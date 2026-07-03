import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await db.teacher.findFirst({
    where: { id, status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
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

  return NextResponse.json({
    id: teacher.id,
    fullName: teacher.fullName,
    professionalName: teacher.professionalName,
    photoUrl: teacher.photoUrl,
    jobTitle: teacher.jobTitle,
    bio: teacher.bio,
    experienceYears: teacher.experienceYears,
    diploma: teacher.diploma,
    profileType: teacher.profileType,
    rating: teacher.rating,
    ratingCount: teacher.ratingCount,
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
    commune: teacher.commune,
    pricingTier: teacher.pricingTier,
    pricePerHour: teacher.pricePerHour,
    pricePerSession: teacher.pricePerSession,
    pricePack4: teacher.pricePack4,
    pricePack8: teacher.pricePack8,
    primarySubject: teacher.subjects.find((s) => s.isPrimary)?.subject.name ?? teacher.subjects[0]?.subject.name,
    subjects: teacher.subjects.map((s) => ({
      name: s.subject.name,
      isPrimary: s.isPrimary,
    })),
    levels: teacher.levels.map((l) => l.level.name),
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
