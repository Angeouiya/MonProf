import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { editableSettingsFromClient, settingsForClient } from "@/lib/settings-security";

export async function GET() {
  if (!(await requireAdminApi("SETTINGS_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const rows = await db.setting.findMany();
  return NextResponse.json({ settings: settingsForClient(rows) });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdminApi("SETTINGS_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const editableSettings = editableSettingsFromClient(body);
  for (const [key, value] of Object.entries(editableSettings)) {
    const exists = await db.setting.findUnique({ where: { key } });
    if (exists) {
      await db.setting.update({ where: { key }, data: { value } });
    } else {
      await db.setting.create({ data: { key, value } });
    }
  }
  return NextResponse.json({ ok: true });
}
