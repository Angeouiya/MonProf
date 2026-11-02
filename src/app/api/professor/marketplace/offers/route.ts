import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";

export async function GET() {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const teacher = await requireTeacherApi();
  if (!teacher) return NextResponse.json({ error: "Accès professeur requis." }, { status: 401 });
  const offers = await db.marketplaceOffer.findMany({
    where: {
      teacherId: teacher.id,
      status: { in: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"] },
    },
    orderBy: { offeredAt: "desc" },
    take: 30,
    include: {
      request: {
        select: {
          id: true, reference: true, clientId: true, status: true, journey: true,
          subjectName: true, levelName: true, courseFormat: true, commune: true,
          quartier: true, addressHint: true, objective: true,
          scheduledDate: true, scheduledTime: true, durationMinutes: true,
          courseAmount: true, commissionAmount: true, startedAt: true, dueAt: true,
          client: { select: { name: true, phone: true } },
        },
      },
    },
  });
  return NextResponse.json({
    offers: offers.map((offer) => ({
      id: offer.id,
      requestId: offer.requestId,
      status: offer.status,
      expiresAt: offer.expiresAt,
      transportFee: offer.transportFee,
      totalClientPrice: offer.totalClientPrice,
      request: {
        ...offer.request,
        clientId: undefined,
        addressHint: offer.status === "ACCEPTED" ? offer.request.addressHint : null,
        client: offer.status === "ACCEPTED" ? offer.request.client : { name: "Client Compétence", phone: null },
      },
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
