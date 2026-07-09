import Link from "next/link";
import { db } from "@/lib/db";
import {
  ClientEmptyState,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { TeacherCard } from "@/components/shared/teacher-card";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import {
  BookOpenCheck,
  CalendarCheck,
  ChevronDown,
  LifeBuoy,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { getLevelCategory, getSubjectCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";
import { getCachedCommunes, getCachedLevels, getCachedSubjects } from "@/lib/catalog-cache";
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
    case "rating": orderBy = { rating: "desc" }; break;
    case "experience": orderBy = { experienceYears: "desc" }; break;
    default: orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }]; break;
  }

  let teachers: any[] = [];
  let totalVisibleTeachers = 0;
  let subjects: any[] = [];
  let levels: any[] = [];
  let communes: any[] = [];

  try {
    totalVisibleTeachers = await db.teacher.count({ where: visibleTeacherWhere });
    if (totalVisibleTeachers > 0) {
      teachers = await db.teacher.findMany({
        where,
        orderBy,
        take: 24,
        include: {
          subjects: { include: { subject: true } },
          _count: { select: { reviews: true } },
        },
      });
      [subjects, levels, communes] = await Promise.all([
        getCachedSubjects(),
        getCachedLevels(),
        getCachedCommunes(),
      ]);
    }
  } catch (error) {
    console.error("[client-search:query_failed]", error);
  }

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
  const communeGroups = [{
    label: "Villes et communes",
    options: communes.map((c) => ({
      value: c.name,
      label: c.name,
      keywords: c.name,
    })),
  }];
  const hasActiveFilters = activeFilters.length > 0;
  const resultIntro = hasActiveFilters
    ? `Résultats pour ${activeFilters.map((filter) => filter.label.replace(" : ", " ")).join(", ")}.`
    : "Recherche libre sur les matières, niveaux, communes, concours, métiers et parcours professeur.";
  const homeCount = items.filter((teacher) => teacher.offersHome).length;
  const onlineCount = items.filter((teacher) => teacher.offersOnline).length;
  const certifiedCount = items.filter((teacher) => teacher.badgeVerified).length;
  const primaryActionHref = items.length > 0 ? "#resultats-professeurs" : "#filtres-professeurs";
  const hasPublishedTeachers = totalVisibleTeachers > 0;

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Trouver un professeur"
        title="Rechercher un professeur"
        description="Tapez une matière, un concours, un métier ou une commune."
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: UserRound, label: "Profils", value: items.length, attention: items.length === 0 },
          { icon: ShieldCheck, label: "Certifiés", value: certifiedCount },
          { icon: MapPin, label: "Domicile", value: homeCount },
          { icon: BookOpenCheck, label: "En ligne", value: onlineCount },
        ]}
      />

      <SearchCommandCenter
        resultCount={items.length}
        activeFilterCount={activeFilters.length}
        hasQuery={Boolean(q)}
        subjectLabel={subjectLabel}
        levelLabel={levelLabel}
        commune={commune ?? ""}
        formatLabel={formatLabel}
        primaryActionHref={primaryActionHref}
      />

      <form
        id="filtres-professeurs"
        data-client-search-form
        className="scroll-mt-24 rounded-lg border border-[#DDE3EE] bg-white p-3 sm:p-4"
      >
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

        <div data-client-search-mobile-summary className="mt-2 grid grid-cols-2 gap-2 md:hidden">
          <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Résultats</p>
            <p className="mt-0.5 text-sm font-semibold text-[#111827]">{formatCount(items.length, "profil")}</p>
          </div>
          <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Filtres</p>
            <p className="mt-0.5 text-sm font-semibold text-[#111827]">{activeFilters.length || "Aucun"}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EAF3] pt-3 max-md:hidden">
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
          <div className="flex flex-col gap-2 min-[820px]:flex-row min-[820px]:items-center">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Recherches fréquentes</span>
            <div
              data-client-quick-search-rail
              className="flex snap-x gap-2 overflow-x-auto pb-1 min-[820px]:flex-wrap min-[820px]:overflow-visible min-[820px]:pb-0"
              aria-label="Recherches fréquentes"
            >
              {quickSearches.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group inline-flex min-h-11 min-w-[10rem] snap-start items-center justify-between gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-sm font-semibold leading-4 text-[#111827] transition hover:border-[#111B4D] hover:text-[#111B4D] min-[820px]:min-w-0 min-[820px]:justify-center"
                >
                  <span className="min-w-0">{item.label}</span>
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
                <div
                  className="grid min-w-0 grid-cols-1 gap-1.5 min-[430px]:grid-cols-2 min-[720px]:flex min-[720px]:flex-wrap"
                  aria-label="Filtres actifs"
                >
                  {activeFilters.map((filter) => (
                    <Link
                      key={filter.key}
                      href={filter.href}
                      className="inline-flex min-h-9 min-w-0 items-center justify-between gap-1.5 rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold text-[#111B4D] transition hover:border-[#111B4D] min-[720px]:justify-center"
                      title={`Retirer le filtre ${filter.label}`}
                    >
                      <span className="truncate">{filter.label}</span>
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

            <div className="grid gap-3 min-[680px]:grid-cols-2 lg:grid-cols-4">
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
                <SearchableCatalogSelect
                  name="commune"
                  value={commune ?? ""}
                  placeholder="Toutes"
                  searchPlaceholder="Tapez une ville ou commune..."
                  emptyLabel="Aucune commune trouvée"
                  allLabel="Toutes les communes"
                  groups={communeGroups}
                  triggerClassName="mt-1.5 h-11 rounded-lg border-[#E3E8F2] py-2.5 focus:border-[#111B4D] focus:ring-2 focus:ring-[#111B4D]"
                  allowCustomValue
                  customValueLabel="Rechercher dans cette ville"
                />
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
              <div className="flex items-end min-[680px]:col-span-2 lg:col-span-3">
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

      <ClientSurface id="resultats-professeurs" className="scroll-mt-24 space-y-4">
        <ClientSectionTitle
          title={hasPublishedTeachers ? formatCount(items.length, "professeur trouvé", "professeurs trouvés") : "Professeurs en cours de publication"}
          description={
            hasPublishedTeachers
              ? hasActiveFilters
                ? "Résultats adaptés à vos critères."
                : "Choisissez un professeur pour réserver directement."
              : "Les premiers profils réels sont ajoutés par le service client après vérification."
          }
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
              title={hasPublishedTeachers ? "Aucun professeur ne correspond" : "Aucun professeur publié pour le moment"}
              description={
                hasPublishedTeachers
                  ? "Essayez d'élargir vos critères de recherche ou retirez un filtre actif."
                  : "Compétence publie uniquement des professeurs avec vraie photo, profil vérifié et disponibilité exploitable. Revenez bientôt ou contactez le service client pour un besoin précis."
              }
            />
            <div
              className="grid gap-2 min-[520px]:grid-cols-2 min-[840px]:grid-cols-4"
              aria-label="Suggestions de recherche"
            >
              <Link
                href={hasPublishedTeachers ? "/client/rechercher" : "/client/service-client"}
                className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg bg-[#111B4D] px-4 text-center text-sm font-semibold text-white transition hover:bg-[#182260]"
              >
                {hasPublishedTeachers ? "Voir tous les professeurs" : "Contacter le service client"}
              </Link>
              {(hasPublishedTeachers ? quickSearches.slice(0, 3) : quickSearches.slice(0, 2)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border border-[#DDE6F7] bg-white px-4 text-center text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-3 min-[720px]:grid-cols-2 xl:grid-cols-3">
            {items.map((t, index) => (
              <TeacherCard key={`${t.id}-${index}`} teacher={t as any} href={`/client/reserver?teacherId=${t.id}`} />
            ))}
          </div>
        )}
      </ClientSurface>
    </div>
  );
}

function SearchCommandCenter({
  resultCount,
  activeFilterCount,
  hasQuery,
  subjectLabel,
  levelLabel,
  commune,
  formatLabel,
  primaryActionHref,
}: {
  resultCount: number;
  activeFilterCount: number;
  hasQuery: boolean;
  subjectLabel: string;
  levelLabel: string;
  commune: string;
  formatLabel: string;
  primaryActionHref: string;
}) {
  const hasContext = hasQuery || activeFilterCount > 0;
  const bestContext = [
    subjectLabel || null,
    levelLabel || null,
    commune || null,
    formatLabel || null,
  ].filter(Boolean).join(" · ");

  return (
    <ClientSurface compact className="hidden overflow-hidden rounded-lg border border-[#DDE3EE] p-0 md:block" data-client-search-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.8fr)]">
        <div className="space-y-4 p-4 min-[640px]:p-5">
          <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Recherche intelligente</p>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-[#111827]">
                {resultCount > 0 ? "Des professeurs prêts à réserver" : "Élargissez les critères pour trouver un profil"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
                {hasContext
                  ? "La recherche combine matière, niveau, commune, format et texte libre pour garder des résultats exploitables."
                  : "Décrivez simplement le besoin : matière, concours, compétence professionnelle, commune ou format."}
              </p>
            </div>
            <a
              href={primaryActionHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260] min-[520px]:w-fit"
            >
              {resultCount > 0 ? "Voir les profils" : "Ajuster les filtres"}
            </a>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Résultats" value={formatCount(resultCount, "profil")} strong={resultCount > 0} />
            <ClientInfoPill label="Filtres actifs" value={activeFilterCount || "Aucun"} strong={activeFilterCount > 0} />
            <ClientInfoPill label="Contexte" value={bestContext || "Recherche libre"} strong={Boolean(bestContext)} />
            <ClientInfoPill label="Séance" value="2h par cours" strong />
          </div>

          <div className="hidden lg:block">
            <ClientProcessTracker
              steps={[
                {
                  label: "Saisir le besoin",
                  state: hasQuery || activeFilterCount > 0 ? "done" : "current",
                  hint: "Matière, concours, métier, commune ou objectif.",
                },
                {
                  label: "Affiner sans effort",
                  state: activeFilterCount > 0 ? "done" : hasQuery ? "current" : "pending",
                  hint: "Matière, niveau, zone, format et tri.",
                },
                {
                  label: "Réserver le bon professeur",
                  state: resultCount > 0 ? "current" : "pending",
                  hint: "Photo réelle, certification, tarif indicatif et accès profil.",
                },
              ]}
            />
          </div>
        </div>

        <aside className="border-t border-[#E6EAF3] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Décision rapide</p>
              <h3 className="mt-1 text-base font-semibold leading-tight text-[#111827]">
                {resultCount > 0 ? "Comparez, puis réservez directement" : "Retirez un filtre ou essayez une recherche large"}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
                Les cartes affichent uniquement des professeurs actifs avec photo, pour garder une expérience crédible et nette.
              </p>
            </div>
            <div className="grid gap-2">
              <a
                href={primaryActionHref}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
              >
                {resultCount > 0 ? "Comparer maintenant" : "Ouvrir les filtres"}
              </a>
              <Link
                href="/client/service-client"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#CAD7F2] bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
              >
                Besoin d'aide
              </Link>
            </div>
            <div className="mt-auto rounded-lg border border-[#E3E8F2] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Prix</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#111827]">
                Le prix affiché reste indicatif. Le total final est confirmé dans la réservation avant PayDunya.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </ClientSurface>
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
