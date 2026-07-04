import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import {
  PAYDUNYA_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";

function makeToken() {
  return randomBytes(32).toString("hex");
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const { teacherId, bookingId, instructions, expiresInHours } = body;
  if (!teacherId || !bookingId) {
    return NextResponse.json({ error: "teacherId et bookingId requis" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: true,
      client: true,
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking || booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Mission introuvable pour ce professeur" }, { status: 404 });
  }
  if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
    return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
  }
  const settingsRows = await db.setting.findMany({
    where: { key: { in: ["support_phone", "support_email"] } },
  });
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

  const token = makeToken();
  const expiresAt = new Date(Date.now() + (Number(expiresInHours) || 48) * 60 * 60 * 1000);
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  const mission = await db.teacherMissionLink.create({
    data: {
      token,
      teacherId,
      bookingId,
      title: `Mission ${booking.reference} - ${booking.subjectName}`,
      instructions: instructions || "Merci de confirmer rapidement votre disponibilité.",
      expiresAt,
      createdById: admin.id,
    },
  });

  const missionUrl = `/mission/${token}`;
  const absoluteMissionUrl = new URL(missionUrl, req.nextUrl.origin).toString();
  const dateLabel = booking.scheduledDate?.toLocaleDateString("fr-FR") ?? "À confirmer";
  const timeLabel = booking.scheduledTime || booking.preferredTime || "À confirmer";
  const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
  const locationLabel = booking.courseFormat === "ONLINE"
    ? (booking.onlineLink || "Lien en ligne à confirmer")
    : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
  const groupLabel = booking.participantsCount > 1
    ? `Petit groupe (${booking.participantsCount} participants)`
    : "Cours individuel";
  const pedagogicalDetails = [
    booking.objective ? `Objectif : ${booking.objective}` : "",
    booking.schoolProgram ? `Programme / contexte : ${booking.schoolProgram}` : "",
    booking.needDescription ? `Besoin précis : ${booking.needDescription}` : "",
    booking.message ? `Message client : ${booking.message}` : "",
  ].filter(Boolean);
  const supportDetails = [
    settings.support_phone ? `Téléphone admin : ${settings.support_phone}` : "",
    settings.support_email ? `Email admin : ${settings.support_email}` : "",
  ].filter(Boolean);
  const message = [
    `Bonjour ${teacherName},`,
    "",
    "Un cours vous a été attribué sur Compétence.",
    "",
    `Réservation : ${booking.reference}`,
    `Client : ${booking.client.name}`,
    `Contact client : ${booking.client.phone ?? "à confirmer par l'administration"}`,
    `Matière : ${booking.subjectName}`,
    `Niveau : ${booking.levelName}`,
    `Date : ${dateLabel}`,
    `Heure : ${timeLabel}`,
    `Format : ${formatLabel}`,
    `Type : ${groupLabel}`,
    `Lieu : ${locationLabel}`,
    `Nombre de séance(s) : ${booking.sessionsCount}`,
    `Montant net prévu : ${booking.teacherNetAmount.toLocaleString("fr-FR")} FCFA`,
    ...(pedagogicalDetails.length ? ["", "Détails pédagogiques :", ...pedagogicalDetails] : []),
    "",
    instructions || "Merci de confirmer rapidement votre disponibilité.",
    ...(supportDetails.length ? ["", "Contact administration :", ...supportDetails] : []),
    "",
    `Lien mission sécurisé : ${absoluteMissionUrl}`,
  ].join("\n");

  await db.teacherNotification.create({
    data: {
      teacherId,
      bookingId,
      title: `Lien mission sécurisé - ${booking.reference}`,
      message,
      channel: "PRIVATE_LINK",
      sent: true,
      status: "SENT",
      sentById: admin.id,
    },
  });
  await db.notification.create({
    data: {
      userId: null,
      title: "Lien mission professeur envoyé",
      message: `Lien privé généré pour ${teacherName} sur la réservation ${booking.reference}.`,
      type: "TEACHER_MISSION_LINK",
      recipientType: "TEACHER",
      recipientName: teacherName,
      channel: "PRIVATE_LINK",
      status: "SENT",
      priority: "IMPORTANT",
      bookingId,
      teacherId,
      adminId: admin.id,
      sentAt: new Date(),
      expiresAt,
      link: `/admin/professeurs/${teacherId}?tab=cours&bookingId=${bookingId}`,
      actionLabel: "Ouvrir l'espace professeur",
    },
  });
  await db.teacherTask.create({
    data: {
      teacherId,
      bookingId,
      type: "CONFIRM_AVAILABILITY",
      title: "Confirmer la mission via lien privé",
      description: "Le professeur doit confirmer sa disponibilité depuis le lien privé sécurisé.",
      priority: "URGENT",
      status: "SENT_TO_TEACHER",
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  });
  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Lien mission professeur créé",
      entityType: "TeacherMissionLink",
      entityId: mission.id,
      detail: `Lien mission ${booking.reference} envoyé à ${teacherName}. Expire le ${expiresAt.toLocaleString("fr-FR")}.`,
    },
  });

  return NextResponse.json({ ok: true, id: mission.id, token, url: missionUrl, absoluteUrl: absoluteMissionUrl, message, expiresAt });
}
