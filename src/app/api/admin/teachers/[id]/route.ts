import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminApi } from "@/lib/admin-api";
import { validateTeacherPhotoUrlForStorage } from "@/lib/server/teacher-photo";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { normalizeTeacherProfileText } from "@/lib/teacher-profile";
import { normalizeTeacherPhone } from "@/lib/teacher-portal";
import { isActivePaymentMethod } from "@/lib/payment-methods";

const ACTIVE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const RESTRICTIVE_TEACHER_STATUSES = ["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "INACTIVE"] as const;
const PUBLIC_VISIBLE_TEACHER_STATUSES = ["ACTIVE"] as const;

function isRestrictiveTeacherStatus(status: string) {
  return RESTRICTIVE_TEACHER_STATUSES.includes(status as (typeof RESTRICTIVE_TEACHER_STATUSES)[number]);
}

function isPublicVisibleTeacherStatus(status: string) {
  return PUBLIC_VISIBLE_TEACHER_STATUSES.includes(status as (typeof PUBLIC_VISIBLE_TEACHER_STATUSES)[number]);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    SUSPENDED: "Suspendu",
    PENDING: "En attente",
    TEMPORARILY_SUSPENDED: "Suspendu temporairement",
    PERMANENTLY_SUSPENDED: "Suspendu définitivement",
    OBSERVATION: "En observation",
    REPLACEABLE: "Remplaçable",
    PRIORITY: "Prioritaire",
    BLACKLISTED: "Blacklisté",
  };
  return labels[status] ?? status;
}

function validateTeacherRelationPatch(subjects: unknown, levels: unknown) {
  if (subjects !== undefined) {
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return "Sélectionnez au moins une matière pour ce professeur.";
    }
    if (!subjects.some((subject: any) => Boolean(subject?.isPrimary))) {
      return "Définissez une matière principale pour ce professeur.";
    }
  }
  if (levels !== undefined && (!Array.isArray(levels) || levels.length === 0)) {
    return "Sélectionnez au moins un niveau enseigné par ce professeur.";
  }
  return null;
}

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
        include: {
          client: { select: { name: true, email: true, phone: true } },
          transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
        },
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
    totalGenerated: bookings.filter(hasVerifiedPayDunyaClientPayment).reduce((s, b) => s + b.totalPrice, 0),
    totalCommission: bookings.filter(hasVerifiedPayDunyaClientPayment).reduce((s, b) => s + b.commissionAmount, 0),
    totalNet: bookings.filter(hasVerifiedPayDunyaClientPayment).reduce((s, b) => s + b.teacherNetAmount, 0),
    blockedFunds: bookings.filter((b) => b.paymentStatus === "BLOCKED" && hasVerifiedPayDunyaClientPayment(b)).reduce((s, b) => s + b.teacherNetAmount, 0),
    validatedFunds: bookings.filter((b) => b.paymentStatus === "VALIDATED" && hasVerifiedPayDunyaClientPayment(b)).reduce((s, b) => s + b.teacherNetAmount, 0),
    toPay: bookings.filter((b) => b.paymentStatus === "TO_PAY_TEACHER" && hasVerifiedPayDunyaClientPayment(b)).reduce((s, b) => s + b.teacherNetAmount, 0),
    alreadyPaid: bookings.filter((b) => b.paymentStatus === "TEACHER_PAID" && hasVerifiedPayDunyaClientPayment(b)).reduce((s, b) => s + b.teacherNetAmount, 0),
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
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const {
    subjects,
    levels,
    zones,
    availability,
    statusChangeReason,
    notifyTeacherOnStatusChange,
    portalPassword,
    ...rest
  } = body;

  try {
    const relationError = validateTeacherRelationPatch(subjects, levels);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }

    const existingTeacher = await db.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        professionalName: true,
        photoUrl: true,
        phone: true,
        portalAccessEnabled: true,
        portalPhone: true,
        status: true,
        qualityScore: true,
        adminRating: true,
        adminRatingNote: true,
        adminRatingPublic: true,
        portalPasswordHash: true,
        bookings: {
          where: { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
          select: { id: true, reference: true, subjectName: true, levelName: true, scheduledDate: true, scheduledTime: true },
          take: 50,
        },
      },
    });
    if (!existingTeacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });

    const data: any = {};
    const allowed = [
      "fullName","professionalName","photoUrl","phone","email","commune","quartier","addressHint",
      "portalAccessEnabled","portalPhone","defaultPayoutMethod","defaultPayoutPhone","payoutInstructions",
      "jobTitle","bio","experienceYears","diploma","cvUrl","careerSummary","skills","workHistory","certifications","teachingAchievements","learnersCoached","profileType","status","featured","qualityScore","operationalComment",
      "adminRating","adminRatingNote","adminRatingPublic",
      "badgeVerified","badgeRecommended","badgeNew","badgePopular","badgePremium",
      "internalNote","offersHome","offersOnline","offersGroup",
      "pricePerHour","pricePerSession","pricePack4","pricePack8","commissionRate","pricingTier",
    ];
    for (const k of allowed) {
      if (k in rest) data[k] = rest[k];
    }
    if ("experienceYears" in data) data.experienceYears = Number(data.experienceYears) || 0;
    if ("learnersCoached" in data) data.learnersCoached = Math.max(0, Number(data.learnersCoached) || 0);
    for (const k of ["careerSummary","skills","workHistory","certifications","teachingAchievements"]) {
      if (k in data) data[k] = normalizeTeacherProfileText(data[k]);
    }
    if ("qualityScore" in data) data.qualityScore = Math.max(0, Math.min(100, Number(data.qualityScore) || 0));
    if ("adminRating" in data) {
      data.adminRating = Math.max(0, Math.min(5, Number(data.adminRating) || 0));
      data.adminRatingUpdatedAt = new Date();
      data.adminRatingUpdatedById = admin.id;
    }
    if ("adminRatingNote" in data) {
      data.adminRatingNote = typeof data.adminRatingNote === "string" && data.adminRatingNote.trim()
        ? data.adminRatingNote.trim().slice(0, 500)
        : null;
      data.adminRatingUpdatedAt = new Date();
      data.adminRatingUpdatedById = admin.id;
    }
    if ("adminRatingPublic" in data) {
      data.adminRatingPublic = Boolean(data.adminRatingPublic);
    }
    if ("defaultPayoutPhone" in data) {
      const rawPhone = typeof data.defaultPayoutPhone === "string" ? data.defaultPayoutPhone.replace(/[^\d+]/g, "").trim() : "";
      data.defaultPayoutPhone = rawPhone || null;
    }
    if ("defaultPayoutMethod" in data && data.defaultPayoutMethod !== null && !isActivePaymentMethod(data.defaultPayoutMethod)) {
      return NextResponse.json({ error: "Moyen de paiement professeur invalide." }, { status: 400 });
    }
    if ("payoutInstructions" in data) {
      data.payoutInstructions = typeof data.payoutInstructions === "string" && data.payoutInstructions.trim()
        ? data.payoutInstructions.trim().slice(0, 500)
        : null;
    }
    for (const k of ["pricePerHour","pricePerSession","pricePack4","pricePack8","commissionRate"]) {
      if (k in data) data[k] = Number(data[k]) || 0;
    }
    if ("portalPhone" in data || "portalAccessEnabled" in data || "phone" in data) {
      const normalizedPortalPhone = normalizeTeacherPhone(data.portalPhone || data.phone || existingTeacher.phone);
      data.portalPhone = data.portalAccessEnabled === false ? null : normalizedPortalPhone;
    }
    if ("portalAccessEnabled" in data) {
      data.portalAccessEnabled = Boolean(data.portalAccessEnabled);
      if (data.portalAccessEnabled && !data.portalPhone) {
        return NextResponse.json({ error: "Téléphone de connexion professeur requis." }, { status: 400 });
      }
      if (data.portalAccessEnabled && !existingTeacher.portalPasswordHash && (typeof portalPassword !== "string" || portalPassword.trim().length < 6)) {
        return NextResponse.json({ error: "Définissez un mot de passe professeur de 6 caractères minimum avant d'activer l'accès." }, { status: 400 });
      }
    }
    if (typeof portalPassword === "string" && portalPassword.trim()) {
      if (portalPassword.trim().length < 6) {
        return NextResponse.json({ error: "Le mot de passe professeur doit contenir au moins 6 caractères." }, { status: 400 });
      }
      data.portalPasswordHash = await bcrypt.hash(portalPassword.trim(), 10);
      if (!("portalAccessEnabled" in data)) data.portalAccessEnabled = true;
      if (!data.portalPhone) data.portalPhone = normalizeTeacherPhone(data.phone || existingTeacher.phone);
    }
    const nextPortalEnabled = "portalAccessEnabled" in data
      ? Boolean(data.portalAccessEnabled)
      : existingTeacher.portalAccessEnabled;
    const nextPortalPhone = typeof data.portalPhone === "string" && data.portalPhone
      ? data.portalPhone
      : existingTeacher.portalPhone;
    if (nextPortalEnabled && nextPortalPhone) {
      const duplicatePortalPhone = await db.teacher.findFirst({
        where: {
          portalPhone: nextPortalPhone,
          id: { not: id },
        },
        select: { fullName: true, professionalName: true },
      });
      if (duplicatePortalPhone) {
        return NextResponse.json({
          error: `Ce numéro de connexion est déjà attribué à ${duplicatePortalPhone.professionalName || duplicatePortalPhone.fullName}.`,
        }, { status: 409 });
      }
    }
    if (availability !== undefined) {
      data.availability = availability ? (typeof availability === "string" ? availability : JSON.stringify(availability)) : null;
    }

    const nextStatus = String(data.status ?? existingTeacher.status);
    const statusChanged = "status" in data && nextStatus !== existingTeacher.status;
    const effectivePhotoUrl = "photoUrl" in data ? data.photoUrl : existingTeacher.photoUrl;
    if (isPublicVisibleTeacherStatus(nextStatus)) {
      const effectivePhotoValidation = await validateTeacherPhotoUrlForStorage(effectivePhotoUrl);
      if (!effectivePhotoValidation.ok) {
        return NextResponse.json({
          error: `Impossible d'activer ce professeur sans vraie photo validée. ${effectivePhotoValidation.error}`,
        }, { status: 400 });
      }
      data.photoUrl = effectivePhotoValidation.photoUrl;
    } else if ("photoUrl" in data) {
      const rawPhotoUrl = typeof data.photoUrl === "string" ? data.photoUrl.trim() : "";
      if (rawPhotoUrl) {
        const photoValidation = await validateTeacherPhotoUrlForStorage(rawPhotoUrl);
        if (!photoValidation.ok) {
          return NextResponse.json({ error: photoValidation.error }, { status: 400 });
        }
        data.photoUrl = photoValidation.photoUrl;
      } else {
        data.photoUrl = null;
      }
    }
    if (statusChanged) data.lastActivityAt = new Date();

    await db.teacher.update({ where: { id }, data });

    const qualityTouched = [
      "qualityScore",
      "adminRating",
      "adminRatingNote",
      "adminRatingPublic",
    ].some((key) => key in data);
    if (qualityTouched) {
      const teacherName = existingTeacher.professionalName || existingTeacher.fullName;
      const nextRating = "adminRating" in data ? data.adminRating : existingTeacher.adminRating;
      const nextScore = "qualityScore" in data ? data.qualityScore : existingTeacher.qualityScore;
      await db.$transaction([
        db.adminActionLog.create({
          data: {
            adminId: admin.id,
            action: "Évaluation qualité professeur modifiée",
            entityType: "Teacher",
            entityId: id,
            detail: `${admin.name} a mis à jour l'évaluation de ${teacherName}. Note plateforme : ${Number(nextRating || 0).toFixed(1)}/5. Score qualité : ${nextScore}/100.`,
            oldStatus: `rating=${Number(existingTeacher.adminRating || 0).toFixed(1)};score=${existingTeacher.qualityScore}`,
            newStatus: `rating=${Number(nextRating || 0).toFixed(1)};score=${nextScore}`,
          },
        }),
        db.teacherNotification.create({
          data: {
            teacherId: id,
            title: "Évaluation qualité mise à jour",
            message: `Bonjour ${teacherName}, votre suivi qualité Compétence a été mis à jour. Note plateforme : ${Number(nextRating || 0).toFixed(1)}/5. Score qualité : ${nextScore}/100.`,
            channel: "INTERNAL",
            sent: true,
            status: "SENT",
            sentById: admin.id,
          },
        }),
      ]);
    }

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

    if (statusChanged) {
      const teacherName = existingTeacher.professionalName || existingTeacher.fullName;
      const reason = typeof statusChangeReason === "string" && statusChangeReason.trim()
        ? statusChangeReason.trim()
        : "Changement de statut effectué par le service client.";
      const detail = `${admin.name} a changé le statut de ${teacherName} : ${statusLabel(existingTeacher.status)} → ${statusLabel(nextStatus)}. Motif : ${reason}`;
      const restrictive = isRestrictiveTeacherStatus(nextStatus);
      const taskCreates = restrictive
        ? existingTeacher.bookings.map((booking) => ({
            teacherId: id,
            bookingId: booking.id,
            type: "ADMIN_ACTION" as const,
            title: `Vérifier/remplacer ${teacherName} sur ${booking.reference}`,
            description: `Le professeur est maintenant "${statusLabel(nextStatus)}". Vérifiez la réservation ${booking.reference} (${booking.subjectName} - ${booking.levelName}) et préparez un remplacement si nécessaire. Motif : ${reason}`,
            priority: "CRITICAL" as const,
            status: "TODO" as const,
            createdById: admin.id,
          }))
        : [];

      await db.$transaction([
        db.adminActionLog.create({
          data: {
            adminId: admin.id,
            action: "Statut professeur modifié",
            entityType: "Teacher",
            entityId: id,
            detail,
            oldStatus: existingTeacher.status,
            newStatus: nextStatus,
          },
        }),
        db.notification.create({
          data: {
            userId: null,
            title: restrictive ? "Professeur à vérifier/remplacer" : "Statut professeur modifié",
            message: restrictive
              ? `${teacherName} est maintenant ${statusLabel(nextStatus)}. ${existingTeacher.bookings.length} réservation(s) active(s) à vérifier.`
              : detail,
            type: restrictive ? "TEACHER_STATUS_RESTRICTED" : "TEACHER_STATUS_CHANGED",
            recipientType: "ADMIN",
            priority: restrictive ? "CRITICAL" : nextStatus === "OBSERVATION" ? "IMPORTANT" : "NORMAL",
            status: "CREATED",
            teacherId: id,
            adminId: admin.id,
            link: `/admin/professeurs/${id}?tab=operationnel`,
            actionLabel: restrictive ? "Vérifier le professeur" : "Voir la fiche",
            actionType: restrictive ? "CHECK_TEACHER_BOOKINGS" : "VIEW_TEACHER",
          },
        }),
        ...(notifyTeacherOnStatusChange !== false ? [
          db.teacherNotification.create({
            data: {
              teacherId: id,
              title: "Mise à jour de votre statut",
              message: `Bonjour ${teacherName}, votre statut opérationnel est maintenant : ${statusLabel(nextStatus)}. Motif : ${reason}. Merci de contacter le service client si nécessaire.`,
              channel: "INTERNAL",
              sent: true,
              status: "SENT",
              sentById: admin.id,
            },
          }),
        ] : []),
        ...taskCreates.map((task) => db.teacherTask.create({ data: task })),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin/teachers PATCH error", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ce téléphone de connexion professeur est déjà utilisé." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const teacher = await db.teacher.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      status: true,
      bookings: {
        where: { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
        select: { id: true, reference: true, subjectName: true, levelName: true },
        take: 50,
      },
    },
  });
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  const teacherName = teacher.professionalName || teacher.fullName;
  const nextStatus = "SUSPENDED";
  await db.$transaction([
    db.teacher.update({ where: { id }, data: { status: nextStatus, lastActivityAt: new Date() } }),
    db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Professeur suspendu",
        entityType: "Teacher",
        entityId: id,
        detail: `${admin.name} a suspendu ${teacherName}. Suspension via endpoint de désactivation.`,
        oldStatus: teacher.status,
        newStatus: nextStatus,
      },
    }),
    db.notification.create({
      data: {
        userId: null,
        title: "Professeur suspendu",
        message: `${teacherName} est suspendu. ${teacher.bookings.length} réservation(s) active(s) à vérifier.`,
        type: "TEACHER_STATUS_RESTRICTED",
        recipientType: "ADMIN",
        priority: "CRITICAL",
        status: "CREATED",
        teacherId: id,
        adminId: admin.id,
        link: `/admin/professeurs/${id}?tab=operationnel`,
        actionLabel: "Vérifier les réservations",
      },
    }),
    db.teacherNotification.create({
      data: {
        teacherId: id,
        title: "Suspension de votre profil",
        message: `Bonjour ${teacherName}, votre profil professeur est suspendu. Merci de contacter le service client si nécessaire.`,
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    }),
    ...teacher.bookings.map((booking) => db.teacherTask.create({
      data: {
        teacherId: id,
        bookingId: booking.id,
        type: "ADMIN_ACTION",
        title: `Vérifier/remplacer ${teacherName} sur ${booking.reference}`,
        description: `Le professeur est suspendu. Vérifiez la réservation ${booking.reference} (${booking.subjectName} - ${booking.levelName}) et préparez un remplacement si nécessaire.`,
        priority: "CRITICAL",
        status: "TODO",
        createdById: admin.id,
      },
    })),
  ]);
  return NextResponse.json({ ok: true });
}
