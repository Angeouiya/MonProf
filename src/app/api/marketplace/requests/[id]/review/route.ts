import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { refreshTeacherPublicRating } from "@/lib/reviews";
import { detectReviewReputationRisk } from "@/lib/review-reputation";
import { enqueueNotificationEvent } from "@/lib/notification-events";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Accès client requis." }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    const rating = Number(body.rating);
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Choisissez une note de 1 à 5.");
    if (comment.length > 900 || (rating <= 3 && comment.length < 20)) {
      throw new Error("Pour une note de 1 à 3, expliquez votre avis en 20 à 900 caractères.");
    }
    const requestRow = await db.marketplaceRequest.findFirst({
      where: { id, clientId: user.id, status: "COMPLETED", assignedTeacherId: { not: null } },
      select: { id: true, reference: true, assignedTeacherId: true },
    });
    if (!requestRow?.assignedTeacherId) return NextResponse.json({ error: "Avis possible uniquement après un cours confirmé." }, { status: 409 });
    const teacherId = requestRow.assignedTeacherId;
    const risk = detectReviewReputationRisk({ rating, comment, allowDirectPayment: true });
    const created = await db.$transaction(async (tx) => {
      const review = await tx.marketplaceReview.create({ data: {
        requestId: id, clientId: user.id, teacherId, rating, comment: comment || null,
        published: !risk.isReputationRisk,
      } });
      if (risk.shouldObserveTeacher) await tx.teacher.updateMany({
        where: { id: teacherId, status: { in: ["ACTIVE", "PRIORITY", "REPLACEABLE"] } },
        data: { status: "OBSERVATION" },
      });
      await enqueueNotificationEvent({
        title: risk.isReputationRisk ? "Risque réputation professeur" : "Nouvel avis de cours",
        message: `Avis ${rating}/5 sur ${requestRow.reference}${comment ? ` : ${comment}` : "."}`,
        type: risk.isReputationRisk ? "MARKETPLACE_REPUTATION_RISK" : "MARKETPLACE_REVIEW",
        recipientType: "ADMIN", priority: risk.priority, teacherId,
        clientId: user.id, link: `/admin/marketplace/${id}`,
      }, tx);
      return review;
    });
    await refreshTeacherPublicRating(teacherId);
    await publishWebPushFlushEvent("outbox_created");
    return NextResponse.json({ id: created.id, rating }, { status: 201 });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    return NextResponse.json({ error: duplicate ? "Vous avez déjà donné un avis pour ce cours." : error instanceof Error ? error.message : "Avis impossible." }, { status: duplicate ? 409 : 400 });
  }
}
