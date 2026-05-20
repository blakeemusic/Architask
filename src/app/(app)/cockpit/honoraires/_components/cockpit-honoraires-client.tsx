"use client";

import * as React from "react";
import Link from "next/link";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { SubNavCockpit } from "../../_components/sub-nav-cockpit";

type ContractRow = {
  opId: string;
  opCode: string;
  opName: string;
  opStatut: string;
  moaName: string | null;
  contractId: string;
  contractMontantHt: number;
  contractStatut: string;
  cumulFactureHt: number;
  cumulPaid: number;
  cumulSent: number;
  cumulSigned: number;
  avancementGlobalPct: number;
  nbSituations: number;
  attendu: number;
};

type MissionToInvoice = {
  opCode: string;
  opName: string;
  missionLibelle: string;
  delta: number;
};

type SituationSummary = {
  id: string;
  numero: string;
  montantHt: number;
  opCode: string;
  opName: string;
};

type RecentSituation = {
  id: string;
  numero: string;
  dateEmission: Date;
  montantHt: number;
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
  opCode: string;
  opName: string;
  missionLibelle: string;
};

export function CockpitHonorairesClient({
  contractRows,
  totalActifs,
  facture,
  toFacturer,
  enAttentePaiement,
  missionsAFacturer,
  enAttenteSignature,
  recentSituations,
}: {
  contractRows: ContractRow[];
  totalActifs: number;
  facture: number;
  toFacturer: number;
  enAttentePaiement: number;
  missionsAFacturer: MissionToInvoice[];
  enAttenteSignature: SituationSummary[];
  recentSituations: RecentSituation[];
}) {
  const [scope, setScope] = React.useState<"actifs" | "clos" | "tous">("actifs");

  const filtered = contractRows.filter((c) => {
    if (scope === "actifs") {
      return (
        c.contractStatut === "signe" || c.contractStatut === "en_execution"
      );
    }
    if (scope === "clos") return c.contractStatut === "clos";
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.cumulFactureHt - a.cumulFactureHt,
  );

  return (
    <>
      <SubNavCockpit active="honoraires" />

      {/* Header */}
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
            Honoraires
          </h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Vue agrégée · {contractRows.length} chantier
            {contractRows.length > 1 ? "s" : ""} ·{" "}
            {new Date().toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <KpiHero
          label="Total contrats actifs"
          value={formatK(totalActifs)}
          unit={totalActifs >= 1_000_000 ? "M€" : "k€"}
          sub={`${contractRows.length} contrats`}
          tone="light"
        />
        <KpiHero
          label="Cumul facturé YTD"
          value={formatK(facture)}
          unit={facture >= 1_000_000 ? "M€" : "k€"}
          sub="Toutes opérations"
          tone="dark"
        />
        <KpiHero
          label="À facturer (avancement)"
          value={formatK(toFacturer)}
          unit={toFacturer >= 1_000_000 ? "M€" : "k€"}
          sub="Selon avancement réel"
          tone="mint"
        />
        <KpiHero
          label="Attente paiement MOA"
          value={formatK(enAttentePaiement)}
          unit={enAttentePaiement >= 1_000_000 ? "M€" : "k€"}
          sub="Notes signées/envoyées non payées"
          tone="lilac"
        />
      </div>

      {/* Pipeline de facturation */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <PipelineCard
          tone="brand"
          icon="clock"
          count={missionsAFacturer.length}
          countLabel="à émettre"
          title="À facturer cette semaine"
          subtitle="Missions dont l'avancement réel dépasse le % facturé"
        >
          {missionsAFacturer.slice(0, 5).map((m) => (
            <div
              key={`${m.opCode}-${m.missionLibelle}`}
              className="flex items-center gap-2 text-[12px]"
            >
              <CompanyChip name={m.opCode} />
              <span className="flex-1 truncate">
                {m.missionLibelle} · {m.opName}
              </span>
              <span className="font-bold font-tabular">+{m.delta.toFixed(0)}%</span>
            </div>
          ))}
          {missionsAFacturer.length === 0 && (
            <div
              className="text-[12px] py-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucune mission en attente.
            </div>
          )}
        </PipelineCard>

        <PipelineCard
          tone="warning"
          icon="edit"
          count={enAttenteSignature.length}
          countLabel="attente sign."
          title="En attente signature MOA"
          subtitle="Notes émises non encore signées"
        >
          {enAttenteSignature.map((s) => (
            <Link
              key={s.id}
              href={`/operations/${s.id}/honoraires`}
              className="flex items-center gap-2 text-[12px]"
            >
              <CompanyChip name={s.opCode} />
              <span className="flex-1 truncate font-tabular">{s.numero}</span>
              <span className="font-bold font-tabular">
                {formatEuro(s.montantHt)} €
              </span>
            </Link>
          ))}
          {enAttenteSignature.length === 0 && (
            <div
              className="text-[12px] py-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucune note en attente.
            </div>
          )}
        </PipelineCard>

        <PipelineCard
          tone="danger"
          icon="euro"
          count={
            recentSituations.filter(
              (s) => s.statut === "envoyee" || s.statut === "signee",
            ).length
          }
          countLabel="attente paiement"
          title="En attente paiement"
          subtitle="Notes signées/envoyées non payées"
        >
          {recentSituations
            .filter((s) => s.statut === "envoyee" || s.statut === "signee")
            .slice(0, 3)
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 text-[12px]"
              >
                <CompanyChip name={s.opCode} />
                <span className="flex-1 truncate font-tabular">
                  {s.numero}
                </span>
                <span className="font-bold font-tabular">
                  {formatEuro(s.montantHt)} €
                </span>
              </div>
            ))}
          {recentSituations.filter(
            (s) => s.statut === "envoyee" || s.statut === "signee",
          ).length === 0 && (
            <div
              className="text-[12px] py-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucune note en attente.
            </div>
          )}
        </PipelineCard>
      </div>

      {/* Layout : Table contrats + activité récente */}
      <div className="grid grid-cols-3 gap-6">
        <div
          className="col-span-2 rounded-3xl overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          <div className="px-7 py-5 flex items-center justify-between">
            <div>
              <h3
                className="text-[18px] font-bold tracking-tight"
                style={{ letterSpacing: "-0.015em" }}
              >
                Contrats par opération
              </h3>
              <p
                className="text-[12px] mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {sorted.length} contrats · Trié par cumul facturé
              </p>
            </div>
            <SegmentedControl
              value={scope}
              onValueChange={(v) =>
                setScope(v as "actifs" | "clos" | "tous")
              }
              options={[
                { value: "actifs", label: "Actifs" },
                { value: "clos", label: "Clos" },
                { value: "tous", label: "Tous" },
              ]}
            />
          </div>

          <div className="px-3 pb-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--text-tertiary)" }}>
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                    Opération · MOA
                  </th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                    Contrat HT
                  </th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                    Facturé
                  </th>
                  <th className="text-right py-2 px-2 text-[11px] uppercase tracking-wider font-semibold">
                    %
                  </th>
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {sorted.map((c) => {
                  const pct =
                    c.contractMontantHt > 0
                      ? (c.cumulFactureHt / c.contractMontantHt) * 100
                      : 0;
                  return (
                    <tr
                      key={c.contractId}
                      className="hover:bg-[var(--surface-2)] cursor-pointer"
                      onClick={() =>
                        (window.location.href = `/operations/${c.opId}/honoraires`)
                      }
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <CompanyChip name={c.opCode} large />
                          <div>
                            <div className="font-bold">{c.opName}</div>
                            <div
                              className="text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {c.moaName ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {formatEuro(c.contractMontantHt)} €
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatEuro(c.cumulFactureHt)} €
                      </td>
                      <td
                        className="py-3 px-2 text-right font-semibold"
                        style={{
                          color:
                            pct >= 95
                              ? "var(--success)"
                              : pct >= 50
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                        }}
                      >
                        {pct.toFixed(0)}%
                      </td>
                      <td className="py-3 px-4">
                        <ContractStatutPill statut={c.contractStatut} />
                      </td>
                    </tr>
                  );
                })}
                {sorted.length > 0 && (
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td className="py-3 px-4 rounded-l-2xl font-bold">
                      Totaux · {sorted.length} contrats
                    </td>
                    <td className="py-3 text-right font-bold">
                      {formatEuro(
                        sorted.reduce((a, c) => a + c.contractMontantHt, 0),
                      )}{" "}
                      €
                    </td>
                    <td className="py-3 text-right font-bold">
                      {formatEuro(
                        sorted.reduce((a, c) => a + c.cumulFactureHt, 0),
                      )}{" "}
                      €
                    </td>
                    <td className="py-3 px-2 text-right font-bold">
                      {(() => {
                        const t = sorted.reduce(
                          (a, c) => a + c.contractMontantHt,
                          0,
                        );
                        const f = sorted.reduce(
                          (a, c) => a + c.cumulFactureHt,
                          0,
                        );
                        return t > 0 ? ((f / t) * 100).toFixed(0) : 0;
                      })()}
                      %
                    </td>
                    <td className="py-3 px-4 rounded-r-2xl"></td>
                  </tr>
                )}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-[13px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Aucun contrat pour ce filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activité récente */}
        <div className="space-y-5">
          <div
            className="p-6 rounded-3xl"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3
                  className="text-[16px] font-bold tracking-tight"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  Activité récente
                </h3>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  10 dernières notes émises
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {recentSituations.length === 0 && (
                <div
                  className="text-[12px] py-3 text-center"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Aucune activité récente.
                </div>
              )}
              {recentSituations.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-2xl flex items-center gap-3 hover:bg-[var(--surface-2)] cursor-pointer"
                  onClick={() =>
                    window.open(
                      `/api/honoraires/situations/${s.id}/pdf`,
                      "_blank",
                    )
                  }
                >
                  <CompanyChip name={s.opCode} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold font-tabular">
                      {s.numero}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {s.missionLibelle} · {s.opName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold font-tabular">
                      {formatEuro(s.montantHt)} €
                    </div>
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: bgFor(s.statut),
                        color: fgFor(s.statut),
                      }}
                    >
                      {labelFor(s.statut)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
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
    <div className="p-7 rounded-3xl" style={style}>
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

function PipelineCard({
  tone,
  icon,
  count,
  countLabel,
  title,
  subtitle,
  children,
}: {
  tone: "brand" | "warning" | "danger";
  icon: "clock" | "edit" | "euro";
  count: number;
  countLabel: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const iconBg =
    tone === "brand"
      ? "rgba(31,45,234,0.10)"
      : tone === "warning"
        ? "rgba(245,158,11,0.10)"
        : "rgba(220,38,38,0.10)";
  const iconFg =
    tone === "brand"
      ? "var(--brand)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div
      className="p-6 rounded-3xl"
      style={{
        background: "var(--surface)",
        border: tone === "danger" ? "1.5px solid rgba(220,38,38,0.30)" : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: iconBg, color: iconFg }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            {icon === "clock" ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </>
            ) : icon === "edit" ? (
              <>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </>
            ) : (
              <>
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </>
            )}
          </svg>
        </div>
        <div className="text-right">
          <div
            className="font-tabular leading-none"
            style={{ fontSize: 36, fontWeight: 700 }}
          >
            {count}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {countLabel}
          </div>
        </div>
      </div>
      <div className="text-[14px] font-bold">{title}</div>
      <div
        className="text-[12px] mt-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {subtitle}
      </div>
      <div
        className="mt-4 pt-4 border-t space-y-2"
        style={{ borderColor: "var(--border)" }}
      >
        {children}
      </div>
    </div>
  );
}

function ContractStatutPill({ statut }: { statut: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    brouillon: { label: "Brouillon", bg: "var(--surface-2)", fg: "var(--text-secondary)" },
    a_signer: { label: "À signer", bg: "rgba(245,158,11,0.15)", fg: "var(--warning)" },
    signe: { label: "Signé", bg: "rgba(22,163,74,0.15)", fg: "var(--success)" },
    en_execution: { label: "En cours", bg: "rgba(31,45,234,0.15)", fg: "var(--brand)" },
    clos: { label: "Clos", bg: "var(--surface-2)", fg: "var(--text-secondary)" },
  };
  const meta = map[statut] ?? map.brouillon;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

function CompanyChip({
  name,
  large,
}: {
  name: string;
  large?: boolean;
}) {
  const palette = [
    ["#1F2DEA", "#4F5DFF"],
    ["#16A34A", "#22C55E"],
    ["#F59E0B", "#FBBF24"],
    ["#9333EA", "#A855F7"],
    ["#0EA5E9", "#38BDF8"],
    ["#EC4899", "#F472B6"],
  ];
  const idx =
    name.charCodeAt(0) % palette.length;
  const [a, b] = palette[idx];
  return (
    <div
      className="flex items-center justify-center text-white font-bold rounded-xl"
      style={{
        width: large ? 32 : 22,
        height: large ? 32 : 22,
        fontSize: large ? 11 : 9,
        background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}

function labelFor(s: string): string {
  return s === "brouillon"
    ? "Brouillon"
    : s === "a_valider"
      ? "À valider"
      : s === "signee"
        ? "Signée"
        : s === "envoyee"
          ? "Envoyée"
          : "Payée";
}
function bgFor(s: string): string {
  return s === "payee"
    ? "rgba(22,163,74,0.15)"
    : s === "envoyee" || s === "a_valider"
      ? "rgba(245,158,11,0.15)"
      : s === "signee"
        ? "rgba(31,45,234,0.15)"
        : "rgba(95,102,117,0.10)";
}
function fgFor(s: string): string {
  return s === "payee"
    ? "var(--success)"
    : s === "envoyee" || s === "a_valider"
      ? "var(--warning)"
      : s === "signee"
        ? "var(--brand)"
        : "var(--text-secondary)";
}
function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".00", "");
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "");
  return n.toFixed(0);
}
