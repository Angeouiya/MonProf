import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { parseMarketplaceSearchInput } from "@/lib/marketplace-input";
import { createMarketplaceRequest, MarketplaceError } from "@/lib/marketplace-missions";

export async function GET() {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  const requests = await db.marketplaceRequest.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, reference: true, journey: true, subjectName: true, levelName: true,
      scheduledDate: true, scheduledTime: true, durationMinutes: true, status: true,
      courseAmount: true, transportFee: true, totalClientPrice: true,
      assignedTeacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
    },
  });
  return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  try {
    const body = await request.json();
    const input = await parseMarketplaceSearchInput(body);
    const created = await createMarketplaceRequest(user.id, {
      ...input,
      clientKey: typeof body.clientKey === "string" ? body.clientKey : "",
      preferredTeacherId: typeof body.teacherId === "string" ? body.teacherId : null,
      addressHint: typeof body.addressHint === "string" ? body.addressHint : null,
      objective: typeof body.objective === "string" ? body.objective : null,
    });
    return NextResponse.json({ id: created.id, reference: created.reference, status: created.status }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demande impossible." }, { status: error instanceof MarketplaceError ? error.status : 400 });
  }
}
