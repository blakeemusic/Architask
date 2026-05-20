"use server";

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { companies, insurances } from "@/db/schema/annuaire";
import { siteMeetings } from "@/db/schema/cr";
import { certificatsPaiement } from "@/db/schema/finance";
import {
  honoraireContracts,
  honoraireSituations,
} from "@/db/schema/honoraires";
import {
  avenants,
  dgds,
  lots,
  operations,
  planningTasks,
  retentions,
} from "@/db/schema/operations";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { computeInsuranceStatus } from "@/lib/validation/insurance";
import { type ActionResult, ok, withAction } from "@/server/actions/_helpers";

// ============================================================
// Types publics
// ============================================================

export type DashboardActivityPoint = {
  /** YYYY-MM (key utilisable côté client). */
  ym: string;
  /** Date du 1er du mois. */
  monthStart: Date;
  /** Σ brut HT des CP émis (statut ≠ brouillon) signés ce mois. */
  cpEmitHt: number;
  /** Σ TTC des situations d'honoraires (statut ≠ brouillon) ce mois. */
  honosFacturesTtc: number;
  /** Σ brut HT des CP payés ce mois (paidAt). */
  encaisseHt: number;
  /** Compte des avenants signés ce mois (non financier). */
  avenantsSignedCount: number;
  /** Compte des jalons franchis ce mois (dateFinReelle dans le mois). */
  jalonsCompletedCount: number;
  /** Compte des réunions de chantier ce mois. */
  meetingsCount: number;
};

export type DashboardActivityTotals = {
  cpEmitHt: number;
  honosFacturesTtc: number;
  encaisseHt: number;
  /** Variation YTD vs N-1 sur encaissé. Null si N-1 = 0. */
  encaisseYoyPct: number | null;
  opsActiveCount: number;
  meetingsCount: number;
  avenantsSignedCount: number;
  jalonsCompletedCount: number;
};

export type DashboardDeadline = {
  id: string;
  date: Date;
  kind: "meeting" | "reception" | "payment" | "retention";
  title: string;
  subtitle: string;
  /** Montant facultatif (CP, retenue). */
  amountHt?: string;
  operationId: string;
};

export type DashboardTodo = {
  cpToSign: number;
  dgdToFinalize: number;
  decennalesExpiringSoon: number;
  retentionsToRelease: number;
  total: number;
};

export type DashboardPortfolio = {
  /** Σ marché révisé sur les ops actives. */
  totalCaHt: number;
  opsActiveCount: number;
  /** Avancement moyen pondéré (par marché révisé). */
  avgAvancementPct: number;
};

export type DashboardActiveOp = {
  id: string;
  code: string;
  name: string;
  moaName: string | null;
  lotsCount: number;
  avancementPct: number;
  /** Badge calculé : à jour / CP attente / OPR / Avenants 15%+ / DGD. */
  badge: "a_jour" | "cp_attente" | "opr" | "avenants_15" | "dgd";
};

export type DashboardExpiringDecennale = {
  id: string;
  companyName: string;
  dateFin: Date;
};

export type DashboardNextMeeting = {
  date: Date;
  title: string;
  operationName: string;
} | null;

export type DashboardData = {
  userName: string;
  today: Date;
  canFinance: boolean;
  activitySeries: DashboardActivityPoint[];
  activityTotals: DashboardActivityTotals;
  deadlines: DashboardDeadline[];
  todo: DashboardTodo;
  portfolio: DashboardPortfolio;
  activeOperations: DashboardActiveOp[];
  expiringDecennales: DashboardExpiringDecennale[];
  nextMeeting: DashboardNextMeeting;
};

// ============================================================
// Action publique
// ============================================================

const ACTIVE_OP_STATUTS = ["signe", "en_execution", "en_reception"] as const;

export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    const today = new Date();
    const canFinance = await canAccessCockpit({
      userId: user.userId,
      organizationId: user.organizationId,
      role: user.role,
    });

    // Toutes les ops de l'org (utile pour scoper les sous-queries).
    const orgOps = await db.query.operations.findMany({
      where: and(
        eq(operations.organizationId, user.organizationId),
        isNull(operations.archivedAt),
      ),
      columns: {
        id: true,
        code: true,
        name: true,
        statut: true,
        dateOs: true,
        dateReceptionCible: true,
        moaId: true,
        updatedAt: true,
      },
      with: {
        moa: { columns: { raisonSociale: true } },
        lots: {
          columns: { id: true, montantMarcheHt: true, statut: true },
          with: {
            avenants: { columns: { montantHt: true, statut: true } },
          },
        },
      },
    });
    const orgOpIds = orgOps.map((o) => o.id);

    if (orgOpIds.length === 0) {
      return ok(emptyDashboard(user.name, today, canFinance));
    }

    const [activity, deadlinesAll, todoCounts, expiringList, nextMeetingRow] =
      await Promise.all([
        fetchActivity(orgOpIds, today),
        fetchDeadlines(orgOpIds, today),
        fetchTodoCounts(user.organizationId, orgOpIds, today),
        fetchExpiringDecennales(user.organizationId, today),
        fetchNextMeeting(orgOpIds, today),
      ]);

    // Portfolio + active ops calculés à partir de orgOps déjà chargées.
    const activeOps = orgOps.filter((o) =>
      (ACTIVE_OP_STATUTS as readonly string[]).includes(o.statut),
    );

    // Cumul CP non-brouillon par opération (utile pour avancement financier).
    const cpsAllAgg = await db
      .select({
        operationId: certificatsPaiement.operationId,
        cumulHt: sql<string>`COALESCE(SUM(${certificatsPaiement.brutAPayerHt}), 0)::text`,
      })
      .from(certificatsPaiement)
      .where(
        and(
          inArray(certificatsPaiement.operationId, orgOpIds),
          sql`${certificatsPaiement.statut} <> 'brouillon'`,
        ),
      )
      .groupBy(certificatsPaiement.operationId);
    const cumulByOp = new Map<string, number>(
      cpsAllAgg.map((r) => [r.operationId, Number(r.cumulHt)]),
    );

    const portfolio = computePortfolio(activeOps, cumulByOp);
    const activeOperations = computeActiveOpsList(
      activeOps,
      cumulByOp,
      today,
    ).slice(0, 5);

    const deadlines = deadlinesAll.slice(0, 4);

    return ok({
      userName: user.name,
      today,
      canFinance,
      activitySeries: activity.series,
      activityTotals: {
        ...activity.totals,
        opsActiveCount: activeOps.length,
      },
      deadlines,
      todo: todoCounts,
      portfolio,
      activeOperations,
      expiringDecennales: expiringList,
      nextMeeting: nextMeetingRow,
    });
  });
}

// ============================================================
// Sub-fetchers
// ============================================================

async function fetchActivity(
  orgOpIds: string[],
  today: Date,
): Promise<{
  series: DashboardActivityPoint[];
  totals: Omit<DashboardActivityTotals, "opsActiveCount">;
}> {
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  // Année N-1 pour YoY YTD encaissé
  const startPrevYear = new Date(start.getFullYear() - 1, start.getMonth(), 1);
  const endPrevYearYtd = new Date(
    today.getFullYear() - 1,
    today.getMonth() + 1,
    1,
  );

  const [
    cps,
    cpsPrev,
    honos,
    avenantsRows,
    jalonsRows,
    meetingsRows,
  ] = await Promise.all([
    db.query.certificatsPaiement.findMany({
      where: and(
        inArray(certificatsPaiement.operationId, orgOpIds),
        sql`${certificatsPaiement.statut} <> 'brouillon'`,
        gte(certificatsPaiement.createdAt, start),
      ),
      columns: {
        brutAPayerHt: true,
        signedAt: true,
        paidAt: true,
        createdAt: true,
        statut: true,
      },
    }),
    db.query.certificatsPaiement.findMany({
      where: and(
        inArray(certificatsPaiement.operationId, orgOpIds),
        sql`${certificatsPaiement.statut} <> 'brouillon'`,
        gte(certificatsPaiement.paidAt, startPrevYear),
        sql`${certificatsPaiement.paidAt} < ${endPrevYearYtd}`,
      ),
      columns: { brutAPayerHt: true, paidAt: true },
    }),
    db
      .select({
        montantTtc: honoraireSituations.montantTtc,
        signedAt: honoraireSituations.signedAt,
        createdAt: honoraireSituations.createdAt,
        statut: honoraireSituations.statut,
      })
      .from(honoraireSituations)
      .innerJoin(
        honoraireContracts,
        eq(honoraireSituations.contractId, honoraireContracts.id),
      )
      .where(
        and(
          inArray(honoraireContracts.operationId, orgOpIds),
          sql`${honoraireSituations.statut} <> 'brouillon'`,
          gte(honoraireSituations.createdAt, start),
        ),
      ),
    // Avenants signés (référence = date_signature, fallback updated_at)
    db
      .select({
        dateSignature: avenants.dateSignature,
        updatedAt: avenants.updatedAt,
      })
      .from(avenants)
      .innerJoin(lots, eq(avenants.lotId, lots.id))
      .where(
        and(
          inArray(lots.operationId, orgOpIds),
          eq(avenants.statut, "signe"),
          gte(avenants.updatedAt, start),
        ),
      ),
    // Jalons franchis (dateFinReelle dans la fenêtre)
    db
      .select({
        dateFinReelle: planningTasks.dateFinReelle,
      })
      .from(planningTasks)
      .where(
        and(
          inArray(planningTasks.operationId, orgOpIds),
          gte(planningTasks.dateFinReelle, start),
        ),
      ),
    // Réunions chantier
    db
      .select({ date: siteMeetings.date })
      .from(siteMeetings)
      .where(
        and(
          inArray(siteMeetings.operationId, orgOpIds),
          gte(siteMeetings.date, start),
        ),
      ),
  ]);

  // Build empty buckets
  const seriesMap = new Map<string, DashboardActivityPoint>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    seriesMap.set(ym, {
      ym,
      monthStart: d,
      cpEmitHt: 0,
      honosFacturesTtc: 0,
      encaisseHt: 0,
      avenantsSignedCount: 0,
      jalonsCompletedCount: 0,
      meetingsCount: 0,
    });
  }
  const bumpKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (const cp of cps) {
    const refDate = cp.signedAt ?? cp.createdAt ?? null;
    if (refDate) {
      const k = bumpKey(refDate);
      const b = seriesMap.get(k);
      if (b) b.cpEmitHt += Number(cp.brutAPayerHt ?? 0);
    }
    if (cp.paidAt) {
      const k = bumpKey(cp.paidAt);
      const b = seriesMap.get(k);
      if (b) b.encaisseHt += Number(cp.brutAPayerHt ?? 0);
    }
  }
  for (const h of honos) {
    const refDate = h.signedAt ?? h.createdAt ?? null;
    if (refDate) {
      const k = bumpKey(refDate);
      const b = seriesMap.get(k);
      if (b) b.honosFacturesTtc += Number(h.montantTtc ?? 0);
    }
  }
  for (const a of avenantsRows) {
    const refDate = a.dateSignature ?? a.updatedAt;
    if (refDate) {
      const k = bumpKey(refDate);
      const b = seriesMap.get(k);
      if (b) b.avenantsSignedCount += 1;
    }
  }
  for (const j of jalonsRows) {
    if (j.dateFinReelle) {
      const k = bumpKey(j.dateFinReelle);
      const b = seriesMap.get(k);
      if (b) b.jalonsCompletedCount += 1;
    }
  }
  for (const m of meetingsRows) {
    const k = bumpKey(m.date);
    const b = seriesMap.get(k);
    if (b) b.meetingsCount += 1;
  }

  const series = Array.from(seriesMap.values());

  // YTD totals (depuis 1er janvier de l'année courante)
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const ytd = series.filter((p) => p.monthStart >= yearStart);
  const totals = ytd.reduce(
    (acc, p) => {
      acc.cpEmitHt += p.cpEmitHt;
      acc.honosFacturesTtc += p.honosFacturesTtc;
      acc.encaisseHt += p.encaisseHt;
      acc.meetingsCount += p.meetingsCount;
      acc.avenantsSignedCount += p.avenantsSignedCount;
      acc.jalonsCompletedCount += p.jalonsCompletedCount;
      return acc;
    },
    {
      cpEmitHt: 0,
      honosFacturesTtc: 0,
      encaisseHt: 0,
      meetingsCount: 0,
      avenantsSignedCount: 0,
      jalonsCompletedCount: 0,
    },
  );

  const prevYearEncaisse = cpsPrev.reduce(
    (s, cp) => s + Number(cp.brutAPayerHt ?? 0),
    0,
  );
  const yoy =
    prevYearEncaisse > 0
      ? Math.round(
          ((totals.encaisseHt - prevYearEncaisse) / prevYearEncaisse) * 100,
        )
      : null;

  return {
    series,
    totals: { ...totals, encaisseYoyPct: yoy },
  };
}

async function fetchDeadlines(
  orgOpIds: string[],
  today: Date,
): Promise<DashboardDeadline[]> {
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);

  const [meetings, receptions, payments, libRetenues] = await Promise.all([
    db
      .select({
        id: siteMeetings.id,
        date: siteMeetings.date,
        type: siteMeetings.type,
        opId: siteMeetings.operationId,
        opName: operations.name,
      })
      .from(siteMeetings)
      .innerJoin(operations, eq(siteMeetings.operationId, operations.id))
      .where(
        and(
          inArray(siteMeetings.operationId, orgOpIds),
          gte(siteMeetings.date, today),
          lte(siteMeetings.date, horizon),
        ),
      ),
    db
      .select({
        id: planningTasks.id,
        date: planningTasks.dateDebutPrevue,
        opId: planningTasks.operationId,
        opName: operations.name,
        milestoneKind: planningTasks.milestoneKind,
      })
      .from(planningTasks)
      .innerJoin(operations, eq(planningTasks.operationId, operations.id))
      .where(
        and(
          inArray(planningTasks.operationId, orgOpIds),
          sql`${planningTasks.milestoneKind} IN ('reception', 'dgd')`,
          gte(planningTasks.dateDebutPrevue, today),
          lte(planningTasks.dateDebutPrevue, horizon),
        ),
      ),
    db
      .select({
        id: certificatsPaiement.id,
        date: certificatsPaiement.dueDate,
        amountHt: certificatsPaiement.brutAPayerHt,
        opId: certificatsPaiement.operationId,
        opName: operations.name,
        numero: certificatsPaiement.numero,
      })
      .from(certificatsPaiement)
      .innerJoin(operations, eq(certificatsPaiement.operationId, operations.id))
      .where(
        and(
          inArray(certificatsPaiement.operationId, orgOpIds),
          sql`${certificatsPaiement.statut} IN ('signe', 'envoye')`,
          gte(certificatsPaiement.dueDate, today),
          lte(certificatsPaiement.dueDate, horizon),
        ),
      ),
    db
      .select({
        id: retentions.id,
        date: retentions.echeanceLiberation,
        amountHt: retentions.montantRetenu,
        opId: lots.operationId,
        opName: operations.name,
      })
      .from(retentions)
      .innerJoin(lots, eq(retentions.lotId, lots.id))
      .innerJoin(operations, eq(lots.operationId, operations.id))
      .where(
        and(
          inArray(lots.operationId, orgOpIds),
          eq(retentions.statut, "en_cours"),
          gte(retentions.echeanceLiberation, today),
          lte(retentions.echeanceLiberation, horizon),
        ),
      ),
  ]);

  const all: DashboardDeadline[] = [
    ...meetings.map<DashboardDeadline>((m) => ({
      id: `meeting-${m.id}`,
      date: m.date,
      kind: "meeting",
      title:
        m.type === "opr"
          ? "Réception OPR"
          : m.type === "livraison"
            ? "Livraison"
            : "Réunion chantier",
      subtitle: m.opName,
      operationId: m.opId,
    })),
    ...receptions
      .filter((r) => r.date)
      .map<DashboardDeadline>((r) => ({
        id: `reception-${r.id}`,
        date: r.date as Date,
        kind: "reception",
        title: r.milestoneKind === "dgd" ? "DGD" : "Réception",
        subtitle: r.opName,
        operationId: r.opId,
      })),
    ...payments
      .filter((p) => p.date)
      .map<DashboardDeadline>((p) => ({
        id: `payment-${p.id}`,
        date: p.date as Date,
        kind: "payment",
        title: "Échéance paiement CP",
        subtitle: `${p.opName} · ${p.numero}`,
        amountHt: p.amountHt,
        operationId: p.opId,
      })),
    ...libRetenues.map<DashboardDeadline>((r) => ({
      id: `retention-${r.id}`,
      date: r.date,
      kind: "retention",
      title: "Libération retenue",
      subtitle: r.opName,
      amountHt: r.amountHt,
      operationId: r.opId,
    })),
  ];
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  return all;
}

async function fetchTodoCounts(
  orgId: string,
  orgOpIds: string[],
  today: Date,
): Promise<DashboardTodo> {
  const [cpAgg, dgdAgg, decAgg, retAgg] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(certificatsPaiement)
      .where(
        and(
          inArray(certificatsPaiement.operationId, orgOpIds),
          sql`${certificatsPaiement.statut} IN ('brouillon', 'a_valider')`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(dgds)
      .innerJoin(lots, eq(dgds.lotId, lots.id))
      .where(
        and(
          inArray(lots.operationId, orgOpIds),
          sql`${dgds.statut} IN ('brouillon', 'a_valider')`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(insurances)
      .innerJoin(companies, eq(insurances.companyId, companies.id))
      .where(
        and(
          eq(companies.organizationId, orgId),
          sql`${insurances.type} = 'decennale'`,
          sql`${insurances.status} = 'expirant_60j'`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(retentions)
      .innerJoin(lots, eq(retentions.lotId, lots.id))
      .where(
        and(
          inArray(lots.operationId, orgOpIds),
          eq(retentions.statut, "en_cours"),
          lte(retentions.echeanceLiberation, today),
        ),
      ),
  ]);

  const cpToSign = cpAgg[0]?.n ?? 0;
  const dgdToFinalize = dgdAgg[0]?.n ?? 0;
  const decennalesExpiringSoon = decAgg[0]?.n ?? 0;
  const retentionsToRelease = retAgg[0]?.n ?? 0;
  return {
    cpToSign,
    dgdToFinalize,
    decennalesExpiringSoon,
    retentionsToRelease,
    total:
      cpToSign + dgdToFinalize + decennalesExpiringSoon + retentionsToRelease,
  };
}

async function fetchExpiringDecennales(
  orgId: string,
  today: Date,
): Promise<DashboardExpiringDecennale[]> {
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 60);
  const rows = await db
    .select({
      id: insurances.id,
      companyName: companies.raisonSociale,
      dateFin: insurances.dateFin,
    })
    .from(insurances)
    .innerJoin(companies, eq(insurances.companyId, companies.id))
    .where(
      and(
        eq(companies.organizationId, orgId),
        sql`${insurances.type} = 'decennale'`,
        gte(insurances.dateFin, today),
        lte(insurances.dateFin, horizon),
      ),
    )
    .orderBy(asc(insurances.dateFin))
    .limit(5);
  // Filtre supplémentaire avec computeInsuranceStatus pour bénéficier de la logique pure.
  return rows.filter(
    (r) =>
      computeInsuranceStatus({ dateFin: r.dateFin }, today) === "expirant_60j",
  );
}

async function fetchNextMeeting(
  orgOpIds: string[],
  today: Date,
): Promise<DashboardNextMeeting> {
  const [row] = await db
    .select({
      date: siteMeetings.date,
      type: siteMeetings.type,
      opName: operations.name,
    })
    .from(siteMeetings)
    .innerJoin(operations, eq(siteMeetings.operationId, operations.id))
    .where(
      and(
        inArray(siteMeetings.operationId, orgOpIds),
        gte(siteMeetings.date, today),
      ),
    )
    .orderBy(asc(siteMeetings.date))
    .limit(1);
  if (!row) return null;
  return {
    date: row.date,
    title:
      row.type === "opr"
        ? "Réception OPR"
        : row.type === "livraison"
          ? "Livraison"
          : row.type === "visite_libre"
            ? "Visite chantier"
            : "Réunion chantier",
    operationName: row.opName,
  };
}

// ============================================================
// Computed (pas de DB ici)
// ============================================================

type LotForCompute = {
  id: string;
  montantMarcheHt: string | null;
  statut: string;
  avenants: { montantHt: string | null; statut: string }[];
};

type OpForCompute = {
  id: string;
  code: string;
  name: string;
  statut: string;
  dateOs: Date | null;
  dateReceptionCible: Date | null;
  updatedAt: Date | null;
  moa: { raisonSociale: string } | null;
  lots: LotForCompute[];
};

function marcheReviseFromLots(lotsList: LotForCompute[]): number {
  let total = 0;
  for (const l of lotsList) {
    total += Number(l.montantMarcheHt ?? 0);
    for (const a of l.avenants) {
      if (a.statut === "signe") total += Number(a.montantHt ?? 0);
    }
  }
  return total;
}

function computePortfolio(
  activeOps: OpForCompute[],
  cumulByOp: Map<string, number>,
): DashboardPortfolio {
  let totalCa = 0;
  let weighted = 0;
  for (const op of activeOps) {
    const marche = marcheReviseFromLots(op.lots);
    totalCa += marche;
    if (marche > 0) {
      const cumul = cumulByOp.get(op.id) ?? 0;
      const pct = Math.min(100, (cumul / marche) * 100);
      weighted += pct * marche;
    }
  }
  const avg = totalCa > 0 ? Math.round(weighted / totalCa) : 0;
  return {
    totalCaHt: Math.round(totalCa),
    opsActiveCount: activeOps.length,
    avgAvancementPct: avg,
  };
}

function computeActiveOpsList(
  activeOps: OpForCompute[],
  cumulByOp: Map<string, number>,
  today: Date,
): DashboardActiveOp[] {
  return activeOps
    .map((op) => {
      const marche = marcheReviseFromLots(op.lots);
      const cumul = cumulByOp.get(op.id) ?? 0;
      let pct = 0;
      if (marche > 0 && cumul > 0) {
        pct = Math.min(100, Math.round((cumul / marche) * 100));
      } else if (op.dateOs && op.dateReceptionCible) {
        const total = op.dateReceptionCible.getTime() - op.dateOs.getTime();
        if (total > 0) {
          pct = Math.max(
            0,
            Math.min(100, Math.round(((today.getTime() - op.dateOs.getTime()) / total) * 100)),
          );
        }
      }
      const marcheInitial = op.lots.reduce(
        (s, l) => s + Number(l.montantMarcheHt ?? 0),
        0,
      );
      const avenantsSignes = op.lots.reduce(
        (s, l) =>
          s +
          l.avenants
            .filter((a) => a.statut === "signe")
            .reduce((ss, a) => ss + Number(a.montantHt ?? 0), 0),
        0,
      );
      const avenantsDerivePct =
        marcheInitial > 0 ? (avenantsSignes / marcheInitial) * 100 : 0;
      const badge: DashboardActiveOp["badge"] =
        op.statut === "en_reception"
          ? "opr"
          : op.statut === "dgd"
            ? "dgd"
            : avenantsDerivePct > 15
              ? "avenants_15"
              : pct < 50 && cumul === 0
                ? "cp_attente"
                : "a_jour";
      return {
        id: op.id,
        code: op.code,
        name: op.name,
        moaName: op.moa?.raisonSociale ?? null,
        lotsCount: op.lots.length,
        avancementPct: pct,
        badge,
        _activity: op.updatedAt?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b._activity - a._activity)
    .map(({ _activity, ...rest }) => {
      void _activity;
      return rest;
    });
}

function emptyDashboard(
  userName: string,
  today: Date,
  canFinance: boolean,
): DashboardData {
  return {
    userName,
    today,
    canFinance,
    activitySeries: [],
    activityTotals: {
      cpEmitHt: 0,
      honosFacturesTtc: 0,
      encaisseHt: 0,
      encaisseYoyPct: null,
      opsActiveCount: 0,
      meetingsCount: 0,
      avenantsSignedCount: 0,
      jalonsCompletedCount: 0,
    },
    deadlines: [],
    todo: {
      cpToSign: 0,
      dgdToFinalize: 0,
      decennalesExpiringSoon: 0,
      retentionsToRelease: 0,
      total: 0,
    },
    portfolio: { totalCaHt: 0, opsActiveCount: 0, avgAvancementPct: 0 },
    activeOperations: [],
    expiringDecennales: [],
    nextMeeting: null,
  };
}

// Suppression d'imports inutilisés
void desc;
