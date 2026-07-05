import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({ amount, className, muted }: { amount: number | null | undefined; className?: string; muted?: boolean }) {
  return <span data-slot="money" className={cn("tabular-nums", muted && "text-[#64748B]", className)}>{formatFCFA(amount)}</span>;
}
