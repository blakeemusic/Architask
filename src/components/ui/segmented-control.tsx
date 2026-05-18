"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** "light" : container gris clair, inner-pills blanches. "dark" : container sombre. */
  tone?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  tone = "light",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center p-1.5 gap-1 rounded-2xl",
        tone === "light" ? "bg-[var(--surface-2)]" : "bg-white/[0.08]",
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "px-4 py-2 text-[13px] font-medium rounded-xl",
              "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
              "inline-flex items-center gap-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
              isActive
                ? tone === "light"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "bg-white/95 text-[#0B0B0F] font-semibold"
                : tone === "light"
                  ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  : "text-white/65 hover:text-white",
            )}
          >
            {opt.label}
            {opt.badge}
          </button>
        );
      })}
    </div>
  );
}
