import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeacherQualityScore, TeacherStatusBadge } from "@/components/admin/teacher-operational-components";
import { computeTeacherQualityScore } from "@/lib/teacher-operations";
import { getTeacherAdjustedPayable, getTeacherPaidAmount, getTeacherRemainingAmount } from "@/lib/teacher-payments";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { AlertTriangle, Bell, ClipboardList, Eye, RefreshCw, ShieldAlert, Siren, UserX, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuiviProfesseursPage() {
  await requireAdmin();

  const teachers = await db.teacher.findMany({
    include: {
      subjects: { include: { subject: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } } },
        take: 200,
      },
      warnings: { orderBy: { createdAt: "desc" }, take: 50 },
      sanctions: { orderBy: { createdAt: "desc" }, take: 50 },
      oldReplacements: { orderBy: { createdAt: "desc" }, take: 50 },
      tasks: { orderBy: { createdAt: "desc" }, take: 50 },
      paymentAdjustments: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
  });
  const activeStatuses = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"];
  const teacherRows = teachers.map((teacher) => {
    const primary = teacher.subjects.find((subject) => subject.isPrimary)?.subject.name ?? teacher.subjects[0]?.subject.name ?? "—";
    const realized = teacher.bookings.filter((booking) => ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status)).length;
    const late = teacher.tasks.filter((task) => task.status === "LATE").length;
    const criticalTasks = teacher.tasks.filter((task) => task.priority === "CRITICAL" && !["DONE", "CANCELLED"].includes(task.status)).length;
    const openTasks = teacher.tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
    const cancelled = teacher.bookings.filter((booking) => booking.status === "CANCELLED").length;
    const disputes = teacher.bookings.filter((booking) => booking.status === "DISPUTED" || booking.paymentStatus === "DISPUTED").length;
    const verifiedBookings = teacher.bookings.filter(hasVerifiedPayDunyaClientPayment);
    const blocked = verifiedBookings.filter((booking) => booking.paymentStatus === "BLOCKED").reduce((sum, booking) => sum + booking.teacherNetAmount, 0);
    const paid = verifiedBookings.reduce((sum, booking) => sum + getTeacherPaidAmount(booking), 0);
    const grossToPay = verifiedBookings
      .filter((booking) => booking.paymentStatus === "TO_PAY_TEACHER")
      .reduce((sum, booking) => sum + getTeacherRemainingAmount(booking), 0);
    const toPay = getTeacherAdjustedPayable(grossToPay, teacher.paymentAdjustments);
    const activeBooking = teacher.bookings.find((booking) => activeStatuses.includes(booking.status));
    const score = computeTeacherQualityScore({
      rating: teacher.rating,
      bookings: teacher.bookings,
      warnings: teacher.warnings,
      sanctions: teacher.sanctions,
      replacements: teacher.oldReplacements,
    });
    const riskPoints =
      (score < 60 ? 3 : score < 75 ? 2 : 0) +
      (criticalTasks > 0 ? 3 : 0) +
      (late > 0 ? 2 : 0) +
      (disputes > 0 ? 2 : 0) +
      (teacher.sanctions.length > 0 ? 2 : 0) +
      (["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "OBSERVATION"].includes(teacher.status) ? 3 : 0);
    const risk: "OK" | "WATCH" | "CRITICAL" = riskPoints >= 6 ? "CRITICAL" : riskPoints >= 3 ? "WATCH" : "OK";
    const decision = getTeacherFollowUpDecision({
      teacherId: teacher.id,
      status: teacher.status,
      risk,
      score,
      criticalTasks,
      late,
      disputes,
      sanctionsCount: teacher.sanctions.length,
      toPay,
      blocked,
      activeBookingId: activeBooking?.id ?? null,
    });

    return {
      teacher,
      primary,
      realized,
      late,
      criticalTasks,
      openTasks,
      cancelled,
      disputes,
      blocked,
      paid,
      toPay,
      activeBooking,
      score,
      risk,
      decision,
    };
  });
  const highRiskCount = teacherRows.filter((row) => row.risk === "CRITICAL").length;
  const watchCount = teacherRows.filter((row) => row.risk === "WATCH").length;
  const totalBlocked = teacherRows.reduce((sum, row) => sum + row.blocked, 0);
  const totalToPay = teacherRows.reduce((sum, row) => sum + row.toPay, 0);
  const totalOpenTasks = teacherRows.reduce((sum, row) => sum + row.openTasks, 0);
  const replacementCandidates = teacherRows.filter((row) => row.activeBooking && ["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED"].includes(row.teacher.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Suivi des professeurs" description="Pilotage qualité, tâches, incidents, paiements et actions rapides par professeur." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Risque critique" value={`${highRiskCount}`} detail={`${watchCount} profil(s) à surveiller`} tone={highRiskCount ? "red" : "blue"} icon={AlertTriangle} />
        <SummaryCard label="Tâches ouvertes" value={`${totalOpenTasks}`} detail="À suivre ou relancer" tone={totalOpenTasks ? "amber" : "blue"} icon={ClipboardList} />
        <SummaryCard label="Remplacements potentiels" value={`${replacementCandidates}`} detail="Prof suspendu avec cours actif" tone={replacementCandidates ? "red" : "violet"} icon={RefreshCw} />
        <SummaryCard label="Fonds bloqués" value={<Money amount={totalBlocked} />} detail="Net professeur sécurisé" tone="violet" icon={Wallet} />
        <SummaryCard label="À payer" value={<Money amount={totalToPay} />} detail="Comptabilité interne" tone={totalToPay ? "amber" : "blue"} icon={Wallet} />
      </div>

      <div className="grid gap-3 md:hidden">
        {teacherRows.map(({ teacher, primary, realized, late, criticalTasks, openTasks, cancelled, disputes, blocked, paid, toPay, activeBooking, score, risk, decision }) => {
          return (
            <Card key={teacher.id} className="border-violet-100 bg-white">
              <CardContent className="space-y-4 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfessorImage photoUrl={teacher.photoUrl} name={teacher.professionalName || teacher.fullName} size="md" shape="circle" verified={teacher.badgeVerified} />
                    <div className="min-w-0">
                      <Link href={`/admin/professeurs/${teacher.id}`} className="block truncate text-sm font-bold text-foreground">
                        {teacher.professionalName || teacher.fullName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{primary} · {teacher.commune ?? "Abidjan"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <TeacherStatusBadge status={teacher.status} />
                    <RiskBadge risk={risk} />
                  </div>
                </div>

                <TeacherQualityScore score={score} />

                <div className={decision.tone === "red" ? "rounded-lg border border-red-100 bg-red-50/75 p-4" : decision.tone === "amber" ? "rounded-lg border border-amber-100 bg-amber-50/75 p-4" : "rounded-lg border border-blue-100 bg-blue-50/65 p-4"}>
                  <p className={decision.tone === "red" ? "text-xs font-bold uppercase tracking-wide text-red-900/65" : decision.tone === "amber" ? "text-xs font-bold uppercase tracking-wide text-amber-900/65" : "text-xs font-bold uppercase tracking-wide text-blue-900/65"}>
                    Action recommandée
                  </p>
                  <p className={decision.tone === "red" ? "mt-1 text-sm font-black text-red-950" : decision.tone === "amber" ? "mt-1 text-sm font-black text-amber-950" : "mt-1 text-sm font-black text-blue-950"}>
                    {decision.title}
                  </p>
                  <p className={decision.tone === "red" ? "mt-1 text-xs text-red-950/72" : decision.tone === "amber" ? "mt-1 text-xs text-amber-950/72" : "mt-1 text-xs text-blue-950/72"}>
                    {decision.description}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3 h-10 w-full rounded-lg bg-white">
                    <Link href={decision.href}>{decision.actionLabel}</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Cours</p>
                    <p className="mt-1 font-black tabular-nums">{teacher.bookings.length}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Réalisés</p>
                    <p className="mt-1 font-black tabular-nums">{realized}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Retards</p>
                    <p className="mt-1 font-black tabular-nums">{late}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Tâches</p>
                    <p className="mt-1 font-black tabular-nums">{openTasks}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Annul.</p>
                    <p className="mt-1 font-black tabular-nums">{cancelled}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Litiges</p>
                    <p className="mt-1 font-black tabular-nums">{disputes}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Avert.</p>
                    <p className="mt-1 font-black tabular-nums">{teacher.warnings.length}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-2 py-2">
                    <p className="text-[11px] text-muted-foreground">Critiques</p>
                    <p className="mt-1 font-black tabular-nums">{criticalTasks}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-violet-100 bg-violet-50/45 px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Fonds bloqués</p>
                    <Money amount={blocked} className="mt-1 text-xs font-black" />
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-violet-50/45 px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">À payer</p>
                    <Money amount={toPay} className="mt-1 text-xs font-black" />
                    {paid > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Payé: {paid.toLocaleString("fr-FR")} FCFA</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}`}><Eye className="mr-1.5 h-4 w-4" /> Fiche</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=notify`}><Bell className="mr-1.5 h-4 w-4" /> Notifier</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=warning`}><Siren className="mr-1.5 h-4 w-4" /> Avertir</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=sanction`}><ShieldAlert className="mr-1.5 h-4 w-4" /> Sanction</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=paiements`}><Wallet className="mr-1.5 h-4 w-4" /> Payer</Link>
                  </Button>
                  {activeBooking && (
                    <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                      <Link href={`/admin/reservations/${activeBooking.id}?action=replace`}><RefreshCw className="mr-1.5 h-4 w-4" /> Remplacer</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=suspend`}><UserX className="mr-1.5 h-4 w-4" /> Suspendre</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-10 flex-1 rounded-lg">
                    <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=block`}><ShieldAlert className="mr-1.5 h-4 w-4" /> Bloquer</Link>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Dernière activité : {teacher.lastActivityAt ? teacher.lastActivityAt.toLocaleDateString("fr-FR") : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Risque</TableHead>
                <TableHead>Action recommandée</TableHead>
                <TableHead>Score qualité</TableHead>
                <TableHead className="text-right">Cours</TableHead>
                <TableHead className="text-right">Réalisés</TableHead>
                <TableHead className="text-right">Retards</TableHead>
                <TableHead className="text-right">Tâches</TableHead>
                <TableHead className="text-right">Annulations</TableHead>
                <TableHead className="text-right">Litiges</TableHead>
                <TableHead className="text-right">Avert.</TableHead>
                <TableHead className="text-right">Fonds bloqués</TableHead>
                <TableHead className="text-right">À payer</TableHead>
                <TableHead>Dernière activité</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherRows.map(({ teacher, primary, realized, late, openTasks, cancelled, disputes, blocked, paid, toPay, activeBooking, score, risk, decision }) => {
                return (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <div className="flex min-w-64 items-center gap-3">
                        <ProfessorImage photoUrl={teacher.photoUrl} name={teacher.professionalName || teacher.fullName} size="sm" shape="circle" verified={teacher.badgeVerified} />
                        <div className="min-w-0">
                          <Link href={`/admin/professeurs/${teacher.id}`} className="inline-flex min-h-10 max-w-full items-center truncate text-sm font-semibold text-foreground hover:text-primary">
                            {teacher.professionalName || teacher.fullName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{primary} · {teacher.commune ?? "Abidjan"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><TeacherStatusBadge status={teacher.status} /></TableCell>
                    <TableCell><RiskBadge risk={risk} /></TableCell>
                    <TableCell className="min-w-60">
                      <Link href={decision.href} className="block rounded-lg border border-violet-100 bg-violet-50/35 px-3 py-2 transition hover:bg-violet-50">
                        <p className="text-xs font-black text-foreground">{decision.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{decision.description}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-40"><TeacherQualityScore score={score} /></TableCell>
                    <TableCell className="text-right tabular-nums">{teacher.bookings.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{realized}</TableCell>
                    <TableCell className="text-right tabular-nums">{late}</TableCell>
                    <TableCell className="text-right tabular-nums">{openTasks}</TableCell>
                    <TableCell className="text-right tabular-nums">{cancelled}</TableCell>
                    <TableCell className="text-right tabular-nums">{disputes}</TableCell>
                    <TableCell className="text-right tabular-nums">{teacher.warnings.length}</TableCell>
                    <TableCell className="text-right"><Money amount={blocked} /></TableCell>
                    <TableCell className="text-right">
                      <Money amount={toPay} />
                      {paid > 0 && <p className="text-[11px] text-muted-foreground">Payé: <Money amount={paid} /></p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{teacher.lastActivityAt ? teacher.lastActivityAt.toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" title="Voir fiche">
                          <Link href={`/admin/professeurs/${teacher.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Notifier">
                          <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=notify`}><Bell className="h-4 w-4" /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Avertir">
                          <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=warning`}><Siren className="h-4 w-4" /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Sanctionner">
                          <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=sanction`}><ShieldAlert className="h-4 w-4" /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Payer">
                          <Link href={`/admin/professeurs/${teacher.id}?tab=paiements`}><Wallet className="h-4 w-4" /></Link>
                        </Button>
                        {activeBooking && (
                          <Button asChild variant="ghost" size="icon" title="Remplacer sur réservation active">
                            <Link href={`/admin/reservations/${activeBooking.id}?action=replace`}><RefreshCw className="h-4 w-4" /></Link>
                          </Button>
                        )}
                        <Button asChild variant="ghost" size="icon" title="Suspendre">
                          <Link href={`/admin/professeurs/${teacher.id}?tab=operationnel&action=suspend`}><UserX className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  tone: "blue" | "violet" | "amber" | "red";
  icon: any;
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-950",
    violet: "border-violet-100 bg-violet-50/70 text-violet-950",
    amber: "border-amber-100 bg-amber-50/75 text-amber-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
  }[tone];
  const iconClass = {
    blue: "text-blue-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
        </div>
        <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{detail}</p>
    </div>
  );
}

function getTeacherFollowUpDecision({
  teacherId,
  status,
  risk,
  score,
  criticalTasks,
  late,
  disputes,
  sanctionsCount,
  toPay,
  blocked,
  activeBookingId,
}: {
  teacherId: string;
  status: string;
  risk: "OK" | "WATCH" | "CRITICAL";
  score: number;
  criticalTasks: number;
  late: number;
  disputes: number;
  sanctionsCount: number;
  toPay: number;
  blocked: number;
  activeBookingId: string | null;
}) {
  const restrictive = ["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED"].includes(status);
  if (restrictive && activeBookingId) {
    return {
      tone: "red" as const,
      title: "Remplacement à préparer",
      description: "Statut bloquant avec réservation active. Vérifier la mission, avertir le client si besoin et remplacer le professeur.",
      href: `/admin/reservations/${activeBookingId}?action=replace`,
      actionLabel: "Remplacer",
    };
  }
  if (disputes > 0) {
    return {
      tone: "red" as const,
      title: "Litige à arbitrer",
      description: "Un litige touche ce professeur. Suspendre tout paiement sensible jusqu'à décision admin.",
      href: `/admin/professeurs/${teacherId}?tab=discipline`,
      actionLabel: "Voir discipline",
    };
  }
  if (criticalTasks > 0) {
    return {
      tone: "red" as const,
      title: "Tâches critiques à traiter",
      description: "Des tâches critiques sont ouvertes. Relancer le professeur ou organiser un remplacement.",
      href: `/admin/professeurs/${teacherId}?tab=taches`,
      actionLabel: "Voir tâches",
    };
  }
  if (late > 0 || score < 60) {
    return {
      tone: "amber" as const,
      title: "Avertissement recommandé",
      description: "Retards ou score faible détectés. Consigner un avertissement et mettre le professeur en observation si nécessaire.",
      href: `/admin/professeurs/${teacherId}?tab=operationnel&action=warning`,
      actionLabel: "Avertir",
    };
  }
  if (sanctionsCount > 0 || risk === "WATCH") {
    return {
      tone: "amber" as const,
      title: "Suivi qualité renforcé",
      description: "Le professeur demande un contrôle régulier avant nouvelles attributions sensibles.",
      href: `/admin/professeurs/${teacherId}?tab=operationnel&action=observe`,
      actionLabel: "Mettre en observation",
    };
  }
  if (toPay > 0) {
    return {
      tone: "blue" as const,
      title: "Paiement à contrôler",
      description: "Un montant est prêt à payer. Vérifier validations, retenues et historique avant versement.",
      href: `/admin/professeurs/${teacherId}?tab=paiements`,
      actionLabel: "Comptabilité",
    };
  }
  if (blocked > 0) {
    return {
      tone: "blue" as const,
      title: "Fonds bloqués à suivre",
      description: "Des fonds restent sécurisés. Attendre validation client/admin ou traiter l'incident associé.",
      href: `/admin/professeurs/${teacherId}?tab=paiements`,
      actionLabel: "Suivre fonds",
    };
  }
  return {
    tone: "blue" as const,
    title: "Dossier stable",
    description: "Aucune action urgente. Le professeur peut rester dans le flux opérationnel normal.",
    href: `/admin/professeurs/${teacherId}?tab=operationnel`,
    actionLabel: "Ouvrir fiche",
  };
}

function RiskBadge({ risk }: { risk: "OK" | "WATCH" | "CRITICAL" }) {
  const config = {
    OK: "border-blue-200 bg-blue-50 text-blue-800",
    WATCH: "border-amber-200 bg-amber-50 text-amber-800",
    CRITICAL: "border-red-200 bg-red-50 text-red-700",
  }[risk];
  const label = {
    OK: "Stable",
    WATCH: "À surveiller",
    CRITICAL: "Critique",
  }[risk];

  return (
    <Badge variant="outline" className={config}>
      {label}
    </Badge>
  );
}
