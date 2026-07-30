import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeAccountEmail, normalizeAccountPhone } from "@/lib/account-phone";
import { isPasswordCompliant, PASSWORD_MIN_LENGTH, passwordHashRounds } from "@/lib/password-policy";

const schema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().max(32, "Téléphone invalide").optional().or(z.literal("")),
  password: z.string().refine(
    isPasswordCompliant,
    `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, une lettre et un chiffre.`,
  ),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  legalAccepted: z.boolean().optional(),
}).superRefine((input, context) => {
  const email = normalizeAccountEmail(input.email);
  const phone = normalizeAccountPhone(input.phone);
  if (input.phone?.trim() && !phone) {
    context.addIssue({ code: "custom", path: ["phone"], message: "Téléphone invalide" });
  }
  if (!email && !phone) {
    context.addIssue({
      code: "custom",
      path: ["email"],
      message: "Renseignez un email ou un numéro de téléphone.",
    });
  }
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (body.legalAccepted !== true) {
    return NextResponse.json(
      { error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }
  const { name, password, commune, quartier } = parsed.data;
  const email = normalizeAccountEmail(parsed.data.email);
  const phone = parsed.data.phone?.trim() || null;
  const phoneNormalized = normalizeAccountPhone(phone);

  const existing = await db.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phoneNormalized ? [{ phoneNormalized }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email ou ce téléphone." },
      { status: 409 },
    );
  }

  const hash = await bcrypt.hash(password, passwordHashRounds({ role: "CLIENT" }));
  let user;
  try {
    user = await db.user.create({
      data: {
        email,
        name,
        phone,
        phoneNormalized,
        passwordHash: hash,
        role: "CLIENT",
        commune: commune || null,
        quartier: quartier || null,
      },
      select: { id: true, email: true, phone: true, name: true, role: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email ou ce téléphone." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true, user }, { status: 201 });
}
