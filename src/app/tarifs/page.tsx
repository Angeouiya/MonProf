import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { formatFCFA } from "@/lib/format";
import {
  OFFICIAL_ACADEMIC_PRICING,
  PROFESSIONAL_SESSION_PRICE,
} from "@/lib/service-offers";

export const metadata = {
  title: "Tarifs officiels | Compétence",
  description: "Tarifs des cours du système ivoirien, du système français et des formations professionnelles.",
};

const TABLES = [
  {
    key: "ivoirien" as const,
    title: "Système ivoirien",
    description: "Tarif par séance de 2 heures.",
  },
  {
    key: "francais" as const,
    title: "Système français",
    description: "Tarif par séance de 2 heures.",
  },
];

export default function TarifsPage() {
  return (
    <PublicLayout>
      <section className="border-b border-[#E5E8F0] bg-[#F7F8FC]">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#111B4D]">Grille officielle</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-5xl">Des tarifs simples et connus à l’avance.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#64748B]">
            Le professeur n’affiche aucun prix personnel. Le tarif dépend uniquement du parcours et de la classe choisis.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-2">
            {TABLES.map((table) => (
              <article key={table.key} className="overflow-hidden rounded-2xl border border-[#DDE2EC] bg-white">
                <div className="border-b border-[#E5E8F0] bg-[#F7F8FC] p-5 sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111B4D] text-white">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-[#111827]">{table.title}</h2>
                  <p className="mt-1 text-sm text-[#64748B]">{table.description}</p>
                </div>
                <dl className="divide-y divide-[#E5E8F0] px-5 sm:px-6">
                  {OFFICIAL_ACADEMIC_PRICING[table.key].map((price) => (
                    <div key={price.key} className="flex items-center justify-between gap-4 py-4">
                      <dt className="font-medium text-[#596579]">{price.label}</dt>
                      <dd className="text-lg font-semibold tabular-nums text-[#111827]">{formatFCFA(price.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <article className="mt-5 flex flex-col gap-5 rounded-2xl border border-[#DDE2EC] bg-[#111B4D] p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#111B4D]">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#CCD4E7]">Compétences & métiers</p>
                <h2 className="mt-2 text-2xl font-semibold">Formation professionnelle</h2>
                <p className="mt-1 text-sm leading-6 text-[#DDE3F2]">Un tarif unique, quelle que soit la compétence choisie.</p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-sm font-medium text-[#CCD4E7]">1 séance</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{formatFCFA(PROFESSIONAL_SESSION_PRICE)}</p>
            </div>
          </article>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#DDE2EC] p-5 sm:p-6">
              <MapPin className="h-5 w-5 text-[#111B4D]" />
              <h2 className="mt-4 text-lg font-semibold text-[#111827]">Cours à domicile</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                Les frais de transport sont calculés séparément selon la localisation du professeur et l’adresse du cours. Le montant exact apparaît avant le paiement.
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE2EC] p-5 sm:p-6">
              <ShieldCheck className="h-5 w-5 text-[#111B4D]" />
              <h2 className="mt-4 text-lg font-semibold text-[#111827]">Total transparent</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                La plateforme affiche le cours, le transport éventuel et les frais de paiement avant toute validation. Aucun prix n’est négocié sur le profil du professeur.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/professeurs" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#111B4D] px-6 text-sm font-semibold text-white hover:bg-[#1E2A78]">
              Choisir un professeur <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
