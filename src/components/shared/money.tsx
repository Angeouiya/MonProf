import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({ amount, className, muted }: { amount: number | null | undefined; className?: string; muted?: boolean }) {
  return <span className={cn("tabular-nums", muted && "text-muted-foreground", className)}>{formatFCFA(amount)}</span>;
}
