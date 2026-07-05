import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/back-button";

export function PageHeader({
  title,
  description,
  children,
  className,
  showBack = true,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className={cn("page-header flex flex-col gap-4 rounded-xl border border-[#E3E8F2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5", className)}>
      <div className="flex min-w-0 flex-col gap-3">
        {showBack && <BackButton fallbackHref={backHref} label={backLabel} />}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">{description}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: any;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-[#E3E8F2] bg-white p-8 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111B4D] ring-1 ring-[#111B4D]">
          <Icon className="h-6 w-6 text-white" />
        </div>
      )}
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-[#64748B]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
