import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { OPEN_SUBJECT_PRESETS } from "@/lib/open-subject-catalog";

export async function POST() {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const existing = await db.subject.findMany({
    where: {
      OR: [
        { slug: { in: OPEN_SUBJECT_PRESETS.map((subject) => subject.slug) } },
        { name: { in: OPEN_SUBJECT_PRESETS.map((subject) => subject.name) } },
      ],
    },
    select: { name: true, slug: true },
  });
  const existingSlugs = new Set(existing.map((subject) => subject.slug));
  const existingNames = new Set(existing.map((subject) => subject.name));
  const missingSubjects = OPEN_SUBJECT_PRESETS.filter((subject) => (
    !existingSlugs.has(subject.slug) && !existingNames.has(subject.name)
  ));

  if (missingSubjects.length > 0) {
    await db.$transaction(
      missingSubjects.map((subject) => (
        db.subject.create({
          data: {
            name: subject.name,
            slug: subject.slug,
            icon: subject.icon,
          },
        })
      )),
    );
  }

  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Catalogue matières ouvert importé",
      entityType: "Subject",
      entityId: "open-subject-catalog",
      detail: `${admin.name} a importé ${missingSubjects.length} matière(s) du catalogue ouvert Côte d'Ivoire. ${existingSlugs.size} déjà présente(s).`,
      oldStatus: "CATALOG_CHECK",
      newStatus: missingSubjects.length > 0 ? "CATALOG_ENRICHED" : "CATALOG_ALREADY_READY",
    },
  });

  return NextResponse.json({
    ok: true,
    imported: missingSubjects.length,
    skipped: existingSlugs.size,
    total: OPEN_SUBJECT_PRESETS.length,
  });
}
