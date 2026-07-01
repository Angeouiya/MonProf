import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // unread | all
  const where: any = { userId: null };
  if (filter === "unread") where.read = false;
  const items = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  // body: { markAllRead?: true } ou { id, read: true }
  if (body.markAllRead) {
    await db.notification.updateMany({ where: { userId: null, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (body.id) {
    await db.notification.update({ where: { id: body.id }, data: { read: !!body.read } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
}
