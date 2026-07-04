import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-100 disabled:shadow-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[#111B4D] text-primary-foreground shadow-sm hover:bg-[#182260] disabled:bg-[#4B5563] disabled:text-white disabled:hover:bg-[#4B5563]",
        destructive:
          "border border-red-600 bg-white text-red-700 shadow-sm hover:bg-white hover:text-red-800 focus-visible:ring-destructive/20 disabled:border-[#4B5563] disabled:text-[#4B5563] dark:focus-visible:ring-destructive/40 dark:bg-white dark:text-red-700",
        outline:
          "border border-[#D7DEE9] bg-white text-[#111B4D] shadow-sm hover:border-[#111B4D] hover:bg-white hover:text-[#111B4D] disabled:border-[#94A3B8] disabled:text-[#475569] dark:bg-white dark:border-[#D7DEE9] dark:hover:bg-white",
        secondary:
          "border border-[#D7DEE9] bg-white text-[#111B4D] shadow-sm hover:border-[#111B4D] hover:bg-white disabled:border-[#94A3B8] disabled:text-[#475569]",
        ghost:
          "bg-white text-[#111B4D] hover:bg-white hover:text-[#111B4D] hover:shadow-sm disabled:text-[#475569] dark:bg-white dark:hover:bg-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 has-[>svg]:px-3",
        sm: "min-h-10 rounded-lg gap-1.5 px-3 py-2 has-[>svg]:px-2.5",
        lg: "min-h-12 rounded-lg px-6 py-3 has-[>svg]:px-4",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
