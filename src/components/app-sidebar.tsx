"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: { value: string | number; tone?: "default" | "warning" | "dark" };
  /** Si true, l'item est en preview / V1 — clic désactivé. */
  disabled?: boolean;
};

function buildNavAgence(operationsActiveCount: number): NavItem[] {
  return [
    {
      href: "/",
      label: "Accueil",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      href: "/operations",
      label: "Opérations",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
      badge:
        operationsActiveCount > 0
          ? { value: operationsActiveCount }
          : undefined,
    },
    {
      href: "/annuaire",
      label: "Annuaire",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: "/cockpit",
      label: "Cockpit",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      disabled: true,
    },
  ];
}

const NAV_INSIGHTS: NavItem[] = [
  {
    href: "/planning",
    label: "Planning",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    disabled: true,
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    disabled: true,
  },
  {
    href: "/documents",
    label: "Documents",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    disabled: true,
  },
];

export function AppSidebar({
  user,
  operationsActiveCount = 0,
}: {
  user: { name: string; email: string; orgName: string };
  operationsActiveCount?: number;
}) {
  const pathname = usePathname();
  const navAgence = buildNavAgence(operationsActiveCount);

  return (
    <aside
      className="w-64 shrink-0 p-5 pt-7 flex flex-col gap-1"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="px-3 py-2 mb-3 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "var(--black)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          </svg>
        </div>
        <div className="font-semibold text-[15px]">Architask</div>
      </div>

      <div className="px-3 mb-2">
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-colors hover:bg-[var(--surface-2)]"
          style={{ background: "var(--surface)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[13px] flex-1 text-left" style={{ color: "var(--text-tertiary)" }}>
            Rechercher…
          </span>
          <span className="kbd">⌘K</span>
        </button>
      </div>

      <SectionTitle>Agence</SectionTitle>
      {navAgence.map((item) => (
        <SidebarItem key={item.href} item={item} pathname={pathname} />
      ))}

      <SectionTitle>Insights</SectionTitle>
      {NAV_INSIGHTS.map((item) => (
        <SidebarItem key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="mt-auto pt-4">
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer transition-colors hover:bg-[var(--surface)]"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0"
            style={{
              background:
                "linear-gradient(135deg, #1F2DEA 0%, #4F5DFF 100%)",
            }}
          >
            {initials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{user.name}</div>
            <div
              className="text-[11px] truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {user.orgName}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] uppercase tracking-[0.6px] px-3 mt-4 mb-1 font-semibold"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-[120ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
        isActive
          ? "bg-[var(--black)] text-[var(--surface)]"
          : item.disabled
            ? "text-[var(--text-tertiary)] cursor-not-allowed"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
            isActive
              ? "bg-white/15 text-white"
              : "bg-[var(--surface-2)] text-[var(--text-secondary)]",
          )}
        >
          {item.badge.value}
        </span>
      )}
      {item.disabled && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
    </div>
  );

  if (item.disabled) {
    return <div aria-disabled className="opacity-60">{content}</div>;
  }
  return <Link href={item.href}>{content}</Link>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
