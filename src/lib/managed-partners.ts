import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeAccountPhone } from "@/lib/account-phone";
import { ManagedCourseError } from "@/lib/managed-course-error";
type Tx = Prisma.TransactionClient;

export const managedPartnerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(8).max(32),
  })
  .strict();
export async function lockManagedPartner(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "ManagedPartner" WHERE id=${id} FOR UPDATE`;
}
export async function managedPartnerBalance(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<
    { earned: bigint; paid: bigint; held: bigint }[]
  >`
    SELECT
      COALESCE((SELECT sum(round(s."fundedAmount"::numeric*d."partnerRateBps"/10000)) FROM "ManagedCourseSession" s JOIN "ManagedCourseDossier" d ON d.id=s."dossierId" WHERE d."partnerId"=${id} AND s.status='VALIDATED'),0)::bigint AS earned,
      -COALESCE((SELECT sum(p."amountDelta") FROM "ManagedPartnerPayment" p WHERE p."partnerId"=${id}),0)::bigint AS paid,
      COALESCE((SELECT sum(round(s."fundedAmount"::numeric*d."partnerRateBps"/10000)) FROM "ManagedCourseSession" s JOIN "ManagedCourseDossier" d ON d.id=s."dossierId" WHERE d."partnerId"=${id} AND s.status='VALIDATED' AND d."onHold"),0)::bigint AS held`;
  const earned = Number(row.earned),
    paid = Number(row.paid),
    held = Number(row.held);
  return {
    earned,
    paid,
    held,
    available: Math.max(0, earned - paid - held),
    remaining: earned - paid,
  };
}
export async function createManagedPartner(raw: unknown, adminId: string) {
  const input = managedPartnerSchema.parse(raw);
  const phone = normalizeAccountPhone(input.phone);
  if (!phone || !/^\+225(01|05|07)\d{8}$/.test(phone))
    throw new ManagedCourseError("Numéro mobile ivoirien invalide.", 400);
  return db.$transaction(async (tx) => {
    const partner = await tx.managedPartner.create({
      data: { name: input.name, phone, createdBy: adminId },
    });
    await tx.adminActionLog.create({
      data: {
        adminId,
        action: "MANAGED_PARTNER_CREATED",
        entityType: "ManagedPartner",
        entityId: partner.id,
        detail: "Partenaire enregistré par l’administration",
      },
    });
    return { id: partner.id };
  });
}
export async function setManagedPartnerActive(
  id: string,
  active: boolean,
  adminId: string,
) {
  return db.$transaction(async (tx) => {
    await lockManagedPartner(tx, id);
    await tx.managedPartner.update({ where: { id }, data: { active } });
    await tx.adminActionLog.create({
      data: {
        adminId,
        action: "MANAGED_PARTNER_STATUS",
        entityType: "ManagedPartner",
        entityId: id,
        detail: active ? "Réactivé" : "Nouvelles attributions désactivées",
      },
    });
    return { ok: true };
  });
}
export async function setManagedDossierPartner(
  id: string,
  partnerId: string | null,
  ratePercent: number,
  adminId: string,
) {
  const rate = Math.round(ratePercent * 100);
  if (
    !Number.isFinite(ratePercent) ||
    !Number.isInteger(rate) ||
    Math.abs(ratePercent * 100 - rate) > 0.00001 ||
    rate < 0 ||
    rate > 10000 ||
    (!partnerId && rate !== 0)
  )
    throw new ManagedCourseError("Partenariat invalide.", 400);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ManagedCourseDossier" WHERE id=${id} FOR UPDATE`;
    const dossier = await tx.managedCourseDossier.findUnique({
      where: { id },
      include: {
        sessions: { select: { teacherId: true, status: true } },
        offers: { select: { status: true } },
      },
    });
    if (!dossier) throw new ManagedCourseError("Dossier introuvable.", 404);
    if (
      dossier.receivedAmount ||
      dossier.onHold ||
      dossier.sessions.some((s) => s.teacherId || s.status !== "PLANNED") ||
      dossier.offers.some((o) =>
        [
          "OFFERED",
          "ACCEPTED",
          "CANCEL_REQUESTED",
          "PARTIAL_CANCELLED",
        ].includes(o.status),
      )
    )
      throw new ManagedCourseError(
        "Fixez le partenariat avant l’envoi au professeur et avant tout encaissement.",
      );
    if (partnerId) {
      await lockManagedPartner(tx, partnerId);
      const partner = await tx.managedPartner.findUnique({
        where: { id: partnerId },
      });
      if (!partner?.active)
        throw new ManagedCourseError(
          "Choisissez un partenaire actif enregistré par l’administration.",
          400,
        );
    }
    await tx.managedCourseDossier.update({
      where: { id },
      data: { partnerId, partnerRateBps: rate },
    });
    await tx.managedCourseEvent.create({
      data: {
        dossierId: id,
        actorId: adminId,
        action: "PARTNER_ASSIGNED",
        details: { partnerId, rateBps: rate, basis: "FINAL_COURSE_AMOUNT" },
      },
    });
    return { ok: true };
  });
}
type Payment = {
  amount: number;
  method: string;
  reference: string;
  note: string;
  idempotencyKey: string;
};
export async function recordManagedPartnerPayment(
  id: string,
  input: Payment,
  adminId: string,
) {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < 1 ||
    input.note.trim().length < 10
  )
    throw new ManagedCourseError(
      "Vérifiez le montant et la justification.",
      400,
    );
  return db.$transaction(async (tx) => {
    await lockManagedPartner(tx, id);
    const partner = await tx.managedPartner.findUnique({ where: { id } });
    if (!partner) throw new ManagedCourseError("Partenaire introuvable.", 404);
    const existing = await tx.managedPartnerPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (
        existing.partnerId !== id ||
        existing.amountDelta !== -input.amount ||
        existing.method !== input.method ||
        existing.reference !== input.reference ||
        existing.kind !== "PAYMENT"
      )
        throw new ManagedCourseError(
          "Cette référence concerne une autre opération.",
        );
      return { ok: true };
    }
    const balance = await managedPartnerBalance(tx, id);
    if (input.amount > balance.available)
      throw new ManagedCourseError(
        "Montant supérieur aux commissions acquises disponibles après règlements et retenues.",
      );
    await tx.managedPartnerPayment.create({
      data: {
        partnerId: id,
        kind: "PAYMENT",
        amountDelta: -input.amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        actorId: adminId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminId,
        action: "MANAGED_PARTNER_PAID",
        entityType: "ManagedPartner",
        entityId: id,
        detail: JSON.stringify({
          amount: input.amount,
          reference: input.reference,
        }),
      },
    });
    return { ok: true };
  });
}
export async function reverseManagedPartnerPayment(
  id: string,
  paymentId: string,
  note: string,
  adminId: string,
) {
  if (note.trim().length < 10)
    throw new ManagedCourseError("Expliquez la correction.", 400);
  return db.$transaction(async (tx) => {
    await lockManagedPartner(tx, id);
    const entry = await tx.managedPartnerPayment.findFirst({
      where: { id: paymentId, partnerId: id, kind: "PAYMENT" },
    });
    if (!entry) throw new ManagedCourseError("Versement introuvable.", 404);
    if (
      await tx.managedPartnerPayment.findUnique({
        where: { reversesId: entry.id },
      })
    )
      return { ok: true };
    await tx.managedPartnerPayment.create({
      data: {
        partnerId: id,
        kind: "PAYMENT_REVERSAL",
        amountDelta: -entry.amountDelta,
        reversesId: entry.id,
        method: entry.method,
        reference: `CORRECTION-${entry.id}`,
        note,
        actorId: adminId,
        idempotencyKey: `partner-reversal:${entry.id}`,
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminId,
        action: "MANAGED_PARTNER_PAYMENT_REVERSED",
        entityType: "ManagedPartner",
        entityId: id,
        detail: JSON.stringify({ paymentId, note }),
      },
    });
    return { ok: true };
  });
}
