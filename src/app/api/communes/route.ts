import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const communes = await db.commune.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  return NextResponse.json({
    items: communes.map((c) => ({ id: c.id, name: c.name, zone: c.zone, teachersCount: c._count.teachers })),
  });
}
