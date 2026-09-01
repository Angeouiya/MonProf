import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ACTIVE_PAYMENT_METHODS } from "@/lib/payment-methods";
import { requireTeacherApi } from "@/lib/teacher-auth";
import {
  createAndProcessTeacherJekoPayout,
  TeacherJekoPayoutError,
} from "@/lib/teacher-jeko-payouts";
import { normalizeTeacherPayoutRequestIdempotencyKey } from "@/lib/teacher-payout-request-idempotency";
import type { JekoPayoutReconciliationResult } from "@/lib/jeko-payout-reconciliation";

const PAYMENT_METHODS: readonly PaymentMethod[] = ACTIVE_PAYMENT_METHODS;
const MAX_NOTE_LENGTH = 500;
const MAX_POST_BODY_BYTES = 8 * 1024;
const MAX_PASSWORD_LENGTH = 200;

function parseAmount(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") return Math.round(Number(value.replace(/\s/g, "")));
  return 0;
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
}

export async function POST(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_POST_BODY_BYTES) {
    return NextResponse.json({ error: "Corps de requête trop volumineux." }, { status: 413 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = parseAmount(body.amount);
  const method = typeof body.method === "string" && PAYMENT_METHODS.includes(body.method as PaymentMethod)
    ? (body.method as PaymentMethod)
    : null;
  const paymentPhone = normalizePhone(body.paymentPhone);
  const paymentPhoneConfirm = normalizePhone(body.paymentPhoneConfirm);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant demandé invalide." }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json({ error: "Choisissez le moyen de retrait." }, { status: 400 });
  }
  if (paymentPhone.length < 8 || paymentPhone.length > 20) {
    return NextResponse.json({ error: "Numéro de retrait invalide." }, { status: 400 });
  }
  if (paymentPhone !== paymentPhoneConfirm) {
    return NextResponse.json({ error: "Les deux numéros de retrait ne correspondent pas." }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note trop longue (${MAX_NOTE_LENGTH} caractères maximum).` }, { status: 400 });
  }
  if (
    !currentPassword
    || currentPassword.length > MAX_PASSWORD_LENGTH
    || !teacher.portalPasswordHash
    || !await bcrypt.compare(currentPassword, teacher.portalPasswordHash)
  ) {
    console.warn("[jeko:professor_payout_reauthentication_failed]", { teacherId: teacher.id });
    return NextResponse.json({
      error: "Mot de passe actuel incorrect. Le retrait n'a pas été lancé.",
      code: "PAYOUT_REAUTHENTICATION_FAILED",
    }, { status: 403 });
  }

  const idempotencyKey = normalizeTeacherPayoutRequestIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey) {
    return NextResponse.json({
      error: "Clé de sécurité du retrait invalide. Rechargez la page avant de réessayer.",
      code: "PAYOUT_REQUEST_IDEMPOTENCY_KEY_INVALID",
    }, { status: 400 });
  }

  try {
    const payout = await createAndProcessTeacherJekoPayout({
      teacherId: teacher.id,
      amount,
      method,
      paymentPhone,
      idempotencyKey,
      note,
      actor: { type: "TEACHER" },
    });
    return payoutResultResponse(payout);
  } catch (error) {
    if (error instanceof TeacherJekoPayoutError) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: error.code,
        payoutRecordId: error.payoutRecordId ?? null,
      }, { status: error.status });
    }
    throw error;
  }
}

function payoutResultResponse(result: JekoPayoutReconciliationResult) {
  console.info("[jeko:professor_payout_result]", {
    payoutRecordId: result.payoutRecordId ?? null,
    reference: result.reference ?? null,
    action: result.action,
    status: result.status,
    verified: result.verified,
  });
  if (result.action === "paid" || result.action === "already_paid") {
    return NextResponse.json({ ok: true, pending: false, payout: result });
  }
  if (result.action === "pending" || result.action === "duplicate") {
    return NextResponse.json({ ok: true, pending: true, payout: result }, { status: 202 });
  }
  const status = result.action === "not_found" ? 404 : result.action === "rejected" ? 409 : 422;
  return NextResponse.json({
    ok: false,
    pending: false,
    error: result.message,
    payout: result,
  }, { status });
}
