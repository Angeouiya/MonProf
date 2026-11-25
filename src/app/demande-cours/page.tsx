import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedPublicShell } from "@/components/managed/public-shell";
import { ManagedRequestForm } from "@/components/managed/request-form";
import { managedSchoolSubjectNames, managedSchoolSubjectOptions } from "@/lib/managed-school-subjects";
export const dynamic = "force-dynamic";
export default async function ManagedCoursePage() {
  if (!managedCoursesEnabled()) notFound();
  const subjects = managedSchoolSubjectOptions(await db.subject.findMany({ where: { name: { in: managedSchoolSubjectNames } }, select: { id: true, name: true }, orderBy: { name: "asc" } }));
  return <ManagedPublicShell><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Votre demande de cours</h1><p className="mb-8 mt-3 leading-7 text-slate-600">Sans compte, sans paiement en ligne. Notre équipe organise votre accompagnement.</p><ManagedRequestForm subjects={subjects} /></div></ManagedPublicShell>;
}
