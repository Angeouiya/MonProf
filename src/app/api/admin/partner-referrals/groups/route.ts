import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { normalizePartnerReferralPhone } from "@/lib/partner-referrals";

const PAYOUT_METHODS = new Set<PaymentMethod>(["WAVE", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY"]);

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await req.json();
  const promoterPhone = normalizePartnerReferralPhone(body.promoterPhone);
  const identityName = typeof body.identityName === "string" ? body.identityName.trim().slice(0, 160) : "";
  const payoutMethod = PAYOUT_METHODS.has(body.payoutMethod) ? body.payoutMethod as PaymentMethod : null;
  const payoutPhone = normalizePartnerReferralPhone(body.payoutPhone);
  const payoutReference = typeof body.payoutReference === "string" ? body.payoutReference.trim().slice(0, 160) : "";
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 800) : "";

  if (!promoterPhone) {
    return NextResponse.json({ error: "Numéro partenaire requis pour payer un lot." }, { status: 400 });
  }
  const groupPhone = promoterPhone;
  if (!identityName) {
    return NextResponse.json({ error: "Nom officiel vérifié sur la pièce requis pour le lot." }, { status: 400 });
  }
  if (!payoutMethod || !payoutPhone || !payoutReference) {
    return NextResponse.json({ error: "Moyen, téléphone et référence de dépôt sont requis." }, { status: 400 });
  }

  const payableRows = await db.partnerReferral.findMany({
    where: { status: "PAYABLE", promoterPhone: { not: null } },
    include: { booking: { select: { reference: true } } },
    orderBy: { payableAt: "asc" },
  });
  const referrals = payableRows.filter((item) => normalizePartnerReferralPhone(item.promoterPhone) === groupPhone);

  if (referrals.length === 0) {
    return NextResponse.json({ error: "Aucune commission payable pour ce numéro." }, { status: 404 });
  }

  const now = new Date();
  const totalAmount = referrals.reduce((sum, item) => sum + Math.max(0, item.commissionAmount), 0);
  const groupNote = `Lot partenaire payé : ${referrals.length} commission(s), ${totalAmount} FCFA. Référence dépôt : ${payoutReference}.`;

  try {
    await db.$transaction(async (tx) => {
      const updates = await Promise.all(referrals.map((referral) => tx.partnerReferral.updateMany({
        where: { id: referral.id, status: "PAYABLE" },
        data: {
          status: "PAID",
          paidAt: now,
          paidById: admin.id,
          payoutMethod,
          payoutPhone,
          payoutReference,
          promoterIdentityName: identityName,
          promoterIdentityVerifiedAt: referral.promoterIdentityVerifiedAt ?? now,
          adminNote: appendAdminNote(referral.adminNote, appendAdminNote(adminNote, groupNote)),
        },
      })));
      if (updates.some((result) => result.count !== 1)) {
        throw new PartnerReferralGroupConflictError();
      }

      await tx.adminActionLog.createMany({
        data: [
          {
            adminId: admin.id,
            action: "Lot commissions partenaire payé",
            entityType: "PartnerReferralGroup",
            entityId: groupPhone,
            detail: `${referrals.length} commission(s) payée(s) au ${groupPhone}, total ${totalAmount} FCFA par ${payoutMethod}. Référence : ${payoutReference}.`,
            oldStatus: "PAYABLE",
            newStatus: "PAID",
          },
          ...referrals.map((referral) => ({
            adminId: admin.id,
            action: "Commission partenaire payée dans un lot",
            entityType: "PartnerReferral",
            entityId: referral.id,
            detail: `Déclaration ${referral.booking.reference}. Commission ${referral.commissionAmount} FCFA payée dans le lot ${groupPhone}. Référence : ${payoutReference}.`,
            oldStatus: "PAYABLE",
            newStatus: "PAID",
          })),
        ],
      });
    });
  } catch (error) {
    if (error instanceof PartnerReferralGroupConflictError) {
      return NextResponse.json({ error: "Le lot a changé pendant le paiement. Actualisez et recommencez." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    message: `${referrals.length} commission(s) payée(s) pour ${totalAmount.toLocaleString("fr-FR")} FCFA.`,
    paidCount: referrals.length,
    paidAmount: totalAmount,
  });
}

function appendAdminNote(note: string | null, fallback: string) {
  return [note, fallback].filter(Boolean).join("\n");
}

class PartnerReferralGroupConflictError extends Error {
  constructor() {
    super("Partner referral group changed during payout");
    this.name = "PartnerReferralGroupConflictError";
  }
}
