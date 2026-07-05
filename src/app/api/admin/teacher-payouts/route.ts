import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { ACTIVE_PAYMENT_METHODS, isActivePaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

const PAYMENT_METHODS: readonly PaymentMethod[] = ACTIVE_PAYMENT_METHODS;
const MAX_REFERENCE_LENGTH = 80;
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
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const targetBookingId = typeof body.bookingId === "string" && body.bookingId.trim() ? body.bookingId.trim() : null;
  const requestId = typeof body.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : null;
  const amount = parseAmount(body.amount);
  const method = typeof body.method === "string" && PAYMENT_METHODS.includes(body.method as PaymentMethod)
    ? (body.method as PaymentMethod)
    : undefined;
  const requestedPaymentPhone = normalizePhone(body.paymentPhone);
  const requestedPaymentPhoneConfirm = normalizePhone(body.paymentPhoneConfirm);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const reference = typeof body.reference === "string" && body.reference.trim()
    ? body.reference.trim()
    : generateReference("PAY-PROF");

  if (!teacherId) {
    return NextResponse.json({ error: "Professeur requis." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant de paiement invalide." }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json({ error: "Choisissez le moyen de paiement professeur." }, { status: 400 });
  }
  if (reference.length > MAX_REFERENCE_LENGTH) {
    return NextResponse.json({ error: `Référence trop longue (${MAX_REFERENCE_LENGTH} caractères maximum).` }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note interne trop longue (${MAX_NOTE_LENGTH} caractères maximum).` }, { status: 400 });
  }
  const duplicateReference = await db.teacherPayoutRecord.findUnique({ where: { reference } });
  if (duplicateReference) {
    return NextResponse.json({ error: "Cette référence de paiement professeur existe déjà." }, { status: 400 });
  }

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      bookings: {
        where: { paymentStatus: "TO_PAY_TEACHER" },
        orderBy: [{ clientValidatedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          reference: true,
          teacherNetAmount: true,
          teacherPaidAmount: true,
          paymentStatus: true,
          paymentMethod: true,
          totalClientPays: true,
          totalPrice: true,
          paydunyaStatus: true,
          paydunyaVerifiedAt: true,
          status: true,
          transactions: {
            where: { type: "CLIENT_PAYMENT" },
            select: { type: true, status: true, amount: true },
          },
        },
      },
      paymentAdjustments: {
        where: { status: "APPLIED" },
        select: { amount: true, bookingId: true },
      },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
  }

  const payoutRequest = requestId
    ? await db.teacherPayoutRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          reference: true,
          teacherId: true,
          amount: true,
          method: true,
          paymentPhone: true,
          status: true,
        },
      })
    : null;

  if (requestId && !payoutRequest) {
    return NextResponse.json({ error: "Demande de paiement introuvable." }, { status: 404 });
  }
  if (payoutRequest && payoutRequest.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Cette demande de paiement n'appartient pas à ce professeur." }, { status: 400 });
  }
  if (payoutRequest && payoutRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Cette demande de paiement a déjà été traitée." }, { status: 400 });
  }
  if (payoutRequest && payoutRequest.amount !== amount) {
    return NextResponse.json({ error: `La demande ${payoutRequest.reference} porte sur ${payoutRequest.amount} FCFA. Enregistrez ce montant ou désélectionnez la demande.` }, { status: 400 });
  }
  if (payoutRequest && payoutRequest.method !== method) {
    return NextResponse.json({
      error: `La demande ${payoutRequest.reference} a été faite via ${paymentMethodLabel(payoutRequest.method)}. Désélectionnez-la pour utiliser un autre moyen de paiement.`,
    }, { status: 400 });
  }

  const paymentPhone = payoutRequest?.paymentPhone ?? requestedPaymentPhone;
  if (paymentPhone.length < 8 || paymentPhone.length > 20) {
    return NextResponse.json({ error: "Numéro de paiement professeur requis et invalide." }, { status: 400 });
  }
  if (!payoutRequest) {
    if (!requestedPaymentPhoneConfirm) {
      return NextResponse.json({ error: "Confirmez le numéro de paiement professeur." }, { status: 400 });
    }
    if (paymentPhone !== requestedPaymentPhoneConfirm) {
      return NextResponse.json({ error: "Les deux numéros de paiement ne correspondent pas." }, { status: 400 });
    }
  }

  let globalRetentionLeft = teacher.paymentAdjustments
    .filter((adjustment) => !adjustment.bookingId)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
  const dueBookings = teacher.bookings
    .filter((booking) => hasVerifiedPayDunyaClientPayment(booking))
    .map((booking) => {
      const paid = Math.max(0, booking.teacherPaidAmount);
      const grossRemaining = Math.max(0, booking.teacherNetAmount - paid);
      const bookingRetention = teacher.paymentAdjustments
        .filter((adjustment) => adjustment.bookingId === booking.id)
        .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
      const globalRetention = Math.min(Math.max(0, grossRemaining - bookingRetention), globalRetentionLeft);
      globalRetentionLeft -= globalRetention;
      const retainedAmount = Math.min(grossRemaining, bookingRetention + globalRetention);
      return {
        ...booking,
        paid,
        retainedAmount,
        remaining: Math.max(0, grossRemaining - retainedAmount),
      };
    })
    .filter((booking) => booking.remaining > 0 || booking.retainedAmount > 0);
  const allocationCandidates = targetBookingId
    ? dueBookings.filter((booking) => booking.id === targetBookingId)
    : dueBookings;
  const totalDue = allocationCandidates.reduce((sum, booking) => sum + booking.remaining, 0);

  if (targetBookingId && allocationCandidates.length === 0) {
    return NextResponse.json({ error: "Cette réservation n'est pas payable pour ce professeur ou n'a plus de reste dû." }, { status: 400 });
  }

  if (totalDue <= 0) {
    return NextResponse.json({ error: targetBookingId ? "Aucun reste net à payer sur cette réservation après retenues appliquées." : "Aucun montant net à payer pour ce professeur après retenues appliquées." }, { status: 400 });
  }
  if (amount > totalDue) {
    return NextResponse.json({
      error: `Le montant dépasse le net à payer après retenues (${totalDue} FCFA).`,
    }, { status: 400 });
  }

  let remainingPayment = amount;
  const allocations: { booking: (typeof dueBookings)[number]; amount: number }[] = [];
  for (const booking of allocationCandidates) {
    if (remainingPayment <= 0) break;
    const allocated = Math.min(booking.remaining, remainingPayment);
    if (allocated <= 0) continue;
    allocations.push({ booking, amount: allocated });
    remainingPayment -= allocated;
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const allocationSummary = allocations
    .map((allocation) => `- ${allocation.booking.reference} : ${allocation.amount.toLocaleString("fr-FR")} FCFA`)
    .join("\n");
  const payout = await db.$transaction(async (tx) => {
    const record = await tx.teacherPayoutRecord.create({
      data: {
        reference,
        teacherId: teacher.id,
        amount,
        method,
        paymentPhone,
        note: note || null,
        paidAt: now,
        createdById: admin.id,
        allocations: {
          create: allocations.map((allocation) => ({
            bookingId: allocation.booking.id,
            amount: allocation.amount,
          })),
        },
      },
      include: {
        allocations: { include: { booking: { select: { reference: true } } } },
      },
    });

    const allocatedByBooking = new Map(allocations.map((allocation) => [allocation.booking.id, allocation.amount]));
    for (const booking of dueBookings) {
      const allocated = allocatedByBooking.get(booking.id) ?? 0;
      const newPaid = booking.teacherPaidAmount + allocated;
      const fullyPaid = newPaid + booking.retainedAmount >= booking.teacherNetAmount;
      if (allocated <= 0 && !fullyPaid) continue;

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          teacherPaidAmount: newPaid,
          paymentStatus: fullyPaid ? "TEACHER_PAID" : "TO_PAY_TEACHER",
          status: fullyPaid ? "TEACHER_PAID" : booking.status,
          teacherPaidAt: fullyPaid ? now : null,
        },
      });
      if (allocated > 0) {
        const payoutMethod = method ?? (isActivePaymentMethod(booking.paymentMethod) ? booking.paymentMethod : null);
        await tx.transaction.create({
          data: {
            reference: generateReference("TX-PROF"),
            bookingId: booking.id,
            teacherId: teacher.id,
            amount: allocated,
            commission: 0,
            teacherNet: allocated,
            type: "TEACHER_PAYOUT",
            status: fullyPaid ? "TEACHER_PAID" : "TO_PAY_TEACHER",
            method: payoutMethod,
            paidAt: now,
          },
        });
      }
      if (fullyPaid) {
        await tx.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "TEACHER_PAID", paidAt: now },
        });
      }
    }

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Paiement professeur enregistré",
        entityType: "Teacher",
        entityId: teacher.id,
        detail: `${admin.name} a enregistré ${amount} FCFA pour ${teacherName} (${allocations.length} réservation(s))${targetBookingId ? " avec imputation ciblée" : ""}${payoutRequest ? ` depuis la demande ${payoutRequest.reference}` : ""}. Référence: ${reference}.`,
        oldStatus: "TO_PAY_TEACHER",
        newStatus: "PAID_LEDGER",
      },
    });

    if (payoutRequest) {
      await tx.teacherPayoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          status: "PAID",
          adminNote: `Versement enregistré par ${admin.name}. Reçu ${record.reference}. Numéro déclaré : ${paymentPhone}.`,
          reviewedAt: now,
          reviewedById: admin.id,
          payoutRecordId: record.id,
        },
      });
    }

    await tx.teacherNotification.create({
      data: {
        teacherId: teacher.id,
        bookingId: allocations[0]?.booking.id,
        title: `Paiement enregistré - ${reference}`,
        message: [
          `Bonjour ${teacherName},`,
          "",
          `Un paiement professeur de ${amount.toLocaleString("fr-FR")} FCFA a été enregistré par le service client Compétence.`,
          `Référence interne : ${reference}`,
          method ? `Méthode : ${paymentMethodLabel(method)}` : "",
          paymentPhone ? `Numéro payé : ${paymentPhone}` : "",
          note ? `Note : ${note}` : "",
          "",
          "Réservations concernées :",
          allocationSummary || "- Allocation non détaillée",
          "",
          "Ce message est une notification opérationnelle. Conservez votre preuve opérateur si un paiement Mobile Money a été effectué.",
        ].filter(Boolean).join("\n"),
        channel: "WHATSAPP",
        sent: false,
        status: "PENDING",
        sentById: admin.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: "Paiement professeur enregistré",
        message: `${amount} FCFA enregistrés pour ${teacherName}. Référence interne : ${reference}. Une notification professeur est prête à transmettre.`,
        type: "TEACHER_PAYOUT",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel: "WHATSAPP",
        status: "CREATED",
        priority: "NORMAL",
        teacherId: teacher.id,
        bookingId: allocations[0]?.booking.id,
        adminId: admin.id,
        link: allocations[0]?.booking.id
          ? `/admin/professeurs/${teacher.id}?tab=paiements&bookingId=${allocations[0].booking.id}`
          : `/admin/professeurs/${teacher.id}?tab=paiements`,
        actionLabel: "Ouvrir comptabilité",
      },
    });

    return record;
  });

  return NextResponse.json({ ok: true, payout });
}
