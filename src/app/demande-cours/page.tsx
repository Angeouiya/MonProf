import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedPublicShell } from "@/components/managed/public-shell";
import { ManagedRequestForm } from "@/components/managed/request-form";
export const dynamic = "force-dynamic";
export default async function ManagedCoursePage() {
  if (!managedCoursesEnabled()) notFound();
  const subjects = await db.subject.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 250 });
  return <ManagedPublicShell><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Votre demande de cours</h1><p className="mb-8 mt-3 leading-7 text-slate-600">Sans compte, sans paiement en ligne. Notre équipe organise votre accompagnement.</p><ManagedRequestForm subjects={subjects} /></div></ManagedPublicShell>;
}
