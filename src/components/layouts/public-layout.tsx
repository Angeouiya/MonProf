"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  Home,
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
import { BrandLogo } from "@/components/shared/brand-logo";
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

const footerLegalLinks = [
  { href: "/conditions-utilisation", label: "Conditions d'utilisation" },
  { href: "/politique-confidentialite", label: "Confidentialité" },
];

const trustSignals = [
  { icon: ShieldCheck, label: "Professeurs vérifiés" },
  { icon: CalendarCheck, label: "Séances de 2h" },
  { icon: WalletCards, label: "Paiement sécurisé" },
];

const mobileNavBase = [
  { href: "/", label: "Accueil", icon: Home, exact: true },
  { href: "/professeurs", label: "Profs", icon: Search },
  { href: "/tarifs", label: "Tarifs", icon: WalletCards },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isClient = (session?.user as any)?.role === "CLIENT";
  const hideMobileNav = shouldHidePublicMobileNav(pathname);

  return (
    <div className={cn(
      "public-shell flex min-h-screen flex-col bg-white",
      hideMobileNav ? "public-shell--mobile-nav-hidden" : "public-shell--mobile-nav-visible",
    )}>
      <header className="app-topbar fixed inset-x-0 top-0 z-[70] w-full border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-1.5 transition hover:bg-white"
            onClick={() => setMobileOpen(false)}
          >
            <BrandLogo priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
                  pathname?.startsWith(link.href)
                    ? "border border-[#DDE6F7] bg-white text-[#111B4D]"
                    : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isClient && (
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/client" prefetch={false}>
                  <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/admin" prefetch={false}>Service client</Link>
              </Button>
            )}
            {!session && (
              <Button asChild variant="ghost" className="min-h-11 rounded-lg px-4 text-[#111827] hover:bg-white hover:text-[#111B4D]">
                <Link href="/connexion" prefetch={false}>Connexion</Link>
              </Button>
            )}
            {!session && (
              <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] px-5 text-white hover:bg-[#1E2A78]">
                <Link href="/inscription" prefetch={false}>
                  Créer un compte
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
            {session && !isAdmin && !isClient && (
              <Button asChild variant="ghost" className="min-h-11 rounded-lg px-4 text-[#111827] hover:bg-white hover:text-[#111B4D]">
                <Link href="/connexion" prefetch={false}>Connexion</Link>
              </Button>
            )}
          </div>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#CAD7F2] bg-white text-[#111B4D] transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div
          className="fixed inset-x-0 z-40 overflow-y-auto border-b border-[#E3E8F2] bg-white lg:hidden"
          style={{
            top: "var(--app-topbar-height)",
            maxHeight: "calc(100dvh - var(--app-topbar-height))",
          }}
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
            <Link
              href="/professeurs"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="flex min-h-14 items-center justify-between rounded-lg border border-[#CAD7F2] bg-[#111B4D] px-4 text-sm font-semibold text-white"
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
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "inline-flex min-h-12 items-center rounded-lg px-4 text-sm font-semibold transition",
                  pathname?.startsWith(link.href)
                    ? "border border-[#DDE6F7] bg-white text-[#111B4D]"
                    : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-[#E3E8F2] bg-white p-3 min-[430px]:grid-cols-3">
              {trustSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div key={signal.label} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-[#111B4D]">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{signal.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-col gap-2 border-t border-[#E3E8F2] pt-3">
              {isClient && (
                <Button asChild variant="outline" className="min-h-12 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <Link href="/client" prefetch={false} onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <Button asChild variant="outline" className="min-h-12 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <Link href="/admin" prefetch={false} onClick={() => setMobileOpen(false)}>Service client</Link>
                </Button>
              )}
              {!session && (
                <>
                  <Button asChild variant="outline" className="min-h-12 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                    <Link href="/connexion" prefetch={false} onClick={() => setMobileOpen(false)}>Connexion</Link>
                  </Button>
                  <Button asChild className="min-h-12 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                    <Link href="/inscription" prefetch={false} onClick={() => setMobileOpen(false)}>
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
      <div className="app-topbar-spacer" aria-hidden="true" />

      {pathname !== "/" && (
        <div className="border-b border-[#E3E8F2] bg-white">
          <div className="mx-auto flex max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            <BackButton fallbackHref="/" />
          </div>
        </div>
      )}

      <main className={cn("flex-1", !hideMobileNav && "public-main-with-mobile-nav")}>{children}</main>

      <footer className={cn("mt-auto border-t border-[#E3E8F2] bg-white lg:pb-0", hideMobileNav ? "pb-0" : "pb-24")}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mb-8 rounded-lg border border-[#DDE6F7] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  Compétence
                </p>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#475569]">
                  Une plateforme ivoirienne pensée pour réserver un professeur, payer proprement et suivre chaque cours depuis un espace client clair.
                </p>
              </div>
              <Button asChild className="min-h-12 rounded-lg bg-[#111B4D] px-5 text-white hover:bg-[#1E2A78]">
                <Link href="/professeurs" prefetch={false}>
                  Trouver un professeur
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 gap-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <BrandLogo />
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-[#64748B]">
                Plateforme ivoirienne de réservation de cours à domicile et en ligne, avec des professeurs vérifiés et un paiement sécurisé.
              </p>
              <div className="mt-4 grid gap-2 text-xs font-semibold text-[#111B4D] sm:grid-cols-3">
                {trustSignals.map((signal) => {
                  const Icon = signal.icon;
                  return (
                    <span key={signal.label} className="inline-flex min-h-9 items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {signal.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#111827]">Plateforme</h4>
              <ul className="mt-3 space-y-1 text-sm">
                {footerPlatformLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} prefetch={false} className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 font-semibold text-[#64748B] transition hover:text-[#111B4D]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#111827]">Compte</h4>
              <ul className="mt-3 space-y-1 text-sm">
                {footerAccountLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} prefetch={false} className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 font-semibold text-[#64748B] transition hover:text-[#111B4D]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#111827]">Cadre légal</h4>
              <ul className="mt-3 space-y-1 text-sm">
                {footerLegalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} prefetch={false} className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 font-semibold text-[#64748B] transition hover:text-[#111B4D]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#111827]">Contact</h4>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-[#64748B]">
                <li className="flex min-h-10 items-center gap-2"><Phone className="h-4 w-4 text-[#111B4D]" /> +225 27 22 00 00 00</li>
                <li className="flex min-h-10 items-center gap-2"><Mail className="h-4 w-4 text-[#111B4D]" /> contact@competence.ci</li>
                <li className="flex min-h-10 items-center gap-2"><MapPin className="h-4 w-4 text-[#111B4D]" /> Cocody, Abidjan</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[#E3E8F2] pt-6 text-xs font-semibold text-[#64748B] sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} Compétence - Tous droits réservés.</p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-[#111B4D]" /> Professeurs vérifiés · Paiement sécurisé</span>
              <Link
                href="/conditions-utilisation"
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-3 text-[#111B4D] transition hover:border-[#111B4D]"
              >
                CGU
              </Link>
              <Link
                href="/politique-confidentialite"
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-3 text-[#111B4D] transition hover:border-[#111B4D]"
              >
                Confidentialité
              </Link>
            </p>
          </div>
        </div>
      </footer>
      {!hideMobileNav && <PublicMobileNav pathname={pathname} isClient={isClient} isAdmin={isAdmin} />}
    </div>
  );
}

function shouldHidePublicMobileNav(pathname: string | null) {
  if (!pathname) return false;
  if (/^\/professeurs\/[^/]+/.test(pathname)) return true;
  if (pathname.startsWith("/connexion")) return true;
  if (pathname.startsWith("/inscription")) return true;
  if (pathname.startsWith("/mot-de-passe-oublie")) return true;
  if (pathname.startsWith("/reinitialiser-mot-de-passe")) return true;
  return false;
}

function PublicMobileNav({
  pathname,
  isClient,
  isAdmin,
}: {
  pathname: string | null;
  isClient: boolean;
  isAdmin: boolean;
}) {
  const accountLink = isAdmin
    ? { href: "/admin", label: "Service client", icon: LayoutDashboard }
    : isClient
      ? { href: "/client", label: "Espace", icon: LayoutDashboard }
      : { href: "/connexion", label: "Compte", icon: GraduationCap };
  const items = [...mobileNavBase, accountLink];

  return (
    <nav
      className="public-mobile-nav fixed inset-x-3 z-40 rounded-lg border border-[#E1E7F2] bg-white px-2 py-2 lg:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigation publique mobile"
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const active = "exact" in item && item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-semibold transition-colors",
                active
                  ? "bg-[#111B4D] text-white"
                  : "bg-white text-[#64748B] hover:bg-white hover:text-[#111B4D]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
