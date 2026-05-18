import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "./card";

export type KpiTone = "white" | "black" | "mint" | "lilac";

type ToneStyle = {
  eyebrow: string;
  delta: string;
  arrow: string;
  helper: string;
  sparklineColor: string;
};

const toneStyles: Record<KpiTone, ToneStyle> = {
  white: {
    eyebrow: "text-[var(--text-tertiary)]",
    delta: "bg-[rgba(22,163,74,0.10)] text-[var(--success)]",
    arrow: "text-[var(--success)]",
    helper: "text-[var(--text-secondary)]",
    sparklineColor: "#16A34A",
  },
  black: {
    eyebrow: "text-white/55",
    delta: "bg-white/12 text-white",
    arrow: "text-white",
    helper: "text-white/55",
    sparklineColor: "rgba(255,255,255,0.85)",
  },
  mint: {
    eyebrow: "text-[rgba(6,78,44,0.55)]",
    delta: "bg-[rgba(6,78,44,0.10)] text-[var(--mint-900)]",
    arrow: "text-[var(--mint-900)]",
    helper: "text-[rgba(6,78,44,0.65)]",
    sparklineColor: "#15803D",
  },
  lilac: {
    eyebrow: "text-[rgba(59,27,122,0.55)]",
    delta: "bg-[rgba(59,27,122,0.10)] text-[var(--lilac-900)]",
    arrow: "text-[var(--lilac-900)]",
    helper: "text-[rgba(59,27,122,0.65)]",
    sparklineColor: "#6D28D9",
  },
};

export interface KpiCardProps {
  eyebrow: string;
  value: React.ReactNode;
  /** Unité ou suffixe : "M€", "%", ",96 €"… */
  unit?: React.ReactNode;
  delta?: {
    label: string;
    /** Surcharge le ton automatique (par défaut couleurs du ton de la card) */
    tone?: "success" | "warning" | "danger" | "neutral";
  };
  trendArrow?: "up" | "down";
  sparkline?: number[];
  footer?: React.ReactNode;
  tone?: KpiTone;
  className?: string;
}

const deltaOverrides: Record<NonNullable<NonNullable<KpiCardProps["delta"]>["tone"]>, string> = {
  success: "bg-[rgba(22,163,74,0.10)] text-[var(--success)]",
  warning: "bg-[rgba(245,158,11,0.18)] text-[var(--warning)]",
  danger: "bg-[rgba(220,38,38,0.10)] text-[var(--danger)]",
  neutral: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
};

export function KpiCard({
  eyebrow,
  value,
  unit,
  delta,
  trendArrow,
  sparkline,
  footer,
  tone = "white",
  className,
}: KpiCardProps) {
  const styles = toneStyles[tone];
  const deltaClass = delta?.tone ? deltaOverrides[delta.tone] : styles.delta;

  return (
    <Card
      variant={tone}
      padding="lg"
      className={cn("relative overflow-hidden", className)}
    >
      <div className="flex items-center justify-between mb-5 relative z-10">
        <span
          className={cn(
            "text-[12px] uppercase tracking-[0.6px] font-semibold",
            styles.eyebrow,
          )}
        >
          {eyebrow}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
              deltaClass,
            )}
          >
            {delta.label}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1 relative z-10">
        <div className="num-xl font-tabular">{value}</div>
        {unit && (
          <div className="text-[24px] font-semibold ml-1">{unit}</div>
        )}
        {trendArrow && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={cn("ml-2 self-start mt-2", styles.arrow)}
            aria-hidden="true"
          >
            {trendArrow === "up" ? (
              <>
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </>
            ) : (
              <>
                <line x1="7" y1="7" x2="17" y2="17" />
                <polyline points="17 7 17 17 7 17" />
              </>
            )}
          </svg>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <Sparkline
          values={sparkline}
          color={styles.sparklineColor}
          className="mt-4 relative z-10"
        />
      )}

      {footer && (
        <div
          className={cn("text-[12px] mt-3 relative z-10", styles.helper)}
        >
          {footer}
        </div>
      )}
    </Card>
  );
}

function Sparkline({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const width = 140;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full h-9 sparkline", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
