"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleGroupVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-lg p-1 bg-muted",
  {
    variants: {
      variant: {
        default: "",
        outline: "border border-input bg-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const toggleItemVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all outline-none select-none cursor-pointer px-3 py-1.5 min-h-[2.5rem] disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm hover:bg-background/50 text-muted-foreground",
  {
    variants: {
      size: {
        default: "h-10 px-3",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function ToggleGroup({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive> &
  VariantProps<typeof toggleGroupVariants>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ variant, className }))}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  size,
  value,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleItemVariants> & { value: string }) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      value={value}
      className={cn(toggleItemVariants({ size, className }))}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
