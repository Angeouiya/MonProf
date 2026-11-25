import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ManagedCourseError } from "@/lib/managed-course-error";
import { enqueueNotificationEvent } from "@/lib/notification-events";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";
type Access = { token: string } | { clientId: string; dossierId: string };
async function lockParentDossier(tx: Prisma.TransactionClient, access: Access) {
  const found =
    "token" in access
      ? /^[A-Za-z0-9_-]{43}$/.test(access.token)
        ? await tx.managedCourseDossier.findUnique({
            where: {
              contractTokenHash: createHash("sha256")
                .update(access.token)
                .digest("hex"),
            },
            select: { id: true },
          })
        : null
      : await tx.managedCourseDossier.findFirst({
          where: { id: access.dossierId, clientId: access.clientId },
          select: { id: true },
        });
  if (!found)
    throw new ManagedCourseError("Dossier introuvable ou accès expiré.", 404);
  await tx.$queryRaw`SELECT id FROM "ManagedCourseDossier" WHERE id=${found.id} FOR UPDATE`;
  const dossier = await tx.managedCourseDossier.findUniqueOrThrow({
    where: { id: found.id },
  });
  if (
    "token" in access &&
    (!dossier.contractTokenExpiresAt ||
      dossier.contractTokenExpiresAt.getTime() < Date.now())
  )
    throw new ManagedCourseError("Lien expiré.", 410);
  if ("clientId" in access && dossier.clientId !== access.clientId)
    throw new ManagedCourseError("Dossier introuvable.", 404);
  return dossier;
}
export async function linkManagedParentAccount(
  token: string,
  clientId: string,
) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: clientId, role: "CLIENT", passwordMustChange: false },
      select: { id: true },
    });
    if (!user)
      throw new ManagedCourseError(
        "Connectez-vous à votre compte client avant de rattacher ce dossier.",
        401,
      );
    const dossier = await lockParentDossier(tx, { token });
    if (dossier.clientId && dossier.clientId !== clientId)
      throw new ManagedCourseError(
        "Ce dossier est déjà rattaché à un autre compte. Contactez Compétence.",
      );
    if (!dossier.clientId) {
      await tx.managedCourseDossier.update({
        where: { id: dossier.id },
        data: { clientId },
      });
      await tx.managedCourseEvent.create({
        data: {
          dossierId: dossier.id,
          actorId: clientId,
          action: "PARENT_ACCOUNT_LINKED",
          details: {
            method: "PRIVATE_LINK_POSSESSION",
            identityVerified: false,
          },
        },
      });
    }
    return { ok: true, path: "/client/accompagnement" };
  });
}
export async function confirmManagedParentSession(
  access: Access,
  sessionId: string,
) {
  const result = await db.$transaction(async (tx) => {
    const dossier = await lockParentDossier(tx, access);
    if (dossier.onHold || dossier.acceptedRevision !== dossier.revision)
      throw new ManagedCourseError(
        "La confirmation est suspendue. Contactez Compétence.",
      );
    const session = await tx.managedCourseSession.findFirst({
      where: { id: sessionId, dossierId: dossier.id },
    });
    if (!session || !session.teacherId)
      throw new ManagedCourseError("Séance introuvable.", 404);
    if (!["DONE", "VALIDATED"].includes(session.status))
      throw new ManagedCourseError(
        "Le professeur doit d’abord déclarer la séance effectuée.",
      );
    if (session.parentConfirmedAt) return { ok: true };
    const actor =
      "clientId" in access ? access.clientId : "PARENT_PRIVATE_LINK";
    const method = "clientId" in access ? "CLIENT_ACCOUNT" : "PRIVATE_LINK";
    await tx.managedCourseSession.update({
      where: { id: sessionId },
      data: { parentConfirmedAt: new Date(), parentConfirmationMethod: method },
    });
    await tx.managedCourseEvent.create({
      data: {
        dossierId: dossier.id,
        actorId: actor,
        action: "PARENT_SESSION_CONFIRMED",
        details: { sessionId, method, revision: dossier.revision },
      },
    });
    await enqueueNotificationEvent(
      {
        recipientType: "ADMIN",
        type: "MANAGED_COURSE",
        priority: "IMPORTANT",
        title: "Séance confirmée par le parent",
        message: `${dossier.reference} · séance ${session.sequence} confirmée.`,
        link: `/admin/accompagnement/${dossier.id}`,
      },
      tx,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}
