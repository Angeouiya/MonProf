import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { passwordHashRounds, validatePasswordForAccount } from "@/lib/password-policy";

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

  await db.$transaction([
    db.user.update({
      where: { id: admin.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, passwordHashRounds(account)),
        adminPasswordChangedAt: new Date(),
      },
    }),
    db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Mot de passe administrateur modifié",
        entityType: "User",
        entityId: admin.id,
        detail: `${admin.name} a modifié son propre mot de passe depuis son espace privé.`,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
