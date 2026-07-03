import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-[#9AAAD0] focus-visible:ring-[#DDE6F7] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-white flex field-sizing-content min-h-20 w-full rounded-xl border bg-white px-3.5 py-2.5 text-base shadow-sm transition-[color,box-shadow,background,border-color] outline-none focus-visible:bg-white focus-visible:ring-[4px] disabled:cursor-not-allowed disabled:bg-white disabled:text-[#9CA3AF] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
