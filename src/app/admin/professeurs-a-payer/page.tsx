import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, CheckCircle2, Clock, Phone, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { formatDate, formatFCFA } from "@/lib/format";
import { getTeacherAdjustedPayable, getTeacherFinancialSettlement, isTeacherPartiallyPaid } from "@/lib/teacher-payments";
import { paymentMethodLabel } from "@/lib/platform-labels";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { PayAllTeacherButton } from "./pay-all-button";
import { CopyTeacherPaymentSummaryButton } from "./copy-summary-button";

export const dynamic = "force-dynamic";

export default async function AdminProfesseursAPayerPage() {
  await requireAdmin();
  const rawBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: "TO_PAY_TEACHER" }),
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          phone: true,
          badgeVerified: true,
          payoutRecords: {
            orderBy: { paidAt: "desc" },
            take: 1,
            select: { reference: true, amount: true, method: true, paidAt: true },
          },
          paymentAdjustments: { select: { amount: true, status: true, bookingId: true } },
        },
      },
      client: { select: { name: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
    },
    orderBy: { clientValidatedAt: "desc" },
    take: 200,
  });
  const bookings = rawBookings.filter(hasVerifiedPayDunyaClientPayment);

  const rows = bookings
    .map((booking) => {
      const settlement = getTeacherFinancialSettlement(booking, booking.teacher.paymentAdjustments);
      return {
        booking,
        paid: settlement.paid,
        retained: settlement.retained,
        remaining: settlement.remaining,
        partiallyPaid: isTeacherPartiallyPaid(booking) || settlement.retained > 0,
      };
    })
    .filter((row) => row.remaining > 0);

  // Group by teacher
  const byTeacher = new Map<string, { teacher: any; rows: typeof rows; grossTotal: number; total: number; retainedTotal: number; pendingRetentions: number }>();
  for (const row of rows) {
    const b = row.booking;
    const key = b.teacherId;
    if (!byTeacher.has(key)) {
      const pendingRetentions = b.teacher.paymentAdjustments
        .filter((adjustment) => adjustment.status === "PENDING")
        .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
      byTeacher.set(key, { teacher: b.teacher, rows: [], grossTotal: 0, total: 0, retainedTotal: 0, pendingRetentions });
    }
    const entry = byTeacher.get(key)!;
    entry.rows.push(row);
    entry.grossTotal += row.remaining;
    entry.retainedTotal += row.retained;
    entry.total = getTeacherAdjustedPayable(
      entry.grossTotal,
      b.teacher.paymentAdjustments.filter((adjustment) => !adjustment.bookingId),
    );
  }
  const groups = Array.from(byTeacher.values()).filter((group) => group.total > 0).sort((a, b) => b.total - a.total);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const grossGrandTotal = groups.reduce((s, g) => s + g.grossTotal, 0);
  const retainedGrandTotal = groups.reduce((s, g) => s + g.retainedTotal, 0);
  const pendingRetentionTotal = groups.reduce((s, g) => s + g.pendingRetentions, 0);
  const partialRowsCount = rows.filter((row) => row.partiallyPaid).length;
  const oldestWaiting = rows
    .map((row) => row.booking.clientValidatedAt ?? row.booking.updatedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Professeurs à payer" description="Regroupement des paiements à libérer par professeur" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Net total à payer" value={formatFCFA(grandTotal)} icon={Banknote} tone="primary" />
        <StatCard label="Brut avant ajustements" value={formatFCFA(grossGrandTotal)} icon={CheckCircle2} />
        <StatCard label="Retenues appliquées" value={formatFCFA(retainedGrandTotal)} icon={ShieldAlert} tone={retainedGrandTotal ? "danger" : "default"} />
        <StatCard label="Retenues en attente" value={formatFCFA(pendingRetentionTotal)} icon={AlertTriangle} tone={pendingRetentionTotal ? "warning" : "default"} />
        <StatCard label="Professeurs concernés" value={groups.length} icon={Users} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PaymentSignalCard
          label="Paiements partiels / retenues"
          value={`${partialRowsCount}`}
          detail="Réservations avec un paiement déjà partiel ou une retenue appliquée."
          tone={partialRowsCount ? "amber" : "blue"}
        />
        <PaymentSignalCard
          label="Plus ancien reste dû"
          value={oldestWaiting ? formatDate(oldestWaiting) : "—"}
          detail="Permet de prioriser les versements internes à traiter."
          tone={oldestWaiting ? "violet" : "blue"}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Banknote} title="Aucun professeur à payer" description="Tous les paiements ont été libérés." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const hasPartial = g.rows.some((row) => row.partiallyPaid);
            const hasPendingRetention = g.pendingRetentions > 0;
            return (
            <Card key={g.teacher.id}>
              <CardHeader className="flex flex-col gap-3 space-y-0 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <ProfessorImage
                    photoUrl={g.teacher.photoUrl}
                    name={g.teacher.professionalName || g.teacher.fullName}
                    size="sm"
                    shape="circle"
                    verified={g.teacher.badgeVerified}
                  />
                  <div>
                    <Link href={`/admin/professeurs/${g.teacher.id}?tab=paiements`} className="text-sm font-medium text-foreground hover:text-primary">
                      {g.teacher.professionalName || g.teacher.fullName}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{g.rows.length} cours avec reste dû</span>
                      {g.teacher.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {g.teacher.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hasPartial && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Paiement partiel / retenue</Badge>}
                      {hasPendingRetention && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Retenue à valider</Badge>}
                      {g.retainedTotal > 0 && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Retenu {formatFCFA(g.retainedTotal)}</Badge>}
                    </div>
                    <LastPayoutLine payout={g.teacher.payoutRecords[0]} />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Net à payer</p>
                    <p className="text-base font-semibold"><Money amount={g.total} /></p>
                    {g.grossTotal !== g.total && (
                      <p className="text-[11px] text-muted-foreground">Brut: <Money amount={g.grossTotal} /></p>
                    )}
                  </div>
                  <PayAllTeacherButton
                    teacherId={g.teacher.id}
                    total={g.total}
                    count={g.rows.length}
                    teacherName={g.teacher.professionalName || g.teacher.fullName}
                    teacherPhone={g.teacher.phone}
                    pendingRetentions={g.pendingRetentions}
                    retainedTotal={g.retainedTotal}
                  />
                  <CopyTeacherPaymentSummaryButton
                    teacherName={g.teacher.professionalName || g.teacher.fullName}
                    total={g.total}
                    grossTotal={g.grossTotal}
                    retainedTotal={g.retainedTotal}
                    pendingRetentions={g.pendingRetentions}
                    rows={g.rows.map(({ booking: b, paid, retained, remaining }) => ({
                      reference: b.reference,
                      clientName: b.client.name,
                      paid,
                      retained,
                      remaining,
                    }))}
                  />
                  <Button asChild variant="outline">
                    <Link href={`/admin/professeurs/${g.teacher.id}?tab=paiements`}>Comptabilité</Link>
                  </Button>
                </div>
            </CardHeader>
              <CardContent className="p-4 md:hidden">
                <div className="grid gap-3">
                  {g.rows.map(({ booking: b, paid, retained, remaining, partiallyPaid }) => (
                    <div key={b.id} className="rounded-3xl border border-violet-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-bold text-primary">
                            {b.reference}
                          </Link>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">{b.client.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {b.subjectName} - {b.levelName}
                          </p>
                          {partiallyPaid && (
                            <p className="mt-1 text-[11px] font-semibold text-amber-700">Partiel / retenue</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button asChild size="sm" variant="outline" className="rounded-2xl">
                            <Link href={`/admin/reservations/${b.id}`}>Voir</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="rounded-2xl">
                            <Link href={`/admin/professeurs/${g.teacher.id}?tab=paiements&bookingId=${b.id}`}>Compta</Link>
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MobileAmount label="Payé" amount={paid} muted={paid === 0} />
                        <MobileAmount label="Retenu" amount={retained} muted={retained === 0} danger={retained > 0} />
                        <MobileAmount label="Reste" amount={remaining} strong />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardContent className="hidden p-0 overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden xl:table-cell">Cours</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Déjà payé</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Retenue</TableHead>
                      <TableHead className="text-right">Reste dû</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map(({ booking: b, paid, retained, remaining, partiallyPaid }) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/admin/reservations/${b.id}`} className="text-primary hover:underline">{b.reference}</Link>
                          {partiallyPaid && <p className="mt-1 text-[11px] font-semibold text-amber-700">Partiel</p>}
                        </TableCell>
                        <TableCell className="text-sm">{b.client.name}</TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {b.subjectName} - {b.levelName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right">
                          <Money amount={paid} className="text-sm" muted={paid === 0} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right"><Money amount={retained} className="text-sm" muted={retained === 0} /></TableCell>
                        <TableCell className="text-right"><Money amount={remaining} className="text-sm font-medium" /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/admin/reservations/${b.id}`}>Voir</Link>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/professeurs/${g.teacher.id}?tab=paiements&bookingId=${b.id}`}>Compta</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LastPayoutLine({
  payout,
}: {
  payout?: { reference: string; amount: number; method: string | null; paidAt: Date } | null;
}) {
  if (!payout) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50/60 px-2.5 py-1 text-[11px] font-medium text-violet-900/75">
        <Clock className="h-3.5 w-3.5" />
        Aucun versement encore enregistré
      </p>
    );
  }

  return (
    <p className="mt-2 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-blue-100 bg-blue-50/70 px-2.5 py-1 text-[11px] font-medium text-blue-950/78">
      <Clock className="h-3.5 w-3.5" />
      <span>Dernier paiement : {formatFCFA(payout.amount)}</span>
      <span>· {paymentMethodLabel(payout.method)}</span>
      <span>· {formatDate(payout.paidAt)}</span>
      <span className="font-mono">{payout.reference}</span>
    </p>
  );
}

function PaymentSignalCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "violet" | "amber";
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-950",
    violet: "border-violet-100 bg-violet-50/70 text-violet-950",
    amber: "border-amber-100 bg-amber-50/75 text-amber-950",
  }[tone];
  return (
    <div className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-2 text-sm opacity-75">{detail}</p>
    </div>
  );
}

function MobileAmount({
  label,
  amount,
  muted,
  strong,
  danger,
}: {
  label: string;
  amount: number;
  muted?: boolean;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Money
        amount={amount}
        className={`mt-1 text-xs ${strong ? "font-black" : "font-semibold"} ${danger ? "text-red-700" : ""}`}
        muted={muted}
      />
    </div>
  );
}
