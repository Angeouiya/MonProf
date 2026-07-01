import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  return NextResponse.json({
    items: subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug, icon: s.icon, teachersCount: s._count.teachers })),
  });
}
