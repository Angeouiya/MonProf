import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSubjectCategory, groupByCatalogCategory } from "@/lib/catalog-taxonomy";

export async function GET() {
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });
  const items = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    icon: s.icon,
    category: getSubjectCategory(s.name, s.icon),
    teachersCount: s._count.teachers,
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
