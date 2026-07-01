import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional().or(z.literal("")),
  subject: z.string().min(2, "Le sujet est requis"),
  message: z.string().min(10, "Le message doit comporter au moins 10 caractères"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    await db.contactMessage.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        subject,
        message,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/contact] error:", e);
    return NextResponse.json(
      { error: "Impossible d'enregistrer votre message. Réessayez." },
      { status: 500 }
    );
  }
}
