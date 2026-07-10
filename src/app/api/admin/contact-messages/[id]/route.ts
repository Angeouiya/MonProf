import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const handled = body.handled ?? true;
  await db.contactMessage.update({
    where: { id },
    data: { handled, handledById: handled ? admin.id : null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("COMMUNICATIONS_SEND"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  await db.contactMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
