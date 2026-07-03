import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { EmptyState } from "@/components/shared/page-header";
import { ClientFocusPanel, ClientMetricStrip, ClientPageHeader } from "@/components/shared/client-page-primitives";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { WalletCards, Wallet, ArrowDownCircle, ExternalLink, ReceiptText } from "lucide-react";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function PaiementsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const rawTransactions = await db.transaction.findMany({
    where: {
      booking: { is: verifiedPayDunyaBookingWhere({ clientId: user.id }) },
      type: { in: ["CLIENT_PAYMENT", "REFUND"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true, levelName: true, schoolProgram: true,
          startDate: true, scheduledDate: true, paymentStatus: true, totalClientPays: true, totalPrice: true,
          paydunyaStatus: true, paydunyaVerifiedAt: true,
          transactions: {
            where: { type: "CLIENT_PAYMENT" },
            select: { type: true, status: true, amount: true },
          },
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
      },
    },
  });
  const transactions = rawTransactions.filter((transaction) => hasVerifiedPayDunyaClientPayment(transaction.booking));

  const totalDepense = transactions
    .filter((t) => t.type === "CLIENT_PAYMENT")
    .reduce((sum, t) => sum + t.amount, 0);
  const fondsBloques = transactions
    .filter((t) => t.type === "CLIENT_PAYMENT" && t.status === "BLOCKED")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRembourse = transactions
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + t.amount, 0);
  const secureTransactions = transactions.filter((t) => t.type === "CLIENT_PAYMENT" && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(t.status));
  const lastSecureTransaction = secureTransactions[0] ?? transactions[0] ?? null;

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Paiements"
        title="Mes paiements"
        description="Consultez vos paiements sécurisés, remboursements et dossiers liés aux professeurs choisis."
      />

      <ClientMetricStrip
        metrics={[
          { icon: WalletCards, label: "Dépensé", value: formatFCFA(totalDepense) },
          { icon: Wallet, label: "Bloqués", value: formatFCFA(fondsBloques), attention: fondsBloques > 0 },
          { icon: ArrowDownCircle, label: "Remboursé", value: formatFCFA(totalRembourse) },
        ]}
      />

      {lastSecureTransaction && (
        <ClientFocusPanel
          icon={ReceiptText}
          eyebrow="Dernier mouvement"
          title={<Money amount={lastSecureTransaction.amount} />}
          description={`${formatDate(lastSecureTransaction.createdAt)} · ${clientPaymentChannelLabel(lastSecureTransaction.method)} · ${lastSecureTransaction.booking.reference}`}
          action={
            <Button asChild className="min-h-11 w-full rounded-2xl">
              <Link href={`/client/reservations/${lastSecureTransaction.booking.id}`}>
                Ouvrir le dossier
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      )}

      {transactions.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="Aucune transaction"
          description="Vos paiements apparaîtront ici après votre première réservation."
        />
      ) : (
        <Card className="overflow-hidden rounded-[1.35rem]">
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden 2xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E3E8F2] bg-white text-left text-xs uppercase tracking-wide text-[#64748B]">
                    <th className="px-4 py-3 font-bold">Date</th>
                    <th className="px-4 py-3 font-bold">Référence</th>
                    <th className="px-4 py-3 font-bold">Professeur</th>
                    <th className="px-4 py-3 font-bold">Matière</th>
                    <th className="px-4 py-3 font-bold">Canal</th>
                    <th className="px-4 py-3 text-right font-bold">Montant</th>
                    <th className="px-4 py-3 font-bold">Statut</th>
                    <th className="px-4 py-3 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F2]">
                  {transactions.map((t) => (
                    <tr key={t.id} className="transition hover:bg-white">
                      <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">
                        <p>{formatDate(t.createdAt)}</p>
                        <p className="text-xs font-semibold">{formatDateTime(t.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#111827]">{t.reference}</td>
                      <td className="px-4 py-3 text-[#111827]">
                        <div className="flex items-center gap-2">
                          <ProfessorImage
                            photoUrl={t.booking.teacher.photoUrl}
                            name={t.booking.teacher.professionalName || t.booking.teacher.fullName}
                            size="sm"
                            shape="circle"
                            verified={t.booking.teacher.badgeVerified}
                          />
                          <span className="font-semibold">{t.booking.teacher.professionalName || t.booking.teacher.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#111827]">
                        <p className="font-bold">{t.booking.subjectName}</p>
                        <p className="text-xs text-[#64748B]">{t.booking.levelName}</p>
                        <p className="mt-0.5 text-xs font-semibold text-[#64748B]">
                          {t.booking.scheduledDate ? formatDate(t.booking.scheduledDate) : t.booking.startDate ? `${formatDate(t.booking.startDate)} demandée` : "Date à confirmer"}
                        </p>
                        {t.booking.schoolProgram && (
                          <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[#111B4D]">{t.booking.schoolProgram}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{clientPaymentChannelLabel(t.method)}</td>
                      <td className="px-4 py-3 text-right font-black tabular-nums text-[#111827]">
                        {t.type === "REFUND" ? "+" : ""}
                        <Money amount={t.amount} />
                      </td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={t.status} audience="client" /></td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/client/reservations/${t.booking.id}`}>
                            <ExternalLink className="mr-1.5 h-4 w-4" />
                            Dossier
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Responsive cards */}
            <div className="divide-y divide-[#E3E8F2] 2xl:hidden">
              {transactions.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                    <p className="min-w-0 break-words font-mono text-xs font-black text-[#111827]">{t.reference}</p>
                    <PaymentStatusBadge status={t.status} audience="client" />
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#111827]">{t.booking.subjectName} • {t.booking.levelName}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#64748B]">
                    {t.booking.scheduledDate ? formatDate(t.booking.scheduledDate) : t.booking.startDate ? `${formatDate(t.booking.startDate)} demandée` : "Date à confirmer"}
                  </p>
                  {t.booking.schoolProgram && (
                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-[#111B4D]">{t.booking.schoolProgram}</p>
                  )}
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-[#64748B]">
                    <ProfessorImage
                      photoUrl={t.booking.teacher.photoUrl}
                      name={t.booking.teacher.professionalName || t.booking.teacher.fullName}
                      size={32}
                      shape="circle"
                      verified={t.booking.teacher.badgeVerified}
                    />
                    <span className="min-w-0 break-words">{t.booking.teacher.professionalName || t.booking.teacher.fullName} • {formatDate(t.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                    <span className="text-xs font-semibold text-[#64748B]">
                      {clientPaymentChannelLabel(t.method)}
                    </span>
                    <span className="font-black tabular-nums text-[#111827]">
                      {t.type === "REFUND" ? "+" : ""}<Money amount={t.amount} />
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <p className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
                      <ReceiptText className="mr-1 inline h-3.5 w-3.5" />
                      {getPaymentHint(t.type, t.status)}
                    </p>
                    <Button asChild variant="outline" size="sm" className="min-h-11 rounded-2xl">
                      <Link href={`/client/reservations/${t.booking.id}`}>
                        Voir le dossier <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
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

function getPaymentHint(type: string, status: string) {
  if (type === "REFUND") return "Remboursement enregistré dans l'historique de votre réservation.";
  if (status === "BLOCKED") return "Paiement confirmé par PayDunya et gardé bloqué jusqu'à la confirmation du cours.";
  if (status === "TO_PAY_TEACHER") return "Cours confirmé : l'administration finalise le dossier.";
  if (status === "TEACHER_PAID") return "Cours clôturé dans votre espace client.";
  if (status === "DISPUTED") return "Paiement suspendu pendant le traitement du litige.";
  return "Transaction suivie dans le dossier de réservation.";
}

function clientPaymentChannelLabel(method?: string | null) {
  return method ? paymentMethodLabel(method) : "PayDunya Checkout";
}
