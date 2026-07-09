"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Search, CalendarCheck, BookOpen, WalletCards,
  MessageSquare, LifeBuoy, User, LogOut, Menu, X, Bell,
  ShieldCheck, ArrowRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

type ClientNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const navItems: ClientNavItem[] = [
  { href: "/client", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Rechercher", icon: Search },
  { href: "/client/reservations", label: "Réservations", icon: CalendarCheck },
  { href: "/client/cours", label: "Cours", icon: BookOpen },
  { href: "/client/paiements", label: "Paiements", icon: WalletCards },
  { href: "/client/notifications", label: "Notifications", icon: Bell },
  { href: "/client/avis", label: "Avis", icon: MessageSquare },
  { href: "/client/service-client", label: "Service client", icon: LifeBuoy },
];

const accountNavItems: ClientNavItem[] = [
  { href: "/client/profil", label: "Profil", icon: User },
  { href: "/client/parametres", label: "Paramètres", icon: Settings },
];

const mobileNavItems: ClientNavItem[] = [
  { href: "/client", label: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Profs", icon: Search },
  { href: "/client/reservations", label: "Réserv.", icon: CalendarCheck },
  { href: "/client/paiements", label: "Paiement", icon: WalletCards },
  { href: "/client/notifications", label: "Alertes", icon: Bell },
];

const quickSearchItems = [
  { label: "Maths", href: "/client/rechercher?q=math" },
  { label: "Cocody", href: "/client/rechercher?q=Cocody" },
  { label: "Concours", href: "/client/rechercher?q=concours" },
  { label: "Adultes", href: "/client/rechercher?q=professionnel" },
];

const prefetchRoutes = [
  "/client",
  "/client/rechercher",
  "/client/reservations",
  "/client/cours",
  "/client/paiements",
  "/client/notifications",
  "/client/service-client",
  "/client/profil",
  "/client/parametres",
];

export function ClientLayout({ children, userName, notificationCount = 0 }: { children: React.ReactNode; userName?: string | null; notificationCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigationResetRef = useRef<number | null>(null);
  const navigationDelayRef = useRef<number | null>(null);
  const searchKey = searchParams.toString();
  const currentSection = getCurrentSection(pathname);
  const mobileSectionLabel = currentSection.mobileLabel ?? currentSection.label;
  const hideMobileBottomNav = Boolean(
    pathname?.startsWith("/client/reserver")
    || /^\/client\/reservations\/[^/]+/.test(pathname ?? "")
  );

  const isActive = (item: ClientNavItem) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  useEffect(() => {
    if (navigationDelayRef.current) {
      window.clearTimeout(navigationDelayRef.current);
      navigationDelayRef.current = null;
    }
    if (navigationResetRef.current) {
      window.clearTimeout(navigationResetRef.current);
      navigationResetRef.current = null;
    }
    const routeSettledTimer = window.setTimeout(() => setNavigating(false), 0);
    return () => window.clearTimeout(routeSettledTimer);
  }, [pathname, searchKey]);

  useEffect(() => {
    const prefetch = () => {
      for (const route of prefetchRoutes) {
        router.prefetch(route);
      }
    };
    const idleId = "requestIdleCallback" in window
      ? window.requestIdleCallback(prefetch, { timeout: 1600 })
      : window.setTimeout(prefetch, 450);

    return () => {
      if ("cancelIdleCallback" in window && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else if (typeof idleId === "number") {
        window.clearTimeout(idleId);
      }
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (navigationDelayRef.current) {
        window.clearTimeout(navigationDelayRef.current);
      }
      if (navigationResetRef.current) {
        window.clearTimeout(navigationResetRef.current);
      }
    };
  }, []);

  function startNavigationFeedback() {
    if (navigationDelayRef.current) {
      window.clearTimeout(navigationDelayRef.current);
    }
    if (navigationResetRef.current) {
      window.clearTimeout(navigationResetRef.current);
    }
    navigationDelayRef.current = window.setTimeout(() => {
      setNavigating(true);
      navigationDelayRef.current = null;
    }, 90);
    navigationResetRef.current = window.setTimeout(() => {
      setNavigating(false);
      navigationResetRef.current = null;
      if (navigationDelayRef.current) {
        window.clearTimeout(navigationDelayRef.current);
        navigationDelayRef.current = null;
      }
    }, 1800);
  }

  function maybeStartClientNavigationFeedback(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute("download")) {
      return;
    }
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) {
      return;
    }
    try {
      const nextUrl = new URL(rawHref, window.location.origin);
      if (nextUrl.origin !== window.location.origin || !nextUrl.pathname.startsWith("/client")) {
        return;
      }
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath !== currentPath) {
        startNavigationFeedback();
      }
    } catch {
      // Ignore malformed href values; navigation itself will handle them.
    }
  }

  function handleClientNavigationIntent(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    maybeStartClientNavigationFeedback(event);
  }

  function handleClientNavigationCapture(event: MouseEvent<HTMLElement>) {
    maybeStartClientNavigationFeedback(event);
  }

  function submitQuickSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "").trim();
    startNavigationFeedback();
    router.push(query ? `/client/rechercher?q=${encodeURIComponent(query)}` : "/client/rechercher");
    setMobileSearchOpen(false);
  }

  return (
    <div
      data-client-layout
      aria-busy={navigating}
      data-route-pending={navigating ? "true" : "false"}
      onPointerDownCapture={handleClientNavigationIntent}
      onClickCapture={handleClientNavigationCapture}
      className="client-shell client-app-root flex min-h-screen flex-col bg-white text-[#111827] antialiased"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      {/* Top bar (mobile + desktop) */}
      <header data-client-topbar className="app-topbar client-app-topbar fixed inset-x-0 top-0 z-[70] flex min-h-16 items-center justify-between border-b border-[#E6EAF3] bg-white px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 min-[380px]:gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] bg-white text-[#111827] transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => {
              setMobileSearchOpen(false);
              setOpen(!open);
            }}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/client" className="flex min-h-11 shrink-0 items-center rounded-lg bg-white px-1 transition hover:bg-white lg:px-1.5">
            <BrandLogo size="sm" compact priority className="lg:hidden" />
            <BrandLogo size="sm" priority className="hidden lg:inline-flex" />
          </Link>
          <div className="flex min-w-0 flex-col lg:hidden">
            <span className="truncate text-sm font-semibold leading-4 text-[#111827]">{mobileSectionLabel}</span>
            <span className="hidden truncate text-[11px] font-medium leading-4 text-[#64748B] min-[360px]:block">{currentSection.hint}</span>
          </div>
          <span className="hidden rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111B4D] lg:inline-flex">
            {currentSection.label}
          </span>
        </div>
        <form
          key={searchParams.get("q") ?? "empty-search"}
          onSubmit={submitQuickSearch}
          className="hidden min-w-[16rem] max-w-xl flex-1 items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-2 py-1 lg:mx-4 lg:flex"
          role="search"
          aria-label="Recherche rapide de professeur"
        >
          <Search className="h-4 w-4 shrink-0 text-[#111B4D]" />
          <input
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Matière, niveau, commune, concours..."
            className="min-h-9 min-w-0 flex-1 border-0 bg-white px-1 text-sm font-medium text-[#111827] outline-none placeholder:text-[#64748B]"
            aria-label="Rechercher une matière, un niveau ou une commune"
          />
          <button
            type="submit"
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] px-3 text-xs font-semibold text-white transition hover:bg-[#182260]"
          >
            Rechercher
          </button>
        </form>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-1.5 text-xs font-semibold text-[#111B4D] xl:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            PayDunya vérifié
          </div>
          <Button asChild className="hidden min-h-11 rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78] lg:inline-flex">
            <Link href="/client/rechercher">
              Trouver un professeur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-11 rounded-lg text-[#111B4D] hover:bg-white lg:hidden"
            aria-label={mobileSearchOpen ? "Fermer la recherche" : "Rechercher un professeur"}
            aria-expanded={mobileSearchOpen}
            aria-controls="client-mobile-search-panel"
            onClick={() => {
              setOpen(false);
              setMobileSearchOpen((value) => !value);
            }}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>
          <Button asChild variant="ghost" className="relative h-11 w-11 rounded-lg text-[#111B4D] hover:bg-white" aria-label="Notifications client">
            <Link href="/client/notifications">
              <Bell className="h-5 w-5" />
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="hidden min-h-11 rounded-lg border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white xl:inline-flex">
            <Link href="/">Retour au site</Link>
          </Button>
          <ImportantActionConfirm
            title="Quitter l'espace client ?"
            description="Avant de vous déconnecter, vérifiez que vos paiements, confirmations de cours, demandes de report, litiges ou remboursements sont bien terminés."
            badge="Déconnexion"
            notices={[
              notificationCount > 0 ? `${notificationCount} notification(s) client restent à consulter.` : "Aucune information sensible ne sera validée automatiquement après la sortie.",
              "Une réservation non payée, une annulation ou un remboursement incomplet devra être repris à la prochaine connexion.",
              "Restez sur la page si vous devez encore confirmer un cours, payer via PayDunya ou renseigner un numéro de remboursement.",
            ]}
            confirmLabel="Me déconnecter"
            cancelLabel="Continuer mes actions"
            onConfirm={() => signOut({ callbackUrl: "/" })}
            trigger={
              <Button
                variant="ghost"
                title="Déconnexion"
                className="hidden h-11 w-11 rounded-lg text-[#111B4D] hover:bg-white lg:inline-flex"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            }
          />
        </div>
      </header>
      {navigating && (
        <>
          <div
            data-client-route-progress
            className="pointer-events-none fixed inset-x-0 z-[90] h-1 overflow-hidden border-y border-[#E3E8F2] bg-white"
            style={{ top: "var(--app-topbar-height, 4rem)" }}
            aria-hidden="true"
          >
            <div data-client-route-progress-bar className="h-full w-2/3 rounded-r-full bg-[#111B4D]" />
          </div>
          <div
            data-client-route-status
            className="pointer-events-none fixed left-1/2 z-[95] -translate-x-1/2 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2 text-xs font-semibold text-[#111B4D]"
            style={{ top: "calc(var(--app-topbar-height, 4rem) + 0.75rem)" }}
            role="status"
            aria-live="polite"
          >
            Chargement de l'espace...
          </div>
        </>
      )}
      {mobileSearchOpen && !open && (
        <div id="client-mobile-search-panel" data-client-mobile-search-panel className="app-topbar-offset fixed inset-x-0 z-30 border-b border-[#E6EAF3] bg-white px-3 py-3 lg:hidden">
          <form
            key={`mobile-${searchParams.get("q") ?? "empty-search"}`}
            onSubmit={submitQuickSearch}
            className="flex min-h-12 items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3"
            role="search"
            aria-label="Recherche rapide mobile de professeur"
          >
            <Search className="h-4 w-4 shrink-0 text-[#111B4D]" />
            <input
              name="q"
              defaultValue={searchParams.get("q") ?? ""}
              placeholder="Matière, niveau, commune..."
              className="min-h-10 min-w-0 flex-1 border-0 bg-white text-base font-medium text-[#111827] outline-none placeholder:text-[#64748B]"
              aria-label="Rechercher un professeur depuis le mobile"
              autoFocus
            />
            <button
              type="submit"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] px-3 text-xs font-semibold text-white"
            >
              OK
            </button>
          </form>
          <div className="mt-2 grid grid-cols-2 gap-2 min-[430px]:grid-cols-4" aria-label="Recherches rapides">
            {quickSearchItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSearchOpen(false)}
                className="inline-flex min-h-9 min-w-0 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-3 text-center text-xs font-semibold text-[#111B4D]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="app-topbar-spacer" aria-hidden="true" />

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside data-client-sidebar className="app-sidebar-below-topbar fixed left-0 z-30 hidden w-72 shrink-0 overflow-hidden border-r border-[#E6EAF3] bg-white lg:block">
          <SidebarContent userName={userName} isActive={isActive} notificationCount={notificationCount} />
        </aside>

        {/* Sidebar mobile (drawer) */}
        {open && (
          <div data-client-mobile-layer className="app-topbar-offset fixed inset-x-0 bottom-0 z-30 overflow-hidden lg:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-[#050B24]"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu client"
            />
            <aside
              data-client-mobile-drawer
              className="client-mobile-drawer absolute left-0 top-0 flex h-full w-[19rem] max-w-[88%] flex-col overflow-hidden border-r border-[#E6EAF3] bg-white"
              role="dialog"
              aria-modal="true"
              aria-label="Menu client"
            >
              <div className="flex min-h-16 items-center justify-between border-b border-[#E6EAF3] px-4 py-2">
                <BrandLogo size="sm" />
                <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] transition hover:border-[#111B4D] hover:bg-white" aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="border-b border-[#E6EAF3] bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Vous êtes dans</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-5 text-[#111827]">{currentSection.label}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">{currentSection.hint}</p>
                  </div>
                  {!!notificationCount && (
                    <Link
                      href="/client/notifications"
                      onClick={() => setOpen(false)}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#E3E8F2] bg-white px-2 text-xs font-semibold text-[#111B4D]"
                    >
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </Link>
                  )}
                </div>
              </div>
              <SidebarContent userName={userName} isActive={isActive} notificationCount={notificationCount} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main
          data-client-main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden lg:ml-72 lg:pb-0",
            hideMobileBottomNav
              ? "pb-8"
              : "client-main-with-mobile-nav pb-40"
          )}
        >
          <div data-client-content className="client-content mx-auto w-full max-w-[86rem] px-3 py-4 min-[380px]:px-4 sm:px-5 lg:px-7 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      {!hideMobileBottomNav && !open && (
        <MobileBottomNav pathname={pathname} isActive={isActive} notificationCount={notificationCount} />
      )}
    </div>
  );
}

function SidebarContent({
  userName,
  isActive,
  onNavigate,
  notificationCount = 0,
}: {
  userName?: string | null;
  isActive: (item: ClientNavItem) => boolean;
  onNavigate?: () => void;
  notificationCount?: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav data-client-sidebar-nav className="client-sidebar-main-nav scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale client">
        <p className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
          Espace client
        </p>
        <Link
          href="/client/rechercher"
          onClick={onNavigate}
          className="mb-2 flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[#111B4D] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#182260]"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            Trouver un professeur
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-client-sidebar-link
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                active ? "bg-[#111B4D] text-white" : "bg-white text-[#475569] hover:text-[#111B4D]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.href === "/client/notifications" && !!notificationCount && (
                <span className={cn(
                  "ml-auto rounded-md px-2 py-0.5 text-xs font-semibold",
                  active ? "bg-white text-[#111B4D]" : "bg-white text-[#111B4D] ring-1 ring-[#E3E8F2]"
                )}>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div data-client-sidebar-account className="client-sidebar-account shrink-0 border-t border-[#E6EAF3] p-3">
        <div className="bg-white p-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">
              {getInitials(userName ?? "Client")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#111827]">{userName ?? "Client"}</p>
              <p className="truncate text-xs font-medium text-[#64748B]">Espace personnel</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#E6EAF3] pt-2" aria-label="Compte client">
            {accountNavItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-[#111B4D] bg-[#111B4D] text-white"
                      : "border-[#E3E8F2] bg-white text-[#64748B] hover:border-[#111B4D] hover:text-[#111B4D]",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <ImportantActionConfirm
            title="Quitter l'espace client ?"
            description="Avant de vous déconnecter, vérifiez que vos paiements, confirmations de cours, demandes de report, litiges ou remboursements sont bien terminés."
            badge="Déconnexion"
            notices={[
              notificationCount > 0 ? `${notificationCount} notification(s) client restent à consulter.` : "Aucune information sensible ne sera validée automatiquement après la sortie.",
              "Une réservation non payée, une annulation ou un remboursement incomplet devra être repris à la prochaine connexion.",
              "Restez sur la page si vous devez encore confirmer un cours, payer via PayDunya ou renseigner un numéro de remboursement.",
            ]}
            confirmLabel="Me déconnecter"
            cancelLabel="Continuer"
            onConfirm={() => signOut({ callbackUrl: "/" })}
            trigger={
              <button
                type="button"
                className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            }
          />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium leading-4 text-[#64748B]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
            Paiement protégé jusqu'à validation.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#E6EAF3] pt-2 text-[11px] font-semibold text-[#64748B]">
            <Link
              href="/conditions-utilisation"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-2 text-[#111B4D] transition hover:border-[#111B4D]"
              onClick={onNavigate}
            >
              CGU
            </Link>
            <Link
              href="/politique-confidentialite"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-2 text-center text-[#111B4D] transition hover:border-[#111B4D]"
              onClick={onNavigate}
            >
              Confidentialité
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({
  pathname,
  isActive,
  notificationCount,
}: {
  pathname: string | null;
  isActive: (item: ClientNavItem) => boolean;
  notificationCount: number;
}) {
  return (
    <nav
      data-client-mobile-nav
      className="client-mobile-nav fixed inset-x-2 z-40 rounded-lg border border-[#E1E7F2] bg-white px-1.5 py-1.5 min-[390px]:inset-x-3 min-[390px]:px-2 min-[390px]:py-2 lg:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigation client mobile"
    >
      <div className="grid grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-xs font-semibold transition-colors min-[390px]:px-1",
                active ? "bg-[#111B4D] text-white" : "bg-white text-[#64748B] hover:text-[#111B4D]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate text-[0.66rem] leading-none min-[380px]:text-[0.72rem]">
                {item.label}
              </span>
              {item.href === "/client/notifications" && !!notificationCount && (
                <span
                  className={cn(
                    "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-semibold",
                    active ? "bg-white text-[#111B4D]" : "bg-[#111B4D] text-white",
                  )}
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

function getCurrentSection(pathname: string | null) {
  if (!pathname || pathname === "/client") {
    return { label: "Tableau de bord", mobileLabel: "Accueil", hint: "Suivi des cours" };
  }
  if (pathname.startsWith("/client/reserver")) {
    return { label: "Réserver", hint: "Parcours sécurisé" };
  }
  if (pathname.startsWith("/client/rechercher")) {
    return { label: "Professeurs", hint: "Recherche rapide" };
  }
  if (pathname.startsWith("/client/reservations")) {
    return { label: "Réservations", mobileLabel: "Dossiers", hint: "Dossiers et paiements" };
  }
  if (pathname.startsWith("/client/cours")) {
    return { label: "Cours", hint: "Séances à suivre" };
  }
  if (pathname.startsWith("/client/paiements")) {
    return { label: "Paiements", hint: "PayDunya sécurisé" };
  }
  if (pathname.startsWith("/client/notifications")) {
    return { label: "Notifications", mobileLabel: "Alertes", hint: "Actions importantes" };
  }
  if (pathname.startsWith("/client/avis")) {
    return { label: "Avis", hint: "Qualité des cours" };
  }
  if (pathname.startsWith("/client/service-client") || pathname.startsWith("/client/support")) {
    return { label: "Service client", mobileLabel: "Aide", hint: "Aide et litiges" };
  }
  if (pathname.startsWith("/client/profil")) {
    return { label: "Profil", hint: "Coordonnées client" };
  }
  if (pathname.startsWith("/client/parametres")) {
    return { label: "Paramètres", hint: "Sécurité du compte" };
  }
  return { label: "Espace client", hint: "Compétence" };
}
