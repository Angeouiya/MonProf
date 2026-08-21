import { permanentRedirect } from "next/navigation";
import { teacherPublicProfilePath } from "@/lib/teacher-public-link";

export default async function TeacherShortLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(teacherPublicProfilePath(id));
}
