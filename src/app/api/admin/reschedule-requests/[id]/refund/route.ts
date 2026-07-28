import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import {
  buildRescheduleRefundLedgerReference,
  normalizeRescheduleRefundExternalReference,
  validateRescheduleRefundSnapshot,
} from "@/lib/reschedule-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class RescheduleRefundWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "RescheduleRefundWorkflowError";
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const externalReference = normalizeRescheduleRefundExternalReference(body.externalReference);
  if (!externalReference) {
    return NextResponse.json({
      error: "Saisissez une référence de dépôt valide (3 à 160 caractères).",
      code: "INVALID_EXTERNAL_REFERENCE",
    }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const request = await tx.bookingRescheduleRequest.findUnique({
        where: { id },
        include: {
          transaction: true,
          refundTransaction: true,
          booking: { select: { id: true, reference: true } },
          client: { select: { id: true, name: true, phone: true } },
        },
      });
      if (!request) {
        throw new RescheduleRefundWorkflowError(
          "Demande de report introuvable.",
          404,
          "RESCHEDULE_REQUEST_NOT_FOUND",
        );
      }

      const ledgerReference = buildRescheduleRefundLedgerReference(request.id);
      if (request.status === "REFUNDED") {
        assertCompletedRefundLedger(request, ledgerReference);
        if (request.refundExternalReference !== externalReference) {
          throw new RescheduleRefundWorkflowError(
            `Ce supplément est déjà remboursé avec la référence ${request.refundExternalReference}.`,
            409,
            "REFUND_REFERENCE_MISMATCH",
          );
        }
        return completedResult(request, true);
      }

      if (request.refundTransactionId || request.refundTransaction) {
        throw new RescheduleRefundWorkflowError(
          "Un remboursement est déjà lié à cette demande sans clôture cohérente.",
          409,
          "REFUND_LEDGER_INCONSISTENT",
        );
      }

      const validationError = validateRescheduleRefundSnapshot(request);
      if (validationError) {
        throw new RescheduleRefundWorkflowError(validationError, 409, "REFUND_NOT_ALLOWED");
      }
      const sourceTransaction = request.transaction!;
      const refundAmount = sourceTransaction.amount;
      const duplicateReceipt = await tx.bookingRescheduleRequest.findFirst({
        where: {
          id: { not: request.id },
          status: "REFUNDED",
          refundExternalReference: externalReference,
        },
        select: { id: true },
      });
      if (duplicateReceipt) {
        throw new RescheduleRefundWorkflowError(
          "Cette référence de dépôt est déjà utilisée pour un autre remboursement.",
          409,
          "REFUND_REFERENCE_ALREADY_USED",
        );
      }

      const now = new Date();
      const claimed = await tx.bookingRescheduleRequest.updateMany({
        where: {
          id: request.id,
          status: "REFUND_REQUIRED",
          refundTransactionId: null,
        },
        data: {
          status: "REFUNDED",
          refundedAmount: refundAmount,
          refundExternalReference: externalReference,
          refundedAt: now,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.bookingRescheduleRequest.findUnique({
          where: { id: request.id },
          include: { transaction: true, refundTransaction: true },
        });
        if (current?.status === "REFUNDED") {
          assertCompletedRefundLedger(current, ledgerReference);
          if (current.refundExternalReference !== externalReference) {
            throw new RescheduleRefundWorkflowError(
              `Ce supplément est déjà remboursé avec la référence ${current.refundExternalReference}.`,
              409,
              "REFUND_REFERENCE_MISMATCH",
            );
          }
          return completedResult(current, true);
        }
        throw new RescheduleRefundWorkflowError(
          "Cette demande vient d'être traitée depuis une autre fenêtre.",
          409,
          "REFUND_CONCURRENT_UPDATE",
        );
      }

      const sourceClaim = await tx.transaction.updateMany({
        where: {
          id: sourceTransaction.id,
          type: "RESCHEDULE_FEE",
          status: "REFUND_PENDING",
          amount: refundAmount,
        },
        data: { status: "REFUNDED" },
      });
      if (sourceClaim.count !== 1) {
        throw new RescheduleRefundWorkflowError(
          "Le ledger du supplément a changé pendant le remboursement.",
          409,
          "REFUND_SOURCE_CHANGED",
        );
      }

      const refundTransaction = await tx.transaction.create({
        data: {
          reference: ledgerReference,
          bookingId: request.bookingId,
          teacherId: request.teacherId,
          amount: refundAmount,
          commission: 0,
          teacherNet: 0,
          type: "REFUND",
          status: "REFUNDED",
          method: sourceTransaction.method,
          paidAt: now,
        },
      });
      await tx.bookingRescheduleRequest.update({
        where: { id: request.id },
        data: { refundTransactionId: refundTransaction.id },
      });

      await tx.notification.create({
        data: {
          userId: request.clientId,
          title: "Supplément de report remboursé",
          message: `Votre supplément de ${refundAmount.toLocaleString("fr-FR")} FCFA pour ${request.booking.reference} a été remboursé. Référence du dépôt : ${externalReference}.`,
          type: "RESCHEDULE_REFUNDED",
          recipientType: "CLIENT",
          recipientName: request.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: request.bookingId,
          teacherId: request.teacherId,
          clientId: request.clientId,
          adminId: admin.id,
          sentAt: now,
          link: `/client/reservations/${request.bookingId}`,
          actionLabel: "Voir la réservation",
        },
      });
      await tx.clientCommunication.create({
        data: {
          clientId: request.clientId,
          bookingId: request.bookingId,
          type: "PAYMENT",
          channel: "INTERNAL",
          subject: `Supplément de report remboursé - ${request.booking.reference}`,
          content: `Montant remboursé : ${refundAmount.toLocaleString("fr-FR")} FCFA\nRéférence du dépôt : ${externalReference}`,
          priority: "IMPORTANT",
          status: "SENT",
          sentById: admin.id,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Remboursement supplément de report effectué",
          entityType: "BookingRescheduleRequest",
          entityId: request.id,
          detail: `Supplément ${request.id} de ${request.booking.reference} remboursé pour ${refundAmount} FCFA. Référence dépôt : ${externalReference}. Transaction de remboursement : ${ledgerReference}.`,
          oldStatus: "REFUND_REQUIRED",
          newStatus: "REFUNDED",
        },
      });

      return {
        ok: true,
        alreadyRefunded: false,
        rescheduleRequestId: request.id,
        amount: refundAmount,
        externalReference,
        refundTransactionReference: ledgerReference,
        refundedAt: now,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RescheduleRefundWorkflowError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({
        error: "Cette référence ou ce remboursement est déjà enregistré.",
        code: "REFUND_ALREADY_RECORDED",
      }, { status: 409 });
    }
    console.error("[admin:reschedule_refund_failed]", {
      rescheduleRequestId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({
      error: "Le remboursement du supplément n'a pas pu être enregistré.",
      code: "RESCHEDULE_REFUND_FAILED",
    }, { status: 500 });
  }
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2002",
  );
}

function assertCompletedRefundLedger(
  request: {
    status: string;
    refundedAmount: number;
    refundExternalReference: string | null;
    refundedAt: Date | null;
    transaction: { status: string; amount: number } | null;
    refundTransaction: { reference: string; type: string; status: string; amount: number } | null;
  },
  expectedLedgerReference: string,
) {
  const consistent = request.status === "REFUNDED"
    && request.refundedAmount > 0
    && Boolean(request.refundExternalReference)
    && Boolean(request.refundedAt)
    && request.transaction?.status === "REFUNDED"
    && request.transaction.amount === request.refundedAmount
    && request.refundTransaction?.reference === expectedLedgerReference
    && request.refundTransaction.type === "REFUND"
    && request.refundTransaction.status === "REFUNDED"
    && request.refundTransaction.amount === request.refundedAmount;
  if (!consistent) {
    throw new RescheduleRefundWorkflowError(
      "Ce remboursement possède un ledger incomplet ou incohérent.",
      409,
      "REFUND_LEDGER_INCONSISTENT",
    );
  }
}

function completedResult(
  request: {
    id: string;
    refundedAmount: number;
    refundExternalReference: string | null;
    refundedAt: Date | null;
    refundTransaction: { reference: string } | null;
  },
  alreadyRefunded: boolean,
) {
  return {
    ok: true,
    alreadyRefunded,
    rescheduleRequestId: request.id,
    amount: request.refundedAmount,
    externalReference: request.refundExternalReference,
    refundTransactionReference: request.refundTransaction?.reference ?? null,
    refundedAt: request.refundedAt,
  };
}
