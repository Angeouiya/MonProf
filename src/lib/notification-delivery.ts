import { db } from "@/lib/db";
import {
  getGmailSenderIdentity,
  isGmailConfigured,
  isValidGmailSenderIdentity,
  sendGmailEmail,
} from "@/lib/gmail-email";
import {
  readPasswordEmailDispatchSnapshot,
  type PasswordEmailDispatchSnapshot,
  type PasswordEmailProvider,
} from "@/lib/password-email-provider";
import { passwordChangedEmailTemplate, passwordResetEmailTemplate } from "@/lib/password-email-templates";
import { normalizeIvorianPhoneForWhatsApp } from "@/lib/phone";
import {
  getResendSenderIdentity,
  isResendConfigured,
  isValidResendSenderIdentity,
  sendResendEmail,
} from "@/lib/resend-email";

export type DeliveryResult = {
  ok: boolean;
  provider: "gmail" | "resend" | "twilio" | "whatsapp-cloud" | "internal";
  configured: boolean;
  skipped?: boolean;
  message: string;
  externalId?: string | null;
  retryable?: boolean;
  ambiguous?: boolean;
  statusCode?: number | null;
};

export type EmailDeliveryResult = DeliveryResult & {
  provider: "gmail" | "resend";
  externalId: string | null;
  retryable: boolean;
  ambiguous: boolean;
  statusCode: number | null;
};

export function getNotificationProviderStatus(options: { webPushConfigured?: boolean } = {}) {
  return {
    email: isGmailConfigured() || isResendConfigured(),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    webPush: Boolean(
      options.webPushConfigured
      || (process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY)
    ),
    cron: Boolean(process.env.CRON_SECRET),
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}): Promise<EmailDeliveryResult> {
  const gmail = await sendGmailEmail(input);
  if (gmail.ok) {
    return asGmailDeliveryResult(gmail);
  }

  // A timeout, network interruption or ambiguous 5xx may mean Gmail accepted
  // the message without returning its id. Never cross-send such a request.
  if (gmail.ambiguous) return asGmailDeliveryResult(gmail);

  const resendConfigured = isResendConfigured();
  if (resendConfigured) {
    const resend = await sendResendEmail(input);
    if (resend.ok) {
      return {
        ...resend,
        message: gmail.configured
          ? "Email envoyé par le fournisseur de secours Resend. Gmail est temporairement indisponible."
          : resend.message,
      } satisfies EmailDeliveryResult;
    }
    return {
      ...resend,
      message: gmail.configured
        ? "L'envoi a échoué avec Gmail et avec le fournisseur de secours."
        : resend.message,
    } satisfies EmailDeliveryResult;
  }

  return {
    ...asGmailDeliveryResult(gmail),
    message: gmail.configured
      ? gmail.message
      : "Aucun fournisseur email n'est configuré. Configurez Gmail OAuth ou Resend.",
  } satisfies EmailDeliveryResult;
}

export async function sendSms(input: { to: string; text: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return {
      ok: false,
      provider: "twilio",
      configured: false,
      message: "Twilio SMS non configuré : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER requis.",
    } satisfies DeliveryResult;
  }

  const to = normalizePhoneForProvider(input.to);
  const body = new URLSearchParams({ To: to, From: from, Body: input.text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await safeJson(res);
  return {
    ok: res.ok,
    provider: "twilio",
    configured: true,
    message: res.ok ? "SMS envoyé." : errorMessage(data, "Échec envoi SMS Twilio."),
    externalId: typeof data?.sid === "string" ? data.sid : null,
  } satisfies DeliveryResult;
}

export async function sendWhatsApp(input: { to: string; text: string }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v20.0";
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      provider: "whatsapp-cloud",
      configured: false,
      message: "WhatsApp Cloud API non configuré : WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID requis.",
    } satisfies DeliveryResult;
  }

  const to = normalizeIvorianPhoneForWhatsApp(input.to);
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: input.text },
    }),
  });
  const data = await safeJson(res);
  const externalId = Array.isArray(data?.messages) ? data.messages[0]?.id : null;
  return {
    ok: res.ok,
    provider: "whatsapp-cloud",
    configured: true,
    message: res.ok ? "WhatsApp envoyé." : errorMessage(data, "Échec envoi WhatsApp Cloud API."),
    externalId: typeof externalId === "string" ? externalId : null,
  } satisfies DeliveryResult;
}

export async function deliverTeacherNotification(id: string) {
  const notification = await db.teacherNotification.findUnique({
    where: { id },
    include: { teacher: true },
  });
  if (!notification) {
    return {
      ok: false,
      provider: "internal",
      configured: true,
      message: "Notification professeur introuvable.",
    } satisfies DeliveryResult;
  }
  if (notification.deletedAt || (notification.expiresAt && notification.expiresAt <= new Date())) {
    return {
      ok: true,
      provider: "internal",
      configured: true,
      skipped: true,
      message: "Notification professeur expirée ou masquée.",
    } satisfies DeliveryResult;
  }

  const channel = notification.channel.toUpperCase();
  const teacherName = notification.teacher.professionalName || notification.teacher.fullName;
  const text = notification.message;
  const result = channel === "EMAIL"
    ? notification.teacher.email
      ? await sendEmail({ to: notification.teacher.email, subject: notification.title, text })
      : missingTarget("resend", `Aucun email professeur pour ${teacherName}.`)
    : channel === "SMS"
      ? await sendSms({ to: notification.teacher.phone, text })
      : channel === "WHATSAPP"
        ? await sendWhatsApp({ to: notification.teacher.phone, text })
        : {
            ok: true,
            provider: "internal",
            configured: true,
            skipped: true,
            message: "Canal interne ou manuel : aucun provider externe requis.",
          } satisfies DeliveryResult;

  await db.teacherNotification.update({
    where: { id },
    data: {
      sent: result.ok,
      status: result.ok ? "SENT" : result.configured ? "FAILED" : "PENDING",
      readAt: notification.readAt,
    },
  });

  return result;
}

export async function dispatchPendingTeacherNotifications(limit = 50) {
  const deliveryEnabled = await getBooleanSetting("notification_delivery_enabled", true);
  if (!deliveryEnabled) {
    return { total: 0, sent: 0, skipped: 0, failed: 0, pendingConfiguration: 0 };
  }

  const pending = await db.teacherNotification.findMany({
    where: {
      channel: { in: ["SMS", "WHATSAPP", "EMAIL"] },
      deletedAt: null,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      OR: [
        { sent: false },
        { status: { in: ["DRAFT", "PENDING"] } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results: DeliveryResult[] = [];
  for (const item of pending) {
    results.push(await deliverTeacherNotification(item.id));
  }
  return summarizeResults(results);
}

export function getPasswordEmailSenderIdentity(
  provider: PasswordEmailProvider,
) {
  return provider === "resend"
    ? getResendSenderIdentity()
    : getGmailSenderIdentity();
}

export function createClientResetPasswordEmailSnapshot(input: {
  name: string;
  resetUrl: string;
  provider: PasswordEmailProvider;
  senderIdentity?: string;
}): PasswordEmailDispatchSnapshot | null {
  const senderIdentity = resolvePasswordEmailSenderIdentity(
    input.provider,
    input.senderIdentity,
  );
  if (!senderIdentity) return null;
  const content = passwordResetEmailTemplate({
    name: input.name,
    resetUrl: input.resetUrl,
    expiresInMinutes: 60,
  });
  return freezePasswordEmailSnapshot({
    provider: input.provider,
    senderIdentity,
    subject: "Réinitialisation de votre mot de passe Compétence.CI",
    text: content.text,
    html: content.html,
  });
}

export function createClientPasswordChangedEmailSnapshot(input: {
  name: string;
  changedAt: Date;
  securityUrl: string;
  accountLabel?: string;
  provider: PasswordEmailProvider;
  senderIdentity?: string;
}): PasswordEmailDispatchSnapshot | null {
  const senderIdentity = resolvePasswordEmailSenderIdentity(
    input.provider,
    input.senderIdentity,
  );
  if (!senderIdentity) return null;
  const changedAtLabel = new Intl.DateTimeFormat("fr-CI", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(input.changedAt);
  const content = passwordChangedEmailTemplate({
    name: input.name,
    changedAtLabel,
    securityUrl: input.securityUrl,
    accountLabel: input.accountLabel,
  });

  return freezePasswordEmailSnapshot({
    provider: input.provider,
    senderIdentity,
    subject: "Votre mot de passe Compétence.CI a été modifié",
    text: content.text,
    html: content.html,
  });
}

export async function sendClientResetPasswordEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
  idempotencyKey: string;
  provider: PasswordEmailProvider;
}): Promise<EmailDeliveryResult> {
  const snapshot = createClientResetPasswordEmailSnapshot(input);
  if (!snapshot) return unavailableSecurityEmailProvider(input.provider);
  return sendPasswordEmailSnapshot({
    snapshot,
    to: input.to,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function sendClientPasswordChangedEmail(input: {
  to: string;
  name: string;
  changedAt: Date;
  securityUrl: string;
  idempotencyKey: string;
  accountLabel?: string;
  provider: PasswordEmailProvider;
}): Promise<EmailDeliveryResult> {
  const snapshot = createClientPasswordChangedEmailSnapshot(input);
  if (!snapshot) return unavailableSecurityEmailProvider(input.provider);
  return sendPasswordEmailSnapshot({
    snapshot,
    to: input.to,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function sendPasswordEmailSnapshot(input: {
  snapshot: PasswordEmailDispatchSnapshot;
  to: string;
  idempotencyKey: string;
}): Promise<EmailDeliveryResult> {
  const snapshot = readPasswordEmailDispatchSnapshot(input.snapshot);
  if (!snapshot) {
    return unavailableSecurityEmailProvider(
      input.snapshot.provider === "resend" ? "resend" : "gmail",
    );
  }
  if (snapshot.provider === "resend") {
    return sendResendEmail({
      to: input.to,
      senderIdentity: snapshot.senderIdentity,
      subject: snapshot.subject,
      text: snapshot.text,
      html: snapshot.html ?? undefined,
      idempotencyKey: input.idempotencyKey,
    });
  }

  const gmail = await sendGmailEmail({
    to: input.to,
    senderIdentity: snapshot.senderIdentity,
    subject: snapshot.subject,
    text: snapshot.text,
    html: snapshot.html ?? undefined,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    ...asGmailDeliveryResult(gmail),
    message: gmail.configured
      ? gmail.message
      : "Gmail Compétence n'est pas configuré pour le fournisseur de sécurité sélectionné.",
  } satisfies EmailDeliveryResult;
}

function resolvePasswordEmailSenderIdentity(
  provider: PasswordEmailProvider,
  requestedIdentity?: string,
) {
  const senderIdentity = requestedIdentity === undefined
    ? getPasswordEmailSenderIdentity(provider)
    : requestedIdentity.trim();
  if (!senderIdentity) return null;
  if (provider === "gmail") {
    const normalized = senderIdentity.toLowerCase();
    return isValidGmailSenderIdentity(normalized) ? normalized : null;
  }
  return isValidResendSenderIdentity(senderIdentity) ? senderIdentity : null;
}

function freezePasswordEmailSnapshot(
  snapshot: PasswordEmailDispatchSnapshot,
) {
  return Object.freeze({ ...snapshot });
}

function unavailableSecurityEmailProvider(
  provider: PasswordEmailProvider,
): EmailDeliveryResult {
  return {
    ok: false,
    provider,
    configured: false,
    message: "Le fournisseur sélectionné n'est pas configuré pour cet email de sécurité.",
    externalId: null,
    retryable: true,
    ambiguous: false,
    statusCode: null,
  };
}

function asGmailDeliveryResult(
  gmail: Awaited<ReturnType<typeof sendGmailEmail>>,
): EmailDeliveryResult {
  return {
    ...gmail,
    provider: "gmail",
    externalId: gmail.externalId ?? null,
    statusCode: gmail.statusCode ?? null,
  };
}

function summarizeResults(results: DeliveryResult[]) {
  return {
    total: results.length,
    sent: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.ok && result.configured).length,
    pendingConfiguration: results.filter((result) => !result.ok && !result.configured).length,
  };
}

function normalizePhoneForProvider(value: string) {
  const normalized = normalizeIvorianPhoneForWhatsApp(value);
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

function missingTarget(provider: DeliveryResult["provider"], message: string) {
  return { ok: false, provider, configured: true, message } satisfies DeliveryResult;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessage(data: any, fallback: string) {
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return fallback;
}

async function getBooleanSetting(key: string, fallback: boolean) {
  const setting = await db.setting.findUnique({ where: { key } });
  if (!setting) return fallback;
  return !["0", "false", "no", "off", "disabled"].includes(setting.value.toLowerCase());
}
