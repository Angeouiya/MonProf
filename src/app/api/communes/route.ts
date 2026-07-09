import { NextResponse } from "next/server";
import { getCachedCommunesWithTeacherCounts } from "@/lib/catalog-cache";

export async function GET() {
  const communes = await getCachedCommunesWithTeacherCounts();
  return NextResponse.json({
    items: communes.map((c) => ({ id: c.id, name: c.name, zone: c.zone, teachersCount: c._count.teachers })),
  });
}
