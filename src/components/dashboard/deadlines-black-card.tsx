import Link from "next/link";

import { formatMoneyFull } from "@/lib/format";
import type { DashboardDeadline } from "@/server/actions/dashboard";

const MONTH_ABBR = [
  "jan",
  "fév",
  "mar",
  "avr",
  "mai",
  "juin",
  "juil",
  "août",
  "sept",
  "oct",
  "nov",
  "déc",
];

function kindStyle(kind: DashboardDeadline["kind"]) {
  switch (kind) {
    case "meeting":
      return { bg: "rgba(245,158,11,0.18)", fg: "#F59E0B" };
    case "reception":
      return { bg: "rgba(14,165,233,0.18)", fg: "#38BDF8" };
    case "payment":
      return { bg: "rgba(22,163,74,0.18)", fg: "#86EFAC" };
    case "retention":
      return { bg: "rgba(139,92,246,0.20)", fg: "#C4B5FD" };
  }
}

export function DeadlinesBlackCard({
  items,
}: {
  items: DashboardDeadline[];
}) {
  return (
    <div
      className="p-7"
      style={{
        background: "var(--black)",
        color: "var(--surface)",
        borderRadius: 28,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em]">
          Échéances
        </h3>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "var(--surface)",
          }}
        >
          30 jours
        </span>
      </div>
      <div className="space-y-3">
        {items.length === 0 && (
          <div
            className="text-[12px] text-center py-6"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Aucune échéance dans les 30 prochains jours.
          </div>
        )}
        {items.map((it) => {
          const style = kindStyle(it.kind);
          return (
            <Link
              key={it.id}
              href={`/operations/${it.operationId}`}
              className="flex items-start gap-3 transition-opacity hover:opacity-80"
            >
              <div
                className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl shrink-0"
                style={{ background: style.bg, color: style.fg }}
              >
                <div
                  className="font-bold font-tabular leading-none"
                  style={{ fontSize: 15 }}
                >
                  {it.date.getDate()}
                </div>
                <div className="text-[9px] uppercase">
                  {MONTH_ABBR[it.date.getMonth()]}
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-[13px] font-semibold truncate">
                  {it.title}
                </div>
                <div
                  className="text-[11px] truncate font-tabular"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {it.subtitle}
                  {it.amountHt
                    ? ` · ${formatMoneyFull(it.amountHt)}`
                    : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        href="/planning"
        className="block w-full mt-5 py-2.5 rounded-2xl text-[12px] font-semibold text-center transition-colors hover:opacity-90"
        style={{ background: "rgba(255,255,255,0.10)", color: "var(--surface)" }}
      >
        Voir le planning complet →
      </Link>
    </div>
  );
}
