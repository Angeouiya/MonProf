import { Prisma, type CourseFormat } from "@prisma/client";
import { db } from "@/lib/db";
import { marketplaceCommission, rankMarketplaceTeacher, teacherAvailableInGrid, type MarketplaceSlot } from "@/lib/marketplace-core";
import { marketplaceCourseAmount } from "@/lib/marketplace-pricing";
import { calculateGrandAbidjanTransportFee } from "@/lib/pricing";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { marketplaceTransportOrigin, type MarketplaceTransportLesson } from "@/lib/marketplace-transport-origin";
import { scheduleSlotsConflict } from "@/lib/schedule-conflict-core";
import { SCHEDULE_BLOCKING_BOOKING_STATUSES, SCHEDULE_BLOCKING_PAYMENT_STATUSES, SCHEDULE_BLOCKING_SESSION_STATUSES } from "@/lib/teacher-schedule-conflicts";
import { teacherJourneyWhere, type TeacherJourney } from "@/lib/teacher-journeys";
import { isTeacherQualifiedForPreciseLevel } from "@/lib/teacher-precise-levels";
import { scanPagedMarketplaceCandidates } from "@/lib/marketplace-candidate-scan";

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
  transportOriginLabel: string;
  totalClientPrice: number;
  commissionAmount: number;
  score: number;
};

function normalized(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function findMarketplaceCandidates(input: MarketplaceSearchInput, limit = 12): Promise<MarketplaceCandidate[]> {
  const courseAmount = marketplaceCourseAmount(input.journey, input.levelName, input.courseFormat, input.durationMinutes);
  const commissionAmount = marketplaceCommission(courseAmount);
  const where = {
    status: "ACTIVE" as const,
    portalAccessEnabled: true,
    portalPasswordMustChange: false,
    photoUrl: { not: null },
    ...teacherJourneyWhere(input.journey),
    ...(input.courseFormat === "HOME" ? { offersHome: true } : { offersOnline: true }),
    subjects: { some: { subjectId: input.subjectId } },
    ...(input.journey === "professionnel"
      ? { levels: { some: { levelId: input.levelId } } }
      : { preciseLevels: { some: {
          journey: input.journey, className: input.levelName, subjectId: input.subjectId,
        } } }),
    wallet: { is: { available: { gte: commissionAmount } } },
  };
  const select = {
    id: true, fullName: true, professionalName: true, photoUrl: true,
    commune: true, quartier: true, availability: true, rating: true,
    ratingCount: true, featured: true,
    preciseLevels: { select: { journey: true, className: true, subjectId: true } },
  } as const;
  const targetCount = Math.max(1, Math.min(limit, 70));
  const dayStart = input.scheduledDate;
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const settings = await getPlatformRuntimeSettings();
  const verifiedLegacyBooking = {
    status: { in: SCHEDULE_BLOCKING_BOOKING_STATUSES },
    paymentStatus: { in: SCHEDULE_BLOCKING_PAYMENT_STATUSES },
    OR: [
      { paymentProvider: "JEKO" as const, providerPaymentStatus: "SUCCESS" as const, paymentVerifiedAt: { not: null } },
      { paymentProvider: "PAYDUNYA" as const, paydunyaStatus: "COMPLETED", paydunyaVerifiedAt: { not: null } },
    ],
    transactions: { some: { type: "CLIENT_PAYMENT" as const, status: { in: SCHEDULE_BLOCKING_PAYMENT_STATUSES }, amount: { gt: 0 } } },
  };
  const result: MarketplaceCandidate[] = [];
  const inspectBatch = async (teachers: Prisma.TeacherGetPayload<{ select: typeof select }>[]) => {
    if (teachers.length === 0) return;
    const teacherIds = teachers.map((teacher) => teacher.id);
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
  const lessonsByTeacher = new Map<string, MarketplaceTransportLesson[]>();
  const addLesson = (lesson: MarketplaceTransportLesson) => {
    const existing = lessonsByTeacher.get(lesson.teacherId);
    if (existing) existing.push(lesson);
    else lessonsByTeacher.set(lesson.teacherId, [lesson]);
  };
  for (const session of legacySessions) {
    if (!session.scheduledDate) continue;
    addLesson({
      teacherId: session.teacherId, scheduledDate: session.scheduledDate, scheduledTime: session.scheduledTime,
      durationMinutes: session.durationMinutes, courseFormat: session.booking.courseFormat,
      commune: session.booking.commune, quartier: session.booking.quartier,
    });
  }
  for (const booking of legacyBookings) {
    if (!booking.teacherId || !booking.scheduledDate) continue;
    addLesson({
      teacherId: booking.teacherId, scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime || booking.preferredTime,
      durationMinutes: 120, courseFormat: booking.courseFormat,
      commune: booking.commune, quartier: booking.quartier,
    });
  }
  for (const request of marketplaceRequests) {
    if (!request.assignedTeacherId) continue;
    addLesson({
      teacherId: request.assignedTeacherId, scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime, durationMinutes: request.durationMinutes,
      courseFormat: request.courseFormat, commune: request.commune, quartier: request.quartier,
    });
  }
  const requestSlot = { ...input, courseFormat: input.courseFormat };
  for (const teacher of teachers) {
    const occupied = legacySessions.some((session) => session.teacherId === teacher.id && scheduleSlotsConflict(requestSlot, {
      scheduledDate: session.scheduledDate, scheduledTime: session.scheduledTime,
      durationMinutes: session.durationMinutes, courseFormat: session.booking.courseFormat,
      commune: session.booking.commune, quartier: session.booking.quartier,
    }, settings.scheduleBuffers)) || legacyBookings.some((booking) => booking.teacherId === teacher.id && scheduleSlotsConflict(requestSlot, {
      scheduledDate: booking.scheduledDate, scheduledTime: booking.scheduledTime || booking.preferredTime,
      durationMinutes: 120, courseFormat: booking.courseFormat, commune: booking.commune, quartier: booking.quartier,
    }, settings.scheduleBuffers)) || marketplaceRequests.some((request) => request.assignedTeacherId === teacher.id && scheduleSlotsConflict(requestSlot, request, settings.scheduleBuffers));
    if (occupied) continue;
    const sameCommune = Boolean(input.commune && normalized(input.commune) === normalized(teacher.commune));
    const sameQuartier = sameCommune && Boolean(input.quartier && normalized(input.quartier) === normalized(teacher.quartier));
    const transportOrigin = marketplaceTransportOrigin({
      teacherId: teacher.id, teacherCommune: teacher.commune, teacherQuartier: teacher.quartier,
      scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime,
      lessons: lessonsByTeacher.get(teacher.id) ?? [],
    });
    const transportFee = input.courseFormat === "ONLINE" ? 0 : calculateGrandAbidjanTransportFee({
      teacherCommune: transportOrigin.commune,
      teacherQuartier: transportOrigin.quartier,
      clientCommune: input.commune,
      clientQuartier: input.quartier,
      transportFeeAmounts: settings.transportFees,
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
      transportOriginLabel: input.courseFormat === "ONLINE" ? "Cours en ligne : aucun déplacement" : transportOrigin.label,
      totalClientPrice: courseAmount + transportFee,
      commissionAmount,
      score: rankMarketplaceTeacher({ sameQuartier, sameCommune, rating: teacher.rating, ratingCount: teacher.ratingCount, featured: teacher.featured }),
    });
  }
  };

  const scanPool = (poolWhere: Prisma.TeacherWhereInput) => scanPagedMarketplaceCandidates({
    loadPage: (skip, take) => db.teacher.findMany({
      where: poolWhere,
      select,
      skip,
      take,
      orderBy: [{ rating: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
    }),
    inspectPage: async (page) => {
      const eligible = page.filter((teacher) => (
        Boolean(teacher.photoUrl?.trim())
        && teacherAvailableInGrid(teacher.availability, input)
        && isTeacherQualifiedForPreciseLevel(
          input.journey, input.levelName, input.subjectId, teacher.preciseLevels,
        )
      ));
      await inspectBatch(eligible);
    },
    hasEnough: () => result.length >= targetCount,
  });

  let scannedLocalIds: string[] = [];
  if (input.commune && input.courseFormat === "HOME") {
    scannedLocalIds = await scanPool({ ...where, OR: [
      { commune: { equals: input.commune, mode: "insensitive" } },
      { zones: { some: { commune: { name: { equals: input.commune, mode: "insensitive" } } } } },
    ] });
  }
  if (result.length < targetCount) {
    await scanPool({ ...where, ...(scannedLocalIds.length ? { id: { notIn: scannedLocalIds } } : {}) });
  }
  return result.sort((a, b) => b.score - a.score || a.teacherId.localeCompare(b.teacherId)).slice(0, targetCount);
}
