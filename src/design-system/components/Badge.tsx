import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]",
        accent: "bg-[var(--color-accent)] text-[var(--color-neutral-0)]",
        outline: "border border-[var(--color-border)] text-[var(--color-foreground)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
