import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { ProfessorImage } from "@/components/shared/professor-image";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, Clock, ExternalLink, Phone, ReceiptText, Unlock, Wallet } from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDate, timeAgo } from "@/lib/format";
import { getTeacherFinancialSettlement, isTeacherPartiallyPaid } from "@/lib/teacher-payments";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { PayTeacherButton } from "./pay-button";

export const dynamic = "force-dynamic";

export default async function AdminPaiementsALibererPage() {
  await requireAdmin();
  const now = new Date();
  const rawBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: "TO_PAY_TEACHER" }),
    orderBy: { clientValidatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      teacherPaymentAdjustments: { orderBy: { createdAt: "desc" } },
    },
    take: 200,
  });
  const bookings = rawBookings.filter(hasVerifiedPayDunyaClientPayment);

  const paymentRows = bookings
    .map((booking) => {
      const settlement = getTeacherFinancialSettlement(booking, booking.teacherPaymentAdjustments);
      return {
        booking,
        paid: settlement.paid,
        retained: settlement.retained,
        remaining: settlement.remaining,
        partiallyPaid: isTeacherPartiallyPaid(booking) || settlement.retained > 0,
      };
    })
    .filter((row) => row.remaining > 0);

  const totalNet = paymentRows.reduce((s, row) => s + row.remaining, 0);
  const totalPaidPartial = paymentRows.reduce((s, row) => s + row.paid, 0);
  const totalRetained = paymentRows.reduce((s, row) => s + row.retained, 0);
  const partialRows = paymentRows.filter((row) => row.partiallyPaid);
  const oldRows = paymentRows.filter((row) => row.booking.clientValidatedAt && hoursSince(row.booking.clientValidatedAt, now) >= 48);

  return (
    <div className="space-y-5">
      <PageHeader title="Paiements à libérer" description="Réservations validées par le client, prêtes à payer au professeur" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Net total à payer" value={formatFCFA(totalNet)} icon={Banknote} tone="primary" />
        <StatCard label="Réservations à payer" value={paymentRows.length} icon={Clock} tone="warning" />
        <StatCard label="Déjà versé partiel" value={formatFCFA(totalPaidPartial)} icon={ReceiptText} />
        <StatCard label="À prioriser" value={oldRows.length} icon={AlertTriangle} tone={oldRows.length ? "danger" : "default"} />
      </div>

      {paymentRows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <SignalCard
            title="Retenues appliquées"
            value={formatFCFA(totalRetained)}
            description="Montants déjà justifiés par sanction, litige ou décision admin."
            tone={totalRetained ? "red" : "blue"}
          />
          <SignalCard
            title="Paiements partiels"
            value={`${partialRows.length} réservation${partialRows.length > 1 ? "s" : ""}`}
            description="Dossiers avec versement déjà enregistré ou retenue impactant le net."
            tone={partialRows.length ? "amber" : "blue"}
          />
          <SignalCard
            title="Validation ancienne"
            value={`${oldRows.length} dossier${oldRows.length > 1 ? "s" : ""}`}
            description="Client a validé depuis plus de 48h : paiement professeur à traiter rapidement."
            tone={oldRows.length ? "violet" : "blue"}
          />
        </div>
      )}

      <div className="rounded-lg border border-amber-100 bg-amber-50/55 p-4 text-sm text-amber-950/80">
        <p className="font-bold text-amber-950">Règle de libération</p>
        <p className="mt-1">
          Le paiement professeur est libérable uniquement après validation client ou décision admin. Les retenues restent
          manuelles, justifiées, et visibles dans la comptabilité du professeur.
        </p>
      </div>

      {paymentRows.length === 0 ? (
        <EmptyState icon={Unlock} title="Aucun paiement à libérer" description="Aucune réservation n'attend un paiement professeur." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {paymentRows.map(({ booking: b, paid, retained, remaining, partiallyPaid }) => (
              <Card key={b.id} className="border-violet-100 bg-white">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfessorImage
                        photoUrl={b.teacher.photoUrl}
                        name={b.teacher.professionalName || b.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={b.teacher.badgeVerified}
                      />
                      <div className="min-w-0">
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=paiements&bookingId=${b.id}`} className="block truncate text-sm font-bold text-foreground">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="truncate">{b.client.name}</span>
                          {b.teacher.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {b.teacher.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/admin/reservations/${b.id}`} className="rounded-full bg-violet-50 px-2.5 py-1 font-mono text-[11px] font-bold text-violet-700">
                      {b.reference}
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                    <BookingStatusBadge status={b.status} />
                    {b.clientValidatedAt && (
                      <Badge variant="outline" className={hoursSince(b.clientValidatedAt, now) >= 48 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                        Validé {timeAgo(b.clientValidatedAt)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <MobileAmount label="Déjà payé" amount={paid} muted={paid === 0} />
                    <MobileAmount label="Reste net" amount={remaining} strong />
                    {retained > 0 && <MobileAmount label="Retenu" amount={retained} danger />}
                    <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Validation client</p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {b.clientValidatedAt ? timeAgo(b.clientValidatedAt) : "À vérifier"}
                      </p>
                    </div>
                  </div>

                  {partiallyPaid && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Paiement partiel ou retenue déjà enregistré.
                    </p>
                  )}

                  <ReleaseActions
                    bookingId={b.id}
                    teacherId={b.teacher.id}
                    amount={remaining}
                    teacherName={b.teacher.professionalName || b.teacher.fullName}
                    compact
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden lg:table-cell">Validé le</TableHead>
                  <TableHead className="hidden xl:table-cell">Statut cours</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Déjà payé</TableHead>
                  <TableHead className="text-right">Reste à payer</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.map(({ booking: b, paid, retained, remaining, partiallyPaid }) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/admin/reservations/${b.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{b.reference}</Link>
                      {partiallyPaid && <p className="mt-1 text-[11px] font-semibold text-amber-700">Paiement partiel</p>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <ProfessorImage
                          photoUrl={b.teacher.photoUrl}
                          name={b.teacher.professionalName || b.teacher.fullName}
                          size="sm"
                          shape="circle"
                          verified={b.teacher.badgeVerified}
                        />
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=paiements&bookingId=${b.id}`} className="hover:text-primary">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </Link>
                      </div>
                      {b.teacher.phone && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {b.teacher.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{b.client.name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {b.clientValidatedAt ? `${formatDate(b.clientValidatedAt)} (${timeAgo(b.clientValidatedAt)})` : "—"}
                      {b.clientValidatedAt && hoursSince(b.clientValidatedAt, now) >= 48 && (
                        <p className="mt-1 text-[11px] font-bold text-amber-700">Paiement à prioriser</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <BookingStatusBadge status={b.status} />
                    </TableCell>
                        <TableCell className="hidden xl:table-cell text-right">
                          <Money amount={paid} className="text-sm" muted={paid === 0} />
                          {retained > 0 && <p className="text-[11px] text-red-700">Retenu: <Money amount={retained} /></p>}
                        </TableCell>
                    <TableCell className="text-right"><Money amount={remaining} className="text-sm font-semibold" /></TableCell>
                    <TableCell className="text-right">
                      <ReleaseActions
                        bookingId={b.id}
                        teacherId={b.teacher.id}
                        amount={remaining}
                        teacherName={b.teacher.professionalName || b.teacher.fullName}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function hoursSince(date: Date, now: Date) {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function SignalCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: "amber" | "blue" | "red" | "violet";
}) {
  const toneClass = {
    amber: "border-amber-100 bg-amber-50/80 text-amber-950",
    blue: "border-blue-100 bg-blue-50/75 text-blue-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
    violet: "border-violet-100 bg-violet-50/75 text-violet-950",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-75">{description}</p>
    </div>
  );
}

function ReleaseActions({
  bookingId,
  teacherId,
  amount,
  teacherName,
  compact,
}: {
  bookingId: string;
  teacherId: string;
  amount: number;
  teacherName: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap justify-end gap-2"}>
      <PayTeacherButton bookingId={bookingId} amount={amount} teacherName={teacherName} />
      <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`}>
          <Wallet className="mr-1.5 h-4 w-4" />
          Comptabilité
        </Link>
      </Button>
      <Button asChild size="sm" variant="secondary" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/reservations/${bookingId}`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Dossier
        </Link>
      </Button>
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
    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Money
        amount={amount}
        className={`mt-1 text-sm ${strong ? "font-black" : "font-semibold"} ${danger ? "text-red-700" : ""}`}
        muted={muted}
      />
    </div>
  );
}
