import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { ProfessorImage } from "@/components/shared/professor-image";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, Clock, ExternalLink, Lock, MessageSquare, Phone, UserCog } from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDateTime, timeAgo } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function AdminFondsBloquesPage() {
  await requireAdmin();
  const now = new Date();
  const rawBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: "BLOCKED" }),
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
    },
    take: 200,
  });
  const bookings = rawBookings.filter(hasVerifiedPayDunyaClientPayment);

  const totalBlocked = bookings.reduce((s, b) => s + b.totalPrice, 0);
  const totalNet = bookings.reduce((s, b) => s + b.teacherNetAmount, 0);
  const oldBlocked = bookings.filter((booking) => hoursSince(booking.createdAt, now) >= 48);
  const veryOldBlocked = bookings.filter((booking) => hoursSince(booking.createdAt, now) >= 168);
  const awaitingClient = bookings.filter((booking) => ["COURSE_DONE", "PENDING_CLIENT_VALIDATION"].includes(booking.status));
  const awaitingAdminOrTeacher = bookings.filter((booking) => ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(booking.status));

  return (
    <div className="space-y-5">
      <PageHeader title="Fonds bloqués" description="Paiements clients en attente de validation ou de réalisation du cours" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fonds bloqués (total)" value={formatFCFA(totalBlocked)} icon={Lock} tone="warning" />
        <StatCard label="Net prof correspondant" value={formatFCFA(totalNet)} icon={Banknote} />
        <StatCard label="Réservations concernées" value={bookings.length} icon={Clock} />
        <StatCard label="À prioriser" value={oldBlocked.length} icon={AlertTriangle} tone={oldBlocked.length ? "danger" : "default"} />
      </div>

      {bookings.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <SignalCard
            title="Blocage long"
            value={`${veryOldBlocked.length} dossier${veryOldBlocked.length > 1 ? "s" : ""}`}
            description="Fonds bloqués depuis plus de 7 jours. Vérifier litige, validation client ou décision admin."
            tone={veryOldBlocked.length ? "red" : "blue"}
          />
          <SignalCard
            title="Validation client"
            value={`${awaitingClient.length} cours`}
            description="Cours réalisé ou à valider par le client avant passage en paiement professeur."
            tone={awaitingClient.length ? "amber" : "blue"}
          />
          <SignalCard
            title="Mission à sécuriser"
            value={`${awaitingAdminOrTeacher.length} réservation${awaitingAdminOrTeacher.length > 1 ? "s" : ""}`}
            description="Réservation active : confirmer professeur, horaire, lieu et suivi opérationnel."
            tone={awaitingAdminOrTeacher.length ? "violet" : "blue"}
          />
        </div>
      )}

      <div className="rounded-lg border border-violet-100 bg-violet-50/45 p-4 text-sm text-violet-950/78">
        <p className="font-bold text-violet-950">Règle opérationnelle</p>
        <p className="mt-1">
          Un fonds bloqué doit toujours avoir une cause lisible : cours à venir, cours terminé en attente client,
          litige potentiel ou action admin. Au-delà de 48h sans mouvement, il devient prioritaire.
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon={Lock} title="Aucun fonds bloqué" description="Tous les paiements en attente ont été traités." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {bookings.map((b) => {
              const waitingClient = b.status === "PENDING_CLIENT_VALIDATION";
              const waitingCourse = ["PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS","COURSE_DONE"].includes(b.status);
              const teacherName = b.teacher.professionalName || b.teacher.fullName;
              const risk = getBlockedRisk(b.status, b.createdAt, now);

              return (
                <Card key={b.id} className="border-violet-100 bg-white">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/reservations/${b.id}`} className="block font-mono text-xs font-bold text-primary">
                          {b.reference}
                        </Link>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{b.client.name}</p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${risk.className}`}>{risk.label}</Badge>
                    </div>

                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
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
                          <span className="truncate">{b.subjectName}</span>
                          {b.teacher.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {b.teacher.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {waitingClient ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Validation client</Badge>
                        ) : waitingCourse ? (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Réalisation cours</Badge>
                        ) : (
                          <BookingStatusBadge status={b.status} />
                        )}
                      </div>
                      <p className="mt-2 text-xs font-medium text-blue-950/75">{risk.hint}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Montant client</p>
                        <Money amount={b.totalPrice} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Net professeur</p>
                        <Money amount={b.teacherNetAmount} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="col-span-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Bloqué depuis</p>
                        <p className="mt-1 text-xs font-bold text-foreground" title={formatDateTime(b.createdAt)}>{timeAgo(b.createdAt)}</p>
                      </div>
                    </div>

                    <BlockedActions bookingId={b.id} teacherId={b.teacher.id} compact />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block">
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
                  const risk = getBlockedRisk(b.status, b.createdAt, now);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{b.reference}</Link>
                        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{timeAgo(b.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-sm">{b.client.name}</TableCell>
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
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm font-medium" /></TableCell>
                      <TableCell className="text-right hidden md:table-cell"><Money amount={b.teacherNetAmount} className="text-sm" muted /></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={risk.className}>{risk.label}</Badge>
                          <div>
                            {waitingClient ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Validation client</Badge>
                            ) : waitingCourse ? (
                              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Réalisation cours</Badge>
                            ) : (
                              <BookingStatusBadge status={b.status} />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <BlockedActions bookingId={b.id} teacherId={b.teacher.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function hoursSince(date: Date, now: Date) {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function getBlockedRisk(status: string, createdAt: Date, now: Date) {
  const age = hoursSince(createdAt, now);
  if (age >= 168) {
    return {
      label: "+7 jours",
      hint: "Blocage long : traiter en priorité, vérifier validation client, litige ou décision de paiement.",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (age >= 48) {
    return {
      label: "+48h",
      hint: "Dossier prioritaire : relancer le client ou le professeur selon l'état du cours.",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (["COURSE_DONE", "PENDING_CLIENT_VALIDATION"].includes(status)) {
    return {
      label: "Client à relancer",
      hint: "Le cours semble terminé : demander confirmation client avant libération du paiement.",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  return {
    label: "Suivi normal",
    hint: "Suivre la mission jusqu'à réalisation du cours, puis attendre la validation client.",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  };
}

function SignalCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: "amber" | "blue" | "red" | "violet";
}) {
  const toneClass = {
    amber: "border-amber-100 bg-amber-50/80 text-amber-950",
    blue: "border-blue-100 bg-blue-50/75 text-blue-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
    violet: "border-violet-100 bg-violet-50/75 text-violet-950",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-75">{description}</p>
    </div>
  );
}

function BlockedActions({
  bookingId,
  teacherId,
  compact,
}: {
  bookingId: string;
  teacherId: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap justify-end gap-2"}>
      <Button asChild size="sm" variant="secondary" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/reservations/${bookingId}`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Dossier
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/professeurs/${teacherId}?tab=cours&bookingId=${bookingId}`}>
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Prof
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/reservations/${bookingId}?action=replace`}>
          <UserCog className="mr-1.5 h-4 w-4" />
          Remplacer
        </Link>
      </Button>
    </div>
  );
}
