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
    <div data-app-page-header className={cn("page-header flex flex-col gap-4 rounded-lg border border-[#E3E8F2] bg-white p-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between min-[640px]:p-5", className)}>
      <div className="flex min-w-0 flex-col gap-3">
        {showBack && <BackButton fallbackHref={backHref} label={backLabel} />}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal text-[#111827] sm:text-2xl">{title}</h1>
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
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-[#E3E8F2] bg-white p-5 text-center sm:p-6", className)}>
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#111B4D] ring-1 ring-[#111B4D] sm:h-11 sm:w-11">
          <Icon className="h-5 w-5 text-white" />
        </div>
      )}
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-[#64748B]">{description}</p>}
      {action && <div className="mt-4 grid w-full justify-items-center gap-2 sm:flex sm:w-auto sm:justify-center">{action}</div>}
    </div>
  );
}
