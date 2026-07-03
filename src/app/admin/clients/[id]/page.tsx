import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Bell, ExternalLink, Mail, MapPin, Phone, UserCog } from "lucide-react";
import { formatFCFA, formatDate, formatDateTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const client = await db.user.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
          transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
        },
        take: 100,
      },
    },
  });
  if (!client) notFound();

  const valid = client.bookings.filter(hasVerifiedPayDunyaClientPayment);
  const totalSpent = valid.reduce((s, b) => s + b.totalPrice, 0);
  const totalPaid = valid.filter((b) => b.paymentStatus === "TEACHER_PAID").reduce((s, b) => s + b.totalPrice, 0);
  const totalBlocked = valid.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.totalPrice, 0);
  const actionRequired = valid.filter((b) => ["PENDING_CLIENT_VALIDATION", "DISPUTED"].includes(b.status) || ["BLOCKED", "TO_PAY_TEACHER", "DISPUTED"].includes(b.paymentStatus));

  // Transactions
  const [txs, communications] = await Promise.all([
    db.transaction.findMany({
      where: { booking: { is: verifiedPayDunyaBookingWhere({ clientId: client.id }) } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.clientCommunication.findMany({
      where: { clientId: client.id },
      include: {
        sentBy: { select: { name: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
            teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

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
                <AvatarFallback className="bg-violet-50 text-violet-700">{initials(client.name)}</AvatarFallback>
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
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Cours clôturés</p>
              <p className="mt-1 text-base font-semibold text-blue-700">{formatFCFA(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Actions à suivre</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">{actionRequired.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Messages envoyés</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{communications.length}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {actionRequired.length > 0 && (
        <Card className="border-amber-100 bg-amber-50/45">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="text-sm font-bold text-amber-950">Dossier client à surveiller</p>
                <p className="text-sm text-amber-950/72">
                  {actionRequired.length} réservation(s) demandent un suivi : confirmation client, fonds bloqués, litige ou paiement professeur.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="border-amber-200 bg-white text-amber-800">
              <Link href={`/admin/reservations?clientId=${client.id}`}>Voir réservations</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Réservations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 p-4 md:hidden">
            {client.bookings.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">Aucune réservation.</p>
            ) : (
              client.bookings.map((b) => {
                const teacherName = b.teacher.professionalName || b.teacher.fullName;
                return (
                  <div key={b.id} className="space-y-4 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/reservations/${b.id}`} className="block font-mono text-xs font-bold text-primary">
                          {b.reference}
                        </Link>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{b.subjectName}</p>
                      </div>
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </div>

                    <div className="flex min-w-0 items-center gap-3 rounded-3xl border border-violet-100 bg-violet-50/50 p-3">
                      <ProfessorImage
                        photoUrl={b.teacher.photoUrl}
                        name={teacherName}
                        size="sm"
                        shape="circle"
                        verified={b.teacher.badgeVerified}
                      />
                      <div className="min-w-0">
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`} className="block truncate text-sm font-bold text-foreground">
                          {teacherName}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="truncate">{b.levelName}</span>
                          {b.teacher.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {b.teacher.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                        <Money amount={b.totalPrice} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                        <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <BookingStatusBadge status={b.status} />
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </div>

                    <Button asChild className="h-11 w-full rounded-2xl">
                      <Link href={`/admin/reservations/${b.id}`}>Voir la réservation</Link>
                    </Button>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button asChild variant="outline" className="h-11 rounded-2xl">
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`}>Fiche professeur</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-2xl">
                        <Link href={`/admin/reservations/${b.id}?action=replace`}>Remplacer</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.bookings.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Aucune réservation.</TableCell></TableRow>
              )}
              {client.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-primary hover:underline">{b.reference}</Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <ProfessorImage
                        photoUrl={b.teacher.photoUrl}
                        name={b.teacher.professionalName || b.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={b.teacher.badgeVerified}
                      />
                      <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`} className="hover:text-primary">
                        {b.teacher.professionalName || b.teacher.fullName}
                      </Link>
                    </div>
                    {b.teacher.phone && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {b.teacher.phone}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</TableCell>
                  <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm" /></TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={b.paymentStatus} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={`/admin/reservations/${b.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={`/admin/reservations/${b.id}?action=replace`}><UserCog className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Communications envoyées au client</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {communications.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
              Aucun message opérationnel envoyé à ce client.
            </p>
          ) : (
            communications.map((communication) => {
              const teacher = communication.booking?.teacher;
              const teacherName = teacher?.professionalName || teacher?.fullName || "Professeur à confirmer";
              return (
                <div key={communication.id} className="rounded-3xl border border-violet-100 bg-white/95 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {teacher ? (
                        <ProfessorImage photoUrl={teacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={teacher.badgeVerified} />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-700">
                          <Bell className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{communication.subject}</p>
                          <Badge variant="outline" className="border-violet-100 bg-violet-50 text-violet-800">{communication.type}</Badge>
                          <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">{communication.channel}</Badge>
                        </div>
                        {communication.booking && (
                          <p className="mt-1 text-xs font-medium text-foreground">
                            {communication.booking.reference} · {communication.booking.subjectName} · {teacherName}
                            {teacher?.phone ? ` · ${teacher.phone}` : ""}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(communication.createdAt)}
                          {communication.sentBy?.name ? ` · envoyé par ${communication.sentBy.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {communication.booking && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/reservations/${communication.booking.id}`}>
                            Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      {teacher && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={communication.booking ? `/admin/professeurs/${teacher.id}?tab=cours&bookingId=${communication.booking.id}` : `/admin/professeurs/${teacher.id}?tab=historique`}>
                            Professeur <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-line rounded-2xl border border-violet-100 bg-violet-50/35 p-3 text-sm text-foreground">
                    {communication.content}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique paiements</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 p-4 md:hidden">
            {txs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">Aucune transaction.</p>
            ) : (
              txs.map((t) => (
                <div key={t.id} className="rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-primary">{t.reference}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{t.type}</p>
                    </div>
                    <PaymentStatusBadge status={t.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                      <Money amount={t.amount} className="mt-1 text-xs font-black" />
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                      <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
