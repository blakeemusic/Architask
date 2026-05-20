"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Tab = "honoraires" | "tresorerie" | "rapprochement" | "facturation";

export function SubNavCockpit({
  active,
  reconciliationCount,
}: {
  active: Tab;
  reconciliationCount?: number;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div
        className="inline-flex items-center p-1.5 gap-1 rounded-2xl"
        style={{ background: "var(--surface-2)" }}
      >
        <CockpitTab
          href="/cockpit/honoraires"
          label="Honoraires"
          isActive={active === "honoraires"}
        />
        <CockpitTab
          href="/cockpit/tresorerie"
          label="Trésorerie"
          isActive={active === "tresorerie"}
        />
        <CockpitTab
          href="/cockpit/rapprochement"
          label="Rapprochement"
          isActive={active === "rapprochement"}
          badge={
            reconciliationCount && reconciliationCount > 0
              ? reconciliationCount
              : null
          }
          badgeTone="danger"
        />
        <CockpitTab
          href="/cockpit/facturation"
          label="Facturation"
          isActive={active === "facturation"}
        />
      </div>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface)",
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
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Cockpit · Accès Owner
      </span>
    </div>
  );
}

function CockpitTab({
  href,
  label,
  isActive,
  badge,
  badgeTone,
  disabled,
}: {
  href: string;
  label: string;
  isActive: boolean;
  badge?: number | null;
  badgeTone?: "danger" | "neutral";
  disabled?: boolean;
}) {
  const className = cn(
    "px-4 py-2 text-[13px] font-medium rounded-xl",
    "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
    "inline-flex items-center gap-2",
    isActive
      ? "bg-[var(--surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  );

  const content = (
    <>
      {label}
      {badge !== undefined && badge !== null && (
        <span
          className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
          style={{
            background:
              badgeTone === "danger" ? "var(--danger)" : "var(--surface-2)",
            color: badgeTone === "danger" ? "white" : "var(--text-secondary)",
          }}
        >
          {badge}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => toast.info(`Bientôt — sprint ${label} à venir`)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
