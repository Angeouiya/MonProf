import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { parseMarketplaceSeriesInput } from "@/lib/marketplace-series-search";
import { createMarketplaceSeriesRequest, MarketplaceError } from "@/lib/marketplace-missions";

export async function POST(request: NextRequest) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Suivi indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  try {
    const body = await request.json();
    const inputs = await parseMarketplaceSeriesInput(body);
    const created = await createMarketplaceSeriesRequest(user.id, inputs, {
      clientKey: typeof body.clientKey === "string" ? body.clientKey : "",
      preferredTeacherId: typeof body.teacherId === "string" ? body.teacherId : "",
      quotedTotalClientPrice: body.quotedTotalClientPrice,
      addressHint: typeof body.addressHint === "string" ? body.addressHint : null,
      objective: typeof body.objective === "string" ? body.objective : null,
    });
    return NextResponse.json({ id: created.id, reference: created.reference, status: created.status }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suivi impossible." }, { status: error instanceof MarketplaceError ? error.status : 400 });
  }
}
