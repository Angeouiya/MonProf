import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { locationSlug, nullableText, quarterInputSchema } from "@/lib/location-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id: communeId } = await params;
  const parsed = quarterInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides." }, { status: 400 });
  const commune = await db.commune.findUnique({ where: { id: communeId }, select: { id: true, name: true } });
  if (!commune) return NextResponse.json({ error: "Commune introuvable." }, { status: 404 });

  try {
    const item = await db.$transaction(async (tx) => {
      const quarter = await tx.communeQuarter.create({
        data: {
          communeId,
          name: parsed.data.name,
          slug: locationSlug(parsed.data.name),
          aliases: nullableText(parsed.data.aliases),
          isActive: parsed.data.isActive,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Quartier créé",
          entityType: "CommuneQuarter",
          entityId: quarter.id,
          detail: `${admin.name} a ajouté ${quarter.name} à ${commune.name}.`,
          newStatus: quarter.isActive ? "ACTIVE" : "INACTIVE",
        },
      });
      return quarter;
    });
    revalidateTag("catalog-communes", "max");
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "Ce quartier existe déjà dans cette commune." }, { status: 400 });
    return NextResponse.json({ error: "Impossible d'ajouter le quartier." }, { status: 500 });
  }
}
