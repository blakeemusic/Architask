import * as React from "react";

import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

export interface ProgressBarGradientProps {
  /** % d'avancement 0..100. */
  pct: number;
  /** Affiche un tooltip noir au-dessus du curseur (date d'aujourd'hui). */
  markerDate?: Date;
  /** Date début (affichée à gauche). */
  startDate?: Date;
  /** Date fin / milestone (affichée à droite, en dot vert). */
  endDate?: Date;
  /** Labels de débul/fin custom (override les dates formatées). */
  startLabel?: string;
  endLabel?: string;
  className?: string;
}

/**
 * Reproduit la progress bar de la frame "operation" du mockup v0.3 :
 * - gradient brand → violet (#1F2DEA → #4F5DFF → #8B5CF6)
 * - tooltip noir flottant au-dessus du curseur "aujourd'hui"
 * - milestone réception en dot vert à droite
 */
export function ProgressBarGradient({
  pct,
  markerDate,
  startDate,
  endDate,
  startLabel,
  endLabel,
  className,
}: ProgressBarGradientProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative h-3 rounded-full overflow-visible"
        style={{ background: "var(--surface-2)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background:
              "linear-gradient(90deg, #1F2DEA 0%, #4F5DFF 50%, #8B5CF6 100%)",
          }}
        />
        {markerDate && clamped > 0 && clamped < 100 && (
          <div
            className="absolute"
            style={{
              left: `${clamped}%`,
              top: "-32px",
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="text-[12px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
              style={{
                background: "var(--black)",
                color: "var(--surface)",
              }}
            >
              {markerDate.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div
              className="w-px h-3 mx-auto"
              style={{ background: "var(--text-primary)" }}
            />
          </div>
        )}
        {/* Milestone réception dot vert à droite */}
        {endDate && (
          <div className="absolute" style={{ right: 0, top: "-3px" }}>
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                background: "var(--surface)",
                borderColor: "var(--success)",
              }}
            />
          </div>
        )}
      </div>
      {(startDate || endDate || startLabel || endLabel) && (
        <div
          className="flex items-center justify-between text-[11px] mt-2 font-tabular"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>{startLabel ?? (startDate ? `OS · ${formatDateShort(startDate)}` : "—")}</span>
          <span style={{ color: endDate ? "var(--success)" : undefined }}>
            {endLabel ?? (endDate ? `Réception · ${formatDateShort(endDate)}` : "—")}
          </span>
        </div>
      )}
    </div>
  );
}
