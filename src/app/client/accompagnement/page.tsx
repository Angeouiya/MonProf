import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { ManagedAction } from "@/components/managed/action";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
import { managedMoney as money, managedSessionDate } from "@/lib/managed-display-format";
import styles from "@/components/managed/workspace.module.css";
export const dynamic = "force-dynamic";
export default async function ManagedClientCourses({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const client = await requireClient();
  const { after } = await searchParams;
  const where = { clientId: client.id };
  const cursor = after
    ? await db.managedCourseDossier.findFirst({
        where: { ...where, id: after },
        select: { id: true, createdAt: true },
      })
    : null;
  const dossiers = await db.managedCourseDossier.findMany({
    where: {
      ...where,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      reference: true,
      subjectName: true,
      className: true,
      totalPrice: true,
      cancelledAmount: true,
      receivedAmount: true,
      onHold: true,
      sessions: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          scheduledDate: true,
          scheduledTime: true,
          status: true,
          parentConfirmedAt: true,
          teacher: { select: { fullName: true, phone: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
  });
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Mon espace</p>
          <h1>Mes cours</h1>
          <p className={styles.muted}>
            Vos dates, vos règlements et le suivi des séances.
          </p>
        </div>
        <Link className={styles.button} href="/demande-cours">
          Demander un cours
        </Link>
      </header>
      {!dossiers.length && (
        <section className={styles.empty}>
          <h2>Aucun nouveau dossier rattaché</h2>
          <p>
            Vos demandes faites depuis ce compte apparaîtront ici. Pour une
            demande transmise par téléphone ou sans connexion, ouvrez le lien
            privé reçu de Compétence et choisissez « Rattacher à mon compte ».
          </p>
          <Link className={styles.button} href="/client/reservations">
            Mes anciens cours
          </Link>
        </section>
      )}
      {dossiers.slice(0, 20).map((d) => (
        <article className={styles.card} key={d.id}>
          <header className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>{d.reference}</p>
              <h2>
                {d.subjectName} · {d.className}
              </h2>
            </div>
            <strong>{money(d.totalPrice - d.cancelledAmount)}</strong>
          </header>
          <p className={styles.muted}>
            Reçu : {money(d.receivedAmount)} · Reste à régler :{" "}
            {money(
              Math.max(0, d.totalPrice - d.cancelledAmount - d.receivedAmount),
            )}
          </p>
          {d.onHold && (
            <p className={styles.notice}>
              Une réclamation est en cours d’examen par Compétence.
            </p>
          )}
          <details
            className={styles.disclosure}
            open={
              d.sessions.some(
                (s) => s.status === "DONE" && !s.parentConfirmedAt,
              ) || undefined
            }
          >
            <summary>Dates et suivi · {d.sessions.length} séance(s)</summary>
            {d.sessions.map((s) => (
              <div className={styles.session} key={s.id}>
                <strong>
                  Séance {s.sequence} ·{" "}
                  {managedSessionDate(s.scheduledDate)}{" "}
                  à {s.scheduledTime} · 2 h
                </strong>
                <p className={styles.muted}>
                  {managedStatusLabel(s.status)}
                  {s.teacher
                    ? ` · ${s.teacher.fullName}`
                    : " · Professeur à confirmer"}
                </p>
                {s.teacher?.phone && (
                  <a className={styles.button} href={`tel:${s.teacher.phone}`}>
                    Appeler le professeur
                  </a>
                )}
                {s.parentConfirmedAt ? (
                  <p className={styles.muted}>
                    Vous avez confirmé cette séance.
                  </p>
                ) : s.status === "DONE" && !d.onHold ? (
                  <ManagedAction
                    endpoint="/api/client/managed-courses"
                    payload={{
                      action: "CONFIRM_SESSION",
                      dossierId: d.id,
                      sessionId: s.id,
                    }}
                    label="Confirmer la séance effectuée"
                    confirmText="Vous confirmez que cette séance a bien eu lieu. Compétence conservera cette confirmation et vérifiera les conditions de règlement. Aucun paiement parent n’est créé par cette action."
                  />
                ) : null}
              </div>
            ))}
          </details>
        </article>
      ))}
      {dossiers.length > 20 && (
        <Link className={styles.button} href={`?after=${dossiers[19].id}`}>
          Dossiers suivants
        </Link>
      )}
      <Link className={`${styles.muted} underline`} href="/client/reservations">
        Consulter les anciens cours
      </Link>
    </div>
  );
}
