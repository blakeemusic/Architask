"use client";

import * as React from "react";

import { formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  DashboardActivityPoint,
  DashboardActivityTotals,
} from "@/server/actions/dashboard";

type Range = "month" | "quarter" | "year";

const RANGE_LABELS: Record<Range, string> = {
  month: "Mois",
  quarter: "Trim.",
  year: "Année",
};

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function ActivityHeroCard({
  series,
  totals,
  canFinance,
  today,
}: {
  series: DashboardActivityPoint[];
  totals: DashboardActivityTotals;
  canFinance: boolean;
  today: Date;
}) {
  const [range, setRange] = React.useState<Range>("month");

  const aggregated = React.useMemo(
    () => aggregateByRange(series, range),
    [series, range],
  );

  const currentMonthLabel = today.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Pour la variante salarié : on choisit une métrique d'activité non-financière.
  const metricKey: keyof DashboardActivityPoint = canFinance
    ? "encaisseHt"
    : "jalonsCompletedCount";

  const heroNumber = canFinance ? totals.encaisseHt : totals.opsActiveCount;
  const heroSuffix = canFinance ? "encaissés YTD" : "chantiers actifs";
  const heroVariation = canFinance ? totals.encaisseYoyPct : null;

  return (
    <div
      className="rounded-3xl p-8 relative overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="flex items-start justify-between mb-2 gap-4">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase tracking-[0.6px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            {canFinance ? "Activité financière" : "Activité chantier"} ·{" "}
            {currentMonthLabel}
          </div>
          <div className="flex items-baseline gap-2 mt-3 flex-wrap">
            <HeroNumber
              value={heroNumber}
              format={canFinance ? "money" : "count"}
            />
            <div
              className="text-[20px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              {canFinance
                ? `${formatMoneyCompact(heroNumber).unit} ${heroSuffix}`
                : heroSuffix}
            </div>
            {heroVariation !== null && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ml-2"
                style={{
                  background:
                    heroVariation >= 0
                      ? "rgba(22,163,74,0.12)"
                      : "rgba(220,38,38,0.10)",
                  color:
                    heroVariation >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  {heroVariation >= 0 ? (
                    <>
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </>
                  ) : (
                    <>
                      <line x1="7" y1="7" x2="17" y2="17" />
                      <polyline points="7 17 17 17 17 7" />
                    </>
                  )}
                </svg>
                {heroVariation >= 0 ? "+" : ""}
                {heroVariation}% YTD
              </span>
            )}
          </div>
        </div>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <div className="mt-4">
        <ActivityChart
          points={aggregated}
          metricKey={metricKey}
          format={canFinance ? "money" : "count"}
        />
      </div>

      <div
        className="grid grid-cols-3 gap-4 mt-6 pt-6"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {canFinance ? (
          <>
            <SubKpi
              dotColor="var(--brand)"
              label="CP émis"
              value={totals.cpEmitHt}
              format="money"
            />
            <SubKpi
              dotColor="#8B5CF6"
              label="Honoraires facturés"
              value={totals.honosFacturesTtc}
              format="money"
            />
            <SubKpi
              dotColor="var(--success)"
              label="Encaissé"
              value={totals.encaisseHt}
              format="money"
            />
          </>
        ) : (
          <>
            <SubKpi
              dotColor="var(--brand)"
              label="Réunions ce mois"
              value={currentMonthValue(series, "meetingsCount", today)}
              format="count"
            />
            <SubKpi
              dotColor="#8B5CF6"
              label="Avenants signés ce mois"
              value={currentMonthValue(series, "avenantsSignedCount", today)}
              format="count"
            />
            <SubKpi
              dotColor="var(--success)"
              label="Jalons franchis ce mois"
              value={currentMonthValue(series, "jalonsCompletedCount", today)}
              format="count"
            />
          </>
        )}
      </div>
    </div>
  );
}

function HeroNumber({
  value,
  format,
}: {
  value: number;
  format: "money" | "count";
}) {
  if (format === "money") {
    const { display } = formatMoneyCompact(value);
    return (
      <div
        className="font-bold font-tabular leading-[0.95]"
        style={{ fontSize: 64, letterSpacing: "-0.035em" }}
      >
        {display}
      </div>
    );
  }
  return (
    <div
      className="font-bold font-tabular leading-[0.95]"
      style={{ fontSize: 64, letterSpacing: "-0.035em" }}
    >
      {value}
    </div>
  );
}

function RangeToggle({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-2xl shrink-0"
      style={{ background: "var(--surface-2)" }}
    >
      {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "px-3 py-1.5 text-[12px] rounded-xl transition-all",
            range === r ? "font-semibold" : "font-medium",
          )}
          style={{
            background: range === r ? "var(--surface)" : "transparent",
            color:
              range === r ? "var(--text-primary)" : "var(--text-secondary)",
            boxShadow: range === r ? "var(--shadow-1)" : undefined,
          }}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function SubKpi({
  dotColor,
  label,
  value,
  format,
}: {
  dotColor: string;
  label: string;
  value: number;
  format: "money" | "count";
}) {
  const formatted =
    format === "money" ? formatMoneyCompact(value) : { display: String(value), unit: "" };
  return (
    <div>
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: dotColor }}
        />
        {label}
      </div>
      <div
        className="font-bold font-tabular mt-1.5"
        style={{ fontSize: 26, letterSpacing: "-0.02em" }}
      >
        {formatted.display}
        {formatted.unit && (
          <span
            className="text-[14px] ml-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {formatted.unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Chart
// ============================================================

function aggregateByRange(
  series: DashboardActivityPoint[],
  range: Range,
): DashboardActivityPoint[] {
  // Pour MVP : on retourne toujours les 12 derniers mois ; la légende et le
  // tooltip s'adaptent. (Quarter/year regroupent visuellement à terme.)
  void range;
  return series;
}

function ActivityChart({
  points,
  metricKey,
  format,
}: {
  points: DashboardActivityPoint[];
  metricKey: keyof DashboardActivityPoint;
  format: "money" | "count";
}) {
  const values = points.map((p) => Number(p[metricKey] ?? 0));
  const max = Math.max(1, ...values);
  const W = 760;
  const H = 180;
  const padX = 8;
  const padTop = 12;
  const padBottom = 20;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const xFor = (i: number) =>
    points.length <= 1 ? padX : padX + (i * innerW) / (points.length - 1);
  const yFor = (v: number) => padTop + innerH - (v / max) * innerH;

  const linePath = points
    .map((p, i) => {
      const v = Number(p[metricKey] ?? 0);
      if (i === 0) return `M${xFor(i)},${yFor(v)}`;
      const prevX = xFor(i - 1);
      const x = xFor(i);
      const prevY = yFor(Number(points[i - 1][metricKey] ?? 0));
      const y = yFor(v);
      const cpX = (prevX + x) / 2;
      return `C${cpX},${prevY} ${cpX},${y} ${x},${y}`;
    })
    .join(" ");
  const areaPath = `${linePath} L${xFor(points.length - 1)},${padTop + innerH} L${xFor(0)},${padTop + innerH} Z`;

  // Hover state
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(
    points.length > 0 ? points.length - 1 : null,
  );

  const lastIdx = points.length - 1;
  const lastPoint = points[hoverIdx ?? lastIdx];
  const lastValue =
    lastPoint !== undefined ? Number(lastPoint[metricKey] ?? 0) : 0;
  const lastLabel = lastPoint
    ? lastPoint.monthStart.toLocaleDateString("fr-FR", {
        month: "short",
      })
    : "";
  const tooltipDisplay =
    format === "money"
      ? `${formatMoneyCompact(lastValue).display} ${formatMoneyCompact(lastValue).unit}`
      : String(lastValue);

  return (
    <div className="relative" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="actGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1F2DEA" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1F2DEA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="actLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1F2DEA" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        <line x1="0" y1={padTop + innerH / 4} x2={W} y2={padTop + innerH / 4} stroke="rgba(0,0,0,0.04)" />
        <line x1="0" y1={padTop + innerH / 2} x2={W} y2={padTop + innerH / 2} stroke="rgba(0,0,0,0.04)" />
        <line x1="0" y1={padTop + (3 * innerH) / 4} x2={W} y2={padTop + (3 * innerH) / 4} stroke="rgba(0,0,0,0.04)" />
        <path d={areaPath} fill="url(#actGrad)" />
        <path d={linePath} fill="none" stroke="url(#actLine)" strokeWidth="3" strokeLinecap="round" />
        {/* Hover targets */}
        {points.map((p, i) => (
          <rect
            key={p.ym}
            x={xFor(i) - innerW / (points.length * 2)}
            y={padTop}
            width={innerW / points.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {/* Active dot */}
        {hoverIdx !== null && points[hoverIdx] && (
          <circle
            cx={xFor(hoverIdx)}
            cy={yFor(Number(points[hoverIdx][metricKey] ?? 0))}
            r="6"
            fill="white"
            stroke="#1F2DEA"
            strokeWidth="3"
          />
        )}
        {/* Month letters */}
        {points.map((p, i) => (
          <text
            key={`m-${p.ym}`}
            x={xFor(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-tertiary)"
            fontWeight="600"
          >
            {MONTH_LETTERS[p.monthStart.getMonth()]}
          </text>
        ))}
      </svg>
      {/* Tooltip */}
      {hoverIdx !== null && points[hoverIdx] && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${(xFor(hoverIdx) / W) * 100}%`,
            top: 0,
            transform: "translate(-50%, -100%) translateY(-6px)",
          }}
        >
          <div
            className="text-[12px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-xl"
            style={{
              background: "var(--text-primary)",
              color: "var(--surface)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            }}
          >
            {lastLabel} · {tooltipDisplay}
          </div>
        </div>
      )}
    </div>
  );
}

function currentMonthValue(
  series: DashboardActivityPoint[],
  key: keyof DashboardActivityPoint,
  today: Date,
): number {
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const p = series.find((s) => s.ym === ym);
  return p ? Number(p[key] ?? 0) : 0;
}
