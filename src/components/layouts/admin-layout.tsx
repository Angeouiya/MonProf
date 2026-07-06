"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarRange, Wallet,
  ShieldAlert, Tag, Bell, Settings, LogOut, Menu, X, BookOpen,
  Banknote, Lock, MessageSquare, MapPin, ChevronRight, Home, Activity,
  ClipboardList, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";
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
      { href: "/admin/remboursements", label: "Remboursements", icon: RefreshCw },
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
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
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
    <div data-admin-layout className="admin-shell flex min-h-screen flex-col bg-white text-[#111827] antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      <header data-admin-topbar className="app-topbar fixed inset-x-0 top-0 z-[70] flex h-14 items-center justify-between border-b border-[#E6EAF3] bg-white px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] bg-white text-[#111827] transition hover:border-[#111B4D] lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <BrandLogo size="sm" priority />
            <span className="hidden rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111B4D] sm:inline-flex">
              Admin
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationHeaderRadar summary={summary} />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/"><Home className="mr-1.5 h-4 w-4" /> Voir le site</Link>
          </Button>
          <ImportantActionConfirm
            title="Déconnecter l'administration ?"
            description="Les actions opérationnelles doivent être enregistrées avant de quitter le dashboard admin."
            badge="Sortie admin"
            danger={summary.urgent > 0}
            notices={[
              summary.urgent > 0 ? `${summary.urgent} urgence(s) restent visibles dans le centre opérationnel.` : "Aucune urgence critique n'est signalée dans le radar actuel.",
              summary.payment > 0 ? `${summary.payment} notification(s) paiement ou remboursement sont à traiter.` : "Les remboursements et paiements non validés restent en attente.",
              "Sauvegardez les paiements, sanctions, remplacements, messages et remboursements avant de sortir.",
            ]}
            confirmLabel="Me déconnecter"
            cancelLabel="Rester dans l'admin"
            onConfirm={() => signOut({ callbackUrl: "/" })}
            trigger={
              <Button variant="ghost" size="icon" title="Déconnexion">
                <LogOut className="h-5 w-5" />
              </Button>
            }
          />
        </div>
      </header>
      <div className="app-topbar-spacer" aria-hidden="true" />

      <div className="flex flex-1">
        <aside data-admin-sidebar className="app-sidebar-below-topbar fixed left-0 z-30 hidden w-72 shrink-0 overflow-hidden border-r border-[#E6EAF3] bg-white lg:block">
          <SidebarContent userName={userName} isActive={isActive} notificationCount={summary.total} notificationSummary={summary} />
        </aside>

        {open && (
          <div data-admin-mobile-layer className="app-topbar-offset fixed inset-x-0 bottom-0 z-30 overflow-hidden lg:hidden">
            <div className="absolute inset-0 bg-[#111827]" onClick={() => setOpen(false)} />
            <aside data-admin-mobile-drawer className="admin-mobile-drawer absolute left-0 top-0 flex h-full w-[19rem] max-w-[88%] flex-col overflow-hidden border-r border-[#E6EAF3] bg-white">
              <div className="flex h-14 items-center justify-between border-b border-[#E6EAF3] px-4">
                <BrandLogo size="sm" />
                <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] text-[#111827] transition hover:border-[#111B4D]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent userName={userName} isActive={isActive} notificationCount={summary.total} notificationSummary={summary} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main data-admin-main className="min-w-0 flex-1 overflow-x-hidden lg:ml-72">
          <div data-admin-content className="mx-auto w-full max-w-[86rem] px-3 py-5 min-[380px]:px-4 sm:px-6 lg:px-8 lg:py-8">{children}</div>
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
    <div className="flex h-full min-h-0 flex-col">
      <nav data-admin-sidebar-nav className="admin-sidebar-main-nav min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        {(summary.total > 0 || summary.urgent > 0 || summary.teacher > 0 || summary.payment > 0) && (
          <div className="rounded-lg border border-[#E6EAF3] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Radar admin</p>
              <span className={cn(
                "rounded-lg border px-2 py-0.5 text-[10px] font-semibold",
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
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
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
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                        active ? "bg-[#111B4D] text-white" : "bg-white text-[#475569] hover:text-[#111B4D]"
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
      <div className="border-t border-[#E6EAF3] p-3">
        <div className="flex items-center gap-3 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">
            {(userName ?? "A")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#111827]">{userName ?? "Admin"}</p>
            <p className="truncate text-xs font-semibold text-[#64748B]">Administrateur</p>
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
        "hidden rounded-lg border bg-white sm:inline-flex",
        summary.urgent > 0 ? "border-red-200 text-red-700 hover:bg-white" : "border-[#CAD7F2] text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
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
        "rounded-lg border px-2 py-2 transition hover:border-[#111B4D]",
        danger ? "border-red-200 bg-white text-red-700" : "border-[#E6EAF3] bg-white text-[#475569]"
      )}
    >
      <span className="block font-black">{value > 99 ? "99+" : value}</span>
      <span className="block truncate">{label}</span>
    </Link>
  );
}
