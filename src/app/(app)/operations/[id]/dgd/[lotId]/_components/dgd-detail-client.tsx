"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatDateFr,
  formatMoneyCompact,
  formatMoneyFull,
} from "@/lib/format";
import { signDGD, updateDGD } from "@/server/actions/operations/dgd";
import { suggestPenalitesPourRetard } from "@/lib/finance/computeDGD";

type DgdData = {
  id: string;
  marcheReviseHt: string;
  travauxSupplAcceptesHt: string;
  penalitesHt: string;
  cumulCpVersesHt: string;
  soldeHt: string;
  soldeTtc: string;
  statut: "brouillon" | "a_valider" | "signe";
  signedAt: Date | null;
  computedAt: Date | null;
  signedByUser: { name: string } | null;
  lot: {
    id: string;
    numero: string;
    libelle: string;
    montantMarcheHt: string;
    tauxTva: string;
    company: { id: string; raisonSociale: string } | null;
    avenants: Array<{ montantHt: string | null; statut: string }>;
  };
};

export function DgdDetailClient({
  dgd,
  operationId,
}: {
  dgd: DgdData;
  operationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [editingPen, setEditingPen] = React.useState(false);
  const [penInput, setPenInput] = React.useState(dgd.penalitesHt);
  const [travauxInput, setTravauxInput] = React.useState(
    dgd.travauxSupplAcceptesHt,
  );

  const isDuMoa = Number(dgd.soldeHt) < 0;
  const soldeCompact = formatMoneyCompact(Math.abs(Number(dgd.soldeHt)));
  const soldeTtcCompact = formatMoneyCompact(Math.abs(Number(dgd.soldeTtc)));
  const cardVariant: "mint" | "lilac" = isDuMoa ? "lilac" : "mint";
  void operationId;

  // Helper "suggestion pénalités" (informatif).
  const suggestion = suggestPenalitesPourRetard({
    marcheReviseHt: dgd.marcheReviseHt,
    // V1 : connecter date_reception_cible vs date_reception réelle.
    // En MVP : suggestion à 0 par défaut.
    dateReceptionPrevue: null,
    dateReceptionReelle: null,
  });
  void suggestion;

  const handleSave = async () => {
    setBusy(true);
    const res = await updateDGD({
      id: dgd.id,
      travauxSupplAcceptesHt: travauxInput,
      penalitesHt: penInput,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("DGD mis à jour.");
    setEditingPen(false);
    router.refresh();
  };

  const handleSign = async () => {
    setBusy(true);
    const res = await signDGD({ id: dgd.id });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("DGD signé ✓ — PDF figé.");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Col gauche : header + calcul + workflow */}
      <div className="lg:col-span-2 space-y-5">
        <Card variant="white" padding="lg">
          <div className="flex items-start gap-3 mb-4">
            {dgd.lot.company && (
              <CompanyLogo name={dgd.lot.company.raisonSociale} size="lg" />
            )}
            <div className="flex-1 min-w-0">
              <div className="label-eyebrow">Lot {dgd.lot.numero}</div>
              <div className="title-md mt-1 leading-tight">
                {dgd.lot.libelle}
              </div>
              <div
                className="text-[12px] mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {dgd.lot.company?.raisonSociale ?? "—"}
              </div>
              <div className="mt-3">
                <StatusPill
                  variant={
                    dgd.statut === "signe"
                      ? "success"
                      : dgd.statut === "a_valider"
                        ? "warning"
                        : "neutral"
                  }
                >
                  DGD {dgd.statut === "signe" ? "signé" : dgd.statut === "a_valider" ? "à valider" : "brouillon"}
                </StatusPill>
              </div>
            </div>
          </div>

          {/* Hero solde HT */}
          <Card variant={cardVariant} padding="lg" className="mt-4">
            <span
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{
                color: isDuMoa ? "rgba(59,27,122,0.55)" : "rgba(6,78,44,0.55)",
              }}
            >
              {isDuMoa ? "Trop-versé entreprise" : "Solde dû à l'entreprise"}
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="num-lg font-tabular">{soldeCompact.display}</div>
              <div
                className="text-[20px] font-semibold ml-1"
                style={{
                  color: isDuMoa
                    ? "rgba(59,27,122,0.65)"
                    : "rgba(6,78,44,0.65)",
                }}
              >
                {soldeCompact.unit} HT
              </div>
            </div>
            <div
              className="text-[11px] mt-2 font-tabular"
              style={{
                color: isDuMoa ? "rgba(59,27,122,0.65)" : "rgba(6,78,44,0.65)",
              }}
            >
              {formatMoneyFull(Math.abs(Number(dgd.soldeHt)))} HT
            </div>
          </Card>

          {/* Solde TTC en card noire */}
          <Card variant="black" padding="md" className="mt-3">
            <span
              className="text-[11px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Solde TTC
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="num-md font-tabular">
                {soldeTtcCompact.display}
              </div>
              <div
                className="text-[16px] ml-1"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {soldeTtcCompact.unit}
              </div>
            </div>
          </Card>

          {/* Workflow */}
          <div className="mt-5 space-y-2">
            {dgd.statut === "brouillon" && (
              <Button
                className="w-full"
                onClick={handleSign}
                disabled={busy}
              >
                Signer le DGD
              </Button>
            )}
            {dgd.statut === "signe" && (
              <div
                className="p-3 rounded-xl text-center text-[12px]"
                style={{
                  background: "rgba(22,163,74,0.10)",
                  color: "var(--success)",
                }}
              >
                ✓ DGD signé le {formatDateFr(dgd.signedAt)}
                {dgd.signedByUser ? ` par ${dgd.signedByUser.name}` : ""}
              </div>
            )}
            <a
              href={`/api/dgds/${dgd.id}/pdf?download=1`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              className="block"
            >
              <Button variant="ghost" className="w-full">
                Télécharger le PDF
              </Button>
            </a>
          </div>
        </Card>

        {/* Bloc édition manuelle (brouillon uniquement) */}
        {dgd.statut === "brouillon" && (
          <Card variant="white" padding="lg">
            <div className="title-md mb-3">Ajustements manuels</div>
            <p
              className="text-[12px] mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Pénalités et travaux suppl. acceptés sont déclaratifs (NF P03-001).
              L&apos;archi décide librement.
            </p>

            <label className="block mb-3">
              <span
                className="text-[12px] font-semibold mb-1 block"
                style={{ color: "var(--text-secondary)" }}
              >
                Travaux suppl. acceptés HT (€)
              </span>
              <input
                value={travauxInput}
                onChange={(e) => setTravauxInput(e.target.value)}
                onFocus={() => setEditingPen(true)}
                type="text"
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </label>
            <label className="block mb-3">
              <span
                className="text-[12px] font-semibold mb-1 block"
                style={{ color: "var(--text-secondary)" }}
              >
                Pénalités HT (€)
              </span>
              <input
                value={penInput}
                onChange={(e) => setPenInput(e.target.value)}
                onFocus={() => setEditingPen(true)}
                type="text"
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <span
                className="text-[11px] mt-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                Référence NF P03-001 : 1/1000 du marché × jours de retard
                (informatif — l&apos;archi décide).
              </span>
            </label>

            {editingPen && (
              <Button
                className="w-full"
                size="sm"
                variant="light"
                onClick={handleSave}
                disabled={busy}
              >
                {busy ? "…" : "Recalculer & sauvegarder"}
              </Button>
            )}
          </Card>
        )}

        <Card variant="section" padding="md">
          <div
            className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            Calcul détaillé
          </div>
          <div className="space-y-1.5 text-[12px] font-tabular">
            <CalcRow label="Marché révisé HT" value={dgd.marcheReviseHt} />
            {Number(dgd.travauxSupplAcceptesHt) > 0 && (
              <CalcRow
                label="+ Travaux suppl."
                value={dgd.travauxSupplAcceptesHt}
                positive
              />
            )}
            {Number(dgd.penalitesHt) > 0 && (
              <CalcRow
                label="− Pénalités"
                value={dgd.penalitesHt}
                negative
              />
            )}
            <CalcRow
              label="− Cumul CP versés"
              value={dgd.cumulCpVersesHt}
              negative
            />
            <CalcRow
              label="Solde HT"
              value={dgd.soldeHt}
              bold
              border
              highlight
            />
            <CalcRow
              label="Solde TTC"
              value={dgd.soldeTtc}
              bold
            />
          </div>
        </Card>
      </div>

      {/* Col droite : preview PDF */}
      <div className="lg:col-span-3">
        <Card variant="white" padding="none" className="overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <div className="text-[13px] font-semibold">Aperçu PDF</div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {dgd.signedAt
                  ? "PDF figé (signé)"
                  : "Régénération dynamique"}
              </div>
            </div>
            <a
              href={`/api/dgds/${dgd.id}/pdf?download=1`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Button variant="light" size="sm">
                Télécharger
              </Button>
            </a>
          </div>
          <iframe
            src={`/api/dgds/${dgd.id}/pdf?t=${dgd.signedAt?.getTime() ?? dgd.computedAt?.getTime() ?? dgd.id}`}
            className="w-full"
            style={{ height: 900, border: 0 }}
            title="DGD PDF"
          />
        </Card>
      </div>

    </div>
  );
}

function CalcRow({
  label,
  value,
  bold,
  border,
  highlight,
  negative,
  positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  highlight?: boolean;
  negative?: boolean;
  positive?: boolean;
}) {
  const prefix = negative ? "− " : positive ? "+ " : "";
  return (
    <div
      className="flex justify-between"
      style={{
        fontWeight: bold ? 700 : 400,
        paddingTop: border ? 6 : 0,
        marginTop: border ? 4 : 0,
        borderTop: border ? "1px solid var(--border)" : "none",
        color: highlight ? "var(--brand)" : undefined,
        fontSize: highlight ? 14 : undefined,
      }}
    >
      <span style={{ color: highlight ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {label}
      </span>
      <span>
        {prefix}
        {formatMoneyFull(Math.abs(Number(value)))}
      </span>
    </div>
  );
}
