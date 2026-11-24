import { db } from "@/lib/db";
import { ManagedAction } from "./action";
const methods = [
  { value: "CASH", label: "Espèces" },
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MOMO", label: "MTN MoMo" },
  { value: "BANK", label: "Banque" },
  { value: "OTHER", label: "Autre" },
];
const reason = {
  name: "reason",
  label: "Motif détaillé et décision convenue avec les parties",
};
const note = {
  name: "note",
  label: "Motif détaillé et justificatif de rapprochement",
};
export async function ManagedAdminOperations({
  dossier,
  canManage,
  canFinance,
  teacherIds,
}: {
  dossier: {
    id: string;
    onHold: boolean;
    cancelledAmount: number;
    sessions: {
      id: string;
      sequence: number;
      status: string;
      fundedAmount: number;
    }[];
    receipts: {
      id: string;
      amount: number;
      kind: string;
      reference: string;
      reversesId: string | null;
    }[];
  };
  canManage: boolean;
  canFinance: boolean;
  teacherIds: string[];
}) {
  const endpoint = `/api/admin/managed-courses/${dossier.id}`;
  const payments = canFinance
    ? await db.managedTeacherLedgerEntry.findMany({
        where: {
          teacherId: { in: teacherIds },
          kind: "PAYMENT",
          reversal: null,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { teacher: { select: { fullName: true } } },
      })
    : [];
  const refundable = dossier.sessions
    .filter((session) => session.status === "CANCELLED")
    .reduce((sum, session) => sum + session.fundedAmount, 0);
  return (
    <section className="space-y-4 rounded-2xl border border-slate-300 bg-white p-5 text-slate-900">
      <h2 className="text-xl font-semibold">
        Annulations, litiges et corrections
      </h2>
      <p className="text-sm leading-6 text-slate-600">
        Aucune pénalité automatique. Les décisions sont motivées et historisées.
        Les boutons financiers enregistrent uniquement des opérations vérifiées
        ; ils ne transfèrent pas d'argent.
      </p>
      {dossier.onHold && (
        <p
          role="status"
          className="rounded-xl border border-amber-400 p-4 font-semibold text-amber-950"
        >
          Litige ouvert · attribution, validation et sommes concernées retenues.
        </p>
      )}
      {canManage && canFinance && (
        <>
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "HOLD", onHold: !dossier.onHold }}
            fields={[reason]}
            label={
              dossier.onHold
                ? "Lever la retenue après résolution"
                : "Ouvrir un litige et retenir les fonds"
            }
            confirmText={
              dossier.onHold
                ? "Confirmez la décision de résolution. Les crédits financés redeviennent payables sans effacer les preuves du litige."
                : "Les sommes acquises de ce dossier seront retenues dans la limite du solde encore présent. Aucun montant déjà payé ne sera récupéré automatiquement."
            }
          />
          <details>
            <summary className="cursor-pointer py-3 font-semibold">
              Annuler une séance non effectuée
            </summary>
            <p className="mb-3 text-sm">
              Vérifiez l'accord avec le parent. La séance sort du montant
              restant dû, son créneau est libéré et tout encaissement
              correspondant reste à rapprocher/rembourser.
            </p>
            {dossier.sessions
              .filter((session) => session.status === "PLANNED")
              .map((session) => (
                <ManagedAction
                  key={session.id}
                  endpoint={endpoint}
                  payload={{
                    action: "CANCEL_SESSIONS",
                    sessionIds: [session.id],
                  }}
                  label={`Annuler la séance ${session.sequence}`}
                  fields={[reason]}
                  confirmText="Confirmez que la séance n'a pas été effectuée et que son annulation est convenue. Cette action ne supprime aucun encaissement et n'effectue aucun remboursement."
                />
              ))}
          </details>
        </>
      )}
      {canManage && (
        <details>
          <summary className="cursor-pointer py-3 font-semibold">
            Reprogrammer une séance non effectuée
          </summary>
          <p className="mb-3 text-sm">
            Le parent devra accepter la nouvelle version. La séance sera retirée
            de l'attribution actuelle puis reproposée à un professeur, avec un
            nouveau contrôle de planning. Les autres séances et leurs écritures
            sont conservées.
          </p>
          {dossier.sessions
            .filter((session) => session.status === "PLANNED")
            .map((session) => (
              <ManagedAction
                key={session.id}
                endpoint={endpoint}
                payload={{ action: "RESCHEDULE", sessionId: session.id }}
                label={`Proposer un report · séance ${session.sequence}`}
                fields={[
                  { name: "date", label: "Nouvelle date", type: "date" },
                  {
                    name: "time",
                    label: "Début (08 h–20 h, par demi-heure)",
                    type: "time",
                  },
                  reason,
                ]}
                confirmText="L'accord parent et le lien privé de la version actuelle seront remplacés. Cette séance sera désattribuée jusqu'au nouvel accord du parent puis à la nouvelle acceptation d'un professeur. Aucun prix ni paiement ne sera modifié."
              />
            ))}
        </details>
      )}
      {canFinance && (
        <>
          {refundable > 0 && (
            <details>
              <summary className="cursor-pointer py-3 font-semibold">
                Remboursement parent · maximum{" "}
                {refundable.toLocaleString("fr-FR")} F CFA
              </summary>
              <ManagedAction
                endpoint={endpoint}
                payload={{ action: "REFUND" }}
                label="Enregistrer le remboursement effectué"
                fields={[
                  {
                    name: "amount",
                    label: "Montant rendu au parent",
                    type: "number",
                    max: refundable,
                  },
                  { name: "method", label: "Moyen", options: methods },
                  {
                    name: "reference",
                    label: "Référence unique du remboursement",
                  },
                  note,
                  {
                    name: "confirmedPaid",
                    label: "J'ai vérifié le remboursement réellement effectué",
                    type: "checkbox",
                  },
                ]}
                confirmText="Vous certifiez avoir réellement remboursé le parent pour des séances annulées. Le reçu d'origine restera conservé et une écriture négative sera ajoutée."
              />
            </details>
          )}
          <details>
            <summary className="cursor-pointer py-3 font-semibold">
              Corriger une erreur de saisie d'encaissement
            </summary>
            <p className="mb-3 text-sm">
              Extourne intégrale seulement. Impossible si les fonds
              correspondants ont déjà été remboursés ou si leur annulation
              créerait une dette professeur. Un vrai remboursement n'est pas une
              erreur de saisie.
            </p>
            {dossier.receipts
              .filter(
                (receipt) =>
                  receipt.kind === "RECEIPT" &&
                  !dossier.receipts.some(
                    (item) => item.reversesId === receipt.id,
                  ),
              )
              .map((receipt) => (
                <ManagedAction
                  key={receipt.id}
                  endpoint={endpoint}
                  payload={{ action: "REVERSE_RECEIPT", receiptId: receipt.id }}
                  label={`Corriger ${receipt.reference} · ${receipt.amount.toLocaleString("fr-FR")} F`}
                  fields={[
                    {
                      name: "method",
                      label: "Moyen de rapprochement",
                      options: methods,
                    },
                    {
                      name: "reference",
                      label: "Référence unique de correction",
                    },
                    note,
                    {
                      name: "confirmedCorrection",
                      label:
                        "Je confirme qu'il s'agit d'une saisie incorrecte, après vérification",
                      type: "checkbox",
                    },
                  ]}
                  confirmText="L'encaissement d'origine sera conservé avec une écriture compensatrice. Les crédits correspondants seront annulés seulement si le solde professeur le permet. Aucun argent ne sera envoyé au parent."
                />
              ))}
          </details>
          <details>
            <summary className="cursor-pointer py-3 font-semibold">
              Corriger une erreur de saisie de paiement professeur
            </summary>
            <p className="mb-3 text-sm">
              À utiliser seulement pour une saisie incorrecte ou un versement
              effectivement revenu. Un paiement réellement reçu par le
              professeur ne peut pas être annulé pour recréer artificiellement
              un solde.
            </p>
            {payments.map((payment) => (
              <ManagedAction
                key={payment.id}
                endpoint="/api/admin/managed-teacher-payments"
                payload={{
                  action: "REVERSE_PAYMENT",
                  teacherId: payment.teacherId,
                  entryId: payment.id,
                }}
                label={`${payment.teacher.fullName} · ${payment.reference} · ${(-payment.amountDelta).toLocaleString("fr-FR")} F`}
                fields={[
                  note,
                  {
                    name: "confirmedCorrection",
                    label:
                      "J'ai rapproché l'opération et vérifié l'absence de paiement ou le retour réel des fonds",
                    type: "checkbox",
                  },
                ]}
                confirmText="Une écriture compensatrice restaurera le montant restant à payer au professeur. L'original et l'identité de l'opérateur resteront conservés. Aucun virement n'est déclenché."
              />
            ))}
          </details>
        </>
      )}
    </section>
  );
}
