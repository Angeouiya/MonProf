import { Prisma, type BookingSessionStatus, type BookingStatus, type PaymentStatus, type PrismaClient } from "@prisma/client";
import {
  normalizeScheduleSlot,
  scheduleSlotsConflict,
  scheduleSlotsOverlap,
  type NormalizedScheduleSlot,
  type ScheduleBufferMinutes,
  type ScheduleConflictContext,
  type ScheduleConflictKind,
  type ScheduleSlotLike,
} from "@/lib/schedule-conflict-core";

export { scheduleSlotsOverlap };

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
  courseFormat?: string | null;
  commune?: string | null;
  quartier?: string | null;
  transportFeeKey?: string | null;
} & ScheduleSlotLike;

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
  kind: ScheduleConflictKind;
  requiredBufferMinutes: number | null;
  gapMinutes: number | null;
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
    scheduleBuffers?: Partial<ScheduleBufferMinutes> | null;
    grandAbidjanCommuneNames?: string[];
    neighborhoodAliases?: ScheduleConflictContext["neighborhoodAliases"];
  },
) {
  const conflict = input.bookingId
    ? await findTeacherScheduleConflictForBooking(client, input.bookingId, {
        teacherId: input.teacherId,
        excludeBookingId: input.excludeBookingId,
        excludeSessionId: input.excludeSessionId,
        scheduleBuffers: input.scheduleBuffers,
        grandAbidjanCommuneNames: input.grandAbidjanCommuneNames,
        neighborhoodAliases: input.neighborhoodAliases,
      })
    : await findTeacherScheduleConflict(client, {
        teacherId: input.teacherId,
        slots: input.slots ?? [],
        excludeBookingId: input.excludeBookingId,
        excludeSessionId: input.excludeSessionId,
        scheduleBuffers: input.scheduleBuffers,
        grandAbidjanCommuneNames: input.grandAbidjanCommuneNames,
        neighborhoodAliases: input.neighborhoodAliases,
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
    scheduleBuffers?: Partial<ScheduleBufferMinutes> | null;
    grandAbidjanCommuneNames?: string[];
    neighborhoodAliases?: ScheduleConflictContext["neighborhoodAliases"];
  } = {},
) {
  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      teacherId: true,
      scheduledDate: true,
      scheduledTime: true,
      startDate: true,
      preferredTime: true,
      courseFormat: true,
      commune: true,
      quartier: true,
      transportFeeKey: true,
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
      courseFormat: booking.courseFormat,
      commune: booking.commune,
      quartier: booking.quartier,
      transportFeeKey: booking.transportFeeKey,
    }));
  const slots = sessionSlots.length > 0
    ? sessionSlots
    : [{
        scheduledDate: booking.scheduledDate ?? booking.startDate,
        scheduledTime: booking.scheduledTime || booking.preferredTime,
        durationMinutes: 120,
        courseFormat: booking.courseFormat,
        commune: booking.commune,
        quartier: booking.quartier,
        transportFeeKey: booking.transportFeeKey,
      }];

  return findTeacherScheduleConflict(client, {
    teacherId,
    slots,
    excludeBookingId: options.excludeBookingId ?? bookingId,
    excludeSessionId: options.excludeSessionId,
    scheduleBuffers: options.scheduleBuffers,
    grandAbidjanCommuneNames: options.grandAbidjanCommuneNames,
    neighborhoodAliases: options.neighborhoodAliases,
  });
}

export async function findTeacherScheduleConflict(
  client: ScheduleClient,
  input: {
    teacherId: string;
    slots: ScheduleSlotInput[];
    excludeBookingId?: string | null;
    excludeSessionId?: string | null;
    scheduleBuffers?: Partial<ScheduleBufferMinutes> | null;
    grandAbidjanCommuneNames?: string[];
    neighborhoodAliases?: ScheduleConflictContext["neighborhoodAliases"];
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
  const conflictContext: ScheduleConflictContext = {
    grandAbidjanCommuneNames: input.grandAbidjanCommuneNames,
    neighborhoodAliases: input.neighborhoodAliases,
  };

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
          courseFormat: true,
          commune: true,
          quartier: true,
          transportFeeKey: true,
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
      courseFormat: session.booking.courseFormat,
      commune: session.booking.commune,
      quartier: session.booking.quartier,
      transportFeeKey: session.booking.transportFeeKey,
    });
    if (!existingSlot) continue;
    const conflict = requestedSlots
      .map((slot) => scheduleSlotsConflict(slot, existingSlot, input.scheduleBuffers, conflictContext))
      .find((item): item is NonNullable<typeof item> => Boolean(item));
    if (conflict) {
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
        kind: conflict.kind,
        requiredBufferMinutes: conflict.requiredBufferMinutes,
        gapMinutes: conflict.gapMinutes,
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
      courseFormat: true,
      commune: true,
      quartier: true,
      transportFeeKey: true,
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
      courseFormat: booking.courseFormat,
      commune: booking.commune,
      quartier: booking.quartier,
      transportFeeKey: booking.transportFeeKey,
    });
    if (!existingSlot) continue;
    const conflict = requestedSlots
      .map((slot) => scheduleSlotsConflict(slot, existingSlot, input.scheduleBuffers, conflictContext))
      .find((item): item is NonNullable<typeof item> => Boolean(item));
    if (conflict) {
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
        kind: conflict.kind,
        requiredBufferMinutes: conflict.requiredBufferMinutes,
        gapMinutes: conflict.gapMinutes,
      };
    }
  }

  return null;
}

export function formatTeacherScheduleConflictMessage(conflict: TeacherScheduleConflict) {
  const dateLabel = formatDateFr(conflict.scheduledDate);
  const sessionLabel = conflict.sequence ? `, séance ${conflict.sequence}` : "";
  if (conflict.kind === "TRAVEL_BUFFER") {
    const bufferLabel = conflict.requiredBufferMinutes
      ? `${conflict.requiredBufferMinutes} min`
      : "le temps de déplacement configuré";
    return `Déplacement insuffisant : ce professeur a déjà un cours payé (${dateLabel} · ${conflict.scheduledTime}${sessionLabel}, dossier ${conflict.bookingReference}). Il faut au moins ${bufferLabel} entre les deux cours. Choisissez une autre heure ou un autre professeur.`;
  }
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

function formatDateFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
