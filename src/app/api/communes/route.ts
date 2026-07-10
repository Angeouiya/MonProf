import { NextResponse } from "next/server";
import { getCachedCommunesWithTeacherCounts } from "@/lib/catalog-cache";

export async function GET() {
  const communes = await getCachedCommunesWithTeacherCounts();
  return NextResponse.json({
    items: communes.map((commune) => ({
      id: commune.id,
      name: commune.name,
      zone: commune.zone,
      transportClass: commune.transportClass,
      transportFeeOverride: commune.transportFeeOverride,
      quarters: commune.quarters,
      teachersCount: commune._count.teachers,
    })),
  });
}
