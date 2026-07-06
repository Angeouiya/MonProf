import { paymentMethodLabel } from "@/lib/payment-methods";

export type ClientPaymentFilter = "all" | "secure" | "blocked" | "refund" | "attention";

export function getClientTransactionStatusLabel(type: string, status: string) {
  if (type === "REFUND") return "Remboursement";
  const labels: Record<string, string> = {
    FAILED: "Paiement à finaliser",
    RECEIVED: "Paiement reçu",
    BLOCKED: "Paiement sécurisé",
    VALIDATED: "Cours validé",
    TO_PAY_TEACHER: "Traitement service client",
    TEACHER_PAID: "Cours clôturé",
    DISPUTED: "Litige en cours",
    REFUND_PENDING: "Remboursement en traitement",
    PARTIAL_REFUND_PENDING: "Remboursement partiel en traitement",
    REFUNDED: "Remboursé",
    PARTIALLY_REFUNDED: "Remboursement partiel",
    RETAINED: "Frais appliqués",
  };
  return labels[status] ?? "Transaction suivie";
}

export function getPaymentHint(type: string, status: string) {
  if (type === "REFUND") return "Remboursement enregistré dans l'historique de votre réservation.";
  if (status === "BLOCKED") return "Paiement confirmé par PayDunya et gardé bloqué jusqu'à la confirmation du cours.";
  if (status === "TO_PAY_TEACHER") return "Cours confirmé : le service client finalise le dossier.";
  if (status === "TEACHER_PAID") return "Cours clôturé dans votre espace client.";
  if (status === "REFUND_PENDING" || status === "PARTIAL_REFUND_PENDING") return "Le service client traite le dépôt de remboursement.";
  if (status === "DISPUTED") return "Paiement suspendu pendant le traitement du litige.";
  return "Transaction suivie dans le dossier de réservation.";
}

export function clientPaymentChannelLabel(method?: string | null) {
  return method ? paymentMethodLabel(method) : "PayDunya Checkout";
}

export function getClientPaymentFilter(type: string, status: string): ClientPaymentFilter {
  if (type === "REFUND" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "refund";
  if (status === "BLOCKED") return "blocked";
  if (["DISPUTED", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED", "FAILED"].includes(status)) return "attention";
  return "secure";
}
