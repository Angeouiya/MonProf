import Link from "next/link";
import { AlertTriangle, Banknote, Clock, ExternalLink, Phone, ReceiptText, RefreshCw, Scale, ShieldCheck, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { cancellationActorLabel, cancellationWindowLabel } from "@/lib/cancellation-policy";
import { paymentMethodLabel } from "@/lib/platform-labels";
import { AdminRefundProcessButton } from "./refund-process-button";

export const dynamic = "force-dynamic";

const REFUND_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const;

type RefundBookingRow = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  paymentStatus: string;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationWindow: string | null;
  cancellationFeeAmount: number;
  cancellationFeeRate: number;
  cancellationRefundAmount: number;
  cancellationPenaltyTeacherAmount: number;
  cancellationPenaltyTeacherRate: number;
  cancellationPenaltyPlatformAmount: number;
  cancellationPenaltyPlatformRate: number;
  paymentServiceFeeAmount: number;
  client: { id: string; name: string | null; phone: string | null };
  teacher: {
    id: string;
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    phone: string | null;
    badgeVerified: boolean;
  };
  clientRefundRequests: {
    id: string;
    reference: string;
    amount: number;
    method: string;
    paymentPhone: string;
    accountName: string | null;
    status: string;
    externalReference: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }[];
};

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("FINANCE_VIEW");
  const sp = await searchParams;
  const selectedStatus = sp.status && REFUND_STATUSES.includes(sp.status as any) ? sp.status : "";

  const [refundRequests, cancellationBookings] = await db.$transaction([
    db.clientRefundRequest.findMany({
      where: selectedStatus ? { status: selectedStatus as any } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
            status: true,
            paymentStatus: true,
            cancelledAt: true,
            cancelledBy: true,
            cancellationWindow: true,
            cancellationFeeAmount: true,
            cancellationFeeRate: true,
            cancellationRefundAmount: true,
            cancellationPenaltyTeacherAmount: true,
            cancellationPenaltyTeacherRate: true,
            cancellationPenaltyPlatformAmount: true,
            cancellationPenaltyPlatformRate: true,
            paymentServiceFeeAmount: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
                professionalName: true,
                photoUrl: true,
                phone: true,
                badgeVerified: true,
              },
            },
          },
        },
      },
      take: 200,
    }),
    db.booking.findMany({
      where: {
        cancelledAt: { not: null },
        OR: [
          { cancellationRefundAmount: { gt: 0 } },
          { cancellationFeeAmount: { gt: 0 } },
          { cancellationPenaltyTeacherAmount: { gt: 0 } },
        ],
      },
      orderBy: { cancelledAt: "desc" },
      select: {
        id: true,
        reference: true,
        subjectName: true,
        levelName: true,
        paymentStatus: true,
        cancelledAt: true,
        cancelledBy: true,
        cancellationWindow: true,
        cancellationFeeAmount: true,
        cancellationFeeRate: true,
        cancellationRefundAmount: true,
        cancellationPenaltyTeacherAmount: true,
        cancellationPenaltyTeacherRate: true,
        cancellationPenaltyPlatformAmount: true,
        cancellationPenaltyPlatformRate: true,
        paymentServiceFeeAmount: true,
        client: { select: { id: true, name: true, phone: true } },
        teacher: {
          select: {
            id: true,
            fullName: true,
            professionalName: true,
            photoUrl: true,
            phone: true,
            badgeVerified: true,
          },
        },
        clientRefundRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            reference: true,
            amount: true,
            method: true,
            paymentPhone: true,
            accountName: true,
            status: true,
            externalReference: true,
            createdAt: true,
            processedAt: true,
          },
        },
      },
      take: 200,
    }),
  ]);

  const trackedBookings = new Map<string, RefundBookingRow>();
  for (const booking of cancellationBookings) trackedBookings.set(booking.id, booking);
  for (const request of refundRequests) {
    if (!trackedBookings.has(request.booking.id)) {
      trackedBookings.set(request.booking.id, {
        ...request.booking,
        client: request.client,
        clientRefundRequests: [{
          id: request.id,
          reference: request.reference,
          amount: request.amount,
          method: request.method,
          paymentPhone: request.paymentPhone,
          accountName: request.accountName,
          status: request.status,
          externalReference: request.externalReference,
          createdAt: request.createdAt,
          processedAt: request.processedAt,
        }],
      });
    }
  }
  const rows = Array.from(trackedBookings.values()).sort((a, b) => {
    const aTime = (a.cancelledAt ?? a.clientRefundRequests[0]?.createdAt ?? new Date(0)).getTime();
    const bTime = (b.cancelledAt ?? b.clientRefundRequests[0]?.createdAt ?? new Date(0)).getTime();
    return bTime - aTime;
  });

  const pendingRequests = refundRequests.filter((request) => ["PENDING", "APPROVED"].includes(request.status)).length;
  const refundTotal = rows.reduce((sum, row) => sum + Math.max(0, row.cancellationRefundAmount), 0);
  const teacherPenaltyTotal = rows.reduce((sum, row) => sum + Math.max(0, row.cancellationPenaltyTeacherAmount), 0);
  const platformPenaltyTotal = rows.reduce((sum, row) => sum + Math.max(0, row.cancellationPenaltyPlatformAmount), 0);
  const serviceFeeTotal = rows.reduce((sum, row) => sum + Math.max(0, row.paymentServiceFeeAmount), 0);
  const paidRefundTotal = refundRequests
    .filter((request) => request.status === "PAID")
    .reduce((sum, request) => sum + Math.max(0, request.amount), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Remboursements"
        description="Pilotage des remboursements client, pénalités d'annulation et indemnités professeur."
        rootPage
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <RefundMetric label="À traiter" value={`${pendingRequests}`} detail="Demandes client en attente ou approuvées." icon={AlertTriangle} tone={pendingRequests ? "warning" : "neutral"} />
        <RefundMetric label="À rembourser client" value={formatFCFA(refundTotal)} detail="Montant prévu hors frais service." icon={RefreshCw} tone="primary" />
        <RefundMetric label="Indemnités professeurs" value={formatFCFA(teacherPenaltyTotal)} detail="Part de pénalité due aux professeurs." icon={Banknote} tone="primary" />
        <RefundMetric label="Part plateforme" value={formatFCFA(platformPenaltyTotal)} detail="Part interne conservée sur pénalité." icon={Scale} tone="neutral" />
        <RefundMetric label="Frais service non remboursés" value={formatFCFA(serviceFeeTotal)} detail="Frais opérateur PayDunya/Mobile Money." icon={Wallet} tone="neutral" />
      </div>

      <Card className="border-[#E3E8F2] bg-white">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Règle de répartition appliquée</p>
            <p className="mt-1 max-w-3xl text-sm text-[#64748B]">
              Entre 24h et 6h avant le cours, 60% de la pénalité client compense le professeur et 40% reste plateforme.
              À moins de 6h ou après dépassement du créneau, 70% compense le professeur et 30% reste plateforme.
              Si l'annulation vient du professeur ou du service client, aucune pénalité professeur n'est appliquée automatiquement.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <CompactAmount label="Déjà remboursé" value={formatFCFA(paidRefundTotal)} />
            <CompactAmount label="Dossiers" value={`${rows.length}`} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/admin/remboursements" active={!selectedStatus}>Tous</FilterLink>
        {REFUND_STATUSES.map((status) => (
          <FilterLink key={status} href={`/admin/remboursements?status=${status}`} active={selectedStatus === status}>
            {refundStatusLabel(status)}
          </FilterLink>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Aucun remboursement" description="Aucun dossier ne correspond au filtre sélectionné." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((booking) => (
              <RefundMobileCard key={booking.id} booking={booking} />
            ))}
          </div>

          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="text-base">Dossiers de remboursement et pénalités</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réservation</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Professeur</TableHead>
                      <TableHead className="text-right">Remboursement</TableHead>
                      <TableHead className="text-right">Professeur</TableHead>
                      <TableHead className="text-right">Plateforme</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((booking) => {
                      const refundRequest = booking.clientRefundRequests[0];
                      const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
                      return (
                        <TableRow key={booking.id}>
                          <TableCell className="min-w-[190px]">
                            <Link href={`/admin/reservations/${booking.id}`} className="font-mono text-xs font-bold text-[#111B4D] hover:underline">
                              {booking.reference}
                            </Link>
                            <p className="mt-1 text-sm font-semibold text-[#111827]">{booking.subjectName}</p>
                            <p className="mt-0.5 text-xs text-[#64748B]">{cancellationWindowLabel(booking.cancellationWindow)} · {cancellationActorLabel(booking.cancelledBy)}</p>
                          </TableCell>
                          <TableCell>
                            <Link href={`/admin/clients/${booking.client.id}`} className="text-sm font-semibold text-[#111827] hover:text-[#111B4D]">
                              {booking.client.name}
                            </Link>
                            {booking.client.phone && <p className="mt-1 text-xs text-[#64748B]">{booking.client.phone}</p>}
                          </TableCell>
                          <TableCell className="min-w-[210px]">
                            <div className="flex items-center gap-3">
                              <ProfessorImage
                                photoUrl={booking.teacher.photoUrl}
                                name={teacherName}
                                size="sm"
                                shape="circle"
                                verified={booking.teacher.badgeVerified}
                              />
                              <div className="min-w-0">
                                <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`} className="block truncate text-sm font-semibold text-[#111827] hover:text-[#111B4D]">
                                  {teacherName}
                                </Link>
                                {booking.teacher.phone && <p className="mt-0.5 text-xs text-[#64748B]">{booking.teacher.phone}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={booking.cancellationRefundAmount} className="text-sm font-semibold" />
                            <p className="text-[11px] text-[#64748B]">Service: {formatFCFA(booking.paymentServiceFeeAmount)}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={booking.cancellationPenaltyTeacherAmount} className="text-sm font-semibold" />
                            <p className="text-[11px] text-[#64748B]">{booking.cancellationPenaltyTeacherRate}% pénalité</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={booking.cancellationPenaltyPlatformAmount} className="text-sm font-semibold" />
                            <p className="text-[11px] text-[#64748B]">{booking.cancellationPenaltyPlatformRate}% pénalité</p>
                          </TableCell>
                          <TableCell>
                            <RefundStatusBadge status={refundRequest?.status} />
                            {refundRequest?.externalReference && (
                              <p className="mt-1 max-w-[12rem] truncate text-[11px] text-[#64748B]">Reçu: {refundRequest.externalReference}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <AdminRefundProcessButton
                                bookingId={booking.id}
                                bookingReference={booking.reference}
                                refundAmount={booking.cancellationRefundAmount}
                                serviceFeeAmount={booking.paymentServiceFeeAmount}
                                teacherPenaltyAmount={booking.cancellationPenaltyTeacherAmount}
                                platformPenaltyAmount={booking.cancellationPenaltyPlatformAmount}
                                refundRequest={refundRequest ? {
                                  reference: refundRequest.reference,
                                  amount: refundRequest.amount,
                                  method: refundRequest.method,
                                  paymentPhone: refundRequest.paymentPhone,
                                  accountName: refundRequest.accountName,
                                  status: refundRequest.status,
                                  externalReference: refundRequest.externalReference,
                                } : null}
                              />
                              <Button asChild size="sm" variant="outline" className="rounded-lg">
                                <Link href={`/admin/reservations/${booking.id}`}>
                                  <ExternalLink className="mr-1.5 h-4 w-4" />
                                  Dossier
                                </Link>
                              </Button>
                              <Button asChild size="sm" variant="outline" className="rounded-lg">
                                <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`}>
                                  Compta
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RefundMobileCard({ booking }: { booking: RefundBookingRow }) {
  const refundRequest = booking.clientRefundRequests[0];
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;

  return (
    <Card className="border-[#E3E8F2] bg-white">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/admin/reservations/${booking.id}`} className="font-mono text-xs font-bold text-[#111B4D]">
              {booking.reference}
            </Link>
            <p className="mt-1 truncate text-sm font-semibold text-[#111827]">{booking.subjectName} · {booking.levelName}</p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              {booking.cancelledAt ? formatDateTime(booking.cancelledAt) : "Date d'annulation non renseignée"}
            </p>
          </div>
          <RefundStatusBadge status={refundRequest?.status} />
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
          <ProfessorImage
            photoUrl={booking.teacher.photoUrl}
            name={teacherName}
            size="sm"
            shape="circle"
            verified={booking.teacher.badgeVerified}
          />
          <div className="min-w-0">
            <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`} className="block truncate text-sm font-semibold text-[#111827]">
              {teacherName}
            </Link>
            <p className="truncate text-xs text-[#64748B]">Client : {booking.client.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniAmount label="Remboursement" value={booking.cancellationRefundAmount} />
          <MiniAmount label="Frais retenus" value={booking.cancellationFeeAmount} />
          <MiniAmount label="Part professeur" value={booking.cancellationPenaltyTeacherAmount} />
          <MiniAmount label="Part plateforme" value={booking.cancellationPenaltyPlatformAmount} />
        </div>

        {refundRequest ? (
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs text-[#64748B]">
            <p className="font-semibold text-[#111827]">{refundRequest.reference}</p>
            <p className="mt-1">
              {paymentMethodLabel(refundRequest.method)} · {refundRequest.paymentPhone}
              {refundRequest.accountName ? ` · ${refundRequest.accountName}` : ""}
            </p>
            {refundRequest.externalReference && <p className="mt-1">Reçu : {refundRequest.externalReference}</p>}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-3 text-xs font-medium text-[#64748B]">
            Le client doit renseigner son moyen et son numéro de remboursement.
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <AdminRefundProcessButton
            bookingId={booking.id}
            bookingReference={booking.reference}
            refundAmount={booking.cancellationRefundAmount}
            serviceFeeAmount={booking.paymentServiceFeeAmount}
            teacherPenaltyAmount={booking.cancellationPenaltyTeacherAmount}
            platformPenaltyAmount={booking.cancellationPenaltyPlatformAmount}
            refundRequest={refundRequest ? {
              reference: refundRequest.reference,
              amount: refundRequest.amount,
              method: refundRequest.method,
              paymentPhone: refundRequest.paymentPhone,
              accountName: refundRequest.accountName,
              status: refundRequest.status,
              externalReference: refundRequest.externalReference,
            } : null}
            className="w-full"
          />
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={`/admin/reservations/${booking.id}`}>Ouvrir dossier</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`}>Comptabilité</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RefundMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "warning" | "neutral";
}) {
  return (
    <Card className="border-[#E3E8F2] bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
            <p className="mt-2 truncate text-xl font-semibold text-[#111827]">{value}</p>
          </div>
          <span className={tone === "primary" ? "rounded-lg bg-[#111B4D] p-2 text-white" : tone === "warning" ? "rounded-lg bg-orange-600 p-2 text-white" : "rounded-lg bg-[#111827] p-2 text-white"}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#64748B]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={active
        ? "inline-flex min-h-10 items-center rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white"
        : "inline-flex min-h-10 items-center rounded-lg border border-[#D8E0EE] bg-white px-4 text-sm font-semibold text-[#111827] hover:border-[#111B4D]"
      }
    >
      {children}
    </Link>
  );
}

function RefundStatusBadge({ status }: { status?: string | null }) {
  const label = status ? refundStatusLabel(status) : "Coordonnées attendues";
  const className = status === "PAID"
    ? "border-blue-200 bg-blue-50 text-blue-800"
    : status === "REJECTED" || status === "CANCELLED"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-orange-200 bg-orange-50 text-orange-800";
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function refundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "À traiter",
    APPROVED: "Approuvé",
    PAID: "Remboursé",
    REJECTED: "Rejeté",
    CANCELLED: "Annulé",
  };
  return labels[status] ?? status;
}

function MiniAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{formatFCFA(value)}</p>
    </div>
  );
}

function CompactAmount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
