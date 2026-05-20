"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  FullGantt,
  type FullGanttTask,
} from "@/components/operations/full-gantt";
import { PlanningTaskDrawer, type PlanningTaskDrawerTask } from "../../_components/planning-task-drawer";

type PlanningTaskInput = {
  id: string;
  type: "lot" | "jalon";
  lotId: string | null;
  libelle: string;
  dateDebutPrevue: Date | null;
  dateFinPrevue: Date | null;
  dateDebutReelle: Date | null;
  dateFinReelle: Date | null;
  statut: "a_venir" | "en_cours" | "termine" | "en_retard";
  milestoneKind: string | null;
};

type LotInput = {
  id: string;
  numero: string;
  libelle: string;
  company: { raisonSociale: string } | null;
};

export function PlanningClient({
  operationId,
  operationName,
  planningTasks,
  lots,
  pctByLot,
}: {
  operationId: string;
  operationName: string;
  planningTasks: PlanningTaskInput[];
  lots: LotInput[];
  pctByLot: Record<string, number>;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const ganttTasks: FullGanttTask[] = React.useMemo(() => {
    return planningTasks.map((t) => {
      const lot = t.lotId ? lots.find((l) => l.id === t.lotId) : null;
      return {
        id: t.id,
        type: t.type,
        libelle: t.libelle,
        sublabel:
          t.type === "lot" && lot
            ? (lot.company?.raisonSociale ?? `Lot ${lot.numero}`)
            : undefined,
        dateDebutPrevue: t.dateDebutPrevue,
        dateFinPrevue: t.dateFinPrevue,
        dateDebutReelle: t.dateDebutReelle,
        dateFinReelle: t.dateFinReelle,
        pctAvancement: t.lotId ? pctByLot[t.lotId] : undefined,
        statut: t.statut,
        milestoneKind: t.milestoneKind,
      };
    });
  }, [planningTasks, lots, pctByLot]);

  const selectedTask = React.useMemo<PlanningTaskDrawerTask | null>(() => {
    if (!selectedId) return null;
    const t = planningTasks.find((p) => p.id === selectedId);
    if (!t) return null;
    return {
      id: t.id,
      type: t.type,
      libelle: t.libelle,
      dateDebutPrevue: t.dateDebutPrevue,
      dateFinPrevue: t.dateFinPrevue,
      dateDebutReelle: t.dateDebutReelle,
      dateFinReelle: t.dateFinReelle,
      statut: t.statut,
      milestoneKind: t.milestoneKind,
    };
  }, [selectedId, planningTasks]);

  const onTaskClick = (taskId: string) => {
    setSelectedId(taskId);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const onAddJalon = () => {
    setSelectedId(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const onExportPdf = () => {
    window.open(`/api/operations/${operationId}/planning-pdf`, "_blank");
  };

  const lotsCount = planningTasks.filter((t) => t.type === "lot").length;
  const jalonsCount = planningTasks.filter((t) => t.type === "jalon").length;

  return (
    <>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="title-xl">Planning chantier</h1>
          <p
            className="text-[13px] mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {operationName} · {lotsCount} lot{lotsCount > 1 ? "s" : ""} · {jalonsCount}{" "}
            jalon{jalonsCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onExportPdf}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mr-1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF
          </Button>
          <Button onClick={onAddJalon}>
            <span className="mr-1.5">+</span> Jalon
          </Button>
        </div>
      </div>

      <FullGantt tasks={ganttTasks} onTaskClick={onTaskClick} />

      <PlanningTaskDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        operationId={operationId}
        task={selectedTask}
      />
    </>
  );
}
