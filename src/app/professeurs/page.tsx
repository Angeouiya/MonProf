import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Home as HomeIcon,
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
import { buildTeacherSearchClauses } from "@/lib/teacher-search";

export const dynamic = "force-dynamic";

type SearchParams = {
  subject?: string;
  level?: string;
  commune?: string;
  format?: string;
  sort?: string;
  q?: string;
  page?: string;
};

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

  const subject = sp.subject?.trim() || "";
  const level = sp.level?.trim() || "";
  const commune = sp.commune?.trim() || "";
  const format = sp.format?.trim() || "";
  const sort = sp.sort?.trim() || "recommended";
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);

  // Build where clause (same logic as /api/teachers)
  const visibleTeacherWhere: any = {
    status: "ACTIVE",
    AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
  };
  const where: any = {
    ...visibleTeacherWhere,
    AND: [...visibleTeacherWhere.AND, ...buildTeacherSearchClauses(q)],
  };
  if (subject) where.subjects = { some: { subject: { slug: subject } } };
  if (level) where.levels = { some: { level: { slug: level } } };
  if (commune) where.zones = { some: { commune: { name: commune } } };
  if (format === "HOME") where.offersHome = true;
  if (format === "ONLINE") where.offersOnline = true;

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

  const [total, totalVisibleTeachers, teachers, subjects, levels, communes] = await Promise.all([
    db.teacher.count({ where }),
    db.teacher.count({ where: visibleTeacherWhere }),
    db.teacher.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true, bookings: true } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items = teachers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    professionalName: t.professionalName,
    photoUrl: t.photoUrl,
    jobTitle: t.jobTitle,
    rating: t.rating,
    ratingCount: t.ratingCount,
    adminRating: t.adminRating,
    adminRatingPublic: t.adminRatingPublic,
    experienceYears: t.experienceYears,
    careerSummary: t.careerSummary,
    skills: t.skills,
    workHistory: t.workHistory,
    certifications: t.certifications,
    teachingAchievements: t.teachingAchievements,
    learnersCoached: t.learnersCoached,
    pricePerSession: t.pricePerSession,
    offersHome: t.offersHome,
    offersOnline: t.offersOnline,
    commune: t.commune,
    badgeVerified: t.badgeVerified,
    badgeRecommended: t.badgeRecommended,
    badgeNew: t.badgeNew,
    badgePopular: t.badgePopular,
    badgePremium: t.badgePremium,
    primarySubject: t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name,
    _count: { reviews: t._count.reviews },
  }));

  // Build a query string without `page` for pagination links
  function buildPaginationUrl(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (subject) params.set("subject", subject);
    if (level) params.set("level", level);
    if (commune) params.set("commune", commune);
    if (format) params.set("format", format);
    if (sort && sort !== "recommended") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/professeurs?${qs}` : "/professeurs";
  }

  const activeFiltersCount = [
    subject,
    level,
    commune,
    format,
    q,
  ].filter(Boolean).length;
  const hasPublishedTeachers = totalVisibleTeachers > 0;
  const showTeacherFilters = hasPublishedTeachers;
  const subjectGroups = groupByCatalogCategory(subjects, (item) => getSubjectCategory(item.name, item.icon));
  const levelGroups = groupByCatalogCategory(levels, (item) => getLevelCategory(item.name, item.order));

  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="relative overflow-hidden border-b border-[#E6EAF3] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <nav className="mb-4 hidden min-h-9 flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B] sm:flex">
            <Link href="/" className="inline-flex min-h-10 items-center px-1 hover:text-[#111B4D]">Accueil</Link>
            <span>/</span>
            <span className="inline-flex min-h-10 items-center text-[#111827]">Professeurs</span>
          </nav>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#111B4D] sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Profils vérifiés
              </div>
              <h1 className="max-w-2xl text-[1.85rem] font-semibold leading-[1.06] text-[#111827] text-balance sm:text-4xl lg:text-[2.65rem]">
                Choisissez le bon professeur.
              </h1>
              <p className="mt-2 max-w-xl text-[0.95rem] font-medium leading-6 text-[#64748B] sm:text-base">
                Scolaire, université, concours, métiers et formations adultes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:rounded-lg lg:border lg:border-[#E3E8F2] lg:bg-white lg:p-4">
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
          <form method="GET" action="/professeurs" className="mt-4 flex flex-col gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2 sm:mt-6 min-[640px]:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Matière, concours, adulte, art, technique, spécialité..."
              className="min-h-12 flex-1 rounded-lg border border-[#DDE6F7] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
              style={{ minHeight: 48 }}
            />
            {/* Préserve les autres filtres */}
            {subject && <input type="hidden" name="subject" value={subject} />}
            {level && <input type="hidden" name="level" value={level} />}
            {commune && <input type="hidden" name="commune" value={commune} />}
            {format && <input type="hidden" name="format" value={format} />}
            {sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[#111B4D] px-5 text-sm font-semibold text-white transition hover:bg-[#182260]"
            >
              Rechercher
            </button>
            {q && (
              <Link
                href={buildPaginationUrl(1)}
                className="inline-flex h-12 items-center justify-center rounded-lg border border-[#D6DEED] bg-white px-3 text-sm text-[#64748B] transition hover:border-[#111B4D] hover:text-[#111B4D]"
                title="Réinitialiser la recherche"
              >
                <X className="h-4 w-4" />
              </Link>
            )}
          </form>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {showTeacherFilters && (
            <div className="mb-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#E3E8F2] bg-white px-4 py-2 lg:hidden">
              <p className="min-w-0 text-sm font-medium text-[#64748B]">
                <span className="font-semibold text-[#111827]">{total}</span>{" "}
                professeur{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
              </p>
              {activeFiltersCount > 0 && (
                <Link href="/professeurs" className="shrink-0 text-xs font-semibold text-[#111B4D]">
                  Effacer ({activeFiltersCount})
                </Link>
              )}
            </div>
          )}
          {showTeacherFilters && (
            <details className="mb-4 rounded-lg border border-[#E3E8F2] bg-white p-3 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-semibold text-[#111827]">
                <span className="inline-flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#111B4D]" />
                  Filtres
                </span>
                {activeFiltersCount > 0 && (
                  <span className="rounded-lg border border-[#E3E8F2] bg-white px-2 py-1 text-xs text-[#111B4D]">
                    {activeFiltersCount}
                  </span>
                )}
              </summary>
              <div className="pt-3">
                <FiltersForm
                  activeFiltersCount={activeFiltersCount}
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
                  compact
                />
              </div>
            </details>
          )}
          <div className={showTeacherFilters ? "grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]" : "mx-auto max-w-3xl"}>
            {/* SIDEBAR FILTRES */}
            {showTeacherFilters && (
              <aside className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:h-fit">
                <FiltersForm
                  activeFiltersCount={activeFiltersCount}
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
                />
              </aside>
            )}

            {/* RÉSULTATS */}
            <div>
              {showTeacherFilters && (
                <div className="mb-5 hidden flex-col gap-2 rounded-lg border border-[#E3E8F2] bg-white p-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm font-medium text-[#64748B]">
                    <span className="font-semibold text-[#111827]">{total}</span>{" "}
                    professeur{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
                    {subject || level || commune || format ? (
                      <span className="ml-1 text-[#64748B]">
                        · filtres actifs
                      </span>
                    ) : null}
                  </p>
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
                  className={hasPublishedTeachers ? undefined : "min-h-[18rem] px-5 py-8 sm:px-8 sm:py-10"}
                  description={
                    hasPublishedTeachers
                      ? "Essayez d'élargir vos filtres (niveau, commune, prix) ou réinitialisez la recherche."
                      : "Les profils réels seront affichés ici après vérification par le service client : vraie photo, identité contrôlée, matières et disponibilités exploitables."
                  }
                  action={
                    <>
                      <Link
                        href={hasPublishedTeachers ? "/professeurs" : "/contact"}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260] sm:w-auto"
                      >
                        {hasPublishedTeachers ? "Réinitialiser les filtres" : "Transmettre mon besoin"}
                      </Link>
                      {!hasPublishedTeachers && (
                        <Link
                          href="/"
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#D6DEED] bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D] sm:w-auto"
                        >
                          Retour accueil
                        </Link>
                      )}
                    </>
                  }
                />
              ) : (
                <>
                  <div className="grid min-w-0 gap-4 min-[680px]:grid-cols-2 min-[1180px]:grid-cols-3">
                    {items.map((t, index) => (
                      <TeacherCard key={`${t.id}-${index}`} teacher={t as any} />
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
  q,
  subject,
  level,
  commune,
  format,
  sort,
  subjectGroups,
  levelGroups,
  communes,
  compact = false,
}: {
  activeFiltersCount: number;
  q: string;
  subject: string;
  level: string;
  commune: string;
  format: string;
  sort: string;
  subjectGroups: CatalogFilterGroup[];
  levelGroups: CatalogFilterGroup[];
  communes: CommuneFilterOption[];
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
              href="/professeurs"
              className="text-xs font-medium text-[#111B4D] hover:underline"
            >
              Réinitialiser ({activeFiltersCount})
            </Link>
          )}
        </div>
      )}

      <div className={compact ? "grid gap-3 min-[560px]:grid-cols-2" : "space-y-4"}>
        <Field label="Matière">
          <SearchableCatalogSelect
            name="subject"
            value={subject}
            placeholder="Toutes les matières"
            searchPlaceholder="Saisir une matière, concours, métier..."
            emptyLabel="Aucune matière trouvée"
            allLabel="Toutes les matières"
            groups={subjectGroups}
            triggerClassName="focus:border-[#9AAAD0] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </Field>

        <Field label="Niveau">
          <SearchableCatalogSelect
            name="level"
            value={level}
            placeholder="Tous les niveaux"
            searchPlaceholder="Saisir un niveau : BAC, adulte, BTS..."
            emptyLabel="Aucun niveau trouvé"
            allLabel="Tous les niveaux"
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
            allowCustomValue
            customValueLabel="Rechercher dans cette ville"
          />
        </Field>

        <Field label="Format">
          <div className="grid grid-cols-3 gap-1.5">
            {FORMATS.map((item) => (
              <label
                key={item.value || "all"}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition ${
                  format === item.value
                    ? "border-[#111B4D] bg-[#111B4D] text-white"
                    : "border-[#D6DEED] bg-white text-[#64748B] hover:border-[#111B4D] hover:text-[#111B4D]"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={item.value}
                  defaultChecked={format === item.value}
                  className="sr-only"
                />
                <span className="truncate px-1">{item.label}</span>
              </label>
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
