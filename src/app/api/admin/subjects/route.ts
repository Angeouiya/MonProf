import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const name: string = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  const slug = body.slug?.trim() || slugify(name);
  try {
    const created = await db.subject.create({ data: { name, slug, icon: body.icon || null } });
    return NextResponse.json({ id: created.id, ok: true });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Cette matière existe déjà" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
