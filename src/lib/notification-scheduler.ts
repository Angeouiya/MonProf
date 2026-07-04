import { db } from "@/lib/db";
import { dispatchPendingTeacherNotifications } from "@/lib/notification-delivery";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

const ACTIVE_IMMINENT_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"] as const;

type SchedulerActor = {
  adminId?: string | null;
  adminName?: string | null;
  source: "cron" | "admin";
};

export async function runNotificationScheduler(actor: SchedulerActor) {
  const enabled = await getBooleanSetting("notification_cron_enabled", true);
  if (!enabled && actor.source === "cron") {
    return {
      ok: true,
      disabled: true,
      relaunched: 0,
      secondRelaunched: 0,
      adminAlerts: 0,
      replacementTasks: 0,
      imminentCourseAlerts: 0,
      delivery: { total: 0, sent: 0, skipped: 0, failed: 0, pendingConfiguration: 0 },
    };
  }

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  await db.teacherMissionLink.updateMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  let relaunched = 0;
  let secondRelaunched = 0;
  let adminAlerts = 0;
  let replacementTasks = 0;
  let imminentCourseAlerts = 0;

  const firstTaskResult = await relaunchTeacherTasks({
    status: "TODO",
    createdBefore: thirtyMinutesAgo,
    createdAfter: twoHoursAgo,
    titlePrefix: "Première relance tâche",
    nextTaskStatus: "SENT_TO_TEACHER",
    adminPriority: "IMPORTANT",
    notificationTitle: "Relance professeur envoyée",
    message: "merci de confirmer rapidement votre disponibilité",
    actor,
    now,
  });
  relaunched += firstTaskResult.relaunched;

  const secondTaskResult = await relaunchTeacherTasks({
    status: "SENT_TO_TEACHER",
    createdBefore: oneHourAgo,
    createdAfter: twoHoursAgo,
    titlePrefix: "Deuxième relance tâche",
    nextTaskStatus: null,
    adminPriority: "URGENT",
    notificationTitle: "Professeur non confirmé après 1h",
    message: "deuxième relance : votre confirmation est toujours attendue",
    actor,
    now,
  });
  secondRelaunched += secondTaskResult.relaunched;
  adminAlerts += secondTaskResult.adminAlerts;

  const taskEscalation = await escalateLateTeacherTasks(twoHoursAgo, actor, now);
  adminAlerts += taskEscalation.adminAlerts;
  replacementTasks += taskEscalation.replacementTasks;

  const firstMissionResult = await relaunchMissionLinks({
    status: "PENDING_CONFIRMATION",
    createdBefore: thirtyMinutesAgo,
    createdAfter: twoHoursAgo,
    titlePrefix: "Première relance mission",
    nextMissionStatus: "RELAUNCHED",
    adminPriority: "IMPORTANT",
    actor,
    now,
  });
  relaunched += firstMissionResult.relaunched;

  const secondMissionResult = await relaunchMissionLinks({
    status: "RELAUNCHED",
    createdBefore: oneHourAgo,
    createdAfter: twoHoursAgo,
    titlePrefix: "Deuxième relance mission",
    nextMissionStatus: null,
    adminPriority: "URGENT",
    actor,
    now,
  });
  secondRelaunched += secondMissionResult.relaunched;
  adminAlerts += secondMissionResult.adminAlerts;

  const missionEscalation = await escalateLateMissionLinks(twoHoursAgo, actor, now);
  adminAlerts += missionEscalation.adminAlerts;
  replacementTasks += missionEscalation.replacementTasks;

  const imminent = await createImminentCourseAlerts(actor, now);
  adminAlerts += imminent.adminAlerts;
  replacementTasks += imminent.replacementTasks;
  imminentCourseAlerts += imminent.imminentCourseAlerts;

  const delivery = await dispatchPendingTeacherNotifications(80);

  return {
    ok: true,
    disabled: false,
    relaunched,
    secondRelaunched,
    adminAlerts,
    replacementTasks,
    imminentCourseAlerts,
    delivery,
  };
}

async function relaunchTeacherTasks({
  status,
  createdBefore,
  createdAfter,
  titlePrefix,
  nextTaskStatus,
  adminPriority,
  notificationTitle,
  message,
  actor,
  now,
}: {
  status: "TODO" | "SENT_TO_TEACHER";
  createdBefore: Date;
  createdAfter: Date;
  titlePrefix: string;
  nextTaskStatus: "SENT_TO_TEACHER" | null;
  adminPriority: "IMPORTANT" | "URGENT";
  notificationTitle: string;
  message: string;
  actor: SchedulerActor;
  now: Date;
}) {
  let relaunched = 0;
  let adminAlerts = 0;
  const tasks = await db.teacherTask.findMany({
    where: {
      type: "CONFIRM_AVAILABILITY",
      status,
      createdAt: { lte: createdBefore, gt: createdAfter },
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
    include: {
      teacher: true,
      booking: { include: { transactions: { where: { type: "CLIENT_PAYMENT" } } } },
    },
    take: 100,
  });

  for (const task of tasks) {
    const booking = task.booking;
    if (!booking) continue;
    if (!hasVerifiedPayDunyaClientPayment(booking)) continue;
    const teacherName = task.teacher.professionalName || task.teacher.fullName;
    const existing = await db.teacherNotification.findFirst({
      where: {
        teacherId: task.teacherId,
        bookingId: task.bookingId,
        title: { contains: `${titlePrefix} ${booking.reference}` },
      },
    });
    if (existing) continue;

    relaunched += 1;
    if (adminPriority === "URGENT") adminAlerts += 1;

    await db.$transaction(async (tx) => {
      if (nextTaskStatus) {
        await tx.teacherTask.update({
          where: { id: task.id },
          data: { status: nextTaskStatus },
        });
      }
      await tx.teacherNotification.create({
        data: {
          teacherId: task.teacherId,
          bookingId: task.bookingId,
          title: `${titlePrefix} ${booking.reference}`,
          message: `Bonjour ${teacherName}, ${message} pour la réservation ${booking.reference}. Sans retour, l'administration pourra envisager un remplacement.`,
          channel: "WHATSAPP",
          sent: false,
          status: "PENDING",
          sentById: actor.adminId ?? undefined,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: notificationTitle,
          message: `${teacherName} doit confirmer ${booking.reference}.`,
          type: adminPriority === "URGENT" ? "TEACHER_NOT_CONFIRMED" : "TEACHER_REMINDER",
          recipientType: adminPriority === "URGENT" ? "ADMIN" : "TEACHER",
          recipientName: teacherName,
          channel: "INTERNAL",
          status: adminPriority === "URGENT" ? "SENT" : "RELAUNCHED",
          priority: adminPriority,
          bookingId: task.bookingId,
          teacherId: task.teacherId,
          adminId: actor.adminId ?? undefined,
          sentAt: now,
          link: `/admin/professeurs/${task.teacherId}?tab=cours&bookingId=${task.bookingId}`,
          actionLabel: "Ouvrir l'espace professeur",
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: actor.adminId ?? undefined,
          action: titlePrefix,
          entityType: "TeacherTask",
          entityId: task.id,
          detail: `${actor.adminName ?? "Scheduler"} a relancé ${teacherName} pour ${booking.reference}.`,
          oldStatus: task.status,
          newStatus: nextTaskStatus ?? task.status,
        },
      });
    });
  }

  return { relaunched, adminAlerts };
}

async function escalateLateTeacherTasks(twoHoursAgo: Date, actor: SchedulerActor, now: Date) {
  let adminAlerts = 0;
  let replacementTasks = 0;
  const tasks = await db.teacherTask.findMany({
    where: {
      type: "CONFIRM_AVAILABILITY",
      status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
      createdAt: { lte: twoHoursAgo },
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
    include: {
      teacher: true,
      booking: { include: { transactions: { where: { type: "CLIENT_PAYMENT" } } } },
    },
    take: 100,
  });

  for (const task of tasks) {
    const booking = task.booking;
    if (!booking) continue;
    if (!hasVerifiedPayDunyaClientPayment(booking)) continue;
    const existingTask = await db.teacherTask.findFirst({
      where: {
        teacherId: task.teacherId,
        bookingId: task.bookingId,
        type: "ADMIN_ACTION",
        title: { contains: "Remplacement recommandé" },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    });
    if (existingTask) continue;

    const teacherName = task.teacher.professionalName || task.teacher.fullName;
    adminAlerts += 1;
    replacementTasks += 1;
    await db.$transaction(async (tx) => {
      await tx.teacherTask.update({
        where: { id: task.id },
        data: { status: "LATE" },
      });
      await tx.teacherTask.create({
        data: {
          teacherId: task.teacherId,
          bookingId: task.bookingId,
          type: "ADMIN_ACTION",
          title: "Remplacement recommandé",
          description: `${teacherName} n'a pas confirmé la réservation ${booking.reference} après 2 heures. Contacter le professeur, avertir le client ou remplacer.`,
          priority: "CRITICAL",
          status: "TODO",
          dueAt: now,
          createdById: actor.adminId ?? undefined,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Remplacement recommandé",
          message: `${teacherName} n'a pas confirmé la réservation ${booking.reference} après 2 heures.`,
          type: "REPLACEMENT_RECOMMENDED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: task.bookingId,
          teacherId: task.teacherId,
          adminId: actor.adminId ?? undefined,
          sentAt: now,
          link: `/admin/reservations/${task.bookingId}?action=replace`,
          actionLabel: "Remplacer",
          actionType: "REPLACE_TEACHER",
        },
      });
    });
  }

  return { adminAlerts, replacementTasks };
}

async function relaunchMissionLinks({
  status,
  createdBefore,
  createdAfter,
  titlePrefix,
  nextMissionStatus,
  adminPriority,
  actor,
  now,
}: {
  status: "PENDING_CONFIRMATION" | "RELAUNCHED";
  createdBefore: Date;
  createdAfter: Date;
  titlePrefix: string;
  nextMissionStatus: "RELAUNCHED" | null;
  adminPriority: "IMPORTANT" | "URGENT";
  actor: SchedulerActor;
  now: Date;
}) {
  let relaunched = 0;
  let adminAlerts = 0;
  const missions = await db.teacherMissionLink.findMany({
    where: {
      status,
      createdAt: { lte: createdBefore, gt: createdAfter },
      expiresAt: { gt: now },
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
    include: {
      teacher: true,
      booking: { include: { transactions: { where: { type: "CLIENT_PAYMENT" } } } },
    },
    take: 100,
  });

  for (const mission of missions) {
    if (!hasVerifiedPayDunyaClientPayment(mission.booking)) continue;
    const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
    const existing = await db.teacherNotification.findFirst({
      where: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: { contains: `${titlePrefix} ${mission.booking.reference}` },
      },
    });
    if (existing) continue;

    relaunched += 1;
    if (adminPriority === "URGENT") adminAlerts += 1;
    await db.$transaction(async (tx) => {
      if (nextMissionStatus) {
        await tx.teacherMissionLink.update({
          where: { id: mission.id },
          data: { status: nextMissionStatus },
        });
      }
      await tx.teacherNotification.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          title: `${titlePrefix} ${mission.booking.reference}`,
          message: `Bonjour ${teacherName}, votre confirmation est attendue pour la mission ${mission.booking.reference}. Sans retour rapide, l'administration pourra recommander un remplacement.`,
          channel: "WHATSAPP",
          sent: false,
          status: "PENDING",
          sentById: actor.adminId ?? undefined,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: adminPriority === "URGENT" ? "Professeur non confirmé après 1h" : "Relance professeur envoyée",
          message: `${teacherName} doit confirmer la mission ${mission.booking.reference}.`,
          type: adminPriority === "URGENT" ? "TEACHER_NOT_CONFIRMED" : "TEACHER_REMINDER",
          recipientType: adminPriority === "URGENT" ? "ADMIN" : "TEACHER",
          recipientName: teacherName,
          channel: "INTERNAL",
          status: adminPriority === "URGENT" ? "SENT" : "RELAUNCHED",
          priority: adminPriority,
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          adminId: actor.adminId ?? undefined,
          sentAt: now,
          link: `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
          actionLabel: "Ouvrir l'espace professeur",
        },
      });
    });
  }

  return { relaunched, adminAlerts };
}

async function escalateLateMissionLinks(twoHoursAgo: Date, actor: SchedulerActor, now: Date) {
  let adminAlerts = 0;
  let replacementTasks = 0;
  const missions = await db.teacherMissionLink.findMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
      createdAt: { lte: twoHoursAgo },
      expiresAt: { gt: now },
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
    include: {
      teacher: true,
      booking: { include: { transactions: { where: { type: "CLIENT_PAYMENT" } } } },
    },
    take: 100,
  });

  for (const mission of missions) {
    if (!hasVerifiedPayDunyaClientPayment(mission.booking)) continue;
    const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
    await db.teacherMissionLink.update({
      where: { id: mission.id },
      data: { status: "REPLACEMENT_RECOMMENDED" },
    });
    const existingTask = await db.teacherTask.findFirst({
      where: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        type: "ADMIN_ACTION",
        title: { contains: "Remplacement recommandé" },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    });
    if (!existingTask) {
      replacementTasks += 1;
      await db.teacherTask.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          title: "Remplacement recommandé",
          description: `${teacherName} n'a pas confirmé la mission ${mission.booking.reference} après 2 heures. Contacter le professeur ou remplacer.`,
          priority: "CRITICAL",
          status: "TODO",
          dueAt: now,
          createdById: actor.adminId ?? undefined,
        },
      });
    }
    adminAlerts += 1;
    await db.notification.create({
      data: {
        userId: null,
        title: "Remplacement recommandé",
        message: `${teacherName} n'a pas confirmé la mission ${mission.booking.reference} après 2 heures.`,
        type: "REPLACEMENT_RECOMMENDED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "CRITICAL",
        bookingId: mission.bookingId,
        teacherId: mission.teacherId,
        adminId: actor.adminId ?? undefined,
        sentAt: now,
        link: `/admin/reservations/${mission.bookingId}?action=replace`,
        actionLabel: "Remplacer",
        actionType: "REPLACE_TEACHER",
      },
    });
  }

  return { adminAlerts, replacementTasks };
}

async function createImminentCourseAlerts(actor: SchedulerActor, now: Date) {
  let adminAlerts = 0;
  let replacementTasks = 0;
  let imminentCourseAlerts = 0;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const bookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({
      status: { in: [...ACTIVE_IMMINENT_BOOKING_STATUSES] as any },
      scheduledDate: { gte: todayStart, lte: tomorrowEnd },
    }),
    include: {
      client: { select: { name: true, phone: true } },
      teacher: true,
      transactions: { where: { type: "CLIENT_PAYMENT" } },
      missionLinks: { where: { status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED", "CONFIRMED"] } } },
      teacherTasks: { where: { type: "CONFIRM_AVAILABILITY", status: { in: ["TODO", "SENT_TO_TEACHER", "CONFIRMED", "DONE"] } } },
    },
    take: 150,
  });

  for (const booking of bookings) {
    if (!hasVerifiedPayDunyaClientPayment(booking)) continue;
    const courseStart = parseCourseStartDate(booking.scheduledDate, booking.scheduledTime, booking.preferredTime);
    if (!courseStart || courseStart < now || courseStart > twoHoursFromNow) continue;
    const confirmed = Boolean(booking.assignedAt)
      || booking.missionLinks.some((mission) => mission.status === "CONFIRMED")
      || booking.teacherTasks.some((task) => ["CONFIRMED", "DONE"].includes(task.status));
    if (confirmed) continue;

    const existingAlert = await db.notification.findFirst({
      where: {
        bookingId: booking.id,
        teacherId: booking.teacherId,
        type: "COURSE_SOON_TEACHER_UNCONFIRMED",
        status: { in: ["CREATED", "SENT", "RELAUNCHED"] },
      },
    });
    if (existingAlert) continue;

    const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
    const scheduleLabel = `${courseStart.toLocaleDateString("fr-FR")} à ${booking.scheduledTime || booking.preferredTime}`;
    imminentCourseAlerts += 1;
    adminAlerts += 1;
    replacementTasks += 1;

    await db.$transaction(async (tx) => {
      await tx.teacherTask.create({
        data: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: "Cours imminent sans confirmation professeur",
          description: `Le cours ${booking.reference} est prévu ${scheduleLabel}, mais ${teacherName} n'a pas confirmé. Appeler le professeur, avertir le client ou ouvrir un remplacement.`,
          priority: "CRITICAL",
          status: "TODO",
          dueAt: now,
          createdById: actor.adminId ?? undefined,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Cours dans moins de 2h sans confirmation",
          message: `${booking.reference} avec ${teacherName} est prévu ${scheduleLabel}. Client : ${booking.client.name}. Confirmation professeur absente.`,
          type: "COURSE_SOON_TEACHER_UNCONFIRMED",
          recipientType: "ADMIN",
          recipientName: teacherName,
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          adminId: actor.adminId ?? undefined,
          sentAt: now,
          link: `/admin/reservations/${booking.id}?action=replace`,
          actionLabel: "Confirmer / remplacer",
          actionType: "REPLACE_TEACHER",
        },
      });
      await tx.teacherNotification.create({
        data: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          title: `Urgent - confirmation ${booking.reference}`,
          message: `Bonjour ${teacherName}, votre cours ${booking.reference} est prévu ${scheduleLabel}. Merci de confirmer immédiatement votre disponibilité auprès de l'administration Compétence.`,
          channel: "WHATSAPP",
          sent: false,
          status: "PENDING",
          sentById: actor.adminId ?? undefined,
        },
      });
    });
  }

  return { adminAlerts, replacementTasks, imminentCourseAlerts };
}

function parseCourseStartDate(scheduledDate: Date | null, scheduledTime: string | null, preferredTime: string | null) {
  if (!scheduledDate) return null;
  const source = scheduledTime || preferredTime || "";
  const match = source.match(/(\d{1,2})(?:\s*h|:)?\s*(\d{2})?/i);
  const start = new Date(scheduledDate);
  if (match) {
    start.setHours(Number(match[1]), Number(match[2] ?? 0), 0, 0);
  }
  return start;
}

async function getBooleanSetting(key: string, fallback: boolean) {
  const setting = await db.setting.findUnique({ where: { key } });
  if (!setting) return fallback;
  return !["0", "false", "no", "off", "disabled"].includes(setting.value.toLowerCase());
}
