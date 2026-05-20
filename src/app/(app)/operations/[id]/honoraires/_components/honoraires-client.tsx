"use client";

import * as React from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";

import { ContractEmptyState } from "./contract-empty-state";
import { ContractTab } from "./contract-tab";
import { SituationsTab } from "./situations-tab";
import { ContractCreateDrawer } from "./contract-create-drawer";

type ContractRow = {
  id: string;
  operationId: string;
  moaId: string | null;
  modeFacturation: "forfait" | "pct_travaux" | "mixte";
  montantTotalHt: string | null;
  tauxTva: string;
  delaiPaiementJours: number;
  marcheReferenceHt: string | null;
  dateSignature: Date | null;
  signedAt: Date | null;
  statut: "brouillon" | "a_signer" | "signe" | "en_execution" | "clos";
};

type Mission = {
  id: string;
  contractId: string;
  libelle: string;
  ordre: number;
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null;
  montantHt: string | null;
  montantCalcule: string | null;
  pctAvancementCourant: string;
  description: string | null;
};

type Situation = {
  id: string;
  numero: string;
  dateEmission: Date;
  pctAvancementPrecedent: string;
  pctAvancementNouveau: string;
  montantHt: string | null;
  montantTva: string | null;
  montantTtc: string | null;
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
  signedAt: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  mission: { id: string; libelle: string; ordre: number };
};

type Member = { id: string; name: string; email: string; role: string };
type Grant = {
  id: string;
  scope: "global" | "operation";
  operationId: string | null;
  user: { id: string; name: string; email: string; role: string };
};

export function HonorairesClient({
  operationId,
  operationName,
  operationCode,
  moa,
  currentUserRole,
  currentUserId,
  contractData,
  missions,
  situations,
  members,
  grants,
}: {
  operationId: string;
  operationName: string;
  operationCode: string;
  moa: { id: string; raisonSociale: string } | null;
  currentUserRole: string;
  currentUserId: string;
  contractData: {
    contract: ContractRow;
    cumulFactureHt: string;
    avancementGlobalPct: string;
  } | null;
  missions: Mission[];
  situations: Situation[];
  members: Member[];
  grants: Grant[];
}) {
  const [tab, setTab] = React.useState<"contrat" | "situations">("contrat");
  const [createOpen, setCreateOpen] = React.useState(false);

  if (!contractData) {
    return (
      <>
        <ContractEmptyState
          operationName={operationName}
          onCreate={() => setCreateOpen(true)}
        />
        <ContractCreateDrawer
          open={createOpen}
          onOpenChange={setCreateOpen}
          operationId={operationId}
          moaName={moa?.raisonSociale ?? null}
        />
      </>
    );
  }

  const { contract, cumulFactureHt, avancementGlobalPct } = contractData;
  const total = Number(contract.montantTotalHt ?? 0);
  const cumul = Number(cumulFactureHt);
  const restant = total - cumul;
  const pctOfMarche =
    contract.marcheReferenceHt && Number(contract.marcheReferenceHt) > 0
      ? ((total / Number(contract.marcheReferenceHt)) * 100).toFixed(2)
      : null;
  const situationsEmises = situations.filter((s) => s.statut !== "brouillon");
  const situationsPayees = situations.filter((s) => s.statut === "payee");

  return (
    <>
      <Header
        operationName={operationName}
        currentUserRole={currentUserRole}
      />
      <KPIRow
        totalHt={total}
        cumul={cumul}
        restant={restant}
        avancementGlobalPct={avancementGlobalPct}
        pctOfMarche={pctOfMarche}
        situationsCount={situationsEmises.length}
        paidCount={situationsPayees.length}
      />
      <div className="flex items-center gap-3 mb-7">
        <SegmentedControl
          value={tab}
          onValueChange={(v) => setTab(v as "contrat" | "situations")}
          options={[
            { value: "contrat", label: "Contrat architecte" },
            {
              value: "situations",
              label: (
                <span className="flex items-center gap-2">
                  Notes d&apos;honoraires
                  <span
                    className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {situations.length}
                  </span>
                </span>
              ),
            },
          ]}
        />
        {contract.signedAt && (
          <div
            className="ml-auto text-[12px] flex items-center gap-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              <path d="M12 7v5l3 3" />
            </svg>
            Contrat signé le{" "}
            {new Date(contract.signedAt).toLocaleDateString("fr-FR")}
          </div>
        )}
      </div>

      {tab === "contrat" ? (
        <ContractTab
          contract={contract}
          missions={missions}
          moa={moa}
          members={members}
          grants={grants}
          operationId={operationId}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          situations={situations}
        />
      ) : (
        <SituationsTab
          contract={contract}
          missions={missions}
          situations={situations}
          operationCode={operationCode}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  );
}

function Header({
  operationName,
  currentUserRole,
}: {
  operationName: string;
  currentUserRole: string;
}) {
  return (
    <div className="flex items-end justify-between mb-10">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: "var(--text-primary)",
              color: "var(--surface)",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Accès restreint
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Vous voyez cet onglet en tant qu&apos;
            <span
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {currentUserRole === "owner"
                ? "Owner"
                : currentUserRole === "admin"
                  ? "Admin"
                  : "Invité Cockpit"}
            </span>
          </span>
        </div>
        <h1
          className="text-[48px] font-bold tracking-tight"
          style={{ letterSpacing: "-0.025em" }}
        >
          Honoraires agence
        </h1>
        <p
          className="text-[15px] mt-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Contrat MOA + situations d&apos;honoraires pour {operationName}
        </p>
      </div>
    </div>
  );
}

function KPIRow({
  totalHt,
  cumul,
  restant,
  avancementGlobalPct,
  pctOfMarche,
  situationsCount,
  paidCount,
}: {
  totalHt: number;
  cumul: number;
  restant: number;
  avancementGlobalPct: string;
  pctOfMarche: string | null;
  situationsCount: number;
  paidCount: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-5 mb-8">
      <KpiHero
        label="Total contrat HT"
        value={kFormat(totalHt)}
        unit="k€"
        sub={
          pctOfMarche
            ? `${pctOfMarche} % du marché travaux estimé`
            : "—"
        }
        tone="light"
      />
      <KpiHero
        label="Cumul facturé"
        value={kFormat(cumul)}
        unit="k€"
        sub={`${situationsCount} situations émises · ${paidCount} payées`}
        tone="dark"
      />
      <KpiHero
        label="Avancement global"
        value={Number(avancementGlobalPct).toFixed(0)}
        unit="%"
        sub="Σ avancement pondéré"
        tone="mint"
      />
      <KpiHero
        label="Restant à facturer"
        value={kFormat(restant)}
        unit="k€"
        sub="Selon contrat signé"
        tone="lilac"
      />
    </div>
  );
}

function KpiHero({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  tone: "light" | "dark" | "mint" | "lilac";
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
      className="p-7 rounded-3xl"
      style={style}
    >
      <span
        className="text-[12px] uppercase tracking-wider font-semibold"
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <div className="mt-4 flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: "56px", letterSpacing: "-0.025em" }}
        >
          {value}
        </div>
        <div
          className="text-[28px] font-semibold ml-1"
          style={{
            opacity: tone === "light" ? 0.5 : 0.65,
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

function kFormat(value: number): string {
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".0", "");
  }
  return value.toFixed(0);
}

void Button;
