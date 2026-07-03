import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BadgeCheck, BookOpen, BriefcaseBusiness, Tag } from "lucide-react";
import { getSubjectCategory } from "@/lib/catalog-taxonomy";
import { MatieresClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminMatieresPage() {
  await requireAdmin();
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  const categoryRows = subjects.map((subject) => ({ subject, category: getSubjectCategory(subject.name, subject.icon) }));
  const categoryCounts = categoryRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category.label] = (acc[row.category.label] ?? 0) + 1;
    return acc;
  }, {});
  const activeSubjects = subjects.filter((subject) => subject._count.teachers > 0).length;
  const openSubjects = categoryRows.filter(({ subject, category }) => (
    ["Besoins ouverts", "Concours", "Professionnel", "Technique", "Arts", "Numérique", "Langues", "Santé", "Agro & métiers", "Services"].includes(category.label)
    || /autre|besoin spécifique|adulte|universit|concours|professionnel|technique|santé|agro|service/i.test(subject.name)
  )).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Matières" description={`${subjects.length} matière(s)`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Matières disponibles" value={subjects.length} icon={Tag} tone="primary" />
        <StatCard label="Avec professeurs" value={activeSubjects} icon={BadgeCheck} tone="success" />
        <StatCard label="Offre ouverte" value={openSubjects} icon={BriefcaseBusiness} tone="warning" />
        <StatCard label="Familles couvertes" value={Object.keys(categoryCounts).length} icon={BookOpen} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(categoryCounts).map(([label, count]) => (
          <div key={label} className="rounded-3xl border border-violet-100 bg-violet-50/45 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-950/60">{label}</p>
            <p className="mt-1 text-2xl font-black text-violet-950">{count}</p>
            <p className="mt-1 text-xs text-violet-950/65">matière(s)</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50/55 p-4 text-sm text-blue-950/78">
        <p className="font-bold text-blue-950">Catalogue ouvert</p>
        <p className="mt-1">
          La plateforme couvre le soutien scolaire, l'université, les concours, les adultes, les langues,
          le numérique, la santé, l'agro, les services, les métiers professionnels, les arts et les besoins spécifiques.
          L'admin peut ajouter une matière à la main ou importer le catalogue ouvert.
        </p>
      </div>

      {subjects.length === 0 ? (
        <EmptyState icon={Tag} title="Aucune matière" description="Ajoutez votre première matière." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {categoryRows.map(({ subject: s, category }) => (
                <Card key={s.id} className="border-violet-100 bg-white/92 shadow-sm">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                        <Badge variant="outline" className={category.className}>{category.label}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{s.slug}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Icône : {s.icon ?? "—"}</p>
                      <p className="mt-2 text-xs font-semibold text-violet-800">{s._count.teachers} professeur(s)</p>
                    </div>
                    <MatieresClient subject={s} />
                  </CardContent>
                </Card>
              ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden lg:table-cell">Famille</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="hidden md:table-cell">Icône</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryRows.map(({ subject: s, category }) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className={category.className}>{category.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{s.icon ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{s._count.teachers}</TableCell>
                      <TableCell className="text-right">
                        <MatieresClient subject={s} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
      <MatieresClient />
    </div>
  );
}
