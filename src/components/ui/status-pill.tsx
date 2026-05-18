import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "bg-[rgba(22,163,74,0.10)] text-[var(--success)]",
        warning: "bg-[rgba(245,158,11,0.12)] text-[var(--warning)]",
        danger: "bg-[rgba(220,38,38,0.10)] text-[var(--danger)]",
        info: "bg-[rgba(14,165,233,0.10)] text-[var(--info)]",
        neutral: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
        brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
        dark: "bg-[var(--black)] text-[var(--surface)]",
        light:
          "bg-[var(--surface)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-[11px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  icon?: React.ReactNode;
}

export function StatusPill({
  className,
  variant,
  size,
  icon,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(pillVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

export { pillVariants };
