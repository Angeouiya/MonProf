import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const teacher = await db.teacher.findUnique({
    where: { id },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { client: { select: { name: true, email: true, phone: true } } },
        take: 50,
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
      reviews: { include: { client: { select: { name: true } }, booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 30 },
      _count: { select: { bookings: true, reviews: true, transactions: true } },
    },
  });
  if (!teacher) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Stats agrégées
  const bookings = teacher.bookings;
  const stats = {
    total: bookings.length,
    realized: bookings.filter((b) => ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(b.status)).length,
    cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
    refunded: bookings.filter((b) => b.status === "REFUNDED").length,
    pending: bookings.filter((b) => ["PENDING_PAYMENT", "PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(b.status)).length,
    disputed: bookings.filter((b) => b.status === "DISPUTED").length,
    uniqueClients: new Set(bookings.map((b) => b.clientId)).size,
  };
  const finance = {
    totalGenerated: bookings.filter((b) => b.paymentStatus !== "FAILED").reduce((s, b) => s + b.totalPrice, 0),
    totalCommission: bookings.filter((b) => b.paymentStatus !== "FAILED").reduce((s, b) => s + b.commissionAmount, 0),
    totalNet: bookings.filter((b) => b.paymentStatus !== "FAILED").reduce((s, b) => s + b.teacherNetAmount, 0),
    blockedFunds: bookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.teacherNetAmount, 0),
    validatedFunds: bookings.filter((b) => b.paymentStatus === "VALIDATED").reduce((s, b) => s + b.teacherNetAmount, 0),
    toPay: bookings.filter((b) => b.paymentStatus === "TO_PAY_TEACHER").reduce((s, b) => s + b.teacherNetAmount, 0),
    alreadyPaid: bookings.filter((b) => b.paymentStatus === "TEACHER_PAID").reduce((s, b) => s + b.teacherNetAmount, 0),
  };

  return NextResponse.json({
    teacher: {
      ...teacher,
      availability: teacher.availability ? JSON.parse(teacher.availability) : null,
    },
    stats,
    finance,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const { subjects, levels, zones, availability, ...rest } = body;

  try {
    const data: any = {};
    const allowed = [
      "fullName","professionalName","photoUrl","phone","email","commune","quartier","addressHint",
      "jobTitle","bio","experienceYears","diploma","cvUrl","profileType","status","featured",
      "rating","ratingCount","badgeVerified","badgeRecommended","badgeNew","badgePopular","badgePremium",
      "internalNote","offersHome","offersOnline","offersGroup",
      "pricePerHour","pricePerSession","pricePack4","pricePack8","commissionRate","pricingTier",
    ];
    for (const k of allowed) {
      if (k in rest) data[k] = rest[k];
    }
    if ("experienceYears" in data) data.experienceYears = Number(data.experienceYears) || 0;
    if ("rating" in data) data.rating = Number(data.rating) || 0;
    if ("ratingCount" in data) data.ratingCount = Number(data.ratingCount) || 0;
    for (const k of ["pricePerHour","pricePerSession","pricePack4","pricePack8","commissionRate"]) {
      if (k in data) data[k] = Number(data[k]) || 0;
    }
    if (availability !== undefined) {
      data.availability = availability ? (typeof availability === "string" ? availability : JSON.stringify(availability)) : null;
    }

    await db.teacher.update({ where: { id }, data });

    // Sync relations
    if (Array.isArray(subjects)) {
      await db.teacherSubject.deleteMany({ where: { teacherId: id } });
      if (subjects.length > 0) {
        await db.teacherSubject.createMany({
          data: subjects.map((s: any) => ({
            teacherId: id,
            subjectId: s.subjectId || s.id,
            isPrimary: !!s.isPrimary,
          })),
        });
      }
    }
    if (Array.isArray(levels)) {
      await db.teacherLevel.deleteMany({ where: { teacherId: id } });
      if (levels.length > 0) {
        await db.teacherLevel.createMany({
          data: levels.map((l: any) => ({ teacherId: id, levelId: l.levelId || l.id })),
        });
      }
    }
    if (Array.isArray(zones)) {
      await db.teacherZone.deleteMany({ where: { teacherId: id } });
      if (zones.length > 0) {
        await db.teacherZone.createMany({
          data: zones.map((z: any) => ({ teacherId: id, communeId: z.communeId || z.id })),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin/teachers PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  // Suspendre au lieu de supprimer
  await db.teacher.update({ where: { id }, data: { status: "SUSPENDED" } });
  return NextResponse.json({ ok: true });
}
