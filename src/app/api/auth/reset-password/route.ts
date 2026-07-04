import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || password.length < 6) {
    return NextResponse.json({ error: "Lien invalide ou mot de passe trop court." }, { status: 400 });
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || resetToken.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: { not: resetToken.id },
      },
      data: { usedAt: new Date() },
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
        sentAt: new Date(),
        link: "/client/parametres",
        actionLabel: "Voir paramètres",
      },
    });
  });

  return NextResponse.json({ ok: true });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
