import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { teacherSanctionTypeLabel } from "@/lib/teacher-discipline-labels";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const decisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";
  if (!["apply", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  if (decisionNote.length > 700) {
    return NextResponse.json({ error: "La justification admin ne doit pas dépasser 700 caractères." }, { status: 400 });
  }

  const sanction = await db.teacherSanction.findUnique({
    where: { id },
    include: { teacher: { select: { id: true, fullName: true, professionalName: true } } },
  });
  if (!sanction) return NextResponse.json({ error: "Sanction introuvable." }, { status: 404 });
  if (sanction.status !== "PENDING_VALIDATION") {
    return NextResponse.json({ error: "Cette sanction a déjà été traitée." }, { status: 409 });
  }
  if (sanction.financial && decisionNote.length < 10) {
    return NextResponse.json({ error: "Une sanction financière doit avoir une justification admin d'au moins 10 caractères." }, { status: 400 });
  }

  const nextStatus = action === "apply" ? "APPLIED" : "CANCELLED";

  await db.$transaction(async (tx) => {
    await tx.teacherSanction.update({
      where: { id },
      data: {
        status: nextStatus,
        validatedAt: action === "apply" ? new Date() : null,
      },
    });

    if (sanction.financial && sanction.amount > 0) {
      const adjustment = await tx.teacherPaymentAdjustment.findFirst({
        where: {
          teacherId: sanction.teacherId,
          bookingId: sanction.bookingId,
          amount: sanction.amount,
          reason: sanction.reason,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });

      if (adjustment) {
        await tx.teacherPaymentAdjustment.update({
          where: { id: adjustment.id },
          data: {
            status: action === "apply" ? "APPLIED" : "CANCELLED",
            decision: action === "apply"
              ? `Retenue validée manuellement par ${admin.name}. Justification: ${decisionNote}`
              : `Retenue annulée manuellement par ${admin.name}. Justification: ${decisionNote}`,
          },
        });
      } else if (action === "apply") {
        await tx.teacherPaymentAdjustment.create({
          data: {
            teacherId: sanction.teacherId,
            bookingId: sanction.bookingId,
            amount: sanction.amount,
            reason: sanction.reason,
            decision: `Retenue créée et validée manuellement par ${admin.name} lors de la validation de sanction. Justification: ${decisionNote}`,
            status: "APPLIED",
          },
        });
      }
    }

    await tx.teacher.update({
      where: { id: sanction.teacherId },
      data: { lastActivityAt: new Date() },
    });

    await tx.teacherNotification.create({
      data: {
        teacherId: sanction.teacherId,
        bookingId: sanction.bookingId,
        title: action === "apply" ? "Sanction validée" : "Sanction annulée",
        message: [
          `Bonjour ${sanction.teacher.professionalName || sanction.teacher.fullName},`,
          "",
          action === "apply"
            ? "Une sanction a été validée par le service client."
            : "Une sanction en attente a été annulée par le service client.",
          `Motif : ${sanction.reason}`,
          sanction.financial ? `Montant de retenue : ${sanction.amount.toLocaleString("fr-FR")} FCFA` : "",
          sanction.financial ? `Décision service client : ${decisionNote}` : "",
        ].filter(Boolean).join("\n"),
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: action === "apply" ? "Sanction validée" : "Sanction annulée",
        entityType: "Teacher",
        entityId: sanction.teacherId,
        detail: `${teacherSanctionTypeLabel(sanction.type)} - ${sanction.reason}${sanction.financial ? ` (${sanction.amount} FCFA) - justification: ${decisionNote}` : decisionNote ? ` - note: ${decisionNote}` : ""}`,
        oldStatus: "PENDING_VALIDATION",
        newStatus: nextStatus,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: action === "apply" ? "Sanction professeur validée" : "Sanction professeur annulée",
        message: `${sanction.teacher.professionalName || sanction.teacher.fullName} - ${sanction.reason}`,
        type: "SANCTION",
        recipientType: "ADMIN",
        priority: sanction.financial ? "IMPORTANT" : "NORMAL",
        link: `/admin/professeurs/${sanction.teacherId}?tab=discipline`,
      },
    });
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
