import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const campaign = await db.communicationCampaign.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });

  const now = new Date();
  await db.$transaction(async (tx) => {
    const [clientNotifications, teacherNotifications] = await Promise.all([
      tx.notification.findMany({ where: { campaignId: id }, select: { id: true } }),
      tx.teacherNotification.findMany({ where: { campaignId: id }, select: { id: true } }),
    ]);
    await tx.communicationCampaign.update({
      where: { id },
      data: { deletedAt: now, status: campaign.status === "SENDING" ? "CANCELLED" : campaign.status },
    });
    await tx.notification.updateMany({ where: { campaignId: id }, data: { deletedAt: now, read: true, readAt: now } });
    await tx.teacherNotification.updateMany({ where: { campaignId: id }, data: { deletedAt: now, readAt: now, status: "READ" } });
    await tx.webPushOutbox.updateMany({
      where: {
        OR: [
          { notificationId: { in: clientNotifications.map((notification) => notification.id) } },
          { teacherNotificationId: { in: teacherNotifications.map((notification) => notification.id) } },
        ],
        status: { in: ["PENDING", "PROCESSING", "FAILED", "PARTIAL"] },
      },
      data: { status: "DEAD", processedAt: now, lastError: "Campagne communication supprimée par l'administration." },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Campagne communication supprimée",
        entityType: "CommunicationCampaign",
        entityId: id,
        detail: `${admin.name} a masqué la campagne "${campaign.title}" et ses notifications liées.`,
        oldStatus: campaign.status,
        newStatus: "DELETED",
      },
    });
  });

  return NextResponse.json({ ok: true });
}
