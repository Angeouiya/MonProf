"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarRange, Wallet,
  ShieldAlert, Tag, Bell, Settings, LogOut, Menu, X, BookOpen,
  Banknote, Lock, MessageSquare, MapPin, ChevronRight, Home, Activity, ClipboardList, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  hideInList?: boolean;
};

type AdminNotificationSummary = {
  total: number;
  urgent: number;
  teacher: number;
  payment: number;
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Pilotage",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/centre-operationnel", label: "Centre opérationnel", icon: Activity },
      { href: "/admin/reservations", label: "Réservations", icon: CalendarRange },
    ],
  },
  {
    title: "Professeurs & Clients",
    items: [
      { href: "/admin/professeurs", label: "Professeurs", icon: GraduationCap },
      { href: "/admin/suivi-professeurs", label: "Suivi professeurs", icon: ClipboardList },
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
      { href: "/admin/avis", label: "Avis & notes", icon: MessageSquare },
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

export function AdminLayout({
  children,
  userName,
  notificationCount = 0,
  notificationSummary,
}: {
  children: React.ReactNode;
  userName?: string | null;
  notificationCount?: number;
  notificationSummary?: AdminNotificationSummary;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const summary = notificationSummary ?? { total: notificationCount, urgent: 0, teacher: 0, payment: 0 };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/60 bg-white/75 px-4 shadow-[0_10px_35px_rgba(30,42,120,0.07)] backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-2xl border border-violet-100 bg-white/80 p-2 text-foreground shadow-sm transition hover:bg-violet-50 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
            <span className="hidden rounded-full premium-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm sm:inline">
              Admin
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationHeaderRadar summary={summary} />
          <Button asChild variant="ghost" size="sm">
            <Link href="/"><Home className="mr-1.5 h-4 w-4" /> Voir le site</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/" })} title="Déconnexion">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-white/20 bg-[#111827] text-white shadow-[20px_0_60px_rgba(17,24,39,0.12)] lg:block">
          <SidebarContent userName={userName} isActive={isActive} notificationCount={summary.total} notificationSummary={summary} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[#111827]/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto bg-[#111827] text-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                <Image src="/logo.svg" alt="MonProf CI" width={120} height={24} />
                <button onClick={() => setOpen(false)} className="rounded-2xl p-2 transition hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} isActive={isActive} notificationCount={summary.total} notificationSummary={summary} onNavigate={() => setOpen(false)} />
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
  notificationCount,
  notificationSummary,
  onNavigate,
}: {
  userName?: string | null;
  isActive: (href: string, exact?: boolean) => boolean;
  notificationCount?: number;
  notificationSummary?: AdminNotificationSummary;
  onNavigate?: () => void;
}) {
  const summary = notificationSummary ?? { total: notificationCount ?? 0, urgent: 0, teacher: 0, payment: 0 };
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-4 overflow-y-auto p-3 scrollbar-thin">
        {(summary.total > 0 || summary.urgent > 0 || summary.teacher > 0 || summary.payment > 0) && (
          <div className="rounded-3xl border border-white/10 bg-white/8 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Radar admin</p>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black",
                summary.urgent > 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"
              )}>
                {summary.total > 99 ? "99+" : summary.total}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <RadarPill href="/admin/notifications?filter=urgent" label="Urgent" value={summary.urgent} danger={summary.urgent > 0} onNavigate={onNavigate} />
              <RadarPill href="/admin/notifications?filter=teacher" label="Profs" value={summary.teacher} danger={summary.teacher > 0} onNavigate={onNavigate} />
              <RadarPill href="/admin/paiements-a-liberer" label="Paiements" value={summary.payment} danger={summary.payment > 0} onNavigate={onNavigate} />
            </div>
          </div>
        )}
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
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
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all",
                        active ? "premium-gradient text-white shadow-lg shadow-violet-950/20" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.href === "/admin/notifications" && !!notificationCount && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-100">
                          {notificationCount > 99 ? "99+" : notificationCount}
                        </span>
                      )}
                      {active && <ChevronRight className={cn("h-4 w-4", item.href === "/admin/notifications" && notificationCount ? "" : "ml-auto")} />}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary">
            {(userName ?? "A")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName ?? "Admin"}</p>
            <p className="truncate text-xs text-white/55">Administrateur</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationHeaderRadar({ summary }: { summary: AdminNotificationSummary }) {
  if (summary.total === 0 && summary.urgent === 0 && summary.teacher === 0 && summary.payment === 0) {
    return (
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/admin/notifications">
          <Bell className="mr-1.5 h-4 w-4" />
          Notifications
        </Link>
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        "hidden rounded-2xl border bg-white/82 shadow-sm sm:inline-flex",
        summary.urgent > 0 ? "border-red-200 text-red-700 hover:bg-red-50" : "border-violet-100 text-violet-800 hover:bg-violet-50"
      )}
    >
      <Link href={summary.urgent > 0 ? "/admin/notifications?filter=urgent" : "/admin/notifications"}>
        {summary.urgent > 0 ? <AlertTriangle className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
        {summary.urgent > 0 ? `${summary.urgent} urgente(s)` : `${summary.total} notification(s)`}
      </Link>
    </Button>
  );
}

function RadarPill({
  href,
  label,
  value,
  danger,
  onNavigate,
}: {
  href: string;
  label: string;
  value: number;
  danger?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "rounded-2xl px-2 py-2 transition hover:bg-white/12",
        danger ? "bg-red-100 text-red-800" : "bg-white/8 text-white/70"
      )}
    >
      <span className="block font-black">{value > 99 ? "99+" : value}</span>
      <span className="block truncate">{label}</span>
    </Link>
  );
}
