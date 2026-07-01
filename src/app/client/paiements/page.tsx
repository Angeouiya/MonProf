import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { CreditCard, Wallet, ArrowDownCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  MOOV_MONEY: "Moov Money",
  CARD: "Carte bancaire",
};

export default async function PaiementsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const transactions = await db.transaction.findMany({
    where: { booking: { clientId: user.id } },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true } },
        },
      },
    },
  });

  const totalDepense = transactions
    .filter((t) => t.type === "CLIENT_PAYMENT")
    .reduce((sum, t) => sum + t.amount, 0);
  const fondsBloques = transactions
    .filter((t) => t.type === "CLIENT_PAYMENT" && t.status === "BLOCKED")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRembourse = transactions
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes paiements"
        description="Historique de toutes vos transactions sur la plateforme."
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Total dépensé" value={formatFCFA(totalDepense)} icon={CreditCard} tone="primary" />
        <StatCard label="Fonds bloqués" value={formatFCFA(fondsBloques)} icon={Wallet} tone="warning" />
        <StatCard label="Remboursé" value={formatFCFA(totalRembourse)} icon={ArrowDownCircle} tone="default" />
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Aucune transaction"
          description="Vos paiements apparaîtront ici après votre première réservation."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Référence</th>
                    <th className="px-4 py-3 font-medium">Professeur</th>
                    <th className="px-4 py-3 font-medium">Matière</th>
                    <th className="px-4 py-3 font-medium">Méthode</th>
                    <th className="px-4 py-3 text-right font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{t.reference}</td>
                      <td className="px-4 py-3 text-foreground">
                        {t.booking.teacher.professionalName || t.booking.teacher.fullName}
                      </td>
                      <td className="px-4 py-3 text-foreground">{t.booking.subjectName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.method ? METHOD_LABELS[t.method] ?? t.method : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {t.type === "REFUND" ? "+" : t.type === "TEACHER_PAYOUT" ? "→ " : ""}
                        <Money amount={t.amount} />
                      </td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border sm:hidden">
              {transactions.map((t) => (
                <div key={t.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-medium text-foreground">{t.reference}</p>
                    <PaymentStatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-sm text-foreground">{t.booking.subjectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.booking.teacher.professionalName || t.booking.teacher.fullName} • {formatDate(t.createdAt)}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t.method ? METHOD_LABELS[t.method] ?? t.method : "—"}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {t.type === "REFUND" ? "+" : ""}<Money amount={t.amount} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
