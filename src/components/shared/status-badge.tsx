import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Ban, RefreshCw, DollarSign, Lock, Unlock } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";

const bookingStatusConfig: Record<BookingStatus, { label: string; className: string; icon?: any }> = {
  PENDING_PAYMENT: { label: "Brouillon non réservé", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Clock },
  PAID: { label: "Payée", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  PENDING_ADMIN_VALIDATION: { label: "En attente validation service client", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: Clock },
  CONFIRMED: { label: "Confirmée", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  ASSIGNED: { label: "Affectée au professeur", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  IN_PROGRESS: { label: "En cours", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: Clock },
  COURSE_DONE: { label: "Cours effectué", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  PENDING_CLIENT_VALIDATION: { label: "En attente validation client", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Clock },
  VALIDATED_BY_CLIENT: { label: "Validée par le client", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  PAYMENT_TO_RELEASE: { label: "Paiement à libérer", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Unlock },
  TEACHER_PAID: { label: "Professeur payé", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: DollarSign },
  DISPUTED: { label: "Litige", className: "bg-white text-[#B42318] border-[#E3E8F2]", icon: AlertTriangle },
  CANCELLED: { label: "Annulée", className: "bg-white text-[#64748B] border-[#E3E8F2]", icon: Ban },
  REFUNDED: { label: "Remboursée", className: "bg-white text-[#64748B] border-[#E3E8F2]", icon: RefreshCw },
};

const clientBookingStatusLabels: Partial<Record<BookingStatus, string>> = {
  PENDING_PAYMENT: "Brouillon non réservé",
  PAID: "Réservation reçue",
  PENDING_ADMIN_VALIDATION: "Validation en cours",
  CONFIRMED: "Réservation confirmée",
  ASSIGNED: "Professeur confirmé",
  IN_PROGRESS: "Cours en cours",
  COURSE_DONE: "Cours effectué",
  PENDING_CLIENT_VALIDATION: "Votre confirmation attendue",
  VALIDATED_BY_CLIENT: "Cours confirmé",
  PAYMENT_TO_RELEASE: "Traitement service client",
  TEACHER_PAID: "Cours clôturé",
  DISPUTED: "Litige en cours",
  CANCELLED: "Réservation annulée",
  REFUNDED: "Remboursement traité",
};

const clientBookingStatusClasses: Partial<Record<BookingStatus, string>> = {
  PENDING_PAYMENT: "bg-white text-[#111B4D] border-[#E3E8F2]",
  PENDING_CLIENT_VALIDATION: "bg-white text-[#111B4D] border-[#E3E8F2]",
  PAYMENT_TO_RELEASE: "bg-white text-[#111B4D] border-[#E3E8F2]",
  DISPUTED: "bg-white text-[#111B4D] border-[#E3E8F2]",
  CANCELLED: "bg-white text-[#64748B] border-[#E3E8F2]",
  REFUNDED: "bg-white text-[#64748B] border-[#E3E8F2]",
};

const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string; icon?: any }> = {
  FAILED: { label: "Paiement non finalisé", className: "bg-white text-[#B42318] border-[#E3E8F2]", icon: XCircle },
  RECEIVED: { label: "Paiement reçu", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  BLOCKED: { label: "Fonds bloqués", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Lock },
  VALIDATED: { label: "Fonds validés", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: CheckCircle2 },
  TO_PAY_TEACHER: { label: "À payer au professeur", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Unlock },
  TEACHER_PAID: { label: "Professeur payé", className: "bg-white text-[#111B4D] border-[#E3E8F2]", icon: DollarSign },
  DISPUTED: { label: "En litige", className: "bg-white text-[#B42318] border-[#E3E8F2]", icon: AlertTriangle },
  REFUND_PENDING: { label: "Remboursement à traiter", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: RefreshCw },
  PARTIAL_REFUND_PENDING: { label: "Remboursement partiel à traiter", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: RefreshCw },
  REFUNDED: { label: "Remboursé", className: "bg-white text-[#64748B] border-[#E3E8F2]", icon: RefreshCw },
  PARTIALLY_REFUNDED: { label: "Remboursé partiel", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: RefreshCw },
  RETAINED: { label: "Frais retenus", className: "bg-white text-[#8A4B05] border-[#E3E8F2]", icon: Lock },
};

const clientPaymentStatusLabels: Partial<Record<PaymentStatus, string>> = {
  FAILED: "Paiement à finaliser",
  RECEIVED: "Paiement reçu",
  BLOCKED: "Paiement sécurisé",
  VALIDATED: "Cours validé",
  TO_PAY_TEACHER: "Traitement service client",
  TEACHER_PAID: "Cours clôturé",
  DISPUTED: "Litige en cours",
  REFUND_PENDING: "Remboursement en traitement",
  PARTIAL_REFUND_PENDING: "Remboursement partiel en traitement",
  REFUNDED: "Remboursé",
  PARTIALLY_REFUNDED: "Remboursement partiel",
  RETAINED: "Frais appliqués",
};

const clientPaymentStatusClasses: Partial<Record<PaymentStatus, string>> = {
  FAILED: "bg-white text-[#111B4D] border-[#E3E8F2]",
  BLOCKED: "bg-white text-[#111B4D] border-[#E3E8F2]",
  TO_PAY_TEACHER: "bg-white text-[#111B4D] border-[#E3E8F2]",
  DISPUTED: "bg-white text-[#111B4D] border-[#E3E8F2]",
  REFUND_PENDING: "bg-white text-[#111B4D] border-[#E3E8F2]",
  PARTIAL_REFUND_PENDING: "bg-white text-[#111B4D] border-[#E3E8F2]",
  REFUNDED: "bg-white text-[#64748B] border-[#E3E8F2]",
  PARTIALLY_REFUNDED: "bg-white text-[#111B4D] border-[#E3E8F2]",
  RETAINED: "bg-white text-[#111B4D] border-[#E3E8F2]",
};

type StatusBadgeAudience = "admin" | "client";

export function BookingStatusBadge({ status, className, audience = "admin" }: { status: BookingStatus; className?: string; audience?: StatusBadgeAudience }) {
  const cfg = bookingStatusConfig[status];
  const Icon = cfg.icon;
  const label = audience === "client" ? (clientBookingStatusLabels[status] ?? cfg.label) : cfg.label;
  const statusClassName = audience === "client"
    ? (clientBookingStatusClasses[status] ?? "bg-white text-[#111B4D] border-[#E3E8F2]")
    : cfg.className;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", statusClassName, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
  className,
  audience = "admin",
  quoteOnly = false,
}: {
  status: PaymentStatus;
  className?: string;
  audience?: StatusBadgeAudience;
  quoteOnly?: boolean;
}) {
  if (quoteOnly) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[#E3E8F2] bg-white px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-[#111B4D]", className)}>
        <Clock className="h-3 w-3" />
        Sur devis
      </span>
    );
  }
  const cfg = paymentStatusConfig[status];
  const Icon = cfg.icon;
  const label = audience === "client" ? (clientPaymentStatusLabels[status] ?? cfg.label) : cfg.label;
  const statusClassName = audience === "client"
    ? (clientPaymentStatusClasses[status] ?? "bg-white text-[#111B4D] border-[#E3E8F2]")
    : cfg.className;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", statusClassName, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function TeacherStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Actif", className: "bg-white text-[#111B4D] border-[#E3E8F2]" },
    INACTIVE: { label: "Inactif", className: "bg-white text-[#64748B] border-[#E3E8F2]" },
    SUSPENDED: { label: "Suspendu", className: "bg-white text-[#B42318] border-[#E3E8F2]" },
    PENDING: { label: "En attente", className: "bg-white text-[#8A4B05] border-[#E3E8F2]" },
    TEMPORARILY_SUSPENDED: { label: "Suspendu temporairement", className: "bg-white text-[#B42318] border-[#E3E8F2]" },
    PERMANENTLY_SUSPENDED: { label: "Suspendu définitivement", className: "bg-white text-[#B42318] border-[#E3E8F2]" },
    OBSERVATION: { label: "En observation", className: "bg-white text-[#8A4B05] border-[#E3E8F2]" },
    REPLACEABLE: { label: "Remplaçable", className: "bg-white text-[#111B4D] border-[#E3E8F2]" },
    PRIORITY: { label: "Prioritaire", className: "bg-white text-[#111B4D] border-[#E3E8F2]" },
    BLACKLISTED: { label: "Blacklisté", className: "bg-slate-950 text-white border-slate-950" },
  };
  const cfg = map[status] ?? map.INACTIVE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold", cfg.className)}>
      {cfg.label}
    </span>
  );
}
