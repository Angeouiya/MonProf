import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { TeacherMiniCv } from "@/components/shared/teacher-mini-cv";
import { TeacherOperationsClient } from "@/components/admin/teacher-operations-client";
import {
  AdminActionLog,
  OperationalAlertCard,
  ReplacementHistoryTable,
  TeacherActivityTimeline,
  TeacherPaymentSummary,
  TeacherQualityScore,
  TeacherStatusBadge,
  TeacherTaskCard,
} from "@/components/admin/teacher-operational-components";
import { ReviewOperationalActionsClient } from "@/components/admin/review-operational-actions-client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pencil, Bell, MapPin, Phone, Mail, GraduationCap, Award, BriefcaseBusiness,
  BookOpen, Wallet, CheckCircle2, Clock, Users, MessageSquare, ShieldAlert, ShieldCheck, Siren, ClipboardList,
} from "lucide-react";
import { TeacherActionsClient } from "./actions-client";
import { AdminTeacherNotesClient } from "./admin-notes-client";
import { TeacherPayoutClient } from "./teacher-payout-client";
import { TeacherPaymentAdjustmentActionsClient } from "./teacher-payment-adjustment-actions-client";
import { TeacherWhatsAppMessageClient } from "./teacher-whatsapp-message-client";
import { TeacherSanctionActionsClient } from "./teacher-sanction-actions-client";
import { TeacherNotificationHistoryClient } from "./teacher-notification-history-client";
import { TeacherMissionLinksClient } from "./teacher-mission-links-client";
import { TeacherCourseQuickActionsClient } from "./teacher-course-quick-actions-client";
import { TeacherWarningActionsClient } from "./teacher-warning-actions-client";
import { TeacherControlPanelClient } from "./teacher-control-panel-client";
import { TeacherAdminMessagesClient, type TeacherAdminMessageItem } from "@/components/admin/teacher-admin-messages-client";
import { PLATFORM_COMMISSION_PERCENT, TEACHER_PERCENT, PRICE_TIERS, parsePricingSnapshot } from "@/lib/pricing";
import { AvisClient } from "@/app/admin/avis/client";
import { formatFCFA, formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { computeTeacherQualityScore } from "@/lib/teacher-operations";
import { getTeacherAdjustedPayable, getTeacherAdjustmentAmount, getTeacherFinancialSettlement } from "@/lib/teacher-payments";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import {
  teacherSanctionStatusLabel,
  teacherSanctionTypeLabel,
  teacherWarningLevelLabel,
  teacherWarningReasonLabel,
} from "@/lib/teacher-discipline-labels";
import { transactionTypeLabel } from "@/lib/platform-labels";
import { paymentMethodLabel } from "@/lib/payment-methods";

export const dynamic = "force-dynamic";

const reviewAdminStatusLabel: Record<string, string> = {
  NEW: "Nouveau",
  TO_REVIEW: "À traiter",
  CONTACT_CLIENT: "Contacter client",
  CONTACT_TEACHER: "Contacter professeur",
  WARNING_SENT: "Avertissement envoyé",
  RESOLVED: "Résolu",
  ESCALATED: "Escaladé",
  DISMISSED: "Écarté",
};

const reviewAdminStatusClass: Record<string, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-800",
  TO_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACT_CLIENT: "border-violet-200 bg-violet-50 text-violet-800",
  CONTACT_TEACHER: "border-violet-200 bg-violet-50 text-violet-800",
  WARNING_SENT: "border-orange-200 bg-orange-50 text-orange-800",
  RESOLVED: "border-blue-200 bg-blue-50 text-blue-800",
  ESCALATED: "border-red-200 bg-red-50 text-red-800",
  DISMISSED: "border-slate-200 bg-slate-50 text-slate-700",
};

function reviewSeverity(rating: number) {
  if (rating <= 2) {
    return { label: "Critique", className: "border-red-200 bg-red-50 text-red-800" };
  }
  if (rating === 3) {
    return { label: "À surveiller", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return null;
}

const paymentAdjustmentStatusLabel: Record<string, string> = {
  PENDING: "En attente de validation",
  APPLIED: "Retenue appliquée",
  CANCELLED: "Retenue annulée",
};

export default async function ProfesseurDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; action?: string; bookingId?: string; status?: string; messageId?: string; payoutRequestId?: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const [teacher, actionLogs] = await Promise.all([
    db.teacher.findUnique({
      where: { id },
      include: {
        subjects: { include: { subject: true } },
        levels: { include: { level: true } },
        zones: { include: { commune: true } },
        bookings: {
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { name: true, phone: true } },
            transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
          },
          take: 100,
        },
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
        reviews: { include: { client: { select: { name: true } }, booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" } },
        notifications: { orderBy: { createdAt: "desc" }, take: 30 },
        missionLinks: {
          include: {
            booking: {
              select: {
                id: true,
                reference: true,
                subjectName: true,
                levelName: true,
                client: { select: { name: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        tasks: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 50 },
        warnings: { include: { booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
        sanctions: { include: { booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
        oldReplacements: {
          include: {
            booking: { select: { reference: true, client: { select: { name: true, phone: true } } } },
            oldTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true } },
            newTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        newReplacements: {
          include: {
            booking: { select: { reference: true, client: { select: { name: true, phone: true } } } },
            oldTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true } },
            newTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        paymentAdjustments: {
          include: { booking: { select: { id: true, reference: true, subjectName: true, levelName: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        payoutRecords: {
          include: {
            createdBy: { select: { name: true } },
            allocations: {
              include: {
                booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
              },
            },
          },
          orderBy: { paidAt: "desc" },
          take: 50,
        },
        payoutRequests: {
          include: {
            payoutRecord: { select: { reference: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        adminMessages: {
          include: {
            booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
            admin: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: { select: { bookings: true, reviews: true } },
      },
    }),
    db.adminActionLog.findMany({
      where: { entityType: "Teacher", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!teacher) notFound();

  const targetBookingId = sp.bookingId ?? null;
  const targetBooking = targetBookingId ? teacher.bookings.find((booking) => booking.id === targetBookingId) : null;
  const availability = parseAvailability(teacher.availability);
  const primarySubject = teacher.subjects.find((s) => s.isPrimary)?.subject ?? teacher.subjects[0]?.subject;

  const realized = teacher.bookings.filter((b) => ["COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID"].includes(b.status)).length;
  const cancelled = teacher.bookings.filter((b) => b.status === "CANCELLED").length;
  const refunded = teacher.bookings.filter((b) => b.status === "REFUNDED").length;
  const pending = teacher.bookings.filter((b) => ["PENDING_PAYMENT","PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS"].includes(b.status)).length;
  const disputed = teacher.bookings.filter((b) => b.status === "DISPUTED").length;
  const uniqueClients = new Set(teacher.bookings.map((b) => b.clientId)).size;
  const activeOperationalBookings = teacher.bookings.filter((b) => ["PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS"].includes(b.status));
  const nextBooking = activeOperationalBookings
    .filter((booking) => booking.scheduledDate)
    .sort((a, b) => (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0))[0];

  const validBookings = teacher.bookings.filter(hasVerifiedPayDunyaClientPayment);
  const totalGenerated = validBookings.reduce((s, b) => s + b.totalPrice, 0);
  const totalCommission = validBookings.reduce((s, b) => s + b.commissionAmount, 0);
  const totalNet = validBookings.reduce((s, b) => s + b.teacherNetAmount, 0);
  const totalTransportFees = validBookings.reduce((s, b) => s + b.transportFee, 0);
  const totalTeacherCourseShare = validBookings.reduce((s, b) => {
    const courseShare = b.teacherPayoutAmount || Math.max(0, b.teacherNetAmount - b.transportFee);
    return s + courseShare;
  }, 0);
  const blockedFunds = validBookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.teacherNetAmount, 0);
  const validatedFunds = validBookings.filter((b) => b.paymentStatus === "VALIDATED").reduce((s, b) => s + b.teacherNetAmount, 0);
  const paidForBooking = (b: (typeof teacher.bookings)[number]) => hasVerifiedPayDunyaClientPayment(b) ? b.teacherPaidAmount || (b.paymentStatus === "TEACHER_PAID" ? b.teacherNetAmount : 0) : 0;
  const toPay = validBookings
    .filter((b) => b.paymentStatus === "TO_PAY_TEACHER")
    .reduce((s, b) => s + Math.max(0, b.teacherNetAmount - paidForBooking(b)), 0);
  const alreadyPaid = validBookings.reduce((s, b) => s + paidForBooking(b), 0);
  const appliedAdjustments = getTeacherAdjustmentAmount(teacher.paymentAdjustments, "APPLIED");
  const pendingAdjustments = getTeacherAdjustmentAmount(teacher.paymentAdjustments, "PENDING");
  const netToPay = getTeacherAdjustedPayable(toPay, teacher.paymentAdjustments);
  const replacements = [...teacher.oldReplacements, ...teacher.newReplacements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const lateTasks = teacher.tasks.filter((task) => task.status === "LATE").length;
  const criticalTasks = teacher.tasks.filter((task) => task.priority === "CRITICAL" && !["DONE", "CANCELLED"].includes(task.status)).length;
  const today = new Date();
  const coursesToday = teacher.bookings.filter((booking) => {
    if (!booking.scheduledDate) return false;
    return booking.scheduledDate.toDateString() === today.toDateString();
  }).length;
  const qualityScore = computeTeacherQualityScore({
    rating: teacher.rating,
    bookings: teacher.bookings,
    warnings: teacher.warnings,
    sanctions: teacher.sanctions,
    replacements,
  });
  const taskBookingOptions = teacher.bookings.map((booking) => ({
    id: booking.id,
    reference: booking.reference,
    subjectName: booking.subjectName,
    levelName: booking.levelName,
  }));
  const adminMessages: TeacherAdminMessageItem[] = teacher.adminMessages.map((message) => ({
    id: message.id,
    teacherId: message.teacherId,
    bookingId: message.bookingId,
    sender: message.sender,
    subject: message.subject,
    message: message.message,
    priority: message.priority,
    status: message.status,
    readByAdminAt: message.readByAdminAt?.toISOString() ?? null,
    readByTeacherAt: message.readByTeacherAt?.toISOString() ?? null,
    resolvedAt: message.resolvedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    booking: message.booking,
    admin: message.admin,
  }));
  const missionMessageBookings = teacher.bookings.slice(0, 25).map((booking) => {
    const settlement = hasVerifiedPayDunyaClientPayment(booking)
      ? getTeacherFinancialSettlement(booking, teacher.paymentAdjustments)
      : { paid: 0, retained: 0, remaining: 0, settled: true };
    const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
    return {
      id: booking.id,
      reference: booking.reference,
      clientName: booking.client.name,
      clientPhone: booking.client.phone,
      subjectName: booking.subjectName,
      levelName: booking.levelName,
      courseFormat: booking.courseFormat,
      commune: booking.commune,
      quartier: booking.quartier,
      addressHint: booking.addressHint,
      preferredDays: booking.preferredDays,
      preferredTime: booking.preferredTime,
      scheduledDate: booking.scheduledDate?.toISOString() ?? null,
      scheduledTime: booking.scheduledTime,
      schoolProgram: booking.schoolProgram,
      needDescription: booking.needDescription,
      objective: booking.objective,
      message: booking.message,
      participantsCount: booking.participantsCount,
      sessionsCount: booking.sessionsCount,
      teacherCourseShare: booking.teacherPayoutAmount || Math.max(0, booking.teacherNetAmount - booking.transportFee),
      transportFee: booking.transportFee,
      transportRouteLabel: pricingSnapshot?.transportRouteLabel ?? null,
      teacherNetAmount: booking.teacherNetAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paidAmount: settlement.paid,
      remainingAmount: settlement.remaining,
    };
  });
  const courseActionBooking = (booking: (typeof teacher.bookings)[number]) => {
    const settlement = hasVerifiedPayDunyaClientPayment(booking)
      ? getTeacherFinancialSettlement(booking, teacher.paymentAdjustments)
      : { paid: 0, retained: 0, remaining: 0, settled: true };
    return {
      id: booking.id,
      reference: booking.reference,
      clientName: booking.client.name,
      clientPhone: booking.client.phone,
      subjectName: booking.subjectName,
      levelName: booking.levelName,
      courseFormat: booking.courseFormat,
      commune: booking.commune,
      quartier: booking.quartier,
      addressHint: booking.addressHint,
      onlineLink: booking.onlineLink,
      preferredDays: booking.preferredDays,
      preferredTime: booking.preferredTime,
      scheduledDate: booking.scheduledDate?.toISOString() ?? null,
      scheduledTime: booking.scheduledTime,
      participantsCount: booking.participantsCount,
      sessionsCount: booking.sessionsCount,
      teacherNetAmount: booking.teacherNetAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paidAmount: settlement.paid,
      remainingAmount: settlement.remaining,
    };
  };
  const payoutRecords = teacher.payoutRecords.map((record) => ({
    id: record.id,
    reference: record.reference,
    amount: record.amount,
    method: record.method,
    paymentPhone: record.paymentPhone,
    note: record.note,
    status: record.status,
    paidAt: record.paidAt.toISOString(),
    createdBy: record.createdBy,
    allocations: record.allocations.map((allocation) => ({
      id: allocation.id,
      amount: allocation.amount,
      booking: allocation.booking,
    })),
  }));
  const payoutRequests = teacher.payoutRequests.map((request) => ({
    id: request.id,
    reference: request.reference,
    amount: request.amount,
    method: request.method,
    paymentPhone: request.paymentPhone,
    note: request.note,
    status: request.status,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    payoutRecord: request.payoutRecord,
  }));
  const ledgerRows = teacher.bookings.map((booking) => {
    const paymentVerified = hasVerifiedPayDunyaClientPayment(booking);
    const settlement = paymentVerified
      ? getTeacherFinancialSettlement(booking, teacher.paymentAdjustments)
      : { paid: 0, retained: 0, remaining: 0, settled: true };
    const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
    return {
      id: booking.id,
      reference: booking.reference,
      subjectName: booking.subjectName,
      levelName: booking.levelName,
      clientName: booking.client.name,
      paymentStatus: booking.paymentStatus,
      paymentVerified,
      status: booking.status,
      courseAmount: booking.courseAmount || Math.max(0, booking.totalPrice - booking.transportFee - booking.materialFee),
      teacherCourseShare: booking.teacherPayoutAmount || Math.max(0, booking.teacherNetAmount - booking.transportFee),
      transportFee: booking.transportFee,
      transportRouteLabel: pricingSnapshot?.transportRouteLabel ?? null,
      teacherNetAmount: booking.teacherNetAmount,
      paid: settlement.paid,
      retained: settlement.retained,
      remaining: settlement.remaining,
      scheduledDate: booking.scheduledDate ?? booking.createdAt,
    };
  });
  const payableLedgerRows = ledgerRows.filter((row) => row.paymentStatus === "TO_PAY_TEACHER" && row.remaining > 0);
  const blockedLedgerRows = ledgerRows.filter((row) => row.paymentStatus === "BLOCKED" && row.remaining > 0);
  const validatedLedgerRows = ledgerRows.filter((row) => row.paymentStatus === "VALIDATED" && row.remaining > 0);
  const retainedLedgerAmount = ledgerRows.reduce((sum, row) => sum + row.retained, 0);
  const targetLedgerRow = targetBookingId ? ledgerRows.find((row) => row.id === targetBookingId) : null;
  const publishedReviews = teacher.reviews.filter((review) => review.published);
  const hiddenReviews = teacher.reviews.length - publishedReviews.length;
  const sensitiveReviewStatuses = ["TO_REVIEW", "CONTACT_CLIENT", "CONTACT_TEACHER", "ESCALATED", "WARNING_SENT"];
  const criticalReviews = teacher.reviews.filter((review) => review.rating <= 2);
  const watchReviews = teacher.reviews.filter((review) => review.rating === 3);
  const reviewsToProcess = teacher.reviews.filter((review) => sensitiveReviewStatuses.includes(review.adminStatus));
  const latestSensitiveReview = teacher.reviews.find((review) => review.rating <= 3 || sensitiveReviewStatuses.includes(review.adminStatus));
  const reviewDecision = getReviewDecision({
    criticalCount: criticalReviews.length,
    watchCount: watchReviews.length,
    toProcessCount: reviewsToProcess.length,
    hiddenCount: hiddenReviews,
  });
  const reviewBuckets = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: publishedReviews.filter((review) => review.rating === rating).length,
  }));
  const effectivePublicRating = teacher.ratingCount > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : teacher.rating;
  const effectiveRatingSource = teacher.ratingCount > 0
    ? `${teacher.ratingCount} avis client(s)`
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? "note admin publique"
      : "aucune note publique";
  const payoutProgress = totalNet > 0 ? Math.min(100, Math.round((alreadyPaid / totalNet) * 100)) : 0;
  const restrictiveStatus = ["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "INACTIVE"].includes(teacher.status);
  const openTasksCount = teacher.tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
  const nextBookingSettlement = nextBooking ? getTeacherFinancialSettlement(nextBooking, teacher.paymentAdjustments) : null;
  const nextControlBooking = nextBooking && nextBookingSettlement ? {
    id: nextBooking.id,
    reference: nextBooking.reference,
    subjectName: nextBooking.subjectName,
    levelName: nextBooking.levelName,
    clientName: nextBooking.client.name,
    dateLabel: formatDate(nextBooking.scheduledDate ?? nextBooking.createdAt),
    timeLabel: nextBooking.scheduledTime || nextBooking.preferredTime || "",
    status: nextBooking.status,
    paymentStatus: nextBooking.paymentStatus,
    remainingAmount: nextBookingSettlement.remaining,
  } : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={teacher.professionalName || teacher.fullName}
        description={teacher.jobTitle}
      >
        <Button asChild variant="outline">
          <Link href="/admin/professeurs">Retour</Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/professeurs/${teacher.id}/modifier`}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Link>
        </Button>
      </PageHeader>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ProfessorImage
            photoUrl={teacher.photoUrl}
            name={teacher.professionalName || teacher.fullName}
            size={128}
            shape="circle"
            verified={teacher.badgeVerified}
          />
          <div className="flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{teacher.fullName}</h2>
                <TeacherStatusBadge status={teacher.status} />
                {teacher.featured && <Badge variant="secondary" className="border border-violet-200 bg-violet-50 text-violet-700">Mis en avant</Badge>}
              </div>
              <ProfessorTrustBadges
                verified={teacher.badgeVerified}
                recommended={teacher.badgeRecommended}
                premium={teacher.badgePremium}
                popular={teacher.badgePopular}
                isNew={teacher.badgeNew}
                size="md"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Note {effectivePublicRating.toFixed(1)}/5 ({effectiveRatingSource})</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {teacher.commune ?? "—"}</span>
              <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {teacher.phone}</span>
              {teacher.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {teacher.email}</span>}
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                Portail prof {teacher.portalAccessEnabled ? "activé" : "désactivé"}
              </span>
              {teacher.portalAccessEnabled && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  Connexion prof : {teacher.portalPhone || teacher.phone}
                </span>
              )}
              {teacher.portalAccessEnabled && (
                <Link href="/professeur/connexion" target="_blank" className="inline-flex min-h-10 items-center rounded-xl px-1 font-semibold text-primary hover:underline">
                  Ouvrir la connexion professeur
                </Link>
              )}
            </div>
          </div>
          <div className="w-full sm:w-80">
            <TeacherQualityScore score={qualityScore} />
          </div>
          <TeacherActionsClient teacherId={teacher.id} teacherName={teacher.professionalName || teacher.fullName} teacherPhone={teacher.phone} />
        </CardContent>
      </Card>

      <TeacherControlPanelClient
        teacherId={teacher.id}
        teacherName={teacher.professionalName || teacher.fullName}
        teacherPhone={teacher.phone}
        teacherStatus={teacher.status}
        qualityScore={qualityScore}
        coursesToday={coursesToday}
        activeBookingsCount={activeOperationalBookings.length}
        openTasksCount={openTasksCount}
        lateTasks={lateTasks}
        criticalTasks={criticalTasks}
        warningsCount={teacher.warnings.length}
        sanctionsCount={teacher.sanctions.length}
        replacementsCount={teacher.oldReplacements.length}
        disputedBookingsCount={disputed}
        blockedFunds={blockedFunds}
        validatedFunds={validatedFunds}
        netToPay={netToPay}
        alreadyPaid={alreadyPaid}
        totalNet={totalNet}
        payableReservationsCount={payableLedgerRows.length}
        blockedReservationsCount={blockedLedgerRows.length}
        validatedReservationsCount={validatedLedgerRows.length}
        retainedAmount={retainedLedgerAmount}
        pendingAdjustments={pendingAdjustments}
        nextBooking={nextControlBooking}
      />

      <Card className="overflow-hidden border-[#E3E8F2] bg-white shadow-sm">
        <CardHeader className="border-b border-[#E3E8F2] bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base text-[#111827]">Espace professeur interne</CardTitle>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#64748B]">
                Pilotage admin centralisé : statut, missions, messages à transmettre, fonds bloqués et reste à payer au professeur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href={`/admin/professeurs/${teacher.id}?tab=cours`}>
                  <BookOpen className="mr-1.5 h-4 w-4" /> Missions
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href={`/admin/professeurs/${teacher.id}?tab=paiements`}>
                  <Wallet className="mr-1.5 h-4 w-4" /> Versements internes
                </Link>
              </Button>
              <Button asChild size="sm" className="rounded-full bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=notify`}>
                  <Bell className="mr-1.5 h-4 w-4" /> Notifier
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=reactivate`}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Réactiver
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl border border-[#E3E8F2] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Statut opérationnel</p>
                  <div className="mt-2"><TeacherStatusBadge status={teacher.status} /></div>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#111B4D]" />
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-[#64748B]">
                {restrictiveStatus
                  ? "Profil retiré du flux normal : vérifier les cours actifs et préparer un remplacement."
                  : "Profil exploitable par l'administration pour les réservations et missions."}
              </p>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-900/65">À traiter</p>
                  <p className="mt-1 text-2xl font-black text-amber-950">{criticalTasks + lateTasks}</p>
                </div>
                <Siren className="h-5 w-5 text-amber-700" />
              </div>
              <p className="mt-3 text-sm text-amber-950/72">
                {criticalTasks} critique(s), {lateTasks} en retard. {coursesToday} cours prévu(s) aujourd'hui.
              </p>
            </div>

            <div className="rounded-3xl border border-[#CAD7F2] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-900/65">Fonds bloqués</p>
                  <p className="mt-1 text-2xl font-black text-blue-950">{formatFCFA(blockedFunds)}</p>
                </div>
                <Clock className="h-5 w-5 text-blue-700" />
              </div>
              <p className="mt-3 text-sm text-blue-950/72">
                Montant interne en attente de validation client/admin avant paiement professeur.
              </p>
            </div>

            <div className="rounded-3xl border border-[#E3E8F2] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-900/60">Déjà versé</p>
                  <p className="mt-1 text-2xl font-black text-violet-950">{formatFCFA(alreadyPaid)}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-violet-700" />
              </div>
              <p className="mt-3 text-sm text-violet-950/72">
                Total des versements réels enregistrés dans la comptabilité interne.
              </p>
            </div>

            <div className="rounded-3xl border border-red-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-red-900/65">Reste à payer</p>
                  <p className="mt-1 text-2xl font-black text-red-950">{formatFCFA(netToPay)}</p>
                </div>
                <Wallet className="h-5 w-5 text-red-700" />
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#E5E7EB]">
                <div className="h-full rounded-full bg-[#111B4D]" style={{ width: `${payoutProgress}%` }} />
              </div>
              <p className="mt-2 text-xs font-medium text-red-950/68">{payoutProgress}% du net historique déjà enregistré comme payé.</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-violet-100 bg-white/85 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">Prochaine mission liée à ce professeur</p>
                  {nextBooking ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextBooking.reference} - {nextBooking.subjectName} avec {nextBooking.client.name}, {formatDate(nextBooking.scheduledDate ?? nextBooking.createdAt)} {nextBooking.scheduledTime || nextBooking.preferredTime ? `à ${nextBooking.scheduledTime || nextBooking.preferredTime}` : ""}.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Aucune mission active datée pour le moment.</p>
                  )}
                </div>
                {nextBooking && (
                  <Button asChild variant="outline" className="rounded-2xl">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=cours&bookingId=${nextBooking.id}`}>Ouvrir mission ciblée</Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-violet-100">
                <Link href={nextBooking ? `/admin/professeurs/${teacher.id}?tab=cours&bookingId=${nextBooking.id}` : `/admin/professeurs/${teacher.id}?tab=cours`}>
                  <ClipboardList className="mr-2 h-4 w-4 text-violet-700" /> Message mission
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-blue-100 text-blue-800 hover:bg-blue-50">
                <Link href={nextBooking ? `/admin/professeurs/${teacher.id}?tab=paiements&bookingId=${nextBooking.id}` : `/admin/professeurs/${teacher.id}?tab=paiements`}>
                  <Wallet className="mr-2 h-4 w-4" /> Versement
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-amber-100 text-amber-800 hover:bg-amber-50">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=warning`}>
                  <Siren className="mr-2 h-4 w-4" /> Avertir
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-red-100 text-red-700 hover:bg-red-50">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=suspend`}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> Suspendre
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-violet-100 text-violet-800 hover:bg-violet-50">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=observe`}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Observation
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-2xl border-slate-200 text-slate-900 hover:bg-slate-50">
                <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=block`}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> Bloquer
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Commandes opérationnelles</CardTitle></CardHeader>
        <CardContent>
          <TeacherOperationsClient
            teacherId={teacher.id}
            teacherName={teacher.professionalName || teacher.fullName}
            teacherPhone={teacher.defaultPayoutPhone || teacher.phone}
            bookings={taskBookingOptions}
            initialAction={sp.action}
            initialStatus={sp.status}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue={sp.tab || "infos"}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 border border-violet-100 bg-white/80 p-1 shadow-sm">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="matieres">Matières & Niveaux</TabsTrigger>
          <TabsTrigger value="tarifs">Tarifs</TabsTrigger>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="operationnel">Opérationnel</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="taches">Tâches</TabsTrigger>
          <TabsTrigger value="cours">Cours</TabsTrigger>
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
          <TabsTrigger value="discipline">Avertissements</TabsTrigger>
          <TabsTrigger value="remplacements">Remplacements</TabsTrigger>
          <TabsTrigger value="avis">Avis</TabsTrigger>
          <TabsTrigger value="historique">Historique notifs</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        {/* INFOS */}
        <TabsContent value="infos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Nom complet" value={teacher.fullName} />
                <InfoRow label="Nom professionnel" value={teacher.professionalName || "—"} />
                <InfoRow label="Téléphone" value={teacher.phone} />
                <InfoRow label="Email" value={teacher.email || "—"} />
                <InfoRow label="Commune" value={teacher.commune || "—"} />
                <InfoRow label="Quartier" value={teacher.quartier || "—"} />
                <InfoRow label="Adresse (indice)" value={teacher.addressHint || "—"} />
                <Separator />
                <InfoRow label="Moyen paiement prof" value={teacher.defaultPayoutMethod ? paymentMethodLabel(teacher.defaultPayoutMethod) : "À renseigner"} />
                <InfoRow label="Numéro paiement prof" value={teacher.defaultPayoutPhone || "À renseigner"} />
                {teacher.payoutInstructions && <InfoRow label="Consigne paiement" value={teacher.payoutInstructions} />}
                <Separator />
                <InfoRow label="Titre" value={teacher.jobTitle} />
                <InfoRow label="Type de profil" value={teacher.profileType} />
                <InfoRow label="Expérience" value={`${teacher.experienceYears} an(s)`} />
                <InfoRow label="Diplôme" value={teacher.diploma || "—"} />
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Bio</p>
                  <p className="mt-1 text-foreground">{teacher.bio}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Mini CV structuré</p>
                  <div className="mt-2">
                    <TeacherMiniCv
                      careerSummary={teacher.careerSummary}
                      skills={teacher.skills}
                      workHistory={teacher.workHistory}
                      certifications={teacher.certifications || teacher.diploma}
                      teachingAchievements={teacher.teachingAchievements}
                      learnersCoached={teacher.learnersCoached}
                    />
                  </div>
                </div>
                {teacher.internalNote && (
                  <>
                    <Separator />
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-amber-800 shadow-sm">
                      <p className="text-xs font-medium">Note interne</p>
                      <p className="mt-1 text-sm">{teacher.internalNote}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Disponibilités</CardTitle></CardHeader>
              <CardContent>
                {availability ? (
                  <>
                    <div className="space-y-3 md:hidden">
                      {WEEK_DAYS.map((d) => {
                        const availableSlots = TWO_HOUR_SLOTS.filter((s) => !!availability[d.key]?.[s.key]);
                        return (
                          <section key={d.key} className="rounded-3xl border border-violet-100 bg-white/90 p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{d.label}</p>
                              <Badge variant="outline" className={availableSlots.length ? "border-blue-100 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600"}>
                                {availableSlots.length ? `${availableSlots.length} créneau${availableSlots.length > 1 ? "x" : ""}` : "Indisponible"}
                              </Badge>
                            </div>
                            {availableSlots.length ? (
                              <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
                                {availableSlots.map((slot) => (
                                  <span key={slot.key} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 px-2 text-xs font-bold text-violet-900">
                                    {slot.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                                Aucun créneau disponible ce jour.
                              </p>
                            )}
                          </section>
                        );
                      })}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2 text-left font-medium text-muted-foreground">Jour</th>
                            {TWO_HOUR_SLOTS.map((s) => <th key={s.key} className="px-3 py-2 text-center font-medium text-muted-foreground">{s.shortLabel}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {WEEK_DAYS.map((d) => (
                            <tr key={d.key} className="border-b border-border last:border-0">
                              <td className="py-2 font-medium">{d.label}</td>
                              {TWO_HOUR_SLOTS.map((s) => {
                                const ok = !!availability[d.key]?.[s.key];
                                return (
                                  <td key={s.key} className="px-3 py-2 text-center">
                                    {ok ? <CheckCircle2 className="mx-auto h-4 w-4 text-primary" /> : <span className="text-muted-foreground">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune disponibilité renseignée.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Zones d'intervention</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {teacher.zones.length === 0 && <p className="text-sm text-muted-foreground">Aucune zone.</p>}
                {teacher.zones.map((z) => {
                  const commune = z.commune as any;
                  return (
                    <Badge key={commune.id} variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" /> {commune.name}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATIERES & NIVEAUX */}
        <TabsContent value="matieres">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Matières enseignées</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {teacher.subjects.map((s) => (
                  <div key={s.subject.id} className="flex items-center justify-between rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 shadow-sm">
                    <span className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-primary" /> {s.subject.name}
                    </span>
                    {s.isPrimary && <Badge variant="secondary" className="border border-violet-200 bg-violet-50 text-violet-700">Principale</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Niveaux enseignés</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {teacher.levels.map((l) => (
                    <Badge key={l.level.id} variant="outline">{l.level.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TARIFS */}
        <TabsContent value="tarifs">
          <Card>
            <CardHeader><CardTitle className="text-base">Tarification</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PriceCard label="Tarif / heure" amount={teacher.pricePerHour} />
                <PriceCard label="Tarif / séance" amount={teacher.pricePerSession} />
                <PriceCard label="Pack 4 séances" amount={teacher.pricePack4} />
                <PriceCard label="Pack 8 séances" amount={teacher.pricePack8} />
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Grille officielle" value="Active" />
                <InfoBox label="Commission plateforme" value={`${PLATFORM_COMMISSION_PERCENT}% du cours`} />
                <InfoBox label="Part professeur" value={`${TEACHER_PERCENT}% du cours + déplacement`} />
                <InfoBox
                  label="Paliers"
                  value={[
                    PRICE_TIERS.BASIC_7500.amount,
                    PRICE_TIERS.STANDARD_10000.amount,
                    PRICE_TIERS.RENFORCEMENT_12500.amount,
                    PRICE_TIERS.AVANCE_15000.amount,
                    PRICE_TIERS.PREMIUM_20000.amount,
                  ].map((amount) => formatFCFA(amount)).join(" / ")}
                />
              </div>
              <p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm font-medium text-blue-950/75">
                Les montants ci-dessus du profil restent indicatifs. À la réservation, le prix client est calculé par la grille officielle selon catégorie, niveau, système scolaire, format, pack, groupe et déplacement.
              </p>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-3">
                <Badge variant={teacher.offersHome ? "default" : "outline"}>À domicile</Badge>
                <Badge variant={teacher.offersOnline ? "default" : "outline"}>En ligne</Badge>
                <Badge variant={teacher.offersGroup ? "default" : "outline"}>Groupe</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITE */}
        <TabsContent value="activite">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Cours attribués" value={teacher.bookings.length} icon={GraduationCap} />
            <StatCard label="Cours réalisés" value={realized} icon={CheckCircle2} tone="success" />
            <StatCard label="En attente" value={pending} icon={Clock} tone="warning" />
            <StatCard label="Annulés" value={cancelled} icon={Clock} />
            <StatCard label="Remboursés" value={refunded} icon={Clock} />
            <StatCard label="En litige" value={disputed} icon={Clock} tone={disputed > 0 ? "danger" : "default"} />
            <StatCard label="Clients uniques" value={uniqueClients} icon={Users} />
            <StatCard label="Avis reçus" value={teacher._count.reviews} icon={MessageSquare} />
            <StatCard label="Note moyenne" value={teacher.rating.toFixed(1)} icon={MessageSquare} tone="primary" />
          </div>
        </TabsContent>

        {/* OPERATIONNEL */}
        <TabsContent value="operationnel" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Cours du jour" value={coursesToday} icon={Clock} tone={coursesToday ? "primary" : "default"} />
            <StatCard label="Tâches ouvertes" value={teacher.tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length} icon={ClipboardList} tone="primary" />
            <StatCard label="Tâches en retard" value={lateTasks} icon={Clock} tone={lateTasks ? "danger" : "default"} />
            <StatCard label="Critiques" value={criticalTasks} icon={ShieldAlert} tone={criticalTasks ? "danger" : "default"} />
            <StatCard label="Avertissements" value={teacher.warnings.length} icon={Siren} tone={teacher.warnings.length ? "warning" : "default"} />
            <StatCard label="Sanctions" value={teacher.sanctions.length} icon={ShieldAlert} tone={teacher.sanctions.length ? "danger" : "default"} />
            <StatCard label="Remplacements causés" value={teacher.oldReplacements.length} icon={Users} tone={teacher.oldReplacements.length ? "warning" : "default"} />
            <StatCard label="Dernière activité" value={teacher.lastActivityAt ? timeAgo(teacher.lastActivityAt) : "—"} icon={Clock} />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {criticalTasks > 0 && (
              <OperationalAlertCard title="Tâche critique ouverte" description="Une action urgente doit être traitée par l'administration ou le professeur." tone="red" />
            )}
            {lateTasks > 0 && (
              <OperationalAlertCard title="Retard à traiter" description="Une tâche ou un cours est marqué en retard. Vérifiez le professeur et le client." tone="amber" />
            )}
            {teacher.status === "OBSERVATION" && (
              <OperationalAlertCard title="Professeur en observation" description="Chaque nouvelle réservation liée à ce professeur doit être surveillée." tone="amber" />
            )}
            {teacher.status.includes("SUSPENDED") && (
              <OperationalAlertCard title="Professeur suspendu" description="Vérifiez les réservations à venir et préparez des remplacements." tone="red" />
            )}
            {teacher.status === "BLACKLISTED" && (
              <OperationalAlertCard title="Professeur blacklisté" description="Profil bloqué : contrôler les fonds, les réservations actives, les litiges et les remplacements nécessaires." tone="red" />
            )}
          </div>
          <TeacherActivityTimeline logs={actionLogs} warnings={teacher.warnings} sanctions={teacher.sanctions} />
        </TabsContent>

        {/* MESSAGES */}
        <TabsContent value="messages" className="space-y-4">
          <TeacherAdminMessagesClient
            teacherId={teacher.id}
            teacherName={teacher.professionalName || teacher.fullName}
            messages={adminMessages}
            bookings={taskBookingOptions}
            focusMessageId={sp.messageId ?? null}
          />
        </TabsContent>

        {/* TACHES */}
        <TabsContent value="taches" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teacher.tasks.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="p-6 text-sm text-muted-foreground">Aucune tâche professeur pour le moment.</CardContent>
              </Card>
            )}
            {teacher.tasks.map((task) => (
              <TeacherTaskCard
                key={task.id}
                task={task}
                teacherName={teacher.professionalName || teacher.fullName}
                teacherPhone={teacher.phone}
              />
            ))}
          </div>
        </TabsContent>

        {/* COURS */}
        <TabsContent value="cours" className="space-y-4">
          {targetBooking && (
            <Card className="border-[#1E2A78]/20 bg-blue-50/80 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#1E2A78]">Réservation ciblée depuis une notification</p>
                  <p className="mt-1 text-sm text-blue-950/75">
                    {targetBooking.reference} - {targetBooking.subjectName} avec {targetBooking.client.name}. Les actions ci-dessous concernent directement ce professeur.
                  </p>
                </div>
                <Button asChild variant="outline" className="border-blue-200 bg-white text-[#1E2A78] hover:bg-blue-50">
                  <Link href={`/admin/reservations/${targetBooking.id}`}>Ouvrir la réservation complète</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <TeacherWhatsAppMessageClient
            teacherId={teacher.id}
            teacherName={teacher.professionalName || teacher.fullName}
            teacherPhone={teacher.phone}
            bookings={missionMessageBookings}
            initialBookingId={targetBookingId}
          />
          <TeacherMissionLinksClient missions={JSON.parse(JSON.stringify(teacher.missionLinks))} />
          <Card>
            <CardHeader><CardTitle className="text-base">Cours du professeur</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-4 md:hidden">
                {teacher.bookings.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                    Aucun cours.
                  </p>
                ) : (
                  teacher.bookings.map((b) => {
                    const settlement = getTeacherFinancialSettlement(b, teacher.paymentAdjustments);
                    const paid = settlement.paid;
                    const remaining = settlement.remaining;
                    return (
                      <div
                        key={b.id}
                        id={`booking-${b.id}`}
                        className={
                          b.id === targetBookingId
                            ? "space-y-3 rounded-3xl border border-[#1E2A78]/35 bg-blue-50/85 p-4 shadow-[0_18px_50px_rgba(30,42,120,0.14)]"
                            : "space-y-3 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/admin/reservations/${b.id}`} className="block font-mono text-xs font-bold text-primary">
                              {b.reference}
                            </Link>
                            <p className="mt-1 truncate text-sm font-bold text-foreground">{b.subjectName}</p>
                            <p className="truncate text-xs text-muted-foreground">Client : {b.client.name}</p>
                          </div>
                          <BookingStatusBadge status={b.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                            <Money amount={b.totalPrice} className="mt-1 text-xs font-black" />
                          </div>
                          <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                            <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-violet-100 bg-violet-50/45 px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Payé prof</p>
                            <Money amount={paid} className="mt-1 text-xs font-black" />
                          </div>
                          <div className="rounded-2xl border border-violet-100 bg-violet-50/45 px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Reste dû</p>
                            <Money amount={remaining} className="mt-1 text-xs font-black" muted={remaining === 0} />
                          </div>
                        </div>

                        <TeacherCourseQuickActionsClient
                          teacherId={teacher.id}
                          teacherName={teacher.professionalName || teacher.fullName}
                          teacherPhone={teacher.phone}
                          booking={courseActionBooking(b)}
                        />
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
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Matière</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Payé prof</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Reste</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="min-w-[360px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacher.bookings.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">Aucun cours.</TableCell></TableRow>
                  )}
                  {teacher.bookings.map((b) => {
                    const settlement = getTeacherFinancialSettlement(b, teacher.paymentAdjustments);
                    const paid = settlement.paid;
                    const remaining = settlement.remaining;
                    return (
                      <TableRow
                        key={b.id}
                        id={`booking-row-${b.id}`}
                        className={b.id === targetBookingId ? "bg-blue-50/80 hover:bg-blue-50" : undefined}
                      >
                        <TableCell>
                          <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-primary hover:underline">{b.reference}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{b.client.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</TableCell>
                        <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm" /></TableCell>
                        <TableCell className="hidden xl:table-cell text-right"><Money amount={paid} className="text-sm font-medium" /></TableCell>
                        <TableCell className="hidden xl:table-cell text-right"><Money amount={remaining} className="text-sm" muted={remaining === 0} /></TableCell>
                        <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                        <TableCell>
                          <TeacherCourseQuickActionsClient
                            teacherId={teacher.id}
                            teacherName={teacher.professionalName || teacher.fullName}
                            teacherPhone={teacher.phone}
                            booking={courseActionBooking(b)}
                            compact
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAIEMENTS */}
        <TabsContent value="paiements" className="space-y-4">
          <TeacherPaymentSummary
            blocked={blockedFunds}
            toPay={toPay}
            netToPay={netToPay}
            paid={alreadyPaid}
            appliedAdjustments={appliedAdjustments}
            pendingAdjustments={pendingAdjustments}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-[#111B4D]" />
                Contexte professeur lié à la comptabilité
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Ce volet financier est rattaché à la même fiche interne : parcours, compétences, missions réalisées, paiements et retenues restent centralisés sur ce professeur.
              </p>
            </CardHeader>
            <CardContent>
              <TeacherMiniCv
                compact
                careerSummary={teacher.careerSummary}
                skills={teacher.skills}
                workHistory={teacher.workHistory}
                certifications={teacher.certifications || teacher.diploma}
                teachingAchievements={teacher.teachingAchievements}
                learnersCoached={teacher.learnersCoached}
              />
            </CardContent>
          </Card>

          {targetLedgerRow && (
            <Card className="border-[#1E2A78]/20 bg-blue-50/80 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-[#1E2A78]">Réservation comptable ciblée</p>
                    <p className="mt-1 text-sm text-blue-950/75">
                      {targetLedgerRow.reference} - {targetLedgerRow.subjectName} avec {targetLedgerRow.clientName}. Cette ligne est surlignée dans le grand livre du professeur.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="border-blue-200 bg-white text-[#1E2A78] hover:bg-blue-50">
                      <Link href={`/admin/reservations/${targetLedgerRow.id}`}>Ouvrir la réservation</Link>
                    </Button>
                    <Button asChild variant="outline" className="border-blue-200 bg-white text-[#1E2A78] hover:bg-blue-50">
                      <Link href={`/admin/professeurs/${teacher.id}?tab=cours&bookingId=${targetLedgerRow.id}`}>Voir mission</Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-7">
                  <div className="rounded-2xl border border-blue-100 bg-white/85 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">Statut réservation</p>
                    <div className="mt-2"><BookingStatusBadge status={targetLedgerRow.status} /></div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white/85 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">Statut fonds</p>
                    <div className="mt-2"><PaymentStatusBadge status={targetLedgerRow.paymentStatus} /></div>
                  </div>
                  <AmountTile label="Part cours" amount={targetLedgerRow.teacherCourseShare} />
                  <AmountTile label="Déplacement" amount={targetLedgerRow.transportFee} muted={targetLedgerRow.transportFee === 0} />
                  <AmountTile label="Net professeur" amount={targetLedgerRow.teacherNetAmount} />
                  <AmountTile label="Déjà payé" amount={targetLedgerRow.paid} muted={targetLedgerRow.paid === 0} />
                  <AmountTile label="Reste à traiter" amount={targetLedgerRow.remaining} danger={targetLedgerRow.remaining > 0} />
                </div>

                <p className="rounded-2xl border border-blue-100 bg-white/75 px-3 py-2 text-sm font-medium text-blue-950/75">
                  {getTargetPaymentHint(targetLedgerRow)}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situation comptable par réservation</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Lecture interne agence : chaque ligne montre ce qui est bloqué, déjà versé, retenu ou encore dû au professeur.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-4 md:hidden">
                {ledgerRows.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                    Aucune réservation comptable.
                  </p>
                ) : (
                  ledgerRows.map((row) => (
                    <div
                      key={row.id}
                      className={
                        row.id === targetBookingId
                          ? "space-y-3 rounded-3xl border border-[#1E2A78]/35 bg-blue-50/85 p-4 shadow-[0_18px_50px_rgba(30,42,120,0.14)]"
                          : "space-y-3 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/admin/reservations/${row.id}`} className="block font-mono text-xs font-bold text-primary">
                            {row.reference}
                          </Link>
                          <p className="mt-1 truncate text-sm font-bold text-foreground">{row.subjectName}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.clientName} · {formatDate(row.scheduledDate)}</p>
                        </div>
                        <PaymentStatusBadge status={row.paymentStatus} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <AmountMini label="Part cours" amount={row.teacherCourseShare} />
                        <AmountMini label="Déplacement" amount={row.transportFee} />
                        <AmountMini label="Net prof" amount={row.teacherNetAmount} />
                        <AmountMini label="Déjà payé" amount={row.paid} />
                        <AmountMini label="Retenu" amount={row.retained} danger={row.retained > 0} />
                        <AmountMini label="Reste dû" amount={row.remaining} danger={row.remaining > 0} />
                      </div>
                      <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
                        <Link href={`/admin/reservations/${row.id}`}>Ouvrir la réservation</Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réservation</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden lg:table-cell">Cours</TableHead>
                      <TableHead>Statut fonds</TableHead>
                      <TableHead className="text-right hidden xl:table-cell">Part cours</TableHead>
                      <TableHead className="text-right hidden xl:table-cell">Dépl.</TableHead>
                      <TableHead className="text-right">Net prof</TableHead>
                      <TableHead className="text-right">Payé</TableHead>
                      <TableHead className="text-right">Retenu</TableHead>
                      <TableHead className="text-right">Reste</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerRows.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="py-6 text-center text-sm text-muted-foreground">Aucune réservation comptable.</TableCell></TableRow>
                    )}
                    {ledgerRows.map((row) => (
                      <TableRow key={row.id} className={row.id === targetBookingId ? "bg-blue-50/80 hover:bg-blue-50" : undefined}>
                        <TableCell>
                          <Link href={`/admin/reservations/${row.id}`} className="font-mono text-sm font-bold text-primary hover:underline">
                            {row.reference}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{row.clientName}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          <span>{row.subjectName} · {row.levelName}</span>
                          {row.transportRouteLabel && (
                            <span className="mt-0.5 block text-[11px] font-medium text-violet-700">{row.transportRouteLabel}</span>
                          )}
                        </TableCell>
                        <TableCell><PaymentStatusBadge status={row.paymentStatus} /></TableCell>
                        <TableCell className="text-right hidden xl:table-cell"><Money amount={row.teacherCourseShare} className="text-sm" /></TableCell>
                        <TableCell className="text-right hidden xl:table-cell"><Money amount={row.transportFee} className="text-sm" muted={row.transportFee === 0} /></TableCell>
                        <TableCell className="text-right"><Money amount={row.teacherNetAmount} className="text-sm font-medium" /></TableCell>
                        <TableCell className="text-right"><Money amount={row.paid} className="text-sm" muted={row.paid === 0} /></TableCell>
                        <TableCell className="text-right"><Money amount={row.retained} className="text-sm" muted={row.retained === 0} /></TableCell>
                        <TableCell className="text-right"><Money amount={row.remaining} className="text-sm font-bold" muted={row.remaining === 0} /></TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/reservations/${row.id}`}>Voir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <TeacherPayoutClient
            teacherId={teacher.id}
            teacherName={teacher.professionalName || teacher.fullName}
            teacherPhone={teacher.defaultPayoutPhone || teacher.phone}
            teacherDefaultPayoutMethod={teacher.defaultPayoutMethod}
            targetBookingId={targetBookingId}
            targetPayoutRequestId={sp.payoutRequestId ?? null}
            dueAmount={netToPay}
            grossDueAmount={toPay}
            appliedAdjustments={appliedAdjustments}
            pendingAdjustments={pendingAdjustments}
            paidAmount={alreadyPaid}
            records={payoutRecords}
            payoutRequests={payoutRequests}
            ledgerRows={ledgerRows.map((row) => ({
              ...row,
              scheduledDate: row.scheduledDate.toISOString(),
            }))}
          />

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Retenues et ajustements comptables</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toute retenue financière validée ici réduit le net payable au professeur. Les retenues en attente ne sont pas encore appliquées.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-amber-800">
                {teacher.paymentAdjustments.length} ajustement(s)
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {teacher.paymentAdjustments.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-violet-100 p-4 text-sm text-muted-foreground">
                  Aucune retenue ni ajustement comptable.
                </p>
              ) : (
                teacher.paymentAdjustments.map((adjustment) => {
                  const statusTone = adjustment.status === "APPLIED"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : adjustment.status === "CANCELLED"
                      ? "border-slate-200 bg-slate-50 text-slate-700"
                      : "border-amber-200 bg-amber-50 text-amber-800";
                  return (
                    <div key={adjustment.id} className="rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={statusTone}>
                              {paymentAdjustmentStatusLabel[adjustment.status] ?? adjustment.status}
                            </Badge>
                            <span className="text-sm font-black text-foreground">{formatFCFA(adjustment.amount)}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{adjustment.reason}</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{adjustment.decision}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(adjustment.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {adjustment.booking ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/reservations/${adjustment.booking.id}`}>
                                {adjustment.booking.reference} - {adjustment.booking.subjectName}
                              </Link>
                            </Button>
                          ) : (
                            <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">Retenue globale</Badge>
                          )}
                          {adjustment.status === "PENDING" && (
                            <TeacherPaymentAdjustmentActionsClient
                              adjustmentId={adjustment.id}
                              amount={adjustment.amount}
                              reason={adjustment.reason}
                              bookingReference={adjustment.booking?.reference}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total généré" value={formatFCFA(totalGenerated)} icon={Wallet} tone="primary" />
            <StatCard label="Commission plateforme" value={formatFCFA(totalCommission)} icon={Award} tone="warning" />
            <StatCard label="Part cours professeur" value={formatFCFA(totalTeacherCourseShare)} icon={Wallet} tone="success" />
            <StatCard label="Déplacements reversés" value={formatFCFA(totalTransportFees)} icon={MapPin} tone="primary" />
            <StatCard label="Net prof total" value={formatFCFA(totalNet)} icon={Wallet} tone="success" />
            <StatCard label="Déjà payé au prof" value={formatFCFA(alreadyPaid)} icon={CheckCircle2} tone="success" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Fonds bloqués" value={formatFCFA(blockedFunds)} icon={Clock} tone="warning" />
            <StatCard label="Fonds validés" value={formatFCFA(validatedFunds)} icon={CheckCircle2} />
            <StatCard label="Net à payer au prof" value={formatFCFA(netToPay)} icon={Wallet} tone="danger" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Historique des transactions</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-4 md:hidden">
                {teacher.transactions.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                    Aucune transaction.
                  </p>
                ) : (
                  teacher.transactions.map((t) => (
                    <div key={t.id} className="space-y-3 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-primary">{t.reference}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{transactionTypeLabel(t.type)}</p>
                        </div>
                        <PaymentStatusBadge status={t.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                          <Money amount={t.amount} className="mt-1 text-xs font-black" />
                        </div>
                        <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Net prof</p>
                          <Money amount={t.teacherNet} className="mt-1 text-xs font-black" />
                        </div>
                        <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Commission</p>
                          <Money amount={t.commission} className="mt-1 text-xs font-black" />
                        </div>
                        <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(t.createdAt)}</p>
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
                    <TableHead className="text-right hidden md:table-cell">Commission</TableHead>
                    <TableHead className="text-right">Net prof</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacher.transactions.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</TableCell></TableRow>
                  )}
                  {teacher.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-mono">{t.reference}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{transactionTypeLabel(t.type)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      <TableCell className="text-right"><Money amount={t.amount} className="text-sm" /></TableCell>
                      <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                      <TableCell className="text-right"><Money amount={t.teacherNet} className="text-sm font-medium" /></TableCell>
                      <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISCIPLINE */}
        <TabsContent value="discipline" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Avertissements</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {teacher.warnings.length === 0 && <p className="text-sm text-muted-foreground">Aucun avertissement.</p>}
                {teacher.warnings.map((warning) => {
                  const warningLevel = teacherWarningLevelLabel(warning.level);
                  const warningReason = teacherWarningReasonLabel(warning.reason);
                  const warningMessage = [
                    `Bonjour ${teacher.professionalName || teacher.fullName},`,
                    "",
                    "Avertissement Compétence.",
                    warning.booking ? `Réservation : ${warning.booking.reference}` : "",
                    `Niveau : ${warningLevel}`,
                    `Motif : ${warningReason}`,
                    "",
                    warning.description,
                    warning.requestedAction ? `\nAction demandée : ${warning.requestedAction}` : "",
                    warning.responseDueAt ? `Délai de réponse : ${formatDateTime(warning.responseDueAt)}` : "",
                    warning.evidenceUrl ? `Preuve / document : ${warning.evidenceUrl}` : "",
                  ].filter(Boolean).join("\n");

                  return (
                    <div key={warning.id} className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-amber-200 bg-white/70 text-amber-800">{warningLevel}</Badge>
                          <Badge variant="outline" className={warning.adminOnly ? "border-slate-200 bg-slate-50 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-800"}>
                            {warning.adminOnly ? "Interne admin" : warning.sentToTeacher ? "Envoyé au professeur" : "Non envoyé"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(warning.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{warningReason}</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{warning.description}</p>
                      <div className="mt-3 grid gap-2">
                        {warning.booking && (
                          <p className="rounded-2xl border border-amber-100 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
                            Réservation {warning.booking.reference}
                          </p>
                        )}
                        {warning.requestedAction && (
                          <p className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-950">
                            <span className="font-bold">Action demandée :</span> {warning.requestedAction}
                          </p>
                        )}
                        {warning.responseDueAt && (
                          <p className="rounded-2xl border border-violet-100 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
                            Délai de réponse : {formatDateTime(warning.responseDueAt)}
                          </p>
                        )}
                        {warning.evidenceUrl && (
                          <Button asChild size="sm" variant="outline" className="w-fit rounded-xl bg-white/80">
                            <a href={warning.evidenceUrl} target="_blank" rel="noreferrer">
                              Ouvrir la preuve
                            </a>
                          </Button>
                        )}
                      </div>
                      {!warning.adminOnly && (
                        <TeacherWarningActionsClient teacherPhone={teacher.phone} message={warningMessage} />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Sanctions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {teacher.sanctions.length === 0 && <p className="text-sm text-muted-foreground">Aucune sanction.</p>}
                {teacher.sanctions.map((sanction) => {
                  const sanctionType = teacherSanctionTypeLabel(sanction.type);
                  const sanctionStatus = teacherSanctionStatusLabel(sanction.status);
                  return (
                    <div key={sanction.id} className="rounded-3xl border border-red-100 bg-red-50/60 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="outline" className="border-red-200 bg-white/70 text-red-700">{sanctionType}</Badge>
                        <Badge variant="outline" className={sanction.status === "APPLIED" ? "border-red-200 bg-white/70 text-red-700" : sanction.status === "CANCELLED" ? "border-slate-200 bg-white/70 text-slate-700" : "border-amber-200 bg-white/70 text-amber-800"}>
                          {sanctionStatus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{sanction.reason}</p>
                      {sanction.description && <p className="mt-1 text-sm text-muted-foreground">{sanction.description}</p>}
                      {sanction.financial && (
                        <p className="mt-2 text-sm font-semibold text-red-700">
                          Retenue {sanction.status === "APPLIED" ? "appliquée" : sanction.status === "CANCELLED" ? "annulée" : "en attente"}: {formatFCFA(sanction.amount)}
                        </p>
                      )}
                      {sanction.status === "PENDING_VALIDATION" && (
                        <TeacherSanctionActionsClient sanctionId={sanction.id} financial={sanction.financial} amount={sanction.amount} />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* REMPLACEMENTS */}
        <TabsContent value="remplacements">
          <ReplacementHistoryTable replacements={replacements} />
        </TabsContent>

        {/* AVIS */}
        <TabsContent value="avis" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader><CardTitle className="text-base">Synthèse des avis clients</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <InfoBox label="Note publique" value={`${effectivePublicRating.toFixed(1)}/5`} />
                  <InfoBox label="Note admin" value={teacher.adminRating > 0 ? `${teacher.adminRating.toFixed(1)}/5` : "Non noté"} />
                  <InfoBox label="Avis publiés" value={`${publishedReviews.length}`} />
                  <InfoBox label="Avis masqués" value={`${hiddenReviews}`} />
                  <InfoBox label="Avis critiques" value={`${criticalReviews.length}`} danger={criticalReviews.length > 0} />
                  <InfoBox label="À traiter" value={`${reviewsToProcess.length}`} danger={reviewsToProcess.length > 0} />
                </div>
                <div className="space-y-2">
                  {reviewBuckets.map((bucket) => {
                    const pct = publishedReviews.length ? Math.round((bucket.count / publishedReviews.length) * 100) : 0;
                    return (
                      <div key={bucket.rating} className="grid grid-cols-[54px_1fr_44px] items-center gap-2 text-xs">
                        <span className="font-semibold text-foreground">{bucket.rating}/5</span>
                        <span className="h-2 overflow-hidden rounded-full bg-violet-50">
                          <span className="block h-full rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-right text-muted-foreground">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  Si aucun avis client n'est encore publié, l'administration peut utiliser une note plateforme visible publiquement. Les commentaires internes restent réservés au dashboard admin.
                </p>
                <div className={reviewDecision.tone === "red" ? "rounded-3xl border border-red-100 bg-red-50/75 p-4" : reviewDecision.tone === "amber" ? "rounded-3xl border border-amber-100 bg-amber-50/75 p-4" : "rounded-3xl border border-blue-100 bg-blue-50/65 p-4"}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className={reviewDecision.tone === "red" ? "text-xs font-bold uppercase tracking-wide text-red-900/65" : reviewDecision.tone === "amber" ? "text-xs font-bold uppercase tracking-wide text-amber-900/65" : "text-xs font-bold uppercase tracking-wide text-blue-900/65"}>
                        Décision qualité avis
                      </p>
                      <p className={reviewDecision.tone === "red" ? "mt-1 text-sm font-black text-red-950" : reviewDecision.tone === "amber" ? "mt-1 text-sm font-black text-amber-950" : "mt-1 text-sm font-black text-blue-950"}>
                        {reviewDecision.title}
                      </p>
                      <p className={reviewDecision.tone === "red" ? "mt-1 text-sm text-red-950/72" : reviewDecision.tone === "amber" ? "mt-1 text-sm text-amber-950/72" : "mt-1 text-sm text-blue-950/72"}>
                        {reviewDecision.description}
                      </p>
                    </div>
                    {latestSensitiveReview && (
                      <Badge variant="outline" className={reviewDecision.tone === "red" ? "w-fit border-red-200 bg-white text-red-800" : "w-fit border-amber-200 bg-white text-amber-800"}>
                        Dernier signal : {latestSensitiveReview.rating}/5
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Notes admin sur le professeur</CardTitle></CardHeader>
              <CardContent>
                <AdminTeacherNotesClient
                  teacherId={teacher.id}
                  internalNote={teacher.internalNote}
                  operationalComment={teacher.operationalComment}
                  qualityScore={teacher.qualityScore}
                  adminRating={teacher.adminRating}
                  adminRatingNote={teacher.adminRatingNote}
                  adminRatingPublic={teacher.adminRatingPublic}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Avis reçus</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {teacher.reviews.length === 0 && <p className="text-sm text-muted-foreground">Aucun avis.</p>}
              {teacher.reviews.map((r) => {
                const severity = reviewSeverity(r.rating);
                return (
                  <div
                    key={r.id}
                    id={`review-${r.id}`}
                    className={
                      r.bookingId === targetBookingId
                        ? "rounded-2xl border border-[#1E2A78]/35 bg-blue-50/85 p-3 shadow-[0_18px_50px_rgba(30,42,120,0.14)]"
                        : "rounded-2xl border border-violet-100 bg-white/80 p-3 shadow-sm"
                    }
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{r.client.name}</span>
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Note {r.rating}/5</Badge>
                        {severity && (
                          <Badge variant="outline" className={severity.className}>
                            {severity.label}
                          </Badge>
                        )}
                        {r.bookingId === targetBookingId && (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Avis ciblé</Badge>
                        )}
                        {!r.published && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Masqué</Badge>}
                        <Badge variant="outline" className={reviewAdminStatusClass[r.adminStatus] ?? reviewAdminStatusClass.NEW}>
                          {reviewAdminStatusLabel[r.adminStatus] ?? r.adminStatus}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-foreground">{r.comment}</p>}
                    <p className={r.rating <= 2 ? "mt-3 rounded-2xl border border-red-100 bg-red-50/70 p-3 text-xs font-medium text-red-900" : r.rating === 3 ? "mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-xs font-medium text-amber-900" : "mt-3 rounded-2xl border border-violet-100 bg-violet-50/45 p-3 text-xs font-medium text-violet-900"}>
                      <span className="font-black">Action recommandée : </span>
                      {getReviewActionHint(r.rating, r.adminStatus)}
                    </p>
                    {r.adminNote && (
                      <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-900/65">Note admin avis</p>
                        <p className="mt-1 leading-relaxed text-blue-950">{r.adminNote}</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">Réservation {r.booking.reference}</p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ReviewOperationalActionsClient
                          reviewId={r.id}
                          teacherId={teacher.id}
                          teacherName={teacher.professionalName || teacher.fullName}
                          bookingId={r.bookingId}
                          bookingReference={r.booking.reference}
                          clientName={r.client.name}
                          rating={r.rating}
                          comment={r.comment}
                          compact
                        />
                        <AvisClient review={{ id: r.id, published: r.published, adminStatus: r.adminStatus, adminNote: r.adminNote }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORIQUE NOTIFS */}
        <TabsContent value="historique">
          <TeacherNotificationHistoryClient
            teacherName={teacher.professionalName || teacher.fullName}
            teacherPhone={teacher.phone}
            notifications={JSON.parse(JSON.stringify(teacher.notifications))}
          />
        </TabsContent>

        {/* JOURNAL */}
        <TabsContent value="journal">
          <AdminActionLog logs={actionLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function PriceCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground"><Money amount={amount} /></p>
    </div>
  );
}

function InfoBox({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-100 bg-red-50/75 p-3 shadow-sm" : "rounded-2xl border border-violet-100 bg-white/80 p-3 shadow-sm"}>
      <p className={danger ? "text-xs text-red-900/70" : "text-xs text-muted-foreground"}>{label}</p>
      <p className={danger ? "mt-1 text-sm font-black text-red-950" : "mt-1 text-sm font-semibold text-foreground"}>{value}</p>
    </div>
  );
}

function getReviewDecision({
  criticalCount,
  watchCount,
  toProcessCount,
  hiddenCount,
}: {
  criticalCount: number;
  watchCount: number;
  toProcessCount: number;
  hiddenCount: number;
}) {
  if (criticalCount > 0) {
    return {
      tone: "red" as const,
      title: "Contrôle immédiat requis",
      description: "Au moins un avis critique est présent. Contacter le client, vérifier la réservation, puis décider d'un suivi professeur, avertissement ou remplacement.",
    };
  }
  if (toProcessCount > 0 || watchCount > 0) {
    return {
      tone: "amber" as const,
      title: "Suivi qualité à finaliser",
      description: "Des avis nécessitent une décision admin. Créer une tâche de suivi, consigner la note interne et clôturer le statut quand le dossier est traité.",
    };
  }
  if (hiddenCount > 0) {
    return {
      tone: "amber" as const,
      title: "Modération à revoir",
      description: "Un ou plusieurs avis sont masqués. Vérifier s'ils doivent rester internes ou être publiés après contrôle.",
    };
  }
  return {
    tone: "blue" as const,
    title: "Avis sous contrôle",
    description: "Aucun signal critique immédiat. Continuer à surveiller les prochaines évaluations et les commentaires clients.",
  };
}

function getReviewActionHint(rating: number, adminStatus: string) {
  if (rating <= 2) {
    return "contacter le client, ouvrir ou compléter une tâche qualité, puis avertir le professeur si le problème est confirmé.";
  }
  if (rating === 3) {
    return "vérifier le commentaire et noter les points à améliorer dans le suivi interne du professeur.";
  }
  if (["TO_REVIEW", "CONTACT_CLIENT", "CONTACT_TEACHER", "ESCALATED"].includes(adminStatus)) {
    return "terminer le traitement admin, ajouter une note interne et passer l'avis en résolu ou escaladé selon la décision.";
  }
  return "aucune action urgente ; conserver l'avis dans le suivi qualité du professeur.";
}

function AmountMini({ label, amount, danger = false }: { label: string; amount: number; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-100 bg-red-50/50 px-3 py-2" : "rounded-2xl border border-violet-100 bg-white/85 px-3 py-2"}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Money amount={amount} className={danger ? "mt-1 text-xs font-black text-red-700" : "mt-1 text-xs font-black"} muted={amount === 0} />
    </div>
  );
}

function AmountTile({ label, amount, danger = false, muted = false }: { label: string; amount: number; danger?: boolean; muted?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2" : "rounded-2xl border border-blue-100 bg-white/85 px-3 py-2"}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">{label}</p>
      <Money amount={amount} className={danger ? "mt-2 text-sm font-black text-red-700" : "mt-2 text-sm font-black text-blue-950"} muted={muted} />
    </div>
  );
}

function getTargetPaymentHint(row: { paymentStatus: string; remaining: number; retained: number }) {
  if (row.paymentStatus === "BLOCKED") {
    return "Fonds encore bloqués : vérifier réalisation du cours, confirmation client et absence de litige avant tout versement.";
  }
  if (row.paymentStatus === "TO_PAY_TEACHER" && row.remaining > 0) {
    return "Paiement prêt à traiter : l'admin peut enregistrer un versement réel dans la comptabilité interne du professeur.";
  }
  if (row.paymentStatus === "DISPUTED") {
    return "Paiement suspendu : résoudre le litige avant paiement, remboursement ou retenue manuelle.";
  }
  if (row.retained > 0 && row.remaining <= 0) {
    return "Réservation soldée avec retenue : conserver la justification admin et la preuve de décision.";
  }
  if (row.remaining <= 0) {
    return "Réservation soldée : aucun reste comptable immédiat pour cette ligne.";
  }
  return "Ligne à contrôler : comparer le statut fonds, le reste dû et les décisions admin avant de payer.";
}
