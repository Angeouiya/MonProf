import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DisputeStatus } from "@prisma/client";
import { hasVerifiedClientFunds, hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const disputes = await db.dispute.findMany({
    where: { openedById: userId },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true, levelName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ items: disputes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId, reason, description } = body;
  if (!bookingId || !reason || !description) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } } },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (booking.status === "DISPUTED") {
    return NextResponse.json({ error: "Un litige est déjà ouvert sur cette réservation" }, { status: 400 });
  }
  if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
    return NextResponse.json({
      error: "Un litige financier ne peut être ouvert qu'après un paiement PayDunya vérifié.",
    }, { status: 409 });
  }

  const dispute = await db.dispute.create({
    data: {
      bookingId,
      openedById: userId,
      reason,
      description: description.trim(),
      status: "OPEN" as DisputeStatus,
    },
  });

  await db.booking.update({
    where: { id: bookingId },
    data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
  });

  await db.notification.create({
    data: {
      userId: null,
      title: "Litige ouvert",
      message: `Litige ouvert sur ${booking.reference}. Raison: ${reason}. Paiement bloqué en attente de résolution.`,
      type: "DISPUTE_OPENED",
      link: "/admin/litiges",
    },
  });

  return NextResponse.json({ dispute }, { status: 201 });
}
