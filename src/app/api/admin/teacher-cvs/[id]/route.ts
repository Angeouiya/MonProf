import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("TEACHERS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await context.params;
  const asset = await db.teacherCvAsset.findUnique({
    where: { id },
    select: { data: true, contentType: true, originalName: true },
  });
  if (!asset) return NextResponse.json({ error: "CV introuvable" }, { status: 404 });

  const safeName = asset.originalName.replace(/["\r\n\\/]/g, "_");
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
