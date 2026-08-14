import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const PARTNER_REFERRAL_RATE_PERCENT = 10;
export const PARTNER_REFERRAL_QUERY_PARAM = "ref";

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

type PartnerReferralLeadSource = {
  id: string;
  code: string;
  promoterName: string;
  promoterPhone: string | null;
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

export function normalizePartnerReferralEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, "").trim().toLowerCase().slice(0, 160);
  return normalized.includes("@") ? normalized : null;
}

export function normalizePartnerReferralCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

export function normalizePartnerReferralJourney(value: unknown) {
  if (value === "ivoirien" || value === "francais" || value === "professionnel") return value;
  return null;
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
  promotionCode?: string | null;
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
    promotionCode: normalizePartnerReferralCode(input.promotionCode) || null,
    promotionStartsAt: startsAt,
    promotionEndsAt: endsAt,
    declaredAt: now,
    courseAmount,
    commissionRate: PARTNER_REFERRAL_RATE_PERCENT,
    commissionAmount: calculatePartnerReferralCommission(courseAmount),
  };
}

export async function createPartnerReferralLead(input: {
  promoterName: unknown;
  promoterPhone: unknown;
  promoterEmail?: unknown;
  expectedClientName?: unknown;
  expectedClientPhone?: unknown;
  requestedJourney?: unknown;
  message?: unknown;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!isPartnerPromotionActive(now)) {
    return { ok: false as const, error: "La promotion partenariat n'est pas active actuellement." };
  }

  const promoterName = normalizePartnerReferralName(input.promoterName);
  const promoterPhone = normalizePartnerReferralPhone(input.promoterPhone);
  if (!promoterName || !promoterPhone) {
    return { ok: false as const, error: "Nom et téléphone de l'apporteur requis." };
  }

  const { startsAt, endsAt } = getPartnerPromotionWindow();
  const expectedClientName = normalizePartnerReferralName(input.expectedClientName);
  const message = normalizePartnerReferralMessage(input.message);
  const baseData = {
    promoterName,
    promoterPhone,
    promoterEmail: normalizePartnerReferralEmail(input.promoterEmail),
    expectedClientName: expectedClientName || null,
    expectedClientPhone: normalizePartnerReferralPhone(input.expectedClientPhone),
    requestedJourney: normalizePartnerReferralJourney(input.requestedJourney),
    message: message || null,
    promotionStartsAt: startsAt,
    promotionEndsAt: endsAt,
    declaredAt: now,
  };

  let profile = await db.partnerProfile.findUnique({ where: { promoterPhone } });
  if (profile && profile.status !== "ACTIVE") {
    return { ok: false as const, error: "Ce profil partenaire n'est pas actif. Contactez Compétence.CI." };
  }

  if (!profile) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        profile = await db.partnerProfile.create({
          data: {
            code: generatePartnerReferralCode(),
            promoterName,
            promoterPhone,
            promoterEmail: normalizePartnerReferralEmail(input.promoterEmail),
          },
        });
        break;
      } catch (error) {
        if (isUniqueConstraintError(error)) continue;
        throw error;
      }
    }
  }
  if (!profile) return { ok: false as const, error: "Création du profil partenaire impossible. Réessayez." };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatePartnerReferralCode();
    try {
      const lead = await db.partnerReferralLead.create({
        data: {
          ...baseData,
          code,
        },
      });
      return { ok: true as const, lead, profile };
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }

  return { ok: false as const, error: "Création du code impossible. Réessayez." };
}

export async function getActivePartnerReferralLeadSource(rawCode: unknown, now = new Date()): Promise<PartnerReferralLeadSource | null> {
  const code = normalizePartnerReferralCode(rawCode);
  if (!code) return null;

  const lead = await db.partnerReferralLead.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      promoterName: true,
      promoterPhone: true,
      status: true,
      declaredAt: true,
      promotionStartsAt: true,
      promotionEndsAt: true,
    },
  });
  if (!lead) return null;

  if (lead.status === "DECLARED" && now > lead.promotionEndsAt) {
    await db.partnerReferralLead.updateMany({
      where: { id: lead.id, status: "DECLARED" },
      data: { status: "EXPIRED", expiredAt: now },
    });
    return null;
  }

  if (
    lead.status !== "DECLARED" ||
    lead.declaredAt < lead.promotionStartsAt ||
    lead.declaredAt > lead.promotionEndsAt ||
    now < lead.promotionStartsAt ||
    now > lead.promotionEndsAt
  ) {
    return null;
  }

  return {
    id: lead.id,
    code: lead.code,
    promoterName: lead.promoterName,
    promoterPhone: lead.promoterPhone,
  };
}

export async function claimPartnerReferralLeadInTransaction(
  tx: PartnerReferralTx,
  input: {
    leadId: string;
    bookingId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const result = await tx.partnerReferralLead.updateMany({
    where: {
      id: input.leadId,
      status: "DECLARED",
      promotionStartsAt: { lte: now },
      promotionEndsAt: { gte: now },
    },
    data: {
      status: "MATCHED",
      matchedBookingId: input.bookingId,
      matchedAt: now,
    },
  });

  return result.count === 1;
}

export async function attachPartnerReferralLeadReferralInTransaction(
  tx: PartnerReferralTx,
  input: {
    leadId: string;
    referralId: string;
  },
) {
  await tx.partnerReferralLead.updateMany({
    where: { id: input.leadId, status: "MATCHED" },
    data: { convertedReferralId: input.referralId },
  });
}

export function buildPartnerReferralSharePath(code: string, requestedJourney?: string | null) {
  const params = new URLSearchParams();
  const normalizedCode = normalizePartnerReferralCode(code);
  if (normalizedCode) params.set(PARTNER_REFERRAL_QUERY_PARAM, normalizedCode);
  const journey = normalizePartnerReferralJourney(requestedJourney);
  if (journey) params.set("journey", journey);
  const query = params.toString();
  return query ? `/professeurs?${query}` : "/professeurs";
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
  const [referrals, leads, attributions, rewards] = await db.$transaction([
    db.partnerReferral.updateMany({
      where: {
        status: { in: ["DECLARED", "PAYMENT_CONFIRMED"] },
        promotionEndsAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
        expiredAt: now,
      },
    }),
    db.partnerReferralLead.updateMany({
      where: {
        status: "DECLARED",
        promotionEndsAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
        expiredAt: now,
      },
    }),
    db.clientPartnerAttribution.updateMany({
      where: { status: "ACTIVE", endsAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
    db.clientReward.updateMany({
      where: { status: { in: ["AVAILABLE", "RESERVED"] }, expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
  ]);
  return referrals.count + leads.count + attributions.count + rewards.count;
}

function parsePromotionDate(value: string | undefined, fallback: string) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function appendAdminNote(existing: string | null, note: string) {
  return [existing, note].filter(Boolean).join("\n");
}

function normalizePartnerReferralMessage(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 600) : "";
}

function generatePartnerReferralCode() {
  return `CP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
