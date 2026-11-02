import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { parseMarketplaceSearchInput } from "@/lib/marketplace-input";
import { findMarketplaceCandidates } from "@/lib/marketplace-search";

export async function POST(request: NextRequest) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Nouvelle recherche indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Connectez-vous comme client." }, { status: 401 });
  try {
    const input = await parseMarketplaceSearchInput(await request.json());
    const candidates = await findMarketplaceCandidates(input);
    return NextResponse.json({ candidates, count: candidates.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recherche invalide." }, { status: 400 });
  }
}
