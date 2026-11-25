import { BrandLogo } from "@/components/shared/brand-logo";
export function ManagedPublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-[#12243A]">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="/">
            <BrandLogo />
          </a>
          <nav aria-label="Navigation parents et clients" className="flex flex-wrap gap-4 text-sm font-semibold">
            <a href="/demande-cours">Demander un cours</a>
            <a href="/tarifs">Tarifs</a>
            <a href="/contact">Nous contacter</a>
            <a href="/client">Mon espace client</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-9 sm:py-14">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t border-slate-200 px-4 py-7 text-sm">
        <a href="/engagements-accompagnement">
          Conditions d'accompagnement
        </a>
        <a href="/conditions-utilisation">CGU</a>
        <a href="/politique-confidentialite">Confidentialité</a>
        <a href="/client/reservations">Mes anciens cours</a>
      </footer>
    </div>
  );
}
