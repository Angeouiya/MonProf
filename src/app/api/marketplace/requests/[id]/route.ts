import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { cancelMarketplaceRequest, confirmMarketplaceLesson, marketplaceStartCode, MarketplaceError, reportMarketplaceDispute } from "@/lib/marketplace-missions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  const { id } = await context.params;
  const request = await db.marketplaceRequest.findFirst({
    where: { id, clientId: user.id },
    include: {
      assignedTeacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, rating: true, ratingCount: true } },
      review: { select: { id: true, rating: true, comment: true } },
      offers: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, select: { teacherId: true, status: true, expiresAt: true } },
    },
  });
  if (!request) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  const { startCodeAttempts: _attempts, ...publicRequest } = request;
  const contactVisible = ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "DISPUTED"].includes(request.status);
  return NextResponse.json({
    request: { ...publicRequest, assignedTeacher: contactVisible ? request.assignedTeacher : null },
    startCode: request.status === "ACCEPTED" ? marketplaceStartCode(request.id) : null,
    paymentNotice: "Le règlement du cours se fait directement auprès du professeur. Compétence ne confirme pas ce paiement.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updated = body.action === "cancel"
      ? await cancelMarketplaceRequest(id, user.id)
      : body.action === "confirm"
        ? await confirmMarketplaceLesson(id, user.id)
        : body.action === "dispute"
          ? await reportMarketplaceDispute(id, user.id, typeof body.reason === "string" ? body.reason : "")
        : (() => { throw new MarketplaceError("Action inconnue."); })();
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action impossible." }, { status: error instanceof MarketplaceError ? error.status : 400 });
  }
}
