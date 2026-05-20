"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  connectBankAccount,
  syncTransactions,
} from "@/server/actions/tresorerie/bank";

import { CashFlowChart } from "./cash-flow-chart";
import { ChargeCreateDrawer } from "./charge-create-drawer";
import { ChargesCard } from "./charges-card";
import { EInvoiceCard } from "./einvoice-card";
import { HeroBalanceCard } from "./hero-balance-card";
import { TransactionsList } from "./transactions-list";

type BankAccount = {
  id: string;
  libelle: string;
  ibanLast4: string | null;
  currentBalance: string | null;
  lastSyncedAt: Date | null;
};

type Transaction = React.ComponentProps<typeof TransactionsList>["transactions"][number];

type Charge = React.ComponentProps<typeof ChargesCard>["charges"][number];

type SparklinePoint = { iso: string; balanceHt: string };

export function TresorerieClient({
  accounts,
  transactions,
  charges,
  sparkline,
  cashFlow,
  kpiEntries,
  kpiExits,
  kpiNet,
  kpiRunway,
  einvoice,
}: {
  accounts: BankAccount[];
  transactions: Transaction[];
  charges: Charge[];
  sparkline: {
    points: SparklinePoint[];
    currentBalanceHt: string;
    deltaHt: string;
  };
  cashFlow: {
    months: React.ComponentProps<typeof CashFlowChart>["months"];
    netCumul: string;
    alertMonthIso: string | null;
    alertThreshold: string;
    alertProjectedBalance: string;
  };
  kpiEntries: number;
  kpiExits: number;
  kpiNet: number;
  kpiRunway: number;
  einvoice: React.ComponentProps<typeof EInvoiceCard>;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const onSync = async () => {
    setSyncing(true);
    try {
      const res = await syncTransactions({});
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const created = res.data?.transactionsCreated ?? 0;
      const reco = res.data?.autoReconciled ?? 0;
      toast.success(
        `Synchronisé · ${created} transactions${reco > 0 ? ` · ${reco} rapprochées auto` : ""}.`,
      );
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const onConnect = async () => {
    setSyncing(true);
    try {
      const res = await connectBankAccount({});
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const c = res.data?.accountsCreated ?? 0;
      const t = res.data?.transactionsCreated ?? 0;
      toast.success(`${c} comptes connectés · ${t} transactions importées.`);
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <EmptyState onConnect={onConnect} connecting={syncing} />
    );
  }

  const lastSync = accounts.reduce<Date | null>((acc, a) => {
    if (!a.lastSyncedAt) return acc;
    if (!acc || a.lastSyncedAt > acc) return a.lastSyncedAt;
    return acc;
  }, null);

  return (
    <>
      <div className="flex items-end justify-between mb-10">
        <div>
          <div
            className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            Cockpit · Pilotage agence
          </div>
          <h1
            className="text-[56px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            Trésorerie
          </h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} · Synchronisé{" "}
            {lastSync
              ? lastSync.toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-4 py-2.5 rounded-2xl text-[13px] font-semibold text-white inline-flex items-center gap-2"
            style={{ background: "var(--text-primary)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter une charge
          </button>
        </div>
      </div>

      <HeroBalanceCard
        totalBalance={sparkline.currentBalanceHt}
        deltaSinceMonthStart={sparkline.deltaHt}
        projectedEndOfMonth={
          cashFlow.months.find((m) => m.isCurrent)?.projectedBalanceHt ??
          sparkline.currentBalanceHt
        }
        accounts={accounts.map((a) => ({
          id: a.id,
          libelle: a.libelle,
          ibanLast4: a.ibanLast4,
          currentBalance: a.currentBalance,
        }))}
        sparkline={sparkline.points}
        onSync={onSync}
        syncing={syncing}
      />

      <div className="grid grid-cols-4 gap-5 mb-8">
        <KpiCard
          label="Entrées du mois"
          value={`${formatK(kpiEntries)}`}
          unit="k€"
          sub={`${transactions.filter((t) => Number(t.amountTtc ?? 0) > 0).length} virements`}
          tone="mint"
          arrow="up"
        />
        <KpiCard
          label="Sorties du mois"
          value={`${formatK(Math.abs(kpiExits))}`}
          unit="k€"
          sub={`Charges fixes ${formatK(charges.filter((c) => c.recurrence === "monthly").reduce((a, c) => a + Number(c.montantHt ?? 0), 0))} k€`}
          tone="light"
          arrow="down"
        />
        <KpiCard
          label="Solde net mois"
          value={`${kpiNet >= 0 ? "+" : ""}${formatK(kpiNet)}`}
          unit="k€"
          sub="entrées − sorties"
          tone="light"
          pill={kpiNet >= 0 ? "+44%" : undefined}
        />
        <KpiCard
          label="Runway projection"
          value={`${kpiRunway.toFixed(1)}`}
          unit="mois"
          sub="à charges constantes sans entrée"
          tone="lilac"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 space-y-6">
          <CashFlowChart
            months={cashFlow.months}
            netCumul={cashFlow.netCumul}
            alertMonthIso={cashFlow.alertMonthIso}
          />
          <TransactionsList transactions={transactions} />
        </div>

        <div className="space-y-6">
          <ChargesCard charges={charges} onAdd={() => setDrawerOpen(true)} />
          <EInvoiceCard {...einvoice} />
          {cashFlow.alertMonthIso && (
            <CashFlowAlertCard
              monthIso={cashFlow.alertMonthIso}
              projectedBalance={cashFlow.alertProjectedBalance}
              threshold={cashFlow.alertThreshold}
            />
          )}
        </div>
      </div>

      <ChargeCreateDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}

function EmptyState({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
        style={{
          background: "linear-gradient(135deg, #1F2DEA 0%, #4F5DFF 100%)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
      <h1
        className="text-[36px] font-bold tracking-tight text-center"
        style={{ letterSpacing: "-0.025em" }}
      >
        Aucun compte bancaire connecté
      </h1>
      <p
        className="text-[15px] mt-4 text-center max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        Connecte tes comptes pro pour visualiser le solde temps réel, la
        catégorisation auto des transactions et le rapprochement automatique
        avec les notes d&apos;honoraires.
      </p>
      <p
        className="text-[13px] mt-3 text-center max-w-md"
        style={{ color: "var(--text-tertiary)" }}
      >
        Mode démo : on connecte 2 comptes fictifs avec un historique de 3 mois.
      </p>
      <div className="mt-8">
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="px-5 py-2.5 rounded-2xl text-[13px] font-semibold text-white"
          style={{ background: "var(--text-primary)" }}
        >
          {connecting ? "Connexion…" : "Connecter une banque (démo)"}
        </button>
      </div>
    </div>
  );
}

function CashFlowAlertCard({
  monthIso,
  projectedBalance,
  threshold,
}: {
  monthIso: string;
  projectedBalance: string;
  threshold: string;
}) {
  const date = new Date(monthIso);
  const monthLabel = date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return (
    <div
      className="p-5 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(59,27,122,0.10)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B1B7A"
            strokeWidth="2.5"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold">Point de vigilance</div>
          <div
            className="text-[11px] mt-1"
            style={{ color: "rgba(59,27,122,0.75)" }}
          >
            En {monthLabel}, le solde projeté tombe sous{" "}
            <span className="font-bold">{formatK(Number(threshold))} k€</span> à{" "}
            <span className="font-bold">
              {formatEuroFull(Number(projectedBalance))} €
            </span>
            . Relance les notes en attente de paiement.
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  tone,
  arrow,
  pill,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  tone: "light" | "dark" | "mint" | "lilac";
  arrow?: "up" | "down";
  pill?: string;
}) {
  const style = (() => {
    switch (tone) {
      case "dark":
        return {
          background: "var(--text-primary)",
          color: "var(--surface)",
        };
      case "mint":
        return {
          background:
            "linear-gradient(135deg, #B8F2D1 0%, #DCFCE7 100%)",
          color: "#064E2C",
        };
      case "lilac":
        return {
          background:
            "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
          color: "#3B1B7A",
        };
      default:
        return { background: "var(--surface)", color: "var(--text-primary)" };
    }
  })();
  const subColor =
    tone === "dark"
      ? "rgba(255,255,255,0.65)"
      : tone === "mint"
        ? "rgba(6,78,44,0.65)"
        : tone === "lilac"
          ? "rgba(59,27,122,0.65)"
          : "var(--text-secondary)";
  const labelColor =
    tone === "dark"
      ? "rgba(255,255,255,0.55)"
      : tone === "mint"
        ? "rgba(6,78,44,0.55)"
        : tone === "lilac"
          ? "rgba(59,27,122,0.55)"
          : "var(--text-tertiary)";

  return (
    <div className="p-7 rounded-3xl" style={style}>
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[12px] uppercase tracking-wider font-semibold"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        {pill && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(22,163,74,0.15)",
              color: "var(--success)",
            }}
          >
            {pill}
          </span>
        )}
        {arrow && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              color: arrow === "up" ? "var(--success)" : "var(--danger)",
              transform: arrow === "down" ? "rotate(135deg)" : "none",
            }}
          >
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 40, letterSpacing: "-0.025em" }}
        >
          {value}
        </div>
        <div
          className="text-[20px] font-semibold ml-1"
          style={{
            opacity: 0.65,
          }}
        >
          {unit}
        </div>
      </div>
      <div className="mt-3 text-[12px]" style={{ color: subColor }}>
        {sub}
      </div>
    </div>
  );
}

function formatK(n: number): string {
  if (Math.abs(n) >= 1000)
    return (n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(".0", "");
  return n.toFixed(0);
}
function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
