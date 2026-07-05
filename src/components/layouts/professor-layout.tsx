"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Bell,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";
import { ProfessorImage } from "@/components/shared/professor-image";
import { cn } from "@/lib/utils";

type ProfessorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const navGroups: Array<{ label: string; items: ProfessorNavItem[] }> = [
  {
    label: "Accueil",
    items: [
      { href: "/professeur", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Opérations professeur",
    items: [
      { href: "/professeur/missions", label: "Missions", icon: BookOpenCheck },
      { href: "/professeur/disponibilites", label: "Disponibilités", icon: CalendarClock },
      { href: "/professeur/paiements", label: "Paiements", icon: CreditCard },
      { href: "/professeur/messages", label: "Messages admin", icon: MessageSquareText },
      { href: "/professeur/avis", label: "Avis & qualité", icon: MessageSquareText },
      { href: "/professeur/profil", label: "Profil & mini-CV", icon: User },
    ],
  },
  {
    label: "Suivi",
    items: [
      { href: "/professeur/notifications", label: "Notifications", icon: Bell },
      { href: "/professeur/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

const mobileNavItems = [
  { href: "/professeur", label: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/professeur/missions", label: "Miss.", icon: BookOpenCheck },
  { href: "/professeur/disponibilites", label: "Dispos", icon: CalendarClock },
  { href: "/professeur/paiements", label: "Paie.", icon: CreditCard },
  { href: "/professeur/messages", label: "Msgs", icon: MessageSquareText },
];

export function ProfessorLayout({
  children,
  teacherName,
  photoUrl,
  notificationCount = 0,
  missionCount = 0,
  taskCount = 0,
  messageCount = 0,
}: {
  children: React.ReactNode;
  teacherName: string;
  photoUrl?: string | null;
  notificationCount?: number;
  missionCount?: number;
  taskCount?: number;
  messageCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: ProfessorNavItem) => (
    item.exact ? pathname === item.href : pathname?.startsWith(item.href)
  );

  return (
    <div className="professor-shell flex min-h-screen flex-col bg-white text-[#111827] antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      <header className="app-topbar fixed inset-x-0 top-0 z-40 flex min-h-18 items-center justify-between border-b border-[#E6EAF3] bg-white px-4 py-2 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2] bg-white text-[#111827] transition hover:border-[#111B4D] lg:hidden"
            aria-label="Menu professeur"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/professeur" className="flex min-h-11 items-center gap-2 rounded-lg px-1.5">
            <BrandLogo size="sm" />
          </Link>
          <span className="hidden rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111B4D] md:inline-flex">
            Espace professeur
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="relative h-11 w-11 rounded-lg text-[#111B4D] hover:bg-white sm:hidden" aria-label="Notifications professeur">
            <Link href="/professeur/notifications">
              <Bell className="h-5 w-5" />
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" className="relative hidden min-h-11 rounded-lg border-[#D7DEE9] bg-white px-4 text-[#111B4D] sm:inline-flex">
            <Link href="/professeur/notifications">
              <Bell className="h-4 w-4" />
              Notifications
              {!!notificationCount && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111B4D] px-1 text-xs font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="hidden min-h-11 rounded-lg bg-white px-4 text-[#111B4D] sm:inline-flex">
            <Link href="/">Site public</Link>
          </Button>
          <ImportantActionConfirm
            title="Quitter l'espace professeur ?"
            description="Avant de sortir, vérifiez que vos missions, confirmations et messages à l'administration sont bien terminés."
            badge="Déconnexion professeur"
            danger={missionCount > 0 || taskCount > 0}
            notices={[
              missionCount > 0 ? `${missionCount} mission(s) demandent encore votre attention.` : "Aucune mission urgente n'est signalée dans ce bandeau.",
              taskCount > 0 ? `${taskCount} tâche(s) professeur restent à traiter.` : "Les tâches déjà terminées restent historisées.",
              "Confirmez, refusez ou proposez un nouveau créneau avant de vous déconnecter si une mission est en attente.",
            ]}
            confirmLabel="Me déconnecter"
            cancelLabel="Continuer mes missions"
            onConfirm={() => signOut({ callbackUrl: "/professeur/connexion" })}
            trigger={
              <Button
                variant="ghost"
                title="Déconnexion"
                className="hidden h-11 w-11 rounded-lg text-[#111B4D] hover:bg-white sm:inline-flex"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            }
          />
        </div>
      </header>
      <div className="h-18 shrink-0" aria-hidden="true" />

      <div className="flex flex-1">
        <aside className="fixed left-0 top-[4.5rem] z-30 hidden h-[calc(100vh-4.5rem)] w-72 shrink-0 overflow-hidden border-r border-[#E6EAF3] bg-white lg:block">
          <SidebarContent
            teacherName={teacherName}
            photoUrl={photoUrl}
            isActive={isActive}
            notificationCount={notificationCount}
            missionCount={missionCount}
            taskCount={taskCount}
            messageCount={messageCount}
          />
        </aside>

        {open && (
          <div className="fixed inset-x-0 bottom-0 top-[4.5rem] z-30 overflow-hidden lg:hidden">
            <div className="absolute inset-0 bg-[#111827]" onClick={() => setOpen(false)} />
            <aside className="professor-mobile-drawer absolute left-0 top-0 flex h-full w-[19rem] max-w-[88%] flex-col overflow-hidden border-r border-[#E6EAF3] bg-white">
              <div className="flex min-h-18 items-center justify-between border-b border-[#E6EAF3] px-4 py-2">
                <BrandLogo size="sm" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E1E7F2]"
                  aria-label="Fermer le menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent
                teacherName={teacherName}
                photoUrl={photoUrl}
                isActive={isActive}
                notificationCount={notificationCount}
                missionCount={missionCount}
                taskCount={taskCount}
                messageCount={messageCount}
                onNavigate={() => setOpen(false)}
              />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden pb-24 lg:ml-72 lg:pb-0">
          <div className="mx-auto w-full max-w-7xl px-3 py-5 min-[380px]:px-4 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {!open && <MobileBottomNav pathname={pathname} notificationCount={notificationCount} messageCount={messageCount} />}
    </div>
  );
}

function SidebarContent({
  teacherName,
  photoUrl,
  isActive,
  notificationCount,
  missionCount,
  taskCount,
  messageCount,
  onNavigate,
}: {
  teacherName: string;
  photoUrl?: string | null;
  isActive: (item: ProfessorNavItem) => boolean;
  notificationCount: number;
  missionCount: number;
  taskCount: number;
  messageCount: number;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="professor-sidebar-main-nav min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
        <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Plateforme professeur
        </p>
        <div className="mb-3 rounded-lg border border-[#E6EAF3] bg-white p-3">
          <div className="flex items-center gap-3">
            <ProfessorImage photoUrl={photoUrl} name={teacherName} size="md" verified />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{teacherName}</p>
              <p className="text-xs font-semibold text-[#64748B]">Accès opérationnel</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniCounter label="Missions" value={missionCount} />
            <MiniCounter label="Tâches" value={taskCount} />
            <MiniCounter label="Messages" value={messageCount} />
          </div>
          <div className="mt-3 grid gap-1.5">
            <SidebarSignal
              href="/professeur/missions"
              label="Confirmer missions"
              value={missionCount}
              active={missionCount > 0}
              onNavigate={onNavigate}
            />
            <SidebarSignal
              href="/professeur/missions"
              label="Tâches ouvertes"
              value={taskCount}
              active={taskCount > 0}
              onNavigate={onNavigate}
            />
            <SidebarSignal
              href="/professeur/messages"
              label="Messages admin"
              value={messageCount}
              active={messageCount > 0}
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-[#111B4D] text-white" : "bg-white text-[#475569] hover:bg-white hover:text-[#111B4D]",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.href === "/professeur/messages" && !!messageCount && (
                    <span className={cn(
                      "ml-auto rounded-md px-2 py-0.5 text-xs font-semibold",
                      active ? "bg-white text-[#111B4D]" : "bg-white text-[#111B4D] ring-1 ring-[#E3E8F2]",
                    )}>
                      {messageCount > 99 ? "99+" : messageCount}
                    </span>
                  )}
                  {item.href === "/professeur/notifications" && !!notificationCount && (
                    <span className={cn(
                      "ml-auto rounded-md px-2 py-0.5 text-xs font-semibold",
                      active ? "bg-white text-[#111B4D]" : "bg-white text-[#111B4D] ring-1 ring-[#E3E8F2]",
                    )}>
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-[#E6EAF3] p-3">
        <div className="mb-3 rounded-lg border border-[#E6EAF3] bg-white p-3 text-[11px] font-semibold leading-5 text-[#64748B]">
          <p className="text-[#111827]">Cadre Compétence</p>
          <p className="mt-1">L'accès professeur suppose l'acceptation des règles présentées pendant l'enrôlement administratif.</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/conditions-utilisation" className="text-[#111B4D] hover:underline" onClick={onNavigate}>
              CGU
            </Link>
            <Link href="/politique-confidentialite" className="text-[#111B4D] hover:underline" onClick={onNavigate}>
              Confidentialité
            </Link>
          </div>
        </div>
        <ImportantActionConfirm
          title="Quitter l'espace professeur ?"
          description="Vos missions et messages restent suivis par l'administration. Vérifiez les actions en attente avant de sortir."
          badge="Déconnexion professeur"
          danger={missionCount > 0 || taskCount > 0}
          notices={[
            missionCount > 0 ? `${missionCount} mission(s) demandent encore votre attention.` : "Aucune mission urgente n'est signalée dans ce bandeau.",
            taskCount > 0 ? `${taskCount} tâche(s) restent à traiter.` : "Les tâches déjà terminées restent historisées.",
            messageCount > 0 ? `${messageCount} message(s) admin restent à consulter.` : "Vous pourrez reprendre vos échanges à la prochaine connexion.",
          ]}
          confirmLabel="Me déconnecter"
          cancelLabel="Rester connecté"
          onConfirm={() => signOut({ callbackUrl: "/professeur/connexion" })}
          trigger={
            <Button
              variant="outline"
              className="w-full rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          }
        />
      </div>
    </div>
  );
}

function MobileBottomNav({
  pathname,
  notificationCount,
  messageCount,
}: {
  pathname: string | null;
  notificationCount: number;
  messageCount: number;
}) {
  return (
    <nav
      className="fixed inset-x-3 z-40 rounded-lg border border-[#E1E7F2] bg-white px-2 py-2 lg:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigation professeur mobile"
    >
      <div className="grid grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold transition-colors",
                active ? "bg-[#111B4D] text-white" : "bg-white text-[#64748B] hover:bg-white hover:text-[#111B4D]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
              {item.href === "/professeur/messages" && !!messageCount && (
                <span
                  className={cn(
                    "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-semibold",
                    active ? "bg-white text-[#111B4D]" : "bg-[#111B4D] text-white",
                  )}
                >
                  {messageCount > 9 ? "9+" : messageCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MiniCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white px-2 py-2">
      <p className="text-sm font-semibold text-[#111B4D]">{value > 99 ? "99+" : value}</p>
      <p className="truncate text-[10px] font-semibold text-[#64748B]">{label}</p>
    </div>
  );
}

function SidebarSignal({
  href,
  label,
  value,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  value: number;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-10 items-center justify-between rounded-lg border px-2.5 text-xs font-semibold transition-colors",
        active
          ? "border-[#111B4D] bg-[#111B4D] text-white"
          : "border-[#E6EAF3] bg-white text-[#475569] hover:border-[#111B4D] hover:text-[#111B4D]",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn(
        "ml-2 rounded-lg px-1.5 py-0.5 text-[11px] font-bold",
        active ? "bg-white text-[#111B4D]" : "bg-white text-[#111B4D] ring-1 ring-[#E6EAF3]",
      )}>
        {value > 99 ? "99+" : value}
      </span>
    </Link>
  );
}
