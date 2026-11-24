import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
const money = (value: number) => `${value.toLocaleString("fr-FR")} F CFA`;
const kinds: Record<string, string> = {
  EARNED: "Rémunération acquise",
  PAYMENT: "Règlement professeur",
  EARNED_REVERSAL: "Correction de rémunération",
  PAYMENT_REVERSAL: "Correction de règlement",
  RECEIPT: "Encaissement parent",
  REFUND: "Remboursement parent",
  RECEIPT_REVERSAL: "Correction d'encaissement",
};
export const dynamic = "force-dynamic";
export default async function ManagedAccounting({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  await requireAdmin("FINANCE_VIEW");
  const { before } = await searchParams;
  const cursor = before
    ? await db.managedTeacherLedgerEntry.findUnique({
        where: { id: before },
        select: { id: true, createdAt: true },
      })
    : null;
  const [
    parents,
    refunds,
    teacherBalance,
    paid,
    validated,
    pending,
    cancelled,
    ledger,
    receipts,
    dues,
  ] = await Promise.all([
    db.managedParentReceipt.aggregate({ _sum: { amount: true } }),
    db.managedParentReceipt.aggregate({
      where: { kind: "REFUND" },
      _sum: { amount: true },
    }),
    db.managedTeacherLedgerEntry.aggregate({ _sum: { amountDelta: true } }),
    db.managedTeacherLedgerEntry.aggregate({
      where: { kind: { in: ["PAYMENT", "PAYMENT_REVERSAL"] } },
      _sum: { amountDelta: true },
    }),
    db.managedCourseSession.aggregate({
      where: { status: "VALIDATED" },
      _sum: { fundedAmount: true, creditedTeacherAmount: true },
    }),
    db.managedCourseSession.aggregate({
      where: { status: { in: ["PLANNED", "DONE"] } },
      _sum: { fundedAmount: true },
    }),
    db.managedCourseSession.aggregate({
      where: { status: "CANCELLED" },
      _sum: { fundedAmount: true },
    }),
    db.managedTeacherLedgerEntry.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      include: {
        teacher: { select: { fullName: true } },
        session: {
          select: { dossierId: true, dossier: { select: { reference: true } } },
        },
      },
    }),
    db.managedParentReceipt.findMany({
      take: 20,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { dossier: { select: { reference: true } } },
    }),
    db.$queryRaw<
      { amount: bigint }[]
    >`SELECT COALESCE(SUM(GREATEST(0, "totalPrice" - "cancelledAmount" - "receivedAmount")),0)::bigint AS amount FROM "ManagedCourseDossier"`,
  ]);
  const metrics = [
    ["Encaissements parents nets", parents._sum.amount ?? 0],
    ["Reste dû par les parents", Number(dues[0]?.amount ?? 0)],
    ["Reste à payer aux professeurs", teacherBalance._sum.amountDelta ?? 0],
    [
      "Professeurs déjà réglés · net des corrections",
      -(paid._sum.amountDelta ?? 0),
    ],
    [
      "Part Compétence acquise",
      (validated._sum.fundedAmount ?? 0) -
        (validated._sum.creditedTeacherAmount ?? 0),
    ],
    ["Fonds reçus · cours non encore validés", pending._sum.fundedAmount ?? 0],
    ["Séances annulées · fonds à rapprocher", cancelled._sum.fundedAmount ?? 0],
    ["Remboursements parents enregistrés", -(refunds._sum.amount ?? 0)],
  ] as const;
  const page = ledger.slice(0, 30);
  return (
    <main className="mx-auto max-w-6xl space-y-7 bg-white p-4 text-slate-900 sm:p-7">
      <Link className="underline" href="/admin/accompagnement">
        Accompagnement
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Comptabilité du service</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Encaissements et versements manuels rapprochés par l'équipe. Chaque
          rémunération exige une séance validée et un règlement parent. Les
          retenues pour litige restent non payables. Ces indicateurs ne sont pas
          un relevé bancaire ; les soldes historiques ne sont pas convertis.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            className="rounded-2xl border border-slate-300 bg-white p-5"
            key={label}
          >
            <p className="text-sm leading-6 text-slate-600">{label}</p>
            <strong className="mt-3 block text-2xl tracking-tight text-slate-950">
              {money(value)}
            </strong>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Écritures professeurs</h2>
        <div className="divide-y rounded-2xl border">
          {page.map((entry) => (
            <article
              key={entry.id}
              className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <strong>{entry.teacher.fullName}</strong>
                <p className="mt-1 text-sm">
                  {kinds[entry.kind] || entry.kind} ·{" "}
                  {entry.createdAt.toISOString().slice(0, 10)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {entry.reference || entry.note}
                </p>
                {entry.session && (
                  <Link
                    className="mt-2 inline-block text-sm underline"
                    href={`/admin/accompagnement/${entry.session.dossierId}`}
                  >
                    {entry.session.dossier.reference}
                  </Link>
                )}
              </div>
              <strong className="text-lg">
                {entry.amountDelta > 0 ? "+" : ""}
                {money(entry.amountDelta)}
              </strong>
            </article>
          ))}
          {!page.length && (
            <p className="p-5">Aucune écriture dans ce nouveau service.</p>
          )}
        </div>
        {ledger.length > 30 && (
          <Link
            className="mt-3 inline-block rounded-xl border p-3"
            href={`/admin/accompagnement/comptabilite?before=${page.at(-1)!.id}`}
          >
            Écritures suivantes
          </Link>
        )}
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          20 dernières écritures parents
        </h2>
        <div className="divide-y rounded-2xl border">
          {receipts.map((entry) => (
            <Link
              key={entry.id}
              className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
              href={`/admin/accompagnement/${entry.dossierId}`}
            >
              <div>
                <strong>{entry.dossier.reference}</strong>
                <p className="mt-1 text-sm">
                  {kinds[entry.kind]} · {entry.method} · {entry.reference}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {entry.createdAt.toISOString()} · Opérateur {entry.recordedBy}
                </p>
              </div>
              <strong>{money(entry.amount)}</strong>
            </Link>
          ))}
          {!receipts.length && (
            <p className="p-5">
              Aucun encaissement ou remboursement enregistré.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
