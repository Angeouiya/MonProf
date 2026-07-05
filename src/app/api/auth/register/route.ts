import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Téléphone invalide").optional().or(z.literal("")),
  password: z.string().min(6, "Mot de passe trop court (6 caractères min.)"),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  legalAccepted: z.boolean().optional(),
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
  const { email, name, phone, password, commune, quartier } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      phone: phone || null,
      passwordHash: hash,
      role: "CLIENT",
      commune: commune || null,
      quartier: quartier || null,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ ok: true, user }, { status: 201 });
}
