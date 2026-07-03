"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, CalendarCheck, BookOpen, WalletCards,
  MessageSquare, LifeBuoy, User, LogOut, Menu, X, Bell,
  ShieldCheck, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/client", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Rechercher", icon: Search },
  { href: "/client/reservations", label: "Mes réservations", icon: CalendarCheck },
  { href: "/client/cours", label: "Mes cours", icon: BookOpen },
  { href: "/client/paiements", label: "Mes paiements", icon: WalletCards },
  { href: "/client/notifications", label: "Notifications", icon: Bell },
  { href: "/client/avis", label: "Mes avis", icon: MessageSquare },
  { href: "/client/support", label: "Support / Litige", icon: LifeBuoy },
  { href: "/client/profil", label: "Mon profil", icon: User },
];

const mobileNavItems = [
  { href: "/client", label: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Profs", icon: Search },
  { href: "/client/reservations", label: "Réserv.", icon: CalendarCheck },
  { href: "/client/notifications", label: "Alertes", icon: Bell },
  { href: "/client/profil", label: "Profil", icon: User },
];

export function ClientLayout({ children, userName, notificationCount = 0 }: { children: React.ReactNode; userName?: string | null; notificationCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hideMobileBottomNav = Boolean(
    pathname?.startsWith("/client/reserver")
    || /^\/client\/reservations\/[^/]+/.test(pathname ?? "")
  );

  const isActive = (item: (typeof navItems)[number]) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  return (
    <div className="client-shell flex min-h-screen flex-col bg-white text-[#111827] antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      {/* Top bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 flex min-h-18 items-center justify-between border-b border-[#E6EAF3] bg-white px-4 py-2 shadow-sm lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E1E7F2] bg-white text-[#111827] shadow-sm transition hover:border-[#111B4D] hover:bg-white lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/client" className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-1.5 transition hover:bg-white">
            <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
          </Link>
          <span className="hidden rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-[#111B4D] md:inline-flex">
            Espace client
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-1.5 text-xs font-bold text-[#111B4D] xl:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Paiement gardé jusqu'à confirmation
          </div>
          <Button asChild className="hidden min-h-11 rounded-2xl bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78] md:inline-flex">
            <Link href="/client/rechercher">
              Trouver un professeur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="relative hidden h-11 w-11 rounded-2xl text-[#111B4D] hover:bg-white sm:inline-flex" aria-label="Notifications client">
            <Link href="/client/notifications">
              <Bell className="h-5 w-5" />
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-black text-white shadow-sm">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="hidden min-h-11 rounded-2xl border-[#CAD7F2] bg-white px-4 text-[#111B4D] hover:border-[#111B4D] hover:bg-white sm:inline-flex">
            <Link href="/">Retour au site</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Déconnexion"
            className="hidden h-11 w-11 rounded-2xl text-[#111B4D] hover:bg-white sm:inline-flex"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="fixed left-0 top-[4.5rem] z-30 hidden h-[calc(100vh-4.5rem)] w-72 shrink-0 overflow-hidden border-r border-[#E6EAF3] bg-white shadow-sm lg:block">
          <SidebarContent userName={userName} pathname={pathname} isActive={isActive} notificationCount={notificationCount} />
        </aside>

        {/* Sidebar mobile (drawer) */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[#111827]" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-[19rem] max-w-[88%] border-r border-[#E6EAF3] bg-white shadow-sm">
              <div className="flex min-h-18 items-center justify-between border-b border-[#E6EAF3] px-4 py-2">
                <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
                <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E1E7F2] transition hover:border-[#111B4D] hover:bg-white" aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} pathname={pathname} isActive={isActive} notificationCount={notificationCount} onNavigate={() => setOpen(false)} />
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
          <div className="mx-auto w-full max-w-7xl px-3 py-5 min-[380px]:px-4 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
      {!hideMobileBottomNav && (
        <MobileBottomNav pathname={pathname} isActive={isActive} notificationCount={notificationCount} />
      )}
    </div>
  );
}

function SidebarContent({
  userName,
  pathname,
  isActive,
  onNavigate,
  notificationCount = 0,
}: {
  userName?: string | null;
  pathname: string | null;
  isActive: (item: (typeof navItems)[number]) => boolean;
  onNavigate?: () => void;
  notificationCount?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 lg:overflow-hidden">
        <p className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
          Espace client
        </p>
        <Link
          href="/client/rechercher"
          onClick={onNavigate}
          className="mb-2 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-[#111B4D] px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#182260]"
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
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
                active ? "bg-[#111B4D] text-white shadow-sm" : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.href === "/client/notifications" && !!notificationCount && (
                <span className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-xs font-black",
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
        <div className="rounded-2xl border border-[#E6EAF3] bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111B4D] text-sm font-black text-white">
              {getInitials(userName ?? "Client")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-foreground">{userName ?? "Client"}</p>
              <p className="truncate text-xs font-semibold text-[#64748B]">Compte client vérifié</p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              <span>Vos paiements restent protégés jusqu'à validation du cours.</span>
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
  isActive: (item: (typeof navItems)[number]) => boolean;
  notificationCount: number;
}) {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 rounded-[1.35rem] border border-[#E1E7F2] bg-white px-2 py-2 shadow-sm lg:hidden"
      aria-label="Navigation client mobile"
    >
      <div className="grid grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const active = isActive(item as (typeof navItems)[number]);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-bold transition",
                active ? "bg-[#111B4D] text-white shadow-sm" : "bg-white text-[#64748B] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
              {item.href === "/client/notifications" && !!notificationCount && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-black text-white">
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
