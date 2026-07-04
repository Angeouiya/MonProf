import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canTeacherUsePortal } from "@/lib/teacher-portal";

export type TeacherSessionUser = {
  id: string;
  teacherId: string;
  name: string;
  phone?: string | null;
  role: "TEACHER";
};

export async function getTeacherSessionUser(): Promise<TeacherSessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "TEACHER") return null;
  const teacherId = (session.user as any).teacherId || (session.user as any).id;
  if (!teacherId) return null;

  return {
    id: teacherId,
    teacherId,
    name: session.user.name ?? "Professeur",
    phone: (session.user as any).phone ?? null,
    role: "TEACHER",
  };
}

export async function requireTeacher() {
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
    },
  });

  if (!teacher || !canTeacherUsePortal(teacher)) {
    redirect("/professeur/connexion?error=access");
  }

  return {
    session: sessionTeacher,
    teacher,
  };
}

export async function requireTeacherApi() {
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
    },
  });

  if (!teacher || !canTeacherUsePortal(teacher)) return null;
  return teacher;
}
