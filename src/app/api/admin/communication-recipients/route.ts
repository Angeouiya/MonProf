import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Accès communication refusé." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "TEACHER" ? "TEACHER" : "CLIENT";
  const q = normalizeQuery(searchParams.get("q") || "");
  const take = Math.max(1, Math.min(Number(searchParams.get("limit") || 20), 30));
  if (q.length < 2) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });

  if (type === "TEACHER") {
    const teachers = await db.teacher.findMany({
      where: {
        status: { notIn: ["BLACKLISTED", "PERMANENTLY_SUSPENDED"] },
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { professionalName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { subjects: { some: { subject: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        professionalName: true,
        phone: true,
        subjects: { where: { isPrimary: true }, select: { subject: { select: { name: true } } }, take: 1 },
      },
      orderBy: { fullName: "asc" },
      take,
    });
    return NextResponse.json({
      items: teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.professionalName || teacher.fullName,
        detail: [teacher.phone, teacher.subjects[0]?.subject.name].filter(Boolean).join(" · "),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const clients = await db.user.findMany({
    where: {
      role: "CLIENT",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take,
  });
  return NextResponse.json({
    items: clients.map((client) => ({
      id: client.id,
      name: client.name,
      detail: [client.phone, client.email].filter(Boolean).join(" · "),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}
