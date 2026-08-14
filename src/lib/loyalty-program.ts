import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  normalizePartnerReferralCode,
  normalizePartnerReferralName,
  normalizePartnerReferralPhone,
  PARTNER_REFERRAL_RATE_PERCENT,
  isPartnerPromotionActive,
} from "@/lib/partner-referrals";
import {
  DEFAULT_LOYALTY_GIFT_STEPS,
  PARTNER_ATTRIBUTION_MONTHS,
  resolveLoyaltyGiftCadence,
  type LoyaltyGiftStep,
} from "@/lib/loyalty-constants";

export { DEFAULT_LOYALTY_GIFT_STEPS, PARTNER_ATTRIBUTION_MONTHS } from "@/lib/loyalty-constants";
export type { LoyaltyGiftStep } from "@/lib/loyalty-constants";

type LoyaltyTx = Prisma.TransactionClient;

export async function getLoyaltyProgramConfig() {
  const rows = await db.setting.findMany({
    where: {
      key: {
        in: [
          "loyalty_gifts_enabled",
          "loyalty_gifts_cycle_enabled",
          "loyalty_minimum_margin_percent",
          "loyalty_gift_steps_json",
          ...DEFAULT_LOYALTY_GIFT_STEPS.flatMap((step) => [
            `loyalty_gift_${step.milestone}_rate`,
            `loyalty_gift_${step.milestone}_days`,
            `loyalty_gift_${step.milestone}_gap_payments`,
          ]),
        ],
      },
    },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    enabled: parseBoolean(values.get("loyalty_gifts_enabled"), true),
    cycleEnabled: parseBoolean(values.get("loyalty_gifts_cycle_enabled"), true),
    minimumMarginPercent: clampInt(values.get("loyalty_minimum_margin_percent"), 5, 0, 20),
    steps: giftStepsFromSettings(values),
  };
}

export type ClientPromotionBenefits = {
  attribution: {
    id: string | null;
    profileId: string;
    code: string;
    promoterName: string;
    promoterPhone: string;
    status: "PENDING" | "ACTIVE";
    startsAt: Date | null;
    endsAt: Date | null;
    isNew: boolean;
  } | null;
  partnerDiscountPercent: number;
  partnerCommissionPercent: number;
  reward: {
    id: string;
    milestone: number;
    discountRate: number;
    validityDays: number;
    expiresAt: Date;
  } | null;
  minimumMarginPercent: number;
};

export async function resolveClientPromotionBenefits(input: {
  clientId: string;
  referralCode?: unknown;
  referralName?: unknown;
  referralPhone?: unknown;
  bookingId?: string | null;
  now?: Date;
}): Promise<ClientPromotionBenefits> {
  const now = input.now ?? new Date();
  const config = await getLoyaltyProgramConfig();
  await db.clientReward.updateMany({
    where: { clientId: input.clientId, status: { in: ["AVAILABLE", "RESERVED"] }, expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });

  let current = await db.clientPartnerAttribution.findUnique({
    where: { clientId: input.clientId },
    include: { partnerProfile: true },
  });
  if (current?.status === "ACTIVE" && current.endsAt && current.endsAt < now) {
    current = await db.clientPartnerAttribution.update({
      where: { id: current.id },
      data: { status: "EXPIRED" },
      include: { partnerProfile: true },
    });
  }

  const requestedCode = normalizePartnerReferralCode(input.referralCode);
  const requestedPhone = normalizePartnerReferralPhone(input.referralPhone);
  const requestedName = normalizePartnerReferralName(input.referralName);
  let requestedProfile = requestedCode
    ? await db.partnerProfile.findFirst({ where: { code: requestedCode, status: "ACTIVE" } })
    : requestedPhone
      ? await db.partnerProfile.findFirst({ where: { promoterPhone: requestedPhone, status: "ACTIVE" } })
      : null;

  // Compatibilité production : les anciens liens à usage unique deviennent
  // un profil permanent au premier contrôle, sans perdre l'apporteur existant.
  if (!requestedProfile && requestedCode) {
    const legacyLead = await db.partnerReferralLead.findUnique({ where: { code: requestedCode } });
    if (legacyLead && !["REJECTED", "EXPIRED"].includes(legacyLead.status) && legacyLead.promotionEndsAt >= now) {
      requestedProfile = await db.partnerProfile.upsert({
        where: { promoterPhone: legacyLead.promoterPhone },
        create: {
          code: requestedCode,
          promoterName: legacyLead.promoterName,
          promoterPhone: legacyLead.promoterPhone,
          promoterEmail: legacyLead.promoterEmail,
        },
        update: { status: "ACTIVE" },
      });
    }
  }

  if (requestedProfile && requestedName && !namesAreCompatible(requestedName, requestedProfile.promoterName)) {
    requestedProfile = null;
  }

  const usableCurrent = current && ["PENDING", "ACTIVE"].includes(current.status) && current.partnerProfile.status === "ACTIVE"
    ? current
    : null;
  if (requestedCode || requestedPhone) {
    if (!requestedProfile) throw new Error("PARTNER_NOT_VERIFIED");
    if (!usableCurrent && !isPartnerPromotionActive(now)) throw new Error("PARTNER_PROMOTION_INACTIVE");
    if (usableCurrent && usableCurrent.partnerProfileId !== requestedProfile.id) {
      throw new Error("PARTNER_ATTRIBUTION_LOCKED");
    }
  }

  const profile = usableCurrent?.partnerProfile ?? requestedProfile;
  if (profile) {
    await assertPartnerIsNotClient(db, input.clientId, profile.id);
  }
  const attribution = profile
    ? {
        id: usableCurrent?.id ?? (current && requestedProfile ? current.id : null),
        profileId: profile.id,
        code: profile.code,
        promoterName: profile.promoterName,
        promoterPhone: profile.promoterPhone,
        status: (usableCurrent?.status === "ACTIVE" ? "ACTIVE" : "PENDING") as "PENDING" | "ACTIVE",
        startsAt: usableCurrent?.startsAt ?? null,
        endsAt: usableCurrent?.endsAt ?? null,
        isNew: !usableCurrent,
      }
    : null;

  const getsInitialDiscount = Boolean(attribution) && (
    !usableCurrent?.initialDiscountBookingId
    || usableCurrent.initialDiscountBookingId === input.bookingId
  );
  const reward = config.enabled && !getsInitialDiscount
    ? await db.clientReward.findFirst({
        where: {
          clientId: input.clientId,
          expiresAt: { gte: now },
          OR: [
            { status: "AVAILABLE" },
            ...(input.bookingId ? [{ status: "RESERVED" as const, usedBookingId: input.bookingId }] : []),
          ],
        },
        orderBy: [{ expiresAt: "asc" }, { unlockedAt: "asc" }],
      })
    : null;

  return {
    attribution,
    partnerDiscountPercent: getsInitialDiscount ? PARTNER_REFERRAL_RATE_PERCENT : 0,
    partnerCommissionPercent: attribution ? PARTNER_REFERRAL_RATE_PERCENT : 0,
    reward: reward
      ? {
          id: reward.id,
          milestone: reward.milestone,
          discountRate: reward.discountRate,
          validityDays: reward.validityDays,
          expiresAt: reward.expiresAt,
        }
      : null,
    minimumMarginPercent: config.minimumMarginPercent,
  };
}

export async function attachPromotionToBookingInTransaction(
  tx: LoyaltyTx,
  input: {
    clientId: string;
    bookingId: string;
    benefits: ClientPromotionBenefits;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const benefit = input.benefits;
  await lockClientLoyaltyLedger(tx, input.clientId);
  let attributionId: string | null = null;

  const currentAttribution = await tx.clientPartnerAttribution.findUnique({
    where: { clientId: input.clientId },
  });

  if (benefit.attribution) {
    await assertPartnerIsNotClient(tx, input.clientId, benefit.attribution.profileId);
    if (
      currentAttribution
      && ["PENDING", "ACTIVE"].includes(currentAttribution.status)
      && currentAttribution.partnerProfileId !== benefit.attribution.profileId
    ) {
      throw new Error("PARTNER_ATTRIBUTION_LOCKED");
    }
    attributionId = currentAttribution?.id ?? benefit.attribution.id;
  }

  if (benefit.attribution?.isNew && currentAttribution) {
    await tx.clientPartnerAttribution.update({
      where: { id: currentAttribution.id },
      data: {
        partnerProfileId: benefit.attribution.profileId,
        sourceCode: benefit.attribution.code,
        status: "PENDING",
        declaredAt: now,
        startsAt: null,
        endsAt: null,
        firstBookingId: input.bookingId,
        initialDiscountBookingId: null,
        initialDiscountUsedAt: null,
      },
    });
  }

  if (benefit.attribution && !currentAttribution) {
    const created = await tx.clientPartnerAttribution.create({
      data: {
        clientId: input.clientId,
        partnerProfileId: benefit.attribution.profileId,
        sourceCode: benefit.attribution.code,
        status: "PENDING",
        declaredAt: now,
        firstBookingId: input.bookingId,
      },
    });
    attributionId = created.id;
  }

  if (attributionId && benefit.partnerDiscountPercent > 0) {
    const reserved = await tx.clientPartnerAttribution.updateMany({
      where: { id: attributionId, OR: [{ initialDiscountBookingId: null }, { initialDiscountBookingId: input.bookingId }] },
      data: { initialDiscountBookingId: input.bookingId },
    });
    if (reserved.count !== 1) throw new Error("PARTNER_DISCOUNT_ALREADY_RESERVED");
  }

  if (benefit.reward) {
    const reserved = await tx.clientReward.updateMany({
      where: {
        id: benefit.reward.id,
        clientId: input.clientId,
        expiresAt: { gte: now },
        OR: [{ status: "AVAILABLE" }, { status: "RESERVED", usedBookingId: input.bookingId }],
      },
      data: { status: "RESERVED", usedBookingId: input.bookingId, reservedAt: now },
    });
    if (reserved.count !== 1) throw new Error("LOYALTY_REWARD_ALREADY_RESERVED");
  }

  return attributionId;
}

export async function confirmPromotionPaymentInTransaction(
  tx: LoyaltyTx,
  input: { bookingId: string; clientId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  await lockClientLoyaltyLedger(tx, input.clientId);
  const booking = await tx.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, partnerAttributionId: true, rewardDiscountAmount: true },
  });
  if (!booking) return null;

  if (booking.partnerAttributionId) {
    const attribution = await tx.clientPartnerAttribution.findUnique({ where: { id: booking.partnerAttributionId } });
    if (attribution?.status === "PENDING") {
      const endsAt = addMonths(now, PARTNER_ATTRIBUTION_MONTHS);
      await tx.clientPartnerAttribution.update({
        where: { id: attribution.id },
        data: {
          status: "ACTIVE",
          startsAt: now,
          endsAt,
          initialDiscountUsedAt: attribution.initialDiscountBookingId === booking.id ? now : attribution.initialDiscountUsedAt,
        },
      });
      await tx.partnerReferral.updateMany({
        where: { attributionId: attribution.id, status: { in: ["DECLARED", "PAYMENT_CONFIRMED"] } },
        data: { promotionStartsAt: now, promotionEndsAt: endsAt },
      });
      await tx.notification.create({
        data: {
          userId: input.clientId,
          clientId: input.clientId,
          recipientType: "CLIENT",
          title: "Partenaire confirmé pour six mois",
          message: `Votre premier paiement Jèko est confirmé. Le partenaire reste rattaché à votre compte jusqu'au ${new Intl.DateTimeFormat("fr-FR").format(endsAt)} et votre route Cadeaux vient de commencer.`,
          type: "PARTNER_ATTRIBUTION_ACTIVE",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          sentAt: now,
          link: "/client/cadeaux",
          actionLabel: "Voir ma route",
        },
      });
    }
  }

  if (booking.rewardDiscountAmount > 0) {
    await tx.clientReward.updateMany({
      where: { usedBookingId: booking.id, status: "RESERVED" },
      data: { status: "USED", usedAt: now },
    });
  }

  return qualifyLoyaltyPurchaseInTransaction(tx, { bookingId: booking.id, clientId: input.clientId, now });
}

export async function qualifyLoyaltyPurchaseInTransaction(
  tx: LoyaltyTx,
  input: { bookingId: string; clientId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  await lockClientLoyaltyLedger(tx, input.clientId);
  const existing = await tx.clientLoyaltyPurchase.findUnique({ where: { bookingId: input.bookingId } });
  if (existing) return existing;
  const attribution = await tx.clientPartnerAttribution.findUnique({ where: { clientId: input.clientId } });
  if (!attribution || attribution.status !== "ACTIVE" || !attribution.endsAt || attribution.endsAt < now) return null;

  const configRows = await tx.setting.findMany({
    where: { key: { in: [
      "loyalty_gifts_enabled",
      "loyalty_gifts_cycle_enabled",
      "loyalty_gift_steps_json",
      ...DEFAULT_LOYALTY_GIFT_STEPS.flatMap((step) => [
        `loyalty_gift_${step.milestone}_rate`,
        `loyalty_gift_${step.milestone}_days`,
        `loyalty_gift_${step.milestone}_gap_payments`,
      ]),
    ] } },
  });
  const values = new Map(configRows.map((row) => [row.key, row.value]));
  const enabled = parseBoolean(values.get("loyalty_gifts_enabled"), true);
  const cycleEnabled = parseBoolean(values.get("loyalty_gifts_cycle_enabled"), true);
  const steps = giftStepsFromSettings(values);
  const purchaseCount = await tx.clientLoyaltyPurchase.count({ where: { clientId: input.clientId, reversedAt: null } });
  const absoluteSequence = purchaseCount + 1;
  const cycle = Math.floor((absoluteSequence - 1) / 7) + 1;
  const sequence = ((absoluteSequence - 1) % 7) + 1;

  const purchase = await tx.clientLoyaltyPurchase.create({
    data: { clientId: input.clientId, bookingId: input.bookingId, sequence, cycle, qualifiedAt: now },
  });
  const rewardCount = await tx.clientReward.count({ where: { clientId: input.clientId } });
  const lastReward = await tx.clientReward.findFirst({
    where: { clientId: input.clientId },
    orderBy: [{ unlockedAt: "desc" }, { id: "desc" }],
    select: { unlockPaymentNumber: true, unlockedByBookingId: true },
  });
  const legacyUnlockPurchase = lastReward && !lastReward.unlockPaymentNumber
    ? await tx.clientLoyaltyPurchase.findUnique({
        where: { bookingId: lastReward.unlockedByBookingId },
        select: { cycle: true, sequence: true },
      })
    : null;
  const lastUnlockPaymentNumber = lastReward?.unlockPaymentNumber
    ?? (legacyUnlockPurchase ? ((legacyUnlockPurchase.cycle - 1) * 7) + legacyUnlockPurchase.sequence : 1);
  const paymentsSinceLastGift = Math.max(0, absoluteSequence - lastUnlockPaymentNumber);
  const cadence = resolveLoyaltyGiftCadence({ steps, rewardCount, paymentsSinceLastGift, cycleEnabled });
  const gift = enabled ? cadence.nextGift : null;

  if (gift && cadence.shouldUnlock) {
    const expiresAt = addDays(now, gift.validityDays);
    await tx.clientReward.create({
      data: {
        clientId: input.clientId,
        unlockedByBookingId: input.bookingId,
        cycle: cadence.nextRewardCycle,
        milestone: gift.milestone,
        unlockPaymentNumber: absoluteSequence,
        discountRate: gift.discountRate,
        validityDays: gift.validityDays,
        expiresAt,
      },
    });
    await tx.notification.create({
      data: {
        userId: input.clientId,
        clientId: input.clientId,
        recipientType: "CLIENT",
        title: `Cadeau débloqué : -${gift.discountRate} %`,
        message: `Votre prochain cours bénéficie automatiquement de ${gift.discountRate} % de réduction pendant ${gift.validityDays} jours.`,
        type: "LOYALTY_GIFT_UNLOCKED",
        channel: "INTERNAL",
        status: "SENT",
        priority: "IMPORTANT",
        sentAt: now,
        link: "/client/cadeaux",
        actionLabel: "Voir mon cadeau",
      },
    });
  }
  return purchase;
}

export async function releaseBookingPromotionReservationsInTransaction(tx: LoyaltyTx, bookingId: string) {
  await tx.clientReward.updateMany({
    where: { usedBookingId: bookingId, status: "RESERVED" },
    data: { status: "AVAILABLE", usedBookingId: null, reservedAt: null },
  });
  await tx.clientPartnerAttribution.updateMany({
    where: { initialDiscountBookingId: bookingId, initialDiscountUsedAt: null },
    data: { initialDiscountBookingId: null },
  });
}

export async function reverseBookingPromotionsForRefundInTransaction(
  tx: LoyaltyTx,
  input: { bookingId: string; clientId: string; now?: Date; reason?: string },
) {
  const now = input.now ?? new Date();
  const reason = input.reason ?? "Remboursement intégral confirmé";
  await tx.clientLoyaltyPurchase.updateMany({
    where: { bookingId: input.bookingId, clientId: input.clientId, reversedAt: null },
    data: { reversedAt: now, reversalReason: reason },
  });
  await tx.clientReward.updateMany({
    where: {
      clientId: input.clientId,
      OR: [{ unlockedByBookingId: input.bookingId }, { usedBookingId: input.bookingId }],
      status: { in: ["AVAILABLE", "RESERVED", "USED"] },
    },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await tx.partnerReferral.updateMany({
    where: { bookingId: input.bookingId, status: { in: ["DECLARED", "PAYMENT_CONFIRMED", "PAYABLE"] } },
    data: { status: "REJECTED", rejectedAt: now, adminNote: reason },
  });
  const paidReferral = await tx.partnerReferral.findFirst({ where: { bookingId: input.bookingId, status: "PAID" } });
  if (paidReferral) {
    await tx.partnerReferral.update({
      where: { id: paidReferral.id },
      data: {
        adminNote: [paidReferral.adminNote, `${reason} : commission déjà versée, régularisation comptable requise.`]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }
}

export async function adjustPartnerCommissionForPartialRefundInTransaction(
  tx: LoyaltyTx,
  input: { bookingId: string; totalRefundedAmount: number; now?: Date },
) {
  const referral = await tx.partnerReferral.findUnique({ where: { bookingId: input.bookingId } });
  if (!referral) return;
  const eligibleBase = Math.max(0, referral.eligibleCourseAmount || referral.courseAmount);
  const remainingEligibleBase = Math.max(0, eligibleBase - Math.max(0, input.totalRefundedAmount));
  const adjustedCommission = Math.round((remainingEligibleBase * referral.commissionRate) / 100);
  const note = `Remboursement partiel : base partenaire ramenée à ${remainingEligibleBase} FCFA, commission à ${adjustedCommission} FCFA.`;
  if (referral.status === "PAID") {
    await tx.partnerReferral.update({
      where: { id: referral.id },
      data: { adminNote: [referral.adminNote, `${note} Régularisation comptable requise.`].filter(Boolean).join("\n") },
    });
    return;
  }
  await tx.partnerReferral.update({
    where: { id: referral.id },
    data: {
      courseAmount: remainingEligibleBase,
      eligibleCourseAmount: remainingEligibleBase,
      commissionAmount: adjustedCommission,
      adminNote: [referral.adminNote, note].filter(Boolean).join("\n"),
      ...(adjustedCommission === 0 ? { status: "REJECTED" as const, rejectedAt: input.now ?? new Date() } : {}),
    },
  });
}

export async function getClientLoyaltyOverview(clientId: string, now = new Date()) {
  await db.clientReward.updateMany({
    where: { clientId, status: { in: ["AVAILABLE", "RESERVED"] }, expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  const [config, attribution, purchases, rewards, qualifiedPaymentCount, rewardCount] = await Promise.all([
    getLoyaltyProgramConfig(),
    db.clientPartnerAttribution.findUnique({ where: { clientId }, include: { partnerProfile: true } }),
    db.clientLoyaltyPurchase.findMany({ where: { clientId, reversedAt: null }, orderBy: { qualifiedAt: "desc" }, take: 14 }),
    db.clientReward.findMany({ where: { clientId }, orderBy: { unlockedAt: "desc" }, take: 14 }),
    db.clientLoyaltyPurchase.count({ where: { clientId, reversedAt: null } }),
    db.clientReward.count({ where: { clientId } }),
  ]);
  const lastReward = rewards[0];
  const legacyUnlockPurchase = lastReward && !lastReward.unlockPaymentNumber
    ? await db.clientLoyaltyPurchase.findUnique({
        where: { bookingId: lastReward.unlockedByBookingId },
        select: { cycle: true, sequence: true },
      })
    : null;
  const lastUnlockPaymentNumber = lastReward?.unlockPaymentNumber
    ?? (legacyUnlockPurchase ? ((legacyUnlockPurchase.cycle - 1) * 7) + legacyUnlockPurchase.sequence : 1);
  const paymentsSinceLastGift = Math.max(0, qualifiedPaymentCount - lastUnlockPaymentNumber);
  const cadence = resolveLoyaltyGiftCadence({
    steps: config.steps,
    rewardCount,
    paymentsSinceLastGift,
    cycleEnabled: config.cycleEnabled,
  });
  const roadStep = cadence.programCompleted
    ? 7
    : qualifiedPaymentCount > 0
      ? cadence.completedGiftsInCycle + 1
      : 0;
  return {
    config,
    attribution,
    purchases,
    rewards,
    cycle: cadence.programCompleted ? Math.max(1, cadence.nextRewardCycle - 1) : cadence.nextRewardCycle,
    currentStep: roadStep,
    qualifiedPaymentCount,
    completedGiftsInCycle: cadence.completedGiftsInCycle,
    paymentsSinceLastGift,
    paymentsUntilNextGift: cadence.paymentsUntilNextGift,
    nextGift: cadence.nextGift,
    programCompleted: cadence.programCompleted,
    activeReward: rewards.find((reward) => reward.status === "AVAILABLE" && reward.expiresAt >= now) ?? null,
  };
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function parseGiftSteps(value?: string) {
  try {
    const parsed = value ? JSON.parse(value) : DEFAULT_LOYALTY_GIFT_STEPS;
    if (!Array.isArray(parsed)) return DEFAULT_LOYALTY_GIFT_STEPS;
    const byMilestone = new Map<number, LoyaltyGiftStep>();
    for (const row of parsed) {
      const milestone = clampInt(row?.milestone, 0, 2, 7);
      if (!milestone) continue;
      byMilestone.set(milestone, {
        milestone,
        discountRate: clampInt(row?.discountRate, 8, 8, 15),
        validityDays: clampInt(row?.validityDays, 7, 7, 14),
        paymentGap: clampInt(
          row?.paymentGap,
          DEFAULT_LOYALTY_GIFT_STEPS.find((step) => step.milestone === milestone)?.paymentGap ?? 1,
          1,
          3,
        ),
      });
    }
    return DEFAULT_LOYALTY_GIFT_STEPS.map((fallback) => byMilestone.get(fallback.milestone) ?? fallback);
  } catch {
    return DEFAULT_LOYALTY_GIFT_STEPS;
  }
}

function giftStepsFromSettings(values: Map<string, string>) {
  const jsonSteps = parseGiftSteps(values.get("loyalty_gift_steps_json"));
  return jsonSteps.map((step) => ({
    milestone: step.milestone,
    discountRate: clampInt(values.get(`loyalty_gift_${step.milestone}_rate`), step.discountRate, 8, 15),
    validityDays: clampInt(values.get(`loyalty_gift_${step.milestone}_days`), step.validityDays, 7, 14),
    paymentGap: clampInt(values.get(`loyalty_gift_${step.milestone}_gap_payments`), step.paymentGap, 1, 3),
  }));
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off", "disabled"].includes(value.trim().toLowerCase());
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function namesAreCompatible(left: string, right: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

async function lockClientLoyaltyLedger(tx: LoyaltyTx, clientId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${clientId}
    FOR UPDATE
  `);
  if (rows.length !== 1) throw new Error("CLIENT_NOT_FOUND");
}

async function assertPartnerIsNotClient(
  client: Pick<LoyaltyTx, "user" | "partnerProfile">,
  clientId: string,
  partnerProfileId: string,
) {
  const [user, partner] = await Promise.all([
    client.user.findUnique({
      where: { id: clientId },
      select: { phone: true, phoneNormalized: true },
    }),
    client.partnerProfile.findUnique({
      where: { id: partnerProfileId },
      select: { promoterPhone: true, status: true },
    }),
  ]);
  if (!partner || partner.status !== "ACTIVE") throw new Error("PARTNER_NOT_VERIFIED");
  const clientPhone = phoneIdentityKey(user?.phoneNormalized ?? user?.phone);
  const partnerPhone = phoneIdentityKey(partner.promoterPhone);
  if (clientPhone && partnerPhone && clientPhone === partnerPhone) {
    throw new Error("PARTNER_SELF_REFERRAL_FORBIDDEN");
  }
}

function phoneIdentityKey(value: string | null | undefined) {
  let digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `225${digits}`;
  return digits;
}
