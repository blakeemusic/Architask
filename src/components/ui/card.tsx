import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("transition-colors", {
  variants: {
    variant: {
      white: "card-l",
      black: "card-black",
      mint: "card-mint",
      lilac: "card-lilac",
      section: "card-section",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-7",
      xl: "p-8",
    },
    radius: {
      lg: "!rounded-[14px]",
      xl: "!rounded-[18px]",
      hero: "!rounded-[28px]",
      "card-xl": "!rounded-[32px]",
    },
  },
  defaultVariants: {
    variant: "white",
    padding: "lg",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, radius, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, radius }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export { cardVariants };
