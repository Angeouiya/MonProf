import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { verifyJekoTeacherPayoutRecord } from "@/lib/jeko-payout-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await verifyJekoTeacherPayoutRecord(id);
    if (result.action === "paid" || result.action === "already_paid") {
      return NextResponse.json({ ok: true, pending: false, payout: result });
    }
    if (result.action === "pending" || result.action === "duplicate") {
      return NextResponse.json({ ok: true, pending: true, payout: result }, { status: 202 });
    }
    const status = result.action === "not_found" ? 404 : result.action === "rejected" ? 409 : 422;
    return NextResponse.json({ ok: false, pending: false, error: result.message, payout: result }, { status });
  } catch (error) {
    console.error("[jeko:payout_manual_verification_failed]", {
      payoutRecordId: id,
      adminId: admin.id,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return NextResponse.json({
      error: "Vérification Jèko temporairement indisponible. Aucun débit comptable n'a été appliqué.",
    }, { status: 503 });
  }
}
