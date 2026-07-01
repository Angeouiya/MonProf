import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.zone !== undefined) data.zone = body.zone || null;
  try {
    await db.commune.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Cette commune existe déjà" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await db.commune.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2003") return NextResponse.json({ error: "Commune liée à des professeurs" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
