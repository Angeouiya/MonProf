import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

  const [
    totalClients,
    totalTeachers,
    activeTeachers,
    newBookings7d,
    paidBookings,
    todayBookings,
    blockedFundsAgg,
    toReleaseAgg,
    teachersToPayAgg,
    openDisputes,
    allTimeCommissionAgg,
    monthCommissionAgg,
    recentPaidBookings,
    pendingReleaseBookings,
    openDisputeList,
    adminNotifications,
  ] = await Promise.all([
    db.user.count({ where: { role: "CLIENT" } }),
    db.teacher.count(),
    db.teacher.count({ where: { status: "ACTIVE" } }),
    db.booking.count({ where: { createdAt: { gte: start7d } } }),
    db.booking.count({ where: { status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID", "DISPUTED"] } } }),
    db.booking.count({ where: { scheduledDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) } } }),
    db.transaction.aggregate({ where: { type: "CLIENT_PAYMENT", status: "BLOCKED" }, _sum: { amount: true } }),
    db.booking.aggregate({ where: { paymentStatus: "TO_PAY_TEACHER" }, _sum: { teacherNetAmount: true } }),
    db.booking.findMany({ where: { paymentStatus: "TO_PAY_TEACHER" }, select: { teacherId: true }, distinct: ["teacherId"] }),
    db.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    db.booking.aggregate({ where: { paymentStatus: { in: ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] } }, _sum: { commissionAmount: true } }),
    db.booking.aggregate({ where: { paymentStatus: { in: ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] }, createdAt: { gte: startOfMonth } }, _sum: { commissionAmount: true } }),
    db.booking.findMany({
      where: { paymentStatus: { in: ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] } },
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.booking.findMany({
      where: { paymentStatus: "TO_PAY_TEACHER" },
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } } },
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

  // Build daily commission series (last 30 days)
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
  }
  const commissionTx = await db.booking.findMany({
    where: { createdAt: { gte: start30d }, paymentStatus: { in: ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] } },
    select: { commissionAmount: true, createdAt: true },
  });
  for (const t of commissionTx) {
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
      blockedFunds: blockedFundsAgg._sum.amount ?? 0,
      toRelease: toReleaseAgg._sum.teacherNetAmount ?? 0,
      teachersToPay: teachersToPayAgg.length,
      openDisputes,
      totalCommission: allTimeCommissionAgg._sum.commissionAmount ?? 0,
      monthCommission: monthCommissionAgg._sum.commissionAmount ?? 0,
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
