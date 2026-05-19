import * as React from "react";

import { cn } from "@/lib/utils";

export interface InsuranceTimelineProps {
  startDate: Date;
  endDate: Date;
  /**
   * Date de référence ("aujourd'hui"). REQUISE pour garder le composant pur :
   * le caller doit fournir un Date stable (typiquement via
   * `React.useState(() => new Date())[0]` ou côté serveur).
   */
  referenceDate: Date;
  /** Seuil "expirant" en jours (default 60 = NF P03-001). */
  alertThresholdDays?: number;
  className?: string;
}

/**
 * Timeline visuelle d'une assurance (décennale typiquement).
 *
 * Reproduit fidèlement le SVG du mockup v0.3 :
 *  - path bézier (M0,60 C50,50 100,30 150,28 C200,28 250,32 280,38 …)
 *  - gradient stops : success (#16A34A) → warning (#F59E0B) → danger (#DC2626)
 *  - dot positionné selon le ratio days_elapsed / days_total
 *  - tooltip noir flottant "Aujourd'hui" au-dessus du dot (translateX(-50%))
 */
export function InsuranceTimeline({
  startDate,
  endDate,
  referenceDate,
  alertThresholdDays = 60,
  className,
}: InsuranceTimelineProps) {
  const id = React.useId().replace(/:/g, "");
  const fillId = `insurance-fill-${id}`;
  const lineId = `insurance-line-${id}`;

  const daysTotal = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const now = referenceDate.getTime();
  const daysElapsed = Math.round((now - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.round(
    (endDate.getTime() - now) / (1000 * 60 * 60 * 24),
  );

  const ratio = clamp(daysElapsed / daysTotal, 0, 1);

  // Couleur du dot en fonction du statut courant.
  let dotColor = "#16A34A"; // success
  if (daysRemaining <= 0) dotColor = "#DC2626"; // danger
  else if (daysRemaining <= alertThresholdDays) dotColor = "#F59E0B"; // warning

  // Position du dot en pixels dans le viewBox 400x80.
  const cx = ratio * 400;
  // Y suit la courbe approximative (bezier dans le mockup). On échantillonne :
  // au début ~60, milieu ~28, fin ~68.
  const cy = approxY(ratio);

  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 400 80" className="w-full overflow-visible">
        <defs>
          <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.05" />
            <stop offset="40%" stopColor="#16A34A" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id={lineId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" />
            <stop offset="65%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
        <path
          d="M0,60 C50,50 100,30 150,28 C200,28 250,32 280,38 C310,46 350,58 400,68 L400,80 L0,80 Z"
          fill={`url(#${fillId})`}
        />
        <path
          d="M0,60 C50,50 100,30 150,28 C200,28 250,32 280,38 C310,46 350,58 400,68"
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r="9"
          fill="white"
          stroke={dotColor}
          strokeWidth="3.5"
        />
        <circle cx={cx} cy={cy} r="4" fill={dotColor} />
      </svg>
      {/* Tooltip noir flottant "Aujourd'hui" — positionné en absolu au-dessus
          du dot. translateX(-50%) pour centrer sur le ratio %. */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${ratio * 100}%`,
          top: "-18px",
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
          Aujourd&apos;hui
        </div>
        <div
          className="w-0.5 h-3 mx-auto"
          style={{ background: "var(--text-primary)" }}
        />
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Approxime le Y de la courbe bézier du mockup à un ratio donné.
 * Pas mathématiquement exact mais visuellement bon pour positionner le dot
 * sur la ligne (vs la valeur fixe 38 du mockup statique).
 */
function approxY(ratio: number): number {
  // Curve: (0, 60) → (0.375, 28) → (0.7, 38) → (1, 68).
  // Interpolation cubique simple par segments.
  if (ratio <= 0.375) {
    const t = ratio / 0.375;
    return 60 + (28 - 60) * easeInOut(t);
  }
  if (ratio <= 0.7) {
    const t = (ratio - 0.375) / (0.7 - 0.375);
    return 28 + (38 - 28) * easeInOut(t);
  }
  const t = (ratio - 0.7) / (1 - 0.7);
  return 38 + (68 - 38) * easeInOut(t);
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
