import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendClientResetPasswordEmail } from "@/lib/notification-delivery";
import { absoluteAppUrl } from "@/lib/public-url";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const genericResponse = {
    ok: true,
    message: "Si un compte client existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
  };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json(genericResponse);
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  const resetUrl = absoluteAppUrl(`/reinitialiser-mot-de-passe?token=${token}`, req);

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const delivery = await sendClientResetPasswordEmail({
    to: user.email,
    name: user.name,
    resetUrl,
  });

  if (!delivery.ok) {
    await db.notification.create({
      data: {
        userId: null,
        title: "Email mot de passe oublié non envoyé",
        message: `Demande de réinitialisation pour ${user.email}. ${delivery.message}`,
        type: "PASSWORD_RESET_EMAIL_FAILED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "FAILED",
        priority: "URGENT",
        clientId: user.id,
        sentAt: new Date(),
        link: `/admin/clients/${user.id}`,
        actionLabel: "Voir client",
      },
    });
  }

  return NextResponse.json({
    ...genericResponse,
    delivery: {
      configured: delivery.configured,
      ok: delivery.ok,
      message: delivery.message,
    },
    devResetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
