import * as React from "react"
import { cn } from "@/lib/utils"

const Topbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn(
      "sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-4 shadow-sm md:px-6",
      className
    )}
    {...props}
  />
))
Topbar.displayName = "Topbar"

const TopbarLeft = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-3", className)} {...props} />
))
TopbarLeft.displayName = "TopbarLeft"

const TopbarRight = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-3", className)} {...props} />
))
TopbarRight.displayName = "TopbarRight"

export { Topbar, TopbarLeft, TopbarRight }
