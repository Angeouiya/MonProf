import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, CalendarRange, Clock, Eye, ExternalLink, Phone, UserCog, Wallet } from "lucide-react";
import Link from "next/link";
import { ReservationsListClient } from "./list-client";
import { formatFCFA, formatDate, timeAgo } from "@/lib/format";
import { CLIENT_TYPES, COURSE_CATEGORIES, SCHOOL_SYSTEMS } from "@/lib/course-catalog";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

const VALID_BOOKING_STATUSES = [
  "PENDING_PAYMENT","PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS",
  "COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE",
  "TEACHER_PAID","DISPUTED","CANCELLED","REFUNDED",
];
const VALID_PAYMENT_STATUSES = ["FAILED","RECEIVED","BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID","DISPUTED","REFUND_PENDING","PARTIAL_REFUND_PENDING","REFUNDED","PARTIALLY_REFUNDED","RETAINED"];

function categoryLabel(value?: string | null) {
  return COURSE_CATEGORIES.find((category) => category.code === value)?.label ?? value ?? "";
}

function schoolSystemLabel(value?: string | null) {
  return SCHOOL_SYSTEMS.find((system) => system.value === value)?.label ?? value ?? "";
}

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; payment?: string; teacherId?: string; clientId?: string;
    clientType?: string; courseCategory?: string; schoolSystem?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status && VALID_BOOKING_STATUSES.includes(sp.status) ? sp.status as any : undefined;
  const payment = sp.payment && VALID_PAYMENT_STATUSES.includes(sp.payment) ? sp.payment as any : undefined;
  const teacherId = sp.teacherId || undefined;
  const clientId = sp.clientId || undefined;
  const clientType = sp.clientType && CLIENT_TYPES.includes(sp.clientType as any) ? sp.clientType : undefined;
  const courseCategory = sp.courseCategory && COURSE_CATEGORIES.some((category) => category.code === sp.courseCategory) ? sp.courseCategory : undefined;
  const schoolSystem = sp.schoolSystem && SCHOOL_SYSTEMS.some((system) => system.value === sp.schoolSystem) ? sp.schoolSystem : undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { subjectName: { contains: q } },
      { levelName: { contains: q } },
      { schoolProgram: { contains: q } },
      { courseCatalogName: { contains: q } },
      { preciseLevel: { contains: q } },
      { client: { name: { contains: q } } },
      { teacher: { OR: [{ fullName: { contains: q } }, { professionalName: { contains: q } }] } },
    ];
  }
  if (status) where.status = status;
  if (payment) where.paymentStatus = payment;
  if (teacherId) where.teacherId = teacherId;
  if (clientId) where.clientId = clientId;
  if (clientType) where.clientType = clientType;
  if (courseCategory) where.courseCategory = courseCategory;
  if (schoolSystem) where.schoolSystem = schoolSystem;

  const [bookings, teachers] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      },
      take: 200,
    }),
    db.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, professionalName: true } }),
  ]);
  const now = new Date();
  const verifiedPaymentBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const paidOrBlocked = verifiedPaymentBookings.filter((booking) => ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "RETAINED"].includes(booking.paymentStatus));
  const blockedCount = verifiedPaymentBookings.filter((booking) => booking.paymentStatus === "BLOCKED").length;
  const toPayCount = verifiedPaymentBookings.filter((booking) => booking.paymentStatus === "TO_PAY_TEACHER").length;
  const disputedCount = bookings.filter((booking) => booking.status === "DISPUTED" || booking.paymentStatus === "DISPUTED").length;
  const operationalUrgencies = bookings.filter((booking) => getReservationRisk(booking.status, booking.paymentStatus, booking.scheduledDate, booking.createdAt, now, hasVerifiedPayDunyaClientPayment(booking)).urgent);
  const totalPaidScope = paidOrBlocked.reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Réservations" description={`${bookings.length} réservation(s)`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          title="Volume sous contrôle"
          value={formatFCFA(totalPaidScope)}
          description={`${paidOrBlocked.length} réservation(s) payées, bloquées, validées ou soldées.`}
          tone="violet"
        />
        <SignalCard
          title="Fonds bloqués"
          value={`${blockedCount} dossier${blockedCount > 1 ? "s" : ""}`}
          description="Réservations payées à suivre jusqu'à validation client."
          tone={blockedCount ? "amber" : "blue"}
        />
        <SignalCard
          title="Paiements prof"
          value={`${toPayCount} à libérer`}
          description="Réservations prêtes pour comptabilité professeur."
          tone={toPayCount ? "violet" : "blue"}
        />
        <SignalCard
          title="Urgences"
          value={`${operationalUrgencies.length} signal${operationalUrgencies.length > 1 ? "aux" : ""}`}
          description={`${disputedCount} litige(s) ou dossier(s) sensibles dans la liste.`}
          tone={operationalUrgencies.length ? "red" : "blue"}
        />
      </div>

      <ReservationsListClient
        filters={{
          q: q ?? "", status: status ?? "", payment: payment ?? "",
          teacherId: teacherId ?? "", clientId: clientId ?? "",
          clientType: clientType ?? "", courseCategory: courseCategory ?? "", schoolSystem: schoolSystem ?? "",
        }}
        teachers={teachers.map((t) => ({ id: t.id, name: t.professionalName || t.fullName }))}
      />

      {bookings.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Aucune réservation" description="Aucune réservation ne correspond à vos filtres." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {bookings.map((b) => {
              const displayDate = b.scheduledDate ?? b.startDate ?? b.createdAt;
              const paymentVerified = hasVerifiedPayDunyaClientPayment(b);
              const risk = getReservationRisk(b.status, b.paymentStatus, b.scheduledDate ?? b.startDate, b.createdAt, now, paymentVerified);
              return (
                <Card key={b.id} className="border-violet-100 bg-white">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-bold text-primary">
                          {b.reference}
                        </Link>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">{b.subjectName}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {b.clientType && <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">{b.clientType}</Badge>}
                          {b.courseCategory && <Badge variant="outline" className="border-violet-100 bg-violet-50 text-violet-800">{categoryLabel(b.courseCategory)}</Badge>}
                          {b.schoolSystem && <Badge variant="outline" className="border-amber-100 bg-amber-50 text-amber-800">{schoolSystemLabel(b.schoolSystem)}</Badge>}
                          {b.preciseLevel && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{b.preciseLevel}</Badge>}
                          {b.courseCatalogName && <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{b.courseCatalogName}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{b.scheduledDate ? "Planifiée" : "Souhaitée"} : {formatDate(displayDate)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-foreground">{b.isQuoteOnly ? "Prix à finaliser" : <Money amount={b.totalClientPays || b.totalPrice} />}</p>
                    </div>

                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                      <ProfessorImage
                        photoUrl={b.teacher.photoUrl}
                        name={b.teacher.professionalName || b.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={b.teacher.badgeVerified}
                      />
                      <div className="min-w-0">
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`} className="block truncate text-sm font-bold text-foreground">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </Link>
                        {b.teacher.phone && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {b.teacher.phone}
                          </p>
                        )}
                        <Link href={`/admin/clients/${b.client.id}`} className="inline-flex min-h-10 max-w-full items-center truncate text-xs text-muted-foreground">
                          Client : {b.client.name}
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                      <div className="flex flex-wrap gap-2">
                        <BookingStatusBadge status={b.status} />
                        <PaymentStatusBadge status={b.paymentStatus} quoteOnly={b.isQuoteOnly} />
                        <Badge variant="outline" className={risk.className}>{risk.label}</Badge>
                      </div>
                      <p className="text-xs font-medium text-blue-950/72">{risk.hint}</p>
                    </div>

                    <ReservationActions
                      bookingId={b.id}
                      teacherId={b.teacher.id}
                      status={b.status}
                      paymentStatus={b.paymentStatus}
                      paymentVerified={paymentVerified}
                      compact
                    />
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
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const displayDate = b.scheduledDate ?? b.startDate ?? b.createdAt;
                  const paymentVerified = hasVerifiedPayDunyaClientPayment(b);
                  const risk = getReservationRisk(b.status, b.paymentStatus, b.scheduledDate ?? b.startDate, b.createdAt, now, paymentVerified);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/admin/reservations/${b.id}`} className="inline-flex min-h-10 items-center font-mono text-sm font-medium text-primary hover:underline">{b.reference}</Link>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">Créée {timeAgo(b.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/clients/${b.client.id}`} className="inline-flex min-h-10 items-center text-sm hover:text-primary">{b.client.name}</Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProfessorImage
                            photoUrl={b.teacher.photoUrl}
                            name={b.teacher.professionalName || b.teacher.fullName}
                            size="sm"
                            shape="circle"
                            verified={b.teacher.badgeVerified}
                          />
                          <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`} className="inline-flex min-h-10 items-center text-sm hover:text-primary">
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
                      <TableCell className="hidden md:table-cell text-sm">
                        <p className="font-medium text-foreground">{b.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{b.levelName}</p>
                        <div className="mt-1 flex max-w-72 flex-wrap gap-1">
                          {b.clientType && <Badge variant="outline" className="border-blue-100 bg-blue-50 px-2 py-0 text-[10px] text-blue-800">{b.clientType}</Badge>}
                          {b.courseCategory && <Badge variant="outline" className="border-violet-100 bg-violet-50 px-2 py-0 text-[10px] text-violet-800">{categoryLabel(b.courseCategory)}</Badge>}
                          {b.schoolSystem && <Badge variant="outline" className="border-amber-100 bg-amber-50 px-2 py-0 text-[10px] text-amber-800">{schoolSystemLabel(b.schoolSystem)}</Badge>}
                          {b.preciseLevel && <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2 py-0 text-[10px] text-slate-700">{b.preciseLevel}</Badge>}
                          {b.courseCatalogName && <Badge variant="outline" className="border-slate-200 bg-white px-2 py-0 text-[10px] text-slate-700">{b.courseCatalogName}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        <p>{formatDate(displayDate)}</p>
                        {!b.scheduledDate && b.startDate && <p className="text-[11px]">Date souhaitée</p>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{b.isQuoteOnly ? "Prix à finaliser" : <Money amount={b.totalClientPays || b.totalPrice} />}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <BookingStatusBadge status={b.status} />
                          <Badge variant="outline" className={risk.className}>{risk.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell><PaymentStatusBadge status={b.paymentStatus} quoteOnly={b.isQuoteOnly} /></TableCell>
                      <TableCell className="text-right">
                        <ReservationActions
                          bookingId={b.id}
                          teacherId={b.teacher.id}
                          status={b.status}
                          paymentStatus={b.paymentStatus}
                          paymentVerified={paymentVerified}
                        />
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

function getReservationRisk(status: string, paymentStatus: string, scheduledDate: Date | null, createdAt: Date, now: Date, paymentVerified: boolean) {
  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  const startsSoon = scheduledDate
    ? scheduledDate.getTime() >= now.getTime() && scheduledDate.getTime() - now.getTime() <= 2 * 60 * 60 * 1000
    : false;
  const claimsPaid = ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID", "DISPUTED", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "RETAINED"].includes(paymentStatus);

  if (claimsPaid && !paymentVerified) {
    return {
      label: "Paiement à vérifier",
      hint: "Statut financier ignoré tant qu'aucune preuve PayDunya serveur n'est attachée.",
      className: "border-red-200 bg-red-50 text-red-700",
      urgent: true,
    };
  }
  if (status === "DISPUTED" || paymentStatus === "DISPUTED") {
    return {
      label: "Litige",
      hint: "Décision admin requise : remboursement, paiement partiel, remplacement ou clôture.",
      className: "border-red-200 bg-red-50 text-red-700",
      urgent: true,
    };
  }
  if (startsSoon && !["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(status)) {
    return {
      label: "Moins de 2h",
      hint: "Cours proche : confirmer le professeur et les informations client immédiatement.",
      className: "border-red-200 bg-red-50 text-red-700",
      urgent: true,
    };
  }
  if (paymentStatus === "TO_PAY_TEACHER") {
    return {
      label: "À payer",
      hint: "Le client a validé le cours : traiter la comptabilité professeur.",
      className: "border-violet-200 bg-violet-50 text-violet-700",
      urgent: ageHours >= 48,
    };
  }
  if (paymentStatus === "BLOCKED" && ageHours >= 48) {
    return {
      label: "+48h bloqué",
      hint: "Fonds bloqués depuis plus de 48h : vérifier cours, client, professeur ou litige.",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      urgent: true,
    };
  }
  if (["PAID", "PENDING_ADMIN_VALIDATION"].includes(status)) {
    return {
      label: "Admin à confirmer",
      hint: "Réservation payée : valider puis transmettre clairement la mission au professeur.",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      urgent: ageHours >= 24,
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      label: "Client à relancer",
      hint: "Cours terminé : attendre ou demander la confirmation client.",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      urgent: ageHours >= 48,
    };
  }
  return {
    label: "Suivi normal",
    hint: "La réservation suit son parcours normal.",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    urgent: false,
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
  const iconClass = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    red: "text-red-700",
    violet: "text-violet-700",
  }[tone];
  const Icon = tone === "red" ? AlertTriangle : tone === "amber" ? Clock : tone === "violet" ? Wallet : CalendarRange;
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
          <p className="mt-1 text-lg font-black">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{description}</p>
    </div>
  );
}

function ReservationActions({
  bookingId,
  teacherId,
  status,
  paymentStatus,
  paymentVerified,
  compact,
}: {
  bookingId: string;
  teacherId: string;
  status: string;
  paymentStatus: string;
  paymentVerified: boolean;
  compact?: boolean;
}) {
  const canReplace = paymentVerified && ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "DISPUTED"].includes(status);
  const canPay = paymentVerified && paymentStatus === "TO_PAY_TEACHER";
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
          <Eye className="mr-1.5 h-4 w-4" />
          Prof
        </Link>
      </Button>
      {canPay && (
        <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
          <Link href={`/admin/reservations/${bookingId}?action=pay`}>
            <Banknote className="mr-1.5 h-4 w-4" />
            Payer
          </Link>
        </Button>
      )}
      {canReplace && (
        <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
          <Link href={`/admin/reservations/${bookingId}?action=replace`}>
            <UserCog className="mr-1.5 h-4 w-4" />
            Remplacer
          </Link>
        </Button>
      )}
    </div>
  );
}
