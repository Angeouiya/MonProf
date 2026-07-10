import { db } from "@/lib/db";
import { normalizeIvorianPhoneForWhatsApp } from "@/lib/phone";

export type DeliveryResult = {
  ok: boolean;
  provider: "resend" | "twilio" | "whatsapp-cloud" | "internal";
  configured: boolean;
  skipped?: boolean;
  message: string;
  externalId?: string | null;
};

export function getNotificationProviderStatus(options: { webPushConfigured?: boolean } = {}) {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    webPush: Boolean(
      options.webPushConfigured
      || (process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY)
    ),
    cron: Boolean(process.env.CRON_SECRET),
  };
}

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      configured: false,
      message: "Resend non configuré : RESEND_API_KEY et RESEND_FROM_EMAIL requis.",
    } satisfies DeliveryResult;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });
  const data = await safeJson(res);
  return {
    ok: res.ok,
    provider: "resend",
    configured: true,
    message: res.ok ? "Email envoyé." : errorMessage(data, "Échec envoi email Resend."),
    externalId: typeof data?.id === "string" ? data.id : null,
  } satisfies DeliveryResult;
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

export async function sendClientResetPasswordEmail(input: { to: string; name: string; resetUrl: string }) {
  return sendEmail({
    to: input.to,
    subject: "Réinitialisation de votre mot de passe Compétence",
    text: [
      `Bonjour ${input.name},`,
      "",
      "Vous avez demandé la réinitialisation de votre mot de passe Compétence.",
      "Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :",
      input.resetUrl,
      "",
      "Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      "",
      "Compétence",
    ].join("\n"),
  });
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
