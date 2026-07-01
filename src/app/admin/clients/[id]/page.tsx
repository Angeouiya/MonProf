import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { formatFCFA, formatDate, formatDateTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const client = await db.user.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { teacher: { select: { id: true, fullName: true, professionalName: true } } },
        take: 100,
      },
    },
  });
  if (!client) notFound();

  const valid = client.bookings.filter((b) => b.paymentStatus !== "FAILED");
  const totalSpent = valid.reduce((s, b) => s + b.totalPrice, 0);
  const totalPaid = client.bookings.filter((b) => b.paymentStatus === "TEACHER_PAID").reduce((s, b) => s + b.totalPrice, 0);
  const totalBlocked = client.bookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.totalPrice, 0);

  // Transactions
  const txs = await db.transaction.findMany({
    where: { booking: { clientId: client.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-5">
      <PageHeader title={client.name} description={client.email}>
        <Button asChild variant="outline">
          <Link href="/admin/clients"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-muted">{initials(client.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{client.name}</p>
                <p className="text-xs text-muted-foreground">Client depuis {formatDate(client.createdAt)}</p>
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {client.email}</p>
              <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {client.phone ?? "—"}</p>
              <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {client.commune ?? "—"} {client.quartier ? `• ${client.quartier}` : ""}</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Réservations</p>
              <p className="mt-1 text-2xl font-semibold">{client.bookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total dépensé</p>
              <p className="mt-1 text-base font-semibold">{formatFCFA(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Fonds bloqués</p>
              <p className="mt-1 text-base font-semibold text-amber-600">{formatFCFA(totalBlocked)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Réservations</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead className="hidden md:table-cell">Matière</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.bookings.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune réservation.</TableCell></TableRow>
              )}
              {client.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-primary hover:underline">{b.reference}</Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/admin/professeurs/${b.teacher.id}`} className="hover:text-primary">
                      {b.teacher.professionalName || b.teacher.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</TableCell>
                  <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm" /></TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={b.paymentStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique paiements</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</TableCell></TableRow>
              )}
              {txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{t.type}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell className="text-right"><Money amount={t.amount} className="text-sm" /></TableCell>
                  <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
