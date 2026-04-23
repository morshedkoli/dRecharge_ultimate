import * as React from "react"
import { cn } from "@/lib/utils"

const Sidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-64 flex-col overflow-y-auto border-r border-outline-variant bg-surface px-3 py-4",
      className
    )}
    {...props}
  />
))
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-6 flex items-center px-2", className)} {...props} />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-1 flex-col gap-1", className)} {...props} />
))
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-auto flex flex-col gap-1 pt-4", className)} {...props} />
))
SidebarFooter.displayName = "SidebarFooter"

import Link from "next/link"

const SidebarItem = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean; icon?: React.ElementType; href?: string }
>(({ className, active, icon: Icon, children, href, onClick, ...props }, ref) => {
  const commonProps = {
    className: cn(
      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container",
      active ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface",
      className
    ),
    onClick,
    ...props
  }

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex-1 truncate text-left flex items-center">{children}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} ref={ref as React.Ref<HTMLAnchorElement>} {...commonProps as any}>
        {content}
      </Link>
    )
  }

  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} {...commonProps as any}>
      {content}
    </button>
  )
})
SidebarItem.displayName = "SidebarItem"

export { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarItem }
