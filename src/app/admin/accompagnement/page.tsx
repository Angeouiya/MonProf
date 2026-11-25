import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";
import { managedStatusLabel } from "@/lib/managed-courses-labels";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import styles from "@/components/managed/workspace.module.css";
const money = (value: number) => `${value.toLocaleString("fr-FR")} F`;
export const dynamic = "force-dynamic";
export default async function ManagedAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; filtre?: string }>;
}) {
  const admin = await requireAdmin("BOOKINGS_VIEW");
  const { after, filtre } = await searchParams;
  const filter = ["nouveaux", "en-cours"].includes(filtre ?? "")
    ? filtre
    : "tous";
  const where: Prisma.ManagedCourseDossierWhereInput =
    filter === "nouveaux"
      ? { status: "NEW" }
      : filter === "en-cours"
        ? { status: { in: ["OFFERED", "ACTIVE"] } }
        : {};
  const canManage = hasAdminPermission(
    admin.adminPermissions,
    "BOOKINGS_MANAGE",
  );
  const cursor = after
    ? await db.managedCourseDossier.findFirst({
        where: { ...where, id: after },
        select: { id: true, createdAt: true },
      })
    : null;
  const financePromise = hasAdminPermission(
    admin.adminPermissions,
    "FINANCE_VIEW",
  )
    ? Promise.all([
        db.managedParentReceipt.aggregate({ _sum: { amount: true } }),
        db.managedTeacherLedgerEntry.aggregate({ _sum: { amountDelta: true } }),
        db.managedCourseSession.aggregate({
          where: { status: "VALIDATED" },
          _sum: { fundedAmount: true, creditedTeacherAmount: true },
        }),
      ])
    : null;
  const [rows, count, finance] = await Promise.all([
    db.managedCourseDossier.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
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
        onHold: true,
      },
    }),
    db.managedCourseDossier.count({ where }),
    financePromise,
  ]);
  const page = rows.slice(0, 30);
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Espace administration</p>
          <h1>Demandes de cours</h1>
          <p className={`${styles.muted} mt-2`}>
            Attribuez les demandes et suivez les séances.
          </p>
        </div>
        {canManage && (
          <Link className={styles.button} href="/admin/accompagnement/nouveau">
            <Plus size={17} /> Nouvelle demande
          </Link>
        )}
      </header>
      {finance && (
        <section className={styles.stats} aria-label="Synthèse comptable">
          {[
            ["Encaissements parents", finance[0]._sum.amount ?? 0],
            ["Reste à payer aux professeurs", finance[1]._sum.amountDelta ?? 0],
            [
              "Part Compétence acquise",
              (finance[2]._sum.fundedAmount ?? 0) -
                (finance[2]._sum.creditedTeacherAmount ?? 0),
            ],
          ].map(([label, value]) => (
            <div key={label} className={styles.stat}>
              <p>{label}</p>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </section>
      )}
      <div className={styles.heading}>
        <nav className={styles.tabs} aria-label="Filtrer les demandes">
          {[
            ["tous", "Toutes"],
            ["nouveaux", "À attribuer"],
            ["en-cours", "En cours"],
          ].map(([value, label]) => (
            <Link
              key={value}
              aria-current={filter === value ? "page" : undefined}
              href={`/admin/accompagnement?filtre=${value}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className={styles.muted}>
          {count} dossier{count !== 1 ? "s" : ""}
        </p>
      </div>
      <div className={styles.list}>
        {page.map((dossier) => (
          <Link
            className={styles.row}
            href={`/admin/accompagnement/${dossier.id}`}
            key={dossier.id}
          >
            <div>
              <strong>{dossier.parentName}</strong>
              <p className={`${styles.muted} mt-1`}>
                {dossier.className} · {dossier.subjectName}
              </p>
              <p className={`${styles.muted} mt-1`}>{dossier.reference}</p>
              <span
                className={`${styles.badge} mt-2`}
                data-tone={
                  dossier.onHold || dossier.status === "NEW"
                    ? "attention"
                    : undefined
                }
              >
                {dossier.onHold
                  ? "Litige ouvert"
                  : managedStatusLabel(dossier.status)}
              </span>
            </div>
            <div className={styles.amount}>
              <strong>
                {money(dossier.totalPrice - dossier.cancelledAmount)}
              </strong>
              <p className={`${styles.muted} mt-1`}>
                Reçu : {money(dossier.receivedAmount)}
              </p>
              <p className={styles.muted}>
                Dû :{" "}
                {money(
                  Math.max(
                    0,
                    dossier.totalPrice -
                      dossier.cancelledAmount -
                      dossier.receivedAmount,
                  ),
                )}
              </p>
              <ArrowUpRight size={16} className="ml-auto mt-3" aria-hidden />
            </div>
          </Link>
        ))}
        {!rows.length && (
          <p className={styles.empty}>
            Aucune demande dans cette vue. Les anciens dossiers restent
            accessibles dans les historiques.
          </p>
        )}
      </div>
      {rows.length > 30 && (
        <Link
          className={styles.button}
          href={`/admin/accompagnement?filtre=${filter}&after=${page.at(-1)!.id}`}
        >
          Dossiers suivants
        </Link>
      )}
    </div>
  );
}
