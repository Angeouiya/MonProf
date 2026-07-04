import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isReviewableBookingStatus } from "@/lib/review-policy";
import { refreshTeacherPublicRating } from "@/lib/reviews";
import { PAYDUNYA_PROOF_REQUIRED_ERROR, requiresVerifiedPayDunyaForOperationalAction } from "@/lib/payment-security";

const MAX_REVIEW_COMMENT_LENGTH = 900;
const MIN_LOW_RATING_COMMENT_LENGTH = 20;
const QUALITY_OBSERVATION_STATUSES = new Set(["ACTIVE", "PRIORITY", "REPLACEABLE"]);

function reviewQualityImpact(rating: number) {
  if (rating <= 2) return 10;
  if (rating === 3) return 5;
  if (rating === 4) return 1;
  return 0;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId, rating, comment } = body;
  const parsedRating = Number(rating);
  const roundedRating = Math.round(parsedRating);
  const cleanedComment = typeof comment === "string" ? comment.trim() : "";

  if (!bookingId || typeof bookingId !== "string") {
    return NextResponse.json({ error: "Réservation invalide" }, { status: 400 });
  }
  if (!Number.isFinite(parsedRating) || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return NextResponse.json({ error: "Note invalide (1 à 5)" }, { status: 400 });
  }
  if (cleanedComment.length > MAX_REVIEW_COMMENT_LENGTH) {
    return NextResponse.json({ error: `Commentaire trop long (${MAX_REVIEW_COMMENT_LENGTH} caractères maximum)` }, { status: 400 });
  }
  if (roundedRating <= 3 && cleanedComment.length < MIN_LOW_RATING_COMMENT_LENGTH) {
    return NextResponse.json({
      error: `Pour une note de ${roundedRating}/5, ajoutez un commentaire d'au moins ${MIN_LOW_RATING_COMMENT_LENGTH} caractères afin que l'administration puisse comprendre et traiter le problème.`,
    }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: { select: { fullName: true, professionalName: true, qualityScore: true, status: true } },
      client: { select: { name: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (!isReviewableBookingStatus(booking.status)) {
    return NextResponse.json({ error: "Avis possible après confirmation du cours par le client" }, { status: 400 });
  }
  if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
    return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
  }

  const existing = await db.review.findFirst({ where: { bookingId, clientId: userId } });
  if (existing) {
    return NextResponse.json({ error: "Vous avez déjà laissé un avis pour ce cours" }, { status: 400 });
  }

  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  const priority = roundedRating <= 2 ? "CRITICAL" : roundedRating <= 3 ? "URGENT" : roundedRating === 4 ? "IMPORTANT" : "NORMAL";
  const reviewLink = `/admin/professeurs/${booking.teacherId}?tab=avis&bookingId=${booking.id}`;
  const qualityImpact = reviewQualityImpact(roundedRating);
  const nextQualityScore = Math.max(0, booking.teacher.qualityScore - qualityImpact);
  const shouldMoveToObservation = roundedRating <= 2 && nextQualityScore < 60 && QUALITY_OBSERVATION_STATUSES.has(booking.teacher.status);
  const nextTeacherStatus = shouldMoveToObservation ? "OBSERVATION" : booking.teacher.status;
  const description = cleanedComment
    ? `Avis client ${roundedRating}/5 : ${cleanedComment}`
    : `Avis client ${roundedRating}/5 sans commentaire détaillé.`;

  const review = await db.$transaction(async (tx) => {
    const duplicated = await tx.review.findFirst({ where: { bookingId, clientId: userId } });
    if (duplicated) {
      throw new Error("DUPLICATE_REVIEW");
    }

    const createdReview = await tx.review.create({
      data: {
        clientId: userId,
        teacherId: booking.teacherId,
        bookingId,
        rating: roundedRating,
        comment: cleanedComment || null,
        published: true,
        adminStatus: roundedRating <= 3 ? "TO_REVIEW" : "NEW",
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: roundedRating <= 3 ? "Avis client à traiter" : "Nouvel avis professeur",
        message: [
          `${booking.client.name} a laissé ${roundedRating}/5 à ${teacherName} sur ${booking.reference}.`,
          description,
          qualityImpact > 0 ? `Impact score qualité : -${qualityImpact} point(s), nouveau score ${nextQualityScore}/100.` : "Aucun impact qualité négatif.",
          shouldMoveToObservation ? "Le professeur passe automatiquement en observation." : "",
        ].filter(Boolean).join(" "),
        type: roundedRating <= 3 ? "LOW_TEACHER_REVIEW" : "TEACHER_REVIEW",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CREATED",
        priority,
        bookingId: booking.id,
        teacherId: booking.teacherId,
        clientId: userId,
        link: reviewLink,
        actionLabel: roundedRating <= 3 ? "Traiter l'avis" : "Voir l'avis",
      },
    });

    await tx.notification.create({
      data: {
        userId,
        title: "Avis reçu",
        message: `Merci, votre avis ${roundedRating}/5 pour ${teacherName} a bien été enregistré sur la réservation ${booking.reference}.`,
        type: "CLIENT_REVIEW_CREATED",
        recipientType: "CLIENT",
        channel: "INTERNAL",
        status: "CREATED",
        priority: "NORMAL",
        bookingId: booking.id,
        teacherId: booking.teacherId,
        clientId: userId,
        link: "/client/avis",
        actionLabel: "Voir mes avis",
      },
    });

    if (roundedRating <= 3) {
      await tx.teacherTask.create({
        data: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: `Traiter avis client ${roundedRating}/5 - ${booking.reference}`,
          description: `${description} Vérifier le déroulé du cours, contacter le client si nécessaire et décider d'un suivi professeur.`,
          priority,
          status: "TODO",
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    await tx.teacher.update({
      where: { id: booking.teacherId },
      data: {
        qualityScore: nextQualityScore,
        status: nextTeacherStatus as any,
        badgeRecommended: roundedRating <= 3 ? false : undefined,
        lastActivityAt: new Date(),
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: roundedRating <= 3 ? "Avis client faible détecté" : "Avis client enregistré",
        entityType: "Teacher",
        entityId: booking.teacherId,
        detail: roundedRating <= 3
          ? `Tâche qualité créée automatiquement après un avis ${roundedRating}/5 sur ${booking.reference}. Score qualité: ${booking.teacher.qualityScore} -> ${nextQualityScore}.${shouldMoveToObservation ? " Professeur passé en observation." : ""}`
          : `Avis ${roundedRating}/5 enregistré pour ${teacherName} sur ${booking.reference}. Score qualité: ${booking.teacher.qualityScore} -> ${nextQualityScore}.`,
        oldStatus: `${booking.teacher.status}:SCORE_${booking.teacher.qualityScore}`,
        newStatus: `${nextTeacherStatus}:SCORE_${nextQualityScore}`,
      },
    });

    return createdReview;
  }).catch((error) => {
    if (error instanceof Error && error.message === "DUPLICATE_REVIEW") {
      return null;
    }
    throw error;
  });

  if (!review) {
    return NextResponse.json({ error: "Vous avez déjà laissé un avis pour ce cours" }, { status: 400 });
  }

  await refreshTeacherPublicRating(booking.teacherId);

  return NextResponse.json({ review }, { status: 201 });
}
