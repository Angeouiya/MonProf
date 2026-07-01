import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  className?: string;
}) {
  const toneClasses = {
    default: "bg-white",
    success: "bg-green-50/50 border-green-100",
    warning: "bg-amber-50/50 border-amber-100",
    danger: "bg-red-50/50 border-red-100",
    primary: "bg-primary/5 border-primary/20",
  };
  const iconClasses = {
    default: "bg-muted text-foreground",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div className={cn("rounded-xl border border-border p-4 sm:p-5", toneClasses[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-foreground truncate">{value}</p>
          {trend && <p className={cn("mt-1 text-xs", trend.positive ? "text-green-600" : "text-red-600")}>{trend.value}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
