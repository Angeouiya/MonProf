import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Ban, RefreshCw, DollarSign, Lock, Unlock } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";

const bookingStatusConfig: Record<BookingStatus, { label: string; className: string; icon?: any }> = {
  PENDING_PAYMENT: { label: "En attente de paiement", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  PAID: { label: "Payée", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  PENDING_ADMIN_VALIDATION: { label: "En attente validation admin", className: "bg-purple-50 text-purple-700 border-purple-200", icon: Clock },
  CONFIRMED: { label: "Confirmée", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  ASSIGNED: { label: "Affectée au professeur", className: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: CheckCircle2 },
  IN_PROGRESS: { label: "En cours", className: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Clock },
  COURSE_DONE: { label: "Cours effectué", className: "bg-teal-50 text-teal-700 border-teal-200", icon: CheckCircle2 },
  PENDING_CLIENT_VALIDATION: { label: "En attente validation client", className: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock },
  VALIDATED_BY_CLIENT: { label: "Validée par le client", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  PAYMENT_TO_RELEASE: { label: "Paiement à libérer", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Unlock },
  TEACHER_PAID: { label: "Professeur payé", className: "bg-green-50 text-green-700 border-green-200", icon: DollarSign },
  DISPUTED: { label: "Litige", className: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  CANCELLED: { label: "Annulée", className: "bg-gray-100 text-gray-600 border-gray-200", icon: Ban },
  REFUNDED: { label: "Remboursée", className: "bg-gray-100 text-gray-600 border-gray-200", icon: RefreshCw },
};

const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string; icon?: any }> = {
  FAILED: { label: "Paiement échoué", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  RECEIVED: { label: "Paiement reçu", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  BLOCKED: { label: "Fonds bloqués", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Lock },
  VALIDATED: { label: "Fonds validés", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  TO_PAY_TEACHER: { label: "À payer au professeur", className: "bg-orange-50 text-orange-700 border-orange-200", icon: Unlock },
  TEACHER_PAID: { label: "Professeur payé", className: "bg-green-50 text-green-700 border-green-200", icon: DollarSign },
  DISPUTED: { label: "En litige", className: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  REFUNDED: { label: "Remboursé", className: "bg-gray-100 text-gray-600 border-gray-200", icon: RefreshCw },
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const cfg = bookingStatusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", cfg.className, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const cfg = paymentStatusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", cfg.className, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

export function TeacherStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Actif", className: "bg-green-50 text-green-700 border-green-200" },
    INACTIVE: { label: "Inactif", className: "bg-gray-100 text-gray-600 border-gray-200" },
    SUSPENDED: { label: "Suspendu", className: "bg-red-50 text-red-700 border-red-200" },
    PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  };
  const cfg = map[status] ?? map.INACTIVE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}
