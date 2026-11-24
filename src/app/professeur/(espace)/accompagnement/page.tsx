import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";
import {
  managedSplit,
  managedTeacherTerms,
} from "@/lib/managed-courses-core";
import { ManagedAction } from "@/components/managed/action";
import { WebPushControl } from "@/components/shared/web-push-control";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
const money = (amount: number) => `${amount.toLocaleString("fr-FR")} F CFA`;
export default async function ManagedProfessorPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const { teacher } = await requireTeacher();
  const { after } = await searchParams;
  const cursor = after
    ? await db.managedCourseOffer.findFirst({
        where: { id: after, teacherId: teacher.id },
        select: { offeredAt: true, id: true },
      })
    : null;
  const [offers, total, ledger, held] = await Promise.all([
    db.managedCourseOffer.findMany({
      where: {
        teacherId: teacher.id,
        ...(cursor
          ? {
              OR: [
                { offeredAt: { lt: cursor.offeredAt } },
                { offeredAt: cursor.offeredAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
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
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.managedCourseSession.aggregate({
      where: { teacherId: teacher.id, dossier: { onHold: true } },
      _sum: { creditedTeacherAmount: true },
    }),
  ]);
  const page = offers.slice(0, 20);
  const endpoint = "/api/professor/managed-courses";
  return (
    <main className="mx-auto max-w-5xl space-y-7 bg-white p-4 text-slate-900 sm:p-7">
      <header>
        <h1 className="text-3xl font-semibold">Mon accompagnement</h1>
        <p className="mt-2 leading-7 text-slate-600">
          Vos missions confiées par Compétence et votre rémunération. Aucun
          rechargement nécessaire.
        </p>
      </header>
      <div className="rounded-2xl border border-slate-300 p-6">
        <p className="text-sm text-slate-600">Reste à vous payer</p>
        <strong className="mt-2 block text-3xl">
          {money(total._sum.amountDelta ?? 0)}
        </strong>
        <p className="mt-3 text-sm leading-6">
          Séances validées, financées par le règlement du parent, moins les
          paiements déjà enregistrés par Compétence.
        </p>
      </div>
      <WebPushControl audienceLabel="vos missions Compétence" />
      <p className="text-sm leading-6 text-slate-600">Ce solde concerne les nouveaux accompagnements. Vos anciens cours et rémunérations restent conservés dans <Link className="font-semibold underline" href="/professeur/paiements">l'ancienne comptabilité</Link>.</p>
      {page.map((offer) => {
        const accepted = [
          "ACCEPTED",
          "CANCEL_REQUESTED",
          "PARTIAL_CANCELLED",
        ].includes(offer.status);
        return (
          <article
            className="space-y-4 rounded-2xl border border-slate-200 p-5"
            key={offer.id}
          >
            <header>
              <h2 className="text-xl font-semibold">
                {offer.dossier.subjectName} · {offer.dossier.className}
              </h2>
              <p className="mt-1 text-sm">
                {offer.dossier.reference} · {managedStatusLabel(offer.status)} · Votre part{" "}
                {100 - offer.commissionRateBps / 100} % (Compétence{" "}
                {offer.commissionRateBps / 100} %) ·{" "}
                {offer.dossier.courseFormat === "HOME"
                  ? offer.dossier.commune
                  : "En ligne"}
              </p>
            </header>
            {accepted && (
              <p>
                {offer.dossier.parentName} · {offer.dossier.phone}
                <br />
                {offer.dossier.quartier} {offer.dossier.addressHint}
              </p>
            )}
            <p className="text-sm">{offer.dossier.objective}</p>
            <div className="space-y-3">
              {offer.sessions.map((session) => (
                <div className="rounded-xl border p-3" key={session.id}>
                  <p>
                    {session.scheduledDate.toISOString().slice(0, 10)} ·{" "}
                    {session.scheduledTime} · 2 h · {managedStatusLabel(session.status)}
                  </p>
                  <p className="mt-1 text-sm">
                    Votre part prévue :{" "}
                    {money(
                      managedSplit(
                        session.amount,
                        session.commissionRateBps ?? offer.commissionRateBps,
                      ).teacher,
                    )}{" "}
                    · Crédit payable : {money(session.creditedTeacherAmount)}
                  </p>
                  {accepted && session.status === "PLANNED" && (
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
                  )}
                </div>
              ))}
            </div>
            {offer.status === "OFFERED" && (
              <>
                <p className="text-sm leading-7">
                  {managedTeacherTerms(offer.commissionRateBps, offer.termsVersion)}
                </p>
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
                        "J'accepte les séances et les engagements ci-dessus",
                      type: "checkbox",
                    },
                  ]}
                  label="Accepter la mission"
                  confirmText="Vous vous engagez sur les horaires proposés. Aucune somme ne sera prélevée sur un portefeuille de recharge."
                />
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
                />
              </>
            )}
            {offer.status === "ACCEPTED" && (
              <details>
                <summary className="text-sm">Signaler un empêchement</summary>
                <ManagedAction
                  endpoint={endpoint}
                  payload={{ action: "CANCEL", offerId: offer.id }}
                  fields={[
                    { name: "reason", label: "Expliquez votre empêchement" },
                  ]}
                  label="Prévenir Compétence"
                  confirmText="Les séances restent engagées jusqu'au traitement de votre demande par Compétence. Votre message sera transmis à l'équipe pour réattribution."
                />
              </details>
            )}
          </article>
        );
      })}
      {(held._sum.creditedTeacherAmount ?? 0) > 0 && (
        <aside className="rounded-xl border border-amber-400 p-5 text-sm text-amber-950">
          <strong>
            Retenue pour litige :{" "}
            {money(
              Math.min(
                total._sum.amountDelta ?? 0,
                held._sum.creditedTeacherAmount ?? 0,
              ),
            )}
          </strong>
          <p className="mt-2">
            Disponible après retenues :{" "}
            {money(
              Math.max(
                0,
                (total._sum.amountDelta ?? 0) -
                  (held._sum.creditedTeacherAmount ?? 0),
              ),
            )}
          </p>
          <p className="mt-2">
            Compétence vous contactera pour examiner la situation. Aucun
            versement déjà exécuté n'est récupéré automatiquement.
          </p>
        </aside>
      )}
      {!offers.length && (
        <p className="rounded-2xl border p-6">
          Aucune mission proposée pour le moment.
        </p>
      )}
      {offers.length > 20 && (
        <Link
          className="inline-block rounded-xl border p-3"
          href={`/professeur/accompagnement?after=${page.at(-1)!.id}`}
        >
          Missions suivantes
        </Link>
      )}
      <details className="rounded-2xl border p-5">
        <summary className="font-semibold">
          Derniers mouvements comptables
        </summary>
        {ledger.map((entry) => (
          <div className="mt-3 border-t pt-3 text-sm" key={entry.id}>
            <strong>
              {managedStatusLabel(entry.kind)} ·{" "}
              {money(entry.amountDelta)}
            </strong>
            <p>
              {entry.createdAt.toISOString().slice(0, 10)} ·{" "}
              {entry.reference || entry.note}
            </p>
          </div>
        ))}
      </details>
    </main>
  );
}
