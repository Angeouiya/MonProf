import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLevelCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";

export async function GET() {
  const levels = await db.level.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  const items = levels.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    order: l.order,
    category: getLevelCategory(l.name, l.order),
    teachersCount: l._count.teachers,
  }));
  return NextResponse.json({
    items,
    groups: groupByCatalogCategory(items, (item) => item.category).map((group) => ({
      category: group.category,
      items: group.items,
      count: group.items.length,
      teachersCount: group.items.reduce((sum, item) => sum + item.teachersCount, 0),
    })),
  });
}
