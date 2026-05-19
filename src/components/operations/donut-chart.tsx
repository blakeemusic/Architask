"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatMoneyCompact } from "@/lib/format";

export interface DonutSegment {
  label: string;
  /** Valeur absolue (le composant calcule les %). */
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  /** Total à afficher au centre. Calculé auto si absent. */
  total?: number;
  centerLabel?: string;
  size?: number;
  /** Max segments affichés ; au-delà → bucket "N autres". */
  maxSegments?: number;
  className?: string;
}

const DEFAULT_COLORS = [
  "#1F2DEA",
  "#4F5DFF",
  "#7C86FF",
  "#A8AEFF",
  "#16A34A",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
];

/**
 * Donut SVG reproduisant le code du mockup frame-operation v0.3.
 * - Hover sur segment : scale 1.04 + brightness 1.1 (Framer Motion).
 * - Centre : total + libellé.
 */
export function DonutChart({
  segments,
  total,
  centerLabel = "Total",
  size = 180,
  maxSegments = 5,
  className,
}: DonutChartProps) {
  const totalValue =
    total ?? segments.reduce((s, seg) => s + seg.value, 0);
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  // Compute segments to display (truncate + bucket "N autres").
  const displayed = React.useMemo(() => {
    if (segments.length <= maxSegments) return segments;
    const top = [...segments]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxSegments - 1);
    const others = segments
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(maxSegments - 1);
    const othersTotal = others.reduce((s, x) => s + x.value, 0);
    return [
      ...top,
      {
        label: `${others.length} autres lots`,
        value: othersTotal,
        color: "var(--surface-2)",
      },
    ];
  }, [segments, maxSegments]);

  // r=14 → circumference = 2*pi*14 ≈ 87.96
  const circumference = 2 * Math.PI * 14;

  // Pré-calcul des dash/offset via reduce immutable.
  const segmentsWithGeom = React.useMemo(
    () =>
      displayed.reduce<
        Array<{ seg: DonutSegment; dash: number; offsetBefore: number }>
      >((accum, seg) => {
        const previous = accum[accum.length - 1];
        const offsetBefore = previous
          ? previous.offsetBefore + previous.dash
          : 0;
        const pct = totalValue === 0 ? 0 : seg.value / totalValue;
        const dash = pct * circumference;
        return [...accum, { seg, dash, offsetBefore }];
      }, []),
    [displayed, totalValue, circumference],
  );

  const centerFormatted = formatMoneyCompact(totalValue);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-center my-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 36 36"
            className="-rotate-90"
          >
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="transparent"
              stroke="var(--surface-2)"
              strokeWidth="5"
            />
            {segmentsWithGeom.map(({ seg, dash, offsetBefore }, i) => {
              const dashArr = `${dash} ${circumference - dash}`;
              const color = seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const isActive = activeIdx === i;
              return (
                <motion.circle
                  key={i}
                  cx="18"
                  cy="18"
                  r="14"
                  fill="transparent"
                  stroke={color}
                  strokeWidth="5"
                  strokeDasharray={dashArr}
                  strokeDashoffset={-offsetBefore}
                  initial={false}
                  animate={{
                    scale: isActive ? 1.04 : 1,
                    filter: isActive ? "brightness(1.1)" : "brightness(1)",
                  }}
                  transition={{
                    duration: 0.18,
                    ease: [0.2, 0, 0, 1],
                  }}
                  style={{ transformOrigin: "18px 18px" }}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className="text-[10px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              {centerLabel}
            </div>
            <div className="num-md font-tabular mt-0.5">{centerFormatted.display}</div>
            <div
              className="text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {centerFormatted.unit}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mt-2 text-[12px]">
        {displayed.map((seg, i) => {
          const pct = totalValue === 0 ? 0 : (seg.value / totalValue) * 100;
          const isActive = activeIdx === i;
          return (
            <div
              key={i}
              className="flex items-center justify-between cursor-default transition-colors"
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{
                color: isActive ? "var(--text-primary)" : undefined,
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: seg.color }}
                />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="font-tabular font-semibold ml-2">
                {pct.toFixed(1).replace(".", ",")}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
