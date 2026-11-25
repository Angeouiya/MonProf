import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { managedPartnerBalance } from "@/lib/managed-partners";
import { ManagedAction } from "@/components/managed/action";
import styles from "@/components/managed/workspace.module.css";
const money = (n: number) => `${n.toLocaleString("fr-FR")} F CFA`;
const methods = [
  { value: "CASH", label: "Espèces" },
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MOMO", label: "MTN MoMo" },
  { value: "BANK", label: "Banque" },
  { value: "OTHER", label: "Autre" },
];
export const dynamic = "force-dynamic";
export default async function ManagedPartnerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const admin = await requireAdmin("FINANCE_VIEW");
  const { id } = await params;
  const { after } = await searchParams;
  const partner = await db.managedPartner.findUnique({ where: { id } });
  if (!partner) notFound();
  const cursor = after
    ? await db.managedCourseDossier.findFirst({
        where: { id: after, partnerId: id },
        select: { id: true, createdAt: true },
      })
    : null;
  const [balance, dossiers, payments] = await Promise.all([
    managedPartnerBalance(db, id),
    db.managedCourseDossier.findMany({
      where: {
        partnerId: id,
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
      take: 21,
    }),
    db.managedPartnerPayment.findMany({
      where: { partnerId: id },
      include: { reversal: { select: { id: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    }),
  ]);
  const canManage = hasAdminPermission(
    admin.adminPermissions,
    "FINANCE_MANAGE",
  );
  const endpoint = "/api/admin/managed-partners";
  return (
    <div className={styles.page}>
      <Link className={styles.button} href="/admin/accompagnement/partenaires">
        Tous les partenaires
      </Link>
      <header className={styles.heading}>
        <div>
          <h1>{partner.name}</h1>
          <p className={styles.muted}>
            {partner.phone} · {partner.active ? "Actif" : "Désactivé"}
          </p>
        </div>
        {canManage && (
          <ManagedAction
            endpoint={endpoint}
            payload={{
              action: "STATUS",
              partnerId: id,
              active: !partner.active,
            }}
            label={
              partner.active
                ? "Désactiver les nouvelles attributions"
                : "Réactiver"
            }
            confirmText="Les dossiers, commissions acquises et versements existants seront conservés."
          />
        )}
      </header>
      <section className={styles.stats}>
        {[
          ["Commissions acquises", balance.earned],
          ["Déjà réglé", balance.paid],
          ["Disponible après retenues", balance.available],
          ["Reste total à régler", balance.remaining],
        ].map(([label, value]) => (
          <div className={styles.stat} key={label}>
            <p>{label}</p>
            <strong>{money(Number(value))}</strong>
          </div>
        ))}
      </section>
      <p className={styles.muted}>
        Commission sur le prix final négocié, au prorata des encaissements des
        séances validées. Les retenues pour litige sont non versables. Aucun
        montant du professeur n’est réduit.
      </p>
      {canManage && balance.available > 0 && (
        <details className={styles.disclosure}>
          <summary>Enregistrer un versement effectué</summary>
          <ManagedAction
            endpoint={endpoint}
            payload={{ action: "PAYMENT", partnerId: id }}
            fields={[
              {
                name: "amount",
                label: "Montant versé",
                type: "number",
                max: balance.available,
              },
              { name: "method", label: "Moyen", options: methods },
              { name: "reference", label: "Référence du versement" },
              {
                name: "note",
                label: "Justification / rapprochement",
                minLength: 10,
              },
              {
                name: "confirmedPaid",
                label: "Je confirme avoir réellement versé ce montant",
                type: "checkbox",
              },
            ]}
            label="Enregistrer le versement"
            confirmText="Cette action enregistre un versement déjà exécuté ; elle n’envoie pas d’argent. Vérifiez le destinataire et la référence."
          />
        </details>
      )}
      <section className={styles.card}>
        <h2>Clients et formations</h2>
        {dossiers.slice(0, 20).map((d) => (
          <Link
            className={styles.row}
            key={d.id}
            href={`/admin/accompagnement/${d.id}`}
          >
            <div>
              <strong>{d.parentName}</strong>
              <p className={styles.muted}>
                {d.reference} · {d.subjectName} · {d.className} · {d.journey}
              </p>
            </div>
            <div>
              <strong>{money(d.totalPrice)}</strong>
              <p className={styles.muted}>
                Partenaire {d.partnerRateBps / 100} % · encaissé{" "}
                {money(d.receivedAmount)}
              </p>
            </div>
          </Link>
        ))}
        {!dossiers.length && (
          <p className={styles.muted}>Aucun dossier associé.</p>
        )}
        {dossiers.length > 20 && (
          <Link className={styles.button} href={`?after=${dossiers[19].id}`}>
            Dossiers suivants
          </Link>
        )}
      </section>
      <details className={styles.disclosure}>
        <summary>Derniers versements et corrections</summary>
        {payments.map((p) => (
          <div className={styles.session} key={p.id}>
            <strong>
              {money(-p.amountDelta)} ·{" "}
              {p.kind === "PAYMENT" ? "Versement" : "Correction"}
            </strong>
            <p className={styles.muted}>
              {p.createdAt.toLocaleDateString("fr-FR")} · {p.method} ·{" "}
              {p.reference}
            </p>
            <p className={styles.muted}>{p.note}</p>
            {canManage && p.kind === "PAYMENT" && !p.reversal && (
              <ManagedAction
                endpoint={endpoint}
                payload={{
                  action: "REVERSE_PAYMENT",
                  partnerId: id,
                  paymentId: p.id,
                }}
                fields={[
                  {
                    name: "note",
                    label: "Motif de la correction",
                    minLength: 10,
                  },
                  {
                    name: "confirmedCorrection",
                    label: "Je confirme le rapprochement comptable",
                    type: "checkbox",
                  },
                ]}
                label="Corriger cette écriture"
                confirmText="Une contre-écriture sera créée. L’original ne sera pas effacé ; cette action ne récupère pas automatiquement l’argent."
              />
            )}
          </div>
        ))}
      </details>
    </div>
  );
}
