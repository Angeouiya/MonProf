import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE } from "@/lib/client-password-assistance";
import {
  CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS,
  IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH,
  IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH,
  isClientIdentityVerificationMethod,
  isSafeIdentityVerificationReference,
  normalizeIdentityVerificationReference,
} from "@/lib/client-identity-verification";
import { passwordHashRounds } from "@/lib/password-policy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi("CLIENTS_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Action administrateur non autorisée." }, { status: 403 });
  }

  const { id } = await params;
  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneNormalized: true,
      passwordHash: true,
      role: true,
    },
  });
  if (!target || target.role !== "CLIENT") {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }
  if (target.email) {
    return NextResponse.json(
      { error: "Ce client dispose d'un email et doit utiliser le lien autonome de réinitialisation." },
      { status: 409 },
    );
  }
  if (!target.phoneNormalized) {
    return NextResponse.json(
      { error: "Aucun numéro canonique ne permet de remettre l'accès à ce client." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const identityVerified = body?.identityVerified === true;
  const verificationMethod = typeof body?.verificationMethod === "string"
    ? body.verificationMethod.trim()
    : "";
  const verificationReference = normalizeIdentityVerificationReference(
    typeof body?.verificationReference === "string" ? body.verificationReference : "",
  );

  if (!identityVerified) {
    return NextResponse.json(
      { error: "Confirmez la vérification de l'identité du client avant de créer un accès temporaire." },
      { status: 400 },
    );
  }
  if (!isClientIdentityVerificationMethod(verificationMethod)) {
    return NextResponse.json(
      { error: "Sélectionnez la méthode utilisée pour vérifier l'identité du client." },
      { status: 400 },
    );
  }
  if (!isSafeIdentityVerificationReference(verificationReference)) {
    return NextResponse.json(
      {
        error: `Ajoutez une référence interne de ${IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH} à ${IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH} caractères (lettres, chiffres, tiret, barre, point, # ou _), sans donnée personnelle.`,
      },
      { status: 400 },
    );
  }

  const temporaryPassword = await generateUnusedTemporaryPassword(target.passwordHash);
  const passwordHash = await bcrypt.hash(temporaryPassword, passwordHashRounds(target));
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: target.id,
          role: "CLIENT",
          email: null,
          phoneNormalized: target.phoneNormalized,
          passwordHash: target.passwordHash,
        },
        data: {
          passwordHash,
          passwordMustChange: true,
          temporaryPasswordIssuedAt: now,
          sessionVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("CLIENT_ASSISTED_RECOVERY_STATE_CHANGED");

      await tx.passwordResetToken.updateMany({
        where: { userId: target.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.notification.updateMany({
        where: {
          clientId: target.id,
          recipientType: "ADMIN",
          type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
          read: false,
        },
        data: {
          read: true,
          readAt: now,
          confirmedAt: now,
          status: "CONFIRMED",
          adminId: admin.id,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Mot de passe temporaire client attribué",
          entityType: "User",
          entityId: target.id,
          detail: `${admin.name} a attribué un mot de passe temporaire à ${target.name} après vérification d'identité (${CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS[verificationMethod]} ; référence : ${verificationReference}). Le secret n'est ni journalisé ni conservé en clair.`,
          oldStatus: "CLIENT_PASSWORD_UNKNOWN",
          newStatus: "CLIENT_TEMPORARY_PASSWORD_ASSIGNED",
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_ASSISTED_RECOVERY_STATE_CHANGED") {
      return NextResponse.json(
        { error: "L'accès de ce client vient d'être modifié. Rechargez sa fiche avant de réessayer." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json(
    {
      ok: true,
      temporaryPassword,
      phone: target.phone ?? target.phoneNormalized,
      message: "Transmettez ce mot de passe une seule fois par un canal vérifié. Il sera consommé à la première connexion.",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}

async function generateUnusedTemporaryPassword(currentHash: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = `Cmp9-${randomBytes(12).toString("base64url")}`;
    if (!await bcrypt.compare(candidate, currentHash)) return candidate;
  }
  throw new Error("CLIENT_TEMPORARY_PASSWORD_GENERATION_FAILED");
}
