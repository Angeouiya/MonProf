import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("CATALOG_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.name?.trim()) {
    data.name = body.name.trim();
    data.slug = body.slug?.trim() || slugify(body.name);
  }
  if (body.order !== undefined) data.order = Number(body.order) || 0;
  try {
    await db.level.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ce slug/nom existe déjà" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("CATALOG_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await db.level.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2003") return NextResponse.json({ error: "Niveau lié à des professeurs" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
