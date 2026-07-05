import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { OperationalAlertCard, TeacherStatusBadge } from "@/components/admin/teacher-operational-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Banknote, ClipboardCheck, GraduationCap, Link2, ShieldAlert } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";
import { missionStatusLabel } from "@/lib/platform-labels";
import { verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { ReminderScanButton } from "./reminder-scan-button";
import { OperationalPaymentActionsClient, OperationalTeacherActionsClient } from "./operational-quick-actions-client";

export const dynamic = "force-dynamic";

const teacherStatuses = new Set([
  "ACTIVE",
  "INACTIVE",
  "PENDING",
  "SUSPENDED",
  "TEMPORARILY_SUSPENDED",
  "PERMANENTLY_SUSPENDED",
  "OBSERVATION",
  "REPLACEABLE",
  "PRIORITY",
  "BLACKLISTED",
]);

const imminentBookingStatuses = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;

function parseCourseStartDate(scheduledDate: Date | null, scheduledTime: string | null, preferredTime: string | null) {
  if (!scheduledDate) return null;
  const source = scheduledTime || preferredTime || "";
  const match = source.match(/(\d{1,2})(?:\s*h|:)?\s*(\d{2})?/i);
  const start = new Date(scheduledDate);
  if (match) {
    start.setHours(Number(match[1]), Number(match[2] ?? 0), 0, 0);
  }
  return start;
}

function hasTeacherConfirmation(booking: { assignedAt: Date | null; missionLinks?: { status: string }[]; teacherTasks?: { status: string }[] }) {
  return Boolean(booking.assignedAt)
    || Boolean(booking.missionLinks?.some((mission) => mission.status === "CONFIRMED"))
    || Boolean(booking.teacherTasks?.some((task) => ["CONFIRMED", "DONE"].includes(task.status)));
}

export default async function CentreOperationnelPage() {
  await requireAdmin();
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [
    urgentTasks,
    pendingBookings,
    confirmationTasks,
    blockedPayments,
    sanctions,
    suspendedTeachers,
    disputedBookings,
    missionAlerts,
  ] = await Promise.all([
    db.teacherTask.findMany({
      where: { status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] }, priority: { in: ["URGENT", "CRITICAL"] } },
      include: { teacher: true, booking: true },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 12,
    }),
    db.booking.findMany({
      where: { status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"] } },
      include: { client: { select: { name: true } }, teacher: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    db.teacherTask.findMany({
      where: {
        type: "CONFIRM_AVAILABILITY",
        status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
      },
      include: { teacher: true, booking: true },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      take: 16,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: ["BLOCKED", "TO_PAY_TEACHER", "DISPUTED"] } }),
      include: { client: { select: { name: true } }, teacher: true },
      orderBy: { updatedAt: "asc" },
      take: 12,
    }),
    db.teacherSanction.findMany({
      where: { status: "PENDING_VALIDATION" },
      include: { teacher: true, booking: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    db.teacher.findMany({
      where: { status: { in: ["TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "SUSPENDED", "OBSERVATION", "BLACKLISTED"] } },
      include: { _count: { select: { bookings: true } } },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    db.booking.findMany({
      where: { status: "DISPUTED" },
      include: { client: { select: { name: true } }, teacher: true },
      orderBy: { updatedAt: "asc" },
      take: 12,
    }),
    db.teacherMissionLink.findMany({
      where: { status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED", "REPLACEMENT_RECOMMENDED", "EXPIRED"] } },
      include: {
        teacher: true,
        booking: { include: { client: { select: { name: true } } } },
      },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      take: 16,
    }),
  ]);

  const replacementRecommended = missionAlerts.filter((mission) => mission.status === "REPLACEMENT_RECOMMENDED").length;

  const courseSoonCandidates = await db.booking.findMany({
    where: {
      scheduledDate: { gte: todayStart, lte: tomorrowEnd },
      status: { in: [...imminentBookingStatuses] as any },
    },
    include: {
      client: { select: { name: true } },
      teacher: true,
      missionLinks: {
        where: { status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED", "CONFIRMED", "REPLACEMENT_RECOMMENDED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      teacherTasks: {
        where: { type: "CONFIRM_AVAILABILITY", status: { in: ["TODO", "SENT_TO_TEACHER", "CONFIRMED", "DONE", "LATE"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { scheduledDate: "asc" },
    take: 80,
  });
  const coursesSoon = courseSoonCandidates
    .flatMap((booking) => {
      const courseStart = parseCourseStartDate(booking.scheduledDate, booking.scheduledTime, booking.preferredTime);
      if (!courseStart || courseStart < now || courseStart > soon) return [];
      return [{
        ...booking,
        courseStart,
        teacherConfirmed: hasTeacherConfirmation(booking),
      }];
    })
    .sort((a, b) => a.courseStart.getTime() - b.courseStart.getTime())
    .slice(0, 12);
  const unconfirmedCoursesSoon = coursesSoon.filter((booking) => !booking.teacherConfirmed);

  return (
    <div className="space-y-5">
      <PageHeader title="Centre opérationnel" description="Actions rapides, urgences, remplacements, paiements et qualité professeur.">
        <ReminderScanButton />
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <OperationalAlertCard title={`${urgentTasks.length} tâches urgentes`} description="Tâches critiques ou urgentes à traiter avant impact client." tone={urgentTasks.length ? "red" : "blue"} />
        <OperationalAlertCard title={`${confirmationTasks.length} confirmations prof`} description="Professeurs qui doivent confirmer une réservation client." tone={confirmationTasks.length ? "amber" : "blue"} />
        <OperationalAlertCard title={`${unconfirmedCoursesSoon.length} cours <2h non confirmés`} description="Cours imminents sans confirmation professeur exploitable." tone={unconfirmedCoursesSoon.length ? "red" : "blue"} />
        <OperationalAlertCard title={`${pendingBookings.length} réservations à confirmer`} description="Réservations payées ou confirmées nécessitant une action admin." tone={pendingBookings.length ? "amber" : "blue"} />
        <OperationalAlertCard title={`${replacementRecommended} remplacements recommandés`} description="Missions sans confirmation professeur après relance ou délai critique." tone={replacementRecommended ? "red" : "violet"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OpsCard title="Urgences professeur" icon={AlertTriangle}>
          {urgentTasks.length === 0 ? <EmptyLine label="Aucune urgence professeur." /> : urgentTasks.map((task) => (
            <TeacherLine
              key={task.id}
              teacher={task.teacher}
              meta={`${task.priority} - ${task.title}`}
              badge={task.status}
              booking={task.booking}
            />
          ))}
        </OpsCard>

        <OpsCard title="Confirmations professeur à relancer" icon={ClipboardCheck}>
          {confirmationTasks.length === 0 ? <EmptyLine label="Aucune confirmation professeur en attente." /> : confirmationTasks.map((task) => {
            const bookingLabel = task.booking ? `${task.booking.reference} - ${task.booking.subjectName}` : "Réservation non liée";
            const dueLabel = task.dueAt ? `échéance ${formatDateTime(task.dueAt)}` : "sans échéance";
            return (
              <TeacherLine
                key={task.id}
                teacher={task.teacher}
                meta={`${bookingLabel} · ${dueLabel}`}
                badge={task.status}
                booking={task.booking}
                actionHref={task.bookingId ? `/admin/professeurs/${task.teacherId}?tab=cours&bookingId=${task.bookingId}` : `/admin/professeurs/${task.teacherId}?tab=taches`}
              />
            );
          })}
        </OpsCard>

        <OpsCard title="Cours dans moins de 2h" icon={GraduationCap}>
          {coursesSoon.length === 0 ? <EmptyLine label="Aucun cours imminent sans suivi." /> : coursesSoon.map((booking) => (
            <BookingLine
              key={booking.id}
              booking={booking}
              courseStart={booking.courseStart}
              teacherConfirmed={booking.teacherConfirmed}
            />
          ))}
        </OpsCard>

        <OpsCard title="Missions professeur à confirmer" icon={Link2}>
          {missionAlerts.length === 0 ? <EmptyLine label="Aucune mission privée en attente." /> : missionAlerts.map((mission) => (
            <MissionLine key={mission.id} mission={mission} />
          ))}
        </OpsCard>

        <OpsCard title="À confirmer" icon={ClipboardCheck}>
          {pendingBookings.length === 0 ? <EmptyLine label="Aucune réservation en attente." /> : pendingBookings.map((booking) => (
            <BookingLine key={booking.id} booking={booking} />
          ))}
        </OpsCard>

        <OpsCard title="Paiements & fonds" icon={Banknote}>
          {blockedPayments.length === 0 ? <EmptyLine label="Aucun paiement urgent." /> : blockedPayments.map((booking) => (
            <BookingLine key={booking.id} booking={booking} payment />
          ))}
        </OpsCard>

        <OpsCard title="Sanctions à valider" icon={ShieldAlert}>
          {sanctions.length === 0 ? <EmptyLine label="Aucune sanction en attente." /> : sanctions.map((sanction) => (
            <TeacherLine
              key={sanction.id}
              teacher={sanction.teacher}
              meta={`${sanction.type} - ${sanction.reason}`}
              badge={sanction.status}
              booking={sanction.booking}
              actionHref={`/admin/professeurs/${sanction.teacherId}?tab=discipline`}
            />
          ))}
        </OpsCard>

        <OpsCard title="Professeurs sous surveillance" icon={ShieldAlert}>
          {suspendedTeachers.length === 0 ? <EmptyLine label="Aucun professeur en observation ou suspension." /> : suspendedTeachers.map((teacher) => (
            <TeacherLine key={teacher.id} teacher={teacher} meta={`${teacher._count.bookings} cours liés`} badge={teacher.status} />
          ))}
        </OpsCard>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Litiges critiques</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 p-4 md:hidden">
            {disputedBookings.length === 0 ? (
              <p className="rounded-2xl border border-violet-100 bg-white p-3 text-sm text-muted-foreground">Aucun litige ouvert.</p>
            ) : (
              disputedBookings.map((booking) => {
                const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
                return (
                  <div key={booking.id} className="space-y-4 rounded-3xl border border-red-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/reservations/${booking.id}`} className="block font-mono text-xs font-bold text-primary">
                          {booking.reference}
                        </Link>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{booking.subjectName}</p>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    <div className="flex min-w-0 items-center gap-3 rounded-3xl border border-violet-100 bg-violet-50/50 p-3">
                      <ProfessorImage
                        photoUrl={booking.teacher.photoUrl}
                        name={teacherName}
                        size="sm"
                        shape="circle"
                        verified={booking.teacher.badgeVerified}
                      />
                      <div className="min-w-0">
                        <Link href={`/admin/professeurs/${booking.teacher.id}?tab=cours&bookingId=${booking.id}`} className="block truncate text-sm font-bold text-foreground">
                          {teacherName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">Client : {booking.client.name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                        <Money amount={booking.totalPrice} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Mis à jour</p>
                        <p className="mt-1 truncate text-xs font-bold text-foreground">{timeAgo(booking.updatedAt)}</p>
                      </div>
                    </div>

                    <Button asChild className="h-11 w-full rounded-2xl">
                      <Link href={`/admin/reservations/${booking.id}`}>Traiter le litige</Link>
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réservation</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputedBookings.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucun litige ouvert.</TableCell></TableRow>}
              {disputedBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-sm">{booking.reference}</TableCell>
                  <TableCell>{booking.client.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProfessorImage
                        photoUrl={booking.teacher.photoUrl}
                        name={booking.teacher.professionalName || booking.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={booking.teacher.badgeVerified}
                      />
                      <Link href={`/admin/professeurs/${booking.teacher.id}?tab=cours&bookingId=${booking.id}`} className="hover:text-primary">
                        {booking.teacher.professionalName || booking.teacher.fullName}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell><BookingStatusBadge status={booking.status} /></TableCell>
                  <TableCell className="text-right"><Money amount={booking.totalPrice} /></TableCell>
                  <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link href={`/admin/reservations/${booking.id}`}>Traiter</Link></Button></TableCell>
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

function OpsCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <p className="rounded-2xl border border-violet-100 bg-white p-3 text-sm text-muted-foreground">{label}</p>;
}

function TeacherLine({
  teacher,
  meta,
  badge,
  booking,
  actionHref,
}: {
  teacher: any;
  meta: string;
  badge: string;
  booking?: any;
  actionHref?: string;
}) {
  const teacherName = teacher.professionalName || teacher.fullName;
  const actionBooking = booking ? {
    id: booking.id,
    reference: booking.reference,
    subjectName: booking.subjectName,
    levelName: booking.levelName,
  } : null;
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-3 transition hover:-translate-y-0.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href={actionHref || `/admin/professeurs/${teacher.id}`} className="flex min-w-0 items-center gap-3">
          <ProfessorImage photoUrl={teacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={teacher.badgeVerified} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{teacherName}</p>
            <p className="truncate text-xs text-muted-foreground">{meta}</p>
          </div>
          {teacherStatuses.has(badge) ? <TeacherStatusBadge status={badge} /> : <Badge variant="outline">{badge}</Badge>}
        </Link>
        <OperationalTeacherActionsClient
          teacherId={teacher.id}
          teacherName={teacherName}
          booking={actionBooking}
          compact
        />
      </div>
    </div>
  );
}

function BookingLine({
  booking,
  payment = false,
  courseStart,
  teacherConfirmed,
}: {
  booking: any;
  payment?: boolean;
  courseStart?: Date;
  teacherConfirmed?: boolean;
}) {
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  const urgentUnconfirmed = teacherConfirmed === false;
  const href = urgentUnconfirmed ? `/admin/reservations/${booking.id}?action=replace` : `/admin/reservations/${booking.id}`;
  const actionBooking = {
    id: booking.id,
    reference: booking.reference,
    subjectName: booking.subjectName,
    levelName: booking.levelName,
  };
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-3 transition hover:-translate-y-0.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href={href} className="flex min-w-0 items-center gap-3">
          <ProfessorImage photoUrl={booking.teacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={booking.teacher.badgeVerified} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{booking.reference} - {booking.subjectName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {booking.client.name} avec {teacherName}{courseStart ? ` · ${formatDateTime(courseStart)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {payment ? <PaymentStatusBadge status={booking.paymentStatus} /> : <BookingStatusBadge status={booking.status} />}
            {teacherConfirmed !== undefined && (
              <Badge variant="outline" className={teacherConfirmed ? "border-blue-200 bg-blue-50 text-blue-800" : "border-red-200 bg-red-50 text-red-700"}>
                {teacherConfirmed ? "Prof confirmé" : "Prof non confirmé"}
              </Badge>
            )}
          </div>
        </Link>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <OperationalTeacherActionsClient
            teacherId={booking.teacher.id}
            teacherName={teacherName}
            booking={actionBooking}
            compact
          />
          {payment && (
            <OperationalPaymentActionsClient
              teacherId={booking.teacher.id}
              bookingId={booking.id}
              paymentStatus={booking.paymentStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MissionLine({ mission }: { mission: any }) {
  const isCritical = ["REPLACEMENT_RECOMMENDED", "EXPIRED"].includes(mission.status);
  const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
  const actionBooking = {
    id: mission.booking.id,
    reference: mission.booking.reference,
    subjectName: mission.booking.subjectName,
    levelName: mission.booking.levelName,
  };
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-3 transition hover:-translate-y-0.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href={`/admin/reservations/${mission.bookingId}`} className="flex min-w-0 items-center gap-3">
          <ProfessorImage photoUrl={mission.teacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={mission.teacher.badgeVerified} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{mission.booking.reference} - {mission.booking.subjectName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {teacherName} · créée {timeAgo(mission.createdAt)} · expire {formatDateTime(mission.expiresAt)}
            </p>
          </div>
          <Badge variant="outline" className={isCritical ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
            {missionStatusLabel(mission.status)}
          </Badge>
        </Link>
        <OperationalTeacherActionsClient
          teacherId={mission.teacher.id}
          teacherName={teacherName}
          booking={actionBooking}
          compact
        />
      </div>
    </div>
  );
}
