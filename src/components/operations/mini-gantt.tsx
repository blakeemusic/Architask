"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

export interface GanttTask {
  id: string;
  label: string;
  start: Date;
  end: Date;
  /** % d'avancement (0..100). Affiche la portion "réelle" plus claire. */
  pctDone?: number;
  /** Couleur gradient. Default brand→violet. */
  gradient?: string;
}

export interface GanttMilestone {
  id: string;
  label: string;
  date: Date;
  color?: string;
}

export interface MiniGanttProps {
  tasks: GanttTask[];
  milestones?: GanttMilestone[];
  /** Bornes temporelles du viewport ; auto si absent. */
  windowStart?: Date;
  windowEnd?: Date;
  /** Date "aujourd'hui" pour le marker. */
  today: Date;
  className?: string;
}

/**
 * Mini-Gantt sur card noire (style mockup v0.3 frame-operation).
 * Reproduit : header mois en initiales, ligne verticale "aujourd'hui",
 * barres prévues vs réelles superposées, milestones en losanges.
 */
export function MiniGantt({
  tasks,
  milestones = [],
  windowStart,
  windowEnd,
  today,
  className,
}: MiniGanttProps) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  // Compute window
  const minDate = React.useMemo(() => {
    if (windowStart) return windowStart;
    const allDates = [
      ...tasks.flatMap((t) => [t.start, t.end]),
      ...milestones.map((m) => m.date),
      today,
    ];
    return new Date(Math.min(...allDates.map((d) => d.getTime())));
  }, [windowStart, tasks, milestones, today]);
  const maxDate = React.useMemo(() => {
    if (windowEnd) return windowEnd;
    const allDates = [
      ...tasks.flatMap((t) => [t.start, t.end]),
      ...milestones.map((m) => m.date),
      today,
    ];
    return new Date(Math.max(...allDates.map((d) => d.getTime())));
  }, [windowEnd, tasks, milestones, today]);
  const span = Math.max(1, maxDate.getTime() - minDate.getTime());

  const ratio = (d: Date) =>
    Math.max(0, Math.min(1, (d.getTime() - minDate.getTime()) / span));

  const todayRatio = ratio(today);

  // Génère 12 colonnes mois (initiales) du windowStart à windowEnd.
  const monthLetters = React.useMemo(() => {
    const result: string[] = [];
    const cur = new Date(minDate);
    cur.setDate(1);
    while (cur <= maxDate) {
      const letter = cur.toLocaleDateString("fr-FR", { month: "narrow" });
      result.push(letter);
      cur.setMonth(cur.getMonth() + 1);
    }
    // Cap à 12 pour matcher la grille du mockup.
    return result.slice(0, 12);
  }, [minDate, maxDate]);

  return (
    <div
      className={cn("card-black p-7", className)}
      style={{ background: "var(--black)", borderRadius: 28 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[18px] font-semibold">Planning</h3>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {tasks.length} lot{tasks.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Header mois */}
      <div
        className="grid gap-1 text-[10px] font-semibold mb-3"
        style={{
          gridTemplateColumns: `repeat(${Math.max(monthLetters.length, 12)}, minmax(0, 1fr))`,
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {monthLetters.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>

      <div className="space-y-2 font-tabular text-[11px] relative">
        {/* Vertical marker "aujourd'hui" */}
        <div
          className="absolute"
          style={{
            left: `${todayRatio * 100}%`,
            top: -10,
            bottom: 20,
            width: 1,
            background: "rgba(255,255,255,0.30)",
          }}
        />
        <div
          className="absolute"
          style={{
            left: `${todayRatio * 100}%`,
            top: -22,
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <div
            className="text-[11px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-lg"
            style={{
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          >
            {today.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </div>
        </div>

        {/* Lot bars */}
        {tasks.map((task, i) => {
          const startRatio = ratio(task.start);
          const endRatio = ratio(task.end);
          const width = Math.max(0.01, endRatio - startRatio);
          const doneRatio =
            ((task.pctDone ?? 0) / 100) * width;
          const isHovered = hoverIdx === i;
          return (
            <div
              key={task.id}
              className="relative h-5 group"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Barre prévue */}
              <div
                className="absolute rounded-md h-2 my-1.5 transition-all"
                style={{
                  left: `${startRatio * 100}%`,
                  width: `${width * 100}%`,
                  background: "rgba(255,255,255,0.15)",
                }}
              />
              {/* Barre réelle (en dessus) */}
              <div
                className="absolute rounded-md h-2 my-1.5 transition-all"
                style={{
                  left: `${startRatio * 100}%`,
                  width: `${doneRatio * 100}%`,
                  background:
                    task.gradient ??
                    "linear-gradient(90deg, #4F5DFF 0%, #8B5CF6 100%)",
                }}
              />
              {/* Tooltip au hover */}
              {isHovered && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: `${(startRatio + width / 2) * 100}%`,
                    bottom: 18,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="text-[11px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-lg"
                    style={{
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                    }}
                  >
                    {task.label} · {formatDateShort(task.start)} →{" "}
                    {formatDateShort(task.end)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Milestones */}
        {milestones.map((m) => (
          <div key={m.id} className="relative h-6 mt-2">
            <div
              className="absolute flex items-center gap-1.5"
              style={{
                left: `${ratio(m.date) * 100}%`,
                top: 2,
                transform: "translateX(-50%)",
              }}
            >
              <div
                className="w-3 h-3 rotate-45"
                style={{ background: m.color ?? "var(--mint-300)" }}
              />
              <span
                className="text-[10px]"
                style={{ color: m.color ?? "var(--mint-300)" }}
              >
                {m.label}
              </span>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div
            className="text-center py-6 text-[12px]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Aucun lot signé pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}
