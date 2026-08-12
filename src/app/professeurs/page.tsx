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
import {
  CourseFormatSegmentedControl,
  normalizeCourseFormat,
} from "@/components/shared/course-format-segmented-control";
import { JourneySwitcher } from "@/components/shared/journey-switcher";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
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
  teacherJourneyCatalogClauses,
} from "@/lib/catalog-journey";
import { buildTeacherSearchClauses } from "@/lib/teacher-search";
import {
  parseTeacherJourney,
  TEACHER_JOURNEY_CONFIG,
  TEACHER_JOURNEYS,
  teacherJourneyWhere,
  type TeacherJourney as BookingJourney,
} from "@/lib/teacher-journeys";
import { normalizePartnerReferralCode } from "@/lib/partner-referrals";

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
  ref?: string;
  partnerRef?: string;
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
  const referralCode = normalizePartnerReferralCode(sp.ref || sp.partnerRef);
  const format = normalizeCourseFormat(requestedFormat);
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
        AND: [
          ...visibleTeacherWhere.AND,
          ...teacherJourneyCatalogClauses(subjects, levels),
          ...buildTeacherSearchClauses(q),
        ],
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
    if (referralCode) params.set("ref", referralCode);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/professeurs?${qs}` : "/professeurs";
  }

  function buildJourneyUrl(nextJourney: BookingJourney): string {
    const params = new URLSearchParams({ journey: nextJourney });
    if (commune) params.set("commune", commune);
    if (format) params.set("format", format);
    if (sort && sort !== "recommended") params.set("sort", sort);
    if (referralCode) params.set("ref", referralCode);
    return `/professeurs?${params.toString()}`;
  }

  const activeFiltersCount = [
    subject,
    level,
    commune,
    format,
    q,
  ].filter(Boolean).length;
  const resetFiltersParams = new URLSearchParams();
  if (journey) resetFiltersParams.set("journey", journey);
  if (referralCode) resetFiltersParams.set("ref", referralCode);
  const resetFiltersHref = resetFiltersParams.toString() ? `/professeurs?${resetFiltersParams.toString()}` : "/professeurs";
  const journeyHrefs = Object.fromEntries(
    TEACHER_JOURNEYS.map((value) => [value, buildJourneyUrl(value)]),
  ) as Record<BookingJourney, string>;
  const hasPublishedTeachers = totalVisibleTeachers > 0;
  const showTeacherFilters = hasPublishedTeachers;
  const mobileResultLabel = `${total} professeur${total > 1 ? "s" : ""}`;
  const activeFilterLabel = activeFiltersCount > 0
    ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? "s" : ""}`
    : "Sans filtre";
  const subjectGroups = groupByCatalogCategory(subjects, (item) => getSubjectCategory(item.name, item.icon));
  const levelGroups = groupByCatalogCategory(levels, (item) => getLevelCategory(item.name, item.order));

  return (
    <PublicLayout activeJourney={journey}>
      {/* HEADER */}
      <section className="relative overflow-hidden border-b border-[#E6EAF3] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <nav className="mb-4 hidden min-h-9 flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B] sm:flex">
            <Link href="/" className="inline-flex min-h-10 items-center px-1 hover:text-[#111B4D]">Accueil</Link>
            <span>/</span>
            <span className="inline-flex min-h-10 items-center text-[#111827]">Professeurs</span>
          </nav>
          <nav
            className="mx-auto mb-3 max-w-3xl sm:mb-5 sm:mx-0"
            aria-label="Choisir une mini-application"
            data-public-journey-tabs
          >
            <JourneySwitcher
              activeJourney={journey}
              hrefs={journeyHrefs}
              size="regular"
            />
          </nav>

          <div
            className="rounded-[1.6rem] border border-[#DDE6F7] bg-[#F8FAFF] p-3 shadow-[0_16px_42px_rgba(17,24,39,0.07)] sm:hidden"
            data-public-teacher-app-header
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#64748B]">
                  Système
                </p>
                <h1 className="mt-1 truncate text-2xl font-black leading-none tracking-[-0.045em] text-[#111827]">
                  {journeyConfig.shortLabel}
                </h1>
              </div>
              <div className="shrink-0 text-right" data-public-teacher-count>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                  Profs
                </p>
                <p className="mt-1 text-base font-black leading-none text-[#111B4D]">
                  {total}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p
                className="min-w-0 truncate rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-sm font-black text-[#111B4D]"
                data-public-teacher-system-pill
              >
                {journeyConfig.priceLabel}
              </p>
              <p className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-[#64748B]">
                {activeFilterLabel}
              </p>
            </div>
            <TeacherSearchForm
              q={q}
              journey={journey}
              subject={subject}
              level={level}
              commune={commune}
              format={format}
              sort={sort}
              referralCode={referralCode}
              journeyConfig={journeyConfig}
              resetSearchHref={buildPaginationUrl(1, false)}
              variant="mobile"
            />
          </div>

          <div className="hidden gap-3 sm:grid lg:grid-cols-[1fr_360px] lg:items-end lg:gap-4">
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

          <TeacherSearchForm
            q={q}
            journey={journey}
            subject={subject}
            level={level}
            commune={commune}
            format={format}
            sort={sort}
            referralCode={referralCode}
            journeyConfig={journeyConfig}
            resetSearchHref={buildPaginationUrl(1, false)}
            variant="desktop"
          />
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          {showTeacherFilters && (
            <MobileFilterSheet resultLabel={mobileResultLabel} activeFiltersCount={activeFiltersCount}>
              <FiltersForm
                activeFiltersCount={activeFiltersCount}
                journey={journey}
                q={q}
                subject={subject}
                level={level}
                commune={commune}
                format={format}
                sort={sort}
                referralCode={referralCode}
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
                  Effacer ({activeFiltersCount})
                </Link>
              )}
            </MobileFilterSheet>
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
                  referralCode={referralCode}
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
                        journeyLabel={journeyConfig.shortLabel}
                        profileHref={buildTeacherProfileHref(t.id, journey, referralCode)}
                        href={`/connexion?from=${encodeURIComponent(buildBookingHref(t.id, journey, referralCode))}`}
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

function TeacherSearchForm({
  q,
  journey,
  subject,
  level,
  commune,
  format,
  sort,
  referralCode,
  journeyConfig,
  resetSearchHref,
  variant,
}: {
  q: string;
  journey: BookingJourney | "";
  subject: string;
  level: string;
  commune: string;
  format: string;
  sort: string;
  referralCode: string;
  journeyConfig: (typeof TEACHER_JOURNEY_CONFIG)[BookingJourney];
  resetSearchHref: string;
  variant: "mobile" | "desktop";
}) {
  const mobile = variant === "mobile";

  return (
    <form
      method="GET"
      action="/professeurs"
      className={
        mobile
          ? "mt-3 flex gap-2 rounded-2xl border border-[#DDE6F7] bg-white p-1.5"
          : "mt-3 hidden gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2 sm:mt-6 sm:flex"
      }
      data-public-teacher-quick-search={mobile ? "true" : undefined}
    >
      <input
        type="search"
        name="q"
        defaultValue={q}
        aria-label={journeyConfig.searchAriaLabel}
        placeholder={journeyConfig.searchPlaceholder}
        className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#DDE6F7] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7] sm:rounded-lg sm:px-4"
        style={{ minHeight: 48 }}
      />
      {journey && <input type="hidden" name="journey" value={journey} />}
      {subject && <input type="hidden" name="subject" value={subject} />}
      {level && <input type="hidden" name="level" value={level} />}
      {commune && <input type="hidden" name="commune" value={commune} />}
      {format && <input type="hidden" name="format" value={format} />}
      {sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}
      {referralCode && <input type="hidden" name="ref" value={referralCode} />}
      <button
        type="submit"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-sm font-semibold text-white transition hover:bg-[#182260] sm:w-auto sm:rounded-lg sm:px-5"
        aria-label="Rechercher"
      >
        <Search className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Rechercher</span>
      </button>
      {q && (
        <Link
          href={resetSearchHref}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D6DEED] bg-white text-sm text-[#64748B] transition hover:border-[#111B4D] hover:text-[#111B4D] sm:rounded-lg"
          title="Réinitialiser la recherche"
          aria-label="Effacer la recherche"
        >
          <X className="h-4 w-4" />
        </Link>
      )}
    </form>
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
  referralCode,
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
  referralCode: string;
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
              href={buildTeacherResetHref(journey, referralCode)}
              className="text-xs font-medium text-[#111B4D] hover:underline"
            >
              Réinitialiser ({activeFiltersCount})
            </Link>
          )}
        </div>
      )}

      <div className={compact ? "grid gap-3 min-[560px]:grid-cols-2" : "space-y-4"}>
        {journey && <input type="hidden" name="journey" value={journey} />}
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

function InlineFilter({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}

function buildTeacherProfileHref(teacherId: string, journey: BookingJourney | "", referralCode: string) {
  const params = new URLSearchParams();
  if (journey) params.set("journey", journey);
  if (referralCode) params.set("ref", referralCode);
  const query = params.toString();
  return query ? `/professeurs/${teacherId}?${query}` : `/professeurs/${teacherId}`;
}

function buildBookingHref(teacherId: string, journey: BookingJourney | "", referralCode: string) {
  const params = new URLSearchParams({ teacherId });
  if (journey) params.set("journey", journey);
  if (referralCode) params.set("ref", referralCode);
  return `/client/reserver?${params.toString()}`;
}

function buildTeacherResetHref(journey: BookingJourney | "", referralCode: string) {
  const params = new URLSearchParams();
  if (journey) params.set("journey", journey);
  if (referralCode) params.set("ref", referralCode);
  const query = params.toString();
  return query ? `/professeurs?${query}` : "/professeurs";
}
