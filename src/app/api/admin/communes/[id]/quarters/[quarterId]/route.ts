import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { locationSlug, nullableText, quarterPatchSchema } from "@/lib/location-admin";

type RouteContext = { params: Promise<{ id: string; quarterId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id: communeId, quarterId } = await params;
  const parsed = quarterPatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides." }, { status: 400 });
  const current = await db.communeQuarter.findFirst({ where: { id: quarterId, communeId } });
  if (!current) return NextResponse.json({ error: "Quartier introuvable." }, { status: 404 });

  try {
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.communeQuarter.update({
        where: { id: quarterId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name, slug: locationSlug(parsed.data.name) } : {}),
          ...(parsed.data.aliases !== undefined ? { aliases: nullableText(parsed.data.aliases) } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Quartier modifié",
          entityType: "CommuneQuarter",
          entityId: quarterId,
          detail: JSON.stringify({ changedBy: admin.name, communeId, before: current, after: updated }),
          oldStatus: current.isActive ? "ACTIVE" : "INACTIVE",
          newStatus: updated.isActive ? "ACTIVE" : "INACTIVE",
        },
      });
      return updated;
    });
    revalidateTag("catalog-communes", "max");
    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "Ce quartier existe déjà dans cette commune." }, { status: 400 });
    return NextResponse.json({ error: "Impossible de modifier le quartier." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id: communeId, quarterId } = await params;
  const current = await db.communeQuarter.findFirst({ where: { id: quarterId, communeId } });
  if (!current) return NextResponse.json({ error: "Quartier introuvable." }, { status: 404 });
  await db.$transaction([
    db.communeQuarter.delete({ where: { id: quarterId } }),
    db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Quartier supprimé",
        entityType: "CommuneQuarter",
        entityId: quarterId,
        detail: `${admin.name} a supprimé ${current.name}.`,
        oldStatus: current.isActive ? "ACTIVE" : "INACTIVE",
        newStatus: "DELETED",
      },
    }),
  ]);
  revalidateTag("catalog-communes", "max");
  return NextResponse.json({ ok: true });
}
