"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateFr, formatDateShort } from "@/lib/format";
import {
  signPvReception,
  updateReserve,
} from "@/server/actions/operations/pv-reception";

import { PvCreateDrawer } from "./pv-create-drawer";
import { ReserveCreateDrawer } from "./reserve-create-drawer";

type Pv = {
  id: string;
  dateReception: Date;
  avecReserves: string;
  signedAt: Date | null;
  signedByUser: { name: string } | null;
};

type Reserve = {
  id: string;
  description: string;
  statut: "a_lever" | "en_cours" | "levee";
  dateReleve: Date;
  dateLevee: Date | null;
  lotId: string;
  lot: { id: string; numero: string; libelle: string } | null;
};

type Lot = { id: string; numero: string; libelle: string };

type Tab = "reserves" | "pdf";

const STATUT_LABEL: Record<Reserve["statut"], string> = {
  a_lever: "À lever",
  en_cours: "En cours",
  levee: "Levée",
};

const STATUT_VARIANT: Record<
  Reserve["statut"],
  "warning" | "info" | "success"
> = {
  a_lever: "warning",
  en_cours: "info",
  levee: "success",
};

export function ReceptionClient({
  operationId,
  operationName,
  lots,
  pv,
  reserves,
}: {
  operationId: string;
  operationName: string;
  lots: Lot[];
  pv: Pv | null;
  reserves: Reserve[];
}) {
  const router = useRouter();
  const [pvDrawerOpen, setPvDrawerOpen] = React.useState(false);
  const [reserveDrawerOpen, setReserveDrawerOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("reserves");
  const [signing, setSigning] = React.useState(false);

  const handleSignPv = async () => {
    if (!pv) return;
    setSigning(true);
    const res = await signPvReception({ id: pv.id });
    setSigning(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("PV de réception signé. Retentions créées.");
    router.refresh();
  };

  const handleMarkLevee = async (reserveId: string) => {
    const res = await updateReserve({
      id: reserveId,
      statut: "levee",
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Réserve marquée levée.");
    router.refresh();
  };

  // PAS de PV → écran d'accueil avec CTA
  if (!pv) {
    return (
      <>
        <div className="mb-10">
          <div className="label-eyebrow mb-2">Réception</div>
          <h1 className="title-hero">Réception du chantier</h1>
          <p
            className="text-[15px] mt-3 max-w-[640px]"
            style={{ color: "var(--text-secondary)" }}
          >
            La réception marque la fin du chantier. Elle déclenche le point de
            départ du délai de garantie de parfait achèvement (1 an) et de la
            garantie décennale (10 ans), ainsi que la libération automatique
            des retenues garantie de chaque lot.
          </p>
        </div>
        <Card
          variant="white"
          padding="xl"
          className="text-center"
        >
          <div
            className="mb-4 text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucun PV de réception n&apos;est encore établi pour ce chantier.
          </div>
          <Button onClick={() => setPvDrawerOpen(true)} size="lg">
            Démarrer la réception
          </Button>
        </Card>
        <PvCreateDrawer
          open={pvDrawerOpen}
          onOpenChange={setPvDrawerOpen}
          operationId={operationId}
        />
      </>
    );
  }

  const reservesByStatut = {
    a_lever: reserves.filter((r) => r.statut === "a_lever").length,
    en_cours: reserves.filter((r) => r.statut === "en_cours").length,
    levee: reserves.filter((r) => r.statut === "levee").length,
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <StatusPill
              variant={pv.signedAt ? "success" : "warning"}
              size="md"
            >
              {pv.signedAt ? "PV signé" : "PV brouillon"}
            </StatusPill>
            <StatusPill
              variant={pv.avecReserves === "oui" ? "warning" : "success"}
            >
              {pv.avecReserves === "oui"
                ? `Avec ${reserves.length} réserve${reserves.length > 1 ? "s" : ""}`
                : "Sans réserve"}
            </StatusPill>
          </div>
          <h1 className="title-hero">Réception</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {operationName} · Réception du {formatDateFr(pv.dateReception)}
            {pv.signedAt
              ? ` · Signé le ${formatDateFr(pv.signedAt)}${pv.signedByUser ? ` par ${pv.signedByUser.name}` : ""}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/pv/${pv.id}/pdf?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Button variant="light">Télécharger PDF</Button>
          </a>
          {!pv.signedAt && (
            <Button onClick={handleSignPv} disabled={signing}>
              {signing ? "Signature…" : "Signer le PV"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <SegmentedControl<Tab>
          value={tab}
          onValueChange={setTab}
          options={[
            {
              value: "reserves",
              label: `Réserves · ${reservesByStatut.a_lever + reservesByStatut.en_cours} ouvertes / ${reserves.length}`,
            },
            { value: "pdf", label: "Document PV" },
          ]}
        />
      </div>

      {tab === "reserves" && (
        <Card variant="white" padding="none" className="overflow-hidden">
          <div className="px-7 py-5 flex items-center justify-between">
            <div>
              <div className="title-md">Réserves</div>
              <p className="label-dim mt-0.5">
                {reservesByStatut.a_lever} à lever · {reservesByStatut.en_cours}{" "}
                en cours · {reservesByStatut.levee} levées
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setReserveDrawerOpen(true)}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Nouvelle réserve
            </Button>
          </div>

          {reserves.length === 0 ? (
            <div
              className="text-center py-12 text-[14px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Aucune réserve relevée — réception &laquo; sans réserve &raquo;.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--text-tertiary)" }}>
                    <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                      Lot
                    </th>
                    <th className="text-left py-3 text-[11px] uppercase tracking-wider font-semibold">
                      Description
                    </th>
                    <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                      Date relevé
                    </th>
                    <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                      Date levée
                    </th>
                    <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reserves.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                      <td className="py-3 px-7 font-semibold">
                        {r.lot ? `Lot ${r.lot.numero}` : "—"}
                        {r.lot && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {r.lot.libelle}
                          </div>
                        )}
                      </td>
                      <td className="py-3 max-w-[400px]">{r.description}</td>
                      <td
                        className="py-3 text-right font-tabular"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDateShort(r.dateReleve)}
                      </td>
                      <td
                        className="py-3 text-right font-tabular"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {r.dateLevee ? formatDateShort(r.dateLevee) : "—"}
                      </td>
                      <td className="py-3 px-7">
                        <div className="flex items-center gap-2">
                          <StatusPill
                            variant={STATUT_VARIANT[r.statut]}
                            size="sm"
                          >
                            {STATUT_LABEL[r.statut]}
                          </StatusPill>
                          {r.statut !== "levee" && (
                            <button
                              type="button"
                              onClick={() => handleMarkLevee(r.id)}
                              className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                              style={{ color: "var(--success)" }}
                            >
                              ✓ Lever
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "pdf" && (
        <Card variant="white" padding="none" className="overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <div className="text-[13px] font-semibold">Aperçu du PV</div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {pv.signedAt
                  ? "PDF figé (signé)"
                  : "Régénération dynamique à chaque modification"}
              </div>
            </div>
            <a
              href={`/api/pv/${pv.id}/pdf?download=1`}
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
            src={`/api/pv/${pv.id}/pdf?t=${pv.signedAt?.getTime() ?? pv.id}`}
            className="w-full"
            style={{ height: 900, border: 0 }}
            title="PV de Réception"
          />
        </Card>
      )}

      <ReserveCreateDrawer
        open={reserveDrawerOpen}
        onOpenChange={setReserveDrawerOpen}
        operationId={operationId}
        lots={lots}
      />
    </>
  );
}
