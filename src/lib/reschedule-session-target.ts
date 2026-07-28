export const RESCHEDULABLE_BOOKING_SESSION_STATUSES = ["PLANNED", "TEACHER_CONFIRMED"] as const;
const BOOKING_SCHEDULE_COMPLETED_STATUSES = [
  "AWAITING_CLIENT_CONFIRMATION",
  "RELEASED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
  "REFUNDED",
] as const;

type RescheduleSessionIdentity = {
  id: string;
  status: string;
  scheduledDate: Date | null;
  scheduledTime: string | null;
};

type BookingScheduleSession = Pick<RescheduleSessionIdentity, "id" | "status" | "scheduledDate" | "scheduledTime"> & {
  sequence?: number;
};

export function isReschedulableBookingSessionStatus(status: string) {
  return (RESCHEDULABLE_BOOKING_SESSION_STATUSES as readonly string[]).includes(status);
}

/**
 * New requests resolve exclusively by their persisted session ID. Historical
 * requests without that ID may use the old slot only when it identifies one
 * and only one still-reschedulable ledger row.
 */
export function resolveRescheduleSessionTarget<T extends RescheduleSessionIdentity>(
  sessions: T[],
  input: {
    bookingSessionId?: string | null;
    oldScheduledDate?: Date | null;
    oldScheduledTime?: string | null;
  },
) {
  if (input.bookingSessionId) {
    return sessions.find((session) => session.id === input.bookingSessionId) ?? null;
  }

  if (!input.oldScheduledDate) return null;
  const expectedDay = toUtcDay(input.oldScheduledDate);
  const exactMatches = sessions.filter((session) => (
    isReschedulableBookingSessionStatus(session.status)
    && session.scheduledDate
    && toUtcDay(session.scheduledDate) === expectedDay
    && session.scheduledTime === input.oldScheduledTime
  ));
  return exactMatches.length === 1 ? exactMatches[0] : null;
}

export function sessionMatchesRescheduleOrigin(
  session: Pick<RescheduleSessionIdentity, "scheduledDate" | "scheduledTime">,
  oldDate: Date | null,
  oldTime: string | null,
) {
  if (!session.scheduledDate || !oldDate) return false;
  return toUtcDay(session.scheduledDate) === toUtcDay(oldDate)
    && session.scheduledTime === oldTime;
}

/**
 * Booking.scheduledDate is the compact schedule shown by legacy dashboards.
 * For a multi-session booking it must represent the earliest session that is
 * still operational, regardless of which exact session was just rescheduled.
 */
export function resolveBookingScheduleSummary<T extends BookingScheduleSession>(sessions: T[]) {
  const candidates = sessions
    .filter((session) => (
      session.scheduledDate
      && !(BOOKING_SCHEDULE_COMPLETED_STATUSES as readonly string[]).includes(session.status)
    ))
    .slice()
    .sort((left, right) => {
      const dateDifference = left.scheduledDate!.getTime() - right.scheduledDate!.getTime();
      if (dateDifference !== 0) return dateDifference;
      const timeDifference = (left.scheduledTime ?? "99:99").localeCompare(right.scheduledTime ?? "99:99");
      if (timeDifference !== 0) return timeDifference;
      return (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER);
    });

  const representative = candidates[0];
  return representative
    ? {
        bookingSessionId: representative.id,
        scheduledDate: representative.scheduledDate!,
        scheduledTime: representative.scheduledTime,
      }
    : null;
}

function toUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
