"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./workspace.module.css";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string;
  min?: number;
  max?: number;
  minLength?: number;
  options?: { value: string; label: string }[];
  required?: boolean;
};
export function ManagedAction({
  endpoint,
  payload,
  label,
  fields = [],
  confirmText,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  fields?: Field[];
  confirmText?: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const prepared = useRef<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  async function send() {
    if (inFlight.current || !prepared.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setDialog(false);
    try {
      const body = { ...prepared.current };
      if (
        ["RECEIPT", "REFUND", "REVERSE_RECEIPT"].includes(
          String(payload.action),
        ) ||
        endpoint === "/api/admin/managed-teacher-payments"
      ) {
        body.idempotencyKey = key;
        if (payload.action === "RECEIPT") {
          const date = new Date(String(body.receivedAt));
          if (!Number.isFinite(date.getTime()))
            throw new Error("Vérifiez la date et l’heure de réception.");
          body.receivedAt = date.toISOString();
        }
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (
        !response.ok ||
        !result ||
        typeof result !== "object" ||
        Array.isArray(result)
      )
        throw new Error(
          result?.error ||
            "Le serveur n’a pas confirmé l’opération. Vérifiez le dossier avant de réessayer.",
        );
      setMessage("Enregistré.");
      if (result.path)
        setLink(new URL(result.path, window.location.origin).href);
      setKey(crypto.randomUUID());
      if (body.idempotencyKey) form.current?.reset();
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "Connexion interrompue. Vérifiez le dossier avant de réessayer."
          : failure instanceof Error
            ? failure.message
            : "Opération impossible.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      ref={form}
      className={styles.actionForm}
      aria-busy={busy}
      onChange={() => {
        setMessage("");
        setError("");
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current || !form.current) return;
        const data = new FormData(form.current);
        prepared.current = { ...payload };
        const preview: { label: string; value: string }[] = [];
        for (const field of fields) {
          const value = data.get(field.name);
          prepared.current[field.name] =
            field.type === "number"
              ? Number(value)
              : field.type === "checkbox"
                ? value === "on"
                : String(value ?? "");
          if (field.type !== "checkbox" && value)
            preview.push({
              label: field.label,
              value:
                field.options?.find((option) => option.value === value)
                  ?.label ?? String(value),
            });
        }
        setSummary(preview);
        if (confirmText) setDialog(true);
        else void send();
      }}
    >
      <fieldset disabled={busy}>
        {fields.map((field) => (
          <label key={field.name}>
            {field.type !== "checkbox" && field.label}
            {field.options ? (
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                name={field.name}
                required={field.required !== false}
                defaultValue={field.value ?? ""}
              >
                {!field.value && <option value="">Choisir</option>}
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={
                  field.type === "checkbox"
                    ? "ml-3 h-5 w-5 align-middle"
                    : "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                }
                name={field.name}
                type={field.type || "text"}
                defaultValue={field.value}
                min={field.type === "number" ? (field.min ?? 1) : undefined}
                max={field.max}
                minLength={field.minLength}
                step={field.type === "number" ? 1 : undefined}
                required={field.required !== false}
              />
            )}
            {field.type === "checkbox" && field.label}
          </label>
        ))}
      </fieldset>
      <button
        disabled={
          busy || fields.some((field) => field.options && !field.options.length)
        }
        className={styles.button}
      >
        {busy ? "En cours…" : label}
      </button>
      {message && (
        <p className="text-sm leading-6" role="status">
          {message}
        </p>
      )}
      {link && (
        <div>
          <p className="text-sm">
            À transmettre personnellement au parent, valable 7 jours. Ne pas
            partager publiquement.
          </p>
          <input
            aria-label="Lien privé du parent"
            readOnly
            value={link}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded-lg border p-3 text-sm"
          />
        </div>
      )}
      <AlertDialog open={dialog} onOpenChange={setDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirmer cette opération</AlertDialogTitle>
          <AlertDialogDescription>{confirmText}</AlertDialogDescription>
          {summary.length > 0 && (
            <dl className={styles.confirmation}>
              {summary.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(error)}
        onOpenChange={(open) => {
          if (!open) setError("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Action non confirmée</AlertDialogTitle>
          <AlertDialogDescription>{error}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError("")}>
              OK · revenir au formulaire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
