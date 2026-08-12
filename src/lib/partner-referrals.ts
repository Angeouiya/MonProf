import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const PARTNER_REFERRAL_RATE_PERCENT = 10;

const DEFAULT_PROMOTION_START_ISO = "2026-08-12T00:00:00.000Z";
const DEFAULT_PROMOTION_END_ISO = "2027-02-12T23:59:59.999Z";

type PartnerReferralTx = Prisma.TransactionClient;

type PartnerReferralBooking = {
  id: string;
  clientId: string;
  teacherId?: string | null;
  status?: string | null;
  courseAmount?: number | null;
  paymentConfirmedAt?: Date | null;
  confirmedAt?: Date | null;
};

export function getPartnerPromotionWindow() {
  return {
    startsAt: parsePromotionDate(process.env.PARTNER_PROMOTION_START_DATE, DEFAULT_PROMOTION_START_ISO),
    endsAt: parsePromotionDate(process.env.PARTNER_PROMOTION_END_DATE, DEFAULT_PROMOTION_END_ISO),
  };
}

export function isPartnerPromotionActive(now = new Date()) {
  const { startsAt, endsAt } = getPartnerPromotionWindow();
  return now >= startsAt && now <= endsAt;
}

export function normalizePartnerReferralName(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
}

export function normalizePartnerReferralPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\d+]/g, "").trim().slice(0, 32);
  return normalized || null;
}

export function calculatePartnerReferralCommission(courseAmount: number, ratePercent = PARTNER_REFERRAL_RATE_PERCENT) {
  const safeCourseAmount = Math.max(0, Math.round(Number.isFinite(courseAmount) ? courseAmount : 0));
  const safeRate = Math.max(0, Math.min(100, Math.round(Number.isFinite(ratePercent) ? ratePercent : PARTNER_REFERRAL_RATE_PERCENT)));
  return Math.round((safeCourseAmount * safeRate) / 100);
}

export function buildPartnerReferralCreateData(input: {
  booking: PartnerReferralBooking;
  promoterName: string;
  promoterPhone?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!isPartnerPromotionActive(now)) return null;
  const promoterName = normalizePartnerReferralName(input.promoterName);
  if (!promoterName) return null;
  const courseAmount = Math.max(0, Math.round(input.booking.courseAmount ?? 0));
  const { startsAt, endsAt } = getPartnerPromotionWindow();
  return {
    bookingId: input.booking.id,
    clientId: input.booking.clientId,
    teacherId: input.booking.teacherId ?? null,
    promoterName,
    promoterPhone: normalizePartnerReferralPhone(input.promoterPhone),
    promotionStartsAt: startsAt,
    promotionEndsAt: endsAt,
    declaredAt: now,
    courseAmount,
    commissionRate: PARTNER_REFERRAL_RATE_PERCENT,
    commissionAmount: calculatePartnerReferralCommission(courseAmount),
  };
}

export async function markPartnerReferralPaymentConfirmedInTransaction(
  tx: PartnerReferralTx,
  booking: PartnerReferralBooking,
  now = new Date(),
) {
  const referral = await tx.partnerReferral.findUnique({ where: { bookingId: booking.id } });
  if (!referral || ["PAID", "REJECTED", "EXPIRED"].includes(referral.status)) return null;

  if (now > referral.promotionEndsAt || referral.declaredAt < referral.promotionStartsAt || referral.declaredAt > referral.promotionEndsAt) {
    return tx.partnerReferral.update({
      where: { id: referral.id },
      data: { status: "EXPIRED", expiredAt: now, adminNote: appendAdminNote(referral.adminNote, "Expiration automatique : paiement confirmé hors période promotionnelle.") },
    });
  }

  const bookingAlreadyConfirmed = Boolean(booking.confirmedAt) || ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status ?? "");
  return tx.partnerReferral.update({
    where: { id: referral.id },
    data: {
      status: bookingAlreadyConfirmed ? "PAYABLE" : "PAYMENT_CONFIRMED",
      paymentConfirmedAt: referral.paymentConfirmedAt ?? now,
      bookingConfirmedAt: bookingAlreadyConfirmed ? referral.bookingConfirmedAt ?? booking.confirmedAt ?? now : referral.bookingConfirmedAt,
      payableAt: bookingAlreadyConfirmed ? referral.payableAt ?? now : referral.payableAt,
    },
  });
}

export async function markPartnerReferralBookingConfirmedInTransaction(
  tx: PartnerReferralTx,
  booking: PartnerReferralBooking,
  now = new Date(),
) {
  const referral = await tx.partnerReferral.findUnique({ where: { bookingId: booking.id } });
  if (!referral || ["PAID", "REJECTED", "EXPIRED"].includes(referral.status)) return null;

  if (now > referral.promotionEndsAt || referral.declaredAt < referral.promotionStartsAt || referral.declaredAt > referral.promotionEndsAt) {
    return tx.partnerReferral.update({
      where: { id: referral.id },
      data: { status: "EXPIRED", expiredAt: now, adminNote: appendAdminNote(referral.adminNote, "Expiration automatique : réservation confirmée hors période promotionnelle.") },
    });
  }

  const paymentAlreadyConfirmed = Boolean(referral.paymentConfirmedAt) || Boolean(booking.paymentConfirmedAt);
  return tx.partnerReferral.update({
    where: { id: referral.id },
    data: {
      status: paymentAlreadyConfirmed ? "PAYABLE" : referral.status,
      bookingConfirmedAt: referral.bookingConfirmedAt ?? booking.confirmedAt ?? now,
      payableAt: paymentAlreadyConfirmed ? referral.payableAt ?? now : referral.payableAt,
    },
  });
}

export async function expirePartnerReferrals(now = new Date()) {
  const result = await db.partnerReferral.updateMany({
    where: {
      status: { in: ["DECLARED", "PAYMENT_CONFIRMED"] },
      promotionEndsAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  });
  return result.count;
}

function parsePromotionDate(value: string | undefined, fallback: string) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function appendAdminNote(existing: string | null, note: string) {
  return [existing, note].filter(Boolean).join("\n");
}
