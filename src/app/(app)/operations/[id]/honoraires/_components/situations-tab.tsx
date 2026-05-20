"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteSituation,
  markSituationPaid,
  markSituationSent,
  requestSituationValidation,
  signSituation,
} from "@/server/actions/honoraires/situations";

import { SituationCreateDrawer } from "./situation-create-drawer";

type Mission = {
  id: string;
  libelle: string;
  ordre: number;
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null;
  montantHt: string | null;
  montantCalcule: string | null;
  pctAvancementCourant: string;
};

type Situation = {
  id: string;
  numero: string;
  dateEmission: Date;
  pctAvancementPrecedent: string;
  pctAvancementNouveau: string;
  montantHt: string | null;
  montantTva: string | null;
  montantTtc: string | null;
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
  signedAt: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  mission: { id: string; libelle: string; ordre: number };
};

type Contract = {
  id: string;
  montantTotalHt: string | null;
  tauxTva: string;
  statut: string;
};

export function SituationsTab({
  contract,
  missions,
  situations,
  operationCode,
  currentUserRole,
}: {
  contract: Contract;
  missions: Mission[];
  situations: Situation[];
  operationCode: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [presetMissionId, setPresetMissionId] = React.useState<string | null>(
    null,
  );

  const contractSigned =
    contract.statut === "signe" || contract.statut === "en_execution";
  const canSign = currentUserRole === "owner" || currentUserRole === "admin";

  const openCreateFor = (missionId: string) => {
    setPresetMissionId(missionId);
    setDrawerOpen(true);
  };

  return (
    <div className="grid grid-cols-5 gap-6">
      <div
        className="col-span-3 rounded-3xl overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <div className="px-7 py-5 flex items-center justify-between">
          <div>
            <h2
              className="text-[18px] font-bold tracking-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              Avancement par mission
            </h2>
            <p
              className="text-[12px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Clique « + Facturer » pour émettre une note d&apos;honoraires
            </p>
          </div>
          {contractSigned && (
            <Button
              onClick={() => {
                setPresetMissionId(null);
                setDrawerOpen(true);
              }}
            >
              + Nouvelle note
            </Button>
          )}
        </div>

        {!contractSigned && (
          <div
            className="mx-3 mb-3 p-4 rounded-2xl text-[12px]"
            style={{
              background: "rgba(245,158,11,0.10)",
              color: "var(--warning)",
            }}
          >
            Le contrat doit être signé avant d&apos;émettre des notes
            d&apos;honoraires.
          </div>
        )}

        <div className="px-3 pb-3">
          {missions.length === 0 && (
            <div
              className="py-10 text-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucune mission au contrat.
            </div>
          )}
          {missions.map((m) => (
            <MissionAvancementRow
              key={m.id}
              mission={m}
              contractMontantHt={contract.montantTotalHt ?? "0"}
              onCreate={() => openCreateFor(m.id)}
              canCreate={contractSigned}
            />
          ))}
        </div>
      </div>

      <div className="col-span-2">
        <SituationsList
          situations={situations}
          operationCode={operationCode}
          canSign={canSign}
          onMutate={() => router.refresh()}
        />
      </div>

      <SituationCreateDrawer
        key={`${drawerOpen ? "open" : "closed"}-${presetMissionId ?? "none"}`}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        missions={missions}
        presetMissionId={presetMissionId}
        contractMontantHt={contract.montantTotalHt ?? "0"}
        tauxTva={contract.tauxTva}
      />
    </div>
  );
}

function MissionAvancementRow({
  mission,
  contractMontantHt,
  onCreate,
  canCreate,
}: {
  mission: Mission;
  contractMontantHt: string;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const avancement = Number(mission.pctAvancementCourant);
  const montantMission =
    mission.typeValeur === "pct"
      ? (Number(mission.pctDuTotal ?? 0) / 100) * Number(contractMontantHt)
      : Number(mission.montantHt ?? 0);
  const factureMontant = (avancement / 100) * montantMission;
  const restant = montantMission - factureMontant;
  const isFull = avancement >= 100;
  const isInProgress = avancement > 0 && avancement < 100;

  return (
    <div
      className="px-4 py-3 rounded-2xl flex items-center gap-3 group hover:bg-[var(--surface-2)]"
      style={
        isInProgress
          ? {
              background: "rgba(31,45,234,0.04)",
              border: "1.5px solid var(--brand)",
            }
          : undefined
      }
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold"
        style={{
          background: isFull
            ? "#B8F2D1"
            : isInProgress
              ? "var(--brand)"
              : "var(--surface-2)",
          color: isFull
            ? "#064E2C"
            : isInProgress
              ? "white"
              : "var(--text-tertiary)",
        }}
      >
        {mission.ordre}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold">{mission.libelle}</div>
        <div
          className="text-[11px] mt-0.5 font-tabular"
          style={{ color: "var(--text-secondary)" }}
        >
          {mission.typeValeur === "pct" ? `${mission.pctDuTotal}% · ` : ""}
          {formatEuro(montantMission)} € HT
        </div>
        {isInProgress && (
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex-1 h-2 rounded-full"
              style={{ background: "var(--surface-2)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${avancement}%`,
                  background:
                    "linear-gradient(90deg, var(--brand) 0%, #4F5DFF 100%)",
                }}
              />
            </div>
            <span
              className="text-[11px] font-bold font-tabular"
              style={{ color: "var(--brand)" }}
            >
              {avancement.toFixed(0)} %
            </span>
          </div>
        )}
      </div>

      <div className="text-right w-20">
        <div
          className="text-[10px] uppercase font-semibold"
          style={{ color: "var(--text-tertiary)" }}
        >
          Avancement
        </div>
        <div
          className="font-tabular leading-none mt-1"
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: isFull
              ? "var(--success)"
              : isInProgress
                ? "var(--brand)"
                : "var(--text-tertiary)",
          }}
        >
          {avancement.toFixed(0)}
          <span className="text-[12px]">%</span>
        </div>
      </div>

      <div className="w-24">
        <div
          className="text-[10px] uppercase font-semibold mb-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          Facturé
        </div>
        <div
          className="text-[13px] font-bold font-tabular"
          style={{ color: avancement > 0 ? "var(--text-primary)" : "var(--text-tertiary)" }}
        >
          {formatEuro(factureMontant)} €
        </div>
        {restant > 0 && (
          <div
            className="text-[10px] font-tabular"
            style={{ color: "var(--text-tertiary)" }}
          >
            / {formatEuro(montantMission)} €
          </div>
        )}
      </div>

      {canCreate && !isFull ? (
        <button
          type="button"
          onClick={onCreate}
          className="px-3 py-2 rounded-xl text-[11px] font-bold text-white"
          style={{ background: "var(--brand)" }}
        >
          + Facturer
        </button>
      ) : isFull ? (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(22,163,74,0.15)",
            color: "var(--success)",
          }}
        >
          Soldée
        </span>
      ) : (
        <div style={{ width: "76px" }} />
      )}
    </div>
  );
}

function SituationsList({
  situations,
  operationCode,
  canSign,
  onMutate,
}: {
  situations: Situation[];
  operationCode: string;
  canSign: boolean;
  onMutate: () => void;
}) {
  return (
    <div
      className="p-6 rounded-3xl"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-5">
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
            Toutes les notes émises sur le contrat
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {situations.length === 0 && (
          <div
            className="text-[12px] py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Aucune note d&apos;honoraires émise.
          </div>
        )}
        {situations.map((s) => (
          <SituationRow
            key={s.id}
            situation={s}
            operationCode={operationCode}
            canSign={canSign}
            onMutate={onMutate}
          />
        ))}
      </div>
    </div>
  );
}

function SituationRow({
  situation,
  operationCode,
  canSign,
  onMutate,
}: {
  situation: Situation;
  operationCode: string;
  canSign: boolean;
  onMutate: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const onAction = async (action: "request" | "sign" | "sent" | "paid" | "delete") => {
    setBusy(true);
    try {
      let res;
      if (action === "request") {
        res = await requestSituationValidation({ id: situation.id });
      } else if (action === "sign") {
        res = await signSituation({ id: situation.id });
      } else if (action === "sent") {
        res = await markSituationSent({ id: situation.id });
      } else if (action === "paid") {
        res = await markSituationPaid({ id: situation.id });
      } else {
        if (!confirm(`Supprimer ${situation.numero} ?`)) return;
        res = await deleteSituation({ id: situation.id });
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Mis à jour.");
      onMutate();
    } finally {
      setBusy(false);
    }
  };

  // Suppress unused
  void operationCode;

  return (
    <div
      className="p-3 rounded-2xl flex items-center gap-3 hover:bg-[var(--surface-2)]"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
        onClick={() =>
          window.open(
            `/api/honoraires/situations/${situation.id}/pdf`,
            "_blank",
          )
        }
        style={{
          background: bgFor(situation.statut),
          color: fgFor(situation.statut),
        }}
        title="Voir PDF"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold font-tabular">
          {situation.numero}
        </div>
        <div
          className="text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {situation.mission.libelle} ·{" "}
          {Number(situation.pctAvancementNouveau).toFixed(0)} %
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-bold font-tabular">
          {formatEuro(Number(situation.montantHt ?? 0))} €
        </div>
        <span
          className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: bgFor(situation.statut),
            color: fgFor(situation.statut),
          }}
        >
          {labelFor(situation.statut)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {situation.statut === "brouillon" && canSign && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("sign")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white"
            style={{ background: "var(--brand)" }}
          >
            Signer
          </button>
        )}
        {situation.statut === "a_valider" && canSign && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("sign")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white"
            style={{ background: "var(--brand)" }}
          >
            Signer
          </button>
        )}
        {situation.statut === "brouillon" && !canSign && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("request")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          >
            Soumettre
          </button>
        )}
        {situation.statut === "signee" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("sent")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          >
            Marquer envoyée
          </button>
        )}
        {(situation.statut === "envoyee" || situation.statut === "signee") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("paid")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
            style={{
              background: "rgba(22,163,74,0.15)",
              color: "var(--success)",
            }}
          >
            Marquer payée
          </button>
        )}
        {situation.statut === "brouillon" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("delete")}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
            style={{ color: "var(--text-tertiary)" }}
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

function labelFor(s: Situation["statut"]): string {
  return s === "brouillon"
    ? "Brouillon"
    : s === "a_valider"
      ? "À valider"
      : s === "signee"
        ? "Signée"
        : s === "envoyee"
          ? "Envoyée"
          : "Payée";
}
function bgFor(s: Situation["statut"]): string {
  return s === "payee"
    ? "rgba(22,163,74,0.15)"
    : s === "envoyee" || s === "a_valider"
      ? "rgba(245,158,11,0.15)"
      : s === "signee"
        ? "rgba(31,45,234,0.15)"
        : "rgba(95,102,117,0.10)";
}
function fgFor(s: Situation["statut"]): string {
  return s === "payee"
    ? "var(--success)"
    : s === "envoyee" || s === "a_valider"
      ? "var(--warning)"
      : s === "signee"
        ? "var(--brand)"
        : "var(--text-secondary)";
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
