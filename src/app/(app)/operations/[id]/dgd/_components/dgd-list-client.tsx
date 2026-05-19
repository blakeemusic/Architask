"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { StatusPill } from "@/components/ui/status-pill";
import { formatMoneyFull } from "@/lib/format";
import { createDGD, signDGD } from "@/server/actions/operations/dgd";

type LotRow = {
  id: string;
  numero: string;
  libelle: string;
  montantMarcheHt: string;
  statut: string;
  company: { raisonSociale: string; siret: string | null } | null;
  avenants: Array<{ montantHt: string | null; statut: string }>;
  dgd: {
    id: string;
    statut: "brouillon" | "a_valider" | "signe";
    soldeHt: string;
    soldeTtc: string;
  } | null;
  cumulCp: number;
  cpsPending: number;
};

const STATUT_VARIANT: Record<
  "brouillon" | "a_valider" | "signe",
  "neutral" | "warning" | "success"
> = {
  brouillon: "neutral",
  a_valider: "warning",
  signe: "success",
};

const STATUT_LABEL: Record<"brouillon" | "a_valider" | "signe", string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  signe: "Signé",
};

export function DgdListClient({
  operationId,
  operationName,
  lots,
}: {
  operationId: string;
  operationName: string;
  lots: LotRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const handleCreateDgd = async (lotId: string) => {
    setBusy(lotId);
    const res = await createDGD({ lotId });
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("DGD créé en brouillon.");
    router.refresh();
  };

  const handleSignDgd = async (dgdId: string) => {
    setBusy(dgdId);
    const res = await signDGD({ id: dgdId });
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("DGD signé ✓ — PDF figé.");
    router.refresh();
  };

  const lotsSignables = lots.filter((l) => l.statut !== "en_preparation");

  return (
    <div>
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow mb-2">Clôture financière</div>
          <h1 className="title-hero">Décompte Général Définitif</h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {operationName} · 1 DGD par lot · Le DGD vaut quitus pour le marché
            (NF P03-001).
          </p>
        </div>
      </div>

      <Card variant="white" padding="none" className="overflow-hidden">
        {lotsSignables.length === 0 ? (
          <div
            className="text-center py-16 text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucun lot signé sur ce chantier — pas de DGD à établir.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--text-tertiary)" }}>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Lot · Entreprise
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Marché révisé
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Cumul CP
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Écart
                  </th>
                  <th className="text-right py-3 text-[11px] uppercase tracking-wider font-semibold">
                    Solde DGD HT
                  </th>
                  <th className="text-left py-3 px-7 text-[11px] uppercase tracking-wider font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {lotsSignables.map((lot) => {
                  const marcheRevise =
                    Number(lot.montantMarcheHt ?? 0) +
                    lot.avenants
                      .filter((a) => a.statut === "signe")
                      .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
                  const ecart = marcheRevise - lot.cumulCp;
                  return (
                    <tr key={lot.id} className="hover:bg-[var(--surface-2)]">
                      <td className="py-3 px-7">
                        <div className="flex items-center gap-3">
                          {lot.company && (
                            <CompanyLogo
                              name={lot.company.raisonSociale}
                              size="sm"
                            />
                          )}
                          <div>
                            <div
                              className="font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              Lot {lot.numero} · {lot.libelle}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {lot.company?.raisonSociale ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {formatMoneyFull(marcheRevise)}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {lot.cumulCp === 0
                          ? "—"
                          : formatMoneyFull(lot.cumulCp)}
                      </td>
                      <td
                        className="py-3 text-right font-semibold"
                        style={{
                          color: ecart > 0 ? "var(--brand)" : "var(--text-secondary)",
                        }}
                      >
                        {formatMoneyFull(ecart)}
                      </td>
                      <td className="py-3 text-right font-bold">
                        {lot.dgd ? formatMoneyFull(lot.dgd.soldeHt) : "—"}
                      </td>
                      <td className="py-3 px-7">
                        {!lot.dgd ? (
                          lot.cpsPending > 0 ? (
                            <StatusPill variant="warning" size="sm">
                              {lot.cpsPending} CP en attente
                            </StatusPill>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleCreateDgd(lot.id)}
                              disabled={busy === lot.id}
                            >
                              {busy === lot.id ? "…" : "+ Établir DGD"}
                            </Button>
                          )
                        ) : (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/operations/${operationId}/dgd/${lot.id}`}
                              style={{ textDecoration: "none" }}
                            >
                              <StatusPill
                                variant={STATUT_VARIANT[lot.dgd.statut]}
                                size="sm"
                              >
                                {STATUT_LABEL[lot.dgd.statut]} →
                              </StatusPill>
                            </Link>
                            {lot.dgd.statut === "brouillon" && (
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() =>
                                  handleSignDgd(lot.dgd?.id ?? "")
                                }
                                disabled={busy === lot.dgd.id}
                              >
                                Signer
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

      <div
        className="mt-6 text-[12px] p-4 rounded-xl"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-secondary)",
        }}
      >
        💡 Pour pouvoir établir un DGD, tous les CP du lot doivent être finalisés
        (signés / envoyés / payés). Pas de brouillon ni de CP à valider en
        suspens. Le DGD signé vaut quitus pour le marché.
      </div>
    </div>
  );
}
