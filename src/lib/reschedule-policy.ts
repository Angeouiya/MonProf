import {
  calculatePaymentServiceFee,
  PAYMENT_SERVICE_FEE_LABEL,
  PAYMENT_SERVICE_FEE_RATE_BPS,
} from "@/lib/payment-service-fees";

const HOUR_MS = 60 * 60 * 1000;

export type ReschedulePolicyCode = "FREE" | "MODERATE" | "LATE" | "NO_SHOW" | "UNSCHEDULED";

export type ReschedulePolicyBooking = {
  unitPrice?: number | null;
  courseAmount?: number | null;
  totalClientPays?: number | null;
  totalPrice?: number | null;
  sessionsCount?: number | null;
  paymentServiceFeeAmount?: number | null;
  scheduledDate?: Date | string | null;
  scheduledTime?: string | null;
};

export type ReschedulePolicyResult = {
  code: ReschedulePolicyCode;
  label: string;
  description: string;
  baseAmount: number;
  feeRate: number;
  feeAmount: number;
  teacherRate: number;
  teacherAmount: number;
  platformRate: number;
  platformAmount: number;
  paymentServiceFeeRate: number;
  paymentServiceFeeAmount: number;
  paymentServiceFeeLabel: string;
  totalToPay: number;
  hoursBeforeCourse: number | null;
  scheduledAt: Date | null;
};

export const rescheduleWindowLabels: Record<ReschedulePolicyCode, string> = {
  FREE: "Modification gratuite",
  MODERATE: "Modification proche du cours",
  LATE: "Modification tardive",
  NO_SHOW: "Cours commencé ou dépassé",
  UNSCHEDULED: "Créneau non encore fixé",
};

export function getReschedulePolicy(
  booking: ReschedulePolicyBooking,
  now: Date = new Date(),
): ReschedulePolicyResult {
  const baseAmount = getRescheduleBaseAmount(booking);
  const scheduledAt = getScheduledDateTime(booking.scheduledDate, booking.scheduledTime);

  if (!scheduledAt) {
    return result(
      "UNSCHEDULED",
      "Créneau non encore fixé",
      "Aucun créneau définitif n'est fixé. La modification reste gratuite et doit être validée opérationnellement.",
      baseAmount,
      0,
      null,
      null,
    );
  }

  const hoursBeforeCourse = (scheduledAt.getTime() - now.getTime()) / HOUR_MS;

  if (hoursBeforeCourse <= 0) {
    return result(
      "NO_SHOW",
      "Cours déjà commencé ou dépassé",
      "Le cours est déjà commencé ou dépassé. Le service client doit examiner le dossier avant toute modification.",
      baseAmount,
      100,
      hoursBeforeCourse,
      scheduledAt,
    );
  }

  if (hoursBeforeCourse < 6) {
    return result(
      "LATE",
      "Modification tardive",
      "Moins de 6h avant le cours : 50% d'une séance de 2h est dû pour compenser la disponibilité bloquée.",
      baseAmount,
      50,
      hoursBeforeCourse,
      scheduledAt,
    );
  }

  if (hoursBeforeCourse < 24) {
    return result(
      "MODERATE",
      "Modification proche du cours",
      "Entre 24h et 6h avant le cours : 25% d'une séance de 2h est dû pour compenser la mobilisation.",
      baseAmount,
      25,
      hoursBeforeCourse,
      scheduledAt,
    );
  }

  return result(
    "FREE",
    "Modification gratuite",
    "Plus de 24h avant le cours : aucun frais de modification n'est appliqué.",
    baseAmount,
    0,
    hoursBeforeCourse,
    scheduledAt,
  );
}

export function reschedulePolicySummary(policy: ReschedulePolicyResult) {
  if (policy.feeRate === 0) return "Aucun frais de modification";
  if (policy.code === "NO_SHOW") return "Validation service client recommandée";
  return `Frais de modification : ${policy.feeRate}% d'une séance`;
}

export function rescheduleWindowLabel(code?: string | null) {
  return code && code in rescheduleWindowLabels
    ? rescheduleWindowLabels[code as ReschedulePolicyCode]
    : "Règle non renseignée";
}

export function getRescheduleBaseAmount(booking: ReschedulePolicyBooking) {
  const unitPrice = Math.max(0, Math.round(booking.unitPrice ?? 0));
  if (unitPrice > 0) return unitPrice;

  const sessionsCount = Math.max(1, Math.round(booking.sessionsCount ?? 1));
  const courseAmount = Math.max(0, Math.round(booking.courseAmount ?? 0));
  if (courseAmount > 0) return Math.round(courseAmount / sessionsCount);

  const paymentServiceFee = Math.max(0, Math.round(booking.paymentServiceFeeAmount ?? 0));
  const total = Math.max(0, Math.round(booking.totalClientPays ?? booking.totalPrice ?? 0));
  return Math.max(0, Math.round((total - paymentServiceFee) / sessionsCount));
}

function result(
  code: ReschedulePolicyCode,
  label: string,
  description: string,
  baseAmount: number,
  feeRate: number,
  hoursBeforeCourse: number | null,
  scheduledAt: Date | null,
): ReschedulePolicyResult {
  const feeAmount = Math.max(0, Math.round((baseAmount * feeRate) / 100));
  const teacherRate = feeRate === 25 ? 60 : feeRate >= 50 ? 70 : 0;
  const teacherAmount = Math.min(feeAmount, Math.round((feeAmount * teacherRate) / 100));
  const platformAmount = Math.max(0, feeAmount - teacherAmount);
  const paymentServiceFeeAmount = calculatePaymentServiceFee(feeAmount);
  return {
    code,
    label,
    description,
    baseAmount,
    feeRate,
    feeAmount,
    teacherRate,
    teacherAmount,
    platformRate: Math.max(0, 100 - teacherRate),
    platformAmount,
    paymentServiceFeeRate: PAYMENT_SERVICE_FEE_RATE_BPS,
    paymentServiceFeeAmount,
    paymentServiceFeeLabel: PAYMENT_SERVICE_FEE_LABEL,
    totalToPay: feeAmount + paymentServiceFeeAmount,
    hoursBeforeCourse,
    scheduledAt,
  };
}

function getScheduledDateTime(date: Date | string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const parsedDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const timeParts = parseStartTime(time);
  if (!timeParts) return parsedDate;

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    timeParts.hour,
    timeParts.minute,
    0,
    0,
  );
}

function parseStartTime(time: string | null | undefined) {
  if (!time) return null;
  const normalized = time.trim().toLowerCase();
  const match = normalized.match(/(\d{1,2})(?:h|:)?(\d{2})?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
