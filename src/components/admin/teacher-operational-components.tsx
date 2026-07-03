import Link from "next/link";
import type {
  AdminActionLog,
  TeacherReplacement,
  TeacherSanction,
  TeacherTask,
  TeacherWarning,
} from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileWarning,
  History,
  Lock,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { qualityScoreLabel, qualityScoreTone } from "@/lib/teacher-operations";
import {
  teacherSanctionTypeLabel,
  teacherWarningLevelLabel,
} from "@/lib/teacher-discipline-labels";
import { replacementReasonLabel } from "@/lib/platform-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherTaskActionsClient } from "@/components/admin/teacher-task-actions-client";
import { ReplacementHistoryActionsClient } from "@/components/admin/replacement-history-actions-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfessorImage } from "@/components/shared/professor-image";

export function TeacherStatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Actif", className: "bg-blue-50 text-blue-800 border-blue-200" },
    INACTIVE: { label: "Inactif", className: "bg-slate-100 text-slate-600 border-slate-200" },
    PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" },
    SUSPENDED: { label: "Suspendu", className: "bg-red-50 text-red-700 border-red-200" },
    TEMPORARILY_SUSPENDED: { label: "Suspendu temporairement", className: "bg-red-50 text-red-700 border-red-200" },
    PERMANENTLY_SUSPENDED: { label: "Suspendu définitivement", className: "bg-red-100 text-red-800 border-red-200" },
    OBSERVATION: { label: "En observation", className: "bg-amber-50 text-amber-800 border-amber-200" },
    REPLACEABLE: { label: "Remplaçable", className: "bg-violet-50 text-violet-800 border-violet-200" },
    PRIORITY: { label: "Prioritaire", className: "bg-blue-50 text-blue-800 border-blue-200" },
    BLACKLISTED: { label: "Blacklisté", className: "bg-slate-950 text-white border-slate-950" },
  };
  const cfg = map[status] ?? map.INACTIVE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-sm", cfg.className, className)}>
      {cfg.label}
    </span>
  );
}

export function TeacherQualityScore({ score }: { score: number }) {
  const tone = qualityScoreTone(score);
  const color = {
    blue: "from-blue-700 to-violet-600 text-white",
    violet: "from-[#1E2A78] to-violet-600 text-white",
    amber: "from-amber-200 to-amber-100 text-amber-900",
    orange: "from-orange-200 to-orange-100 text-orange-900",
    red: "from-red-200 to-red-100 text-red-900",
  }[tone];
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score qualité</p>
          <p className="mt-1 text-sm text-muted-foreground">{qualityScoreLabel(score)}</p>
        </div>
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-black shadow-sm", color)}>
          {score}
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-violet-50">
        <div className="h-full rounded-full premium-gradient" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

const TASK_PRIORITY_LABELS: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  SENT_TO_TEACHER: "Envoyée au professeur",
  SEEN_BY_TEACHER: "Vue par le professeur",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
  LATE: "En retard",
  NOT_DONE: "Non réalisée",
  CANCELLED: "Annulée",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  CONTACT_CLIENT: "Contacter le client",
  CONFIRM_AVAILABILITY: "Confirmer disponibilité",
  GO_TO_COURSE: "Se rendre au cours",
  SEND_ONLINE_LINK: "Envoyer le lien du cours",
  TEACH_COURSE: "Faire le cours",
  REPORT_COURSE_DONE: "Signaler cours terminé",
  JUSTIFY_DELAY: "Justifier un retard",
  ANSWER_DISPUTE: "Répondre à un litige",
  SEND_DOCUMENT: "Envoyer un document",
  CONFIRM_RESCHEDULE: "Confirmer un report",
  CONTACT_ADMIN: "Contacter l'administration",
  ADMIN_ACTION: "Action administrative",
};

export function TeacherTaskCard({
  task,
  teacherName,
  teacherPhone,
}: {
  task: TeacherTask;
  teacherName: string;
  teacherPhone?: string | null;
}) {
  const priorityClass = {
    NORMAL: "bg-blue-50 text-blue-700 border-blue-200",
    IMPORTANT: "bg-violet-50 text-violet-700 border-violet-200",
    URGENT: "bg-amber-50 text-amber-800 border-amber-200",
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
  }[task.priority] ?? "bg-slate-50 text-slate-700 border-slate-200";
  const statusClass = {
    TODO: "border-violet-200 bg-violet-50 text-violet-800",
    SENT_TO_TEACHER: "border-blue-200 bg-blue-50 text-blue-800",
    SEEN_BY_TEACHER: "border-blue-200 bg-blue-50 text-blue-800",
    CONFIRMED: "border-blue-200 bg-blue-50 text-blue-800",
    IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
    DONE: "border-blue-200 bg-blue-50 text-blue-800",
    LATE: "border-red-200 bg-red-50 text-red-700",
    NOT_DONE: "border-red-200 bg-red-50 text-red-700",
    CANCELLED: "border-slate-200 bg-slate-50 text-slate-700",
  }[task.status] ?? "border-slate-200 bg-slate-50 text-slate-700";
  const typeLabel = TASK_TYPE_LABELS[task.type] ?? "Tâche opérationnelle";
  const priorityLabel = TASK_PRIORITY_LABELS[task.priority] ?? task.priority;
  const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2 border-slate-200 bg-slate-50 text-slate-700">{typeLabel}</Badge>
          <p className="font-semibold text-foreground">{task.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        </div>
        <Badge variant="outline" className={priorityClass}>{priorityLabel}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {task.dueAt ? formatDateTime(task.dueAt) : "Sans échéance"}
        </span>
      </div>
      <TeacherTaskActionsClient
        task={{
          id: task.id,
          bookingId: task.bookingId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueAt: task.dueAt?.toISOString() ?? null,
        }}
        teacherName={teacherName}
        teacherPhone={teacherPhone}
      />
    </div>
  );
}

export function OperationalAlertCard({
  title,
  description,
  tone = "violet",
  href,
}: {
  title: string;
  description: string;
  tone?: "violet" | "amber" | "red" | "blue";
  href?: string;
}) {
  const styles = {
    violet: "border-violet-100 bg-violet-50/70 text-violet-800",
    amber: "border-amber-100 bg-amber-50/80 text-amber-900",
    red: "border-red-100 bg-red-50/80 text-red-800",
    blue: "border-blue-100 bg-blue-50/80 text-blue-800",
  }[tone];
  const content = (
    <div className={cn("rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", styles)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-80">{description}</p>
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function TeacherPaymentSummary({
  blocked,
  toPay,
  netToPay,
  paid,
  appliedAdjustments,
  pendingAdjustments,
}: {
  blocked: number;
  toPay: number;
  netToPay: number;
  paid: number;
  appliedAdjustments: number;
  pendingAdjustments: number;
}) {
  const items = [
    { label: "Fonds bloqués", value: blocked, icon: Lock, tone: "text-violet-700" },
    { label: "Brut dû", value: toPay, icon: Wallet, tone: "text-amber-700" },
    { label: "Net à payer", value: netToPay, icon: Wallet, tone: "text-blue-700" },
    { label: "Déjà payé", value: paid, icon: CheckCircle2, tone: "text-blue-700" },
    { label: "Retenues appliquées", value: appliedAdjustments, icon: ShieldAlert, tone: "text-red-700" },
    { label: "Retenues en attente", value: pendingAdjustments, icon: ShieldAlert, tone: "text-amber-700" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm">
          <item.icon className={cn("h-5 w-5", item.tone)} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-bold text-foreground">{formatFCFA(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

export function ReplacementHistoryTable({
  replacements,
}: {
  replacements: (TeacherReplacement & {
    booking: { reference: string; client?: { name: string; phone: string | null } | null };
    oldTeacher: { fullName: string; professionalName: string | null; photoUrl?: string | null; phone?: string | null };
    newTeacher: { fullName: string; professionalName: string | null; photoUrl?: string | null; phone?: string | null };
  })[];
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Historique des remplacements</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 p-4 md:hidden">
          {replacements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
              Aucun remplacement enregistré.
            </p>
          ) : (
            replacements.map((replacement) => (
              <div key={replacement.id} className="space-y-3 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-primary">{replacement.booking.reference}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(replacement.createdAt)}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-violet-200 bg-violet-50 text-violet-800">
                    {replacementReasonLabel(replacement.reason)}
                  </Badge>
                </div>
                <p className="rounded-2xl border border-violet-100 bg-violet-50/35 p-3 text-xs text-muted-foreground">
                  {replacement.details || "Aucun détail interne renseigné."}
                  {replacement.financialImpact !== 0 ? ` Impact financier : ${formatFCFA(replacement.financialImpact)}.` : ""}
                </p>
                <div className="grid gap-2">
                  <div className="rounded-2xl border border-violet-100 bg-white/85 px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Ancien professeur</p>
                    <TeacherReplacementPerson teacher={replacement.oldTeacher} tone="muted" />
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Nouveau professeur</p>
                    <TeacherReplacementPerson teacher={replacement.newTeacher} />
                  </div>
                </div>
                <ReplacementHistoryActionsClient
                  targets={[
                    { label: "Client", message: replacement.clientMessage, phone: replacement.booking.client?.phone },
                    { label: "Ancien professeur", message: replacement.oldTeacherMessage, phone: replacement.oldTeacher.phone },
                    { label: "Nouveau professeur", message: replacement.newTeacherMessage, phone: replacement.newTeacher.phone },
                  ]}
                />
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réservation</TableHead>
              <TableHead>Ancien prof</TableHead>
              <TableHead>Nouveau prof</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replacements.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucun remplacement enregistré.</TableCell></TableRow>
            )}
            {replacements.map((replacement) => (
              <TableRow key={replacement.id}>
                <TableCell className="font-mono text-sm">{replacement.booking.reference}</TableCell>
                <TableCell><TeacherReplacementPerson teacher={replacement.oldTeacher} tone="muted" /></TableCell>
                <TableCell><TeacherReplacementPerson teacher={replacement.newTeacher} /></TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="outline">{replacementReasonLabel(replacement.reason)}</Badge>
                    {replacement.financialImpact !== 0 && (
                      <p className="text-xs text-muted-foreground">Impact {formatFCFA(replacement.financialImpact)}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(replacement.createdAt)}</TableCell>
                <TableCell className="min-w-[260px]">
                  <ReplacementHistoryActionsClient
                    targets={[
                      { label: "Client", message: replacement.clientMessage, phone: replacement.booking.client?.phone },
                      { label: "Ancien professeur", message: replacement.oldTeacherMessage, phone: replacement.oldTeacher.phone },
                      { label: "Nouveau professeur", message: replacement.newTeacherMessage, phone: replacement.newTeacher.phone },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TeacherReplacementPerson({
  teacher,
  tone = "default",
}: {
  teacher: { fullName: string; professionalName: string | null; photoUrl?: string | null; badgeVerified?: boolean };
  tone?: "default" | "muted";
}) {
  const name = teacher.professionalName || teacher.fullName;
  return (
    <div className="mt-1 flex min-w-0 items-center gap-2">
      <ProfessorImage
        photoUrl={teacher.photoUrl ?? null}
        name={name}
        size="sm"
        shape="circle"
        verified={Boolean(teacher.badgeVerified)}
      />
      <p className={cn("truncate text-sm font-bold", tone === "muted" ? "text-muted-foreground" : "text-foreground")}>
        {name}
      </p>
    </div>
  );
}

export function TeacherActivityTimeline({
  logs,
  warnings,
  sanctions,
}: {
  logs: AdminActionLog[];
  warnings: TeacherWarning[];
  sanctions: TeacherSanction[];
}) {
  const items = [
    ...logs.map((log) => ({ id: log.id, date: log.createdAt, icon: History, title: log.action, detail: log.detail })),
    ...warnings.map((warning) => ({ id: warning.id, date: warning.createdAt, icon: FileWarning, title: teacherWarningLevelLabel(warning.level), detail: warning.description })),
    ...sanctions.map((sanction) => ({ id: sanction.id, date: sanction.createdAt, icon: ShieldAlert, title: teacherSanctionTypeLabel(sanction.type), detail: sanction.description || sanction.reason })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Journal d'activité professeur</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(item.date)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminActionLog({ logs }: { logs: AdminActionLog[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Journal admin</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 p-4 md:hidden">
          {logs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
              Aucun log.
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="space-y-3 rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{log.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                  {(log.oldStatus || log.newStatus) && (
                    <Badge variant="outline" className="shrink-0 border-violet-200 bg-violet-50 text-violet-800">
                      {log.oldStatus || "—"} {log.newStatus ? `→ ${log.newStatus}` : ""}
                    </Badge>
                  )}
                </div>
                <p className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3 text-sm text-muted-foreground">
                  {log.detail || "Aucun détail renseigné."}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Détail</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Aucun log.</TableCell></TableRow>}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.action}</TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground">{log.detail}</TableCell>
                <TableCell className="text-sm">{log.oldStatus || "—"} {log.newStatus ? `→ ${log.newStatus}` : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
