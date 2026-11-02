import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueueNotificationEvent } from "@/lib/notification-events";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";
import { MARKETPLACE_COMMISSION_BPS, MARKETPLACE_OFFER_TTL_MS, isWithinStartWindow, teacherAvailableInGrid } from "@/lib/marketplace-core";
import { findMarketplaceCandidates, type MarketplaceSearchInput } from "@/lib/marketplace-search";
import { assertTeacherScheduleAvailable, lockTeacherSchedule } from "@/lib/teacher-schedule-conflicts";
import { scheduleSlotsConflict } from "@/lib/schedule-conflict-core";
import { teacherSupportsJourney } from "@/lib/teacher-journeys";

export class MarketplaceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "MarketplaceError";
  }
}

function codeSecret() {
  const secret = process.env.MARKETPLACE_START_CODE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Secret du code de séance manquant ou trop court.");
  return secret;
}

export function marketplaceStartCode(requestId: string) {
  const digest = createHmac("sha256", codeSecret()).update(`marketplace-start:${requestId}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

function startCodeMatches(requestId: string, supplied: string) {
  if (!/^\d{6}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(marketplaceStartCode(requestId)), Buffer.from(supplied));
}

async function notifyNextTeacher(teacherId: string, requestId: string, expiresAt: Date, tx: Prisma.TransactionClient) {
  await enqueueNotificationEvent({
    title: "Nouvelle demande de cours",
    message: "Une mission compatible est disponible. Consultez-la avant l’expiration de l’offre.",
    type: "MARKETPLACE_OFFER",
    recipientType: "TEACHER",
    teacherId,
    link: `/professeur/marche/${requestId}`,
    priority: "IMPORTANT",
    expiresAt,
  }, tx);
}

export async function createMarketplaceRequest(clientId: string, input: MarketplaceSearchInput & {
  clientKey: string;
  preferredTeacherId?: string | null;
  addressHint?: string | null;
  objective?: string | null;
}) {
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.clientKey)) throw new MarketplaceError("Identifiant de demande invalide.");
  const existing = await db.marketplaceRequest.findUnique({
    where: { clientId_clientKey: { clientId, clientKey: input.clientKey } },
  });
  if (existing) return existing;
  const recent = await db.marketplaceRequest.count({
    where: { clientId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  if (recent >= 5) throw new MarketplaceError("Vous avez déjà envoyé plusieurs demandes. Réessayez plus tard.", 429);
  const candidates = await findMarketplaceCandidates(input);
  if (!candidates.length) throw new MarketplaceError("Aucun professeur disponible pour ce créneau. Essayez un autre horaire ou une autre zone.", 409);
  const preferred = input.preferredTeacherId
    ? candidates.find((item) => item.teacherId === input.preferredTeacherId)
    : candidates[0];
  if (!preferred) throw new MarketplaceError("Ce professeur n’est plus disponible. Relancez la recherche.", 409);
  // Une réattribution automatique ne peut jamais augmenter le prix annoncé.
  const ordered = [preferred, ...candidates.filter((item) => item.teacherId !== preferred.teacherId && item.totalClientPrice <= preferred.totalClientPrice)];
  const expiresAt = new Date(Date.now() + MARKETPLACE_OFFER_TTL_MS);
  let request;
  try { request = await db.$transaction(async (tx) => {
    const created = await tx.marketplaceRequest.create({
      data: {
        reference: `MC-${randomUUID().slice(0, 8).toUpperCase()}`,
        clientId,
        clientKey: input.clientKey,
        journey: input.journey,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        levelId: input.levelId,
        levelName: input.levelName,
        courseFormat: input.courseFormat,
        commune: input.commune,
        quartier: input.quartier,
        addressHint: input.addressHint?.trim().slice(0, 240) || null,
        objective: input.objective?.trim().slice(0, 800) || null,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        durationMinutes: input.durationMinutes,
        courseAmount: preferred.courseAmount,
        transportFee: preferred.transportFee,
        totalClientPrice: preferred.totalClientPrice,
        commissionRateBps: MARKETPLACE_COMMISSION_BPS,
        commissionAmount: preferred.commissionAmount,
        status: "OFFERED",
        offerExpiresAt: expiresAt,
        offers: {
          create: ordered.map((candidate, rank) => ({
            teacherId: candidate.teacherId,
            rank,
            transportFee: candidate.transportFee,
            totalClientPrice: candidate.totalClientPrice,
            status: rank === 0 ? "PENDING" : "QUEUED",
            expiresAt,
          })),
        },
      },
    });
    await notifyNextTeacher(preferred.teacherId, created.id, expiresAt, tx);
    return created;
  }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const prior = await db.marketplaceRequest.findUnique({
        where: { clientId_clientKey: { clientId, clientKey: input.clientKey } },
      });
      if (prior) return prior;
    }
    throw error;
  }
  await publishWebPushFlushEvent("outbox_created");
  return request;
}

async function lockRequest(tx: Prisma.TransactionClient, requestId: string) {
  await tx.$queryRaw`SELECT "id" FROM "MarketplaceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
  const request = await tx.marketplaceRequest.findUnique({
    where: { id: requestId },
    include: { offers: { orderBy: { rank: "asc" } } },
  });
  if (!request) throw new MarketplaceError("Demande introuvable.", 404);
  return request;
}

export async function advanceMarketplaceOffer(requestId: string, teacherId?: string) {
  const result = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.status !== "OFFERED") throw new MarketplaceError("Cette demande n’attend plus de réponse.", 409);
    const active = request.offers.find((offer) => offer.status === "PENDING");
    if (!active || (teacherId && active.teacherId !== teacherId)) throw new MarketplaceError("Cette offre n’est plus active.", 409);
    const now = new Date();
    if (!teacherId && active.expiresAt > now) return { status: "waiting" as const };
    await tx.marketplaceOffer.update({
      where: { id: active.id },
      data: { status: teacherId ? "DECLINED" : "EXPIRED", respondedAt: now },
    });
    const courseStart = request.scheduledDate.getTime() + clockMinutes(request.scheduledTime) * 60_000;
    const next = now.getTime() < courseStart - 15 * 60_000
      ? request.offers.find((offer) => offer.status === "QUEUED" && offer.totalClientPrice <= request.totalClientPrice)
      : undefined;
    if (!next) {
      await tx.marketplaceRequest.update({ where: { id: request.id }, data: { status: "EXPIRED", offerExpiresAt: null } });
      await enqueueNotificationEvent({
        title: "Recherche de professeur terminée",
        message: "Aucun professeur n’a accepté ce créneau. Vous pouvez relancer la recherche.",
        type: "MARKETPLACE_NO_MATCH",
        recipientType: "CLIENT",
        userId: request.clientId,
        clientId: request.clientId,
        link: "/client/trouver",
      }, tx);
      return { status: "expired" as const };
    }
    const expiresAt = new Date(now.getTime() + MARKETPLACE_OFFER_TTL_MS);
    await tx.marketplaceOffer.update({ where: { id: next.id }, data: { status: "PENDING", offeredAt: now, expiresAt } });
    await tx.marketplaceRequest.update({ where: { id: request.id }, data: { offerExpiresAt: expiresAt } });
    await notifyNextTeacher(next.teacherId, request.id, expiresAt, tx);
    return { status: "offered" as const, teacherId: next.teacherId };
  });
  if (result.status !== "waiting") await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function acceptMarketplaceOffer(requestId: string, teacherId: string) {
  const accepted = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    const offer = request.offers.find((item) => item.teacherId === teacherId && item.status === "PENDING");
    if (request.status !== "OFFERED" || !offer || offer.expiresAt <= new Date()) {
      throw new MarketplaceError("L’offre a expiré ou a déjà été attribuée.", 409);
    }
    await lockTeacherSchedule(tx, teacherId);
    const teacher = await tx.teacher.findUnique({
      where: { id: teacherId },
      include: { subjects: true, levels: true, wallet: true },
    });
    if (!teacher || teacher.status !== "ACTIVE" || !teacher.portalAccessEnabled || !teacher.photoUrl
      || !teacherSupportsJourney(teacher, request.journey as "ivoirien" | "francais" | "professionnel")
      || !teacher.subjects.some((subject) => subject.subjectId === request.subjectId)
      || !teacher.levels.some((level) => level.levelId === request.levelId)
      || (request.courseFormat === "HOME" ? !teacher.offersHome : !teacher.offersOnline)
      || !teacherAvailableInGrid(teacher.availability, {
        scheduledDate: request.scheduledDate,
        scheduledTime: request.scheduledTime,
        durationMinutes: request.durationMinutes as 60 | 120,
      })) {
      throw new MarketplaceError("Votre profil ou votre disponibilité ne correspond plus à la mission.", 409);
    }
    const slot = {
      scheduledDate: request.scheduledDate, scheduledTime: request.scheduledTime,
      durationMinutes: request.durationMinutes, courseFormat: request.courseFormat,
      commune: request.commune, quartier: request.quartier,
    };
    await assertTeacherScheduleAvailable(tx, { teacherId, slots: [slot] });
    const other = await tx.marketplaceRequest.findMany({
      where: {
        assignedTeacherId: teacherId,
        scheduledDate: request.scheduledDate,
        status: { in: ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "DISPUTED"] },
        id: { not: request.id },
      },
      select: { scheduledDate: true, scheduledTime: true, durationMinutes: true, courseFormat: true, commune: true, quartier: true },
    });
    if (other.some((item) => scheduleSlotsConflict(slot, item))) {
      throw new MarketplaceError("Ce créneau est déjà pris. Refusez l’offre pour proposer le prochain professeur.", 409);
    }
    const wallet = await tx.teacherWallet.updateMany({
      where: { teacherId, available: { gte: request.commissionAmount } },
      data: { available: { decrement: request.commissionAmount }, reserved: { increment: request.commissionAmount } },
    });
    if (wallet.count !== 1) throw new MarketplaceError("Rechargez votre portefeuille pour accepter cette mission.", 409);
    await tx.teacherWalletEntry.create({
      data: {
        teacherId, requestId, kind: "RESERVE", reservedDelta: request.commissionAmount,
        idempotencyKey: `marketplace-reserve:${requestId}:${teacherId}`,
      },
    });
    await tx.marketplaceOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    // Garder les alternatives en attente : si le professeur annule avant le
    // démarrage, la recherche peut reprendre sans demander au client de payer plus.
    const updated = await tx.marketplaceRequest.update({
      where: { id: requestId },
      data: {
        status: "ACCEPTED",
        assignedTeacherId: teacherId,
        acceptedAt: new Date(),
        offerExpiresAt: null,
        transportFee: offer.transportFee,
        totalClientPrice: offer.totalClientPrice,
      },
    });
    await enqueueNotificationEvent({
      title: "Votre professeur a accepté",
      message: `${teacher.professionalName || teacher.fullName} a accepté votre cours. Retrouvez le code de démarrage dans la demande.`,
      type: "MARKETPLACE_ACCEPTED",
      recipientType: "CLIENT",
      userId: request.clientId,
      clientId: request.clientId,
      link: `/client/demandes/${requestId}`,
      priority: "IMPORTANT",
    }, tx);
    return updated;
  });
  await publishWebPushFlushEvent("outbox_created");
  return accepted;
}

export async function startMarketplaceLesson(requestId: string, teacherId: string, code: string) {
  const started = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.assignedTeacherId !== teacherId || request.status !== "ACCEPTED") {
      throw new MarketplaceError("Cette mission ne peut pas démarrer.", 409);
    }
    const startAt = new Date(request.scheduledDate.getTime() + clockMinutes(request.scheduledTime) * 60_000);
    if (!isWithinStartWindow(startAt)) throw new MarketplaceError("Le démarrage est autorisé de 15 minutes avant à 45 minutes après l’heure prévue.", 409);
    if (request.startCodeAttempts >= 5) throw new MarketplaceError("Code bloqué après cinq essais. Contactez l’assistance.", 429);
    if (!startCodeMatches(requestId, code)) {
      await tx.marketplaceRequest.update({ where: { id: requestId }, data: { startCodeAttempts: { increment: 1 } } });
      return null;
    }
    const now = new Date();
    const updatedWallet = await tx.teacherWallet.updateMany({
      where: { teacherId, reserved: { gte: request.commissionAmount }, balance: { gte: request.commissionAmount } },
      data: { balance: { decrement: request.commissionAmount }, reserved: { decrement: request.commissionAmount } },
    });
    if (updatedWallet.count !== 1) throw new MarketplaceError("Le montant réservé est indisponible. Contactez l’assistance.", 409);
    await tx.teacherWalletEntry.create({
      data: {
        teacherId, requestId, kind: "COMMISSION",
        balanceDelta: -request.commissionAmount, reservedDelta: -request.commissionAmount,
        idempotencyKey: `marketplace-commission:${requestId}`,
      },
    });
    const updated = await tx.marketplaceRequest.update({
      where: { id: requestId },
      data: { status: "IN_PROGRESS", startedAt: now, dueAt: new Date(now.getTime() + request.durationMinutes * 60_000) },
    });
    await enqueueNotificationEvent({
      title: "Votre cours a commencé",
      message: `La séance de ${request.durationMinutes} minutes est en cours.`,
      type: "MARKETPLACE_STARTED", recipientType: "CLIENT",
      userId: request.clientId, clientId: request.clientId,
      link: `/client/demandes/${requestId}`,
    }, tx);
    return updated;
  });
  if (!started) throw new MarketplaceError("Code de démarrage incorrect.", 403);
  await publishWebPushFlushEvent("outbox_created");
  return started;
}

export async function endMarketplaceLesson(requestId: string, teacherId: string) {
  const updated = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.assignedTeacherId !== teacherId || request.status !== "IN_PROGRESS" || !request.startedAt) {
      throw new MarketplaceError("Ce cours n’est pas en cours.", 409);
    }
    if (Date.now() < request.startedAt.getTime() + request.durationMinutes * 60_000) {
      throw new MarketplaceError("Le compte à rebours n’est pas terminé.", 409);
    }
    const updated = await tx.marketplaceRequest.update({
      where: { id: requestId },
      data: { status: "AWAITING_CLIENT", teacherEndedAt: new Date() },
    });
    await enqueueNotificationEvent({
      title: "Confirmez la fin du cours",
      message: "Le professeur a marqué la séance terminée. Confirmez ou signalez un problème.",
      type: "MARKETPLACE_END", recipientType: "CLIENT",
      userId: request.clientId, clientId: request.clientId,
      link: `/client/demandes/${requestId}`,
      priority: "IMPORTANT",
    }, tx);
    return updated;
  });
  await publishWebPushFlushEvent("outbox_created");
  return updated;
}

export async function confirmMarketplaceLesson(requestId: string, clientId: string) {
  const completed = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.clientId !== clientId || request.status !== "AWAITING_CLIENT") {
      throw new MarketplaceError("Ce cours n’attend pas votre confirmation.", 409);
    }
    const updated = await tx.marketplaceRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", clientConfirmedAt: new Date() },
    });
    await tx.marketplaceOffer.updateMany({ where: { requestId, status: "QUEUED" }, data: { status: "REVOKED" } });
    if (request.assignedTeacherId) await enqueueNotificationEvent({
      title: "Cours confirmé",
      message: "Le client a confirmé la fin de la séance. Merci pour votre intervention.",
      type: "MARKETPLACE_COMPLETED", recipientType: "TEACHER", teacherId: request.assignedTeacherId,
      link: `/professeur/marche/${requestId}`,
    }, tx);
    return updated;
  });
  await publishWebPushFlushEvent("outbox_created");
  return completed;
}

export async function cancelMarketplaceRequest(requestId: string, clientId: string) {
  const cancelled = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.clientId !== clientId) throw new MarketplaceError("Demande introuvable.", 404);
    if (!["SEARCHING", "OFFERED", "ACCEPTED"].includes(request.status)) {
      throw new MarketplaceError("Un cours commencé ne peut pas être annulé ici. Signalez un litige.", 409);
    }
    if (request.status === "ACCEPTED" && request.assignedTeacherId) {
      const wallet = await tx.teacherWallet.updateMany({
        where: { teacherId: request.assignedTeacherId, reserved: { gte: request.commissionAmount } },
        data: { reserved: { decrement: request.commissionAmount }, available: { increment: request.commissionAmount } },
      });
      if (wallet.count !== 1) throw new MarketplaceError("Réserve incohérente. Contactez l’assistance.", 409);
      await tx.teacherWalletEntry.create({
        data: {
          teacherId: request.assignedTeacherId, requestId, kind: "RELEASE",
          reservedDelta: -request.commissionAmount,
          idempotencyKey: `marketplace-release:${requestId}:${request.assignedTeacherId}`,
        },
      });
    }
    await tx.marketplaceOffer.updateMany({ where: { requestId, status: { in: ["PENDING", "QUEUED"] } }, data: { status: "REVOKED" } });
    if (request.assignedTeacherId) await enqueueNotificationEvent({
      title: "Cours annulé par le client",
      message: "Le client a annulé avant le démarrage. La commission réservée est redevenue disponible.",
      type: "MARKETPLACE_CANCELLED", recipientType: "TEACHER", teacherId: request.assignedTeacherId,
      link: `/professeur/marche/${requestId}`,
    }, tx);
    return tx.marketplaceRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "client" },
    });
  });
  await publishWebPushFlushEvent("outbox_created");
  return cancelled;
}

export async function cancelAcceptedMarketplaceOffer(requestId: string, teacherId: string) {
  const result = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.status !== "ACCEPTED" || request.assignedTeacherId !== teacherId) {
      throw new MarketplaceError("Une mission commencée ne peut plus être annulée ici. Contactez l’assistance.", 409);
    }
    const wallet = await tx.teacherWallet.updateMany({
      where: { teacherId, reserved: { gte: request.commissionAmount } },
      data: { reserved: { decrement: request.commissionAmount }, available: { increment: request.commissionAmount } },
    });
    if (wallet.count !== 1) throw new MarketplaceError("Réserve incohérente. Contactez l’assistance.", 409);
    await tx.teacherWalletEntry.create({
      data: { teacherId, requestId, kind: "RELEASE", reservedDelta: -request.commissionAmount,
        idempotencyKey: `marketplace-release:${requestId}:${teacherId}` },
    });
    await tx.marketplaceOffer.updateMany({ where: { requestId, teacherId, status: "ACCEPTED" }, data: { status: "DECLINED", respondedAt: new Date() } });
    const now = new Date();
    const courseStart = request.scheduledDate.getTime() + clockMinutes(request.scheduledTime) * 60_000;
    const next = now.getTime() < courseStart - 15 * 60_000
      ? request.offers.find((offer) => offer.status === "QUEUED" && offer.totalClientPrice <= request.totalClientPrice)
      : undefined;
    if (next) {
      const expiresAt = new Date(now.getTime() + MARKETPLACE_OFFER_TTL_MS);
      await tx.marketplaceOffer.update({ where: { id: next.id }, data: { status: "PENDING", offeredAt: now, expiresAt } });
      await tx.marketplaceRequest.update({ where: { id: requestId }, data: {
        status: "OFFERED", assignedTeacherId: null, acceptedAt: null, offerExpiresAt: expiresAt,
        transportFee: next.transportFee, totalClientPrice: next.totalClientPrice,
      } });
      await notifyNextTeacher(next.teacherId, requestId, expiresAt, tx);
    } else {
      await tx.marketplaceRequest.update({ where: { id: requestId }, data: {
        status: "EXPIRED", assignedTeacherId: null, acceptedAt: null, offerExpiresAt: null,
      } });
    }
    await enqueueNotificationEvent({
      title: next ? "Un autre professeur est recherché" : "Le professeur a annulé",
      message: next ? "Le professeur a annulé avant le cours. Une nouvelle proposition est en cours, sans hausse du prix annoncé." : "Le professeur a annulé. Relancez une recherche pour choisir un autre créneau.",
      type: "MARKETPLACE_TEACHER_CANCELLED", recipientType: "CLIENT", userId: request.clientId, clientId: request.clientId,
      link: `/client/demandes/${requestId}`, priority: "IMPORTANT",
    }, tx);
    return { status: next ? "offered" as const : "expired" as const };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function expireUnstartedMarketplaceRequest(requestId: string) {
  const expired = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.status !== "ACCEPTED" || !request.assignedTeacherId) return false;
    const lastStart = request.scheduledDate.getTime() + clockMinutes(request.scheduledTime) * 60_000 + 45 * 60_000;
    if (Date.now() <= lastStart) return false;
    const teacherId = request.assignedTeacherId;
    const wallet = await tx.teacherWallet.updateMany({
      where: { teacherId, reserved: { gte: request.commissionAmount } },
      data: { reserved: { decrement: request.commissionAmount }, available: { increment: request.commissionAmount } },
    });
    if (wallet.count !== 1) throw new MarketplaceError("Réserve incohérente.", 409);
    await tx.teacherWalletEntry.create({
      data: { teacherId, requestId, kind: "RELEASE", reservedDelta: -request.commissionAmount,
        idempotencyKey: `marketplace-release:${requestId}:${teacherId}` },
    });
    await tx.marketplaceOffer.updateMany({ where: { requestId, status: "QUEUED" }, data: { status: "REVOKED" } });
    await tx.marketplaceRequest.update({ where: { id: requestId }, data: {
      status: "EXPIRED", offerExpiresAt: null, cancellationReason: "no_start_in_window",
    } });
    await enqueueNotificationEvent({
      title: "Cours non démarré",
      message: "Le code de démarrage n’a pas été saisi dans le délai prévu. La mission a été clôturée. Contactez l’assistance si le cours a malgré tout eu lieu.",
      type: "MARKETPLACE_NO_START", recipientType: "CLIENT", userId: request.clientId, clientId: request.clientId,
      link: `/client/demandes/${requestId}`, priority: "IMPORTANT",
    }, tx);
    await enqueueNotificationEvent({
      title: "Mission non démarrée",
      message: "La mission a expiré sans code de démarrage. Votre commission réservée est redevenue disponible.",
      type: "MARKETPLACE_NO_START", recipientType: "TEACHER", teacherId,
      link: `/professeur/marche/${requestId}`,
    }, tx);
    await enqueueNotificationEvent({
      title: "Cours accepté sans démarrage",
      message: `La mission ${request.reference} a expiré sans code de démarrage. Vérifiez toute répétition ou prise de contact hors plateforme.`,
      type: "MARKETPLACE_NO_START_AUDIT", recipientType: "ADMIN", priority: "IMPORTANT",
      teacherId, clientId: request.clientId, link: `/admin/marketplace/${requestId}`,
    }, tx);
    return true;
  });
  if (expired) await publishWebPushFlushEvent("outbox_created");
  return expired;
}

export async function reportMarketplaceDispute(requestId: string, clientId: string, reason: string) {
  const cleaned = reason.trim().slice(0, 1000);
  if (cleaned.length < 20) throw new MarketplaceError("Expliquez le problème en au moins 20 caractères.");
  const disputed = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, requestId);
    if (request.clientId !== clientId || !["IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED"].includes(request.status)) {
      throw new MarketplaceError("Ce cours ne peut pas être signalé dans cet état.", 409);
    }
    const updated = await tx.marketplaceRequest.update({ where: { id: requestId }, data: {
      status: "DISPUTED", disputeReason: cleaned,
    } });
    await enqueueNotificationEvent({
      title: "Litige sur un cours",
      message: `Une demande ${request.reference} nécessite une vérification. Aucun paiement client n’a été collecté par Compétence.`,
      type: "MARKETPLACE_DISPUTE", recipientType: "ADMIN", priority: "CRITICAL",
      link: `/admin/marketplace/${requestId}`,
    }, tx);
    return updated;
  });
  await publishWebPushFlushEvent("outbox_created");
  return disputed;
}

export async function resolveMarketplaceDispute(input: {
  requestId: string;
  adminId: string;
  action: "CONFIRM_COURSE" | "CREDIT_COMMISSION";
  note: string;
}) {
  const note = input.note.trim().slice(0, 1000);
  if (note.length < 20) throw new MarketplaceError("Documentez la décision en au moins 20 caractères.");
  const updated = await db.$transaction(async (tx) => {
    const request = await lockRequest(tx, input.requestId);
    if (request.status !== "DISPUTED" || !request.assignedTeacherId || !request.startedAt) {
      throw new MarketplaceError("Ce litige n’est plus ouvert.", 409);
    }
    if (input.action === "CREDIT_COMMISSION") {
      await tx.teacherWallet.update({ where: { teacherId: request.assignedTeacherId }, data: {
        balance: { increment: request.commissionAmount }, available: { increment: request.commissionAmount },
      } });
      await tx.teacherWalletEntry.create({ data: {
        teacherId: request.assignedTeacherId, requestId: request.id,
        kind: "ADJUSTMENT", balanceDelta: request.commissionAmount,
        idempotencyKey: `marketplace-dispute-credit:${request.id}`,
      } });
    }
    const resolved = await tx.marketplaceRequest.update({ where: { id: request.id }, data: {
      status: input.action === "CREDIT_COMMISSION" ? "CANCELLED" : "COMPLETED",
      disputeResolution: `${input.action}: ${note}`,
      disputeResolvedAt: new Date(), disputeResolvedBy: input.adminId,
      cancellationReason: input.action === "CREDIT_COMMISSION" ? "dispute_upheld" : request.cancellationReason,
    } });
    await tx.marketplaceOffer.updateMany({ where: { requestId: request.id, status: "QUEUED" }, data: { status: "REVOKED" } });
    await enqueueNotificationEvent({
      title: "Litige examiné",
      message: input.action === "CREDIT_COMMISSION"
        ? "La mission a été annulée après vérification. La commission a été recréditée au professeur ; le règlement direct du cours reste à traiter entre les parties."
        : "La mission a été clôturée après vérification du signalement.",
      type: "MARKETPLACE_DISPUTE_RESOLVED", recipientType: "CLIENT", userId: request.clientId, clientId: request.clientId,
      link: `/client/demandes/${request.id}`,
    }, tx);
    await enqueueNotificationEvent({
      title: "Litige examiné",
      message: input.action === "CREDIT_COMMISSION"
        ? "La commission de cette mission a été recréditée à votre portefeuille après vérification."
        : "La mission a été clôturée après vérification du signalement.",
      type: "MARKETPLACE_DISPUTE_RESOLVED", recipientType: "TEACHER", teacherId: request.assignedTeacherId,
      link: `/professeur/marche/${request.id}`,
    }, tx);
    return resolved;
  });
  await publishWebPushFlushEvent("outbox_created");
  return updated;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
