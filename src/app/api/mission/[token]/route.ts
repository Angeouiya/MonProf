import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  PAYDUNYA_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";
import { findBestReplacementCandidate } from "@/lib/teacher-replacement-matching";

const MIN_RESPONSE_LENGTH_FOR_ISSUE = 10;
const MAX_RESPONSE_LENGTH = 700;

function parseProposalDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minimumProposalDate() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function formatProposalDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const action = body.action as "confirm" | "unavailable" | "problem" | "reschedule";
  const response = typeof body.response === "string" ? body.response.trim() : "";
  const proposedDate = parseProposalDate(body.proposedDate);
  const proposedTime = typeof body.proposedTime === "string" ? body.proposedTime.trim() : "";

  if (!["confirm", "unavailable", "problem", "reschedule"].includes(action)) {
    return NextResponse.json({ error: "Action mission invalide" }, { status: 400 });
  }
  if (response.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: `Message trop long (${MAX_RESPONSE_LENGTH} caractères maximum)` }, { status: 400 });
  }
  if ((action === "unavailable" || action === "problem" || action === "reschedule") && response.length < MIN_RESPONSE_LENGTH_FOR_ISSUE) {
    return NextResponse.json({ error: "Expliquez brièvement la raison de votre réponse." }, { status: 400 });
  }
  if (action === "reschedule") {
    if (!proposedDate || !proposedTime) {
      return NextResponse.json({ error: "Date et heure proposées obligatoires." }, { status: 400 });
    }
    if (proposedDate < minimumProposalDate()) {
      return NextResponse.json({ error: "Le nouveau créneau doit être proposé au moins 24h à l'avance." }, { status: 400 });
    }
    if (proposedTime.length < 5 || proposedTime.length > 40) {
      return NextResponse.json({ error: "Créneau horaire invalide." }, { status: 400 });
    }
  }

  const mission = await db.teacherMissionLink.findUnique({
    where: { token },
    include: {
      booking: {
        include: {
          client: true,
          teacher: true,
          transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
        },
      },
      teacher: true,
    },
  });
  if (!mission) return NextResponse.json({ error: "Lien mission introuvable" }, { status: 404 });
  if (mission.expiresAt < new Date()) {
    await db.teacherMissionLink.update({ where: { id: mission.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "Ce lien mission a expiré" }, { status: 410 });
  }
  if (["CONFIRMED", "UNAVAILABLE", "PROBLEM_REPORTED", "RESCHEDULE_PROPOSED", "EXPIRED", "REPLACEMENT_RECOMMENDED"].includes(mission.status)) {
    return NextResponse.json({ error: "Cette mission a déjà reçu une réponse." }, { status: 409 });
  }
  if (requiresVerifiedPayDunyaForOperationalAction(mission.booking)) {
    return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
  }

  const now = new Date();
  const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
  if (action === "reschedule") {
    const formattedDate = formatProposalDate(proposedDate!);
    let proposalId = "";
    await db.$transaction(async (tx) => {
      await tx.bookingScheduleProposal.updateMany({
        where: { bookingId: mission.bookingId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: now, clientResponse: "Remplacée par une nouvelle proposition professeur." },
      });
      const proposal = await tx.bookingScheduleProposal.create({
        data: {
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          proposedDate: proposedDate!,
          proposedTime,
          reason: response,
        },
      });
      proposalId = proposal.id;
      await tx.teacherMissionLink.update({
        where: { id: mission.id },
        data: {
          status: "RESCHEDULE_PROPOSED",
          response: `Créneau proposé: ${formattedDate}, ${proposedTime}. Motif: ${response}`,
        },
      });
      await tx.teacherTask.updateMany({
        where: { teacherId: mission.teacherId, bookingId: mission.bookingId, type: "CONFIRM_AVAILABILITY" },
        data: { status: "CONFIRMED", completedAt: now },
      });
      await tx.teacherTask.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          title: `Créneau proposé par professeur - ${mission.booking.reference}`,
          description: `${teacherName} propose ${formattedDate} à ${proposedTime}. Motif: ${response}. Le client doit accepter ou refuser ce créneau.`,
          priority: "IMPORTANT",
          status: "TODO",
          dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        },
      });
      await tx.teacherNotification.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          title: `Créneau proposé - ${mission.booking.reference}`,
          message: `Votre proposition a été transmise au client.\nDate: ${formattedDate}\nHeure: ${proposedTime}\nMotif: ${response}`,
          channel: "PRIVATE_LINK",
          sent: true,
          status: "SENT",
          readAt: now,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Nouveau créneau proposé par le professeur",
          message: `${teacherName} propose ${formattedDate} à ${proposedTime} pour ${mission.booking.reference}. Le client doit accepter ou refuser.`,
          type: "TEACHER_RESCHEDULE_PROPOSED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          clientId: mission.booking.clientId,
          sentAt: now,
          response,
          link: `/admin/reservations/${mission.bookingId}`,
          actionLabel: "Suivre la proposition",
          actionType: "FOLLOW_RESCHEDULE_PROPOSAL",
        },
      });
      await tx.notification.create({
        data: {
          userId: mission.booking.clientId,
          title: "Nouveau créneau proposé",
          message: `${teacherName} propose de déplacer votre cours de ${mission.booking.subjectName} au ${formattedDate} à ${proposedTime}. Vous pouvez accepter ou refuser dans votre réservation.`,
          type: "TEACHER_RESCHEDULE_PROPOSED",
          recipientType: "CLIENT",
          recipientName: mission.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/client/reservations/${mission.bookingId}?proposalId=${proposal.id}`,
          actionLabel: "Répondre au créneau",
        },
      });
      await tx.clientCommunication.create({
        data: {
          clientId: mission.booking.clientId,
          bookingId: mission.bookingId,
          type: "INFORMATION",
          channel: "INTERNAL",
          subject: `Nouveau créneau proposé - ${mission.booking.reference}`,
          content: `${teacherName} propose le créneau suivant : ${formattedDate} à ${proposedTime}.\n\nMotif : ${response}\n\nVous pouvez accepter ou refuser dans votre espace client.`,
          priority: "IMPORTANT",
          status: "SENT",
        },
      });
      await tx.adminActionLog.create({
        data: {
          action: "Créneau professeur proposé",
          entityType: "BookingScheduleProposal",
          entityId: proposal.id,
          detail: `${teacherName} propose ${formattedDate} à ${proposedTime} pour ${mission.booking.reference}. Motif: ${response}`,
          oldStatus: mission.status,
          newStatus: "RESCHEDULE_PROPOSED",
        },
      });
    });
    return NextResponse.json({ ok: true, proposalId });
  }

  if (action === "confirm") {
    await db.$transaction(async (tx) => {
      await tx.teacherMissionLink.update({
        where: { id: mission.id },
        data: { status: "CONFIRMED", confirmedAt: now, response },
      });
      await tx.teacherTask.updateMany({
        where: { teacherId: mission.teacherId, bookingId: mission.bookingId, type: "CONFIRM_AVAILABILITY" },
        data: { status: "CONFIRMED", completedAt: now },
      });
      if (["CONFIRMED", "PENDING_ADMIN_VALIDATION", "PAID"].includes(mission.booking.status)) {
        await tx.booking.update({
          where: { id: mission.bookingId },
          data: {
            status: "ASSIGNED",
            assignedAt: mission.booking.assignedAt ?? now,
          },
        });
      }
      await tx.teacherNotification.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          title: `Disponibilité confirmée - ${mission.booking.reference}`,
          message: `${teacherName} a confirmé sa disponibilité. Réponse: ${response || "Confirmation simple."}`,
          channel: "PRIVATE_LINK",
          sent: true,
          status: "CONFIRMED",
          readAt: now,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Professeur confirmé",
          message: `${teacherName} a confirmé sa disponibilité pour ${mission.booking.reference}.`,
          type: "TEACHER_CONFIRMED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "CONFIRMED",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          sentAt: now,
          confirmedAt: now,
          response,
          link: `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
          actionLabel: "Ouvrir l'espace professeur",
        },
      });
      await tx.notification.create({
        data: {
          userId: mission.booking.clientId,
          title: "Professeur confirmé",
          message: `${teacherName} a confirmé sa disponibilité pour votre cours de ${mission.booking.subjectName}. Votre réservation ${mission.booking.reference} reste suivie par le service client Compétence.`,
          type: "TEACHER_CONFIRMED",
          recipientType: "CLIENT",
          recipientName: mission.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/client/reservations/${mission.bookingId}`,
          actionLabel: "Voir réservation",
        },
      });
      await tx.notification.updateMany({
        where: {
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          status: { in: ["CREATED", "SENT", "RELAUNCHED"] },
          type: {
            in: [
              "TEACHER_REMINDER",
              "TEACHER_NOT_CONFIRMED",
              "REPLACEMENT_RECOMMENDED",
              "TEACHER_MISSION_LINK",
            ],
          },
        },
        data: {
          read: true,
          readAt: now,
          status: "CONFIRMED",
          confirmedAt: now,
          response: `Clôturé automatiquement : ${teacherName} a confirmé la mission.`,
        },
      });
      await tx.teacherNotification.updateMany({
        where: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          status: { in: ["DRAFT", "PENDING", "SENT"] },
          title: { contains: mission.booking.reference },
        },
        data: {
          status: "CONFIRMED",
          readAt: now,
        },
      });
      await tx.teacherTask.updateMany({
        where: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
          title: { contains: "Remplacement recommandé" },
        },
        data: {
          status: "CANCELLED",
          completedAt: now,
        },
      });
      await tx.adminActionLog.create({
        data: {
          action: "Mission professeur confirmée",
          entityType: "TeacherMissionLink",
          entityId: mission.id,
          detail: `${teacherName} a confirmé la mission ${mission.booking.reference}${response ? `: ${response}` : "."}`,
          oldStatus: mission.status,
          newStatus: "CONFIRMED",
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  const status = action === "unavailable" ? "UNAVAILABLE" : "PROBLEM_REPORTED";
  const autoReplacement = await findBestReplacementCandidate(mission.bookingId);
  await db.$transaction(async (tx) => {
    await tx.teacherMissionLink.update({
      where: { id: mission.id },
      data: {
        status,
        declinedAt: action === "unavailable" ? now : null,
        problemAt: action === "problem" ? now : null,
        response,
      },
    });
    await tx.teacherTask.updateMany({
      where: { teacherId: mission.teacherId, bookingId: mission.bookingId, type: "CONFIRM_AVAILABILITY" },
      data: { status: action === "unavailable" ? "NOT_DONE" : "LATE" },
    });
    const existingReplacementTask = await tx.teacherTask.findFirst({
      where: {
        bookingId: mission.bookingId,
        type: "ADMIN_ACTION",
        priority: "CRITICAL",
        status: { notIn: ["DONE", "CANCELLED"] },
        title: { contains: action === "unavailable" ? "Remplacer" : "problème" },
      },
    });
    if (!existingReplacementTask) {
      await tx.teacherTask.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          title: action === "unavailable" ? "Remplacer le professeur indisponible" : "Traiter le problème signalé",
          description: `${teacherName} a répondu sur la mission ${mission.booking.reference}: ${response || status}. Remplacement recommandé.`,
          priority: "CRITICAL",
          status: "TODO",
          dueAt: now,
        },
      });
    }
    await tx.teacherNotification.create({
      data: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: action === "unavailable" ? `Indisponibilité déclarée - ${mission.booking.reference}` : `Problème signalé - ${mission.booking.reference}`,
        message: response || status,
        channel: "PRIVATE_LINK",
        sent: true,
        status: "SENT",
        readAt: now,
      },
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: action === "unavailable" ? "Professeur indisponible" : "Problème signalé par le professeur",
        message: `${teacherName} a répondu sur la mission ${mission.booking.reference}: ${response || status}. Remplacement recommandé.`,
        type: action === "unavailable" ? "REPLACEMENT_RECOMMENDED" : "TEACHER_PROBLEM",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "CRITICAL",
        bookingId: mission.bookingId,
        teacherId: mission.teacherId,
        sentAt: now,
        response,
        link: action === "unavailable"
          ? `/admin/reservations/${mission.bookingId}?action=replace`
          : `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
        actionLabel: action === "unavailable" ? "Remplacer le professeur" : "Traiter le problème",
        actionType: action === "unavailable" ? "REPLACE_TEACHER" : "HANDLE_TEACHER_PROBLEM",
      },
    });
    if (autoReplacement.candidate) {
      const newTeacher = autoReplacement.candidate.teacher;
      const newTeacherName = newTeacher.professionalName || newTeacher.fullName;
      const dateLabel = mission.booking.scheduledDate?.toLocaleDateString("fr-FR") ?? "À confirmer";
      const timeLabel = mission.booking.scheduledTime || mission.booking.preferredTime || "À confirmer";
      const formatLabel = mission.booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
      const financialImpact = autoReplacement.candidate.financialImpact;
      const clientMessage = [
        `Bonjour ${mission.booking.client.name},`,
        "",
        `${teacherName} n'est pas disponible pour votre cours de ${mission.booking.subjectName}.`,
        "Compétence vous propose automatiquement un professeur compatible.",
        "",
        `Nouveau professeur proposé : ${newTeacherName}`,
        `Matière : ${mission.booking.subjectName}`,
        `Niveau : ${mission.booking.levelName}`,
        `Date : ${dateLabel}`,
        `Heure : ${timeLabel}`,
        `Format : ${formatLabel}`,
        autoReplacement.candidate.transportRouteLabel ? `Trajet : ${autoReplacement.candidate.transportRouteLabel}` : "",
        `Montant professeur ajusté : ${autoReplacement.candidate.netAmount.toLocaleString("fr-FR")} FCFA`,
        "",
        "Votre paiement reste sécurisé. Vous pouvez accepter ce professeur ou refuser la proposition depuis votre réservation.",
      ].filter(Boolean).join("\n");
      await tx.teacherReplacement.updateMany({
        where: {
          bookingId: mission.bookingId,
          status: { in: ["DRAFT", "CLIENT_NOTIFIED"] },
        },
        data: {
          status: "CANCELLED",
          details: "Remplacée par une nouvelle proposition automatique.",
        },
      });
      const replacement = await tx.teacherReplacement.create({
        data: {
          bookingId: mission.bookingId,
          oldTeacherId: mission.teacherId,
          newTeacherId: newTeacher.id,
          reason: action === "unavailable" ? "UNAVAILABLE" : "QUALITY_ISSUE",
          details: `Proposition automatique après réponse professeur: ${response || status}. Score compatibilité ${autoReplacement.candidate.compatibility.score}/100. Critères: ${autoReplacement.candidate.matchReasons.join(", ") || "compatibilité générale"}.`,
          financialImpact,
          clientMessage,
          oldTeacherMessage: `${teacherName} a été retiré de la proposition opérationnelle ${mission.booking.reference}. Motif: ${response || status}.`,
          newTeacherMessage: `${newTeacherName} est proposé automatiquement pour ${mission.booking.reference}. Le lien mission sera envoyé après acceptation du client.`,
          status: "CLIENT_NOTIFIED",
        },
      });
      await tx.notification.create({
        data: {
          userId: mission.booking.clientId,
          title: "Nouveau professeur proposé",
          message: clientMessage,
          type: "AUTO_REPLACEMENT_PROPOSED",
          recipientType: "CLIENT",
          recipientName: mission.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId: mission.bookingId,
          teacherId: newTeacher.id,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/client/reservations/${mission.bookingId}?replacementId=${replacement.id}`,
          actionLabel: "Répondre à la proposition",
          actionType: "RESPOND_REPLACEMENT_PROPOSAL",
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Remplaçant proposé automatiquement",
          message: `${newTeacherName} a été proposé automatiquement au client pour remplacer ${teacherName} sur ${mission.booking.reference}. Score compatibilité ${autoReplacement.candidate.compatibility.score}/100.`,
          type: "AUTO_REPLACEMENT_PROPOSED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId: mission.bookingId,
          teacherId: newTeacher.id,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${mission.bookingId}`,
          actionLabel: "Suivre proposition",
          actionType: "FOLLOW_REPLACEMENT_PROPOSAL",
        },
      });
      await tx.clientCommunication.create({
        data: {
          clientId: mission.booking.clientId,
          bookingId: mission.bookingId,
          type: "TEACHER_CHANGE",
          channel: "INTERNAL",
          subject: `Nouveau professeur proposé - ${mission.booking.reference}`,
          content: clientMessage,
          priority: "URGENT",
          status: "SENT",
        },
      });
      await tx.teacherTask.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          title: `Suivre réponse client - remplaçant proposé ${mission.booking.reference}`,
          description: `${newTeacherName} a été proposé automatiquement. Si le client refuse, choisir un autre profil ou confirmer l'annulation/remboursement.`,
          priority: "URGENT",
          status: "TODO",
          dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        },
      });
      await tx.adminActionLog.create({
        data: {
          action: "Remplacement automatique proposé",
          entityType: "TeacherReplacement",
          entityId: replacement.id,
          detail: `${newTeacherName} proposé automatiquement pour ${mission.booking.reference}. Ancien professeur: ${teacherName}. Score ${autoReplacement.candidate.compatibility.score}/100. Impact: ${financialImpact} FCFA.`,
          oldStatus: mission.teacherId,
          newStatus: newTeacher.id,
        },
      });
    } else {
      await tx.notification.create({
        data: {
          userId: null,
          title: "Aucun remplaçant automatique trouvé",
          message: `Aucun professeur compatible n'a été trouvé automatiquement pour ${mission.booking.reference}. Le service client doit proposer un nouveau professeur, un nouveau créneau ou annuler/rembourser.`,
          type: "AUTO_REPLACEMENT_NOT_FOUND",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${mission.bookingId}?action=replace`,
          actionLabel: "Traiter manuellement",
          actionType: "REPLACE_TEACHER",
        },
      });
    }
    await tx.adminActionLog.create({
      data: {
        action: action === "unavailable" ? "Mission professeur refusée" : "Problème mission signalé",
        entityType: "TeacherMissionLink",
        entityId: mission.id,
        detail: `${teacherName} a répondu ${status} pour ${mission.booking.reference}${response ? `: ${response}` : "."}`,
        oldStatus: mission.status,
        newStatus: status,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
