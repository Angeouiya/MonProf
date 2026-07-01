import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tag } from "lucide-react";
import { MatieresClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminMatieresPage() {
  await requireAdmin();
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Matières" description={`${subjects.length} matière(s)`} />
      {subjects.length === 0 ? (
        <EmptyState icon={Tag} title="Aucune matière" description="Ajoutez votre première matière." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="hidden md:table-cell">Icône</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">{s.name}</TableCell>
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
      )}
      <MatieresClient />
    </div>
  );
}
