import { getSessionUser } from "@/lib/session";
import { requireTeacherApi } from "@/lib/teacher-auth";

export type WebPushActor =
  | { kind: "CLIENT" | "ADMIN"; userId: string; teacherId: null }
  | { kind: "TEACHER"; userId: null; teacherId: string };

export async function getWebPushActor(): Promise<WebPushActor | null> {
  const session = await getSessionUser();
  if (!session) return null;

  if (session.role === "TEACHER") {
    const teacher = await requireTeacherApi();
    return teacher ? { kind: "TEACHER", userId: null, teacherId: teacher.id } : null;
  }

  if (session.role === "ADMIN") {
    return { kind: "ADMIN", userId: session.id, teacherId: null };
  }

  return { kind: "CLIENT", userId: session.id, teacherId: null };
}
