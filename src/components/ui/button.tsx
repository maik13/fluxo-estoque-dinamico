import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — common to all variants
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg text-sm font-semibold tracking-wide",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-95",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Primary — vivid green gradient ──
        default: [
          "bg-gradient-to-r from-[hsl(145_72%_42%)] to-[hsl(165_68%_36%)]",
          "text-white shadow-md",
          "hover:brightness-110 hover:shadow-[0_0_20px_hsl(145_72%_42%_/_0.4)]",
          "border border-[hsl(145_72%_42%_/_0.3)]",
        ].join(" "),

        // ── Destructive — red gradient ──
        destructive: [
          "bg-gradient-to-r from-[hsl(0_80%_56%)] to-[hsl(15_82%_50%)]",
          "text-white shadow-md",
          "hover:brightness-110 hover:shadow-[0_0_18px_hsl(0_80%_56%_/_0.4)]",
          "border border-[hsl(0_80%_56%_/_0.3)]",
        ].join(" "),

        // ── Outline — glass border ──
        outline: [
          "border border-[hsl(var(--border))] bg-transparent",
          "text-foreground",
          "hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--primary)_/_0.5)]",
          "hover:text-[hsl(var(--primary))]",
        ].join(" "),

        // ── Secondary — slate blue ──
        secondary: [
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
          "border border-[hsl(var(--border))]",
          "hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border))]",
        ].join(" "),

        // ── Ghost ──
        ghost: [
          "bg-transparent text-[hsl(var(--muted-foreground))]",
          "hover:bg-[hsl(var(--muted))] hover:text-foreground",
        ].join(" "),

        // ── Link ──
        link: [
          "bg-transparent text-[hsl(var(--primary))]",
          "underline-offset-4 hover:underline",
          "p-0 h-auto",
        ].join(" "),

        // ── Warning — amber gradient ──
        warning: [
          "bg-gradient-to-r from-[hsl(38_96%_54%)] to-[hsl(25_94%_52%)]",
          "text-[hsl(38_80%_10%)] font-semibold shadow-md",
          "hover:brightness-105 hover:shadow-[0_0_18px_hsl(38_96%_54%_/_0.4)]",
          "border border-[hsl(38_96%_54%_/_0.3)]",
        ].join(" "),

        // ── Success — same as default but named separately ──
        success: [
          "bg-gradient-to-r from-[hsl(145_72%_42%)] to-[hsl(165_68%_36%)]",
          "text-white shadow-md",
          "hover:brightness-110 hover:shadow-[0_0_20px_hsl(145_72%_42%_/_0.4)]",
          "border border-[hsl(145_72%_42%_/_0.3)]",
        ].join(" "),

        // ── Cyan / Accent ──
        accent: [
          "bg-gradient-to-r from-[hsl(186_72%_37%)] to-[hsl(200_80%_44%)]",
          "text-white shadow-md",
          "hover:brightness-110 hover:shadow-[0_0_18px_hsl(186_72%_37%_/_0.4)]",
          "border border-[hsl(186_72%_37%_/_0.3)]",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-12 rounded-xl px-8 text-base",
        xl:      "h-14 rounded-xl px-10 text-base",
        icon:    "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
