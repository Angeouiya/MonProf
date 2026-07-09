import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { teacherWarningLevelLabel, teacherWarningReasonLabel } from "@/lib/teacher-discipline-labels";

const warningImpact: Record<string, number> = {
  SIMPLE_REMINDER: 4,
  OFFICIAL_WARNING: 8,
  FINAL_WARNING: 12,
  SUSPENSION_WARNING: 18,
};
const WARNING_LEVELS = ["SIMPLE_REMINDER", "OFFICIAL_WARNING", "FINAL_WARNING", "SUSPENSION_WARNING"] as const;
const WARNING_REASONS = [
  "LATE_TO_COURSE",
  "UNJUSTIFIED_ABSENCE",
  "POOR_COURSE_QUALITY",
  "BAD_CLIENT_COMMUNICATION",
  "SCHEDULE_NOT_RESPECTED",
  "REPEATED_CANCELLATION",
  "DIRECT_CONTACT_OUTSIDE_PLATFORM",
  "UNPROFESSIONAL_BEHAVIOR",
  "CLIENT_COMPLAINT",
  "UNJUSTIFIED_REFUSAL",
  "LACK_OF_AVAILABILITY",
  "ADMIN_INSTRUCTIONS_NOT_RESPECTED",
  "OTHER",
] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | "" {
  return typeof value === "string" && allowed.some((item) => item === value) ? value as T[number] : "";
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const level = oneOf(body.level, WARNING_LEVELS);
  const reason = oneOf(body.reason, WARNING_REASONS);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const evidenceUrl = typeof body.evidenceUrl === "string" ? body.evidenceUrl.trim() : "";
  const requestedAction = typeof body.requestedAction === "string" ? body.requestedAction.trim() : "";
  const responseDueAt = typeof body.responseDueAt === "string" && body.responseDueAt ? new Date(body.responseDueAt) : null;
  const adminOnly = Boolean(body.adminOnly);
  if (!teacherId || !level || !reason || !description) {
    return NextResponse.json({ error: "teacherId, niveau, motif et description requis" }, { status: 400 });
  }
  if (description.length < 10) {
    return NextResponse.json({ error: "La description doit contenir au moins 10 caractères." }, { status: 400 });
  }
  if (description.length > 2000 || requestedAction.length > 700 || evidenceUrl.length > 500) {
    return NextResponse.json({ error: "Description, action demandée ou preuve trop longue." }, { status: 400 });
  }
  if (responseDueAt && Number.isNaN(responseDueAt.getTime())) {
    return NextResponse.json({ error: "Délai de réponse invalide." }, { status: 400 });
  }

  const [teacher, booking] = await db.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
    const booking = bookingId
      ? await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, teacherId: true, reference: true, subjectName: true, levelName: true } })
      : null;
    return [teacher, booking] as const;
  });
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  if (bookingId && !booking) return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  if (booking && booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce professeur." }, { status: 400 });
  }

  const impact = warningImpact[level] ?? 6;
  const nextStatus = level === "FINAL_WARNING" ? "OBSERVATION" : level === "SUSPENSION_WARNING" ? "TEMPORARILY_SUSPENDED" : teacher.status;
  const nextScore = Math.max(0, teacher.qualityScore - impact);

  const warning = await db.teacherWarning.create({
    data: {
      teacherId,
      bookingId,
      level,
      reason,
      description,
      evidenceUrl: evidenceUrl || null,
      requestedAction: requestedAction || null,
      responseDueAt,
      adminOnly,
      sentToTeacher: !adminOnly,
      qualityImpact: impact,
      createdById: admin.id,
    },
  });

  await db.teacher.update({
    where: { id: teacherId },
    data: {
      status: nextStatus as any,
      qualityScore: nextScore,
      badgeRecommended: level === "SIMPLE_REMINDER" ? teacher.badgeRecommended : false,
      lastActivityAt: new Date(),
    },
  });

  if (!adminOnly) {
    const teacherName = teacher.professionalName || teacher.fullName;
    const levelLabel = teacherWarningLevelLabel(level);
    const reasonLabel = teacherWarningReasonLabel(reason);
    await db.teacherNotification.create({
      data: {
        teacherId,
        bookingId,
        title: `Avertissement professeur - ${levelLabel}`,
        message: [
          `Bonjour ${teacherName},`,
          "",
          "Un avertissement a été enregistré par le service client Compétence.",
          booking ? `Réservation : ${booking.reference}` : "",
          booking ? `Cours : ${booking.subjectName} - ${booking.levelName}` : "",
          `Niveau : ${levelLabel}`,
          `Motif : ${reasonLabel}`,
          "",
          description,
          requestedAction ? `\nAction demandée : ${requestedAction}` : "",
          responseDueAt ? `Délai de réponse : ${responseDueAt.toLocaleString("fr-FR")}` : "",
          evidenceUrl ? `Preuve / document : ${evidenceUrl}` : "",
        ].filter(Boolean).join("\n"),
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    });
  }

  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Avertissement professeur",
      entityType: "Teacher",
      entityId: teacherId,
      detail: `${teacherWarningLevelLabel(level)} - ${teacherWarningReasonLabel(reason)}${booking ? ` (${booking.reference})` : ""}: ${description}${adminOnly ? " [interne admin]" : ""}`,
      oldStatus: teacher.status,
      newStatus: nextStatus,
    },
  });

  return NextResponse.json({ ok: true, id: warning.id });
}
