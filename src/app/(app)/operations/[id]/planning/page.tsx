import Link from "next/link";
import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { listCPsByOperation } from "@/server/actions/operations/cps";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { PlanningClient } from "./_components/planning-client";

export default async function PlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, cpsRes] = await Promise.all([
    getOperationById({ id }),
    listCPsByOperation({ operationId: id }),
  ]);
  if (opRes.error || !opRes.data) notFound();

  const op = opRes.data;
  const cps = cpsRes.data ?? [];

  // % d'avancement par lot = Σ brut HT (CPs non-brouillon) / marché lot révisé.
  const cumulByLot = new Map<string, number>();
  for (const cp of cps) {
    if (cp.statut === "brouillon") continue;
    const cur = cumulByLot.get(cp.lotId) ?? 0;
    cumulByLot.set(cp.lotId, cur + Number(cp.brutAPayerHt));
  }
  const pctByLot: Record<string, number> = {};
  for (const lot of op.lots) {
    const marcheInitial = Number(lot.montantMarcheHt ?? 0);
    const avenantsSignes = lot.avenants
      .filter((a) => a.statut === "signe")
      .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
    const marcheRevise = marcheInitial + avenantsSignes;
    const cumul = cumulByLot.get(lot.id) ?? 0;
    pctByLot[lot.id] = marcheRevise > 0 ? Math.round((cumul / marcheRevise) * 100) : 0;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      <div
        className="flex items-center gap-2 text-[13px] mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link href="/operations" className="hover:text-[var(--text-primary)]">
          Opérations
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/operations/${id}`}
          className="hover:text-[var(--text-primary)]"
        >
          {op.name}
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          Planning
        </span>
      </div>

      <OperationTabs operationId={id} active="planning" />

      <PlanningClient
        operationId={id}
        operationName={op.name}
        planningTasks={op.planningTasks.map((t) => ({
          id: t.id,
          type: t.type,
          lotId: t.lotId,
          libelle: t.libelle,
          dateDebutPrevue: t.dateDebutPrevue,
          dateFinPrevue: t.dateFinPrevue,
          dateDebutReelle: t.dateDebutReelle,
          dateFinReelle: t.dateFinReelle,
          statut: t.statut,
          milestoneKind: t.milestoneKind,
        }))}
        lots={op.lots.map((l) => ({
          id: l.id,
          numero: l.numero,
          libelle: l.libelle,
          company: l.company
            ? { raisonSociale: l.company.raisonSociale }
            : null,
        }))}
        pctByLot={pctByLot}
      />
    </div>
  );
}
