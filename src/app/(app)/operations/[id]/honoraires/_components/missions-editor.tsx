"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  createMission,
  deleteMission,
  reorderMissions,
  updateMission,
} from "@/server/actions/honoraires/missions";

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

export function MissionsEditor({
  contractId,
  contractMontantHt,
  isLocked,
  missions: initialMissions,
}: {
  contractId: string;
  contractMontantHt: string;
  isLocked: boolean;
  missions: Mission[];
}) {
  const router = useRouter();
  // Drag local override (uniquement pendant le drag, sinon on prend les props).
  const [draftMissions, setDraftMissions] = React.useState<Mission[] | null>(
    null,
  );
  const missions = draftMissions ?? initialMissions;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = missions.findIndex((m) => m.id === active.id);
    const newIndex = missions.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(missions, oldIndex, newIndex);
    setDraftMissions(reordered);
    const res = await reorderMissions({
      contractId,
      orderedIds: reordered.map((m) => m.id),
    });
    if (res.error) {
      toast.error(res.error);
    }
    setDraftMissions(null);
    router.refresh();
  };

  const onAdd = async () => {
    // Type par défaut = celui des missions existantes, sinon pct
    const allPct = missions.length === 0 || missions.every((m) => m.typeValeur === "pct");
    const res = await createMission({
      contractId,
      libelle: `Mission ${missions.length + 1}`,
      typeValeur: allPct ? "pct" : "montant",
      pctDuTotal: allPct ? "0" : undefined,
      montantHt: allPct ? undefined : "0",
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  const sum = missions.reduce((acc, m) => {
    if (m.typeValeur === "pct") return acc + Number(m.pctDuTotal ?? 0);
    return acc + Number(m.montantHt ?? 0);
  }, 0);
  const isPctMode = missions.length > 0 && missions[0].typeValeur === "pct";
  const expected = isPctMode ? 100 : Number(contractMontantHt);
  const isValid = Math.abs(sum - expected) <= 0.01;

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      <div className="px-7 py-5 flex items-center justify-between">
        <div>
          <h2
            className="text-[18px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Missions d&apos;honoraires
          </h2>
          <p
            className="text-[12px] mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {missions.length} mission{missions.length > 1 ? "s" : ""} ·{" "}
            <span
              className="font-tabular font-semibold"
              style={{ color: isValid ? "var(--success)" : "var(--danger)" }}
            >
              {isPctMode
                ? `Σ% = ${sum.toFixed(2)}%`
                : `Σ = ${sum.toFixed(0)} €`}{" "}
              {isValid ? "✓" : "✗"}
            </span>{" "}
            · Glisser pour réordonner
          </p>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={onAdd}
            className="px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--surface-2)]"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        {missions.length === 0 ? (
          <div
            className="py-10 text-center text-[13px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Aucune mission — clique sur « Ajouter » pour démarrer.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={missions.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {missions.map((m, i) => (
                <SortableMissionRow
                  key={m.id}
                  mission={m}
                  ordre={i + 1}
                  contractMontantHt={contractMontantHt}
                  isLocked={isLocked}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Total */}
        {missions.length > 0 && (
          <div
            className="px-4 py-3 rounded-2xl flex items-center gap-3 mt-2"
            style={{ background: "var(--surface-2)" }}
          >
            <div className="w-7 h-7" />
            <div className="w-7 h-7" />
            <div className="flex-1">
              <div className="text-[13px] font-bold">Total contrat</div>
              <div
                className="text-[11px] font-tabular"
                style={{
                  color: isValid ? "var(--success)" : "var(--danger)",
                }}
              >
                {isPctMode
                  ? `Σ% = ${sum.toFixed(2)} %`
                  : `Σ = ${formatEuro(sum)} €`}{" "}
                {isValid ? "✓" : "✗ — doit atteindre 100 % avant signature"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold font-tabular">
                {formatEuro(Number(contractMontantHt))} €
              </div>
              <div
                className="text-[10px] font-tabular"
                style={{ color: "var(--text-tertiary)" }}
              >
                Total contrat HT
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableMissionRow({
  mission,
  ordre,
  contractMontantHt,
  isLocked,
}: {
  mission: Mission;
  ordre: number;
  contractMontantHt: string;
  isLocked: boolean;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mission.id, disabled: isLocked });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.95 : 1,
  };

  const propValue =
    mission.typeValeur === "pct"
      ? mission.pctDuTotal ?? "0"
      : mission.montantHt ?? "0";
  const [draft, setDraft] = React.useState<{
    libelle: string;
    value: string;
  } | null>(null);
  const editing = draft !== null;
  const libelle = draft?.libelle ?? mission.libelle;
  const value = draft?.value ?? propValue;

  const startEdit = () =>
    setDraft({ libelle: mission.libelle, value: propValue });
  const cancelEdit = () => setDraft(null);

  const montantCalcule =
    mission.typeValeur === "pct"
      ? (Number(value) / 100) * Number(contractMontantHt)
      : Number(value);

  const onSave = async () => {
    if (!draft) return;
    const res = await updateMission({
      id: mission.id,
      libelle: draft.libelle,
      pctDuTotal: mission.typeValeur === "pct" ? draft.value : undefined,
      montantHt: mission.typeValeur === "montant" ? draft.value : undefined,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    router.refresh();
  };

  const onDelete = async () => {
    if (!confirm(`Supprimer la mission « ${mission.libelle} » ?`)) return;
    const res = await deleteMission({ id: mission.id });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  const avancement = Number(mission.pctAvancementCourant);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-4 py-3 rounded-2xl flex items-center gap-3 group hover:bg-[var(--surface-2)]"
    >
      {!isLocked ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          aria-label="Réordonner"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </button>
      ) : (
        <div className="w-3.5" />
      )}
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold"
        style={{
          background:
            avancement >= 100
              ? "#B8F2D1"
              : avancement > 0
                ? "var(--brand)"
                : "var(--surface-2)",
          color:
            avancement >= 100
              ? "#064E2C"
              : avancement > 0
                ? "white"
                : "var(--text-tertiary)",
        }}
      >
        {ordre}
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={libelle}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, libelle: e.target.value } : d))
            }
            onBlur={onSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") cancelEdit();
            }}
            autoFocus
            className="w-full text-[14px] font-bold bg-transparent outline-none border-b border-[var(--brand)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => !isLocked && startEdit()}
            disabled={isLocked}
            className={isLocked ? "cursor-default" : "cursor-text"}
          >
            <div className="text-[14px] font-bold text-left">
              {mission.libelle}
            </div>
          </button>
        )}
        <div
          className="text-[11px] mt-0.5 font-tabular flex items-center gap-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {editing ? (
            <input
              value={value}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, value: e.target.value } : d))
              }
              onBlur={onSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
              }}
              type="text"
              inputMode="decimal"
              className="w-24 px-2 py-0.5 bg-transparent border border-[var(--border)] rounded-md outline-none focus:border-[var(--brand)]"
            />
          ) : (
            <span>
              {mission.typeValeur === "pct"
                ? `${value} %`
                : `${formatEuro(Number(value))} € HT`}
            </span>
          )}
          <span>·</span>
          <span>{formatEuro(montantCalcule)} € HT</span>
        </div>
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
            color:
              avancement >= 100
                ? "var(--success)"
                : avancement > 0
                  ? "var(--brand)"
                  : "var(--text-tertiary)",
          }}
        >
          {avancement.toFixed(0)}
          <span className="text-[12px]">%</span>
        </div>
      </div>

      {!isLocked && (
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--surface)]"
          aria-label="Supprimer la mission"
          style={{ color: "var(--text-tertiary)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
