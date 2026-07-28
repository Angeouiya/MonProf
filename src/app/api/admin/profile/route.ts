import { after, NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";
import {
  enqueuePasswordChangedEmailInTransaction,
  flushPasswordEmailOutbox,
} from "@/lib/password-email-outbox";
import { absoluteAppUrl } from "@/lib/public-url";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Compte administrateur non autorisé." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const account = await db.user.findUnique({ where: { id: admin.id } });
  if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  if (!await bcrypt.compare(currentPassword, account.passwordHash)) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
  }
  const validation = validatePasswordForAccount(newPassword, account);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Les deux nouveaux mots de passe ne correspondent pas." }, { status: 400 });
  }
  if (await bcrypt.compare(newPassword, account.passwordHash)) {
    return NextResponse.json({ error: "Choisissez un mot de passe différent de l'actuel." }, { status: 400 });
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(newPassword, passwordHashRounds(account));
  const confirmationJobId = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        adminPasswordChangedAt: now,
      },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: admin.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Mot de passe administrateur modifié",
        entityType: "User",
        entityId: admin.id,
        detail: `${admin.name} a modifié son propre mot de passe depuis son espace privé.`,
      },
    });

    return enqueuePasswordChangedEmailInTransaction(tx, {
      accountType: "ADMIN",
      email: account.email,
      name: account.name,
      changedAt: now,
      securityUrl: absoluteAppUrl("/contact", req),
      accountLabel: "compte administrateur Compétence",
      sourceTokenId: `admin-self-service:${account.id}:${now.toISOString()}`,
      userId: account.id,
    });
  });

  if (confirmationJobId) {
    after(async () => {
      try {
        await flushPasswordEmailOutbox({ jobIds: [confirmationJobId], limit: 1 });
      } catch (error) {
        console.error("[password-change] Immediate admin confirmation flush failed; the cron will retry.", error);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    email: {
      sent: false,
      queued: Boolean(confirmationJobId),
      message: confirmationJobId
        ? "Confirmation email prise en charge automatiquement."
        : "Confirmation email en attente de configuration.",
    },
  });
}
