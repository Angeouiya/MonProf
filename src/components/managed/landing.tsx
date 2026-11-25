import { ManagedPublicShell } from "./public-shell";
import {
  MANAGED_CLASSES,
  MANAGED_MONTHLY_PRICES,
} from "@/lib/managed-courses-core";
export function ManagedLanding() {
  return (
    <ManagedPublicShell>
      <section className="mx-auto max-w-3xl py-12 text-center sm:py-20">
        <p className="text-sm font-semibold text-slate-600">
          À domicile ou en ligne · Compétence.CI
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Le bon accompagnement.
          <br />
          Nous organisons le reste.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
          Décrivez votre besoin en quelques instants. Notre équipe vous contacte
          et vous attribue un professeur adapté.
        </p>
        <a
          className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-[#092A55] bg-white px-7 font-semibold text-[#092A55]"
          href="/demande-cours"
        >
          Demander un cours
        </a>
        <p className="mt-4 text-sm text-slate-600">
          Sans compte · Sans paiement en ligne · Séances de 2 heures
        </p>
      </section>
      <section className="grid gap-5 border-t border-slate-200 pt-8 sm:grid-cols-3">
        {[
          ["1", "Votre besoin", "Classe, matière, dates et nombre de séances."],
          [
            "2",
            "Votre professeur",
            "Compétence organise et confirme l'accompagnement.",
          ],
          [
            "3",
            "Votre rythme",
            "Vous réglez Compétence chaque semaine, quinzaine ou mois, selon l'accord accepté.",
          ],
        ].map(([step, title, text]) => (
          <article
            key={step}
            className="rounded-2xl border border-slate-200 p-6"
          >
            <span className="text-sm text-slate-500">{step}</span>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className="mt-2 leading-7 text-slate-600">{text}</p>
          </article>
        ))}
      </section>
    </ManagedPublicShell>
  );
}
export function ManagedTariffs() {
  return (
    <ManagedPublicShell>
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold">Des tarifs clairs.</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Base de 4 séances de deux heures. Pour 6, 8 séances ou plus, le
          montant est proportionnel au nombre choisi.
        </p>
      </header>
      <div className="mt-9 grid gap-6 md:grid-cols-2">
        {(["ivoirien", "francais"] as const).map((journey) => (
          <section
            className="rounded-2xl border border-slate-200 p-5 sm:p-7"
            key={journey}
          >
            <h2 className="text-2xl font-semibold">
              Système {journey === "ivoirien" ? "ivoirien" : "français"}
            </h2>
            <table className="mt-5 w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3">Classe</th>
                  <th className="py-3 text-right">4 séances</th>
                  <th className="py-3 text-right">8 séances</th>
                </tr>
              </thead>
              <tbody>
                {MANAGED_CLASSES.map((level, index) => (
                  <tr className="border-b border-slate-100" key={level}>
                    <th className="py-4 font-medium">{level}</th>
                    <td className="py-4 text-right tabular-nums">
                      {MANAGED_MONTHLY_PRICES[journey][index].toLocaleString(
                        "fr-FR",
                      )}{" "}
                      F
                    </td>
                    <td className="py-4 text-right tabular-nums">
                      {(
                        MANAGED_MONTHLY_PRICES[journey][index] * 2
                      ).toLocaleString("fr-FR")}{" "}
                      F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <p className="mt-7 text-sm leading-7 text-slate-600">
        Le parent règle Compétence hors ligne. Tout supplément ou tarif
        particulier doit être proposé et accepté avant engagement. Pour le
        primaire ou une formation professionnelle,{" "}
        <a className="underline" href="/contact">
          contactez notre équipe
        </a>
        .
      </p>
      <a
        className="mt-6 inline-block rounded-xl border-2 border-[#092A55] px-6 py-3 font-semibold"
        href="/demande-cours"
      >
        Préparer ma demande
      </a>
    </ManagedPublicShell>
  );
}
