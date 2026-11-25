"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagedSchoolSubject } from "@/lib/managed-school-subjects";
import {
  MANAGED_CLASSES,
  MANAGED_PARENT_TERMS,
  MANAGED_TERMS_VERSION,
  managedInstallments,
  managedPrice,
} from "@/lib/managed-courses-core";
const money = (value: number) => `${value.toLocaleString("fr-FR")} F CFA`;
const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900";
export function ManagedRequestForm({
  subjects,
  admin = false,
}: {
  subjects: ManagedSchoolSubject[];
  admin?: boolean;
}) {
  const router = useRouter();
  const [journey, setJourney] = useState<"ivoirien" | "francais">("ivoirien");
  const [className, setClassName] = useState("6e");
  const [count, setCount] = useState("4");
  const [frequency, setFrequency] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [dates, setDates] = useState<
    Record<number, { date?: string; time?: string }>
  >({});
  const [cadence, setCadence] = useState("MONTHLY");
  const [format, setFormat] = useState("HOME");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [contractPath, setContractPath] = useState("");
  const [clientKey] = useState(() => crypto.randomUUID());
  const number = Number(count);
  const validCount = Number.isInteger(number) && number >= 1 && number <= 24;
  const price = managedPrice(journey, className, validCount ? number : 4);
  const sessions = Array.from(
    { length: validCount ? number : 0 },
    (_, index) => {
      const base = new Date(`${startDate}T00:00:00Z`);
      const offset =
        Math.floor(index / frequency) * 7 +
        Math.floor(((index % frequency) * 7) / frequency);
      const date = Number.isFinite(base.getTime())
        ? new Date(base.getTime() + offset * 86_400_000)
            .toISOString()
            .slice(0, 10)
        : "";
      return {
        date: dates[index]?.date ?? date,
        time: dates[index]?.time ?? time,
      };
    },
  );
  const installments = sessions.every((session) => session.date)
    ? managedInstallments(
        sessions.map((session) => ({
          date: session.date,
          amount: price.perSession,
        })),
        cadence,
      )
    : [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        admin ? "/api/admin/managed-courses" : "/api/managed-courses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientKey,
            termsVersion: MANAGED_TERMS_VERSION,
            parentName: values.parentName,
            phone: values.phone,
            journey,
            className,
            subjectId: values.subjectId,
            courseFormat: format,
            commune: values.commune || "",
            quartier: values.quartier || "",
            addressHint: values.addressHint || "",
            objective: values.objective || "",
            cadence,
            sessions,
            quotedTotal: price.total,
            accepted: !admin && values.accepted === "on",
            website: values.website || "",
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Envoi non confirmé. Réessayez avec ce formulaire.",
        );
      if (admin) router.push(`/admin/accompagnement/${payload.id}`);
      else {
        setReference(payload.reference);
        setContractPath(payload.path || "");
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Envoi impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <section
        className="rounded-3xl border border-slate-200 bg-white p-7 text-slate-900"
        aria-live="polite"
      >
        <h2 className="text-2xl font-semibold">
          Votre demande est enregistrée.
        </h2>
        <p className="mt-4">
          Référence <strong>{reference}</strong>
        </p>
        <p className="mt-3 leading-7">
          Compétence vous contactera pour organiser l'accompagnement et
          confirmer le professeur. Aucun paiement n'a été effectué sur ce
          formulaire.
        </p>
        {contractPath && (
          <a className="mt-4 block underline" href={contractPath}>
            Consulter et conserver mon récapitulatif privé
          </a>
        )}
        <a className="mt-5 inline-block underline" href="/contact">
          Contacter Compétence
        </a>
      </section>
    );
  return (
    <form
      onSubmit={submit}
      className="space-y-7 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-8"
    >
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-semibold">Le cours</legend>
        <label>
          Système
          <select
            className={inputClass}
            value={journey}
            onChange={(event) =>
              setJourney(event.target.value as typeof journey)
            }
          >
            <option value="ivoirien">Ivoirien</option>
            <option value="francais">Français</option>
          </select>
        </label>
        <label>
          Classe
          <select
            className={inputClass}
            value={className}
            onChange={(event) => setClassName(event.target.value)}
          >
            {MANAGED_CLASSES.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label>
          Matière
          <select
            className={inputClass}
            name="subjectId"
            key={`${journey}:${className}`}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Choisir une matière
            </option>
            {subjects.filter((subject) => subject.programmes.includes(`${journey}:${className}`)).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select
            className={inputClass}
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="HOME">À domicile</option>
            <option value="ONLINE">En ligne</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          Objectif, si vous le souhaitez
          <textarea
            name="objective"
            maxLength={500}
            className={`${inputClass} py-3`}
            placeholder="Ex. consolider les bases en mathématiques"
          />
        </label>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-semibold">
          Les séances · 2 heures chacune
        </legend>
        <label>
          Nombre de séances
          <input
            className={inputClass}
            type="number"
            min={1}
            max={24}
            value={count}
            onChange={(event) => {
              setCount(event.target.value);
              setFrequency(
                Math.min(
                  4,
                  Math.max(1, Math.ceil(Number(event.target.value) / 4)),
                ),
              );
              setDates({});
            }}
            required
          />
        </label>
        <label>
          Séances par semaine
          <select
            className={inputClass}
            value={frequency}
            onChange={(event) => {
              setFrequency(Number(event.target.value));
              setDates({});
            }}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value} par semaine
              </option>
            ))}
          </select>
        </label>
        <label>
          Première date
          <input
            className={inputClass}
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setDates({});
            }}
            required
          />
        </label>
        <label>
          Heure de début
          <input
            className={inputClass}
            type="time"
            min="08:00"
            max="20:00"
            step={1800}
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              setDates({});
            }}
            required
          />
        </label>
        <label>
          Rythme de règlement
          <select
            className={inputClass}
            value={cadence}
            onChange={(event) => setCadence(event.target.value)}
          >
            <option value="WEEKLY">Chaque semaine</option>
            <option value="FORTNIGHTLY">Toutes les deux semaines</option>
            <option value="MONTHLY">Chaque mois</option>
          </select>
        </label>
        <details className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <summary className="cursor-pointer font-semibold">
            Vérifier et modifier les {sessions.length} dates
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Dates proposées à raison de {frequency} séance(s) par semaine.
            Ajustez chaque date avant d'envoyer.
          </p>
          <div className="mt-3 space-y-3">
            {sessions.map((session, index) => (
              <div
                key={index}
                className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2"
              >
                <span>{index + 1}</span>
                <input
                  aria-label={`Date séance ${index + 1}`}
                  className={inputClass}
                  type="date"
                  value={session.date}
                  required
                  onChange={(event) =>
                    setDates({
                      ...dates,
                      [index]: { ...dates[index], date: event.target.value },
                    })
                  }
                />
                <input
                  aria-label={`Heure séance ${index + 1}`}
                  className={inputClass}
                  type="time"
                  min="08:00"
                  max="20:00"
                  step={1800}
                  required
                  value={session.time}
                  onChange={(event) =>
                    setDates({
                      ...dates,
                      [index]: { ...dates[index], time: event.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </details>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-semibold">Vous contacter</legend>
        <label>
          Nom du parent
          <input
            className={inputClass}
            name="parentName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          Téléphone ivoirien
          <input
            className={inputClass}
            name="phone"
            autoComplete="tel"
            type="tel"
            placeholder="07 00 00 00 00"
            required
          />
        </label>
        {format === "HOME" && (
          <>
            <label>
              Commune
              <input
                className={inputClass}
                name="commune"
                maxLength={100}
                required
              />
            </label>
            <label>
              Quartier
              <input
                className={inputClass}
                name="quartier"
                maxLength={100}
                required
              />
            </label>
            <label className="sm:col-span-2">
              Indication du lieu
              <input
                className={inputClass}
                name="addressHint"
                maxLength={240}
              />
            </label>
          </>
        )}
      </fieldset>
      <div className="rounded-2xl border border-slate-300 p-5">
        <p className="text-sm text-slate-600">
          Base : {money(price.monthly)} pour 4 séances de 2 h
        </p>
        <p className="mt-2">
          {validCount ? number : "—"} × {money(price.perSession)}
        </p>
        <strong className="mt-2 block text-3xl">
          {validCount ? money(price.total) : "Choisissez le nombre de séances"}
        </strong>
        <p className="mt-3 text-sm">
          Pas de paiement en ligne. Vous réglez Compétence selon l'échéancier
          accepté. Aucun supplément non accepté ne sera ajouté.
        </p>
        {installments.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="font-semibold">Échéances proposées</p>
            {installments.map((item) => (
              <p
                key={item.dueDate}
                className="mt-1 flex justify-between gap-3 text-sm"
              >
                <span>{item.dueDate}</span>
                <strong>{money(item.amount)}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold">
          Lire les engagements
        </summary>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">
          {MANAGED_PARENT_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ol>
      </details>
      {!admin ? (
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            className="mt-1 h-5 w-5 shrink-0"
            name="accepted"
            type="checkbox"
            required
          />
          <span>
            J'accepte les dates, le montant et l'échéancier ci-dessus ainsi que
            les{" "}
            <a
              className="underline"
              href="/engagements-accompagnement"
              target="_blank"
              rel="noopener noreferrer"
            >
              conditions d'accompagnement
            </a>
            . J'ai lu la{" "}
            <a
              className="underline"
              href="/politique-confidentialite"
              target="_blank"
              rel="noopener noreferrer"
            >
              confidentialité
            </a>
            .
          </span>
        </label>
      ) : (
        <p className="text-sm text-amber-900">
          Saisie pour le parent : son accord reste à recueillir par lien privé
          avant attribution.
        </p>
      )}
      <input
        name="website"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-white p-4 text-red-800"
        >
          {error}
        </p>
      )}
      <button
        className="min-h-13 w-full rounded-xl border-2 border-[#092A55] bg-white px-5 py-3 font-semibold text-[#092A55] disabled:opacity-60"
        disabled={busy || !validCount}
      >
        {busy
          ? "Enregistrement…"
          : admin
            ? "Créer le dossier parent"
            : "Envoyer ma demande"}
      </button>
    </form>
  );
}
