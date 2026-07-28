import { createHash } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";
import {
  enqueuePasswordChangedEmailInTransaction,
  flushPasswordEmailOutbox,
} from "@/lib/password-email-outbox";
import { absoluteAppUrl } from "@/lib/public-url";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Lien invalide ou mot de passe manquant." }, { status: 400 });
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  const now = new Date();

  // La réinitialisation publique est volontairement réservée aux clients.
  // Les administrateurs suivent le circuit interne et les professeurs reçoivent
  // un mot de passe temporaire attribué par le service client.
  if (
    !resetToken
    || resetToken.user.role !== "CLIENT"
    || resetToken.usedAt
    || !resetToken.deliveredAt
    || resetToken.expiresAt < now
  ) {
    return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
  }

  const validation = validatePasswordForAccount(password, resetToken.user);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (await bcrypt.compare(password, resetToken.user.passwordHash)) {
    return NextResponse.json({ error: "Choisissez un mot de passe différent de l'actuel." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, passwordHashRounds(resetToken.user));
  let confirmationJobId: string | null = null;
  try {
    confirmationJobId = await db.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          deliveredAt: { not: null },
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");

      const updated = await tx.user.updateMany({
        where: { id: resetToken.userId, role: "CLIENT" },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("RESET_TOKEN_ACCOUNT_NOT_CLIENT");

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
          userId: resetToken.userId,
          title: "Mot de passe modifié",
          message: "Votre mot de passe client Compétence a été réinitialisé avec succès.",
          type: "PASSWORD_RESET_DONE",
          recipientType: "CLIENT",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          clientId: resetToken.userId,
          sentAt: now,
          link: "/client/parametres",
          actionLabel: "Voir mes paramètres",
        },
      });

      return enqueuePasswordChangedEmailInTransaction(tx, {
        accountType: "CLIENT",
        email: resetToken.user.email,
        name: resetToken.user.name,
        changedAt: now,
        securityUrl: absoluteAppUrl("/mot-de-passe-oublie", req),
        accountLabel: "compte client Compétence",
        sourceTokenId: resetToken.id,
        userId: resetToken.userId,
      });
    });
  } catch (error) {
    if (isResetTokenClaimError(error)) {
      return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
    }
    throw error;
  }

  if (confirmationJobId) {
    after(async () => {
      try {
        await flushPasswordEmailOutbox({ jobIds: [confirmationJobId!], limit: 1 });
      } catch (error) {
        console.error("[password-reset] Immediate confirmation flush failed; the cron will retry.", error);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    email: {
      sent: false,
      queued: Boolean(confirmationJobId),
      message: confirmationJobId
        ? "Confirmation email planifiée et prise en charge automatiquement."
        : "Confirmation email non planifiée; le mot de passe a bien été modifié.",
    },
    redirectTo: "/connexion",
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isResetTokenClaimError(error: unknown) {
  return error instanceof Error
    && (error.message === "RESET_TOKEN_ALREADY_USED" || error.message === "RESET_TOKEN_ACCOUNT_NOT_CLIENT");
}
