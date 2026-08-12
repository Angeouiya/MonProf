import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { absoluteAppUrl } from "@/lib/public-url";
import {
  buildPartnerReferralSharePath,
  createPartnerReferralLead,
  normalizePartnerReferralJourney,
} from "@/lib/partner-referrals";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = normalizeText(body.name, 120);
  const phone = normalizeText(body.phone, 32);
  const rawEmail = normalizeText(body.email, 160);
  const email = rawEmail || "partenariat@competence.ci";
  const referredClient = normalizeText(body.referredClient, 160);
  const referredClientPhone = normalizeText(body.referredClientPhone, 32);
  const requestedJourney = normalizePartnerReferralJourney(body.requestedJourney);
  const message = normalizeText(body.message, 1200);

  if (!name || !phone || !referredClient) {
    return NextResponse.json({ error: "Nom, téléphone et client recommandé requis." }, { status: 400 });
  }

  const leadResult = await createPartnerReferralLead({
    promoterName: name,
    promoterPhone: phone,
    promoterEmail: rawEmail,
    expectedClientName: referredClient,
    expectedClientPhone: referredClientPhone,
    requestedJourney,
    message,
  });

  if (!leadResult.ok) {
    return NextResponse.json({ error: leadResult.error }, { status: 400 });
  }

  await db.contactMessage.create({
    data: {
      name,
      phone,
      email,
      subject: "Partenariat apporteur d'affaires",
      message: [
        "Pré-déclaration partenariat / apporteur d'affaires.",
        `Code apporteur : ${leadResult.lead.code}`,
        referredClient ? `Client concerné : ${referredClient}` : "",
        referredClientPhone ? `Téléphone client : ${referredClientPhone}` : "",
        requestedJourney ? `Système conseillé : ${requestedJourney}` : "",
        message ? `Message : ${message}` : "",
      ].filter(Boolean).join("\n"),
    },
  });

  const sharePath = buildPartnerReferralSharePath(leadResult.lead.code, requestedJourney);
  const shareUrl = absoluteAppUrl(sharePath, req);

  return NextResponse.json({
    ok: true,
    message: "Déclaration enregistrée. Envoyez ce lien au client : il gardera votre code jusqu'à la réservation.",
    code: leadResult.lead.code,
    shareUrl,
    sharePath,
    promotionEndsAt: leadResult.lead.promotionEndsAt.toISOString(),
  });
}

function normalizeText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
