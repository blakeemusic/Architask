"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { formatDateShort, formatPct } from "@/lib/format";
import {
  computeAutoStatut,
  MILESTONE_COLORS,
  MILESTONE_LABELS,
  STATUS_LABELS,
  type PlanningTaskStatus,
} from "@/lib/planning/status";

export interface FullGanttTask {
  id: string;
  type: "lot" | "jalon";
  libelle: string;
  /** Sous-titre (ex: entreprise pour un lot, type de jalon pour un milestone). */
  sublabel?: string;
  dateDebutPrevue: Date | null;
  dateFinPrevue: Date | null;
  dateDebutReelle: Date | null;
  dateFinReelle: Date | null;
  /** % d'avancement (0..100), pour les lots. */
  pctAvancement?: number;
  statut: PlanningTaskStatus;
  milestoneKind?: string | null;
}

export interface FullGanttProps {
  tasks: FullGanttTask[];
  today?: Date;
  onTaskClick?: (taskId: string) => void;
  className?: string;
}

const LEFT_COL_WIDTH = 280;
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 48;
const MIN_MONTH_WIDTH = 96;

export function FullGantt({
  tasks,
  today = new Date(),
  onTaskClick,
  className,
}: FullGanttProps) {
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  // Compute time window from all task dates + today.
  const { minDate, maxDate, months } = React.useMemo(() => {
    const allDates: Date[] = [today];
    for (const t of tasks) {
      if (t.dateDebutPrevue) allDates.push(t.dateDebutPrevue);
      if (t.dateFinPrevue) allDates.push(t.dateFinPrevue);
      if (t.dateDebutReelle) allDates.push(t.dateDebutReelle);
      if (t.dateFinReelle) allDates.push(t.dateFinReelle);
    }
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    // Pad: 1 month margin de chaque côté pour respirer.
    min.setDate(1);
    min.setMonth(min.getMonth() - 1);
    max.setDate(1);
    max.setMonth(max.getMonth() + 2);
    const monthsList: Date[] = [];
    const cur = new Date(min);
    while (cur <= max) {
      monthsList.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return { minDate: min, maxDate: max, months: monthsList };
  }, [tasks, today]);

  const span = Math.max(1, maxDate.getTime() - minDate.getTime());
  const ratio = (d: Date) =>
    Math.max(0, Math.min(1, (d.getTime() - minDate.getTime()) / span));

  const ganttWidth = Math.max(months.length * MIN_MONTH_WIDTH, 800);

  // Séparation lots (en haut) puis jalons (en bas), tri par date.
  const sorted = React.useMemo(() => {
    const lots = tasks
      .filter((t) => t.type === "lot")
      .sort((a, b) => {
        const da = a.dateDebutPrevue?.getTime() ?? 0;
        const db = b.dateDebutPrevue?.getTime() ?? 0;
        return da - db;
      });
    const milestones = tasks
      .filter((t) => t.type === "jalon")
      .sort((a, b) => {
        const da = a.dateDebutPrevue?.getTime() ?? 0;
        const db = b.dateDebutPrevue?.getTime() ?? 0;
        return da - db;
      });
    return [...lots, ...milestones];
  }, [tasks]);

  return (
    <div
      className={cn("rounded-3xl overflow-hidden", className)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex">
        {/* Colonne fixe gauche : libellés */}
        <div
          className="shrink-0"
          style={{
            width: LEFT_COL_WIDTH,
            borderRight: "1px solid var(--border)",
          }}
        >
          {/* Header gauche */}
          <div
            className="flex items-end px-5 pb-3"
            style={{
              height: HEADER_HEIGHT,
              borderBottom: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div
              className="text-[11px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Lot / Jalon
            </div>
          </div>
          {/* Rows */}
          {sorted.map((task) => {
            const autoStatut = computeAutoStatut(task, today);
            const isHovered = hoverId === task.id;
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task.id)}
                onMouseEnter={() => setHoverId(task.id)}
                onMouseLeave={() => setHoverId(null)}
                className={cn(
                  "px-5 flex items-center cursor-pointer transition-colors",
                  isHovered && "bg-[var(--surface-2)]",
                )}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {task.type === "jalon" && (
                      <div
                        className="w-2 h-2 rotate-45 shrink-0"
                        style={{
                          background:
                            MILESTONE_COLORS[task.milestoneKind ?? "autre"],
                        }}
                      />
                    )}
                    <div
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {task.libelle}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.sublabel && (
                      <div
                        className="text-[11px] truncate"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {task.sublabel}
                      </div>
                    )}
                    <StatutDot statut={autoStatut} />
                    {task.type === "lot" &&
                      task.pctAvancement !== undefined && (
                        <span
                          className="text-[11px] font-semibold font-tabular"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {formatPct(task.pctAvancement)}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div
              className="px-5 py-10 text-[13px] text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucune tâche.
            </div>
          )}
        </div>

        {/* Colonne droite scrollable : zone Gantt */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: ganttWidth, position: "relative" }}>
            {/* Header mois */}
            <div
              className="flex"
              style={{
                height: HEADER_HEIGHT,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {months.map((m, i) => {
                const isCurrent =
                  m.getFullYear() === today.getFullYear() &&
                  m.getMonth() === today.getMonth();
                return (
                  <div
                    key={i}
                    className="flex flex-col justify-end px-3 pb-2"
                    style={{
                      flex: 1,
                      minWidth: MIN_MONTH_WIDTH,
                      borderRight:
                        i < months.length - 1
                          ? "1px solid var(--border-subtle)"
                          : undefined,
                    }}
                  >
                    <div
                      className="text-[11px] font-semibold uppercase tracking-[0.4px]"
                      style={{
                        color: isCurrent
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                      }}
                    >
                      {m.toLocaleDateString("fr-FR", {
                        month: "short",
                      })}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {m.getFullYear()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body rows */}
            <div className="relative">
              {/* Mois background lines */}
              <div
                className="absolute inset-0 flex pointer-events-none"
                aria-hidden="true"
              >
                {months.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      minWidth: MIN_MONTH_WIDTH,
                      borderRight:
                        i < months.length - 1
                          ? "1px solid var(--border-subtle)"
                          : undefined,
                    }}
                  />
                ))}
              </div>

              {/* Today vertical line */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${ratio(today) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--text-primary)",
                  opacity: 0.3,
                  zIndex: 1,
                }}
              />
              {/* Today pill */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${ratio(today) * 100}%`,
                  top: 6,
                  transform: "translateX(-50%)",
                  zIndex: 5,
                }}
              >
                <div
                  className="text-[10px] font-semibold whitespace-nowrap px-2 py-0.5 rounded-md"
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--surface)",
                  }}
                >
                  {today.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              </div>

              {/* Rows */}
              {sorted.map((task) => (
                <GanttRow
                  key={task.id}
                  task={task}
                  ratio={ratio}
                  isHovered={hoverId === task.id}
                  onMouseEnter={() => setHoverId(task.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => onTaskClick?.(task.id)}
                />
              ))}

              {sorted.length === 0 && (
                <div style={{ height: ROW_HEIGHT * 4 }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  task,
  ratio,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  task: FullGanttTask;
  ratio: (d: Date) => number;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  if (task.type === "jalon") {
    const date = task.dateDebutPrevue;
    if (!date) {
      return (
        <div
          className={cn(
            "relative cursor-pointer transition-colors",
            isHovered && "bg-[var(--surface-2)]",
          )}
          style={{
            height: ROW_HEIGHT,
            borderBottom: "1px solid var(--border-subtle)",
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        />
      );
    }
    const color = MILESTONE_COLORS[task.milestoneKind ?? "autre"];
    return (
      <div
        className={cn(
          "relative cursor-pointer transition-colors",
          isHovered && "bg-[var(--surface-2)]",
        )}
        style={{
          height: ROW_HEIGHT,
          borderBottom: "1px solid var(--border-subtle)",
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <div
          className="absolute"
          style={{
            left: `${ratio(date) * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 3,
          }}
        >
          <div
            className="w-4 h-4 rotate-45"
            style={{
              background: color,
              boxShadow: isHovered ? `0 0 0 4px ${color}33` : undefined,
              transition: "box-shadow 120ms",
            }}
          />
        </div>
        {isHovered && (
          <Tooltip
            left={ratio(date) * 100}
            content={
              <>
                <div className="font-semibold">
                  {MILESTONE_LABELS[task.milestoneKind ?? "autre"]} · {task.libelle}
                </div>
                <div style={{ color: "rgba(255,255,255,0.7)" }}>
                  {formatDateShort(date)}
                </div>
              </>
            }
          />
        )}
      </div>
    );
  }

  // Lot bar
  const start = task.dateDebutPrevue;
  const end = task.dateFinPrevue;
  const startReel = task.dateDebutReelle;
  const endReel = task.dateFinReelle;

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-colors",
        isHovered && "bg-[var(--surface-2)]",
      )}
      style={{
        height: ROW_HEIGHT,
        borderBottom: "1px solid var(--border-subtle)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {start && end && (
        <>
          {/* Barre prévue (fond clair) */}
          <div
            className="absolute rounded-lg"
            style={{
              left: `${ratio(start) * 100}%`,
              width: `${(ratio(end) - ratio(start)) * 100}%`,
              top: ROW_HEIGHT / 2 - 12,
              height: 10,
              background: "var(--surface-3, rgba(95,102,117,0.15))",
              border: "1px solid var(--border)",
              zIndex: 2,
            }}
          />
          {/* Barre réelle (avancement, gradient brand→violet) */}
          {task.pctAvancement !== undefined && task.pctAvancement > 0 && (
            <div
              className="absolute rounded-lg"
              style={{
                left: `${ratio(start) * 100}%`,
                width: `${(ratio(end) - ratio(start)) * (task.pctAvancement / 100) * 100}%`,
                top: ROW_HEIGHT / 2 - 1,
                height: 10,
                background:
                  "linear-gradient(90deg, #4F5DFF 0%, #8B5CF6 100%)",
                zIndex: 3,
              }}
            />
          )}
        </>
      )}
      {/* Marqueur "fait" si dateDebutReelle + dateFinReelle */}
      {startReel && endReel && (
        <div
          className="absolute rounded-lg"
          style={{
            left: `${ratio(startReel) * 100}%`,
            width: `${(ratio(endReel) - ratio(startReel)) * 100}%`,
            top: ROW_HEIGHT / 2 - 1,
            height: 10,
            background:
              "linear-gradient(90deg, #4F5DFF 0%, #8B5CF6 100%)",
            opacity: 0.95,
            zIndex: 3,
          }}
        />
      )}

      {isHovered && start && end && (
        <Tooltip
          left={(ratio(start) + ratio(end)) * 50}
          content={
            <>
              <div className="font-semibold">{task.libelle}</div>
              <div style={{ color: "rgba(255,255,255,0.7)" }}>
                Prévu : {formatDateShort(start)} → {formatDateShort(end)}
              </div>
              {startReel && (
                <div style={{ color: "rgba(255,255,255,0.7)" }}>
                  Réel : {formatDateShort(startReel)}
                  {endReel ? ` → ${formatDateShort(endReel)}` : " → en cours"}
                </div>
              )}
              {task.pctAvancement !== undefined && (
                <div style={{ color: "rgba(255,255,255,0.7)" }}>
                  Avancement : {formatPct(task.pctAvancement)}
                </div>
              )}
            </>
          }
        />
      )}

    </div>
  );
}

function Tooltip({
  left,
  content,
}: {
  left: number;
  content: React.ReactNode;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: -4,
        transform: "translate(-50%, -100%)",
        zIndex: 10,
      }}
    >
      <div
        className="text-[11px] whitespace-nowrap px-2.5 py-1.5 rounded-lg"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function StatutDot({ statut }: { statut: PlanningTaskStatus }) {
  const color =
    statut === "termine"
      ? "var(--mint-500, #34D399)"
      : statut === "en_cours"
        ? "#1F2DEA"
        : statut === "en_retard"
          ? "#EF4444"
          : "var(--text-tertiary)";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={STATUS_LABELS[statut]}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      <span
        className="text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {STATUS_LABELS[statut]}
      </span>
    </span>
  );
}
