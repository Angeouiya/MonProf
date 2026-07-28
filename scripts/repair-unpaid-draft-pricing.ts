import { Prisma, PrismaClient } from "@prisma/client";
import { buildBookingSessionRows, distributeAmount } from "../src/lib/booking-sessions";
import { calculateBookingPricing, pricingSnapshotToJson } from "../src/lib/pricing";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const terminalPayDunyaStatuses = new Set([
  "FAILED", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED", "CREATE_FAILED",
]);
const reconcilableJekoAttemptWhere = {
  provider: "JEKO",
  OR: [
    { status: { in: ["CREATED", "REQUESTING", "PENDING"] } },
    {
      status: "FAILED",
      providerOrderId: { not: null },
      OR: [
        { failureCode: null },
        { failureCode: { not: "JEKO_PAYMENT_FAILED" } },
      ],
    },
  ],
} satisfies Prisma.PaymentAttemptWhereInput;
const repriceableDraftWhere = {
  status: "PENDING_PAYMENT",
  paymentStatus: "FAILED",
  paydunyaVerifiedAt: null,
  transactions: {
    none: {
      type: "CLIENT_PAYMENT",
      status: { in: ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] },
    },
  },
  paymentAttempts: { none: reconcilableJekoAttemptWhere },
} satisfies Prisma.BookingWhereInput;

async function main() {
  const [settingRows, grandAbidjanCommunes, destinationCommunes, drafts] = await Promise.all([
    db.setting.findMany({ select: { key: true, value: true } }),
    db.commune.findMany({ where: { transportClass: "GRAND_ABIDJAN", isActive: true }, select: { name: true } }),
    db.commune.findMany({ where: { isActive: true }, select: { name: true, transportFeeOverride: true } }),
    db.booking.findMany({
      where: repriceableDraftWhere,
      include: {
        teacher: {
          include: { zones: { include: { commune: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const settings = new Map(settingRows.map((row) => [row.key, row.value]));
  const destinations = new Map(destinationCommunes.map((commune) => [normalize(commune.name), commune]));
  let updated = 0;
  let skippedActiveInvoice = 0;
  let skippedConcurrentChange = 0;

  for (const booking of drafts) {
    const paydunyaStatus = (booking.paydunyaStatus ?? "").toUpperCase();
    if (booking.paydunyaToken && !terminalPayDunyaStatuses.has(paydunyaStatus)) {
      skippedActiveInvoice += 1;
      continue;
    }

    const destination = booking.commune ? destinations.get(normalize(booking.commune)) : null;
    const commissionPercent = Number.isFinite(booking.teacher.commissionRate)
      ? booking.teacher.commissionRate
      : integer(settings.get("default_commission"), 30);
    const pricing = calculateBookingPricing({
      category: booking.courseCategory || "soutien_scolaire",
      schoolSystem: booking.schoolSystem,
      levelName: booking.levelName,
      preciseLevel: booking.preciseLevel,
      subjectName: booking.subjectName,
      courseCatalogName: booking.courseCatalogName,
      objective: booking.objective,
      deliveryMode: booking.courseFormat === "ONLINE" ? "en_ligne" : "domicile",
      requiresMaterial: false,
      isCompanyTraining: booking.courseCategory === "formation_entreprise",
      packType: booking.packType,
      participantsCount: booking.participantsCount,
      teacherPricePerSession: booking.teacher.pricePerSession,
      teacherCommune: booking.teacher.commune,
      teacherQuartier: booking.teacher.quartier,
      teacherZoneNames: booking.teacher.zones.map((zone) => zone.commune.name),
      clientCommune: booking.commune,
      clientQuartier: booking.quartier,
      platformCommissionPercent: commissionPercent,
      transportFeeAmounts: {
        sameCommune: integer(settings.get("transport_same_commune_fee"), 1_000),
        nearCommune: integer(settings.get("transport_near_commune_fee"), 2_500),
        farCommune: integer(settings.get("transport_far_commune_fee"), 4_500),
        interior: integer(settings.get("transport_interior_fee"), 8_000),
      },
      grandAbidjanCommuneNames: grandAbidjanCommunes.map((commune) => commune.name),
      clientCommuneTransportFeeOverride: destination?.transportFeeOverride,
    });
    const serializedPricing = pricingSnapshotToJson(pricing);

    const changed = booking.totalClientPays !== pricing.totalClientPays
      || booking.transportFee !== pricing.transportFee
      || booking.transportFeeKey !== pricing.transportFeeKey
      || booking.paymentServiceFeeAmount !== pricing.paymentServiceFeeAmount
      || booking.pricingSnapshot !== serializedPricing;
    if (!changed) continue;

    console.log(JSON.stringify({
      reference: booking.reference,
      previousTotal: booking.totalClientPays,
      nextTotal: pricing.totalClientPays,
      previousTransport: booking.transportFee,
      nextTransport: pricing.transportFee,
      nextTransportKey: pricing.transportFeeKey,
      mode: apply ? "apply" : "dry-run",
    }));

    if (!apply) continue;

    const commissionRate = Math.round(pricing.platformCommissionRate * 100);
    const repriced = await db.$transaction(async (tx) => {
      const lockedBooking = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "Booking"
        WHERE "id" = ${booking.id}
        FOR UPDATE
      `);
      if (lockedBooking.length === 0) return false;

      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "BookingSession"
        WHERE "bookingId" = ${booking.id}
        ORDER BY "id"
        FOR UPDATE
      `);
      const currentSessions = await tx.bookingSession.findMany({
        where: { bookingId: booking.id },
        orderBy: { sequence: "asc" },
      });
      const sessionLedgerProtected = currentSessions.some((session) => (
        !["PLANNED", "TEACHER_CONFIRMED"].includes(session.status)
        || session.releasedAmount > 0
        || session.paidAmount > 0
        || session.retainedAmount > 0
        || Boolean(session.releasedAt || session.paidAt || session.completedAt || session.clientValidatedAt)
      ));
      if (sessionLedgerProtected) return false;

      const nextSessionCount = Math.max(1, pricing.numberOfSessions ?? booking.sessionsCount);
      if (currentSessions.length > 0 && currentSessions.length !== nextSessionCount) {
        // Ne jamais supprimer implicitement des identifiants de séance. Une
        // incohérence de cardinalité exige un traitement manuel, tandis qu'un
        // ancien brouillon sans ledger peut être reconstruit sans perte.
        return false;
      }

      const guardedUpdate = await tx.booking.updateMany({
        where: { id: booking.id, updatedAt: booking.updatedAt, ...repriceableDraftWhere },
        data: {
          unitPrice: pricing.unitSessionAmount,
          sessionsCount: nextSessionCount,
          totalPrice: pricing.totalClientPays,
          priceTierKey: pricing.priceTierKey,
          courseAmount: pricing.courseAmount,
          commissionRate,
          commissionAmount: pricing.platformCommissionAmount,
          teacherRate: 100 - commissionRate,
          teacherPayoutAmount: pricing.teacherPayoutAmount,
          transportFee: pricing.transportFee,
          transportFeeKey: pricing.transportFeeKey,
          materialFee: pricing.materialFee,
          discountAmount: pricing.discountAmount,
          paymentServiceFeeRate: pricing.paymentServiceFeeRate,
          paymentServiceFeeAmount: pricing.paymentServiceFeeAmount,
          paymentServiceFeeLabel: pricing.paymentServiceFeeLabel,
          totalClientPays: pricing.totalClientPays,
          totalTeacherReceives: pricing.totalTeacherReceives,
          teacherNetAmount: pricing.totalTeacherReceives,
          isQuoteOnly: false,
          pricingSnapshot: serializedPricing,
          paydunyaToken: null,
          paydunyaCheckoutUrl: null,
          paydunyaStatus: "REPRICED",
          paydunyaReceiptUrl: null,
          paydunyaLastPayload: null,
          paydunyaFailureReason: null,
        },
      });
      if (guardedUpdate.count !== 1) return false;

      if (currentSessions.length === 0) {
        await tx.bookingSession.createMany({
          data: buildBookingSessionRows({
            bookingId: booking.id,
            teacherId: booking.teacherId,
            sessionsCount: nextSessionCount,
            startDate: booking.scheduledDate ?? booking.startDate ?? new Date(),
            selectedTimeSlots: [],
            fallbackTime: booking.scheduledTime || booking.preferredTime,
            courseAmount: pricing.courseAmount,
            commissionAmount: pricing.platformCommissionAmount,
            teacherPayoutAmount: pricing.teacherPayoutAmount,
            transportFee: pricing.transportFee,
          }),
        });
      } else {
        const courseAmounts = distributeAmount(pricing.courseAmount, nextSessionCount);
        const commissionAmounts = distributeAmount(pricing.platformCommissionAmount, nextSessionCount);
        const teacherCourseAmounts = distributeAmount(pricing.teacherPayoutAmount, nextSessionCount);
        const transportAmounts = distributeAmount(pricing.transportFee, nextSessionCount);
        for (const [index, session] of currentSessions.entries()) {
          await tx.bookingSession.update({
            where: { id: session.id },
            data: {
              courseAmount: courseAmounts[index],
              commissionAmount: commissionAmounts[index],
              teacherCourseAmount: teacherCourseAmounts[index],
              transportFee: transportAmounts[index],
              teacherNetAmount: teacherCourseAmounts[index] + transportAmounts[index],
            },
          });
        }
      }

      await tx.notification.updateMany({
        where: { bookingId: booking.id, type: "PAYMENT_PENDING" },
        data: {
          message: `Le montant du brouillon ${booking.reference} a été recalculé selon la zone et les paramètres en vigueur. Total Jèko : ${pricing.totalClientPays.toLocaleString("fr-FR")} FCFA. Aucun professeur n'est notifié avant confirmation serveur du paiement.`,
        },
      });
      await tx.adminActionLog.create({
        data: {
          action: "Brouillon non payé recalculé",
          entityType: "Booking",
          entityId: booking.id,
          detail: `${booking.reference}: ${booking.totalClientPays} -> ${pricing.totalClientPays} FCFA; déplacement ${booking.transportFee} -> ${pricing.transportFee} FCFA. Ancien lien PayDunya terminal invalidé.`,
          oldStatus: booking.paydunyaStatus || "PENDING",
          newStatus: "REPRICED",
        },
      });
      return true;
    });
    if (!repriced) {
      skippedConcurrentChange += 1;
      continue;
    }
    updated += 1;
  }

  if (apply) {
    const [teachers, users] = await db.$transaction([
      db.teacher.updateMany({ where: { quartier: { equals: "Mermoze", mode: "insensitive" } }, data: { quartier: "Mermoz" } }),
      db.user.updateMany({ where: { quartier: { equals: "Mermoze", mode: "insensitive" } }, data: { quartier: "Mermoz" } }),
    ]);
    console.log(JSON.stringify({ canonicalizedTeachers: teachers.count, canonicalizedUsers: users.count }));
  }

  console.log(JSON.stringify({ scanned: drafts.length, updated, skippedActiveInvoice, skippedConcurrentChange, apply }));
}

function integer(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function normalize(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
