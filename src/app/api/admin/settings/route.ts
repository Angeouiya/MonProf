import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import {
  platformSettingsForForm,
  platformSettingsInputSchema,
  platformSettingsInputToRows,
} from "@/lib/platform-settings";

export async function GET() {
  if (!(await requireAdminApi("SETTINGS_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const rows = await db.setting.findMany();
  return NextResponse.json({ settings: platformSettingsForForm(rows) });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi("SETTINGS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const parsed = platformSettingsInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message ?? "Paramètres invalides.",
      fields: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const currentRows = await db.setting.findMany();
  const previous = platformSettingsForForm(currentRows);
  const previousCommission = Number(previous.default_commission) || 30;
  const nextCommission = parsed.data.default_commission;
  const rows = platformSettingsInputToRows(parsed.data);
  const changedKeys = rows
    .filter((row) => previous[row.key] !== row.value)
    .map((row) => row.key);

  const result = await db.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.setting.upsert({
        where: { key: row.key },
        update: { value: row.value },
        create: row,
      });
    }

    const syncedTeachers = previousCommission === nextCommission
      ? { count: 0 }
      : await tx.teacher.updateMany({
          where: { commissionRate: previousCommission },
          data: { commissionRate: nextCommission },
        });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Paramètres plateforme modifiés",
        entityType: "Setting",
        entityId: "platform",
        detail: JSON.stringify({
          changedBy: admin.name,
          previousCommission,
          nextCommission,
          teacherProfilesSynchronized: syncedTeachers.count,
          changedKeys,
          previousValues: Object.fromEntries(changedKeys.map((key) => [key, previous[key]])),
          nextValues: Object.fromEntries(changedKeys.map((key) => [key, rows.find((row) => row.key === key)?.value])),
        }),
        oldStatus: `${previousCommission}%`,
        newStatus: `${nextCommission}%`,
      },
    });

    return { teacherProfilesSynchronized: syncedTeachers.count };
  });

  revalidateTag("platform-settings", "max");
  return NextResponse.json({
    ok: true,
    settings: platformSettingsForForm(rows),
    ...result,
  });
}
