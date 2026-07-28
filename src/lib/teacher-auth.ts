import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canTeacherUsePortal } from "@/lib/teacher-portal";
import { cache } from "react";
import { getSessionUser } from "@/lib/session";

export type TeacherSessionUser = {
  id: string;
  teacherId: string;
  name: string;
  phone?: string | null;
  portalPasswordMustChange: boolean;
  role: "TEACHER";
};

export const getTeacherSessionUser = cache(async (): Promise<TeacherSessionUser | null> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "TEACHER") return null;
  const teacherId = sessionUser.teacherId || sessionUser.id;
  if (!teacherId) return null;

  return {
    id: teacherId,
    teacherId,
    name: sessionUser.name ?? "Professeur",
    phone: sessionUser.phone ?? null,
    portalPasswordMustChange: Boolean(sessionUser.portalPasswordMustChange),
    role: "TEACHER",
  };
});

export const requireTeacher = cache(async () => {
  const sessionTeacher = await getTeacherSessionUser();
  if (!sessionTeacher) redirect("/professeur/connexion");

  const teacher = await db.teacher.findUnique({
    where: { id: sessionTeacher.teacherId },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      photoUrl: true,
      phone: true,
      defaultPayoutMethod: true,
      defaultPayoutPhone: true,
      payoutInstructions: true,
      status: true,
      portalAccessEnabled: true,
      portalPasswordHash: true,
      portalPasswordMustChange: true,
    },
  });

  if (!teacher || !canTeacherUsePortal(teacher)) {
    redirect("/professeur/connexion?error=access");
  }

  return {
    session: sessionTeacher,
    teacher,
  };
});

export async function requireTeacherApi(options: { allowPasswordChangeRequired?: boolean } = {}) {
  const sessionTeacher = await getTeacherSessionUser();
  if (!sessionTeacher) return null;

  const teacher = await db.teacher.findUnique({
    where: { id: sessionTeacher.teacherId },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      phone: true,
      defaultPayoutMethod: true,
      defaultPayoutPhone: true,
      payoutInstructions: true,
      status: true,
      portalAccessEnabled: true,
      portalPasswordHash: true,
      portalPasswordMustChange: true,
    },
  });

  if (!teacher || !canTeacherUsePortal(teacher)) return null;
  if (teacher.portalPasswordMustChange && !options.allowPasswordChangeRequired) return null;
  return teacher;
}
