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
import {
  formatDateShort,
  formatMoneyCompact,
  formatMoneyFull,
} from "@/lib/format";
import type { CompanyListItem } from "@/server/actions/annuaire/companies";

import { CpCreateDrawer } from "./cp-create-drawer";

type CpStatut = "brouillon" | "a_valider" | "signe" | "envoye" | "paye";

type CpRow = {
  id: string;
  numero: string;
  periodeMois: number;
  periodeAnnee: number;
  brutAPayerHt: string;
  retenueGarantie: string;
  netTtc: string;
  statut: CpStatut;
  createdAt: Date;
  sentAt: Date | null;
  paidAt: Date | null;
  lot: {
    id: string;
    numero: string;
    libelle: string;
    company: { id: string; raisonSociale: string } | null;
  };
};

type OperationLite = {
  id: string;
  code: string;
  name: string;
  lots: Array<{
    id: string;
    numero: string;
    libelle: string;
    statut: string;
    montantMarcheHt: string;
    company: { id: string; raisonSociale: string } | null;
  }>;
};

const STATUT_LABEL: Record<CpStatut, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  signe: "Signé",
  envoye: "Envoyé",
  paye: "Payé par MOA",
};

const STATUT_VARIANT: Record<CpStatut, "neutral" | "warning" | "info" | "brand" | "success"> = {
  brouillon: "neutral",
  a_valider: "warning",
  signe: "info",
  envoye: "brand",
  paye: "success",
};

type Tab =
  | "all"
  | "brouillon"
  | "a_valider"
  | "signe_envoye"
  | "overdue"
  | "paye";

const TAB_FILTERS: Record<Tab, CpStatut[] | null> = {
  all: null,
  brouillon: ["brouillon"],
  a_valider: ["a_valider"],
  signe_envoye: ["signe", "envoye"],
  overdue: ["envoye"], // sous-ensemble : envoyé + sent_at > 30 j (filtré ci-dessous)
  paye: ["paye"],
};

/** Nb jours depuis l'envoi à la MOA. Renvoie null si pas encore envoyé. */
function daysSinceSent(sentAt: Date | null, today: Date): number | null {
  if (!sentAt) return null;
  return Math.floor(
    (today.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function CpsListClient({
  operation,
  cps,
  kpis,
  companies,
}: {
  operation: OperationLite;
  cps: CpRow[];
  kpis: {
    aValider: number;
    signes: number;
    payes: number;
    cumulEmisHt: string;
  };
  companies: CompanyListItem[];
}) {
  const [tab, setTab] = React.useState<Tab>("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [today] = React.useState(() => new Date());

  // Count des CP en retard de paiement (envoyé depuis > 30 j sans confirm).
  const overdueCount = React.useMemo(
    () =>
      cps.filter((cp) => {
        if (cp.statut !== "envoye") return false;
        const days = daysSinceSent(cp.sentAt, today);
        return days !== null && days > 30;
      }).length,
    [cps, today],
  );

  const filteredCps = React.useMemo(() => {
    const statuts = TAB_FILTERS[tab];
    if (!statuts) return cps;
    let list = cps.filter((cp) => statuts.includes(cp.statut));
    if (tab === "overdue") {
      list = list.filter((cp) => {
        const days = daysSinceSent(cp.sentAt, today);
        return days !== null && days > 30;
      });
    }
    return list;
  }, [cps, tab, today]);

  const cumulCompact = formatMoneyCompact(kpis.cumulEmisHt);

  // Lots signés disponibles pour création d'un nouveau CP.
  const signedLots = operation.lots.filter(
    (l) =>
      l.statut === "signe" ||
      l.statut === "en_execution" ||
      l.statut === "en_reception",
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow mb-2">Suivi financier</div>
          <h1 className="title-hero">Certificats de paiement</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {cps.length} CP · Cumul émis HT {cumulCompact.display}{" "}
            {cumulCompact.unit}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {process.env.NODE_ENV !== "production" && signedLots[0] && (
            <a
              href={`/api/dev/sample-situation-pdf?lotId=${signedLots[0].id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Button variant="light">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF de situation de test
              </Button>
            </a>
          )}
          <Button
            onClick={() => setDrawerOpen(true)}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Nouveau CP
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KpiCard
          eyebrow="Cumul émis HT"
          value={cumulCompact.display}
          unit={cumulCompact.unit}
          trendArrow={Number(kpis.cumulEmisHt) > 0 ? "up" : undefined}
          footer={`${cps.length} CP au total`}
        />
        <KpiCard
          eyebrow="À valider"
          value={kpis.aValider}
          tone="black"
          delta={
            kpis.aValider > 0
              ? { label: "Action requise", tone: "warning" }
              : undefined
          }
          footer="En attente de signature"
        />
        <KpiCard
          eyebrow="Signés à envoyer"
          value={kpis.signes}
          tone="mint"
          footer="À transmettre à l'entreprise"
        />
        <KpiCard
          eyebrow="Payés"
          value={kpis.payes}
          tone="lilac"
          footer="Cycle clos"
        />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <SegmentedControl<Tab>
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "all", label: `Tous · ${cps.length}` },
            {
              value: "brouillon",
              label: `Brouillon · ${cps.filter((c) => c.statut === "brouillon").length}`,
            },
            { value: "a_valider", label: `À valider · ${kpis.aValider}` },
            { value: "signe_envoye", label: "Signés / envoyés" },
            {
              value: "overdue",
              label: overdueCount > 0
                ? `En retard · ${overdueCount}`
                : "En retard",
            },
            { value: "paye", label: `Payés MOA · ${kpis.payes}` },
          ]}
        />
      </div>

      {/* Tableau CPs */}
      <Card variant="white" padding="none" className="overflow-hidden">
        {filteredCps.length === 0 ? (
          <div
            className="text-center py-16 text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {cps.length === 0
              ? "Aucun CP émis sur cette opération. Crée le premier !"
              : "Aucun CP ne correspond à ce filtre."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--text-tertiary)" }}>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Numéro
                  </th>
                  <th className="text-left py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Lot · Entreprise
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Période
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Brut HT
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Retenue
                  </th>
                  <th className="text-right py-3 px-2 text-[11px] uppercase tracking-wider font-semibold">
                    Net TTC
                  </th>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {filteredCps.map((cp) => (
                  <tr
                    key={cp.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="py-3 px-7 font-semibold">
                      <Link
                        href={`/operations/${operation.id}/cps/${cp.id}`}
                        style={{ textDecoration: "none", color: "var(--text-primary)" }}
                      >
                        {cp.numero}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/operations/${operation.id}/cps/${cp.id}`}
                        style={{ textDecoration: "none" }}
                        className="flex items-center gap-3"
                      >
                        {cp.lot.company && (
                          <CompanyLogo
                            name={cp.lot.company.raisonSociale}
                            size="sm"
                          />
                        )}
                        <div>
                          <div
                            className="font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Lot {cp.lot.numero} · {cp.lot.libelle}
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {cp.lot.company?.raisonSociale ?? "—"}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {String(cp.periodeMois).padStart(2, "0")}/{cp.periodeAnnee}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {formatMoneyFull(cp.brutAPayerHt)}
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      − {formatMoneyFull(cp.retenueGarantie)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold">
                      {formatMoneyFull(cp.netTtc)}
                    </td>
                    <td className="py-3 px-7">
                      <StatusCell cp={cp} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {signedLots.length === 0 ? (
        <div
          className="text-center mt-6 text-[13px] p-6 rounded-2xl"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
          }}
        >
          Aucun lot signé sur cette opération. Signe d&apos;abord un lot avant
          d&apos;émettre un CP.
        </div>
      ) : (
        <CpCreateDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          operationId={operation.id}
          lots={signedLots.map((l) => ({
            id: l.id,
            numero: l.numero,
            libelle: l.libelle,
            company: l.company,
          }))}
          companies={companies}
        />
      )}

    </div>
  );
}

// ---------------------------------------------------------------
// StatusCell — pill + sous-libellé contextuel (envoyé · X jours,
// payé par MOA le X, retard de paiement…)
// ---------------------------------------------------------------

function StatusCell({ cp, today }: { cp: CpRow; today: Date }) {
  if (cp.statut === "envoye") {
    const days = daysSinceSent(cp.sentAt, today);
    const overdue = days !== null && days > 30;
    return (
      <>
        <StatusPill variant={overdue ? "warning" : STATUT_VARIANT.envoye} size="sm">
          {overdue ? `Retard ${days}j` : "Envoyé"}
        </StatusPill>
        {days !== null && (
          <span
            className="text-[10px] block mt-1 font-tabular"
            style={{
              color: overdue ? "var(--warning)" : "var(--text-tertiary)",
            }}
          >
            {overdue
              ? `Paiement MOA en retard de ${days - 30}j`
              : `Envoyé · ${days}j`}
          </span>
        )}
      </>
    );
  }

  if (cp.statut === "paye") {
    return (
      <>
        <StatusPill variant="success" size="sm">
          Payé par MOA
        </StatusPill>
        {cp.paidAt && (
          <span
            className="text-[10px] block mt-1 font-tabular"
            style={{ color: "var(--text-tertiary)" }}
          >
            Déclaré le {formatDateShort(cp.paidAt)}
          </span>
        )}
      </>
    );
  }

  return (
    <StatusPill variant={STATUT_VARIANT[cp.statut]} size="sm">
      {STATUT_LABEL[cp.statut]}
    </StatusPill>
  );
}
