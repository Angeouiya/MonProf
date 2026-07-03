import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/back-button";

export function ClientPageHeader({
  eyebrow,
  title,
  description,
  children,
  showBack = true,
  backHref,
  backLabel,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-[#E6EAF3] pb-4 sm:pb-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex min-h-10 items-center gap-2">
            {showBack && <BackButton fallbackHref={backHref} label={backLabel} className="min-h-10 rounded-full px-3" />}
            {eyebrow && (
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#E1E7F2] bg-white px-3 text-[11px] font-black uppercase tracking-wide text-[#111B4D]">
                {eyebrow}
              </span>
            )}
          </div>
          <h1 className="text-[1.65rem] font-extrabold leading-[1.08] tracking-normal text-[#0F172A] min-[420px]:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#52627A] sm:text-[0.95rem]">
              {description}
            </div>
          )}
        </div>
        {children && <div className="flex shrink-0 flex-col gap-2 min-[460px]:flex-row lg:items-center">{children}</div>}
      </div>
    </section>
  );
}

export type ClientMetric = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  attention?: boolean;
};

export function ClientMetricStrip({
  metrics,
  className,
}: {
  metrics: ClientMetric[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-[1.15rem] border border-[#E1E7F2] bg-white shadow-sm min-[520px]:grid-flow-col min-[520px]:auto-cols-fr",
        metrics.length <= 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
    >
      {metrics.map((metric, index) => {
        const mobileRows = Math.ceil(metrics.length / 3);
        const mobileRow = Math.floor(index / 3) + 1;
        const isLastMobileColumn = index % 3 === 2 || index === metrics.length - 1;

        return (
          <div
            key={`${metric.label}-${index}`}
            className={cn(
              "flex min-h-[4.1rem] min-w-0 items-center justify-between gap-2 border-[#E6EAF3] px-3 py-2.5",
              !isLastMobileColumn && "border-r",
              mobileRow < mobileRows && "border-b min-[520px]:border-b-0",
              index > 0 && "min-[520px]:border-l min-[520px]:border-r-0",
            )}
          >
          <div className="min-w-0">
            <p className="break-words text-[11px] font-extrabold leading-3 text-[#64748B]">{metric.label}</p>
            <div
              className={cn(
                "mt-0.5 break-words text-sm font-extrabold leading-5 text-[#111827] sm:text-base",
                metric.attention && "text-[#111B4D]",
              )}
            >
              {metric.value}
            </div>
          </div>
          {metric.icon && <metric.icon className="hidden h-4 w-4 shrink-0 text-[#111B4D] min-[360px]:block" />}
          </div>
        );
      })}
    </div>
  );
}

export function ClientFocusPanel({
  eyebrow,
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[1.25rem] border border-[#E1E7F2] bg-white p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111B4D] text-white">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#64748B]">{eyebrow}</p>
            <div className="mt-1 text-lg font-extrabold leading-tight text-[#111827] sm:text-xl">{title}</div>
            {description && <div className="mt-1 break-words text-sm font-medium leading-5 text-[#52627A]">{description}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 sm:min-w-48">{action}</div>}
      </div>
    </section>
  );
}
