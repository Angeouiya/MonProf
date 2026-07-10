import type { Booking, BookingSession, BookingSessionStatus, Prisma } from "@prisma/client";
import { TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";

type SessionBookingInput = Pick<
  Booking,
  | "id"
  | "teacherId"
  | "sessionsCount"
  | "startDate"
  | "scheduledDate"
  | "scheduledTime"
  | "preferredTime"
  | "courseAmount"
  | "commissionAmount"
  | "teacherPayoutAmount"
  | "transportFee"
  | "teacherNetAmount"
  | "status"
  | "paymentStatus"
>;

type SessionWriteClient = {
  bookingSession: {
    findMany(args: Prisma.BookingSessionFindManyArgs): Promise<BookingSession[]>;
    createMany(args: Prisma.BookingSessionCreateManyArgs): Promise<unknown>;
  };
  booking: {
    update(args: Prisma.BookingUpdateArgs): Promise<Booking>;
  };
};

const DAY_INDEX = new Map<string, number>(WEEK_DAYS.map((day, index) => [day.key, index === 6 ? 0 : index + 1]));
const SETTLED_SESSION_STATUSES = new Set<BookingSessionStatus>(["RELEASED", "PARTIALLY_PAID", "PAID", "CANCELLED", "REFUNDED"]);

export function distributeAmount(total: number, count: number) {
  const safeCount = Math.max(1, Math.round(count));
  const safeTotal = Math.max(0, Math.round(total));
  const base = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function slotStartLabel(selection?: string | null) {
  if (!selection) return null;
  const slotKey = selection.includes("|") ? selection.split("|")[1] : null;
  const slot = TWO_HOUR_SLOTS.find((item) => item.key === slotKey);
  return slot?.label ?? selection;
}

function buildSchedule(startDate: Date, selectedTimeSlots: string[], count: number, fallbackTime?: string | null) {
  const validSelections = selectedTimeSlots
    .map((selection) => {
      const [dayKey, slotKey] = selection.split("|");
      const dayIndex = DAY_INDEX.get(dayKey);
      const slotIndex = TWO_HOUR_SLOTS.findIndex((slot) => slot.key === slotKey);
      return dayIndex === undefined || slotIndex < 0 ? null : { selection, dayIndex, slotIndex };
    })
    .filter((selection): selection is NonNullable<typeof selection> => Boolean(selection));

  if (validSelections.length === 0) {
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index * 7);
      return { scheduledDate: date, scheduledTime: fallbackTime ?? null };
    });
  }

  const schedule: { scheduledDate: Date; scheduledTime: string | null }[] = [];
  for (let dayOffset = 0; schedule.length < count && dayOffset < count * 14 + 14; dayOffset += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const matches = validSelections
      .filter((selection) => selection.dayIndex === date.getDay())
      .sort((a, b) => a.slotIndex - b.slotIndex);
    for (const match of matches) {
      if (schedule.length >= count) break;
      schedule.push({ scheduledDate: new Date(date), scheduledTime: slotStartLabel(match.selection) });
    }
  }
  return schedule;
}

export function buildBookingSessionRows({
  bookingId,
  teacherId,
  sessionsCount,
  startDate,
  selectedTimeSlots,
  fallbackTime,
  courseAmount,
  commissionAmount,
  teacherPayoutAmount,
  transportFee,
}: {
  bookingId: string;
  teacherId: string;
  sessionsCount: number;
  startDate: Date;
  selectedTimeSlots: string[];
  fallbackTime?: string | null;
  courseAmount: number;
  commissionAmount: number;
  teacherPayoutAmount: number;
  transportFee: number;
}): Prisma.BookingSessionCreateManyInput[] {
  const count = Math.max(1, Math.round(sessionsCount));
  const schedule = buildSchedule(startDate, selectedTimeSlots, count, fallbackTime);
  const courseAmounts = distributeAmount(courseAmount, count);
  const commissionAmounts = distributeAmount(commissionAmount, count);
  const teacherCourseAmounts = distributeAmount(teacherPayoutAmount, count);
  const transportAmounts = distributeAmount(transportFee, count);

  return Array.from({ length: count }, (_, index) => ({
    bookingId,
    sequence: index + 1,
    teacherId,
    scheduledDate: schedule[index]?.scheduledDate ?? null,
    scheduledTime: schedule[index]?.scheduledTime ?? fallbackTime ?? null,
    courseAmount: courseAmounts[index],
    commissionAmount: commissionAmounts[index],
    teacherCourseAmount: teacherCourseAmounts[index],
    transportFee: transportAmounts[index],
    teacherNetAmount: teacherCourseAmounts[index] + transportAmounts[index],
  }));
}

export async function ensureBookingSessions(client: SessionWriteClient, booking: SessionBookingInput) {
  const existing = await client.bookingSession.findMany({
    where: { bookingId: booking.id },
    orderBy: { sequence: "asc" },
  });
  if (existing.length > 0) return existing;

  const startDate = booking.scheduledDate ?? booking.startDate ?? new Date();
  await client.bookingSession.createMany({
    data: buildBookingSessionRows({
      bookingId: booking.id,
      teacherId: booking.teacherId,
      sessionsCount: booking.sessionsCount,
      startDate,
      selectedTimeSlots: [],
      fallbackTime: booking.scheduledTime || booking.preferredTime,
      courseAmount: booking.courseAmount,
      commissionAmount: booking.commissionAmount,
      teacherPayoutAmount: booking.teacherPayoutAmount,
      transportFee: booking.transportFee,
    }),
    skipDuplicates: true,
  });
  return client.bookingSession.findMany({
    where: { bookingId: booking.id },
    orderBy: { sequence: "asc" },
  });
}

export function bookingSessionFinancials(sessions: BookingSession[]) {
  return sessions.reduce((summary, session) => ({
    total: summary.total + session.teacherNetAmount,
    blocked: summary.blocked + (
      session.releasedAt || ["RELEASED", "PARTIALLY_PAID", "PAID"].includes(session.status)
        ? 0
        : Math.max(0, session.teacherNetAmount - session.retainedAmount)
    ),
    released: summary.released + Math.max(0, session.releasedAmount),
    paid: summary.paid + Math.max(0, session.paidAmount),
    retained: summary.retained + Math.max(0, session.retainedAmount),
    payable: summary.payable + Math.max(0, session.releasedAmount - session.paidAmount - session.retainedAmount),
  }), { total: 0, blocked: 0, released: 0, paid: 0, retained: 0, payable: 0 });
}

export async function syncBookingSessionAggregates(client: SessionWriteClient, bookingId: string) {
  const sessions = await client.bookingSession.findMany({
    where: { bookingId },
    orderBy: { sequence: "asc" },
  });
  if (sessions.length === 0) return null;

  const financials = bookingSessionFinancials(sessions);
  const activeSessions = sessions.filter((session) => !["CANCELLED", "REFUNDED"].includes(session.status));
  const allPaid = activeSessions.length > 0 && activeSessions.every((session) => session.status === "PAID");
  const allReleased = activeSessions.length > 0 && activeSessions.every((session) => SETTLED_SESSION_STATUSES.has(session.status));
  const hasAwaitingClient = activeSessions.some((session) => session.status === "AWAITING_CLIENT_CONFIRMATION");
  const hasInProgress = activeSessions.some((session) => session.status === "IN_PROGRESS");
  const hasOperationalIssue = activeSessions.some((session) => ["NEEDS_REPLACEMENT", "REPLACEMENT_PROPOSED", "DISPUTED"].includes(session.status));
  const latestCompletedAt = activeSessions.reduce<Date | null>((latest, session) => (
    session.completedAt && (!latest || session.completedAt > latest) ? session.completedAt : latest
  ), null);
  const latestValidatedAt = activeSessions.reduce<Date | null>((latest, session) => (
    session.clientValidatedAt && (!latest || session.clientValidatedAt > latest) ? session.clientValidatedAt : latest
  ), null);

  const status = allPaid
    ? "TEACHER_PAID"
    : financials.payable > 0
      ? "PAYMENT_TO_RELEASE"
      : hasAwaitingClient
        ? "PENDING_CLIENT_VALIDATION"
        : hasInProgress
          ? "IN_PROGRESS"
          : hasOperationalIssue
            ? "ASSIGNED"
            : allReleased
              ? "VALIDATED_BY_CLIENT"
              : "ASSIGNED";
  const paymentStatus = allPaid
    ? "TEACHER_PAID"
    : financials.payable > 0
      ? "TO_PAY_TEACHER"
      : "BLOCKED";

  return client.booking.update({
    where: { id: bookingId },
    data: {
      status,
      paymentStatus,
      teacherNetAmount: financials.total,
      teacherPaidAmount: financials.paid,
      courseDoneAt: latestCompletedAt,
      clientValidatedAt: latestValidatedAt,
      teacherPaidAt: allPaid ? new Date() : null,
    },
  });
}
