export { paymentMethodLabel, paymentMethodLabels } from "@/lib/payment-methods";

export const transactionTypeLabels: Record<string, string> = {
  CLIENT_PAYMENT: "Paiement client sécurisé",
  TEACHER_PAYOUT: "Versement professeur",
  REFUND: "Remboursement client",
  COMMISSION: "Commission interne",
};

export const packTypeLabels: Record<string, string> = {
  SINGLE: "1 séance",
  PACK_4: "Pack 4 séances",
  PACK_8: "Pack 8 séances",
  PACK_12: "Pack 12 séances",
  CUSTOM: "Pack personnalisé",
  EXAM_PREP: "Préparation examen / concours",
};

export const replacementReasonLabels: Record<string, string> = {
  UNAVAILABLE: "Indisponibilité",
  LATE: "Retard professeur",
  ABSENT: "Absence professeur",
  CLIENT_REQUEST: "Demande du client",
  QUALITY_ISSUE: "Problème de qualité",
  ASSIGNMENT_ERROR: "Erreur d'affectation",
  TEACHER_SUSPENDED: "Professeur suspendu",
  BETTER_MATCH: "Meilleur profil disponible",
  OTHER: "Autre motif",
};

export const missionStatusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "En attente de confirmation",
  CONFIRMED: "Confirmée",
  UNAVAILABLE: "Indisponible",
  PROBLEM_REPORTED: "Problème signalé",
  RESCHEDULE_PROPOSED: "Nouveau créneau proposé",
  EXPIRED: "Lien expiré",
  RELAUNCHED: "Relancée",
  REPLACEMENT_RECOMMENDED: "Remplacement recommandé",
};

export const disputeStatusLabels: Record<string, string> = {
  OPEN: "Ouvert",
  INVESTIGATING: "En traitement",
  RESOLVED: "Résolu",
  REFUNDED: "Remboursé",
  REJECTED: "Rejeté",
};

export const notificationDeliveryStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  SENT: "Envoyé",
  FAILED: "Échec",
  READ: "Lu",
  CONFIRMED: "Confirmé",
};

export const priorityLabels: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

export const notificationRecipientLabels: Record<string, string> = {
  CLIENT: "Client",
  TEACHER: "Professeur",
  ADMIN: "Service client",
};

export const notificationChannelLabels: Record<string, string> = {
  INTERNAL: "Dashboard",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  BROWSER: "Navigateur",
  PWA: "PWA",
  MANUAL_CALL: "Appel manuel",
  PRIVATE_LINK: "Lien privé sécurisé",
};

export const notificationTypeLabels: Record<string, string> = {
  NEW_BOOKING: "Nouvelle réservation",
  QUOTE_REQUESTED: "Prix à finaliser",
  PAYMENT_PENDING: "Paiement à finaliser",
  PAYMENT_RECEIVED: "Paiement reçu",
  BLOCKED_FUNDS: "Fonds bloqués",
  FUNDS_BLOCKED: "Fonds bloqués",
  BOOKING_CONFIRMED: "Réservation confirmée",
  TEACHER_ASSIGNED: "Professeur attribué",
  TEACHER_REPLACED: "Professeur remplacé",
  TEACHER_NOT_CONFIRMED: "Professeur non confirmé",
  STATUS_RESTRICTED: "Statut professeur bloquant",
  TEACHER_STATUS_CHANGED: "Statut professeur modifié",
  DISPUTE: "Litige",
  DISPUTE_OPENED: "Litige ouvert",
  REFUND: "Remboursement",
  PAYMENT_TO_RELEASE: "Paiement à libérer",
  TEACHER_TO_PAY: "Professeur à payer",
  SANCTION: "Sanction",
  WARNING: "Avertissement",
  REMINDER: "Rappel",
  URGENCY: "Urgence",
  CLIENT_MESSAGE: "Message client",
  TEACHER_TASK: "Tâche professeur",
  REPLACEMENT: "Remplacement",
};

export const clientCommunicationTypeLabels: Record<string, string> = {
  INFORMATION: "Information",
  REMINDER: "Rappel",
  WARNING: "Avertissement",
  TEACHER_CHANGE: "Changement professeur",
  RESCHEDULE: "Report",
  PAYMENT: "Paiement",
  DISPUTE: "Litige",
  COURSE_CONFIRMATION: "Confirmation cours",
};

export const courseFormatLabels: Record<string, string> = {
  HOME: "À domicile",
  ONLINE: "En ligne",
};

export function transactionTypeLabel(type: string) {
  return transactionTypeLabels[type] ?? type;
}

export function packTypeLabel(type: string) {
  return packTypeLabels[type] ?? type;
}

export function replacementReasonLabel(reason: string) {
  return replacementReasonLabels[reason] ?? reason;
}

export function missionStatusLabel(status: string) {
  return missionStatusLabels[status] ?? status;
}

export function disputeStatusLabel(status: string) {
  return disputeStatusLabels[status] ?? status;
}

export function notificationDeliveryStatusLabel(status: string) {
  return notificationDeliveryStatusLabels[status] ?? status;
}

export function priorityLabel(priority: string) {
  return priorityLabels[priority] ?? priority;
}

export function notificationRecipientLabel(recipient: string) {
  return notificationRecipientLabels[recipient] ?? recipient;
}

export function notificationChannelLabel(channel: string) {
  return notificationChannelLabels[channel] ?? channel;
}

export function notificationTypeLabel(type: string) {
  return notificationTypeLabels[type] ?? type;
}

export function clientCommunicationTypeLabel(type: string) {
  return clientCommunicationTypeLabels[type] ?? type;
}

export function courseFormatLabel(format: string) {
  return courseFormatLabels[format] ?? format;
}
