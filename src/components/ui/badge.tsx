import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
    "text-xs font-semibold leading-tight",
    "border transition-colors duration-200",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary/10 text-primary",
          "border-primary/25",
        ].join(" "),

        secondary: [
          "bg-secondary text-secondary-foreground",
          "border-border",
        ].join(" "),

        destructive: [
          "bg-destructive/10 text-destructive",
          "border-destructive/25",
        ].join(" "),

        outline: [
          "bg-transparent text-foreground",
          "border-border",
        ].join(" "),

        warning: [
          "bg-warning/15 text-[hsl(var(--warning-foreground))]",
          "border-warning/30",
        ].join(" "),

        info: [
          "bg-info/10 text-[hsl(var(--info))]",
          "border-info/25",
        ].join(" "),

        accent: [
          "bg-accent/10 text-accent",
          "border-accent/25",
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
