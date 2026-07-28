import type { BookingSessionStatus, TeacherPayoutRecordStatus } from "@prisma/client";
import { distributeAmount } from "@/lib/booking-sessions";

export type ReplacementSessionInput = {
  id: string;
  status: BookingSessionStatus;
  completedAt?: Date | null;
  clientValidatedAt?: Date | null;
  releasedAt?: Date | null;
  paidAt?: Date | null;
  releasedAmount: number;
  paidAmount: number;
  retainedAmount: number;
  payoutStatuses?: TeacherPayoutRecordStatus[];
};

export type ReplacementSessionSnapshot = {
  id: string;
  teacherId: string;
  status: BookingSessionStatus;
  courseAmount: number;
  commissionAmount: number;
  teacherCourseAmount: number;
  transportFee: number;
  teacherNetAmount: number;
};

const REASSIGNABLE_SESSION_STATUSES = new Set<BookingSessionStatus>([
  "PLANNED",
  "TEACHER_CONFIRMED",
  "RESCHEDULE_PROPOSED",
  "REPLACEMENT_PROPOSED",
  "NEEDS_REPLACEMENT",
]);

export function calculateReplacementTransportTotal(perSessionAmount: number, sessionsCount: number) {
  const safeSessionsCount = Math.max(1, Math.round(sessionsCount));
  const transportFeePerSession = Math.max(0, Math.round(perSessionAmount));
  return {
    transportFeePerSession,
    transportFee: transportFeePerSession * safeSessionsCount,
  };
}

export function getTeacherReplacementSessionBlocker(session: ReplacementSessionInput) {
  const hasReservedOrPaidPayout = (session.payoutStatuses ?? []).some((status) => status === "DRAFT" || status === "PAID");
  if (hasReservedOrPaidPayout) {
    return "un retrait Jèko est déjà réservé ou payé pour cette séance";
  }
  if (
    session.paidAmount > 0
    || session.retainedAmount > 0
    || session.paidAt
    || session.status === "PARTIALLY_PAID"
    || session.status === "PAID"
  ) {
    return "la séance comporte déjà un versement ou une retenue professeur";
  }
  if (
    session.releasedAmount > 0
    || session.releasedAt
    || session.completedAt
    || session.clientValidatedAt
    || ["AWAITING_CLIENT_CONFIRMATION", "RELEASED"].includes(session.status)
  ) {
    return "la séance a déjà été effectuée ou libérée au professeur actuel";
  }
  if (!REASSIGNABLE_SESSION_STATUSES.has(session.status)) {
    return `le statut ${session.status} ne permet pas une réaffectation globale sûre`;
  }
  return null;
}

export function buildTeacherReplacementSessionSnapshots(input: {
  sessions: ReplacementSessionInput[];
  expectedSessionsCount: number;
  newTeacherId: string;
  courseAmount: number;
  commissionAmount: number;
  teacherCourseAmount: number;
  transportFee: number;
}): ReplacementSessionSnapshot[] {
  const expectedSessionsCount = Math.max(1, Math.round(input.expectedSessionsCount));
  if (input.sessions.length !== expectedSessionsCount) {
    throw new Error(
      `SESSION_COUNT_MISMATCH:${input.sessions.length}:${expectedSessionsCount}`,
    );
  }

  for (const session of input.sessions) {
    const blocker = getTeacherReplacementSessionBlocker(session);
    if (blocker) throw new Error(`SESSION_REPLACEMENT_BLOCKED:${session.id}:${blocker}`);
  }

  const courseAmounts = distributeAmount(input.courseAmount, expectedSessionsCount);
  const commissionAmounts = distributeAmount(input.commissionAmount, expectedSessionsCount);
  const teacherCourseAmounts = distributeAmount(input.teacherCourseAmount, expectedSessionsCount);
  const transportAmounts = distributeAmount(input.transportFee, expectedSessionsCount);

  return input.sessions.map((session, index) => {
    const status = ["REPLACEMENT_PROPOSED", "NEEDS_REPLACEMENT"].includes(session.status)
      ? "PLANNED"
      : session.status;
    return {
      id: session.id,
      teacherId: input.newTeacherId,
      status,
      courseAmount: courseAmounts[index],
      commissionAmount: commissionAmounts[index],
      teacherCourseAmount: teacherCourseAmounts[index],
      transportFee: transportAmounts[index],
      teacherNetAmount: teacherCourseAmounts[index] + transportAmounts[index],
    };
  });
}
