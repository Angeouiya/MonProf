import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BookOpen } from "lucide-react";
import { NiveauxClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminNiveauxPage() {
  await requireAdmin();
  const levels = await db.level.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { teachers: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Niveaux" description={`${levels.length} niveau(x)`} />
      {levels.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucun niveau" description="Ajoutez votre premier niveau." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="text-right">Ordre</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm font-medium">{l.name}</TableCell>
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
      )}
      <NiveauxClient />
    </div>
  );
}
