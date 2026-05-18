import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap",
    "rounded-2xl",
    "transition-all duration-[180ms]",
    "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-[var(--bg-base)] focus-visible:ring-[var(--brand)]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Bouton primaire — noir en light, blanc en dark (via --black)
        dark: "bg-[var(--black)] text-[var(--surface)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
        // Bouton secondaire — surface claire bordée
        light:
          "bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--surface-2)]",
        // Bouton ghost — discret
        ghost:
          "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
      },
      size: {
        sm: "px-3 py-2 text-[12px] rounded-xl",
        md: "px-5 py-3 text-[14px]",
        lg: "px-6 py-3.5 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "dark",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, leftIcon, rightIcon, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {leftIcon && <span className="flex shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex shrink-0">{rightIcon}</span>}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
