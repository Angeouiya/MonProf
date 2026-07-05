"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Lock,
  MessageCircle,
  PhoneCall,
  ShieldAlert,
  Siren,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";

type TeacherControlBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  clientName: string;
  dateLabel: string;
  timeLabel: string;
  status: string;
  paymentStatus: string;
  remainingAmount: number;
};

type TeacherControlPanelClientProps = {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  teacherStatus: string;
  qualityScore: number;
  coursesToday: number;
  activeBookingsCount: number;
  openTasksCount: number;
  lateTasks: number;
  criticalTasks: number;
  warningsCount: number;
  sanctionsCount: number;
  replacementsCount: number;
  disputedBookingsCount: number;
  blockedFunds: number;
  validatedFunds: number;
  netToPay: number;
  alreadyPaid: number;
  totalNet: number;
  payableReservationsCount: number;
  blockedReservationsCount: number;
  validatedReservationsCount: number;
  retainedAmount: number;
  pendingAdjustments: number;
  nextBooking?: TeacherControlBooking | null;
};

function buildDecision({
  teacherStatus,
  criticalTasks,
  lateTasks,
  activeBookingsCount,
  warningsCount,
  sanctionsCount,
  disputedBookingsCount,
  blockedFunds,
  netToPay,
}: Pick<TeacherControlPanelClientProps, "teacherStatus" | "criticalTasks" | "lateTasks" | "activeBookingsCount" | "warningsCount" | "sanctionsCount" | "disputedBookingsCount" | "blockedFunds" | "netToPay">) {
  if (["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "INACTIVE"].includes(teacherStatus)) {
    return activeBookingsCount > 0
      ? "Vérifier les réservations actives et préparer un remplacement si nécessaire."
      : "Aucune nouvelle attribution tant que le statut restrictif reste actif.";
  }
  if (disputedBookingsCount > 0) return "Traiter les litiges liés au professeur avant paiement ou nouvelle attribution sensible.";
  if (sanctionsCount > 0) return "Contrôler les sanctions actives avant toute mission prioritaire.";
  if (warningsCount >= 3) return "Professeur à surveiller : avertissements répétés, privilégier une validation admin renforcée.";
  if (criticalTasks > 0) return "Traiter les tâches critiques avant toute nouvelle attribution.";
  if (lateTasks > 0) return "Relancer le professeur et vérifier les réservations liées aux retards.";
  if (netToPay > 0) return "Contrôler les validations et enregistrer le versement professeur si tout est conforme.";
  if (blockedFunds > 0) return "Suivre la confirmation client/admin avant libération des fonds.";
  return "Dossier stable : le professeur peut continuer à recevoir des missions.";
}

function riskLabel({
  teacherStatus,
  criticalTasks,
  lateTasks,
  warningsCount,
  sanctionsCount,
  disputedBookingsCount,
}: Pick<TeacherControlPanelClientProps, "teacherStatus" | "criticalTasks" | "lateTasks" | "warningsCount" | "sanctionsCount" | "disputedBookingsCount">) {
  if (["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "INACTIVE"].includes(teacherStatus)) {
    return { label: "Statut bloquant", className: "border-red-200 bg-red-50 text-red-800" };
  }
  if (criticalTasks > 0 || disputedBookingsCount > 0 || sanctionsCount > 0) {
    return { label: "Contrôle requis", className: "border-red-200 bg-red-50 text-red-800" };
  }
  if (lateTasks > 0 || warningsCount >= 2) {
    return { label: "À surveiller", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return { label: "Sous contrôle", className: "border-blue-200 bg-blue-50 text-blue-800" };
}

export function TeacherControlPanelClient({
  teacherId,
  teacherName,
  teacherPhone,
  teacherStatus,
  qualityScore,
  coursesToday,
  activeBookingsCount,
  openTasksCount,
  lateTasks,
  criticalTasks,
  warningsCount,
  sanctionsCount,
  replacementsCount,
  disputedBookingsCount,
  blockedFunds,
  validatedFunds,
  netToPay,
  alreadyPaid,
  totalNet,
  payableReservationsCount,
  blockedReservationsCount,
  validatedReservationsCount,
  retainedAmount,
  pendingAdjustments,
  nextBooking,
}: TeacherControlPanelClientProps) {
  const decision = buildDecision({
    teacherStatus,
    criticalTasks,
    lateTasks,
    activeBookingsCount,
    warningsCount,
    sanctionsCount,
    disputedBookingsCount,
    blockedFunds,
    netToPay,
  });
  const risk = riskLabel({
    teacherStatus,
    criticalTasks,
    lateTasks,
    warningsCount,
    sanctionsCount,
    disputedBookingsCount,
  });
  const payoutProgress = totalNet > 0 ? Math.min(100, Math.round((alreadyPaid / totalNet) * 100)) : 0;
  const financialPressure = netToPay > 0 || blockedFunds > 0 || validatedFunds > 0;
  const briefing = useMemo(() => {
    const nextMissionLines = nextBooking
      ? [
          `Prochaine mission : ${nextBooking.reference}`,
          `Client : ${nextBooking.clientName}`,
          `Cours : ${nextBooking.subjectName} - ${nextBooking.levelName}`,
          `Créneau : ${nextBooking.dateLabel}${nextBooking.timeLabel ? ` à ${nextBooking.timeLabel}` : ""}`,
          `Reste comptable lié : ${formatFCFA(nextBooking.remainingAmount)}`,
        ]
      : ["Prochaine mission : aucune mission active datée."];

    return [
      `Briefing professeur - ${teacherName}`,
      "",
      `Statut : ${teacherStatus}`,
      `Score qualité : ${qualityScore}/100`,
      `Réservations actives : ${activeBookingsCount}`,
      `Cours aujourd'hui : ${coursesToday}`,
      `Tâches ouvertes : ${openTasksCount}`,
      `Tâches critiques : ${criticalTasks}`,
      `Tâches en retard : ${lateTasks}`,
      `Litiges liés : ${disputedBookingsCount}`,
      `Avertissements : ${warningsCount}`,
      `Sanctions : ${sanctionsCount}`,
      `Remplacements causés : ${replacementsCount}`,
      "",
      "Comptabilité interne :",
      `Net historique professeur : ${formatFCFA(totalNet)}`,
      `Déjà versé : ${formatFCFA(alreadyPaid)}`,
      `Fonds bloqués : ${formatFCFA(blockedFunds)}`,
      `Fonds validés : ${formatFCFA(validatedFunds)}`,
      `Reste dû interne : ${formatFCFA(netToPay)}`,
      `Réservations prêtes à payer : ${payableReservationsCount}`,
      `Réservations encore bloquées : ${blockedReservationsCount}`,
      `Réservations validées non libérées : ${validatedReservationsCount}`,
      `Retenues appliquées : ${formatFCFA(retainedAmount)}`,
      `Retenues en attente admin : ${formatFCFA(pendingAdjustments)}`,
      `Progression versement : ${payoutProgress}%`,
      "",
      ...nextMissionLines,
      "",
      `Décision admin recommandée : ${decision}`,
      "",
      "Action : ouvrir la fiche professeur pour notifier, avertir, suspendre, remplacer ou enregistrer un paiement si nécessaire.",
    ].join("\n");
  }, [
    activeBookingsCount,
    alreadyPaid,
    blockedFunds,
    blockedReservationsCount,
    coursesToday,
    criticalTasks,
    decision,
    disputedBookingsCount,
    lateTasks,
    netToPay,
    nextBooking,
    openTasksCount,
    payableReservationsCount,
    pendingAdjustments,
    payoutProgress,
    qualityScore,
    replacementsCount,
    retainedAmount,
    sanctionsCount,
    teacherName,
    teacherStatus,
    totalNet,
    validatedFunds,
    validatedReservationsCount,
    warningsCount,
  ]);
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, briefing);
  const hasRisk = risk.label !== "Sous contrôle";

  const copyBriefing = async () => {
    await navigator.clipboard.writeText(briefing);
    toast.success("Briefing professeur copié.");
  };

  return (
    <Card className="overflow-hidden border-violet-100 bg-white">
      <CardHeader className="border-b border-violet-100 bg-violet-50/55">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {hasRisk ? <ShieldAlert className="h-4 w-4 text-red-700" /> : <Wallet className="h-4 w-4 text-[#1E2A78]" />}
              Centre de contrôle professeur
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Synthèse exploitable pour décider, copier le dossier et transmettre les informations sans perdre le fil opérationnel.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="outline" className="w-fit border-violet-200 bg-white text-violet-800">
              Comptabilité agence, sans wallet
            </Badge>
            <Button type="button" variant="outline" onClick={copyBriefing}>
              <ClipboardCopy className="mr-1.5 h-4 w-4" />
              Copier briefing
            </Button>
            {whatsAppUrl ? (
              <Button asChild type="button" variant="outline" className="border-blue-100 text-blue-800 hover:bg-blue-50">
                <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <PhoneCall className="mr-1.5 h-4 w-4" />
                Téléphone absent
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="rounded-3xl border border-blue-100 bg-blue-50/65 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Décision immédiate</p>
              <p className="mt-1 text-sm font-black text-blue-950">{decision}</p>
            </div>
            <Badge variant="outline" className={`w-fit ${risk.className}`}>
              {risk.label}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ControlTile label="Actives" value={activeBookingsCount} detail={`${coursesToday} cours aujourd'hui`} />
          <ControlTile label="Tâches" value={openTasksCount} detail={`${criticalTasks} critique(s), ${lateTasks} retard(s)`} danger={criticalTasks > 0 || lateTasks > 0} />
          <ControlTile label="Fonds bloqués" value={formatFCFA(blockedFunds)} detail="En attente validation" />
          <ControlTile label="Reste dû interne" value={formatFCFA(netToPay)} detail={`Déjà versé ${formatFCFA(alreadyPaid)}`} danger={netToPay > 0} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-violet-100 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-foreground">Chaîne agence du professeur</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lecture directe : mission affectée, fonds sécurisés, versement interne et contrôle qualité.
                </p>
              </div>
              <Badge variant="outline" className={financialPressure ? "w-fit border-amber-200 bg-amber-50 text-amber-800" : "w-fit border-blue-200 bg-blue-50 text-blue-800"}>
                {financialPressure ? "Flux financier actif" : "Flux financier calme"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <FlowStep icon={CheckCircle2} label="Missions" value={`${activeBookingsCount} active(s)`} active={activeBookingsCount > 0} />
              <FlowStep icon={Lock} label="Bloqué" value={formatFCFA(blockedFunds)} active={blockedFunds > 0} tone="violet" />
              <FlowStep icon={Wallet} label="À payer" value={formatFCFA(netToPay)} active={netToPay > 0} tone="amber" />
              <FlowStep icon={CheckCircle2} label="Payé" value={`${payoutProgress}%`} active={payoutProgress > 0} tone="blue" />
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-amber-950">Contrôles avant attribution/paiement</p>
                <p className="mt-1 text-sm text-amber-950/72">Points que l'admin doit voir avant d'envoyer une mission ou libérer de l'argent.</p>
              </div>
              <Siren className="h-5 w-5 text-amber-700" />
            </div>
            <div className="mt-4 grid gap-2">
              <ControlCheck label="Litiges" value={disputedBookingsCount} danger={disputedBookingsCount > 0} />
              <ControlCheck label="Avertissements" value={warningsCount} danger={warningsCount >= 2} />
              <ControlCheck label="Sanctions" value={sanctionsCount} danger={sanctionsCount > 0} />
              <ControlCheck label="Remplacements causés" value={replacementsCount} danger={replacementsCount > 0} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-blue-950">
                <Banknote className="h-4 w-4 text-[#1E2A78]" />
                Solde interne agence
              </p>
              <p className="mt-1 text-sm text-blue-950/70">
                Pas de wallet professeur : l'admin enregistre un versement réel, le montant est imputé aux réservations, puis le reste dû est recalculé automatiquement.
              </p>
            </div>
            <Badge variant="outline" className={netToPay > 0 ? "w-fit border-amber-200 bg-amber-50 text-amber-800" : "w-fit border-blue-200 bg-blue-50 text-blue-800"}>
              {netToPay > 0 ? `${payableReservationsCount} ligne(s) payable(s)` : "Aucun versement immédiat"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <AccountingTile label="Payables" value={payableReservationsCount} detail={formatFCFA(netToPay)} tone={netToPay > 0 ? "amber" : "blue"} />
            <AccountingTile label="Bloquées" value={blockedReservationsCount} detail={formatFCFA(blockedFunds)} tone={blockedFunds > 0 ? "violet" : "blue"} />
            <AccountingTile label="Validées" value={validatedReservationsCount} detail={formatFCFA(validatedFunds)} tone={validatedFunds > 0 ? "amber" : "blue"} />
            <AccountingTile label="Retenues" value={formatFCFA(retainedAmount)} detail={pendingAdjustments > 0 ? `${formatFCFA(pendingAdjustments)} en attente` : "Aucune attente"} tone={retainedAmount > 0 || pendingAdjustments > 0 ? "red" : "blue"} />
            <AccountingTile label="Déjà payé" value={formatFCFA(alreadyPaid)} detail={`${payoutProgress}% du net`} tone="blue" />
          </div>
        </div>

        {nextBooking && (
          <div className="grid gap-3 rounded-3xl border border-violet-100 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-primary">{nextBooking.reference}</p>
              <p className="mt-1 truncate text-sm font-black text-foreground">
                {nextBooking.subjectName} - {nextBooking.levelName} avec {nextBooking.clientName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextBooking.dateLabel}{nextBooking.timeLabel ? ` à ${nextBooking.timeLabel}` : ""} · reste {formatFCFA(nextBooking.remainingAmount)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href={`/admin/professeurs/${teacherId}?tab=cours&bookingId=${nextBooking.id}`}>
                  Mission <ExternalLink className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href={`/admin/professeurs/${teacherId}?tab=paiements&bookingId=${nextBooking.id}`}>
                  Versements <ExternalLink className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlowStep({
  icon: Icon,
  label,
  value,
  active,
  tone = "blue",
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  active: boolean;
  tone?: "blue" | "violet" | "amber";
}) {
  const className = {
    blue: active ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-600",
    violet: active ? "border-violet-200 bg-violet-50 text-violet-900" : "border-slate-200 bg-slate-50 text-slate-600",
    amber: active ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-3 ${className}`}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function ControlCheck({ label, value, danger }: { label: string; value: number; danger: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white px-3 py-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <Badge variant="outline" className={danger ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}>
        {value}
      </Badge>
    </div>
  );
}

function AccountingTile({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "violet" | "amber" | "red";
}) {
  const className = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-950",
    violet: "border-violet-100 bg-violet-50/70 text-violet-950",
    amber: "border-amber-100 bg-amber-50/75 text-amber-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-3 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-65">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-72">{detail}</p>
    </div>
  );
}

function ControlTile({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "rounded-3xl border border-amber-100 bg-amber-50/75 p-4" : "rounded-3xl border border-violet-100 bg-violet-50/35 p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={danger ? "text-xs font-bold uppercase tracking-wide text-amber-950/60" : "text-xs font-bold uppercase tracking-wide text-violet-950/55"}>
            {label}
          </p>
          <p className={danger ? "mt-1 text-xl font-black text-amber-950" : "mt-1 text-xl font-black text-violet-950"}>{value}</p>
        </div>
        {danger && <AlertTriangle className="h-5 w-5 text-amber-700" />}
      </div>
      <p className={danger ? "mt-2 text-xs font-medium text-amber-950/72" : "mt-2 text-xs font-medium text-violet-950/68"}>{detail}</p>
    </div>
  );
}
