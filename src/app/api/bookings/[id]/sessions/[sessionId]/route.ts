import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { findReplacementCandidatesForBooking } from "@/lib/teacher-replacement-matching";
import { syncBookingSessionAggregates } from "@/lib/booking-sessions";

type PortalRole = "CLIENT" | "ADMIN" | "TEACHER";

function cleanReason(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 700) : "";
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 21 || minute > 59) return null;
  const pad = (number: number) => String(number).padStart(2, "0");
  return pad(hour) + ":" + pad(minute) + " - " + pad(hour + 2) + ":" + pad(minute);
}

async function addHistory(tx: any, input: {
  sessionId: string;
  actorType: PortalRole;
  actorId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  detail?: string;
  oldTeacherId?: string;
  newTeacherId?: string | null;
}) {
  await tx.bookingSessionHistory.create({
    data: {
      bookingSessionId: input.sessionId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      detail: input.detail,
      oldTeacherId: input.oldTeacherId,
      newTeacherId: input.newTeacherId,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const actorId = (auth.user as any).id as string;
  const role = (auth.user as any).role as PortalRole;
  const { id: bookingId, sessionId } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const reason = cleanReason(body.reason);

  if (role === "ADMIN" && !(await requireAdminApi("BOOKINGS_MANAGE"))) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const courseSession = await db.bookingSession.findFirst({
    where: { id: sessionId, bookingId },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      proposedTeacher: { select: { id: true, fullName: true, professionalName: true } },
      booking: {
        include: {
          client: { select: { id: true, name: true } },
          transactions: { where: { type: "CLIENT_PAYMENT" } },
        },
      },
    },
  });
  if (!courseSession) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  if (role === "CLIENT" && courseSession.booking.clientId !== actorId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (role === "TEACHER" && courseSession.teacherId !== actorId) {
    return NextResponse.json({ error: "Cette séance ne vous est pas attribuée" }, { status: 403 });
  }
  if (!hasVerifiedPayDunyaClientPayment(courseSession.booking)) {
    return NextResponse.json({ error: "Le paiement PayDunya du pack n'est pas vérifié." }, { status: 409 });
  }

  const now = new Date();
  const teacherName = courseSession.teacher.professionalName || courseSession.teacher.fullName;
  const sessionLabel = "séance " + courseSession.sequence + "/" + courseSession.booking.sessionsCount;

  if (action === "mark_done") {
    if (!["ADMIN", "TEACHER"].includes(role)) return NextResponse.json({ error: "Action non autorisée" }, { status: 403 });
    if (!["PLANNED", "TEACHER_CONFIRMED", "IN_PROGRESS"].includes(courseSession.status)) {
      return NextResponse.json({ error: "Cette séance ne peut pas être marquée terminée." }, { status: 409 });
    }
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({ where: { id: sessionId }, data: { status: "AWAITING_CLIENT_CONFIRMATION", completedAt: now } });
      await addHistory(tx, { sessionId, actorType: role, actorId, action: "SESSION_DONE", fromStatus: courseSession.status, toStatus: "AWAITING_CLIENT_CONFIRMATION" });
      await tx.notification.create({
        data: {
          userId: courseSession.booking.clientId,
          title: "Séance à confirmer",
          message: teacherName + " a déclaré la " + sessionLabel + " terminée. Confirmez-la uniquement si elle a bien été réalisée.",
          type: "SESSION_CONFIRMATION_REQUIRED",
          recipientType: "CLIENT",
          recipientName: courseSession.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId,
          teacherId: courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/client/reservations/" + bookingId + "#seances",
          actionLabel: "Confirmer la séance",
        },
      });
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "confirm") {
    if (role !== "CLIENT") return NextResponse.json({ error: "Action réservée au client" }, { status: 403 });
    if (courseSession.status !== "AWAITING_CLIENT_CONFIRMATION") {
      return NextResponse.json({ error: "Cette séance n'attend pas de confirmation." }, { status: 409 });
    }
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({
        where: { id: sessionId },
        data: { status: "RELEASED", clientValidatedAt: now, releasedAt: now, releasedAmount: courseSession.teacherNetAmount },
      });
      await addHistory(tx, {
        sessionId,
        actorType: role,
        actorId,
        action: "CLIENT_CONFIRMED",
        fromStatus: courseSession.status,
        toStatus: "RELEASED",
        detail: courseSession.teacherNetAmount + " FCFA libérés.",
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Fonds séance libérés",
          message: courseSession.booking.reference + " · " + sessionLabel + " confirmée. " + courseSession.teacherNetAmount.toLocaleString("fr-FR") + " FCFA deviennent payables à " + teacherName + ".",
          type: "SESSION_FUNDS_RELEASED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId,
          teacherId: courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/admin/reservations/" + bookingId + "#seances",
          actionLabel: "Voir la comptabilité",
        },
      });
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true, releasedAmount: courseSession.teacherNetAmount });
  }

  if (action === "reschedule") {
    if (!["ADMIN", "TEACHER"].includes(role)) return NextResponse.json({ error: "Action non autorisée" }, { status: 403 });
    const proposedDate = parseDate(body.proposedDate);
    const proposedTime = parseTime(body.proposedTime);
    if (!proposedDate || !proposedTime || reason.length < 5) {
      return NextResponse.json({ error: "Date, heure et motif du nouveau créneau requis." }, { status: 400 });
    }
    if (proposedDate.getTime() < Date.now()) return NextResponse.json({ error: "Le nouveau créneau doit être ultérieur." }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({
        where: { id: sessionId },
        data: { status: "RESCHEDULE_PROPOSED", proposedDate, proposedTime, unavailableReason: reason },
      });
      await addHistory(tx, {
        sessionId,
        actorType: role,
        actorId,
        action: "RESCHEDULE_PROPOSED",
        fromStatus: courseSession.status,
        toStatus: "RESCHEDULE_PROPOSED",
        detail: proposedDate.toLocaleDateString("fr-FR") + " " + proposedTime + ". " + reason,
      });
      await tx.notification.create({
        data: {
          userId: courseSession.booking.clientId,
          title: "Nouveau créneau proposé",
          message: teacherName + " propose de déplacer la " + sessionLabel + " au " + proposedDate.toLocaleDateString("fr-FR") + " à " + proposedTime + ".",
          type: "SESSION_RESCHEDULE_PROPOSED",
          recipientType: "CLIENT",
          recipientName: courseSession.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId,
          teacherId: courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/client/reservations/" + bookingId + "#seances",
          actionLabel: "Répondre",
        },
      });
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "accept_reschedule" || action === "reject_reschedule") {
    if (role !== "CLIENT") return NextResponse.json({ error: "Action réservée au client" }, { status: 403 });
    if (courseSession.status !== "RESCHEDULE_PROPOSED") return NextResponse.json({ error: "Aucun nouveau créneau en attente." }, { status: 409 });
    const accepted = action === "accept_reschedule";
    const replacement = accepted ? null : (await findReplacementCandidatesForBooking(bookingId, 1, {
      excludedTeacherId: courseSession.teacherId,
      scheduledDate: courseSession.scheduledDate,
      scheduledTime: courseSession.scheduledTime,
    })).items[0] ?? null;
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({
        where: { id: sessionId },
        data: accepted
          ? { status: "TEACHER_CONFIRMED", scheduledDate: courseSession.proposedDate, scheduledTime: courseSession.proposedTime, proposedDate: null, proposedTime: null }
          : {
              status: replacement ? "REPLACEMENT_PROPOSED" : "NEEDS_REPLACEMENT",
              proposedTeacherId: replacement?.teacher.id ?? null,
              proposedDate: null,
              proposedTime: null,
            },
      });
      await addHistory(tx, {
        sessionId,
        actorType: role,
        actorId,
        action: accepted ? "RESCHEDULE_ACCEPTED" : "RESCHEDULE_REJECTED",
        fromStatus: courseSession.status,
        toStatus: accepted ? "TEACHER_CONFIRMED" : replacement ? "REPLACEMENT_PROPOSED" : "NEEDS_REPLACEMENT",
        oldTeacherId: courseSession.teacherId,
        newTeacherId: replacement?.teacher.id,
      });
      if (!accepted) {
        await tx.notification.create({
          data: {
            userId: courseSession.booking.clientId,
            title: replacement ? "Professeur remplaçant proposé" : "Recherche d'un nouveau professeur",
            message: replacement
              ? `${replacement.teacher.professionalName || replacement.teacher.fullName} correspond à votre ${sessionLabel}. Vous pouvez consulter puis valider la proposition.`
              : `Aucun remplaçant compatible n'est disponible immédiatement pour la ${sessionLabel}. Le service client est alerté.`,
            type: replacement ? "SESSION_REPLACEMENT_PROPOSED" : "SESSION_REPLACEMENT_REQUIRED",
            recipientType: "CLIENT",
            recipientName: courseSession.booking.client.name,
            channel: "INTERNAL",
            status: "SENT",
            priority: "URGENT",
            bookingId,
            teacherId: replacement?.teacher.id ?? courseSession.teacherId,
            clientId: courseSession.booking.clientId,
            sentAt: now,
            link: `/client/reservations/${bookingId}#seances`,
            actionLabel: replacement ? "Voir la proposition" : "Suivre la demande",
          },
        });
      }
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true, accepted });
  }

  if (action === "unavailable") {
    if (!["ADMIN", "TEACHER"].includes(role)) return NextResponse.json({ error: "Action non autorisée" }, { status: 403 });
    if (reason.length < 5) return NextResponse.json({ error: "Expliquez brièvement l'indisponibilité." }, { status: 400 });
    const candidates = await findReplacementCandidatesForBooking(bookingId, 3, {
      excludedTeacherId: courseSession.teacherId,
      scheduledDate: courseSession.scheduledDate,
      scheduledTime: courseSession.scheduledTime,
    });
    const replacement = candidates.items[0] ?? null;
    await db.$transaction(async (tx) => {
      const nextStatus = replacement ? "REPLACEMENT_PROPOSED" : "NEEDS_REPLACEMENT";
      await tx.bookingSession.update({
        where: { id: sessionId },
        data: { status: nextStatus, proposedTeacherId: replacement?.teacher.id ?? null, unavailableReason: reason },
      });
      await addHistory(tx, {
        sessionId,
        actorType: role,
        actorId,
        action: "TEACHER_UNAVAILABLE",
        fromStatus: courseSession.status,
        toStatus: nextStatus,
        oldTeacherId: courseSession.teacherId,
        newTeacherId: replacement?.teacher.id,
        detail: reason,
      });
      await tx.notification.create({
        data: {
          userId: courseSession.booking.clientId,
          title: replacement ? "Remplaçant proposé pour une séance" : "Séance à reprogrammer",
          message: replacement
            ? (replacement.teacher.professionalName || replacement.teacher.fullName) + " est proposé pour la " + sessionLabel + ". Les autres séances restent inchangées. Aucun supplément ne vous est demandé."
            : "Le professeur est indisponible pour la " + sessionLabel + ". Le service client recherche une solution; les autres séances restent inchangées.",
          type: replacement ? "SESSION_REPLACEMENT_PROPOSED" : "SESSION_REPLACEMENT_REQUIRED",
          recipientType: "CLIENT",
          recipientName: courseSession.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId,
          teacherId: replacement?.teacher.id ?? courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/client/reservations/" + bookingId + "#seances",
          actionLabel: replacement ? "Répondre au remplacement" : "Suivre la séance",
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: replacement ? "Remplaçant automatique proposé" : "Aucun remplaçant automatique",
          message: courseSession.booking.reference + " · " + sessionLabel + ". " + reason,
          type: replacement ? "SESSION_REPLACEMENT_PROPOSED" : "SESSION_REPLACEMENT_REQUIRED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId,
          teacherId: replacement?.teacher.id ?? courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/admin/reservations/" + bookingId + "#seances",
          actionLabel: "Traiter la séance",
        },
      });
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true, replacementProposed: Boolean(replacement) });
  }

  if (action === "accept_replacement" || action === "reject_replacement") {
    if (role !== "CLIENT") return NextResponse.json({ error: "Action réservée au client" }, { status: 403 });
    if (courseSession.status !== "REPLACEMENT_PROPOSED" || !courseSession.proposedTeacherId) {
      return NextResponse.json({ error: "Aucun remplaçant en attente." }, { status: 409 });
    }
    const accepted = action === "accept_replacement";
    const proposedTeacherId = courseSession.proposedTeacherId;
    const nextReplacement = accepted ? null : (await findReplacementCandidatesForBooking(bookingId, 1, {
      excludedTeacherIds: [courseSession.teacherId, proposedTeacherId],
      scheduledDate: courseSession.scheduledDate,
      scheduledTime: courseSession.scheduledTime,
    })).items[0] ?? null;
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({
        where: { id: sessionId },
        data: accepted
          ? { status: "PLANNED", teacherId: proposedTeacherId, proposedTeacherId: null }
          : {
              status: nextReplacement ? "REPLACEMENT_PROPOSED" : "NEEDS_REPLACEMENT",
              proposedTeacherId: nextReplacement?.teacher.id ?? null,
            },
      });
      await addHistory(tx, {
        sessionId,
        actorType: role,
        actorId,
        action: accepted ? "REPLACEMENT_ACCEPTED" : "REPLACEMENT_REJECTED",
        fromStatus: courseSession.status,
        toStatus: accepted ? "PLANNED" : nextReplacement ? "REPLACEMENT_PROPOSED" : "NEEDS_REPLACEMENT",
        oldTeacherId: courseSession.teacherId,
        newTeacherId: accepted ? proposedTeacherId : nextReplacement?.teacher.id,
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: accepted ? "Remplacement de séance accepté" : nextReplacement ? "Nouvelle proposition automatique" : "Remplacement de séance refusé",
          message: accepted
            ? `${courseSession.booking.client.name} a accepté le remplaçant de la ${sessionLabel}.`
            : nextReplacement
              ? `${courseSession.booking.client.name} a refusé la première proposition. ${nextReplacement.teacher.professionalName || nextReplacement.teacher.fullName} est proposé à son tour.`
              : `${courseSession.booking.client.name} a refusé le remplaçant de la ${sessionLabel}; aucune autre correspondance immédiate.`,
          type: accepted ? "SESSION_REPLACEMENT_ACCEPTED" : nextReplacement ? "SESSION_REPLACEMENT_PROPOSED" : "SESSION_REPLACEMENT_REJECTED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId,
          teacherId: accepted ? proposedTeacherId : nextReplacement?.teacher.id ?? courseSession.teacherId,
          clientId: courseSession.booking.clientId,
          sentAt: now,
          link: "/admin/reservations/" + bookingId + "#seances",
        },
      });
      if (accepted) {
        await tx.teacherNotification.create({
          data: {
            teacherId: proposedTeacherId,
            bookingId,
            title: "Nouvelle séance attribuée",
            message: `${courseSession.booking.reference} · ${sessionLabel}. Le client a accepté votre profil. Consultez la mission et confirmez rapidement votre disponibilité.`,
            channel: "INTERNAL",
            status: "PENDING",
            sent: false,
          },
        });
      } else if (nextReplacement) {
        await tx.notification.create({
          data: {
            userId: courseSession.booking.clientId,
            title: "Nouvelle proposition de professeur",
            message: `${nextReplacement.teacher.professionalName || nextReplacement.teacher.fullName} correspond également à votre ${sessionLabel}. Vérifiez son profil puis acceptez ou refusez.`,
            type: "SESSION_REPLACEMENT_PROPOSED",
            recipientType: "CLIENT",
            recipientName: courseSession.booking.client.name,
            channel: "INTERNAL",
            status: "SENT",
            priority: "URGENT",
            bookingId,
            teacherId: nextReplacement.teacher.id,
            clientId: courseSession.booking.clientId,
            sentAt: now,
            link: `/client/reservations/${bookingId}#seances`,
            actionLabel: "Voir la nouvelle proposition",
          },
        });
      }
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true, accepted });
  }

  if (action === "open_dispute") {
    if (role !== "CLIENT") return NextResponse.json({ error: "Action réservée au client" }, { status: 403 });
    if (reason.length < 10) return NextResponse.json({ error: "Décrivez précisément le problème." }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.bookingSession.update({ where: { id: sessionId }, data: { status: "DISPUTED" } });
      await tx.dispute.create({
        data: { bookingId, bookingSessionId: sessionId, openedById: actorId, reason: "Problème sur une séance", description: reason },
      });
      await addHistory(tx, { sessionId, actorType: role, actorId, action: "DISPUTE_OPENED", fromStatus: courseSession.status, toStatus: "DISPUTED", detail: reason });
      await syncBookingSessionAggregates(tx as any, bookingId);
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
