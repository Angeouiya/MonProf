import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";
import { PAID_CLIENT_TRANSACTION_STATUSES, getCancellationPolicy } from "@/lib/cancellation-policy";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import {
  PLATFORM_COMMISSION_PERCENT,
  TEACHER_PERCENT,
  calculateGrandAbidjanTransportFee,
  parsePricingSnapshot,
  pricingSnapshotToJson,
} from "@/lib/pricing";
import {
  hasRefundableClientFunds,
  hasVerifiedClientFunds,
  hasVerifiedPayDunyaClientPayment,
  isPaymentReadyForCourseProgressWithProof,
  PAYDUNYA_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";

const ACTIVE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const RECENT_ISSUE_DAYS = 90;
const REPLACEABLE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "DISPUTED"] as const;
const REPLACEABLE_PAYMENT_STATUSES = ["RECEIVED", "BLOCKED", "VALIDATED", "DISPUTED"] as const;
const ACTIVE_PAYOUT_METHODS = ["WAVE", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY"] as const;

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

async function getAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  return { id: (session.user as any).id as string, name: session.user.name || "Admin" };
}

function includesNormalized(values: string[], target?: string | null) {
  if (!target) return false;
  const normalizedTarget = target.trim().toLocaleLowerCase("fr-FR");
  return values.some((value) => value.trim().toLocaleLowerCase("fr-FR") === normalizedTarget);
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
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
  if (!(await isAdmin())) {
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
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: true,
      client: true,
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
      teacherPaymentAdjustments: { where: { status: "APPLIED" } },
      clientRefundRequests: { orderBy: { createdAt: "desc" } },
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
          return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
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
          return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
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
          return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
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
        const nextCommission = booking.commissionAmount || Math.round((courseAmount * PLATFORM_COMMISSION_PERCENT) / 100);
        const nextTeacherCoursePayout = booking.teacherPayoutAmount || Math.max(0, courseAmount - nextCommission);
        const replacementTransport = booking.courseFormat === "HOME"
          ? calculateGrandAbidjanTransportFee({
              teacherCommune: newTeacher.commune,
              teacherZoneNames: newTeacher.zones.map((zone) => zone.commune.name),
              clientCommune: booking.commune,
            })
          : null;
        if (replacementTransport?.isQuoteOnly) {
          return NextResponse.json({
            error: `Le déplacement du professeur remplaçant nécessite un devis manuel (${replacementTransport.routeLabel}).`,
          }, { status: 400 });
        }
        const nextTransportFee = replacementTransport?.amount ?? 0;
        const nextNet = nextTeacherCoursePayout + nextTransportFee;
        const financialImpact = nextNet - oldNet;
        const existingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
        const nextPricingSnapshot = existingSnapshot
          ? pricingSnapshotToJson({
              ...existingSnapshot,
              transportFee: nextTransportFee,
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
        const absoluteMissionUrl = new URL(missionUrl, req.nextUrl.origin).toString();
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
          replacementTransport ? `Frais déplacement : ${nextTransportFee.toLocaleString("fr-FR")} FCFA` : "",
          `Montant net à recevoir : ${nextNet.toLocaleString("fr-FR")} FCFA`,
          "",
          `Lien mission sécurisé : ${absoluteMissionUrl}`,
          "",
          "Merci de confirmer rapidement votre disponibilité.",
        ].join("\n");
        await db.booking.update({
          where: { id },
          data: {
            teacherId: newTeacherId,
            // Le remplacement conserve la grille officielle de la réservation.
            commissionRate: PLATFORM_COMMISSION_PERCENT,
            commissionAmount: nextCommission,
            teacherRate: TEACHER_PERCENT,
            teacherPayoutAmount: nextTeacherCoursePayout,
            transportFee: nextTransportFee,
            transportFeeKey: replacementTransport?.key ?? booking.transportFeeKey,
            totalTeacherReceives: nextNet,
            teacherNetAmount: nextNet,
            pricingSnapshot: nextPricingSnapshot,
          },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: {
            teacherId: newTeacherId,
            commission: nextCommission,
            teacherNet: nextNet,
          },
        });
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
        await db.teacherReplacement.create({
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
        if (booking.status !== "ASSIGNED" && booking.status !== "IN_PROGRESS" && booking.status !== "CONFIRMED") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        if (!isPaymentReadyForCourseProgressWithProof(booking)) {
          return NextResponse.json({
            error: "Impossible de marquer le cours terminé: le paiement PayDunya n'est pas vérifié et bloqué.",
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
        if (booking.paymentStatus !== "TO_PAY_TEACHER") {
          return NextResponse.json({ error: "Le paiement n'est pas à libérer" }, { status: 400 });
        }
        if (!hasVerifiedPayDunyaClientPayment(booking)) {
          return NextResponse.json({
            error: "Impossible de payer le professeur: aucun paiement client PayDunya vérifié n'est rattaché à cette réservation.",
          }, { status: 409 });
        }
        const admin = await getAdmin();
        const payoutMethod = typeof body.method === "string" && ACTIVE_PAYOUT_METHODS.includes(body.method as (typeof ACTIVE_PAYOUT_METHODS)[number])
          ? (body.method as PaymentMethod)
          : booking.paymentMethod;
        const paymentPhone = normalizePhone(body.paymentPhone);
        const alreadyPaid = booking.teacherPaidAmount || 0;
        const retained = booking.teacherPaymentAdjustments.reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
        const remaining = Math.max(0, booking.teacherNetAmount - alreadyPaid - retained);
        if (remaining <= 0) {
          if (alreadyPaid + retained >= booking.teacherNetAmount) {
            await db.booking.update({
              where: { id },
              data: {
                status: "TEACHER_PAID",
                paymentStatus: "TEACHER_PAID",
                teacherPaidAt: now,
              },
            });
            return NextResponse.json({ ok: true, settledByRetention: true });
          }
          return NextResponse.json({ error: "Cette réservation est déjà soldée côté professeur." }, { status: 400 });
        }
        if (!payoutMethod || !ACTIVE_PAYOUT_METHODS.includes(payoutMethod as (typeof ACTIVE_PAYOUT_METHODS)[number])) {
          return NextResponse.json({ error: "Choisissez le moyen de paiement professeur." }, { status: 400 });
        }
        if (paymentPhone.length < 8 || paymentPhone.length > 20) {
          return NextResponse.json({ error: "Numéro de paiement professeur requis et invalide." }, { status: 400 });
        }
        await db.$transaction(async (tx) => {
          const payout = await tx.teacherPayoutRecord.create({
            data: {
              reference: generateReference("PAY-PROF"),
              teacherId: booking.teacherId,
              amount: remaining,
              method: payoutMethod,
              paymentPhone,
              note: `Paiement complet de la réservation ${booking.reference}`,
              paidAt: now,
              createdById: admin?.id,
              allocations: {
                create: [{ bookingId: booking.id, amount: remaining }],
              },
            },
          });
          await tx.booking.update({
            where: { id },
            data: {
              status: "TEACHER_PAID",
              paymentStatus: "TEACHER_PAID",
              teacherPaidAmount: alreadyPaid + remaining,
              teacherPaidAt: now,
            },
          });
          await tx.transaction.create({
            data: {
              reference: generateReference("TX-PROF"),
              bookingId: booking.id,
              teacherId: booking.teacherId,
              amount: remaining,
              commission: 0,
              teacherNet: remaining,
              type: "TEACHER_PAYOUT",
              status: "TEACHER_PAID",
              method: payoutMethod,
              paidAt: now,
            },
          });
          await tx.transaction.updateMany({
            where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
            data: { status: "TEACHER_PAID", paidAt: now },
          });
          await tx.adminActionLog.create({
            data: {
              adminId: admin?.id,
              action: "Paiement réservation professeur",
              entityType: "Booking",
              entityId: booking.id,
              detail: `Paiement professeur enregistré pour ${booking.reference} : ${remaining} FCFA (${payout.reference})${retained > 0 ? `, retenue appliquée ${retained} FCFA` : ""}.`,
              oldStatus: "TO_PAY_TEACHER",
              newStatus: "TEACHER_PAID",
            },
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Professeur payé",
              message: `Le professeur de la réservation ${booking.reference} a été payé (${remaining} FCFA net versé${retained > 0 ? `, ${retained} FCFA retenus` : ""}).`,
              type: "TEACHER_PAID",
              link: `/admin/reservations/${id}`,
            },
          });
        });
        return NextResponse.json({ ok: true });
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
        const nextPaymentStatus = !wasPaid
          ? booking.paymentStatus
          : policy.refundAmount <= 0
            ? "RETAINED"
            : policy.refundAmount >= policy.baseAmount
              ? "REFUND_PENDING"
              : "PARTIAL_REFUND_PENDING";
        await db.booking.update({
          where: { id },
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
            cancellationRefundAmount: wasPaid ? policy.refundAmount : 0,
          },
        });
        if (wasPaid) {
          await db.transaction.updateMany({
            where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
            data: { status: nextPaymentStatus },
          });
        }
        await db.notification.create({
          data: {
            userId: null,
            title: "Réservation annulée",
            message: `La réservation ${booking.reference} a été annulée par ${cancellationActor}. Frais: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA. Remboursement: ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
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
              `Décision financière client : frais ${policy.feeAmount.toLocaleString("fr-FR")} FCFA, frais service non remboursés ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA, remboursement ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
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
            detail: `Réservation annulée (${cancellationActor}). Motif: ${body.reason || "Annulation par le service client"}. Frais: ${policy.feeAmount} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount} FCFA. Remboursement: ${policy.refundAmount} FCFA.`,
            oldStatus: booking.status,
            newStatus: "CANCELLED",
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "refund": {
        if (!hasRefundableClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
          return NextResponse.json({
            error: "Impossible de rembourser: aucun paiement PayDunya vérifié n'est rattaché à cette réservation.",
          }, { status: 409 });
        }
        const fallbackRefundableAmount = Math.max(0, (booking.totalClientPays || booking.totalPrice) - (booking.paymentServiceFeeAmount || 0));
        const refundAmount = booking.cancellationRefundAmount > 0
          ? booking.cancellationRefundAmount
          : fallbackRefundableAmount;
        if (refundAmount <= 0) {
          return NextResponse.json({ error: "Aucun montant remboursable n'est disponible pour cette réservation." }, { status: 400 });
        }
        const refundRequest = booking.clientRefundRequests.find((request) => ["PENDING", "APPROVED"].includes(request.status))
          ?? booking.clientRefundRequests[0]
          ?? null;
        if (!refundRequest) {
          return NextResponse.json({
            error: "Le client doit d'abord renseigner son moyen et son numéro de remboursement.",
          }, { status: 400 });
        }
        const externalReference = typeof body.externalReference === "string" ? body.externalReference.trim() : "";
        if (externalReference.length < 3) {
          return NextResponse.json({
            error: "Saisissez la référence du dépôt ou du reçu Mobile Money.",
          }, { status: 400 });
        }
        const finalPaymentStatus = refundAmount < fallbackRefundableAmount ? "PARTIALLY_REFUNDED" : "REFUNDED";
        await db.booking.update({
          where: { id },
          data: { status: "REFUNDED", paymentStatus: finalPaymentStatus },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: finalPaymentStatus },
        });
        await db.transaction.create({
          data: {
            reference: generateReference("TX"),
            bookingId: booking.id,
            teacherId: booking.teacherId,
            amount: refundAmount,
            commission: 0,
            teacherNet: 0,
            type: "REFUND",
            status: finalPaymentStatus,
            method: refundRequest.method ?? booking.paymentMethod,
            paidAt: now,
          },
        });
        await db.clientRefundRequest.updateMany({
          where: {
            bookingId: booking.id,
            status: { in: ["PENDING", "APPROVED"] },
          },
          data: {
            status: "PAID",
            processedAt: now,
            externalReference,
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Remboursement effectué",
            message: `Le client de la réservation ${booking.reference} a été remboursé (${refundAmount} FCFA) via ${refundRequest.method}. Référence dépôt: ${externalReference}. Les frais service paiement non remboursés sont de ${booking.paymentServiceFeeAmount || 0} FCFA.`,
            type: "REFUND",
            link: `/admin/reservations/${id}`,
          },
        });
        await db.notification.create({
          data: {
            userId: booking.clientId,
            title: "Remboursement effectué",
            message: `Votre remboursement de ${refundAmount.toLocaleString("fr-FR")} FCFA pour ${booking.reference} a été marqué effectué. Référence dépôt: ${externalReference}. Les frais de service paiement non remboursés sont de ${(booking.paymentServiceFeeAmount || 0).toLocaleString("fr-FR")} FCFA.`,
            type: "REFUND",
            recipientType: "CLIENT",
            channel: "INTERNAL",
            status: "SENT",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: booking.teacherId,
            clientId: booking.clientId,
            sentAt: now,
            link: `/client/reservations/${booking.id}`,
            actionLabel: "Voir remboursement",
          },
        });
        await db.clientCommunication.create({
          data: {
            clientId: booking.clientId,
            bookingId: booking.id,
            type: "PAYMENT",
            channel: "INTERNAL",
            subject: `Remboursement effectué ${booking.reference}`,
            content: `Votre remboursement est marqué effectué.\nMontant déposé : ${refundAmount.toLocaleString("fr-FR")} FCFA\nMoyen : ${refundRequest.method}\nNuméro : ${refundRequest.paymentPhone}\nTitulaire : ${refundRequest.accountName ?? "Non renseigné"}\nRéférence dépôt : ${externalReference}\nFrais de service paiement non remboursés : ${(booking.paymentServiceFeeAmount || 0).toLocaleString("fr-FR")} FCFA`,
            priority: "IMPORTANT",
            status: "SENT",
          },
        });
        await db.adminActionLog.create({
          data: {
            adminId: (await getAdmin())?.id,
            action: "Remboursement client effectué",
            entityType: "ClientRefundRequest",
            entityId: refundRequest.id,
            detail: `Remboursement ${refundRequest.reference} pour ${booking.reference}: ${refundAmount} FCFA via ${refundRequest.method} au ${refundRequest.paymentPhone}. Référence dépôt: ${externalReference}.`,
            oldStatus: refundRequest.status,
            newStatus: "PAID",
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "dispute": {
        if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
          return NextResponse.json({
            error: "Impossible d'ouvrir un litige financier: aucun paiement PayDunya vérifié n'est rattaché à cette réservation.",
          }, { status: 409 });
        }
        const reason = body.reason || "Litige ouvert par le service client";
        const description = body.description || "";
        await db.booking.update({
          where: { id },
          data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "DISPUTED" },
        });
        const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
        const createdDispute = await db.dispute.create({
          data: {
            bookingId: booking.id,
            openedById: admin?.id ?? booking.clientId,
            reason,
            description,
            status: "OPEN",
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Litige ouvert",
            message: `Un litige a été ouvert sur la réservation ${booking.reference}: ${reason}`,
            type: "DISPUTE_OPENED",
            link: `/admin/litiges/${createdDispute.id}`,
            actionLabel: "Traiter litige",
          },
        });
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
    console.error("admin/booking PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
