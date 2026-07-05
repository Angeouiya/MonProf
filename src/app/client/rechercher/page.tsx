import Link from "next/link";
import { db } from "@/lib/db";
import { ClientEmptyState, ClientPageHeader, ClientSectionTitle, ClientSurface } from "@/components/shared/client-page-primitives";
import { TeacherCard } from "@/components/shared/teacher-card";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { CalendarCheck, ChevronDown, SlidersHorizontal, Search, X } from "lucide-react";
import { getLevelCategory, getSubjectCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";
import { buildTeacherSearchClauses } from "@/lib/teacher-search";

export const dynamic = "force-dynamic";

const fieldClassName = "mt-1.5 h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]";
type SearchParams = { [k: string]: string | undefined };

const quickSearches = [
  { label: "Maths à Cocody", href: "/client/rechercher?q=math&commune=Cocody" },
  { label: "Anglais en ligne", href: "/client/rechercher?q=anglais&format=ONLINE" },
  { label: "Concours", href: "/client/rechercher?q=concours" },
  { label: "Adultes", href: "/client/rechercher?q=professionnel" },
  { label: "Informatique", href: "/client/rechercher?q=informatique" },
  { label: "Art et métiers", href: "/client/rechercher?q=design" },
];

export default async function RechercherPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const subject = sp.subject;
  const level = sp.level;
  const commune = sp.commune;
  const format = sp.format;
  const q = sp.q?.trim();
  const sort = sp.sort ?? "recommended";

  const where: any = { status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }, ...buildTeacherSearchClauses(q)] };
  if (subject) where.subjects = { some: { subject: { slug: subject } } };
  if (level) where.levels = { some: { level: { slug: level } } };
  if (commune) where.zones = { some: { commune: { name: commune } } };
  if (format === "HOME") where.offersHome = true;
  if (format === "ONLINE") where.offersOnline = true;

  let orderBy: any;
  switch (sort) {
    case "rating": orderBy = { rating: "desc" }; break;
    case "experience": orderBy = { experienceYears: "desc" }; break;
    default: orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }]; break;
  }

  const teachers = await db.teacher.findMany({
    where,
    orderBy,
    take: 24,
    include: {
      subjects: { include: { subject: true } },
      _count: { select: { reviews: true } },
    },
  });
  const subjects = await db.subject.findMany({ orderBy: { name: "asc" } });
  const levels = await db.level.findMany({ orderBy: { order: "asc" } });
  const communes = await db.commune.findMany({ orderBy: { name: "asc" } });

  const items = teachers.map((t) => ({
    ...t,
    primarySubject: t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name,
    href: `/client/reserver?teacherId=${t.id}`,
  }));
  const subjectGroups = groupByCatalogCategory(subjects, (item) => getSubjectCategory(item.name, item.icon));
  const levelGroups = groupByCatalogCategory(levels, (item) => getLevelCategory(item.name, item.order));
  const subjectLabel = subject ? subjects.find((item) => item.slug === subject)?.name ?? subject : "";
  const levelLabel = level ? levels.find((item) => item.slug === level)?.name ?? level : "";
  const formatLabel = format ? (format === "HOME" ? "À domicile" : "En ligne") : "";
  const sortLabel = sort === "rating" ? "Mieux notés" : sort === "experience" ? "Expérience" : "";
  const activeFilters = [
    q ? { key: "q", label: `Recherche : ${q}`, href: buildSearchHref(sp, { q: null }) } : null,
    subject ? { key: "subject", label: `Matière : ${subjectLabel}`, href: buildSearchHref(sp, { subject: null }) } : null,
    level ? { key: "level", label: `Niveau : ${levelLabel}`, href: buildSearchHref(sp, { level: null }) } : null,
    commune ? { key: "commune", label: `Commune : ${commune}`, href: buildSearchHref(sp, { commune: null }) } : null,
    format ? { key: "format", label: `Format : ${formatLabel}`, href: buildSearchHref(sp, { format: null }) } : null,
    sort !== "recommended" ? { key: "sort", label: `Tri : ${sortLabel}`, href: buildSearchHref(sp, { sort: null }) } : null,
  ].filter((filter): filter is { key: string; label: string; href: string } => Boolean(filter));
  const hasActiveFilters = activeFilters.length > 0;
  const resultIntro = hasActiveFilters
    ? `Résultats pour ${activeFilters.map((filter) => filter.label.replace(" : ", " ")).join(", ")}.`
    : "Recherche libre sur les matières, niveaux, communes, concours, métiers et parcours professeur.";

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Trouver un professeur"
        title="Rechercher un professeur"
        description="Tapez une matière, un concours, un métier ou une commune."
      />

      <form className="rounded-lg border border-[#DDE3EE] bg-white p-3 sm:p-4">
        <div className="grid gap-2 min-[560px]:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="sr-only" htmlFor="client-search-query">Recherche</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111B4D]" />
              <input
                id="client-search-query"
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Matière, concours, adulte, métier..."
                className="h-12 w-full rounded-lg border border-[#DDE6F7] bg-white py-3 pl-10 pr-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#8A94A8] focus:border-[#111B4D] focus:ring-2 focus:ring-[#DDE6F7]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-5 text-sm font-semibold text-white transition hover:bg-[#182260]"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EAF3] pt-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              {formatCount(items.length, "profil")} disponible{items.length > 1 ? "s" : ""}
            </p>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[#111827]">{resultIntro}</p>
          </div>
          <Link
            href="/client/rechercher"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#DDE6F7] bg-white px-3 text-xs font-semibold text-[#111B4D]"
          >
            Tous les profils
          </Link>
        </div>

        <div className="mt-3 border-t border-[#E6EAF3] pt-3">
          <div className="flex flex-col gap-2 min-[700px]:flex-row min-[700px]:items-center">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Recherches fréquentes</span>
            <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-3 min-[900px]:flex min-[900px]:flex-wrap">
              {quickSearches.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group inline-flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 text-sm font-semibold text-[#111827] transition hover:border-[#111B4D] hover:text-[#111B4D] min-[900px]:justify-center"
                >
                  <span className="truncate">{item.label}</span>
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <details className="mt-3 rounded-lg border border-[#E3E8F2] bg-white" open={hasActiveFilters}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#111827] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate min-[380px]:hidden">Filtres</span>
                <span className="hidden truncate min-[380px]:block">Filtres avancés</span>
                <span className="block truncate text-xs font-medium text-[#64748B] min-[380px]:hidden">Affiner</span>
                <span className="hidden truncate text-xs font-medium text-[#64748B] min-[380px]:block">Matière, niveau, commune, format.</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex min-h-9 min-w-[4.75rem] items-center justify-center whitespace-nowrap rounded-lg border border-[#DDE6F7] bg-white px-2.5 text-xs font-semibold text-[#111B4D]">
                {items.length} résultat{items.length > 1 ? "s" : ""}
              </span>
              <ChevronDown className="h-4 w-4 text-[#111B4D]" />
            </span>
          </summary>

          <div className="border-t border-[#E3E8F2] p-3 sm:p-4">
            {hasActiveFilters && (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#DDE6F7] bg-white p-3 min-[620px]:flex-row min-[620px]:items-center min-[620px]:justify-between">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <Link
                      key={filter.key}
                      href={filter.href}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                      title={`Retirer le filtre ${filter.label}`}
                    >
                      <span>{filter.label}</span>
                      <X className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
                <Link
                  href="/client/rechercher"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#CAD7F2] bg-white px-3 text-xs font-semibold text-[#111B4D] transition hover:bg-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Réinitialiser
                </Link>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Matière</label>
                <SearchableCatalogSelect
                  name="subject"
                  value={subject ?? ""}
                  placeholder="Toutes"
                  searchPlaceholder="Saisir une matière, concours, métier..."
                  emptyLabel="Aucune matière trouvée"
                  allLabel="Toutes les matières"
                  groups={subjectGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((s) => ({
                      value: s.slug,
                      label: s.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  triggerClassName="mt-1.5 h-11 rounded-lg border-[#E3E8F2] py-2.5 focus:border-[#111B4D] focus:ring-2 focus:ring-[#111B4D]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Niveau</label>
                <SearchableCatalogSelect
                  name="level"
                  value={level ?? ""}
                  placeholder="Tous"
                  searchPlaceholder="Saisir un niveau : BAC, adulte, BTS..."
                  emptyLabel="Aucun niveau trouvé"
                  allLabel="Tous les niveaux"
                  groups={levelGroups.map((group) => ({
                    label: group.category.label,
                    options: group.items.map((l) => ({
                      value: l.slug,
                      label: l.name,
                      keywords: group.category.label,
                    })),
                  }))}
                  triggerClassName="mt-1.5 h-11 rounded-lg border-[#E3E8F2] py-2.5 focus:border-[#111B4D] focus:ring-2 focus:ring-[#111B4D]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Commune</label>
                <select
                  name="commune"
                  defaultValue={commune ?? ""}
                  className={fieldClassName}
                >
                  <option value="">Toutes</option>
                  {communes.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Format</label>
                <select
                  name="format"
                  defaultValue={format ?? ""}
                  className={fieldClassName}
                >
                  <option value="">Tous</option>
                  <option value="HOME">À domicile</option>
                  <option value="ONLINE">En ligne</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Trier par</label>
                <select
                  name="sort"
                  defaultValue={sort}
                  className={fieldClassName}
                >
                  <option value="recommended">Recommandés</option>
                  <option value="rating">Mieux notés</option>
                  <option value="experience">Expérience</option>
                </select>
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260] lg:max-w-56"
                >
                  <Search className="h-4 w-4" />
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        </details>
      </form>

      <ClientSurface className="space-y-4">
        <ClientSectionTitle
          title={formatCount(items.length, "professeur trouvé", "professeurs trouvés")}
          description={hasActiveFilters ? "Résultats adaptés à vos critères." : "Choisissez un professeur pour réserver directement."}
          action={
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#111B4D]">
              <CalendarCheck className="h-3.5 w-3.5" />
              Séance de 2h
            </span>
          }
        />
        {items.length === 0 ? (
          <div className="space-y-4">
            <ClientEmptyState
              icon={Search}
              title="Aucun professeur ne correspond"
              description="Essayez d'élargir vos critères de recherche ou retirez un filtre actif."
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/client/rechercher"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
              >
                Voir tous les professeurs
              </Link>
              {quickSearches.slice(0, 3).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#DDE6F7] bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((t, index) => (
              <TeacherCard key={`${t.id}-${index}`} teacher={t as any} href={`/client/reserver?teacherId=${t.id}`} />
            ))}
          </div>
        )}
      </ClientSurface>
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSearchHref(
  currentParams: SearchParams,
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams();
  for (const key of ["q", "subject", "level", "commune", "format", "sort"]) {
    const value = currentParams[key];
    if (!value || (key === "sort" && value === "recommended")) continue;
    params.set(key, value);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value || (key === "sort" && value === "recommended")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/client/rechercher?${query}` : "/client/rechercher";
}
