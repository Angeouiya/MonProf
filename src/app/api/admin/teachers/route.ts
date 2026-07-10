import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { validateTeacherPhotoUrlForStorage } from "@/lib/server/teacher-photo";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/pricing";
import { normalizeTeacherProfileText } from "@/lib/teacher-profile";
import { normalizeTeacherPhone } from "@/lib/teacher-portal";
import { countAvailabilitySlots, normalizeAvailability } from "@/lib/scheduling";

function validateTeacherRelations(subjects: unknown, levels: unknown) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return "Sélectionnez au moins une matière pour ce professeur.";
  }
  if (!subjects.some((subject: any) => Boolean(subject?.isPrimary))) {
    return "Définissez une matière principale pour ce professeur.";
  }
  if (!Array.isArray(levels) || levels.length === 0) {
    return "Sélectionnez au moins un niveau enseigné par ce professeur.";
  }
  return null;
}

const PUBLIC_VISIBLE_TEACHER_STATUSES = ["ACTIVE"] as const;

function isPublicVisibleTeacherStatus(status: string) {
  return PUBLIC_VISIBLE_TEACHER_STATUSES.includes(status as (typeof PUBLIC_VISIBLE_TEACHER_STATUSES)[number]);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("TEACHERS_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const {
      fullName, professionalName, photoUrl, phone, email, commune, quartier, addressHint,
      portalAccessEnabled, portalPhone, portalPassword,
      jobTitle, bio, experienceYears, diploma, cvUrl, careerSummary, skills, workHistory,
      certifications, teachingAchievements, learnersCoached, profileType, status, featured,
      badgeVerified, badgeRecommended, badgeNew, badgePopular, badgePremium,
      internalNote, adminRating, adminRatingNote, adminRatingPublic,
      offersHome, offersOnline, offersGroup,
      pricePerHour, pricePerSession, pricePack4, pricePack8,
      commissionRate, pricingTier,
      availability,
      subjects, levels, zones,
    } = body;

    if (!fullName || !phone || !jobTitle || !bio) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }
    const enablePortal = Boolean(portalAccessEnabled);
    const normalizedPortalPhone = normalizeTeacherPhone(portalPhone || phone);
    if (enablePortal) {
      if (!normalizedPortalPhone) {
        return NextResponse.json({ error: "Téléphone de connexion professeur requis." }, { status: 400 });
      }
      if (typeof portalPassword !== "string" || portalPassword.trim().length < 6) {
        return NextResponse.json({ error: "Mot de passe professeur requis (6 caractères minimum)." }, { status: 400 });
      }
      const existingPortalPhone = await db.teacher.findFirst({
        where: { portalPhone: normalizedPortalPhone },
        select: { fullName: true, professionalName: true },
      });
      if (existingPortalPhone) {
        return NextResponse.json({
          error: `Ce numéro de connexion est déjà attribué à ${existingPortalPhone.professionalName || existingPortalPhone.fullName}.`,
        }, { status: 409 });
      }
    }
    const nextStatus = status || "ACTIVE";
    const rawPhotoUrl = typeof photoUrl === "string" ? photoUrl.trim() : "";
    let storedPhotoUrl: string | null = null;
    if (isPublicVisibleTeacherStatus(nextStatus) || rawPhotoUrl) {
      const photoValidation = await validateTeacherPhotoUrlForStorage(rawPhotoUrl);
      if (!photoValidation.ok) {
        return NextResponse.json({
          error: isPublicVisibleTeacherStatus(nextStatus)
            ? `Impossible de créer un professeur actif sans vraie photo validée. ${photoValidation.error}`
            : photoValidation.error,
        }, { status: 400 });
      }
      storedPhotoUrl = photoValidation.photoUrl;
    }
    const relationError = validateTeacherRelations(subjects, levels);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    const normalizedAvailability = normalizeAvailability(availability);
    if (isPublicVisibleTeacherStatus(nextStatus) && countAvailabilitySlots(normalizedAvailability) === 0) {
      return NextResponse.json({
        error: "Un professeur actif doit avoir au moins une plage horaire de 2h disponible.",
      }, { status: 400 });
    }

    const teacher = await db.teacher.create({
      data: {
        fullName,
        professionalName: professionalName || null,
        photoUrl: storedPhotoUrl,
        phone,
        email: email || null,
        commune: commune || null,
        quartier: quartier || null,
        addressHint: addressHint || null,
        portalAccessEnabled: enablePortal,
        portalPhone: enablePortal ? normalizedPortalPhone : null,
        portalPasswordHash: enablePortal ? await bcrypt.hash(portalPassword.trim(), 10) : null,
        jobTitle,
        bio,
        experienceYears: Number(experienceYears) || 0,
        diploma: diploma || null,
        cvUrl: cvUrl || null,
        careerSummary: normalizeTeacherProfileText(careerSummary),
        skills: normalizeTeacherProfileText(skills),
        workHistory: normalizeTeacherProfileText(workHistory),
        certifications: normalizeTeacherProfileText(certifications),
        teachingAchievements: normalizeTeacherProfileText(teachingAchievements),
        learnersCoached: Math.max(0, Number(learnersCoached) || 0),
        profileType: profileType || "ENSEIGNANT",
        status: nextStatus,
        featured: !!featured,
        rating: 0,
        ratingCount: 0,
        adminRating: Math.max(0, Math.min(5, Number(adminRating) || 0)),
        adminRatingNote: typeof adminRatingNote === "string" && adminRatingNote.trim()
          ? adminRatingNote.trim().slice(0, 500)
          : null,
        adminRatingPublic: adminRatingPublic ?? true,
        adminRatingUpdatedAt: Number(adminRating) > 0 || adminRatingNote ? new Date() : null,
        adminRatingUpdatedById: Number(adminRating) > 0 || adminRatingNote ? admin.id : null,
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
        commissionRate: typeof commissionRate === "number" ? commissionRate : (Number(commissionRate) || PLATFORM_COMMISSION_PERCENT),
        pricingTier: pricingTier || "STANDARD",
        availability: availability ? JSON.stringify(normalizedAvailability) : null,
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
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ce téléphone de connexion professeur est déjà utilisé." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
