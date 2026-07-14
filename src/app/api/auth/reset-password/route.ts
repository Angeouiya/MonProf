import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canUseAccountPasswordFlow, isOwnerAdminAccount } from "@/lib/owner-account";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";

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

  return NextResponse.json({ ok: true });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
