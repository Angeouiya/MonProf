import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { ACTIVE_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";

const PAYMENT_METHODS: readonly PaymentMethod[] = ACTIVE_PAYMENT_METHODS;
const PROFESSIONAL_PROFILE_LIMITS = {
  careerSummary: 900,
  skills: 1200,
  workHistory: 1400,
  certifications: 1000,
  teachingAchievements: 1000,
};

function normalizePaymentPhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateTextLength(label: string, value: string, max: number) {
  if (value.length > max) {
    return `${label} ne doit pas dépasser ${max} caractères.`;
  }
  return null;
}

export async function GET() {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const profile = await db.teacher.findUnique({
    where: { id: teacher.id },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      phone: true,
      email: true,
      portalPhone: true,
      portalAccessEnabled: true,
      portalLastLoginAt: true,
      lastActivityAt: true,
      defaultPayoutMethod: true,
      defaultPayoutPhone: true,
      payoutInstructions: true,
      careerSummary: true,
      skills: true,
      workHistory: true,
      certifications: true,
      teachingAchievements: true,
      learnersCoached: true,
    },
  });

  return NextResponse.json({ teacher: profile });
}

export async function PATCH(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "updateProfessionalProfile") {
    const careerSummary = cleanText(body.careerSummary);
    const skills = cleanText(body.skills);
    const workHistory = cleanText(body.workHistory);
    const certifications = cleanText(body.certifications);
    const teachingAchievements = cleanText(body.teachingAchievements);
    const learnersCoached = Number(body.learnersCoached);

    const lengthError = [
      validateTextLength("Le résumé professionnel", careerSummary, PROFESSIONAL_PROFILE_LIMITS.careerSummary),
      validateTextLength("Les compétences", skills, PROFESSIONAL_PROFILE_LIMITS.skills),
      validateTextLength("Le parcours", workHistory, PROFESSIONAL_PROFILE_LIMITS.workHistory),
      validateTextLength("Les certifications", certifications, PROFESSIONAL_PROFILE_LIMITS.certifications),
      validateTextLength("Les résultats", teachingAchievements, PROFESSIONAL_PROFILE_LIMITS.teachingAchievements),
    ].find(Boolean);
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }
    if (!Number.isFinite(learnersCoached) || learnersCoached < 0 || learnersCoached > 100000) {
      return NextResponse.json({ error: "Nombre d'apprenants encadrés invalide." }, { status: 400 });
    }

    const stored = await db.teacher.findUnique({
      where: { id: teacher.id },
      select: {
        id: true,
        fullName: true,
        professionalName: true,
        careerSummary: true,
        skills: true,
        workHistory: true,
        certifications: true,
        teachingAchievements: true,
        learnersCoached: true,
      },
    });
    if (!stored) {
      return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
    }

    const now = new Date();
    const teacherName = stored.professionalName || stored.fullName;
    const changedFields = [
      careerSummary !== (stored.careerSummary ?? "") ? "résumé" : "",
      skills !== (stored.skills ?? "") ? "compétences" : "",
      workHistory !== (stored.workHistory ?? "") ? "parcours" : "",
      certifications !== (stored.certifications ?? "") ? "certifications" : "",
      teachingAchievements !== (stored.teachingAchievements ?? "") ? "résultats" : "",
      Math.round(learnersCoached) !== stored.learnersCoached ? "apprenants encadrés" : "",
    ].filter(Boolean);

    await db.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id: stored.id },
        data: {
          careerSummary: careerSummary || null,
          skills: skills || null,
          workHistory: workHistory || null,
          certifications: certifications || null,
          teachingAchievements: teachingAchievements || null,
          learnersCoached: Math.round(learnersCoached),
          lastActivityAt: now,
        },
      });

      await tx.teacherNotification.create({
        data: {
          teacherId: stored.id,
          title: "Profil professionnel mis à jour",
          message: changedFields.length
            ? `Votre mini-CV a été mis à jour : ${changedFields.join(", ")}.`
            : "Votre mini-CV a été enregistré sans changement majeur.",
          channel: "INTERNAL",
          sent: true,
          status: "SENT",
        },
      });

      const adminMessage = await tx.teacherAdminMessage.create({
        data: {
          teacherId: stored.id,
          sender: "TEACHER",
          subject: "Mise à jour du profil professionnel",
          message: changedFields.length
            ? `${teacherName} a mis à jour son mini-CV : ${changedFields.join(", ")}. Merci de vérifier la cohérence publique de la fiche.`
            : `${teacherName} a enregistré son mini-CV sans changement détecté.`,
          priority: "IMPORTANT",
          status: "WAITING_ADMIN",
          readByTeacherAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: "Profil professeur à vérifier",
          message: `${teacherName} a modifié son mini-CV professionnel.`,
          type: "TEACHER_PROFILE_UPDATED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          teacherId: stored.id,
          sentAt: now,
          link: `/admin/professeurs/${stored.id}?tab=messages&messageId=${adminMessage.id}`,
          actionLabel: "Vérifier la fiche",
          actionType: "REVIEW_TEACHER_PROFILE",
        },
      });

      await tx.adminActionLog.create({
        data: {
          action: "Mini-CV professeur modifié",
          entityType: "Teacher",
          entityId: stored.id,
          detail: changedFields.length
            ? `${teacherName} a modifié son mini-CV : ${changedFields.join(", ")}.`
            : `${teacherName} a enregistré son mini-CV sans changement détecté.`,
          oldStatus: JSON.stringify({
            learnersCoached: stored.learnersCoached,
            hasCareerSummary: Boolean(stored.careerSummary),
            hasSkills: Boolean(stored.skills),
            hasWorkHistory: Boolean(stored.workHistory),
          }),
          newStatus: "TEACHER_PROFILE_UPDATED",
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "updatePaymentProfile") {
    const method = typeof body.defaultPayoutMethod === "string" && PAYMENT_METHODS.includes(body.defaultPayoutMethod as PaymentMethod)
      ? (body.defaultPayoutMethod as PaymentMethod)
      : null;
    const phone = normalizePaymentPhone(body.defaultPayoutPhone);
    const phoneConfirm = normalizePaymentPhone(body.defaultPayoutPhoneConfirm);
    const instructions = typeof body.payoutInstructions === "string" ? body.payoutInstructions.trim() : "";

    if (!method) {
      return NextResponse.json({ error: "Choisissez le moyen de paiement préféré." }, { status: 400 });
    }
    if (phone.length < 8 || phone.length > 20) {
      return NextResponse.json({ error: "Numéro de paiement invalide." }, { status: 400 });
    }
    if (phone !== phoneConfirm) {
      return NextResponse.json({ error: "Les deux numéros de paiement ne correspondent pas." }, { status: 400 });
    }
    if (instructions.length > 500) {
      return NextResponse.json({ error: "Consigne trop longue (500 caractères maximum)." }, { status: 400 });
    }

    const stored = await db.teacher.findUnique({
      where: { id: teacher.id },
      select: { id: true, fullName: true, professionalName: true },
    });
    if (!stored) {
      return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
    }
    const teacherName = stored.professionalName || stored.fullName;
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id: stored.id },
        data: {
          defaultPayoutMethod: method,
          defaultPayoutPhone: phone,
          payoutInstructions: instructions || null,
          lastActivityAt: now,
        },
      });

      await tx.teacherNotification.create({
        data: {
          teacherId: stored.id,
          title: "Coordonnées de paiement mises à jour",
          message: `Vos coordonnées de paiement par défaut ont été mises à jour : ${paymentMethodLabel(method)}, numéro ${phone}.`,
          channel: "INTERNAL",
          sent: true,
          status: "SENT",
        },
      });

      await tx.adminActionLog.create({
        data: {
          action: "Coordonnées paiement professeur modifiées",
          entityType: "Teacher",
          entityId: stored.id,
          detail: `${teacherName} a modifié ses coordonnées de paiement par défaut : ${paymentMethodLabel(method)}, numéro ${phone}.`,
          newStatus: "TEACHER_PAYOUT_PROFILE_UPDATED",
        },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (action !== "changePassword") {
    return NextResponse.json({ error: "Action professeur inconnue." }, { status: 400 });
  }

  const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "Ancien et nouveau mot de passe requis." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Les deux nouveaux mots de passe ne correspondent pas." }, { status: 400 });
  }

  const stored = await db.teacher.findUnique({
    where: { id: teacher.id },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      portalPasswordHash: true,
    },
  });

  if (!stored?.portalPasswordHash) {
    return NextResponse.json({ error: "Aucun mot de passe professeur n'est activé pour cette fiche." }, { status: 400 });
  }

  const passwordOk = await bcrypt.compare(oldPassword, stored.portalPasswordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Ancien mot de passe incorrect." }, { status: 400 });
  }
  if (await bcrypt.compare(newPassword, stored.portalPasswordHash)) {
    return NextResponse.json({ error: "Choisissez un mot de passe différent de l'actuel." }, { status: 400 });
  }

  const now = new Date();
  const teacherName = stored.professionalName || stored.fullName;
  const newHash = await bcrypt.hash(newPassword, 10);

  await db.$transaction(async (tx) => {
    await tx.teacher.update({
      where: { id: stored.id },
      data: {
        portalPasswordHash: newHash,
        lastActivityAt: now,
      },
    });

    await tx.teacherNotification.create({
      data: {
        teacherId: stored.id,
        title: "Mot de passe modifié",
        message: "Votre mot de passe professeur a été modifié depuis votre espace sécurisé.",
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
      },
    });

    await tx.adminActionLog.create({
      data: {
        action: "Mot de passe professeur modifié",
        entityType: "Teacher",
        entityId: stored.id,
        detail: `${teacherName} a modifié son mot de passe depuis l'espace professeur.`,
        newStatus: "TEACHER_PASSWORD_UPDATED",
      },
    });
  });

  return NextResponse.json({ ok: true });
}
