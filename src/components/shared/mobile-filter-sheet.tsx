"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Filter, X } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileFilterSheetProps = {
  resultLabel: string;
  activeFiltersCount: number;
  children: ReactNode;
  className?: string;
};

export function MobileFilterSheet({
  resultLabel,
  activeFiltersCount,
  children,
  className,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const activeLabel = activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : "";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={cn("mb-3 lg:hidden", className)} data-public-teacher-search-controls>
      <button
        type="button"
        aria-label="Ouvrir les filtres"
        data-mobile-filter-trigger
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 text-sm shadow-[0_10px_28px_rgba(17,24,39,0.055)] transition active:scale-[0.99]"
      >
        <span className="min-w-0 text-left">
          <span className="block truncate text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Professeurs
          </span>
          <span className="block truncate text-base font-semibold tracking-[-0.01em] text-[#111827]">
            {resultLabel}
          </span>
        </span>
        <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#111B4D] px-3 font-semibold text-white">
          <Filter className="h-4 w-4" />
          Affiner{activeLabel}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-[#111827]/30 backdrop-blur-[2px]"
          data-mobile-filter-backdrop
        >
          <button
            type="button"
            aria-label="Fermer les filtres"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-mobile-filter-panel
            className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-24px_80px_rgba(17,24,39,0.22)]"
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[#DDE3EE]" aria-hidden="true" />
            <header className="flex items-center justify-between gap-3 border-b border-[#E3E8F2] px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  {resultLabel}
                </p>
                <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-[#111827]">
                  Affiner
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fermer les filtres"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DDE6F7] bg-white text-[#111B4D]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="max-h-[calc(86dvh-6.5rem)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              {children}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
