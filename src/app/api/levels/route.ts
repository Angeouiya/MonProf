import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const levels = await db.level.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  return NextResponse.json({
    items: levels.map((l) => ({ id: l.id, name: l.name, slug: l.slug, order: l.order, teachersCount: l._count.teachers })),
  });
}
