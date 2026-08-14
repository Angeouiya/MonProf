import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveClientPromotionBenefits } from "@/lib/loyalty-program";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "CLIENT") {
    return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  }
  const clientId = (session.user as { id: string }).id;
  const body = await request.json();
  try {
    const benefits = await resolveClientPromotionBenefits({
      clientId,
      referralCode: body.code,
      referralName: body.name,
      referralPhone: body.phone,
    });
    if (!benefits.attribution) {
      return NextResponse.json({ error: "Aucun partenaire vérifié avec ces informations." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      partner: {
        code: benefits.attribution.code,
        promoterName: benefits.attribution.promoterName,
        promoterPhone: benefits.attribution.promoterPhone,
        status: benefits.attribution.status,
        endsAt: benefits.attribution.endsAt?.toISOString() ?? null,
      },
      benefits: {
        partnerDiscountPercent: benefits.partnerDiscountPercent,
        partnerCommissionPercent: benefits.partnerCommissionPercent,
        minimumMarginPercent: benefits.minimumMarginPercent,
        reward: benefits.reward ? { ...benefits.reward, expiresAt: benefits.reward.expiresAt.toISOString() } : null,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PARTNER_NOT_VERIFIED";
    return NextResponse.json({
      code,
      error: code === "PARTNER_ATTRIBUTION_LOCKED"
        ? "Votre compte est déjà rattaché à un autre partenaire pour six mois."
        : code === "PARTNER_SELF_REFERRAL_FORBIDDEN"
          ? "Vous ne pouvez pas utiliser votre propre numéro comme partenaire."
        : "Partenaire non vérifié. Vérifiez le code, le nom et le numéro.",
    }, { status: 409 });
  }
}
