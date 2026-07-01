import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Home as HomeIcon,
  Video,
  X,
  SearchX,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { TeacherCard } from "@/components/shared/teacher-card";
import { EmptyState } from "@/components/shared/page-header";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = {
  subject?: string;
  level?: string;
  commune?: string;
  format?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 12;

const SORTS = [
  { value: "recommended", label: "Recommandés" },
  { value: "rating", label: "Mieux notés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "experience", label: "Plus expérimentés" },
];

const FORMATS = [
  { value: "", label: "Tous formats" },
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
  const minPrice = sp.minPrice ? Number(sp.minPrice) || undefined : undefined;
  const maxPrice = sp.maxPrice ? Number(sp.maxPrice) || undefined : undefined;
  const sort = sp.sort?.trim() || "recommended";
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);

  // Build where clause (same logic as /api/teachers)
  const where: any = { status: "ACTIVE" };
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
  if (minPrice || maxPrice) {
    where.pricePerSession = {};
    if (minPrice) where.pricePerSession.gte = minPrice;
    if (maxPrice) where.pricePerSession.lte = maxPrice;
  }

  let orderBy: any;
  switch (sort) {
    case "rating":
      orderBy = { rating: "desc" };
      break;
    case "price-asc":
      orderBy = { pricePerSession: "asc" };
      break;
    case "price-desc":
      orderBy = { pricePerSession: "desc" };
      break;
    case "experience":
      orderBy = { experienceYears: "desc" };
      break;
    case "recommended":
    default:
      orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }];
      break;
  }

  const [total, teachers, subjects, levels, communes] = await Promise.all([
    db.teacher.count({ where }),
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
    experienceYears: t.experienceYears,
    pricePerSession: t.pricePerSession,
    pricePack4: t.pricePack4,
    pricePack8: t.pricePack8,
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
    if (minPrice) params.set("minPrice", String(minPrice));
    if (maxPrice) params.set("maxPrice", String(maxPrice));
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
    minPrice ? String(minPrice) : "",
    maxPrice ? String(maxPrice) : "",
    q,
  ].filter(Boolean).length;

  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-3 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Professeurs</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Trouvez votre professeur vérifié
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Filtrez par matière, niveau, commune et format. Paiement sécurisé,
            professeurs vérifiés.
          </p>

          {/* Barre de recherche texte */}
          <form method="GET" action="/professeurs" className="mt-5 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Rechercher par nom, matière, spécialité..."
              className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {/* Préserve les autres filtres */}
            {subject && <input type="hidden" name="subject" value={subject} />}
            {level && <input type="hidden" name="level" value={level} />}
            {commune && <input type="hidden" name="commune" value={commune} />}
            {format && <input type="hidden" name="format" value={format} />}
            {minPrice && <input type="hidden" name="minPrice" value={minPrice} />}
            {maxPrice && <input type="hidden" name="maxPrice" value={maxPrice} />}
            {sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Rechercher
            </button>
            {q && (
              <Link
                href={buildPaginationUrl(1)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-3 text-sm text-muted-foreground transition hover:bg-muted"
                title="Réinitialiser la recherche"
              >
                <X className="h-4 w-4" />
              </Link>
            )}
          </form>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* SIDEBAR FILTRES */}
            <aside className="lg:sticky lg:top-20 lg:h-fit">
              <form
                method="GET"
                action="/professeurs"
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Filter className="h-4 w-4 text-primary" />
                    Filtres
                  </h2>
                  {activeFiltersCount > 0 && (
                    <Link
                      href="/professeurs"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Réinitialiser ({activeFiltersCount})
                    </Link>
                  )}
                </div>

                <div className="space-y-4">
                  <Field label="Matière">
                    <select
                      name="subject"
                      defaultValue={subject}
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Toutes les matières</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Niveau">
                    <select
                      name="level"
                      defaultValue={level}
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Tous les niveaux</option>
                      {levels.map((l) => (
                        <option key={l.id} value={l.slug}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Commune">
                    <select
                      name="commune"
                      defaultValue={commune}
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Toutes les communes</option>
                      {communes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Format">
                    <div className="grid grid-cols-3 gap-1.5">
                      {FORMATS.map((f) => (
                        <label
                          key={f.value || "all"}
                          className={`flex h-9 cursor-pointer items-center justify-center rounded-md border text-xs font-medium transition ${
                            format === f.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-white text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <input
                            type="radio"
                            name="format"
                            value={f.value}
                            defaultChecked={format === f.value}
                            className="sr-only"
                          />
                          <span className="truncate px-1">{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field label="Prix par séance (FCFA)">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        name="minPrice"
                        min={0}
                        step={500}
                        defaultValue={minPrice ?? ""}
                        placeholder="Min"
                        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="text-muted-foreground">—</span>
                      <input
                        type="number"
                        name="maxPrice"
                        min={0}
                        step={500}
                        defaultValue={maxPrice ?? ""}
                        placeholder="Max"
                        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </Field>

                  <Field label="Trier par">
                    <select
                      name="sort"
                      defaultValue={sort}
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {SORTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Préserve la recherche texte */}
                  {q && <input type="hidden" name="q" value={q} />}

                  <button
                    type="submit"
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    Appliquer les filtres
                  </button>
                </div>
              </form>
            </aside>

            {/* RÉSULTATS */}
            <div>
              <div className="mb-5 flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{total}</span>{" "}
                  professeur{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
                  {subject || level || commune || format ? (
                    <span className="ml-1 text-muted-foreground">
                      · filtres actifs
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {format === "HOME" && (
                    <BadgeFilter icon={<HomeIcon className="h-3 w-3" />} label="Domicile" />
                  )}
                  {format === "ONLINE" && (
                    <BadgeFilter icon={<Video className="h-3 w-3" />} label="En ligne" />
                  )}
                </div>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Aucun professeur ne correspond à vos critères"
                  description="Essayez d'élargir vos filtres (niveau, commune, prix) ou réinitialisez la recherche."
                  action={
                    <Link
                      href="/professeurs"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Réinitialiser les filtres
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                    {items.map((t) => (
                      <TeacherCard key={t.id} teacher={t as any} />
                    ))}
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                      <Link
                        href={buildPaginationUrl(Math.max(1, page - 1))}
                        aria-disabled={page === 1}
                        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm font-medium transition ${
                          page === 1
                            ? "pointer-events-none border-border bg-muted text-muted-foreground/50"
                            : "border-border bg-white text-foreground hover:bg-muted"
                        }`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Précédent
                      </Link>
                      <span className="px-3 text-sm text-muted-foreground">
                        Page <span className="font-semibold text-foreground">{page}</span> sur {totalPages}
                      </span>
                      <Link
                        href={buildPaginationUrl(Math.min(totalPages, page + 1))}
                        aria-disabled={page === totalPages}
                        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm font-medium transition ${
                          page === totalPages
                            ? "pointer-events-none border-border bg-muted text-muted-foreground/50"
                            : "border-border bg-white text-foreground hover:bg-muted"
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
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function BadgeFilter({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {icon}
      {label}
    </span>
  );
}
