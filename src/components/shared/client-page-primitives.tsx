import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/back-button";

function isInternalHref(href?: string): href is string {
  return typeof href === "string" && href.startsWith("/");
}

function isHttpHref(href?: string): href is string {
  return typeof href === "string" && /^https?:\/\//i.test(href);
}

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
    <section className={cn("client-page-header client-screen-header overflow-hidden rounded-lg border border-[#DDE3EE] bg-white px-3.5 py-3 sm:px-5 sm:py-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2">
            {showBack && <BackButton fallbackHref={backHref} label={backLabel} className="min-h-10 rounded-lg px-3" />}
            {eyebrow && (
              <span className="inline-flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">
                {eyebrow}
              </span>
            )}
          </div>
          <h1 className="max-w-4xl text-[1.42rem] font-semibold leading-[1.08] tracking-normal text-[#0F172A] min-[420px]:text-2xl lg:text-[2rem]">
            {title}
          </h1>
          {description && (
            <div className="mt-1.5 line-clamp-2 max-w-3xl text-sm font-medium leading-6 text-[#52627A] sm:line-clamp-none">
              {description}
            </div>
          )}
        </div>
        {children && <div className="flex w-full flex-col gap-2 min-[460px]:w-auto min-[460px]:flex-row lg:items-center">{children}</div>}
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
        "client-metric-strip grid gap-2 bg-white",
        metrics.length === 1
          ? "grid-cols-1"
          : metrics.length === 2
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none",
        className,
      )}
    >
      {metrics.map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className={cn(
            "client-metric-card flex min-h-18 min-w-0 items-center justify-between gap-2 rounded-lg border border-[#E1E7F2] bg-white px-3 py-3 sm:px-4",
            metrics.length > 1 && metrics.length % 2 === 1 && index === metrics.length - 1 && "col-span-2 lg:col-span-1",
          )}
        >
          <div className="min-w-0">
            <p className="line-clamp-2 text-[9.5px] font-semibold uppercase leading-3 tracking-wide text-[#64748B] min-[380px]:text-[10.5px]">{metric.label}</p>
            <div
              className={cn(
                "mt-1 whitespace-normal break-normal text-[0.94rem] font-semibold leading-5 text-[#111827] [overflow-wrap:normal] sm:text-[1.08rem]",
                metric.attention && "text-[#111B4D]",
              )}
            >
              {metric.value}
            </div>
          </div>
          {metric.icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white sm:h-9 sm:w-9">
              <metric.icon className="h-4 w-4" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ClientSurface({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "client-app-surface border-t border-[#E6EAF3] bg-white",
        compact ? "py-3 sm:py-4" : "py-4 sm:py-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ClientSectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="client-section-title flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-end min-[560px]:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{eyebrow}</p>}
        <h2 className="text-base font-semibold leading-tight tracking-normal text-[#111827] sm:text-lg">{title}</h2>
        {description && <div className="mt-1 line-clamp-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] sm:line-clamp-none">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
    <section className={cn("client-focus-panel rounded-lg border border-[#DDE3EE] bg-white p-3.5 sm:p-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{eyebrow}</p>
            <div className="mt-1 text-base font-semibold leading-tight text-[#111827] sm:text-lg">{title}</div>
            {description && <div className="mt-1 break-words text-sm font-medium leading-5 text-[#52627A]">{description}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 sm:min-w-48">{action}</div>}
      </div>
    </section>
  );
}

export type ClientTabItem = {
  id: string;
  label: string;
  count?: number;
  href: string;
};

export function ClientTabBar({
  items,
  activeId,
  className,
}: {
  items: ClientTabItem[];
  activeId: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "client-tab-bar grid grid-cols-1 gap-1.5 rounded-lg border border-[#DDE3EE] bg-white p-1.5 min-[360px]:grid-cols-2 min-[520px]:grid-cols-3 lg:flex lg:flex-wrap",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold transition lg:w-auto lg:justify-start",
              active ? "bg-[#111B4D] text-white" : "border border-[#E3E8F2] bg-white text-[#475569] hover:border-[#111B4D] hover:text-[#111B4D]",
            )}
          >
            <span className="truncate">{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "ml-2 rounded-lg px-2 py-0.5 text-xs font-semibold",
                  active ? "bg-white text-[#111B4D]" : "border border-[#E3E8F2] bg-white text-[#111B4D]",
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function ClientInfoPill({
  label,
  value,
  className,
  strong,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("client-info-pill min-w-0 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2", className)}>
      <p className="text-[11px] font-semibold uppercase leading-4 tracking-wide text-[#64748B]">{label}</p>
      <div className={cn("mt-0.5 break-words text-sm font-semibold leading-5", strong ? "text-[#111B4D]" : "text-[#111827]")}>
        {value || "—"}
      </div>
    </div>
  );
}

export function ClientRecordCard({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"article">) {
  return (
    <article {...props} className={cn("client-record-card overflow-hidden rounded-lg border border-[#DDE3EE] bg-white transition-colors hover:border-[#111B4D]", className)}>
      {children}
    </article>
  );
}

export function ClientAppRail({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    icon?: LucideIcon;
    href?: string;
    active?: boolean;
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "client-app-rail grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#DDE3EE] bg-[#DDE3EE] p-px min-[680px]:grid-cols-4 xl:[grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]",
        className,
      )}
    >
      {items.map((item) => {
        const content = (
          <>
            <span className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9",
                  item.active ? "bg-white text-[#111B4D]" : "bg-[#111B4D] text-white",
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
              </span>
            </span>
            <span className="min-w-0 text-center sm:flex-1 sm:text-left">
              <span className={cn(
                "block truncate text-[9.5px] font-semibold uppercase leading-3 tracking-wide sm:text-[10.5px]",
                item.active ? "text-white" : "text-[#64748B]",
              )}>
              {item.label}
              </span>
              <span className={cn(
                "mt-0.5 hidden line-clamp-1 text-[0.72rem] font-semibold leading-4 min-[360px]:block sm:text-sm sm:leading-5",
                item.active ? "text-white" : "text-[#111827]",
              )}>
                {item.value}
              </span>
            </span>
            {item.href && (
              <ChevronRight
                className={cn(
                  "ml-auto hidden h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block",
                  item.active ? "text-white" : "text-[#64748B]",
                )}
              />
            )}
          </>
        );

        const itemClassName = cn(
        "client-shortcut-card group flex min-h-[4.3rem] items-center justify-center bg-white px-2 py-2 text-center transition-colors min-[430px]:min-h-[4.15rem] sm:min-h-14 sm:justify-between sm:px-2.5 sm:text-left",
          item.active
            ? "bg-[#111B4D] text-white"
            : "text-[#111827] hover:bg-white",
        );
        const inner = <span className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-3">{content}</span>;

        if (isInternalHref(item.href)) {
          return (
            <Link key={`${item.label}-${item.href}`} href={item.href} className={itemClassName}>
              {inner}
            </Link>
          );
        }

        if (item.href) {
          return (
            <a
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={itemClassName}
              target={isHttpHref(item.href) ? "_blank" : undefined}
              rel={isHttpHref(item.href) ? "noopener noreferrer" : undefined}
            >
              {inner}
            </a>
          );
        }

        return (
          <div key={item.label} className={itemClassName}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
