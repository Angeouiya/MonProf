"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, CalendarCheck, BookOpen, CreditCard,
  Star, LifeBuoy, User, LogOut, Menu, X, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/client", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/client/rechercher", label: "Rechercher", icon: Search },
  { href: "/client/reservations", label: "Mes réservations", icon: CalendarCheck },
  { href: "/client/cours", label: "Mes cours", icon: BookOpen },
  { href: "/client/paiements", label: "Mes paiements", icon: CreditCard },
  { href: "/client/avis", label: "Mes avis", icon: Star },
  { href: "/client/support", label: "Support / Litige", icon: LifeBuoy },
  { href: "/client/profil", label: "Mon profil", icon: User },
];

export function ClientLayout({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (item: (typeof navItems)[number]) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/client" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/client/support">
              <Bell className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Retour au site</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
          <SidebarContent userName={userName} pathname={pathname} isActive={isActive} />
        </aside>

        {/* Sidebar mobile (drawer) */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} pathname={pathname} isActive={isActive} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  userName,
  pathname,
  isActive,
  onNavigate,
}: {
  userName?: string | null;
  pathname: string | null;
  isActive: (item: (typeof navItems)[number]) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Espace client
        </p>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {(userName ?? "C")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName ?? "Client"}</p>
            <p className="truncate text-xs text-muted-foreground">Client</p>
          </div>
        </div>
      </div>
    </div>
  );
}
