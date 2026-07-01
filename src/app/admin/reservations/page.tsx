import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarRange, Eye } from "lucide-react";
import Link from "next/link";
import { ReservationsListClient } from "./list-client";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_BOOKING_STATUSES = [
  "PENDING_PAYMENT","PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS",
  "COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE",
  "TEACHER_PAID","DISPUTED","CANCELLED","REFUNDED",
];
const VALID_PAYMENT_STATUSES = ["FAILED","RECEIVED","BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID","DISPUTED","REFUNDED"];

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; payment?: string; teacherId?: string; clientId?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status && VALID_BOOKING_STATUSES.includes(sp.status) ? sp.status as any : undefined;
  const payment = sp.payment && VALID_PAYMENT_STATUSES.includes(sp.payment) ? sp.payment as any : undefined;
  const teacherId = sp.teacherId || undefined;
  const clientId = sp.clientId || undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { subjectName: { contains: q } },
      { client: { name: { contains: q } } },
      { teacher: { OR: [{ fullName: { contains: q } }, { professionalName: { contains: q } }] } },
    ];
  }
  if (status) where.status = status;
  if (payment) where.paymentStatus = payment;
  if (teacherId) where.teacherId = teacherId;
  if (clientId) where.clientId = clientId;

  const [bookings, teachers] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true, professionalName: true } },
      },
      take: 200,
    }),
    db.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, professionalName: true } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Réservations" description={`${bookings.length} réservation(s)`} />

      <ReservationsListClient
        filters={{
          q: q ?? "", status: status ?? "", payment: payment ?? "",
          teacherId: teacherId ?? "", clientId: clientId ?? "",
        }}
        teachers={teachers.map((t) => ({ id: t.id, name: t.professionalName || t.fullName }))}
      />

      {bookings.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Aucune réservation" description="Aucune réservation ne correspond à vos filtres." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Matière</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/admin/reservations/${b.id}`} className="text-sm font-mono font-medium text-primary hover:underline">{b.reference}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/clients/${b.client.id}`} className="text-sm hover:text-primary">{b.client.name}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/professeurs/${b.teacher.id}`} className="text-sm hover:text-primary">
                        {b.teacher.professionalName || b.teacher.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</TableCell>
                    <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm" /></TableCell>
                    <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                    <TableCell><PaymentStatusBadge status={b.paymentStatus} /></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/reservations/${b.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
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
