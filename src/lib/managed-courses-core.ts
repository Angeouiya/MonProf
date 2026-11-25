import { z } from "zod";
import {
  MANAGED_MAX_SESSIONS,
  MANAGED_MAX_WEEKS,
  MANAGED_MAX_WEEKLY_SLOTS,
  managedWeeklySessions,
  orderedManagedSessions,
} from "./managed-course-schedule";

export const MANAGED_TERMS_VERSION = "managed-2026-11-25-v4";
export const MANAGED_DURATION_MINUTES = 120;
export const MANAGED_MIN_COMMISSION_BPS = 0;
export const MANAGED_MAX_COMMISSION_BPS = 10_000;
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
    termsVersion: z.literal(MANAGED_TERMS_VERSION, {
      error: "La version du formulaire a changé. Actualisez avant d'accepter.",
    }),
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
    schedule: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("DATES") }).strict(),
        z
          .object({
            mode: z.literal("WEEKLY"),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            weeks: z.number().int().min(1).max(MANAGED_MAX_WEEKS),
            weeklySlots: z
              .array(
                z
                  .object({
                    dayOfWeek: z.number().int().min(0).max(6),
                    time: z
                      .string()
                      .regex(/^(?:(?:0[8-9]|1\d):(?:00|30)|20:00)$/),
                  })
                  .strict(),
              )
              .min(1)
              .max(MANAGED_MAX_WEEKLY_SLOTS),
          })
          .strict(),
      ])
      .optional(),
    sessions: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().regex(/^(?:(?:0[8-9]|1\d):(?:00|30)|20:00)$/),
        }),
      )
      .min(1)
      .max(MANAGED_MAX_SESSIONS),
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
  if (
    index < 0 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > MANAGED_MAX_SESSIONS
  )
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
    commissionRateBps > MANAGED_MAX_COMMISSION_BPS
  )
    throw new Error("La répartition doit être comprise entre 0 % et 100 %.");
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
  input: Pick<ManagedRequestInput, "sessions" | "schedule">,
  now = new Date(),
) {
  managedRequestSchema.shape.sessions.parse(input.sessions);
  if (input.schedule) {
    const rule = managedRequestSchema.shape.schedule.parse(input.schedule);
    if (rule?.mode === "WEEKLY") {
      try {
        const calculated = managedWeeklySessions(rule);
        const received = [...input.sessions].sort((a, b) =>
          `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
        );
        if (JSON.stringify(calculated) !== JSON.stringify(received))
          throw new Error(
            "Le nombre et les dates ne correspondent pas à la répétition hebdomadaire. Recalculez le planning.",
          );
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : "Planning invalide.",
        );
      }
    }
  }
  const slots = orderedManagedSessions(input.sessions).map((slot) => {
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
    return {
      scheduledDate: date,
      scheduledTime: slot.time,
      durationMinutes: MANAGED_DURATION_MINUTES,
    };
  });
  return slots;
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

const MANAGED_PARENT_TERMS_V2 = [
  "Chaque séance dure deux heures. Le montant du dossier correspond au tarif par séance multiplié par le nombre de séances, sans renouvellement implicite.",
  "Le parent règle Compétence hors ligne, selon l'échéancier accepté (hebdomadaire, toutes les deux semaines ou mensuel). Aucun paiement n'est demandé sur ce formulaire.",
  "La demande reste soumise à la vérification de Compétence et à l'acceptation d'un professeur compatible. Tout changement du prix ou des séances nécessite un nouvel accord du parent.",
  "Le parent s'engage à respecter les échéances convenues et à prévenir Compétence de toute absence, difficulté de paiement ou demande de report. Un incident fait l'objet d'un échange contradictoire ; aucune pénalité non acceptée n'est ajoutée automatiquement.",
  "Les informations nécessaires sont communiquées au professeur attribué pour organiser les cours. L'âge de l'élève n'est pas demandé. La notice de confidentialité détaille les traitements et les droits.",
  "Pour une annulation, un remplacement ou une réclamation, le parent contacte Compétence. Une séance non effectuée ne peut être comptabilisée comme effectuée ; les montants déjà reçus doivent être rapprochés avant toute clôture.",
  "Le lien privé du dossier permet aussi de transmettre une demande d'annulation ou une réclamation. L'équipe examine la demande avec les parties. Une réclamation retient les sommes encore disponibles du dossier ; elle ne récupère pas automatiquement un versement déjà exécuté.",
  "Une séance non effectuée annulée par l'équipe est déduite des cours restant dus. Les fonds correspondants déjà reçus font l'objet d'un rapprochement puis, s'il y a lieu, d'un remboursement manuel vérifié. Une séance contestée déjà déclarée effectuée est traitée séparément, sans annulation rétroactive automatique ni pénalité non convenue.",
];
const MANAGED_PARENT_TERMS_V3 = [
  ...MANAGED_PARENT_TERMS_V2,
  "Le planning peut être répété sur un nombre défini de semaines ou composé de dates ponctuelles. Quatre semaines représentent une période de 28 jours, pas nécessairement un mois civil. Le total facturé est toujours le nombre exact de séances affichées multiplié par le tarif unitaire, sans abonnement ni renouvellement automatique.",
];
export const MANAGED_PARENT_TERMS = [
  ...MANAGED_PARENT_TERMS_V3,
  "Le parent peut confirmer qu’une séance déclarée effectuée a bien eu lieu depuis son lien privé ou son compte rattaché. Cette confirmation est conservée comme élément de suivi ; elle ne crée pas un paiement et ne remplace pas la vérification de Compétence. Un dossier transmis sans connexion peut être rattaché à un compte client sur présentation de son lien privé valide. Ne partagez pas ce lien.",
];
const MANAGED_TEACHER_TERMS_LEGACY =
  "La commission Compétence est fixée entre 20 % et 30 % pour chaque mission avant son acceptation ; le professeur reçoit la part restante, entre 70 % et 80 %. Le taux exact affiché est conservé pour les séances attribuées. La rémunération est payable après encaissement du parent et validation des séances. Le professeur s'engage à la ponctualité, à la qualité pédagogique, à la confidentialité, au respect de la vie privée de la famille et à la sécurité de l'élève. Il signale immédiatement tout empêchement à Compétence et ne sous-traite pas la mission sans autorisation.";
export const MANAGED_TEACHER_TERMS =
  "Le professeur prend connaissance des horaires et du montant qui lui est attribué avant d’accepter sa mission. Sa rémunération est payable après réalisation et validation des séances et réception du règlement du parent. Il s’engage à la ponctualité, à la qualité pédagogique, à la confidentialité, au respect de la vie privée de la famille et à la sécurité de l’élève. Il signale immédiatement tout empêchement à Compétence et ne sous-traite pas la mission sans autorisation.";
// Retain past versions when adding conditions. Accepted evidence stores its
// own verbatim snapshot and must never be silently rewritten.
const parentTermsHistory: Record<string, readonly string[]> = {
  "managed-2026-11-24-v1": MANAGED_PARENT_TERMS_V2.slice(0, 6),
  "managed-2026-11-24-v2": MANAGED_PARENT_TERMS_V2,
  "managed-2026-11-25-v3": MANAGED_PARENT_TERMS_V3,
  "managed-2026-11-25-v4": MANAGED_PARENT_TERMS,
};
export function managedParentTermsForVersion(version: string) {
  const terms = parentTermsHistory[version];
  if (!terms)
    throw new Error(
      "Version des conditions indisponible. Contactez Compétence.",
    );
  return [...terms];
}
export function managedTeacherTerms(
  commissionRateBps: number,
  version = MANAGED_TERMS_VERSION,
) {
  if (!parentTermsHistory[version])
    throw new Error("Version des engagements professeur indisponible.");
  managedSplit(0, commissionRateBps);
  return `J'accepte les séances proposées et la commission Compétence de ${commissionRateBps / 100} %, soit une part professeur de ${100 - commissionRateBps / 100} %. ${MANAGED_TEACHER_TERMS_LEGACY}`;
}
