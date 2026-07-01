import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const {
      fullName, professionalName, photoUrl, phone, email, commune, quartier, addressHint,
      jobTitle, bio, experienceYears, diploma, cvUrl, profileType, status, featured,
      rating, ratingCount,
      badgeVerified, badgeRecommended, badgeNew, badgePopular, badgePremium,
      internalNote,
      offersHome, offersOnline, offersGroup,
      pricePerHour, pricePerSession, pricePack4, pricePack8,
      commissionRate, pricingTier,
      availability,
      subjects, levels, zones,
    } = body;

    if (!fullName || !phone || !jobTitle || !bio) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const teacher = await db.teacher.create({
      data: {
        fullName,
        professionalName: professionalName || null,
        photoUrl: photoUrl || null,
        phone,
        email: email || null,
        commune: commune || null,
        quartier: quartier || null,
        addressHint: addressHint || null,
        jobTitle,
        bio,
        experienceYears: Number(experienceYears) || 0,
        diploma: diploma || null,
        cvUrl: cvUrl || null,
        profileType: profileType || "ENSEIGNANT",
        status: status || "ACTIVE",
        featured: !!featured,
        rating: Number(rating) || 0,
        ratingCount: Number(ratingCount) || 0,
        badgeVerified: badgeVerified ?? true,
        badgeRecommended: !!badgeRecommended,
        badgeNew: badgeNew ?? true,
        badgePopular: !!badgePopular,
        badgePremium: !!badgePremium,
        internalNote: internalNote || null,
        offersHome: offersHome ?? true,
        offersOnline: offersOnline ?? true,
        offersGroup: !!offersGroup,
        pricePerHour: Number(pricePerHour) || 10000,
        pricePerSession: Number(pricePerSession) || 10000,
        pricePack4: Number(pricePack4) || 38000,
        pricePack8: Number(pricePack8) || 72000,
        commissionRate: typeof commissionRate === "number" ? commissionRate : (Number(commissionRate) || 20),
        pricingTier: pricingTier || "STANDARD",
        availability: availability ? (typeof availability === "string" ? availability : JSON.stringify(availability)) : null,
      },
    });

    // Subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      await db.teacherSubject.createMany({
        data: subjects.map((s: any) => ({
          teacherId: teacher.id,
          subjectId: s.subjectId || s.id,
          isPrimary: !!s.isPrimary,
        })),
      });
    }
    // Levels
    if (Array.isArray(levels) && levels.length > 0) {
      await db.teacherLevel.createMany({
        data: levels.map((l: any) => ({
          teacherId: teacher.id,
          levelId: l.levelId || l.id,
        })),
      });
    }
    // Zones
    if (Array.isArray(zones) && zones.length > 0) {
      await db.teacherZone.createMany({
        data: zones.map((z: any) => ({
          teacherId: teacher.id,
          communeId: z.communeId || z.id,
        })),
      });
    }

    return NextResponse.json({ id: teacher.id, ok: true });
  } catch (e: any) {
    console.error("admin/teachers POST error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
