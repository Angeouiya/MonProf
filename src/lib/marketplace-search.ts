import { type CourseFormat } from "@prisma/client";
import { db } from "@/lib/db";
import { marketplaceCommission, marketplaceCourseAmount, rankMarketplaceTeacher, teacherAvailableInGrid, type MarketplaceSlot } from "@/lib/marketplace-core";
import { calculateGrandAbidjanTransportFee } from "@/lib/pricing";
import { scheduleSlotsConflict } from "@/lib/schedule-conflict-core";
import { SCHEDULE_BLOCKING_BOOKING_STATUSES, SCHEDULE_BLOCKING_PAYMENT_STATUSES, SCHEDULE_BLOCKING_SESSION_STATUSES } from "@/lib/teacher-schedule-conflicts";
import { teacherJourneyWhere, type TeacherJourney } from "@/lib/teacher-journeys";

export type MarketplaceSearchInput = MarketplaceSlot & {
  journey: TeacherJourney;
  subjectId: string;
  subjectName: string;
  levelId: string;
  levelName: string;
  courseFormat: CourseFormat;
  commune: string | null;
  quartier: string | null;
};

export type MarketplaceCandidate = {
  teacherId: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  ratingCount: number;
  commune: string | null;
  quartier: string | null;
  proximity: "quartier" | "commune" | "autre_commune" | "en_ligne";
  courseAmount: number;
  transportFee: number;
  totalClientPrice: number;
  commissionAmount: number;
  score: number;
};

function normalized(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function findMarketplaceCandidates(input: MarketplaceSearchInput): Promise<MarketplaceCandidate[]> {
  const courseAmount = marketplaceCourseAmount(input.journey, input.levelName);
  const commissionAmount = marketplaceCommission(courseAmount);
  const where = {
    status: "ACTIVE" as const,
    portalAccessEnabled: true,
    portalPasswordMustChange: false,
    photoUrl: { not: null },
    ...teacherJourneyWhere(input.journey),
    ...(input.courseFormat === "HOME" ? { offersHome: true } : { offersOnline: true }),
    subjects: { some: { subjectId: input.subjectId } },
    levels: { some: { levelId: input.levelId } },
    wallet: { is: { available: { gte: commissionAmount } } },
  };
  const select = {
    id: true, fullName: true, professionalName: true, photoUrl: true,
    commune: true, quartier: true, availability: true, rating: true,
    ratingCount: true, featured: true,
  } as const;
  const local = input.commune && input.courseFormat === "HOME"
    ? await db.teacher.findMany({
        where: { ...where, OR: [{ commune: { equals: input.commune, mode: "insensitive" } }, { zones: { some: { commune: { name: { equals: input.commune, mode: "insensitive" } } } } }] },
        select,
        take: 70,
        orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
      })
    : [];
  const others = await db.teacher.findMany({
    where: { ...where, ...(local.length ? { id: { notIn: local.map((teacher) => teacher.id) } } : {}) },
    select,
    take: 70,
    orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
  });
  const teachers = [...local, ...others].filter((teacher) => Boolean(teacher.photoUrl?.trim()) && teacherAvailableInGrid(teacher.availability, input));
  if (!teachers.length) return [];
  const teacherIds = teachers.map((teacher) => teacher.id);
  const dayStart = input.scheduledDate;
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const verifiedLegacyBooking = {
    status: { in: SCHEDULE_BLOCKING_BOOKING_STATUSES },
    paymentStatus: { in: SCHEDULE_BLOCKING_PAYMENT_STATUSES },
    OR: [
      { paymentProvider: "JEKO" as const, providerPaymentStatus: "SUCCESS" as const, paymentVerifiedAt: { not: null } },
      { paymentProvider: "PAYDUNYA" as const, paydunyaStatus: "COMPLETED", paydunyaVerifiedAt: { not: null } },
    ],
    transactions: { some: { type: "CLIENT_PAYMENT" as const, status: { in: SCHEDULE_BLOCKING_PAYMENT_STATUSES }, amount: { gt: 0 } } },
  };
  const [legacySessions, legacyBookings, marketplaceRequests] = await Promise.all([
    db.bookingSession.findMany({
      where: {
        teacherId: { in: teacherIds },
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: { in: SCHEDULE_BLOCKING_SESSION_STATUSES },
        booking: verifiedLegacyBooking,
      },
      select: {
        teacherId: true, scheduledDate: true, scheduledTime: true, durationMinutes: true,
        booking: { select: { courseFormat: true, commune: true, quartier: true } },
      },
    }),
    db.booking.findMany({
      where: {
        teacherId: { in: teacherIds }, sessions: { none: {} },
        scheduledDate: { gte: dayStart, lt: dayEnd },
        ...verifiedLegacyBooking,
      },
      select: { teacherId: true, scheduledDate: true, scheduledTime: true, preferredTime: true,
        courseFormat: true, commune: true, quartier: true },
    }),
    db.marketplaceRequest.findMany({
      where: {
        assignedTeacherId: { in: teacherIds },
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: { in: ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "DISPUTED"] },
      },
      select: {
        assignedTeacherId: true, scheduledDate: true, scheduledTime: true, durationMinutes: true,
        courseFormat: true, commune: true, quartier: true,
      },
    }),
  ]);
  const requestSlot = { ...input, courseFormat: input.courseFormat };
  const result: MarketplaceCandidate[] = [];
  for (const teacher of teachers) {
    const occupied = legacySessions.some((session) => session.teacherId === teacher.id && scheduleSlotsConflict(requestSlot, {
      scheduledDate: session.scheduledDate, scheduledTime: session.scheduledTime,
      durationMinutes: session.durationMinutes, courseFormat: session.booking.courseFormat,
      commune: session.booking.commune, quartier: session.booking.quartier,
    })) || legacyBookings.some((booking) => booking.teacherId === teacher.id && scheduleSlotsConflict(requestSlot, {
      scheduledDate: booking.scheduledDate, scheduledTime: booking.scheduledTime || booking.preferredTime,
      durationMinutes: 120, courseFormat: booking.courseFormat, commune: booking.commune, quartier: booking.quartier,
    })) || marketplaceRequests.some((request) => request.assignedTeacherId === teacher.id && scheduleSlotsConflict(requestSlot, request));
    if (occupied) continue;
    const sameCommune = Boolean(input.commune && normalized(input.commune) === normalized(teacher.commune));
    const sameQuartier = sameCommune && Boolean(input.quartier && normalized(input.quartier) === normalized(teacher.quartier));
    const transportFee = input.courseFormat === "ONLINE" ? 0 : calculateGrandAbidjanTransportFee({
      teacherCommune: teacher.commune,
      teacherQuartier: teacher.quartier,
      clientCommune: input.commune,
      clientQuartier: input.quartier,
    }).amount;
    if (transportFee === null) continue;
    const proximity = input.courseFormat === "ONLINE" ? "en_ligne" : sameQuartier ? "quartier" : sameCommune ? "commune" : "autre_commune";
    result.push({
      teacherId: teacher.id,
      name: teacher.professionalName || teacher.fullName,
      photoUrl: teacher.photoUrl,
      rating: teacher.rating,
      ratingCount: teacher.ratingCount,
      commune: teacher.commune,
      quartier: teacher.quartier,
      proximity,
      courseAmount,
      transportFee,
      totalClientPrice: courseAmount + transportFee,
      commissionAmount,
      score: rankMarketplaceTeacher({ sameQuartier, sameCommune, rating: teacher.rating, ratingCount: teacher.ratingCount, featured: teacher.featured }),
    });
  }
  return result.sort((a, b) => b.score - a.score || a.teacherId.localeCompare(b.teacherId)).slice(0, 12);
}
