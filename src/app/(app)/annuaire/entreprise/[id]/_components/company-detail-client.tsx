"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import { InsuranceTimeline } from "@/components/insurance-timeline";
import { computeInsuranceStatus } from "@/lib/validation/insurance";

import { InsuranceCreateDrawer } from "./insurance-create-drawer";
import { ContactCreateDrawer } from "./contact-create-drawer";

type Tab = "assurances" | "contacts" | "chantiers";

type Insurance = {
  id: string;
  type: "decennale" | "rc_pro" | "gpa";
  compagnie: string;
  numPolice: string;
  montantGaranti: string | null;
  dateDebut: Date;
  dateFin: Date;
  activitesCouvertes: string[];
  attestationFileId: string | null;
};

type Contact = {
  id: string;
  name: string;
  role: "gerant" | "conducteur" | "comptabilite" | "autre";
  email: string | null;
  phone: string | null;
};

export interface CompanyDetailProps {
  company: {
    id: string;
    raisonSociale: string;
    siret: string | null;
    formeJuridique: string | null;
    ville: string | null;
    adresseLigne1: string | null;
    codePostal: string | null;
    insurances: Insurance[];
    contacts: Contact[];
  };
}

const ROLE_LABEL: Record<Contact["role"], string> = {
  gerant: "Gérant",
  conducteur: "Conducteur",
  comptabilite: "Comptabilité",
  autre: "Autre",
};

export function CompanyDetailClient({ company }: CompanyDetailProps) {
  const [tab, setTab] = React.useState<Tab>("assurances");
  const [insuranceDrawerOpen, setInsuranceDrawerOpen] = React.useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = React.useState(false);
  // Lazy init pour rester un composant pur (eslint react-hooks/purity).
  // Date figée au mount — acceptable pour les écrans courts ; pour les
  // longues sessions ouvertes une page entière, on rafraîchira sur focus.
  const [today] = React.useState(() => new Date());

  // Décennale "active" = la plus récente date_fin parmi les décennales.
  const decennales = company.insurances
    .filter((i) => i.type === "decennale")
    .sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime());
  const decennale = decennales[0] ?? null;
  const rcPro = company.insurances.find((i) => i.type === "rc_pro");

  const decennaleStatus = decennale
    ? computeInsuranceStatus({ dateFin: decennale.dateFin }, today)
    : "absente";
  const daysRemaining = decennale
    ? Math.round(
        (decennale.dateFin.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Colonne gauche : header card + tabs content */}
      <div className="lg:col-span-3 space-y-5">
        {/* Header card */}
        <Card variant="white" padding="lg">
          <div className="flex items-start gap-4">
            <CompanyLogo name={company.raisonSociale} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="title-lg leading-tight">
                {company.raisonSociale}
              </div>
              <div
                className="text-[12px] mt-1.5 font-tabular"
                style={{ color: "var(--text-secondary)" }}
              >
                {company.siret
                  ? formatSiret(company.siret)
                  : "Pas de SIRET renseigné"}
              </div>
              <div className="mt-3">{decennalePill(decennaleStatus, daysRemaining)}</div>
            </div>
          </div>

          {/* 3 cellules stats — TODO Sprint Opérations */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <StatCell label="Chantiers" value="0" todo />
            <StatCell label="CP émis" value="0" todo />
            <StatCell label="Engagé" value="— €" todo />
          </div>

          <div className="mt-5">
            <SegmentedControl<Tab>
              value={tab}
              onValueChange={setTab}
              options={[
                { value: "assurances", label: "Assurances" },
                { value: "contacts", label: "Contacts" },
                { value: "chantiers", label: "Chantiers" },
              ]}
            />
          </div>
        </Card>

        {/* Tab content */}
        {tab === "assurances" && (
          <AssurancesTab
            company={company}
            decennale={decennale}
            rcPro={rcPro}
            decennaleStatus={decennaleStatus}
            daysRemaining={daysRemaining}
            today={today}
            onAdd={() => setInsuranceDrawerOpen(true)}
          />
        )}
        {tab === "contacts" && (
          <ContactsTab
            contacts={company.contacts}
            onAdd={() => setContactDrawerOpen(true)}
          />
        )}
        {tab === "chantiers" && <ChantiersTab />}
      </div>

      {/* Colonne droite : info / CTA */}
      <div className="lg:col-span-2 space-y-5">
        <Card variant="white" padding="lg">
          <div
            className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            Informations
          </div>
          <Info label="Forme juridique" value={company.formeJuridique ?? "—"} />
          <Info
            label="Adresse"
            value={
              [
                company.adresseLigne1,
                [company.codePostal, company.ville].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
        </Card>

        {decennaleStatus !== "valide" && decennaleStatus !== "absente" && (
          <Card variant="mint" padding="md">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(6,78,44,0.10)" }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ color: "var(--mint-900)" }}
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-bold"
                  style={{ color: "var(--mint-900)" }}
                >
                  Relancer pour renouveler
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "rgba(6,78,44,0.65)" }}
                >
                  Email pré-rempli prêt à envoyer.
                </div>
              </div>
              <button
                onClick={() =>
                  toast.info("Bientôt disponible : email Resend pré-rempli")
                }
                className="px-4 py-2.5 rounded-2xl text-[12px] font-bold whitespace-nowrap"
                style={{ background: "var(--mint-900)", color: "white" }}
              >
                Envoyer
              </button>
            </div>
          </Card>
        )}
      </div>

      <InsuranceCreateDrawer
        open={insuranceDrawerOpen}
        onOpenChange={setInsuranceDrawerOpen}
        companyId={company.id}
      />
      <ContactCreateDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        companyId={company.id}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Tab : Assurances
// ---------------------------------------------------------------

function AssurancesTab({
  decennale,
  rcPro,
  decennaleStatus,
  daysRemaining,
  today,
  onAdd,
}: {
  company: CompanyDetailProps["company"];
  decennale: Insurance | null;
  rcPro: Insurance | undefined;
  decennaleStatus: "valide" | "expirant_60j" | "expire" | "absente";
  daysRemaining: number | null;
  today: Date;
  onAdd: () => void;
}) {
  // decennaleStatus passé en props mais non utilisé localement (lecture seule).
  void decennaleStatus;
  return (
    <Card variant="white" padding="lg">
      {decennale ? (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[15px] font-bold">Décennale</div>
              <div
                className="text-[12px] mt-0.5 font-tabular"
                style={{ color: "var(--text-secondary)" }}
              >
                {decennale.compagnie} · n° {decennale.numPolice}
              </div>
            </div>
            {decennale.attestationFileId ? (
              <a
                href={`/api/files/${decennale.attestationFileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-[12px]"
                style={{ textDecoration: "none" }}
              >
                PDF →
              </a>
            ) : null}
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <div className="num-xl font-tabular">{Math.abs(daysRemaining ?? 0)}</div>
            <div
              className="text-[18px] ml-1"
              style={{ color: "var(--text-secondary)", fontWeight: 500 }}
            >
              jours
            </div>
          </div>
          <div
            className="text-[12px] mb-5 font-tabular"
            style={{ color: "var(--text-secondary)" }}
          >
            {daysRemaining !== null && daysRemaining > 0
              ? "Avant expiration le "
              : "Expirée depuis le "}
            <span
              className="font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatDateFr(decennale.dateFin)}
            </span>
          </div>

          <InsuranceTimeline
            startDate={decennale.dateDebut}
            endDate={decennale.dateFin}
            referenceDate={today}
          />
          {/* Status code is computed by the parent and used for the pill above the timeline. */}

          <div
            className="flex items-center justify-between text-[11px] mt-3 font-tabular"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>{formatDateShort(decennale.dateDebut)} — début</span>
            <span>{formatDateShort(decennale.dateFin)} — fin</span>
          </div>

          <div
            className="mt-6 pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="text-[12px] mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Activités couvertes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {decennale.activitesCouvertes.length === 0 && (
                <span
                  className="text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Aucune activité renseignée.
                </span>
              )}
              {decennale.activitesCouvertes.map((act) => (
                <StatusPill key={act} variant="neutral">
                  {act}
                </StatusPill>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <div style={{ color: "var(--text-secondary)" }}>Garantie</div>
              <div className="font-bold font-tabular mt-0.5">
                {decennale.montantGaranti
                  ? formatMontant(decennale.montantGaranti)
                  : "—"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)" }}>RC pro</div>
              {rcPro ? (
                <div
                  className="font-bold font-tabular mt-0.5"
                  style={{ color: "var(--success)" }}
                >
                  ✓ Valide{" "}
                  {rcPro.dateFin.toLocaleDateString("fr-FR", {
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              ) : (
                <div
                  className="font-bold mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Non renseignée
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div
            className="text-[14px] mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucune assurance enregistrée.
          </div>
          <div
            className="text-[12px] mb-6"
            style={{ color: "var(--text-tertiary)" }}
          >
            Ajoute la décennale + RC pro pour pouvoir signer des marchés.
          </div>
        </div>
      )}

      <div
        className="flex justify-end mt-5 pt-5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Button variant="light" size="sm" onClick={onAdd}>
          + Nouvelle assurance
        </Button>
      </div>

      {/* TODO V1 : afficher l'historique des décennales antérieures expirées. */}
    </Card>
  );
}

// ---------------------------------------------------------------
// Tab : Contacts
// ---------------------------------------------------------------

function ContactsTab({
  contacts,
  onAdd,
}: {
  contacts: Contact[];
  onAdd: () => void;
}) {
  return (
    <Card variant="white" padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="title-md">Contacts</div>
        <Button variant="light" size="sm" onClick={onAdd}>
          + Ajouter
        </Button>
      </div>
      {contacts.length === 0 ? (
        <div
          className="text-center py-8 text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Aucun contact pour cette entreprise.
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: "var(--surface-2)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[14px] font-semibold truncate">
                    {c.name}
                  </div>
                  <StatusPill variant="neutral" size="sm">
                    {ROLE_LABEL[c.role]}
                  </StatusPill>
                </div>
                <div
                  className="text-[12px] mt-1 font-tabular truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Tab : Chantiers (placeholder)
// ---------------------------------------------------------------

function ChantiersTab() {
  return (
    <Card variant="section" padding="xl">
      <div className="text-center py-8">
        <div
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Liste des chantiers — à venir
        </div>
        <div
          className="text-[12px] mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Sera connectée au sprint Opérations (Module 1) : marchés signés,
          montants engagés, CP émis, statut chantier.
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function StatCell({
  label,
  value,
  todo,
}: {
  label: string;
  value: string;
  todo?: boolean;
}) {
  return (
    <div
      className="text-center p-3 rounded-2xl"
      style={{ background: "var(--surface-2)" }}
      title={todo ? "À connecter au sprint Opérations" : undefined}
    >
      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="num-md font-tabular mt-1">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div
        className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-0.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="text-[13px]"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function decennalePill(
  status: "valide" | "expirant_60j" | "expire" | "absente",
  daysRemaining: number | null,
) {
  switch (status) {
    case "valide":
      return <StatusPill variant="success">Décennale à jour</StatusPill>;
    case "expirant_60j":
      return (
        <StatusPill variant="warning">
          Décennale expire dans {daysRemaining ?? 0}j
        </StatusPill>
      );
    case "expire":
      return <StatusPill variant="danger">Décennale expirée</StatusPill>;
    case "absente":
      return <StatusPill variant="neutral">Sans décennale</StatusPill>;
  }
}

function formatSiret(siret: string): string {
  if (siret.length !== 14) return `SIRET ${siret}`;
  return `SIRET ${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9)}`;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatMontant(raw: string): string {
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) +
    " €"
  );
}
