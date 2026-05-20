import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { honoraireSituations } from "@/db/schema/honoraires";
import {
  bankAccounts,
  bankTransactions,
  einvoiceConfigurations,
  recurringCharges,
} from "@/db/schema/tresorerie";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessCockpit,
  getOrganizationOwner,
} from "@/lib/cockpit-access";
import {
  computeCashFlowForecast,
  computeSparkline30d,
} from "@/server/actions/tresorerie/cash-flow";
import { listTransactions } from "@/server/actions/tresorerie/bank";

import { SubNavCockpit } from "../_components/sub-nav-cockpit";
import { CockpitRestrictedPanel } from "../honoraires/_components/cockpit-restricted-panel";
import { TresorerieClient } from "./_components/tresorerie-client";

export default async function CockpitTresoreriePage() {
  const user = await getCurrentUser();
  if (!(await canAccessCockpit(user, null))) {
    const owner = await getOrganizationOwner(user.organizationId);
    return (
      <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
        <SubNavCockpit active="tresorerie" />
        <CockpitRestrictedPanel ownerName={owner?.name ?? null} />
      </div>
    );
  }

  // 1. Comptes
  const accounts = await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.organizationId, user.organizationId),
    orderBy: [desc(bankAccounts.createdAt)],
  });

  // 2. Transactions (40 max pour la liste)
  const txRes = await listTransactions({ limit: 40 });
  const transactions = txRes.data ?? [];

  // 3. Charges récurrentes
  const charges = await db.query.recurringCharges.findMany({
    where: and(
      eq(recurringCharges.organizationId, user.organizationId),
      eq(recurringCharges.active, true),
    ),
    orderBy: [desc(recurringCharges.montantHt)],
  });

  // 4. Sparkline 30j
  const sparkRes = await computeSparkline30d({});
  const sparkline = sparkRes.data ?? {
    points: [],
    currentBalanceHt: "0",
    deltaHt: "0",
  };

  // 5. Cash flow forecast
  const cashFlowRes = await computeCashFlowForecast({ months: 5 });
  const cashFlowData = cashFlowRes.data ?? {
    months: [],
    currentBalanceHt: "0",
    netCumul: "0",
    alert: { threshold: "10000", monthHit: null, projectedBalanceHt: "0" },
  };

  // 6. KPI mois courant
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const accountIds = accounts.map((a) => a.id);
  let kpiEntries = 0;
  let kpiExits = 0;
  if (accountIds.length > 0) {
    const monthTxs = await db.query.bankTransactions.findMany({
      where: and(
        inArray(bankTransactions.bankAccountId, accountIds),
        gte(bankTransactions.transactionDate, monthStart),
      ),
      columns: { amountTtc: true },
    });
    for (const tx of monthTxs) {
      const amt = Number(tx.amountTtc ?? 0);
      if (amt >= 0) kpiEntries += amt;
      else kpiExits += amt;
    }
  }
  const kpiNet = kpiEntries + kpiExits;

  // Runway = solde actuel / charges mensuelles
  const totalBalance = accounts.reduce(
    (acc, a) => acc + Number(a.currentBalance ?? 0),
    0,
  );
  const monthlyCharges = charges
    .filter((c) => c.recurrence === "monthly")
    .reduce((acc, c) => acc + Number(c.montantHt ?? 0), 0);
  const kpiRunway = monthlyCharges > 0 ? totalBalance / monthlyCharges : 0;

  // 7. eInvoice : config + situations récentes + count mois
  const einvoiceConfig = await db.query.einvoiceConfigurations.findFirst({
    where: eq(einvoiceConfigurations.organizationId, user.organizationId),
  });

  const sitsThisMonthRaw = await db.query.honoraireSituations.findMany({
    where: gte(honoraireSituations.dateEmission, monthStart),
    with: {
      contract: {
        with: { operation: { columns: { organizationId: true } } },
      },
    },
  });
  const emittedThisMonth = sitsThisMonthRaw.filter(
    (s) =>
      s.contract.operation.organizationId === user.organizationId &&
      s.statut !== "brouillon",
  ).length;

  const lastEmittedRaw = await db.query.honoraireSituations.findMany({
    with: {
      contract: {
        with: { operation: { columns: { organizationId: true } } },
      },
    },
    orderBy: [desc(honoraireSituations.dateEmission)],
    limit: 20,
  });
  const lastEmitted = lastEmittedRaw
    .filter(
      (s) =>
        s.contract.operation.organizationId === user.organizationId &&
        s.statut !== "brouillon",
    )
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      numero: s.numero,
      montantTtc: s.montantTtc,
      statut: s.statut,
    }));

  return (
    <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
      <SubNavCockpit active="tresorerie" />
      <TresorerieClient
        accounts={accounts.map((a) => ({
          id: a.id,
          libelle: a.libelle,
          ibanLast4: a.ibanLast4,
          currentBalance: a.currentBalance,
          lastSyncedAt: a.lastSyncedAt,
        }))}
        transactions={transactions.map((t) => ({
          id: t.id,
          transactionDate: t.transactionDate,
          amountTtc: t.amountTtc,
          libelle: t.libelle,
          category: t.category,
          needsReconciliation: t.needsReconciliation,
          invoiceAttachedAt: t.invoiceAttachedAt,
          linkedHonoraireSituationId: t.linkedHonoraireSituationId,
          bankAccount: t.bankAccount,
          linkedHonoraireSituation: t.linkedHonoraireSituation,
        }))}
        charges={charges.map((c) => ({
          id: c.id,
          libelle: c.libelle,
          category: c.category,
          montantHt: c.montantHt,
          tauxTva: c.tauxTva,
          recurrence: c.recurrence,
        }))}
        sparkline={sparkline}
        cashFlow={{
          months: cashFlowData.months,
          netCumul: cashFlowData.netCumul,
          alertMonthIso: cashFlowData.alert.monthHit,
          alertThreshold: cashFlowData.alert.threshold,
          alertProjectedBalance: cashFlowData.alert.projectedBalanceHt,
        }}
        kpiEntries={kpiEntries}
        kpiExits={kpiExits}
        kpiNet={kpiNet}
        kpiRunway={kpiRunway}
        einvoice={{
          pdpProvider: einvoiceConfig?.provider ?? null,
          emittedThisMonth,
          receivedThisMonth: 8, // mock receivedInvoices length
          lastEmitted,
        }}
      />
    </div>
  );
}
