"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OperationCard } from "@/components/operations/operation-card";
import { formatMoneyCompact } from "@/lib/format";
import type { OperationListItem } from "@/server/actions/operations/operations";
import type { MoaRow } from "@/server/actions/annuaire/moas";

import { OperationCreateDrawer } from "./operation-create-drawer";

type Tab = "all" | "actifs" | "reception" | "dgd" | "clos";

const TAB_FILTERS: Record<Tab, OperationListItem["statut"][] | null> = {
  all: null,
  actifs: ["en_preparation", "signe", "en_execution"],
  reception: ["en_reception"],
  dgd: ["dgd"],
  clos: ["clos"],
};

export interface OperationsGridClientProps {
  kpis: {
    totalActive: number;
    totalUpcoming: number;
    volumeEngageHt: string;
    alertsCount: number;
  };
  operations: OperationListItem[];
  moas: MoaRow[];
}

export function OperationsGridClient({
  kpis,
  operations,
  moas,
}: OperationsGridClientProps) {
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const volumeCompact = formatMoneyCompact(kpis.volumeEngageHt);

  const filteredOps = React.useMemo(() => {
    let list = operations;
    const statutFilter = TAB_FILTERS[tab];
    if (statutFilter) {
      list = list.filter((o) => statutFilter.includes(o.statut));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          o.moaName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [operations, tab, search]);

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow mb-2">Opérations de l&apos;agence</div>
          <h1 className="title-hero">Opérations</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {operations.length} opération{operations.length > 1 ? "s" : ""} ·{" "}
            {kpis.totalActive} en cours ·{" "}
            {volumeCompact.display} {volumeCompact.unit} engagés
          </p>
        </div>
        <Button
          onClick={() => setDrawerOpen(true)}
          leftIcon={
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
          }
        >
          Nouvelle opération
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KpiCard
          eyebrow="Chantiers actifs"
          value={kpis.totalActive}
          trendArrow={kpis.totalActive > 0 ? "up" : undefined}
          footer={`${kpis.totalUpcoming} en préparation`}
        />
        <KpiCard
          eyebrow="À venir"
          value={kpis.totalUpcoming}
          tone="black"
          footer="Opérations en préparation"
        />
        <KpiCard
          eyebrow="CA en cours HT"
          value={volumeCompact.display}
          unit={volumeCompact.unit}
          tone="mint"
          trendArrow={Number(kpis.volumeEngageHt) > 0 ? "up" : undefined}
          footer="Marchés signés + avenants"
        />
        <KpiCard
          eyebrow="Alertes"
          value={kpis.alertsCount}
          tone="lilac"
          delta={
            kpis.alertsCount > 0
              ? { label: "Vigilance", tone: "warning" }
              : undefined
          }
          footer="Dérive avenants > 15 % du marché"
        />
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <SegmentedControl<Tab>
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "all", label: `Tous · ${operations.length}` },
            { value: "actifs", label: "En cours" },
            { value: "reception", label: "Réception" },
            { value: "dgd", label: "DGD" },
            { value: "clos", label: "Clos" },
          ]}
        />
      </div>

      {/* Search + Grid */}
      <Card variant="section" padding="md" className="mb-5">
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: "var(--surface)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher opération, code, MOA…"
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: "var(--text-primary)" }}
          />
          <span className="kbd">⌘K</span>
        </div>
      </Card>

      {filteredOps.length === 0 ? (
        <Card variant="white" padding="xl" className="text-center">
          <div
            className="text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {search
              ? "Aucune opération ne correspond à ta recherche."
              : "Aucune opération. Crée la première !"}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOps.map((op) => (
            <OperationCard
              key={op.id}
              id={op.id}
              code={op.code}
              name={op.name}
              moaName={op.moaName}
              ville={op.ville}
              statut={op.statut}
              lotsCount={op.lotsCount}
              marcheReviseHt={op.marcheReviseHt}
              pctAvancement={op.pctAvancementTemporel}
              dateOs={op.dateOs}
              dateReceptionCible={op.dateReceptionCible}
            />
          ))}
        </div>
      )}

      <OperationCreateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        moas={moas}
      />
    </div>
  );
}
