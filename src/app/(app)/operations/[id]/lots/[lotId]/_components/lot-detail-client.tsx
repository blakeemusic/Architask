"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AVENANT_STATUS_LABEL,
  LOT_STATUS_LABEL,
  formatDateShort,
  formatMoneyCompact,
  formatMoneyFull,
} from "@/lib/format";
import { computeInsuranceStatus } from "@/lib/validation/insurance";

import { LotSignDialog } from "../../../_components/lot-sign-dialog";
import { AvenantCreateDrawer } from "../../../_components/avenant-create-drawer";

type Insurance = {
  id: string;
  type: "decennale" | "rc_pro" | "gpa";
  dateDebut: Date;
  dateFin: Date;
  activitesCouvertes: string[];
};

type Avenant = {
  id: string;
  numero: number;
  objet: string;
  montantHt: string | null;
  impactDelaiJours: number;
  dateSignature: Date | null;
  statut: "brouillon" | "a_signer" | "signe";
};

type LotData = {
  id: string;
  numero: string;
  libelle: string;
  statut: "en_preparation" | "signe" | "en_execution" | "en_reception" | "solde";
  montantMarcheHt: string;
  tauxTva: string;
  modeRevision: string | null;
  retenueGarantiePct: string;
  delaiPaiementJours: number;
  activitesAttendues: string[];
  operation: {
    id: string;
    code: string;
    name: string;
    dateOs: Date | null;
  };
  company:
    | {
        id: string;
        raisonSociale: string;
        insurances: Insurance[];
      }
    | null;
  avenants: Avenant[];
};

type Tab = "avenants" | "situations" | "cps" | "marche";

export function LotDetailClient({ lot }: { lot: LotData }) {
  const [today] = React.useState(() => new Date());
  const [tab, setTab] = React.useState<Tab>("avenants");
  const [signOpen, setSignOpen] = React.useState(false);
  const [avenantDrawerOpen, setAvenantDrawerOpen] = React.useState(false);

  // Decennale status of titulaire.
  const decennale = lot.company?.insurances
    .filter((i) => i.type === "decennale")
    .sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime())[0];
  const decennaleStatus = decennale
    ? computeInsuranceStatus({ dateFin: decennale.dateFin }, today)
    : "absente";
  const daysRemaining = decennale
    ? Math.round(
        (decennale.dateFin.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  // Marché révisé du lot = initial + Σ avenants signés.
  const marcheInitial = Number(lot.montantMarcheHt ?? 0);
  const cumulAvenantsSignes = lot.avenants
    .filter((a) => a.statut === "signe")
    .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
  const marcheRevise = marcheInitial + cumulAvenantsSignes;
  const compactInitial = formatMoneyCompact(marcheInitial);
  const compactRevise = formatMoneyCompact(marcheRevise);

  return (
    <>
      {/* Header card */}
      <Card variant="white" padding="lg" className="mb-6">
        <div className="flex items-start gap-4">
          {lot.company ? (
            <CompanyLogo name={lot.company.raisonSociale} size="xl" />
          ) : (
            <div
              className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center text-[20px] font-bold shrink-0"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-tertiary)",
              }}
            >
              ?
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="label-eyebrow">
                Lot {lot.numero}
              </span>
              <StatusPill variant={lotStatutVariant(lot.statut)}>
                {LOT_STATUS_LABEL[lot.statut] ?? lot.statut}
              </StatusPill>
              {lot.company && decennaleStatus !== "valide" && (
                <StatusPill
                  variant={
                    decennaleStatus === "expirant_60j" ? "warning" : "danger"
                  }
                >
                  {decennaleStatus === "expirant_60j"
                    ? `Décennale −${daysRemaining}j`
                    : decennaleStatus === "expire"
                      ? "Décennale expirée"
                      : "Sans décennale"}
                </StatusPill>
              )}
            </div>
            <div className="title-lg leading-tight">{lot.libelle}</div>
            <div
              className="text-[13px] mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {lot.company?.raisonSociale ?? "Entreprise non renseignée"}
            </div>
          </div>
          {lot.statut === "en_preparation" && (
            <Button onClick={() => setSignOpen(true)}>Signer le lot</Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat
            label="Marché initial"
            value={`${compactInitial.display} ${compactInitial.unit}`}
          />
          <Stat
            label="Marché révisé"
            value={`${compactRevise.display} ${compactRevise.unit}`}
            highlight={cumulAvenantsSignes !== 0}
          />
          <Stat label="% avancement" value="0 %" muted="Sprint CP à venir" />
        </div>

        <div className="mt-5">
          <SegmentedControl<Tab>
            value={tab}
            onValueChange={(v) => {
              if (v === "situations" || v === "cps") {
                toast.info("Bientôt — sprint CP");
              } else {
                setTab(v);
              }
            }}
            options={[
              { value: "avenants", label: `Avenants · ${lot.avenants.length}` },
              { value: "situations", label: "Situations" },
              { value: "cps", label: "CP" },
              { value: "marche", label: "Document marché" },
            ]}
          />
        </div>
      </Card>

      {/* Tab content */}
      {tab === "avenants" && (
        <Card variant="white" padding="none" className="overflow-hidden">
          <div className="px-7 py-5 flex items-center justify-between">
            <div>
              <div className="title-md">Avenants</div>
              <p className="label-dim mt-0.5">
                {lot.avenants.length} avenant
                {lot.avenants.length !== 1 ? "s" : ""} · Cumul signé{" "}
                {formatMoneyFull(cumulAvenantsSignes)}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setAvenantDrawerOpen(true)}
              disabled={lot.statut === "en_preparation"}
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
              Nouvel avenant
            </Button>
          </div>

          {lot.statut === "en_preparation" ? (
            <div
              className="px-7 py-12 text-center text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Le lot doit être signé avant de pouvoir créer des avenants.
            </div>
          ) : lot.avenants.length === 0 ? (
            <div
              className="px-7 py-12 text-center text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Aucun avenant pour ce lot.
            </div>
          ) : (
            <div className="px-3 pb-3 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--text-tertiary)" }}>
                    <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                      N°
                    </th>
                    <th className="text-left py-2 text-[11px] uppercase tracking-wider font-semibold">
                      Objet
                    </th>
                    <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                      Montant HT
                    </th>
                    <th className="text-right py-2 text-[11px] uppercase tracking-wider font-semibold">
                      Délai
                    </th>
                    <th className="text-left py-2 px-2 text-[11px] uppercase tracking-wider font-semibold">
                      Signature
                    </th>
                    <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider font-semibold">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="font-tabular">
                  {lot.avenants.map((a) => (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <td className="py-3 px-4 font-semibold">
                        AV-{lot.numero}-{String(a.numero).padStart(3, "0")}
                      </td>
                      <td className="py-3" style={{ color: "var(--text-primary)" }}>
                        {a.objet}
                      </td>
                      <td
                        className="py-3 text-right font-semibold"
                        style={{
                          color:
                            Number(a.montantHt ?? 0) < 0
                              ? "var(--danger)"
                              : undefined,
                        }}
                      >
                        {a.montantHt
                          ? `${Number(a.montantHt) > 0 ? "+ " : ""}${formatMoneyFull(a.montantHt)}`
                          : "—"}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {a.impactDelaiJours === 0
                          ? "—"
                          : `${a.impactDelaiJours > 0 ? "+" : ""}${a.impactDelaiJours} j`}
                      </td>
                      <td
                        className="py-3 px-2"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {a.dateSignature ? formatDateShort(a.dateSignature) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusPill
                          variant={avenantStatutVariant(a.statut)}
                          size="sm"
                        >
                          {AVENANT_STATUS_LABEL[a.statut] ?? a.statut}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "marche" && (
        <Card variant="white" padding="lg">
          <div className="title-md mb-2">Document du marché</div>
          <p
            className="text-[13px] mb-5"
            style={{ color: "var(--text-secondary)" }}
          >
            Upload du marché signé PDF — utilise la même mécanique de storage
            privé que les attestations décennale.
          </p>
          <div
            className="px-5 py-12 rounded-2xl text-center cursor-pointer transition-colors"
            style={{
              background: "var(--surface)",
              border: "1.5px dashed var(--border-strong)",
            }}
            onClick={() =>
              toast.info(
                "Bientôt — upload PDF marché signé (mêmes patterns que décennales)",
              )
            }
          >
            <div
              className="text-[13px] font-semibold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Glisser le PDF ou cliquer pour parcourir
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              PDF · stockage privé · accessible aux membres de l&apos;agence
            </div>
          </div>
        </Card>
      )}

      <LotSignDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        lotId={lot.id}
        lotNumero={lot.numero}
      />
      <AvenantCreateDrawer
        open={avenantDrawerOpen}
        onOpenChange={setAvenantDrawerOpen}
        lotId={lot.id}
        lotNumero={lot.numero}
      />
    </>
  );
}

function Stat({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: string;
}) {
  return (
    <div
      className="text-center p-3 rounded-2xl"
      style={{
        background: "var(--surface-2)",
      }}
    >
      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div
        className="num-md font-tabular mt-1"
        style={{
          color: highlight ? "var(--brand)" : undefined,
        }}
      >
        {value}
      </div>
      {muted && (
        <div
          className="text-[10px] mt-0.5"
          style={{ color: "var(--text-tertiary)" }}
        >
          {muted}
        </div>
      )}
    </div>
  );
}

function lotStatutVariant(s: LotData["statut"]): "neutral" | "info" | "warning" | "success" {
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
  }
}

function avenantStatutVariant(s: Avenant["statut"]): "neutral" | "info" | "success" {
  switch (s) {
    case "brouillon":
      return "neutral";
    case "a_signer":
      return "info";
    case "signe":
      return "success";
  }
}
