import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,transform] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#1E2A78] text-primary-foreground shadow-sm [a&]:hover:shadow-md",
        secondary:
          "border-[#E3E8F2] bg-white text-[#111B4D] [a&]:hover:bg-white [a&]:hover:shadow-sm",
        destructive:
          "border-[#E3E8F2] bg-white text-[#B42318] [a&]:hover:bg-white focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-white",
        outline:
          "border-border bg-white text-foreground [a&]:hover:bg-white [a&]:hover:text-[#111B4D] [a&]:hover:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
