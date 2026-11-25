import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedPublicShell } from "@/components/managed/public-shell";
import { ManagedRequestForm } from "@/components/managed/request-form";
import { managedSchoolSubjectNames, managedSchoolSubjectOptions } from "@/lib/managed-school-subjects";
import styles from "@/components/managed/managed-public.module.css";

export const dynamic = "force-dynamic";
export default async function ManagedCoursePage({ searchParams }: { searchParams: Promise<{ systeme?: string }> }) {
  if (!managedCoursesEnabled()) notFound();
  const [params, rows] = await Promise.all([
    searchParams,
    db.subject.findMany({ where: { name: { in: managedSchoolSubjectNames } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const subjects = managedSchoolSubjectOptions(rows);
  return (
    <ManagedPublicShell>
      <div className={styles.requestPage}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>Votre prochain pas</p>
          <h1>Parlons de vos cours.</h1>
        </header>
        <ManagedRequestForm subjects={subjects} initialJourney={params.systeme === "francais" ? "francais" : "ivoirien"} />
      </div>
    </ManagedPublicShell>
  );
}
