import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { runNotificationScheduler } from "@/lib/notification-scheduler";

export async function POST() {
  const admin = await requireAdminApi("OPERATIONS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const result = await runNotificationScheduler({
    source: "admin",
    adminId: admin.id,
    adminName: admin.name,
  });

  return NextResponse.json(result);
}
