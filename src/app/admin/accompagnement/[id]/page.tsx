import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";
import { managedInstallments } from "@/lib/managed-courses-core";
import { ManagedAction } from "@/components/managed/action";
import { ManagedAdminOperations } from "@/components/managed/admin-operations";
import { ManagedAssignment } from "@/components/managed/assignment";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
import {
  managedAvailableBalance,
  managedStartsInFuture,
} from "@/lib/managed-workspace";
import styles from "@/components/managed/workspace.module.css";
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
  searchParams: Promise<{ prof?: string; partenaire?: string }>;
}) {
  const admin = await requireAdmin("BOOKINGS_VIEW");
  const { id } = await params;
  const { prof = "", partenaire = "" } = await searchParams;
  const dossier = await db.managedCourseDossier.findUnique({
    where: { id },
    include: {
      partner: { select: { name: true, phone: true } },
      sessions: {
        orderBy: { sequence: "asc" },
        include: { teacher: { select: { fullName: true } } },
      },
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
  const classNames =
    dossier.className === "Seconde"
      ? ["2nde", "Seconde"]
      : dossier.className === "Première"
        ? ["1ère", "Première"]
        : [dossier.className];
  const exactJunior = ["6e", "5e", "4e", "3e"].includes(dossier.className);
  const agreed = dossier.acceptedRevision === dossier.revision;
  const unassigned = dossier.sessions.filter(
    (session) =>
      session.status === "PLANNED" &&
      !session.offerId &&
      !session.teacherId &&
      managedStartsInFuture(session),
  ).length;
  const needsValidation = dossier.sessions.filter(
    (session) => session.status === "DONE",
  );
  const expiredUnassigned = dossier.sessions.filter(
    (session) =>
      session.status === "PLANNED" &&
      !session.offerId &&
      !session.teacherId &&
      !managedStartsInFuture(session),
  ).length;
  const teachers =
    canManage && agreed && unassigned > 0 && !dossier.onHold
      ? await db.teacher.findMany({
          where: {
            status: "ACTIVE",
            portalAccessEnabled: true,
            portalPasswordMustChange: false,
            portalPasswordHash: { not: null },
            ...(dossier.journey === "ivoirien"
              ? { offersIvorianSystem: true }
              : { offersFrenchSystem: true }),
            ...(dossier.courseFormat === "HOME"
              ? { offersHome: true }
              : { offersOnline: true }),
            preciseLevels: {
              some: {
                journey: dossier.journey,
                subjectId: dossier.subjectId,
                OR: classNames.flatMap((className) =>
                  exactJunior
                    ? [{ className }]
                    : [
                        { className },
                        { className: { startsWith: `${className} ` } },
                      ],
                ),
              },
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
  const partners =
    canManage && canFinance
      ? await db.managedPartner.findMany({
          where: {
            active: true,
            ...(partenaire.trim()
              ? {
                  OR: [
                    {
                      name: {
                        contains: partenaire.trim().slice(0, 80),
                        mode: "insensitive",
                      },
                    },
                    { phone: { contains: partenaire.trim().slice(0, 32) } },
                  ],
                }
              : {}),
          },
          select: { id: true, name: true, phone: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
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
  const held = canFinance
    ? await db.managedCourseSession.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds }, dossier: { onHold: true } },
        _sum: { creditedTeacherAmount: true },
      })
    : [];
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
    <div className={styles.page}>
      <Link
        className={`${styles.muted} underline`}
        href="/admin/accompagnement"
      >
        Retour aux demandes
      </Link>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{dossier.reference}</p>
          <h1>{dossier.parentName}</h1>
          <p className={`${styles.muted} mt-2`}>
            {dossier.className} · {dossier.subjectName} ·{" "}
            {dossier.courseFormat === "HOME" ? "À domicile" : "En ligne"} ·{" "}
            {dossier.commune} {dossier.quartier}
          </p>
        </div>
        <a className={styles.button} href={`tel:${dossier.phone}`}>
          Appeler le parent
        </a>
      </header>
      <p
        className={styles.badge}
        data-tone={dossier.onHold || !agreed ? "attention" : undefined}
      >
        {dossier.onHold
          ? "Litige ouvert · traitement suspendu"
          : !agreed
            ? "Prochaine étape : accord du parent"
            : unassigned
              ? `${unassigned} séance(s) à attribuer`
              : needsValidation.length
                ? `${needsValidation.length} séance(s) à vérifier`
                : managedStatusLabel(dossier.status)}
      </p>
      <div className={styles.stats}>
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
          <div className={styles.stat} key={label}>
            <p>{label}</p>
            <strong>{money(Number(amount))}</strong>
          </div>
        ))}
      </div>
      <section className={styles.card}>
        <h2>Tarif et partenariat · interne</h2>
        <p className={styles.muted}>
          Base initiale :{" "}
          {dossier.initialTotalPrice
            ? money(dossier.initialTotalPrice)
            : "Non renseignée (dossier historique)"}{" "}
          · Prix final : {money(dossier.totalPrice)}
        </p>
        <p>
          {dossier.partner
            ? `${dossier.partner.name} · ${dossier.partner.phone} · ${dossier.partnerRateBps / 100} % du cours`
            : "Aucun partenaire"}
        </p>
        {canManage &&
          canFinance &&
          !dossier.receivedAmount &&
          !dossier.onHold &&
          !dossier.sessions.some(
            (s) => s.teacherId || s.status !== "PLANNED",
          ) &&
          !dossier.offers.some((o) =>
            [
              "OFFERED",
              "ACCEPTED",
              "CANCEL_REQUESTED",
              "PARTIAL_CANCELLED",
            ].includes(o.status),
          ) && (
            <details className={styles.disclosure}>
              <summary>Définir ou modifier le partenaire</summary>
              <form className="flex gap-2">
                <input
                  name="partenaire"
                  aria-label="Chercher un partenaire"
                  defaultValue={partenaire}
                  placeholder="Nom ou numéro"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
                />
                <button className={styles.button}>Chercher</button>
              </form>
              <p className={styles.muted}>
                30 résultats maximum.{" "}
                <Link
                  href="/admin/accompagnement/partenaires"
                  className="underline"
                >
                  Enregistrer un partenaire
                </Link>
              </p>
              <ManagedAction
                endpoint={endpoint}
                payload={{ action: "SET_PARTNER" }}
                label="Enregistrer le partenariat"
                fields={[
                  {
                    name: "partnerId",
                    label: "Partenaire",
                    required: false,
                    value: dossier.partnerId ?? "",
                    options: [
                      { value: "", label: "Sans partenaire" },
                      ...partners.map((p) => ({
                        value: p.id,
                        label: `${p.name} · ${p.phone}`,
                      })),
                    ],
                  },
                  {
                    name: "partnerRatePercent",
                    label: "Pourcentage sur le prix final du cours",
                    type: "number",
                    value: String(dossier.partnerRateBps / 100),
                    min: 0,
                    max: 100,
                    step: 0.01,
                  },
                ]}
                confirmText="Ce partenariat sera interne à Compétence. La part partenaire sera calculée sur les encaissements des séances validées, sans diminuer la rémunération attribuée au professeur."
              />
            </details>
          )}
      </section>
      {expiredUnassigned > 0 && (
        <p className={styles.notice}>
          {expiredUnassigned} horaire(s) non attribué(s) sont déjà passés.
          Utilisez « Annulations, litiges et corrections » pour proposer un
          report, puis recueillez le nouvel accord du parent.
        </p>
      )}
      <details className={styles.disclosure}>
        <summary>Contact, besoin du parent et échéancier</summary>
        <p className={styles.muted}>
          {dossier.phone}
          <br />
          {dossier.addressHint}
          <br />
          {dossier.objective}
        </p>
        {schedule.map((item) => (
          <p key={item.dueDate} className={styles.muted}>
            Échéance {item.dueDate} : {money(item.amount)}
          </p>
        ))}
      </details>
      <section className={styles.card}>
        <h2 className="text-xl font-semibold">
          Accord parent · version {dossier.revision}
        </h2>
        <p className="my-3">
          {dossier.acceptedRevision === dossier.revision
            ? `Accepté le ${dossier.acceptedAt?.toISOString().slice(0, 10)}`
            : "Accord à recueillir — attribution et encaissement bloqués."}
        </p>
        {!agreed && (
          <p className={styles.muted}>
            L'identité n'est pas certifiée par ce parcours. Vérifiez le contact
            avant de commencer.
          </p>
        )}
        {canManage && !agreed && (
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "CONTRACT_LINK" }}
            label="Créer un lien privé pour le parent"
          />
        )}
        {canManage && agreed && (
          <details className={styles.disclosure}>
            <summary>Renvoyer un accès privé au parent</summary>
            <ManagedAction
              endpoint={endpoint}
              payload={{ action: "CONTRACT_LINK" }}
              label="Renouveler le lien privé"
              confirmText="Le nouveau lien sera valable sept jours et remplacera le précédent. L’accord déjà enregistré et les écritures comptables restent conservés."
            />
          </details>
        )}
      </section>
      {needsValidation.length > 0 && (
        <section className={styles.card}>
          <h2>Séances à vérifier · {needsValidation.length}</h2>
          {needsValidation.map((session) => (
            <div className={styles.session} key={session.id}>
              <p className="text-sm font-semibold">
                Séance {session.sequence} ·{" "}
                {session.scheduledDate.toISOString().slice(0, 10)} ·{" "}
                {session.scheduledTime}
              </p>
              <p className={styles.muted}>
                {session.parentConfirmedAt
                  ? `Parent : séance confirmée le ${session.parentConfirmedAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })}`
                  : "Confirmation parent non encore reçue"}
              </p>
              {canManage && !dossier.onHold ? (
                <ManagedAction
                  endpoint={endpoint}
                  payload={{ action: "VALIDATE", sessionId: session.id }}
                  label="Valider la séance après vérification"
                  confirmText="Confirmez que cette séance a bien eu lieu. La part professeur financée par un encaissement déjà enregistré deviendra payable ; le reste attendra le règlement du parent."
                />
              ) : (
                <p className={styles.muted}>
                  {dossier.onHold
                    ? "Validation suspendue pendant le litige."
                    : "Validation réservée à un gestionnaire habilité."}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
      <details className={styles.disclosure}>
        <summary>
          Planning et financement · {dossier.sessions.length} séance
          {dossier.sessions.length !== 1 ? "s" : ""} de 2 h
        </summary>
        <div className="space-y-3">
          {dossier.sessions.map((session) => (
            <div className="rounded-xl border p-4" key={session.id}>
              <p className="font-semibold">
                {session.sequence}.{" "}
                {session.scheduledDate.toISOString().slice(0, 10)} ·{" "}
                {session.scheduledTime} · {managedStatusLabel(session.status)}
              </p>
              <p className={styles.muted}>
                {session.teacher?.fullName ?? "Non attribué"}
                {session.completedAt
                  ? ` · déclarée effectuée le ${session.completedAt.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}`
                  : ""}
                {session.parentConfirmedAt ? " · confirmée par le parent" : ""}
              </p>
              <p className="mt-2 text-sm">
                Cours {money(session.amount)} · Financé{" "}
                {money(session.fundedAmount)} · Crédit professeur{" "}
                {money(session.creditedTeacherAmount)}
              </p>
            </div>
          ))}
        </div>
      </details>
      {canManage && agreed && unassigned > 0 && !dossier.onHold && (
        <section className={styles.card}>
          <h2 className="text-xl font-semibold">
            Attribuer les séances non affectées
          </h2>
          <form className="flex gap-2">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
              name="prof"
              aria-label="Rechercher un professeur par nom"
              defaultValue={prof}
              placeholder="Rechercher un professeur par nom"
            />
            <button className="rounded-lg border px-4">Rechercher</button>
          </form>
          <p className="text-sm text-slate-600">
            30 résultats maximum. Le système, la classe, la matière et le
            planning seront vérifiés à l'attribution et à l'acceptation.
          </p>
          {!teachers.length && (
            <p className="rounded-xl border border-amber-300 p-4 text-sm leading-6 text-amber-950">
              Aucun profil habilité dans ces résultats. Les anciens profils sont
              conservés mais leurs classes et matières exactes doivent être
              validées :{" "}
              <Link
                className="font-semibold underline"
                href="/admin/professeurs"
              >
                vérifier les habilitations des professeurs
              </Link>
              . Une recherche par nom ne contourne pas ces restrictions.
            </p>
          )}
          {teachers.length > 0 && (
            <ManagedAssignment
              endpoint={endpoint}
              teachers={teachers}
              amounts={dossier.sessions
                .filter(
                  (s) =>
                    s.status === "PLANNED" &&
                    !s.teacherId &&
                    !s.offerId &&
                    managedStartsInFuture(s),
                )
                .map((s) => s.amount)}
              partnerRateBps={dossier.partnerRateBps}
            />
          )}
        </section>
      )}
      {dossier.offers.length > 0 && (
        <details className={styles.disclosure}>
          <summary>Propositions et réattribution</summary>
          {dossier.offers.map((offer) => (
            <div className="mb-3 rounded-xl border p-4" key={offer.id}>
              <p>
                {offer.teacher.fullName} · {managedStatusLabel(offer.status)} ·
                Compétence {offer.commissionRateBps / 100} % · professeur{" "}
                {100 - offer.commissionRateBps / 100} %
              </p>
              {offer.reason && <p className="mt-2 text-sm">{offer.reason}</p>}
              {canManage &&
                ["OFFERED", "ACCEPTED", "CANCEL_REQUESTED"].includes(
                  offer.status,
                ) && (
                  <details className={styles.disclosure}>
                    <summary>Réattribuer les séances à venir</summary>
                    <ManagedAction
                      endpoint={endpoint}
                      payload={{ action: "RELEASE", offerId: offer.id }}
                      label="Libérer les séances à venir pour réattribution"
                      fields={[
                        {
                          name: "reason",
                          label: "Motif détaillé",
                          minLength: 10,
                        },
                      ]}
                      confirmText="Les séances non effectuées seront retirées de cette attribution. Les séances déclarées effectuées ou validées et leurs écritures seront conservées. Aucun paiement n'est automatiquement remboursé."
                    />
                  </details>
                )}
            </div>
          ))}
        </details>
      )}
      {canFinance && (
        <details className={styles.disclosure}>
          <summary>
            Enregistrer un règlement parent / consulter les reçus
          </summary>
          {agreed ? (
            <ManagedAction
              endpoint={endpoint}
              payload={{ action: "RECEIPT" }}
              label="Confirmer l'encaissement"
              confirmText="Vous certifiez avoir reçu et vérifié cette somme. Ce bouton ne débite pas le parent et n'appelle aucun moyen de paiement. Il peut créditer la rémunération de séances déjà validées."
              fields={[
                {
                  name: "amount",
                  label: "Montant reçu (FCFA)",
                  type: "number",
                },
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
          ) : (
            <p className={styles.notice}>
              Les reçus restent consultables. Le parent doit accepter le nouveau
              planning avant un nouvel encaissement.
            </p>
          )}
          <details className="mt-4">
            <summary>Derniers encaissements</summary>
            {dossier.receipts.map((receipt) => (
              <p className="mt-2 text-sm" key={receipt.id}>
                {receipt.receivedAt.toISOString()} · {money(receipt.amount)} ·{" "}
                {receipt.method} · {receipt.reference}
              </p>
            ))}
          </details>
        </details>
      )}
      {canFinance && (
        <details className={styles.disclosure}>
          <summary>Enregistrer un versement professeur</summary>
          <p className="mb-4 text-sm">
            Seuls les crédits issus de séances validées et financées sont
            payables. Les soldes ci-dessous couvrent tous les dossiers du
            professeur dans ce nouveau service.
          </p>
          {teacherIds.map((teacherId) => {
            const available = managedAvailableBalance(
              totals.find((total) => total.teacherId === teacherId)?._sum
                .amountDelta ?? 0,
              held.find((item) => item.teacherId === teacherId)?._sum
                .creditedTeacherAmount ?? 0,
            );
            const teacherName = dossier.offers.find(
              (offer) => offer.teacherId === teacherId,
            )?.teacher.fullName;
            return (
              <div className="mb-4" key={teacherId}>
                <h3 className="mb-2 font-semibold">
                  {teacherName} · Disponible après retenues {money(available)}
                </h3>
                {available > 0 ? (
                  <ManagedAction
                    endpoint="/api/admin/managed-teacher-payments"
                    payload={{ teacherId }}
                    label="Enregistrer le paiement effectué"
                    confirmText="Ce bouton ne transfère pas d'argent. Confirmez uniquement un versement déjà exécuté et vérifié. Le solde sera diminué une seule fois."
                    fields={[
                      {
                        name: "amount",
                        label: "Montant versé",
                        type: "number",
                        max: available,
                      },
                      { name: "method", label: "Moyen", options: methods },
                      { name: "reference", label: "Référence du versement" },
                      {
                        name: "note",
                        label: "Justificatif / note de rapprochement",
                        minLength: 10,
                      },
                      {
                        name: "confirmedPaid",
                        label: "Je confirme le versement réellement effectué",
                        type: "checkbox",
                      },
                    ]}
                  />
                ) : (
                  <p className={styles.muted}>
                    Aucun montant disponible à verser pour ce professeur.
                  </p>
                )}
              </div>
            );
          })}
          {!teacherIds.length && (
            <p className={styles.muted}>
              Aucun professeur attribué à ce dossier.
            </p>
          )}
        </details>
      )}
      {canManage && canFinance && (
        <details className={styles.disclosure}>
          <summary className="font-semibold">
            Tarif exceptionnel avant engagement
          </summary>
          <p className="my-3 text-sm">
            Tout changement annule l'accord parent et les offres non acceptées.
            Impossible après encaissement ou attribution acceptée. La commission
            sera fixée lors de la nouvelle proposition au professeur, qui ne
            verra que sa rémunération.
          </p>
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "REPRICE_TOTAL" }}
            label="Créer une nouvelle proposition tarifaire"
            fields={[
              {
                name: "totalPrice",
                label: "Montant total négocié (F CFA)",
                type: "number",
                value: String(dossier.totalPrice),
              },
              { name: "note", label: "Motif de l'exception" },
            ]}
            confirmText="Le parent devra accepter cette nouvelle version avant toute attribution."
          />
        </details>
      )}
      {(canManage || canFinance) && (
        <details
          className={styles.disclosure}
          open={dossier.onHold || undefined}
        >
          <summary>Annulations, litiges et corrections</summary>
          <ManagedAdminOperations
            dossier={dossier}
            teacherIds={teacherIds}
            canManage={canManage}
            canFinance={canFinance}
          />
        </details>
      )}
      <details className={styles.disclosure}>
        <summary>Journal des 30 dernières opérations</summary>
        {dossier.events.map((entry) => (
          <p key={entry.id} className="mt-2 text-sm">
            {entry.createdAt.toISOString()} · {entry.action} · {entry.actorId}
          </p>
        ))}
      </details>
      <p className="text-xs text-slate-600">
        Répartition fixée librement par l’administration avant attribution. Les
        séances non attribuées n’ont pas encore de répartition définitive. Les
        taux acceptés et rémunérations déjà acquis sont conservés.
      </p>
    </div>
  );
}
