import { Decimal } from "decimal.js";
import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { expenseInvoices } from "@/db/schema/tresorerie";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessCockpit,
  getOrganizationOwner,
} from "@/lib/cockpit-access";
import { listMissingInvoiceTransactions, computeVatSummary } from "@/server/actions/tresorerie/expense-invoices";

import { SubNavCockpit } from "../_components/sub-nav-cockpit";
import { CockpitRestrictedPanel } from "../honoraires/_components/cockpit-restricted-panel";
import { CaptureMobileCard } from "./_components/capture-mobile-card";
import { InboxList } from "./_components/inbox-list";
import { VatSummaryCard } from "./_components/vat-summary-card";

export default async function CockpitRapprochementPage() {
  const user = await getCurrentUser();
  if (!(await canAccessCockpit(user, null))) {
    const owner = await getOrganizationOwner(user.organizationId);
    return (
      <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
        <SubNavCockpit active="rapprochement" />
        <CockpitRestrictedPanel ownerName={owner?.name ?? null} />
      </div>
    );
  }

  const inboxRes = await listMissingInvoiceTransactions();
  const inbox = inboxRes.data ?? [];

  const now = new Date();
  const vatRes = await computeVatSummary({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const vat = vatRes.data ?? {
    tvaCollectee: "0",
    tvaDeductible: "0",
    tvaDue: "0",
    byRate: [],
  };

  // KPI : montant total à rapprocher
  const totalToReconcile = inbox.reduce(
    (acc, t) => acc.plus(new Decimal(t.amountTtc ?? "0").abs()),
    new Decimal(0),
  );
  const critical = inbox.filter((t) => t.daysSinceTx >= 30);
  // TVA récupérable estimée sur les non-rapprochées (taux moyen 16,6%)
  const tvaRecuperable = totalToReconcile.mul("0.166");

  // Économie réalisée 2026 : Σ TVA des expense_invoices déjà rapprochées
  const startYear = new Date(now.getFullYear(), 0, 1);
  const invs = await db.query.expenseInvoices.findMany({
    where: and(
      eq(expenseInvoices.organizationId, user.organizationId),
      gte(expenseInvoices.dateFacture, startYear),
      eq(expenseInvoices.deductible, true),
    ),
    columns: { montantTva: true },
  });
  const economieAnnee = invs.reduce(
    (acc, i) => acc.plus(i.montantTva ?? "0"),
    new Decimal(0),
  );

  return (
    <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
      <SubNavCockpit
        active="rapprochement"
        reconciliationCount={inbox.length}
      />

      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Cockpit · Pilotage agence
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{
                background: "rgba(31,45,234,0.15)",
                color: "var(--brand)",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Synchronisé Pennylane (mock)
            </span>
          </div>
          <h1
            className="text-[56px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            Rapprochement
          </h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {inbox.length} dépenses sans facture ·{" "}
            {formatEuro(tvaRecuperable.toNumber())} € de TVA à récupérer
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <KpiHero
          tone="dark"
          label="À rapprocher"
          value={`${inbox.length}`}
          unit="dépenses"
          sub={`${formatEuro(totalToReconcile.toNumber())} € en attente de justificatif`}
          alert={
            critical.length > 0 ? `${critical.length} critiques` : undefined
          }
        />
        <KpiHero
          tone="mint"
          label="TVA récupérable"
          value={`${formatEuro(tvaRecuperable.toNumber())}`}
          unit="€"
          sub={`Estimée sur les ${inbox.length} dépenses`}
        />
        <KpiHero
          tone="light"
          label={`TVA déductible ${currentMonthLabel(now)}`}
          value={`${formatEuro(Number(vat.tvaDeductible))}`}
          unit="€"
          sub="Sur charges traitées"
        />
        <KpiHero
          tone="lilac"
          label="TVA à reverser"
          value={`${formatEuro(Number(vat.tvaDue))}`}
          unit="€"
          sub={`Collectée ${formatEuro(Number(vat.tvaCollectee))} € − Déductible ${formatEuro(Number(vat.tvaDeductible))} €`}
        />
      </div>

      <div className="grid grid-cols-5 gap-6">
        <InboxList rows={inbox} />
        <div className="col-span-2 space-y-5">
          <CaptureMobileCard />
          <VatSummaryCard
            year={now.getFullYear()}
            month={now.getMonth() + 1}
            tvaCollectee={vat.tvaCollectee}
            tvaDeductible={vat.tvaDeductible}
            tvaDue={vat.tvaDue}
            byRate={vat.byRate}
          />
          <EconomieCard montant={economieAnnee.toNumber()} year={now.getFullYear()} invoicesCount={invs.length} />
        </div>
      </div>
    </div>
  );
}

function EconomieCard({
  montant,
  year,
  invoicesCount,
}: {
  montant: number;
  year: number;
  invoicesCount: number;
}) {
  return (
    <div
      className="p-5 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #B8F2D1 0%, #DCFCE7 100%)",
        color: "#064E2C",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(6,78,44,0.10)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold">Économie {year}</div>
          <div
            className="text-[11px]"
            style={{ color: "rgba(6,78,44,0.65)" }}
          >
            TVA récupérée grâce au rapprochement auto
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 32, letterSpacing: "-0.015em" }}
        >
          {formatEuro(montant)}
        </div>
        <div
          className="text-[16px]"
          style={{ color: "rgba(6,78,44,0.55)" }}
        >
          €
        </div>
        <span
          className="ml-2 text-[11px]"
          style={{ color: "rgba(6,78,44,0.65)" }}
        >
          depuis janvier · {invoicesCount} factures
        </span>
      </div>
    </div>
  );
}

function KpiHero({
  tone,
  label,
  value,
  unit,
  sub,
  alert,
}: {
  tone: "dark" | "mint" | "light" | "lilac";
  label: string;
  value: string;
  unit: string;
  sub: string;
  alert?: string;
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
    <div
      className="p-7 rounded-3xl relative overflow-hidden"
      style={style}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[12px] uppercase tracking-wider font-semibold"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        {alert && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: "rgba(220,38,38,0.20)",
              color: "#FCA5A5",
            }}
          >
            {alert}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 relative z-10">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 56, letterSpacing: "-0.025em" }}
        >
          {value}
        </div>
        <div
          className="text-[24px] font-semibold ml-1"
          style={{ opacity: tone === "light" ? 0.5 : 0.65 }}
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

function currentMonthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
