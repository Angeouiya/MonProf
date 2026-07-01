import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";
import { PackType, PaymentMethod, CourseFormat, GroupType } from "@prisma/client";

function calcUnitPrice(packType: PackType, teacher: {
  pricePerSession: number; pricePack4: number; pricePack8: number;
}): number {
  switch (packType) {
    case "SINGLE": return teacher.pricePerSession;
    case "PACK_4": return teacher.pricePack4;
    case "PACK_8": return teacher.pricePack8;
    case "PACK_12": return Math.round(teacher.pricePerSession * 12 * 0.85);
    case "EXAM_PREP": return Math.round(teacher.pricePerSession * 10);
    default: return teacher.pricePerSession;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(50, Number(searchParams.get("limit")) || 50);

  const where: any = {};
  if (role === "CLIENT") where.clientId = userId;
  if (status) where.status = status;

  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      teacher: {
        select: {
          id: true, fullName: true, professionalName: true, photoUrl: true,
          jobTitle: true, commune: true, phone: true,
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { where: { clientId: userId }, take: 1 },
    },
  });

  return NextResponse.json({
    items: bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      subjectName: b.subjectName,
      levelName: b.levelName,
      objective: b.objective,
      courseFormat: b.courseFormat,
      groupType: b.groupType,
      commune: b.commune,
      quartier: b.quartier,
      onlineLink: b.onlineLink,
      preferredDays: b.preferredDays ? JSON.parse(b.preferredDays) : [],
      preferredTime: b.preferredTime,
      scheduledDate: b.scheduledDate,
      scheduledTime: b.scheduledTime,
      sessionsCount: b.sessionsCount,
      packType: b.packType,
      message: b.message,
      unitPrice: b.unitPrice,
      totalPrice: b.totalPrice,
      commissionRate: b.commissionRate,
      commissionAmount: b.commissionAmount,
      teacherNetAmount: b.teacherNetAmount,
      status: b.status,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt,
      courseDoneAt: b.courseDoneAt,
      clientValidatedAt: b.clientValidatedAt,
      teacherPaidAt: b.teacherPaidAt,
      teacher: b.teacher,
      hasReview: b.reviews.length > 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const {
    teacherId, subjectName, levelName, objective, schoolProgram, needDescription,
    courseFormat, groupType, commune, quartier, addressHint, onlineLink,
    preferredDays, preferredTime, startDate, sessionsCount, packType, message,
    paymentMethod,
  } = body;

  if (!teacherId || !subjectName || !levelName || !courseFormat || !packType || !paymentMethod) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.status !== "ACTIVE") {
    return NextResponse.json({ error: "Professeur introuvable ou inactif" }, { status: 404 });
  }

  const pack = packType as PackType;
  const unitPrice = calcUnitPrice(pack, teacher);
  const totalPrice = pack === "SINGLE" ? unitPrice * Math.max(1, Number(sessionsCount) || 1) : unitPrice;
  const commissionRate = teacher.commissionRate;
  const commissionAmount = Math.round((totalPrice * commissionRate) / 100);
  const teacherNetAmount = totalPrice - commissionAmount;

  const client = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const booking = await db.booking.create({
    data: {
      reference: generateReference("MP"),
      clientId: userId,
      teacherId,
      subjectName,
      levelName,
      objective: objective || null,
      schoolProgram: schoolProgram || null,
      needDescription: needDescription || null,
      courseFormat: courseFormat as CourseFormat,
      groupType: (groupType as GroupType) || "INDIVIDUAL",
      commune: courseFormat === "HOME" ? (commune || null) : null,
      quartier: courseFormat === "HOME" ? (quartier || null) : null,
      addressHint: courseFormat === "HOME" ? (addressHint || null) : null,
      onlineLink: courseFormat === "ONLINE" ? (onlineLink || null) : null,
      preferredDays: JSON.stringify(preferredDays || []),
      preferredTime: preferredTime || "",
      startDate: startDate ? new Date(startDate) : null,
      sessionsCount: pack === "SINGLE" ? Math.max(1, Number(sessionsCount) || 1) : 1,
      packType: pack,
      message: message || null,
      unitPrice,
      totalPrice,
      commissionRate,
      commissionAmount,
      teacherNetAmount,
      status: "PAID",
      paymentStatus: "BLOCKED",
      paymentMethod: paymentMethod as PaymentMethod,
    },
  });

  // Transaction (paiement client bloqué)
  await db.transaction.create({
    data: {
      reference: generateReference("TX"),
      bookingId: booking.id,
      teacherId,
      amount: totalPrice,
      commission: commissionAmount,
      teacherNet: teacherNetAmount,
      type: "CLIENT_PAYMENT",
      status: "BLOCKED",
      method: paymentMethod as PaymentMethod,
    },
  });

  // Notification admin
  const clientName = client?.name ?? "Un client";
  const profName = teacher.professionalName || teacher.fullName;
  const daysStr = (preferredDays || []).join(", ");
  await db.notification.create({
    data: {
      userId: null,
      title: "Nouvelle réservation payée",
      message: `${clientName} a réservé ${profName} pour ${subjectName} ${levelName}${daysStr ? `, ${daysStr}` : ""}. Montant: ${totalPrice.toLocaleString("fr-FR")} FCFA. Statut: fonds bloqués.`,
      type: "NEW_BOOKING",
      link: "/admin/reservations",
    },
  });

  return NextResponse.json({ booking }, { status: 201 });
}
