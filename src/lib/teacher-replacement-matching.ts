import { db } from "@/lib/db";
import { calculateGrandAbidjanTransportFee, TRANSPORT_FEES } from "@/lib/pricing";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";

const ACTIVE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const RECENT_ISSUE_DAYS = 90;

function normalize(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");
}

function includesNormalized(values: string[], target?: string | null) {
  const normalizedTarget = normalize(target);
  if (!normalizedTarget) return false;
  return values.some((value) => normalize(value) === normalizedTarget);
}

function parsePreferredDays(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function dayKeyFromLabel(value: string) {
  const normalized = normalize(value);
  const day = WEEK_DAYS.find((item) => item.key === normalized || normalize(item.label) === normalized);
  return day?.key ?? "";
}

function dayKeyFromDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][parsed.getDay()] ?? "";
}

function slotKeyFromTime(value?: string | null) {
  if (!value) return "";
  const hourMatch = value.match(/(\d{1,2})(?:h|:)/i);
  if (!hourMatch) return "";
  const hour = Number(hourMatch[1]);
  if (!Number.isFinite(hour)) return "";
  return TWO_HOUR_SLOTS.find((slot) => {
    const [start, end] = slot.key.split("-").map(Number);
    return hour >= start && hour < end;
  })?.key ?? "";
}

function dateKey(value?: Date | string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function hasActiveConflict(
  teacherBookings: { status: string; scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string | null }[],
  booking: { scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string },
) {
  const bookingDate = dateKey(booking.scheduledDate);
  const bookingTime = booking.scheduledTime || booking.preferredTime;
  if (!bookingDate || !bookingTime) return false;
  return teacherBookings.some((item) => (
    ACTIVE_BOOKING_STATUSES.includes(item.status as (typeof ACTIVE_BOOKING_STATUSES)[number])
    && dateKey(item.scheduledDate) === bookingDate
    && Boolean((item.scheduledTime || item.preferredTime || "").trim())
    && (item.scheduledTime || item.preferredTime) === bookingTime
  ));
}

function isAvailabilityCompatible(rawAvailability: string | null, booking: { preferredDays: string; scheduledDate: Date | null; scheduledTime: string | null; preferredTime?: string | null }) {
  const availability = parseAvailability(rawAvailability);
  const requestedDays = Array.from(new Set([
    ...parsePreferredDays(booking.preferredDays).map(dayKeyFromLabel),
    dayKeyFromDate(booking.scheduledDate),
  ].filter(Boolean)));
  if (requestedDays.length === 0) return true;

  const scheduledSlot = slotKeyFromTime(booking.scheduledTime || booking.preferredTime);
  if (scheduledSlot) {
    return requestedDays.some((day) => Boolean(availability[day]?.[scheduledSlot]));
  }

  return requestedDays.some((day) => TWO_HOUR_SLOTS.some((slot) => Boolean(availability[day]?.[slot.key])));
}

export async function findReplacementCandidatesForBooking(
  bookingId: string,
  limit = 12,
  options?: { excludedTeacherId?: string; excludedTeacherIds?: string[]; scheduledDate?: Date | null; scheduledTime?: string | null },
) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: true,
      client: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!booking) return { booking: null, items: [] };

  const [platformSettings, grandAbidjanCommunes, destination] = await Promise.all([
    getPlatformRuntimeSettings(),
    db.commune.findMany({ where: { transportClass: "GRAND_ABIDJAN", isActive: true }, select: { name: true } }),
    booking.commune
      ? db.commune.findFirst({ where: { name: { equals: booking.commune, mode: "insensitive" }, isActive: true }, select: { transportFeeOverride: true } })
      : null,
  ]);

  const matchingBooking = {
    ...booking,
    scheduledDate: options?.scheduledDate ?? booking.scheduledDate,
    scheduledTime: options?.scheduledTime ?? booking.scheduledTime,
  };
  const teachers = await db.teacher.findMany({
    where: {
      id: {
        notIn: Array.from(new Set([
          booking.teacherId,
          options?.excludedTeacherId,
          ...(options?.excludedTeacherIds ?? []),
        ].filter((value): value is string => Boolean(value)))),
      },
      status: "ACTIVE",
      AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
      ...(booking.courseFormat === "HOME" ? { offersHome: true } : { offersOnline: true }),
    },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
      warnings: { orderBy: { createdAt: "desc" }, take: 5 },
      sanctions: { orderBy: { createdAt: "desc" }, take: 5 },
      bookings: {
        where: {
          OR: [
            { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
            { disputes: { some: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } } } },
          ],
        },
        select: {
          status: true,
          scheduledDate: true,
          scheduledTime: true,
          preferredTime: true,
          disputes: {
            where: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } },
            select: { id: true },
          },
        },
        take: 30,
      },
      _count: { select: { bookings: true, reviews: true } },
    },
    take: 100,
  });

  const currentTeacherCourseShare = booking.teacherPayoutAmount || Math.max(0, booking.teacherNetAmount - booking.transportFee);
  const items = teachers
    .map((teacher) => {
      const subjectNames = teacher.subjects.map((item) => item.subject.name);
      const levelNames = teacher.levels.map((item) => item.level.name);
      const zoneNames = teacher.zones
        .map((item) => item.commune?.name)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      const sameSubject = includesNormalized(subjectNames, booking.subjectName);
      const sameLevel = includesNormalized(levelNames, booking.levelName);
      const sameCommune = includesNormalized(zoneNames, booking.commune) || normalize(teacher.commune) === normalize(booking.commune);
      const transport = booking.courseFormat === "HOME"
        ? calculateGrandAbidjanTransportFee({
            teacherCommune: teacher.commune,
            teacherQuartier: teacher.quartier,
            teacherZoneNames: zoneNames,
            clientCommune: booking.commune,
            clientQuartier: booking.quartier,
            transportFeeAmounts: platformSettings.transportFees,
            grandAbidjanCommuneNames: grandAbidjanCommunes.map((item) => item.name),
          })
        : null;
      const formatCompatible = booking.courseFormat === "HOME" ? teacher.offersHome : teacher.offersOnline;
      const availabilityCompatible = isAvailabilityCompatible(teacher.availability, matchingBooking);
      const activeConflict = hasActiveConflict(teacher.bookings, matchingBooking);
      const recentDisputeCount = teacher.bookings.reduce((sum, item) => sum + item.disputes.length, 0);
      const priceDiff = teacher.pricePerSession - booking.unitPrice;
      const priceCompatible = Math.abs(priceDiff) <= Math.max(2500, Math.round(booking.unitPrice * 0.25));
      const noRecentIssue = teacher.warnings.length === 0 && teacher.sanctions.length === 0 && recentDisputeCount === 0;
      const destinationOverride = destination?.transportFeeOverride;
      const transportFee = transport?.key !== TRANSPORT_FEES.SAME_NEIGHBORHOOD.key
        && destinationOverride !== null && destinationOverride !== undefined
        ? destinationOverride
        : (transport?.amount ?? 0);
      const netAmount = currentTeacherCourseShare + transportFee;
      const rawScore = [
        sameSubject ? 30 : 0,
        sameLevel ? 20 : 0,
        sameCommune ? 15 : 0,
        formatCompatible ? 10 : 0,
        availabilityCompatible ? 10 : -20,
        priceCompatible ? 10 : 0,
        Math.min(10, Math.round((teacher.qualityScore || 0) / 10)),
        teacher.rating >= 4.5 ? 5 : teacher.rating >= 4 ? 3 : 0,
        noRecentIssue ? 5 : 0,
        activeConflict ? -25 : 0,
        recentDisputeCount > 0 ? -20 : 0,
      ].reduce((sum, value) => sum + value, 0);

      return {
        teacher,
        subjectNames,
        levelNames,
        zoneNames,
        teacherCourseShare: currentTeacherCourseShare,
        transportFee,
        transportRouteLabel: transport?.routeLabel ?? null,
        transportRuleLabel: transport?.ruleLabel ?? null,
        netAmount,
        financialImpact: netAmount - booking.teacherNetAmount,
        matchReasons: [
          sameSubject ? "Même matière" : "",
          sameLevel ? "Même niveau" : "",
          sameCommune ? "Même commune/zone" : "",
          availabilityCompatible ? "Disponibilité compatible" : "",
          priceCompatible ? "Tarif compatible" : "",
          (teacher.qualityScore || 0) >= 75 ? "Bon score qualité" : "",
        ].filter(Boolean),
        compatibility: {
          score: Math.max(0, Math.min(100, rawScore)),
          sameSubject,
          sameLevel,
          sameCommune,
          formatCompatible,
          availabilityCompatible,
          priceCompatible,
          noRecentIssue,
          activeConflict,
          recentDisputeCount,
          transportQuoteOnly: transport?.isQuoteOnly ?? false,
        },
      };
    })
    .filter((item) => (
      item.compatibility.sameSubject
      && item.compatibility.sameLevel
      && item.compatibility.formatCompatible
      && item.compatibility.availabilityCompatible
      && !item.compatibility.activeConflict
      && item.compatibility.recentDisputeCount === 0
      && !item.compatibility.transportQuoteOnly
      && item.teacher.photoUrl
    ))
    .sort((a, b) => (
      b.compatibility.score - a.compatibility.score
      || b.teacher.qualityScore - a.teacher.qualityScore
      || b.teacher.rating - a.teacher.rating
    ))
    .slice(0, limit);

  return { booking, items };
}

export async function findBestReplacementCandidate(bookingId: string) {
  const result = await findReplacementCandidatesForBooking(bookingId, 1);
  return { booking: result.booking, candidate: result.items[0] ?? null };
}
