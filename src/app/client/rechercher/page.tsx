import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { TeacherCard } from "@/components/shared/teacher-card";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

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

  let orderBy: any;
  switch (sort) {
    case "rating": orderBy = { rating: "desc" }; break;
    case "price-asc": orderBy = { pricePerSession: "asc" }; break;
    case "price-desc": orderBy = { pricePerSession: "desc" }; break;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rechercher un professeur"
        description="Trouvez le professeur vérifié qui correspond à votre besoin, puis réservez en quelques clics."
      />

      <form className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Recherche</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nom, matière, spécialité..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Matière</label>
            <select
              name="subject"
              defaultValue={subject ?? ""}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Toutes</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Niveau</label>
            <select
              name="level"
              defaultValue={level ?? ""}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tous</option>
              {levels.map((l) => (
                <option key={l.id} value={l.slug}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Commune</label>
            <select
              name="commune"
              defaultValue={commune ?? ""}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Toutes</option>
              {communes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Format</label>
            <select
              name="format"
              defaultValue={format ?? ""}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tous</option>
              <option value="HOME">À domicile</option>
              <option value="ONLINE">En ligne</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Trier par</label>
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="recommended">Recommandés</option>
              <option value="rating">Mieux notés</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="experience">Expérience</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
              Filtrer
            </button>
          </div>
        </div>
      </form>

      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          {items.length} professeur{items.length > 1 ? "s" : ""} trouvé{items.length > 1 ? "s" : ""}
        </p>
        {items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Aucun professeur ne correspond"
            description="Essayez d'élargir vos critères de recherche."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((t) => (
              <TeacherCard key={t.id} teacher={t as any} href={`/client/reserver?teacherId=${t.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
