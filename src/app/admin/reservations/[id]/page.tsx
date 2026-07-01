import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, MapPin, Phone, Mail, Clock, Calendar, User, GraduationCap,
  Video, Home, Users, CheckCircle2, XCircle,
} from "lucide-react";
import { BookingActionsClient } from "./actions-client";
import { formatFCFA, formatDateTime, formatDate, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true, commune: true, quartier: true } },
      teacher: {
        select: {
          id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, email: true,
          commune: true, quartier: true, addressHint: true, commissionRate: true,
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { include: { client: { select: { name: true } } } },
      disputes: { include: { openedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) notFound();

  const timeline = [
    { label: "Créée", date: booking.createdAt },
    { label: "Confirmée (admin)", date: booking.confirmedAt },
    { label: "Affectée au prof", date: booking.assignedAt },
    { label: "Cours effectué", date: booking.courseDoneAt },
    { label: "Validée par client", date: booking.clientValidatedAt },
    { label: "Professeur payé", date: booking.teacherPaidAt },
  ].filter((t) => t.date);

  return (
    <div className="space-y-5">
      <PageHeader title={`Réservation ${booking.reference}`} description={`Créée le ${formatDateTime(booking.createdAt)}`}>
        <Button asChild variant="outline">
          <Link href="/admin/reservations"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
        </Button>
      </PageHeader>

      {/* Status header */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
            {booking.paymentMethod && <Badge variant="outline">{booking.paymentMethod.replace("_", " ")}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            {booking.scheduledDate ? (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {formatDate(booking.scheduledDate)} à {booking.scheduledTime || "—"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Créneau souhaité: {booking.preferredTime}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions contextuelles */}
      <BookingActionsClient booking={JSON.parse(JSON.stringify(booking))} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-muted text-foreground">{initials(booking.client.name)}</AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/admin/clients/${booking.client.id}`} className="font-medium text-foreground hover:text-primary">{booking.client.name}</Link>
                <p className="text-xs text-muted-foreground">Client</p>
              </div>
            </div>
            <Separator />
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {booking.client.email}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {booking.client.phone ?? "—"}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {booking.client.commune ?? "—"} {booking.client.quartier ? `• ${booking.client.quartier}` : ""}</p>
          </CardContent>
        </Card>

        {/* Teacher card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Professeur</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">{initials(booking.teacher.fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/admin/professeurs/${booking.teacher.id}`} className="font-medium text-foreground hover:text-primary">{booking.teacher.professionalName || booking.teacher.fullName}</Link>
                <p className="text-xs text-muted-foreground">Professeur</p>
              </div>
            </div>
            <Separator />
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {booking.teacher.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {booking.teacher.email ?? "—"}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {booking.teacher.commune ?? "—"} {booking.teacher.quartier ? `• ${booking.teacher.quartier}` : ""}</p>
            {booking.teacher.addressHint && <p className="text-xs text-muted-foreground">Indice adresse: {booking.teacher.addressHint}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Course details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Détails du cours</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail icon={GraduationCap} label="Matière" value={booking.subjectName} />
          <Detail icon={User} label="Niveau" value={booking.levelName} />
          <Detail icon={booking.courseFormat === "HOME" ? Home : Video} label="Format" value={booking.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
          <Detail icon={Users} label="Type" value={booking.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"} />
          <Detail icon={Calendar} label="Pack" value={booking.packType.replace("_", " ")} />
          <Detail icon={Clock} label="Séances" value={`${booking.sessionsCount}`} />
          <Detail icon={Calendar} label="Jours souhaités" value={(() => { try { return JSON.parse(booking.preferredDays).join(", "); } catch { return booking.preferredDays; } })()} />
          <Detail icon={Clock} label="Horaire souhaité" value={booking.preferredTime} />
          <Detail icon={Calendar} label="Date planifiée" value={booking.scheduledDate ? `${formatDate(booking.scheduledDate)} à ${booking.scheduledTime ?? "—"}` : "Non planifiée"} />
          {booking.commune && <Detail icon={MapPin} label="Commune" value={booking.commune} />}
          {booking.quartier && <Detail icon={MapPin} label="Quartier" value={booking.quartier} />}
          {booking.onlineLink && <Detail icon={Video} label="Lien en ligne" value={booking.onlineLink} />}
          {booking.objective && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Objectif</p>
              <p className="mt-1 text-sm">{booking.objective}</p>
            </div>
          )}
          {booking.message && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Message du client</p>
              <p className="mt-1 text-sm">{booking.message}</p>
            </div>
          )}
          {booking.addressHint && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Indice adresse (cours à domicile)</p>
              <p className="mt-1 text-sm">{booking.addressHint}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Montants */}
      <Card>
        <CardHeader><CardTitle className="text-base">Montants</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <AmountBox label="Total payé par le client" value={booking.totalPrice} />
            <AmountBox label="Commission plateforme" value={booking.commissionAmount} sub={`${booking.commissionRate}%`} tone="warning" />
            <AmountBox label="Net professeur" value={booking.teacherNetAmount} tone="primary" />
            <AmountBox label="Prix unitaire" value={booking.unitPrice} sub={`× ${booking.sessionsCount} séance(s)`} />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Suivi des statuts</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement.</p>
          ) : (
            <ol className="relative border-l border-border pl-6">
              {timeline.map((t, i) => (
                <li key={i} className="mb-4 last:mb-0">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                  </span>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.date)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right hidden md:table-cell">Commission</TableHead>
                <TableHead className="text-right">Net prof</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.transactions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</TableCell></TableRow>
              )}
              {booking.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{t.type}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right"><Money amount={t.amount} className="text-sm" /></TableCell>
                  <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                  <TableCell className="text-right"><Money amount={t.teacherNet} className="text-sm font-medium" /></TableCell>
                  <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Litiges */}
      {booking.disputes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Litiges</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {booking.disputes.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{d.reason}</p>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ouvert par {d.openedBy.name} • {formatDateTime(d.createdAt)}</p>
                {d.resolution && (
                  <p className="mt-2 rounded-md bg-muted/50 p-2 text-sm">Résolution: {d.resolution}</p>
                )}
                <Button asChild size="sm" variant="ghost" className="mt-2">
                  <Link href={`/admin/litiges/${d.id}`}>Voir le litige</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      {booking.reviews.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Avis client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {booking.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{r.client.name} — Note: {r.rating}/5</p>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AmountBox({ label, value, sub, tone = "default" }: { label: string; value: number; sub?: string; tone?: "default" | "warning" | "primary" }) {
  const cls = {
    default: "border-border",
    warning: "border-amber-200 bg-amber-50/50",
    primary: "border-primary/20 bg-primary/5",
  }[tone];
  return (
    <div className={`rounded-lg border ${cls} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground"><Money amount={value} /></p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
