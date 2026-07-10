import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { communePatchSchema, locationSlug, nullableText } from "@/lib/location-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const parsed = communePatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides." }, { status: 400 });

  const current = await db.commune.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Commune introuvable." }, { status: 404 });
  try {
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.commune.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name, slug: locationSlug(parsed.data.name) } : {}),
          ...(parsed.data.zone !== undefined ? { zone: nullableText(parsed.data.zone) } : {}),
          ...(parsed.data.transportClass !== undefined ? { transportClass: parsed.data.transportClass } : {}),
          ...(parsed.data.transportFeeOverride !== undefined ? { transportFeeOverride: parsed.data.transportFeeOverride } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Commune modifiée",
          entityType: "Commune",
          entityId: id,
          detail: JSON.stringify({ changedBy: admin.name, before: current, after: updated }),
          oldStatus: current.isActive ? "ACTIVE" : "INACTIVE",
          newStatus: updated.isActive ? "ACTIVE" : "INACTIVE",
        },
      });
      return updated;
    });
    revalidateTag("catalog-communes", "max");
    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "Cette commune ou ce code existe déjà." }, { status: 400 });
    return NextResponse.json({ error: "Impossible de modifier la commune." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const current = await db.commune.findUnique({
    where: { id },
    include: { _count: { select: { teachers: true, quarters: true } } },
  });
  if (!current) return NextResponse.json({ error: "Commune introuvable." }, { status: 404 });
  if (current._count.teachers > 0 || current._count.quarters > 0) {
    return NextResponse.json({
      error: "Cette commune est utilisée. Désactivez-la pour préserver les profils et l'historique.",
    }, { status: 409 });
  }
  await db.$transaction([
    db.commune.delete({ where: { id } }),
    db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Commune supprimée",
        entityType: "Commune",
        entityId: id,
        detail: `${admin.name} a supprimé ${current.name}.`,
        oldStatus: current.isActive ? "ACTIVE" : "INACTIVE",
        newStatus: "DELETED",
      },
    }),
  ]);
  revalidateTag("catalog-communes", "max");
  return NextResponse.json({ ok: true });
}
