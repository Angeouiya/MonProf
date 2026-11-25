import Link from "next/link";
import { CalendarDays, Phone, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";
import {
  managedTeacherNetTerms,
  managedTeacherOfferView,
} from "@/lib/managed-teacher-view";
import { ManagedAction } from "@/components/managed/action";
import { WebPushControl } from "@/components/shared/web-push-control";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
import {
  managedAvailableBalance,
  managedCanDeclareDone,
  managedProfessorOfferWhere,
  managedStartsInFuture,
} from "@/lib/managed-workspace";
import styles from "@/components/managed/workspace.module.css";

const money = (amount: number) => `${amount.toLocaleString("fr-FR")} F CFA`;
const dateLabel = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Abidjan",
  });
export default async function ManagedProfessorPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; vue?: string }>;
}) {
  const { teacher } = await requireTeacher();
  const { after, vue } = await searchParams;
  const history = vue === "historique";
  const where = managedProfessorOfferWhere(teacher.id, history);
  const cursor = after
    ? await db.managedCourseOffer.findFirst({
        where: { ...where, id: after },
        select: { offeredAt: true, id: true },
      })
    : null;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const yesterday = new Date(today.getTime() - 86_400_000);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [offers, total, ledger, held, activity] = await Promise.all([
    db.managedCourseOffer.findMany({
      where: {
        AND: [
          where,
          ...(cursor
            ? [
                {
                  OR: [
                    { offeredAt: { lt: cursor.offeredAt } },
                    { offeredAt: cursor.offeredAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ offeredAt: "desc" }, { id: "desc" }],
      take: 21,
      include: { sessions: { orderBy: { sequence: "asc" } }, dossier: true },
    }),
    db.managedTeacherLedgerEntry.aggregate({
      where: { teacherId: teacher.id },
      _sum: { amountDelta: true },
    }),
    db.managedTeacherLedgerEntry.findMany({
      where: { teacherId: teacher.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    }),
    db.managedCourseSession.aggregate({
      where: { teacherId: teacher.id, dossier: { onHold: true } },
      _sum: { creditedTeacherAmount: true },
    }),
    db.$queryRaw<{ today: number; yesterday: number; total: number }[]>`
      SELECT count(*) FILTER (WHERE "scheduledDate" >= ${today} AND "scheduledDate" < ${tomorrow})::integer AS today,
        count(*) FILTER (WHERE "scheduledDate" >= ${yesterday} AND "scheduledDate" < ${today})::integer AS yesterday,
        count(*)::integer AS total
      FROM "ManagedCourseSession" WHERE "teacherId" = ${teacher.id} AND status IN ('DONE', 'VALIDATED')`,
  ]);
  const balance = total._sum.amountDelta ?? 0;
  const retained = Math.min(
    Math.max(0, balance),
    held._sum.creditedTeacherAmount ?? 0,
  );
  const page = offers.slice(0, 20).map(managedTeacherOfferView);
  const endpoint = "/api/professor/managed-courses";
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Espace professeur</p>
          <h1>Bonjour {teacher.fullName.split(" ")[0]}</h1>
          <p className={`${styles.muted} mt-2`}>
            Vos missions, votre planning et votre rémunération.
          </p>
        </div>
        <Link className={styles.button} href="/professeur/disponibilites">
          <CalendarDays size={17} /> Mon planning
        </Link>
      </header>
      <section
        className={styles.activityStats}
        aria-label="Vos séances déclarées effectuées ou validées"
      >
        {[
          ["Aujourd’hui", activity[0]?.today ?? 0],
          ["Hier", activity[0]?.yesterday ?? 0],
          ["Au total", activity[0]?.total ?? 0],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className={styles.stats} aria-label="Votre rémunération">
        <div className={styles.stat}>
          <p>Disponible après retenues</p>
          <strong>{money(managedAvailableBalance(balance, retained))}</strong>
        </div>
        <div className={styles.stat}>
          <p>Reste total à vous payer</p>
          <strong>{money(balance)}</strong>
        </div>
      </section>
      {retained > 0 && (
        <aside className={styles.notice}>
          Litige en cours : {money(retained)} retenus. Compétence vous
          contactera pour examiner la situation.
        </aside>
      )}
      <details className={styles.disclosure}>
        <summary>Comprendre mon solde</summary>
        <p className={styles.muted}>
          Votre rémunération devient acquise après validation de la séance et
          réception du paiement parent. Les versements enregistrés par
          Compétence diminuent ce solde. Aucun rechargement ni retrait à
          demander ici.
        </p>
        <Link
          className={`${styles.muted} underline`}
          href="/professeur/paiements"
        >
          Consulter l’ancienne comptabilité
        </Link>
      </details>
      <WebPushControl audienceLabel="vos missions Compétence" />
      <nav className={styles.tabs} aria-label="Filtrer mes missions">
        <Link
          aria-current={!history ? "page" : undefined}
          href="/professeur/accompagnement"
        >
          En cours
        </Link>
        <Link
          aria-current={history ? "page" : undefined}
          href="/professeur/accompagnement?vue=historique"
        >
          Historique
        </Link>
      </nav>
      {page.map((offer) => {
        const offeredSessions = offer.sessions.filter(
          (session) => session.status === "PLANNED",
        );
        const canAccept =
          offeredSessions.length > 0 &&
          offeredSessions.every((session) => managedStartsInFuture(session));
        const accepted = [
          "ACCEPTED",
          "CANCEL_REQUESTED",
          "PARTIAL_CANCELLED",
        ].includes(offer.status);
        const next = offer.sessions.find(
          (session) =>
            session.status === "PLANNED" || session.status === "DONE",
        );
        const expected = offer.remuneration;
        return (
          <article className={styles.card} key={offer.id}>
            <header className={styles.cardHeader}>
              <div>
                <p className={styles.eyebrow}>{offer.dossier.reference}</p>
                <h2>
                  {offer.dossier.subjectName} · {offer.dossier.className}
                </h2>
                <p className={styles.muted}>
                  {offer.dossier.courseFormat === "HOME"
                    ? `${offer.dossier.commune} · ${offer.dossier.quartier}`
                    : "Cours en ligne"}
                </p>
              </div>
              <span
                className={styles.badge}
                data-tone={offer.status === "OFFERED" ? "attention" : undefined}
              >
                {managedStatusLabel(offer.status)}
              </span>
            </header>
            <div className={styles.cardHeader}>
              <p className={styles.muted}>
                {offer.sessions.filter((s) => s.status !== "CANCELLED").length}{" "}
                séance
                {offer.sessions.filter((s) => s.status !== "CANCELLED")
                  .length !== 1
                  ? "s"
                  : ""}{" "}
                · 2 h
                <br />
                {next
                  ? `Prochaine : ${dateLabel(next.scheduledDate)} à ${next.scheduledTime}`
                  : "Toutes les séances sont traitées"}
              </p>
              <div className={styles.amount}>
                <strong>{money(expected)}</strong>
                <p className={styles.muted}>Votre rémunération</p>
              </div>
            </div>
            {offer.dossier.onHold && (
              <p className={styles.notice}>
                Dossier en litige. La déclaration et la validation des séances
                sont suspendues.
              </p>
            )}
            {accepted && (
              <div className={styles.contact}>
                <div>
                  <strong className="text-sm">
                    {offer.dossier.parentName}
                  </strong>
                  <p className={styles.muted}>{offer.dossier.addressHint}</p>
                </div>
                <a
                  className={styles.button}
                  href={`tel:${offer.dossier.phone}`}
                >
                  <Phone size={16} /> Appeler le parent
                </a>
              </div>
            )}
            {offer.dossier.objective && (
              <details className={styles.disclosure}>
                <summary>Besoin du parent</summary>
                <p className={styles.muted}>{offer.dossier.objective}</p>
              </details>
            )}
            <details className={styles.disclosure}>
              <summary>
                Dates et suivi · {offer.sessions.length} séance
                {offer.sessions.length !== 1 ? "s" : ""}
              </summary>
              {offer.sessions.map((session) => (
                <div className={styles.session} key={session.id}>
                  <div className={styles.cardHeader}>
                    <strong className="text-sm">
                      {session.sequence}. {dateLabel(session.scheduledDate)} ·{" "}
                      {session.scheduledTime} · 2 h
                    </strong>
                    <span className={styles.badge}>
                      {managedStatusLabel(session.status)}
                    </span>
                  </div>
                  <p className={styles.muted}>
                    Rémunération : {money(session.remuneration)} · Rémunération
                    acquise : {money(session.creditedTeacherAmount)}
                  </p>
                  {accepted &&
                  managedCanDeclareDone(session, offer.dossier.onHold) ? (
                    <ManagedAction
                      endpoint={endpoint}
                      payload={{
                        action: "DONE",
                        dossierId: offer.dossierId,
                        sessionId: session.id,
                      }}
                      label="Déclarer la séance effectuée"
                      confirmText="Confirmez que cette séance de deux heures a réellement été effectuée. Compétence vérifiera la séance ; aucun crédit n'est acquis sur cette seule déclaration."
                    />
                  ) : accepted &&
                    session.status === "PLANNED" &&
                    !offer.dossier.onHold ? (
                    <p className={styles.muted}>
                      Déclaration disponible après la fin des deux heures. Si
                      l’heure vient de passer, actualisez cette page.
                    </p>
                  ) : null}
                  {session.status === "DONE" && (
                    <p className={styles.muted}>
                      En attente de vérification par Compétence.
                    </p>
                  )}
                </div>
              ))}
            </details>
            {offer.status === "OFFERED" && !offer.dossier.onHold && (
              <div className={styles.actions}>
                <details className={styles.disclosure}>
                  <summary>Engagements de la mission</summary>
                  <p className={styles.muted}>
                    {managedTeacherNetTerms(expected)}
                  </p>
                </details>
                {canAccept ? (
                  <ManagedAction
                    endpoint={endpoint}
                    payload={{
                      action: "RESPOND",
                      offerId: offer.id,
                      accept: true,
                    }}
                    fields={[
                      {
                        name: "acceptedTerms",
                        label:
                          "J’ai lu et j’accepte les horaires et les engagements de cette mission",
                        type: "checkbox",
                      },
                    ]}
                    label="Accepter la mission"
                    confirmText="Vous vous engagez sur les horaires proposés. Votre rémunération sera acquise après validation des séances et règlement du parent."
                  />
                ) : (
                  <p className={styles.notice}>
                    Un horaire de cette proposition est déjà passé. Contactez
                    Compétence pour recevoir un planning actualisé ; cette
                    proposition ne peut plus être acceptée.
                  </p>
                )}
                <details className={styles.disclosure}>
                  <summary>Je ne suis pas disponible</summary>
                  <ManagedAction
                    endpoint={endpoint}
                    payload={{
                      action: "RESPOND",
                      offerId: offer.id,
                      accept: false,
                      acceptedTerms: false,
                    }}
                    fields={[{ name: "reason", label: "Motif du refus" }]}
                    label="Refuser la proposition"
                    confirmText="Cette proposition sera refusée et Compétence pourra la confier à un autre professeur."
                  />
                </details>
              </div>
            )}
            {offer.status === "ACCEPTED" && (
              <details className={styles.disclosure}>
                <summary>Signaler un empêchement</summary>
                <ManagedAction
                  endpoint={endpoint}
                  payload={{ action: "CANCEL", offerId: offer.id }}
                  fields={[
                    {
                      name: "reason",
                      label: "Expliquez votre empêchement",
                      minLength: 10,
                    },
                  ]}
                  label="Prévenir Compétence"
                  confirmText="Les séances restent engagées jusqu'au traitement de votre demande par Compétence. Votre message sera transmis à l'équipe pour réattribution."
                />
              </details>
            )}
          </article>
        );
      })}
      {!page.length && (
        <div className={styles.empty}>
          <p className="font-semibold text-[#102b4c]">
            {history
              ? "Aucune mission dans l’historique"
              : "Aucune mission en cours"}
          </p>
          <p>
            {history
              ? "Vos missions traitées apparaîtront ici."
              : "Les nouvelles propositions de Compétence apparaîtront ici."}
          </p>
        </div>
      )}
      {offers.length > 20 && (
        <Link
          className={styles.button}
          href={`/professeur/accompagnement?vue=${history ? "historique" : "en-cours"}&after=${page.at(-1)!.id}`}
        >
          Missions suivantes <ArrowUpRight size={16} />
        </Link>
      )}
      <details className={styles.disclosure}>
        <summary>Derniers mouvements comptables</summary>
        {ledger.length ? (
          ledger.map((entry) => (
            <div className={styles.session} key={entry.id}>
              <div className={styles.cardHeader}>
                <strong className="text-sm">
                  {managedStatusLabel(entry.kind)}
                </strong>
                <strong className="text-sm">{money(entry.amountDelta)}</strong>
              </div>
              <p className={styles.muted}>
                {dateLabel(entry.createdAt)} · Réf.{" "}
                {entry.id.slice(-8).toUpperCase()}
              </p>
            </div>
          ))
        ) : (
          <p className={styles.muted}>Aucun mouvement enregistré.</p>
        )}
      </details>
    </div>
  );
}
