import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Star } from "lucide-react";
import { AvisClient } from "./client";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAvisPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const rating = sp.rating ? Number(sp.rating) : undefined;
  const q = sp.q?.trim();

  const where: any = {};
  if (rating && rating >= 1 && rating <= 5) where.rating = rating;
  if (q) {
    where.OR = [
      { comment: { contains: q } },
      { client: { name: { contains: q } } },
      { teacher: { OR: [{ fullName: { contains: q } }, { professionalName: { contains: q } }] } },
    ];
  }

  const reviews = await db.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      booking: { select: { reference: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Avis & notes" description={`${reviews.length} avis`} />
      <AvisClient filters={{ rating: rating ?? 0, q: q ?? "" }} />

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="Aucun avis" description="Aucun avis ne correspond." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="hidden md:table-cell">Commentaire</TableHead>
                  <TableHead className="hidden lg:table-cell">Réservation</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.client.name}</TableCell>
                    <TableCell className="text-sm">{r.teacher.professionalName || r.teacher.fullName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-medium">{r.rating}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm max-w-xs truncate">{r.comment ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm font-mono text-xs">{r.booking.reference}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      {r.published ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Publié</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Masqué</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AvisClient review={{ id: r.id, published: r.published }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
