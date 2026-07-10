import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BadgeCheck, BookOpen, GraduationCap, Users } from "lucide-react";
import { getLevelCategory } from "@/lib/catalog-taxonomy";
import { NiveauxClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminNiveauxPage() {
  await requireAdmin("CATALOG_MANAGE");
  const levels = await db.level.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  const levelRows = levels.map((level) => ({ level, category: getLevelCategory(level.name, level.order) }));
  const categoryCounts = levelRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category.label] = (acc[row.category.label] ?? 0) + 1;
    return acc;
  }, {});
  const activeLevels = levels.filter((level) => level._count.teachers > 0).length;
  const adultAndConcours = levelRows.filter((row) => ["Adultes", "Concours", "Supérieur"].includes(row.category.label)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Niveaux" description={`${levels.length} niveau(x)`} rootPage />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Niveaux disponibles" value={levels.length} icon={BookOpen} tone="primary" />
        <StatCard label="Avec professeurs" value={activeLevels} icon={BadgeCheck} tone="success" />
        <StatCard label="Adultes / concours / supérieur" value={adultAndConcours} icon={GraduationCap} tone="warning" />
        <StatCard label="Familles couvertes" value={Object.keys(categoryCounts).length} icon={Users} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(categoryCounts).map(([label, count]) => (
          <div key={label} className="rounded-lg border border-violet-100 bg-violet-50/45 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-950/60">{label}</p>
            <p className="mt-1 text-2xl font-black text-violet-950">{count}</p>
            <p className="mt-1 text-xs text-violet-950/65">niveau(x)</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/55 p-4 text-sm text-amber-950/80">
        <p className="font-bold text-amber-950">Parcours ouvert</p>
        <p className="mt-1">
          Les niveaux ne sont pas limités au primaire/collège/lycée : l'admin peut gérer l'université, la formation professionnelle,
          les adultes, l'alphabétisation, les concours et les tests internationaux.
        </p>
      </div>

      {levels.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucun niveau" description="Ajoutez votre premier niveau." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {levelRows.map(({ level: l, category }) => (
                <Card key={l.id} className="border-violet-100 bg-white">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{l.name}</p>
                        <Badge variant="outline" className={category.className}>{category.label}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{l.slug}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-violet-800">
                        <span>Ordre {l.order}</span>
                        <span>{l._count.teachers} professeur(s)</span>
                      </div>
                    </div>
                    <NiveauxClient level={l} />
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
                  <TableHead className="text-right">Ordre</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levelRows.map(({ level: l, category }) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm font-medium">{l.name}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className={category.className}>{category.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{l.slug}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{l.order}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{l._count.teachers}</TableCell>
                      <TableCell className="text-right"><NiveauxClient level={l} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
      <NiveauxClient />
    </div>
  );
}
