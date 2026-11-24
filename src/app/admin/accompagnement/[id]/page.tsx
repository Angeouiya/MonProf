import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";
import {
  managedInstallments,
} from "@/lib/managed-courses-core";
import { ManagedAction } from "@/components/managed/action";
import { ManagedAdminOperations } from "@/components/managed/admin-operations";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
const money = (value: number) => `${value.toLocaleString("fr-FR")} F CFA`;
const methods = [
  { value: "CASH", label: "Espèces" },
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MOMO", label: "MTN MoMo" },
  { value: "BANK", label: "Banque" },
  { value: "OTHER", label: "Autre" },
];
export default async function ManagedAdminDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prof?: string }>;
}) {
  const admin = await requireAdmin("BOOKINGS_VIEW");
  const { id } = await params;
  const { prof = "" } = await searchParams;
  const dossier = await db.managedCourseDossier.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { sequence: "asc" } },
      offers: {
        orderBy: { offeredAt: "desc" },
        take: 50,
        include: { teacher: { select: { fullName: true } } },
      },
      receipts: { orderBy: { createdAt: "desc" }, take: 50 },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!dossier) notFound();
  const canManage = hasAdminPermission(
    admin.adminPermissions,
    "BOOKINGS_MANAGE",
  );
  const canFinance = hasAdminPermission(
    admin.adminPermissions,
    "FINANCE_MANAGE",
  );
  const classNames = dossier.className === "Seconde" ? ["2nde", "Seconde"] : dossier.className === "Première" ? ["1ère", "Première"] : [dossier.className];
  const exactJunior = ["6e", "5e", "4e", "3e"].includes(dossier.className);
  const teachers = canManage
    ? await db.teacher.findMany({
        where: {
          status: "ACTIVE",
          portalAccessEnabled: true,
          portalPasswordMustChange: false,
          portalPasswordHash: { not: null },
          ...(dossier.journey === "ivoirien" ? { offersIvorianSystem: true } : { offersFrenchSystem: true }),
          ...(dossier.courseFormat === "HOME" ? { offersHome: true } : { offersOnline: true }),
          preciseLevels: {
            some: { journey: dossier.journey, subjectId: dossier.subjectId, OR: classNames.flatMap((className) => exactJunior ? [{ className }] : [{ className }, { className: { startsWith: `${className} ` } }]) },
          },
          ...(prof.trim().length > 1
            ? {
                fullName: {
                  contains: prof.trim().slice(0, 80),
                  mode: "insensitive",
                },
              }
            : {}),
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
        take: 30,
      })
    : [];
  const teacherIds = [
    ...new Set(dossier.offers.map((offer) => offer.teacherId)),
  ];
  const totals = canFinance
    ? await db.managedTeacherLedgerEntry.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds } },
        _sum: { amountDelta: true },
      })
    : [];
  const held = canFinance ? await db.managedCourseSession.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, dossier: { onHold: true } }, _sum: { creditedTeacherAmount: true } }) : [];
  const endpoint = `/api/admin/managed-courses/${id}`;
  const schedule = managedInstallments(
    dossier.sessions
      .filter((session) => session.status !== "CANCELLED")
      .map((session) => ({
        date: session.scheduledDate.toISOString().slice(0, 10),
        amount: session.amount,
      })),
    dossier.cadence,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-7 bg-white p-4 text-slate-900 sm:p-7">
      <Link className="underline" href="/admin/accompagnement">
        Tous les dossiers
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">{dossier.reference}</h1>
        <p className="mt-2">
          {dossier.parentName} · {dossier.phone}
        </p>
        <p>
          {dossier.className} · {dossier.subjectName} ·{" "}
          {dossier.courseFormat === "HOME" ? "À domicile" : "En ligne"} ·{" "}
          {dossier.commune} {dossier.quartier}
        </p>
        <p className="mt-2 text-sm">
          {dossier.addressHint} {dossier.objective}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cours maintenus", dossier.totalPrice - dossier.cancelledAmount],
          ["Encaissement net du parent", dossier.receivedAmount],
          [
            "Reste à encaisser",
            Math.max(
              0,
              dossier.totalPrice -
                dossier.cancelledAmount -
                dossier.receivedAmount,
            ),
          ],
          ["Montant annulé", dossier.cancelledAmount],
        ].map(([label, amount]) => (
          <div className="rounded-2xl border border-slate-300 p-5" key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <strong className="mt-2 block text-2xl">
              {money(Number(amount))}
            </strong>
          </div>
        ))}
      </div>
      <ManagedAdminOperations
        dossier={dossier}
        teacherIds={teacherIds}
        canManage={canManage}
        canFinance={canFinance}
      />
      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">
          Accord parent · version {dossier.revision}
        </h2>
        <p className="my-3">
          {dossier.acceptedRevision === dossier.revision
            ? `Accepté le ${dossier.acceptedAt?.toISOString().slice(0, 10)}`
            : "Accord à recueillir — attribution et encaissement bloqués."}
        </p>
        <p className="mb-3 text-sm text-slate-600">
          L'identité n'est pas certifiée par ce parcours. Vérifiez le contact
          avant de commencer.
        </p>
        {schedule.map((item) => (
          <p key={item.dueDate}>
            Échéance {item.dueDate} : {money(item.amount)}
          </p>
        ))}
        {canManage && (
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "CONTRACT_LINK" }}
            label="Créer un lien privé pour le parent"
          />
        )}
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Séances de deux heures</h2>
        <div className="space-y-3">
          {dossier.sessions.map((session) => (
            <div className="rounded-xl border p-4" key={session.id}>
              <p className="font-semibold">
                {session.sequence}.{" "}
                {session.scheduledDate.toISOString().slice(0, 10)} ·{" "}
                {session.scheduledTime} · {managedStatusLabel(session.status)}
              </p>
              <p className="mt-2 text-sm">
                Cours {money(session.amount)} · Financé{" "}
                {money(session.fundedAmount)} · Crédit professeur{" "}
                {money(session.creditedTeacherAmount)}
              </p>
              {canManage && session.status === "DONE" && (
                <ManagedAction
                  endpoint={endpoint}
                  payload={{ action: "VALIDATE", sessionId: session.id }}
                  label="Valider la séance après vérification"
                  confirmText="Confirmez que cette séance a bien eu lieu. La part professeur financée par un encaissement déjà enregistré deviendra payable ; le reste attendra le règlement du parent."
                />
              )}
            </div>
          ))}
        </div>
      </section>
      {canManage && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Attribuer les séances non affectées
          </h2>
          <form className="flex gap-2">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
              name="prof"
              defaultValue={prof}
              placeholder="Rechercher un professeur par nom"
            />
            <button className="rounded-lg border px-4">Rechercher</button>
          </form>
          <p className="text-sm text-slate-600">
            30 résultats maximum. Le système, la classe, la matière et le
            planning seront vérifiés à l'attribution et à l'acceptation.
          </p>
          {!teachers.length && <p className="rounded-xl border border-amber-300 p-4 text-sm leading-6 text-amber-950">Aucun profil habilité dans ces résultats. Les anciens profils sont conservés mais leurs classes et matières exactes doivent être validées : <Link className="font-semibold underline" href="/admin/professeurs">vérifier les habilitations des professeurs</Link>. Une recherche par nom ne contourne pas ces restrictions.</p>}
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "OFFER" }}
            label="Proposer la mission"
            fields={[
              {
                name: "teacherId",
                label: "Professeur",
                options: teachers.map((teacher) => ({
                  value: teacher.id,
                  label: teacher.fullName,
                })),
              },
              {
                name: "commissionPercent",
                label: "Commission Compétence (%) · de 20 à 30",
                type: "number",
                value: "20",
                min: 20,
                max: 30,
              },
            ]}
          />
        </section>
      )}
      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Propositions et réattribution
        </h2>
        {dossier.offers.map((offer) => (
          <div className="mb-3 rounded-xl border p-4" key={offer.id}>
            <p>
              {offer.teacher.fullName} · {managedStatusLabel(offer.status)} · Compétence{" "}
              {offer.commissionRateBps / 100} % · professeur{" "}
              {100 - offer.commissionRateBps / 100} %
            </p>
            {offer.reason && <p className="mt-2 text-sm">{offer.reason}</p>}
            {canManage &&
              ["OFFERED", "ACCEPTED", "CANCEL_REQUESTED"].includes(
                offer.status,
              ) && (
                <ManagedAction
                  endpoint={endpoint}
                  payload={{ action: "RELEASE", offerId: offer.id }}
                  label="Libérer les séances à venir pour réattribution"
                  fields={[{ name: "reason", label: "Motif détaillé" }]}
                  confirmText="Les séances non effectuées seront retirées de cette attribution. Les séances déclarées effectuées ou validées et leurs écritures seront conservées. Aucun paiement n'est automatiquement remboursé."
                />
              )}
          </div>
        ))}
      </section>
      {canFinance && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Enregistrer un règlement réellement reçu du parent
          </h2>
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "RECEIPT" }}
            label="Confirmer l'encaissement"
            confirmText="Vous certifiez avoir reçu et vérifié cette somme. Ce bouton ne débite pas le parent et n'appelle aucun moyen de paiement. Il peut créditer la rémunération de séances déjà validées."
            fields={[
              { name: "amount", label: "Montant reçu (FCFA)", type: "number" },
              { name: "method", label: "Moyen", options: methods },
              {
                name: "reference",
                label: "Référence unique du reçu ou de la transaction",
              },
              {
                name: "receivedAt",
                label: "Date et heure de réception",
                type: "datetime-local",
              },
            ]}
          />
          <details className="mt-4">
            <summary>Derniers encaissements</summary>
            {dossier.receipts.map((receipt) => (
              <p className="mt-2 text-sm" key={receipt.id}>
                {receipt.receivedAt.toISOString()} · {money(receipt.amount)} ·{" "}
                {receipt.method} · {receipt.reference}
              </p>
            ))}
          </details>
        </section>
      )}
      {canFinance && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Règlements manuels professeurs
          </h2>
          <p className="mb-4 text-sm">
            Seuls les crédits issus de séances validées et financées sont
            payables. Les soldes ci-dessous couvrent tous les dossiers du
            professeur dans ce nouveau service.
          </p>
          {teacherIds.map((teacherId) => {
            const teacherName = dossier.offers.find(
              (offer) => offer.teacherId === teacherId,
            )?.teacher.fullName;
            return (
              <div className="mb-4" key={teacherId}>
                <h3 className="mb-2 font-semibold">
                  {teacherName} · Disponible après retenues{" "}
                  {money(
                    Math.max(0, (totals.find((total) => total.teacherId === teacherId)?._sum.amountDelta ?? 0) - (held.find((item) => item.teacherId === teacherId)?._sum.creditedTeacherAmount ?? 0)),
                  )}
                </h3>
                <ManagedAction
                  endpoint="/api/admin/managed-teacher-payments"
                  payload={{ teacherId }}
                  label="Enregistrer le paiement effectué"
                  confirmText="Ce bouton ne transfère pas d'argent. Confirmez uniquement un versement déjà exécuté et vérifié. Le solde sera diminué une seule fois."
                  fields={[
                    { name: "amount", label: "Montant versé", type: "number" },
                    { name: "method", label: "Moyen", options: methods },
                    { name: "reference", label: "Référence du versement" },
                    {
                      name: "note",
                      label: "Justificatif / note de rapprochement",
                    },
                    {
                      name: "confirmedPaid",
                      label: "Je confirme le versement réellement effectué",
                      type: "checkbox",
                    },
                  ]}
                />
              </div>
            );
          })}
        </section>
      )}
      {canManage && canFinance && (
        <details className="rounded-xl border p-4">
          <summary className="font-semibold">
            Tarif exceptionnel avant engagement
          </summary>
          <p className="my-3 text-sm">
            Tout changement annule l'accord parent et les offres non acceptées.
            Impossible après encaissement ou attribution acceptée. La commission
            sera fixée entre 20 % et 30 % lors de la nouvelle proposition au
            professeur.
          </p>
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "REPRICE" }}
            label="Créer une nouvelle proposition tarifaire"
            fields={[
              {
                name: "unitPrice",
                label: "Nouveau prix par séance de 2 h",
                type: "number",
                value: String(dossier.unitPrice),
              },
              { name: "note", label: "Motif de l'exception" },
            ]}
            confirmText="Le parent devra accepter cette nouvelle version avant toute attribution."
          />
        </details>
      )}
      <details className="rounded-xl border p-4">
        <summary>Journal des 30 dernières opérations</summary>
        {dossier.events.map((entry) => (
          <p key={entry.id} className="mt-2 text-sm">
            {entry.createdAt.toISOString()} · {entry.action} · {entry.actorId}
          </p>
        ))}
      </details>
      <p className="text-xs text-slate-600">
        Commission fixée par attribution entre 20 % et 30 %. Les séances non
        attribuées n’ont pas encore de répartition définitive. Les taux acceptés
        et rémunérations déjà acquis sont conservés.
      </p>
    </main>
  );
}
