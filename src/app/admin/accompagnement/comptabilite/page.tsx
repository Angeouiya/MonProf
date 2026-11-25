import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import styles from "@/components/managed/workspace.module.css";
const money = (value: number) =>
  `${(value === 0 ? 0 : value).toLocaleString("fr-FR")} F CFA`;
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
    partnerIncome,
    partnerPayments,
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
    db.$queryRaw<
      { amount: bigint }[]
    >`SELECT COALESCE(sum(round(s."fundedAmount"::numeric*d."partnerRateBps"/10000)),0)::bigint AS amount FROM "ManagedCourseSession" s JOIN "ManagedCourseDossier" d ON d.id=s."dossierId" WHERE s.status='VALIDATED' AND d."partnerId" IS NOT NULL`,
    db.managedPartnerPayment.aggregate({ _sum: { amountDelta: true } }),
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
        (validated._sum.creditedTeacherAmount ?? 0) -
        Number(partnerIncome[0]?.amount ?? 0),
    ],
    ["Fonds reçus · cours non encore validés", pending._sum.fundedAmount ?? 0],
    ["Séances annulées · fonds à rapprocher", cancelled._sum.fundedAmount ?? 0],
    ["Remboursements parents enregistrés", -(refunds._sum.amount ?? 0)],
    ["Commissions partenaires acquises", Number(partnerIncome[0]?.amount ?? 0)],
    ["Partenaires déjà réglés", -(partnerPayments._sum.amountDelta ?? 0)],
    [
      "Reste à payer aux partenaires",
      Number(partnerIncome[0]?.amount ?? 0) +
        (partnerPayments._sum.amountDelta ?? 0),
    ],
  ] as const;
  const page = ledger.slice(0, 30);
  return (
    <div className={styles.page}>
      <Link
        className={`${styles.muted} underline`}
        href="/admin/accompagnement"
      >
        Retour aux demandes
      </Link>
      <header>
        <p className={styles.eyebrow}>Accompagnement</p>
        <h1 className="text-3xl font-semibold">Comptabilité</h1>
        <p className={`${styles.muted} mt-2`}>
          Encaissements parents et versements professeurs vérifiés.
        </p>
      </header>
      <section className={styles.stats} aria-label="Principaux montants">
        {metrics.slice(0, 4).map(([label, value]) => (
          <div className={styles.stat} key={label}>
            <p className="text-sm leading-6 text-slate-600">{label}</p>
            <strong className="mt-3 block text-2xl tracking-tight text-slate-950">
              {money(value)}
            </strong>
          </div>
        ))}
      </section>
      <details className={styles.disclosure}>
        <summary>Répartition, remboursements et fonds en attente</summary>
        <div className={styles.stats}>
          {metrics.slice(4).map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <p>{label}</p>
              <strong>{money(value)}</strong>
            </div>
          ))}
        </div>
        <p className={styles.muted}>
          Le reste à payer inclut les éventuelles retenues pour litige, qui ne
          sont pas versables avant résolution. La rémunération exige une séance
          validée et financée. Ces chiffres sont des écritures de gestion, pas
          un relevé bancaire. Les soldes historiques restent séparés.
        </p>
      </details>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Écritures professeurs</h2>
        <div className={styles.list}>
          {page.map((entry) => (
            <article key={entry.id} className={styles.row}>
              <div>
                <strong>{entry.teacher.fullName}</strong>
                <p className="mt-1 text-sm">
                  {kinds[entry.kind] || entry.kind} ·{" "}
                  {entry.createdAt.toISOString().slice(0, 10)}
                </p>
                <p className={`${styles.muted} mt-1`}>
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
              <strong className={styles.amount}>
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
      <details className={styles.disclosure}>
        <summary>20 dernières écritures parents</summary>
        <div className={styles.list}>
          {receipts.map((entry) => (
            <Link
              key={entry.id}
              className={styles.row}
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
      </details>
    </div>
  );
}
