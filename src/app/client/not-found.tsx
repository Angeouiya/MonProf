import Link from "next/link";
import { ArrowRight, Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientNotFound() {
  return (
    <section
      data-client-not-found
      className="grid min-h-[calc(100dvh-var(--app-topbar-height)-2rem)] place-items-center bg-white px-3 py-6 text-[#111827]"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[#D8DEE9] bg-white p-4 min-[560px]:p-6">
        <div className="flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              Espace client
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-[#111827] min-[560px]:text-2xl">
              Cette page client est introuvable.
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#52627A]">
              Le lien a peut-être changé ou le dossier n'est plus disponible. Vous pouvez revenir au tableau de bord ou lancer une nouvelle recherche de professeur.
            </p>

            <div className="mt-5 grid gap-2 min-[460px]:flex min-[460px]:flex-wrap">
              <Button
                asChild
                className="min-h-11 rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#111B4D]"
              >
                <Link href="/client">
                  Tableau de bord
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
              >
                <Link href="/client/rechercher">
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  Trouver un professeur
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
