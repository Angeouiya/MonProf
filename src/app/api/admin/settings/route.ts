import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const rows = await db.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    const exists = await db.setting.findUnique({ where: { key } });
    if (exists) {
      await db.setting.update({ where: { key }, data: { value: String(value) } });
    } else {
      await db.setting.create({ data: { key, value: String(value) } });
    }
  }
  return NextResponse.json({ ok: true });
}
