import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { ManagedAction } from "@/components/managed/action";
import styles from "@/components/managed/workspace.module.css";
const money = (n: number) => `${n.toLocaleString("fr-FR")} F CFA`;
export const dynamic = "force-dynamic";
export default async function ManagedPartners({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; after?: string }>;
}) {
  const admin = await requireAdmin("FINANCE_VIEW");
  const { q = "", after } = await searchParams;
  const search = q.trim().slice(0, 100);
  const cursor = after
    ? await db.managedPartner.findUnique({
        where: { id: after },
        select: { createdAt: true, id: true },
      })
    : null;
  const partners = await db.managedPartner.findMany({
    where: {
      AND: [
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search } },
                ],
              },
            ]
          : []),
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 31,
  });
  const page = partners.slice(0, 30);
  const totals = page.length
    ? await db.$queryRaw<
        { id: string; earned: bigint; paid: bigint; dossiers: bigint }[]
      >(Prisma.sql`
    SELECT p.id,
    COALESCE((SELECT sum(round(s."fundedAmount"::numeric*d."partnerRateBps"/10000)) FROM "ManagedCourseSession" s JOIN "ManagedCourseDossier" d ON d.id=s."dossierId" WHERE d."partnerId"=p.id AND s.status='VALIDATED'),0)::bigint AS earned,
    -COALESCE((SELECT sum("amountDelta") FROM "ManagedPartnerPayment" WHERE "partnerId"=p.id),0)::bigint AS paid,
    (SELECT count(*) FROM "ManagedCourseDossier" WHERE "partnerId"=p.id)::bigint AS dossiers
    FROM "ManagedPartner" p WHERE p.id IN (${Prisma.join(page.map((p) => p.id))})`)
    : [];
  const summary = new Map(totals.map((t) => [t.id, t]));
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Gestion interne</p>
          <h1>Partenaires</h1>
          <p className={styles.muted}>
            Un numéro, un partenaire, tous ses dossiers réunis.
          </p>
        </div>
        <Link
          className={styles.button}
          href="/admin/accompagnement/comptabilite"
        >
          Comptabilité
        </Link>
      </header>
      {hasAdminPermission(admin.adminPermissions, "FINANCE_MANAGE") && (
        <details className={styles.disclosure}>
          <summary>Enregistrer un partenaire</summary>
          <ManagedAction
            endpoint="/api/admin/managed-partners"
            payload={{ action: "CREATE" }}
            fields={[
              { name: "name", label: "Nom du partenaire" },
              { name: "phone", label: "Numéro du partenaire", type: "tel" },
            ]}
            label="Enregistrer"
            confirmText="Ce partenaire sera uniquement visible dans l’administration. Aucun lien public ni avantage client ne sera créé."
          />
        </details>
      )}
      <form className="flex gap-2">
        <input
          className="min-h-12 min-w-0 flex-1 rounded-xl border px-3"
          name="q"
          defaultValue={q}
          placeholder="Nom ou numéro"
          aria-label="Rechercher un partenaire"
        />
        <button className={styles.button}>Rechercher</button>
      </form>
      <div className={styles.list}>
        {page.map((p) => {
          const t = summary.get(p.id);
          return (
            <Link
              className={styles.row}
              key={p.id}
              href={`/admin/accompagnement/partenaires/${p.id}`}
            >
              <div>
                <strong>{p.name}</strong>
                <p className={styles.muted}>
                  {p.phone} · {Number(t?.dossiers ?? 0)} dossier(s) ·{" "}
                  {p.active ? "Actif" : "Désactivé"}
                </p>
              </div>
              <div className="text-right">
                <strong>
                  {money(Number(t?.earned ?? 0) - Number(t?.paid ?? 0))}
                </strong>
                <p className={styles.muted}>Reste à régler</p>
                <p className={styles.muted}>
                  Acquis {money(Number(t?.earned ?? 0))} · Réglé{" "}
                  {money(Number(t?.paid ?? 0))}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      {!page.length && (
        <p className={styles.empty}>
          Aucun partenaire enregistré pour cette recherche.
        </p>
      )}
      {partners.length > 30 && (
        <Link
          className={styles.button}
          href={`/admin/accompagnement/partenaires?after=${page.at(-1)!.id}&q=${encodeURIComponent(search)}`}
        >
          Partenaires suivants
        </Link>
      )}
      <p className={styles.muted}>
        Les anciens parrainages restent consultables dans{" "}
        <Link className="underline" href="/admin/partenariats">
          l’historique
        </Link>
        . Aucun ancien profil n’est importé ni rémunéré automatiquement dans ce
        registre.
      </p>
    </div>
  );
}
