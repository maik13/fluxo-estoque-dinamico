import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Base
  [
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
    "text-xs font-semibold leading-tight",
    "border transition-colors duration-200",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Default — green ──
        default: [
          "bg-[hsl(145_72%_42%_/_0.15)] text-[hsl(145_72%_62%)]",
          "border-[hsl(145_72%_42%_/_0.3)]",
        ].join(" "),

        // ── Secondary — slate ──
        secondary: [
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
          "border-[hsl(var(--border))]",
        ].join(" "),

        // ── Destructive — red ──
        destructive: [
          "bg-[hsl(0_80%_56%_/_0.15)] text-[hsl(0_80%_70%)]",
          "border-[hsl(0_80%_56%_/_0.3)]",
        ].join(" "),

        // ── Outline — neutral ──
        outline: [
          "bg-transparent text-foreground",
          "border-[hsl(var(--border))]",
        ].join(" "),

        // ── Warning — amber ──
        warning: [
          "bg-[hsl(38_96%_54%_/_0.15)] text-[hsl(38_96%_70%)]",
          "border-[hsl(38_96%_54%_/_0.3)]",
        ].join(" "),

        // ── Info — blue ──
        info: [
          "bg-[hsl(210_84%_60%_/_0.15)] text-[hsl(210_84%_75%)]",
          "border-[hsl(210_84%_60%_/_0.3)]",
        ].join(" "),

        // ── Accent — cyan ──
        accent: [
          "bg-[hsl(186_72%_37%_/_0.15)] text-[hsl(186_72%_60%)]",
          "border-[hsl(186_72%_37%_/_0.3)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
