import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(_req: NextRequest) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  return NextResponse.json({
    ok: false,
    code: "ADMIN_TEACHER_PAYOUT_DISABLED",
    error: "Les retraits professeurs sont désormais déclenchés uniquement par le professeur et exécutés automatiquement via Jèko. L'administration conserve le suivi comptable et la vérification des transferts en cours.",
  }, { status: 410 });
}
