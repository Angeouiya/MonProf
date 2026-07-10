import { PrismaClient } from "@prisma/client";
import { calculateBookingPricing, pricingSnapshotToJson } from "../src/lib/pricing";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const terminalPayDunyaStatuses = new Set([
  "FAILED", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED", "CREATE_FAILED",
]);

async function main() {
  const [settingRows, grandAbidjanCommunes, destinationCommunes, drafts] = await Promise.all([
    db.setting.findMany({ select: { key: true, value: true } }),
    db.commune.findMany({ where: { transportClass: "GRAND_ABIDJAN", isActive: true }, select: { name: true } }),
    db.commune.findMany({ where: { isActive: true }, select: { name: true, transportFeeOverride: true } }),
    db.booking.findMany({
      where: {
        status: "PENDING_PAYMENT",
        paymentStatus: "FAILED",
        paydunyaVerifiedAt: null,
        transactions: { none: { type: "CLIENT_PAYMENT", status: { in: ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] } } },
      },
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
    await db.$transaction([
      db.booking.update({
        where: { id: booking.id },
        data: {
          unitPrice: pricing.unitSessionAmount,
          sessionsCount: pricing.numberOfSessions ?? booking.sessionsCount,
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
      }),
      db.notification.updateMany({
        where: { bookingId: booking.id, type: "PAYMENT_PENDING" },
        data: {
          message: `Le montant du brouillon ${booking.reference} a été recalculé selon la zone et les paramètres en vigueur. Total PayDunya : ${pricing.totalClientPays.toLocaleString("fr-FR")} FCFA. Aucun professeur n'est notifié avant confirmation serveur du paiement.`,
        },
      }),
      db.adminActionLog.create({
        data: {
          action: "Brouillon non payé recalculé",
          entityType: "Booking",
          entityId: booking.id,
          detail: `${booking.reference}: ${booking.totalClientPays} -> ${pricing.totalClientPays} FCFA; déplacement ${booking.transportFee} -> ${pricing.transportFee} FCFA. Ancien lien PayDunya terminal invalidé.`,
          oldStatus: booking.paydunyaStatus || "PENDING",
          newStatus: "REPRICED",
        },
      }),
    ]);
    updated += 1;
  }

  if (apply) {
    const [teachers, users] = await db.$transaction([
      db.teacher.updateMany({ where: { quartier: { equals: "Mermoze", mode: "insensitive" } }, data: { quartier: "Mermoz" } }),
      db.user.updateMany({ where: { quartier: { equals: "Mermoze", mode: "insensitive" } }, data: { quartier: "Mermoz" } }),
    ]);
    console.log(JSON.stringify({ canonicalizedTeachers: teachers.count, canonicalizedUsers: users.count }));
  }

  console.log(JSON.stringify({ scanned: drafts.length, updated, skippedActiveInvoice, apply }));
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
