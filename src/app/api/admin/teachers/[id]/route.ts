import { after, NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { validateTeacherPhotoUrlForStorage } from "@/lib/server/teacher-photo";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { getTeacherFinancialSettlement, isTeacherPayableStatus } from "@/lib/teacher-payments";
import { normalizeTeacherProfileText } from "@/lib/teacher-profile";
import { normalizeTeacherPhone } from "@/lib/teacher-portal";
import { isActivePaymentMethod } from "@/lib/payment-methods";
import { countAvailabilitySlots, normalizeAvailability, parseAvailability } from "@/lib/scheduling";
import { isPasswordCompliant, PASSWORD_MIN_LENGTH, passwordHashRounds } from "@/lib/password-policy";
import {
  enqueuePasswordChangedEmailInTransaction,
  flushPasswordEmailOutbox,
} from "@/lib/password-email-outbox";
import { absoluteAppUrl } from "@/lib/public-url";
import { requiresTeacherHomeCommune } from "@/lib/teacher-home-delivery";
import {
  TEMPORARY_PASSWORD_TTL_HOURS,
  temporaryPasswordExpiresAt,
} from "@/lib/temporary-password-policy";
import {
  CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS,
  IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH,
  IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH,
  isClientIdentityVerificationMethod,
  isSafeIdentityVerificationReference,
  normalizeIdentityVerificationReference,
} from "@/lib/client-identity-verification";
import {
  TEACHER_JOURNEY_CONFIG,
  TEACHER_JOURNEYS,
  hasTeacherJourney,
  resolveTeacherJourney,
  teacherSupportsJourney,
} from "@/lib/teacher-journeys";
import { TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE } from "@/lib/teacher-password-assistance";
import {
  teacherJourneyCatalogIssueMessage,
  teacherJourneyCatalogIssues,
} from "@/lib/teacher-journey-validation";

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

function relationIds(items: unknown, primaryKey: "subjectId" | "levelId") {
  if (!Array.isArray(items)) return [];
  return Array.from(new Set(
    items
      .map((item: any) => item?.[primaryKey] || item?.id)
      .filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim())),
  ));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("TEACHERS_VIEW"))) {
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
  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const finance = {
    totalGenerated: verifiedBookings.reduce((s, b) => s + b.totalPrice, 0),
    totalCommission: verifiedBookings.reduce((s, b) => s + b.commissionAmount, 0),
    totalNet: verifiedBookings.reduce((s, b) => s + getTeacherFinancialSettlement(b).payableAmount, 0),
    blockedFunds: verifiedBookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.teacherNetAmount, 0),
    validatedFunds: verifiedBookings.filter((b) => b.paymentStatus === "VALIDATED").reduce((s, b) => s + b.teacherNetAmount, 0),
    toPay: verifiedBookings.filter(isTeacherPayableStatus).reduce((s, b) => s + getTeacherFinancialSettlement(b).remaining, 0),
    alreadyPaid: verifiedBookings.reduce((s, b) => s + getTeacherFinancialSettlement(b).paid, 0),
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
  const admin = await requireAdminApi("TEACHERS_MANAGE");
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
    identityVerified,
    verificationMethod,
    verificationReference,
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
        email: true,
        photoUrl: true,
        phone: true,
        portalAccessEnabled: true,
        portalPhone: true,
        commune: true,
        offersHome: true,
        offersIvorianSystem: true,
        offersFrenchSystem: true,
        offersProfessionalTraining: true,
        subjects: {
          select: {
            subject: { select: { id: true, name: true, icon: true } },
          },
        },
        levels: {
          select: {
            level: { select: { id: true, name: true, order: true } },
          },
        },
        availability: true,
        status: true,
        qualityScore: true,
        adminRating: true,
        adminRatingNote: true,
        adminRatingPublic: true,
        portalPasswordHash: true,
        bookings: {
          where: { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
            courseCategory: true,
            schoolSystem: true,
            scheduledDate: true,
            scheduledTime: true,
          },
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
      "offersIvorianSystem","offersFrenchSystem","offersProfessionalTraining",
      "pricePerHour","pricePerSession","pricePack4","pricePack8","commissionRate","pricingTier",
    ];
    for (const k of allowed) {
      if (k in rest) data[k] = rest[k];
    }
    if ("commune" in data) {
      data.commune = typeof data.commune === "string" && data.commune.trim()
        ? data.commune.trim()
        : null;
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
      if (k in data) data[k] = Math.max(0, Math.round(Number(data[k]) || 0));
    }
    if ("commissionRate" in data) data.commissionRate = Math.max(0, Math.min(60, Math.round(data.commissionRate)));
    for (const key of ["offersIvorianSystem", "offersFrenchSystem", "offersProfessionalTraining"]) {
      if (key in data) data[key] = Boolean(data[key]);
    }
    const journeyEligibility = {
      offersIvorianSystem: "offersIvorianSystem" in data ? data.offersIvorianSystem : existingTeacher.offersIvorianSystem,
      offersFrenchSystem: "offersFrenchSystem" in data ? data.offersFrenchSystem : existingTeacher.offersFrenchSystem,
      offersProfessionalTraining: "offersProfessionalTraining" in data ? data.offersProfessionalTraining : existingTeacher.offersProfessionalTraining,
    };
    if (!hasTeacherJourney(journeyEligibility)) {
      return NextResponse.json({ error: "Activez au moins une mini-application pour ce professeur." }, { status: 400 });
    }
    const disabledJourneys = TEACHER_JOURNEYS.filter((journey) => (
      teacherSupportsJourney(existingTeacher, journey) && !teacherSupportsJourney(journeyEligibility, journey)
    ));
    if (disabledJourneys.length > 0) {
      const blockedBookings = existingTeacher.bookings.filter((booking) => {
        const bookingJourney = resolveTeacherJourney({
          courseCategory: booking.courseCategory,
          schoolSystem: booking.schoolSystem,
        });
        return Boolean(bookingJourney && disabledJourneys.includes(bookingJourney));
      });
      if (blockedBookings.length > 0) {
        const journeyLabels = disabledJourneys.map((journey) => TEACHER_JOURNEY_CONFIG[journey].label).join(", ");
        const bookingRefs = blockedBookings.map((booking) => booking.reference).join(", ");
        return NextResponse.json({
          error: `Impossible de verrouiller ${journeyLabels} : ${blockedBookings.length} réservation(s) active(s) utilisent encore ce système (${bookingRefs}). Terminez ou remplacez ces missions avant de retirer l'autorisation.`,
        }, { status: 409 });
      }
    }
    const nextSubjectIds = Array.isArray(subjects)
      ? relationIds(subjects, "subjectId")
      : existingTeacher.subjects.map((item) => item.subject.id);
    const nextLevelIds = Array.isArray(levels)
      ? relationIds(levels, "levelId")
      : existingTeacher.levels.map((item) => item.level.id);
    const [journeySubjects, journeyLevels] = await db.$transaction([
      db.subject.findMany({
        where: { id: { in: nextSubjectIds } },
        select: { id: true, name: true, icon: true },
      }),
      db.level.findMany({
        where: { id: { in: nextLevelIds } },
        select: { id: true, name: true, order: true },
      }),
    ]);
    if (journeySubjects.length !== nextSubjectIds.length || journeyLevels.length !== nextLevelIds.length) {
      return NextResponse.json({ error: "Certaines matières ou certains niveaux sélectionnés sont introuvables." }, { status: 400 });
    }
    const journeyCatalogError = teacherJourneyCatalogIssueMessage(teacherJourneyCatalogIssues({
      eligibility: journeyEligibility,
      subjects: journeySubjects,
      levels: journeyLevels,
    }));
    if (journeyCatalogError) {
      return NextResponse.json({ error: journeyCatalogError }, { status: 400 });
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
      if (data.portalAccessEnabled && !existingTeacher.portalPasswordHash && (typeof portalPassword !== "string" || !isPasswordCompliant(portalPassword.trim()))) {
        return NextResponse.json({ error: `Définissez un mot de passe professeur de ${PASSWORD_MIN_LENGTH} caractères minimum, avec une lettre et un chiffre, avant d'activer l'accès.` }, { status: 400 });
      }
    }
    const passwordWasChanged = typeof portalPassword === "string" && Boolean(portalPassword.trim());
    const temporaryPasswordIssuedAt = passwordWasChanged ? new Date() : null;
    const normalizedVerificationMethod = typeof verificationMethod === "string"
      ? verificationMethod.trim()
      : "";
    const normalizedVerificationReference = normalizeIdentityVerificationReference(
      typeof verificationReference === "string" ? verificationReference : "",
    );
    let identityVerificationMethodLabel: string | null = null;
    if (passwordWasChanged) {
      if (!isPasswordCompliant(portalPassword.trim())) {
        return NextResponse.json({ error: `Le mot de passe professeur doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, une lettre et un chiffre.` }, { status: 400 });
      }
      if (identityVerified !== true) {
        return NextResponse.json(
          { error: "Confirmez la vérification de l'identité du professeur avant de créer un accès temporaire." },
          { status: 400 },
        );
      }
      if (!isClientIdentityVerificationMethod(normalizedVerificationMethod)) {
        return NextResponse.json(
          { error: "Sélectionnez la méthode utilisée pour vérifier l'identité du professeur." },
          { status: 400 },
        );
      }
      identityVerificationMethodLabel = CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS[normalizedVerificationMethod];
      if (!isSafeIdentityVerificationReference(normalizedVerificationReference)) {
        return NextResponse.json(
          {
            error: `Ajoutez une référence interne de ${IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH} à ${IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH} caractères, sans donnée personnelle.`,
          },
          { status: 400 },
        );
      }
      data.portalPasswordHash = await bcrypt.hash(portalPassword.trim(), passwordHashRounds({ role: "TEACHER" }));
      data.portalPasswordMustChange = true;
      data.portalTemporaryPasswordIssuedAt = temporaryPasswordIssuedAt;
      data.sessionVersion = { increment: 1 };
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
    const nextStatus = String(data.status ?? existingTeacher.status);
    const nextOffersHome = "offersHome" in data ? Boolean(data.offersHome) : existingTeacher.offersHome;
    const nextCommune = "commune" in data ? data.commune : existingTeacher.commune;
    if (requiresTeacherHomeCommune({
      status: nextStatus,
      offersHome: nextOffersHome,
      commune: nextCommune,
    })) {
      return NextResponse.json({
        error: "Une commune principale est obligatoire pour activer un professeur qui propose les cours à domicile.",
      }, { status: 400 });
    }
    const normalizedAvailability = availability !== undefined
      ? normalizeAvailability(availability)
      : parseAvailability(existingTeacher.availability);
    if (isPublicVisibleTeacherStatus(nextStatus) && countAvailabilitySlots(normalizedAvailability) === 0) {
      return NextResponse.json({
        error: "Un professeur actif doit avoir au moins une plage horaire de 2h disponible.",
      }, { status: 400 });
    }
    if (availability !== undefined) {
      data.availability = availability ? JSON.stringify(normalizedAvailability) : null;
    }

    const statusChanged = "status" in data && nextStatus !== existingTeacher.status;
    const portalAccessChanged = "portalAccessEnabled" in data
      && Boolean(data.portalAccessEnabled) !== existingTeacher.portalAccessEnabled;
    const portalPhoneChanged = "portalPhone" in data
      && (data.portalPhone || null) !== existingTeacher.portalPhone;
    if (!passwordWasChanged && (statusChanged || portalAccessChanged || portalPhoneChanged)) {
      data.sessionVersion = { increment: 1 };
    }
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

    const passwordChangedAt = temporaryPasswordIssuedAt;
    const passwordTeacherName = typeof data.professionalName === "string" && data.professionalName.trim()
      ? data.professionalName.trim()
      : existingTeacher.professionalName || existingTeacher.fullName;
    const passwordTeacherEmail = "email" in data
      ? typeof data.email === "string" ? data.email.trim() : ""
      : existingTeacher.email?.trim() || "";
    let passwordEmailJobId: string | null = null;
    await db.$transaction(async (tx) => {
      await tx.teacher.update({ where: { id }, data });
      if (passwordWasChanged && passwordChangedAt) {
        await tx.teacherPasswordResetToken.updateMany({
          where: { teacherId: id, usedAt: null },
          data: { usedAt: passwordChangedAt },
        });
        await tx.notification.updateMany({
          where: {
            teacherId: id,
            type: TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
            read: false,
          },
          data: {
            read: true,
            readAt: passwordChangedAt,
            confirmedAt: passwordChangedAt,
            status: "CONFIRMED",
            response: "Identité vérifiée et accès temporaire attribué.",
          },
        });
        await tx.adminActionLog.create({
          data: {
            adminId: admin.id,
            action: "Mot de passe professeur réinitialisé",
            entityType: "Teacher",
            entityId: id,
            detail: `${admin.name} a attribué un mot de passe temporaire valable ${TEMPORARY_PASSWORD_TTL_HOURS} h à ${passwordTeacherName} après vérification d'identité (${identityVerificationMethodLabel} ; référence : ${normalizedVerificationReference}).`,
            newStatus: "TEACHER_TEMPORARY_PASSWORD_ASSIGNED",
          },
        });
        await tx.teacherNotification.create({
          data: {
            teacherId: id,
            title: "Mot de passe temporaire attribué",
            message: `L'administration a remplacé votre mot de passe. Le mot de passe temporaire transmis par le service client est valable ${TEMPORARY_PASSWORD_TTL_HOURS} h et une seule connexion, puis vous devrez créer votre mot de passe personnel.`,
            channel: "INTERNAL",
            sent: true,
            status: "SENT",
            sentById: admin.id,
          },
        });
        if (passwordTeacherEmail) {
          passwordEmailJobId = await enqueuePasswordChangedEmailInTransaction(tx, {
            accountType: "PROFESSOR",
            email: passwordTeacherEmail,
            name: passwordTeacherName,
            changedAt: passwordChangedAt,
            securityUrl: absoluteAppUrl("/contact", req),
            accountLabel: "espace professeur Compétence",
            sourceTokenId: `teacher-admin-reset:${id}:${passwordChangedAt.toISOString()}`,
            teacherId: id,
          });
        }
      }
    });

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
            detail: `${admin.name} a mis à jour l'évaluation de ${teacherName}. Note service client : ${Number(nextRating || 0).toFixed(1)}/5. Score qualité : ${nextScore}/100.`,
            oldStatus: `rating=${Number(existingTeacher.adminRating || 0).toFixed(1)};score=${existingTeacher.qualityScore}`,
            newStatus: `rating=${Number(nextRating || 0).toFixed(1)};score=${nextScore}`,
          },
        }),
        db.teacherNotification.create({
          data: {
            teacherId: id,
            title: "Évaluation qualité mise à jour",
            message: `Bonjour ${teacherName}, votre suivi qualité Compétence a été mis à jour. Note service client : ${Number(nextRating || 0).toFixed(1)}/5. Score qualité : ${nextScore}/100.`,
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

    if (passwordEmailJobId) {
      after(async () => {
        try {
          await flushPasswordEmailOutbox({ jobIds: [passwordEmailJobId!], limit: 1 });
        } catch (error) {
          console.error("[password-change] Immediate teacher-admin confirmation flush failed; the cron will retry.", error);
        }
      });
    }
    const passwordEmail = passwordWasChanged
      ? {
          sent: false,
          queued: Boolean(passwordEmailJobId),
          message: passwordEmailJobId
            ? "Confirmation email prise en charge automatiquement."
            : "Mot de passe temporaire enregistré. Ajoutez une adresse email pour la confirmation de sécurité.",
        }
      : null;

    revalidatePath("/admin/professeurs");
    revalidatePath(`/admin/professeurs/${id}`);
    revalidatePath(`/admin/professeurs/${id}/modifier`);
    revalidatePath("/professeurs");
    revalidatePath(`/professeurs/${id}`);

    return NextResponse.json({
      ok: true,
      id,
      passwordEmail,
      temporaryPassword: temporaryPasswordIssuedAt
        ? {
            expiresAt: temporaryPasswordExpiresAt(temporaryPasswordIssuedAt).toISOString(),
            expiresInHours: TEMPORARY_PASSWORD_TTL_HOURS,
          }
        : null,
    });
  } catch (e: any) {
    console.error("admin/teachers PATCH error", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ce téléphone de connexion professeur est déjà utilisé." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("TEACHERS_MANAGE");
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
    db.teacher.update({
      where: { id },
      data: {
        status: nextStatus,
        sessionVersion: { increment: 1 },
        lastActivityAt: new Date(),
      },
    }),
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
