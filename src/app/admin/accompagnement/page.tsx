import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
const money = (value: number) => `${value.toLocaleString("fr-FR")} F`;
export const dynamic = "force-dynamic";
export default async function ManagedAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const admin = await requireAdmin("BOOKINGS_VIEW");
  const { after } = await searchParams;
  const cursor = after
    ? await db.managedCourseDossier.findUnique({
        where: { id: after },
        select: { id: true, createdAt: true },
      })
    : null;
  const [rows, count] = await Promise.all([
    db.managedCourseDossier.findMany({
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
      select: {
        id: true,
        reference: true,
        parentName: true,
        className: true,
        subjectName: true,
        totalPrice: true,
        receivedAmount: true,
        cancelledAmount: true,
        status: true,
      },
    }),
    db.managedCourseDossier.count(),
  ]);
  const page = rows.slice(0, 30);
  const finance = hasAdminPermission(admin.adminPermissions, "FINANCE_VIEW")
    ? await Promise.all([
        db.managedParentReceipt.aggregate({ _sum: { amount: true } }),
        db.managedTeacherLedgerEntry.aggregate({ _sum: { amountDelta: true } }),
        db.managedCourseSession.aggregate({
          where: { status: "VALIDATED" },
          _sum: { fundedAmount: true, creditedTeacherAmount: true },
        }),
      ])
    : null;
  return (
    <main className="mx-auto max-w-6xl space-y-6 bg-white p-4 text-slate-900 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Accompagnement</h1>
          <p className="mt-2 text-slate-600">
            {count} dossiers · attribution et suivi des séances
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#092A55] px-5 py-3 font-semibold"
          href="/admin/accompagnement/nouveau"
        >
          Saisir une demande parent
        </Link>
      </header>
      {finance && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Encaissements parents enregistrés", finance[0]._sum.amount ?? 0],
            ["Reste à payer aux professeurs", finance[1]._sum.amountDelta ?? 0],
            [
              "Part Compétence · séances validées et financées",
              (finance[2]._sum.fundedAmount ?? 0) -
                (finance[2]._sum.creditedTeacherAmount ?? 0),
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-300 p-5">
              <p className="text-sm text-slate-600">{label}</p>
              <strong className="mt-2 block text-2xl">
                {money(Number(value))}
              </strong>
            </div>
          ))}
        </section>
      )}
      <div className="divide-y rounded-2xl border border-slate-200">
        {page.map((dossier) => (
          <Link
            className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]"
            href={`/admin/accompagnement/${dossier.id}`}
            key={dossier.id}
          >
            <div>
              <strong>
                {dossier.reference} · {dossier.parentName}
              </strong>
              <p className="mt-1 text-sm text-slate-600">
                {dossier.className} · {dossier.subjectName} · {managedStatusLabel(dossier.status)}
              </p>
            </div>
            <div className="text-sm">
              <strong>{money(dossier.totalPrice - dossier.cancelledAmount)}</strong>
              <p>Encaissé : {money(dossier.receivedAmount)}</p>
              <p>
                Reste parent :{" "}
                {money(Math.max(0, dossier.totalPrice - dossier.cancelledAmount - dossier.receivedAmount))}
              </p>
            </div>
          </Link>
        ))}
        {!rows.length && <p className="p-6">Aucune demande pour le moment.</p>}
      </div>
      {rows.length > 30 && (
        <Link
          className="inline-block rounded-xl border p-3"
          href={`/admin/accompagnement?after=${page.at(-1)!.id}`}
        >
          Dossiers suivants
        </Link>
      )}
    </main>
  );
}
