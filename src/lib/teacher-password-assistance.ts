import { db } from "@/lib/db";
import { normalizeAccountPhone } from "@/lib/account-phone";
import { normalizeTeacherPhone } from "@/lib/teacher-portal";
import {
  isPasswordResetIpAllowed,
  isPasswordResetRequestAllowed,
  PASSWORD_RESET_AUDIT_RETENTION_MS,
  PASSWORD_RESET_REQUEST_WINDOW_MS,
} from "@/lib/password-reset-rate-limit";
import { passwordEmailIdentifier } from "@/lib/password-email-outbox-crypto";

export const TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE =
  "TEACHER_PASSWORD_ASSISTANCE_REQUESTED" as const;

export type TeacherPasswordAssistanceResult = {
  accepted: boolean;
  notificationId: string | null;
  reused: boolean;
};

/**
 * Enregistre une demande publique sans jamais indiquer au demandeur si le
 * numéro appartient à un professeur. Les identifiants de quota restent
 * pseudonymisés et le numéro brut n'est jamais écrit dans les journaux.
 */
export async function requestTeacherPasswordAssistance(input: {
  phone: string;
  clientIdentifier: string;
}): Promise<TeacherPasswordAssistanceResult> {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || null;
  const validPhone = normalizeAccountPhone(input.phone);
  const portalPhone = normalizeTeacherPhone(input.phone);
  if (!secret || !validPhone || !portalPhone) {
    if (!secret) {
      console.error("[teacher-password-assistance] Stable application secret unavailable.");
    }
    return { accepted: false, notificationId: null, reused: false };
  }

  const now = new Date();
  const accountHash = passwordEmailIdentifier(`teacher-phone:${portalPhone}`, secret);
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
            accountType: "PROFESSOR_PHONE_ASSISTED",
          },
        });

        const teacher = await tx.teacher.findUnique({
          where: { portalPhone },
          select: {
            id: true,
            fullName: true,
            professionalName: true,
          },
        });

        // Même résultat public pour un numéro inconnu : aucune information
        // de compte ne quitte le serveur et aucune alerte admin n'est créée.
        if (!teacher) {
          return { accepted: true, notificationId: null, reused: false };
        }

        const existing = await tx.notification.findFirst({
          where: {
            type: TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
            recipientType: "ADMIN",
            teacherId: teacher.id,
            userId: null,
            read: false,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        });
        if (existing) {
          if (existing.createdAt < windowStart) {
            await tx.notification.update({
              where: { id: existing.id },
              data: {
                status: "RELAUNCHED",
                priority: "URGENT",
                sentAt: now,
                createdAt: now,
              },
            });
          }
          return { accepted: true, notificationId: existing.id, reused: true };
        }

        const teacherName = teacher.professionalName || teacher.fullName;
        const notification = await tx.notification.create({
          data: {
            userId: null,
            title: "Assistance mot de passe professeur demandée",
            message: `${teacherName} demande un nouvel accès. Vérifiez son identité et son statut avant de créer puis transmettre un mot de passe temporaire.`,
            type: TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE,
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "CREATED",
            priority: "URGENT",
            read: false,
            teacherId: teacher.id,
            sentAt: now,
            link: `/admin/professeurs/${teacher.id}/modifier?assistanceMotDePasse=1`,
            actionLabel: "Vérifier et créer l'accès",
            actionType: "ASSIGN_TEACHER_TEMPORARY_PASSWORD",
          },
          select: { id: true },
        });

        return { accepted: true, notificationId: notification.id, reused: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isRetryableTransactionConflict(error) && attempt < 3) continue;
      console.error(
        "[teacher-password-assistance] Unable to register assisted recovery request.",
        error instanceof Error ? error.message : error,
      );
      return { accepted: false, notificationId: null, reused: false };
    }
  }

  return { accepted: false, notificationId: null, reused: false };
}

function isRetryableTransactionConflict(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error.code === "P2034" || error.code === "P2002"),
  );
}
