import { NextRequest, NextResponse } from "next/server";
import { type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { createTeacherWalletTopUp } from "@/lib/marketplace-wallet";
import { MarketplaceError } from "@/lib/marketplace-missions";

export async function GET() {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const teacher = await requireTeacherApi();
  if (!teacher) return NextResponse.json({ error: "Accès professeur requis." }, { status: 401 });
  const [wallet, topUps, entries] = await Promise.all([
    db.teacherWallet.findUnique({ where: { teacherId: teacher.id } }),
    db.teacherWalletTopUp.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, reference: true, amount: true, status: true, paymentMethod: true, createdAt: true, verifiedAt: true, checkoutUrl: true },
    }),
    db.teacherWalletEntry.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, kind: true, balanceDelta: true, reservedDelta: true, createdAt: true, requestId: true },
    }),
  ]);
  return NextResponse.json({
    balance: wallet?.balance ?? 0,
    reserved: wallet?.reserved ?? 0,
    available: wallet?.available ?? 0,
    topUps,
    entries,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const teacher = await requireTeacherApi();
  if (!teacher) return NextResponse.json({ error: "Accès professeur requis." }, { status: 401 });
  try {
    const body = await request.json();
    const method = typeof body.method === "string" ? body.method : "";
    if (!["WAVE", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "DJAMO"].includes(method)) {
      throw new MarketplaceError("Choisissez un moyen Jèko valide.");
    }
    const created = await createTeacherWalletTopUp({
      teacherId: teacher.id,
      amount: Number(body.amount),
      method: method as PaymentMethod,
      clientKey: typeof body.clientKey === "string" ? body.clientKey : "",
    });
    return NextResponse.json({
      topUpId: created.topUp.id,
      status: created.topUp.status,
      checkoutUrl: created.checkoutUrl,
    }, { status: created.checkoutUrl ? 201 : 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recharge impossible." }, { status: error instanceof MarketplaceError ? error.status : 503 });
  }
}
