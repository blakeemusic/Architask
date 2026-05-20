import Link from "next/link";

import type { DashboardExpiringDecennale } from "@/server/actions/dashboard";

function shortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DecennaleAlertBanner({
  items,
}: {
  items: DashboardExpiringDecennale[];
}) {
  if (items.length === 0) return null;
  const summary = items
    .map((it) => `${it.companyName} (${shortDate(it.dateFin)})`)
    .join(" · ");
  return (
    <div
      className="p-6 flex items-center gap-5 mt-6 flex-wrap"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: "4px solid var(--warning)",
        borderRadius: 28,
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px]">
          {items.length} décennale{items.length > 1 ? "s" : ""} expire
          {items.length > 1 ? "nt" : ""} dans moins de 60 jours
        </div>
        <div
          className="text-[13px] mt-1 truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {summary} — à relancer pour renouvellement
        </div>
      </div>
      <Link
        href="/annuaire"
        className="inline-flex items-center px-5 py-3 rounded-2xl text-[14px] font-medium transition-colors hover:bg-[var(--surface-2)] shrink-0"
        style={{
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      >
        Voir l&apos;annuaire →
      </Link>
    </div>
  );
}
