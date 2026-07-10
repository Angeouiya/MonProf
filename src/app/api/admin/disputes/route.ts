import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  if (!(await requireAdminApi("DISPUTES_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: any = {};
  if (status) where.status = status;

  const disputes = await db.dispute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, totalPrice: true, teacherNetAmount: true,
          subjectName: true, levelName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          client: { select: { id: true, name: true } },
        },
      },
      openedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    items: disputes.map((d) => ({
      id: d.id,
      reason: d.reason,
      description: d.description,
      status: d.status,
      resolution: d.resolution,
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt,
      booking: d.booking,
      openedBy: d.openedBy,
    })),
  });
}
