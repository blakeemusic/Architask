"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import { DonutChart } from "@/components/operations/donut-chart";
import { MiniGantt } from "@/components/operations/mini-gantt";
import { OperationTabs } from "@/components/operations/operation-tabs";
import { ProgressBarGradient } from "@/components/operations/progress-bar-gradient";
import {
  OPERATION_STATUS_LABEL,
  formatDateFr,
  formatMoneyCompact,
  formatMoneyFull,
  formatPct,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CompanyListItem } from "@/server/actions/annuaire/companies";
import { computeAvancement } from "@/lib/operations-compute";

import { LotCreateDrawer } from "./lot-create-drawer";

type OperationDetail = {
  id: string;
  code: string;
  name: string;
  ville: string | null;
  statut:
    | "en_preparation"
    | "signe"
    | "en_execution"
    | "en_reception"
    | "dgd"
    | "clos";
  dateOs: Date | null;
  dateReceptionCible: Date | null;
  dureePrevueJours: number | null;
  moa: { raisonSociale: string } | null;
  lots: Array<{
    id: string;
    numero: string;
    libelle: string;
    statut: string;
    montantMarcheHt: string;
    activitesAttendues: string[];
    company: {
      id: string;
      raisonSociale: string;
    } | null;
    avenants: Array<{
      id: string;
      numero: number;
      montantHt: string | null;
      statut: string;
    }>;
  }>;
  planningTasks: Array<{
    id: string;
    type: "lot" | "jalon";
    lotId: string | null;
    libelle: string;
    dateDebutPrevue: Date | null;
    dateFinPrevue: Date | null;
    milestoneKind: string | null;
  }>;
};

type CpRowLite = {
  id: string;
  lotId: string;
  brutAPayerHt: string;
  netTtc: string;
  retenueGarantie: string;
  statut: "brouillon" | "a_valider" | "signe" | "envoye" | "paye";
};

const DONUT_COLORS = [
  "#1F2DEA",
  "#4F5DFF",
  "#7C86FF",
  "#A8AEFF",
  "#16A34A",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
];

export function OperationRecapClient({
  operation,
  cps,
  companies,
  pv,
  reserves,
  dgdByLot,
}: {
  operation: OperationDetail;
  cps: CpRowLite[];
  companies: CompanyListItem[];
  pv: {
    id: string;
    dateReception: Date;
    avecReserves: string;
    signedAt: Date | null;
  } | null;
  reserves: Array<{ id: string; statut: "a_lever" | "en_cours" | "levee" }>;
  dgdByLot: ReadonlyArray<[string, "brouillon" | "a_valider" | "signe"]>;
}) {
  const dgdMap = new Map(dgdByLot);
  const reservesLevees = reserves.filter((r) => r.statut === "levee").length;
  const reservesTotal = reserves.length;
  const [today] = React.useState(() => new Date());
  const [lotDrawerOpen, setLotDrawerOpen] = React.useState(false);
  const [lotTab, setLotTab] = React.useState<"lots" | "companies">("lots");

  // Computed values.
  const marcheInitial = operation.lots.reduce(
    (s, l) => s + Number(l.montantMarcheHt ?? 0),
    0,
  );
  const cumulAvenantsSignes = operation.lots.reduce(
    (s, l) =>
      s +
      l.avenants
        .filter((a) => a.statut === "signe")
        .reduce((ss, a) => ss + Number(a.montantHt ?? 0), 0),
    0,
  );
  const marcheRevise = marcheInitial + cumulAvenantsSignes;
  const avenantsPctDerive =
    marcheInitial === 0 ? 0 : (cumulAvenantsSignes / marcheInitial) * 100;

  // CP cumulés réels (sprint CP).
  const cpsNonBrouillon = cps.filter((cp) => cp.statut !== "brouillon");
  const cumulCpHt = cpsNonBrouillon.reduce(
    (s, cp) => s + Number(cp.brutAPayerHt ?? 0),
    0,
  );
  const retenue = cpsNonBrouillon.reduce(
    (s, cp) => s + Number(cp.retenueGarantie ?? 0),
    0,
  );
  const restant = marcheRevise - cumulCpHt;

  // Avancement hybride : financier si CP émis, sinon temporel.
  const avancement = computeAvancement({
    marcheReviseHt: marcheRevise,
    cpsNonBrouillon,
    dateOs: operation.dateOs,
    dateReceptionCible: operation.dateReceptionCible,
    today,
  });
  const pctAvancement = avancement.pct;

  // Cumul CP par lot pour le tableau.
  const cpsByLot = new Map<string, { cumulBrut: number; cumulRetenue: number; count: number }>();
  for (const cp of cpsNonBrouillon) {
    const entry = cpsByLot.get(cp.lotId) ?? { cumulBrut: 0, cumulRetenue: 0, count: 0 };
    entry.cumulBrut += Number(cp.brutAPayerHt);
    entry.cumulRetenue += Number(cp.retenueGarantie);
    entry.count += 1;
    cpsByLot.set(cp.lotId, entry);
  }

  // Build donut segments (top 5 + bucket).
  const donutSegments = operation.lots.map((l, i) => ({
    label: l.libelle,
    value: Number(l.montantMarcheHt ?? 0),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  // Build Gantt tasks (lots signés uniquement) depuis planningTasks type=lot.
  const ganttTasks = operation.planningTasks
    .filter((t) => t.type === "lot" && t.dateDebutPrevue && t.dateFinPrevue)
    .map((t) => {
      const lot = operation.lots.find((l) => l.id === t.lotId);
      return {
        id: t.id,
        label: lot ? `Lot ${lot.numero} · ${lot.libelle}` : t.libelle,
        start: t.dateDebutPrevue as Date,
        end: t.dateFinPrevue as Date,
        pctDone: 30,
      };
    });

  const ganttMilestones = operation.planningTasks
    .filter((t) => t.type === "jalon" && t.dateDebutPrevue)
    .map((t) => ({
      id: t.id,
      label: t.libelle,
      date: t.dateDebutPrevue as Date,
      color:
        t.milestoneKind === "reception"
          ? "var(--mint-300)"
          : t.milestoneKind === "os"
            ? "#1F2DEA"
            : "var(--brand)",
    }));

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 text-[13px] mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link href="/operations" className="hover:text-[var(--text-primary)]">
          Opérations
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          {operation.name}
        </span>
      </div>

      <OperationTabs operationId={operation.id} active="recap" />

      {/* Bandeau réception si PV présent */}
      {pv && (
        <Link
          href={`/operations/${operation.id}/reception`}
          style={{ textDecoration: "none" }}
        >
          <Card
            variant="white"
            padding="md"
            className="mb-6 flex items-center gap-4 transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderLeft: "4px solid var(--success)" }}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(22,163,74,0.10)",
                color: "var(--success)",
              }}
            >
              ✓
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">
                Réception le {formatDateFr(pv.dateReception)}
                {pv.signedAt ? " · PV signé" : " · PV brouillon"}
              </div>
              {reservesTotal > 0 ? (
                <div
                  className="text-[12px] mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {reservesLevees} réserve{reservesLevees !== 1 ? "s" : ""}{" "}
                  levée{reservesLevees !== 1 ? "s" : ""} sur {reservesTotal}
                </div>
              ) : (
                <div
                  className="text-[12px] mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Sans réserve
                </div>
              )}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Card>
        </Link>
      )}

      {/* Header */}
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <StatusPill variant={statutPillVariant(operation.statut)}>
              {OPERATION_STATUS_LABEL[operation.statut] ?? operation.statut}
            </StatusPill>
            <span
              className="text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {operation.ville ?? "Ville non renseignée"} ·{" "}
              {operation.lots.length} lot{operation.lots.length > 1 ? "s" : ""} ·{" "}
              MOA {operation.moa?.raisonSociale ?? "non renseigné"}
            </span>
          </div>
          <h1 className="title-hero">{operation.name}</h1>
          <p
            className="mt-3 text-[15px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {operation.dateOs ? `OS ${formatDateFr(operation.dateOs)}` : "OS non défini"}
            {operation.dateReceptionCible
              ? ` · Réception cible ${formatDateFr(operation.dateReceptionCible)}`
              : ""}
            {operation.dureePrevueJours
              ? ` · ${Math.round(operation.dureePrevueJours / 30)} mois`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/operations/${operation.id}/recap-pdf?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Button
              variant="light"
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
            >
              Export récap
            </Button>
          </a>
          <Link
            href={`/operations/${operation.id}/cps`}
            style={{ textDecoration: "none" }}
          >
            <Button
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Émettre un CP
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 hero KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <HeroKpiCard
          tone="white"
          eyebrow="Marché révisé HT"
          value={marcheRevise}
          footer={
            cumulAvenantsSignes !== 0 ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{
                    color: cumulAvenantsSignes > 0 ? "var(--warning)" : "var(--success)",
                  }}
                  aria-hidden="true"
                >
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
                <span>
                  <span
                    className="font-semibold font-tabular"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {cumulAvenantsSignes > 0 ? "+ " : ""}
                    {formatMoneyFull(cumulAvenantsSignes)}
                  </span>{" "}
                  avenants ({avenantsPctDerive.toFixed(1).replace(".", ",")} %)
                </span>
              </>
            ) : (
              "Pas d'avenant signé"
            )
          }
        />
        <HeroKpiCard
          tone="black"
          eyebrow="Cumul CP émis"
          value={cumulCpHt}
          footer={
            <>
              <span className="font-bold" style={{ color: "white" }}>
                {marcheRevise === 0
                  ? "—"
                  : formatPct((cumulCpHt / marcheRevise) * 100)}
              </span>{" "}
              du marché révisé · sprint CP à venir
            </>
          }
        />
        <HeroKpiCard
          tone="mint"
          eyebrow="Restant à facturer"
          value={restant}
          footer={
            operation.dateReceptionCible
              ? `Projection fin ${formatDateFr(operation.dateReceptionCible)}`
              : "Projection à définir"
          }
        />
        <Link
          href={`/operations/${operation.id}/cautions`}
          style={{ textDecoration: "none" }}
          className="block"
        >
          <HeroKpiCard
            tone="lilac"
            eyebrow="Retenue garantie"
            value={retenue}
            footer={
              operation.dateReceptionCible
                ? `À libérer ${formatDateFr(
                    new Date(
                      new Date(operation.dateReceptionCible).setFullYear(
                        operation.dateReceptionCible.getFullYear() + 1,
                      ),
                    ),
                  )} · Voir cautions →`
                : "Voir cautions →"
            }
          />
        </Link>
      </div>

      {/* Progress bar timeline */}
      <Card variant="white" padding="lg" className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] font-semibold">Avancement chantier</div>
            <div
              className="text-[12px] mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {pctAvancement} %{" "}
              {avancement.source === "financier"
                ? "financier (Σ CP / marché révisé)"
                : "du planning écoulé"}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="num-md font-tabular">{pctAvancement}</div>
            <div
              className="text-[16px]"
              style={{ color: "var(--text-secondary)" }}
            >
              %
            </div>
          </div>
        </div>
        <ProgressBarGradient
          pct={pctAvancement}
          markerDate={today}
          startDate={operation.dateOs ?? undefined}
          endDate={operation.dateReceptionCible ?? undefined}
        />
      </Card>

      {/* Layout grid 5 cols : tableau lots + donut + gantt */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tableau lots */}
        <div className="lg:col-span-3">
          <Card variant="white" padding="none" className="overflow-hidden">
            <div className="px-7 py-5 flex items-center justify-between">
              <div>
                <h3 className="title-md">Récap par lot</h3>
                <p className="label-dim mt-1">
                  {operation.lots.length} lots ·{" "}
                  {countUniqueCompanies(operation.lots)} entreprises engagées
                </p>
              </div>
              <SegmentedControl<"lots" | "companies">
                value={lotTab}
                onValueChange={(v) => {
                  if (v === "companies") {
                    toast.info("Bientôt — vue par entreprise");
                  } else {
                    setLotTab(v);
                  }
                }}
                options={[
                  { value: "lots", label: "Lots" },
                  { value: "companies", label: "Entreprises" },
                ]}
              />
            </div>

            {operation.lots.length === 0 ? (
              <div
                className="text-center py-12 text-[14px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Aucun lot. Crée le premier !
              </div>
            ) : (
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: "var(--text-tertiary)" }}>
                      <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                        Lot · Entreprise
                      </th>
                      <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                        Marché
                      </th>
                      <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                        CP cumulés
                      </th>
                      <th className="text-right py-2 px-2 text-[11px] uppercase tracking-wider font-semibold">
                        %
                      </th>
                      <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                        Statut
                      </th>
                      <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                        DGD
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-tabular">
                    {operation.lots.map((lot) => {
                      const marcheLotRevise =
                        Number(lot.montantMarcheHt ?? 0) +
                        lot.avenants
                          .filter((a) => a.statut === "signe")
                          .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
                      const cpAgg = cpsByLot.get(lot.id) ?? {
                        cumulBrut: 0,
                        cumulRetenue: 0,
                        count: 0,
                      };
                      const lotPct =
                        marcheLotRevise === 0
                          ? 0
                          : Math.round((cpAgg.cumulBrut / marcheLotRevise) * 100);
                      const pctColor =
                        lotPct >= 95
                          ? "var(--success)"
                          : lotPct >= 50
                            ? "var(--brand)"
                            : "var(--text-primary)";
                      return (
                        <tr
                          key={lot.id}
                          className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                        >
                          <td className="py-3 px-4">
                            <Link
                              href={`/operations/${operation.id}/lots/${lot.id}`}
                              style={{ textDecoration: "none" }}
                              className="flex items-center gap-3"
                            >
                              {lot.company ? (
                                <CompanyLogo
                                  name={lot.company.raisonSociale}
                                  size="sm"
                                />
                              ) : (
                                <div
                                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold shrink-0"
                                  style={{
                                    background: "var(--surface-2)",
                                    color: "var(--text-tertiary)",
                                  }}
                                >
                                  ?
                                </div>
                              )}
                              <div>
                                <div
                                  className="font-semibold"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {lot.numero} · {lot.libelle}
                                </div>
                                <div
                                  className="text-[11px]"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  {lot.company?.raisonSociale ?? "Entreprise ?"}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 text-right font-semibold">
                            {formatMoneyFull(marcheLotRevise)}
                          </td>
                          <td
                            className="py-3 text-right"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {cpAgg.count === 0
                              ? "— €"
                              : formatMoneyFull(cpAgg.cumulBrut)}
                          </td>
                          <td
                            className="py-3 px-2 text-right font-semibold"
                            style={{ color: pctColor }}
                          >
                            {lotPct} %
                          </td>
                          <td className="py-3 px-4">
                            <StatusPill
                              variant={lotStatutVariant(lot.statut)}
                              size="sm"
                            >
                              {lot.statut === "en_preparation"
                                ? "Brouillon"
                                : lot.statut === "signe"
                                  ? "Signé"
                                  : lot.statut === "en_execution"
                                    ? "En cours"
                                    : lot.statut === "en_reception"
                                      ? "Réception"
                                      : "Soldé"}
                            </StatusPill>
                          </td>
                          <td className="py-3 px-4">
                            {(() => {
                              const dgdStatut = dgdMap.get(lot.id);
                              if (!dgdStatut) {
                                return (
                                  <Link
                                    href={`/operations/${operation.id}/dgd`}
                                    style={{ textDecoration: "none" }}
                                  >
                                    <StatusPill variant="neutral" size="sm">
                                      Non établi
                                    </StatusPill>
                                  </Link>
                                );
                              }
                              return (
                                <Link
                                  href={`/operations/${operation.id}/dgd/${lot.id}`}
                                  style={{ textDecoration: "none" }}
                                >
                                  <StatusPill
                                    variant={
                                      dgdStatut === "signe"
                                        ? "success"
                                        : dgdStatut === "a_valider"
                                          ? "warning"
                                          : "info"
                                    }
                                    size="sm"
                                  >
                                    {dgdStatut === "signe"
                                      ? "Signé"
                                      : dgdStatut === "a_valider"
                                        ? "À valider"
                                        : "Brouillon"}
                                  </StatusPill>
                                </Link>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div
              className="px-7 py-4 flex items-center justify-end"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <Button
                onClick={() => setLotDrawerOpen(true)}
                size="sm"
                leftIcon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                }
              >
                Nouveau lot
              </Button>
            </div>
          </Card>
        </div>

        {/* Sidebar droite : donut + mini-gantt */}
        <div className="lg:col-span-2 space-y-6">
          {operation.lots.length > 0 && (
            <Card variant="white" padding="lg">
              <div>
                <h3 className="title-md">Répartition</h3>
                <p className="label-dim mt-0.5">Par lot du marché révisé</p>
              </div>
              <DonutChart segments={donutSegments} maxSegments={5} />
            </Card>
          )}

          <MiniGantt
            tasks={ganttTasks}
            milestones={ganttMilestones}
            windowStart={operation.dateOs ?? undefined}
            windowEnd={operation.dateReceptionCible ?? undefined}
            today={today}
          />
        </div>
      </div>

      <LotCreateDrawer
        open={lotDrawerOpen}
        onOpenChange={setLotDrawerOpen}
        operationId={operation.id}
        companies={companies}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function HeroKpiCard({
  tone,
  eyebrow,
  value,
  footer,
}: {
  tone: "white" | "black" | "mint" | "lilac";
  eyebrow: string;
  value: number;
  footer: React.ReactNode;
}) {
  const compact = formatMoneyCompact(value);
  const toneFooterStyle: Record<string, React.CSSProperties> = {
    white: { color: "var(--text-secondary)" },
    black: { color: "rgba(255,255,255,0.65)" },
    mint: { color: "rgba(6,78,44,0.65)" },
    lilac: { color: "rgba(59,27,122,0.65)" },
  };
  const toneEyebrowStyle: Record<string, React.CSSProperties> = {
    white: { color: "var(--text-tertiary)" },
    black: { color: "rgba(255,255,255,0.55)" },
    mint: { color: "rgba(6,78,44,0.55)" },
    lilac: { color: "rgba(59,27,122,0.55)" },
  };
  return (
    <Card variant={tone} padding="lg" className={cn("relative overflow-hidden")}>
      <div
        className="text-[12px] uppercase tracking-[0.6px] font-semibold"
        style={toneEyebrowStyle[tone]}
      >
        {eyebrow}
      </div>
      <div className="mt-4 flex items-baseline gap-2 relative z-10">
        <div className="num-hero font-tabular">{compact.display}</div>
        <div
          className="text-[28px] font-semibold ml-1"
          style={toneEyebrowStyle[tone]}
        >
          {compact.unit}
        </div>
      </div>
      <div
        className="mt-4 flex items-center gap-2 text-[12px] relative z-10"
        style={toneFooterStyle[tone]}
      >
        {footer}
      </div>
    </Card>
  );
}

function statutPillVariant(s: OperationDetail["statut"]) {
  switch (s) {
    case "en_preparation":
      return "neutral";
    case "signe":
    case "en_execution":
      return "info";
    case "en_reception":
      return "warning";
    case "dgd":
      return "success";
    case "clos":
      return "neutral";
  }
}

function lotStatutVariant(s: string): "neutral" | "info" | "warning" | "success" {
  switch (s) {
    case "en_preparation":
      return "neutral";
    case "signe":
    case "en_execution":
      return "info";
    case "en_reception":
      return "warning";
    case "solde":
      return "success";
    default:
      return "neutral";
  }
}

function countUniqueCompanies(lots: OperationDetail["lots"]): number {
  const set = new Set<string>();
  for (const l of lots) if (l.company) set.add(l.company.id);
  return set.size;
}
