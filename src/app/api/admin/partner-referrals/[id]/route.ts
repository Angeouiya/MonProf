import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { normalizePartnerReferralPhone } from "@/lib/partner-referrals";

const PAYOUT_METHODS = new Set<PaymentMethod>(["WAVE", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date();
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 800) : "";
  const identityName = typeof body.identityName === "string" ? body.identityName.trim().slice(0, 160) : "";
  const payoutMethod = PAYOUT_METHODS.has(body.payoutMethod) ? body.payoutMethod as PaymentMethod : null;
  const payoutPhone = normalizePartnerReferralPhone(body.payoutPhone);
  const payoutReference = typeof body.payoutReference === "string" ? body.payoutReference.trim().slice(0, 160) : "";

  const referral = await db.partnerReferral.findUnique({
    where: { id },
    include: { booking: { select: { reference: true } } },
  });
  if (!referral) return NextResponse.json({ error: "Déclaration introuvable." }, { status: 404 });

  if (action === "verify_identity") {
    if (referral.status !== "PAYABLE") {
      return NextResponse.json({ error: "La commission doit être payable avant la vérification finale." }, { status: 400 });
    }
    if (!identityName) {
      return NextResponse.json({ error: "Indiquez le nom officiel vu sur la pièce." }, { status: 400 });
    }
    await db.$transaction(async (tx) => {
      await tx.partnerReferral.update({
        where: { id },
        data: {
          promoterIdentityName: identityName,
          promoterIdentityVerifiedAt: now,
          adminNote: appendAdminNote(referral.adminNote, adminNote || "Pièce d'identité vérifiée."),
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Pièce apporteur vérifiée",
          entityType: "PartnerReferral",
          entityId: id,
          detail: `Déclaration ${referral.booking.reference}. Nom pièce : ${identityName}.`,
          oldStatus: referral.status,
          newStatus: referral.status,
        },
      });
    });
    return NextResponse.json({ ok: true, message: "Pièce enregistrée." });
  }

  if (action === "mark_paid") {
    if (referral.status !== "PAYABLE") {
      return NextResponse.json({ error: "Seules les commissions payables peuvent être marquées payées." }, { status: 400 });
    }
    if (!payoutMethod || !payoutPhone || !payoutReference) {
      return NextResponse.json({ error: "Moyen, téléphone et référence de dépôt sont requis." }, { status: 400 });
    }
    await db.$transaction(async (tx) => {
      await tx.partnerReferral.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: now,
          paidById: admin.id,
          payoutMethod,
          payoutPhone,
          payoutReference,
          promoterIdentityName: identityName || referral.promoterIdentityName,
          promoterIdentityVerifiedAt: identityName ? referral.promoterIdentityVerifiedAt ?? now : referral.promoterIdentityVerifiedAt,
          adminNote: appendAdminNote(referral.adminNote, adminNote || `Commission payée. Référence dépôt : ${payoutReference}.`),
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Commission partenaire payée",
          entityType: "PartnerReferral",
          entityId: id,
          detail: `Déclaration ${referral.booking.reference}. Commission ${referral.commissionAmount} FCFA payée par ${payoutMethod} au ${payoutPhone}. Référence : ${payoutReference}.`,
          oldStatus: referral.status,
          newStatus: "PAID",
        },
      });
    });
    return NextResponse.json({ ok: true, message: "Commission marquée payée." });
  }

  if (action === "reject") {
    if (["PAID", "REJECTED", "EXPIRED"].includes(referral.status)) {
      return NextResponse.json({ error: "Ce dossier ne peut plus être rejeté." }, { status: 400 });
    }
    await db.$transaction(async (tx) => {
      await tx.partnerReferral.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          adminNote: appendAdminNote(referral.adminNote, adminNote || "Déclaration rejetée par l'administration."),
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Déclaration partenaire rejetée",
          entityType: "PartnerReferral",
          entityId: id,
          detail: `Déclaration ${referral.booking.reference} rejetée.${adminNote ? ` Note : ${adminNote}` : ""}`,
          oldStatus: referral.status,
          newStatus: "REJECTED",
        },
      });
    });
    return NextResponse.json({ ok: true, message: "Déclaration rejetée." });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}

function appendAdminNote(existing: string | null, note: string) {
  return [existing, note].filter(Boolean).join("\n");
}
