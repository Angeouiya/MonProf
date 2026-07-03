"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-[#DDE6F7] bg-white text-[#111B4D] shadow-sm transition-[color,box-shadow,border-color] outline-none focus-visible:border-[#9AAAD0] focus-visible:ring-[3px] focus-visible:ring-[#DDE6F7] disabled:cursor-not-allowed disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-white dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#CBD5E1] bg-white" />
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative z-10 flex items-center justify-center"
      >
        <span className="block size-2 rounded-full bg-[#1E2A78]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
