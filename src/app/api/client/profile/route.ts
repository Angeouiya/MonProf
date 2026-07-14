import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { canUseAccountPasswordFlow, isOwnerAdminAccount } from "@/lib/owner-account";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = (session.user as any).role;
  const ownerAdmin = isOwnerAdminAccount({ role, email: session.user.email });
  if (role !== "CLIENT" && !ownerAdmin) {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
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
  const ownerAdmin = isOwnerAdminAccount({ role, email: session.user.email });
  if (role !== "CLIENT" && !ownerAdmin) {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const body = await req.json();
  const { action, name, phone, commune, quartier, avatarUrl, oldPassword, newPassword, confirmPassword } = body;

  if (action === "changePassword") {
    if (!canUseAccountPasswordFlow({ role, email: session.user.email })) {
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
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          ...(ownerAdmin ? { adminPasswordChangedAt: now } : {}),
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
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
    });
    return NextResponse.json({ ok: true });
  }

  if (ownerAdmin) {
    return NextResponse.json({ error: "Le compte propriétaire ne peut modifier ici que son mot de passe." }, { status: 403 });
  }

  const data: any = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof phone === "string") data.phone = phone.trim() || null;
  if (typeof commune === "string") data.commune = commune.trim() || null;
  if (typeof quartier === "string") data.quartier = quartier.trim() || null;
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, email: true, name: true, phone: true,
      commune: true, quartier: true, avatarUrl: true, role: true,
    },
  });

  return NextResponse.json({ user: updated });
}
