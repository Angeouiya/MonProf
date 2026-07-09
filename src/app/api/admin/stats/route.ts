import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { getTeacherRemainingAmount, isTeacherPayableStatus } from "@/lib/teacher-payments";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return false;
  return true;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const start30d = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidOperationalStatuses = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID", "DISPUTED"] as const;
  const financialStatuses = ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] as const;
  const payableTeacherWhere = {
    OR: [
      { paymentStatus: "TO_PAY_TEACHER" },
      {
        status: { in: ["CANCELLED", "REFUNDED"] },
        paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
        cancellationPenaltyTeacherAmount: { gt: 0 },
      },
    ],
  } satisfies Prisma.BookingWhereInput;
  const paymentProofInclude = {
    transactions: { where: { type: "CLIENT_PAYMENT" as const }, select: { type: true, status: true, amount: true } },
  };

  const [
    totalClients,
    totalTeachers,
    activeTeachers,
    newBookings7d,
    todayBookings,
    paidBookingRows,
    blockedFundRows,
    toReleaseRows,
    allTimeCommissionRows,
    monthCommissionRows,
    openDisputes,
    rawRecentPaidBookings,
    rawPendingReleaseBookings,
    openDisputeList,
    adminNotifications,
  ] = await db.$transaction([
    db.user.count({ where: { role: "CLIENT" } }),
    db.teacher.count(),
    db.teacher.count({ where: { status: "ACTIVE" } }),
    db.booking.count({ where: { createdAt: { gte: start7d } } }),
    db.booking.count({ where: { scheduledDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) } } }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ status: { in: [...paidOperationalStatuses] as any } }),
      include: paymentProofInclude,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: "BLOCKED" }),
      include: paymentProofInclude,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere(payableTeacherWhere),
      include: { teacherPaymentAdjustments: { select: { amount: true, status: true, bookingId: true } }, ...paymentProofInclude },
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: [...financialStatuses] as any } }),
      include: paymentProofInclude,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: [...financialStatuses] as any }, createdAt: { gte: startOfMonth } }),
      include: paymentProofInclude,
    }),
    db.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: [...financialStatuses] as any } }),
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } }, ...paymentProofInclude },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere(payableTeacherWhere),
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } }, teacherPaymentAdjustments: { select: { amount: true, status: true, bookingId: true } }, ...paymentProofInclude },
      orderBy: { clientValidatedAt: "desc" },
      take: 5,
    }),
    db.dispute.findMany({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      include: { booking: { select: { reference: true } }, openedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.notification.findMany({ where: { userId: null, read: false }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const paidBookings = paidBookingRows.filter(hasVerifiedPayDunyaClientPayment).length;
  const blockedFunds = blockedFundRows.filter(hasVerifiedPayDunyaClientPayment).reduce((sum, booking) => sum + booking.totalClientPays, 0);
  const strictToReleaseRows = toReleaseRows.filter((booking) => hasVerifiedPayDunyaClientPayment(booking) && isTeacherPayableStatus(booking));
  const toRelease = strictToReleaseRows.reduce((sum, booking) => sum + getTeacherRemainingAmount(booking, booking.teacherPaymentAdjustments), 0);
  const teachersToPay = new Set(strictToReleaseRows.map((booking) => booking.teacherId)).size;
  const totalCommission = allTimeCommissionRows.filter(hasVerifiedPayDunyaClientPayment).reduce((sum, booking) => sum + booking.commissionAmount, 0);
  const monthCommission = monthCommissionRows.filter(hasVerifiedPayDunyaClientPayment).reduce((sum, booking) => sum + booking.commissionAmount, 0);
  const recentPaidBookings = rawRecentPaidBookings.filter(hasVerifiedPayDunyaClientPayment);
  const pendingReleaseBookings = rawPendingReleaseBookings.filter(hasVerifiedPayDunyaClientPayment);

  // Build daily commission series (last 30 days)
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
  }
  const commissionTx = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ createdAt: { gte: start30d }, paymentStatus: { in: [...financialStatuses] as any } }),
    include: paymentProofInclude,
  });
  for (const t of commissionTx.filter(hasVerifiedPayDunyaClientPayment)) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (dailyMap[key] !== undefined) dailyMap[key] += t.commissionAmount;
  }
  const series = Object.entries(dailyMap).map(([date, value]) => ({ date, value }));

  return NextResponse.json({
    kpis: {
      totalClients,
      totalTeachers,
      activeTeachers,
      newBookings7d,
      paidBookings,
      todayBookings,
      blockedFunds,
      toRelease,
      teachersToPay,
      openDisputes,
      totalCommission,
      monthCommission,
    },
    series,
    recent: {
      paidBookings: recentPaidBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        clientName: b.client.name,
        teacherName: b.teacher.professionalName || b.teacher.fullName,
        totalPrice: b.totalPrice,
        status: b.status,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt,
      })),
      pendingRelease: pendingReleaseBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        clientName: b.client.name,
        teacherName: b.teacher.professionalName || b.teacher.fullName,
        teacherNet: b.teacherNetAmount,
        clientValidatedAt: b.clientValidatedAt,
      })),
      disputes: openDisputeList.map((d) => ({
        id: d.id,
        reason: d.reason,
        bookingRef: d.booking.reference,
        openedBy: d.openedBy.name,
        status: d.status,
        createdAt: d.createdAt,
      })),
      notifications: adminNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.createdAt,
        link: n.link,
      })),
    },
  });
}
