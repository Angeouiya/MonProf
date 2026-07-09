import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildTeacherSearchClauses } from "@/lib/teacher-search";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const level = searchParams.get("level");
  const commune = searchParams.get("commune");
  const format = searchParams.get("format"); // HOME | ONLINE
  const search = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "recommended"; // recommended | rating | experience
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(24, Math.max(6, Number(searchParams.get("pageSize")) || 12));

  const where: any = {
    status: "ACTIVE",
    AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }, ...buildTeacherSearchClauses(search)],
  };

  if (subject) {
    where.subjects = { some: { subject: { slug: subject } } };
  }
  if (level) {
    where.levels = { some: { level: { slug: level } } };
  }
  if (commune) {
    where.zones = { some: { commune: { name: commune } } };
  }
  if (format === "HOME") where.offersHome = true;
  if (format === "ONLINE") where.offersOnline = true;

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

  const items = teachers.map((t) => ({
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
    commune: t.commune,
    featured: t.featured,
    badges: {
      verified: t.badgeVerified,
      recommended: t.badgeRecommended,
      new: t.badgeNew,
      popular: t.badgePopular,
      premium: t.badgePremium,
    },
    primarySubject: t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name,
    subjects: t.subjects.map((s) => s.subject.name),
    levels: t.levels.map((l) => l.level.name),
    zones: t.zones.map((z) => (z.commune as any).name),
    reviewsCount: t._count.reviews,
    bookingsCount: t._count.bookings,
  }));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
