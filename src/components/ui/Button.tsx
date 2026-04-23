import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"
  size?: "sm" | "base" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "base", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-primary text-primary-foreground hover:bg-primary-dim shadow-sm": variant === "primary",
            "bg-surface-container text-on-surface hover:bg-surface-container/80": variant === "secondary",
            "border border-outline-variant bg-transparent hover:bg-surface-container text-on-surface": variant === "outline",
            "bg-transparent hover:bg-surface-container text-on-surface": variant === "ghost",
            "bg-red-50 text-red-600 hover:bg-red-100": variant === "danger",
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 py-2 text-base": size === "base",
            "h-12 px-6 text-lg": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
