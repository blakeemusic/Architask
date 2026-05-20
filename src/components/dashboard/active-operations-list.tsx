import Link from "next/link";

import type { DashboardActiveOp } from "@/server/actions/dashboard";

const GRADIENTS = [
  "linear-gradient(135deg,#1F2DEA,#4F5DFF)",
  "linear-gradient(135deg,#DC2626,#F97316)",
  "linear-gradient(135deg,#16A34A,#10B981)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#0EA5E9,#06B6D4)",
  "linear-gradient(135deg,#8B5CF6,#A78BFA)",
];

const BADGE_STYLES: Record<
  DashboardActiveOp["badge"],
  { label: string; bg: string; fg: string }
> = {
  a_jour: {
    label: "à jour",
    bg: "rgba(22,163,74,0.10)",
    fg: "var(--success)",
  },
  cp_attente: {
    label: "CP attente",
    bg: "rgba(245,158,11,0.12)",
    fg: "var(--warning)",
  },
  opr: {
    label: "OPR",
    bg: "rgba(14,165,233,0.10)",
    fg: "var(--info)",
  },
  avenants_15: {
    label: "Avenants >15%",
    bg: "rgba(220,38,38,0.10)",
    fg: "var(--danger)",
  },
  dgd: {
    label: "DGD",
    bg: "rgba(22,163,74,0.10)",
    fg: "var(--success)",
  },
};

function gradientForCode(code: string): string {
  const sum = code.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ActiveOperationsList({
  items,
  totalActive,
}: {
  items: DashboardActiveOp[];
  totalActive: number;
}) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 28,
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="px-7 py-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold tracking-[-0.01em]">
            Chantiers actifs
          </h3>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {totalActive} opération{totalActive > 1 ? "s" : ""} · triées par
            activité
          </p>
        </div>
        <Link
          href="/operations"
          className="text-[12px] font-semibold"
          style={{ color: "var(--brand)" }}
        >
          Tout voir →
        </Link>
      </div>
      <div>
        {items.length === 0 && (
          <div
            className="px-7 py-10 text-[13px] text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Pas encore de chantier actif.
          </div>
        )}
        {items.map((op, i) => {
          const badge = BADGE_STYLES[op.badge];
          return (
            <Link
              key={op.id}
              href={`/operations/${op.id}`}
              className="px-7 py-4 flex items-center gap-4 transition-colors hover:bg-[var(--surface-2)]"
              style={{
                borderTop:
                  i === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[14px] shrink-0"
                style={{ background: gradientForCode(op.code) }}
              >
                {initials(op.code)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate">
                  {op.name}
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {op.moaName ?? "—"} · {op.lotsCount} lot
                  {op.lotsCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="w-32 shrink-0">
                <div
                  className="flex items-center justify-between text-[11px] mb-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span>Avancement</span>
                  <span
                    className="font-bold font-tabular"
                    style={{
                      color:
                        op.avancementPct >= 95
                          ? "var(--success)"
                          : "var(--text-primary)",
                    }}
                  >
                    {op.avancementPct}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{
                    background:
                      op.avancementPct >= 95
                        ? "var(--mint-100, #DCFCE7)"
                        : "var(--surface-2)",
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${op.avancementPct}%`,
                      background:
                        op.avancementPct >= 95
                          ? "linear-gradient(90deg,#16A34A,#10B981)"
                          : op.badge === "avenants_15"
                            ? "linear-gradient(90deg,#DC2626,#F97316)"
                            : "linear-gradient(90deg,var(--brand),#8B5CF6)",
                    }}
                  />
                </div>
              </div>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ background: badge.bg, color: badge.fg }}
              >
                {badge.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
