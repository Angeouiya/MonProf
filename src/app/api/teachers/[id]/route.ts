import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { filterLevelsForJourney, filterSubjectsForJourney, subjectNameMatchesJourney } from "@/lib/catalog-journey";
import {
  parseTeacherJourney,
  teacherJourneyWhere,
  type TeacherJourney,
} from "@/lib/teacher-journeys";
import { teacherCatalogEligibleJourneys } from "@/lib/teacher-journey-validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const requestedJourney = searchParams.get("journey");
  const journey = requestedJourney ? parseTeacherJourney(requestedJourney) : null;

  if (requestedJourney && !journey) {
    return NextResponse.json({ error: "Système d'enseignement invalide." }, { status: 400 });
  }

  const teacher = await db.teacher.findFirst({
    where: {
      id,
      status: "ACTIVE",
      ...(journey ? teacherJourneyWhere(journey) : {}),
      AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
    },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
      reviews: {
        where: { published: true },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { reviews: true, bookings: true } },
    },
  });

  if (!teacher || teacher.status !== "ACTIVE") {
    return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  }

  const eligibleJourneys = teacherCatalogEligibleJourneys({
    eligibility: teacher,
    subjects: teacher.subjects.map((s) => ({ name: s.subject.name, icon: s.subject.icon })),
    levels: teacher.levels.map((l) => ({ name: l.level.name, order: l.level.order })),
  });
  if (eligibleJourneys.length === 0 || (journey && !eligibleJourneys.includes(journey))) {
    return NextResponse.json({
      error: "Ce professeur n'enseigne pas dans ce système. Choisissez un autre profil compatible.",
    }, { status: 404 });
  }
  const activeJourney: TeacherJourney = journey ?? eligibleJourneys[0]!;
  const journeySubjects = filterSubjectsForJourney(
    teacher.subjects.map((s) => ({ name: s.subject.name, isPrimary: s.isPrimary })),
    activeJourney,
  );
  const journeyLevels = filterLevelsForJourney(
    teacher.levels.map((l) => ({ name: l.level.name, order: l.level.order })),
    activeJourney,
  );

  const displayRating = teacher.ratingCount > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : teacher.rating;

  return NextResponse.json({
    id: teacher.id,
    fullName: teacher.fullName,
    professionalName: teacher.professionalName,
    photoUrl: teacher.photoUrl,
    jobTitle: teacher.jobTitle,
    bio: teacher.bio,
    experienceYears: teacher.experienceYears,
    diploma: teacher.diploma,
    careerSummary: teacher.careerSummary,
    skills: teacher.skills,
    workHistory: teacher.workHistory,
    certifications: teacher.certifications,
    teachingAchievements: teacher.teachingAchievements,
    learnersCoached: teacher.learnersCoached,
    profileType: teacher.profileType,
    rating: teacher.rating,
    ratingCount: teacher.ratingCount,
    adminRating: teacher.adminRating,
    adminRatingPublic: teacher.adminRatingPublic,
    displayRating,
    displayRatingSource: teacher.ratingCount > 0 ? "CLIENT_REVIEWS" : teacher.adminRatingPublic && teacher.adminRating > 0 ? "SERVICE_CLIENT" : "NONE",
    reviewsCount: teacher._count.reviews,
    bookingsCount: teacher._count.bookings,
    badges: {
      verified: teacher.badgeVerified,
      recommended: teacher.badgeRecommended,
      new: teacher.badgeNew,
      popular: teacher.badgePopular,
      premium: teacher.badgePremium,
    },
    featured: teacher.featured,
    offersHome: teacher.offersHome,
    offersOnline: teacher.offersOnline,
    offersGroup: teacher.offersGroup,
    offersIvorianSystem: teacher.offersIvorianSystem,
    offersFrenchSystem: teacher.offersFrenchSystem,
    offersProfessionalTraining: teacher.offersProfessionalTraining,
    eligibleJourneys,
    activeJourney,
    commune: teacher.commune,
    pricingTier: teacher.pricingTier,
    pricePerHour: teacher.pricePerHour,
    pricePerSession: teacher.pricePerSession,
    pricePack4: teacher.pricePack4,
    pricePack8: teacher.pricePack8,
    primarySubject: teacher.subjects.find((s) => s.isPrimary && subjectNameMatchesJourney(s.subject.name, activeJourney))?.subject.name
      ?? journeySubjects[0]?.name,
    subjects: journeySubjects.map((s) => ({
      name: s.name,
      isPrimary: s.isPrimary,
    })),
    levels: journeyLevels.map((l) => l.name),
    zones: teacher.zones.map((z) => (z.commune as any).name),
    availability: teacher.availability ? JSON.parse(teacher.availability) : null,
    reviews: teacher.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      clientName: r.client.name,
    })),
  });
}
