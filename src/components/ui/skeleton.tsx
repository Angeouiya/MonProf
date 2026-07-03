import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-xl bg-[#DDE6F7] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.7s_infinite] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
