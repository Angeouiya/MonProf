import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildTeacherSearchClauses } from "@/lib/teacher-search";
import { parseTeacherJourney, TEACHER_JOURNEY_CONFIG, teacherJourneyWhere } from "@/lib/teacher-journeys";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import {
  filterLevelsForJourney,
  filterSubjectsForJourney,
  subjectNameMatchesJourney,
  teacherJourneyCatalogClauses,
} from "@/lib/catalog-journey";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedSubject = searchParams.get("subject")?.trim() ?? "";
  const requestedLevel = searchParams.get("level")?.trim() ?? "";
  const requestedCommune = searchParams.get("commune")?.trim() ?? "";
  const requestedFormat = searchParams.get("format")?.trim() ?? "";
  const format = ["HOME", "ONLINE"].includes(requestedFormat) ? requestedFormat : "";
  const search = searchParams.get("q")?.trim();
  const journey = parseTeacherJourney(searchParams.get("journey")) ?? "ivoirien";
  const requestedSort = searchParams.get("sort")?.trim() ?? "recommended";
  const sort = ["recommended", "rating", "experience"].includes(requestedSort)
    ? requestedSort
    : "recommended";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(24, Math.max(6, Number(searchParams.get("pageSize")) || 12));

  let orderBy: any;
  switch (sort) {
    case "rating":
      orderBy = { rating: "desc" };
      break;
    case "experience":
      orderBy = { experienceYears: "desc" };
      break;
    case "recommended":
    default:
      orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }];
      break;
  }

  let total = 0;
  let teachers: any[] = [];

  try {
    const catalog = await getCachedTeacherSearchCatalog();
    const subjects = filterSubjectsForJourney(catalog.subjects, journey);
    const levels = filterLevelsForJourney(catalog.levels, journey);
    const subject = subjects.some((item) => item.slug === requestedSubject) ? requestedSubject : "";
    const level = levels.some((item) => item.slug === requestedLevel) ? requestedLevel : "";
    const commune = catalog.communes.some((item) => item.name === requestedCommune) ? requestedCommune : "";
    const where: any = {
      status: "ACTIVE",
      ...teacherJourneyWhere(journey),
      AND: [
        { photoUrl: { not: null } },
        { photoUrl: { not: "" } },
        ...teacherJourneyCatalogClauses(subjects, levels),
        ...buildTeacherSearchClauses(search),
      ],
    };
    if (subject) where.subjects = { some: { subject: { slug: subject } } };
    if (level) where.levels = { some: { level: { slug: level } } };
    if (commune) where.zones = { some: { commune: { name: commune } } };
    if (format === "HOME") where.offersHome = true;
    if (format === "ONLINE") where.offersOnline = true;

    total = await db.teacher.count({ where });
    teachers = total > 0
      ? await db.teacher.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            subjects: { include: { subject: true } },
            levels: { include: { level: true } },
            zones: { include: { commune: true } },
            _count: { select: { reviews: true, bookings: true } },
          },
        })
      : [];
  } catch (error) {
    console.error("[api:teachers_query_failed]", error);
  }

  const items = teachers.map((t) => {
    const journeySubjects = filterSubjectsForJourney(
      t.subjects.map((item) => ({ name: item.subject.name, icon: item.subject.icon })),
      journey,
    );
    const journeyLevels = filterLevelsForJourney(
      t.levels.map((item) => ({ name: item.level.name, order: item.level.order })),
      journey,
    );
    return {
      displayRating: t.ratingCount > 0
        ? t.rating
        : t.adminRatingPublic && t.adminRating > 0
          ? t.adminRating
          : t.rating,
    displayRatingSource: t.ratingCount > 0 ? "CLIENT_REVIEWS" : t.adminRatingPublic && t.adminRating > 0 ? "SERVICE_CLIENT" : "NONE",
    id: t.id,
    fullName: t.fullName,
    professionalName: t.professionalName,
    jobTitle: t.jobTitle,
    photoUrl: t.photoUrl,
    rating: t.rating,
    ratingCount: t.ratingCount,
    adminRating: t.adminRating,
    adminRatingPublic: t.adminRatingPublic,
    experienceYears: t.experienceYears,
    careerSummary: t.careerSummary,
    skills: t.skills,
    workHistory: t.workHistory,
    certifications: t.certifications,
    teachingAchievements: t.teachingAchievements,
    learnersCoached: t.learnersCoached,
    offersHome: t.offersHome,
    offersOnline: t.offersOnline,
    offersIvorianSystem: t.offersIvorianSystem,
    offersFrenchSystem: t.offersFrenchSystem,
    offersProfessionalTraining: t.offersProfessionalTraining,
    commune: t.commune,
    featured: t.featured,
    badges: {
      verified: t.badgeVerified,
      recommended: t.badgeRecommended,
      new: t.badgeNew,
      popular: t.badgePopular,
      premium: t.badgePremium,
    },
    primarySubject: t.subjects.find((s) => s.isPrimary && subjectNameMatchesJourney(s.subject.name, journey))?.subject.name
      ?? t.subjects.find((s) => subjectNameMatchesJourney(s.subject.name, journey))?.subject.name
      ?? TEACHER_JOURNEY_CONFIG[journey].primarySubjectFallback,
    subjects: journeySubjects.map((item) => item.name),
    levels: journeyLevels.map((item) => item.name),
    zones: t.zones.map((z) => (z.commune as any).name),
    reviewsCount: t._count.reviews,
    bookingsCount: t._count.bookings,
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
