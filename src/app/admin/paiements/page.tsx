import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingUp, Banknote } from "lucide-react";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { PaiementsFiltersClient } from "./filters-client";

export const dynamic = "force-dynamic";

const VALID_METHODS = ["WAVE","ORANGE_MONEY","MTN_MONEY","MOOV_MONEY","CARD"];
const VALID_STATUSES = ["FAILED","RECEIVED","BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID","DISPUTED","REFUNDED"];

export default async function AdminPaiementsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const method = sp.method && VALID_METHODS.includes(sp.method) ? sp.method : undefined;
  const status = sp.status && VALID_STATUSES.includes(sp.status) ? sp.status : undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;

  const where: any = { type: "CLIENT_PAYMENT" };
  if (method) where.method = method;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = new Date(to.getTime() + 24*60*60*1000);
  }

  const [txs, agg] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { reference: true, client: { select: { name: true } } } },
        teacher: { select: { id: true, fullName: true, professionalName: true } },
      },
      take: 300,
    }),
    db.transaction.aggregate({
      where,
      _sum: { amount: true, commission: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Paiements reçus" description="Toutes les transactions CLIENT_PAYMENT" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total reçu" value={formatFCFA(agg._sum.amount ?? 0)} icon={Wallet} tone="primary" />
        <StatCard label="Total commission" value={formatFCFA(agg._sum.commission ?? 0)} icon={TrendingUp} tone="success" />
        <StatCard label="Transactions" value={agg._count._all ?? 0} icon={Banknote} />
      </div>

      <PaiementsFiltersClient filters={{ method: method ?? "", status: status ?? "", from: sp.from ?? "", to: sp.to ?? "" }} />

      {txs.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun paiement" description="Aucune transaction ne correspond." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-primary">{t.booking?.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.booking?.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.teacher?.professionalName || t.teacher?.fullName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{t.method?.replace("_", " ") ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money amount={t.amount} className="text-sm font-medium" /></TableCell>
                    <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                    <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
