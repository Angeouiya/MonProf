import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

const ACTIVE_IMMINENT_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"] as const;

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

export async function POST() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

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

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const imminentBookings = await db.booking.findMany({
    where: {
      status: { in: [...ACTIVE_IMMINENT_BOOKING_STATUSES] as any },
      scheduledDate: { gte: todayStart, lte: tomorrowEnd },
    },
    include: {
      client: { select: { name: true, phone: true } },
      teacher: true,
      missionLinks: {
        where: { status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED", "CONFIRMED", "REPLACEMENT_RECOMMENDED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      teacherTasks: {
        where: { type: "CONFIRM_AVAILABILITY", status: { in: ["TODO", "SENT_TO_TEACHER", "CONFIRMED", "DONE", "LATE"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    take: 150,
  });

  for (const booking of imminentBookings) {
    const courseStart = parseCourseStartDate(booking.scheduledDate, booking.scheduledTime, booking.preferredTime);
    if (!courseStart || courseStart < now || courseStart > twoHoursFromNow) continue;
    const teacherConfirmed = Boolean(booking.assignedAt)
      || booking.missionLinks.some((mission) => mission.status === "CONFIRMED")
      || booking.teacherTasks.some((task) => ["CONFIRMED", "DONE"].includes(task.status));
    if (teacherConfirmed) continue;

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

    await db.$transaction(async (tx) => {
      const existingCriticalTask = await tx.teacherTask.findFirst({
        where: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: { contains: "Cours imminent sans confirmation" },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      });
      if (!existingCriticalTask) {
        replacementTasks += 1;
        await tx.teacherTask.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            type: "ADMIN_ACTION",
            title: "Cours imminent sans confirmation professeur",
            description: `Le cours ${booking.reference} est prévu ${scheduleLabel}, mais ${teacherName} n'a pas encore confirmé. Appeler le professeur, avertir le client ou ouvrir un remplacement.`,
            priority: "CRITICAL",
            status: "TODO",
            dueAt: now,
            createdById: admin.id,
          },
        });
      }

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
          adminId: admin.id,
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
          message: `Bonjour ${teacherName}, votre cours ${booking.reference} est prévu ${scheduleLabel}. Merci de confirmer immédiatement votre disponibilité auprès de l'administration MonProf CI.`,
          channel: "WHATSAPP",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Cours imminent sans confirmation",
          entityType: "Booking",
          entityId: booking.id,
          detail: `${booking.reference} prévu ${scheduleLabel} sans confirmation professeur. Alerte critique générée pour ${teacherName}.`,
          oldStatus: booking.status,
          newStatus: "COURSE_SOON_TEACHER_UNCONFIRMED",
        },
      });
    });
  }

  const tasksToFirstRelaunch = await db.teacherTask.findMany({
    where: {
      type: "CONFIRM_AVAILABILITY",
      status: "TODO",
      createdAt: { lte: thirtyMinutesAgo, gt: twoHoursAgo },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const task of tasksToFirstRelaunch) {
    if (!task.booking) continue;
    const booking = task.booking;
    const teacherName = task.teacher.professionalName || task.teacher.fullName;
    const existingFirstRelaunch = await db.teacherNotification.findFirst({
      where: {
        teacherId: task.teacherId,
        bookingId: task.bookingId,
        title: { contains: `Première relance tâche ${booking.reference}` },
      },
    });
    if (existingFirstRelaunch) continue;

    relaunched += 1;
    await db.$transaction(async (tx) => {
      await tx.teacherTask.update({
        where: { id: task.id },
        data: { status: "SENT_TO_TEACHER" },
      });
      await tx.teacherNotification.create({
        data: {
          teacherId: task.teacherId,
          bookingId: task.bookingId,
          title: `Première relance tâche ${booking.reference}`,
          message: `Bonjour ${teacherName}, merci de confirmer rapidement votre disponibilité pour la réservation ${booking.reference}. Sans retour, l'administration devra relancer puis envisager un remplacement.`,
          channel: "WHATSAPP",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Relance professeur envoyée",
          message: `Première relance envoyée à ${teacherName} pour ${booking.reference}.`,
          type: "TEACHER_REMINDER",
          recipientType: "TEACHER",
          recipientName: teacherName,
          channel: "WHATSAPP",
          status: "RELAUNCHED",
          priority: "IMPORTANT",
          bookingId: task.bookingId,
          teacherId: task.teacherId,
          adminId: admin.id,
          sentAt: now,
          link: `/admin/professeurs/${task.teacherId}?tab=cours&bookingId=${task.bookingId}`,
          actionLabel: "Ouvrir l'espace professeur",
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Première relance tâche professeur",
          entityType: "TeacherTask",
          entityId: task.id,
          detail: `${admin.name} a relancé ${teacherName} pour confirmer ${booking.reference}.`,
          oldStatus: task.status,
          newStatus: "SENT_TO_TEACHER",
        },
      });
    });
  }

  const tasksToSecondRelaunch = await db.teacherTask.findMany({
    where: {
      type: "CONFIRM_AVAILABILITY",
      status: "SENT_TO_TEACHER",
      createdAt: { lte: oneHourAgo, gt: twoHoursAgo },
      updatedAt: { lte: oneHourAgo },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const task of tasksToSecondRelaunch) {
    if (!task.booking) continue;
    const booking = task.booking;
    const teacherName = task.teacher.professionalName || task.teacher.fullName;
    const existingSecondRelaunch = await db.teacherNotification.findFirst({
      where: {
        teacherId: task.teacherId,
        bookingId: task.bookingId,
        title: { contains: `Deuxième relance tâche ${booking.reference}` },
      },
    });
    if (existingSecondRelaunch) continue;

    secondRelaunched += 1;
    adminAlerts += 1;
    await db.$transaction(async (tx) => {
      await tx.teacherNotification.create({
        data: {
          teacherId: task.teacherId,
          bookingId: task.bookingId,
          title: `Deuxième relance tâche ${booking.reference}`,
          message: `Bonjour ${teacherName}, deuxième relance : votre confirmation est toujours attendue pour ${booking.reference}. Sans retour rapide, l'administration pourra recommander un remplacement.`,
          channel: "WHATSAPP",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Professeur non confirmé après 1h",
          message: `${teacherName} n'a toujours pas confirmé ${booking.reference} après deux relances.`,
          type: "TEACHER_NOT_CONFIRMED",
          recipientType: "ADMIN",
          recipientName: teacherName,
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId: task.bookingId,
          teacherId: task.teacherId,
          adminId: admin.id,
          sentAt: now,
          link: `/admin/professeurs/${task.teacherId}?tab=cours&bookingId=${task.bookingId}`,
          actionLabel: "Contacter / remplacer",
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Deuxième relance tâche professeur",
          entityType: "TeacherTask",
          entityId: task.id,
          detail: `${admin.name} a relancé ${teacherName} une deuxième fois pour ${booking.reference}.`,
          oldStatus: task.status,
          newStatus: task.status,
        },
      });
    });
  }

  const tasksToEscalate = await db.teacherTask.findMany({
    where: {
      type: "CONFIRM_AVAILABILITY",
      status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
      createdAt: { lte: twoHoursAgo },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const task of tasksToEscalate) {
    if (!task.booking) continue;
    const booking = task.booking;
    const teacherName = task.teacher.professionalName || task.teacher.fullName;
    const existingTask = await db.teacherTask.findFirst({
      where: {
        teacherId: task.teacherId,
        bookingId: task.bookingId,
        type: "ADMIN_ACTION",
        title: { contains: "Remplacement recommandé" },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    });
    if (existingTask) {
      if (task.status !== "LATE") {
        await db.teacherTask.update({
          where: { id: task.id },
          data: { status: "LATE" },
        });
      }
      continue;
    }

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
          createdById: admin.id,
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
          adminId: admin.id,
          sentAt: now,
          link: `/admin/reservations/${task.bookingId}?action=replace`,
          actionLabel: "Remplacer",
          actionType: "REPLACE_TEACHER",
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Remplacement recommandé",
          entityType: "TeacherTask",
          entityId: task.id,
          detail: `Réservation ${booking.reference} sans confirmation après 2 heures. Remplacement recommandé pour ${teacherName}.`,
          oldStatus: task.status,
          newStatus: "LATE",
        },
      });
    });
  }

  const missionsToSecondRelaunch = await db.teacherMissionLink.findMany({
    where: {
      status: "RELAUNCHED",
      createdAt: { lte: oneHourAgo, gt: twoHoursAgo },
      expiresAt: { gt: now },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const mission of missionsToSecondRelaunch) {
    const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
    const existingSecondRelaunch = await db.teacherNotification.findFirst({
      where: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: { contains: `Deuxième relance mission ${mission.booking.reference}` },
      },
    });
    if (existingSecondRelaunch) continue;

    secondRelaunched += 1;
    adminAlerts += 1;
    const message = `Bonjour ${teacherName}, deuxième relance : votre confirmation est toujours attendue pour la mission ${mission.booking.reference}. Sans retour rapide, l'administration pourra recommander un remplacement.`;
    await db.teacherNotification.create({
      data: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: `Deuxième relance mission ${mission.booking.reference}`,
        message,
        channel: "WHATSAPP",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    });
    await db.notification.create({
      data: {
        userId: null,
        title: "Professeur non confirmé après 1h",
        message: `${teacherName} n'a toujours pas confirmé ${mission.booking.reference} après deux relances.`,
        type: "TEACHER_NOT_CONFIRMED",
        recipientType: "ADMIN",
        recipientName: teacherName,
        channel: "INTERNAL",
        status: "SENT",
        priority: "URGENT",
        bookingId: mission.bookingId,
        teacherId: mission.teacherId,
        adminId: admin.id,
        sentAt: now,
        link: `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
        actionLabel: "Contacter / remplacer",
      },
    });
    await db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Deuxième relance professeur",
        entityType: "TeacherMissionLink",
        entityId: mission.id,
        detail: `${admin.name} a relancé ${teacherName} une deuxième fois pour ${mission.booking.reference}.`,
        oldStatus: mission.status,
        newStatus: "RELAUNCHED",
      },
    });
  }

  const missionsToRelaunch = await db.teacherMissionLink.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      createdAt: { lte: thirtyMinutesAgo, gt: twoHoursAgo },
      expiresAt: { gt: now },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const mission of missionsToRelaunch) {
    const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
    const existingFirstRelaunch = await db.teacherNotification.findFirst({
      where: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: { contains: `Première relance mission ${mission.booking.reference}` },
      },
    });
    if (existingFirstRelaunch) continue;

    await db.teacherMissionLink.update({
      where: { id: mission.id },
      data: { status: "RELAUNCHED" },
    });
    relaunched += 1;
    await db.teacherNotification.create({
      data: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: `Première relance mission ${mission.booking.reference}`,
        message: `Bonjour ${teacherName}, merci de confirmer rapidement votre disponibilité pour la mission ${mission.booking.reference}.`,
        channel: "WHATSAPP",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    });
    await db.notification.create({
      data: {
        userId: null,
        title: "Relance professeur envoyée",
        message: `Relance envoyée à ${teacherName} pour ${mission.booking.reference}.`,
        type: "TEACHER_REMINDER",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel: "WHATSAPP",
        status: "RELAUNCHED",
        priority: "URGENT",
        bookingId: mission.bookingId,
        teacherId: mission.teacherId,
        adminId: admin.id,
        sentAt: now,
        link: `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
        actionLabel: "Ouvrir l'espace professeur",
      },
    });
  }

  const missionsToEscalate = await db.teacherMissionLink.findMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
      createdAt: { lte: twoHoursAgo },
      expiresAt: { gt: now },
    },
    include: { teacher: true, booking: true },
    take: 100,
  });

  for (const mission of missionsToEscalate) {
    const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
    adminAlerts += 1;
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
          createdById: admin.id,
        },
      });
    }
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
        adminId: admin.id,
        sentAt: now,
        link: `/admin/reservations/${mission.bookingId}?action=replace`,
        actionLabel: "Remplacer",
        actionType: "REPLACE_TEACHER",
      },
    });
    await db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Remplacement recommandé",
        entityType: "TeacherMissionLink",
        entityId: mission.id,
        detail: `Mission ${mission.booking.reference} sans confirmation après 2 heures. Remplacement recommandé pour ${teacherName}.`,
        oldStatus: mission.status,
        newStatus: "REPLACEMENT_RECOMMENDED",
      },
    });
  }

  return NextResponse.json({ ok: true, relaunched, secondRelaunched, adminAlerts, replacementTasks, imminentCourseAlerts });
}
