import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { deliverTeacherNotification } from "@/lib/notification-delivery";
import {
  PAYDUNYA_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";

const TEACHER_CHANNELS = ["SMS", "WHATSAPP", "EMAIL", "MANUAL_CALL", "INTERNAL", "PRIVATE_LINK"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;
const DELIVERY_STATUSES = ["DRAFT", "PENDING", "SENT", "FAILED", "READ", "CONFIRMED"] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  if (typeof value === "string" && allowed.includes(value)) return value as T[number];
  return fallback;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const channel = oneOf(body.channel, TEACHER_CHANNELS, "SMS");
  const priority = oneOf(body.priority, PRIORITIES, "NORMAL");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : `Notification - ${channel}`;

  if (!teacherId || !message) {
    return NextResponse.json({ error: "teacherId et message requis" }, { status: 400 });
  }
  if (title.length > 180) {
    return NextResponse.json({ error: "Le titre de la notification est trop long." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Le message ne doit pas dépasser 4000 caractères." }, { status: 400 });
  }

  const [teacher, booking] = await db.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
    const booking = bookingId
      ? await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            teacherId: true,
            reference: true,
            subjectName: true,
            levelName: true,
            status: true,
            paymentStatus: true,
            totalClientPays: true,
            totalPrice: true,
            paydunyaStatus: true,
            paydunyaVerifiedAt: true,
            assignedAt: true,
            clientId: true,
            client: { select: { name: true } },
            transactions: {
              where: { type: "CLIENT_PAYMENT" },
              select: { type: true, status: true, amount: true },
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : null;
    return [teacher, booking] as const;
  });
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  if (bookingId && !booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking && booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce professeur." }, { status: 400 });
  }

  const teacherName = teacher.professionalName || teacher.fullName;
  const teacherSpaceLink = bookingId
    ? `/admin/professeurs/${teacherId}?tab=cours&bookingId=${bookingId}`
    : `/admin/professeurs/${teacherId}?tab=historique`;
  const manualCallConfirmed = channel === "MANUAL_CALL" && /résultat\s*:\s*(professeur joint|disponibilité confirmée)/i.test(message);
  const manualCallUnavailable = channel === "MANUAL_CALL" && /résultat\s*:\s*indisponible/i.test(message);
  const manualCallFailed = channel === "MANUAL_CALL" && /résultat\s*:\s*numéro incorrect/i.test(message);
  const deliveryStatus = manualCallFailed ? "FAILED" : manualCallConfirmed ? "CONFIRMED" : "SENT";
  const publicStatus = manualCallFailed ? "FAILED" : manualCallConfirmed ? "CONFIRMED" : "SENT";
  const now = new Date();

  if (booking && manualCallConfirmed && requiresVerifiedPayDunyaForOperationalAction(booking)) {
    return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
  }

  const notif = await db.$transaction(async (tx) => {
    const created = await tx.teacherNotification.create({
      data: {
        teacherId,
        bookingId,
        title,
        message,
        channel,
        sent: true,
        status: deliveryStatus,
        sentById: admin.id,
        readAt: manualCallConfirmed ? now : null,
      },
    });

    await tx.teacher.update({
      where: { id: teacherId },
      data: { lastActivityAt: now },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: channel === "MANUAL_CALL" ? "Appel manuel professeur" : "Notification professeur",
        entityType: "Teacher",
        entityId: teacherId,
        detail: booking ? `${channel} - ${booking.reference} - ${message}` : `${channel} - ${message}`,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title,
        message,
        type: "TEACHER_NOTIFICATION",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel,
        status: publicStatus,
        priority,
        teacherId,
        bookingId,
        adminId: admin.id,
        sentAt: now,
        confirmedAt: manualCallConfirmed ? now : null,
        response: channel === "MANUAL_CALL" ? message : null,
        link: teacherSpaceLink,
        actionLabel: bookingId ? "Ouvrir l'espace professeur" : "Voir historique professeur",
      },
    });

    if (booking && manualCallConfirmed) {
      await tx.teacherMissionLink.updateMany({
        where: {
          teacherId,
          bookingId: booking.id,
          status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          response: `Confirmé par appel manuel service client : ${teacherName}.`,
        },
      });
      await tx.teacherTask.updateMany({
        where: { teacherId, bookingId: booking.id, type: "CONFIRM_AVAILABILITY" },
        data: { status: "CONFIRMED", completedAt: now },
      });
      if (["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"].includes(booking.status)) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "ASSIGNED", assignedAt: booking.assignedAt ?? now },
        });
      }
      await tx.notification.updateMany({
        where: {
          bookingId: booking.id,
          teacherId,
          status: { in: ["CREATED", "SENT", "RELAUNCHED"] },
          type: { in: ["TEACHER_REMINDER", "TEACHER_NOT_CONFIRMED", "REPLACEMENT_RECOMMENDED", "TEACHER_MISSION_LINK"] },
        },
        data: {
          read: true,
          readAt: now,
          status: "CONFIRMED",
          confirmedAt: now,
          response: `Clôturé automatiquement après appel manuel : ${teacherName} a confirmé.`,
        },
      });
      await tx.notification.create({
        data: {
          userId: booking.clientId,
          title: "Professeur confirmé",
          message: `${teacherName} a confirmé par appel avec le service client sa disponibilité pour votre cours de ${booking.subjectName}. Votre réservation ${booking.reference} reste suivie par Compétence.`,
          type: "TEACHER_CONFIRMED",
          recipientType: "CLIENT",
          recipientName: booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: booking.id,
          teacherId,
          clientId: booking.clientId,
          adminId: admin.id,
          sentAt: now,
          link: `/client/reservations/${booking.id}`,
          actionLabel: "Voir réservation",
        },
      });
    }

    if (booking && manualCallUnavailable) {
      await tx.teacherMissionLink.updateMany({
        where: {
          teacherId,
          bookingId: booking.id,
          status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        },
        data: {
          status: "REPLACEMENT_RECOMMENDED",
          declinedAt: now,
          response: message,
        },
      });
      await tx.teacherTask.updateMany({
        where: { teacherId, bookingId: booking.id, type: "CONFIRM_AVAILABILITY" },
        data: { status: "NOT_DONE" },
      });
      const existingReplacementTask = await tx.teacherTask.findFirst({
        where: {
          teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: { contains: "Remplacement recommandé" },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      });
      if (!existingReplacementTask) {
        await tx.teacherTask.create({
          data: {
            teacherId,
            bookingId: booking.id,
            type: "ADMIN_ACTION",
            title: "Remplacement recommandé après appel",
            description: `${teacherName} a indiqué être indisponible pour ${booking.reference}. Le service client doit avertir le client et choisir un remplaçant compatible.`,
            priority: "CRITICAL",
            status: "TODO",
            dueAt: now,
            createdById: admin.id,
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: null,
          title: "Remplacement recommandé",
          message: `${teacherName} est indisponible pour ${booking.reference} après appel manuel. Choisir un remplaçant et avertir le client.`,
          type: "REPLACEMENT_RECOMMENDED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: booking.id,
          teacherId,
          adminId: admin.id,
          sentAt: now,
          response: message,
          link: `/admin/reservations/${booking.id}?action=replace`,
          actionLabel: "Remplacer",
          actionType: "REPLACE_TEACHER",
        },
      });
    }

    if (booking && manualCallFailed) {
      await tx.teacherMissionLink.updateMany({
        where: {
          teacherId,
          bookingId: booking.id,
          status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        },
        data: {
          status: "PROBLEM_REPORTED",
          problemAt: now,
          response: message,
        },
      });
      await tx.teacherTask.create({
        data: {
          teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: "Coordonnées professeur à vérifier",
          description: `Appel manuel sur ${booking.reference} : numéro incorrect. Vérifier les coordonnées du professeur avant toute nouvelle attribution.`,
          priority: "URGENT",
          status: "TODO",
          dueAt: now,
          createdById: admin.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Numéro professeur incorrect",
          message: `Le numéro de ${teacherName} semble incorrect pour ${booking.reference}. Vérifier la fiche professeur.`,
          type: "TEACHER_CONTACT_FAILED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId: booking.id,
          teacherId,
          adminId: admin.id,
          sentAt: now,
          link: `/admin/professeurs/${teacherId}?tab=operationnel`,
          actionLabel: "Vérifier coordonnées",
        },
      });
    }

    return created;
  });
  const delivery = ["SMS", "WHATSAPP", "EMAIL"].includes(channel)
    ? await deliverTeacherNotification(notif.id)
    : null;

  return NextResponse.json({ id: notif.id, ok: true, delivery });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : "";
  const status = oneOf(body.status, DELIVERY_STATUSES, "SENT");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!id) {
    return NextResponse.json({ error: "Notification professeur requise." }, { status: 400 });
  }

  const notification = await db.teacherNotification.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
    },
  });
  if (!notification) {
    return NextResponse.json({ error: "Notification professeur introuvable." }, { status: 404 });
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.teacherNotification.update({
      where: { id },
      data: {
        status,
        sent: ["SENT", "READ", "CONFIRMED"].includes(status),
        sentById: ["SENT", "READ", "CONFIRMED"].includes(status) ? admin.id : notification.sentById,
        readAt: ["READ", "CONFIRMED"].includes(status) ? now : notification.readAt,
      },
    });
    await tx.teacher.update({
      where: { id: notification.teacherId },
      data: { lastActivityAt: now },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Statut notification professeur",
        entityType: "TeacherNotification",
        entityId: notification.id,
        detail: `${admin.name} a passé "${notification.title}" pour ${notification.teacher.professionalName || notification.teacher.fullName} à ${status}.${note ? ` Note: ${note}` : ""}`,
        oldStatus: notification.status,
        newStatus: status,
      },
    });
  });

  return NextResponse.json({ ok: true, status });
}
