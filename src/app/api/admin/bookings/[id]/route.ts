import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { PAID_CLIENT_TRANSACTION_STATUSES, getCancellationPenaltySplit, getCancellationPolicy } from "@/lib/cancellation-policy";
import {
  assertBookingRefundPayoutSafetyInTransaction,
  BookingRefundWorkflowError,
  finalizeBookingRefundInTransaction,
  prepareBookingSessionsForRefundInTransaction,
} from "@/lib/booking-refund-finalization";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import {
  TRANSPORT_FEES,
  buildNeighborhoodAliasMap,
  calculateGrandAbidjanTransportFee,
  parsePricingSnapshot,
  pricingSnapshotToJson,
} from "@/lib/pricing";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import {
  buildTeacherReplacementSessionSnapshots,
  calculateReplacementTransportTotal,
} from "@/lib/teacher-replacement-financials";
import {
  hasRefundableClientFunds,
  hasVerifiedClientFunds,
  hasVerifiedPayDunyaClientPayment,
  isPaymentReadyForCourseProgressWithProof,
  PAYMENT_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";
import { absoluteAppUrl } from "@/lib/public-url";
import { isBookingFinanciallyTerminal, isBookingRefundInProgressOrFinal } from "@/lib/booking-financial-state";
import { normalizeBookingRefundExternalReference } from "@/lib/booking-refund";
import { lockTeacherPayoutBalances } from "@/lib/teacher-payout-reservations";

const ACTIVE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const RECENT_ISSUE_DAYS = 90;
const REPLACEABLE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "DISPUTED"] as const;
const REPLACEABLE_PAYMENT_STATUSES = ["RECEIVED", "BLOCKED", "VALIDATED", "DISPUTED"] as const;

async function getAdmin() {
  return requireAdminApi("BOOKINGS_MANAGE");
}

function includesNormalized(values: string[], target?: string | null) {
  if (!target) return false;
  const normalizedTarget = target.trim().toLocaleLowerCase("fr-FR");
  return values.some((value) => value.trim().toLocaleLowerCase("fr-FR") === normalizedTarget);
}

function parsePreferredDays(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function dayKeyFromLabel(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr-FR");
  const day = WEEK_DAYS.find((item) => item.key === normalized || item.label.toLocaleLowerCase("fr-FR") === normalized);
  return day?.key ?? "";
}

function dayKeyFromDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const indexToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return indexToKey[parsed.getDay()] ?? "";
}

function slotKeyFromTime(value?: string | null) {
  if (!value) return "";
  const hourMatch = value.match(/(\d{1,2})(?:h|:)/i);
  if (!hourMatch) return "";
  const hour = Number(hourMatch[1]);
  if (!Number.isFinite(hour)) return "";
  return TWO_HOUR_SLOTS.find((slot) => {
    const [start, end] = slot.key.split("-").map(Number);
    return hour >= start && hour < end;
  })?.key ?? "";
}

function dateKey(value?: Date | string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function hasActiveConflict(
  teacherBookings: { status: string; scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string | null }[],
  booking: { id: string; scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string },
) {
  const bookingDate = dateKey(booking.scheduledDate);
  const bookingTime = booking.scheduledTime || booking.preferredTime;
  if (!bookingDate || !bookingTime) return false;
  return teacherBookings.some((item) => (
    ACTIVE_BOOKING_STATUSES.includes(item.status as (typeof ACTIVE_BOOKING_STATUSES)[number]) &&
    dateKey(item.scheduledDate) === bookingDate &&
    Boolean((item.scheduledTime || item.preferredTime || "").trim()) &&
    (item.scheduledTime || item.preferredTime) === bookingTime
  ));
}

function isAvailabilityCompatible(rawAvailability: string | null, booking: { preferredDays: string; scheduledDate: Date | null; scheduledTime: string | null }) {
  const availability = parseAvailability(rawAvailability);
  const requestedDays = Array.from(new Set([
    ...parsePreferredDays(booking.preferredDays).map(dayKeyFromLabel),
    dayKeyFromDate(booking.scheduledDate),
  ].filter(Boolean)));
  if (requestedDays.length === 0) return true;

  const scheduledSlot = slotKeyFromTime(booking.scheduledTime);
  if (scheduledSlot) {
    return requestedDays.some((day) => Boolean(availability[day]?.[scheduledSlot]));
  }

  return requestedDays.some((day) => TWO_HOUR_SLOTS.some((slot) => Boolean(availability[day]?.[slot.key])));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("BOOKINGS_VIEW"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true, commune: true, quartier: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true, phone: true, email: true, commune: true, quartier: true, addressHint: true } },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { include: { client: { select: { name: true } } } },
      disputes: { include: { openedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const action: string = body.action;
  const authorizedAdmin = await requireAdminApi(action === "refund" ? "FINANCE_MANAGE" : "BOOKINGS_MANAGE");
  if (!authorizedAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: true,
      client: true,
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
      teacherPaymentAdjustments: { where: { status: "APPLIED" } },
      clientRefundRequests: { orderBy: { createdAt: "desc" } },
      sessions: { orderBy: { sequence: "asc" } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });

  const now = new Date();

  try {
    switch (action) {
      case "validate": {
        if (booking.status !== "PENDING_ADMIN_VALIDATION" && booking.status !== "PAID") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
          return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "CONFIRMED", confirmedAt: now },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Réservation confirmée",
            message: `La réservation ${booking.reference} a été confirmée et est prête à affecter.`,
            type: "BOOKING_CONFIRMED",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "assign": {
        if (booking.status !== "CONFIRMED" && booking.status !== "ASSIGNED") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
          return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "ASSIGNED", assignedAt: now },
        });
        // Notifier le professeur et historiser le canal choisi.
        const channel = body.channel || "SMS";
        const message = body.message || `Bonjour ${booking.teacher.professionalName || booking.teacher.fullName}, vous avez été affecté à la réservation ${booking.reference}. Matière: ${booking.subjectName}, niveau ${booking.levelName}. Contact client: ${booking.client.phone}. Merci de confirmer.`;
        const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
        await db.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: `Affectation cours ${booking.reference}`,
            message,
            channel,
            sent: true,
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: `Affectation professeur - ${booking.reference}`,
            message,
            type: "TEACHER_ASSIGNED",
            recipientType: "TEACHER",
            recipientName: teacherName,
            channel,
            status: "SENT",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: booking.teacherId,
            clientId: booking.clientId,
            sentAt: now,
            link: `/admin/professeurs/${booking.teacherId}?tab=cours&bookingId=${booking.id}`,
            actionLabel: "Ouvrir l'espace professeur",
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "change_teacher": {
        if (!REPLACEABLE_BOOKING_STATUSES.includes(booking.status as (typeof REPLACEABLE_BOOKING_STATUSES)[number])) {
          return NextResponse.json({ error: "Cette réservation n'est plus remplaçable à ce stade opérationnel." }, { status: 400 });
        }
        if (!REPLACEABLE_PAYMENT_STATUSES.includes(booking.paymentStatus as (typeof REPLACEABLE_PAYMENT_STATUSES)[number])) {
          return NextResponse.json({ error: "Cette réservation n'est plus remplaçable avec ce statut de paiement." }, { status: 400 });
        }
        if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
          return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
        }
        if ((booking.teacherPaidAmount || 0) > 0) {
          return NextResponse.json({ error: "Un versement professeur est déjà enregistré sur cette réservation. Traitez la comptabilité avant remplacement." }, { status: 400 });
        }
        const newTeacherId = body.newTeacherId;
        const reason = body.reason || "OTHER";
        const details = body.details || "Remplacement décidé par le service client.";
        if (!newTeacherId) {
          return NextResponse.json({ error: "Nouveau professeur requis" }, { status: 400 });
        }
        if (newTeacherId === booking.teacherId) {
          return NextResponse.json({ error: "Le nouveau professeur doit être différent du professeur actuel" }, { status: 400 });
        }
        const newTeacher = await db.teacher.findUnique({
          where: { id: newTeacherId },
          include: {
            subjects: { include: { subject: true } },
            levels: { include: { level: true } },
            zones: { include: { commune: true } },
            bookings: {
              where: {
                OR: [
                  { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
                  { disputes: { some: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } } } },
                ],
              },
              select: {
                status: true,
                scheduledDate: true,
                scheduledTime: true,
                preferredTime: true,
                disputes: {
                  where: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } },
                  select: { id: true },
                },
              },
              take: 30,
            },
          },
        });
        if (!newTeacher || newTeacher.status !== "ACTIVE" || !newTeacher.photoUrl) {
          return NextResponse.json({ error: "Professeur introuvable ou inactif" }, { status: 400 });
        }
        const teachesSubject = includesNormalized(newTeacher.subjects.map((item) => item.subject.name), booking.subjectName);
        const teachesLevel = includesNormalized(newTeacher.levels.map((item) => item.level.name), booking.levelName);
        const formatCompatible = booking.courseFormat === "HOME" ? newTeacher.offersHome : newTeacher.offersOnline;
        if (!teachesSubject) {
          return NextResponse.json({ error: "Le professeur remplaçant n'enseigne pas la matière de cette réservation." }, { status: 400 });
        }
        if (!teachesLevel) {
          return NextResponse.json({ error: "Le professeur remplaçant n'enseigne pas le niveau de cette réservation." }, { status: 400 });
        }
        if (!formatCompatible) {
          return NextResponse.json({ error: "Le professeur remplaçant n'est pas compatible avec le format du cours." }, { status: 400 });
        }
        if (!isAvailabilityCompatible(newTeacher.availability, booking)) {
          return NextResponse.json({ error: "La disponibilité du professeur remplaçant ne correspond pas au jour ou au créneau de cette réservation." }, { status: 400 });
        }
        if (hasActiveConflict(newTeacher.bookings, booking)) {
          return NextResponse.json({ error: "Le professeur remplaçant a déjà une mission active sur ce créneau." }, { status: 400 });
        }
        const recentDisputeCount = newTeacher.bookings.reduce((sum, item) => sum + item.disputes.length, 0);
        if (recentDisputeCount > 0) {
          return NextResponse.json({ error: "Le professeur remplaçant a un litige récent. Choisissez un autre profil ou traitez le risque avant remplacement." }, { status: 400 });
        }
        const admin = await getAdmin();
        const oldTeacherName = booking.teacher.professionalName || booking.teacher.fullName;
        const newTeacherName = newTeacher.professionalName || newTeacher.fullName;
        const oldNet = booking.teacherNetAmount;
        const courseAmount = booking.courseAmount || Math.max(0, booking.totalPrice - (booking.transportFee || 0) - (booking.materialFee || 0));
        const nextCommission = booking.commissionAmount;
        const nextTeacherCoursePayout = booking.teacherPayoutAmount || Math.max(0, courseAmount - nextCommission);
        const replacementPricingCommuneNames = Array.from(new Set(
          [newTeacher.commune, booking.commune]
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value)),
        ));
        const [platformSettings, grandAbidjanCommunes, destination, neighborhoodAliasRows] = await Promise.all([
          getPlatformRuntimeSettings(),
          db.commune.findMany({ where: { transportClass: "GRAND_ABIDJAN", isActive: true }, select: { name: true } }),
          booking.commune
            ? db.commune.findFirst({ where: { name: { equals: booking.commune, mode: "insensitive" }, isActive: true }, select: { transportFeeOverride: true } })
            : null,
          replacementPricingCommuneNames.length > 0
            ? db.communeQuarter.findMany({
                where: {
                  isActive: true,
                  commune: {
                    isActive: true,
                    OR: replacementPricingCommuneNames.map((name) => ({
                      name: { equals: name, mode: "insensitive" as const },
                    })),
                  },
                },
                select: {
                  id: true,
                  name: true,
                  aliases: true,
                  commune: { select: { id: true, name: true } },
                },
              })
            : Promise.resolve([]),
        ]);
        const neighborhoodAliases = buildNeighborhoodAliasMap(
          neighborhoodAliasRows.map((quarter) => ({
            id: quarter.id,
            communeId: quarter.commune.id,
            name: quarter.name,
            aliases: quarter.aliases,
            communeName: quarter.commune.name,
          })),
        );
        const replacementTransport = booking.courseFormat === "HOME"
          ? calculateGrandAbidjanTransportFee({
              teacherCommune: newTeacher.commune,
              teacherQuartier: newTeacher.quartier,
              teacherZoneNames: newTeacher.zones.map((zone) => zone.commune.name),
              clientCommune: booking.commune,
              clientQuartier: booking.quartier,
              transportFeeAmounts: platformSettings.transportFees,
              grandAbidjanCommuneNames: grandAbidjanCommunes.map((item) => item.name),
              neighborhoodAliases,
            })
          : null;
        const nextTransportFeePerSession = booking.courseFormat !== "HOME"
          ? 0
          : replacementTransport?.key !== TRANSPORT_FEES.SAME_NEIGHBORHOOD.key
            && destination?.transportFeeOverride !== null && destination?.transportFeeOverride !== undefined
            ? destination.transportFeeOverride
            : (replacementTransport?.amount ?? 0);
        const { transportFee: nextTransportFee, transportFeePerSession } = calculateReplacementTransportTotal(
          nextTransportFeePerSession,
          booking.sessionsCount,
        );
        const nextNet = nextTeacherCoursePayout + nextTransportFee;
        const financialImpact = nextNet - oldNet;
        const existingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
        const nextPricingSnapshot = existingSnapshot
          ? pricingSnapshotToJson({
              ...existingSnapshot,
              transportFee: nextTransportFee,
              transportFeePerSession,
              transportFeeKey: replacementTransport?.key ?? existingSnapshot.transportFeeKey,
              transportFeeLabel: replacementTransport?.label ?? existingSnapshot.transportFeeLabel,
              transportRouteLabel: replacementTransport?.routeLabel ?? existingSnapshot.transportRouteLabel,
              transportRuleLabel: replacementTransport?.ruleLabel ?? existingSnapshot.transportRuleLabel,
              transportCoveredByTeacherZone: replacementTransport?.coveredByTeacherZone ?? existingSnapshot.transportCoveredByTeacherZone,
              totalTeacherReceives: nextNet,
            })
          : booking.pricingSnapshot;
        const dateLabel = booking.scheduledDate?.toLocaleDateString("fr-FR") ?? "À confirmer";
        const timeLabel = booking.scheduledTime || booking.preferredTime || "À confirmer";
        const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
        const locationLabel = booking.courseFormat === "ONLINE"
          ? (booking.onlineLink || "Lien en ligne à confirmer")
          : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
        const clientMessage = body.clientMessage || [
          `Bonjour ${booking.client.name},`,
          "",
          `Nous vous informons que votre professeur initialement prévu, ${oldTeacherName}, a été remplacé pour votre cours de ${booking.subjectName}.`,
          "",
          `Nouveau professeur : ${newTeacherName}`,
          `Matière : ${booking.subjectName}`,
          `Niveau : ${booking.levelName}`,
          `Date : ${dateLabel}`,
          `Heure : ${timeLabel}`,
          `Format : ${formatLabel}`,
          "",
          "Votre paiement reste sécurisé et votre réservation reste confirmée.",
          "Merci de votre compréhension.",
        ].join("\n");
        const oldTeacherMessage = body.oldTeacherMessage || [
          `Bonjour ${oldTeacherName},`,
          "",
          "Vous avez été retiré de la réservation suivante :",
          "",
          `Client : ${booking.client.name}`,
          `Cours : ${booking.subjectName}`,
          `Niveau : ${booking.levelName}`,
          `Date : ${dateLabel}`,
          `Heure : ${timeLabel}`,
          "",
          `Motif : ${details}`,
          "",
          "Merci de contacter le service client si nécessaire.",
        ].join("\n");
        const missionToken = randomBytes(32).toString("hex");
        const missionUrl = `/mission/${missionToken}`;
        const absoluteMissionUrl = absoluteAppUrl(missionUrl, req);
        const missionExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const newTeacherMessage = body.newTeacherMessage || [
          `Bonjour ${newTeacherName},`,
          "",
          "Un cours vous a été attribué en remplacement.",
          "",
          `Client : ${booking.client.name}`,
          `Contact : ${booking.client.phone ?? "à confirmer par le service client"}`,
          `Cours : ${booking.subjectName}`,
          `Niveau : ${booking.levelName}`,
          `Date : ${dateLabel}`,
          `Heure : ${timeLabel}`,
          `Lieu : ${locationLabel}`,
          `Format : ${formatLabel}`,
          replacementTransport ? `Trajet déplacement : ${replacementTransport.routeLabel}` : "",
          replacementTransport ? `Frais déplacement : ${transportFeePerSession.toLocaleString("fr-FR")} FCFA par séance, soit ${nextTransportFee.toLocaleString("fr-FR")} FCFA pour le pack` : "",
          `Montant net à recevoir : ${nextNet.toLocaleString("fr-FR")} FCFA`,
          "",
          `Lien mission sécurisé : ${absoluteMissionUrl}`,
          "",
          "Merci de confirmer rapidement votre disponibilité.",
        ].join("\n");
        await db.$transaction(async (tx) => {
          const lockedTeacherIds = await lockTeacherPayoutBalances(tx, [
            booking.teacherId,
            newTeacherId,
            ...booking.sessions.map((session) => session.teacherId),
          ]);
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            select: {
              teacherId: true,
              teacherPaidAmount: true,
              status: true,
              paymentStatus: true,
              updatedAt: true,
            },
          });
          if (
            !currentBooking
            || currentBooking.teacherId !== booking.teacherId
            || currentBooking.teacherPaidAmount > 0
            || currentBooking.status !== booking.status
            || currentBooking.paymentStatus !== booking.paymentStatus
            || currentBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
            || currentBooking.status === "DISPUTED"
            || currentBooking.paymentStatus === "DISPUTED"
            || isBookingFinanciallyTerminal(currentBooking)
            || isBookingRefundInProgressOrFinal(currentBooking)
          ) {
            throw new Error("BOOKING_REPLACEMENT_CONFLICT");
          }
          const activeDispute = await tx.dispute.findFirst({
            where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (activeDispute) {
            throw new Error("BOOKING_REPLACEMENT_CONFLICT");
          }

          const currentSessions = await tx.bookingSession.findMany({
            where: { bookingId: booking.id },
            orderBy: { sequence: "asc" },
            include: {
              payoutAllocations: {
                select: { payout: { select: { status: true } } },
              },
            },
          });
          if (currentSessions.some((session) => !lockedTeacherIds.includes(session.teacherId))) {
            throw new Error("BOOKING_REPLACEMENT_CONFLICT");
          }
          const sessionSnapshots = buildTeacherReplacementSessionSnapshots({
            sessions: currentSessions.map((session) => ({
              id: session.id,
              status: session.status,
              completedAt: session.completedAt,
              clientValidatedAt: session.clientValidatedAt,
              releasedAt: session.releasedAt,
              paidAt: session.paidAt,
              releasedAmount: session.releasedAmount,
              paidAmount: session.paidAmount,
              retainedAmount: session.retainedAmount,
              payoutStatuses: session.payoutAllocations.map((allocation) => allocation.payout.status),
            })),
            expectedSessionsCount: booking.sessionsCount,
            newTeacherId,
            courseAmount,
            commissionAmount: nextCommission,
            teacherCourseAmount: nextTeacherCoursePayout,
            transportFee: nextTransportFee,
          });

          const bookingReassigned = await tx.booking.updateMany({
            where: {
              id,
              teacherId: currentBooking.teacherId,
              status: currentBooking.status,
              paymentStatus: currentBooking.paymentStatus,
              updatedAt: currentBooking.updatedAt,
            },
            data: {
              teacherId: newTeacherId,
              // Le remplacement conserve la grille officielle de la réservation et le paiement client vérifié.
              commissionRate: booking.commissionRate,
              commissionAmount: nextCommission,
              teacherRate: booking.teacherRate,
              teacherPayoutAmount: nextTeacherCoursePayout,
              transportFee: nextTransportFee,
              transportFeeKey: replacementTransport?.key ?? booking.transportFeeKey,
              totalTeacherReceives: nextNet,
              teacherNetAmount: nextNet,
              pricingSnapshot: nextPricingSnapshot,
            },
          });
          if (bookingReassigned.count !== 1) {
            throw new Error("BOOKING_REPLACEMENT_CONFLICT");
          }
          await tx.transaction.updateMany({
            where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
            data: {
              teacherId: newTeacherId,
              commission: nextCommission,
              teacherNet: nextNet,
            },
          });
          for (const session of sessionSnapshots) {
            const sourceSession = currentSessions.find((item) => item.id === session.id);
            if (!sourceSession) throw new Error("BOOKING_REPLACEMENT_CONFLICT");
            const sessionReassigned = await tx.bookingSession.updateMany({
              where: {
                id: session.id,
                bookingId: booking.id,
                teacherId: sourceSession.teacherId,
                status: sourceSession.status,
                paidAmount: sourceSession.paidAmount,
                releasedAmount: sourceSession.releasedAmount,
                retainedAmount: sourceSession.retainedAmount,
              },
              data: {
                teacherId: session.teacherId,
                proposedTeacherId: null,
                status: session.status,
                courseAmount: session.courseAmount,
                commissionAmount: session.commissionAmount,
                teacherCourseAmount: session.teacherCourseAmount,
                transportFee: session.transportFee,
                teacherNetAmount: session.teacherNetAmount,
                proposedDate: null,
                proposedTime: null,
                unavailableReason: null,
              },
            });
            if (sessionReassigned.count !== 1) {
              throw new Error("BOOKING_REPLACEMENT_CONFLICT");
            }
          }
          await tx.bookingSessionHistory.createMany({
            data: sessionSnapshots.map((session) => ({
              bookingSessionId: session.id,
              actorType: "ADMIN",
              actorId: admin?.id,
              action: "TEACHER_REPLACED",
              fromStatus: currentSessions.find((item) => item.id === session.id)?.status,
              toStatus: session.status,
              oldTeacherId: booking.teacherId,
              newTeacherId,
              detail: `Remplacement global ${booking.reference}. Snapshot net séance: ${session.teacherNetAmount} FCFA, dont transport ${session.transportFee} FCFA.`,
            })),
          });
          await tx.teacherReplacement.create({
            data: {
              bookingId: booking.id,
              oldTeacherId: booking.teacherId,
              newTeacherId,
              reason,
              details,
              financialImpact,
              clientMessage,
              oldTeacherMessage,
              newTeacherMessage,
              status: "APPLIED",
              createdById: admin?.id,
              appliedAt: now,
            },
          });
        }, { isolationLevel: "Serializable" });
        await db.teacherTask.updateMany({
          where: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            status: { notIn: ["DONE", "CANCELLED"] },
            type: { not: "ADMIN_ACTION" },
          },
          data: {
            status: "CANCELLED",
            completedAt: now,
          },
        });
        await db.teacherMissionLink.updateMany({
          where: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
          },
          data: { status: "EXPIRED" },
        });
        await db.notification.updateMany({
          where: {
            bookingId: booking.id,
            teacherId: booking.teacherId,
            status: { in: ["CREATED", "SENT", "RELAUNCHED"] },
            type: { in: ["TEACHER_REMINDER", "TEACHER_NOT_CONFIRMED", "TEACHER_MISSION_LINK", "REPLACEMENT_RECOMMENDED"] },
          },
          data: {
            read: true,
            readAt: now,
            status: "EXPIRED",
            response: `Clôturé automatiquement après remplacement par ${newTeacherName}.`,
          },
        });
        await db.teacherNotification.createMany({
          data: [
            {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              title: `Retrait de réservation ${booking.reference}`,
              message: oldTeacherMessage,
              channel: "INTERNAL",
              sent: true,
              status: "SENT",
              sentById: admin?.id,
            },
            {
              teacherId: newTeacherId,
              bookingId: booking.id,
              title: `Cours attribué en remplacement ${booking.reference}`,
              message: newTeacherMessage,
              channel: "INTERNAL",
              sent: true,
              status: "SENT",
              sentById: admin?.id,
            },
          ],
        });
        await db.teacherTask.create({
          data: {
            teacherId: newTeacherId,
            bookingId: booking.id,
            type: "CONFIRM_AVAILABILITY",
            title: "Confirmer le remplacement",
            description: `Confirmer rapidement la disponibilité pour la réservation ${booking.reference}.`,
            priority: "URGENT",
            status: "SENT_TO_TEACHER",
            dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            createdById: admin?.id,
          },
        });
        await db.teacherMissionLink.create({
          data: {
            token: missionToken,
            teacherId: newTeacherId,
            bookingId: booking.id,
            title: `Mission remplacement ${booking.reference} - ${booking.subjectName}`,
            instructions: "Vous recevez cette mission en remplacement. Merci de confirmer rapidement votre disponibilité ou de signaler un problème.",
            expiresAt: missionExpiresAt,
            createdById: admin?.id,
          },
        });
        await db.clientCommunication.create({
          data: {
            clientId: booking.clientId,
            bookingId: booking.id,
            type: "TEACHER_CHANGE",
            channel: "INTERNAL",
            subject: `Remplacement professeur - ${booking.reference}`,
            content: clientMessage,
            priority: "IMPORTANT",
            status: "SENT",
            sentById: admin?.id,
          },
        });
        await db.notification.create({
          data: {
            userId: booking.clientId,
            title: "Professeur remplacé",
            message: clientMessage,
            type: "TEACHER_REPLACED",
            recipientType: "CLIENT",
            recipientName: booking.client.name,
            channel: "INTERNAL",
            status: "SENT",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: newTeacherId,
            clientId: booking.clientId,
            adminId: admin?.id,
            sentAt: now,
            link: `/client/reservations/${booking.id}`,
            actionLabel: "Voir réservation",
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Professeur changé",
            message: `Le professeur de la réservation ${booking.reference} a été changé de ${oldTeacherName} vers ${newTeacherName}.`,
            type: "TEACHER_CHANGED",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "SENT",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: newTeacherId,
            clientId: booking.clientId,
            adminId: admin?.id,
            sentAt: now,
            link: `/admin/professeurs/${newTeacherId}?tab=cours&bookingId=${booking.id}`,
            actionLabel: "Ouvrir l'espace professeur",
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Lien mission remplacement envoyé",
            message: `Lien privé généré pour ${newTeacherName} sur le remplacement ${booking.reference}.`,
            type: "TEACHER_MISSION_LINK",
            recipientType: "TEACHER",
            recipientName: newTeacherName,
            channel: "PRIVATE_LINK",
            status: "SENT",
            priority: "URGENT",
            bookingId: booking.id,
            teacherId: newTeacherId,
            clientId: booking.clientId,
            adminId: admin?.id,
            sentAt: now,
            expiresAt: missionExpiresAt,
            link: `/admin/professeurs/${newTeacherId}?tab=cours&bookingId=${booking.id}`,
            actionLabel: "Ouvrir l'espace professeur",
          },
        });
        await db.adminActionLog.create({
          data: {
            adminId: admin?.id,
            action: "Remplacement professeur",
            entityType: "Booking",
            entityId: booking.id,
            detail: `${oldTeacherName} remplacé par ${newTeacherName}. Motif: ${reason}. Impact financier net: ${financialImpact} FCFA.`,
            oldStatus: booking.teacherId,
            newStatus: newTeacherId,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "mark_done": {
        if (booking.sessions.length > 0) {
          return NextResponse.json({ error: "Marquez la séance précise comme effectuée dans le suivi du pack." }, { status: 409 });
        }
        if (booking.status !== "ASSIGNED" && booking.status !== "IN_PROGRESS" && booking.status !== "CONFIRMED") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        if (!isPaymentReadyForCourseProgressWithProof(booking)) {
          return NextResponse.json({
            error: "Impossible de marquer le cours terminé : le paiement n'est pas confirmé côté serveur et bloqué.",
          }, { status: 409 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "PENDING_CLIENT_VALIDATION", courseDoneAt: now },
        });
        // Notification admin
        await db.notification.create({
          data: {
            userId: null,
            title: "Cours effectué — validation client requise",
            message: `Le cours de la réservation ${booking.reference} a été marqué comme effectué. En attente de validation par le client.`,
            type: "COURSE_DONE",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "pay_teacher": {
        return NextResponse.json({
          error: "Ce raccourci de paiement manuel est désactivé. Utilisez le versement Jèko depuis la comptabilité professeur afin que le solde ne soit débité qu'après confirmation du fournisseur.",
          payoutUrl: `/admin/professeurs/${booking.teacherId}?tab=paiements&bookingId=${booking.id}`,
        }, { status: 409 });
      }
      case "cancel": {
        const admin = await getAdmin();
        const cancellationActor = ["ADMIN", "TEACHER", "CLIENT"].includes(body.cancellationActor)
          ? body.cancellationActor
          : "ADMIN";
        const wasPaid = hasVerifiedClientFunds(booking.paymentStatus) && hasVerifiedPayDunyaClientPayment(booking);
        const paidAggregate = wasPaid
          ? await db.transaction.aggregate({
              where: {
                bookingId: booking.id,
                type: "CLIENT_PAYMENT",
                status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
              },
              _sum: { amount: true },
            })
          : null;
        const paidAmount = paidAggregate?._sum.amount ?? 0;
        const policy = getCancellationPolicy({ ...booking, paidAmount: wasPaid ? paidAmount : null }, now, cancellationActor);
        const penaltySplit = getCancellationPenaltySplit(policy, cancellationActor);
        const nextPaymentStatus = !wasPaid
          ? booking.paymentStatus
          : policy.refundAmount <= 0
            ? "RETAINED"
            : policy.refundAmount >= policy.baseAmount
              ? "REFUND_PENDING"
              : "PARTIAL_REFUND_PENDING";
        await db.$transaction(async (tx) => {
          await assertBookingRefundPayoutSafetyInTransaction(tx, booking.id);
          await tx.$queryRaw(Prisma.sql`
            SELECT "id"
            FROM "Booking"
            WHERE "id" = ${booking.id}
            FOR UPDATE
          `);
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { id: true, status: true, paymentStatus: true, updatedAt: true },
          });
          if (!currentBooking) {
            throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
          }
          if (
            currentBooking.status !== booking.status
            || currentBooking.paymentStatus !== booking.paymentStatus
            || currentBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
            || currentBooking.status === "DISPUTED"
            || currentBooking.paymentStatus === "DISPUTED"
            || isBookingFinanciallyTerminal(currentBooking)
            || isBookingRefundInProgressOrFinal(currentBooking)
          ) {
            throw new BookingRefundWorkflowError(
              "La réservation vient de changer ou possède déjà un état financier final.",
              409,
              "BOOKING_CANCELLATION_STATE_CONFLICT",
            );
          }
          await prepareBookingSessionsForRefundInTransaction(tx, {
            bookingId: booking.id,
            actorId: authorizedAdmin.id,
            actorType: "ADMIN",
            now,
          });
          const cancelled = await tx.booking.updateMany({
            where: {
              id,
              status: currentBooking.status,
              paymentStatus: currentBooking.paymentStatus,
              updatedAt: currentBooking.updatedAt,
            },
            data: {
              status: "CANCELLED",
              paymentStatus: nextPaymentStatus,
              cancelledAt: now,
              cancelledBy: cancellationActor,
              cancellationReason: body.reason || "Annulation par le service client",
              cancellationDetail: body.description || "Annulation décidée par le service client.",
              cancellationWindow: policy.code,
              cancellationFeeRate: policy.feeRate,
              cancellationFeeAmount: policy.feeAmount,
              cancellationPenaltyTeacherRate: penaltySplit.teacherRate,
              cancellationPenaltyTeacherAmount: penaltySplit.teacherAmount,
              cancellationPenaltyPlatformRate: penaltySplit.platformRate,
              cancellationPenaltyPlatformAmount: penaltySplit.platformAmount,
              cancellationRefundAmount: wasPaid ? policy.refundAmount : 0,
            },
          });
          if (cancelled.count !== 1) {
            throw new BookingRefundWorkflowError(
              "La réservation vient de changer pendant l'annulation.",
              409,
              "BOOKING_CANCELLATION_CONCURRENT_UPDATE",
            );
          }
          const activeDispute = await tx.dispute.findFirst({
            where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (activeDispute) {
            throw new BookingRefundWorkflowError(
              "Clôturez d'abord le litige ouvert avant d'annuler cette réservation.",
              409,
              "BOOKING_ACTIVE_DISPUTE",
            );
          }
          if (wasPaid) {
            await tx.transaction.updateMany({
              where: {
                bookingId: booking.id,
                type: "CLIENT_PAYMENT",
                status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
              },
              data: { status: nextPaymentStatus },
            });
          }
        }, { isolationLevel: "Serializable" });
        await db.notification.create({
          data: {
            userId: null,
            title: "Réservation annulée",
            message: `La réservation ${booking.reference} a été annulée par ${cancellationActor}. Frais: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA. Part professeur: ${penaltySplit.teacherAmount.toLocaleString("fr-FR")} FCFA. Part plateforme: ${penaltySplit.platformAmount.toLocaleString("fr-FR")} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA. Remboursement: ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
            type: "BOOKING_CANCELLED",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "SENT",
            priority: policy.feeRate > 0 ? "URGENT" : "IMPORTANT",
            bookingId: booking.id,
            teacherId: booking.teacherId,
            clientId: booking.clientId,
            adminId: admin?.id,
            sentAt: now,
            link: `/admin/reservations/${id}`,
            actionLabel: "Voir annulation",
          },
        });
        if (wasPaid) {
          await db.notification.create({
            data: {
              userId: booking.clientId,
              title: "Votre réservation a été annulée",
              message: `La réservation ${booking.reference} est annulée. Remboursement prévu: ${policy.refundAmount.toLocaleString("fr-FR")} FCFA. Frais retenus: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA. Frais service paiement non remboursés: ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA.`,
              type: "BOOKING_CANCELLED",
              recipientType: "CLIENT",
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: booking.teacherId,
              clientId: booking.clientId,
              adminId: admin?.id,
              sentAt: now,
              link: `/client/reservations/${booking.id}`,
              actionLabel: "Voir le détail",
            },
          });
        }
        await db.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: "Réservation annulée",
            message: [
              `La réservation ${booking.reference} a été annulée par ${cancellationActor}.`,
              `Client : ${booking.client.name}`,
              `Cours : ${booking.subjectName}`,
              `Niveau : ${booking.levelName}`,
              `Motif : ${body.reason || "Non renseigné"}`,
              `Décision financière client : frais ${policy.feeAmount.toLocaleString("fr-FR")} FCFA, part professeur ${penaltySplit.teacherAmount.toLocaleString("fr-FR")} FCFA, part plateforme ${penaltySplit.platformAmount.toLocaleString("fr-FR")} FCFA, frais service non remboursés ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA, remboursement ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
              "Merci de ne pas vous présenter au cours sans nouvelle instruction du service client.",
            ].join("\n"),
            channel: "WHATSAPP",
            sent: false,
            status: "PENDING",
            sentById: admin?.id,
          },
        });
        if (cancellationActor === "TEACHER") {
          await db.teacherTask.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              type: "ADMIN_ACTION",
              title: `Annulation côté professeur - ${booking.reference}`,
              description: `Réservation annulée pour motif côté professeur. Vérifier s'il faut avertir, sanctionner ou remplacer le professeur. Motif: ${body.reason || "Non renseigné"}.`,
              priority: "URGENT",
              status: "TODO",
              dueAt: now,
              createdById: admin?.id,
            },
          });
        } else {
          await db.teacherTask.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              type: "ADMIN_ACTION",
              title: `Informer professeur - annulation ${booking.reference}`,
              description: `Réservation annulée par ${cancellationActor}. Prévenir le professeur, confirmer qu'il ne se déplace pas et conserver la trace du canal utilisé. Motif: ${body.reason || "Non renseigné"}.`,
              priority: policy.feeRate > 0 ? "URGENT" : "IMPORTANT",
              status: "TODO",
              dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
              createdById: admin?.id,
            },
          });
        }
        await db.teacher.update({
          where: { id: booking.teacherId },
          data: { lastActivityAt: now },
        });
        await db.adminActionLog.create({
          data: {
            adminId: admin?.id,
            action: "Annulation réservation",
            entityType: "Booking",
            entityId: booking.id,
            detail: `Réservation annulée (${cancellationActor}). Motif: ${body.reason || "Annulation par le service client"}. Frais: ${policy.feeAmount} FCFA. Part professeur: ${penaltySplit.teacherAmount} FCFA. Part plateforme: ${penaltySplit.platformAmount} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount} FCFA. Remboursement: ${policy.refundAmount} FCFA.`,
            oldStatus: booking.status,
            newStatus: "CANCELLED",
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "refund": {
        const externalReference = typeof body.externalReference === "string"
          ? normalizeBookingRefundExternalReference(body.externalReference)
          : "";
        if (externalReference.length < 3 || externalReference.length > 160) {
          return NextResponse.json({
            error: "Saisissez une référence de dépôt valide (3 à 160 caractères).",
          }, { status: 400 });
        }
        const result = await db.$transaction(async (tx) => {
          const { snapshot, refundRequest, calculation, refundTransaction } = await finalizeBookingRefundInTransaction(tx, {
            bookingId: id,
            externalReference,
            processedById: authorizedAdmin.id,
            now,
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Remboursement effectué",
              message: `Le client de la réservation ${snapshot.reference} a été remboursé (${calculation.refundAmount} FCFA) via ${refundRequest.method}. Référence dépôt: ${externalReference}. Les frais service paiement non remboursés sont de ${snapshot.paymentServiceFeeAmount || 0} FCFA.`,
              type: "REFUND",
              link: `/admin/reservations/${id}`,
            },
          });
          if ((snapshot.cancellationPenaltyTeacherAmount || 0) > 0) {
            await tx.notification.create({
              data: {
                userId: null,
                title: "Indemnité professeur à traiter",
                message: `Après remboursement client de ${snapshot.reference}, une indemnité professeur de ${snapshot.cancellationPenaltyTeacherAmount.toLocaleString("fr-FR")} FCFA est disponible. Part plateforme sur pénalité: ${snapshot.cancellationPenaltyPlatformAmount.toLocaleString("fr-FR")} FCFA.`,
                type: "TEACHER_PAYOUT",
                recipientType: "ADMIN",
                channel: "INTERNAL",
                status: "CREATED",
                priority: "IMPORTANT",
                teacherId: snapshot.teacherId,
                bookingId: snapshot.id,
                link: `/admin/professeurs/${snapshot.teacherId}?tab=paiements&bookingId=${snapshot.id}`,
                actionLabel: "Ouvrir comptabilité",
              },
            });
            await tx.teacherNotification.create({
              data: {
                teacherId: snapshot.teacherId,
                bookingId: snapshot.id,
                title: `Indemnité annulation - ${snapshot.reference}`,
                message: `Le service client a traité le remboursement de la réservation ${snapshot.reference}. Une indemnité professeur de ${snapshot.cancellationPenaltyTeacherAmount.toLocaleString("fr-FR")} FCFA est visible dans votre comptabilité et pourra être demandée selon le solde disponible.`,
                channel: "INTERNAL",
                sent: false,
                status: "PENDING",
              },
            });
          }
          await tx.notification.create({
            data: {
              userId: snapshot.clientId,
              title: "Remboursement effectué",
              message: `Votre remboursement de ${calculation.refundAmount.toLocaleString("fr-FR")} FCFA pour ${snapshot.reference} a été marqué effectué. Référence dépôt: ${externalReference}. Les frais de service paiement non remboursés sont de ${(snapshot.paymentServiceFeeAmount || 0).toLocaleString("fr-FR")} FCFA.`,
              type: "REFUND",
              recipientType: "CLIENT",
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: snapshot.id,
              teacherId: snapshot.teacherId,
              clientId: snapshot.clientId,
              sentAt: now,
              link: `/client/reservations/${snapshot.id}`,
              actionLabel: "Voir remboursement",
            },
          });
          await tx.clientCommunication.create({
            data: {
              clientId: snapshot.clientId,
              bookingId: snapshot.id,
              type: "PAYMENT",
              channel: "INTERNAL",
              subject: `Remboursement effectué ${snapshot.reference}`,
              content: `Votre remboursement est marqué effectué.\nMontant déposé : ${calculation.refundAmount.toLocaleString("fr-FR")} FCFA\nMoyen : ${refundRequest.method}\nNuméro : ${refundRequest.paymentPhone}\nTitulaire : ${refundRequest.accountName ?? "Non renseigné"}\nRéférence dépôt : ${externalReference}\nFrais de service paiement non remboursés : ${(snapshot.paymentServiceFeeAmount || 0).toLocaleString("fr-FR")} FCFA`,
              priority: "IMPORTANT",
              status: "SENT",
              sentById: authorizedAdmin.id,
            },
          });
          await tx.adminActionLog.create({
            data: {
              adminId: authorizedAdmin.id,
              action: "Remboursement client effectué",
              entityType: "ClientRefundRequest",
              entityId: refundRequest.id,
              detail: `Remboursement ${refundRequest.reference} pour ${snapshot.reference}: ${calculation.refundAmount} FCFA via ${refundRequest.method} au ${refundRequest.paymentPhone}. Référence dépôt: ${externalReference}. Transaction: ${refundTransaction.reference}.`,
              oldStatus: refundRequest.status,
              newStatus: "PAID",
            },
          });

          return {
            ok: true,
            amount: calculation.refundAmount,
            remainingRefundableAmount: Math.max(0, calculation.remainingPolicyRefundAmount - calculation.refundAmount),
            refundTransactionReference: refundTransaction.reference,
          };
        }, { isolationLevel: "Serializable" });
        return NextResponse.json(result);
      }
      case "dispute": {
        if (isBookingFinanciallyTerminal(booking) || isBookingRefundInProgressOrFinal(booking)) {
          return NextResponse.json({ error: "Cette réservation est financièrement clôturée et ne peut plus être remise en litige." }, { status: 409 });
        }
        if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
          return NextResponse.json({
            error: "Impossible d'ouvrir un litige financier : aucun paiement confirmé côté serveur n'est rattaché à cette réservation.",
          }, { status: 409 });
        }
        const reason = body.reason || "Litige ouvert par le service client";
        const description = body.description || "";
        await db.$transaction(async (tx) => {
          await assertBookingRefundPayoutSafetyInTransaction(tx, booking.id);
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            include: { transactions: { where: { type: "CLIENT_PAYMENT" } } },
          });
          if (!currentBooking) {
            throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
          }
          if (isBookingFinanciallyTerminal(currentBooking) || isBookingRefundInProgressOrFinal(currentBooking)) {
            throw new BookingRefundWorkflowError(
              "Cette réservation est financièrement clôturée et ne peut plus être remise en litige.",
              409,
              "BOOKING_FINANCIALLY_TERMINAL",
            );
          }
          if (!hasVerifiedClientFunds(currentBooking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(currentBooking)) {
            throw new BookingRefundWorkflowError(
              "Impossible d'ouvrir un litige financier : aucun paiement confirmé côté serveur n'est rattaché à cette réservation.",
              409,
              "CLIENT_PAYMENT_NOT_VERIFIED",
            );
          }
          const openDispute = await tx.dispute.findFirst({
            where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (currentBooking.status === "DISPUTED" || openDispute) {
            throw new BookingRefundWorkflowError(
              "Un litige est déjà ouvert sur cette réservation.",
              409,
              "DISPUTE_ALREADY_OPEN",
            );
          }
          const transitioned = await tx.booking.updateMany({
            where: { id, status: currentBooking.status, paymentStatus: currentBooking.paymentStatus },
            data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
          });
          if (transitioned.count !== 1) {
            throw new BookingRefundWorkflowError("La réservation a changé et ne peut pas être remise en litige.", 409, "BOOKING_TERMINAL_STATE_CONFLICT");
          }
          await tx.transaction.updateMany({
            where: {
              bookingId: booking.id,
              type: "CLIENT_PAYMENT",
              status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
            },
            data: { status: "DISPUTED" },
          });
          const createdDispute = await tx.dispute.create({
            data: { bookingId: booking.id, openedById: authorizedAdmin.id, reason, description, status: "OPEN" },
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Litige ouvert",
              message: `Un litige a été ouvert sur la réservation ${booking.reference}: ${reason}`,
              type: "DISPUTE_OPENED",
              link: `/admin/litiges/${createdDispute.id}`,
              actionLabel: "Traiter litige",
            },
          });
        }, { isolationLevel: "Serializable" });
        return NextResponse.json({ ok: true });
      }
      case "send_teacher_info": {
        const channel = body.channel || "SMS";
        const message = body.message || `Rappel: la réservation ${booking.reference} vous est assignée.`;
        await db.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: `Information — ${booking.reference}`,
            message,
            channel,
            sent: true,
          },
        });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (e: any) {
    if (e instanceof BookingRefundWorkflowError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (action === "refund" && (e?.code === "P2002" || e?.code === "P2034")) {
      return NextResponse.json({
        error: "Ce remboursement est déjà enregistré ou vient d'être traité depuis une autre fenêtre.",
        code: "REFUND_ALREADY_RECORDED",
      }, { status: 409 });
    }
    if (e?.code === "P2034") {
      return NextResponse.json({
        error: "La réservation vient de changer depuis une autre fenêtre. Rechargez-la avant de recommencer.",
        code: "BOOKING_SERIALIZATION_CONFLICT",
      }, { status: 409 });
    }
    if (e?.message === "BOOKING_REPLACEMENT_CONFLICT") {
      return NextResponse.json({
        error: "Le professeur ou le solde de cette réservation a changé pendant le remplacement. Rechargez la page avant de réessayer.",
      }, { status: 409 });
    }
    if (typeof e?.message === "string" && e.message.startsWith("SESSION_COUNT_MISMATCH:")) {
      return NextResponse.json({
        error: "Le découpage des séances de ce pack est incomplet. Corrigez les séances avant de remplacer le professeur afin de préserver la comptabilité.",
      }, { status: 409 });
    }
    if (typeof e?.message === "string" && e.message.startsWith("SESSION_REPLACEMENT_BLOCKED:")) {
      const reason = e.message.split(":").slice(2).join(":");
      return NextResponse.json({
        error: `Remplacement refusé : ${reason}. Traitez d'abord la séance et sa comptabilité.`,
      }, { status: 409 });
    }
    console.error("admin/booking PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
