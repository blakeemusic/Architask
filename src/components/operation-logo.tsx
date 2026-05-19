import * as React from "react";

import { cn, getLogoPalette } from "@/lib/utils";

export type OperationLogoSize = "xs" | "sm" | "md" | "lg" | "xl";
export type OperationLogoPalette = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const paletteGradients: Record<OperationLogoPalette, string> = {
  1: "linear-gradient(135deg, #1F2DEA 0%, #4F5DFF 100%)",
  2: "linear-gradient(135deg, #DC2626 0%, #F97316 100%)",
  3: "linear-gradient(135deg, #16A34A 0%, #10B981 100%)",
  4: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
  5: "linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)",
  6: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
  7: "linear-gradient(135deg, #EC4899 0%, #F472B6 100%)",
  8: "linear-gradient(135deg, #475569 0%, #64748B 100%)",
};

const sizeClasses: Record<OperationLogoSize, string> = {
  xs: "w-7 h-7 text-[10px] rounded-lg",
  sm: "w-9 h-9 text-[12px] rounded-[10px]",
  md: "w-11 h-11 text-[14px] rounded-xl",
  lg: "w-14 h-14 text-[17px] rounded-2xl",
  xl: "w-[72px] h-[72px] text-[22px] rounded-[18px]",
};

export interface OperationLogoProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Code court (RC, VR, EM…) qui sert ET de seed palette ET de label. */
  code: string;
  size?: OperationLogoSize;
  palette?: OperationLogoPalette;
}

/**
 * Avatar gradient stable d'une opération, indexé sur le code. Une opération
 * "RC" aura toujours le même gradient à travers l'app.
 */
export function OperationLogo({
  code,
  size = "md",
  palette,
  className,
  style,
  ...props
}: OperationLogoProps) {
  const idx = palette ?? getLogoPalette(code);
  const label = code.slice(0, 4).toUpperCase();
  return (
    <div
      aria-label={code}
      title={code}
      className={cn(
        "inline-flex items-center justify-center text-white font-bold tracking-[0.2px] flex-shrink-0 select-none font-tabular",
        sizeClasses[size],
        className,
      )}
      style={{ background: paletteGradients[idx], ...style }}
      {...props}
    >
      {label}
    </div>
  );
}
