import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { ACTIVE_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";
import { requireTeacherApi } from "@/lib/teacher-auth";
import {
  getTeacherGlobalRetentionLedger,
  getTeacherFinancialSettlement,
} from "@/lib/teacher-payments";
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

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const reference = generateReference("REQ-PROF");
  try {
    const result = await db.$transaction(async (tx) => {
      // Le calcul du disponible et la création de sa réservation PENDING
      // doivent partager le même snapshot. Deux POST concurrents ne peuvent
      // ainsi plus consommer deux fois le même solde professeur.
      const [
        bookings,
        adjustments,
        pendingRequests,
        draftAllocations,
        historicalSessionRetentions,
        historicalLegacyRetentions,
      ] = await Promise.all([
        tx.booking.findMany({
          where: verifiedPayDunyaBookingWhere({
            OR: [
              {
                teacherId: teacher.id,
                status: { notIn: ["CANCELLED", "REFUNDED"] },
                OR: [
                  {
                    // Ledger moderne : seules les séances effectivement libérées
                    // et encore dues à ce professeur deviennent demandables.
                    sessions: {
                      some: {
                        teacherId: teacher.id,
                        status: { in: ["RELEASED", "PARTIALLY_PAID"] },
                      },
                    },
                  },
                  {
                    // Compatibilité avec les anciennes réservations sans ledger
                    // par séance. Ne jamais utiliser ce fallback si des séances
                    // existent, notamment après un remplacement global.
                    sessions: { none: {} },
                    teacherNetAmount: { gt: 0 },
                    paymentStatus: "TO_PAY_TEACHER",
                  },
                ],
              },
              {
                teacherId: teacher.id,
                status: { in: ["CANCELLED", "REFUNDED"] },
                paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
                cancellationPenaltyTeacherAmount: { gt: 0 },
              },
              {
                // Une réservation conserve son professeur d'origine : un
                // remplaçant est donc retrouvé par le ledger de ses séances.
                teacherId: { not: teacher.id },
                status: { notIn: ["CANCELLED", "REFUNDED"] },
                sessions: {
                  some: {
                    teacherId: teacher.id,
                    status: { in: ["RELEASED", "PARTIALLY_PAID"] },
                  },
                },
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
            paymentProvider: true,
            providerPaymentStatus: true,
            paymentVerifiedAt: true,
            transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
            sessions: {
              where: { teacherId: teacher.id },
              select: {
                status: true,
                teacherNetAmount: true,
                releasedAmount: true,
                paidAmount: true,
                retainedAmount: true,
              },
              orderBy: { sequence: "asc" },
            },
          },
        }),
        tx.teacherPaymentAdjustment.findMany({
          where: { teacherId: teacher.id },
          select: { bookingId: true, amount: true, status: true },
        }),
        tx.teacherPayoutRequest.aggregate({
          where: { teacherId: teacher.id, status: "PENDING" },
          _sum: { amount: true },
        }),
        tx.teacherPayoutAllocation.findMany({
          where: { payout: { teacherId: teacher.id, status: "DRAFT" } },
          select: {
            amount: true,
            payout: { select: { payoutRequest: { select: { status: true } } } },
          },
        }),
        tx.bookingSession.findMany({
          where: { teacherId: teacher.id, retainedAmount: { gt: 0 } },
          select: { bookingId: true, retainedAmount: true },
        }),
        tx.teacherPayoutAllocation.findMany({
          where: {
            bookingSessionId: null,
            retainedAmountSnapshot: { gt: 0 },
            payout: {
              teacherId: teacher.id,
              status: { in: ["DRAFT", "PAID"] },
            },
          },
          select: { bookingId: true, retainedAmountSnapshot: true },
        }),
      ]);

      const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
      // Les ajustements rattachés à une réservation sont déjà pris en
      // compte par getTeacherFinancialSettlement. Une retenue globale
      // affectée à un ancien booking sans séance n'y possède pas de
      // retainedAmount : son snapshot doit donc continuer à réduire ce
      // booking après un paiement partiel. Le reliquat non affecté est ensuite
      // déduit une seule fois du solde global.
      const globalRetentionLedger = getTeacherGlobalRetentionLedger(
        adjustments,
        historicalSessionRetentions,
        historicalLegacyRetentions,
      );
      const readyAfterAssignedLegacyRetentions = verifiedBookings.reduce((sum, booking) => {
        const remaining = getTeacherFinancialSettlement(booking, adjustments).remaining;
        const assignedLegacyRetention = globalRetentionLedger.legacyByBooking.get(booking.id) ?? 0;
        return sum + Math.max(0, remaining - assignedLegacyRetention);
      }, 0);
      const readyToReceive = Math.max(
        0,
        readyAfterAssignedLegacyRetentions - globalRetentionLedger.remaining,
      );
      const pendingAmount = pendingRequests._sum.amount ?? 0;
      // Une demande PENDING reliée à un DRAFT réserve déjà son montant.
      // Les autres allocations DRAFT (versement admin direct) sont ajoutées
      // sans compter deux fois celles issues d'une demande professeur.
      const draftReservedAmount = draftAllocations.reduce((sum, allocation) => (
        allocation.payout.payoutRequest?.status === "PENDING"
          ? sum
          : sum + Math.max(0, allocation.amount)
      ), 0);
      const requestableAmount = Math.max(0, readyToReceive - pendingAmount - draftReservedAmount);

      if (requestableAmount <= 0) {
        return { ok: false as const, error: "Aucun montant payable n'est disponible pour une nouvelle demande." };
      }
      if (amount > requestableAmount) {
        return {
          ok: false as const,
          error: `Le montant demandé dépasse le solde disponible (${requestableAmount.toLocaleString("fr-FR")} FCFA).`,
        };
      }

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
        data: {
          defaultPayoutMethod: method,
          defaultPayoutPhone: paymentPhone,
          lastActivityAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: "Demande de paiement professeur",
          message: `${teacherName} demande ${amount.toLocaleString("fr-FR")} FCFA via ${paymentMethodLabel(method)}. Numéro déclaré : ${paymentPhone}.`,
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
          detail: `${teacherName} a demandé ${amount.toLocaleString("fr-FR")} FCFA via ${paymentMethodLabel(method)}. Référence demande : ${reference}.`,
          newStatus: "PENDING_PAYOUT_REQUEST",
        },
      });

      return { ok: true as const, request: created };
    }, { isolationLevel: "Serializable" });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, request: result.request });
  } catch (error) {
    if (errorCode(error) === "P2034") {
      return NextResponse.json({
        error: "Le solde professeur vient d'être réservé depuis une autre demande. Actualisez avant de réessayer.",
        code: "PAYOUT_REQUEST_BALANCE_CONFLICT",
      }, { status: 409 });
    }
    throw error;
  }
}

function errorCode(error: unknown) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") return error.code;
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "UNKNOWN";
}
