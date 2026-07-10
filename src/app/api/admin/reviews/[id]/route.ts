import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshTeacherPublicRating } from "@/lib/reviews";
import { requireAdminApi } from "@/lib/admin-api";

const REVIEW_ADMIN_STATUSES = new Set([
  "NEW",
  "TO_REVIEW",
  "CONTACT_CLIENT",
  "CONTACT_TEACHER",
  "WARNING_SENT",
  "RESOLVED",
  "ESCALATED",
  "DISMISSED",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("REVIEWS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: {
    published?: boolean;
    adminStatus?: any;
    adminNote?: string | null;
    reviewedAt?: Date;
    reviewedById?: string;
  } = {};

  if (Object.prototype.hasOwnProperty.call(body, "published")) {
    data.published = !!body.published;
  }
  if (Object.prototype.hasOwnProperty.call(body, "adminStatus")) {
    if (typeof body.adminStatus !== "string" || !REVIEW_ADMIN_STATUSES.has(body.adminStatus)) {
      return NextResponse.json({ error: "Statut de traitement invalide." }, { status: 400 });
    }
    data.adminStatus = body.adminStatus;
    data.reviewedAt = new Date();
    data.reviewedById = admin.id;
  }
  if (Object.prototype.hasOwnProperty.call(body, "adminNote")) {
    if (body.adminNote !== null && typeof body.adminNote !== "string") {
      return NextResponse.json({ error: "Note admin invalide." }, { status: 400 });
    }
    const cleanNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
    if (cleanNote.length > 1200) {
      return NextResponse.json({ error: "La note admin ne doit pas dépasser 1200 caractères." }, { status: 400 });
    }
    data.adminNote = cleanNote || null;
    data.reviewedAt = new Date();
    data.reviewedById = admin.id;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification reçue." }, { status: 400 });
  }

  try {
    const previous = await db.review.findUnique({ where: { id }, select: { published: true, adminStatus: true, adminNote: true } });
    if (!previous) return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    const review = await db.review.update({
      where: { id },
      data,
      include: {
        teacher: { select: { fullName: true, professionalName: true } },
        client: { select: { name: true } },
        booking: { select: { reference: true } },
      },
    });
    if (typeof data.published === "boolean" && data.published !== previous.published) {
      await refreshTeacherPublicRating(review.teacherId);
    }
    await db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: typeof data.published === "boolean" && data.published !== previous.published
          ? (data.published ? "Avis publié" : "Avis masqué")
          : "Avis traité par l'admin",
        entityType: "Review",
        entityId: review.id,
        detail: `${admin.name} a mis à jour l'avis ${review.rating}/5 de ${review.client.name} sur ${review.teacher.professionalName || review.teacher.fullName} (${review.booking.reference}). Statut qualité: ${previous.adminStatus} -> ${review.adminStatus}.${review.adminNote ? ` Note: ${review.adminNote}` : ""}`,
        oldStatus: `${previous.published ? "PUBLISHED" : "HIDDEN"}:${previous.adminStatus}`,
        newStatus: `${review.published ? "PUBLISHED" : "HIDDEN"}:${review.adminStatus}`,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("REVIEWS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  try {
    const review = await db.review.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true } },
        client: { select: { name: true } },
        booking: { select: { reference: true } },
      },
    });
    await db.review.delete({ where: { id } });
    if (review) {
      await refreshTeacherPublicRating(review.teacherId);
      await db.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Avis supprimé",
          entityType: "Review",
          entityId: id,
          detail: `${admin.name} a supprimé l'avis ${review.rating}/5 de ${review.client.name} sur ${review.teacher.professionalName || review.teacher.fullName} (${review.booking.reference}).`,
          oldStatus: review.published ? "PUBLISHED" : "HIDDEN",
          newStatus: "DELETED",
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
