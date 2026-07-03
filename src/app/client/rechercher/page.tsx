import Link from "next/link";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/shared/page-header";
import { ClientPageHeader } from "@/components/shared/client-page-primitives";
import { TeacherCard } from "@/components/shared/teacher-card";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { CalendarCheck, Filter, Search, X } from "lucide-react";
import { getLevelCategory, getSubjectCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";

export const dynamic = "force-dynamic";

const fieldClassName = "mt-1.5 h-11 w-full rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]";
const quickSearches = [
  { label: "Mathématiques à Cocody", href: "/client/rechercher?q=math&commune=Cocody", detail: "Soutien scolaire" },
  { label: "Anglais en ligne", href: "/client/rechercher?q=anglais&format=ONLINE", detail: "Cours à distance" },
  { label: "Préparation concours", href: "/client/rechercher?q=concours", detail: "Examens et écoles" },
  { label: "Adultes et professionnels", href: "/client/rechercher?q=professionnel", detail: "Montée en compétence" },
  { label: "Informatique", href: "/client/rechercher?q=informatique", detail: "Bureautique, code, outils" },
  { label: "Art, design et métiers", href: "/client/rechercher?q=design", detail: "Compétences pratiques" },
];

export default async function RechercherPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const subject = sp.subject;
  const level = sp.level;
  const commune = sp.commune;
  const format = sp.format;
  const q = sp.q?.trim();
  const sort = sp.sort ?? "recommended";

  const where: any = { status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] };
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { professionalName: { contains: q } },
      { jobTitle: { contains: q } },
      { bio: { contains: q } },
    ];
  }
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

  const [teachers, subjects, levels, communes] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy,
      take: 24,
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  const items = teachers.map((t) => ({
    ...t,
    primarySubject: t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name,
    href: `/client/reserver?teacherId=${t.id}`,
  }));
  const subjectGroups = groupByCatalogCategory(subjects, (item) => getSubjectCategory(item.name, item.icon));
  const levelGroups = groupByCatalogCategory(levels, (item) => getLevelCategory(item.name, item.order));
  const activeFilters = [
    q ? `Recherche : ${q}` : "",
    subject ? `Matière : ${subjects.find((item) => item.slug === subject)?.name ?? subject}` : "",
    level ? `Niveau : ${levels.find((item) => item.slug === level)?.name ?? level}` : "",
    commune ? `Commune : ${commune}` : "",
    format ? `Format : ${format === "HOME" ? "À domicile" : "En ligne"}` : "",
    sort !== "recommended" ? `Tri : ${sort === "rating" ? "Mieux notés" : "Expérience"}` : "",
  ].filter(Boolean);
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Trouver un professeur"
        title="Rechercher un professeur"
        description="Trouvez un professeur vérifié pour le scolaire, l'université, les adultes, les concours, les matières techniques ou artistiques."
      >
        <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#DDE6F7] bg-white px-4 text-sm font-black text-[#111B4D]">
          {formatCount(items.length, "résultat")}
        </span>
      </ClientPageHeader>

      <section className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#111827]">Recherches rapides</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-[#64748B]">
              Sélectionnez un besoin courant ou filtrez directement.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 min-[460px]:grid-cols-2 xl:grid-cols-3">
          {quickSearches.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-left transition hover:border-[#111B4D] hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[#111827]">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[#64748B]">{item.detail}</span>
              </span>
              <Search className="h-4 w-4 shrink-0 text-[#111B4D] transition group-hover:scale-105" />
            </Link>
          ))}
        </div>
      </section>

      <form className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 border-b border-[#E3E8F2] pb-4 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111B4D] text-white">
              <Filter className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-black text-[#111827]">Filtres de recherche</p>
              <p className="text-xs text-[#64748B]">Matière, niveau, commune, format et disponibilité du professeur.</p>
            </div>
          </div>
          <p className="rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
            {formatCount(items.length, "résultat")}
          </p>
        </div>
        {hasActiveFilters && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#DDE6F7] bg-white p-3 min-[620px]:flex-row min-[620px]:items-center min-[620px]:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <span key={filter} className="rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
                  {filter}
                </span>
              ))}
            </div>
            <Link
              href="/client/rechercher"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[#CAD7F2] bg-white px-3 text-xs font-black text-[#111B4D] transition hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
              Réinitialiser
            </Link>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Recherche</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nom, matière, concours, adulte, technique, art..."
              className={fieldClassName}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Matière</label>
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
              triggerClassName="mt-1.5 h-11 rounded-2xl border-[#E3E8F2] py-2.5 focus:border-[#111B4D] focus:ring-2 focus:ring-[#111B4D]"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Niveau</label>
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
              triggerClassName="mt-1.5 h-11 rounded-2xl border-[#E3E8F2] py-2.5 focus:border-[#111B4D] focus:ring-2 focus:ring-[#111B4D]"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Commune</label>
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
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Format</label>
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
            <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Trier par</label>
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
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#17245F]"
            >
              <Search className="h-4 w-4" />
              Filtrer
            </button>
          </div>
        </div>
      </form>

      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#111827]">
              {formatCount(items.length, "professeur trouvé", "professeurs trouvés")}
            </p>
            <p className="text-xs text-[#64748B]">
              Choisissez un professeur pour ouvrir une réservation directement rattachée à son espace.
              {hasActiveFilters ? " Les résultats respectent vos critères actifs." : " Utilisez les filtres pour préciser votre besoin."}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
            <CalendarCheck className="h-3.5 w-3.5" />
            Séance de 2h
          </span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Aucun professeur ne correspond"
            description="Essayez d'élargir vos critères de recherche."
          />
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((t, index) => (
              <TeacherCard key={`${t.id}-${index}`} teacher={t as any} href={`/client/reserver?teacherId=${t.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
