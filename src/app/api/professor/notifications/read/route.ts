import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";

export async function PATCH() {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  await db.teacherNotification.updateMany({
    where: {
      teacherId: teacher.id,
      status: { in: ["DRAFT", "PENDING", "SENT", "FAILED"] },
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
