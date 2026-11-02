import { NextRequest, NextResponse } from "next/server";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { acceptMarketplaceOffer, advanceMarketplaceOffer, cancelAcceptedMarketplaceOffer, endMarketplaceLesson, MarketplaceError, startMarketplaceLesson } from "@/lib/marketplace-missions";
import { db } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const teacher = await requireTeacherApi();
  if (!teacher) return NextResponse.json({ error: "Accès professeur requis." }, { status: 401 });
  const { id } = await context.params;
  const offer = await db.marketplaceOffer.findFirst({
    where: { requestId: id, teacherId: teacher.id },
    include: {
      request: {
        include: { client: { select: { name: true, phone: true } } },
      },
    },
  });
  if (!offer) return NextResponse.json({ error: "Mission introuvable." }, { status: 404 });
  const isAssigned = offer.status === "ACCEPTED" && offer.request.assignedTeacherId === teacher.id
    && ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "DISPUTED"].includes(offer.request.status);
  const { clientId: _clientId, startCodeAttempts: _attempts, ...safeRequest } = offer.request;
  return NextResponse.json({
    offer: {
      id: offer.id, status: offer.status, expiresAt: offer.expiresAt,
      totalClientPrice: offer.totalClientPrice, transportFee: offer.transportFee,
    },
    request: {
      ...safeRequest,
      addressHint: isAssigned ? offer.request.addressHint : null,
      client: isAssigned ? offer.request.client : { name: "Client Compétence", phone: null },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const teacher = await requireTeacherApi();
  if (!teacher) return NextResponse.json({ error: "Accès professeur requis." }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    const result = body.action === "accept"
      ? await acceptMarketplaceOffer(id, teacher.id)
      : body.action === "decline"
        ? await advanceMarketplaceOffer(id, teacher.id)
        : body.action === "start"
          ? await startMarketplaceLesson(id, teacher.id, typeof body.code === "string" ? body.code : "")
          : body.action === "end"
            ? await endMarketplaceLesson(id, teacher.id)
            : body.action === "cancel"
              ? await cancelAcceptedMarketplaceOffer(id, teacher.id)
            : (() => { throw new MarketplaceError("Action inconnue."); })();
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action impossible." }, { status: error instanceof MarketplaceError ? error.status : 400 });
  }
}
