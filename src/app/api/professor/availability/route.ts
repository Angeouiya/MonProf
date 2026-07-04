import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import { requireTeacherApi } from "@/lib/teacher-auth";

function countSlots(availability: Record<string, Record<string, boolean>>) {
  return WEEK_DAYS.reduce((total, day) => (
    total + TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length
  ), 0);
}

export async function PATCH(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const availability = normalizeAvailability(body.availability);
  const selectedSlots = countSlots(availability);
  if (selectedSlots === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins un créneau de disponibilité." }, { status: 400 });
  }

  const teacherName = teacher.professionalName || teacher.fullName;
  await db.$transaction([
    db.teacher.update({
      where: { id: teacher.id },
      data: {
        availability: JSON.stringify(availability),
        lastActivityAt: new Date(),
      },
    }),
    db.notification.create({
      data: {
        userId: null,
        title: "Disponibilités professeur mises à jour",
        message: `${teacherName} a mis à jour ses disponibilités depuis la plateforme professeur (${selectedSlots} créneau(x) de 2h).`,
        type: "TEACHER_AVAILABILITY_UPDATED",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CREATED",
        priority: "IMPORTANT",
        teacherId: teacher.id,
        link: `/admin/professeurs/${teacher.id}/modifier`,
        actionLabel: "Vérifier la fiche",
      },
    }),
    db.teacherNotification.create({
      data: {
        teacherId: teacher.id,
        title: "Disponibilités enregistrées",
        message: `Vos disponibilités ont été mises à jour (${selectedSlots} créneau(x) de 2h). L'administration peut les vérifier si nécessaire.`,
        channel: "INTERNAL",
        sent: true,
        status: "CONFIRMED",
      },
    }),
    db.adminActionLog.create({
      data: {
        action: "Disponibilités professeur mises à jour",
        entityType: "Teacher",
        entityId: teacher.id,
        detail: `${teacherName} a mis à jour ses disponibilités depuis son espace professeur.`,
        newStatus: `${selectedSlots} créneau(x)`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, selectedSlots });
}
