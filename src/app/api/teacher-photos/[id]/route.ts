import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^c[a-z0-9]{20,}$/i.test(id)) {
    return NextResponse.json({ error: "Photo invalide." }, { status: 400 });
  }

  const asset = await db.teacherPhotoAsset.findUnique({
    where: { id },
    select: { data: true, contentType: true, size: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(asset.data), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
