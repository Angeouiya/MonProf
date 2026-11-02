"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin, Search, Star } from "lucide-react";
import { ProfessorImage } from "@/components/shared/professor-image";
import type { MarketplaceCandidate } from "@/lib/marketplace-search";
import type { TeacherJourney } from "@/lib/teacher-journeys";

type Catalog = { subjects: { id: string; name: string }[]; levels: { id: string; name: string }[] };
type Props = {
  catalogs: Record<TeacherJourney, Catalog>;
  communes: { name: string }[];
};

const SYSTEMS: { value: TeacherJourney; label: string }[] = [
  { value: "ivoirien", label: "Ivoirien" },
  { value: "francais", label: "Français" },
  { value: "professionnel", label: "Professionnel" },
];

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} F`;

export function ClientMarketplaceSearch({ catalogs, communes }: Props) {
  const router = useRouter();
  const [journey, setJourney] = useState<TeacherJourney>("ivoirien");
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [subjectId, setSubjectId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [durationMinutes, setDurationMinutes] = useState<60 | 120>(120);
  const [format, setFormat] = useState<"HOME" | "ONLINE">("HOME");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [addressHint, setAddressHint] = useState("");
  const [objective, setObjective] = useState("");
  const [candidates, setCandidates] = useState<MarketplaceCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef("");
  const catalog = catalogs[journey];
  const selectedTeacher = useMemo(() => candidates?.find((item) => item.teacherId === selected) ?? candidates?.[0] ?? null, [candidates, selected]);
  const minDate = new Date().toISOString().slice(0, 10);
  const payload = { journey, subjectId, levelId, date, time, durationMinutes, format, commune, quartier, addressHint, objective };

  function nextStep() {
    setError("");
    if (step === 0 && (!subjectId || !levelId)) {
      setError("Choisissez la matière et le niveau du cours.");
      return;
    }
    if (step === 1 && !date) {
      setError("Choisissez la date et l’heure du cours.");
      return;
    }
    setStep(step === 0 ? 1 : 2);
  }

  async function search() {
    setError("");
    if (!subjectId || !levelId || !date || (format === "HOME" && (!commune || !quartier.trim()))) {
      setError("Renseignez la matière, le niveau, la date et le lieu du cours.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/marketplace/search", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Recherche impossible.");
      requestKey.current = "";
      setCandidates(result.candidates);
      setSelected(result.candidates[0]?.teacherId ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recherche impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function propose() {
    if (!selectedTeacher) return;
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/marketplace/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, teacherId: selectedTeacher.teacherId, clientKey: requestKey.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Demande impossible.");
      router.push(`/client/demandes/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demande impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl bg-white px-4 pb-12 pt-5 text-[#12243A] sm:px-7 sm:pt-8" data-marketplace-client>
      {candidates === null ? (
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#9A6A10]">Compétence<span className="hidden sm:inline"> · votre prochain cours</span></p><span className="whitespace-nowrap text-xs font-semibold text-[#526174]">0{step + 1} / 03</span></div>
          <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">{step === 0 ? "Quel cours vous faut-il ?" : step === 1 ? "À quel moment ?" : "Où se déroule le cours ?"}</h1>
          <p className="mt-3 text-sm leading-6 text-[#526174]">{step === 0 ? "Choisissez votre système, la matière et le niveau." : step === 1 ? "Fixez la date et l’heure qui vous conviennent." : "Une dernière précision, puis découvrez les professeurs disponibles."}</p>
          <div aria-label="Progression de la recherche" className="mt-7 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((item) => <span key={item} className={`h-1 rounded-full ${item <= step ? "bg-[#092A55]" : "bg-[#E3E7EB]"}`} />)}</div>

          {step === 0 && <div className="mt-8">
            <span className="text-sm font-semibold">Système</span>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-[#DCE2E8] bg-[#F6F7F6] p-1" role="group" aria-label="Système d’enseignement">
              {SYSTEMS.map((system) => (
                <button key={system.value} type="button" aria-pressed={journey === system.value}
                  onClick={() => { setJourney(system.value); setSubjectId(""); setLevelId(""); }}
                  className={`min-h-12 rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${journey === system.value ? "bg-white text-[#092A55] shadow-sm" : "text-[#526174] hover:text-[#092A55]"}`}>
                  {system.label}
                </button>
              ))}
            </div>
          </div>}

          {step === 0 && <div className="mt-8 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label={journey === "professionnel" ? "Compétence" : "Matière"}>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={fieldClass} required>
                <option value="">Choisir</option>
                {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </Field>
            <Field label={journey === "professionnel" ? "Profil" : "Niveau / classe"}>
              <select value={levelId} onChange={(event) => setLevelId(event.target.value)} className={fieldClass} required>
                <option value="">Choisir</option>
                {catalog.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </Field>
          </div>}
          {step === 1 && <div className="mt-8 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label="Date">
              <input type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} required />
            </Field>
            <Field label="Heure">
              <input type="time" min="08:00" max="21:00" step={1800} value={time} onChange={(event) => setTime(event.target.value)} className={fieldClass} required />
            </Field>
            <Field label="Durée">
              <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value) as 60 | 120)} className={fieldClass}>
                <option value={120}>2 heures</option><option value={60}>1 heure · même tarif</option>
              </select>
            </Field>
          </div>}
          {step === 2 && <div className="mt-8 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label="Format">
              <select value={format} onChange={(event) => setFormat(event.target.value as "HOME" | "ONLINE")} className={fieldClass}>
                <option value="HOME">À domicile</option><option value="ONLINE">En ligne</option>
              </select>
            </Field>
            {format === "HOME" && (
              <>
                <Field label="Commune du cours">
                  <select value={commune} onChange={(event) => { setCommune(event.target.value); setQuartier(""); }} className={fieldClass} required>
                    <option value="">Choisir</option>
                    {communes.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Quartier du cours">
                  <input value={quartier} onChange={(event) => setQuartier(event.target.value)} maxLength={100} placeholder="Ex. Angré" className={fieldClass} required />
                </Field>
                <Field label="Adresse ou repère" optional>
                  <input value={addressHint} onChange={(event) => setAddressHint(event.target.value)} maxLength={240} placeholder="Précision donnée après acceptation" className={fieldClass} />
                </Field>
              </>
            )}
            <Field label="Votre besoin" optional>
              <input value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={800} placeholder="Ex. Préparer le prochain devoir" className={fieldClass} />
            </Field>
          </div>
          }
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#E5C1C1] bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {step > 0 && <button type="button" onClick={() => { setStep(step === 2 ? 1 : 0); setError(""); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#DCE2E8] px-5 text-sm font-semibold text-[#092A55]"><ArrowLeft className="h-4 w-4" />Retour</button>}
            <button type="button" onClick={step === 2 ? search : nextStep} disabled={loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#092A55] px-6 text-sm font-semibold text-white transition hover:bg-[#123B72] disabled:opacity-60 sm:flex-none">
              {step === 2 ? <Search className="h-4 w-4" /> : null}{loading ? "Recherche en cours…" : step === 2 ? "Voir les professeurs" : "Continuer"}{step < 2 && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" onClick={() => { setCandidates(null); setError(""); }} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#526174] hover:text-[#092A55]"><ArrowLeft className="h-4 w-4" />Modifier la recherche</button>
              <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Vos professeurs disponibles</h1>
              <p className="mt-2 text-sm text-[#526174]">{candidates.length} profil{candidates.length > 1 ? "s" : ""} compatible{candidates.length > 1 ? "s" : ""} · {SYSTEMS.find((item) => item.value === journey)?.label} · {format === "HOME" ? `${quartier}, ${commune}` : "En ligne"}</p>
            </div>
            <Link href="/client/demandes" className="text-sm font-semibold text-[#092A55] underline underline-offset-4">Mes demandes</Link>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-2">
              {candidates.length === 0 ? (
                <div className="rounded-2xl border border-[#DCE2E8] p-6 text-sm text-[#526174]">
                  Aucun professeur disponible à cet horaire. Essayez une autre heure ou un autre quartier.
                </div>
              ) : candidates.map((teacher, index) => (
                <button key={teacher.teacherId} type="button" aria-pressed={selectedTeacher?.teacherId === teacher.teacherId}
                  onClick={() => setSelected(teacher.teacherId)}
                  className={`flex min-h-24 w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-[#8DA4BF] ${selectedTeacher?.teacherId === teacher.teacherId ? "border-[#092A55] shadow-[0_4px_16px_rgba(9,42,85,0.08)]" : "border-[#E3E7EB]"}`}>
                  <ProfessorImage photoUrl={teacher.photoUrl} name={teacher.name} size={54} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold">{teacher.name}</strong>
                    <span className="mt-1 block text-xs text-[#526174]">{teacher.proximity === "quartier" ? "Même quartier" : teacher.proximity === "commune" ? "Même commune" : teacher.proximity === "en_ligne" ? "En ligne" : "Autre commune"}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-[#9A6A10]"><Star className="h-3.5 w-3.5 fill-current" />{teacher.ratingCount ? `${teacher.rating.toFixed(1)} · ${teacher.ratingCount} avis` : "Nouveau professeur"}</span>
                  </span>
                  <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{money(teacher.totalClientPrice)}</span><span className="mt-1 block text-[11px] text-[#526174]">{index === 0 ? "Recommandé" : "Disponible"}</span></span>
                </button>
              ))}
            </div>

            <div className="lg:sticky lg:top-5 lg:self-start">
              <div className="relative min-h-52 overflow-hidden rounded-2xl border border-[#DCE2E8] bg-[#F1F4F1] p-5 sm:min-h-60">
                <div className="relative z-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#395364]"><MapPin className="h-4 w-4" />Secteur du cours</div>
                <div className="relative z-10 mt-7 text-2xl font-semibold tracking-[-0.03em]">{format === "HOME" ? quartier : "Cours en ligne"}</div>
                <div className="relative z-10 mt-1 text-sm text-[#526174]">{format === "HOME" ? commune : "Aucun déplacement"}</div>
                <div className="relative z-10 mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#395364]">Position exacte du professeur non affichée</div>
                <span aria-hidden="true" className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full border-[30px] border-white/75" />
                <span aria-hidden="true" className="absolute -right-14 top-6 h-40 w-96 rotate-[-23deg] border-y-[9px] border-white/75" />
              </div>
              {selectedTeacher && (
                <div className="mt-4 rounded-2xl border border-[#DCE2E8] bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-3"><ProfessorImage photoUrl={selectedTeacher.photoUrl} name={selectedTeacher.name} size={52} /><div><strong className="block text-base">{selectedTeacher.name}</strong><span className="text-xs text-[#526174]">Votre professeur proposé</span></div></div>
                  <div className="mt-5 space-y-3 border-t border-[#E3E7EB] pt-5 text-sm">
                    <PriceLine label="Cours" amount={selectedTeacher.courseAmount} />
                    <PriceLine label="Déplacement" amount={selectedTeacher.transportFee} />
                    <PriceLine label="Total estimé à régler au professeur" amount={selectedTeacher.totalClientPrice} strong />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#526174]">Le professeur reçoit votre demande et choisit de l’accepter ou de la refuser. En cas de refus, nous proposons le cours à un autre profil sans augmenter ce total.</p>
                  {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
                  <button type="button" onClick={propose} disabled={submitting} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#092A55] px-4 text-sm font-semibold text-white transition hover:bg-[#123B72] disabled:opacity-60">
                    {submitting ? "Envoi en cours…" : "Proposer ce cours"}<ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-[#DCE2E8] bg-white px-3.5 text-base text-[#12243A] outline-none transition focus:border-[#092A55] focus:ring-2 focus:ring-[#CFDAE5]";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-[#12243A]">{label}{optional && <span className="ml-1 font-normal text-[#6A7786]">· facultatif</span>}{children}</label>;
}

function PriceLine({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return <div className={`flex items-baseline justify-between gap-4 ${strong ? "border-t border-[#E3E7EB] pt-4 font-semibold text-[#12243A]" : "text-[#526174]"}`}><span>{label}</span><span className="whitespace-nowrap text-[#12243A]">{money(amount)}</span></div>;
}
