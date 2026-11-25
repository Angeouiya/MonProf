"use client";
import { useState } from "react";
import { managedSplit } from "@/lib/managed-courses-core";
import { ManagedAction } from "./action";
import styles from "./workspace.module.css";
const money = (amount: number) => `${amount.toLocaleString("fr-FR")} F CFA`;
export function ManagedAssignment({
  endpoint,
  teachers,
  amounts,
  partnerRateBps,
}: {
  endpoint: string;
  teachers: { id: string; fullName: string }[];
  amounts: number[];
  partnerRateBps: number;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [share, setShare] = useState("80");
  const percentage = Number(share);
  const bps = Math.round((100 - percentage) * 100);
  const valid =
    share !== "" &&
    Number.isFinite(percentage) &&
    percentage >= 0 &&
    percentage <= 100 &&
    Math.abs(percentage * 100 - Math.round(percentage * 100)) < 0.00001 &&
    bps >= partnerRateBps;
  const teacherNet = valid
    ? amounts.reduce(
        (sum, amount) => sum + managedSplit(amount, bps).teacher,
        0,
      )
    : 0;
  const partner = amounts.reduce(
    (sum, amount) => sum + Math.round((amount * partnerRateBps) / 10000),
    0,
  );
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Professeur
        <select
          className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Choisir un professeur</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Part du professeur (%)
        <input
          className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={share}
          onChange={(e) => setShare(e.target.value)}
        />
      </label>
      {valid ? (
        <div className={styles.stats} aria-live="polite">
          {[
            ["Montant envoyé au professeur", teacherNet],
            ["Partenaire", partner],
            ["Compétence", total - teacherNet - partner],
          ].map(([label, amount]) => (
            <div className={styles.stat} key={label}>
              <p>{label}</p>
              <strong>{money(Number(amount))}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p role="alert" className={styles.notice}>
          Choisissez une part entre 0 et 100 %, sans dépasser le budget avec le
          partenaire.
        </p>
      )}
      <p className={styles.muted}>
        Ces détails restent internes. Le professeur reçoit uniquement sa
        rémunération, les horaires et les informations utiles à la mission.
      </p>
      {valid && teacherId ? (
        <ManagedAction
          endpoint={endpoint}
          payload={{
            action: "OFFER",
            teacherId,
            teacherSharePercent: percentage,
          }}
          label="Envoyer la mission"
          confirmText={`Le professeur recevra une proposition de rémunération de ${money(teacherNet)} pour ${amounts.length} séance(s). Son montant ne changera plus après acceptation. Les horaires et habilitations seront revérifiés.`}
        />
      ) : null}
    </div>
  );
}
