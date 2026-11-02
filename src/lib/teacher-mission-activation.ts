import "server-only";

import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { absoluteAppUrl } from "@/lib/public-url";

type TeacherMissionActivationInput = {
  bookingId: string;
  teacherId: string;
  now?: Date;
  priority?: "IMPORTANT" | "URGENT";
  sourceLabel: string;
  scopeLabel?: string;
  scheduledDate?: Date | null;
  scheduledTime?: string | null;
  teacherNetAmount?: number;
  instructions?: string;
};

/**
 * Opens the professor-side operational workflow for an already verified order.
 * The caller must first prove the provider payment (or a paid replacement) and
 * must run this helper inside the same transaction as the booking transition.
 */
export async function ensureTeacherMissionActivationInTransaction(
  tx: Prisma.TransactionClient,
  input: TeacherMissionActivationInput,
) {
  const now = input.now ?? new Date();
  const booking = await tx.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      client: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!booking) throw new Error("Réservation introuvable pendant l'activation professeur.");

  const teacher = booking.teacherId === input.teacherId
    ? booking.teacher
    : await tx.teacher.findUnique({
        where: { id: input.teacherId },
        select: { id: true, fullName: true, professionalName: true },
      });
  if (!teacher) throw new Error("Professeur introuvable pendant l'activation de la mission.");

  const teacherName = teacher.professionalName || teacher.fullName;
  const scheduledDate = input.scheduledDate ?? booking.scheduledDate ?? booking.startDate;
  const scheduledTime = input.scheduledTime || booking.scheduledTime || booking.preferredTime || "À confirmer";
  const dateLabel = scheduledDate?.toLocaleDateString("fr-FR") ?? "À confirmer";
  const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
  const locationLabel = booking.courseFormat === "ONLINE"
    ? (booking.onlineLink || "Lien en ligne à confirmer")
    : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
  const scopeLabel = input.scopeLabel || `${booking.sessionsCount} séance(s)`;
  const teacherNetAmount = Math.max(0, input.teacherNetAmount ?? booking.teacherNetAmount);
  const instructions = input.instructions || "Merci de confirmer rapidement votre disponibilité ou de signaler un problème.";

  let mission = await tx.teacherMissionLink.findFirst({
    where: {
      bookingId: booking.id,
      teacherId: teacher.id,
      status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!mission) {
    const token = randomBytes(32).toString("hex");
    mission = await tx.teacherMissionLink.create({
      data: {
        token,
        teacherId: teacher.id,
        bookingId: booking.id,
        title: `Mission ${booking.reference} - ${booking.subjectName}`,
        instructions,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      },
    });
  }

  const existingTask = await tx.teacherTask.findFirst({
    where: {
      teacherId: teacher.id,
      bookingId: booking.id,
      type: "CONFIRM_AVAILABILITY",
      status: { notIn: ["DONE", "CANCELLED", "CONFIRMED"] },
    },
    select: { id: true },
  });
  if (!existingTask) {
    await tx.teacherTask.create({
      data: {
        teacherId: teacher.id,
        bookingId: booking.id,
        type: "CONFIRM_AVAILABILITY",
        title: `Confirmer la commande - ${booking.reference}`,
        description: [
          `${input.sourceLabel}.`,
          `${booking.subjectName} (${booking.levelName}) avec ${booking.client.name}.`,
          `Date : ${dateLabel}. Heure : ${scheduledTime}. Format : ${formatLabel}.`,
          `Lieu : ${locationLabel}. Mission : ${scopeLabel}.`,
        ].join(" "),
        priority: input.priority ?? "IMPORTANT",
        status: "SENT_TO_TEACHER",
        dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      },
    });
  }

  const notificationTitle = `Nouvelle commande à confirmer - ${booking.reference}`;
  const existingNotification = await tx.teacherNotification.findFirst({
    where: {
      teacherId: teacher.id,
      bookingId: booking.id,
      title: notificationTitle,
    },
    select: { id: true },
  });
  if (!existingNotification) {
    await tx.teacherNotification.create({
      data: {
        teacherId: teacher.id,
        bookingId: booking.id,
        title: notificationTitle,
        message: [
          `Bonjour ${teacherName},`,
          "",
          `${input.sourceLabel}. La commande est maintenant visible dans votre espace Compétence.`,
          `Réservation : ${booking.reference}`,
          `Client : ${booking.client.name}`,
          `Contact client : ${booking.client.phone || "à confirmer"}`,
          `Cours : ${booking.subjectName}`,
          `Niveau : ${booking.levelName}`,
          `Date : ${dateLabel}`,
          `Heure : ${scheduledTime}`,
          `Format : ${formatLabel}`,
          `Lieu : ${locationLabel}`,
          `Mission : ${scopeLabel}`,
          `Montant net prévu : ${teacherNetAmount.toLocaleString("fr-FR")} FCFA`,
          "",
          instructions,
          `Ouvrir la mission : ${absoluteAppUrl(`/professeur/missions/${booking.id}`)}`,
        ].join("\n"),
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
      },
    });
  }

  return { booking, teacher, mission };
}

export async function ensureJekoPaymentStakeholderNotificationsInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    providerReference: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const booking = await tx.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      teacher: { select: { fullName: true, professionalName: true } },
      client: { select: { id: true, name: true } },
    },
  });
  if (!booking) throw new Error("Réservation introuvable pendant la notification Jèko.");

  const existing = await tx.notification.findMany({
    where: {
      bookingId: booking.id,
      type: "PAYMENT_RECEIVED",
      recipientType: { in: ["CLIENT", "ADMIN"] },
    },
    select: { recipientType: true },
  });
  const recipients = new Set(existing.map((item) => item.recipientType));
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;

  if (!recipients.has("CLIENT")) {
    await tx.notification.create({
      data: {
        userId: booking.clientId,
        title: "Paiement Jèko confirmé",
        message: `Votre paiement pour ${booking.reference} est confirmé après vérification serveur. Le professeur reçoit maintenant la commande et doit confirmer sa disponibilité.`,
        type: "PAYMENT_RECEIVED",
        recipientType: "CLIENT",
        recipientName: booking.client.name,
        channel: "INTERNAL",
        status: "SENT",
        priority: "IMPORTANT",
        bookingId: booking.id,
        teacherId: booking.teacherId,
        clientId: booking.clientId,
        sentAt: now,
        link: `/client/reservations/${booking.id}`,
        actionLabel: "Suivre la commande",
      },
    });
  }

  if (!recipients.has("ADMIN")) {
    await tx.notification.create({
      data: {
        userId: null,
        title: "Paiement Jèko vérifié",
        message: `${booking.client.name} a payé ${booking.reference}. Preuve serveur Jèko confirmée ; mission transmise à ${teacherName}. Référence : ${input.providerReference}.`,
        type: "PAYMENT_RECEIVED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "IMPORTANT",
        bookingId: booking.id,
        teacherId: booking.teacherId,
        clientId: booking.clientId,
        sentAt: now,
        link: `/admin/reservations/${booking.id}`,
        actionLabel: "Ouvrir la commande",
      },
    });
  }
}
