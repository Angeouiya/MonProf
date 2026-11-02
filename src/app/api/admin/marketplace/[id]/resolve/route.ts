import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { MarketplaceError, resolveMarketplaceDispute } from "@/lib/marketplace-missions";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const admin = await requireAdminApi("DISPUTES_MANAGE");
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    if (body.action !== "CONFIRM_COURSE" && body.action !== "CREDIT_COMMISSION") {
      throw new MarketplaceError("Décision inconnue.");
    }
    const result = await resolveMarketplaceDispute({
      requestId: id, adminId: admin.id, action: body.action,
      note: typeof body.note === "string" ? body.note : "",
    });
    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Décision impossible." }, { status: error instanceof MarketplaceError ? error.status : 503 });
  }
}
