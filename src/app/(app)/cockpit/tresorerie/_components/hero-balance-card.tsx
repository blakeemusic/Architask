"use client";

import * as React from "react";

type BankAccount = {
  id: string;
  libelle: string;
  ibanLast4: string | null;
  currentBalance: string | null;
};

type SparklinePoint = { iso: string; balanceHt: string };

export function HeroBalanceCard({
  totalBalance,
  deltaSinceMonthStart,
  projectedEndOfMonth,
  accounts,
  sparkline,
  onSync,
  syncing,
}: {
  totalBalance: string;
  deltaSinceMonthStart: string;
  projectedEndOfMonth: string;
  accounts: BankAccount[];
  sparkline: SparklinePoint[];
  onSync: () => void;
  syncing: boolean;
}) {
  const total = Number(totalBalance);
  const totalIntPart = Math.floor(total).toLocaleString("fr-FR");
  const decPart = (total - Math.floor(total))
    .toFixed(2)
    .replace("0.", "")
    .replace(/^0/, "");

  const delta = Number(deltaSinceMonthStart);
  const deltaPositive = delta >= 0;
  const deltaFormatted = `${deltaPositive ? "+" : "-"}${formatK(Math.abs(delta))} k€`;

  return (
    <div
      className="p-8 mb-8 relative overflow-hidden rounded-3xl"
      style={{
        background: "var(--text-primary)",
        color: "var(--surface)",
      }}
    >
      <div className="flex items-start justify-between mb-2 relative z-10">
        <div className="min-w-0">
          <div
            className="text-[12px] uppercase tracking-wider font-semibold mb-3"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Solde total agence
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <div
              className="font-bold font-tabular"
              style={{ fontSize: "88px", letterSpacing: "-0.025em", lineHeight: 1 }}
            >
              {totalIntPart}
            </div>
            <div
              className="text-[32px] font-semibold ml-1"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              ,{decPart} €
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: deltaPositive
                  ? "rgba(22,163,74,0.18)"
                  : "rgba(220,38,38,0.20)",
                color: deltaPositive ? "#86EFAC" : "#FCA5A5",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: deltaPositive ? "none" : "rotate(180deg)",
                }}
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
              {deltaFormatted} vs début de mois
            </span>
            <span
              className="text-[12px]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Projection fin de mois :{" "}
              <span
                className="font-bold font-tabular"
                style={{ color: "white" }}
              >
                {formatEuroFull(Number(projectedEndOfMonth))} €
              </span>
            </span>
          </div>
        </div>

        <div className="space-y-2" style={{ minWidth: 280, maxWidth: 320 }}>
          {accounts.map((a) => (
            <AccountChip key={a.id} account={a} />
          ))}
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="w-full py-2 rounded-2xl text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-white/15"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                animation: syncing
                  ? "spin 1s linear infinite"
                  : undefined,
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {syncing ? "Synchronisation…" : "Synchroniser les comptes"}
          </button>
        </div>
      </div>

      {/* Sparkline 30j */}
      <Sparkline points={sparkline} />

      <div
        className="absolute w-72 h-72 rounded-full pointer-events-none"
        style={{
          right: -80,
          top: -80,
          background:
            "radial-gradient(circle, rgba(79,93,255,0.15) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

function AccountChip({ account }: { account: BankAccount }) {
  const isCm = /cr[ée]dit\s*mutuel/i.test(account.libelle);
  const isQonto = /qonto/i.test(account.libelle);

  const initials = isCm ? "CM" : isQonto ? "Q" : initialsFrom(account.libelle);
  const bg = isCm
    ? "white"
    : isQonto
      ? "linear-gradient(135deg, #FF8800, #FF4400)"
      : "linear-gradient(135deg, #4F5DFF, #1F2DEA)";
  const fg = isCm ? "#0044AA" : "white";

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold"
        style={{ background: bg, color: fg }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold truncate">{account.libelle}</div>
        <div
          className="text-[10px] font-tabular"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {account.ibanLast4
            ? `FR76 … ${account.ibanLast4}`
            : "Compte connecté"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[14px] font-bold font-tabular">
          {formatEuroFull(Number(account.currentBalance ?? 0))} €
        </div>
        <div
          className="text-[10px]"
          style={{ color: "rgba(34,197,94,0.85)" }}
        >
          ● Connecté
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: Array<{ iso: string; balanceHt: string }> }) {
  if (points.length < 2) {
    return (
      <div
        className="mt-6 relative z-10 h-20 flex items-center justify-center text-[12px]"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Historique 30 jours indisponible
      </div>
    );
  }
  const values = points.map((p) => Number(p.balanceHt));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 800;
  const H = 80;
  const stepX = W / (points.length - 1);
  const yFor = (v: number) => H - 5 - ((v - min) / range) * (H - 15);

  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = yFor(Number(p.balanceHt));
      return `${i === 0 ? "M" : "L"}${x.toFixed(0)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L${W},${H} L0,${H} Z`;
  const lastY = yFor(values[values.length - 1]);

  return (
    <div className="mt-6 relative z-10">
      <div
        className="flex items-center justify-between mb-2 text-[11px]"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <span>30 derniers jours</span>
        <span>
          {points[0]
            ? new Date(points[0].iso).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })
            : ""}
          {" → "}
          {points[points.length - 1]
            ? new Date(points[points.length - 1].iso).toLocaleDateString(
                "fr-FR",
                { day: "numeric", month: "short" },
              )
            : ""}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="treso-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4F5DFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4F5DFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#treso-area)" />
        <path
          d={path}
          fill="none"
          stroke="#4F5DFF"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx={W} cy={lastY} r="6" fill="white" stroke="#4F5DFF" strokeWidth="3" />
      </svg>
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 1).replace(".0", "");
  return n.toFixed(0);
}
function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
