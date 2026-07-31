import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { ACTIVE_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";
import { requireTeacherApi } from "@/lib/teacher-auth";
import {
  calculateTeacherPayoutAvailability,
  getTeacherGlobalRetentionLedger,
  getTeacherFinancialSettlement,
} from "@/lib/teacher-payments";
import { lockTeacherPayoutBalance } from "@/lib/teacher-payout-reservations";
import {
  normalizeTeacherPayoutRequestIdempotencyKey,
  resolveTeacherPayoutRequestIdempotency,
  TEACHER_PAYOUT_REQUEST_IDEMPOTENCY_ERROR,
  type TeacherPayoutRequestIntent,
} from "@/lib/teacher-payout-request-idempotency";
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

  const idempotencyKey = normalizeTeacherPayoutRequestIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey) {
    return NextResponse.json({
      error: "Clé de sécurité de la demande invalide. Rechargez la page avant de réessayer.",
      code: "PAYOUT_REQUEST_IDEMPOTENCY_KEY_INVALID",
    }, { status: 400 });
  }

  const requestIntent: TeacherPayoutRequestIntent = {
    teacherId: teacher.id,
    amount,
    method,
    paymentPhone,
    note,
  };
  const existingBeforeReservation = await db.teacherPayoutRequest.findUnique({
    where: { idempotencyKey },
  });
  const initialResolution = resolveTeacherPayoutRequestIdempotency(
    existingBeforeReservation,
    requestIntent,
  );
  if (initialResolution === "REPLAY") {
    return NextResponse.json({
      ok: true,
      request: existingBeforeReservation,
      idempotentReplay: true,
    });
  }
  if (initialResolution === "CONFLICT") {
    return idempotencyConflictResponse();
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const reference = generateReference("REQ-PROF");
  try {
    const result = await db.$transaction(async (tx) => {
      // Le calcul du disponible et la création de sa réservation PENDING
      // doivent partager le même snapshot. Deux POST concurrents ne peuvent
      // ainsi plus consommer deux fois le même solde professeur. Le mutex est
      // aussi partagé avec les DRAFT Jèko et les retenues administratives.
      await lockTeacherPayoutBalance(tx, teacher.id);
      const existingRequest = await tx.teacherPayoutRequest.findUnique({
        where: { idempotencyKey },
      });
      const lockedResolution = resolveTeacherPayoutRequestIdempotency(
        existingRequest,
        requestIntent,
      );
      if (lockedResolution === "REPLAY") {
        return {
          ok: true as const,
          request: existingRequest!,
          idempotentReplay: true as const,
        };
      }
      if (lockedResolution === "CONFLICT") {
        throw new Error(TEACHER_PAYOUT_REQUEST_IDEMPOTENCY_ERROR);
      }
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
      const pendingAmount = pendingRequests._sum.amount ?? 0;
      const { requestableAmount } = calculateTeacherPayoutAvailability({
        settlements: verifiedBookings.map((booking) => ({
          bookingId: booking.id,
          remaining: getTeacherFinancialSettlement(booking, adjustments).remaining,
        })),
        globalRetentionLedger,
        pendingRequestedAmount: pendingAmount,
        draftReservations: draftAllocations.map((allocation) => ({
          amount: allocation.amount,
          payoutRequestStatus: allocation.payout.payoutRequest?.status ?? null,
        })),
      });

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
          idempotencyKey,
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

      return { ok: true as const, request: created, idempotentReplay: false as const };
    }, { isolationLevel: "Serializable" });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      request: result.request,
      idempotentReplay: result.idempotentReplay,
    });
  } catch (error) {
    const code = errorCode(error);
    if (code === TEACHER_PAYOUT_REQUEST_IDEMPOTENCY_ERROR) {
      return idempotencyConflictResponse();
    }
    if (["P2002", "P2034"].includes(code)) {
      const existingAfterRace = await db.teacherPayoutRequest.findUnique({
        where: { idempotencyKey },
      });
      const racedResolution = resolveTeacherPayoutRequestIdempotency(
        existingAfterRace,
        requestIntent,
      );
      if (racedResolution === "REPLAY") {
        return NextResponse.json({
          ok: true,
          request: existingAfterRace,
          idempotentReplay: true,
        });
      }
      if (racedResolution === "CONFLICT") {
        return idempotencyConflictResponse();
      }
    }
    if (["P2034", "TEACHER_PAYOUT_LOCK_NOT_FOUND"].includes(code)) {
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

function idempotencyConflictResponse() {
  return NextResponse.json({
    error: "Cette clé de demande a déjà été utilisée avec un autre montant ou un autre compte de paiement.",
    code: TEACHER_PAYOUT_REQUEST_IDEMPOTENCY_ERROR,
  }, { status: 409 });
}
