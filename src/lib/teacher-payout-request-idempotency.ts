export const TEACHER_PAYOUT_REQUEST_IDEMPOTENCY_ERROR =
  "PAYOUT_REQUEST_IDEMPOTENCY_MISMATCH" as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeacherPayoutRequestIntent = {
  teacherId: string;
  amount: number;
  method: string;
  paymentPhone: string;
  note: string;
};

export type ExistingTeacherPayoutRequestIntent = {
  teacherId: string;
  amount: number;
  method: string;
  paymentPhone: string;
  note?: string | null;
};

export type TeacherPayoutRequestIdempotencyResolution =
  | "CREATE"
  | "REPLAY"
  | "CONFLICT";

export function normalizeTeacherPayoutRequestIdempotencyKey(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return UUID_V4_PATTERN.test(normalized) ? normalized : null;
}

export function teacherPayoutRequestMatchesIntent(
  existing: ExistingTeacherPayoutRequestIntent,
  intent: TeacherPayoutRequestIntent,
) {
  return existing.teacherId === intent.teacherId
    && existing.amount === intent.amount
    && existing.method === intent.method
    && existing.paymentPhone === intent.paymentPhone
    && (existing.note ?? "") === intent.note;
}

export function resolveTeacherPayoutRequestIdempotency(
  existing: ExistingTeacherPayoutRequestIntent | null | undefined,
  intent: TeacherPayoutRequestIntent,
): TeacherPayoutRequestIdempotencyResolution {
  if (!existing) return "CREATE";
  return teacherPayoutRequestMatchesIntent(existing, intent) ? "REPLAY" : "CONFLICT";
}
