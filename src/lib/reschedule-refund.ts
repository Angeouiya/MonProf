export const RESCHEDULE_REFUND_REFERENCE_MIN_LENGTH = 3;
export const RESCHEDULE_REFUND_REFERENCE_MAX_LENGTH = 160;

type RescheduleFeeTransactionSnapshot = {
  type: string;
  status: string;
  amount: number;
  paidAt?: Date | string | null;
};

export type RescheduleRefundSnapshot = {
  status: string;
  paidAt?: Date | string | null;
  feeAmount: number;
  totalToPay: number;
  transaction?: RescheduleFeeTransactionSnapshot | null;
};

/**
 * Le montant n'est jamais fourni par le navigateur. Le ledger d'origine doit
 * prouver exactement le total payé pour que le remboursement soit autorisé.
 */
export function validateRescheduleRefundSnapshot(snapshot: RescheduleRefundSnapshot) {
  if (snapshot.status !== "REFUND_REQUIRED") {
    return "Cette demande de report n'est pas en attente de remboursement.";
  }
  if (!snapshot.paidAt) {
    return "Aucun supplément payé n'est rattaché à cette demande.";
  }
  if (!Number.isSafeInteger(snapshot.feeAmount) || snapshot.feeAmount <= 0) {
    return "Le supplément de report n'est pas remboursable.";
  }
  if (!Number.isSafeInteger(snapshot.totalToPay) || snapshot.totalToPay <= 0) {
    return "Le total payé du supplément est invalide.";
  }
  if (!snapshot.transaction || snapshot.transaction.type !== "RESCHEDULE_FEE") {
    return "La transaction d'origine du supplément est introuvable.";
  }
  if (snapshot.transaction.status !== "REFUND_PENDING") {
    return "La transaction du supplément n'est pas en attente de remboursement.";
  }
  if (!snapshot.transaction.paidAt) {
    return "La transaction du supplément ne possède aucune preuve de paiement.";
  }
  if (
    !Number.isSafeInteger(snapshot.transaction.amount)
    || snapshot.transaction.amount <= 0
    || snapshot.transaction.amount !== snapshot.totalToPay
  ) {
    return "Le montant du ledger ne correspond pas exactement au supplément payé.";
  }
  return null;
}

export function normalizeRescheduleRefundExternalReference(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  if (
    normalized.length < RESCHEDULE_REFUND_REFERENCE_MIN_LENGTH
    || normalized.length > RESCHEDULE_REFUND_REFERENCE_MAX_LENGTH
  ) {
    return null;
  }
  return normalized;
}

export function buildRescheduleRefundLedgerReference(rescheduleRequestId: string) {
  const normalizedId = rescheduleRequestId.trim();
  if (!normalizedId || normalizedId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(normalizedId)) {
    throw new Error("Identifiant de report invalide pour le ledger de remboursement.");
  }
  return `TX-REFUND-RS-${normalizedId}`;
}
