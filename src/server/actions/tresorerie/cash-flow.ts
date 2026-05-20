"use server";

import { Decimal } from "decimal.js";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { honoraireSituations } from "@/db/schema/honoraires";
import {
  bankAccounts,
  bankTransactions,
  recurringCharges,
} from "@/db/schema/tresorerie";
import { canAccessCockpit } from "@/lib/cockpit-access";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Types public
// ---------------------------------------------------------------

export type CashFlowMonth = {
  label: string;
  iso: string; // YYYY-MM-01
  isCurrent: boolean;
  entriesHt: string;
  exitsHt: string;
  netHt: string;
  projectedBalanceHt: string;
};

export type CashFlowForecast = {
  months: CashFlowMonth[];
  currentBalanceHt: string;
  netCumul: string;
  alert: {
    threshold: string;
    monthHit: string | null;
    projectedBalanceHt: string;
  };
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
}

function recurrenceMonths(rec: "monthly" | "quarterly" | "yearly" | "punctual") {
  switch (rec) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
    default:
      return 0; // ponctuel : pas répété
  }
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

const ForecastSchema = z.object({
  months: z.number().int().min(1).max(12).optional(),
  thresholdHt: z.string().optional(),
});

export async function computeCashFlowForecast(
  rawInput: z.input<typeof ForecastSchema>,
): Promise<ActionResult<CashFlowForecast>> {
  return withAction(ForecastSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const monthsAhead = input.months ?? 5;
    const threshold = new Decimal(input.thresholdHt ?? "10000");

    // 1. Solde actuel = Σ currentBalance des bank_accounts
    const orgAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
    });
    const accountIds = orgAccounts.map((a) => a.id);
    const currentBalance = orgAccounts.reduce(
      (acc, a) => acc.plus(a.currentBalance ?? "0"),
      new Decimal(0),
    );

    // 2. Construit les buckets mois (mois courant + N suivants)
    const today = new Date();
    const currentMonth = startOfMonth(today);

    type MonthBucket = {
      start: Date;
      label: string;
      iso: string;
      isCurrent: boolean;
      entries: Decimal;
      exits: Decimal;
    };
    const buckets: MonthBucket[] = [];
    for (let i = 0; i <= monthsAhead; i += 1) {
      const m = new Date(currentMonth);
      m.setMonth(m.getMonth() + i);
      buckets.push({
        start: m,
        label: monthLabel(m),
        iso: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`,
        isCurrent: i === 0,
        entries: new Decimal(0),
        exits: new Decimal(0),
      });
    }

    // 3. Mois courant : on prend les transactions réelles déjà passées
    if (accountIds.length > 0) {
      const txs = await db.query.bankTransactions.findMany({
        where: and(
          inArray(bankTransactions.bankAccountId, accountIds),
          gte(bankTransactions.transactionDate, buckets[0].start),
          lte(bankTransactions.transactionDate, endOfMonth(buckets[0].start)),
        ),
      });
      for (const tx of txs) {
        const amt = new Decimal(tx.amountTtc ?? "0");
        if (amt.gte(0)) buckets[0].entries = buckets[0].entries.plus(amt);
        else buckets[0].exits = buckets[0].exits.plus(amt.abs());
      }
    }

    // 4. Entrées prévisionnelles : NH envoyées non payées → tombent sur le
    //    mois (dateEmission + delaiPaiement) du contrat.
    const sitsRaw = await db.query.honoraireSituations.findMany({
      where: inArray(honoraireSituations.statut, ["envoyee", "signee"]),
      with: {
        contract: {
          with: {
            operation: { columns: { organizationId: true } },
          },
        },
      },
    });
    const sits = sitsRaw.filter(
      (s) => s.contract.operation.organizationId === user.organizationId,
    );
    for (const s of sits) {
      const due = new Date(s.dateEmission);
      due.setDate(
        due.getDate() + (s.contract.delaiPaiementJours ?? 30) + 5,
      );
      const bucket = buckets.find(
        (b) =>
          due.getFullYear() === b.start.getFullYear() &&
          due.getMonth() === b.start.getMonth(),
      );
      if (bucket) {
        bucket.entries = bucket.entries.plus(s.montantTtc ?? "0");
      }
    }

    // 5. Sorties prévisionnelles : charges récurrentes répliquées sur les
    //    mois selon recurrence.
    const charges = await db.query.recurringCharges.findMany({
      where: and(
        eq(recurringCharges.organizationId, user.organizationId),
        eq(recurringCharges.active, true),
      ),
    });
    for (const charge of charges) {
      const step = recurrenceMonths(charge.recurrence);
      const amount = new Decimal(charge.montantHt ?? "0").mul(
        new Decimal("1").plus(new Decimal(charge.tauxTva ?? "20").div(100)),
      );
      if (step === 0) continue;
      for (let i = 0; i < buckets.length; i += 1) {
        // Mensuel : toutes occurrences. Trimestriel : tous les 3 mois.
        // Annuel : 1 fois selon nextDueDate ou mois de référence.
        if (charge.recurrence === "monthly") {
          buckets[i].exits = buckets[i].exits.plus(amount);
        } else if (charge.recurrence === "quarterly") {
          if (i % 3 === 0) buckets[i].exits = buckets[i].exits.plus(amount);
        } else if (charge.recurrence === "yearly") {
          if (i === 0) buckets[i].exits = buckets[i].exits.plus(amount);
        }
      }
    }

    // 6. Solde projeté cumulatif
    let running = new Decimal(currentBalance);
    const months: CashFlowMonth[] = buckets.map((b) => {
      const net = b.entries.minus(b.exits);
      if (!b.isCurrent) {
        // pour le mois courant, on a déjà observé les transactions passées —
        // mais le solde "actuel" inclut déjà ces flux. On n'applique le net
        // que pour les mois futurs.
        running = running.plus(net);
      }
      return {
        label: b.label,
        iso: b.iso,
        isCurrent: b.isCurrent,
        entriesHt: b.entries.toFixed(2),
        exitsHt: b.exits.toFixed(2),
        netHt: net.toFixed(2),
        projectedBalanceHt: running.toFixed(2),
      };
    });

    // 7. Alerte cash flow
    let monthHit: string | null = null;
    let projectedHit = new Decimal(currentBalance);
    for (const m of months) {
      if (new Decimal(m.projectedBalanceHt).lt(threshold)) {
        monthHit = m.iso;
        projectedHit = new Decimal(m.projectedBalanceHt);
        break;
      }
    }

    const netCumul = months.reduce(
      (acc, m) => acc.plus(m.entriesHt).minus(m.exitsHt),
      new Decimal(0),
    );

    return ok({
      months,
      currentBalanceHt: currentBalance.toFixed(2),
      netCumul: netCumul.toFixed(2),
      alert: {
        threshold: threshold.toFixed(2),
        monthHit,
        projectedBalanceHt: projectedHit.toFixed(2),
      },
    });
  });
}

/**
 * Sparkline 30j : evolution du solde sur les 30 derniers jours,
 * en partant du solde actuel et en remontant via les transactions.
 */
const SparklineSchema = z.object({
  days: z.number().int().min(7).max(90).optional(),
});

export async function computeSparkline30d(
  rawInput: z.input<typeof SparklineSchema>,
): Promise<
  ActionResult<{
    points: Array<{ iso: string; balanceHt: string }>;
    currentBalanceHt: string;
    deltaHt: string;
  }>
> {
  return withAction(SparklineSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const days = input.days ?? 30;
    const orgAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
    });
    if (orgAccounts.length === 0) {
      return ok({ points: [], currentBalanceHt: "0.00", deltaHt: "0.00" });
    }
    const currentBalance = orgAccounts.reduce(
      (acc, a) => acc.plus(a.currentBalance ?? "0"),
      new Decimal(0),
    );

    const since = new Date();
    since.setDate(since.getDate() - days);

    const accountIds = orgAccounts.map((a) => a.id);
    const txs = await db.query.bankTransactions.findMany({
      where: and(
        inArray(bankTransactions.bankAccountId, accountIds),
        gte(bankTransactions.transactionDate, since),
      ),
      orderBy: [asc(bankTransactions.transactionDate)],
    });

    // Strat : partir du solde actuel, soustraire les transactions une par une
    // EN REMONTANT pour trouver le solde de chaque jour.
    // Plus pratique : récupère le solde de fin de chaque jour ET assigne
    // un running balance "à rebours".
    // Step 1 : on calcule le total des net flows sur la période → balance à
    // J-days = current - sumNet
    const sumNet = txs.reduce(
      (acc, t) => acc.plus(t.amountTtc ?? "0"),
      new Decimal(0),
    );
    let running = currentBalance.minus(sumNet);

    // Step 2 : trie jour par jour
    const byDay = new Map<string, Decimal>();
    for (const t of txs) {
      const iso = t.transactionDate.toISOString().slice(0, 10);
      const cur = byDay.get(iso) ?? new Decimal(0);
      byDay.set(iso, cur.plus(t.amountTtc ?? "0"));
    }

    const points: Array<{ iso: string; balanceHt: string }> = [];
    for (let i = 0; i <= days; i += 1) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const flow = byDay.get(iso) ?? new Decimal(0);
      running = running.plus(flow);
      points.push({ iso, balanceHt: running.toFixed(2) });
    }

    const startBalance =
      points.length > 0 ? new Decimal(points[0].balanceHt) : currentBalance;
    const delta = currentBalance.minus(startBalance);

    return ok({
      points,
      currentBalanceHt: currentBalance.toFixed(2),
      deltaHt: delta.toFixed(2),
    });
  });
}

void desc;
