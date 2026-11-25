"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Home, Monitor } from "lucide-react";
import type { ManagedSchoolSubject } from "@/lib/managed-school-subjects";
import {
  MANAGED_CLASSES,
  MANAGED_PARENT_TERMS,
  MANAGED_TERMS_VERSION,
  managedInstallments,
  managedPrice,
} from "@/lib/managed-courses-core";
import styles from "./managed-public.module.css";
import { ManagedCountryFlag } from "./country-flag";

const money = (value: number) => `${value.toLocaleString("fr-FR")} F CFA`;
const steps = ["Cours", "Séances", "Contact"];
type ValidatedControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function ManagedRequestForm({
  subjects,
  admin = false,
  initialJourney = "ivoirien",
}: {
  subjects: ManagedSchoolSubject[];
  admin?: boolean;
  initialJourney?: "ivoirien" | "francais";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [journey, setJourney] = useState(initialJourney);
  const [className, setClassName] = useState("6e");
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState("4");
  const [frequency, setFrequency] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [dates, setDates] = useState<Record<number, { date?: string; time?: string }>>({});
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
  const availableSubjects = subjects.filter((subject) => subject.programmes.includes(`${journey}:${className}`));
  const selectedSubject = availableSubjects.find((subject) => subject.id === subjectId);
  const sessions = Array.from({ length: validCount ? number : 0 }, (_, index) => {
    const base = new Date(`${startDate}T00:00:00Z`);
    const offset = Math.floor(index / frequency) * 7 + Math.floor(((index % frequency) * 7) / frequency);
    const date = Number.isFinite(base.getTime())
      ? new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
      : "";
    return { date: dates[index]?.date ?? date, time: dates[index]?.time ?? time };
  });
  const installments = sessions.length > 0 && sessions.every((session) => session.date)
    ? managedInstallments(sessions.map((session) => ({ date: session.date, amount: price.perSession })), cadence)
    : [];

  function showStep(next: number) {
    setStep(next);
    setError("");
    requestAnimationFrame(() => {
      const heading = formRef.current?.querySelector<HTMLElement>(`[data-form-step="${next}"] h2`);
      heading?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  function validateStep(index: number) {
    const controls = formRef.current?.querySelectorAll<ValidatedControl>(`[data-form-step="${index}"] input, [data-form-step="${index}"] select, [data-form-step="${index}"] textarea`);
    const invalid = controls && Array.from(controls).find((control) => !control.checkValidity());
    if (!invalid) return true;
    setStep(index);
    requestAnimationFrame(() => {
      // A required field may be inside an optional dates disclosure.
      const disclosure = invalid.closest("details");
      if (disclosure) disclosure.open = true;
      invalid.focus();
      invalid.reportValidity();
    });
    return false;
  }
  function nextStep() {
    if (validateStep(step)) showStep(Math.min(2, step + 1));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step < 2) { nextStep(); return; }
    for (let index = 0; index < 3; index++) if (!validateStep(index)) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch(admin ? "/api/admin/managed-courses" : "/api/managed-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey, termsVersion: MANAGED_TERMS_VERSION,
          parentName: values.parentName, phone: values.phone,
          journey, className, subjectId,
          courseFormat: format, commune: values.commune || "", quartier: values.quartier || "",
          addressHint: values.addressHint || "", objective: values.objective || "",
          cadence, sessions, quotedTotal: price.total,
          accepted: !admin && values.accepted === "on", website: values.website || "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Envoi non confirmé. Réessayez avec ce formulaire.");
      if (admin) router.push(`/admin/accompagnement/${payload.id}`);
      else { setReference(payload.reference); setContractPath(payload.path || ""); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Envoi impossible.");
    } finally { setBusy(false); }
  }
  if (reference) return (
    <section className={styles.success} aria-live="polite">
      <span className={styles.successIcon}><Check size={28} aria-hidden="true" /></span>
      <h2>Bien reçu.</h2>
      <p>Notre équipe vous contacte pour organiser vos cours.</p>
      <p>Votre référence : <strong>{reference}</strong></p>
      <div className={styles.successLinks}>
        {contractPath && <a className={styles.primaryButton} href={contractPath}>Mon récapitulatif privé<ArrowRight size={16} aria-hidden="true" /></a>}
        <a className={styles.textLink} href="/contact">Contacter Compétence</a>
      </div>
    </section>
  );
  return (
    <form ref={formRef} onSubmit={submit} noValidate className={styles.form} aria-label="Demande de cours">
      <ol className={styles.stepper} aria-label="Progression de votre demande">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{step > index ? <Check size={13} aria-hidden="true" /> : index + 1}</span><span>{label}</span></li>)}
      </ol>
      <div className={styles.stepBody}>
        <section data-form-step="0" hidden={step !== 0} aria-labelledby="managed-course-heading">
          <div className={styles.stepHeading}><h2 id="managed-course-heading" tabIndex={-1}>Quel accompagnement ?</h2><p>Choisissez le parcours et la matière.</p></div>
          <div className={styles.fields}>
            <div className={styles.full}>
              <p className={styles.choiceLabel} id="managed-system-label">Système</p>
              <div className={styles.choices} role="group" aria-labelledby="managed-system-label">
                {(["ivoirien", "francais"] as const).map((value) => <button type="button" key={value} className={styles.choice} aria-pressed={journey === value} onClick={() => { setJourney(value); setSubjectId(""); }}><ManagedCountryFlag journey={value} />{value === "ivoirien" ? "Ivoirien" : "Français"}</button>)}
              </div>
            </div>
            <label className={styles.field}>Classe<select className={styles.input} value={className} onChange={(event) => { setClassName(event.target.value); setSubjectId(""); }}>{MANAGED_CLASSES.map((level) => <option key={level}>{level}</option>)}</select></label>
            <label className={styles.field}>Matière<select className={styles.input} name="subjectId" required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="" disabled>Choisir</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <div className={styles.full}>
              <p className={styles.choiceLabel} id="managed-format-label">Où se déroule le cours ?</p>
              <div className={styles.choices} role="group" aria-labelledby="managed-format-label">
                <button className={styles.choice} type="button" aria-pressed={format === "HOME"} onClick={() => setFormat("HOME")}><Home size={17} aria-hidden="true" />À domicile</button>
                <button className={styles.choice} type="button" aria-pressed={format === "ONLINE"} onClick={() => setFormat("ONLINE")}><Monitor size={17} aria-hidden="true" />En ligne</button>
              </div>
            </div>
          </div>
        </section>
        <section data-form-step="1" hidden={step !== 1} aria-labelledby="managed-sessions-heading">
          <div className={styles.stepHeading}><h2 id="managed-sessions-heading" tabIndex={-1}>À votre rythme.</h2><p>Chaque séance dure 2 heures.</p></div>
          <div className={styles.fields}>
            <label className={styles.field}>Nombre de séances<input className={styles.input} type="number" min={1} max={24} value={count} onChange={(event) => { const value = Number(event.target.value); setCount(event.target.value); if (Number.isFinite(value) && value > 0) setFrequency(Math.min(4, Math.max(1, Math.ceil(value / 4)))); setDates({}); }} required /></label>
            <label className={styles.field}>Séances par semaine<select className={styles.input} value={frequency} onChange={(event) => { setFrequency(Number(event.target.value)); setDates({}); }}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} par semaine</option>)}</select></label>
            <label className={styles.field}>Première date<input className={styles.input} type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setDates({}); }} required /></label>
            <label className={styles.field}>Heure de début<input className={styles.input} type="time" min="08:00" max="20:00" step={1800} value={time} onChange={(event) => { setTime(event.target.value); setDates({}); }} required /></label>
            <label className={`${styles.field} ${styles.full}`}>Rythme de règlement<select className={styles.input} value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="WEEKLY">Chaque semaine</option><option value="FORTNIGHTLY">Toutes les deux semaines</option><option value="MONTHLY">Chaque mois</option></select></label>
            <details className={`${styles.disclosure} ${styles.full}`}>
              <summary>Vérifier les {sessions.length} dates<ChevronDown size={15} aria-hidden="true" /></summary>
              <p>Dates proposées à raison de {frequency} séance(s) par semaine. Vous pouvez les modifier.</p>
              <div className={styles.dateRows}>{sessions.map((session, index) => <div key={index} className={styles.dateRow}><span>{index + 1}</span><input aria-label={`Date séance ${index + 1}`} className={styles.input} type="date" value={session.date} required onChange={(event) => setDates({ ...dates, [index]: { ...dates[index], date: event.target.value } })} /><input aria-label={`Heure séance ${index + 1}`} className={styles.input} type="time" min="08:00" max="20:00" step={1800} required value={session.time} onChange={(event) => setDates({ ...dates, [index]: { ...dates[index], time: event.target.value } })} /></div>)}</div>
            </details>
          </div>
        </section>
        <section data-form-step="2" hidden={step !== 2} aria-labelledby="managed-contact-heading">
          <div className={styles.stepHeading}><h2 id="managed-contact-heading" tabIndex={-1}>On vous rappelle.</h2><p>Un dernier détail pour vous accompagner.</p></div>
          <div className={styles.recap}><BookOpen size={21} aria-hidden="true" /><div>{journey === "ivoirien" ? "Ivoirien" : "Français"} · {className} · {selectedSubject?.name}<small>{sessions.length} séances de 2 h · {format === "HOME" ? "À domicile" : "En ligne"}</small></div></div>
          <div className={styles.fields}>
            <label className={styles.field}>Nom du parent<input className={styles.input} name="parentName" autoComplete="name" minLength={2} maxLength={100} required /></label>
            <label className={styles.field}>Téléphone<input className={styles.input} name="phone" autoComplete="tel" type="tel" placeholder="07 00 00 00 00" required /></label>
            {format === "HOME" && <>
              <label className={styles.field}>Commune<input className={styles.input} name="commune" maxLength={100} autoComplete="address-level2" required /></label>
              <label className={styles.field}>Quartier<input className={styles.input} name="quartier" maxLength={100} required /></label>
              <details className={`${styles.optional} ${styles.full}`}><summary>Préciser l'adresse (facultatif)<ChevronDown size={15} aria-hidden="true" /></summary><input aria-label="Indication du lieu" className={styles.input} name="addressHint" maxLength={240} /></details>
            </>}
          </div>
          <details className={styles.optional} style={{ marginTop: 20 }}><summary>Préciser un objectif (facultatif)<ChevronDown size={15} aria-hidden="true" /></summary><textarea aria-label="Objectif" name="objective" maxLength={500} className={styles.input} placeholder="Ex. reprendre confiance en mathématiques" /></details>
          <details className={styles.disclosure} style={{ marginTop: 22 }}>
            <summary>Échéancier et engagements<ChevronDown size={15} aria-hidden="true" /></summary>
            <p>Vous réglez Compétence hors ligne. Aucun supplément sans votre accord.</p>
            {installments.map((item) => <div className={styles.installment} key={item.dueDate}><span>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.dueDate}T00:00:00Z`))}</span><strong>{money(item.amount)}</strong></div>)}
            <ol className={styles.termsList}>{MANAGED_PARENT_TERMS.map((term) => <li key={term}>{term}</li>)}</ol>
          </details>
          {!admin ? <label className={styles.consent}><input name="accepted" type="checkbox" required /><span>J'accepte les dates, le montant, l'échéancier et les <a href="/engagements-accompagnement" target="_blank" rel="noopener noreferrer">conditions d'accompagnement</a>. J'ai lu la <a href="/politique-confidentialite" target="_blank" rel="noopener noreferrer">confidentialité</a>.</span></label> : <p className={styles.consent}>L'accord du parent sera recueilli par lien privé avant attribution.</p>}
        </section>
      </div>
      <div className={styles.summary} aria-live="polite" aria-atomic="true"><div><p>{validCount ? number : "—"} séances · 2 h chacune</p><small>{money(price.perSession)} / séance</small></div><strong>{validCount ? money(price.total) : "—"}</strong></div>
      <input name="website" aria-hidden="true" tabIndex={-1} autoComplete="off" hidden />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        {step > 0 && <button type="button" className={styles.secondaryButton} onClick={() => showStep(step - 1)} disabled={busy}><ArrowLeft size={16} aria-hidden="true" /><span>Retour</span></button>}
        {step < 2
          ? <button key="continue" type="button" className={styles.primaryButton} onClick={nextStep}>Continuer<ArrowRight size={17} aria-hidden="true" /></button>
          : <button key="send" type="submit" className={styles.primaryButton} disabled={busy || !validCount}>{busy ? "Enregistrement…" : admin ? "Créer le dossier parent" : "Envoyer ma demande"}<ArrowRight size={17} aria-hidden="true" /></button>}
      </div>
    </form>
  );
}
