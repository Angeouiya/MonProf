import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { paymentMethodLabel } from "@/lib/payment-methods";

const MAX_ADMIN_NOTE_LENGTH = 500;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
  const nextStatus = action === "cancel" ? "CANCELLED" : action === "reject" ? "REJECTED" : null;

  if (!nextStatus) {
    return NextResponse.json({ error: "Action de demande invalide." }, { status: 400 });
  }
  if (!adminNote) {
    return NextResponse.json({ error: "Un motif admin est requis." }, { status: 400 });
  }
  if (adminNote.length > MAX_ADMIN_NOTE_LENGTH) {
    return NextResponse.json({ error: `Motif trop long (${MAX_ADMIN_NOTE_LENGTH} caractères maximum).` }, { status: 400 });
  }

  const request = await db.teacherPayoutRequest.findUnique({
    where: { id },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          phone: true,
        },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Demande de paiement introuvable." }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Cette demande de paiement a déjà été traitée." }, { status: 400 });
  }

  const now = new Date();
  const teacherName = request.teacher.professionalName || request.teacher.fullName;
  const amountLabel = `${request.amount.toLocaleString("fr-FR")} FCFA`;
  const statusLabel = nextStatus === "REJECTED" ? "rejetée" : "annulée";

  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.teacherPayoutRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        adminNote,
        reviewedAt: now,
        reviewedById: admin.id,
      },
    });

    await tx.teacherNotification.create({
      data: {
        teacherId: request.teacherId,
        title: `Demande de paiement ${statusLabel} - ${request.reference}`,
        message: [
          `Bonjour ${teacherName},`,
          "",
          `Votre demande de paiement ${request.reference} de ${amountLabel} via ${paymentMethodLabel(request.method)} a été ${statusLabel} par l'administration Compétence.`,
          `Numéro déclaré : ${request.paymentPhone}`,
          "",
          `Motif admin : ${adminNote}`,
          "",
          "Vous pouvez corriger vos informations de paiement dans Paramètres puis envoyer une nouvelle demande si un montant reste payable.",
        ].join("\n"),
        channel: "WHATSAPP",
        sent: false,
        status: "PENDING",
        sentById: admin.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: `Demande paiement professeur ${statusLabel}`,
        message: `${request.reference} (${amountLabel}) pour ${teacherName} a été ${statusLabel}. Motif : ${adminNote}`,
        type: "TEACHER_PAYOUT_REQUEST_REVIEWED",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel: "WHATSAPP",
        status: "CREATED",
        priority: "NORMAL",
        teacherId: request.teacherId,
        adminId: admin.id,
        link: `/admin/professeurs/${request.teacherId}?tab=paiements&payoutRequestId=${request.id}`,
        actionLabel: "Ouvrir comptabilité",
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: `Demande de paiement professeur ${statusLabel}`,
        entityType: "TeacherPayoutRequest",
        entityId: request.id,
        detail: `${admin.name} a ${statusLabel} la demande ${request.reference} de ${amountLabel} pour ${teacherName}. Motif : ${adminNote}`,
        oldStatus: "PENDING",
        newStatus: nextStatus,
      },
    });

    return saved;
  });

  return NextResponse.json({ ok: true, request: updated });
}
