"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { KpiCard } from "@/components/ui/kpi-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import type { CompanyListItem } from "@/server/actions/annuaire/companies";
import type { MoaRow } from "@/server/actions/annuaire/moas";

import { CompanyCreateDrawer } from "./company-create-drawer";
import { MoaCreateDrawer } from "./moa-create-drawer";

type Tab = "all" | "companies" | "moas";

export interface AnnuaireClientProps {
  kpis: {
    totalCompanies: number;
    validPct: number;
    expiringSoon: number;
    activeChantiers: number;
    volumeEngageHt: string;
  };
  companies: CompanyListItem[];
  moas: MoaRow[];
}

export function AnnuaireClient({ kpis, companies, moas }: AnnuaireClientProps) {
  const [tab, setTab] = React.useState<Tab>("companies");
  const [search, setSearch] = React.useState("");
  const [companyDrawerOpen, setCompanyDrawerOpen] = React.useState(false);
  const [moaDrawerOpen, setMoaDrawerOpen] = React.useState(false);

  const filteredCompanies = React.useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.raisonSociale.toLowerCase().includes(q) ||
        c.siret?.includes(search) ||
        c.ville?.toLowerCase().includes(q),
    );
  }, [companies, search]);

  const filteredMoas = React.useMemo(() => {
    if (!search) return moas;
    const q = search.toLowerCase();
    return moas.filter(
      (m) =>
        m.raisonSociale.toLowerCase().includes(q) ||
        m.siret?.includes(search) ||
        m.ville?.toLowerCase().includes(q),
    );
  }, [moas, search]);

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="label-eyebrow mb-2">Annuaire de l&apos;agence</div>
          <h1 className="title-hero">Entreprises</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {companies.length} entreprises · {moas.length} maîtres d&apos;ouvrage ·
            Réutilisables sur tous les chantiers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="light"
            onClick={() => toast.info("Bientôt disponible : import CSV")}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
          >
            Import CSV
          </Button>
          {tab === "moas" ? (
            <Button
              onClick={() => setMoaDrawerOpen(true)}
              leftIcon={<PlusIcon />}
            >
              Nouveau MOA
            </Button>
          ) : (
            <Button
              onClick={() => setCompanyDrawerOpen(true)}
              leftIcon={<PlusIcon />}
            >
              Nouvelle entreprise
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <SegmentedControl<Tab>
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "all", label: `Tous · ${companies.length + moas.length}` },
            {
              value: "companies",
              label: `Entreprises · ${companies.length}`,
            },
            {
              value: "moas",
              label: `Maîtres d'ouvrage · ${moas.length}`,
            },
          ]}
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KpiCard
          eyebrow="Décennales valides"
          value={kpis.validPct}
          unit="%"
          trendArrow="up"
          footer={`${Math.round((kpis.validPct / 100) * kpis.totalCompanies)} sur ${kpis.totalCompanies} entreprises`}
        />
        <KpiCard
          eyebrow="Expiration < 60 j"
          value={kpis.expiringSoon}
          tone="black"
          delta={{ label: "Action requise", tone: "warning" }}
          footer="À traiter cette semaine"
        />
        <KpiCard
          eyebrow="Chantiers actifs"
          value={kpis.activeChantiers}
          tone="mint"
          footer="Sprint Opérations à venir"
        />
        <KpiCard
          eyebrow="Volume engagé HT"
          value={formatVolume(kpis.volumeEngageHt)}
          unit="€"
          tone="lilac"
          footer="Sur les chantiers actifs"
        />
      </div>

      {/* Liste */}
      <Card variant="white" padding="none" className="overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
              style={{ background: "var(--surface-2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher entreprise, SIRET, ville…"
                className="flex-1 bg-transparent border-none outline-none text-[13px]"
                style={{ color: "var(--text-primary)" }}
              />
              <span className="kbd">⌘K</span>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 space-y-1 max-h-[640px] overflow-y-auto">
          {tab !== "moas" &&
            filteredCompanies.map((c) => (
              <CompanyRow key={c.id} company={c} />
            ))}
          {tab !== "companies" &&
            filteredMoas.map((m) => <MoaRow key={m.id} moa={m} />)}
          {tab === "companies" && filteredCompanies.length === 0 && (
            <EmptyState
              label={
                search
                  ? "Aucune entreprise ne correspond à ta recherche."
                  : "Aucune entreprise dans l'annuaire. Commence par en créer une !"
              }
            />
          )}
          {tab === "moas" && filteredMoas.length === 0 && (
            <EmptyState
              label={
                search
                  ? "Aucun maître d'ouvrage ne correspond à ta recherche."
                  : "Aucun MOA dans l'annuaire. Ajoute le premier !"
              }
            />
          )}
        </div>

        <div
          className="px-6 py-3 text-[12px]"
          style={{
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {tab === "companies" && `${filteredCompanies.length} entreprises affichées`}
          {tab === "moas" && `${filteredMoas.length} MOA affichés`}
          {tab === "all" &&
            `${filteredCompanies.length + filteredMoas.length} contacts au total`}
        </div>
      </Card>

      <CompanyCreateDrawer
        open={companyDrawerOpen}
        onOpenChange={setCompanyDrawerOpen}
      />
      <MoaCreateDrawer open={moaDrawerOpen} onOpenChange={setMoaDrawerOpen} />
    </div>
  );
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function CompanyRow({ company }: { company: CompanyListItem }) {
  const pill = decennalePill(company);
  return (
    <Link
      href={`/annuaire/entreprise/${company.id}`}
      className="block"
      style={{ textDecoration: "none" }}
    >
      <div className="px-4 py-3 cursor-pointer flex items-center gap-4 rounded-2xl transition-colors hover:bg-[var(--surface-2)]">
        <CompanyLogo name={company.raisonSociale} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-[14px]">{company.raisonSociale}</div>
            {pill}
          </div>
          <div
            className="text-[12px] truncate mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {company.formeJuridique ? `${company.formeJuridique} · ` : ""}
            {company.ville ?? "Ville non renseignée"}
          </div>
          <div
            className="flex items-center gap-3 mt-1.5 text-[11px] font-tabular"
            style={{ color: "var(--text-tertiary)" }}
          >
            {/* TODO Sprint Opérations : remplacer par count(lots) + sum(montant_marche) réels */}
            <span>0 chantier</span>
            <span>·</span>
            <span
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              — €
            </span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

function MoaRow({ moa }: { moa: MoaRow }) {
  return (
    <Link
      href={`/annuaire/moa/${moa.id}`}
      className="block"
      style={{ textDecoration: "none" }}
    >
      <div className="px-4 py-3 cursor-pointer flex items-center gap-4 rounded-2xl transition-colors hover:bg-[var(--surface-2)]">
        <CompanyLogo name={moa.raisonSociale} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-[14px]">{moa.raisonSociale}</div>
            <StatusPill variant="brand" size="sm">
              {moa.typeJuridique.toUpperCase()}
            </StatusPill>
          </div>
          <div
            className="text-[12px] truncate mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {moa.ville ?? "Ville non renseignée"}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

function decennalePill(c: CompanyListItem) {
  switch (c.decennaleStatus) {
    case "valide":
      return <StatusPill variant="success">À jour</StatusPill>;
    case "expirant_60j":
      return (
        <StatusPill variant="warning">
          Décennale −{c.decennaleDaysRemaining ?? 0} j
        </StatusPill>
      );
    case "expire":
      return <StatusPill variant="danger">Décennale expirée</StatusPill>;
    case "absente":
      return <StatusPill variant="neutral">Sans décennale</StatusPill>;
  }
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "px-4 py-12 text-center text-[13px]",
      )}
      style={{ color: "var(--text-secondary)" }}
    >
      {label}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function formatVolume(raw: string): string {
  const n = Number(raw);
  if (Number.isNaN(n) || n === 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",");
  if (n >= 1000) return Math.round(n / 1000).toString() + "k";
  return n.toString();
}
