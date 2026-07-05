"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  { href: "/client/support", label: "Support", icon: LifeBuoy },
];

const accountNavItems: ClientNavItem[] = [
  { href: "/client/profil", label: "Profil", icon: User },
  { href: "/client/parametres", label: "Paramètres", icon: Settings },
];

const mobileNavItems: ClientNavItem[] = [
  { href: "/client", label: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Profs", icon: Search },
  { href: "/client/reservations", label: "Réserv.", icon: CalendarCheck },
  { href: "/client/paiements", label: "Payer", icon: WalletCards },
  { href: "/client/notifications", label: "Alertes", icon: Bell },
];

export function ClientLayout({ children, userName, notificationCount = 0 }: { children: React.ReactNode; userName?: string | null; notificationCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hideMobileBottomNav = Boolean(
    pathname?.startsWith("/client/reserver")
    || /^\/client\/reservations\/[^/]+/.test(pathname ?? "")
  );

  const isActive = (item: ClientNavItem) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  return (
    <div className="client-shell client-app-root flex min-h-screen flex-col bg-white text-[#111827] antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      {/* Top bar (mobile + desktop) */}
      <header className="client-app-topbar sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-[#E6EAF3] bg-white px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E1E7F2] bg-white text-[#111827] transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/client" className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-1.5 transition hover:bg-white">
            <BrandLogo size="sm" />
          </Link>
          <span className="hidden rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111B4D] md:inline-flex">
            Espace client
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-1.5 text-xs font-semibold text-[#111B4D] xl:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            PayDunya vérifié
          </div>
          <Button asChild className="hidden min-h-11 rounded-xl bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78] lg:inline-flex">
            <Link href="/client/rechercher">
              Trouver un professeur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="relative hidden h-11 w-11 rounded-xl text-[#111B4D] hover:bg-white sm:inline-flex" aria-label="Notifications client">
            <Link href="/client/notifications">
              <Bell className="h-5 w-5" />
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="hidden min-h-11 rounded-xl border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white xl:inline-flex">
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
                className="hidden h-11 w-11 rounded-xl text-[#111B4D] hover:bg-white lg:inline-flex"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            }
          />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-72 shrink-0 overflow-hidden border-r border-[#E6EAF3] bg-white lg:block">
          <SidebarContent userName={userName} isActive={isActive} notificationCount={notificationCount} />
        </aside>

        {/* Sidebar mobile (drawer) */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[#111827]" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-[19rem] max-w-[88%] border-r border-[#E6EAF3] bg-white">
              <div className="flex min-h-16 items-center justify-between border-b border-[#E6EAF3] px-4 py-2">
                <BrandLogo size="sm" />
                <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E1E7F2] transition hover:border-[#111B4D] hover:bg-white" aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} isActive={isActive} notificationCount={notificationCount} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main
          className={cn(
            "flex-1 overflow-x-hidden lg:ml-72 lg:pb-0",
            hideMobileBottomNav
              ? "pb-8"
              : "client-main-with-mobile-nav pb-6"
          )}
        >
          <div className="client-content mx-auto w-full max-w-[86rem] px-3 py-4 min-[380px]:px-4 sm:px-5 lg:px-7 lg:py-6">
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
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1 overflow-hidden p-3">
        <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Espace client
        </p>
        <Link
          href="/client/rechercher"
          onClick={onNavigate}
          className="mb-2 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#111B4D] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#182260]"
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
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
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
      <div className="border-t border-[#E6EAF3] p-3">
        <div className="bg-white p-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">
              {getInitials(userName ?? "Client")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#111827]">{userName ?? "Client"}</p>
              <p className="truncate text-xs font-medium text-[#64748B]">Espace personnel</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E6EAF3] pt-3">
            {accountNavItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold transition-colors",
                    active ? "text-[#111B4D]" : "text-[#64748B] hover:text-[#111B4D]",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium leading-5 text-[#64748B]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
            Paiement protégé jusqu'à validation.
          </p>
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
      className="client-mobile-nav fixed inset-x-3 z-40 rounded-xl border border-[#E1E7F2] bg-white px-2 py-2 lg:hidden"
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
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold transition-colors",
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
