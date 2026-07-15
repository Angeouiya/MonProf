import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canUseAccountPasswordFlow, isOwnerAdminAccount } from "@/lib/owner-account";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";
import { sendClientPasswordChangedEmail } from "@/lib/notification-delivery";
import { absoluteAppUrl } from "@/lib/public-url";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Lien invalide ou mot de passe manquant." }, { status: 400 });
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date() ||
    !canUseAccountPasswordFlow({ role: resetToken.user.role, email: resetToken.user.email })
  ) {
    return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
  }

  const ownerAdmin = isOwnerAdminAccount({ role: resetToken.user.role, email: resetToken.user.email });
  const validation = validatePasswordForAccount(password, resetToken.user);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (await bcrypt.compare(password, resetToken.user.passwordHash)) {
    return NextResponse.json({ error: "Choisissez un mot de passe différent de l'actuel." }, { status: 400 });
  }
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, passwordHashRounds(resetToken.user));
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        ...(ownerAdmin ? { adminPasswordChangedAt: now } : {}),
      },
    });
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: { not: resetToken.id },
      },
      data: { usedAt: now },
    });
    await tx.notification.create({
      data: {
        userId: ownerAdmin ? null : resetToken.userId,
        title: "Mot de passe modifié",
        message: ownerAdmin
          ? "Le mot de passe du compte administrateur propriétaire a été réinitialisé avec succès."
          : "Votre mot de passe Compétence a été réinitialisé avec succès.",
        type: "PASSWORD_RESET_DONE",
        recipientType: ownerAdmin ? "ADMIN" : "CLIENT",
        channel: "INTERNAL",
        status: "SENT",
        priority: "IMPORTANT",
        clientId: ownerAdmin ? null : resetToken.userId,
        sentAt: now,
        link: ownerAdmin ? "/admin/parametres" : "/client/parametres",
        actionLabel: "Voir paramètres",
      },
    });
    if (ownerAdmin) {
      await tx.adminActionLog.create({
        data: {
          adminId: resetToken.userId,
          action: "OWNER_ADMIN_PASSWORD_RESET",
          entityType: "User",
          entityId: resetToken.userId,
          detail: "Réinitialisation du mot de passe du compte administrateur propriétaire via lien email sécurisé.",
          oldStatus: "PASSWORD_ACTIVE",
          newStatus: "PASSWORD_RESET",
        },
      });
    }
  });
  const delivery = await sendClientPasswordChangedEmail({
    to: resetToken.user.email,
    name: resetToken.user.name,
    changedAt: now,
    securityUrl: absoluteAppUrl("/mot-de-passe-oublie", req),
    idempotencyKey: `password-reset-done-${resetToken.id}`,
  });
  try {
    await db.notification.create({
      data: {
      userId: ownerAdmin ? null : resetToken.userId,
      title: "Confirmation email de la réinitialisation du mot de passe",
      message: delivery.ok
        ? `Un email personnel de confirmation a été envoyé à ${resetToken.user.email}.`
        : `L'email personnel destiné à ${resetToken.user.email} n'a pas pu être envoyé. ${delivery.message}`,
      type: delivery.ok ? "PASSWORD_RESET_EMAIL_SENT" : "PASSWORD_RESET_EMAIL_FAILED",
      recipientType: ownerAdmin ? "ADMIN" : "CLIENT",
      recipientName: resetToken.user.name,
      channel: "EMAIL",
      status: delivery.ok ? "SENT" : "FAILED",
      priority: delivery.ok ? "IMPORTANT" : "URGENT",
      clientId: ownerAdmin ? null : resetToken.userId,
      sentAt: delivery.ok ? now : null,
      response: [delivery.message, delivery.externalId ? `Identifiant fournisseur : ${delivery.externalId}` : null]
        .filter(Boolean)
        .join(" "),
      link: ownerAdmin ? "/admin/mon-compte" : "/client/parametres",
      actionLabel: "Voir la sécurité du compte",
      },
    });
  } catch (error) {
    console.error("password reset email audit error", error);
  }

  return NextResponse.json({
    ok: true,
    email: {
      sent: delivery.ok,
      configured: delivery.configured,
      message: delivery.message,
    },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
