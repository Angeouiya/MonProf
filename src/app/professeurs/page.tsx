import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Home as HomeIcon,
  Search,
  Video,
  X,
  SearchX,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { TeacherCard } from "@/components/shared/teacher-card";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { EmptyState } from "@/components/shared/page-header";
import { db } from "@/lib/db";
import { getLevelCategory, getSubjectCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import {
  filterLevelsForJourney,
  filterSubjectsForJourney,
  subjectNameMatchesJourney,
} from "@/lib/catalog-journey";
import { buildTeacherSearchClauses } from "@/lib/teacher-search";
import {
  parseTeacherJourney,
  TEACHER_JOURNEY_CONFIG,
  TEACHER_JOURNEYS,
  teacherJourneyWhere,
  type TeacherJourney as BookingJourney,
} from "@/lib/teacher-journeys";

export const dynamic = "force-dynamic";

type SearchParams = {
  journey?: string;
  subject?: string;
  level?: string;
  commune?: string;
  format?: string;
  sort?: string;
  q?: string;
  page?: string;
};

function parseBookingJourney(value?: string): BookingJourney | "" {
  return parseTeacherJourney(value) ?? "";
}

const PAGE_SIZE = 12;

const SORTS = [
  { value: "recommended", label: "Recommandés" },
  { value: "rating", label: "Mieux notés" },
  { value: "experience", label: "Plus expérimentés" },
];

const FORMATS = [
  { value: "", label: "Tout" },
  { value: "HOME", label: "À domicile" },
  { value: "ONLINE", label: "En ligne" },
];

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const journey = parseBookingJourney(sp.journey?.trim()) || "ivoirien";
  const requestedSubject = sp.subject?.trim() || "";
  const requestedLevel = sp.level?.trim() || "";
  const requestedCommune = sp.commune?.trim() || "";
  const requestedFormat = sp.format?.trim() || "";
  const requestedSort = sp.sort?.trim() || "recommended";
  const format = FORMATS.some((item) => item.value === requestedFormat) ? requestedFormat : "";
  const sort = SORTS.some((item) => item.value === requestedSort) ? requestedSort : "recommended";
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);
  const journeyConfig = TEACHER_JOURNEY_CONFIG[journey];

  let orderBy: any;
  switch (sort) {
    case "rating":
      orderBy = { rating: "desc" };
      break;
    case "experience":
      orderBy = { experienceYears: "desc" };
      break;
    case "recommended":
    default:
      orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }];
      break;
  }

  let total = 0;
  let totalVisibleTeachers = 0;
  let teachers: any[] = [];
  let subjects: any[] = [];
  let levels: any[] = [];
  let communes: any[] = [];
  let subject = "";
  let level = "";
  let commune = "";

  try {
    const catalog = await getCachedTeacherSearchCatalog();
    totalVisibleTeachers = catalog.teacherCount;
    subjects = filterSubjectsForJourney(catalog.subjects, journey);
    levels = filterLevelsForJourney(catalog.levels, journey);
    communes = catalog.communes;
    subject = subjects.some((item) => item.slug === requestedSubject) ? requestedSubject : "";
    level = levels.some((item) => item.slug === requestedLevel) ? requestedLevel : "";
    commune = communes.some((item) => item.name === requestedCommune) ? requestedCommune : "";

    if (totalVisibleTeachers > 0) {
      const visibleTeacherWhere: any = {
        status: "ACTIVE",
        AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
      };
      const where: any = {
        ...visibleTeacherWhere,
        ...teacherJourneyWhere(journey),
        AND: [...visibleTeacherWhere.AND, ...buildTeacherSearchClauses(q)],
      };
      if (subject) where.subjects = { some: { subject: { slug: subject } } };
      if (level) where.levels = { some: { level: { slug: level } } };
      if (commune) where.zones = { some: { commune: { name: commune } } };
      if (format === "HOME") where.offersHome = true;
      if (format === "ONLINE") where.offersOnline = true;

      const [teacherTotal, teacherRows] = await db.$transaction([
        db.teacher.count({ where }),
        db.teacher.findMany({
            where,
            orderBy,
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
              id: true,
              fullName: true,
              professionalName: true,
              photoUrl: true,
              coverUrl: true,
              jobTitle: true,
              rating: true,
              ratingCount: true,
              adminRating: true,
              adminRatingPublic: true,
              experienceYears: true,
              offersHome: true,
              offersOnline: true,
              commune: true,
              badgeVerified: true,
              subjects: { select: { isPrimary: true, subject: { select: { name: true } } } },
              _count: { select: { reviews: true } },
            },
          }),
      ]);
      total = teacherTotal;
      teachers = teacherRows;
    }
  } catch (error) {
    console.error("[teachers:public_query_failed]", error);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items = teachers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    professionalName: t.professionalName,
    photoUrl: t.photoUrl,
    coverUrl: t.coverUrl,
    jobTitle: t.jobTitle,
    rating: t.rating,
    ratingCount: t.ratingCount,
    adminRating: t.adminRating,
    adminRatingPublic: t.adminRatingPublic,
    experienceYears: t.experienceYears,
    offersHome: t.offersHome,
    offersOnline: t.offersOnline,
    commune: t.commune,
    badgeVerified: t.badgeVerified,
    primarySubject: t.subjects.find((s) => s.isPrimary && subjectNameMatchesJourney(s.subject.name, journey))?.subject.name
      ?? t.subjects.find((s) => subjectNameMatchesJourney(s.subject.name, journey))?.subject.name
      ?? journeyConfig.primarySubjectFallback,
    _count: { reviews: t._count.reviews },
  }));

  // Build a query string without `page` for pagination links
  function buildPaginationUrl(p: number, includeQuery = true): string {
    const params = new URLSearchParams();
    if (journey) params.set("journey", journey);
    if (includeQuery && q) params.set("q", q);
    if (subject) params.set("subject", subject);
    if (level) params.set("level", level);
    if (commune) params.set("commune", commune);
    if (format) params.set("format", format);
    if (sort && sort !== "recommended") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/professeurs?${qs}` : "/professeurs";
  }

  function buildJourneyUrl(nextJourney: BookingJourney): string {
    const params = new URLSearchParams({ journey: nextJourney });
    if (commune) params.set("commune", commune);
    if (format) params.set("format", format);
    if (sort && sort !== "recommended") params.set("sort", sort);
    return `/professeurs?${params.toString()}`;
  }

  const activeFiltersCount = [
    subject,
    level,
    commune,
    format,
    q,
  ].filter(Boolean).length;
  const resetFiltersHref = journey ? `/professeurs?journey=${journey}` : "/professeurs";
  const hasPublishedTeachers = totalVisibleTeachers > 0;
  const showTeacherFilters = hasPublishedTeachers;
  const subjectGroups = groupByCatalogCategory(subjects, (item) => getSubjectCategory(item.name, item.icon));
  const levelGroups = groupByCatalogCategory(levels, (item) => getLevelCategory(item.name, item.order));

  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="relative overflow-hidden border-b border-[#E6EAF3] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <nav className="mb-4 hidden min-h-9 flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B] sm:flex">
            <Link href="/" className="inline-flex min-h-10 items-center px-1 hover:text-[#111B4D]">Accueil</Link>
            <span>/</span>
            <span className="inline-flex min-h-10 items-center text-[#111827]">Professeurs</span>
          </nav>
          <nav
            className="mb-3 grid grid-cols-3 gap-1.5 sm:mb-5 sm:max-w-2xl sm:gap-2"
            aria-label="Choisir une mini-application"
            data-public-journey-tabs
          >
            {TEACHER_JOURNEYS.map((value) => {
              const active = journey === value;
              const config = TEACHER_JOURNEY_CONFIG[value];
              return (
                <Link
                  key={value}
                  href={buildJourneyUrl(value)}
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  data-public-journey-tab={value}
                  className={`inline-flex min-h-12 items-center justify-center rounded-lg border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition sm:px-4 sm:text-sm ${
                    active
                      ? "border-[#111B4D] bg-[#111B4D] text-white"
                      : "border-[#D6DEED] bg-white text-[#475569] hover:border-[#111B4D] hover:text-[#111B4D]"
                  }`}
                >
                  <span className="sm:hidden">{config.shortLabel}</span>
                  <span className="hidden sm:inline">{config.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-end lg:gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#111B4D] sm:mb-2 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Profils vérifiés
              </div>
              <h1 className="max-w-2xl text-2xl font-semibold leading-tight text-[#111827] text-balance sm:text-4xl lg:text-[2.65rem] lg:leading-[1.06]">
                <span className="sm:hidden">{journeyConfig.label}</span>
                <span className="hidden sm:inline">Choisissez le bon professeur.</span>
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#111B4D] sm:hidden">{journeyConfig.priceLabel}</p>
              <p className="mt-2 hidden max-w-xl text-[0.95rem] font-medium leading-6 text-[#64748B] sm:block sm:text-base">
                {journeyConfig.description}
              </p>
            </div>
            <div className="hidden grid-cols-2 gap-2 lg:grid lg:grid-cols-1 lg:rounded-lg lg:border lg:border-[#E3E8F2] lg:bg-white lg:p-4">
              <div className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-2 lg:flex lg:border-0 lg:px-0 lg:py-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white lg:h-10 lg:w-10"><BadgeCheck className="h-4 w-4 lg:h-5 lg:w-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#111827] lg:text-sm"><span className="lg:hidden">Contrôlés</span><span className="hidden lg:inline">Professeurs contrôlés</span></p>
                  <p className="hidden text-xs font-medium text-[#64748B] lg:block">Identité, diplôme et expérience vérifiés.</p>
                </div>
              </div>
              <div className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-2 lg:flex lg:border-0 lg:px-0 lg:py-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D6DEED] bg-white text-[#111B4D] lg:h-10 lg:w-10"><ShieldCheck className="h-4 w-4 lg:h-5 lg:w-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#111827] lg:text-sm"><span className="lg:hidden">Paiement sûr</span><span className="hidden lg:inline">Paiement rassurant</span></p>
                  <p className="hidden text-xs font-medium text-[#64748B] lg:block">Fonds bloqués jusqu'à confirmation du cours.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de recherche texte */}
          <form method="GET" action="/professeurs" className="mt-3 flex gap-2 rounded-lg border border-[#E3E8F2] bg-white p-1.5 sm:mt-6 sm:p-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label={journeyConfig.searchAriaLabel}
              placeholder={journeyConfig.searchPlaceholder}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-[#DDE6F7] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7] sm:px-4"
              style={{ minHeight: 48 }}
            />
            {/* Préserve les autres filtres */}
            {journey && <input type="hidden" name="journey" value={journey} />}
            {subject && <input type="hidden" name="subject" value={subject} />}
            {level && <input type="hidden" name="level" value={level} />}
            {commune && <input type="hidden" name="commune" value={commune} />}
            {format && <input type="hidden" name="format" value={format} />}
            {sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}
            <button
              type="submit"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-sm font-semibold text-white transition hover:bg-[#182260] sm:w-auto sm:px-5"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Rechercher</span>
            </button>
            {q && (
              <Link
                href={buildPaginationUrl(1, false)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#D6DEED] bg-white text-sm text-[#64748B] transition hover:border-[#111B4D] hover:text-[#111B4D]"
                title="Réinitialiser la recherche"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </Link>
            )}
          </form>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          {showTeacherFilters && (
            <details className="mb-3 rounded-lg border border-[#DDE6F7] bg-white lg:hidden" data-public-teacher-search-controls>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm marker:hidden">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#111827]">
                    {total} professeur{total > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[#F1F4FF] px-3 font-semibold text-[#111B4D]">
                  <Filter className="h-4 w-4" />
                  Filtres
                  {activeFiltersCount > 0 && <span className="tabular-nums">· {activeFiltersCount}</span>}
                </span>
              </summary>
              <div className="border-t border-[#E3E8F2] p-3">
                <FiltersForm
                  activeFiltersCount={activeFiltersCount}
                  journey={journey}
                  q={q}
                  subject={subject}
                  level={level}
                  commune={commune}
                  format={format}
                  sort={sort}
                  subjectGroups={subjectGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((s) => ({
                      value: s.slug,
                      label: s.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  levelGroups={levelGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((l) => ({
                      value: l.slug,
                      label: l.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  communes={communes}
                  journeyConfig={journeyConfig}
                  compact
                />
                {activeFiltersCount > 0 && (
                  <Link href={resetFiltersHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-[#111B4D]">
                    Effacer les filtres ({activeFiltersCount})
                  </Link>
                )}
              </div>
            </details>
          )}
          <div className={showTeacherFilters ? "grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]" : "mx-auto max-w-3xl"}>
            {/* SIDEBAR FILTRES */}
            {showTeacherFilters && (
              <aside className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:h-fit">
                <FiltersForm
                  activeFiltersCount={activeFiltersCount}
                  journey={journey}
                  q={q}
                  subject={subject}
                  level={level}
                  commune={commune}
                  format={format}
                  sort={sort}
                  subjectGroups={subjectGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((s) => ({
                      value: s.slug,
                      label: s.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  levelGroups={levelGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((l) => ({
                      value: l.slug,
                      label: l.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  communes={communes}
                  journeyConfig={journeyConfig}
                />
              </aside>
            )}

            {/* RÉSULTATS */}
            <div>
              {showTeacherFilters && (
                <div className="mb-5 hidden flex-col gap-2 rounded-lg border border-[#E3E8F2] bg-white p-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#64748B]">
                      <span className="font-semibold text-[#111827]">{total}</span>{" "}
                      professeur{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
                      {subject || level || commune || format ? (
                        <span className="ml-1 text-[#64748B]">· filtres actifs</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#111B4D]">
                    {format === "HOME" && (
                      <InlineFilter icon={<HomeIcon className="h-3 w-3" />} label="Domicile" />
                    )}
                    {format === "ONLINE" && (
                      <InlineFilter icon={<Video className="h-3 w-3" />} label="En ligne" />
                    )}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={hasPublishedTeachers ? "Aucun professeur ne correspond à vos critères" : "Professeurs en cours de publication"}
                  className={hasPublishedTeachers ? undefined : "px-5 py-6 sm:min-h-[18rem] sm:px-8 sm:py-10"}
                  description={
                    hasPublishedTeachers
                      ? `Essayez d'élargir ${journeyConfig.subjectLabel.toLowerCase()}, ${journeyConfig.levelLabel.toLowerCase()}, la commune ou le format, puis relancez la recherche.`
                      : "Les profils avec vraie photo et disponibilités seront publiés après vérification par le service client."
                  }
                  action={
                    <>
                      <Link
                        href={hasPublishedTeachers ? resetFiltersHref : "/contact"}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260] sm:w-auto"
                      >
                        {hasPublishedTeachers ? "Réinitialiser les filtres" : "Transmettre mon besoin"}
                      </Link>
                    </>
                  }
                />
              ) : (
                <>
                  <div className="grid min-w-0 gap-4 min-[680px]:grid-cols-2 min-[1180px]:grid-cols-3">
                    {items.map((t, index) => (
                      <TeacherCard
                        key={`${t.id}-${index}`}
                        teacher={t as any}
                        priceLabel={journeyConfig.priceLabel}
                        profileHref={journey ? `/professeurs/${t.id}?journey=${journey}` : `/professeurs/${t.id}`}
                        href={`/connexion?from=${encodeURIComponent(`/client/reserver?teacherId=${t.id}${journey ? `&journey=${journey}` : ""}`)}`}
                      />
                    ))}
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                      <Link
                        href={buildPaginationUrl(Math.max(1, page - 1))}
                        aria-disabled={page === 1}
                        className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          page === 1
                            ? "pointer-events-none border-[#E3E8F2] bg-white text-[#8892A8]"
                            : "border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D]"
                        }`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Précédent
                      </Link>
                      <span className="px-3 text-sm font-medium text-[#64748B]">
                        Page <span className="font-semibold text-[#111827]">{page}</span> sur {totalPages}
                      </span>
                      <Link
                        href={buildPaginationUrl(Math.min(totalPages, page + 1))}
                        aria-disabled={page === totalPages}
                        className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          page === totalPages
                            ? "pointer-events-none border-[#E3E8F2] bg-white text-[#8892A8]"
                            : "border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D]"
                        }`}
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
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

type CatalogFilterGroup = {
  label: string;
  options: { value: string; label: string; keywords?: string }[];
};

type CommuneFilterOption = {
  id: string;
  name: string;
};

function FiltersForm({
  activeFiltersCount,
  journey,
  q,
  subject,
  level,
  commune,
  format,
  sort,
  subjectGroups,
  levelGroups,
  communes,
  journeyConfig,
  compact = false,
}: {
  activeFiltersCount: number;
  journey: BookingJourney | "";
  q: string;
  subject: string;
  level: string;
  commune: string;
  format: string;
  sort: string;
  subjectGroups: CatalogFilterGroup[];
  levelGroups: CatalogFilterGroup[];
  communes: CommuneFilterOption[];
  journeyConfig: (typeof TEACHER_JOURNEY_CONFIG)[BookingJourney];
  compact?: boolean;
}) {
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
              href={journey ? `/professeurs?journey=${journey}` : "/professeurs"}
              className="text-xs font-medium text-[#111B4D] hover:underline"
            >
              Réinitialiser ({activeFiltersCount})
            </Link>
          )}
        </div>
      )}

      <div className={compact ? "grid gap-3 min-[560px]:grid-cols-2" : "space-y-4"}>
        {journey && <input type="hidden" name="journey" value={journey} />}
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
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATS.map((item) => (
              <button
                type="submit"
                name="format"
                value={item.value}
                key={item.value || "all"}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${
                  format === item.value
                    ? "border-[#111B4D] bg-[#111B4D] text-white"
                    : "border-[#D6DEED] bg-white text-[#64748B] hover:border-[#111B4D] hover:text-[#111B4D]"
                }`}
                aria-pressed={format === item.value}
              >
                <span className="truncate px-1">{item.label}</span>
              </button>
            ))}
          </div>
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

function InlineFilter({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}
