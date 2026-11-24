import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { findMarketplaceSeriesCandidates, parseMarketplaceSeriesInput } from "@/lib/marketplace-series-search";

export async function POST(request: NextRequest) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Suivi indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  try {
    const inputs = await parseMarketplaceSeriesInput(await request.json());
    const candidates = await findMarketplaceSeriesCandidates(inputs);
    return NextResponse.json({ candidates, count: candidates.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recherche invalide." }, { status: 400 });
  }
}
