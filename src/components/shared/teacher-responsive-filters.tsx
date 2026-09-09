"use client";

import Link from "next/link";
import { Filter } from "lucide-react";

import {
  CourseFormatSegmentedControl,
} from "@/components/shared/course-format-segmented-control";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import {
  TEACHER_JOURNEY_CONFIG,
  type TeacherJourney,
} from "@/lib/teacher-journeys";

type CatalogFilterGroup = {
  label: string;
  options: { value: string; label: string; keywords?: string }[];
};

type CommuneFilterOption = {
  id: string;
  name: string;
};

type TeacherResponsiveFiltersProps = {
  activeFiltersCount: number;
  resultLabel: string;
  resetFiltersHref: string;
  journey: TeacherJourney;
  q: string;
  subject: string;
  level: string;
  commune: string;
  format: string;
  sort: string;
  referralCode: string;
  subjectGroups: CatalogFilterGroup[];
  levelGroups: CatalogFilterGroup[];
  communes: CommuneFilterOption[];
  journeyConfig: (typeof TEACHER_JOURNEY_CONFIG)[TeacherJourney];
};

const SORTS = [
  { value: "recommended", label: "Recommandés" },
  { value: "rating", label: "Mieux notés" },
  { value: "experience", label: "Plus expérimentés" },
] as const;

export function TeacherResponsiveFilters(props: TeacherResponsiveFiltersProps) {
  return (
    <>
      <MobileFilterSheet
        resultLabel={props.resultLabel}
        activeFiltersCount={props.activeFiltersCount}
        className="lg:hidden"
      >
        <FiltersForm {...props} compact />
        {props.activeFiltersCount > 0 && (
          <Link
            href={props.resetFiltersHref}
            prefetch={false}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-[#111B4D]"
          >
            Effacer ({props.activeFiltersCount})
          </Link>
        )}
      </MobileFilterSheet>

      <aside className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:h-fit">
        <FiltersForm {...props} />
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </label>
      {children}
    </div>
  );
}

function FiltersForm({
  activeFiltersCount,
  journey,
  q,
  subject,
  level,
  commune,
  format,
  sort,
  referralCode,
  subjectGroups,
  levelGroups,
  communes,
  journeyConfig,
  resetFiltersHref,
  compact = false,
}: TeacherResponsiveFiltersProps & { compact?: boolean }) {
  const communeGroups = [{
    label: "Villes et communes",
    options: communes.map((item) => ({
      value: item.name,
      label: item.name,
      keywords: item.name,
    })),
  }];

  return (
    <form
      method="GET"
      action="/professeurs"
      className={compact ? "min-w-0" : "min-w-0 rounded-lg border border-[#E3E8F2] bg-white p-5"}
    >
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#111827]">
            <Filter className="h-4 w-4 text-[#111B4D]" />
            Filtres
          </h2>
          {activeFiltersCount > 0 && (
            <Link
              href={resetFiltersHref}
              prefetch={false}
              className="text-xs font-medium text-[#111B4D] hover:underline"
            >
              Réinitialiser ({activeFiltersCount})
            </Link>
          )}
        </div>
      )}

      <div className={compact ? "grid gap-3 min-[560px]:grid-cols-2" : "space-y-4"}>
        <input type="hidden" name="journey" value={journey} />
        {referralCode && <input type="hidden" name="ref" value={referralCode} />}
        <Field label={journeyConfig.subjectLabel}>
          <SearchableCatalogSelect
            name="subject"
            value={subject}
            placeholder={journeyConfig.subjectPlaceholder}
            searchPlaceholder={journeyConfig.subjectSearchPlaceholder}
            emptyLabel={journeyConfig.subjectEmptyLabel}
            allLabel={journeyConfig.subjectPlaceholder}
            groups={subjectGroups}
            triggerClassName="focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </Field>

        <Field label={journeyConfig.levelLabel}>
          <SearchableCatalogSelect
            name="level"
            value={level}
            placeholder={journeyConfig.levelPlaceholder}
            searchPlaceholder={journeyConfig.levelSearchPlaceholder}
            emptyLabel={`Aucun ${journeyConfig.levelLabel.toLowerCase()} trouvé`}
            allLabel={journeyConfig.levelPlaceholder}
            groups={levelGroups}
            triggerClassName="focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </Field>

        <Field label="Commune">
          <SearchableCatalogSelect
            name="commune"
            value={commune}
            placeholder="Toutes les communes"
            searchPlaceholder="Tapez une ville ou commune..."
            emptyLabel="Aucune commune trouvée"
            allLabel="Toutes les communes"
            groups={communeGroups}
            triggerClassName="focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </Field>

        <Field label="Format">
          <CourseFormatSegmentedControl
            idPrefix={compact ? "public-teacher-format-mobile" : "public-teacher-format-desktop"}
            value={format}
            compact={compact}
          />
        </Field>

        <Field label="Trier par">
          <select
            name="sort"
            defaultValue={sort}
            className="min-h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        {q && <input type="hidden" name="q" value={q} />}

        <div className={compact ? "min-[560px]:self-end" : ""}>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>
    </form>
  );
}
