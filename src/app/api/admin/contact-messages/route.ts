import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  if (!(await requireAdminApi("COMMUNICATIONS_VIEW"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // all | unhandled
  const where: any = {};
  if (filter === "unhandled") where.handled = false;
  const items = await db.contactMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}
