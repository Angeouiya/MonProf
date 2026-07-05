import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { teacherSanctionTypeLabel } from "@/lib/teacher-discipline-labels";

const sanctionImpact: Record<string, number> = {
  LIGHT: 6,
  MEDIUM: 12,
  FINANCIAL: 14,
  STRONG: 22,
};
const SANCTION_TYPES = ["LIGHT", "MEDIUM", "FINANCIAL", "STRONG"] as const;

function parseAmount(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") return Math.round(Number(value.replace(/\s/g, "")));
  return 0;
}

function isSanctionType(value: unknown): value is (typeof SANCTION_TYPES)[number] {
  return typeof value === "string" && SANCTION_TYPES.some((item) => item === value);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const type = isSanctionType(body.type) ? body.type : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const amount = parseAmount(body.amount);
  if (!teacherId || !type || !reason) {
    return NextResponse.json({ error: "teacherId, type et motif requis" }, { status: 400 });
  }
  if (reason.length > 180 || description.length > 1600) {
    return NextResponse.json({ error: "Motif ou description trop long." }, { status: 400 });
  }
  if (type === "FINANCIAL" && amount <= 0) {
    return NextResponse.json({ error: "Une sanction financière doit avoir un montant retenu positif." }, { status: 400 });
  }

  const [teacher, booking] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId } }),
    bookingId ? db.booking.findUnique({ where: { id: bookingId }, select: { id: true, teacherId: true, teacherNetAmount: true, reference: true } }) : null,
  ]);
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  if (bookingId && !booking) return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  if (booking && booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce professeur." }, { status: 400 });
  }
  if (booking && type === "FINANCIAL" && amount > booking.teacherNetAmount) {
    return NextResponse.json({ error: `La retenue dépasse le net professeur de la réservation (${booking.teacherNetAmount} FCFA).` }, { status: 400 });
  }

  const financial = type === "FINANCIAL";
  const status = financial ? "PENDING_VALIDATION" : "APPLIED";
  const impact = sanctionImpact[type] ?? 8;
  const nextStatus = type === "STRONG" ? "TEMPORARILY_SUSPENDED" : type === "MEDIUM" ? "OBSERVATION" : teacher.status;
  const nextScore = Math.max(0, teacher.qualityScore - impact);

  const sanction = await db.teacherSanction.create({
    data: {
      teacherId,
      bookingId: bookingId || null,
      type,
      reason,
      description: description || null,
      financial,
      amount: financial ? amount : 0,
      status,
      qualityImpact: impact,
      createdById: admin.id,
      validatedAt: financial ? null : new Date(),
    },
  });

  if (financial && Number(amount) > 0) {
    await db.teacherPaymentAdjustment.create({
      data: {
        teacherId,
      bookingId,
      amount,
      reason,
      decision: booking
        ? `Retenue financière en attente de validation manuelle sur ${booking.reference}.`
        : "Retenue financière globale en attente de validation manuelle.",
      status: "PENDING",
      },
    });
  }

  await db.teacher.update({
    where: { id: teacherId },
    data: {
      status: nextStatus as any,
      qualityScore: nextScore,
      badgeRecommended: false,
      lastActivityAt: new Date(),
    },
  });

  await db.teacherNotification.create({
    data: {
      teacherId,
      bookingId: bookingId || null,
      title: `Sanction professeur - ${teacherSanctionTypeLabel(type)}`,
      message: `${reason}${description ? `\n\n${description}` : ""}${financial ? "\n\nUne retenue financière est en attente de validation manuelle par le service client." : ""}`,
      channel: "INTERNAL",
      sent: true,
      status: "SENT",
      sentById: admin.id,
    },
  });

  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Sanction professeur",
      entityType: "Teacher",
      entityId: teacherId,
      detail: `${teacherSanctionTypeLabel(type)} - ${reason}${booking ? ` (${booking.reference})` : ""}${financial ? ` - retenue en attente ${amount} FCFA` : ""}`,
      oldStatus: teacher.status,
      newStatus: nextStatus,
    },
  });

  return NextResponse.json({ ok: true, id: sanction.id });
}
