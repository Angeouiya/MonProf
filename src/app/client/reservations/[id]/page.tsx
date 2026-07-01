import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime, avatarFromName } from "@/lib/format";
import {
  Home, Video, User, Users, Calendar, Clock, MapPin, MessageSquare,
  CheckCircle2, Circle, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { BookingActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string; paid?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const sp = await searchParams;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, phone: true },
      },
      transactions: { orderBy: { createdAt: "asc" } },
      reviews: { where: { clientId: user.id } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking || booking.clientId !== user.id) notFound();

  const name = booking.teacher.professionalName || booking.teacher.fullName;
  const preferredDays: string[] = booking.preferredDays ? JSON.parse(booking.preferredDays) : [];

  // Timeline
  const timeline = [
    { label: "Réservation créée", date: booking.createdAt, done: true },
    { label: "Paiement reçu", date: booking.createdAt, done: booking.paymentStatus !== "FAILED" },
    { label: "Validée par l'admin", date: booking.confirmedAt, done: !!booking.confirmedAt || ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Cours effectué", date: booking.courseDoneAt, done: !!booking.courseDoneAt || ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Confirmé par le client", date: booking.clientValidatedAt, done: !!booking.clientValidatedAt || ["VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Professeur payé", date: booking.teacherPaidAt, done: booking.status === "TEACHER_PAID" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/client/reservations"><ArrowLeft className="mr-1 h-4 w-4" /> Retour</Link>
        </Button>
        <PageHeader
          title={`Réservation ${booking.reference}`}
          description={`Créée le ${formatDateTime(booking.createdAt)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        </PageHeader>
      </div>

      {sp.paid && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Paiement réussi</p>
            <p className="text-muted-foreground">
              Votre paiement de <strong className="text-foreground"><Money amount={booking.totalPrice} /></strong> a été reçu
              et est gardé bloqué jusqu'à la confirmation du cours. L'administrateur valide votre réservation prochainement.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche : détails */}
        <div className="space-y-4 lg:col-span-2">
          {/* Carte prof */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {booking.teacher.photoUrl ? (
                    <Image src={booking.teacher.photoUrl} alt={name} fill className="object-cover" />
                  ) : (
                    <img src={avatarFromName(name)} alt={name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{booking.teacher.jobTitle}</p>
                  <p className="text-xs text-muted-foreground">{booking.teacher.commune ?? "Abidjan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Détails cours */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Détails du cours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow icon={null} label="Matière" value={booking.subjectName} />
                <DetailRow icon={null} label="Niveau" value={booking.levelName} />
                <DetailRow
                  icon={booking.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  label="Format"
                  value={booking.courseFormat === "HOME" ? "À domicile" : "En ligne"}
                />
                <DetailRow
                  icon={booking.groupType === "INDIVIDUAL" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  label="Type"
                  value={booking.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"}
                />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Date prévue" value={booking.scheduledDate ? formatDate(booking.scheduledDate) : "À planifier"} />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Créneau" value={booking.scheduledTime || booking.preferredTime || "—"} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Jours souhaités" value={preferredDays.length ? preferredDays.join(", ") : "—"} />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Formule" value={booking.packType === "SINGLE" ? "1 séance" : booking.packType.replace("_", " ")} />
              </div>

              {booking.courseFormat === "HOME" && (
                <>
                  <Separator />
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Lieu" value={[booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(", ") || "Non précisé"} />
                </>
              )}
              {booking.courseFormat === "ONLINE" && booking.onlineLink && (
                <>
                  <Separator />
                  <DetailRow icon={<Video className="h-4 w-4" />} label="Lien" value={booking.onlineLink} />
                </>
              )}

              {booking.objective && (
                <>
                  <Separator />
                  <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Objectif" value={booking.objective} />
                </>
              )}
              {booking.message && (
                <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Message" value={booking.message} />
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Suivi de la réservation</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 pl-6">
                <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[1.4rem] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-background ${
                      t.done ? "bg-primary" : "bg-muted border border-border"
                    }`}>
                      {t.done && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${t.done ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</p>
                      {t.date && t.done && (
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Transactions */}
          {booking.transactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Historique des transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {booking.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{tx.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.type === "CLIENT_PAYMENT" ? "Paiement client" :
                          tx.type === "TEACHER_PAYOUT" ? "Versement professeur" :
                          tx.type === "REFUND" ? "Remboursement" : tx.type}
                        {" • "}{formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground"><Money amount={tx.amount} /></p>
                      <PaymentStatusBadge status={tx.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite : montants + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prix unitaire</span>
                <span className="tabular-nums text-foreground"><Money amount={booking.unitPrice} /></span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span className="text-foreground">Total payé</span>
                <span className="tabular-nums text-primary"><Money amount={booking.totalPrice} /></span>
              </div>
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Commission ({booking.commissionRate}%)</span>
                <span className="tabular-nums"><Money amount={booking.commissionAmount} /></span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Net professeur</span>
                <span className="tabular-nums"><Money amount={booking.teacherNetAmount} /></span>
              </div>
            </CardContent>
          </Card>

          <BookingActions booking={booking as any} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}
