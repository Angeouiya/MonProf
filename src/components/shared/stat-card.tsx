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
    default: "border-[#E3E8F2] bg-white",
    success: "border-[#E3E8F2] bg-white",
    warning: "border-[#E3E8F2] bg-white",
    danger: "border-[#E3E8F2] bg-white",
    primary: "border-[#111B4D] bg-white",
  };
  const iconClasses = {
    default: "bg-[#111B4D] text-white",
    success: "bg-[#111B4D] text-white",
    warning: "bg-[#111B4D] text-white",
    danger: "bg-[#111B4D] text-white",
    primary: "bg-[#111B4D] text-white",
  };
  return (
    <div className={cn("rounded-lg border p-4 transition-colors hover:border-[#111B4D] sm:p-5", toneClasses[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
          <p className="mt-1.5 break-words text-xl font-semibold leading-tight tracking-normal text-[#111827] sm:text-2xl">{value}</p>
          {trend && <p className="mt-1 text-xs font-semibold text-[#111B4D]">{trend.value}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", iconClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
