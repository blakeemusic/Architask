"use client";

import * as React from "react";

type MonthData = {
  label: string;
  iso: string;
  isCurrent: boolean;
  entriesHt: string;
  exitsHt: string;
  netHt: string;
  projectedBalanceHt: string;
};

export function CashFlowChart({
  months,
  netCumul,
  alertMonthIso,
}: {
  months: MonthData[];
  netCumul: string;
  alertMonthIso: string | null;
}) {
  // Détermine l'échelle
  const maxValue = months.reduce((acc, m) => {
    return Math.max(
      acc,
      Number(m.entriesHt),
      Number(m.exitsHt),
      Number(m.projectedBalanceHt) / 2, // pour que la ligne reste lisible
    );
  }, 0);
  const yMax = Math.ceil(maxValue / 10000) * 10000 || 60000;

  const W = 700;
  const H = 240;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 60;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const monthWidth = chartW / months.length;
  const barGap = 4;
  const barWidth = Math.min((monthWidth - 8 - barGap) / 2, 28);

  const yFor = (v: number) =>
    padTop + chartH - (Math.max(0, v) / yMax) * chartH;

  // Path de la ligne solde projeté
  const balanceValues = months.map((m) => Number(m.projectedBalanceHt));
  const balanceMin = Math.min(...balanceValues, 0);
  const balanceMax = Math.max(...balanceValues, yMax);
  const balRange = balanceMax - balanceMin || 1;
  const yForBalance = (v: number) =>
    padTop + chartH - ((v - balanceMin) / balRange) * chartH;

  const linePath = months
    .map((m, i) => {
      const x = padLeft + i * monthWidth + monthWidth / 2;
      const y = yForBalance(Number(m.projectedBalanceHt));
      return `${i === 0 ? "M" : "L"}${x.toFixed(0)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Tooltip dynamique : on précalcule la zone "aujourd'hui"
  const todayIdx = months.findIndex((m) => m.isCurrent);
  const alertIdx = alertMonthIso
    ? months.findIndex((m) => m.iso === alertMonthIso)
    : -1;

  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  return (
    <div className="p-7 rounded-3xl" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3
            className="text-[18px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Cash flow prévisionnel
          </h3>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {months.length} mois glissants · entrées vs sorties
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: "40px", letterSpacing: "-0.025em" }}
        >
          {Number(netCumul) >= 0 ? "+" : ""}
          {formatK(Math.round(Number(netCumul)))}
        </div>
        <div className="text-[20px] text-muted ml-1">k€</div>
        <span
          className="ml-4 text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          net cumul {months.length} mois
        </span>
      </div>

      <div
        className="mt-6 relative"
        style={{ height: H }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cf-in" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#16A34A" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="cf-out" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1F2937" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1F2937" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="cf-balance" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1F2DEA" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 0.5, 1].map((p) => {
            const y = padTop + chartH * p;
            return (
              <g key={p}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={W - padRight}
                  y2={y}
                  stroke="rgba(0,0,0,0.04)"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  fontSize="9"
                  fill="#9AA0AB"
                  textAnchor="end"
                >
                  {formatK(yMax * (1 - p))}k
                </text>
              </g>
            );
          })}

          {/* Barres + labels */}
          {months.map((m, i) => {
            const xCenter = padLeft + i * monthWidth + monthWidth / 2;
            const xIn = xCenter - barWidth - barGap / 2;
            const xOut = xCenter + barGap / 2;
            const yIn = yFor(Number(m.entriesHt));
            const yOut = yFor(Number(m.exitsHt));
            const hIn = padTop + chartH - yIn;
            const hOut = padTop + chartH - yOut;
            const opacity = 1 - i * 0.1;
            return (
              <g
                key={m.iso}
                onMouseEnter={() => setHoverIdx(i)}
                style={{ cursor: "pointer" }}
              >
                {/* hit-zone invisible */}
                <rect
                  x={padLeft + i * monthWidth}
                  y={padTop}
                  width={monthWidth}
                  height={chartH}
                  fill="transparent"
                />
                <rect
                  x={xIn}
                  y={yIn}
                  width={barWidth}
                  height={Math.max(2, hIn)}
                  rx={6}
                  fill="url(#cf-in)"
                  opacity={opacity}
                />
                <rect
                  x={xOut}
                  y={yOut}
                  width={barWidth}
                  height={Math.max(2, hOut)}
                  rx={6}
                  fill="url(#cf-out)"
                  opacity={opacity}
                />
                <text
                  x={xCenter}
                  y={H - 35}
                  fontSize="11"
                  fill="#5F6675"
                  textAnchor="middle"
                  fontWeight={600}
                >
                  {capitalize(m.label)}
                </text>
                {m.isCurrent && (
                  <text
                    x={xCenter}
                    y={H - 20}
                    fontSize="9"
                    fill="#9AA0AB"
                    textAnchor="middle"
                  >
                    en cours
                  </text>
                )}
              </g>
            );
          })}

          {/* Solde projeté */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#cf-balance)"
            strokeWidth={2.5}
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />

          {/* Marker today */}
          {todayIdx >= 0 && (
            <line
              x1={padLeft + todayIdx * monthWidth + monthWidth / 2}
              y1={padTop - 5}
              x2={padLeft + todayIdx * monthWidth + monthWidth / 2}
              y2={padTop + chartH + 5}
              stroke="rgba(0,0,0,0.20)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Marker alerte */}
          {alertIdx >= 0 && (
            <circle
              cx={padLeft + alertIdx * monthWidth + monthWidth / 2}
              cy={yForBalance(Number(months[alertIdx].projectedBalanceHt))}
              r={5}
              fill="#DC2626"
              stroke="white"
              strokeWidth={2}
            />
          )}
        </svg>

        {/* Tooltip noir */}
        {hoverIdx !== null && (
          <div
            className="absolute"
            style={{
              left: `${
                ((padLeft + hoverIdx * monthWidth + monthWidth / 2) / W) * 100
              }%`,
              top: 4,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: "var(--text-primary)",
                color: "white",
              }}
            >
              {capitalize(months[hoverIdx].label)} ·{" "}
              {Number(months[hoverIdx].netHt) >= 0 ? "+" : ""}
              {formatK(Math.round(Number(months[hoverIdx].netHt)))} k€
            </div>
          </div>
        )}
      </div>

      {/* Légende */}
      <div
        className="flex items-center gap-5 mt-2 text-[12px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: "var(--success)" }}
          />
          Entrées
        </span>
        <span className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: "var(--text-primary)" }}
          />
          Sorties
        </span>
        <span className="flex items-center gap-2">
          <span
            className="w-6 h-0.5"
            style={{ background: "var(--brand)", borderRadius: 1 }}
          />
          Solde projeté
        </span>
      </div>
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1000)
    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "");
  return n.toFixed(0);
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
