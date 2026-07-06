import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientAppRail,
  ClientCompactFacts,
  ClientFocusPanel,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordStatusLine,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatDate } from "@/lib/format";
import { ACTIVE_PAYMENT_METHODS } from "@/lib/payment-methods";
import { WalletCards, Wallet, ArrowDownCircle, ExternalLink, ReceiptText, ShieldCheck, Search, LockKeyhole, CalendarCheck, Clock3 } from "lucide-react";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { clientPaymentChannelLabel } from "@/lib/client-payment-display";
import { PaymentHistoryClient, type ClientPaymentHistoryItem } from "./payment-history-client";

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
  const pendingPaymentBookings = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: "PENDING_PAYMENT",
      paymentStatus: "FAILED",
      isQuoteOnly: false,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      reference: true,
      subjectName: true,
      levelName: true,
      startDate: true,
      scheduledDate: true,
      totalClientPays: true,
      totalPrice: true,
      teacher: {
        select: {
          fullName: true,
          professionalName: true,
          photoUrl: true,
          badgeVerified: true,
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
  const secureTransactions = transactions.filter((t) => t.type === "CLIENT_PAYMENT" && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(t.status));
  const lastSecureTransaction = secureTransactions[0] ?? transactions[0] ?? null;
  const paymentHistory: ClientPaymentHistoryItem[] = transactions.map((transaction) => ({
    id: transaction.id,
    reference: transaction.reference,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    method: transaction.method,
    createdAt: transaction.createdAt.toISOString(),
    booking: {
      id: transaction.booking.id,
      reference: transaction.booking.reference,
      subjectName: transaction.booking.subjectName,
      levelName: transaction.booking.levelName,
      startDate: transaction.booking.startDate?.toISOString() ?? null,
      scheduledDate: transaction.booking.scheduledDate?.toISOString() ?? null,
      teacher: {
        fullName: transaction.booking.teacher.fullName,
        professionalName: transaction.booking.teacher.professionalName,
        photoUrl: transaction.booking.teacher.photoUrl,
        badgeVerified: transaction.booking.teacher.badgeVerified,
      },
    },
  }));

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Paiements"
        title="Paiements"
        description="Consultez vos paiements sécurisés, remboursements et dossiers liés aux professeurs choisis."
      />

      <ClientMetricStrip
        metrics={[
          { icon: WalletCards, label: "Dépensé", value: formatFCFA(totalDepense) },
          { icon: Wallet, label: "Bloqués", value: formatFCFA(fondsBloques), attention: fondsBloques > 0 },
          { icon: ArrowDownCircle, label: "Remboursé", value: formatFCFA(totalRembourse) },
          { icon: Clock3, label: "À finaliser", value: `${pendingPaymentBookings.length} dossier(s)`, attention: pendingPaymentBookings.length > 0 },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/paiements", icon: ReceiptText, label: "Historique", value: `${transactions.length} mouvement(s)`, active: true },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: "Réservations liées" },
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Nouveau cours" },
          { href: "/client/service-client", icon: ShieldCheck, label: "Sécurité", value: "Litige ou remboursement" },
        ]}
      />

      <PaymentTrustPanel />

      {pendingPaymentBookings.length > 0 && (
        <PendingPaymentsPanel bookings={pendingPaymentBookings} />
      )}

      {lastSecureTransaction && (
        <ClientFocusPanel
          icon={ReceiptText}
          eyebrow="Dernier mouvement"
          title={<Money amount={lastSecureTransaction.amount} />}
          description={`${formatDate(lastSecureTransaction.createdAt)} · ${clientPaymentChannelLabel(lastSecureTransaction.method)} · ${lastSecureTransaction.booking.reference}`}
          action={
            <Button asChild className="min-h-11 w-full rounded-lg">
              <Link href={`/client/reservations/${lastSecureTransaction.booking.id}`}>
                Ouvrir le dossier
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      )}

      {transactions.length === 0 && pendingPaymentBookings.length === 0 ? (
        <PaymentEmptyState />
      ) : transactions.length > 0 ? (
        <PaymentHistoryClient transactions={paymentHistory} />
      ) : (
        <ClientSurface compact className="p-4">
          <div className="flex min-w-0 flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Historique vérifié</p>
              <h2 className="mt-1 text-base font-semibold leading-6 text-[#111827]">Aucun paiement serveur confirmé</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-[#52627A]">
                Vos demandes ci-dessus restent en brouillon jusqu'au retour PayDunya validé côté serveur.
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
              <Link href="/client/reservations">Voir mes réservations</Link>
            </Button>
          </div>
        </ClientSurface>
      )}
    </div>
  );
}

type PendingPaymentBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  startDate: Date | null;
  scheduledDate: Date | null;
  totalClientPays: number;
  totalPrice: number;
  teacher: {
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    badgeVerified: boolean;
  };
};

function PaymentTrustPanel() {
  return (
    <ClientSurface compact className="p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Validation serveur obligatoire</p>
            <h2 className="mt-1 text-lg font-semibold leading-6 text-[#111827]">Aucune réservation active sans PayDunya vérifié.</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
              Vous ne saisissez aucun numéro ici. Le paiement se fait sur PayDunya, puis Compétence active le dossier uniquement après confirmation serveur.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {ACTIVE_PAYMENT_METHODS.map((method) => (
            <PaymentMethodLogo key={method} method={method} className="h-12 w-full min-w-0 rounded-lg" />
          ))}
        </div>
      </div>
    </ClientSurface>
  );
}

function PendingPaymentsPanel({ bookings }: { bookings: PendingPaymentBooking[] }) {
  return (
    <ClientSurface compact className="space-y-3 p-4">
      <div className="flex min-w-0 flex-col gap-2 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">À finaliser</p>
          <h2 className="text-lg font-semibold leading-6 text-[#111827]">Paiements PayDunya en attente</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
            Ces demandes ne réservent aucun créneau tant que PayDunya n'a pas confirmé le paiement côté serveur.
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-lg border border-[#D8DEE9] bg-white px-3 text-xs font-semibold text-[#111B4D]">
          {bookings.length} dossier(s)
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {bookings.map((booking) => {
          const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
          const requestedDate = booking.scheduledDate
            ? formatDate(booking.scheduledDate)
            : booking.startDate
              ? `${formatDate(booking.startDate)} demandée`
              : "Date à confirmer";
          return (
            <article key={booking.id} className="rounded-lg border border-[#DDE3EE] bg-white p-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <ProfessorImage
                  photoUrl={booking.teacher.photoUrl}
                  name={teacherName}
                  size={52}
                  shape="circle"
                  verified={booking.teacher.badgeVerified}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{booking.reference}</p>
                  <h3 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                    {booking.subjectName} · {booking.levelName}
                  </h3>
                  <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">{teacherName}</p>
                </div>
              </div>

              <ClientCompactFacts
                className="mt-3"
                items={[
                  { label: "Date", value: requestedDate },
                  { label: "Montant", value: <Money amount={getPendingBookingAmount(booking)} />, strong: true },
                  { label: "État", value: "Brouillon non réservé", strong: true },
                ]}
              />

              <ClientRecordStatusLine
                className="mt-3"
                label="Action attendue"
                hint="Payez via PayDunya, puis utilisez la vérification serveur sur le dossier si vous revenez sur la plateforme."
              />

              <div className="mt-3 grid gap-2 min-[520px]:grid-cols-2">
                <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <Link href={`/client/reservations/${booking.id}`}>
                    Dossier
                    <ExternalLink className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                  <Link href={`/client/reservations/${booking.id}?payment=pending`}>
                    Payer via PayDunya
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </ClientSurface>
  );
}

function getPendingBookingAmount(booking: Pick<PendingPaymentBooking, "totalClientPays" | "totalPrice">) {
  return Math.max(0, booking.totalClientPays || booking.totalPrice || 0);
}

function PaymentEmptyState() {
  return (
    <div data-client-payment-empty>
      <ClientSurface compact className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Paiement sécurisé</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">Aucun paiement pour le moment</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                Après réservation, le paiement se fait sur PayDunya. Compétence vérifie le retour serveur avant d'afficher la transaction ici.
              </p>
            </div>
          </div>
          <Button asChild className="min-h-11 rounded-lg">
            <Link href="/client/rechercher">
              <Search className="mr-2 h-4 w-4" />
              Trouver un professeur
            </Link>
          </Button>
        </div>

        <div className="grid gap-2 min-[520px]:grid-cols-3">
          <ClientInfoPill label="Étape 1" value="Choisir un professeur" />
          <ClientInfoPill label="Étape 2" value="Payer via PayDunya" />
          <ClientInfoPill label="Étape 3" value="Fonds sécurisés" />
        </div>

        <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-[#111B4D]" />
            <p className="text-sm font-semibold text-[#111827]">Moyens acceptés sur PayDunya</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[560px]:grid-cols-4">
            {ACTIVE_PAYMENT_METHODS.map((method) => (
              <PaymentMethodLogo key={method} method={method} className="h-12 w-full min-w-0 rounded-lg" />
            ))}
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
            Aucun numéro de paiement n'est saisi dans votre espace client. La validation vient de la confirmation serveur PayDunya.
          </p>
        </div>
      </ClientSurface>
    </div>
  );
}
