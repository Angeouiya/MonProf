"use client";
import { useState } from "react";
import { managedInstallments } from "@/lib/managed-courses-core";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
type Contract = {
  parentTerms: string[];
  termsVersion: string;
  reference: string;
  parentName: string;
  revision: number;
  accepted: boolean;
  className: string;
  subjectName: string;
  courseFormat: string;
  commune: string | null;
  quartier: string | null;
  totalPrice: number;
  cancelledAmount: number;
  receivedAmount: number;
  onHold: boolean;
  cadence: string;
  sessions: {
    id: string;
    date: string;
    time: string;
    amount: number;
    status: string;
    parentConfirmed: boolean;
  }[];
};
const money = (value: number) => `${value.toLocaleString("fr-FR")} F CFA`;
const statuses: Record<string, string> = {
  PLANNED: "Prévue",
  DONE: "Déclarée effectuée · vérification en cours",
  VALIDATED: "Effectuée et validée",
  CANCELLED: "Annulée",
};
export function ManagedContract() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"CANCELLATION" | "DISPUTE" | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  async function request(body: Record<string, unknown>) {
    const token = window.location.hash.slice(1);
    const response = await fetch("/api/managed-courses/accord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Lien indisponible.");
    return data;
  }
  async function load(accept = false) {
    setBusy(true);
    setError("");
    try {
      setContract(
        await request(
          accept && contract
            ? { revision: contract.revision, accepted: true }
            : {},
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chargement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirmSession() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    try {
      await request({ action: "CONFIRM_SESSION", sessionId: confirmation });
      setConfirmation(null);
      setMessage("Votre confirmation a été enregistrée.");
      setContract(await request({}));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Confirmation impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function linkAccount() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request({ action: "LINK_ACCOUNT" });
      setMessage(
        "Dossier rattaché. Vous pouvez le retrouver dans votre espace client.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Rattachement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function sendAction() {
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      await request({ action, reason });
      setMessage(
        "Votre demande est transmise à Compétence. L'équipe vous contactera pour la suite.",
      );
      setReason("");
      setAction(null);
      setContract(await request({}));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Envoi impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-8">
      <h1 className="text-3xl font-semibold">Votre accompagnement</h1>
      {!contract ? (
        <>
          <p>
            Ce lien privé permet de consulter la proposition de Compétence. Ne
            le transférez pas.
          </p>
          <button
            disabled={busy}
            className="rounded-xl border-2 px-5 py-3 font-semibold"
            onClick={() => void load()}
          >
            Consulter ma proposition
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {contract.reference} · Version {contract.revision} ·{" "}
            {contract.parentName}
          </p>
          <h2 className="text-xl font-semibold">
            {contract.subjectName} · {contract.className}
          </h2>
          <p>
            {contract.courseFormat === "HOME"
              ? `À domicile · ${contract.commune} · ${contract.quartier || ""}`
              : "En ligne"}
          </p>
          <strong className="block text-2xl">
            {money(contract.totalPrice - contract.cancelledAmount)}
          </strong>
          {contract.cancelledAmount > 0 && (
            <p className="text-sm">
              Montant initial : {money(contract.totalPrice)} · Cours annulés :{" "}
              {money(contract.cancelledAmount)}
            </p>
          )}
          <p className="text-sm">
            Règlements nets enregistrés : {money(contract.receivedAmount)} ·
            Reste à régler :{" "}
            {money(
              Math.max(
                0,
                contract.totalPrice -
                  contract.cancelledAmount -
                  contract.receivedAmount,
              ),
            )}
          </p>
          {contract.onHold && (
            <p className="rounded-xl border border-amber-400 p-4 text-sm text-amber-950">
              Réclamation en cours · Compétence examine votre dossier.
            </p>
          )}
          <ul className="space-y-2">
            {contract.sessions.map((session) => (
              <li
                className="rounded-xl border p-3"
                key={`${session.date}-${session.time}`}
              >
                <strong>
                  {session.date} · {session.time} · 2 h
                </strong>
                <p className="mt-1 text-sm">
                  {money(session.amount)} ·{" "}
                  {statuses[session.status] || session.status}
                </p>
                {session.parentConfirmed ? (
                  <p className="mt-2 text-sm font-semibold">
                    Séance confirmée par vous.
                  </p>
                ) : session.status === "DONE" &&
                  contract.accepted &&
                  !contract.onHold ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-3 min-h-11 rounded-xl border px-4 font-semibold"
                    onClick={() => setConfirmation(session.id)}
                  >
                    Confirmer la séance effectuée
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <h3 className="font-semibold">Échéances convenues</h3>
          {managedInstallments(
            contract.sessions.filter(
              (session) => session.status !== "CANCELLED",
            ),
            contract.cadence,
          ).map((item) => (
            <p key={item.dueDate}>
              {item.dueDate} : {money(item.amount)}
            </p>
          ))}
          <details open={!contract.accepted}>
            <summary className="cursor-pointer py-2 font-semibold">
              Vos engagements et conditions
            </summary>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-7">
              {contract.parentTerms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
          </details>
          {contract.accepted ? (
            <p className="rounded-xl border border-green-300 p-4 font-semibold text-green-900">
              Accord enregistré pour cette version.
            </p>
          ) : (
            <>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                J'accepte expressément cette proposition, les horaires, le
                montant, les échéances et les conditions ci-dessus.
              </label>
              <button
                className="rounded-xl border-2 border-[#092A55] px-5 py-3 font-semibold disabled:opacity-50"
                disabled={!agree || busy}
                onClick={() => void load(true)}
              >
                Accepter la proposition
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-xl border px-5 py-3 print:hidden"
            onClick={() => window.print()}
          >
            Imprimer / enregistrer en PDF
          </button>
          <details className="rounded-xl border p-4 print:hidden">
            <summary className="cursor-pointer font-semibold">
              Retrouver ce dossier dans mon espace client
            </summary>
            <p className="mt-3 text-sm">
              Connectez-vous à votre compte client, puis rattachez ce dossier.
              Ne partagez pas ce lien privé.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                className="min-h-11 rounded-xl border px-4 py-3 text-sm"
                href="/connexion"
                target="_blank"
                rel="noopener noreferrer"
              >
                Se connecter dans un autre onglet
              </a>
              <button
                className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold"
                disabled={busy}
                onClick={() => void linkAccount()}
              >
                Rattacher à mon compte
              </button>
              <a
                className="min-h-11 rounded-xl border px-4 py-3 text-sm"
                href="/client/accompagnement"
              >
                Mes cours
              </a>
            </div>
          </details>
          <details className="rounded-xl border p-4 print:hidden">
            <summary className="cursor-pointer font-semibold">
              Une annulation ou une réclamation ?
            </summary>
            <p className="my-3 text-sm leading-6">
              Précisez les séances concernées et votre demande. L'équipe vous
              contactera ; aucun remboursement ni aucune pénalité ne sont
              exécutés automatiquement.
            </p>
            <label className="block text-sm">
              Votre message
              <textarea
                minLength={10}
                maxLength={500}
                className="mt-2 min-h-28 w-full rounded-lg border bg-white p-3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                disabled={busy || reason.trim().length < 10}
                className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                onClick={() => setAction("CANCELLATION")}
              >
                Demander une annulation
              </button>
              <button
                disabled={busy || reason.trim().length < 10}
                className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                onClick={() => setAction("DISPUTE")}
              >
                Signaler un problème
              </button>
            </div>
          </details>
          <p className="text-xs leading-6 text-slate-600">
            Acceptation électronique simple. Ce parcours ne constitue pas une
            signature électronique qualifiée et ne vérifie pas à lui seul
            l'identité du signataire.
          </p>
        </>
      )}
      {message && (
        <p role="status" className="rounded-xl border p-4 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            Confirmer que cette séance a eu lieu ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Votre confirmation sera conservée dans le suivi de cette séance.
            Compétence vérifiera les conditions de règlement ; aucun paiement
            parent n’est créé par cette action.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirmSession();
              }}
            >
              {busy ? "Enregistrement…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {action === "DISPUTE"
              ? "Transmettre votre réclamation ?"
              : "Demander une annulation ?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === "DISPUTE"
              ? "Les sommes encore disponibles de ce dossier seront retenues pendant l'examen par Compétence. Un paiement déjà exécuté n'est pas récupéré automatiquement."
              : "Compétence examinera votre demande avec les parties. Vos séances restent prévues jusqu'à confirmation de l'annulation."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void sendAction();
              }}
            >
              {busy ? "Envoi…" : "Transmettre"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
