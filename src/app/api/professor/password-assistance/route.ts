import { NextRequest, NextResponse } from "next/server";
import { normalizeAccountPhone } from "@/lib/account-phone";
import { requestTeacherPasswordAssistance } from "@/lib/teacher-password-assistance";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const GENERIC_RESPONSE = {
  ok: true,
  message: "Si un accès professeur correspond à ce numéro, le service client recevra la demande et vous contactera après vérification.",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 80) : "";

  if (!normalizeAccountPhone(phone)) {
    return NextResponse.json(
      { error: "Numéro de téléphone invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  await requestTeacherPasswordAssistance({
    phone,
    clientIdentifier: getClientIdentifier(req),
  });

  return NextResponse.json(GENERIC_RESPONSE, { headers: NO_STORE_HEADERS });
}

function getClientIdentifier(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = req.headers.get("x-real-ip")?.trim();
  if (forwarded || direct) return (forwarded || direct || "unknown").slice(0, 200);
  return `unknown:${(req.headers.get("user-agent") || "unknown").slice(0, 200)}`;
}
