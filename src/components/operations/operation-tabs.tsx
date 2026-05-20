"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ui/status-pill";

type TabKey =
  | "recap"
  | "lots"
  | "cp"
  | "planning"
  | "cr"
  | "honoraires"
  | "dgd"
  | "documents"
  // Pages hors-tab visibles dans le breadcrumb (réception, cautions).
  // Acceptées dans la prop `active` mais ne highlightent aucun tab.
  | "reception"
  | "cautions";

const TABS: {
  key: TabKey;
  label: string;
  href: (opId: string) => string;
  /** Disabled = pas encore implémenté → toast "Bientôt". */
  disabled?: boolean;
  /** Icône cadenas (Cockpit). */
  locked?: boolean;
  /** Badge count. */
  badge?: number | null;
}[] = [
  { key: "recap", label: "Récap", href: (id) => `/operations/${id}` },
  { key: "lots", label: "Lots", href: (id) => `/operations/${id}#lots` },
  { key: "cp", label: "CP", href: (id) => `/operations/${id}/cps` },
  { key: "planning", label: "Planning", href: (id) => `/operations/${id}/planning`, disabled: true },
  { key: "cr", label: "CR chantier", href: (id) => `/operations/${id}/cr-chantier`, disabled: true },
  { key: "honoraires", label: "Honoraires", href: (id) => `/operations/${id}/honoraires`, locked: true },
  { key: "dgd", label: "DGD", href: (id) => `/operations/${id}/dgd` },
  { key: "documents", label: "Documents", href: (id) => `/operations/${id}/documents`, disabled: true },
];

export function OperationTabs({
  operationId,
  active = "recap",
}: {
  operationId: string;
  active?: TabKey;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-8 -mx-1 overflow-x-auto">
      <div className="inline-flex items-center gap-1 px-1">
        {TABS.map((tab) => {
          const isActive = active === tab.key || pathname === tab.href(operationId);
          if (tab.disabled) {
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  toast.info(`Bientôt — sprint ${tab.label} à venir`)
                }
                className={cn(
                  "px-4 py-2 text-[13px] font-medium rounded-2xl flex items-center gap-2 transition-colors",
                  "hover:bg-[var(--surface-2)]",
                )}
                style={{ color: "var(--text-secondary)" }}
              >
                {tab.locked && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
                {tab.label}
                {tab.badge !== undefined && tab.badge !== null && (
                  <StatusPill variant="neutral" size="sm">
                    {tab.badge}
                  </StatusPill>
                )}
              </button>
            );
          }
          return (
            <Link
              key={tab.key}
              href={tab.href(operationId)}
              className={cn(
                "px-4 py-2 text-[13px] rounded-2xl flex items-center gap-2 transition-colors",
                isActive
                  ? "font-semibold shadow-[var(--shadow-1)]"
                  : "font-medium hover:bg-[var(--surface-2)]",
              )}
              style={{
                background: isActive ? "var(--surface)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              {tab.locked && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null && (
                <StatusPill variant="neutral" size="sm">
                  {tab.badge}
                </StatusPill>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
