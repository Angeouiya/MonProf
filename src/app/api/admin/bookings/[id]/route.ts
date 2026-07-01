import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true, commune: true, quartier: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true, phone: true, email: true, commune: true, quartier: true, addressHint: true } },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { include: { client: { select: { name: true } } } },
      disputes: { include: { openedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  const booking = await db.booking.findUnique({ where: { id }, include: { teacher: true, client: true } });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });

  const now = new Date();

  try {
    switch (action) {
      case "validate": {
        if (booking.status !== "PENDING_ADMIN_VALIDATION" && booking.status !== "PAID") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "CONFIRMED", confirmedAt: now },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Réservation confirmée",
            message: `La réservation ${booking.reference} a été confirmée et est prête à affecter.`,
            type: "BOOKING_CONFIRMED",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "assign": {
        if (booking.status !== "CONFIRMED" && booking.status !== "ASSIGNED") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "ASSIGNED", assignedAt: now },
        });
        // Notifier le professeur (SMS/WhatsApp simulé)
        const channel = body.channel || "SMS";
        const message = body.message || `Bonjour ${booking.teacher.professionalName || booking.teacher.fullName}, vous avez été affecté à la réservation ${booking.reference}. Matière: ${booking.subjectName}, niveau ${booking.levelName}. Contact client: ${booking.client.phone}. Merci de confirmer.`;
        await db.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: `Affectation cours ${booking.reference}`,
            message,
            channel,
            sent: true,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "change_teacher": {
        const newTeacherId = body.newTeacherId;
        if (!newTeacherId) {
          return NextResponse.json({ error: "Nouveau professeur requis" }, { status: 400 });
        }
        const newTeacher = await db.teacher.findUnique({ where: { id: newTeacherId } });
        if (!newTeacher || newTeacher.status !== "ACTIVE") {
          return NextResponse.json({ error: "Professeur introuvable ou inactif" }, { status: 400 });
        }
        const oldTeacherName = booking.teacher.professionalName || booking.teacher.fullName;
        const newTeacherName = newTeacher.professionalName || newTeacher.fullName;
        await db.booking.update({
          where: { id },
          data: {
            teacherId: newTeacherId,
            // Recalcul des montants selon le nouveau prof
            commissionRate: newTeacher.commissionRate,
            commissionAmount: Math.round((booking.totalPrice * newTeacher.commissionRate) / 100),
            teacherNetAmount: booking.totalPrice - Math.round((booking.totalPrice * newTeacher.commissionRate) / 100),
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Professeur changé",
            message: `Le professeur de la réservation ${booking.reference} a été changé de ${oldTeacherName} vers ${newTeacherName}.`,
            type: "TEACHER_CHANGED",
            link: `/admin/reservations/${booking.id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "mark_done": {
        if (booking.status !== "ASSIGNED" && booking.status !== "IN_PROGRESS" && booking.status !== "CONFIRMED") {
          return NextResponse.json({ error: "Action non permise pour ce statut" }, { status: 400 });
        }
        await db.booking.update({
          where: { id },
          data: { status: "PENDING_CLIENT_VALIDATION", courseDoneAt: now },
        });
        // Notification admin
        await db.notification.create({
          data: {
            userId: null,
            title: "Cours effectué — validation client requise",
            message: `Le cours de la réservation ${booking.reference} a été marqué comme effectué. En attente de validation par le client.`,
            type: "COURSE_DONE",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "pay_teacher": {
        if (booking.paymentStatus !== "TO_PAY_TEACHER") {
          return NextResponse.json({ error: "Le paiement n'est pas à libérer" }, { status: 400 });
        }
        await db.booking.update({
          where: { id },
          data: {
            status: "TEACHER_PAID",
            paymentStatus: "TEACHER_PAID",
            teacherPaidAt: now,
          },
        });
        // Créer la transaction TEACHER_PAYOUT
        await db.transaction.create({
          data: {
            reference: generateReference("TX"),
            bookingId: booking.id,
            teacherId: booking.teacherId,
            amount: booking.teacherNetAmount,
            commission: 0,
            teacherNet: booking.teacherNetAmount,
            type: "TEACHER_PAYOUT",
            status: "TEACHER_PAID",
            method: booking.paymentMethod,
            paidAt: now,
          },
        });
        // Marquer les transactions CLIENT_PAYMENT comme TEACHER_PAID
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "TEACHER_PAID", paidAt: now },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Professeur payé",
            message: `Le professeur de la réservation ${booking.reference} a été payé (${booking.teacherNetAmount} FCFA net).`,
            type: "TEACHER_PAID",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "cancel": {
        await db.booking.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "REFUNDED" },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Réservation annulée",
            message: `La réservation ${booking.reference} a été annulée.`,
            type: "BOOKING_CANCELLED",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "refund": {
        await db.booking.update({
          where: { id },
          data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "REFUNDED" },
        });
        await db.transaction.create({
          data: {
            reference: generateReference("TX"),
            bookingId: booking.id,
            teacherId: booking.teacherId,
            amount: booking.totalPrice,
            commission: 0,
            teacherNet: 0,
            type: "REFUND",
            status: "REFUNDED",
            method: booking.paymentMethod,
            paidAt: now,
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Remboursement effectué",
            message: `Le client de la réservation ${booking.reference} a été remboursé (${booking.totalPrice} FCFA).`,
            type: "REFUND",
            link: `/admin/reservations/${id}`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "dispute": {
        const reason = body.reason || "Litige ouvert par l'admin";
        const description = body.description || "";
        await db.booking.update({
          where: { id },
          data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
        });
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "DISPUTED" },
        });
        const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
        await db.dispute.create({
          data: {
            bookingId: booking.id,
            openedById: admin?.id ?? booking.clientId,
            reason,
            description,
            status: "OPEN",
          },
        });
        await db.notification.create({
          data: {
            userId: null,
            title: "Litige ouvert",
            message: `Un litige a été ouvert sur la réservation ${booking.reference}: ${reason}`,
            type: "DISPUTE_OPENED",
            link: `/admin/litiges`,
          },
        });
        return NextResponse.json({ ok: true });
      }
      case "send_teacher_info": {
        const channel = body.channel || "SMS";
        const message = body.message || `Rappel: la réservation ${booking.reference} vous est assignée.`;
        await db.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: `Information — ${booking.reference}`,
            message,
            channel,
            sent: true,
          },
        });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("admin/booking PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
