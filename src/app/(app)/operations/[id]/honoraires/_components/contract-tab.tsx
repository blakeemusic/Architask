"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteContract,
  signContract,
} from "@/server/actions/honoraires/contracts";

import { AccessManagementCard } from "./access-management-card";
import { MissionsEditor } from "./missions-editor";

type ContractRow = {
  id: string;
  operationId: string;
  moaId: string | null;
  modeFacturation: "forfait" | "pct_travaux" | "mixte";
  montantTotalHt: string | null;
  tauxTva: string;
  delaiPaiementJours: number;
  marcheReferenceHt: string | null;
  dateSignature: Date | null;
  signedAt: Date | null;
  statut: "brouillon" | "a_signer" | "signe" | "en_execution" | "clos";
};

type Mission = {
  id: string;
  contractId: string;
  libelle: string;
  ordre: number;
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null;
  montantHt: string | null;
  montantCalcule: string | null;
  pctAvancementCourant: string;
  description: string | null;
};

type Situation = {
  id: string;
  numero: string;
  dateEmission: Date;
  montantHt: string | null;
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
};

type Member = { id: string; name: string; email: string; role: string };
type Grant = {
  id: string;
  scope: "global" | "operation";
  operationId: string | null;
  user: { id: string; name: string; email: string; role: string };
};

const MODE_LABEL: Record<ContractRow["modeFacturation"], string> = {
  forfait: "Forfait HT",
  pct_travaux: "% Travaux",
  mixte: "Mixte",
};

export function ContractTab({
  contract,
  missions,
  moa,
  members,
  grants,
  operationId,
  currentUserRole,
  currentUserId,
  situations,
}: {
  contract: ContractRow;
  missions: Mission[];
  moa: { id: string; raisonSociale: string } | null;
  members: Member[];
  grants: Grant[];
  operationId: string;
  currentUserRole: string;
  currentUserId: string;
  situations: Situation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const isLocked = contract.statut === "signe" || contract.statut === "en_execution" || contract.statut === "clos";

  const onSign = async () => {
    setBusy(true);
    try {
      const res = await signContract({ id: contract.id });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contrat signé. Tu peux maintenant émettre des notes d'honoraires.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Supprimer le contrat d'honoraires ?")) return;
    const res = await deleteContract({ id: contract.id });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Contrat supprimé.");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-5 gap-6">
      <div className="col-span-3">
        <MissionsEditor
          contractId={contract.id}
          contractMontantHt={contract.montantTotalHt ?? "0"}
          isLocked={isLocked}
          missions={missions}
        />

        {!isLocked && (
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={onSign} disabled={busy || missions.length === 0}>
              {busy ? "Signature…" : "Signer le contrat"}
            </Button>
            {missions.length === 0 && (
              <span
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Ajoute au moins une mission avant de signer.
              </span>
            )}
            <Button variant="ghost" onClick={onDelete}>
              Supprimer le contrat
            </Button>
          </div>
        )}
      </div>

      <div className="col-span-2 space-y-5">
        <ConditionsCard
          contract={contract}
          moa={moa}
        />
        <SituationsSummaryCard situations={situations} />
        <AccessManagementCard
          operationId={operationId}
          members={members}
          grants={grants}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </div>
    </div>
  );
}

function ConditionsCard({
  contract,
  moa,
}: {
  contract: ContractRow;
  moa: { id: string; raisonSociale: string } | null;
}) {
  const cells = [
    { label: "Mode", value: MODE_LABEL[contract.modeFacturation] },
    { label: "TVA", value: `${Number(contract.tauxTva).toFixed(0)} %` },
    {
      label: "Délai paiement",
      value: `${contract.delaiPaiementJours} j fin mois`,
    },
    { label: "MOA", value: moa?.raisonSociale ?? "—" },
  ];

  return (
    <div
      className="p-6 rounded-3xl"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-[16px] font-bold tracking-tight"
          style={{ letterSpacing: "-0.015em" }}
        >
          Conditions du contrat
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div
            key={c.label}
            className="p-3 rounded-2xl"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              {c.label}
            </div>
            <div className="text-[13px] font-bold mt-1 truncate">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SituationsSummaryCard({ situations }: { situations: Situation[] }) {
  const cumul = situations.reduce((acc, s) => {
    if (s.statut === "brouillon") return acc;
    return acc + Number(s.montantHt ?? 0);
  }, 0);
  const emises = situations.filter((s) => s.statut !== "brouillon");

  return (
    <div
      className="p-6 rounded-3xl"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            className="text-[16px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Notes d&apos;honoraires
          </h3>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {emises.length} émises ·{" "}
            <span className="font-tabular font-semibold">
              {cumul.toLocaleString("fr-FR")} €
            </span>{" "}
            cumulés
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {situations.length === 0 && (
          <div
            className="text-[12px] py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Pas encore de note d&apos;honoraires.
          </div>
        )}
        {situations.slice(0, 5).map((s) => (
          <div
            key={s.id}
            className="p-3 rounded-2xl flex items-center gap-3 hover:bg-[var(--surface-2)] cursor-pointer"
            onClick={() =>
              window.open(`/api/honoraires/situations/${s.id}/pdf`, "_blank")
            }
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background:
                  s.statut === "payee"
                    ? "rgba(22,163,74,0.10)"
                    : s.statut === "envoyee"
                      ? "rgba(245,158,11,0.10)"
                      : "rgba(95,102,117,0.10)",
                color:
                  s.statut === "payee"
                    ? "var(--success)"
                    : s.statut === "envoyee"
                      ? "var(--warning)"
                      : "var(--text-secondary)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                {s.statut === "payee" ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </>
                )}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold font-tabular">
                {s.numero}
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {new Date(s.dateEmission).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold font-tabular">
                {Number(s.montantHt ?? 0).toLocaleString("fr-FR")} €
              </div>
              <StatutPill statut={s.statut} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatutPill({
  statut,
}: {
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
}) {
  const map = {
    brouillon: { label: "Brouillon", bg: "var(--surface-2)", fg: "var(--text-secondary)" },
    a_valider: { label: "À valider", bg: "rgba(245,158,11,0.15)", fg: "var(--warning)" },
    signee: { label: "Signée", bg: "rgba(31,45,234,0.15)", fg: "var(--brand)" },
    envoyee: { label: "Envoyée", bg: "rgba(245,158,11,0.15)", fg: "var(--warning)" },
    payee: { label: "Payée", bg: "rgba(22,163,74,0.15)", fg: "var(--success)" },
  } as const;
  const meta = map[statut];
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}
