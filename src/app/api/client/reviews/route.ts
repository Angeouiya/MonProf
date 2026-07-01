import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId, rating, comment } = body;

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Note invalide (1 à 5)" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (booking.status !== "TEACHER_PAID") {
    return NextResponse.json({ error: "Avis possible seulement après paiement du professeur" }, { status: 400 });
  }

  const existing = await db.review.findFirst({ where: { bookingId, clientId: userId } });
  if (existing) {
    return NextResponse.json({ error: "Vous avez déjà laissé un avis pour ce cours" }, { status: 400 });
  }

  const review = await db.review.create({
    data: {
      clientId: userId,
      teacherId: booking.teacherId,
      bookingId,
      rating: Math.round(rating),
      comment: comment?.trim() || null,
      published: true,
    },
  });

  // Recalculer la note moyenne du professeur
  const agg = await db.review.aggregate({
    where: { teacherId: booking.teacherId, published: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await db.teacher.update({
    where: { id: booking.teacherId },
    data: {
      rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      ratingCount: agg._count.rating,
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}
