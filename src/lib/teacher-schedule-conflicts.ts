import { Prisma, type BookingSessionStatus, type BookingStatus, type PaymentStatus, type PrismaClient } from "@prisma/client";

export const TEACHER_SCHEDULE_CONFLICT_CODE = "TEACHER_SLOT_ALREADY_RESERVED";

export const SCHEDULE_BLOCKING_BOOKING_STATUSES = [
  "PAID",
  "PENDING_ADMIN_VALIDATION",
  "CONFIRMED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COURSE_DONE",
  "PENDING_CLIENT_VALIDATION",
  "VALIDATED_BY_CLIENT",
  "PAYMENT_TO_RELEASE",
  "DISPUTED",
] satisfies BookingStatus[];

export const SCHEDULE_BLOCKING_PAYMENT_STATUSES = [
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "DISPUTED",
] satisfies PaymentStatus[];

export const SCHEDULE_BLOCKING_SESSION_STATUSES = [
  "PLANNED",
  "TEACHER_CONFIRMED",
  "IN_PROGRESS",
  "AWAITING_CLIENT_CONFIRMATION",
  "RESCHEDULE_PROPOSED",
  "REPLACEMENT_PROPOSED",
  "NEEDS_REPLACEMENT",
  "DISPUTED",
] satisfies BookingSessionStatus[];

type ScheduleClient = Prisma.TransactionClient | PrismaClient;

export type ScheduleSlotInput = {
  scheduledDate?: Date | string | null;
  scheduledTime?: string | null;
  durationMinutes?: number | null;
};

export type TeacherScheduleConflict = {
  teacherId: string;
  bookingId: string;
  bookingReference: string;
  bookingSessionId: string | null;
  sequence: number | null;
  scheduledDate: Date;
  scheduledTime: string;
  status: string;
  paymentStatus: string;
};

type NormalizedScheduleSlot = {
  scheduledDate: Date;
  dateKey: string;
  scheduledTime: string;
  normalizedTimeLabel: string;
  durationMinutes: number;
  range: { startMinutes: number; endMinutes: number } | null;
};

export class TeacherScheduleConflictError extends Error {
  readonly code = TEACHER_SCHEDULE_CONFLICT_CODE;
  readonly conflict: TeacherScheduleConflict;

  constructor(conflict: TeacherScheduleConflict) {
    super(formatTeacherScheduleConflictMessage(conflict));
    this.name = "TeacherScheduleConflictError";
    this.conflict = conflict;
  }
}

export function isTeacherScheduleConflictError(error: unknown): error is TeacherScheduleConflictError {
  return error instanceof TeacherScheduleConflictError
    || Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && error.code === TEACHER_SCHEDULE_CONFLICT_CODE,
    );
}

export async function lockTeacherSchedule(client: ScheduleClient, teacherId: string) {
  const safeTeacherId = teacherId.trim();
  if (!safeTeacherId) throw new Error("Professeur manquant pour le verrou planning.");
  const locked = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Teacher"
    WHERE "id" = ${safeTeacherId}
    FOR UPDATE
  `);
  if (locked.length !== 1) {
    throw new Error("Professeur introuvable pour le verrou planning.");
  }
}

export async function assertTeacherScheduleAvailable(
  client: ScheduleClient,
  input: {
    teacherId: string;
    slots?: ScheduleSlotInput[];
    bookingId?: string | null;
    excludeBookingId?: string | null;
    excludeSessionId?: string | null;
  },
) {
  const conflict = input.bookingId
    ? await findTeacherScheduleConflictForBooking(client, input.bookingId, {
        teacherId: input.teacherId,
        excludeBookingId: input.excludeBookingId,
        excludeSessionId: input.excludeSessionId,
      })
    : await findTeacherScheduleConflict(client, {
        teacherId: input.teacherId,
        slots: input.slots ?? [],
        excludeBookingId: input.excludeBookingId,
        excludeSessionId: input.excludeSessionId,
      });
  if (conflict) throw new TeacherScheduleConflictError(conflict);
}

export async function findTeacherScheduleConflictForBooking(
  client: ScheduleClient,
  bookingId: string,
  options: {
    teacherId?: string | null;
    excludeBookingId?: string | null;
    excludeSessionId?: string | null;
  } = {},
) {
  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    include: {
      sessions: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          teacherId: true,
          scheduledDate: true,
          scheduledTime: true,
          durationMinutes: true,
        },
      },
    },
  });
  if (!booking) return null;
  const teacherId = options.teacherId ?? booking.teacherId;
  const sessionSlots = booking.sessions
    .filter((session) => session.teacherId === teacherId)
    .map((session) => ({
      scheduledDate: session.scheduledDate,
      scheduledTime: session.scheduledTime,
      durationMinutes: session.durationMinutes,
    }));
  const slots = sessionSlots.length > 0
    ? sessionSlots
    : [{
        scheduledDate: booking.scheduledDate ?? booking.startDate,
        scheduledTime: booking.scheduledTime || booking.preferredTime,
        durationMinutes: 120,
      }];

  return findTeacherScheduleConflict(client, {
    teacherId,
    slots,
    excludeBookingId: options.excludeBookingId ?? bookingId,
    excludeSessionId: options.excludeSessionId,
  });
}

export async function findTeacherScheduleConflict(
  client: ScheduleClient,
  input: {
    teacherId: string;
    slots: ScheduleSlotInput[];
    excludeBookingId?: string | null;
    excludeSessionId?: string | null;
  },
): Promise<TeacherScheduleConflict | null> {
  const teacherId = input.teacherId.trim();
  if (!teacherId) return null;
  const requestedSlots = input.slots
    .map(normalizeScheduleSlot)
    .filter((slot): slot is NormalizedScheduleSlot => Boolean(slot));
  if (requestedSlots.length === 0) return null;

  const dateFilters = buildDateFilters(requestedSlots);
  if (dateFilters.length === 0) return null;

  const activeSessionRows = await client.bookingSession.findMany({
    where: {
      teacherId,
      ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
      ...(input.excludeBookingId ? { bookingId: { not: input.excludeBookingId } } : {}),
      scheduledDate: { not: null },
      scheduledTime: { not: null },
      status: { in: [...SCHEDULE_BLOCKING_SESSION_STATUSES] as BookingSessionStatus[] },
      OR: dateFilters,
      booking: verifiedJekoScheduleBlockingBookingWhere(),
    },
    select: {
      id: true,
      bookingId: true,
      sequence: true,
      scheduledDate: true,
      scheduledTime: true,
      durationMinutes: true,
      status: true,
      booking: {
        select: {
          reference: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { sequence: "asc" }],
    take: 50,
  });

  for (const session of activeSessionRows) {
    if (!session.scheduledDate || !session.scheduledTime) continue;
    const existingSlot = normalizeScheduleSlot({
      scheduledDate: session.scheduledDate,
      scheduledTime: session.scheduledTime,
      durationMinutes: session.durationMinutes,
    });
    if (!existingSlot) continue;
    if (requestedSlots.some((slot) => scheduleSlotsOverlap(slot, existingSlot))) {
      return {
        teacherId,
        bookingId: session.bookingId,
        bookingReference: session.booking.reference,
        bookingSessionId: session.id,
        sequence: session.sequence,
        scheduledDate: session.scheduledDate,
        scheduledTime: session.scheduledTime,
        status: session.booking.status,
        paymentStatus: session.booking.paymentStatus,
      };
    }
  }

  const legacyBookingRows = await client.booking.findMany({
    where: {
      teacherId,
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      sessions: { none: {} },
      scheduledDate: { not: null },
      OR: dateFilters,
      ...verifiedJekoScheduleBlockingBookingWhere(),
    },
    select: {
      id: true,
      reference: true,
      scheduledDate: true,
      scheduledTime: true,
      preferredTime: true,
      status: true,
      paymentStatus: true,
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    take: 50,
  });

  for (const booking of legacyBookingRows) {
    const scheduledTime = booking.scheduledTime || booking.preferredTime;
    if (!booking.scheduledDate || !scheduledTime) continue;
    const existingSlot = normalizeScheduleSlot({
      scheduledDate: booking.scheduledDate,
      scheduledTime,
      durationMinutes: 120,
    });
    if (!existingSlot) continue;
    if (requestedSlots.some((slot) => scheduleSlotsOverlap(slot, existingSlot))) {
      return {
        teacherId,
        bookingId: booking.id,
        bookingReference: booking.reference,
        bookingSessionId: null,
        sequence: null,
        scheduledDate: booking.scheduledDate,
        scheduledTime,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      };
    }
  }

  return null;
}

export function scheduleSlotsOverlap(first: ScheduleSlotInput, second: ScheduleSlotInput) {
  const a = normalizeScheduleSlot(first);
  const b = normalizeScheduleSlot(second);
  if (!a || !b || a.dateKey !== b.dateKey) return false;
  if (a.range && b.range) {
    return a.range.startMinutes < b.range.endMinutes
      && b.range.startMinutes < a.range.endMinutes;
  }
  return Boolean(a.normalizedTimeLabel && a.normalizedTimeLabel === b.normalizedTimeLabel);
}

export function formatTeacherScheduleConflictMessage(conflict: TeacherScheduleConflict) {
  const dateLabel = formatDateFr(conflict.scheduledDate);
  const sessionLabel = conflict.sequence ? `, séance ${conflict.sequence}` : "";
  return `Ce créneau est déjà réservé et payé pour ce professeur (${dateLabel} · ${conflict.scheduledTime}${sessionLabel}, dossier ${conflict.bookingReference}). Choisissez un autre créneau ou un autre professeur.`;
}

function verifiedJekoScheduleBlockingBookingWhere(): Prisma.BookingWhereInput {
  return {
    status: { in: [...SCHEDULE_BLOCKING_BOOKING_STATUSES] },
    paymentStatus: { in: [...SCHEDULE_BLOCKING_PAYMENT_STATUSES] },
    paymentProvider: "JEKO",
    providerPaymentStatus: "SUCCESS",
    paymentVerifiedAt: { not: null },
    transactions: {
      some: {
        type: "CLIENT_PAYMENT",
        status: { in: [...SCHEDULE_BLOCKING_PAYMENT_STATUSES] },
        amount: { gt: 0 },
      },
    },
  };
}

function buildDateFilters(slots: NormalizedScheduleSlot[]) {
  const uniqueDateKeys = [...new Set(slots.map((slot) => slot.dateKey))];
  return uniqueDateKeys.map((key) => {
    const start = new Date(`${key}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { scheduledDate: { gte: start, lt: end } };
  });
}

function normalizeScheduleSlot(slot: ScheduleSlotInput): NormalizedScheduleSlot | null {
  const scheduledDate = parseScheduleDate(slot.scheduledDate);
  const scheduledTime = typeof slot.scheduledTime === "string" ? slot.scheduledTime.trim() : "";
  if (!scheduledDate || !scheduledTime) return null;
  const durationMinutes = normalizeDuration(slot.durationMinutes);
  return {
    scheduledDate,
    dateKey: dateKey(scheduledDate),
    scheduledTime,
    normalizedTimeLabel: normalizeTimeLabel(scheduledTime),
    durationMinutes,
    range: parseTimeRange(scheduledTime, durationMinutes),
  };
}

function parseScheduleDate(value?: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDuration(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 120;
  const duration = Math.round(Number(value));
  return duration >= 30 && duration <= 480 ? duration : 120;
}

function parseTimeRange(value: string, durationMinutes: number) {
  const label = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const compactRange = label.match(/\b([01]?\d|2[0-3])\s*-\s*([01]?\d|2[0-3])\b/);
  if (compactRange) {
    const startHour = Number(compactRange[1]);
    const endHour = Number(compactRange[2]);
    if (endHour > startHour) {
      return { startMinutes: startHour * 60, endMinutes: endHour * 60 };
    }
  }

  const times = Array.from(label.matchAll(/(?:^|[^\d])([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?/g))
    .map((match) => ({
      hour: Number(match[1]),
      minute: match[2] ? Number(match[2]) : 0,
    }))
    .filter((time) => Number.isFinite(time.hour) && Number.isFinite(time.minute));
  if (times.length === 0) return null;
  const start = times[0].hour * 60 + times[0].minute;
  const explicitEnd = times.length > 1 ? times[1].hour * 60 + times[1].minute : null;
  const end = explicitEnd && explicitEnd > start ? explicitEnd : start + durationMinutes;
  return { startMinutes: start, endMinutes: end };
}

function normalizeTimeLabel(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
