import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Container pill — semi-transparent with glass border
      "inline-flex items-center justify-center gap-1",
      "rounded-xl p-1",
      "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]",
      "shadow-[inset_0_1px_3px_hsl(222_28%_4%_/_0.4)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base
      "inline-flex items-center justify-center gap-2 whitespace-nowrap",
      "rounded-lg px-4 py-2 text-sm font-medium",
      "transition-all duration-200 ease-out",
      "ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-40",
      // Inactive state
      "text-[hsl(var(--muted-foreground))] hover:text-foreground",
      "hover:bg-[hsl(var(--background)_/_0.6)]",
      // Active state — gradient highlight
      "data-[state=active]:bg-gradient-to-r",
      "data-[state=active]:from-[hsl(145_72%_42%_/_0.15)]",
      "data-[state=active]:to-[hsl(165_68%_36%_/_0.1)]",
      "data-[state=active]:text-[hsl(145_72%_52%)]",
      "data-[state=active]:font-semibold",
      "data-[state=active]:shadow-[0_0_0_1px_hsl(145_72%_42%_/_0.25),0_2px_8px_hsl(145_72%_42%_/_0.15)]",
      "data-[state=active]:border data-[state=active]:border-[hsl(145_72%_42%_/_0.2)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2",
      "ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Fade-in animation when switching tabs
      "data-[state=active]:animate-[fade-in_0.2s_ease-out]",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
