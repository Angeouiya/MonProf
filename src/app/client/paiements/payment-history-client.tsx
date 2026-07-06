"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Filter, Search, X } from "lucide-react";
import {
  ClientCompactFacts,
  ClientEmptyState,
  ClientRecordAmount,
  ClientRecordStatusLine,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  clientPaymentChannelLabel,
  getClientPaymentFilter,
  getClientTransactionStatusLabel,
  getPaymentHint,
  type ClientPaymentFilter,
} from "@/lib/client-payment-display";

export type ClientPaymentHistoryItem = {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  method: string | null;
  createdAt: string;
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    startDate: string | null;
    scheduledDate: string | null;
    teacher: {
      fullName: string;
      professionalName: string | null;
      photoUrl: string | null;
      badgeVerified: boolean;
    };
  };
};

const filterOptions: Array<{ key: ClientPaymentFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "secure", label: "Sécurisés" },
  { key: "blocked", label: "Bloqués" },
  { key: "refund", label: "Remboursements" },
  { key: "attention", label: "À suivre" },
];

export function PaymentHistoryClient({ transactions }: { transactions: ClientPaymentHistoryItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClientPaymentFilter>("all");

  const counts = useMemo(() => {
    const next: Record<ClientPaymentFilter, number> = {
      all: transactions.length,
      secure: 0,
      blocked: 0,
      refund: 0,
      attention: 0,
    };
    for (const transaction of transactions) {
      next[getClientPaymentFilter(transaction.type, transaction.status)] += 1;
    }
    return next;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const teacherName = transaction.booking.teacher.professionalName || transaction.booking.teacher.fullName;
      const category = getClientPaymentFilter(transaction.type, transaction.status);
      const searchable = [
        transaction.reference,
        transaction.booking.reference,
        transaction.booking.subjectName,
        transaction.booking.levelName,
        teacherName,
        clientPaymentChannelLabel(transaction.method),
        getClientTransactionStatusLabel(transaction.type, transaction.status),
      ].join(" ").toLowerCase();

      return (filter === "all" || category === filter) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query, transactions]);

  const activeFilter = filterOptions.find((option) => option.key === filter)?.label ?? "Tous";
  const hasRefinement = filter !== "all" || query.trim().length > 0;

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-payment-history>
      <div className="space-y-3 border-b border-[#E3E8F2] bg-white p-3 min-[640px]:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher professeur, référence, matière..."
              className="h-12 rounded-lg border-[#D8DEE9] bg-white pl-9 pr-10 text-sm font-medium focus:border-[#111B4D] focus:ring-[#111B4D]"
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-white hover:text-[#111B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111B4D]"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <Filter className="h-4 w-4" />
            <span className="min-w-0 truncate">{activeFilter}</span>
            <span className="shrink-0 text-[#111B4D]">{filteredTransactions.length}</span>
          </div>

          {hasRefinement && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="min-h-11 w-full rounded-lg text-xs lg:w-auto"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 min-[560px]:grid-cols-5" aria-label="Filtres paiements">
          {filterOptions.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={filter === option.key ? "default" : "outline"}
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className="min-h-11 min-w-0 justify-center rounded-lg px-2 text-xs"
            >
              <span className="min-w-0 truncate">{option.label}</span>
              <span className={filter === option.key ? "shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs text-[#111B4D]" : "shrink-0 rounded-md border border-[#E3E8F2] bg-white px-1.5 py-0.5 text-xs text-[#64748B]"}>
                {counts[option.key]}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <ClientEmptyState icon={Search} title="Aucun mouvement trouvé" description="Essayez un autre filtre, une référence ou le nom du professeur." compact />
      ) : (
        <div aria-live="polite">
          <div className="hidden xl:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E3E8F2] bg-white text-left text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Référence</th>
                  <th className="px-4 py-3 font-semibold">Professeur</th>
                  <th className="px-4 py-3 font-semibold">Matière</th>
                  <th className="px-4 py-3 font-semibold">Canal</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8F2]">
                {filteredTransactions.map((transaction) => (
                  <PaymentDesktopRow key={transaction.id} transaction={transaction} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#E3E8F2] xl:hidden">
            {filteredTransactions.map((transaction) => (
              <PaymentMobileCard key={transaction.id} transaction={transaction} />
            ))}
          </div>
        </div>
      )}
    </ClientSurface>
  );
}

function PaymentDesktopRow({ transaction }: { transaction: ClientPaymentHistoryItem }) {
  const teacherName = transaction.booking.teacher.professionalName || transaction.booking.teacher.fullName;
  return (
    <tr className="transition hover:bg-white">
      <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">
        <p>{formatDate(transaction.createdAt)}</p>
        <p className="text-xs font-semibold">{formatDateTime(transaction.createdAt)}</p>
      </td>
      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#111827]">{transaction.reference}</td>
      <td className="px-4 py-3 text-[#111827]">
        <div className="flex items-center gap-2">
          <ProfessorImage
            photoUrl={transaction.booking.teacher.photoUrl}
            name={teacherName}
            size="sm"
            shape="circle"
            verified={transaction.booking.teacher.badgeVerified}
          />
          <span className="font-semibold">{teacherName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[#111827]">
        <p className="font-semibold">{transaction.booking.subjectName}</p>
        <p className="text-xs text-[#64748B]">{transaction.booking.levelName}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#64748B]">{courseDateLabel(transaction)}</p>
      </td>
      <td className="px-4 py-3 text-[#64748B]">{clientPaymentChannelLabel(transaction.method)}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#111827]">
        {transaction.type === "REFUND" ? "+" : ""}
        <Money amount={transaction.amount} />
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-[#111827]">{getClientTransactionStatusLabel(transaction.type, transaction.status)}</p>
        <p className="mt-0.5 max-w-52 break-words text-xs text-[#64748B]">{getPaymentHint(transaction.type, transaction.status)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <Button asChild size="sm" variant="outline">
          <Link href={`/client/reservations/${transaction.booking.id}`}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Dossier
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function PaymentMobileCard({ transaction }: { transaction: ClientPaymentHistoryItem }) {
  const teacherName = transaction.booking.teacher.professionalName || transaction.booking.teacher.fullName;
  return (
    <div data-client-payment-card className="p-3.5 sm:p-4">
      <div className="grid gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <ProfessorImage
            photoUrl={transaction.booking.teacher.photoUrl}
            name={teacherName}
            size={52}
            shape="circle"
            verified={transaction.booking.teacher.badgeVerified}
          />
          <div className="min-w-0 flex-1">
            <p className="break-all font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{transaction.reference}</p>
            <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
              {transaction.booking.subjectName} · {transaction.booking.levelName}
            </h2>
            <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
              {teacherName}
            </p>
          </div>
        </div>
        <ClientRecordAmount
          value={<>{transaction.type === "REFUND" ? "+" : ""}<Money amount={transaction.amount} /></>}
          className="min-[520px]:min-w-36 min-[520px]:text-right"
        />
      </div>

      <ClientCompactFacts
        className="mt-3"
        items={[
          { label: "Date", value: courseDateLabel(transaction) },
          { label: "Canal", value: clientPaymentChannelLabel(transaction.method) },
          { label: "État", value: getClientTransactionStatusLabel(transaction.type, transaction.status), strong: true },
        ]}
      />

      <ClientRecordStatusLine
        className="mt-3"
        label="Sécurité du paiement"
        hint={getPaymentHint(transaction.type, transaction.status)}
      />

      <div className="mt-3 grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
        <p className="break-words text-xs font-medium leading-5 text-[#64748B]">
          Mouvement enregistré le {formatDate(transaction.createdAt)} dans le dossier {transaction.booking.reference}.
        </p>
        <Button asChild size="sm" className="min-h-11 rounded-lg">
          <Link href={`/client/reservations/${transaction.booking.id}`}>
            Voir le dossier <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function courseDateLabel(transaction: ClientPaymentHistoryItem) {
  if (transaction.booking.scheduledDate) return formatDate(transaction.booking.scheduledDate);
  if (transaction.booking.startDate) return `${formatDate(transaction.booking.startDate)} demandée`;
  return "Date à confirmer";
}
