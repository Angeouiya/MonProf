import { z } from "zod";

export const MANAGED_TERMS_VERSION = "managed-2026-11-24-v2";
export const MANAGED_DURATION_MINUTES = 120;
export const MANAGED_MIN_COMMISSION_BPS = 2_000;
export const MANAGED_MAX_COMMISSION_BPS = 3_000;
export const MANAGED_CLASSES = [
  "6e",
  "5e",
  "4e",
  "3e",
  "Seconde",
  "Première",
  "Terminale",
] as const;
export const MANAGED_MONTHLY_PRICES = {
  ivoirien: [50_000, 60_000, 70_000, 85_000, 90_000, 100_000, 120_000],
  francais: [75_000, 75_000, 75_000, 100_000, 130_000, 145_000, 150_000],
} as const;
export function managedCoursesEnabled() {
  return process.env.MANAGED_LESSONS_ENABLED === "true";
}
export const managedRequestSchema = z
  .object({
    termsVersion: z.literal(MANAGED_TERMS_VERSION, { error: "La version du formulaire a changé. Actualisez avant d'accepter." }),
    clientKey: z.string().uuid(),
    parentName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(
        /^(?:\+225)?[0-9 ]{10,16}$/,
        "Renseignez un numéro ivoirien valide.",
      ),
    journey: z.enum(["ivoirien", "francais"]),
    className: z.enum(MANAGED_CLASSES),
    subjectId: z.string().min(1).max(100),
    courseFormat: z.enum(["HOME", "ONLINE"]),
    commune: z.string().trim().max(100).default(""),
    quartier: z.string().trim().max(100).default(""),
    addressHint: z.string().trim().max(240).default(""),
    objective: z.string().trim().max(500).default(""),
    cadence: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
    sessions: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().regex(/^(?:(?:0[8-9]|1\d):(?:00|30)|20:00)$/),
        }),
      )
      .min(1)
      .max(24),
    accepted: z.boolean(),
    quotedTotal: z.number().int().positive(),
    website: z.string().max(0).optional(),
  })
  .strict();
export type ManagedRequestInput = z.infer<typeof managedRequestSchema>;

export function managedPrice(
  journey: keyof typeof MANAGED_MONTHLY_PRICES,
  className: string,
  count: number,
) {
  const index = MANAGED_CLASSES.indexOf(
    className as (typeof MANAGED_CLASSES)[number],
  );
  if (index < 0 || !Number.isSafeInteger(count) || count < 1 || count > 24)
    throw new Error("Classe ou nombre de séances invalide.");
  const monthly = MANAGED_MONTHLY_PRICES[journey][index];
  const perSession = monthly / 4;
  return { monthly, perSession, total: perSession * count };
}
export function managedSplit(amount: number, commissionRateBps: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Montant FCFA invalide.");
  if (
    !Number.isInteger(commissionRateBps) ||
    commissionRateBps < MANAGED_MIN_COMMISSION_BPS ||
    commissionRateBps > MANAGED_MAX_COMMISSION_BPS ||
    commissionRateBps % 100 !== 0
  )
    throw new Error(
      "La commission Compétence doit être comprise entre 20 % et 30 %, par pourcentage entier.",
    );
  const platform = Math.round((amount * commissionRateBps) / 10_000);
  return { platform, teacher: amount - platform };
}
export function managedPayableCredit(session: {
  amount: number;
  fundedAmount: number;
  creditedTeacherAmount: number;
  status: string;
  commissionRateBps: number | null;
}) {
  if (session.fundedAmount < 0 || session.fundedAmount > session.amount)
    throw new Error("Financement incohérent.");
  if (session.status === "VALIDATED" && session.commissionRateBps === null)
    throw new Error("Commission de la séance non définie.");
  const earned =
    session.status === "VALIDATED"
      ? managedSplit(session.fundedAmount, session.commissionRateBps!).teacher
      : 0;
  if (earned < session.creditedTeacherAmount)
    throw new Error("Une régularisation comptable est nécessaire.");
  return earned - session.creditedTeacherAmount;
}
export function managedSlots(
  input: Pick<ManagedRequestInput, "sessions">,
  now = new Date(),
) {
  managedRequestSchema.shape.sessions.parse(input.sessions);
  const seen = new Set<string>();
  return input.sessions
    .map((slot) => {
      const date = new Date(`${slot.date}T00:00:00.000Z`);
      const start = new Date(`${slot.date}T${slot.time}:00.000Z`);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== slot.date ||
        start.getTime() < now.getTime() + 30 * 60_000 ||
        start.getTime() > now.getTime() + 366 * 86_400_000
      )
        throw new Error(
          "Choisissez des dates futures, dans les douze prochains mois.",
        );
      if (seen.has(slot.date))
        throw new Error("Une seule séance par date pour ce dossier.");
      seen.add(slot.date);
      return {
        scheduledDate: date,
        scheduledTime: slot.time,
        durationMinutes: MANAGED_DURATION_MINUTES,
      };
    })
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
}

export function managedInstallments(
  sessions: { date: string; amount: number }[],
  cadence: string,
) {
  if (!sessions.length) return [];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(`${ordered[0].date}T00:00:00Z`);
  const boundary = (period: number) => {
    if (cadence !== "MONTHLY")
      return new Date(
        start.getTime() + period * (cadence === "WEEKLY" ? 7 : 14) * 86_400_000,
      );
    const date = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + period, 1),
    );
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(start.getUTCDate(), last));
    return date;
  };
  const groups = new Map<number, { dueDate: string; amount: number }>();
  for (const session of ordered) {
    let period = 0;
    while (
      boundary(period + 1)
        .toISOString()
        .slice(0, 10) <= session.date
    )
      period++;
    const group = groups.get(period) ?? {
      dueDate: boundary(period + 1)
        .toISOString()
        .slice(0, 10),
      amount: 0,
    };
    group.amount += session.amount;
    groups.set(period, group);
  }
  return [...groups.values()];
}

export const MANAGED_PARENT_TERMS = [
  "Chaque séance dure deux heures. Le montant du dossier correspond au tarif par séance multiplié par le nombre de séances, sans renouvellement implicite.",
  "Le parent règle Compétence hors ligne, selon l'échéancier accepté (hebdomadaire, toutes les deux semaines ou mensuel). Aucun paiement n'est demandé sur ce formulaire.",
  "La demande reste soumise à la vérification de Compétence et à l'acceptation d'un professeur compatible. Tout changement du prix ou des séances nécessite un nouvel accord du parent.",
  "Le parent s'engage à respecter les échéances convenues et à prévenir Compétence de toute absence, difficulté de paiement ou demande de report. Un incident fait l'objet d'un échange contradictoire ; aucune pénalité non acceptée n'est ajoutée automatiquement.",
  "Les informations nécessaires sont communiquées au professeur attribué pour organiser les cours. L'âge de l'élève n'est pas demandé. La notice de confidentialité détaille les traitements et les droits.",
  "Pour une annulation, un remplacement ou une réclamation, le parent contacte Compétence. Une séance non effectuée ne peut être comptabilisée comme effectuée ; les montants déjà reçus doivent être rapprochés avant toute clôture.",
  "Le lien privé du dossier permet aussi de transmettre une demande d'annulation ou une réclamation. L'équipe examine la demande avec les parties. Une réclamation retient les sommes encore disponibles du dossier ; elle ne récupère pas automatiquement un versement déjà exécuté.",
  "Une séance non effectuée annulée par l'équipe est déduite des cours restant dus. Les fonds correspondants déjà reçus font l'objet d'un rapprochement puis, s'il y a lieu, d'un remboursement manuel vérifié. Une séance contestée déjà déclarée effectuée est traitée séparément, sans annulation rétroactive automatique ni pénalité non convenue.",
];
export const MANAGED_TEACHER_TERMS =
  "La commission Compétence est fixée entre 20 % et 30 % pour chaque mission avant son acceptation ; le professeur reçoit la part restante, entre 70 % et 80 %. Le taux exact affiché est conservé pour les séances attribuées. La rémunération est payable après encaissement du parent et validation des séances. Le professeur s'engage à la ponctualité, à la qualité pédagogique, à la confidentialité, au respect de la vie privée de la famille et à la sécurité de l'élève. Il signale immédiatement tout empêchement à Compétence et ne sous-traite pas la mission sans autorisation.";
// Retain past versions when adding conditions. Accepted evidence stores its
// own verbatim snapshot and must never be silently rewritten.
const parentTermsHistory: Record<string, readonly string[]> = {
  "managed-2026-11-24-v1": MANAGED_PARENT_TERMS.slice(0, 6),
  "managed-2026-11-24-v2": MANAGED_PARENT_TERMS,
};
export function managedParentTermsForVersion(version: string) {
  const terms = parentTermsHistory[version];
  if (!terms) throw new Error("Version des conditions indisponible. Contactez Compétence.");
  return [...terms];
}
export function managedTeacherTerms(commissionRateBps: number, version = MANAGED_TERMS_VERSION) {
  if (!parentTermsHistory[version]) throw new Error("Version des engagements professeur indisponible.");
  managedSplit(0, commissionRateBps);
  return `J'accepte les séances proposées et la commission Compétence de ${commissionRateBps / 100} %, soit une part professeur de ${100 - commissionRateBps / 100} %. ${MANAGED_TEACHER_TERMS}`;
}
