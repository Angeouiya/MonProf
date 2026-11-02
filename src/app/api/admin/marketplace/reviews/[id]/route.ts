import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { db } from "@/lib/db";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { refreshTeacherPublicRating } from "@/lib/reviews";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const admin = await requireAdminApi("REVIEWS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  if (typeof body.published !== "boolean") return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  const review = await db.marketplaceReview.findUnique({ where: { id }, select: { id: true, teacherId: true, published: true } });
  if (!review) return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  if (review.published === body.published) return NextResponse.json({ id, published: review.published });
  await db.$transaction(async (tx) => {
    await tx.marketplaceReview.update({ where: { id }, data: { published: body.published } });
    await tx.adminActionLog.create({ data: {
      adminId: admin.id, action: body.published ? "Avis de mission publié" : "Avis de mission masqué",
      entityType: "MarketplaceReview", entityId: id,
      detail: `${admin.name} a ${body.published ? "publié" : "masqué"} un avis de mission après vérification.`,
      oldStatus: review.published ? "PUBLISHED" : "HIDDEN", newStatus: body.published ? "PUBLISHED" : "HIDDEN",
    } });
  });
  await refreshTeacherPublicRating(review.teacherId);
  return NextResponse.json({ id, published: body.published });
}
