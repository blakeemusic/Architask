import * as React from "react";

import { cn } from "@/lib/utils";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipDarkProps {
  content: React.ReactNode;
  placement?: TooltipPlacement;
  children: React.ReactNode;
  className?: string;
}

const placementClasses: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Tooltip V0 — CSS-only (hover/focus), 4 placements fixes.
 * À remplacer par Radix Tooltip + Floating UI quand on aura besoin
 * de positionnement intelligent (collision detection, portal, etc.).
 */
export function TooltipDark({
  content,
  placement = "top",
  children,
  className,
}: TooltipDarkProps) {
  return (
    <span className={cn("relative inline-flex group", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "absolute pointer-events-none z-50",
          "opacity-0 scale-95",
          "group-hover:opacity-100 group-hover:scale-100",
          "group-focus-within:opacity-100 group-focus-within:scale-100",
          "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
          "whitespace-nowrap text-[12px] font-semibold",
          "px-3 py-1.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)]",
          placementClasses[placement],
        )}
        style={{
          background: "var(--black)",
          color: "var(--surface)",
        }}
      >
        {content}
      </span>
    </span>
  );
}
