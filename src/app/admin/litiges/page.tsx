import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Banknote, CheckCircle2, Phone, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { formatDateTime, timeAgo } from "@/lib/format";
import { LitigesFiltersClient } from "./filters-client";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN","INVESTIGATING","RESOLVED","REFUNDED","REJECTED"];
const LABELS: Record<string, string> = {
  OPEN: "Ouvert", INVESTIGATING: "Investigation", RESOLVED: "Résolu", REFUNDED: "Remboursé", REJECTED: "Rejeté",
};
const BADGE_CLS: Record<string, string> = {
  OPEN: "border-red-200 bg-red-50 text-red-700",
  INVESTIGATING: "border-amber-200 bg-amber-50 text-amber-700",
  RESOLVED: "border-blue-200 bg-blue-50 text-blue-700",
  REFUNDED: "border-blue-200 bg-blue-50 text-blue-700",
  REJECTED: "border-slate-200 bg-slate-50 text-slate-700",
};

export default async function AdminLitigesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("DISPUTES_MANAGE");
  const sp = await searchParams;
  const status = sp.status && STATUSES.includes(sp.status) ? sp.status : undefined;
  const where: any = {};
  if (status) where.status = status;

  const disputes = await db.dispute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true,
          reference: true,
          subjectName: true,
          totalPrice: true,
          status: true,
          paymentStatus: true,
          client: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
        },
      },
      openedBy: { select: { id: true, name: true } },
    },
    take: 200,
  });
  const openCount = disputes.filter((dispute) => ["OPEN", "INVESTIGATING"].includes(dispute.status)).length;
  const refundedCount = disputes.filter((dispute) => dispute.status === "REFUNDED").length;
  const resolvedCount = disputes.filter((dispute) => dispute.status === "RESOLVED").length;
  const amountAtStake = disputes
    .filter((dispute) => ["OPEN", "INVESTIGATING"].includes(dispute.status))
    .reduce((sum, dispute) => sum + dispute.booking.totalPrice, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Litiges" description={`${disputes.length} litige(s)`} rootPage />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DisputeSummaryCard label="À traiter" value={`${openCount}`} detail="Ouverts ou en investigation" icon={ShieldAlert} tone={openCount ? "red" : "blue"} />
        <DisputeSummaryCard label="Montant exposé" value={<Money amount={amountAtStake} />} detail="Paiements concernés par litiges actifs" icon={Banknote} tone={amountAtStake ? "amber" : "blue"} />
        <DisputeSummaryCard label="Remboursés" value={`${refundedCount}`} detail="Décisions avec remboursement client" icon={RefreshCw} tone={refundedCount ? "violet" : "blue"} />
        <DisputeSummaryCard label="Résolus" value={`${resolvedCount}`} detail="Paiement ou décision clôturée" icon={CheckCircle2} tone="blue" />
      </div>

      <LitigesFiltersClient status={status ?? ""} />

      {disputes.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Aucun litige" description="Aucun litige ne correspond." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {disputes.map((d) => (
              <Card key={d.id} className="border-red-100 bg-white">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-foreground">{d.reason}</p>
                      <Link href={`/admin/reservations/${d.booking.id}`} className="mt-1 block font-mono text-xs font-bold text-primary">
                        {d.booking.reference}
                      </Link>
                    </div>
                    <Badge variant="outline" className={`${BADGE_CLS[d.status]} shrink-0`}>{LABELS[d.status]}</Badge>
                  </div>

                  <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                    <ProfessorImage
                      photoUrl={d.booking.teacher.photoUrl}
                      name={d.booking.teacher.professionalName || d.booking.teacher.fullName}
                      size="sm"
                      shape="circle"
                      verified={d.booking.teacher.badgeVerified}
                    />
                    <div className="min-w-0">
                      <Link href={`/admin/professeurs/${d.booking.teacher.id}?tab=cours&bookingId=${d.booking.id}`} className="block truncate text-sm font-bold text-foreground">
                        {d.booking.teacher.professionalName || d.booking.teacher.fullName}
                      </Link>
                      {d.booking.teacher.phone && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {d.booking.teacher.phone}
                        </p>
                      )}
                      <Link href={`/admin/clients/${d.booking.client.id}`} className="block truncate text-xs text-muted-foreground">
                        Client : {d.booking.client.name}
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Matière</p>
                      <p className="mt-1 truncate text-xs font-bold text-foreground">{d.booking.subjectName}</p>
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                      <Money amount={d.booking.totalPrice} className="mt-1 text-xs font-black" />
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Ouvert par</p>
                      <p className="mt-1 truncate text-xs font-bold text-foreground">{d.openedBy.name}</p>
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                      <p className="mt-1 text-xs font-bold text-foreground">{timeAgo(d.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <BookingStatusBadge status={d.booking.status} />
                    <PaymentStatusBadge status={d.booking.paymentStatus} />
                  </div>

                  <Button asChild className="h-11 w-full rounded-lg">
                    <Link href={`/admin/litiges/${d.id}`}>
                      Traiter le litige
                    </Link>
                  </Button>
                  {["OPEN", "INVESTIGATING"].includes(d.status) && (
                    <Button asChild variant="outline" className="h-11 w-full rounded-lg">
                      <Link href={`/admin/reservations/${d.booking.id}?action=replace`}>
                        Préparer un remplacement
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raison</TableHead>
                  <TableHead>Réservation</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Ouvert par</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm font-medium">{d.reason}</TableCell>
                    <TableCell>
                      <Link href={`/admin/reservations/${d.booking.id}`} className="font-mono text-xs text-primary hover:underline">{d.booking.reference}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{d.booking.subjectName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProfessorImage
                          photoUrl={d.booking.teacher.photoUrl}
                          name={d.booking.teacher.professionalName || d.booking.teacher.fullName}
                          size="sm"
                          shape="circle"
                          verified={d.booking.teacher.badgeVerified}
                        />
                        <Link href={`/admin/professeurs/${d.booking.teacher.id}?tab=cours&bookingId=${d.booking.id}`} className="text-sm hover:text-primary">
                          {d.booking.teacher.professionalName || d.booking.teacher.fullName}
                        </Link>
                      </div>
                      {d.booking.teacher.phone && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {d.booking.teacher.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{d.openedBy.name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground" title={formatDateTime(d.createdAt)}>{timeAgo(d.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={BADGE_CLS[d.status]}>{LABELS[d.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {["OPEN", "INVESTIGATING"].includes(d.status) && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/reservations/${d.booking.id}?action=replace`}>Remplacer</Link>
                          </Button>
                        )}
                        <Button asChild size="sm">
                          <Link href={`/admin/litiges/${d.id}`}>Traiter</Link>
                        </Button>
                      </div>
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

function DisputeSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: any;
  tone: "blue" | "violet" | "amber" | "red";
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
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{detail}</p>
    </div>
  );
}
