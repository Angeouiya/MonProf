import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, ExternalLink, FileText, Lock, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/platform-labels";
import { PaiementsFiltersClient } from "./filters-client";
import { TeacherPayoutReceiptActions } from "@/components/admin/teacher-payout-receipt-actions";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

const VALID_METHODS = ["WAVE","ORANGE_MONEY","MTN_MONEY","MOOV_MONEY"];
const VALID_STATUSES = ["FAILED","RECEIVED","BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID","DISPUTED","REFUND_PENDING","PARTIAL_REFUND_PENDING","REFUNDED","PARTIALLY_REFUNDED","RETAINED"];

export default async function AdminPaiementsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireAdmin("FINANCE_VIEW");
  const sp = await searchParams;
  const method = sp.method && VALID_METHODS.includes(sp.method) ? sp.method : undefined;
  const status = sp.status && VALID_STATUSES.includes(sp.status) ? sp.status : undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;

  const where: any = { type: "CLIENT_PAYMENT" };
  where.booking = { is: verifiedPayDunyaBookingWhere() };
  if (method) where.method = method;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = new Date(to.getTime() + 24*60*60*1000);
  }

  const [rawTxs, teacherPayouts, teacherPayoutAgg] = await db.$transaction([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true, reference: true, subjectName: true, levelName: true, paymentStatus: true,
            totalClientPays: true, totalPrice: true, paydunyaStatus: true, paydunyaVerifiedAt: true,
            transactions: {
              where: { type: "CLIENT_PAYMENT" },
              select: { type: true, status: true, amount: true },
            },
            client: { select: { name: true } },
          },
        },
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      },
      take: 300,
    }),
    db.teacherPayoutRecord.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true, phone: true } },
        createdBy: { select: { name: true } },
        allocations: {
          include: { booking: { select: { id: true, reference: true, subjectName: true, levelName: true } } },
        },
      },
      take: 100,
    }),
    db.teacherPayoutRecord.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const txs = rawTxs.filter((tx) => tx.booking && hasVerifiedPayDunyaClientPayment(tx.booking));
  const receivedAmount = txs.reduce((sum, tx) => sum + tx.amount, 0);
  const commissionAmount = txs.reduce((sum, tx) => sum + tx.commission, 0);
  const blockedAmount = txs.filter((tx) => tx.status === "BLOCKED").reduce((sum, tx) => sum + tx.amount, 0);
  const disputedAmount = txs.filter((tx) => tx.status === "DISPUTED").reduce((sum, tx) => sum + tx.amount, 0);
  const toPayTeacherAmount = txs.filter((tx) => tx.status === "TO_PAY_TEACHER").reduce((sum, tx) => sum + tx.amount, 0);
  const paidTeacherAmount = teacherPayoutAgg._sum.amount ?? 0;
  const financialAttentionCount = txs.filter((tx) => ["BLOCKED", "DISPUTED", "TO_PAY_TEACHER", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED"].includes(tx.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Paiements" description="Paiements clients reçus et versements internes enregistrés aux professeurs" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total reçu" value={formatFCFA(receivedAmount)} icon={Wallet} tone="primary" />
        <StatCard label="Total commission" value={formatFCFA(commissionAmount)} icon={TrendingUp} tone="success" />
        <StatCard label="Transactions" value={txs.length} icon={Banknote} />
        <StatCard label="Versé aux professeurs" value={formatFCFA(paidTeacherAmount)} icon={Banknote} tone="warning" />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SignalCard
          title="Fonds bloqués"
          value={formatFCFA(blockedAmount)}
          description="Paiements clients sécurisés en attente de cours, validation ou décision admin."
          tone={blockedAmount ? "amber" : "blue"}
        />
        <SignalCard
          title="À payer professeurs"
          value={formatFCFA(toPayTeacherAmount)}
          description="Montants arrivés au stade de libération après validation du cours."
          tone={toPayTeacherAmount ? "violet" : "blue"}
        />
        <SignalCard
          title="Litiges financiers"
          value={formatFCFA(disputedAmount)}
          description="Sommes suspendues jusqu'à arbitrage, remboursement ou paiement partiel."
          tone={disputedAmount ? "red" : "blue"}
        />
        <SignalCard
          title="À surveiller"
          value={`${financialAttentionCount} ligne${financialAttentionCount > 1 ? "s" : ""}`}
          description="Transactions qui nécessitent une décision, un suivi professeur ou une libération."
          tone={financialAttentionCount ? "amber" : "blue"}
        />
      </div>

      <PaiementsFiltersClient filters={{ method: method ?? "", status: status ?? "", from: sp.from ?? "", to: sp.to ?? "" }} />

      {txs.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun paiement" description="Aucune transaction ne correspond." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paiements clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-0">
            <div className="grid gap-3 md:hidden">
              {txs.map((t) => {
                const teacherName = t.teacher ? t.teacher.professionalName || t.teacher.fullName : "Professeur non attribué";
                return (
                  <Card key={t.id} className="border-violet-100 bg-white">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-primary">{t.reference}</p>
                          {t.booking ? (
                            <Link href={`/admin/reservations/${t.booking.id}`} className="mt-1 block truncate text-sm font-bold text-foreground">
                              {t.booking.reference}
                            </Link>
                          ) : (
                            <p className="mt-1 truncate text-sm font-bold text-foreground">Réservation indisponible</p>
                          )}
                        </div>
                        <PaymentStatusBadge status={t.status} />
                      </div>

                      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                        {t.teacher ? (
                          <ProfessorImage
                            photoUrl={t.teacher.photoUrl}
                            name={teacherName}
                            size="sm"
                            shape="circle"
                            verified={t.teacher.badgeVerified}
                          />
                        ) : (
                          <ProfessorImage photoUrl={null} name={teacherName} size="sm" shape="circle" verified={false} />
                        )}
                        <div className="min-w-0">
                          {t.teacher ? (
                            <Link href={teacherAccountingHref(t.teacher.id, t.booking?.id)} className="block truncate text-sm font-bold text-foreground">
                              {teacherName}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-bold text-foreground">{teacherName}</p>
                          )}
                          <p className="truncate text-xs text-muted-foreground">Client : {t.booking?.client?.name ?? "—"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                          <Money amount={t.amount} className="mt-1 text-xs font-black" />
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Méthode</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{t.method ? paymentMethodLabel(t.method) : "—"}</p>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Cours</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{t.booking?.subjectName ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(t.createdAt)}</p>
                        </div>
                      </div>

                      {t.booking && (
                        <PaymentActions bookingId={t.booking.id} teacherId={t.teacher?.id ?? null} compact />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead className="hidden md:table-cell">Réservation</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Méthode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Commission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => {
                  const teacherName = t.teacher ? t.teacher.professionalName || t.teacher.fullName : "Professeur non attribué";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-primary">{t.booking?.reference ?? "—"}</TableCell>
                      <TableCell className="text-sm">{t.booking?.client?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProfessorImage
                            photoUrl={t.teacher?.photoUrl ?? null}
                            name={teacherName}
                            size="sm"
                            shape="circle"
                            verified={Boolean(t.teacher?.badgeVerified)}
                          />
                          <div className="min-w-0">
                            {t.teacher ? (
                              <Link href={teacherAccountingHref(t.teacher.id, t.booking?.id)} className="block truncate font-medium text-foreground hover:text-primary">
                                {teacherName}
                              </Link>
                            ) : (
                              <p className="truncate font-medium text-foreground">{teacherName}</p>
                            )}
                            <p className="truncate text-xs text-muted-foreground">
                              {t.booking ? `${t.booking.subjectName} · ${t.booking.levelName}` : "Cours non lié"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{t.method ? paymentMethodLabel(t.method) : "—"}</TableCell>
                      <TableCell className="text-right"><Money amount={t.amount} className="text-sm font-medium" /></TableCell>
                      <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <PaymentStatusBadge status={t.status} />
                          {["BLOCKED", "DISPUTED", "TO_PAY_TEACHER", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED"].includes(t.status) && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Suivi requis</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.booking ? (
                          <PaymentActions bookingId={t.booking.id} teacherId={t.teacher?.id ?? null} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Factures / reçus professeurs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registre interne des paiements réellement versés aux professeurs, avec allocations, numéro de paiement et document téléchargeable.
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="grid gap-3 p-4 md:hidden">
            {teacherPayouts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                Aucun versement professeur enregistré.
              </p>
            ) : (
              teacherPayouts.map((payout) => {
                const teacherName = payout.teacher.professionalName || payout.teacher.fullName;
                return (
                  <Card key={payout.id} className="border-violet-100 bg-white">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-primary">{payout.reference}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{formatDateTime(payout.paidAt)}</p>
                        </div>
                        <Money amount={payout.amount} className="shrink-0 text-sm font-black" />
                      </div>

                      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                        <ProfessorImage
                          photoUrl={payout.teacher.photoUrl}
                          name={teacherName}
                          size="sm"
                          shape="circle"
                          verified={payout.teacher.badgeVerified}
                        />
                        <div className="min-w-0">
                          <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)} className="block truncate text-sm font-bold text-foreground">
                            {teacherName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{paymentMethodLabel(payout.method)}</p>
                          {payout.paymentPhone && (
                            <p className="truncate text-xs text-muted-foreground">Numéro payé : {payout.paymentPhone}</p>
                          )}
                        </div>
                      </div>

                      {payout.allocations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Allocations</p>
                          {payout.allocations.slice(0, 3).map((allocation) => (
                            <Link
                              key={allocation.id}
                              href={`/admin/reservations/${allocation.booking.id}`}
                              className="block rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs text-foreground"
                            >
                              <span className="font-mono font-bold text-primary">{allocation.booking.reference}</span>
                              <span className="ml-1 text-muted-foreground">{allocation.booking.subjectName}</span>
                              <Money amount={allocation.amount} className="mt-1 block font-bold" />
                            </Link>
                          ))}
                          {payout.allocations.length > 3 && (
                            <p className="text-xs text-muted-foreground">+{payout.allocations.length - 3} autre(s) allocation(s)</p>
                          )}
                        </div>
                      )}

                      {payout.note && (
                        <p className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs text-muted-foreground">{payout.note}</p>
                      )}

                      <Button asChild variant="outline" className="h-11 w-full rounded-lg">
                        <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)}>Voir comptabilité professeur</Link>
                      </Button>
                      <TeacherPayoutReceiptActions
                        teacherName={teacherName}
                        teacherPhone={payout.teacher.phone}
                        record={payout}
                        compact
                      />
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf versement</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead className="hidden md:table-cell">Allocations</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Méthode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="hidden xl:table-cell">Admin</TableHead>
                <TableHead className="text-right">Facture/reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherPayouts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun versement professeur enregistré.
                  </TableCell>
                </TableRow>
              )}
              {teacherPayouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-mono text-xs">{payout.reference}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <ProfessorImage
                        photoUrl={payout.teacher.photoUrl}
                        name={payout.teacher.professionalName || payout.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={payout.teacher.badgeVerified}
                      />
                        <div className="min-w-0">
                          <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)} className="block truncate font-medium text-foreground hover:text-primary">
                            {payout.teacher.professionalName || payout.teacher.fullName}
                          </Link>
                          {payout.paymentPhone && <p className="line-clamp-1 text-xs text-muted-foreground">Numéro payé : {payout.paymentPhone}</p>}
                          {payout.note && <p className="line-clamp-1 text-xs text-muted-foreground">{payout.note}</p>}
                        </div>
                      </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    <div className="flex flex-col gap-1">
                      {payout.allocations.map((allocation) => (
                        <Link key={allocation.id} href={`/admin/reservations/${allocation.booking.id}`} className="text-primary hover:underline">
                          {allocation.booking.reference} · {allocation.booking.subjectName} · {formatFCFA(allocation.amount)}
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDateTime(payout.paidAt)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{payout.method ? paymentMethodLabel(payout.method) : "—"}</TableCell>
                  <TableCell className="text-right"><Money amount={payout.amount} className="text-sm font-semibold" /></TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{payout.createdBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <TeacherPayoutReceiptActions
                      teacherName={payout.teacher.professionalName || payout.teacher.fullName}
                      teacherPhone={payout.teacher.phone}
                      record={payout}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
  const iconClass = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    red: "text-red-700",
    violet: "text-violet-700",
  }[tone];
  const Icon = tone === "red" ? AlertTriangle : tone === "amber" ? Lock : tone === "violet" ? ReceiptText : FileText;
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
          <p className="mt-1 text-lg font-black">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{description}</p>
    </div>
  );
}

function PaymentActions({
  bookingId,
  teacherId,
  compact,
}: {
  bookingId: string;
  teacherId: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap justify-end gap-2"}>
      <Button asChild size="sm" variant="secondary" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/reservations/${bookingId}`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Dossier
        </Link>
      </Button>
      {teacherId && (
        <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
          <Link href={teacherAccountingHref(teacherId, bookingId)}>
            <Wallet className="mr-1.5 h-4 w-4" />
            Comptabilité
          </Link>
        </Button>
      )}
    </div>
  );
}

function teacherAccountingHref(teacherId: string, bookingId?: string | null) {
  return bookingId
    ? `/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`
    : `/admin/professeurs/${teacherId}?tab=paiements`;
}
