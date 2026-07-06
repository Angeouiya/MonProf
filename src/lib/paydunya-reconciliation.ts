import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { confirmPayDunyaInvoice, type PayDunyaInvoiceStatus } from "@/lib/paydunya";
import { hasVerifiedPayDunyaClientPayment, VERIFIED_CLIENT_FUND_STATUS_VALUES } from "@/lib/payment-security";

const SECURED_PAYMENT_STATUSES = new Set<string>(VERIFIED_CLIENT_FUND_STATUS_VALUES);

type ReconcilePayDunyaInput = {
  bookingId?: string | null;
  bookingReference?: string | null;
  token?: string | null;
  expectedClientId?: string | null;
  source: "webhook" | "client_return" | "client_manual" | "client_checkout";
  incomingStatus?: string | null;
  incomingPayload?: unknown;
};

export type ReconcilePayDunyaResult = {
  bookingId?: string;
  verified: boolean;
  status: PayDunyaInvoiceStatus | "rejected";
  action: "paid" | "pending" | "failed" | "rejected" | "already_paid" | "missing_token" | "not_configured" | "not_found";
  message: string;
  checkoutUrl?: string | null;
};

export async function reconcilePayDunyaBookingPayment(input: ReconcilePayDunyaInput): Promise<ReconcilePayDunyaResult> {
  const bookingWhere: Prisma.BookingWhereInput | null = input.bookingId
    ? { id: input.bookingId }
    : input.bookingReference
      ? { reference: input.bookingReference }
      : null;

  if (!bookingWhere) {
    return {
      verified: false,
      status: "rejected",
      action: "not_found",
      message: "Réservation PayDunya introuvable.",
    };
  }

  const booking = await db.booking.findFirst({
    where: bookingWhere,
    include: {
      client: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) {
    return {
      verified: false,
      status: "rejected",
      action: "not_found",
      message: "Réservation PayDunya introuvable.",
    };
  }

  if (input.expectedClientId && booking.clientId !== input.expectedClientId) {
    await markSuspiciousPayment({
      booking,
      source: input.source,
      reason: "Tentative de vérification PayDunya par un client différent de celui de la réservation.",
      incomingPayload: input.incomingPayload,
      keepCurrentPaymentStatus: true,
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Accès refusé pour cette réservation.",
    };
  }

  const alreadyPaid = hasVerifiedPayDunyaClientPayment(booking);
  const token = firstString(input.token, booking.paydunyaToken);
  if (!token) {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        paydunyaStatus: "MISSING_TOKEN",
        paydunyaFailureReason: "Token PayDunya manquant: impossible de vérifier le paiement.",
        paydunyaLastCheckedAt: new Date(),
        paydunyaLastPayload: compactPayload(input.incomingPayload),
      },
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "rejected",
      action: "missing_token",
      message: "Token PayDunya manquant. Le paiement ne peut pas être validé.",
    };
  }

  if (booking.paydunyaToken && booking.paydunyaToken !== token) {
    await markSuspiciousPayment({
      booking,
      source: input.source,
      reason: `Token PayDunya incohérent. Attendu: ${booking.paydunyaToken}. Reçu: ${token}.`,
      incomingPayload: input.incomingPayload,
      keepCurrentPaymentStatus: alreadyPaid,
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Token PayDunya incohérent. Paiement rejeté.",
    };
  }

  const confirmation = await confirmPayDunyaInvoice(token);
  const now = new Date();
  const expectedAmount = booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice;
  const confirmedBookingId = firstString(
    confirmation.customData.booking_id,
    confirmation.customData.bookingId,
    confirmation.customData.booking,
  );
  const confirmedBookingReference = firstString(
    confirmation.customData.booking_reference,
    confirmation.customData.bookingReference,
  );
  const confirmedToken = firstString(confirmation.token, token);
  const tokenMatches = confirmedToken === token;
  const customMatches = (
    (confirmedBookingId && confirmedBookingId === booking.id)
    || (confirmedBookingReference && confirmedBookingReference === booking.reference)
  );
  const amountMatches = expectedAmount > 0 && confirmation.totalAmount === expectedAmount;
  const missingConfirmationHash = !confirmation.hashProvided;
  const invalidConfirmationHash = !confirmation.hashValid;
  const lastPayload = compactPayload({
    source: input.source,
    incomingStatus: input.incomingStatus,
    incomingPayload: input.incomingPayload,
    confirmation: confirmation.raw,
  });

  if (!confirmation.configured) {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        paydunyaToken: booking.paydunyaToken ?? token,
        paydunyaStatus: "NOT_CONFIGURED",
        paydunyaFailureReason: confirmation.responseText ?? "PayDunya n'est pas configuré.",
        paydunyaLastCheckedAt: now,
        paydunyaLastPayload: lastPayload,
      },
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "unknown",
      action: "not_configured",
      message: "PayDunya n'est pas configuré. Le paiement reste non validé.",
      checkoutUrl: booking.paydunyaCheckoutUrl,
    };
  }

  if (!confirmation.ok || missingConfirmationHash || invalidConfirmationHash || !tokenMatches) {
    await markSuspiciousPayment({
      booking,
      source: input.source,
      reason: [
        !confirmation.ok ? `Confirmation PayDunya invalide: ${confirmation.responseText ?? "réponse non OK"}.` : "",
        missingConfirmationHash ? "Hash PayDunya absent sur la confirmation serveur." : "",
        invalidConfirmationHash ? "Hash PayDunya invalide sur la confirmation serveur." : "",
        !tokenMatches ? `Token confirmé différent. Reçu: ${token}. Confirmé: ${confirmedToken ?? "absent"}.` : "",
      ].filter(Boolean).join(" "),
      incomingPayload: { incoming: input.incomingPayload, confirmation: confirmation.raw },
      keepCurrentPaymentStatus: alreadyPaid,
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Confirmation PayDunya rejetée. Le paiement n'est pas validé.",
    };
  }

  if (confirmation.status === "completed") {
    if (!customMatches || !amountMatches) {
      await markSuspiciousPayment({
        booking,
        source: input.source,
        reason: [
          !customMatches
            ? `Custom data PayDunya ne correspond pas. booking_id=${confirmedBookingId ?? "absent"}, reference=${confirmedBookingReference ?? "absente"}.`
            : "",
          !amountMatches
            ? `Montant PayDunya incohérent. Attendu: ${expectedAmount > 0 ? expectedAmount : "montant positif"} FCFA. Confirmé: ${confirmation.totalAmount} FCFA.`
            : "",
        ].filter(Boolean).join(" "),
        incomingPayload: { incoming: input.incomingPayload, confirmation: confirmation.raw },
        keepCurrentPaymentStatus: alreadyPaid,
      });
      return {
        bookingId: booking.id,
        verified: false,
        status: "rejected",
        action: "rejected",
        message: "Paiement PayDunya rejeté: montant ou réservation incohérent.",
      };
    }

    const nextPaymentStatus = alreadyPaid ? booking.paymentStatus : "BLOCKED";
    const nextTransactionStatus = alreadyPaid && booking.transactions[0]?.status
      ? booking.transactions[0].status
      : nextPaymentStatus;

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: booking.status === "PENDING_PAYMENT" ? "PAID" : booking.status,
          paymentStatus: nextPaymentStatus,
          paymentMethod: null,
          paydunyaToken: booking.paydunyaToken ?? token,
          paydunyaStatus: "COMPLETED",
          paydunyaReceiptUrl: confirmation.receiptUrl,
          paydunyaVerifiedAt: now,
          paydunyaLastCheckedAt: now,
          paydunyaFailureReason: null,
          paydunyaLastPayload: lastPayload,
        },
      });

      if (booking.transactions.length === 0) {
        await tx.transaction.create({
          data: {
            reference: generateReference("TX-PAYDUNYA"),
            bookingId: booking.id,
            teacherId: booking.teacherId,
            amount: confirmation.totalAmount,
            commission: booking.commissionAmount,
            teacherNet: booking.teacherNetAmount,
            type: "CLIENT_PAYMENT",
            status: nextTransactionStatus,
            method: null,
            paidAt: now,
          },
        });
      } else {
        await tx.transaction.update({
          where: { id: booking.transactions[0].id },
          data: {
            amount: confirmation.totalAmount,
            commission: booking.commissionAmount,
            teacherNet: booking.teacherNetAmount,
            status: nextTransactionStatus,
            method: null,
            paidAt: now,
          },
        });
      }

      if (!alreadyPaid) {
        const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
        const dateLabel = formatDateFr(booking.scheduledDate ?? booking.startDate);
        const timeLabel = booking.scheduledTime || booking.preferredTime || "À confirmer";
        const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
        const locationLabel = booking.courseFormat === "ONLINE"
          ? (booking.onlineLink || "Lien en ligne à confirmer")
          : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
        const existingAvailabilityTask = await tx.teacherTask.findFirst({
          where: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            type: "CONFIRM_AVAILABILITY",
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        });
        const existingMissionNotification = await tx.teacherNotification.findFirst({
          where: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: { contains: booking.reference },
          },
        });

        await tx.notification.createMany({
          data: [
            {
              userId: booking.clientId,
              title: "Paiement PayDunya confirmé",
              message: `Votre paiement PayDunya pour la réservation ${booking.reference} est confirmé après vérification serveur. Les fonds sont sécurisés jusqu'à la validation du cours.`,
              type: "PAYMENT_RECEIVED",
              recipientType: "CLIENT",
              recipientName: booking.client.name,
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: booking.teacherId,
              clientId: booking.clientId,
              sentAt: now,
              link: `/client/reservations/${booking.id}`,
              actionLabel: "Voir réservation",
            },
            {
              userId: null,
              title: "Paiement PayDunya vérifié",
              message: `${booking.client.name} a payé ${booking.reference}. Vérification serveur PayDunya OK. Professeur : ${teacherName}. Token : ${token}. Reçu : ${confirmation.receiptUrl || "non fourni"}.`,
              type: "PAYMENT_RECEIVED",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: booking.teacherId,
              clientId: booking.clientId,
              sentAt: now,
              link: `/admin/professeurs/${booking.teacherId}?tab=cours&bookingId=${booking.id}`,
              actionLabel: "Ouvrir le dossier",
            },
          ],
        });

        if (!existingAvailabilityTask) {
          await tx.teacherTask.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              type: "CONFIRM_AVAILABILITY",
              title: `Confirmer disponibilité - ${booking.reference}`,
              description: [
                `Paiement PayDunya vérifié serveur pour ${booking.reference}.`,
                `Confirmer la mission ${booking.subjectName} (${booking.levelName}) avec ${booking.client.name}.`,
                `Date : ${dateLabel}. Créneau : ${timeLabel}. Format : ${formatLabel}.`,
                `Lieu : ${locationLabel}.`,
              ].join(" "),
              priority: "IMPORTANT",
              status: "TODO",
              dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            },
          });
        }

        if (!existingMissionNotification) {
          await tx.teacherNotification.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              title: `Mission à confirmer - ${booking.reference}`,
              message: [
                `Bonjour ${teacherName},`,
                "",
                "Un cours Compétence vous est proposé après paiement client vérifié par PayDunya.",
                "",
                `Réservation : ${booking.reference}`,
                `Client : ${booking.client.name}`,
                `Cours : ${booking.subjectName}`,
                `Niveau : ${booking.levelName}`,
                `Date : ${dateLabel}`,
                `Heure : ${timeLabel}`,
                `Format : ${formatLabel}`,
                `Lieu : ${locationLabel}`,
                `Nombre de séance(s) : ${booking.sessionsCount}`,
                `Montant net prévu : ${booking.teacherNetAmount.toLocaleString("fr-FR")} FCFA`,
                "",
                "Merci de confirmer rapidement votre disponibilité ou de signaler un problème au service client.",
              ].join("\n"),
              channel: "WHATSAPP",
              sent: false,
              status: "PENDING",
            },
          });
        }
      }

      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Paiement PayDunya vérifié serveur",
          entityType: "Booking",
          entityId: booking.id,
          detail: `Source: ${input.source}. Statut PayDunya: completed. Montant confirmé: ${confirmation.totalAmount.toLocaleString("fr-FR")} FCFA. Token: ${token}. Hash confirmation: OK.`,
          oldStatus: booking.paymentStatus,
          newStatus: nextPaymentStatus,
        },
      });
    });

    return {
      bookingId: booking.id,
      verified: true,
      status: "completed",
      action: alreadyPaid ? "already_paid" : "paid",
      message: "Paiement PayDunya confirmé et sécurisé.",
    };
  }

  if (alreadyPaid) {
    await markSuspiciousPayment({
      booking,
      source: input.source,
      reason: `Réservation déjà marquée payée mais PayDunya confirme maintenant le statut ${confirmation.status}. Aucun déclassement automatique appliqué.`,
      incomingPayload: { incoming: input.incomingPayload, confirmation: confirmation.raw },
      keepCurrentPaymentStatus: true,
    });
    return {
      bookingId: booking.id,
      verified: false,
      status: "rejected",
      action: "rejected",
      message: "Statut PayDunya contradictoire sur une réservation déjà payée. Contrôle service client requis.",
    };
  }

  const failed = confirmation.status === "cancelled" || confirmation.status === "failed";
  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: failed && booking.status === "PAID" ? "PENDING_PAYMENT" : booking.status,
        paymentStatus: failed ? "FAILED" : booking.paymentStatus,
        paymentMethod: null,
        paydunyaToken: booking.paydunyaToken ?? token,
        paydunyaStatus: confirmation.status.toUpperCase(),
        paydunyaReceiptUrl: confirmation.receiptUrl,
        paydunyaLastCheckedAt: now,
        paydunyaFailureReason: confirmation.failReason ?? (failed ? "Paiement PayDunya non finalisé." : null),
        paydunyaLastPayload: lastPayload,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: failed ? "Paiement PayDunya non finalisé" : "Paiement PayDunya en attente",
        entityType: "Booking",
        entityId: booking.id,
        detail: `Source: ${input.source}. Statut PayDunya confirmé: ${confirmation.status}. Token: ${token}. ${confirmation.failReason ? `Motif: ${confirmation.failReason}.` : ""}`,
        oldStatus: booking.paymentStatus,
        newStatus: failed ? "FAILED" : booking.paymentStatus,
      },
    });
  });

  return {
    bookingId: booking.id,
    verified: false,
    status: confirmation.status,
    action: failed ? "failed" : "pending",
    message: failed
      ? "Paiement PayDunya non finalisé. La réservation reste non payée."
      : "Paiement PayDunya encore en attente. Aucune validation n'est appliquée.",
    checkoutUrl: booking.paydunyaCheckoutUrl,
  };
}

async function markSuspiciousPayment({
  booking,
  source,
  reason,
  incomingPayload,
  keepCurrentPaymentStatus = false,
}: {
  booking: {
    id: string;
    reference: string;
    clientId: string;
    teacherId: string;
    paymentStatus: string;
    paydunyaToken?: string | null;
  };
  source: ReconcilePayDunyaInput["source"];
  reason: string;
  incomingPayload?: unknown;
  keepCurrentPaymentStatus?: boolean;
}) {
  const now = new Date();
  const bookingData: Prisma.BookingUpdateInput = {
    paydunyaStatus: "REJECTED",
    paydunyaFailureReason: reason,
    paydunyaLastCheckedAt: now,
    paydunyaLastPayload: compactPayload(incomingPayload),
  };
  if (!keepCurrentPaymentStatus) {
    bookingData.paymentStatus = "FAILED";
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: bookingData,
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: "Paiement PayDunya suspect rejeté",
        message: `Contrôle anti-fraude PayDunya sur ${booking.reference}. Source: ${source}. Motif: ${reason}`,
        type: "PAYMENT_VERIFICATION_FAILED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "CRITICAL",
        bookingId: booking.id,
        teacherId: booking.teacherId,
        clientId: booking.clientId,
        sentAt: now,
        link: `/admin/reservations/${booking.id}`,
        actionLabel: "Vérifier le paiement",
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: "Paiement PayDunya suspect rejeté",
        entityType: "Booking",
        entityId: booking.id,
        detail: `Source: ${source}. ${reason}`,
        oldStatus: booking.paymentStatus,
        newStatus: keepCurrentPaymentStatus ? booking.paymentStatus : "FAILED",
      },
    });
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function compactPayload(value: unknown) {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value).slice(0, 8000);
  } catch {
    return String(value).slice(0, 8000);
  }
}

function formatDateFr(date?: Date | string | null) {
  if (!date) return "À confirmer";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "À confirmer";
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
