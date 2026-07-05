"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EEF3FF] hover:text-[#111B4D] disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-[#DDE6F7] data-[state=on]:bg-[#DDE6F7] data-[state=on]:text-[#111B4D] data-[state=on]: [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-[#9AAAD0] focus-visible:ring-[#DDE6F7] focus-visible:ring-[3px] outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[#E3E8F2] bg-white hover:border-[#DDE6F7] hover:bg-[#EEF3FF] hover:text-[#111B4D]",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
