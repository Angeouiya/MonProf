import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { confirmPayDunyaInvoice, normalizePayDunyaStatus, type PayDunyaInvoiceStatus } from "@/lib/paydunya";

type ReconcileReschedulePayDunyaInput = {
  rescheduleRequestId?: string | null;
  bookingId?: string | null;
  token?: string | null;
  expectedClientId?: string | null;
  source: "webhook" | "client_return" | "client_manual";
  incomingStatus?: string | null;
  incomingPayload?: unknown;
  incomingHashVerified?: boolean;
};

export type ReconcileReschedulePayDunyaResult = {
  bookingId?: string;
  rescheduleRequestId?: string;
  verified: boolean;
  status: PayDunyaInvoiceStatus | "rejected";
  action: "paid" | "pending" | "failed" | "rejected" | "already_paid" | "missing_token" | "not_configured" | "not_found";
  message: string;
  checkoutUrl?: string | null;
};

export async function reconcilePayDunyaReschedulePayment(
  input: ReconcileReschedulePayDunyaInput,
): Promise<ReconcileReschedulePayDunyaResult> {
  const inputToken = firstString(input.token);
  const requestWhere: Prisma.BookingRescheduleRequestWhereInput | null = input.rescheduleRequestId
    ? { id: input.rescheduleRequestId }
    : inputToken
      ? { paydunyaToken: inputToken }
      : null;

  if (!requestWhere) {
    return {
      verified: false,
      status: "rejected",
      action: "not_found",
      message: "Demande de modification PayDunya introuvable.",
    };
  }

  const request = await db.bookingRescheduleRequest.findFirst({
    where: requestWhere,
    include: {
      booking: {
        include: {
          client: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true } },
        },
      },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      client: { select: { id: true, name: true } },
      transaction: true,
    },
  });

  if (!request || (input.bookingId && request.bookingId !== input.bookingId)) {
    return {
      verified: false,
      status: "rejected",
      action: "not_found",
      message: "Demande de modification PayDunya introuvable.",
    };
  }

  if (input.expectedClientId && request.clientId !== input.expectedClientId) {
    await markSuspiciousReschedulePayment({
      request,
      source: input.source,
      reason: "Tentative de vérification PayDunya par un client différent de celui de la réservation.",
      incomingPayload: input.incomingPayload,
    });
    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Accès refusé pour cette demande de modification.",
    };
  }

  const alreadyPaid = Boolean(request.paidAt)
    && Boolean(request.paydunyaVerifiedAt)
    && (request.paydunyaStatus ?? "").trim().toUpperCase() === "COMPLETED";
  const token = firstString(inputToken, request.paydunyaToken);

  if (!token) {
    await db.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        paydunyaStatus: "MISSING_TOKEN",
        paydunyaFailureReason: "Token PayDunya manquant: impossible de vérifier le supplément.",
        paydunyaLastCheckedAt: new Date(),
        paydunyaLastPayload: compactPayload(input.incomingPayload),
      },
    });
    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: false,
      status: "rejected",
      action: "missing_token",
      message: "Token PayDunya manquant. Le supplément ne peut pas être validé.",
    };
  }

  if (request.paydunyaToken && request.paydunyaToken !== token) {
    await markSuspiciousReschedulePayment({
      request,
      source: input.source,
      reason: `Token PayDunya incohérent. Attendu: ${request.paydunyaToken}. Reçu: ${token}.`,
      incomingPayload: input.incomingPayload,
    });
    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Token PayDunya incohérent. Supplément rejeté.",
    };
  }

  const trustedWebhookHash = input.source === "webhook" && input.incomingHashVerified === true;
  let confirmation = await confirmPayDunyaInvoice(token);
  if (trustedWebhookHash && !confirmation.ok) {
    const trusted = buildTrustedWebhookConfirmation(input.incomingPayload, token);
    if (trusted) confirmation = trusted;
  }

  const now = new Date();
  const incomingPayloadRoot = asRecord(input.incomingPayload);
  const incomingInvoice = asRecord(incomingPayloadRoot?.invoice) ?? {};
  const incomingCustomData = asRecord(incomingPayloadRoot?.custom_data) ?? asRecord(incomingInvoice.custom_data) ?? {};
  const confirmedRequestId = firstString(
    confirmation.customData.reschedule_request_id,
    confirmation.customData.rescheduleRequestId,
    incomingCustomData.reschedule_request_id,
    incomingCustomData.rescheduleRequestId,
    incomingPayloadRoot?.reschedule_request_id,
  );
  const confirmedBookingId = firstString(
    confirmation.customData.booking_id,
    confirmation.customData.bookingId,
    incomingCustomData.booking_id,
    incomingCustomData.bookingId,
    incomingPayloadRoot?.booking_id,
  );
  const confirmedPurpose = firstString(
    confirmation.customData.payment_purpose,
    confirmation.customData.paymentPurpose,
    incomingCustomData.payment_purpose,
    incomingCustomData.paymentPurpose,
  );
  const confirmedToken = firstString(confirmation.token, token);
  const tokenMatches = confirmedToken === token;
  const foundByStoredToken = Boolean(inputToken && request.paydunyaToken === inputToken);
  const customMatches = foundByStoredToken
    || (
      (!confirmedRequestId || confirmedRequestId === request.id)
      && (!confirmedBookingId || confirmedBookingId === request.bookingId)
      && (!confirmedPurpose || confirmedPurpose === "RESCHEDULE_FEE")
    );
  const amountMatches = request.totalToPay > 0 && confirmation.totalAmount === request.totalToPay;
  const serverConfirmationTrusted = input.source !== "webhook" && confirmation.ok && !confirmation.hashProvided;
  const hasTrustedPayDunyaProof = confirmation.hashValid || trustedWebhookHash || serverConfirmationTrusted;
  const missingConfirmationHash = !confirmation.hashProvided && !trustedWebhookHash && !serverConfirmationTrusted;
  const invalidConfirmationHash = confirmation.hashProvided && !confirmation.hashValid && !trustedWebhookHash;
  const lastPayload = compactPayload({
    source: input.source,
    incomingStatus: input.incomingStatus,
    incomingHashVerified: input.incomingHashVerified === true,
    incomingPayload: input.incomingPayload,
    confirmation: confirmation.raw,
  });

  if (!confirmation.configured) {
    await db.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        paydunyaToken: request.paydunyaToken ?? token,
        paydunyaStatus: "NOT_CONFIGURED",
        paydunyaFailureReason: confirmation.responseText ?? "PayDunya n'est pas configuré.",
        paydunyaLastCheckedAt: now,
        paydunyaLastPayload: lastPayload,
      },
    });
    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: false,
      status: "unknown",
      action: "not_configured",
      message: "PayDunya n'est pas configuré. Le supplément reste non validé.",
      checkoutUrl: request.paydunyaCheckoutUrl,
    };
  }

  if (!confirmation.ok || !hasTrustedPayDunyaProof || missingConfirmationHash || invalidConfirmationHash || !tokenMatches) {
    await markSuspiciousReschedulePayment({
      request,
      source: input.source,
      reason: [
        !confirmation.ok ? `Confirmation PayDunya invalide: ${confirmation.responseText ?? "réponse non OK"}.` : "",
        missingConfirmationHash ? "Hash PayDunya absent sur la confirmation serveur." : "",
        invalidConfirmationHash ? "Hash PayDunya invalide sur la confirmation serveur." : "",
        !hasTrustedPayDunyaProof ? "Aucune preuve PayDunya vérifiée disponible." : "",
        !tokenMatches ? `Token confirmé différent. Reçu: ${token}. Confirmé: ${confirmedToken ?? "absent"}.` : "",
      ].filter(Boolean).join(" "),
      incomingPayload: { incoming: input.incomingPayload, confirmation: confirmation.raw },
    });
    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Confirmation PayDunya rejetée. Le supplément n'est pas validé.",
    };
  }

  if (confirmation.status === "completed") {
    if (!customMatches || !amountMatches) {
      await markSuspiciousReschedulePayment({
        request,
        source: input.source,
        reason: [
          !customMatches
            ? `Custom data PayDunya ne correspond pas. reschedule_request_id=${confirmedRequestId ?? "absent"}, booking_id=${confirmedBookingId ?? "absent"}, purpose=${confirmedPurpose ?? "absent"}.`
            : "",
          !amountMatches
            ? `Montant PayDunya incohérent. Attendu: ${request.totalToPay} FCFA. Confirmé: ${confirmation.totalAmount} FCFA.`
            : "",
        ].filter(Boolean).join(" "),
        incomingPayload: { incoming: input.incomingPayload, confirmation: confirmation.raw },
      });
      return {
        bookingId: request.bookingId,
        rescheduleRequestId: request.id,
        verified: false,
        status: "rejected",
        action: "rejected",
        message: "Supplément PayDunya rejeté: montant ou dossier incohérent.",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.bookingRescheduleRequest.update({
        where: { id: request.id },
        data: {
          status: alreadyPaid ? request.status : "AWAITING_TEACHER",
          paydunyaToken: request.paydunyaToken ?? token,
          paydunyaStatus: "COMPLETED",
          paydunyaReceiptUrl: confirmation.receiptUrl,
          paydunyaVerifiedAt: now,
          paydunyaLastCheckedAt: now,
          paydunyaFailureReason: null,
          paydunyaLastPayload: lastPayload,
          paidAt: request.paidAt ?? now,
        },
      });

      if (!request.transaction) {
        await tx.transaction.create({
          data: {
            reference: generateReference("TX-RESCHEDULE"),
            bookingId: request.bookingId,
            teacherId: request.teacherId,
            rescheduleRequestId: request.id,
            amount: confirmation.totalAmount,
            commission: request.feePlatformAmount,
            teacherNet: request.feeTeacherAmount,
            type: "RESCHEDULE_FEE",
            status: "BLOCKED",
            method: null,
            paidAt: now,
          },
        });
      } else {
        await tx.transaction.update({
          where: { id: request.transaction.id },
          data: {
            amount: confirmation.totalAmount,
            commission: request.feePlatformAmount,
            teacherNet: request.feeTeacherAmount,
            status: "BLOCKED",
            method: null,
            paidAt: now,
          },
        });
      }

      if (!alreadyPaid) {
        await createRescheduleAwaitingTeacherNotifications(tx, { request, now, token });
      }

      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Supplément modification PayDunya vérifié",
          entityType: "BookingRescheduleRequest",
          entityId: request.id,
          detail: `Source: ${input.source}. Montant confirmé: ${confirmation.totalAmount.toLocaleString("fr-FR")} FCFA. Frais: ${request.feeAmount.toLocaleString("fr-FR")} FCFA. Part professeur: ${request.feeTeacherAmount.toLocaleString("fr-FR")} FCFA. Référence PayDunya: ${maskPayDunyaReference(token)}.`,
          oldStatus: request.status,
          newStatus: alreadyPaid ? request.status : "AWAITING_TEACHER",
        },
      });
    });

    return {
      bookingId: request.bookingId,
      rescheduleRequestId: request.id,
      verified: true,
      status: "completed",
      action: alreadyPaid ? "already_paid" : "paid",
      message: "Supplément PayDunya confirmé. Le professeur doit maintenant valider le nouveau créneau.",
    };
  }

  const failed = confirmation.status === "cancelled" || confirmation.status === "failed";
  await db.bookingRescheduleRequest.update({
    where: { id: request.id },
    data: {
      status: failed ? "PAYMENT_FAILED" : request.status,
      paydunyaToken: request.paydunyaToken ?? token,
      paydunyaStatus: confirmation.status.toUpperCase(),
      paydunyaReceiptUrl: confirmation.receiptUrl,
      paydunyaLastCheckedAt: now,
      paydunyaFailureReason: confirmation.failReason ?? (failed ? "Paiement PayDunya non finalisé." : null),
      paydunyaLastPayload: lastPayload,
    },
  });

  return {
    bookingId: request.bookingId,
    rescheduleRequestId: request.id,
    verified: false,
    status: confirmation.status,
    action: failed ? "failed" : "pending",
    message: failed
      ? "Supplément PayDunya non finalisé. Le créneau ne change pas."
      : "Supplément PayDunya encore en attente. Aucun changement n'est appliqué.",
    checkoutUrl: request.paydunyaCheckoutUrl,
  };
}

export async function createRescheduleAwaitingTeacherNotifications(
  tx: Prisma.TransactionClient,
  {
    request,
    now = new Date(),
    token,
  }: {
    request: Awaited<ReturnType<typeof db.bookingRescheduleRequest.findFirst>> & {
      booking: {
        reference: string;
        subjectName: string;
        levelName: string;
        clientId: string;
        client: { name: string };
        teacher: { fullName: string; professionalName: string | null };
      };
      teacher: { fullName: string; professionalName: string | null };
      client: { name: string };
    };
    now?: Date;
    token?: string | null;
  },
) {
  if (!request) return;
  const teacherName = request.teacher.professionalName || request.teacher.fullName;
  const oldDate = request.oldScheduledDate ? formatDateFr(request.oldScheduledDate) : "Ancienne date non renseignée";
  const newDate = formatDateFr(request.proposedDate);
  const feeLine = request.feeAmount > 0
    ? `Supplément payé : ${request.feeAmount.toLocaleString("fr-FR")} FCFA. Part professeur prévue : ${request.feeTeacherAmount.toLocaleString("fr-FR")} FCFA.`
    : "Modification gratuite pour le client.";
  const message = [
    `Bonjour ${teacherName},`,
    "",
    `Le client ${request.booking.client.name} demande une modification de créneau pour ${request.booking.reference}.`,
    `Cours : ${request.booking.subjectName} - ${request.booking.levelName}`,
    `Ancien créneau : ${oldDate} · ${request.oldScheduledTime || "horaire non renseigné"}`,
    `Nouveau créneau demandé : ${newDate} · ${request.proposedTime}`,
    feeLine,
    request.reason ? `Motif client : ${request.reason}` : "",
    "",
    "Merci de confirmer ou refuser rapidement depuis votre espace professeur.",
  ].filter(Boolean).join("\n");

  await tx.teacherTask.create({
    data: {
      teacherId: request.teacherId,
      bookingId: request.bookingId,
      type: "CONFIRM_RESCHEDULE",
      title: `Confirmer nouveau créneau - ${request.booking.reference}`,
      description: message,
      priority: request.feeRate >= 50 ? "URGENT" : "IMPORTANT",
      status: "SENT_TO_TEACHER",
      dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    },
  });

  await tx.teacherNotification.create({
    data: {
      teacherId: request.teacherId,
      bookingId: request.bookingId,
      title: `Nouveau créneau à valider - ${request.booking.reference}`,
      message,
      channel: "WHATSAPP",
      sent: false,
      status: "PENDING",
    },
  });

  await tx.notification.createMany({
    data: [
      {
        userId: request.clientId,
        title: "Demande de modification transmise",
        message: `Votre demande de changement de créneau pour ${request.booking.reference} est transmise au professeur. ${feeLine}`,
        type: request.feeAmount > 0 ? "RESCHEDULE_FEE_PAID" : "RESCHEDULE_REQUESTED",
        recipientType: "CLIENT",
        recipientName: request.client.name,
        channel: "INTERNAL",
        status: "SENT",
        priority: "IMPORTANT",
        bookingId: request.bookingId,
        teacherId: request.teacherId,
        clientId: request.clientId,
        sentAt: now,
        link: `/client/reservations/${request.bookingId}`,
        actionLabel: "Voir réservation",
      },
      {
        userId: null,
        title: "Nouveau créneau à valider par professeur",
        message: `${request.client.name} demande ${newDate} · ${request.proposedTime} pour ${request.booking.reference}. ${feeLine}${token ? ` PayDunya: ${maskPayDunyaReference(token)}.` : ""}`,
        type: "RESCHEDULE_AWAITING_TEACHER",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: request.feeRate >= 50 ? "URGENT" : "IMPORTANT",
        bookingId: request.bookingId,
        teacherId: request.teacherId,
        clientId: request.clientId,
        sentAt: now,
        link: `/admin/reservations/${request.bookingId}`,
        actionLabel: "Suivre le créneau",
      },
    ],
  });
}

async function markSuspiciousReschedulePayment({
  request,
  source,
  reason,
  incomingPayload,
}: {
  request: {
    id: string;
    bookingId: string;
    clientId: string;
    teacherId: string;
    status: string;
  };
  source: ReconcileReschedulePayDunyaInput["source"];
  reason: string;
  incomingPayload?: unknown;
}) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: "PAYMENT_FAILED",
        paydunyaStatus: "REJECTED",
        paydunyaFailureReason: reason,
        paydunyaLastCheckedAt: now,
        paydunyaLastPayload: compactPayload(incomingPayload),
      },
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: "Supplément PayDunya suspect rejeté",
        message: `Contrôle anti-fraude PayDunya sur modification de créneau. Source: ${source}. Motif: ${reason}`,
        type: "RESCHEDULE_PAYMENT_VERIFICATION_FAILED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "CRITICAL",
        bookingId: request.bookingId,
        teacherId: request.teacherId,
        clientId: request.clientId,
        sentAt: now,
        link: `/admin/reservations/${request.bookingId}`,
        actionLabel: "Vérifier le supplément",
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: "Supplément modification PayDunya suspect rejeté",
        entityType: "BookingRescheduleRequest",
        entityId: request.id,
        detail: `Source: ${source}. ${reason}`,
        oldStatus: request.status,
        newStatus: "PAYMENT_FAILED",
      },
    });
  });
}

function buildTrustedWebhookConfirmation(payload: unknown, token: string) {
  const root = asRecord(payload) ?? {};
  const invoice = asRecord(root.invoice) ?? {};
  const customData = asRecord(root.custom_data) ?? asRecord(invoice.custom_data) ?? {};
  const status = normalizePayDunyaStatus(firstString(root.status, invoice.status));
  const totalAmount = parseAmount(invoice.total_amount ?? root.total_amount);
  if (status === "unknown" || totalAmount <= 0) return null;
  return {
    configured: true,
    ok: true,
    status,
    token: firstString(invoice.token, root.token, token),
    totalAmount,
    receiptUrl: firstString(root.receipt_url, root.receiptURL, root.receiptUrl),
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    customData,
    responseText: firstString(root.response_text, root.description) ?? undefined,
    failReason: firstString(root.fail_reason) ?? undefined,
    hashValid: true,
    hashProvided: true,
    raw: root,
  } satisfies Awaited<ReturnType<typeof confirmPayDunyaInvoice>>;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
}

function compactPayload(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, (_key, item) => {
      if (typeof item === "string" && item.length > 500) return `${item.slice(0, 500)}...`;
      return item;
    }).slice(0, 5000);
  } catch {
    return String(value).slice(0, 5000);
  }
}

function maskPayDunyaReference(value?: string | null) {
  if (!value) return "absente";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatDateFr(date?: Date | string | null) {
  if (!date) return "À confirmer";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "À confirmer";
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
