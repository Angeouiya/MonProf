import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const level = searchParams.get("level");
  const commune = searchParams.get("commune");
  const format = searchParams.get("format"); // HOME | ONLINE
  const search = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "recommended"; // recommended | rating | price-asc | price-desc | experience
  const minPrice = Number(searchParams.get("minPrice")) || undefined;
  const maxPrice = Number(searchParams.get("maxPrice")) || undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(24, Math.max(6, Number(searchParams.get("pageSize")) || 12));

  const where: any = {
    status: "ACTIVE",
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { professionalName: { contains: search } },
      { jobTitle: { contains: search } },
      { bio: { contains: search } },
    ];
  }
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
  if (minPrice || maxPrice) {
    where.pricePerSession = {};
    if (minPrice) where.pricePerSession.gte = minPrice;
    if (maxPrice) where.pricePerSession.lte = maxPrice;
  }

  let orderBy: any;
  switch (sort) {
    case "rating":
      orderBy = { rating: "desc" };
      break;
    case "price-asc":
      orderBy = { pricePerSession: "asc" };
      break;
    case "price-desc":
      orderBy = { pricePerSession: "desc" };
      break;
    case "experience":
      orderBy = { experienceYears: "desc" };
      break;
    case "recommended":
    default:
      orderBy = [{ featured: "desc" }, { rating: "desc" }, { ratingCount: "desc" }];
      break;
  }

  const [total, teachers] = await Promise.all([
    db.teacher.count({ where }),
    db.teacher.findMany({
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
    }),
  ]);

  const items = teachers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    professionalName: t.professionalName,
    jobTitle: t.jobTitle,
    photoUrl: t.photoUrl,
    rating: t.rating,
    ratingCount: t.ratingCount,
    experienceYears: t.experienceYears,
    pricePerSession: t.pricePerSession,
    pricePack4: t.pricePack4,
    pricePack8: t.pricePack8,
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
    zones: t.zones.map((z) => z.commune.name),
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
