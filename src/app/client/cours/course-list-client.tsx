"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, FilterX, Search } from "lucide-react";
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

        <div className="grid grid-cols-2 gap-1.5 min-[460px]:grid-cols-3 min-[760px]:flex min-[760px]:flex-wrap min-[760px]:justify-end">
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors",
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
  return (
    <ClientRecordCard data-client-course-card>
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{course.stepLabel}</p>
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
              Voir le dossier <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </ClientRecordCard>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
