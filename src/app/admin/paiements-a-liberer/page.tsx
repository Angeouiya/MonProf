import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Banknote, Unlock, Clock } from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDate, timeAgo } from "@/lib/format";
import { PayTeacherButton } from "./pay-button";

export const dynamic = "force-dynamic";

export default async function AdminPaiementsALibererPage() {
  await requireAdmin();
  const bookings = await db.booking.findMany({
    where: { paymentStatus: "TO_PAY_TEACHER" },
    orderBy: { clientValidatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
    },
    take: 200,
  });

  const totalNet = bookings.reduce((s, b) => s + b.teacherNetAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Paiements à libérer" description="Réservations validées par le client, prêtes à payer au professeur" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Net total à payer" value={formatFCFA(totalNet)} icon={Banknote} tone="primary" />
        <StatCard label="Réservations à payer" value={bookings.length} icon={Clock} tone="warning" />
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon={Unlock} title="Aucun paiement à libérer" description="Aucune réservation n'attend un paiement professeur." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden lg:table-cell">Validé le</TableHead>
                  <TableHead className="text-right">Net à payer</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{b.reference}</Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/admin/professeurs/${b.teacher.id}`} className="hover:text-primary">
                        {b.teacher.professionalName || b.teacher.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{b.client.name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {b.clientValidatedAt ? `${formatDate(b.clientValidatedAt)} (${timeAgo(b.clientValidatedAt)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right"><Money amount={b.teacherNetAmount} className="text-sm font-semibold" /></TableCell>
                    <TableCell className="text-right">
                      <PayTeacherButton bookingId={b.id} amount={b.teacherNetAmount} teacherName={b.teacher.professionalName || b.teacher.fullName} />
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
