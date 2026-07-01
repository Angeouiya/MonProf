"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarRange, Wallet,
  ShieldAlert, Tag, Bell, Settings, LogOut, Menu, X, BookOpen,
  Banknote, Lock, MessageSquare, Star, MapPin, ChevronRight, Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navSections = [
  {
    title: "Pilotage",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/reservations", label: "Réservations", icon: CalendarRange },
    ],
  },
  {
    title: "Professeurs & Clients",
    items: [
      { href: "/admin/professeurs", label: "Professeurs", icon: GraduationCap },
      { href: "/admin/professeurs/nouveau", label: "Ajouter professeur", icon: BookOpen, hideInList: true },
      { href: "/admin/clients", label: "Clients", icon: Users },
    ],
  },
  {
    title: "Finances",
    items: [
      { href: "/admin/paiements", label: "Paiements reçus", icon: Wallet },
      { href: "/admin/fonds-bloques", label: "Fonds bloqués", icon: Lock },
      { href: "/admin/paiements-a-liberer", label: "Paiements à libérer", icon: Banknote },
      { href: "/admin/professeurs-a-payer", label: "Professeurs à payer", icon: Banknote },
    ],
  },
  {
    title: "Litiges & Avis",
    items: [
      { href: "/admin/litiges", label: "Litiges", icon: ShieldAlert },
      { href: "/admin/avis", label: "Avis & notes", icon: Star },
    ],
  },
  {
    title: "Référentiels",
    items: [
      { href: "/admin/matieres", label: "Matières", icon: Tag },
      { href: "/admin/niveaux", label: "Niveaux", icon: BookOpen },
      { href: "/admin/communes", label: "Communes & quartiers", icon: MapPin },
    ],
  },
  {
    title: "Communication",
    items: [
      { href: "/admin/messages", label: "Messages contact", icon: MessageSquare },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export function AdminLayout({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
            <span className="hidden rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background sm:inline">
              Admin
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/"><Home className="mr-1.5 h-4 w-4" /> Voir le site</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/" })} title="Déconnexion">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
          <SidebarContent userName={userName} isActive={isActive} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} isActive={isActive} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  userName,
  isActive,
  onNavigate,
}: {
  userName?: string | null;
  isActive: (href: string, exact?: boolean) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-4 overflow-y-auto p-3 scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items
                .filter((i) => !i.hideInList)
                .map((item) => {
                  const active = isActive(item.href, item.exact);
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
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active && <ChevronRight className="ml-auto h-4 w-4" />}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {(userName ?? "A")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName ?? "Admin"}</p>
            <p className="truncate text-xs text-muted-foreground">Administrateur</p>
          </div>
        </div>
      </div>
    </div>
  );
}
