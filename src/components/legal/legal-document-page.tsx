import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";

export type LegalSection = {
  title: string;
  body: string[];
  bullets?: string[];
};

export function LegalDocumentPage({
  eyebrow,
  title,
  description,
  version,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  version: string;
  sections: LegalSection[];
}) {
  return (
    <PublicLayout>
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-6">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {eyebrow}
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[#111827] text-balance sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[#475569] sm:text-base">
              {description}
            </p>
            <div className="mt-5 flex flex-col gap-2 rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm font-semibold text-[#111B4D] sm:flex-row sm:items-center sm:justify-between">
              <span>Version applicable : {version}</span>
              <span>Plateforme Compétence - Côte d'Ivoire</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {sections.map((section, index) => (
              <article key={section.title} className="rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Article {index + 1}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-normal text-[#111827]">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm font-medium leading-7 text-[#475569]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {!!section.bullets?.length && (
                  <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#111827]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2 rounded-lg border border-[#E6EAF3] bg-white p-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#111B4D]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm font-semibold text-[#111827] sm:grid-cols-2">
            <Link href="/conditions-utilisation" className="inline-flex min-h-12 items-center justify-between rounded-lg border border-[#E3E8F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D]">
              Conditions générales d'utilisation
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/politique-confidentialite" className="inline-flex min-h-12 items-center justify-between rounded-lg border border-[#E3E8F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D]">
              Politique de confidentialité
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
