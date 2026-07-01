import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { formatDateTime, timeAgo } from "@/lib/format";
import { LitigesFiltersClient } from "./filters-client";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN","INVESTIGATING","RESOLVED","REFUNDED","REJECTED"];
const LABELS: Record<string, string> = {
  OPEN: "Ouvert", INVESTIGATING: "Investigation", RESOLVED: "Résolu", REFUNDED: "Remboursé", REJECTED: "Rejeté",
};
const BADGE_CLS: Record<string, string> = {
  OPEN: "border-red-200 bg-red-50 text-red-700",
  INVESTIGATING: "border-amber-200 bg-amber-50 text-amber-700",
  RESOLVED: "border-green-200 bg-green-50 text-green-700",
  REFUNDED: "border-blue-200 bg-blue-50 text-blue-700",
  REJECTED: "border-gray-200 bg-gray-50 text-gray-700",
};

export default async function AdminLitigesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status && STATUSES.includes(sp.status) ? sp.status : undefined;
  const where: any = {};
  if (status) where.status = status;

  const disputes = await db.dispute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      booking: { select: { id: true, reference: true, subjectName: true, totalPrice: true } },
      openedBy: { select: { id: true, name: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Litiges" description={`${disputes.length} litige(s)`} />

      <LitigesFiltersClient status={status ?? ""} />

      {disputes.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Aucun litige" description="Aucun litige ne correspond." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raison</TableHead>
                  <TableHead>Réservation</TableHead>
                  <TableHead className="hidden md:table-cell">Ouvert par</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm font-medium">{d.reason}</TableCell>
                    <TableCell>
                      <Link href={`/admin/reservations/${d.booking.id}`} className="font-mono text-xs text-primary hover:underline">{d.booking.reference}</Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{d.openedBy.name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground" title={formatDateTime(d.createdAt)}>{timeAgo(d.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={BADGE_CLS[d.status]}>{LABELS[d.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/litiges/${d.id}`} className="text-sm text-primary hover:underline">Voir</Link>
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
