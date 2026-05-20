import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  honoraireContracts,
  honoraireMissions,
  honoraireSituations,
} from "@/db/schema/honoraires";
import { operations } from "@/db/schema/operations";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessCockpit,
  getOrganizationOwner,
} from "@/lib/cockpit-access";

import { SubNavCockpit } from "../_components/sub-nav-cockpit";
import { CockpitHonorairesClient } from "./_components/cockpit-honoraires-client";
import { CockpitRestrictedPanel } from "./_components/cockpit-restricted-panel";

export default async function CockpitHonorairesPage() {
  const user = await getCurrentUser();

  if (!(await canAccessCockpit(user, null))) {
    const owner = await getOrganizationOwner(user.organizationId);
    return (
      <div className="px-10 py-10 min-w-0 max-w-[1400px] mx-auto">
        <SubNavCockpit active="honoraires" />
        <CockpitRestrictedPanel ownerName={owner?.name ?? null} />
      </div>
    );
  }

  // Charge contrats + missions + situations agrégés
  const ops = await db.query.operations.findMany({
    where: eq(operations.organizationId, user.organizationId),
    with: { moa: { columns: { raisonSociale: true } } },
  });
  void and;

  const contracts = await db.query.honoraireContracts.findMany({
    with: {
      missions: { orderBy: (t, { asc }) => [asc(t.ordre)] },
      situations: true,
    },
  });

  const opByContract = new Map(
    ops.filter((o) => o.organizationId === user.organizationId).map((o) => [o.id, o]),
  );

  const contractRows = contracts
    .filter((c) => opByContract.has(c.operationId))
    .map((c) => {
      const op = opByContract.get(c.operationId)!;
      const total = Number(c.montantTotalHt ?? 0);

      let cumul = 0;
      let cumulPaid = 0;
      let cumulSent = 0;
      let cumulSigned = 0;
      for (const s of c.situations) {
        const m = Number(s.montantHt ?? 0);
        if (s.statut === "brouillon") continue;
        cumul += m;
        if (s.statut === "payee") cumulPaid += m;
        if (s.statut === "envoyee") cumulSent += m;
        if (s.statut === "signee") cumulSigned += m;
      }

      let avancementPct = 0;
      if (total > 0) {
        for (const m of c.missions) {
          const montantMission =
            m.typeValeur === "pct"
              ? (Number(m.pctDuTotal ?? 0) / 100) * total
              : Number(m.montantHt ?? 0);
          const av = Number(m.pctAvancementCourant ?? 0);
          avancementPct += (montantMission * av) / total;
        }
      }
      return {
        opId: op.id,
        opCode: op.code,
        opName: op.name,
        opStatut: op.statut,
        moaName: op.moa?.raisonSociale ?? null,
        contractId: c.id,
        contractMontantHt: total,
        contractStatut: c.statut,
        cumulFactureHt: cumul,
        cumulPaid,
        cumulSent,
        cumulSigned,
        avancementGlobalPct: avancementPct,
        nbSituations: c.situations.length,
        // Restant à facturer = montant attendu selon avancement réel − cumul facturé
        attendu: (avancementPct / 100) * total,
        missions: c.missions.map((m) => ({
          id: m.id,
          libelle: m.libelle,
          pctAvancementCourant: Number(m.pctAvancementCourant ?? 0),
        })),
      };
    });

  // Pour KPI agrégés
  const totalActifs = contractRows.reduce(
    (acc, c) =>
      acc + (c.contractStatut === "signe" || c.contractStatut === "en_execution" ? c.contractMontantHt : 0),
    0,
  );
  const facture = contractRows.reduce((acc, c) => acc + c.cumulFactureHt, 0);

  // Notes récentes pour activité
  const recentSituationsRaw = await db.query.honoraireSituations.findMany({
    with: {
      contract: {
        with: {
          operation: {
            columns: {
              id: true,
              code: true,
              name: true,
              organizationId: true,
            },
          },
        },
      },
      mission: { columns: { libelle: true } },
    },
    orderBy: (t, { desc }) => [desc(t.dateEmission)],
    limit: 30,
  });
  const recentSituations = recentSituationsRaw
    .filter(
      (r) =>
        r.contract.operation.organizationId === user.organizationId &&
        r.statut !== "brouillon",
    )
    .slice(0, 10);

  const toFacturer = contractRows.reduce(
    (acc, c) => acc + Math.max(0, c.attendu - c.cumulFactureHt),
    0,
  );
  const enAttentePaiement = contractRows.reduce(
    (acc, c) => acc + c.cumulSent + c.cumulSigned,
    0,
  );

  // Pipeline : missions dont l'avancement courant > cumul facturé sur cette mission
  // (en MVP : on prend les missions actives non encore signées à 100%)
  const missionsAFacturer: Array<{
    opCode: string;
    opName: string;
    missionLibelle: string;
    delta: number;
  }> = [];
  for (const c of contractRows) {
    if (c.contractStatut !== "signe" && c.contractStatut !== "en_execution")
      continue;
    for (const m of c.missions) {
      // Ici on ne dispose pas de "facturé sur mission" facile,
      // alors on signale juste les missions avec avancement > 0 et < 100
      if (m.pctAvancementCourant > 0 && m.pctAvancementCourant < 100) {
        missionsAFacturer.push({
          opCode: c.opCode,
          opName: c.opName,
          missionLibelle: m.libelle,
          delta: 100 - m.pctAvancementCourant,
        });
      }
    }
  }

  // Pipeline : en attente signature
  const enAttenteSignature = recentSituations
    .filter((s) => s.statut === "a_valider" || s.statut === "signee")
    .slice(0, 3);

  return (
    <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
      <CockpitHonorairesClient
        contractRows={contractRows}
        totalActifs={totalActifs}
        facture={facture}
        toFacturer={toFacturer}
        enAttentePaiement={enAttentePaiement}
        missionsAFacturer={missionsAFacturer}
        enAttenteSignature={enAttenteSignature.map((s) => ({
          id: s.id,
          numero: s.numero,
          montantHt: Number(s.montantHt ?? 0),
          opCode: s.contract.operation.code,
          opName: s.contract.operation.name,
        }))}
        recentSituations={recentSituations.map((s) => ({
          id: s.id,
          numero: s.numero,
          dateEmission: s.dateEmission,
          montantHt: Number(s.montantHt ?? 0),
          statut: s.statut,
          opCode: s.contract.operation.code,
          opName: s.contract.operation.name,
          missionLibelle: s.mission.libelle,
        }))}
      />
    </div>
  );
}

void honoraireMissions;
void honoraireSituations;

// silence redirect unused
void redirect;
