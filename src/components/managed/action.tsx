"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  async function send() {
    if (busy || !form.current) return;
    setBusy(true);
    setMessage("");
    setDialog(false);
    try {
      const body: Record<string, unknown> = { ...payload };
      for (const field of fields) {
        const value = new FormData(form.current).get(field.name);
        body[field.name] =
          field.type === "number"
            ? Number(value)
            : field.type === "checkbox"
              ? value === "on"
              : String(value ?? "");
      }
      if (
        ["RECEIPT", "REFUND", "REVERSE_RECEIPT"].includes(
          String(payload.action),
        ) ||
        endpoint === "/api/admin/managed-teacher-payments"
      ) {
        body.idempotencyKey = key;
        if (payload.action === "RECEIPT")
          body.receivedAt = new Date(String(body.receivedAt)).toISOString();
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Opération non confirmée.");
      setMessage("Enregistré et confirmé par le serveur.");
      if (result.path)
        setLink(new URL(result.path, window.location.origin).href);
      setKey(crypto.randomUUID());
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Opération impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={form}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmText) setDialog(true);
        else void send();
      }}
    >
      {fields.map((field) => (
        <label className="block text-sm" key={field.name}>
          {field.label}
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
              step={field.type === "number" ? 1 : undefined}
              required={field.required !== false}
            />
          )}
        </label>
      ))}
      <button
        disabled={busy}
        className="min-h-11 rounded-xl border border-[#092A55] bg-white px-4 font-semibold text-[#092A55] disabled:opacity-50"
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
