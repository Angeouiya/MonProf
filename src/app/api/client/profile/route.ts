import { after, NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { canUseAccountPasswordFlow, isOwnerAdminAccount } from "@/lib/owner-account";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";
import {
  enqueuePasswordChangedEmailInTransaction,
  flushPasswordEmailOutbox,
  supersedeActivePasswordResetEmailsInTransaction,
} from "@/lib/password-email-outbox";
import { absoluteAppUrl } from "@/lib/public-url";
import { normalizeAccountPhone } from "@/lib/account-phone";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = (session.user as any).role;
  const ownerAdmin = isOwnerAdminAccount({ role, adminTeamRole: (session.user as any).adminTeamRole });
  if (role !== "CLIENT" && !ownerAdmin) {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  if (role === "CLIENT" && Boolean((session.user as any).passwordMustChange)) {
    return passwordChangeRequiredResponse();
  }
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, phone: true,
      commune: true, quartier: true, avatarUrl: true, role: true, createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = (session.user as any).role;
  const ownerAdmin = isOwnerAdminAccount({ role, adminTeamRole: (session.user as any).adminTeamRole });
  if (role !== "CLIENT" && !ownerAdmin) {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const body = await req.json();
  const { action, name, phone, commune, quartier, avatarUrl, oldPassword, newPassword, confirmPassword } = body;
  if (
    role === "CLIENT"
    && Boolean((session.user as any).passwordMustChange)
    && action !== "changePassword"
  ) {
    return passwordChangeRequiredResponse();
  }

  if (action === "changePassword") {
    if (!canUseAccountPasswordFlow({ role })) {
      return NextResponse.json({ error: "Compte non autorisé pour cette opération." }, { status: 403 });
    }
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Ancien et nouveau mot de passe requis" }, { status: 400 });
    }
    if (typeof confirmPassword !== "string" || newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Les deux nouveaux mots de passe ne correspondent pas." }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    const validation = validatePasswordForAccount(newPassword, user);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Ancien mot de passe incorrect" }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Choisissez un mot de passe différent de l'actuel." }, { status: 400 });
    }
    const now = new Date();
    const newHash = await bcrypt.hash(newPassword, passwordHashRounds(user));
    const confirmationJobId = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          sessionVersion: { increment: 1 },
          ...(ownerAdmin
            ? { adminPasswordChangedAt: now }
            : { passwordMustChange: false, temporaryPasswordIssuedAt: null }),
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await supersedeActivePasswordResetEmailsInTransaction(tx, user.email);
      await tx.notification.create({
        data: {
          userId: ownerAdmin ? null : userId,
          title: "Mot de passe modifié",
          message: ownerAdmin
            ? "Le mot de passe du compte administrateur propriétaire a été modifié depuis l'espace compte."
            : "Votre mot de passe Compétence a été modifié depuis vos paramètres.",
          type: "PASSWORD_CHANGED",
          recipientType: ownerAdmin ? "ADMIN" : "CLIENT",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          clientId: ownerAdmin ? null : userId,
          sentAt: now,
          link: ownerAdmin ? "/admin/parametres" : "/client/parametres",
          actionLabel: "Voir paramètres",
        },
      });
      if (ownerAdmin) {
        await tx.adminActionLog.create({
          data: {
            adminId: userId,
            action: "OWNER_ADMIN_PASSWORD_CHANGED",
            entityType: "User",
            entityId: userId,
            detail: "Modification du mot de passe du compte administrateur propriétaire depuis l'espace compte.",
            oldStatus: "PASSWORD_ACTIVE",
            newStatus: "PASSWORD_CHANGED",
          },
        });
      }

      return enqueuePasswordChangedEmailInTransaction(tx, {
        accountType: ownerAdmin ? "ADMIN" : "CLIENT",
        email: user.email,
        name: user.name,
        changedAt: now,
        securityUrl: absoluteAppUrl(ownerAdmin ? "/contact" : "/mot-de-passe-oublie", req),
        accountLabel: ownerAdmin ? "compte administrateur Compétence" : "compte client Compétence",
        sourceTokenId: `self-service:${user.id}:${now.toISOString()}`,
        userId: user.id,
      });
    });
    if (confirmationJobId) {
      after(async () => {
        try {
          await flushPasswordEmailOutbox({ jobIds: [confirmationJobId], limit: 1 });
        } catch (error) {
          console.error("[password-change] Immediate client confirmation flush failed; the cron will retry.", error);
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
          : user.email
            ? "Confirmation email en attente de configuration."
            : "Mot de passe modifié. Aucun email de confirmation n'est associé à ce compte.",
      },
    });
  }

  if (ownerAdmin) {
    return NextResponse.json({ error: "Le compte propriétaire ne peut modifier ici que son mot de passe." }, { status: 403 });
  }

  const data: any = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof phone === "string") {
    const rawPhone = phone.trim();
    const phoneNormalized = rawPhone ? normalizeAccountPhone(rawPhone) : null;
    if (rawPhone && !phoneNormalized) {
      return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
    }
    if (!rawPhone) {
      const stored = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!stored?.email) {
        return NextResponse.json(
          { error: "Un compte sans email doit conserver un numéro de téléphone." },
          { status: 400 },
        );
      }
    }
    data.phone = rawPhone || null;
    data.phoneNormalized = phoneNormalized;
  }
  if (typeof commune === "string") data.commune = commune.trim() || null;
  if (typeof quartier === "string") data.quartier = quartier.trim() || null;
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  let updated;
  try {
    updated = await db.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, name: true, phone: true,
        commune: true, quartier: true, avatarUrl: true, role: true,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Ce numéro de téléphone est déjà utilisé." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ user: updated });
}

function passwordChangeRequiredResponse() {
  return NextResponse.json(
    {
      error: "Vous devez remplacer votre mot de passe temporaire avant d'utiliser votre espace.",
      code: "PASSWORD_CHANGE_REQUIRED",
    },
    {
      status: 403,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
