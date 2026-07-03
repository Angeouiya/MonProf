export type CancellationActor = "CLIENT" | "ADMIN" | "TEACHER";

export type CancellationPolicyResult = {
  code: "FREE" | "MODERATE" | "LATE" | "NO_SHOW" | "UNSCHEDULED" | "ADMIN_OVERRIDE" | "TEACHER_FAULT";
  label: string;
  description: string;
  baseAmount: number;
  feeRate: number;
  feeAmount: number;
  refundAmount: number;
  hoursBeforeCourse: number | null;
  scheduledAt: Date | null;
};

type BookingLike = {
  totalPrice: number;
  paidAmount?: number | null;
  scheduledDate?: Date | string | null;
  scheduledTime?: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

export const PAID_CLIENT_TRANSACTION_STATUSES = [
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "DISPUTED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "RETAINED",
] as const;

export const CANCELLATION_REASONS = [
  "Empêchement personnel",
  "Changement d'horaire",
  "Problème de santé",
  "Adresse ou déplacement impossible",
  "Professeur indisponible",
  "Autre",
] as const;

export const cancellationWindowLabels: Record<CancellationPolicyResult["code"], string> = {
  FREE: "Annulation gratuite",
  MODERATE: "Annulation proche du cours",
  LATE: "Annulation tardive",
  NO_SHOW: "Cours commencé ou dépassé",
  UNSCHEDULED: "Cours non encore planifié",
  ADMIN_OVERRIDE: "Annulation administrative",
  TEACHER_FAULT: "Annulation côté professeur",
};

export const cancellationActorLabels: Record<CancellationActor, string> = {
  CLIENT: "Client",
  ADMIN: "Administration",
  TEACHER: "Professeur",
};

export function cancellationWindowLabel(code?: string | null) {
  return code && code in cancellationWindowLabels
    ? cancellationWindowLabels[code as CancellationPolicyResult["code"]]
    : "Règle non renseignée";
}

export function cancellationActorLabel(actor?: string | null) {
  return actor && actor in cancellationActorLabels
    ? cancellationActorLabels[actor as CancellationActor]
    : "Non renseigné";
}

export function getCancellationPolicy(booking: BookingLike, now = new Date(), actor: CancellationActor = "CLIENT"): CancellationPolicyResult {
  const totalPrice = Math.max(0, booking.totalPrice || 0);
  const paidAmount = typeof booking.paidAmount === "number" ? Math.max(0, booking.paidAmount) : null;
  const baseAmount = paidAmount && paidAmount > 0 ? paidAmount : totalPrice;

  if (actor === "ADMIN") {
    return result("ADMIN_OVERRIDE", "Annulation administrative", "L'administration annule ou arbitre manuellement. Aucun frais client n'est appliqué par défaut.", 0, baseAmount, null, null);
  }

  if (actor === "TEACHER") {
    return result("TEACHER_FAULT", "Annulation côté professeur", "Le client n'est pas pénalisé. L'administration propose un remplacement, un report ou un remboursement.", 0, baseAmount, null, null);
  }

  const scheduledAt = getScheduledDateTime(booking.scheduledDate, booking.scheduledTime);
  if (!scheduledAt) {
    return result("UNSCHEDULED", "Cours non encore planifié", "Aucun créneau définitif n'est fixé. L'annulation client reste gratuite.", 0, baseAmount, null, null);
  }

  const hoursBeforeCourse = (scheduledAt.getTime() - now.getTime()) / HOUR_MS;

  if (hoursBeforeCourse <= 0) {
    return result("NO_SHOW", "Cours déjà commencé ou dépassé", "Le cours est déjà commencé ou dépassé. Le dossier doit être examiné par l'administration.", 100, baseAmount, hoursBeforeCourse, scheduledAt);
  }

  if (hoursBeforeCourse < 6) {
    return result("LATE", "Annulation tardive", "Moins de 6h avant le cours : 50% du montant est retenu, sauf décision exceptionnelle de l'administration.", 50, baseAmount, hoursBeforeCourse, scheduledAt);
  }

  if (hoursBeforeCourse < 24) {
    return result("MODERATE", "Annulation proche du cours", "Entre 24h et 6h avant le cours : 25% du montant est retenu.", 25, baseAmount, hoursBeforeCourse, scheduledAt);
  }

  return result("FREE", "Annulation gratuite", "Plus de 24h avant le cours : aucun frais d'annulation.", 0, baseAmount, hoursBeforeCourse, scheduledAt);
}

export function cancellationPolicySummary(policy: CancellationPolicyResult) {
  if (policy.feeRate === 0) return "Annulation gratuite";
  if (policy.feeRate === 100) return "Dossier à examiner";
  return `Frais d'annulation : ${policy.feeRate}%`;
}

function result(
  code: CancellationPolicyResult["code"],
  label: string,
  description: string,
  feeRate: number,
  baseAmount: number,
  hoursBeforeCourse: number | null,
  scheduledAt: Date | null
): CancellationPolicyResult {
  const feeAmount = Math.min(baseAmount, Math.round((baseAmount * feeRate) / 100));
  return {
    code,
    label,
    description,
    baseAmount,
    feeRate,
    feeAmount,
    refundAmount: Math.max(0, baseAmount - feeAmount),
    hoursBeforeCourse,
    scheduledAt,
  };
}

function getScheduledDateTime(date: Date | string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const base = typeof date === "string" ? new Date(date) : new Date(date);
  if (Number.isNaN(base.getTime())) return null;

  const hour = parseFirstHour(time);
  if (hour !== null) {
    base.setHours(hour, 0, 0, 0);
  }
  return base;
}

function parseFirstHour(time: string | null | undefined) {
  if (!time) return null;
  const match = time.match(/(\d{1,2})(?:\s*(?:h|:)\s*(\d{2}))?/i);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}
