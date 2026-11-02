import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { advanceMarketplaceOffer, expireUnstartedMarketplaceRequest, MarketplaceError } from "@/lib/marketplace-missions";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Cron non autorisé." }, { status: 401 });
  }
  if (!marketplaceEnabled()) return NextResponse.json({ processed: 0 });
  const [expired, accepted] = await Promise.all([db.marketplaceRequest.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { offerExpiresAt: "asc" },
    take: 100,
  }), db.marketplaceRequest.findMany({
    where: { status: "ACCEPTED", scheduledDate: { lte: new Date() } },
    select: { id: true }, orderBy: { scheduledDate: "asc" }, take: 100,
  })]);
  let processed = 0;
  for (const item of expired) {
    try {
      const result = await advanceMarketplaceOffer(item.id);
      if (result.status !== "waiting") processed++;
    } catch (error) {
      if (!(error instanceof MarketplaceError && error.status === 409)) {
        console.error("[marketplace:offer_expiry]", item.id, error);
      }
    }
  }
  let unstarted = 0;
  for (const item of accepted) {
    try { if (await expireUnstartedMarketplaceRequest(item.id)) unstarted++; }
    catch (error) { console.error("[marketplace:unstarted_expiry]", item.id, error); }
  }
  return NextResponse.json({ processed, unstarted, scanned: expired.length + accepted.length });
}
