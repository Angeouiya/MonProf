"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock3, Home, MonitorPlay, Search, SlidersHorizontal, Star } from "lucide-react";
import { MarketplaceMap } from "@/components/marketplace/marketplace-map";
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
  const minDate = new Date().toLocaleDateString("en-CA");
  const payload = { journey, subjectId, levelId, date, time, durationMinutes, format, commune, quartier, addressHint, objective };
  const areaLabel = format === "ONLINE" ? "Cours en ligne" : commune ? `${quartier ? `${quartier}, ` : ""}${commune}` : "Abidjan · choisissez votre quartier";

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
    <div className="mx-auto max-w-[86rem] pb-10 text-[#12243A]" data-marketplace-client>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#966B24]">Compétence · Trouver un professeur</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Un cours, simplement.</h1></div>
        <Link href="/client/demandes" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#DCE2E8] bg-white px-4 text-sm font-semibold text-[#092A55] hover:border-[#8DA4BF]">Mes demandes <ChevronRight className="h-4 w-4" /></Link>
      </div>

      <div className="mb-5 rounded-2xl border border-[#E2E7EA] bg-[#F4F6F8] p-1.5 shadow-[0_4px_22px_rgba(12,36,60,0.04)]" role="group" aria-label="Système d’enseignement">
        <div className="grid grid-cols-3 gap-1.5">
          {SYSTEMS.map((system) => <button key={system.value} type="button" aria-pressed={journey === system.value} onClick={() => { setJourney(system.value); setSubjectId(""); setLevelId(""); setCandidates(null); setStep(0); setError(""); }} className={`min-h-12 rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${journey === system.value ? "bg-white text-[#092A55] shadow-[0_2px_10px_rgba(9,42,85,0.12)]" : "bg-transparent text-[#40516A] hover:bg-white"}`}>{system.label}</button>)}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-[#DCE2E8] bg-[#F4F6F7] shadow-[0_14px_50px_rgba(10,39,68,0.09)] lg:grid lg:min-h-[690px] lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <div className="relative h-[310px] sm:h-[410px] lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-[690px]">
          <MarketplaceMap key={format} format={format} areaLabel={areaLabel} />
          {candidates !== null && format === "HOME" && <p className="absolute bottom-4 left-4 right-4 w-fit max-w-[calc(100%-2rem)] rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-[#33485E] shadow-sm">Les profils sont classés par zone, disponibilité et adéquation. Leur position en direct n’est pas partagée.</p>}
        </div>

        <section className="relative z-10 -mt-8 rounded-t-[1.75rem] bg-white px-5 pb-7 pt-5 shadow-[0_-8px_24px_rgba(10,39,68,0.08)] sm:px-7 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:rounded-none lg:border-l lg:border-[#E2E7EA] lg:pb-8 lg:shadow-none" aria-label={candidates === null ? "Préparer mon cours" : "Professeurs compatibles"}>
          <div aria-hidden="true" className="mx-auto mb-5 h-1 w-11 rounded-full bg-[#D6DDE4] lg:hidden" />
          {candidates === null ? <>
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#966B24]">Étape {step + 1} sur 3</p><h2 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.035em]">{step === 0 ? "Quel cours cherchez-vous ?" : step === 1 ? "Quand souhaitez-vous apprendre ?" : "Où aura lieu le cours ?"}</h2></div><span className="rounded-full bg-[#F1F4F7] p-2.5 text-[#092A55]">{step === 0 ? <Search className="h-5 w-5" /> : step === 1 ? <CalendarDays className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}</span></div>
            <div aria-label="Progression de la recherche" className="mt-5 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((item) => <span key={item} className={`h-1 rounded-full ${item <= step ? "bg-[#092A55]" : "bg-[#E3E7EB]"}`} />)}</div>
            <div className="mt-6 grid grid-cols-2 gap-2" role="group" aria-label="Format du cours">
              <button type="button" aria-pressed={format === "HOME"} onClick={() => setFormat("HOME")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold ${format === "HOME" ? "border-[#092A55] bg-[#EDF3F7] text-[#092A55]" : "border-[#DCE2E8] bg-white text-[#536278]"}`}><Home className="h-4 w-4" /> À domicile</button>
              <button type="button" aria-pressed={format === "ONLINE"} onClick={() => setFormat("ONLINE")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold ${format === "ONLINE" ? "border-[#092A55] bg-[#EDF3F7] text-[#092A55]" : "border-[#DCE2E8] bg-white text-[#536278]"}`}><MonitorPlay className="h-4 w-4" /> En ligne</button>
            </div>
            {step === 0 && <div className="mt-6 space-y-4">
              <Field label={journey === "professionnel" ? "Compétence recherchée" : "Matière"}><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={fieldClass} required><option value="">Choisir une matière</option>{catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
              <Field label={journey === "professionnel" ? "Profil" : "Niveau / classe"}><select value={levelId} onChange={(event) => setLevelId(event.target.value)} className={fieldClass} required><option value="">Choisir un niveau</option>{catalog.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
            </div>}
            {step === 1 && <div className="mt-6 space-y-4">
              <Field label="Date du cours"><input type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} required /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Heure"><input type="time" min="08:00" max="21:00" step={1800} value={time} onChange={(event) => setTime(event.target.value)} className={fieldClass} required /></Field><Field label="Durée"><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value) as 60 | 120)} className={fieldClass}><option value={120}>2 heures</option><option value={60}>1 heure</option></select></Field></div>
              <p className="flex items-center gap-2 text-xs text-[#536278]"><Clock3 className="h-4 w-4" /> 1 ou 2 heures : le prix du cours reste identique.</p>
            </div>}
            {step === 2 && <div className="mt-6 space-y-4">
              {format === "HOME" && <><Field label="Commune du cours"><select value={commune} onChange={(event) => { setCommune(event.target.value); setQuartier(""); }} className={fieldClass} required><option value="">Choisir la commune</option>{communes.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></Field><Field label="Quartier du cours"><input value={quartier} onChange={(event) => setQuartier(event.target.value)} maxLength={100} placeholder="Ex. Angré" className={fieldClass} required /></Field><Field label="Adresse ou repère" optional><input value={addressHint} onChange={(event) => setAddressHint(event.target.value)} maxLength={240} placeholder="Ex. près de la pharmacie" className={fieldClass} /></Field></>}
              <Field label="Votre objectif" optional><input value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={800} placeholder="Ex. préparer le prochain devoir" className={fieldClass} /></Field>
            </div>}
            {error && <p role="alert" className="mt-5 rounded-xl border border-[#E5C1C1] bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
            <div className="mt-7 flex gap-2">{step > 0 && <button type="button" onClick={() => { setStep(step === 2 ? 1 : 0); setError(""); }} className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-[#DCE2E8] px-4 text-sm font-semibold text-[#092A55]"><ArrowLeft className="h-4 w-4" /> Retour</button>}<button type="button" onClick={step === 2 ? search : nextStep} disabled={loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white transition hover:bg-[#123B72] disabled:opacity-60">{loading ? "Recherche en cours…" : step === 2 ? "Rechercher un professeur" : "Continuer"}{!loading && <ArrowRight className="h-4 w-4" />}</button></div>
            <p className="mt-4 text-center text-xs text-[#617083]">{format === "HOME" ? "Le lieu exact se partage après acceptation du cours." : "Les modalités du cours en ligne se conviennent après acceptation."}</p>
          </> : <>
            <button type="button" onClick={() => { setCandidates(null); setError(""); }} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#526174] hover:text-[#092A55]"><ArrowLeft className="h-4 w-4" /> Modifier ma recherche</button>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{candidates.length ? "Professeurs pour vous" : "Aucun professeur disponible"}</h2>
            <p className="mt-1 text-sm text-[#526174]">{SYSTEMS.find((item) => item.value === journey)?.label} · {areaLabel} · {date} à {time}</p>
            {candidates.length === 0 ? <div className="mt-6 rounded-xl border border-[#DCE2E8] bg-[#F7F9FA] p-5 text-sm leading-6 text-[#526174]">Essayez une autre heure ou un autre quartier. Vous pouvez modifier votre recherche sans tout recommencer.</div> : <>
              <div className="mt-5 max-h-[300px] space-y-2 overflow-y-auto pr-1" aria-label="Liste des professeurs compatibles">{candidates.map((teacher, index) => <button key={teacher.teacherId} type="button" aria-pressed={selectedTeacher?.teacherId === teacher.teacherId} onClick={() => setSelected(teacher.teacherId)} className={`flex min-h-20 w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedTeacher?.teacherId === teacher.teacherId ? "border-[#092A55] bg-[#F1F5F8]" : "border-[#E3E7EB] bg-white hover:border-[#8DA4BF]"}`}><ProfessorImage photoUrl={teacher.photoUrl} name={teacher.name} size={50} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{teacher.name}</strong><span className="mt-1 block text-xs text-[#526174]">{teacher.proximity === "quartier" ? "Dans votre quartier" : teacher.proximity === "commune" ? "Dans votre commune" : teacher.proximity === "en_ligne" ? "Cours en ligne" : "Autre commune"}</span><span className="mt-1 flex items-center gap-1 text-xs text-[#9A6A10]"><Star className="h-3.5 w-3.5 fill-current" />{teacher.ratingCount ? `${teacher.rating.toFixed(1)} · ${teacher.ratingCount} avis` : "Nouveau profil"}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-bold text-[#092A55]">{money(teacher.totalClientPrice)}</span><span className="mt-1 block text-[11px] text-[#526174]">{index === 0 ? "Recommandé" : "Disponible"}</span></span></button>)}</div>
              {selectedTeacher && <div className="mt-5 rounded-2xl border border-[#DCE2E8] bg-white p-4"><div className="flex items-center gap-3"><ProfessorImage photoUrl={selectedTeacher.photoUrl} name={selectedTeacher.name} size={48} /><div><strong className="block text-sm">{selectedTeacher.name}</strong><span className="text-xs text-[#526174]">Votre choix · réponse du professeur attendue</span></div></div><div className="mt-4 space-y-2 border-t border-[#E3E7EB] pt-4 text-sm"><PriceLine label="Cours" amount={selectedTeacher.courseAmount} /><PriceLine label="Déplacement" amount={selectedTeacher.transportFee} /><PriceLine label="Total estimé à régler" amount={selectedTeacher.totalClientPrice} strong /></div><p className="mt-3 text-xs leading-5 text-[#526174]">Le professeur peut accepter ou refuser. En cas de refus, un autre profil compatible pourra être sollicité.</p>{error && <p role="alert" className="mt-3 rounded-xl bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}<button type="button" onClick={propose} disabled={submitting} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#092A55] px-4 text-sm font-semibold text-white transition hover:bg-[#123B72] disabled:opacity-60">{submitting ? "Envoi en cours…" : "Proposer le cours"}<ArrowRight className="h-4 w-4" /></button></div>}
            </>}
          </>}
        </section>
      </div>
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
