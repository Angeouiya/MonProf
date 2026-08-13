import { db } from "@/lib/db";
import { enqueueNotificationEvent } from "@/lib/notification-events";
import { flushWebPushOutbox } from "@/lib/web-push";
import { getWebPushActor } from "@/lib/web-push-actor";

export async function runCurrentActorWebPushTest() {
  const actor = await getWebPushActor();
  if (!actor) {
    return { ok: false, status: 401, error: "Non autorisé" };
  }

  const subscriptionWhere = actor.kind === "TEACHER"
    ? { teacherId: actor.teacherId, enabled: true, revokedAt: null }
    : { userId: actor.userId, enabled: true, revokedAt: null };
  const activeDevices = await db.webPushSubscription.count({ where: subscriptionWhere });
  if (activeDevices === 0) {
    return {
      ok: false,
      status: 409,
      code: "NO_ACTIVE_DEVICE",
      activeDevices,
      error: "Aucun appareil push actif pour ce compte. Activez d'abord les notifications sur ce téléphone ou ce navigateur.",
    };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await enqueueNotificationEvent({
    title: "Test notification Compétence",
    message: "Si vous voyez cette alerte, les notifications push Compétence sont bien actives sur cet appareil.",
    type: "WEB_PUSH_DEVICE_TEST",
    recipientType: actor.kind,
    recipientName: actor.kind === "TEACHER" ? "Professeur Compétence" : "Compte Compétence",
    channel: "PWA",
    priority: "URGENT",
    link: actor.kind === "TEACHER" ? "/professeur/notifications" : actor.kind === "ADMIN" ? "/admin/notifications/sante" : "/client/notifications",
    actionLabel: "Ouvrir",
    userId: actor.kind === "TEACHER" ? null : actor.userId,
    teacherId: actor.kind === "TEACHER" ? actor.teacherId : null,
    clientId: actor.kind === "CLIENT" ? actor.userId : null,
    expiresAt,
  });

  const flush = await flushWebPushOutbox(50);
  const delivered = flush.deliveriesAccepted > 0 || flush.sent > 0;
  return {
    ok: delivered,
    status: 200,
    activeDevices,
    flush,
    message: delivered
      ? "Notification test envoyée. Elle doit apparaître via le système du téléphone ou du navigateur."
      : "Notification test créée, mais aucun provider push ne l'a encore acceptée. Consultez Santé push pour le détail.",
  };
}
