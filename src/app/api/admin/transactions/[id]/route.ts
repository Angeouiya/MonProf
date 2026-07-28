import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi("FINANCE_MANAGE"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx) return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });

  if (action === "pay") {
    return NextResponse.json({
      error: "La validation manuelle d'un versement professeur est désactivée. Utilisez le flux Jèko afin que le ledger ne soit modifié qu'après confirmation du fournisseur.",
      payoutUrl: `/admin/professeurs/${tx.teacherId}?tab=paiements&bookingId=${tx.bookingId}`,
    }, { status: 409 });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
