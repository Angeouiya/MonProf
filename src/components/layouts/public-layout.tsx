"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shared/back-button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

const navLinks = [
  { href: "/professeurs", label: "Trouver un professeur" },
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

const footerPlatformLinks = [
  { href: "/professeurs", label: "Trouver un professeur" },
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

const footerAccountLinks = [
  { href: "/connexion", label: "Connexion" },
  { href: "/inscription", label: "Créer un compte" },
  { href: "/client", label: "Espace client" },
];

const trustSignals = [
  { icon: ShieldCheck, label: "Professeurs vérifiés" },
  { icon: CalendarCheck, label: "Séances de 2h" },
  { icon: WalletCards, label: "Paiement sécurisé" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isClient = (session?.user as any)?.role === "CLIENT";

  return (
    <div className="public-shell flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 w-full border-b border-[#E3E8F2] bg-white shadow-sm">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-1.5 transition hover:bg-white"
            onClick={() => setMobileOpen(false)}
          >
            <Image src="/logo.svg" alt="MonProf CI" width={140} height={28} priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-bold transition-colors",
                  pathname?.startsWith(link.href)
                    ? "border border-[#DDE6F7] bg-white text-[#111B4D] shadow-sm"
                    : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isClient && (
              <Button asChild variant="outline" className="min-h-11 rounded-2xl border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/client">
                  <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline" className="min-h-11 rounded-2xl border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/admin">Admin</Link>
              </Button>
            )}
            {!session && (
              <Button asChild variant="ghost" className="min-h-11 rounded-2xl px-4 text-[#111827] hover:bg-white hover:text-[#111B4D] hover:shadow-sm">
                <Link href="/connexion">Connexion</Link>
              </Button>
            )}
            {!session && (
              <Button asChild className="min-h-11 rounded-2xl bg-[#111B4D] px-5 text-white shadow-sm hover:bg-[#1E2A78]">
                <Link href="/inscription">
                  Créer un compte
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
            {session && !isAdmin && !isClient && (
              <Button asChild variant="ghost" className="min-h-11 rounded-2xl px-4 text-[#111827] hover:bg-white hover:text-[#111B4D] hover:shadow-sm">
                <Link href="/connexion">Connexion</Link>
              </Button>
            )}
          </div>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#CAD7F2] bg-white text-[#111B4D] shadow-sm transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#E3E8F2] bg-white shadow-sm lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
              <Link
                href="/professeurs"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-14 items-center justify-between rounded-3xl border border-[#CAD7F2] bg-[#111B4D] px-4 text-sm font-black text-white shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Trouver un professeur
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "inline-flex min-h-12 items-center rounded-2xl px-4 text-sm font-bold transition",
                    pathname?.startsWith(link.href)
                      ? "border border-[#DDE6F7] bg-white text-[#111B4D]"
                      : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-2 rounded-3xl border border-[#E3E8F2] bg-white p-3 min-[430px]:grid-cols-3">
                {trustSignals.map((signal) => {
                  const Icon = signal.icon;
                  return (
                    <div key={signal.label} className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-[#111B4D] shadow-sm">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{signal.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-col gap-2 border-t border-[#E3E8F2] pt-3">
                {isClient && (
                  <Button asChild variant="outline" className="min-h-12 w-full rounded-2xl border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                    <Link href="/client" onClick={() => setMobileOpen(false)}>
                      <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                    </Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild variant="outline" className="min-h-12 w-full rounded-2xl border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                    <Link href="/admin" onClick={() => setMobileOpen(false)}>Admin</Link>
                  </Button>
                )}
                {!session && (
                  <>
                    <Button asChild variant="outline" className="min-h-12 w-full rounded-2xl border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                      <Link href="/connexion" onClick={() => setMobileOpen(false)}>Connexion</Link>
                    </Button>
                    <Button asChild className="min-h-12 w-full rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                      <Link href="/inscription" onClick={() => setMobileOpen(false)}>
                        Créer un compte
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {pathname !== "/" && (
        <div className="border-b border-[#E3E8F2] bg-white">
          <div className="mx-auto flex max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            <BackButton fallbackHref="/" />
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mb-8 rounded-[1.6rem] border border-[#DDE6F7] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-black text-[#111B4D]">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  MonProf CI
                </p>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#475569]">
                  Une plateforme ivoirienne pensée pour réserver un professeur, payer proprement et suivre chaque cours depuis un espace client clair.
                </p>
              </div>
              <Button asChild className="min-h-12 rounded-2xl bg-[#111B4D] px-5 text-white hover:bg-[#1E2A78]">
                <Link href="/professeurs">
                  Trouver un professeur
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-7 md:grid-cols-[1.1fr_0.75fr_0.75fr_1fr]">
            <div>
              <Image src="/logo.svg" alt="MonProf CI" width={140} height={28} />
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-[#64748B]">
                Plateforme ivoirienne de réservation de cours à domicile et en ligne, avec des professeurs vérifiés et un paiement sécurisé.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {trustSignals.map((signal) => {
                  const Icon = signal.icon;
                  return (
                    <span key={signal.label} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DDE6F7] bg-white px-3 text-xs font-black text-[#111B4D]">
                      <Icon className="h-3.5 w-3.5" />
                      {signal.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#111827]">Plateforme</h4>
              <ul className="mt-3 space-y-1 text-sm">
                {footerPlatformLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 font-semibold text-[#64748B] transition hover:text-[#111B4D]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#111827]">Compte</h4>
              <ul className="mt-3 space-y-1 text-sm">
                {footerAccountLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 font-semibold text-[#64748B] transition hover:text-[#111B4D]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#111827]">Contact</h4>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-[#64748B]">
                <li className="flex min-h-10 items-center gap-2"><Phone className="h-4 w-4 text-[#111B4D]" /> +225 27 22 00 00 00</li>
                <li className="flex min-h-10 items-center gap-2"><Mail className="h-4 w-4 text-[#111B4D]" /> support@monprof.ci</li>
                <li className="flex min-h-10 items-center gap-2"><MapPin className="h-4 w-4 text-[#111B4D]" /> Cocody, Abidjan</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[#E3E8F2] pt-6 text-xs font-semibold text-[#64748B] sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} MonProf CI - Tous droits réservés.</p>
            <p className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-[#111B4D]" /> Professeurs vérifiés · Paiement sécurisé</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
