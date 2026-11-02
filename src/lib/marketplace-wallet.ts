import { randomUUID } from "node:crypto";
import { type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { createJekoPaymentRequest, confirmJekoPaymentRequest, recoverJekoPaymentRequestByReference, type JekoPaymentConfirmation } from "@/lib/jeko";
import { platformMethodToJeko } from "@/lib/jeko-client-payment";
import type { JekoServerConfig } from "@/lib/jeko-config";
import { isJekoIncomingPaymentType, normalizeJekoPaymentMethod, normalizeJekoPaymentStatus, type ParsedJekoWebhook, xofToJekoAmountCents } from "@/lib/jeko-utils";
import { getPublicAppOrigin } from "@/lib/public-url";
import { MarketplaceError } from "@/lib/marketplace-missions";

function confirmationMatchesTopUp(
  topUp: { reference: string; amount: number; paymentMethod: PaymentMethod; jekoRequestId: string | null; jekoStoreId: string | null },
  confirmation: JekoPaymentConfirmation,
  config: JekoServerConfig,
) {
  return Boolean(
    (!topUp.jekoRequestId || topUp.jekoRequestId === confirmation.id)
    && confirmation.reference === topUp.reference
    && confirmation.storeId === config.storeId
    && (!topUp.jekoStoreId || topUp.jekoStoreId === config.storeId)
    && confirmation.paymentMethod === platformMethodToJeko(topUp.paymentMethod)
    && confirmation.transaction
    && confirmation.transaction.amountCents === xofToJekoAmountCents(topUp.amount)
    && confirmation.transaction.currency === "XOF",
  );
}

async function creditConfirmedTopUp(topUpId: string, confirmation: JekoPaymentConfirmation, config: JekoServerConfig) {
  if (!confirmation.transaction || confirmation.status !== "success" || confirmation.transaction.status !== "success") {
    throw new Error("La recharge Jèko n'est pas confirmée.");
  }
  const transaction = confirmation.transaction;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "TeacherWalletTopUp" WHERE "id" = ${topUpId} FOR UPDATE`;
    const current = await tx.teacherWalletTopUp.findUnique({ where: { id: topUpId } });
    if (!current) throw new Error("Recharge introuvable.");
    if (current.status === "VERIFIED") return "duplicate" as const;
    if (current.status !== "PENDING" && current.status !== "FAILED") throw new Error("Statut de recharge incohérent.");
    if (!confirmationMatchesTopUp(current, confirmation, config)) throw new Error("Confirmation Jèko incohérente.");
    await tx.teacherWalletTopUp.update({
      where: { id: current.id },
      data: {
        status: "VERIFIED", jekoRequestId: confirmation.id, jekoStoreId: config.storeId,
        jekoTransactionId: transaction.id, verifiedAt: new Date(),
      },
    });
    await tx.teacherWallet.upsert({
      where: { teacherId: current.teacherId },
      create: { teacherId: current.teacherId, balance: current.amount, available: current.amount },
      update: { balance: { increment: current.amount }, available: { increment: current.amount } },
    });
    await tx.teacherWalletEntry.create({
      data: {
        teacherId: current.teacherId, topUpId: current.id, kind: "TOPUP",
        balanceDelta: current.amount, idempotencyKey: `jeko-wallet-topup:${current.id}`,
      },
    });
    return "credited" as const;
  });
}

export async function createTeacherWalletTopUp(input: {
  teacherId: string;
  amount: number;
  method: PaymentMethod;
  clientKey: string;
}) {
  if (!Number.isInteger(input.amount) || input.amount < 5_000 || input.amount > 500_000) {
    throw new MarketplaceError("Choisissez un montant de 5 000 à 500 000 FCFA.");
  }
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.clientKey)) {
    throw new MarketplaceError("Identifiant de paiement invalide.");
  }
  const jekoMethod = platformMethodToJeko(input.method);
  if (!jekoMethod) throw new MarketplaceError("Moyen Jèko non disponible.");
  let topUp = await db.teacherWalletTopUp.findUnique({ where: { clientKey: input.clientKey } });
  if (topUp) {
    if (topUp.teacherId !== input.teacherId || topUp.amount !== input.amount || topUp.paymentMethod !== input.method) {
      throw new MarketplaceError("Cette tentative de paiement appartient à une autre opération.", 409);
    }
    if (!topUp.checkoutUrl && topUp.status === "PENDING") {
      const recovered = await recoverJekoPaymentRequestByReference({
        reference: topUp.reference, amountXof: topUp.amount,
        paymentMethod: jekoMethod, referenceCreatedAt: topUp.createdAt,
      });
      if (recovered) {
        topUp = await db.teacherWalletTopUp.update({ where: { id: topUp.id }, data: {
          jekoRequestId: recovered.confirmation.id, jekoStoreId: recovered.confirmation.storeId,
          checkoutUrl: recovered.redirectUrl,
        } });
      }
    }
    return { topUp, checkoutUrl: topUp.checkoutUrl };
  }
  topUp = await db.teacherWalletTopUp.create({
    data: {
      reference: `TW-${randomUUID().slice(0, 12).toUpperCase()}`,
      clientKey: input.clientKey,
      teacherId: input.teacherId,
      amount: input.amount,
      paymentMethod: input.method,
    },
  });
  const origin = getPublicAppOrigin();
  try {
    const created = await createJekoPaymentRequest({
      reference: topUp.reference,
      amountXof: topUp.amount,
      paymentMethod: jekoMethod,
      successUrl: `${origin}/professeur/portefeuille?topup=${topUp.id}`,
      errorUrl: `${origin}/professeur/portefeuille?topup=${topUp.id}&error=1`,
    });
    const updated = await db.teacherWalletTopUp.update({
      where: { id: topUp.id },
      data: {
        jekoRequestId: created.id,
        jekoStoreId: created.storeId,
        checkoutUrl: created.redirectUrl,
      },
    });
    return { topUp: updated, checkoutUrl: updated.checkoutUrl };
  } catch (error) {
    // Une réponse HTTP ambiguë ne prouve pas que Jèko n'a rien créé.
    // Ne jamais renvoyer un second POST pour la même référence : rechercher
    // d'abord la demande créée chez Jèko et la valider par GET serveur.
    console.error("[marketplace:topup_create]", topUp.id, error);
    try {
      const recovered = await recoverJekoPaymentRequestByReference({
        reference: topUp.reference, amountXof: topUp.amount,
        paymentMethod: jekoMethod, referenceCreatedAt: topUp.createdAt,
      });
      if (recovered) {
        const updated = await db.teacherWalletTopUp.update({ where: { id: topUp.id }, data: {
          jekoRequestId: recovered.confirmation.id, jekoStoreId: recovered.confirmation.storeId,
          checkoutUrl: recovered.redirectUrl,
        } });
        return { topUp: updated, checkoutUrl: updated.checkoutUrl };
      }
    } catch (recoveryError) {
      console.error("[marketplace:topup_recovery]", topUp.id, recoveryError);
    }
    throw new MarketplaceError("Jèko n’a pas confirmé l’ouverture du paiement. Cette tentative reste en attente ; ne la réglez pas deux fois.", 503);
  }
}

export async function reconcileTeacherWalletTopUp(webhook: ParsedJekoWebhook, config: JekoServerConfig) {
  const incoming = webhook.transaction;
  const reference = incoming.transactionDetails?.reference?.trim() ?? "";
  const providerOrderId = incoming.transactionDetails?.id?.trim() ?? "";
  if (!reference.startsWith("TW-") || !providerOrderId || !isJekoIncomingPaymentType(incoming.transactionType)) {
    return { action: "rejected" as const, verified: false };
  }
  const topUp = await db.teacherWalletTopUp.findUnique({ where: { reference } });
  if (!topUp) return { action: "not_found" as const, verified: false };
  if (topUp.status === "VERIFIED") return { action: "duplicate" as const, verified: true, topUpId: topUp.id };
  if (topUp.jekoRequestId && topUp.jekoRequestId !== providerOrderId) {
    return { action: "rejected" as const, verified: false };
  }
  const confirmation = await confirmJekoPaymentRequest(providerOrderId, { config });
  const transaction = confirmation.transaction;
  const expectedMethod = platformMethodToJeko(topUp.paymentMethod);
  const amountCents = xofToJekoAmountCents(topUp.amount);
  const consistent = confirmation.id === providerOrderId
    && confirmation.reference === topUp.reference
    && confirmation.storeId === config.storeId
    && (!topUp.jekoStoreId || topUp.jekoStoreId === config.storeId)
    && confirmation.paymentMethod === expectedMethod
    && normalizeJekoPaymentMethod(incoming.paymentMethod) === expectedMethod
    && incoming.amount.currency === "XOF"
    && incoming.amount.amount === amountCents
    && transaction?.id === incoming.id
    && transaction.amountCents === amountCents
    && transaction.currency === "XOF";
  if (!consistent) return { action: "rejected" as const, verified: false, topUpId: topUp.id };
  if (normalizeJekoPaymentStatus(incoming.status) === "pending" || confirmation.status === "pending" || transaction.status === "pending") {
    return { action: "pending" as const, verified: false, topUpId: topUp.id };
  }
  if (normalizeJekoPaymentStatus(incoming.status) !== "success" || confirmation.status !== "success" || transaction.status !== "success") {
    await db.teacherWalletTopUp.updateMany({
      where: { id: topUp.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { action: "failed" as const, verified: false, topUpId: topUp.id };
  }
  const result = await creditConfirmedTopUp(topUp.id, confirmation, config);
  return { action: result, verified: true, topUpId: topUp.id };
}

/** Rattrapage serveur-à-serveur d'une recharge si son webhook est perdu. */
export async function verifyTeacherWalletTopUpByProvider(topUpId: string, config: JekoServerConfig) {
  const topUp = await db.teacherWalletTopUp.findUnique({ where: { id: topUpId } });
  if (!topUp || !topUp.jekoRequestId) return { action: "not_found" as const, verified: false };
  if (topUp.status === "VERIFIED") return { action: "duplicate" as const, verified: true };
  if (topUp.status === "CANCELLED") return { action: "cancelled" as const, verified: false };
  const confirmation = await confirmJekoPaymentRequest(topUp.jekoRequestId, { config });
  if (!confirmationMatchesTopUp(topUp, confirmation, config)) return { action: "rejected" as const, verified: false };
  if (confirmation.status === "pending" || confirmation.transaction?.status === "pending") {
    return { action: "pending" as const, verified: false };
  }
  if (confirmation.status !== "success" || confirmation.transaction?.status !== "success") {
    await db.teacherWalletTopUp.updateMany({ where: { id: topUp.id, status: "PENDING" }, data: { status: "FAILED" } });
    return { action: "failed" as const, verified: false };
  }
  const action = await creditConfirmedTopUp(topUp.id, confirmation, config);
  return { action, verified: true };
}
