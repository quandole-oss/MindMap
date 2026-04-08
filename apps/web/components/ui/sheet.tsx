"use client"

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import * as React from "react"

import { cn } from "@/lib/utils"

const Sheet = DrawerPrimitive.Root
const SheetTrigger = DrawerPrimitive.Trigger
const SheetClose = DrawerPrimitive.Close
const SheetPortal = DrawerPrimitive.Portal

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-300",
        className
      )}
      {...props}
    />
  )
}

type SheetSide = "top" | "bottom" | "left" | "right"

interface SheetContentProps
  extends React.ComponentProps<typeof DrawerPrimitive.Popup> {
  side?: SheetSide
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetContentProps) {
  const sideStyles: Record<SheetSide, string> = {
    right:
      "right-0 top-0 h-full w-3/4 max-w-sm data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full border-l",
    left: "left-0 top-0 h-full w-3/4 max-w-sm data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full border-r",
    top: "top-0 left-0 w-full h-auto max-h-screen data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full border-b",
    bottom:
      "bottom-0 left-0 w-full h-auto max-h-screen data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full border-t",
  }

  return (
    <DrawerPrimitive.Portal>
      <SheetOverlay />
      <DrawerPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 bg-background p-6 shadow-lg transition-transform duration-300",
          sideStyles[side],
          className
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 mb-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
