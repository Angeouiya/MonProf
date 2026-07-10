import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { generateReference } from "@/lib/format";

const AUDIENCES = ["ONE_CLIENT", "ONE_TEACHER", "ALL_CLIENTS", "ALL_TEACHERS", "ALL_USERS"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Accès communication refusé." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const audience = isOneOf(body.audience, AUDIENCES) ? body.audience : null;
  const priority = isOneOf(body.priority, PRIORITIES) ? body.priority : "NORMAL";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const targetUserId = typeof body.targetUserId === "string" && body.targetUserId.trim() ? body.targetUserId.trim() : null;
  const targetTeacherId = typeof body.targetTeacherId === "string" && body.targetTeacherId.trim() ? body.targetTeacherId.trim() : null;
  const link = typeof body.link === "string" && body.link.trim() ? body.link.trim().slice(0, 500) : null;
  const actionLabel = typeof body.actionLabel === "string" && body.actionLabel.trim() ? body.actionLabel.trim().slice(0, 80) : null;
  const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null;

  if (!audience || !title || !message) {
    return NextResponse.json({ error: "Audience, titre et message sont requis." }, { status: 400 });
  }
  if (title.length > 180 || message.length > 4000) {
    return NextResponse.json({ error: "Titre limité à 180 caractères et message à 4 000 caractères." }, { status: 400 });
  }
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
    return NextResponse.json({ error: "La date d'expiration doit être future." }, { status: 400 });
  }
  if (audience === "ONE_CLIENT" && !targetUserId) {
    return NextResponse.json({ error: "Sélectionnez le client destinataire." }, { status: 400 });
  }
  if (audience === "ONE_TEACHER" && !targetTeacherId) {
    return NextResponse.json({ error: "Sélectionnez le professeur destinataire." }, { status: 400 });
  }

  const includeClients = ["ONE_CLIENT", "ALL_CLIENTS", "ALL_USERS"].includes(audience);
  const includeTeachers = ["ONE_TEACHER", "ALL_TEACHERS", "ALL_USERS"].includes(audience);
  const [clients, teachers] = await Promise.all([
    includeClients
      ? db.user.findMany({
          where: audience === "ONE_CLIENT"
            ? { id: targetUserId!, role: "CLIENT" }
            : { role: "CLIENT" },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    includeTeachers
      ? db.teacher.findMany({
          where: audience === "ONE_TEACHER"
            ? { id: targetTeacherId! }
            : { status: { notIn: ["BLACKLISTED", "PERMANENTLY_SUSPENDED"] } },
          select: { id: true, fullName: true, professionalName: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  const recipientCount = clients.length + teachers.length;
  if (recipientCount === 0) {
    return NextResponse.json({ error: "Aucun destinataire valide pour cette diffusion." }, { status: 400 });
  }

  const now = new Date();
  const reference = generateReference("COM");
  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.communicationCampaign.create({
      data: {
        reference,
        title,
        message,
        audience,
        targetUserId: audience === "ONE_CLIENT" ? targetUserId : null,
        targetTeacherId: audience === "ONE_TEACHER" ? targetTeacherId : null,
        channel: "INTERNAL",
        priority,
        status: "SENDING",
        recipientCount,
        link,
        actionLabel,
        expiresAt,
        createdById: admin.id,
      },
    });

    if (clients.length) {
      await tx.notification.createMany({
        data: clients.map((client) => ({
          userId: client.id,
          title,
          message,
          type: "PLATFORM_COMMUNICATION",
          recipientType: "CLIENT" as const,
          recipientName: client.name,
          channel: "INTERNAL" as const,
          status: "SENT" as const,
          priority,
          clientId: client.id,
          adminId: admin.id,
          campaignId: created.id,
          sentAt: now,
          expiresAt,
          link: link || "/client/notifications",
          actionLabel: actionLabel || "Voir l'information",
        })),
      });
    }

    if (teachers.length) {
      await tx.teacherNotification.createMany({
        data: teachers.map((teacher) => ({
          teacherId: teacher.id,
          campaignId: created.id,
          title,
          message,
          channel: "INTERNAL",
          sent: true,
          status: "SENT" as const,
          sentById: admin.id,
        })),
      });
    }

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Communication plateforme diffusée",
        entityType: "CommunicationCampaign",
        entityId: created.id,
        detail: `${admin.name} a diffusé "${title}" à ${recipientCount} destinataire(s). Audience: ${audience}. Priorité: ${priority}.`,
        oldStatus: "DRAFT",
        newStatus: "SENT",
      },
    });

    return tx.communicationCampaign.update({
      where: { id: created.id },
      data: {
        status: "SENT",
        deliveredCount: recipientCount,
        failedCount: 0,
        sentAt: now,
      },
    });
  });

  return NextResponse.json({ ok: true, campaign });
}
