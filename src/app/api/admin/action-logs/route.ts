import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const { action, entityType, entityId, detail, oldStatus, newStatus } = body;
  if (!action || !entityType || !entityId || !detail) {
    return NextResponse.json({ error: "action, entityType, entityId et detail requis" }, { status: 400 });
  }

  const log = await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action,
      entityType,
      entityId,
      detail,
      oldStatus: oldStatus || null,
      newStatus: newStatus || null,
    },
  });
  return NextResponse.json({ ok: true, id: log.id });
}
