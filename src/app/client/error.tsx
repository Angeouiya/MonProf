"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      data-client-error
      className="grid min-h-[calc(100dvh-var(--app-topbar-height)-2rem)] place-items-center bg-white px-3 py-6 text-[#111827]"
      aria-live="polite"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[#D8DEE9] bg-white p-4 min-[560px]:p-6">
        <div className="flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              Espace client
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-[#111827] min-[560px]:text-2xl">
              Cette page n'a pas pu s'afficher correctement.
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#52627A]">
              Vos réservations, paiements et demandes restent sécurisés. Réessayez l'affichage ou revenez au tableau de bord client.
            </p>

            {error.digest && (
              <p className="mt-3 w-fit rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-semibold text-[#64748B]">
                Référence incident : {error.digest}
              </p>
            )}

            <div className="mt-5 grid gap-2 min-[460px]:flex min-[460px]:flex-wrap">
              <Button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#111B4D]"
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Réessayer
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
              >
                <Link href="/client">
                  Tableau de bord
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
