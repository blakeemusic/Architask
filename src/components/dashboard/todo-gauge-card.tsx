import Link from "next/link";

import type { DashboardTodo } from "@/server/actions/dashboard";

const ITEMS: Array<{
  key: keyof DashboardTodo;
  label: (n: number) => string;
  href: string;
  color: string;
}> = [
  {
    key: "cpToSign",
    label: (n) => `${n} CP à signer`,
    href: "/operations",
    color: "var(--danger)",
  },
  {
    key: "dgdToFinalize",
    label: (n) => `${n} DGD à finaliser`,
    href: "/operations",
    color: "var(--info)",
  },
  {
    key: "decennalesExpiringSoon",
    label: (n) => `${n} décennale${n > 1 ? "s" : ""} -60j`,
    href: "/annuaire",
    color: "var(--warning)",
  },
  {
    key: "retentionsToRelease",
    label: (n) => `${n} retenue${n > 1 ? "s" : ""} à libérer`,
    href: "/operations",
    color: "var(--success)",
  },
];

export function TodoGaugeCard({ counts }: { counts: DashboardTodo }) {
  const total = counts.total;
  // Jauge : on plafonne à 12 pour ne pas saturer le cercle visuel.
  const dashMax = 97.4;
  const filled = Math.min(1, total / 12) * dashMax;
  return (
    <div
      className="p-7"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 28,
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em]">À faire</h3>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}
        >
          Action
        </span>
      </div>
      <div className="flex items-center gap-5 mt-4">
        <div className="relative" style={{ width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 36 36" className="-rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="4"
            />
            {total > 0 && (
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${dashMax}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-bold font-tabular"
              style={{ fontSize: 26, letterSpacing: "-0.02em" }}
            >
              {total}
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              tâche{total > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-[12px]">
          {ITEMS.map((it) => {
            const n = counts[it.key];
            if (n === 0) {
              return (
                <div
                  key={it.key as string}
                  className="flex items-center gap-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: it.color, opacity: 0.4 }}
                  />
                  {it.label(n as number)}
                </div>
              );
            }
            return (
              <Link
                key={it.key as string}
                href={it.href}
                className="flex items-center gap-2 transition-colors hover:text-[var(--brand)]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: it.color }}
                />
                {it.label(n as number)}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
