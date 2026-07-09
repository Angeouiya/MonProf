import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { ACTIVE_PAYMENT_METHODS } from "@/lib/payment-methods";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { getTeacherFinancialSettlement } from "@/lib/teacher-payments";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

const PAYMENT_METHODS: readonly PaymentMethod[] = ACTIVE_PAYMENT_METHODS;
const MAX_NOTE_LENGTH = 500;

function parseAmount(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") return Math.round(Number(value.replace(/\s/g, "")));
  return 0;
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
}

export async function POST(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = parseAmount(body.amount);
  const method = typeof body.method === "string" && PAYMENT_METHODS.includes(body.method as PaymentMethod)
    ? (body.method as PaymentMethod)
    : null;
  const paymentPhone = normalizePhone(body.paymentPhone);
  const paymentPhoneConfirm = normalizePhone(body.paymentPhoneConfirm);
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant demandé invalide." }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json({ error: "Choisissez le moyen de paiement." }, { status: 400 });
  }
  if (paymentPhone.length < 8 || paymentPhone.length > 20) {
    return NextResponse.json({ error: "Numéro de paiement invalide." }, { status: 400 });
  }
  if (paymentPhone !== paymentPhoneConfirm) {
    return NextResponse.json({ error: "Les deux numéros de paiement ne correspondent pas." }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note trop longue (${MAX_NOTE_LENGTH} caractères maximum).` }, { status: 400 });
  }

  const [bookings, adjustments, pendingRequests] = await db.$transaction([
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        teacherId: teacher.id,
        OR: [
          {
            teacherNetAmount: { gt: 0 },
            paymentStatus: "TO_PAY_TEACHER",
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
          {
            status: { in: ["CANCELLED", "REFUNDED"] },
            paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
            cancellationPenaltyTeacherAmount: { gt: 0 },
          },
        ],
      }),
      select: {
        id: true,
        status: true,
        teacherNetAmount: true,
        teacherPaidAmount: true,
        cancellationPenaltyTeacherAmount: true,
        paymentStatus: true,
        totalClientPays: true,
        totalPrice: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      },
    }),
    db.teacherPaymentAdjustment.findMany({
      where: { teacherId: teacher.id },
      select: { bookingId: true, amount: true, status: true },
    }),
    db.teacherPayoutRequest.aggregate({
      where: { teacherId: teacher.id, status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const readyToReceive = verifiedBookings.reduce((sum, booking) => (
    sum + getTeacherFinancialSettlement(booking, adjustments).remaining
  ), 0);
  const pendingAmount = pendingRequests._sum.amount ?? 0;
  const requestableAmount = Math.max(0, readyToReceive - pendingAmount);

  if (requestableAmount <= 0) {
    return NextResponse.json({ error: "Aucun montant payable n'est disponible pour une nouvelle demande." }, { status: 400 });
  }
  if (amount > requestableAmount) {
    return NextResponse.json({
      error: `Le montant demandé dépasse le solde disponible (${requestableAmount.toLocaleString("fr-FR")} FCFA).`,
    }, { status: 400 });
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const reference = generateReference("REQ-PROF");
  const request = await db.$transaction(async (tx) => {
    const created = await tx.teacherPayoutRequest.create({
      data: {
        reference,
        teacherId: teacher.id,
        amount,
        method,
        paymentPhone,
        note: note || null,
      },
    });

    await tx.teacher.update({
      where: { id: teacher.id },
      data: { lastActivityAt: now },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: "Demande de paiement professeur",
        message: `${teacherName} demande ${amount.toLocaleString("fr-FR")} FCFA via ${method}. Numéro déclaré : ${paymentPhone}.`,
        type: "TEACHER_PAYOUT_REQUEST",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CREATED",
        priority: "IMPORTANT",
        teacherId: teacher.id,
        link: `/admin/professeurs/${teacher.id}?tab=paiements&payoutRequestId=${created.id}`,
        actionLabel: "Ouvrir comptabilité",
        actionType: "REVIEW_TEACHER_PAYOUT_REQUEST",
      },
    });

    await tx.adminActionLog.create({
      data: {
        action: "Demande de paiement professeur",
        entityType: "Teacher",
        entityId: teacher.id,
        detail: `${teacherName} a demandé ${amount.toLocaleString("fr-FR")} FCFA via ${method}. Référence demande : ${reference}.`,
        newStatus: "PENDING_PAYOUT_REQUEST",
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, request });
}
