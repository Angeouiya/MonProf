import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { communeInputSchema, locationSlug, nullableText } from "@/lib/location-admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("CATALOG_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const parsed = communeInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  try {
    const created = await db.$transaction(async (tx) => {
      const commune = await tx.commune.create({
        data: {
          name: parsed.data.name,
          slug: locationSlug(parsed.data.name),
          zone: nullableText(parsed.data.zone),
          transportClass: parsed.data.transportClass,
          transportFeeOverride: parsed.data.transportFeeOverride ?? null,
          isActive: parsed.data.isActive,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Commune créée",
          entityType: "Commune",
          entityId: commune.id,
          detail: `${admin.name} a créé ${commune.name} (${commune.transportClass}).`,
          newStatus: commune.isActive ? "ACTIVE" : "INACTIVE",
        },
      });
      return commune;
    });
    revalidateTag("catalog-communes", "max");
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") return invalid("Cette commune ou ce code existe déjà.");
    return NextResponse.json({ error: "Impossible de créer la commune." }, { status: 500 });
  }
}

function invalid(message?: string) {
  return NextResponse.json({ error: message || "Données invalides." }, { status: 400 });
}
