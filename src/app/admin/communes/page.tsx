import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MapPin } from "lucide-react";
import { CommunesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminCommunesPage() {
  await requireAdmin();
  const communes = await db.commune.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Communes & quartiers" description={`${communes.length} commune(s)`} />
      {communes.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucune commune" description="Ajoutez votre première commune." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Zone</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.zone ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c._count.teachers}</TableCell>
                    <TableCell className="text-right"><CommunesClient commune={c} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <CommunesClient />
    </div>
  );
}
