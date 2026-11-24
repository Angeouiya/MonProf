import Link from "next/link";
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
          <Link href="/">
            <BrandLogo />
          </Link>
          <nav aria-label="Navigation parents et clients" className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/demande-cours">Demander un cours</Link>
            <Link href="/tarifs">Tarifs</Link>
            <Link href="/contact">Nous contacter</Link>
            <Link href="/client">Mon espace client</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-9 sm:py-14">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t border-slate-200 px-4 py-7 text-sm">
        <Link href="/engagements-accompagnement">
          Conditions d'accompagnement
        </Link>
        <Link href="/conditions-utilisation">CGU</Link>
        <Link href="/politique-confidentialite">Confidentialité</Link>
        <Link href="/client/reservations">Mes anciens cours</Link>
      </footer>
    </div>
  );
}
