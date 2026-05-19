"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatDateFr,
  formatDateShort,
  formatMoneyFull,
} from "@/lib/format";
import { releaseRetention } from "@/server/actions/operations/retentions";

import { CautionCreateDrawer } from "./caution-create-drawer";

type Caution = {
  id: string;
  montant: string;
  dateEmission: Date;
  dateExpiration: Date;
  banque: string;
  numCaution: string;
  statut: "active" | "liberee" | "expiree";
  lot: {
    numero: string;
    libelle: string;
    company: { raisonSociale: string } | null;
  };
};

type Retention = {
  id: string;
  montantRetenu: string;
  dateReceptionLot: Date;
  echeanceLiberation: Date;
  dateLiberationReelle: Date | null;
  statut: "en_cours" | "liberee";
  substitutedByCautionId: string | null;
  lot: {
    numero: string;
    libelle: string;
    company: { raisonSociale: string } | null;
  };
};

export function CautionsClient({
  operationName,
  lots,
  cautions,
  retentions,
}: {
  operationId: string;
  operationName: string;
  lots: Array<{ id: string; numero: string; libelle: string }>;
  cautions: Caution[];
  retentions: Retention[];
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [today] = React.useState(() => new Date());

  const cautionsExpiringSoon = cautions.filter((c) => {
    if (c.statut !== "active") return false;
    const days = Math.floor(
      (c.dateExpiration.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return days <= 60 && days >= 0;
  });

  const handleRelease = async (retentionId: string) => {
    setBusy(retentionId);
    const res = await releaseRetention({ id: retentionId });
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Retenue libérée.");
    router.refresh();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow mb-2">Garanties financières</div>
          <h1 className="title-hero">Retenues & cautions</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {operationName} · {retentions.length} retenue
            {retentions.length > 1 ? "s" : ""} ·{" "}
            {cautions.filter((c) => c.statut === "active").length} caution
            {cautions.length > 1 ? "s" : ""} active
            {cautions.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Nouvelle caution</Button>
      </div>

      {/* Bandeau pédagogique */}
      <Card
        variant="section"
        padding="md"
        className="mb-6 flex items-start gap-3"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-0.5 shrink-0"
          style={{ color: "var(--brand)" }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <div className="text-[13px] font-semibold mb-1">
            Cautions bancaires (RBQS) ≡ alternative à la retenue garantie 5 %
          </div>
          <div
            className="text-[12px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Les cautions bancaires (Retenue Bancaire de Qualité Substitutive)
            remplacent la retenue garantie 5 %. L&apos;entreprise touche son
            paiement intégral et la banque se substitue à la retenue. À la
                  création d&apos;une caution, tu peux indiquer qu&apos;elle
            remplace une retenue existante.
          </div>
        </div>
      </Card>

      {/* Alerte expiration */}
      {cautionsExpiringSoon.length > 0 && (
        <Card
          variant="white"
          padding="md"
          className="mb-6"
          style={{ borderLeft: "4px solid var(--warning)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "var(--warning)",
              }}
            >
              ⚠
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[13px]">
                {cautionsExpiringSoon.length} caution
                {cautionsExpiringSoon.length > 1 ? "s" : ""} expire
                {cautionsExpiringSoon.length > 1 ? "nt" : ""} dans moins de 60
                jours
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {cautionsExpiringSoon
                  .map(
                    (c) =>
                      `${c.banque} (lot ${c.lot.numero}) le ${formatDateShort(c.dateExpiration)}`,
                  )
                  .join(" · ")}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Retentions */}
      <Card variant="white" padding="none" className="overflow-hidden mb-6">
        <div className="px-7 py-5">
          <div className="title-md">Retenues garantie</div>
          <p className="label-dim mt-0.5">
            Constituées au moment du PV de réception (5 % NF P03-001) ·
            libérées à 1 an
          </p>
        </div>
        {retentions.length === 0 ? (
          <div
            className="text-center py-10 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucune retenue active — créées à la signature du PV de réception.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--text-tertiary)" }}>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Lot
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Montant retenu
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Échéance libération
                  </th>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {retentions.map((r) => {
                  const daysToEcheance = Math.floor(
                    (r.echeanceLiberation.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return (
                    <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                      <td className="py-3 px-7">
                        <div className="font-semibold">
                          Lot {r.lot.numero} · {r.lot.libelle}
                        </div>
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {r.lot.company?.raisonSociale ?? "—"}
                        </div>
                      </td>
                      <td className="py-3 text-right font-bold">
                        {formatMoneyFull(r.montantRetenu)}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDateShort(r.echeanceLiberation)}
                        {r.statut === "en_cours" &&
                          r.substitutedByCautionId === null && (
                            <div
                              className="text-[10px] mt-0.5"
                              style={{
                                color:
                                  daysToEcheance <= 60
                                    ? "var(--warning)"
                                    : "var(--text-tertiary)",
                              }}
                            >
                              {daysToEcheance > 0
                                ? `J − ${daysToEcheance}`
                                : `À libérer (${Math.abs(daysToEcheance)} j de retard)`}
                            </div>
                          )}
                      </td>
                      <td className="py-3 px-7">
                        {r.statut === "liberee" ? (
                          <StatusPill variant="success" size="sm">
                            Libérée {r.dateLiberationReelle ? `le ${formatDateShort(r.dateLiberationReelle)}` : ""}
                          </StatusPill>
                        ) : r.substitutedByCautionId ? (
                          <StatusPill variant="info" size="sm">
                            Remplacée par caution
                          </StatusPill>
                        ) : (
                          <div className="flex items-center gap-2">
                            <StatusPill variant="warning" size="sm">
                              En cours
                            </StatusPill>
                            {daysToEcheance <= 0 && (
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => handleRelease(r.id)}
                                disabled={busy === r.id}
                              >
                                Libérer
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cautions */}
      <Card variant="white" padding="none" className="overflow-hidden">
        <div className="px-7 py-5">
          <div className="title-md">Cautions bancaires (RBQS)</div>
          <p className="label-dim mt-0.5">
            Garanties émises par la banque de l&apos;entreprise · {cautions.length}{" "}
            au total
          </p>
        </div>
        {cautions.length === 0 ? (
          <div
            className="text-center py-10 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucune caution enregistrée. Crée la première avec le bouton en haut.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--text-tertiary)" }}>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Lot · Banque
                  </th>
                  <th className="text-left py-3 text-[11px] uppercase tracking-wider font-semibold">
                    N° caution
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Montant
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Émission → Expiration
                  </th>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {cautions.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                    <td className="py-3 px-7">
                      <div className="font-semibold">Lot {c.lot.numero}</div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {c.banque}
                      </div>
                    </td>
                    <td className="py-3">{c.numCaution}</td>
                    <td className="py-3 text-right font-bold">
                      {formatMoneyFull(c.montant)}
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDateShort(c.dateEmission)} →{" "}
                      <span
                        style={{
                          color: cautionsExpiringSoon.some((s) => s.id === c.id)
                            ? "var(--warning)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {formatDateShort(c.dateExpiration)}
                      </span>
                    </td>
                    <td className="py-3 px-7">
                      <StatusPill
                        variant={
                          c.statut === "active"
                            ? "success"
                            : c.statut === "expiree"
                              ? "danger"
                              : "neutral"
                        }
                        size="sm"
                      >
                        {c.statut === "active"
                          ? "Active"
                          : c.statut === "expiree"
                            ? "Expirée"
                            : "Libérée"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CautionCreateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lots={lots}
        retentions={retentions
          .filter((r) => r.statut === "en_cours" && !r.substitutedByCautionId)
          .map((r) => ({
            id: r.id,
            lotId: r.lot.numero, // pour affichage
            label: `Lot ${r.lot.numero} — ${formatMoneyFull(r.montantRetenu)} HT (éch. ${formatDateShort(r.echeanceLiberation)})`,
            actualLotId:
              lots.find((l) => l.numero === r.lot.numero)?.id ?? "",
          }))}
      />

      {/* Diff suppress unused */}
      {(() => {
        void formatDateFr;
        return null;
      })()}
    </div>
  );
}
