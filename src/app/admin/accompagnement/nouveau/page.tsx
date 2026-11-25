import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedRequestForm } from "@/components/managed/request-form";
import { managedSchoolSubjectWhere, managedSchoolSubjectOptions } from "@/lib/managed-school-subjects";
export default async function ManagedNewAdminPage() {
  await requireAdmin("BOOKINGS_MANAGE");
  if (!managedCoursesEnabled()) notFound();
  const subjects = managedSchoolSubjectOptions(await db.subject.findMany({
    where: managedSchoolSubjectWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }));
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 text-slate-900 sm:p-7">
      <h1 className="text-3xl font-semibold">Demande reçue par téléphone</h1>
      <ManagedRequestForm subjects={subjects} admin />
    </main>
  );
}
