"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FilterX,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  ClientCompactFacts,
  ClientEmptyState,
  ClientRecordAmount,
  ClientRecordCard,
  ClientRecordStatusLine,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ClientCourseListItem = {
  id: string;
  subjectName: string;
  levelName: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  teacherJobTitle: string | null;
  teacherBadgeVerified: boolean;
  amountLabel: string;
  dateLabel: string;
  dateLabelName: string;
  timeLabel: string;
  formatLabel: string;
  stepLabel: string;
  stepHint: string;
  actionKind: "all" | "upcoming" | "current" | "action" | "closed";
  searchText: string;
};

const FILTERS: Array<{ id: ClientCourseListItem["actionKind"] | "all"; label: string; emptyTitle: string }> = [
  { id: "all", label: "Tous", emptyTitle: "Aucun cours trouvé" },
  { id: "upcoming", label: "À venir", emptyTitle: "Aucun cours à venir dans cette vue" },
  { id: "current", label: "En cours", emptyTitle: "Aucun cours en cours" },
  { id: "action", label: "Actions", emptyTitle: "Aucune action immédiate" },
  { id: "closed", label: "Terminés", emptyTitle: "Aucun cours terminé dans cette vue" },
];

export function CourseListClient({
  courses,
  fallbackHref,
}: {
  courses: ClientCourseListItem[];
  fallbackHref: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const normalizedQuery = normalize(query);
  const counts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = item.id === "all"
        ? courses.length
        : courses.filter((course) => course.actionKind === item.id).length;
      return acc;
    }, {});
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesFilter = filter === "all" || course.actionKind === filter;
      const matchesQuery = !normalizedQuery || course.searchText.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [courses, filter, normalizedQuery]);

  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const hasSearch = query.trim().length > 0 || filter !== "all";
  const visibleActionCount = filteredCourses.filter((course) => course.actionKind === "action").length;
  const visibleCurrentCount = filteredCourses.filter((course) => course.actionKind === "current").length;
  const visibleUpcomingCount = filteredCourses.filter((course) => course.actionKind === "upcoming").length;
  const priorityCourse = filteredCourses.find((course) => course.actionKind === "action")
    ?? filteredCourses.find((course) => course.actionKind === "current")
    ?? filteredCourses.find((course) => course.actionKind === "upcoming")
    ?? filteredCourses[0];

  return (
    <ClientSurface data-client-course-list className="space-y-4">
      <ClientSectionTitle
        eyebrow="Cours vérifiés"
        title="Recherche rapide"
        description="Retrouvez un cours par professeur, matière, niveau, date, format ou statut."
        action={<span className="text-sm font-semibold text-[#111B4D]">{filteredCourses.length} affiché(s)</span>}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block min-w-0">
          <span className="sr-only">Rechercher un cours</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Professeur, matière, niveau, date..."
            className="h-11 rounded-lg border-[#D8DEE9] bg-white pl-9 text-sm font-medium text-[#111827] placeholder:text-[#64748B]"
            data-client-course-search
          />
        </label>

        <div
          data-client-course-filter-rail
          className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-0.5 min-[760px]:mx-0 min-[760px]:flex-wrap min-[760px]:justify-end min-[760px]:overflow-visible min-[760px]:px-0 min-[760px]:pb-0"
        >
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 min-w-[7.5rem] shrink-0 snap-start rounded-lg border px-3 text-xs font-semibold transition-colors min-[760px]:min-w-0",
                  active
                    ? "border-[#111B4D] bg-[#111B4D] text-white"
                    : "border-[#D8DEE9] bg-white text-[#111827] hover:border-[#111B4D]",
                )}
                aria-pressed={active}
              >
                {item.label}
                <span className={cn("ml-1.5", active ? "text-white" : "text-[#64748B]")}>{counts[item.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        data-client-course-summary
        className="hidden gap-2 rounded-lg border border-[#D8DEE9] bg-white p-2.5 md:grid lg:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)] lg:items-stretch"
      >
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
          <CourseSummaryTile label="Affichés" value={filteredCourses.length} />
          <CourseSummaryTile label="À confirmer" value={visibleActionCount} attention={visibleActionCount > 0} />
          <CourseSummaryTile
            label={visibleCurrentCount > 0 ? "En cours" : "À venir"}
            value={visibleCurrentCount > 0 ? visibleCurrentCount : visibleUpcomingCount}
            attention={visibleCurrentCount > 0}
          />
        </div>
        {priorityCourse ? (
          <Link
            href={`/client/reservations/${priorityCourse.id}`}
            className="group flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#111B4D]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Accès rapide</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#111827]">{priorityCourse.subjectName}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">{priorityCourse.stepLabel} · {priorityCourse.dateLabel}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white transition-colors group-hover:bg-[#1E2A78]">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <div className="flex min-h-16 items-center rounded-lg border border-dashed border-[#D8DEE9] bg-white px-3 py-2.5 text-sm font-semibold text-[#64748B]">
            Aucun cours dans cette vue.
          </div>
        )}
      </div>

      {hasSearch && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#D8DEE9] bg-white p-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
          <p className="text-sm font-medium leading-5 text-[#52627A]">
            Filtre actif : <span className="font-semibold text-[#111827]">{activeFilter.label}</span>
            {query.trim() ? <> · recherche “{query.trim()}”</> : null}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="min-h-10 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
          >
            <FilterX className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      )}

      {filteredCourses.length === 0 ? (
        <ClientEmptyState
          icon={BookOpen}
          title={hasSearch ? activeFilter.emptyTitle : "Aucun cours vérifié dans cette catégorie"}
          description={hasSearch ? "Essayez un autre professeur, une autre matière ou une autre date." : "Un cours apparaît ici seulement après paiement PayDunya confirmé côté serveur."}
          action={
            <Button asChild size="sm" className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href={fallbackHref}>Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2" data-client-course-results>
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </ClientSurface>
  );
}

function CourseCard({ course }: { course: ClientCourseListItem }) {
  const actionMeta = getCourseActionMeta(course.actionKind);
  const ActionIcon = actionMeta.icon;

  return (
    <ClientRecordCard data-client-course-card data-action-kind={course.actionKind}>
      <div className="p-3.5 sm:p-5">
        <div className="grid gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <ProfessorImage
              photoUrl={course.teacherPhotoUrl}
              name={course.teacherName}
              size={58}
              shape="circle"
              verified={course.teacherBadgeVerified}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{course.stepLabel}</p>
                <span
                  className={cn(
                    "inline-flex min-h-7 items-center gap-1 rounded-lg border bg-white px-2 text-[11px] font-semibold",
                    actionMeta.className,
                  )}
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                  {actionMeta.label}
                </span>
              </div>
              <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                {course.subjectName} · {course.levelName}
              </h2>
              <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                {course.teacherName} · {course.teacherJobTitle || "Professeur"}
              </p>
            </div>
          </div>
          <ClientRecordAmount label="Protégé" value={course.amountLabel} className="min-[520px]:min-w-36 min-[520px]:text-right" />
        </div>

        <ClientCompactFacts
          className="mt-3"
          items={[
            { label: course.dateLabelName, value: course.dateLabel },
            { label: "Créneau", value: course.timeLabel },
            { label: "Format", value: course.formatLabel },
            { label: "Paiement", value: "Vérifié serveur", strong: true },
          ]}
        />

        <ClientRecordStatusLine className="mt-3" label={course.stepLabel} hint={course.stepHint} aside="PayDunya confirmé" />

        <div className="mt-3 grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
          <p className="text-xs font-medium leading-5 text-[#64748B]">
            Cours rattaché à {course.teacherName}. Le lien en ligne et les actions sont disponibles dans le dossier.
          </p>
          <Button asChild size="sm" className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <Link href={`/client/reservations/${course.id}`}>
              {actionMeta.ctaLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </ClientRecordCard>
  );
}

function CourseSummaryTile({
  label,
  value,
  attention,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase leading-3 tracking-wide text-[#64748B]">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold leading-6", attention ? "text-[#111B4D]" : "text-[#111827]")}>{value}</p>
    </div>
  );
}

function getCourseActionMeta(actionKind: ClientCourseListItem["actionKind"]): {
  label: string;
  ctaLabel: string;
  icon: LucideIcon;
  className: string;
} {
  if (actionKind === "action") {
    return {
      label: "Action requise",
      ctaLabel: "Confirmer",
      icon: AlertTriangle,
      className: "border-[#111B4D] text-[#111B4D]",
    };
  }
  if (actionKind === "current") {
    return {
      label: "En cours",
      ctaLabel: "Suivre",
      icon: Clock3,
      className: "border-[#111B4D] text-[#111B4D]",
    };
  }
  if (actionKind === "upcoming") {
    return {
      label: "À venir",
      ctaLabel: "Préparer",
      icon: CalendarCheck,
      className: "border-[#D8DEE9] text-[#111B4D]",
    };
  }
  if (actionKind === "closed") {
    return {
      label: "Terminé",
      ctaLabel: "Consulter",
      icon: CheckCircle2,
      className: "border-[#D8DEE9] text-[#111B4D]",
    };
  }
  return {
    label: "Vérifié",
    ctaLabel: "Dossier",
    icon: ShieldCheck,
    className: "border-[#D8DEE9] text-[#111B4D]",
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
