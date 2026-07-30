import { after, NextRequest, NextResponse } from "next/server";
import {
  flushPasswordEmailOutbox,
  requestPasswordResetAssistanceByPhone,
  requestPasswordResetEmail,
} from "@/lib/password-email-outbox";
import { normalizeAccountPhone } from "@/lib/account-phone";
import { getPublicAppOrigin } from "@/lib/public-url";

export const maxDuration = 30;

const GENERIC_RESPONSE = {
  ok: true,
  message: "Si un compte Compétence existe avec cet email, un lien de réinitialisation sera envoyé.",
};
const GENERIC_PHONE_RESPONSE = {
  ok: true,
  message: "Si un compte client sans email correspond à ce numéro, le service client recevra la demande d'assistance.",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!email && phone) {
    if (!normalizeAccountPhone(phone)) {
      return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
    }
    await requestPasswordResetAssistanceByPhone({
      phone,
      clientIdentifier: getClientIdentifier(req),
    });
    return NextResponse.json(GENERIC_PHONE_RESPONSE);
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse email ou téléphone invalide." }, { status: 400 });
  }

  const request = await requestPasswordResetEmail({
    email,
    clientIdentifier: getClientIdentifier(req),
    appOrigin: getPublicAppOrigin(req),
  });

  // Le cron durable reprendra un job existant. Ne pas lancer un nouveau flush
  // pour chaque clic répété sur le même lien actif.
  if (request.jobId && !request.reused) {
    after(async () => {
      try {
        await flushPasswordEmailOutbox({ jobIds: [request.jobId!], limit: 1 });
      } catch (error) {
        console.error(
          "[password-reset] Immediate outbox flush failed; the cron will retry.",
          error instanceof Error ? error.message : error,
        );
      }
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}

function getClientIdentifier(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = req.headers.get("x-real-ip")?.trim();
  if (forwarded || direct) return forwarded || direct || "unknown";
  return `unknown:${(req.headers.get("user-agent") || "unknown").slice(0, 200)}`;
}
