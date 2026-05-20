"use client";

import * as React from "react";

type Charge = {
  id: string;
  libelle: string;
  category: string;
  montantHt: string | null;
  tauxTva: string;
  recurrence: "monthly" | "quarterly" | "yearly" | "punctual";
};

export function ChargesCard({
  charges,
  onAdd,
}: {
  charges: Charge[];
  onAdd: () => void;
}) {
  const totalMonthly = charges.reduce((acc, c) => {
    const monthly =
      c.recurrence === "monthly"
        ? Number(c.montantHt ?? 0)
        : c.recurrence === "quarterly"
          ? Number(c.montantHt ?? 0) / 3
          : c.recurrence === "yearly"
            ? Number(c.montantHt ?? 0) / 12
            : 0;
    return acc + monthly;
  }, 0);

  return (
    <div
      className="p-6 rounded-3xl"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3
            className="text-[16px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Charges récurrentes
          </h3>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            Sortie mensuelle prévue
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="text-[12px] font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          + Ajouter
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 36, letterSpacing: "-0.025em" }}
        >
          {formatEuroFull(Math.round(totalMonthly))}
        </div>
        <div className="text-[18px] text-muted ml-1">€/mois</div>
      </div>

      <div className="mt-5 space-y-2">
        {charges.length === 0 && (
          <div
            className="text-[12px] py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Aucune charge. Ajoute-en pour modéliser le cash flow.
          </div>
        )}
        {charges.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
              }}
            >
              <CategoryIcon category={c.category} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold truncate">{c.libelle}</div>
              <div
                className="text-[10px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {labelForRecurrence(c.recurrence)}
              </div>
            </div>
            <div className="text-[13px] font-bold font-tabular">
              {formatEuroFull(Number(c.montantHt ?? 0))} €
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  if (category === "salaires")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
      </svg>
    );
  if (category === "loyer_bureau")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
    );
  if (category === "vehicules")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
        <path d="M3 12l3-6h9l3 6h3v4h-3" />
      </svg>
    );
  if (category === "logiciels")
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>
    );
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function labelForRecurrence(
  r: "monthly" | "quarterly" | "yearly" | "punctual",
): string {
  if (r === "monthly") return "Mensuel";
  if (r === "quarterly") return "Trimestriel";
  if (r === "yearly") return "Annuel";
  return "Ponctuel";
}

function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
