import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Info, ShieldAlert, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shared/back-button";
import { cn } from "@/lib/utils";

export const teacherBookingStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Brouillon non réservé",
  PAID: "Payée",
  PENDING_ADMIN_VALIDATION: "Validation service client",
  CONFIRMED: "Confirmée",
  ASSIGNED: "Attribuée",
  IN_PROGRESS: "En cours",
  COURSE_DONE: "Cours réalisé",
  PENDING_CLIENT_VALIDATION: "Attente validation client",
  VALIDATED_BY_CLIENT: "Validée par le client",
  PAYMENT_TO_RELEASE: "Paiement à libérer",
  TEACHER_PAID: "Payée au professeur",
  DISPUTED: "Litige",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  FAILED: "Non payé",
  RECEIVED: "Paiement reçu",
  BLOCKED: "Fonds bloqués",
  VALIDATED: "Validé",
  TO_PAY_TEACHER: "À payer au professeur",
  REFUND_PENDING: "Remboursement à traiter",
  PARTIAL_REFUND_PENDING: "Remboursement partiel à traiter",
  PARTIALLY_REFUNDED: "Partiellement remboursé",
  RETAINED: "Retenue appliquée",
  REJECTED: "Rejetée",
  PAYMENT_FAILED: "Paiement échoué",
  PAYMENT_PENDING: "Supplément à payer",
  AWAITING_TEACHER: "Réponse attendue",
  APPLIED: "Créneau modifié",
  TEACHER_REJECTED: "Créneau refusé",
  REFUND_REQUIRED: "Remboursement requis",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
  PENDING: "En attente",
  TEMPORARILY_SUSPENDED: "Suspendu temporairement",
  PERMANENTLY_SUSPENDED: "Suspendu définitivement",
  OBSERVATION: "En observation",
  REPLACEABLE: "Remplaçable",
  PRIORITY: "Prioritaire",
  BLACKLISTED: "Blacklisté",
};

export const teacherMissionStatusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "À confirmer",
  RELAUNCHED: "Relancée",
  CONFIRMED: "Confirmée",
  UNAVAILABLE: "Indisponible",
  PROBLEM_REPORTED: "Problème signalé",
  RESCHEDULE_PROPOSED: "Créneau proposé",
  EXPIRED: "Expirée",
  REPLACEMENT_RECOMMENDED: "Remplacement recommandé",
};

export const teacherTaskStatusLabels: Record<string, string> = {
  TODO: "À faire",
  SENT_TO_TEACHER: "Envoyée",
  SEEN_BY_TEACHER: "Vue",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
  LATE: "En retard",
  NOT_DONE: "Non réalisée",
  CANCELLED: "Annulée",
};

export const teacherTaskPriorityLabels: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

export function ProfessorPageHeader({
  title,
  description,
  action,
  showBack = true,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div data-app-page-header data-professor-page-header className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
      <div className="min-w-0">
        {showBack && (
          <div className="mb-2">
            <BackButton fallbackHref={backHref} label={backLabel} className="min-h-10 rounded-lg px-3" />
          </div>
        )}
        <h1 className="text-[1.38rem] font-semibold leading-[1.08] tracking-normal text-[#111827] min-[420px]:text-2xl lg:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">{description}</p>}
      </div>
      {action && <div data-professor-page-action className="grid w-full min-w-0 gap-2 min-[520px]:w-auto min-[520px]:grid-flow-col min-[640px]:shrink-0">{action}</div>}
    </div>
  );
}

export function ProfessorStatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: "calendar" | "wallet" | "clock" | "check" | "alert";
}) {
  const Icon = icon === "wallet"
    ? Wallet
    : icon === "clock"
      ? Clock
      : icon === "check"
        ? CheckCircle2
        : icon === "alert"
          ? ShieldAlert
          : CalendarClock;

  return (
    <div data-professor-stat-card className="min-w-0 rounded-lg border border-[#E6EAF3] bg-white p-3 min-[520px]:p-4">
      <div className="flex items-start justify-between gap-2.5 min-[520px]:gap-3">
        <div className="min-w-0">
          <p className="break-words text-[10px] font-semibold uppercase tracking-normal text-[#64748B] min-[420px]:text-[11px] min-[760px]:text-xs">{label}</p>
          <p className="mt-1 break-words text-xl font-semibold leading-tight tracking-normal text-[#111B4D] min-[420px]:text-2xl">{value}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white min-[420px]:h-10 min-[420px]:w-10">
          <Icon className="h-4 w-4 min-[420px]:h-5 min-[420px]:w-5" />
        </span>
      </div>
      {detail && <p className="mt-2 break-words text-[11px] font-semibold leading-4 text-[#64748B] min-[420px]:text-xs min-[420px]:leading-5">{detail}</p>}
    </div>
  );
}

export function PortalCard({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} data-professor-portal-card className={cn("rounded-lg border border-[#E6EAF3] bg-white p-3.5 min-[640px]:p-5", className)}>
      {children}
    </section>
  );
}

export function StatusPill({ status, type = "booking" }: { status: string; type?: "booking" | "mission" | "task" | "priority" }) {
  const label = type === "mission"
    ? teacherMissionStatusLabels[status] ?? status
    : type === "task"
      ? teacherTaskStatusLabels[status] ?? status
      : type === "priority"
        ? teacherTaskPriorityLabels[status] ?? status
        : teacherBookingStatusLabels[status] ?? status;
  const tone = getTone(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "danger" && "border-red-300 bg-white text-red-700",
        tone === "warning" && "border-amber-300 bg-white text-amber-800",
        tone === "success" && "border-blue-300 bg-white text-[#111B4D]",
        tone === "neutral" && "border-[#D7DEE9] bg-white text-[#475569]",
      )}
    >
      {label}
    </Badge>
  );
}

export function InfoLine({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div data-professor-info-line className="flex flex-col gap-1 border-b border-[#EEF2F7] py-2 last:border-0 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between min-[420px]:gap-3">
      <span className="min-w-0 text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</span>
      <span className="min-w-0 break-words text-sm font-bold text-[#111827] min-[420px]:text-right">{value || "—"}</span>
    </div>
  );
}

export function EmptyProfessorState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div data-professor-empty-state className="rounded-lg border border-dashed border-[#D7DEE9] bg-white p-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white">
        <Info className="h-5 w-5" />
      </div>
      <p className="mt-3 text-base font-semibold text-[#111827]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-6 text-[#64748B]">{description}</p>
      {href && actionLabel && (
        <Button asChild className="mt-4 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          <Link href={href}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function getTone(status: string) {
  if (["DISPUTED", "CANCELLED", "REFUNDED", "UNAVAILABLE", "PROBLEM_REPORTED", "EXPIRED", "REPLACEMENT_RECOMMENDED", "LATE", "NOT_DONE", "CRITICAL", "SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "FAILED", "REJECTED", "PAYMENT_FAILED", "TEACHER_REJECTED", "REFUND_REQUIRED"].includes(status)) {
    return "danger";
  }
  if (["PENDING_PAYMENT", "PAYMENT_PENDING", "PENDING_ADMIN_VALIDATION", "PENDING_CONFIRMATION", "AWAITING_TEACHER", "RELAUNCHED", "RESCHEDULE_PROPOSED", "TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "IMPORTANT", "URGENT", "PENDING", "OBSERVATION", "REPLACEABLE"].includes(status)) {
    return "warning";
  }
  if (["PAID", "CONFIRMED", "ASSIGNED", "COURSE_DONE", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID", "DONE", "NORMAL", "RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "ACTIVE", "PRIORITY", "APPLIED"].includes(status)) {
    return "success";
  }
  return "neutral";
}
