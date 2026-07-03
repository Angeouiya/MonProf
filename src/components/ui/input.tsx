import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-white border-input flex h-10 w-full min-w-0 rounded-xl border bg-white px-3.5 py-2 text-base shadow-sm transition-[color,box-shadow,background,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white disabled:text-[#9CA3AF] md:text-sm",
        "focus-visible:border-[#9AAAD0] focus-visible:bg-white focus-visible:ring-[#DDE6F7] focus-visible:ring-[4px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
