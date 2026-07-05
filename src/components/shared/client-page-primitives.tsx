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
    <section className={cn("client-page-header client-screen-header border-b border-[#E6EAF3] bg-white pb-3 pt-0 sm:pb-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2">
            {showBack && <BackButton fallbackHref={backHref} label={backLabel} className="min-h-10 rounded-lg border-[#DDE6F7] bg-white px-3 text-[#111B4D] hover:border-[#111B4D] hover:bg-white" />}
            {eyebrow && (
              <span className="inline-flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">
                {eyebrow}
              </span>
            )}
          </div>
          <h1 className="max-w-4xl text-[1.32rem] font-semibold leading-[1.08] tracking-normal text-[#0F172A] min-[420px]:text-[1.55rem] lg:text-[1.88rem]">
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
            ? "grid-cols-1 min-[380px]:grid-cols-2"
            : "grid-cols-1 min-[380px]:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none",
        className,
      )}
    >
      {metrics.map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className={cn(
            "client-metric-card flex min-h-16 min-w-0 items-center justify-between gap-2 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5 sm:min-h-17 sm:px-4",
            metrics.length > 1 && metrics.length % 2 === 1 && index === metrics.length - 1 && "col-span-2 lg:col-span-1",
          )}
        >
          <div className="min-w-0">
            <p className="line-clamp-2 text-[9.5px] font-semibold uppercase leading-3 tracking-wide text-[#64748B] min-[380px]:text-[10.5px]">{metric.label}</p>
            <div
              className={cn(
                "mt-1 whitespace-normal break-words text-[0.98rem] font-semibold leading-5 text-[#111827] [overflow-wrap:normal] sm:text-[1.12rem]",
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
  ...props
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
} & Omit<ComponentPropsWithoutRef<"section">, "className">) {
  return (
    <section
      {...props}
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
        <h2 className="text-[0.98rem] font-semibold leading-tight tracking-normal text-[#111827] sm:text-[1.08rem]">{title}</h2>
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
        "client-tab-bar grid grid-cols-2 gap-1.5 rounded-lg border border-[#DDE3EE] bg-white p-1.5 min-[520px]:grid-cols-3 lg:flex",
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
              "flex min-h-11 min-w-0 items-center justify-center rounded-lg px-2.5 py-2 text-center text-sm font-semibold transition-colors lg:flex-1 lg:px-3",
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

export type ClientCompactFact = {
  label: string;
  value: ReactNode;
  strong?: boolean;
  className?: string;
};

export function ClientCompactFacts({
  items,
  className,
}: {
  items: ClientCompactFact[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "client-compact-facts grid overflow-hidden rounded-lg border border-[#D8DEE9] bg-white grid-cols-1 min-[380px]:grid-cols-2 min-[680px]:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={cn(
            "min-w-0 border-b border-[#E6EAF3] bg-white px-3 py-2.5 last:border-b-0 min-[380px]:border-r min-[380px]:even:border-r-0 min-[680px]:[&:nth-child(3n)]:border-r-0",
            items.length % 2 === 1 && index === items.length - 1 && "min-[380px]:col-span-2 min-[680px]:col-span-1",
            item.className,
          )}
        >
          <dt className="truncate text-[10px] font-semibold uppercase leading-3 tracking-wide text-[#64748B]">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-[#111827]",
              item.strong && "text-[#111B4D]",
            )}
          >
            {item.value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ClientRecordAmount({
  label = "Montant",
  value,
  className,
}: {
  label?: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5", className)}>
      <p className="truncate text-[10px] font-semibold uppercase leading-3 tracking-wide text-[#64748B]">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold leading-5 text-[#111B4D]">{value || "—"}</div>
    </div>
  );
}

export function ClientRecordStatusLine({
  label,
  hint,
  aside,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("client-record-status-line border-t border-[#D8DEE9] pt-3", className)}>
      <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-[#111827]">{label}</p>
          {hint && <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{hint}</p>}
        </div>
        {aside && <div className="shrink-0 text-xs font-semibold leading-5 text-[#111B4D]">{aside}</div>}
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
  const gridClassName = items.length === 1
    ? "grid-cols-1"
    : items.length === 2
      ? "grid-cols-2"
      : items.length === 3
        ? "grid-cols-1 min-[420px]:grid-cols-3"
        : items.length >= 5
          ? "grid-cols-2 min-[620px]:grid-cols-3 min-[980px]:grid-cols-5"
          : "grid-cols-2 min-[720px]:grid-cols-4";

  return (
    <div
      className={cn(
        "client-app-rail grid gap-1 rounded-lg border border-[#D8DEE9] bg-white p-1",
        gridClassName,
        className,
      )}
      aria-label="Raccourcis client"
      role="navigation"
    >
      {items.map((item) => {
        const content = (
          <>
            <span className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors sm:h-9 sm:w-9",
                  item.active ? "border-white bg-white text-[#111B4D]" : "border-[#E3E8F2] bg-white text-[#111B4D] group-hover:border-[#111B4D]",
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
              </span>
            </span>
            <span className="min-w-0 text-center sm:flex-1 sm:text-left">
              <span className={cn(
                "block truncate text-[10px] font-semibold uppercase leading-3 tracking-wide min-[380px]:text-[10.5px]",
                item.active ? "text-white" : "text-[#64748B]",
              )}>
                {item.label}
              </span>
              <span className={cn(
                "mt-0.5 block line-clamp-2 text-[0.72rem] font-semibold leading-4 sm:line-clamp-1 sm:text-sm sm:leading-5",
                item.active ? "text-white" : "text-[#111827]",
              )}>
                {item.value}
              </span>
            </span>
            {item.href && (
              <ChevronRight
                className={cn(
                  "ml-auto hidden h-4 w-4 shrink-0 sm:block",
                  item.active ? "text-white" : "text-[#64748B]",
                )}
              />
            )}
          </>
        );

        const itemClassName = cn(
          "client-shortcut-card group flex min-h-14 min-w-0 items-center justify-center rounded-lg px-2.5 py-2 text-center transition-colors sm:justify-between sm:px-3 sm:text-left",
          item.active
            ? "bg-[#111B4D] text-white"
            : "bg-white text-[#111827] hover:bg-white hover:text-[#111B4D]",
        );
        const inner = <span className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-3">{content}</span>;

        if (isInternalHref(item.href)) {
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={itemClassName}
              aria-current={item.active ? "page" : undefined}
            >
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
