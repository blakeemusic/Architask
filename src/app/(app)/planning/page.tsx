import Link from "next/link";

import { listOperations } from "@/server/actions/operations/operations";
import { formatDateFr, formatPct } from "@/lib/format";

export default async function PlanningAgencePage() {
  const res = await listOperations({
    statuts: ["signe", "en_execution", "en_reception"],
  });
  const ops = res.data ?? [];

  const today = new Date();
  const sorted = [...ops].sort((a, b) => {
    const da = a.dateReceptionCible?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = b.dateReceptionCible?.getTime() ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      <div className="mb-8">
        <h1 className="title-xl">Planning agence</h1>
        <p
          className="text-[14px] mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {ops.length} chantier{ops.length > 1 ? "s" : ""} en cours, triés par
          date de réception la plus proche.
        </p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((op) => (
            <PlanningCard
              key={op.id}
              op={op}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanningCard({
  op,
  today,
}: {
  op: {
    id: string;
    code: string;
    name: string;
    moaName: string | null;
    dateReceptionCible: Date | null;
    dateOs: Date | null;
    pctAvancementTemporel: number;
    lotsCount: number;
  };
  today: Date;
}) {
  const daysToReception = op.dateReceptionCible
    ? Math.ceil(
        (op.dateReceptionCible.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const status: "en_retard" | "imminent" | "normal" | "lointain" | "no_date" =
    daysToReception === null
      ? "no_date"
      : daysToReception < 0
        ? "en_retard"
        : daysToReception <= 30
          ? "imminent"
          : daysToReception <= 90
            ? "normal"
            : "lointain";

  const statusBadge =
    status === "en_retard"
      ? {
          label: `En retard de ${Math.abs(daysToReception ?? 0)} j`,
          fg: "#B91C1C",
          bg: "#FEE2E2",
        }
      : status === "imminent"
        ? {
            label: `Réception dans ${daysToReception} j`,
            fg: "#92400E",
            bg: "#FEF3C7",
          }
        : status === "normal"
          ? {
              label: `Réception dans ${daysToReception} j`,
              fg: "#1E3A8A",
              bg: "#DBEAFE",
            }
          : status === "lointain"
            ? {
                label: `Réception dans ${daysToReception} j`,
                fg: "#065F46",
                bg: "#DCFCE7",
              }
            : {
                label: "Date à définir",
                fg: "var(--text-tertiary)",
                bg: "var(--surface-2)",
              };

  return (
    <Link
      href={`/operations/${op.id}/planning`}
      className="block rounded-3xl p-6 transition-shadow hover:shadow-lg"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        textDecoration: "none",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {op.code} · {op.lotsCount} lot{op.lotsCount > 1 ? "s" : ""}
          </div>
          <h3
            className="text-[18px] font-semibold leading-tight truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {op.name}
          </h3>
          <div
            className="text-[12px] mt-1 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {op.moaName ?? "—"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--text-tertiary)" }}>OS</span>
          <span
            className="font-semibold font-tabular"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDateFr(op.dateOs)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--text-tertiary)" }}>Réception cible</span>
          <span
            className="font-semibold font-tabular"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDateFr(op.dateReceptionCible)}
          </span>
        </div>

        <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Avancement temporel
            </span>
            <span
              className="text-[12px] font-semibold font-tabular"
              style={{ color: "var(--text-primary)" }}
            >
              {formatPct(op.pctAvancementTemporel)}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, op.pctAvancementTemporel))}%`,
                background:
                  "linear-gradient(90deg, #4F5DFF 0%, #8B5CF6 100%)",
              }}
            />
          </div>
        </div>

        <div
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: statusBadge.bg, color: statusBadge.fg }}
        >
          {statusBadge.label}
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-3xl p-12 text-center"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: "var(--surface-2)" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "var(--text-tertiary)" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <h2 className="text-[18px] font-semibold mb-2">Aucun chantier en cours</h2>
      <p
        className="text-[13px] mb-5"
        style={{ color: "var(--text-secondary)" }}
      >
        Les plannings apparaîtront ici dès qu&apos;un premier marché aura été signé.
      </p>
      <Link
        href="/operations"
        className="inline-flex items-center text-[13px] font-semibold"
        style={{ color: "var(--brand)" }}
      >
        Voir les opérations →
      </Link>
    </div>
  );
}
