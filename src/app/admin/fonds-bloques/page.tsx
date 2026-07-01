import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Lock, Clock, Banknote } from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDateTime, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminFondsBloquesPage() {
  await requireAdmin();
  const bookings = await db.booking.findMany({
    where: { paymentStatus: "BLOCKED" },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
    },
    take: 200,
  });

  const totalBlocked = bookings.reduce((s, b) => s + b.totalPrice, 0);
  const totalNet = bookings.reduce((s, b) => s + b.teacherNetAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Fonds bloqués" description="Paiements clients en attente de validation ou de réalisation du cours" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Fonds bloqués (total)" value={formatFCFA(totalBlocked)} icon={Lock} tone="warning" />
        <StatCard label="Net prof correspondant" value={formatFCFA(totalNet)} icon={Banknote} />
        <StatCard label="Réservations concernées" value={bookings.length} icon={Clock} />
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon={Lock} title="Aucun fonds bloqué" description="Tous les paiements en attente ont été traités." />
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
                  <TableHead className="hidden lg:table-cell">Date paiement</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Net prof</TableHead>
                  <TableHead>Attente</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const waitingClient = b.status === "PENDING_CLIENT_VALIDATION";
                  const waitingCourse = ["PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS","COURSE_DONE"].includes(b.status);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{b.reference}</Link>
                      </TableCell>
                      <TableCell className="text-sm">{b.client.name}</TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/admin/professeurs/${b.teacher.id}`} className="hover:text-primary">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm font-medium" /></TableCell>
                      <TableCell className="text-right hidden md:table-cell"><Money amount={b.teacherNetAmount} className="text-sm" muted /></TableCell>
                      <TableCell>
                        {waitingClient ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Validation client</Badge>
                        ) : waitingCourse ? (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Réalisation cours</Badge>
                        ) : (
                          <Badge variant="outline">{b.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/reservations/${b.id}`}>Détails</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
