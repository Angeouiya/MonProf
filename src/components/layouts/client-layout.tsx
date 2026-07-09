"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FocusEvent, type FormEvent, type MouseEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Search, CalendarCheck, BookOpen, WalletCards,
  MessageSquare, LifeBuoy, User, LogOut, Menu, X, Bell,
  ArrowRight, Settings, WifiOff
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
  { label: "Maths Cocody", href: "/client/rechercher?q=math&commune=Cocody" },
  { label: "Anglais ligne", href: "/client/rechercher?q=anglais&format=ONLINE" },
  { label: "Concours", href: "/client/rechercher?q=concours" },
  { label: "Adultes", href: "/client/rechercher?q=professionnel" },
];

const CLIENT_NAV_PREFETCH = true;
const CLIENT_PRIMARY_PREFETCH_ROUTES = [
  "/client",
  "/client/rechercher",
  "/client/reservations",
  "/client/paiements",
  "/client/notifications",
];
const CLIENT_SECONDARY_PREFETCH_ROUTES = [
  "/client/cours",
  "/client/avis",
  "/client/service-client",
  "/client/profil",
  "/client/parametres",
];
const CLIENT_PRIORITY_PREFETCH_ROUTES = [...CLIENT_PRIMARY_PREFETCH_ROUTES, ...CLIENT_SECONDARY_PREFETCH_ROUTES];
const CLIENT_NAV_FEEDBACK_DELAY_MS = 35;
const CLIENT_NAV_FEEDBACK_TIMEOUT_MS = 520;

export function ClientLayout({ children, userName, notificationCount = 0 }: { children: React.ReactNode; userName?: string | null; notificationCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const navigationResetRef = useRef<number | null>(null);
  const navigationDelayRef = useRef<number | null>(null);
  const navigationIntentRef = useRef<{ target: string; timestamp: number } | null>(null);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const searchKey = searchParams.toString();
  const currentSection = getCurrentSection(pathname);
  const mobileSectionLabel = currentSection.mobileLabel ?? currentSection.label;
  const hideMobileBottomNav = Boolean(
    pathname?.startsWith("/client/reserver")
    || /^\/client\/reservations\/[^/]+/.test(pathname ?? "")
  );
  const shouldRenderMobileBottomNav = !hideMobileBottomNav && !open;
  const closeMobileSurfaces = useCallback(() => {
    setOpen(false);
    setMobileSearchOpen(false);
  }, []);

  const isActive = (item: ClientNavItem) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  const prefetchClientRoute = useCallback((href: string) => {
    if (!href.startsWith("/client")) return;
    if (prefetchedRoutesRef.current.has(href)) return;
    prefetchedRoutesRef.current.add(href);
    router.prefetch(href);
  }, [router]);

  useEffect(() => {
    const closeTimer = window.setTimeout(closeMobileSurfaces, 0);
    if (navigationDelayRef.current) {
      window.clearTimeout(navigationDelayRef.current);
      navigationDelayRef.current = null;
    }
    if (navigationResetRef.current) {
      window.clearTimeout(navigationResetRef.current);
      navigationResetRef.current = null;
    }
    navigationIntentRef.current = null;
    const routeSettledTimer = window.setTimeout(() => setNavigating(false), 0);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(routeSettledTimer);
    };
  }, [pathname, searchKey, closeMobileSurfaces]);

  useEffect(() => {
    const initialCloseTimer = window.setTimeout(closeMobileSurfaces, 0);

    const closeOnPageShow = () => closeMobileSurfaces();
    const closeOnFocus = () => closeMobileSurfaces();
    const closeOnVisible = () => {
      if (document.visibilityState === "visible") closeMobileSurfaces();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileSurfaces();
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) closeMobileSurfaces();
    };

    window.addEventListener("pageshow", closeOnPageShow);
    window.addEventListener("focus", closeOnFocus);
    window.addEventListener("resize", closeOnDesktop);
    document.addEventListener("visibilitychange", closeOnVisible);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.clearTimeout(initialCloseTimer);
      window.removeEventListener("pageshow", closeOnPageShow);
      window.removeEventListener("focus", closeOnFocus);
      window.removeEventListener("resize", closeOnDesktop);
      document.removeEventListener("visibilitychange", closeOnVisible);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [closeMobileSurfaces]);

  useEffect(() => {
    return () => {
      if (navigationDelayRef.current) {
        window.clearTimeout(navigationDelayRef.current);
      }
      if (navigationResetRef.current) {
        window.clearTimeout(navigationResetRef.current);
      }
      navigationIntentRef.current = null;
    };
  }, []);

  useEffect(() => {
    const browserNavigator = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      deviceMemory?: number;
    };
    const connection = browserNavigator.connection;
    const effectiveType = connection?.effectiveType ?? "";
    const lowMemoryDevice = typeof browserNavigator.deviceMemory === "number" && browserNavigator.deviceMemory <= 2;
    const constrainedConnection = connection?.saveData || /(^|-)2g$|slow-2g|3g/i.test(effectiveType);
    if (constrainedConnection || lowMemoryDevice) return;

    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const routes = desktop ? CLIENT_PRIORITY_PREFETCH_ROUTES : CLIENT_PRIMARY_PREFETCH_ROUTES;
    const staggerMs = desktop ? 50 : 90;
    const prefetchClientRoutes = () => {
      const timers = routes.map((route, index) => (
        window.setTimeout(() => prefetchClientRoute(route), index * staggerMs)
      ));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    };
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let cancelStaggeredPrefetch: (() => void) | undefined;

    if (browserWindow.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(() => {
        cancelStaggeredPrefetch = prefetchClientRoutes();
      }, { timeout: desktop ? 250 : 650 });
      return () => {
        browserWindow.cancelIdleCallback?.(idleId);
        cancelStaggeredPrefetch?.();
      };
    }

    const timer = window.setTimeout(() => {
      cancelStaggeredPrefetch = prefetchClientRoutes();
    }, desktop ? 60 : 260);
    return () => {
      window.clearTimeout(timer);
      cancelStaggeredPrefetch?.();
    };
  }, [prefetchClientRoute]);

  useEffect(() => {
    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    syncNetworkState();
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);
    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timers = CLIENT_SECONDARY_PREFETCH_ROUTES.map((route, index) => (
      window.setTimeout(() => prefetchClientRoute(route), 90 + index * 55)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [open, prefetchClientRoute]);

  useEffect(() => {
    if (!open && !mobileSearchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mobileSearchOpen]);

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
    }, CLIENT_NAV_FEEDBACK_DELAY_MS);
    navigationResetRef.current = window.setTimeout(() => {
      setNavigating(false);
      navigationResetRef.current = null;
      if (navigationDelayRef.current) {
        window.clearTimeout(navigationDelayRef.current);
        navigationDelayRef.current = null;
      }
    }, CLIENT_NAV_FEEDBACK_TIMEOUT_MS);
  }

  function getClientNavigationTarget(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) {
    const hasModifier = "metaKey" in event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
    if (event.defaultPrevented || hasModifier) {
      return null;
    }
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute("download")) {
      return null;
    }
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) {
      return null;
    }
    try {
      const nextUrl = new URL(rawHref, window.location.origin);
      if (nextUrl.origin !== window.location.origin || !nextUrl.pathname.startsWith("/client")) {
        return null;
      }
      return `${nextUrl.pathname}${nextUrl.search}`;
    } catch {
      // Ignore malformed href values; navigation itself will handle them.
      return null;
    }
  }

  function maybeStartClientNavigationFeedback(
    event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
    source: "pointer" | "click",
  ) {
    const nextPath = getClientNavigationTarget(event);
    if (!nextPath) return;
    prefetchClientRoute(nextPath);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) {
      const now = window.performance.now();
      const previousIntent = navigationIntentRef.current;
      if (source === "click" && previousIntent?.target === nextPath && now - previousIntent.timestamp < 700) {
        return;
      }
      navigationIntentRef.current = { target: nextPath, timestamp: now };
      startNavigationFeedback();
    }
  }

  function maybePrefetchClientNavigation(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) {
    const nextPath = getClientNavigationTarget(event);
    if (nextPath) prefetchClientRoute(nextPath);
  }

  function handleClientNavigationIntent(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    maybeStartClientNavigationFeedback(event, "pointer");
  }

  function handleClientNavigationCapture(event: MouseEvent<HTMLElement>) {
    maybeStartClientNavigationFeedback(event, "click");
  }

  function handleClientPrefetchCapture(event: MouseEvent<HTMLElement>) {
    maybePrefetchClientNavigation(event);
  }

  function handleClientFocusPrefetch(event: FocusEvent<HTMLElement>) {
    maybePrefetchClientNavigation(event);
  }

  function submitQuickSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "").trim();
    const nextPath = query ? `/client/rechercher?q=${encodeURIComponent(query)}` : "/client/rechercher";
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) {
      navigationIntentRef.current = { target: nextPath, timestamp: window.performance.now() };
      startNavigationFeedback();
    }
    router.push(nextPath);
    setMobileSearchOpen(false);
  }

  return (
    <div
      data-client-layout
      data-mobile-menu-open={open ? "true" : "false"}
      aria-busy={navigating}
      data-route-pending={navigating ? "true" : "false"}
      onPointerDownCapture={handleClientNavigationIntent}
      onClickCapture={handleClientNavigationCapture}
      onMouseOverCapture={handleClientPrefetchCapture}
      onFocusCapture={handleClientFocusPrefetch}
      className="client-shell client-app-root flex min-h-screen flex-col bg-white text-[#111827] antialiased"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      <a
        href="#client-main-content"
        data-client-skip-link
        className="fixed left-3 top-3 z-[120] -translate-y-20 rounded-lg bg-[#111B4D] px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Aller au contenu
      </a>
      {/* Top bar (mobile + desktop) */}
      <header data-client-topbar className="app-topbar client-app-topbar fixed inset-x-0 top-0 z-[70] flex min-h-16 items-center justify-between border-b border-[#E6EAF3] bg-white px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 min-[380px]:gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] bg-white text-[#111827] transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => {
              setMobileSearchOpen(false);
              setOpen((value) => !value);
            }}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/client" prefetch={CLIENT_NAV_PREFETCH} onClick={closeMobileSurfaces} className="flex min-h-11 shrink-0 items-center rounded-lg bg-white px-1 transition hover:bg-white lg:px-1.5">
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
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] px-3 text-xs font-semibold text-white transition hover:bg-[#182260]"
          >
            Rechercher
          </button>
        </form>
        <div className="flex items-center gap-2">
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
            <Link href="/client/notifications" prefetch={CLIENT_NAV_PREFETCH} onClick={closeMobileSurfaces}>
              <Bell className="h-5 w-5" />
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
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
        <div
          data-client-route-progress
          className="pointer-events-none fixed inset-x-0 z-[90] h-1 overflow-hidden border-y border-[#E3E8F2] bg-white"
          style={{ top: "var(--app-topbar-height, 4rem)" }}
          aria-hidden="true"
        >
          <div data-client-route-progress-bar className="h-full w-2/3 rounded-r-full bg-[#111B4D]" />
        </div>
      )}
      {isOffline && (
        <div
          data-client-offline-banner
          className="fixed inset-x-3 z-[85] mx-auto flex max-w-xl items-center gap-2 rounded-lg border border-[#111B4D] bg-[#111B4D] px-3 py-2 text-sm font-semibold text-white"
          style={{ top: "calc(var(--app-topbar-height, 4rem) + 0.5rem)" }}
          role="status"
          aria-live="polite"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            Connexion interrompue. Les actions seront reprises au retour du réseau.
          </span>
        </div>
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
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
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
                prefetch={CLIENT_NAV_PREFETCH}
                onClick={closeMobileSurfaces}
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
          <div
            data-client-mobile-layer
            className="app-topbar-offset fixed inset-x-0 z-[60] overflow-hidden lg:hidden"
            style={{ bottom: "0px" }}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-[#111827]"
              onPointerDown={closeMobileSurfaces}
              onClick={closeMobileSurfaces}
              aria-label="Fermer le menu client"
            />
            <aside
              data-client-mobile-drawer
              className="client-mobile-menu-panel absolute bottom-2 left-2 top-2 flex w-[min(22.5rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-[#E6EAF3] bg-white"
              role="dialog"
              aria-modal="true"
              aria-label="Menu client"
            >
              <div className="flex min-h-14 items-center justify-between border-b border-[#E6EAF3] px-4 py-2">
                <BrandLogo size="sm" />
                <button onClick={closeMobileSurfaces} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] transition hover:border-[#111B4D] hover:bg-white" aria-label="Fermer le menu">
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
                      prefetch={CLIENT_NAV_PREFETCH}
                      onClick={closeMobileSurfaces}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#E3E8F2] bg-white px-2 text-xs font-semibold text-[#111B4D]"
                    >
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </Link>
                  )}
                </div>
              </div>
              <SidebarContent userName={userName} isActive={isActive} notificationCount={notificationCount} onNavigate={closeMobileSurfaces} compactAccount />
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
          <div id="client-main-content" tabIndex={-1} data-client-content className="client-content mx-auto w-full max-w-[86rem] px-3 py-4 min-[380px]:px-4 sm:px-5 lg:px-7 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      {shouldRenderMobileBottomNav && (
        <MobileBottomNav pathname={pathname} isActive={isActive} notificationCount={notificationCount} onNavigate={closeMobileSurfaces} />
      )}
    </div>
  );
}

function SidebarContent({
  userName,
  isActive,
  onNavigate,
  notificationCount = 0,
  compactAccount = false,
}: {
  userName?: string | null;
  isActive: (item: ClientNavItem) => boolean;
  onNavigate?: () => void;
  notificationCount?: number;
  compactAccount?: boolean;
}) {
  const showPrimaryAction = !compactAccount;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav data-client-sidebar-nav className="client-sidebar-main-nav scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale client">
        <p className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
          Espace client
        </p>
        {showPrimaryAction && (
          <Link
            href="/client/rechercher"
            prefetch={CLIENT_NAV_PREFETCH}
            onClick={onNavigate}
            className="mb-2 flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[#111B4D] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#182260]"
          >
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4" />
              Trouver un professeur
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={CLIENT_NAV_PREFETCH}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : "false"}
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
      <div data-client-sidebar-account className={cn("client-sidebar-account shrink-0 border-t border-[#E6EAF3]", compactAccount ? "p-2" : "p-2.5")}>
        <div className="bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">
              {getInitials(userName ?? "Client")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#111827]">{userName ?? "Client"}</p>
              <p className="truncate text-xs font-medium text-[#64748B]">Compte client</p>
            </div>
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
                className={cn(
                  "mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold text-[#111B4D] transition hover:border-[#111B4D]",
                  compactAccount && "min-h-10",
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({
  pathname,
  isActive,
  notificationCount,
  onNavigate,
}: {
  pathname: string | null;
  isActive: (item: ClientNavItem) => boolean;
  notificationCount: number;
  onNavigate: () => void;
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
              prefetch={CLIENT_NAV_PREFETCH}
              onClick={onNavigate}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-xs font-semibold transition-colors min-[390px]:px-1",
                active ? "bg-[#111B4D] text-white" : "bg-white text-[#64748B] hover:text-[#111B4D]"
              )}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : "false"}
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
