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
import {
  markCPAsPaid,
  sendCP,
  signCP,
  validateCP,
} from "@/server/actions/operations/cps";

type CpStatut = "brouillon" | "a_valider" | "signe" | "envoye" | "paye";

type CpData = {
  id: string;
  numero: string;
  periodeMois: number;
  periodeAnnee: number;
  createdAt: Date;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  signedAt: Date | null;
  cumulTravauxHt: string;
  cumulCpPrecedentsHt: string;
  brutAPayerHt: string;
  retenueGarantie: string;
  revisionMontantHt: string | null;
  tva: string;
  netTtc: string;
  statut: CpStatut;
  operation: { id: string; name: string };
  lot: {
    numero: string;
    libelle: string;
    tauxTva: string;
    company: { id: string; raisonSociale: string; siret: string | null } | null;
  };
  signedByUser: { name: string } | null;
  creator: { name: string } | null;
};

const STATUT_LABEL: Record<CpStatut, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  signe: "Signé",
  envoye: "Envoyé",
  paye: "Payé",
};

const STATUT_VARIANT: Record<CpStatut, "neutral" | "warning" | "info" | "brand" | "success"> = {
  brouillon: "neutral",
  a_valider: "warning",
  signe: "info",
  envoye: "brand",
  paye: "success",
};

export function CpDetailClient({ cp }: { cp: CpData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const compact = formatMoneyCompact(cp.netTtc);

  const handleValidate = async () => {
    setBusy(true);
    const res = await validateCP({ id: cp.id });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("CP envoyé pour validation.");
    router.refresh();
  };

  const handleSign = async () => {
    setBusy(true);
    const res = await signCP({ id: cp.id });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("CP signé ✓ — PDF figé.");
    router.refresh();
  };

  const handleSend = async () => {
    setBusy(true);
    const res = await sendCP({ id: cp.id });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Email envoyé à ${cp.lot.company?.raisonSociale ?? "l'entreprise"} (mock — sprint Resend à venir).`,
    );
    router.refresh();
  };

  const handlePaid = async () => {
    setBusy(true);
    const res = await markCPAsPaid({ id: cp.id });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("CP marqué comme payé.");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Col gauche : header + workflow + ventilation */}
      <div className="lg:col-span-2 space-y-5">
        <Card variant="white" padding="lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="label-eyebrow">{cp.numero}</div>
              <h1 className="title-lg leading-tight mt-1">
                Période {String(cp.periodeMois).padStart(2, "0")}/
                {cp.periodeAnnee}
              </h1>
              <div className="mt-2">
                <StatusPill variant={STATUT_VARIANT[cp.statut]}>
                  {STATUT_LABEL[cp.statut]}
                </StatusPill>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
            {cp.lot.company && (
              <CompanyLogo name={cp.lot.company.raisonSociale} size="md" />
            )}
            <div>
              <div className="text-[13px] font-semibold">
                {cp.lot.company?.raisonSociale ?? "—"}
              </div>
              <div
                className="text-[11px] mt-0.5 font-tabular"
                style={{ color: "var(--text-secondary)" }}
              >
                Lot {cp.lot.numero} · {cp.lot.libelle}
              </div>
            </div>
          </div>

          {/* Hero Net TTC */}
          <div
            className="p-5 rounded-2xl mt-4"
            style={{
              background: "linear-gradient(135deg, #B8F2D1 0%, #DCFCE7 100%)",
            }}
          >
            <span
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "rgba(6,78,44,0.55)" }}
            >
              Net à payer TTC
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="num-lg font-tabular">{compact.display}</div>
              <div
                className="text-[20px] font-semibold ml-1"
                style={{ color: "rgba(6,78,44,0.65)" }}
              >
                {compact.unit}
              </div>
            </div>
            <div
              className="text-[11px] mt-2 font-tabular"
              style={{ color: "rgba(6,78,44,0.65)" }}
            >
              {formatMoneyFull(cp.netTtc)}
            </div>
          </div>

          {/* Workflow */}
          <div className="mt-5 space-y-2">
            <div
              className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Workflow
            </div>
            {cp.statut === "brouillon" && (
              <>
                <Button
                  className="w-full"
                  variant="light"
                  onClick={handleValidate}
                  disabled={busy}
                >
                  Envoyer pour validation
                </Button>
                <Button
                  className="w-full"
                  onClick={handleSign}
                  disabled={busy}
                >
                  Signer maintenant
                </Button>
              </>
            )}
            {cp.statut === "a_valider" && (
              <Button
                className="w-full"
                onClick={handleSign}
                disabled={busy}
              >
                Signer (Owner / Admin)
              </Button>
            )}
            {cp.statut === "signe" && (
              <Button
                className="w-full"
                onClick={handleSend}
                disabled={busy}
              >
                Envoyer à l&apos;entreprise
              </Button>
            )}
            {cp.statut === "envoye" && (
              <Button
                className="w-full"
                onClick={handlePaid}
                disabled={busy}
              >
                Marquer comme payé
              </Button>
            )}
            {cp.statut === "paye" && (
              <div
                className="p-3 rounded-xl text-center text-[12px]"
                style={{
                  background: "rgba(22,163,74,0.10)",
                  color: "var(--success)",
                }}
              >
                ✓ CP soldé le {formatDateFr(cp.paidAt)}
              </div>
            )}
            <a
              href={`/api/cps/${cp.id}/pdf?download=1`}
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

        {/* Timeline workflow */}
        <Card variant="white" padding="lg">
          <div className="title-md mb-3">Historique</div>
          <ul className="space-y-3 text-[12px]">
            <Timeline
              label="Créé"
              by={cp.creator?.name}
              date={cp.createdAt}
              done
            />
            <Timeline
              label="Signé"
              by={cp.signedByUser?.name}
              date={cp.signedAt}
              done={Boolean(cp.signedAt)}
            />
            <Timeline label="Envoyé" date={cp.sentAt} done={Boolean(cp.sentAt)} />
            <Timeline label="Payé" date={cp.paidAt} done={Boolean(cp.paidAt)} />
          </ul>
        </Card>

        <Card variant="section" padding="md">
          <div
            className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            Calcul détaillé
          </div>
          <div className="space-y-1.5 text-[12px] font-tabular">
            <CalcRow label="Cumul travaux exécutés HT" value={cp.cumulTravauxHt} />
            <CalcRow label="− Cumul CP précédents" value={cp.cumulCpPrecedentsHt} />
            <CalcRow
              label="Brut à payer HT"
              value={cp.brutAPayerHt}
              bold
              border
            />
            <CalcRow
              label="− Retenue garantie"
              value={cp.retenueGarantie}
              negative
            />
            {cp.revisionMontantHt && Number(cp.revisionMontantHt) !== 0 && (
              <CalcRow
                label="+ Révision"
                value={cp.revisionMontantHt}
              />
            )}
            <CalcRow label="+ TVA" value={cp.tva} />
            <CalcRow label="Net TTC" value={cp.netTtc} bold border highlight />
          </div>
        </Card>
      </div>

      {/* Col droite : preview PDF */}
      <div className="lg:col-span-3">
        <Card variant="white" padding="none" className="overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <div className="text-[13px] font-semibold">Aperçu PDF</div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {cp.signedAt
                  ? "PDF figé (signé)"
                  : "Régénération dynamique"}
              </div>
            </div>
            <a
              href={`/api/cps/${cp.id}/pdf?download=1`}
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
            src={`/api/cps/${cp.id}/pdf`}
            className="w-full"
            style={{ height: 900, border: 0 }}
            title="PDF du CP"
          />
        </Card>
      </div>
    </div>
  );
}

function Timeline({
  label,
  by,
  date,
  done,
}: {
  label: string;
  by?: string | null;
  date: Date | null;
  done: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{
          background: done ? "var(--success)" : "var(--surface-2)",
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="font-semibold"
          style={{
            color: done ? "var(--text-primary)" : "var(--text-tertiary)",
          }}
        >
          {label}
        </div>
        {date && (
          <div
            className="text-[11px] mt-0.5 font-tabular"
            style={{ color: "var(--text-secondary)" }}
          >
            {formatDateFr(date)}
            {by ? ` · par ${by}` : ""}
          </div>
        )}
      </div>
    </li>
  );
}

function CalcRow({
  label,
  value,
  bold,
  border,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  highlight?: boolean;
  negative?: boolean;
}) {
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
        {negative ? "− " : ""}
        {formatMoneyFull(value)}
      </span>
    </div>
  );
}
