"use client";

import * as React from "react";
import Link from "next/link";
import { ClerkLoaded, ClerkLoading, UserButton, useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { KpiCard } from "@/components/ui/kpi-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import { TooltipDark } from "@/components/ui/tooltip-dark";
import { ThemeToggle } from "@/components/theme-toggle";

// ---------------------------------------------------------------
// Donnée de démo
// ---------------------------------------------------------------
const colorTokens: Array<{ group: string; tokens: Array<{ name: string; varName: string }> }> = [
  {
    group: "Surfaces",
    tokens: [
      { name: "bg-base", varName: "--bg-base" },
      { name: "surface", varName: "--surface" },
      { name: "surface-2", varName: "--surface-2" },
      { name: "surface-3", varName: "--surface-3" },
    ],
  },
  {
    group: "Texte",
    tokens: [
      { name: "text-primary", varName: "--text-primary" },
      { name: "text-secondary", varName: "--text-secondary" },
      { name: "text-tertiary", varName: "--text-tertiary" },
    ],
  },
  {
    group: "Brand & accent",
    tokens: [
      { name: "brand", varName: "--brand" },
      { name: "brand-soft", varName: "--brand-soft" },
      { name: "black (token)", varName: "--black" },
    ],
  },
  {
    group: "Mint",
    tokens: [
      { name: "mint-100", varName: "--mint-100" },
      { name: "mint-200", varName: "--mint-200" },
      { name: "mint-700", varName: "--mint-700" },
      { name: "mint-900", varName: "--mint-900" },
    ],
  },
  {
    group: "Lilac",
    tokens: [
      { name: "lilac-100", varName: "--lilac-100" },
      { name: "lilac-200", varName: "--lilac-200" },
      { name: "lilac-700", varName: "--lilac-700" },
      { name: "lilac-900", varName: "--lilac-900" },
    ],
  },
  {
    group: "Sémantique",
    tokens: [
      { name: "success", varName: "--success" },
      { name: "warning", varName: "--warning" },
      { name: "danger", varName: "--danger" },
      { name: "info", varName: "--info" },
    ],
  },
];

const companySamples = [
  "SAS Beton+",
  "Vitrol Ouest",
  "Toits & Co",
  "SARL Dupont",
  "Atelier Habria",
  "Electro Marchand",
  "Villa Robineau",
  "Plomb'Express",
];

// ---------------------------------------------------------------
// Page démo
// ---------------------------------------------------------------
export default function DesignSystemPage() {
  const [segTab, setSegTab] = React.useState<"actifs" | "reception" | "dgd">("actifs");
  const [segDarkTab, setSegDarkTab] = React.useState<"semaine" | "mois" | "trimestre">("mois");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header sticky */}
      <header
        className="glass sticky top-0 z-30 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-[1280px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--black)" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-[15px]">Architask</div>
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Design System · v0
              </div>
            </div>
            <StatusPill variant="dark" className="ml-2">
              Sprint 1
            </StatusPill>
          </div>
          <div className="flex items-center gap-3">
            <AuthHeaderCluster />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-8 py-16 space-y-20">
        {/* HERO */}
        <section className="space-y-4">
          <span className="label-eyebrow">Design system</span>
          <h1 className="title-hero">Tokens & composants Architask</h1>
          <p className="text-[16px] max-w-[640px]" style={{ color: "var(--text-secondary)" }}>
            Référence visuelle des fondamentaux (couleurs, typographie, cards, composants).
            Bascule entre clair et sombre via le bouton en haut à droite pour valider que tous les
            tokens répondent.
          </p>
        </section>

        {/* COULEURS */}
        <Section title="1. Couleurs" subtitle="Tokens CSS exposés via :root et [data-theme='dark']">
          <div className="space-y-8">
            {colorTokens.map((g) => (
              <div key={g.group}>
                <h3 className="title-md mb-4">{g.group}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {g.tokens.map((t) => (
                    <Card key={t.varName} variant="white" padding="md">
                      <div
                        className="w-full h-16 rounded-xl mb-3 border"
                        style={{
                          background: `var(${t.varName})`,
                          borderColor: "var(--border)",
                        }}
                      />
                      <div className="text-[13px] font-semibold">{t.name}</div>
                      <div
                        className="text-[11px] font-tabular mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        var({t.varName})
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* TYPOGRAPHIE */}
        <Section
          title="2. Typographie"
          subtitle="Inter variable · tabular-nums obligatoires sur les chiffres"
        >
          <Card variant="white" padding="xl">
            <div className="space-y-6">
              <TypoRow label="title-hero · 56/700">
                <div className="title-hero">Bonjour Camille</div>
              </TypoRow>
              <TypoRow label="title-xl · 40/700">
                <div className="title-xl">Résidence Les Cèdres</div>
              </TypoRow>
              <TypoRow label="title-lg · 28/600">
                <div className="title-lg">Récap par lot</div>
              </TypoRow>
              <TypoRow label="title-md · 20/600">
                <div className="title-md">Chantiers récents</div>
              </TypoRow>
              <TypoRow label="num-hero · 72/700 · tabular">
                <div className="num-hero font-tabular">64 380,96 €</div>
              </TypoRow>
              <TypoRow label="num-xl · 56/700 · tabular">
                <div className="num-xl font-tabular">4,82 M€</div>
              </TypoRow>
              <TypoRow label="num-lg · 40/700 · tabular">
                <div className="num-lg font-tabular">1 240 000</div>
              </TypoRow>
              <TypoRow label="num-md · 28/700 · tabular">
                <div className="num-md font-tabular">62%</div>
              </TypoRow>
              <TypoRow label="body · 14/regular">
                <p className="text-[14px] leading-[22px]">
                  Le marché privé suit la norme NF P03-001. Retenue de garantie 5 % par défaut,
                  libérée 1 an après la réception.
                </p>
              </TypoRow>
              <TypoRow label="label-eyebrow / label-muted / label-dim">
                <div className="flex flex-wrap gap-4 items-center">
                  <span className="label-eyebrow">CP à valider</span>
                  <span className="label-muted">Mis à jour il y a 2 min</span>
                  <span className="label-dim">14 opérations actives</span>
                </div>
              </TypoRow>
            </div>
          </Card>
        </Section>

        {/* CARDS */}
        <Section
          title="3. Cards"
          subtitle="Variantes blanc / noir / mint / lilac — radius 28-32 px"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card variant="white" padding="lg">
              <span className="label-eyebrow">white</span>
              <div className="num-lg font-tabular mt-3">1 240</div>
              <p
                className="text-[12px] mt-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Surface neutre, contenu textuel et tableaux financiers.
              </p>
            </Card>

            <Card variant="black" padding="lg">
              <span
                className="text-[12px] uppercase tracking-[0.6px] font-semibold"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                black
              </span>
              <div className="num-lg font-tabular mt-3">7</div>
              <p
                className="text-[12px] mt-3"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Card hero, accent fort, alertes prioritaires.
              </p>
            </Card>

            <Card variant="mint" padding="lg">
              <span
                className="text-[12px] uppercase tracking-[0.6px] font-semibold"
                style={{ color: "rgba(6,78,44,0.55)" }}
              >
                mint
              </span>
              <div className="num-lg font-tabular mt-3">4,82 M€</div>
              <p className="text-[12px] mt-3" style={{ color: "rgba(6,78,44,0.65)" }}>
                Positif, validé, succès. CA en cours, économies, gains.
              </p>
            </Card>

            <Card variant="lilac" padding="lg">
              <span
                className="text-[12px] uppercase tracking-[0.6px] font-semibold"
                style={{ color: "rgba(59,27,122,0.55)" }}
              >
                lilac
              </span>
              <div className="num-lg font-tabular mt-3">8,4 %</div>
              <p
                className="text-[12px] mt-3"
                style={{ color: "rgba(59,27,122,0.65)" }}
              >
                Données secondaires, forecasts, vigilance non-bloquante.
              </p>
            </Card>
          </div>

          <div className="mt-5">
            <Card variant="section" padding="lg">
              <span className="label-eyebrow">section</span>
              <p
                className="text-[13px] mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Card &laquo;&nbsp;section&nbsp;&raquo; — fond surface-2, radius 24. Utilisée pour
                grouper des sous-éléments sans concurrencer une card hero blanche.
              </p>
            </Card>
          </div>
        </Section>

        {/* KPI CARDS */}
        <Section
          title="4. KpiCards"
          subtitle="Le composant le plus utilisé — gros chiffre tabular, eyebrow, delta pill, flèche ↗ et sparkline"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard
              eyebrow="Chantiers actifs"
              value="14"
              delta={{ label: "+2 ce mois", tone: "success" }}
              trendArrow="up"
              sparkline={[8, 9, 10, 9, 11, 12, 13, 14]}
            />
            <KpiCard
              eyebrow="CP à valider"
              value="7"
              tone="black"
              delta={{ label: "Action requise", tone: "warning" }}
              footer="dont 2 en retard · 412 580 € à signer"
            />
            <KpiCard
              eyebrow="CA en cours HT"
              value="4,82"
              unit="M€"
              tone="mint"
              delta={{ label: "+12%" }}
              trendArrow="up"
              footer="Sur les chantiers actifs"
            />
            <KpiCard
              eyebrow="Dérive avenants moy."
              value="8,4"
              unit="%"
              tone="lilac"
              delta={{ label: "Vigilance" }}
              footer="Seuil alerte : 15 % du marché initial"
            />
          </div>
        </Section>

        {/* BUTTONS */}
        <Section title="5. Buttons" subtitle="Variantes dark / light / ghost — tailles sm / md / lg">
          <Card variant="white" padding="xl">
            <div className="space-y-8">
              <ButtonRow label="dark">
                <Button size="sm">Petit bouton</Button>
                <Button size="md">Bouton moyen</Button>
                <Button size="lg">Grand bouton</Button>
                <Button
                  leftIcon={
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  }
                >
                  Nouvelle opération
                </Button>
              </ButtonRow>
              <ButtonRow label="light">
                <Button variant="light" size="sm">
                  Petit
                </Button>
                <Button variant="light" size="md">
                  Moyen
                </Button>
                <Button variant="light" size="lg">
                  Grand
                </Button>
                <Button
                  variant="light"
                  rightIcon={
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  }
                >
                  Voir l&apos;annuaire
                </Button>
              </ButtonRow>
              <ButtonRow label="ghost">
                <Button variant="ghost" size="sm">
                  Annuler
                </Button>
                <Button variant="ghost" size="md">
                  ← Retour
                </Button>
                <Button variant="ghost" size="lg">
                  Voir tout
                </Button>
                <Button variant="ghost" disabled>
                  Désactivé
                </Button>
              </ButtonRow>
            </div>
          </Card>
        </Section>

        {/* STATUS PILLS */}
        <Section
          title="6. StatusPills"
          subtitle="8 variantes sémantiques + 2 tons neutres · 2 tailles"
        >
          <Card variant="white" padding="xl">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill variant="success">à jour</StatusPill>
                <StatusPill variant="warning">CP attente</StatusPill>
                <StatusPill variant="danger">Avenants 14%</StatusPill>
                <StatusPill variant="info">OPR</StatusPill>
                <StatusPill variant="neutral">Brouillon</StatusPill>
                <StatusPill variant="brand">Cmd+K</StatusPill>
                <StatusPill variant="dark">Maquettes v0.3</StatusPill>
                <StatusPill variant="light">Light</StatusPill>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill variant="success" size="sm">
                  98%
                </StatusPill>
                <StatusPill variant="warning" size="sm">
                  72%
                </StatusPill>
                <StatusPill variant="danger" size="sm">
                  −60 j
                </StatusPill>
                <StatusPill variant="info" size="sm">
                  J−28
                </StatusPill>
                <StatusPill variant="neutral" size="sm">
                  draft
                </StatusPill>
              </div>
            </div>
          </Card>
        </Section>

        {/* SEGMENTED CONTROL */}
        <Section
          title="7. SegmentedControl"
          subtitle="Tabs en pill style segmented Apple · tons light et dark"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card variant="white" padding="xl">
              <span className="label-eyebrow mb-4 inline-block">tone=&laquo;light&raquo;</span>
              <SegmentedControl
                value={segTab}
                onValueChange={setSegTab}
                options={[
                  { value: "actifs", label: "Actifs" },
                  { value: "reception", label: "Réception" },
                  { value: "dgd", label: "DGD" },
                ]}
              />
              <p
                className="text-[13px] mt-4"
                style={{ color: "var(--text-secondary)" }}
              >
                Sélection actuelle : <strong>{segTab}</strong>
              </p>
            </Card>

            <Card variant="black" padding="xl">
              <span
                className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-4 inline-block"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                tone=&laquo;dark&raquo;
              </span>
              <SegmentedControl
                tone="dark"
                value={segDarkTab}
                onValueChange={setSegDarkTab}
                options={[
                  { value: "semaine", label: "Semaine" },
                  { value: "mois", label: "Mois" },
                  { value: "trimestre", label: "Trimestre" },
                ]}
              />
              <p
                className="text-[13px] mt-4"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Sélection actuelle : <strong>{segDarkTab}</strong>
              </p>
            </Card>
          </div>
        </Section>

        {/* COMPANY LOGO */}
        <Section
          title="8. CompanyLogo"
          subtitle="Initiales auto + palette stable par hash du nom · 5 tailles"
        >
          <Card variant="white" padding="xl">
            <div className="space-y-8">
              <div>
                <span className="label-eyebrow">Toutes les palettes (1 → 8) · taille md</span>
                <div className="flex flex-wrap gap-3 mt-4">
                  {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((p) => (
                    <CompanyLogo
                      key={p}
                      name={`Palette ${p}`}
                      palette={p}
                      initials={`P${p}`}
                      size="md"
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="label-eyebrow">Tailles · xs / sm / md / lg / xl</span>
                <div className="flex flex-wrap items-end gap-4 mt-4">
                  <CompanyLogo name="SAS Beton+" size="xs" />
                  <CompanyLogo name="SAS Beton+" size="sm" />
                  <CompanyLogo name="SAS Beton+" size="md" />
                  <CompanyLogo name="SAS Beton+" size="lg" />
                  <CompanyLogo name="SAS Beton+" size="xl" />
                </div>
              </div>

              <div>
                <span className="label-eyebrow">Noms réels · initiales + palette stable</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {companySamples.map((name) => (
                    <div key={name} className="flex items-center gap-3">
                      <CompanyLogo name={name} size="md" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">{name}</div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* TOOLTIP DARK */}
        <Section
          title="9. TooltipDark"
          subtitle="V0 simple (CSS hover) · 4 placements fixes · pas de positionnement intelligent"
        >
          <Card variant="white" padding="xl">
            <div className="flex flex-wrap items-center gap-8 justify-center py-12">
              <TooltipDark content="Tooltip au-dessus" placement="top">
                <Button variant="light" size="sm">
                  Hover top
                </Button>
              </TooltipDark>
              <TooltipDark content="Tooltip en bas" placement="bottom">
                <Button variant="light" size="sm">
                  Hover bottom
                </Button>
              </TooltipDark>
              <TooltipDark content="À gauche" placement="left">
                <Button variant="light" size="sm">
                  Hover left
                </Button>
              </TooltipDark>
              <TooltipDark content="À droite" placement="right">
                <Button variant="light" size="sm">
                  Hover right
                </Button>
              </TooltipDark>
              <TooltipDark
                content={
                  <span className="font-tabular">632 € · pic du mois</span>
                }
                placement="top"
              >
                <span className="text-[14px] font-semibold cursor-help underline decoration-dotted">
                  Inline trigger
                </span>
              </TooltipDark>
            </div>
          </Card>
        </Section>

        {/* DRAWER */}
        <Section
          title="10. Drawer"
          subtitle="Panneau latéral droite · radius top-left 32 px · animation slide 180ms"
        >
          <Card variant="white" padding="xl">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
                  Le drawer encapsule un Header / Body scrollable / Footer. Backdrop blur,
                  ESC pour fermer, click-outside pour fermer.
                </p>
              </div>
              <Button onClick={() => setDrawerOpen(true)}>Ouvrir le drawer</Button>
            </div>
          </Card>
        </Section>

        {/* PIED DE PAGE */}
        <div className="pt-8 pb-16 text-center">
          <p
            className="text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Architask Design System v0 · Sprint 1 · {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Drawer démo */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CompanyLogo name="SAS Beton+" size="sm" />
                <div
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  SAS Beton+ · Lot 01 Gros œuvre · Villa Robineau
                </div>
              </div>
              <h2 className="title-xl mt-3">Émettre le CP n°7</h2>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer"
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
              style={{ background: "var(--surface)" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </DrawerHeader>

        <DrawerBody>
          <Card variant="mint" padding="lg">
            <span
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "rgba(6,78,44,0.55)" }}
            >
              Net à payer TTC
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <div className="num-hero font-tabular">64 380</div>
              <div className="text-[28px] font-semibold ml-1">,96 €</div>
            </div>
            <div
              className="mt-3 text-[12px]"
              style={{ color: "rgba(6,78,44,0.65)" }}
            >
              CP n°7 · Mai 2026 · Échéance 30 juin (30 j)
            </div>
          </Card>

          <Card variant="black" padding="lg">
            <span
              className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-4 block"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Détail du calcul CP n°7
            </span>
            <div className="space-y-2 text-[13px] font-tabular">
              <CalcRow label="Cumul travaux exécutés HT" value="164 280,00 €" />
              <CalcRow label="− Cumul CP précédents" value="108 240,00 €" />
              <div
                className="flex justify-between font-bold pt-2.5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
              >
                <span>Brut à payer HT</span>
                <span>56 040,00 €</span>
              </div>
              <CalcRow label="− Retenue garantie (5%)" value="− 2 802,00 €" muted />
              <CalcRow label="+ Révision BT01" value="+ 412,80 €" muted />
              <CalcRow label="+ TVA 20%" value="+ 10 730,16 €" muted />
              <div
                className="flex justify-between text-[18px] font-bold pt-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
              >
                <span>Net TTC</span>
                <span>64 380,96 €</span>
              </div>
            </div>
          </Card>

          <Card variant="white" padding="md">
            <div className="flex items-center gap-3">
              <StatusPill variant="success">OCR 94%</StatusPill>
              <span
                className="text-[12px]"
                style={{ color: "var(--text-secondary)" }}
              >
                8 postes extraits, 7 validés automatiquement
              </span>
            </div>
          </Card>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
            ← Retour
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="light">Brouillon</Button>
            <Button
              rightIcon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              }
            >
              Étape suivante
            </Button>
          </div>
        </DrawerFooter>
      </Drawer>
    </main>
  );
}

// ---------------------------------------------------------------
// Helpers de mise en page
// ---------------------------------------------------------------
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="title-lg">{title}</h2>
        {subtitle && (
          <p
            className="text-[14px] mt-2 max-w-[720px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function TypoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[180px_1fr] gap-6 items-baseline pb-6"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="label-eyebrow shrink-0">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ButtonRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-6 items-center">
      <span className="label-eyebrow">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: muted ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.85)" }}>
        {label}
      </span>
      <span
        className="font-semibold"
        style={{ color: muted ? "rgba(255,255,255,0.85)" : "white" }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------
// Auth header cluster — bouton conditionnel "Annuaire" / "Se connecter"
// ---------------------------------------------------------------
function AuthHeaderCluster() {
  return (
    <>
      <ClerkLoading>
        <div
          className="w-24 h-9 rounded-2xl animate-pulse"
          style={{ background: "var(--surface-2)" }}
        />
      </ClerkLoading>
      <ClerkLoaded>
        <AuthHeaderClusterContent />
      </ClerkLoaded>
    </>
  );
}

function AuthHeaderClusterContent() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) {
    return (
      <>
        <Link
          href="/annuaire"
          className="btn-dark"
          style={{ textDecoration: "none" }}
        >
          Aller à l&apos;annuaire
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
      </>
    );
  }
  return (
    <Link
      href="/sign-in"
      className="btn-light"
      style={{ textDecoration: "none" }}
    >
      Se connecter
    </Link>
  );
}
