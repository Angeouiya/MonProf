"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shared/back-button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/professeurs", label: "Trouver un professeur" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
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

const publicRootPaths = new Set(["/", "/professeurs", "/tarifs", "/contact"]);

type PublicSessionRole = "CLIENT" | "ADMIN" | "TEACHER";

const sessionDestinations: Record<PublicSessionRole, { href: string; label: string; navLabel: string }> = {
  CLIENT: { href: "/client", label: "Mon espace", navLabel: "Espace" },
  ADMIN: { href: "/admin", label: "Service client", navLabel: "Service client" },
  TEACHER: { href: "/professeur", label: "Mon espace", navLabel: "Espace" },
};

export function PublicLayout({
  children,
  backFallbackHref = "/",
}: {
  children: React.ReactNode;
  backFallbackHref?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hideGlobalBookingAction = isPublicTeacherDetail(pathname);
  const hideMobileNav = shouldHidePublicMobileNav(pathname);
  const hideFooter = shouldHidePublicFooter(pathname);
  const { data: sessionRole = null } = useQuery({
    queryKey: ["public-session-role"],
    queryFn: readPublicSessionRole,
    enabled: !hideFooter,
    staleTime: 60_000,
    retry: false,
  });
  const sessionDestination = sessionRole ? sessionDestinations[sessionRole] : null;
  const isAuthenticated = sessionDestination !== null;

  return (
    <div className={cn(
      "public-shell flex min-h-screen flex-col bg-white",
      hideMobileNav ? "public-shell--mobile-nav-hidden" : "public-shell--mobile-nav-visible",
    )}
      data-public-mobile-menu-open={mobileOpen ? "true" : "false"}
    >
      <header className="app-topbar fixed inset-x-0 top-0 z-[70] w-full border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            prefetch={true}
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
                prefetch={true}
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
            {sessionDestination && (
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href={sessionDestination.href} prefetch={true}>
                  <LayoutDashboard className="mr-1.5 h-4 w-4" /> {sessionDestination.label}
                </Link>
              </Button>
            )}
            {!isAuthenticated && (
              <Button asChild variant="ghost" className="min-h-11 rounded-lg px-4 text-[#111827] hover:bg-white hover:text-[#111B4D]">
                <Link href="/connexion" prefetch={true}>Connexion</Link>
              </Button>
            )}
            {!isAuthenticated && !hideGlobalBookingAction && (
              <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] px-5 text-white hover:bg-[#1E2A78]">
                <Link href="/professeurs" prefetch={true}>
                  Réserver
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
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
              prefetch={true}
              onClick={() => setMobileOpen(false)}
              className="flex min-h-14 items-center justify-between rounded-lg border border-[#CAD7F2] bg-[#111B4D] px-4 text-sm font-semibold text-white"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" />
                Trouver un professeur
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            {navLinks.filter((link) => link.href !== "/professeurs").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
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
              {sessionDestination && (
                <Button asChild variant="outline" className="min-h-12 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <Link href={sessionDestination.href} prefetch={true} onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="mr-1.5 h-4 w-4" /> {sessionDestination.label}
                  </Link>
                </Button>
              )}
              {!isAuthenticated && (
                <>
                  <Button asChild variant="outline" className="min-h-12 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                    <Link href="/connexion" prefetch={true} onClick={() => setMobileOpen(false)}>Connexion</Link>
                  </Button>
                  <Button asChild className="min-h-12 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                    <Link href="/professeurs" prefetch={true} onClick={() => setMobileOpen(false)}>
                      Réserver une séance
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

      {shouldShowPublicBack(pathname) && (
        <div className="border-b border-[#E3E8F2] bg-white">
          <div className="mx-auto flex max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            <BackButton fallbackHref={backFallbackHref} />
          </div>
        </div>
      )}

      <main className={cn("flex-1", !hideMobileNav && "public-main-with-mobile-nav")}>{children}</main>

      {!hideFooter && (
      <footer className={cn("mt-auto hidden border-t border-[#E3E8F2] bg-white sm:block lg:pb-0", hideMobileNav ? "pb-0" : "pb-24")}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <BrandLogo />
            <p className="mt-2 text-xs font-medium text-[#64748B]">© {new Date().getFullYear()} Compétence · Cocody, Abidjan</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#64748B]">
            <Link href="/tarifs" className="min-h-10 content-center hover:text-[#111B4D]">Tarifs</Link>
            <Link href="/contact" className="min-h-10 content-center hover:text-[#111B4D]">Aide</Link>
            <Link href="/conditions-utilisation" className="min-h-10 content-center hover:text-[#111B4D]">Conditions</Link>
            <Link href="/politique-confidentialite" className="min-h-10 content-center hover:text-[#111B4D]">Confidentialité</Link>
          </nav>
          </div>
      </footer>
      )}
      {!hideMobileNav && !mobileOpen && <PublicMobileNav pathname={pathname} sessionRole={sessionRole} />}
    </div>
  );
}

function shouldHidePublicMobileNav(pathname: string | null) {
  if (!pathname) return false;
  if (isPublicTeacherDetail(pathname)) return true;
  if (pathname.startsWith("/connexion")) return true;
  if (pathname.startsWith("/inscription")) return true;
  if (pathname.startsWith("/mot-de-passe-oublie")) return true;
  if (pathname.startsWith("/reinitialiser-mot-de-passe")) return true;
  return false;
}

function shouldHidePublicFooter(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.startsWith("/connexion")
    || pathname.startsWith("/inscription")
    || pathname.startsWith("/mot-de-passe-oublie")
    || pathname.startsWith("/reinitialiser-mot-de-passe")
  );
}

function PublicMobileNav({
  pathname,
  sessionRole,
}: {
  pathname: string | null;
  sessionRole: PublicSessionRole | null;
}) {
  const accountLink = sessionRole
    ? {
        href: sessionDestinations[sessionRole].href,
        label: sessionDestinations[sessionRole].navLabel,
        icon: LayoutDashboard,
      }
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
              prefetch={true}
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

function isPublicTeacherDetail(pathname: string | null) {
  return Boolean(pathname && /^\/professeurs\/[^/]+/.test(pathname));
}

function shouldShowPublicBack(pathname: string | null) {
  return Boolean(pathname && !publicRootPaths.has(pathname));
}

async function readPublicSessionRole(): Promise<PublicSessionRole | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) return null;

  const payload = await response.json() as { user?: { role?: string } | null };
  const role = payload.user?.role;
  return role === "CLIENT" || role === "ADMIN" || role === "TEACHER" ? role : null;
}
