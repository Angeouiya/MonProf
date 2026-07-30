import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendClientPasswordChangedEmail, sendClientResetPasswordEmail } from "@/lib/notification-delivery";
import {
  isPasswordResetIpAllowed,
  isPasswordResetRequestAllowed,
  PASSWORD_RESET_AUDIT_RETENTION_MS,
  PASSWORD_RESET_REQUEST_WINDOW_MS,
} from "@/lib/password-reset-rate-limit";
import {
  decryptPasswordEmailPayload,
  encryptPasswordEmailPayload,
  passwordEmailIdentifier,
} from "@/lib/password-email-outbox-crypto";
import { selectPasswordEmailCandidateBatch } from "@/lib/password-email-candidate-selection";
import { normalizeAccountPhone } from "@/lib/account-phone";
import { CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE } from "@/lib/client-password-assistance";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const CONFIRMATION_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const OUTBOX_TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const OUTBOX_LEASE_MS = 5 * 60 * 1000;
const OUTBOX_MIN_DELIVERY_WINDOW_MS = 20_000;
const ACTIVE_STATUSES = ["PENDING", "RETRY", "PROCESSING"];

export type PasswordAccountType = "CLIENT" | "PROFESSOR" | "ADMIN";

type ResetEmailPayload = {
  version: 1;
  kind: "PASSWORD_RESET";
  accountType: "CLIENT";
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  tokenRecordId: string;
  userId: string;
  teacherId: null;
  tokenExpiresAt: string;
};

type PasswordChangedEmailPayload = {
  version: 1;
  kind: "PASSWORD_CHANGED";
  accountType: PasswordAccountType;
  recipientEmail: string;
  recipientName: string;
  changedAt: string;
  securityUrl: string;
  accountLabel: string;
  userId: string | null;
  teacherId: string | null;
};

type PasswordEmailPayload = ResetEmailPayload | PasswordChangedEmailPayload;

export function isAcceptedPasswordEmailDelivery(input: {
  ok?: boolean;
  externalId?: string | null;
  statusCode?: number | null;
}): input is { ok: true; externalId: string; statusCode: number } {
  return input.ok === true
    && typeof input.externalId === "string"
    && Boolean(input.externalId.trim())
    && typeof input.statusCode === "number"
    && input.statusCode >= 200
    && input.statusCode < 300;
}

export async function requestPasswordResetEmail(input: {
  email: string;
  clientIdentifier: string;
  appOrigin: string;
}) {
  const secret = getOutboxSecret();
  if (!secret) {
    console.error("[password-reset] NEXTAUTH_SECRET is unavailable for the encrypted outbox.");
    return { accepted: false, jobId: null as string | null, reused: false };
  }

  const now = new Date();
  const normalizedEmail = input.email.toLowerCase().trim();
  const accountHash = passwordEmailIdentifier(`account:${normalizedEmail}`, secret);
  const routingHash = passwordEmailIdentifier(
    `reset-route:CLIENT:${normalizedEmail}`,
    secret,
  );
  const ipHash = passwordEmailIdentifier(`ip:${input.clientIdentifier}`, secret);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.passwordResetRequestAudit.deleteMany({
          where: { createdAt: { lt: new Date(now.getTime() - PASSWORD_RESET_AUDIT_RETENTION_MS) } },
        });

        const windowStart = new Date(now.getTime() - PASSWORD_RESET_REQUEST_WINDOW_MS);
        const [recentIpRequests, recentAccountRequests] = await Promise.all([
          tx.passwordResetRequestAudit.count({ where: { ipHash, createdAt: { gte: windowStart } } }),
          tx.passwordResetRequestAudit.count({ where: { accountHash, createdAt: { gte: windowStart } } }),
        ]);
        if (
          !isPasswordResetIpAllowed(recentIpRequests)
          || !isPasswordResetRequestAllowed(recentAccountRequests)
        ) {
          return { accepted: false, jobId: null, reused: false };
        }

        const audit = await tx.passwordResetRequestAudit.create({
          data: {
            ipHash,
            accountHash,
            accountType: "CLIENT",
          },
          select: { id: true },
        });

        // Une demande répétée suit exactement le même chemin d'audit et de
        // quota qu'une première demande. Elle peut réutiliser le lien actif,
        // mais elle ne contourne jamais les limites par compte ou par IP.
        const existing = await tx.passwordEmailOutbox.findFirst({
          where: {
            kind: "PASSWORD_RESET",
            routingHash,
            status: { in: ACTIVE_STATUSES },
            expiresAt: { gt: now },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, status: true },
        });
        if (existing) {
          return { accepted: true, jobId: existing.id, reused: true };
        }

        const target = await resolveClientResetTarget(tx, normalizedEmail);
        if (!target) {
          return { accepted: true, jobId: null, reused: false };
        }

        // A corrected account-space choice supersedes an older unsent/retry job
        // for the same pseudonymous email. A job already being delivered is
        // allowed to finish; the new job is processed immediately after it.
        await tx.passwordEmailOutbox.updateMany({
          where: {
            kind: "PASSWORD_RESET",
            accountHash,
            status: { in: ["PENDING", "RETRY"] },
          },
          data: {
            status: "SUPERSEDED",
            lockedAt: null,
            payloadCiphertext: null,
            payloadIv: null,
            payloadAuthTag: null,
            lastError: "Remplacé par une demande plus récente pour ce compte.",
          },
        });

        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
        const resetUrl = buildClientResetUrl(input.appOrigin, token);
        const tokenRecord = await tx.passwordResetToken.create({
          data: { userId: target.id, tokenHash, expiresAt },
          select: { id: true },
        });
        const dedupeKey = passwordEmailIdentifier(`password-reset:${tokenHash}`, secret);
        const payload: ResetEmailPayload = {
          version: 1,
          kind: "PASSWORD_RESET",
          accountType: "CLIENT",
          recipientEmail: target.email,
          recipientName: target.name,
          resetUrl,
          tokenRecordId: tokenRecord.id,
          userId: target.id,
          teacherId: null,
          tokenExpiresAt: expiresAt.toISOString(),
        };
        const encrypted = encryptPasswordEmailPayload(payload, secret, dedupeKey);
        const outbox = await tx.passwordEmailOutbox.create({
          data: {
            requestAudit: { connect: { id: audit.id } },
            kind: payload.kind,
            accountHash,
            routingHash,
            dedupeKey,
            ...encrypted,
            expiresAt,
          },
          select: { id: true },
        });

        return { accepted: true, jobId: outbox.id, reused: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isRetryableTransactionConflict(error) && attempt < 3) continue;
      console.error(
        "[password-reset] Unable to reserve encrypted email outbox job.",
        error instanceof Error ? error.message : error,
      );
      return { accepted: false, jobId: null, reused: false };
    }
  }

  return { accepted: false, jobId: null, reused: false };
}

export async function requestPasswordResetAssistanceByPhone(input: {
  phone: string;
  clientIdentifier: string;
}) {
  const secret = getOutboxSecret();
  const phoneNormalized = normalizeAccountPhone(input.phone);
  if (!secret || !phoneNormalized) {
    if (!secret) {
      console.error("[password-reset] NEXTAUTH_SECRET is unavailable for assisted recovery.");
    }
    return { accepted: false, notificationId: null as string | null, reused: false };
  }

  const now = new Date();
  const accountHash = passwordEmailIdentifier(`account-phone:${phoneNormalized}`, secret);
  const ipHash = passwordEmailIdentifier(`ip:${input.clientIdentifier}`, secret);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.passwordResetRequestAudit.deleteMany({
          where: { createdAt: { lt: new Date(now.getTime() - PASSWORD_RESET_AUDIT_RETENTION_MS) } },
        });

        const windowStart = new Date(now.getTime() - PASSWORD_RESET_REQUEST_WINDOW_MS);
        const [recentIpRequests, recentAccountRequests] = await Promise.all([
          tx.passwordResetRequestAudit.count({ where: { ipHash, createdAt: { gte: windowStart } } }),
          tx.passwordResetRequestAudit.count({ where: { accountHash, createdAt: { gte: windowStart } } }),
        ]);
        if (
          !isPasswordResetIpAllowed(recentIpRequests)
          || !isPasswordResetRequestAllowed(recentAccountRequests)
        ) {
          return { accepted: false, notificationId: null, reused: false };
        }

        await tx.passwordResetRequestAudit.create({
          data: {
            ipHash,
            accountHash,
            accountType: "CLIENT_PHONE_ASSISTED",
          },
        });

        const target = await tx.user.findUnique({
          where: { phoneNormalized },
          select: { id: true, name: true, email: true, phone: true, role: true },
        });
        // Le circuit assisté est strictement réservé aux clients qui ne
        // disposent pas d'email; toute autre situation suit la même réponse
        // publique mais ne crée aucune notification administrateur.
        if (!target || target.role !== "CLIENT" || target.email) {
          return { accepted: true, notificationId: null, reused: false };
        }

        const existing = await tx.notification.findFirst({
          where: {
            type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
            recipientType: "ADMIN",
            clientId: target.id,
            read: false,
            createdAt: { gte: windowStart },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (existing) {
          return { accepted: true, notificationId: existing.id, reused: true };
        }

        const notification = await tx.notification.create({
          data: {
            userId: null,
            title: "Assistance mot de passe client demandée",
            message: `${target.name} demande une récupération assistée de son compte sans email. Vérifiez son identité par téléphone avant d'attribuer un mot de passe temporaire.`,
            type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "CREATED",
            priority: "URGENT",
            clientId: target.id,
            sentAt: now,
            link: `/admin/clients/${target.id}?assistanceMotDePasse=1`,
            actionLabel: "Vérifier et assister",
            actionType: "ASSIGN_CLIENT_TEMPORARY_PASSWORD",
          },
          select: { id: true },
        });

        return { accepted: true, notificationId: notification.id, reused: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isRetryableTransactionConflict(error) && attempt < 3) continue;
      console.error(
        "[password-reset] Unable to reserve assisted recovery request.",
        error instanceof Error ? error.message : error,
      );
      return { accepted: false, notificationId: null, reused: false };
    }
  }

  return { accepted: false, notificationId: null, reused: false };
}

export type PasswordChangedEmailInput = {
  accountType: PasswordAccountType;
  email?: string | null;
  name: string;
  changedAt: Date;
  securityUrl: string;
  accountLabel: string;
  sourceTokenId: string;
  userId?: string | null;
  teacherId?: string | null;
};

export async function enqueuePasswordChangedEmail(input: PasswordChangedEmailInput) {
  return enqueuePasswordChangedEmailWithClient(db, input);
}

export async function enqueuePasswordChangedEmailInTransaction(
  tx: Prisma.TransactionClient,
  input: PasswordChangedEmailInput,
) {
  return enqueuePasswordChangedEmailWithClient(tx, input);
}

export async function supersedeActivePasswordResetEmailsInTransaction(
  tx: Prisma.TransactionClient,
  email?: string | null,
) {
  const normalizedEmail = email?.toLowerCase().trim() ?? "";
  const secret = getOutboxSecret();
  if (!normalizedEmail || !secret) return 0;

  const accountHash = passwordEmailIdentifier(`account:${normalizedEmail}`, secret);
  const result = await tx.passwordEmailOutbox.updateMany({
    where: {
      kind: "PASSWORD_RESET",
      accountHash,
      status: { in: ACTIVE_STATUSES },
    },
    data: {
      status: "SUPERSEDED",
      lockedAt: null,
      payloadCiphertext: null,
      payloadIv: null,
      payloadAuthTag: null,
      lastError: "Invalidé après la modification réussie du mot de passe du compte.",
    },
  });
  return result.count;
}

async function enqueuePasswordChangedEmailWithClient(
  client: Prisma.TransactionClient | typeof db,
  input: PasswordChangedEmailInput,
) {
  const normalizedEmail = input.email?.toLowerCase().trim() ?? "";
  if (!normalizedEmail) return null;

  const secret = getOutboxSecret();
  if (!secret) {
    console.error("[password-reset] Confirmation email not queued because NEXTAUTH_SECRET is unavailable.");
    return null;
  }

  const accountHash = passwordEmailIdentifier(`account:${normalizedEmail}`, secret);
  const routingHash = passwordEmailIdentifier(`password-changed:${input.accountType}:${normalizedEmail}`, secret);
  const dedupeKey = passwordEmailIdentifier(`password-changed:${input.sourceTokenId}`, secret);
  const payload: PasswordChangedEmailPayload = {
    version: 1,
    kind: "PASSWORD_CHANGED",
    accountType: input.accountType,
    recipientEmail: normalizedEmail,
    recipientName: input.name,
    changedAt: input.changedAt.toISOString(),
    securityUrl: input.securityUrl,
    accountLabel: input.accountLabel,
    userId: input.userId ?? null,
    teacherId: input.teacherId ?? null,
  };
  const encrypted = encryptPasswordEmailPayload(payload, secret, dedupeKey);
  const expiresAt = new Date(input.changedAt.getTime() + CONFIRMATION_JOB_TTL_MS);

  const job = await client.passwordEmailOutbox.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      kind: payload.kind,
      accountHash,
      routingHash,
      dedupeKey,
      ...encrypted,
      expiresAt,
    },
    select: { id: true },
  });
  return job.id;
}

export async function flushPasswordEmailOutbox(options: {
  limit?: number;
  jobIds?: string[];
} = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const now = new Date();
  const staleBefore = new Date(now.getTime() - OUTBOX_LEASE_MS);

  await db.passwordEmailOutbox.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
    data: {
      status: "RETRY",
      availableAt: now,
      lockedAt: null,
      lastError: "Traitement interrompu avant confirmation; reprise automatique.",
    },
  });
  const expired = await expireActivePasswordEmailJobs(now);

  const candidateWhere = {
    ...(options.jobIds?.length ? { id: { in: options.jobIds } } : {}),
    status: { in: ["PENDING", "RETRY"] },
    availableAt: { lte: now },
    expiresAt: { gt: new Date(now.getTime() + OUTBOX_MIN_DELIVERY_WINDOW_MS) },
  } satisfies Prisma.PasswordEmailOutboxWhereInput;
  const candidateOrder: Prisma.PasswordEmailOutboxOrderByWithRelationInput[] = [
    { createdAt: "asc" },
    { id: "asc" },
  ];
  const candidateSelect = { id: true, kind: true, createdAt: true } as const;

  // Le `take` s'applique après avoir réservé une fenêtre équivalente
  // aux resets. Ainsi, un lot de confirmations plus anciennes ne peut jamais
  // masquer tous les resets plus récents du batch global.
  const [resetCandidates, otherCandidates] = await Promise.all([
    db.passwordEmailOutbox.findMany({
      where: { ...candidateWhere, kind: "PASSWORD_RESET" },
      orderBy: candidateOrder,
      take: limit,
      select: candidateSelect,
    }),
    db.passwordEmailOutbox.findMany({
      where: { ...candidateWhere, kind: { not: "PASSWORD_RESET" } },
      orderBy: candidateOrder,
      take: limit,
      select: candidateSelect,
    }),
  ]);
  const candidates = selectPasswordEmailCandidateBatch(
    [...resetCandidates, ...otherCandidates],
    limit,
  );

  const summary = {
    selected: candidates.length,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    expired,
    purgedResetTokens: 0,
  };
  for (const candidate of candidates) {
    const outcome = await processPasswordEmailJob(candidate.id);
    summary[outcome] += 1;
  }

  const terminalBefore = new Date(now.getTime() - OUTBOX_TERMINAL_RETENTION_MS);
  await db.passwordEmailOutbox.deleteMany({
    where: {
      status: { in: ["SENT", "FAILED", "SUPERSEDED"] },
      updatedAt: { lt: terminalBefore },
    },
  });
  summary.purgedResetTokens = (await db.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: new Date(now.getTime() - PASSWORD_RESET_TOKEN_RETENTION_MS) },
    },
  })).count;
  return summary;
}

async function expireActivePasswordEmailJobs(now: Date) {
  return db.$transaction(async (tx) => {
    const groups = await tx.$queryRaw<Array<{ kind: string; count: number }>>(Prisma.sql`
      WITH expired AS (
        UPDATE "PasswordEmailOutbox"
        SET
          "status" = 'FAILED',
          "failedAt" = ${now},
          "lockedAt" = NULL,
          "payloadCiphertext" = NULL,
          "payloadIv" = NULL,
          "payloadAuthTag" = NULL,
          "lastError" = 'Fenêtre d''envoi expirée.',
          "updatedAt" = ${now}
        WHERE "status" IN ('PENDING', 'RETRY', 'PROCESSING')
          AND "expiresAt" <= ${now}
        RETURNING "kind"
      )
      SELECT "kind", COUNT(*)::integer AS "count"
      FROM expired
      GROUP BY "kind"
    `);
    const total = groups.reduce((sum, group) => sum + Number(group.count), 0);
    if (total === 0) return 0;

    const changedCount = groups
      .filter((group) => group.kind === "PASSWORD_CHANGED")
      .reduce((sum, group) => sum + Number(group.count), 0);
    const otherCount = groups
      .filter((group) => group.kind !== "PASSWORD_RESET" && group.kind !== "PASSWORD_CHANGED")
      .reduce((sum, group) => sum + Number(group.count), 0);
    const notifiableCount = changedCount + otherCount;
    // Les resets client avec email restent entièrement autonomes : même un
    // échec d'infrastructure ne crée pas de demande de traitement admin.
    if (notifiableCount === 0) return total;
    const details = [
      changedCount > 0 ? `${changedCount} confirmation(s)` : null,
      otherCount > 0 ? `${otherCount} autre(s)` : null,
    ].filter(Boolean).join(", ");

    await tx.notification.create({
      data: {
        userId: null,
        title: "Emails de sécurité expirés",
        message: `${notifiableCount} job(s) de confirmation de sécurité ont expiré sans confirmation d'envoi (${details}). Les payloads chiffrés ont été supprimés.`,
        type: "PASSWORD_EMAIL_OUTBOX_EXPIRED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "FAILED",
        priority: "URGENT",
        sentAt: now,
        link: "/admin/notifications",
        actionLabel: "Vérifier les emails",
      },
    });

    return total;
  });
}

async function processPasswordEmailJob(jobId: string): Promise<"sent" | "retried" | "failed" | "skipped"> {
  const job = await claimPasswordEmailJob(jobId);
  if (!job) return "skipped";

  const secret = getOutboxSecret();
  if (!secret) {
    await retryPasswordEmailJob(job.id, job.attempts, "NEXTAUTH_SECRET indisponible.");
    return "retried";
  }
  if (!job.payloadCiphertext || !job.payloadIv || !job.payloadAuthTag) {
    await failPasswordEmailJob(job.id, "Payload chiffré absent.");
    return "failed";
  }

  let payload: PasswordEmailPayload;
  try {
    payload = decryptPasswordEmailPayload<PasswordEmailPayload>({
      payloadCiphertext: job.payloadCiphertext,
      payloadIv: job.payloadIv,
      payloadAuthTag: job.payloadAuthTag,
    }, secret, job.dedupeKey);
    if (!isPasswordEmailPayload(payload) || payload.kind !== job.kind) {
      throw new Error("PASSWORD_EMAIL_PAYLOAD_INVALID");
    }
  } catch (error) {
    console.error("[password-email-outbox] Unable to decrypt job.", job.id, error instanceof Error ? error.message : error);
    await failPasswordEmailJob(job.id, "Payload chiffré invalide.");
    return "failed";
  }

  try {
    if (job.acceptedAt) {
      if (payload.kind === "PASSWORD_RESET") {
        const finalized = await finalizeResetTokenDelivery(job.id, payload);
        if (!finalized) {
          await failPasswordEmailJob(job.id, "Le token accepté n'est plus utilisable.");
          return "failed";
        }
      }
      await completePasswordEmailJob(job.id, job.externalId);
      return "sent";
    }

    if (payload.kind === "PASSWORD_RESET") {
      const ready = await isResetTokenEligibleForDelivery(payload);
      if (!ready) {
        await failPasswordEmailJob(job.id, "Le token de réinitialisation n'est plus utilisable.");
        return "failed";
      }
    }

    const delivery = payload.kind === "PASSWORD_RESET"
      ? await sendClientResetPasswordEmail({
          to: payload.recipientEmail,
          name: payload.recipientName,
          resetUrl: payload.resetUrl,
          idempotencyKey: job.dedupeKey,
        })
      : await sendClientPasswordChangedEmail({
          to: payload.recipientEmail,
          name: payload.recipientName,
          changedAt: new Date(payload.changedAt),
          securityUrl: payload.securityUrl,
          idempotencyKey: job.dedupeKey,
          accountLabel: payload.accountLabel,
        });

    if (isAcceptedPasswordEmailDelivery(delivery)) {
      await rememberAcceptedDelivery(job.id, delivery.externalId);
      if (payload.kind === "PASSWORD_RESET") {
        const finalized = await finalizeResetTokenDelivery(job.id, payload);
        if (!finalized) {
          await failPasswordEmailJob(job.id, "Le token envoyé n'est plus utilisable.");
          return "failed";
        }
      }
      await completePasswordEmailJob(job.id, delivery.externalId);
      return "sent";
    }

    if (delivery.ok) {
      await rememberAmbiguousDelivery(job.id);
      await retryPasswordEmailJob(
        job.id,
        job.attempts,
        "Gmail n'a pas fourni une preuve 2xx avec identifiant de message.",
      );
      return "retried";
    }

    if (delivery.ambiguous) {
      await rememberAmbiguousDelivery(job.id);
      await retryPasswordEmailJob(job.id, job.attempts, delivery.message);
      return "retried";
    }

    if (delivery.retryable) {
      await retryPasswordEmailJob(job.id, job.attempts, delivery.message);
      return "retried";
    }

    if (payload.kind === "PASSWORD_RESET" && !job.ambiguousAt) {
      await deleteResetToken(payload);
    }
    await failPasswordEmailJob(job.id, delivery.message);
    await recordTerminalFailure(payload, job.id, delivery.message);
    return "failed";
  } catch (error) {
    console.error("[password-email-outbox] Job processing failed.", job.id, error instanceof Error ? error.message : error);
    await retryPasswordEmailJob(
      job.id,
      job.attempts,
      "Erreur d'infrastructure pendant le traitement de l'email.",
    ).catch((retryError) => {
      console.error("[password-email-outbox] Unable to release job lease.", retryError);
    });
    return "retried";
  }
}

async function claimPasswordEmailJob(jobId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const candidate = await tx.passwordEmailOutbox.findUnique({ where: { id: jobId } });
      const now = new Date();
      if (
        !candidate
        || !["PENDING", "RETRY"].includes(candidate.status)
        || candidate.availableAt > now
        || candidate.expiresAt <= new Date(now.getTime() + OUTBOX_MIN_DELIVERY_WINDOW_MS)
      ) {
        return null;
      }

      // Un seul envoi par compte peut être en cours. Le verrou logique est
      // doublé par l'index partiel PROCESSING afin de rester sûr entre workers.
      const processingForAccount = await tx.passwordEmailOutbox.findFirst({
        where: {
          accountHash: candidate.accountHash,
          status: "PROCESSING",
          expiresAt: { gt: now },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (processingForAccount) return null;

      const executableWhere = {
        accountHash: candidate.accountHash,
        status: { in: ["PENDING", "RETRY"] },
        availableAt: { lte: now },
        expiresAt: { gt: new Date(now.getTime() + OUTBOX_MIN_DELIVERY_WINDOW_MS) },
      } satisfies Prisma.PasswordEmailOutboxWhereInput;

      // Un reset disponible est prioritaire sur les confirmations. Un ancien
      // PASSWORD_CHANGED encore en backoff ne peut donc plus bloquer le lien
      // de récupération. Dans chaque classe, l'ordre reste déterministe.
      const firstAvailableReset = await tx.passwordEmailOutbox.findFirst({
        where: { ...executableWhere, kind: "PASSWORD_RESET" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      const firstAvailableForAccount = firstAvailableReset ?? await tx.passwordEmailOutbox.findFirst({
        where: executableWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (firstAvailableForAccount?.id !== candidate.id) return null;

      const claimed = await tx.passwordEmailOutbox.updateMany({
        where: {
          id: candidate.id,
          status: { in: ["PENDING", "RETRY"] },
          availableAt: { lte: now },
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          lockedAt: now,
        },
      });
      if (claimed.count !== 1) return null;
      return tx.passwordEmailOutbox.findUnique({ where: { id: candidate.id } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (!isRetryableTransactionConflict(error)) {
      console.error("[password-email-outbox] Claim failed.", jobId, error instanceof Error ? error.message : error);
    }
    return null;
  }
}

async function isResetTokenEligibleForDelivery(payload: ResetEmailPayload) {
  const now = new Date();
  if (new Date(payload.tokenExpiresAt) <= new Date(now.getTime() + OUTBOX_MIN_DELIVERY_WINDOW_MS)) return false;
  const token = await db.passwordResetToken.findUnique({
    where: { id: payload.tokenRecordId },
    select: { userId: true, usedAt: true, deliveredAt: true, expiresAt: true },
  });
  return Boolean(
    token
    && token.userId === payload.userId
    && !token.usedAt
    && !token.deliveredAt
    && token.expiresAt > now,
  );
}

async function finalizeResetTokenDelivery(jobId: string, payload: ResetEmailPayload) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const now = new Date();
        const acceptedJob = await tx.passwordEmailOutbox.findUnique({
          where: { id: jobId },
          select: { kind: true, acceptedAt: true, externalId: true },
        });
        if (
          acceptedJob?.kind !== "PASSWORD_RESET"
          || !acceptedJob.acceptedAt
          || !acceptedJob.externalId
        ) {
          return false;
        }
        const current = await tx.passwordResetToken.findUnique({
          where: { id: payload.tokenRecordId },
          select: { userId: true, deliveredAt: true, usedAt: true, expiresAt: true },
        });
        if (!current || current.userId !== payload.userId || current.expiresAt <= now) return false;
        if (current.usedAt) return Boolean(current.deliveredAt);
        if (!current.deliveredAt) {
          const marked = await tx.passwordResetToken.updateMany({
            where: {
              id: payload.tokenRecordId,
              userId: payload.userId,
              usedAt: null,
              deliveredAt: null,
              expiresAt: { gt: now },
            },
            data: { deliveredAt: now },
          });
          if (marked.count !== 1) return false;
        }
        await tx.passwordResetToken.updateMany({
          where: {
            userId: payload.userId,
            id: { not: payload.tokenRecordId },
            deliveredAt: { not: null },
            usedAt: null,
          },
          data: { usedAt: now },
        });
        return true;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isRetryableTransactionConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  return false;
}

async function deleteResetToken(payload: ResetEmailPayload) {
  await db.passwordResetToken.deleteMany({
    where: { id: payload.tokenRecordId, userId: payload.userId, usedAt: null },
  });
}

async function rememberAcceptedDelivery(jobId: string, externalId: string) {
  await db.passwordEmailOutbox.update({
    where: { id: jobId },
    data: { acceptedAt: new Date(), externalId },
  });
}

async function rememberAmbiguousDelivery(jobId: string) {
  await db.passwordEmailOutbox.update({
    where: { id: jobId },
    data: { ambiguousAt: new Date() },
  });
}

async function completePasswordEmailJob(jobId: string, externalId: string | null) {
  await db.passwordEmailOutbox.update({
    where: { id: jobId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      lockedAt: null,
      externalId,
      lastError: null,
      payloadCiphertext: null,
      payloadIv: null,
      payloadAuthTag: null,
    },
  });
}

async function retryPasswordEmailJob(jobId: string, attempts: number, message: string) {
  const delayMinutes = Math.min(60, 2 ** Math.min(Math.max(attempts - 1, 0), 6));
  await db.passwordEmailOutbox.update({
    where: { id: jobId },
    data: {
      status: "RETRY",
      availableAt: new Date(Date.now() + delayMinutes * 60 * 1000),
      lockedAt: null,
      lastError: sanitizeProviderMessage(message),
    },
  });
}

async function failPasswordEmailJob(jobId: string, message: string) {
  await db.passwordEmailOutbox.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      lockedAt: null,
      lastError: sanitizeProviderMessage(message),
      payloadCiphertext: null,
      payloadIv: null,
      payloadAuthTag: null,
    },
  });
}

async function recordTerminalFailure(payload: PasswordEmailPayload, jobId: string, message: string) {
  if (payload.kind === "PASSWORD_RESET") {
    console.error(
      "[password-email-outbox] Client reset email failed without admin escalation.",
      jobId,
      sanitizeProviderMessage(message),
    );
    return;
  }
  try {
    await db.notification.create({
      data: {
        userId: null,
        title: "Email de sécurité non envoyé",
        message: `Le job ${jobId} a échoué de façon permanente. ${sanitizeProviderMessage(message)}`,
        type: "PASSWORD_RESET_EMAIL_FAILED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "FAILED",
        priority: "URGENT",
        clientId: payload.accountType === "CLIENT" ? payload.userId : null,
        teacherId: payload.teacherId,
        sentAt: new Date(),
        link: payload.teacherId
          ? `/admin/professeurs/${payload.teacherId}`
          : payload.accountType === "ADMIN"
            ? "/admin/parametres"
            : payload.userId
              ? `/admin/clients/${payload.userId}`
              : "/admin/notifications",
        actionLabel: "Vérifier l'envoi",
      },
    });
  } catch (error) {
    console.error("[password-email-outbox] Unable to record terminal failure.", error);
  }
}

async function resolveClientResetTarget(tx: Prisma.TransactionClient, email: string) {
  const user = await tx.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user || user.role !== "CLIENT" || !user.email) return null;
  return { id: user.id, name: user.name, email: user.email };
}

function buildClientResetUrl(appOrigin: string, token: string) {
  const url = new URL("/reinitialiser-mot-de-passe", appOrigin);
  url.searchParams.set("token", token);
  url.searchParams.set("compte", "client");
  return url.toString();
}

function getOutboxSecret() {
  return process.env.NEXTAUTH_SECRET?.trim() || null;
}

function isPasswordEmailPayload(value: unknown): value is PasswordEmailPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PasswordEmailPayload>;
  if (
    payload.version !== 1
    || (payload.kind !== "PASSWORD_RESET" && payload.kind !== "PASSWORD_CHANGED")
    || typeof payload.recipientEmail !== "string"
    || typeof payload.recipientName !== "string"
  ) return false;
  if (payload.kind === "PASSWORD_RESET") {
    return payload.accountType === "CLIENT"
      && typeof payload.userId === "string"
      && payload.teacherId === null;
  }
  return payload.accountType === "CLIENT"
    || payload.accountType === "PROFESSOR"
    || payload.accountType === "ADMIN";
}

function sanitizeProviderMessage(message: string) {
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function isRetryableTransactionConflict(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error.code === "P2034" || error.code === "P2002"),
  );
}
