import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = normalizeText(body.name, 120);
  const phone = normalizeText(body.phone, 32);
  const email = normalizeText(body.email, 160) || "partenariat@competence.ci";
  const referredClient = normalizeText(body.referredClient, 160);
  const message = normalizeText(body.message, 1200);

  if (!name || !phone) {
    return NextResponse.json({ error: "Nom et téléphone requis." }, { status: 400 });
  }

  await db.contactMessage.create({
    data: {
      name,
      phone,
      email,
      subject: "Partenariat apporteur d'affaires",
      message: [
        "Demande partenariat / apporteur d'affaires.",
        referredClient ? `Client concerné : ${referredClient}` : "",
        message ? `Message : ${message}` : "",
      ].filter(Boolean).join("\n"),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Votre demande partenariat a été envoyée. L'équipe Compétence.CI pourra vérifier la déclaration et les pièces avant tout dépôt.",
  });
}

function normalizeText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
