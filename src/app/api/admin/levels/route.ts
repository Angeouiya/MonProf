import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminApi("CATALOG_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const name: string = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  const slug = body.slug?.trim() || slugify(name);
  const order = Number(body.order) || 0;
  try {
    const created = await db.level.create({ data: { name, slug, order } });
    return NextResponse.json({ id: created.id, ok: true });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ce niveau existe déjà" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
