import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueueNotificationEvent } from "@/lib/notification-events";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import {
  assertTeacherScheduleAvailable,
  lockTeacherSchedule,
} from "@/lib/teacher-schedule-conflicts";
import { teacherAvailableInGrid } from "@/lib/marketplace-core";
import { teacherSupportsJourney } from "@/lib/teacher-journeys";
import {
  MANAGED_CLASSES,
  MANAGED_PARENT_TERMS,
  MANAGED_TERMS_VERSION,
  managedPayableCredit,
  managedParentTermsForVersion,
  managedPrice,
  managedRequestSchema,
  managedSlots,
  managedSplit,
  managedTeacherTerms,
} from "@/lib/managed-courses-core";

export class ManagedCourseError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
type Tx = Prisma.TransactionClient;
const managedTransaction = <T>(run: (tx: Tx) => Promise<T>) =>
  db.$transaction(run, { maxWait: 5_000, timeout: 30_000 });
const include = {
  sessions: { orderBy: { sequence: "asc" as const } },
  offers: { orderBy: { offeredAt: "desc" as const } },
};
async function lockDossier(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "ManagedCourseDossier" WHERE "id" = ${id} FOR UPDATE`;
  const dossier = await tx.managedCourseDossier.findUnique({
    where: { id },
    include,
  });
  if (!dossier) throw new ManagedCourseError("Dossier introuvable.", 404);
  return dossier;
}
async function event(
  tx: Tx,
  dossierId: string,
  actorId: string,
  action: string,
  details: Prisma.InputJsonValue,
) {
  await tx.managedCourseEvent.create({
    data: { dossierId, actorId, action, details },
  });
}
async function notifyAdmin(
  tx: Tx,
  dossierId: string,
  title: string,
  message: string,
) {
  await enqueueNotificationEvent(
    {
      title,
      message,
      recipientType: "ADMIN",
      type: "MANAGED_COURSE",
      priority: "IMPORTANT",
      link: `/admin/accompagnement/${dossierId}`,
    },
    tx,
  );
}
export async function createManagedDossier(raw: unknown, actorId?: string) {
  const input = managedRequestSchema.parse(raw);
  if (!actorId && !input.accepted)
    throw new ManagedCourseError(
      "Acceptez les conditions et le récapitulatif.",
      400,
    );
  if (input.courseFormat === "HOME" && !input.commune)
    throw new ManagedCourseError("La commune du cours est requise.", 400);
  const phone = input.phone.replace(/\s/g, "").replace(/^\+225/, "");
  if (!/^(01|05|07)\d{8}$/.test(phone))
    throw new ManagedCourseError("Numéro mobile ivoirien invalide.", 400);
  let slots: ReturnType<typeof managedSlots>;
  try {
    slots = managedSlots(input);
  } catch (error) {
    throw new ManagedCourseError(
      error instanceof Error ? error.message : "Dates invalides.",
      400,
    );
  }
  const price = managedPrice(input.journey, input.className, slots.length);
  if (input.quotedTotal !== price.total)
    throw new ManagedCourseError(
      "Le tarif a changé. Actualisez le récapitulatif avant d'accepter.",
    );
  const subject = await db.subject.findUnique({
    where: { id: input.subjectId },
  });
  if (!subject) throw new ManagedCourseError("Matière introuvable.", 400);
  const result = await managedTransaction(async (tx) => {
    // Public intake is bounded per phone even when submissions race.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`managed-intake:${phone}`}))`;
    const existing = await tx.managedCourseDossier.findUnique({
      where: { clientKey: input.clientKey },
      include: { sessions: { orderBy: { sequence: "asc" } } },
    });
    if (existing) {
      const sameSlots =
        existing.sessions.length === slots.length &&
        existing.sessions.every(
          (session, index) =>
            session.scheduledDate.getTime() ===
              slots[index].scheduledDate.getTime() &&
            session.scheduledTime === slots[index].scheduledTime,
        );
      if (
        existing.phone !== `+225${phone}` ||
        existing.parentName !== input.parentName ||
        existing.source !== (actorId ? "ADMIN" : "PUBLIC") ||
        existing.journey !== input.journey ||
        existing.className !== input.className ||
        existing.subjectId !== input.subjectId ||
        existing.courseFormat !== input.courseFormat ||
        existing.cadence !== input.cadence ||
        existing.totalPrice !== price.total ||
        !sameSlots ||
        (existing.objective || "") !== input.objective ||
        (input.courseFormat === "HOME" &&
          ((existing.commune || "") !== input.commune ||
            (existing.quartier || "") !== input.quartier ||
            (existing.addressHint || "") !== input.addressHint))
      )
        throw new ManagedCourseError(
          "Ce formulaire a déjà été envoyé avec d'autres informations. Consultez le dossier reçu avant de créer une autre demande.",
        );
      return { id: existing.id, reference: existing.reference };
    }
    if (
      !actorId &&
      (await tx.managedCourseDossier.count({
        where: {
          phone: `+225${phone}`,
          createdAt: { gte: new Date(Date.now() - 3_600_000) },
        },
      })) >= 3
    ) {
      throw new ManagedCourseError(
        "Plusieurs demandes sont déjà enregistrées. Contactez Compétence.",
        429,
      );
    }
    const parentToken = randomBytes(32).toString("base64url");
    const created = await tx.managedCourseDossier.create({
      data: {
        reference: `AC-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        clientKey: input.clientKey,
        source: actorId ? "ADMIN" : "PUBLIC",
        parentName: input.parentName,
        phone: `+225${phone}`,
        journey: input.journey,
        className: input.className,
        subjectId: subject.id,
        subjectName: subject.name,
        courseFormat: input.courseFormat,
        commune: input.courseFormat === "HOME" ? input.commune : null,
        quartier: input.courseFormat === "HOME" ? input.quartier : null,
        addressHint: input.courseFormat === "HOME" ? input.addressHint : null,
        objective: input.objective,
        cadence: input.cadence,
        unitPrice: price.perSession,
        totalPrice: price.total,
        termsVersion: MANAGED_TERMS_VERSION,
        contractTokenHash: hashToken(parentToken),
        contractTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000),
        // An operator cannot accept a parent's contract on their behalf.
        acceptedAt: actorId ? null : new Date(),
        acceptedRevision: actorId ? null : 1,
        acceptanceEvidence: actorId
          ? undefined
          : {
              method: "FORM_CHECKBOX",
              phoneVerified: false,
              terms: MANAGED_PARENT_TERMS,
              version: MANAGED_TERMS_VERSION,
              total: price.total,
              sessions: input.sessions,
              cadence: input.cadence,
            },
        sessions: {
          create: slots.map((slot, index) => ({
            ...slot,
            sequence: index + 1,
            amount: price.perSession,
          })),
        },
      },
    });
    await event(tx, created.id, actorId || "PUBLIC", "CREATED", {
      source: created.source,
      total: price.total,
    });
    await notifyAdmin(
      tx,
      created.id,
      "Nouvelle demande d'accompagnement",
      `${created.reference} · ${subject.name} · ${input.className}`,
    );
    return {
      id: created.id,
      reference: created.reference,
      path: `/demande-cours/accord#${parentToken}`,
    };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

function qualificationMatches(className: string, precise: string) {
  if (MANAGED_CLASSES.slice(0, 4).includes(className as "6e"))
    return precise === className;
  if (className === "Seconde") return /^(2nde|Seconde)( |$)/.test(precise);
  if (className === "Première") return /^(1ère|Première)( |$)/.test(precise);
  return /^Terminale( |$)/.test(precise);
}
async function qualifiedTeacher(
  tx: Tx,
  teacherId: string,
  dossier: {
    journey: string;
    className: string;
    subjectId: string;
    courseFormat: string;
  },
) {
  const teacher = await tx.teacher.findUnique({
    where: { id: teacherId },
    include: { preciseLevels: true },
  });
  if (
    !teacher ||
    teacher.status !== "ACTIVE" ||
    !teacher.portalAccessEnabled ||
    teacher.portalPasswordMustChange ||
    !teacherSupportsJourney(
      teacher,
      dossier.journey as "ivoirien" | "francais",
    ) ||
    (dossier.courseFormat === "HOME"
      ? !teacher.offersHome
      : !teacher.offersOnline) ||
    !teacher.preciseLevels.some(
      (level) =>
        level.journey === dossier.journey &&
        level.subjectId === dossier.subjectId &&
        qualificationMatches(dossier.className, level.className),
    )
  ) {
    throw new ManagedCourseError(
      "Professeur non habilité pour ce système, cette classe et cette matière. Vérifiez sa fiche.",
    );
  }
  return teacher;
}
export async function offerManagedDossier(
  id: string,
  teacherId: string,
  commissionPercent: number,
  adminId: string,
) {
  const commissionRateBps = commissionPercent * 100;
  managedSplit(0, commissionRateBps);
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    if (dossier.onHold)
      throw new ManagedCourseError(
        "Ce dossier est en litige. L'équipe doit lever la retenue avant attribution.",
      );
    if (dossier.acceptedRevision !== dossier.revision)
      throw new ManagedCourseError(
        "L'accord du parent sur cette version est requis.",
      );
    const teacher = await qualifiedTeacher(tx, teacherId, dossier);
    if (dossier.offers.some((offer) => offer.status === "OFFERED"))
      throw new ManagedCourseError("Une proposition attend déjà une réponse.");
    const pending = dossier.sessions.filter(
      (session) =>
        session.status === "PLANNED" &&
        !session.teacherId &&
        new Date(
          `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
        ).getTime() > Date.now(),
    );
    if (!pending.length)
      throw new ManagedCourseError("Aucune séance non attribuée.");
    if (
      pending.some(
        (slot) => !teacherAvailableInGrid(teacher.availability, slot),
      )
    )
      throw new ManagedCourseError(
        "Ces horaires ne correspondent pas aux disponibilités du professeur.",
      );
    const offer = await tx.managedCourseOffer.create({
      data: {
        dossierId: id,
        teacherId,
        revision: dossier.revision,
        commissionRateBps,
        termsVersion: MANAGED_TERMS_VERSION,
      },
    });
    await tx.managedCourseSession.updateMany({
      where: { id: { in: pending.map((session) => session.id) } },
      data: { offerId: offer.id },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: { status: "OFFERED" },
    });
    await event(tx, id, adminId, "OFFERED", {
      offerId: offer.id,
      teacherId,
      sessions: pending.length,
      commissionRateBps,
    });
    await enqueueNotificationEvent(
      {
        title: "Accompagnement proposé par Compétence",
        message:
          "Consultez les séances, votre rémunération et les engagements avant de répondre.",
        type: "MANAGED_OFFER",
        recipientType: "TEACHER",
        teacherId,
        priority: "IMPORTANT",
        link: "/professeur/accompagnement",
      },
      tx,
    );
    return { id: offer.id };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}
export async function respondManagedOffer(
  id: string,
  teacherId: string,
  accept: boolean,
  reason: string,
) {
  const target = await db.managedCourseOffer.findFirst({
    where: { id, teacherId },
    select: { dossierId: true },
  });
  if (!target) throw new ManagedCourseError("Proposition introuvable.", 404);
  const settings = await getPlatformRuntimeSettings();
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, target.dossierId);
    if (dossier.onHold)
      throw new ManagedCourseError(
        "Ce dossier est en litige. Contactez Compétence avant de répondre.",
      );
    const offer = dossier.offers.find(
      (item) => item.id === id && item.teacherId === teacherId,
    );
    if (
      !offer ||
      offer.status !== "OFFERED" ||
      offer.revision !== dossier.revision ||
      dossier.acceptedRevision !== dossier.revision
    )
      throw new ManagedCourseError("Cette proposition n'est plus active.");
    const sessions = dossier.sessions.filter(
      (session) => session.offerId === id && session.status === "PLANNED",
    );
    if (!sessions.length)
      throw new ManagedCourseError("Aucune séance à accepter.");
    if (accept) {
      await lockTeacherSchedule(tx, teacherId);
      const teacher = await qualifiedTeacher(tx, teacherId, dossier);
      if (
        sessions.some(
          (session) =>
            new Date(
              `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
            ).getTime() <= Date.now() ||
            !teacherAvailableInGrid(teacher.availability, session),
        )
      )
        throw new ManagedCourseError("Un des horaires n'est plus disponible.");
      await assertTeacherScheduleAvailable(tx, {
        teacherId,
        slots: sessions.map((session) => ({
          ...session,
          courseFormat: dossier.courseFormat,
          commune: dossier.commune,
          quartier: dossier.quartier,
        })),
        scheduleBuffers: settings.scheduleBuffers,
      });
      await tx.managedCourseSession.updateMany({
        where: { id: { in: sessions.map((session) => session.id) } },
        data: { teacherId, commissionRateBps: offer.commissionRateBps },
      });
    } else {
      await tx.managedCourseSession.updateMany({
        where: { offerId: id, status: "PLANNED" },
        data: { offerId: null },
      });
    }
    await tx.managedCourseOffer.update({
      where: { id },
      data: {
        status: accept ? "ACCEPTED" : "DECLINED",
        respondedAt: new Date(),
        reason: reason.slice(0, 500),
      },
    });
    await tx.managedCourseDossier.update({
      where: { id: dossier.id },
      data: { status: accept ? "ACTIVE" : "NEW" },
    });
    await event(
      tx,
      dossier.id,
      teacherId,
      accept ? "TEACHER_ACCEPTED" : "TEACHER_DECLINED",
      {
        offerId: id,
        terms: accept ? managedTeacherTerms(offer.commissionRateBps, offer.termsVersion) : "",
        commissionRateBps: offer.commissionRateBps,
        version: offer.termsVersion,
        reason,
      },
    );
    await notifyAdmin(
      tx,
      dossier.id,
      accept ? "Professeur confirmé" : "Réattribution nécessaire",
      `${dossier.reference} · ${accept ? "Toutes les séances proposées sont acceptées." : "Le professeur a refusé la proposition."}`,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

async function creditSession(tx: Tx, sessionId: string, actorId: string) {
  const session = await tx.managedCourseSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const delta = managedPayableCredit(session);
  if (!delta || !session.teacherId) return;
  await lockTeacherSchedule(tx, session.teacherId);
  await tx.managedTeacherLedgerEntry.create({
    data: {
      teacherId: session.teacherId,
      sessionId,
      kind: "EARNED",
      amountDelta: delta,
      actorId,
      // The dossier lock and payable delta prevent replay. A later reversal and
      // real re-collection may legitimately fund this same amount again.
      idempotencyKey: `managed-credit:${sessionId}:${randomUUID()}`,
      note: `Séance validée et encaissement parent enregistré · part professeur ${100 - session.commissionRateBps! / 100} % · taux de la mission accepté`,
    },
  });
  await tx.managedCourseSession.update({
    where: { id: sessionId },
    data: { creditedTeacherAmount: { increment: delta } },
  });
  await enqueueNotificationEvent(
    {
      title: "Rémunération devenue payable",
      message: `${delta.toLocaleString("fr-FR")} F CFA crédités après validation de séance et encaissement du parent.`,
      type: "MANAGED_EARNED",
      recipientType: "TEACHER",
      teacherId: session.teacherId,
      link: "/professeur/accompagnement",
    },
    tx,
  );
}
export async function recordManagedReceipt(
  id: string,
  data: {
    amount: number;
    method: string;
    reference: string;
    idempotencyKey: string;
    receivedAt: string;
  },
  adminId: string,
) {
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    const existing = await tx.managedParentReceipt.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existing) {
      if (
        existing.dossierId !== id ||
        existing.amount !== data.amount ||
        existing.reference !== data.reference ||
        existing.method !== data.method
      )
        throw new ManagedCourseError(
          "Clé de paiement déjà utilisée pour une autre opération.",
        );
      return { ok: true };
    }
    if (dossier.acceptedRevision !== dossier.revision)
      throw new ManagedCourseError(
        "Accord du parent requis avant encaissement.",
      );
    if (dossier.onHold)
      throw new ManagedCourseError("Encaissement bloqué pendant le litige.");
    if (
      data.amount >
      dossier.totalPrice - dossier.cancelledAmount - dossier.receivedAmount
    )
      throw new ManagedCourseError("Le montant dépasse le reste à encaisser.");
    const teacherIds = [
      ...new Set(
        dossier.sessions.flatMap((session) =>
          session.teacherId ? [session.teacherId] : [],
        ),
      ),
    ].sort();
    for (const teacherId of teacherIds)
      await lockTeacherSchedule(tx, teacherId);
    let remaining = data.amount;
    const allocations: { sessionId: string; amount: number }[] = [];
    for (const session of dossier.sessions) {
      if (!remaining || session.status === "CANCELLED") continue;
      const amount = Math.min(remaining, session.amount - session.fundedAmount);
      if (!amount) continue;
      await tx.managedCourseSession.update({
        where: { id: session.id },
        data: { fundedAmount: { increment: amount } },
      });
      allocations.push({ sessionId: session.id, amount });
      remaining -= amount;
      await creditSession(tx, session.id, adminId);
    }
    if (remaining)
      throw new ManagedCourseError(
        "Impossible d'affecter cet encaissement aux séances.",
      );
    await tx.managedParentReceipt.create({
      data: {
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        idempotencyKey: data.idempotencyKey,
        receivedAt: new Date(data.receivedAt),
        dossierId: id,
        recordedBy: adminId,
        allocations,
      },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: { receivedAmount: { increment: data.amount } },
    });
    await event(tx, id, adminId, "PARENT_RECEIPT", {
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      allocations,
    });
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}
export async function completeManagedSession(
  id: string,
  sessionId: string,
  actorId: string,
  adminValidation: boolean,
) {
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    if (dossier.onHold)
      throw new ManagedCourseError("Validation bloquée pendant le litige.");
    const session = dossier.sessions.find((item) => item.id === sessionId);
    if (!session || (!adminValidation && session.teacherId !== actorId))
      throw new ManagedCourseError("Séance introuvable.", 404);
    if (
      !session.teacherId ||
      !session.offerId ||
      !["ACCEPTED", "CANCEL_REQUESTED", "PARTIAL_CANCELLED"].includes(
        dossier.offers.find((offer) => offer.id === session.offerId)?.status ??
          "",
      )
    )
      throw new ManagedCourseError(
        "Le professeur doit d'abord accepter la mission.",
      );
    const endsAt =
      new Date(
        `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
      ).getTime() +
      120 * 60_000;
    if (endsAt > Date.now())
      throw new ManagedCourseError(
        "La séance de deux heures n'est pas encore terminée.",
      );
    if (
      session.status === "VALIDATED" ||
      (!adminValidation && session.status === "DONE")
    )
      return { ok: true };
    if (
      adminValidation ? session.status !== "DONE" : session.status !== "PLANNED"
    )
      throw new ManagedCourseError(
        "Cette séance ne peut pas être validée dans son état actuel.",
      );
    await tx.managedCourseSession.update({
      where: { id: sessionId },
      data: adminValidation
        ? { status: "VALIDATED", validatedAt: new Date(), validatedBy: actorId }
        : { status: "DONE", completedAt: new Date() },
    });
    if (adminValidation) await creditSession(tx, sessionId, actorId);
    if (
      adminValidation &&
      (await tx.managedCourseSession.count({
        where: { dossierId: id, status: { notIn: ["VALIDATED", "CANCELLED"] } },
      })) === 0
    ) {
      await tx.managedCourseDossier.update({
        where: { id },
        data: { status: "COMPLETED" },
      });
    }
    await event(
      tx,
      id,
      actorId,
      adminValidation ? "SESSION_VALIDATED" : "SESSION_DECLARED_DONE",
      { sessionId },
    );
    if (!adminValidation)
      await notifyAdmin(
        tx,
        id,
        "Séance à vérifier",
        `${dossier.reference} · le professeur déclare la séance terminée.`,
      );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function recordManagedTeacherPayment(
  teacherId: string,
  data: {
    amount: number;
    method: string;
    reference: string;
    idempotencyKey: string;
    note: string;
  },
  adminId: string,
) {
  const result = await managedTransaction(async (tx) => {
    await lockTeacherSchedule(tx, teacherId);
    const prior = await tx.managedTeacherLedgerEntry.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (prior) {
      if (
        prior.teacherId !== teacherId ||
        prior.amountDelta !== -data.amount ||
        prior.reference !== data.reference ||
        prior.method !== data.method ||
        prior.kind !== "PAYMENT"
      )
        throw new ManagedCourseError("Identifiant déjà utilisé.");
      return { ok: true };
    }
    const total = await tx.managedTeacherLedgerEntry.aggregate({
      where: { teacherId },
      _sum: { amountDelta: true },
    });
    const held = await tx.managedCourseSession.aggregate({
      where: { teacherId, dossier: { onHold: true } },
      _sum: { creditedTeacherAmount: true },
    });
    if (
      data.amount >
      Math.max(
        0,
        (total._sum.amountDelta ?? 0) - (held._sum.creditedTeacherAmount ?? 0),
      )
    )
      throw new ManagedCourseError(
        "Le montant dépasse le solde disponible après retenues pour litige.",
      );
    if (data.amount > (total._sum.amountDelta ?? 0))
      throw new ManagedCourseError(
        "Le paiement dépasse le solde réellement payable.",
      );
    await tx.managedTeacherLedgerEntry.create({
      data: {
        teacherId,
        kind: "PAYMENT",
        amountDelta: -data.amount,
        method: data.method,
        reference: data.reference,
        idempotencyKey: data.idempotencyKey,
        actorId: adminId,
        note: data.note,
      },
    });
    await enqueueNotificationEvent(
      {
        title: "Paiement enregistré par Compétence",
        message:
          "Un règlement manuel est enregistré dans votre comptabilité. Consultez sa référence.",
        type: "MANAGED_PAYMENT",
        recipientType: "TEACHER",
        teacherId,
        link: "/professeur/accompagnement",
      },
      tx,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function cancelManagedOffer(
  offerId: string,
  actorId: string,
  isAdmin: boolean,
  reason: string,
) {
  const offer = await db.managedCourseOffer.findUnique({
    where: { id: offerId },
  });
  if (!offer || (!isAdmin && offer.teacherId !== actorId))
    throw new ManagedCourseError("Mission introuvable.", 404);
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, offer.dossierId);
    const current = dossier.offers.find((item) => item.id === offerId);
    if (
      !current ||
      !["ACCEPTED", "CANCEL_REQUESTED", "OFFERED"].includes(current.status)
    )
      throw new ManagedCourseError("Cette mission ne peut plus être annulée.");
    await lockTeacherSchedule(tx, current.teacherId);
    if (isAdmin) {
      const futureIds = dossier.sessions
        .filter(
          (session) =>
            session.offerId === offerId &&
            session.status === "PLANNED" &&
            new Date(
              `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
            ).getTime() > Date.now(),
        )
        .map((session) => session.id);
      if (!futureIds.length)
        throw new ManagedCourseError(
          "Aucune séance future à libérer. Les séances commencées ou passées doivent être vérifiées séparément.",
        );
      await tx.managedCourseSession.updateMany({
        where: { id: { in: futureIds }, offerId, status: "PLANNED" },
        data: { teacherId: null, offerId: null, commissionRateBps: null },
      });
      await tx.managedCourseOffer.update({
        where: { id: offerId },
        data: { status: "PARTIAL_CANCELLED", reason },
      });
      await tx.managedCourseDossier.update({
        where: { id: dossier.id },
        data: { status: "NEW" },
      });
    } else {
      await tx.managedCourseOffer.update({
        where: { id: offerId },
        data: { status: "CANCEL_REQUESTED", reason },
      });
    }
    await event(
      tx,
      dossier.id,
      actorId,
      isAdmin ? "FUTURE_SESSIONS_RELEASED" : "TEACHER_CANCELLATION_REQUESTED",
      { offerId, reason },
    );
    await notifyAdmin(
      tx,
      dossier.id,
      isAdmin ? "Réattribution ouverte" : "Empêchement professeur",
      `${dossier.reference} · ${reason}`,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function reviseManagedPrice(
  id: string,
  unitPrice: number,
  note: string,
  actorId: string,
) {
  return managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    if (
      dossier.onHold ||
      dossier.receivedAmount ||
      dossier.cancelledAmount ||
      dossier.sessions.some(
        (session) => session.teacherId || session.status !== "PLANNED",
      )
    )
      throw new ManagedCourseError(
        "Un dossier engagé ne peut pas être repricé. Créez une nouvelle proposition.",
      );
    await tx.managedCourseOffer.updateMany({
      where: { dossierId: id, status: "OFFERED" },
      data: { status: "REVOKED", reason: "Nouvelle proposition tarifaire" },
    });
    await tx.managedCourseSession.updateMany({
      where: { dossierId: id },
      data: { amount: unitPrice, offerId: null },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: {
        unitPrice,
        totalPrice: unitPrice * dossier.sessions.length,
        revision: { increment: 1 },
        acceptedAt: null,
        acceptedRevision: null,
        acceptanceEvidence: Prisma.DbNull,
        contractTokenHash: null,
        contractTokenExpiresAt: null,
        status: "NEW",
      },
    });
    await event(tx, id, actorId, "PRICE_REVISED", {
      oldUnitPrice: dossier.unitPrice,
      unitPrice,
      note,
      previousRevision: dossier.revision,
      previousAcceptedAt: dossier.acceptedAt?.toISOString() ?? null,
      previousAcceptance: dossier.acceptanceEvidence,
    });
    return { ok: true };
  });
}

// Corrections are append-only. No function below sends or refunds money.
export async function setManagedHold(
  id: string,
  onHold: boolean,
  reason: string,
  actorId: string,
) {
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    for (const teacherId of [
      ...new Set(
        dossier.sessions.flatMap((session) =>
          session.teacherId ? [session.teacherId] : [],
        ),
      ),
    ].sort())
      await lockTeacherSchedule(tx, teacherId);
    await tx.managedCourseDossier.update({ where: { id }, data: { onHold } });
    await event(tx, id, actorId, onHold ? "DISPUTE_HOLD" : "DISPUTE_RELEASED", {
      reason,
    });
    await notifyAdmin(
      tx,
      id,
      onHold ? "Retenue pour litige" : "Litige : retenue levée",
      `${dossier.reference} · ${reason}`,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function rescheduleManagedSession(
  id: string,
  sessionId: string,
  date: string,
  time: string,
  reason: string,
  actorId: string,
) {
  let slot: ReturnType<typeof managedSlots>[number];
  try {
    [slot] = managedSlots({ sessions: [{ date, time }] });
  } catch (error) {
    throw new ManagedCourseError(
      error instanceof Error ? error.message : "Horaire invalide.",
      400,
    );
  }
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    const session = dossier.sessions.find((item) => item.id === sessionId);
    if (
      dossier.onHold ||
      !session ||
      session.status !== "PLANNED" ||
      session.creditedTeacherAmount
    )
      throw new ManagedCourseError(
        "Seule une séance non effectuée, hors litige, peut être reprogrammée.",
      );
    if (
      dossier.sessions.some(
        (item) =>
          item.id !== sessionId &&
          item.status !== "CANCELLED" &&
          item.scheduledDate.toISOString().slice(0, 10) === date,
      )
    )
      throw new ManagedCourseError(
        "Une autre séance est déjà prévue ce jour dans ce dossier.",
      );
    if (session.teacherId) await lockTeacherSchedule(tx, session.teacherId);
    await tx.managedCourseSession.update({
      where: { id: session.id },
      data: {
        ...slot,
        teacherId: null,
        offerId: null,
        commissionRateBps: null,
      },
    });
    await tx.managedCourseOffer.updateMany({
      where: { dossierId: id, status: "OFFERED" },
      data: {
        status: "REVOKED",
        reason: "Horaires révisés : nouvel accord nécessaire",
      },
    });
    await tx.managedCourseSession.updateMany({
      where: { dossierId: id, teacherId: null, status: "PLANNED" },
      data: { offerId: null },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: {
        revision: { increment: 1 },
        acceptedAt: null,
        acceptedRevision: null,
        acceptanceEvidence: Prisma.DbNull,
        contractTokenHash: null,
        contractTokenExpiresAt: null,
        status: "NEW",
      },
    });
    await event(tx, id, actorId, "SESSION_RESCHEDULE_PROPOSED", {
      sessionId,
      reason,
      previousDate: session.scheduledDate.toISOString(),
      previousTime: session.scheduledTime,
      previousTeacherId: session.teacherId,
      previousOfferId: session.offerId,
      previousRate: session.commissionRateBps,
      date,
      time,
      previousRevision: dossier.revision,
      previousAcceptance: dossier.acceptanceEvidence,
    });
    if (session.teacherId)
      await enqueueNotificationEvent(
        {
          title: "Horaire modifié · nouvel accord nécessaire",
          message: `${dossier.reference} · une séance a été retirée de votre planning en attente d'une nouvelle proposition.`,
          type: "MANAGED_RESCHEDULE",
          recipientType: "TEACHER",
          teacherId: session.teacherId,
          priority: "IMPORTANT",
          link: "/professeur/accompagnement",
        },
        tx,
      );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

export async function cancelManagedSessions(
  id: string,
  sessionIds: string[],
  reason: string,
  actorId: string,
) {
  const result = await managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    const sessions = dossier.sessions.filter((session) =>
      sessionIds.includes(session.id),
    );
    if (!sessions.length || sessions.length !== new Set(sessionIds).size)
      throw new ManagedCourseError("Séances introuvables.");
    if (
      sessions.some(
        (session) =>
          session.status !== "PLANNED" && session.status !== "CANCELLED",
      )
    )
      throw new ManagedCourseError(
        "Une séance déclarée effectuée ou validée doit faire l'objet d'un litige, pas d'une annulation rétroactive.",
      );
    const pending = sessions.filter(
      (session) => session.status !== "CANCELLED",
    );
    if (!pending.length) return { ok: true };
    for (const teacherId of [
      ...new Set(
        pending.flatMap((session) =>
          session.teacherId ? [session.teacherId] : [],
        ),
      ),
    ].sort())
      await lockTeacherSchedule(tx, teacherId);
    await tx.managedCourseSession.updateMany({
      where: { id: { in: pending.map((session) => session.id) } },
      data: { status: "CANCELLED" },
    });
    const cancelledAmount =
      dossier.cancelledAmount +
      pending.reduce((sum, session) => sum + session.amount, 0);
    await tx.managedCourseDossier.update({
      where: { id },
      data: {
        cancelledAmount,
        status:
          cancelledAmount === dossier.totalPrice ? "CANCELLED" : dossier.status,
      },
    });
    for (const offer of dossier.offers.filter(
      (item) => item.status === "OFFERED",
    )) {
      const left = await tx.managedCourseSession.count({
        where: { offerId: offer.id, status: "PLANNED" },
      });
      if (!left)
        await tx.managedCourseOffer.update({
          where: { id: offer.id },
          data: { status: "REVOKED", reason },
        });
    }
    await event(tx, id, actorId, "SESSIONS_CANCELLED", {
      sessionIds: pending.map((session) => session.id),
      reason,
      cancelledAmount,
    });
    for (const teacherId of [
      ...new Set(
        pending.flatMap((session) =>
          session.teacherId ? [session.teacherId] : [],
        ),
      ),
    ]) {
      await enqueueNotificationEvent(
        {
          title: "Séance annulée par Compétence",
          message: `${dossier.reference} · consultez les séances mises à jour.`,
          type: "MANAGED_CANCELLATION",
          recipientType: "TEACHER",
          teacherId,
          priority: "IMPORTANT",
          link: "/professeur/accompagnement",
        },
        tx,
      );
    }
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}

type CorrectionMoney = {
  amount: number;
  method: string;
  reference: string;
  idempotencyKey: string;
  note: string;
};
export async function refundManagedCancelledSessions(
  id: string,
  data: CorrectionMoney,
  actorId: string,
) {
  return managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    const prior = await tx.managedParentReceipt.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (prior) {
      if (
        prior.dossierId !== id ||
        prior.kind !== "REFUND" ||
        prior.amount !== -data.amount ||
        prior.method !== data.method ||
        prior.reference !== data.reference
      )
        throw new ManagedCourseError(
          "Identifiant de remboursement déjà utilisé.",
        );
      return { ok: true };
    }
    const refundable = dossier.sessions.filter(
      (session) => session.status === "CANCELLED",
    );
    if (
      data.amount >
      refundable.reduce((sum, session) => sum + session.fundedAmount, 0)
    )
      throw new ManagedCourseError(
        "Le remboursement dépasse les fonds reçus pour les séances annulées.",
      );
    let remaining = data.amount;
    const allocations: { sessionId: string; amount: number }[] = [];
    for (const session of refundable) {
      const amount = Math.min(remaining, session.fundedAmount);
      if (!amount) continue;
      if (session.creditedTeacherAmount)
        throw new ManagedCourseError(
          "Rémunération déjà acquise : rapprochez le litige avant remboursement.",
        );
      await tx.managedCourseSession.update({
        where: { id: session.id },
        data: { fundedAmount: { decrement: amount } },
      });
      allocations.push({ sessionId: session.id, amount: -amount });
      remaining -= amount;
    }
    await tx.managedParentReceipt.create({
      data: {
        ...data,
        dossierId: id,
        amount: -data.amount,
        kind: "REFUND",
        receivedAt: new Date(),
        recordedBy: actorId,
        allocations,
      },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: { receivedAmount: { decrement: data.amount } },
    });
    await event(tx, id, actorId, "PARENT_REFUND_RECORDED", {
      ...data,
      allocations,
    });
    return { ok: true };
  });
}

export async function reverseManagedReceipt(
  id: string,
  receiptId: string,
  data: Omit<CorrectionMoney, "amount">,
  actorId: string,
) {
  return managedTransaction(async (tx) => {
    const dossier = await lockDossier(tx, id);
    const original = await tx.managedParentReceipt.findFirst({
      where: { id: receiptId, dossierId: id, kind: "RECEIPT" },
    });
    if (!original)
      throw new ManagedCourseError("Encaissement d'origine introuvable.", 404);
    const prior = await tx.managedParentReceipt.findUnique({
      where: { reversesId: receiptId },
    });
    if (prior) return { ok: true };
    const allocations = original.allocations as {
      sessionId: string;
      amount: number;
    }[];
    for (const teacherId of [
      ...new Set(
        dossier.sessions.flatMap((session) =>
          session.teacherId ? [session.teacherId] : [],
        ),
      ),
    ].sort())
      await lockTeacherSchedule(tx, teacherId);
    const debits = new Map<string, number>();
    for (const allocation of allocations) {
      const session = dossier.sessions.find(
        (item) => item.id === allocation.sessionId,
      );
      if (!session || session.fundedAmount < allocation.amount)
        throw new ManagedCourseError(
          "Ces fonds ont déjà fait l'objet d'un remboursement ou d'une correction. Rapprochement manuel nécessaire.",
        );
      const fundedAmount = session.fundedAmount - allocation.amount;
      const credit =
        session.status === "VALIDATED"
          ? managedSplit(fundedAmount, session.commissionRateBps!).teacher
          : 0;
      const debit = session.creditedTeacherAmount - credit;
      if (debit && session.teacherId) {
        debits.set(
          session.teacherId,
          (debits.get(session.teacherId) ?? 0) + debit,
        );
        await tx.managedTeacherLedgerEntry.create({
          data: {
            teacherId: session.teacherId,
            sessionId: session.id,
            kind: "EARNED_REVERSAL",
            amountDelta: -debit,
            note: data.note,
            actorId,
            idempotencyKey: `receipt-reversal:${receiptId}:${session.id}`,
          },
        });
      }
      await tx.managedCourseSession.update({
        where: { id: session.id },
        data: { fundedAmount, creditedTeacherAmount: credit },
      });
    }
    for (const teacherId of debits.keys()) {
      const balance = await tx.managedTeacherLedgerEntry.aggregate({
        where: { teacherId },
        _sum: { amountDelta: true },
      });
      if ((balance._sum.amountDelta ?? 0) < 0)
        throw new ManagedCourseError(
          "Le professeur a déjà été réglé. Récupérez/rapprochez ce versement avant d'annuler l'encaissement. Aucune dette n'est créée automatiquement.",
        );
    }
    await tx.managedParentReceipt.create({
      data: {
        ...data,
        dossierId: id,
        amount: -original.amount,
        kind: "RECEIPT_REVERSAL",
        reversesId: original.id,
        receivedAt: new Date(),
        recordedBy: actorId,
        allocations: allocations.map((allocation) => ({
          ...allocation,
          amount: -allocation.amount,
        })),
      },
    });
    await tx.managedCourseDossier.update({
      where: { id },
      data: { receivedAmount: { decrement: original.amount } },
    });
    await event(tx, id, actorId, "RECEIPT_REVERSED", {
      receiptId,
      amount: original.amount,
      reason: data.note,
      reference: data.reference,
    });
    return { ok: true };
  });
}

export async function reverseManagedTeacherPayment(
  teacherId: string,
  entryId: string,
  reason: string,
  actorId: string,
) {
  const result = await managedTransaction(async (tx) => {
    await lockTeacherSchedule(tx, teacherId);
    const original = await tx.managedTeacherLedgerEntry.findFirst({
      where: { id: entryId, teacherId, kind: "PAYMENT" },
    });
    if (!original)
      throw new ManagedCourseError("Versement d'origine introuvable.", 404);
    if (
      await tx.managedTeacherLedgerEntry.findUnique({
        where: { reversesId: entryId },
      })
    )
      return { ok: true };
    await tx.managedTeacherLedgerEntry.create({
      data: {
        teacherId,
        kind: "PAYMENT_REVERSAL",
        reversesId: entryId,
        amountDelta: -original.amountDelta,
        note: reason,
        actorId,
        idempotencyKey: `payment-reversal:${entryId}`,
      },
    });
    await enqueueNotificationEvent(
      {
        title: "Correction d'un règlement enregistré",
        message:
          "Une écriture compensatrice a corrigé un versement saisi par l'équipe. Le mouvement d'origine reste visible.",
        type: "MANAGED_PAYMENT_CORRECTION",
        recipientType: "TEACHER",
        teacherId,
        link: "/professeur/accompagnement",
      },
      tx,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}
export async function createManagedContractLink(id: string, actorId: string) {
  const token = randomBytes(32).toString("base64url");
  await managedTransaction(async (tx) => {
    await lockDossier(tx, id);
    await tx.managedCourseDossier.update({
      where: { id },
      data: {
        contractTokenHash: hashToken(token),
        contractTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    await event(tx, id, actorId, "CONTRACT_LINK_CREATED", { expiresInDays: 7 });
  });
  // Fragment is not sent in page requests or Referrer headers.
  return { path: `/demande-cours/accord#${token}` };
}
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function managedContract(token: string, acceptRevision?: number) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ManagedCourseError("Lien invalide ou expiré.", 404);
  return managedTransaction(async (tx) => {
    const found = await tx.managedCourseDossier.findUnique({
      where: { contractTokenHash: hashToken(token) },
      select: { id: true },
    });
    if (!found) throw new ManagedCourseError("Lien invalide ou expiré.", 404);
    const dossier = await lockDossier(tx, found.id);
    if (
      !dossier.contractTokenExpiresAt ||
      dossier.contractTokenExpiresAt.getTime() < Date.now()
    )
      throw new ManagedCourseError("Lien expiré.", 410);
    const recordedTerms = (dossier.acceptanceEvidence as { terms?: unknown } | null)?.terms;
    const parentTerms = dossier.acceptedRevision === dossier.revision && Array.isArray(recordedTerms) && recordedTerms.every((term) => typeof term === "string") ? recordedTerms as string[] : managedParentTermsForVersion(dossier.termsVersion);
    if (acceptRevision !== undefined) {
      if (acceptRevision !== dossier.revision)
        throw new ManagedCourseError(
          "Le dossier a changé. Relisez le nouveau récapitulatif.",
        );
      if (dossier.acceptedRevision !== dossier.revision) {
        await tx.managedCourseDossier.update({
          where: { id: dossier.id },
          data: {
            acceptedAt: new Date(),
            acceptedRevision: dossier.revision,
            acceptanceEvidence: {
              method: "PRIVATE_LINK_CHECKBOX",
              phoneVerified: false,
              version: dossier.termsVersion,
              terms: parentTerms,
              total: dossier.totalPrice,
              sessions: dossier.sessions.map((session) => ({
                date: session.scheduledDate.toISOString().slice(0, 10),
                time: session.scheduledTime,
                amount: session.amount,
              })),
              cadence: dossier.cadence,
            },
          },
        });
        await event(tx, dossier.id, "PARENT_PRIVATE_LINK", "PARENT_ACCEPTED", {
          revision: dossier.revision,
          identityVerified: false,
        });
      }
    }
    return {
      reference: dossier.reference,
      parentTerms,
      termsVersion: dossier.termsVersion,
      revision: dossier.revision,
      parentName: dossier.parentName,
      className: dossier.className,
      subjectName: dossier.subjectName,
      journey: dossier.journey,
      courseFormat: dossier.courseFormat,
      commune: dossier.commune,
      quartier: dossier.quartier,
      cadence: dossier.cadence,
      totalPrice: dossier.totalPrice,
      cancelledAmount: dossier.cancelledAmount,
      receivedAmount: dossier.receivedAmount,
      onHold: dossier.onHold,
      accepted:
        acceptRevision === dossier.revision ||
        dossier.acceptedRevision === dossier.revision,
      sessions: dossier.sessions.map((session) => ({
        date: session.scheduledDate.toISOString().slice(0, 10),
        time: session.scheduledTime,
        amount: session.amount,
        status: session.status,
      })),
    };
  });
}

export async function requestManagedParentAction(
  token: string,
  action: "CANCELLATION" | "DISPUTE",
  reason: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ManagedCourseError("Lien invalide ou expiré.", 404);
  const result = await managedTransaction(async (tx) => {
    const found = await tx.managedCourseDossier.findUnique({
      where: { contractTokenHash: hashToken(token) },
      select: { id: true },
    });
    if (!found) throw new ManagedCourseError("Lien invalide ou expiré.", 404);
    const dossier = await lockDossier(tx, found.id);
    if (
      !dossier.contractTokenExpiresAt ||
      dossier.contractTokenExpiresAt.getTime() < Date.now()
    )
      throw new ManagedCourseError("Lien expiré.", 410);
    const eventAction = `PARENT_${action}_REQUESTED`;
    if (
      (await tx.managedCourseEvent.count({
        where: {
          dossierId: dossier.id,
          action: eventAction,
          createdAt: { gte: new Date(Date.now() - 3_600_000) },
        },
      })) >= 3
    )
      throw new ManagedCourseError(
        "Votre demande est déjà transmise. Contactez Compétence pour tout complément.",
        429,
      );
    if (action === "DISPUTE") {
      for (const teacherId of [
        ...new Set(
          dossier.sessions.flatMap((session) =>
            session.teacherId ? [session.teacherId] : [],
          ),
        ),
      ].sort())
        await lockTeacherSchedule(tx, teacherId);
      await tx.managedCourseDossier.update({
        where: { id: dossier.id },
        data: { onHold: true },
      });
    }
    await event(tx, dossier.id, "PARENT_PRIVATE_LINK", eventAction, {
      reason,
      identityVerified: false,
    });
    await notifyAdmin(
      tx,
      dossier.id,
      action === "DISPUTE"
        ? "Réclamation parent · retenue ouverte"
        : "Demande d'annulation parent",
      `${dossier.reference} · ${reason}`,
    );
    return { ok: true };
  });
  await publishWebPushFlushEvent("outbox_created");
  return result;
}
