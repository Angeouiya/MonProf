import assert from "node:assert/strict";
import {
  isManagedSchoolSubject,
  managedSchoolSubjectOptions,
  managedSchoolSubjectNames,
} from "../src/lib/managed-school-subjects";
import { isManagedRequestOriginAllowed } from "../src/lib/managed-courses-origin";
import { readFileSync } from "node:fs";
import {
  MANAGED_CLASSES,
  MANAGED_MONTHLY_PRICES,
  MANAGED_DURATION_MINUTES,
  MANAGED_TERMS_VERSION,
  managedInstallments,
  managedPayableCredit,
  managedPrice,
  managedRequestSchema,
  managedSlots,
  managedSplit,
  managedParentTermsForVersion,
} from "../src/lib/managed-courses-core";
import {
  defaultManagedWeeklySlots,
  managedWeeklySessions,
  MANAGED_MAX_SESSIONS,
} from "../src/lib/managed-course-schedule";
import {
  managedAvailableBalance,
  managedCanDeclareDone,
  managedProfessorOfferWhere,
  managedStartsInFuture,
} from "../src/lib/managed-workspace";
import {
  managedTeacherOfferView,
  managedTeacherNetTerms,
} from "../src/lib/managed-teacher-view";
const completionTest = {
  scheduledDate: new Date("2027-01-01T00:00:00Z"),
  scheduledTime: "16:00",
  status: "PLANNED",
};
assert.equal(
  managedCanDeclareDone(
    completionTest,
    false,
    Date.parse("2027-01-01T17:59:59Z"),
  ),
  false,
);
assert.equal(
  managedStartsInFuture(completionTest, Date.parse("2027-01-01T15:59:59Z")),
  true,
);
assert.equal(
  managedStartsInFuture(completionTest, Date.parse("2027-01-01T16:00:00Z")),
  false,
);
assert.equal(
  managedCanDeclareDone(
    completionTest,
    false,
    Date.parse("2027-01-01T18:00:00Z"),
  ),
  true,
);
assert.equal(
  managedCanDeclareDone(
    completionTest,
    true,
    Date.parse("2027-01-01T18:00:00Z"),
  ),
  false,
);
assert.equal(
  managedCanDeclareDone(
    { ...completionTest, status: "DONE" },
    false,
    Date.parse("2027-01-02T00:00:00Z"),
  ),
  false,
);
assert.equal(managedAvailableBalance(30_000, 12_000), 18_000);
assert.equal(managedAvailableBalance(10_000, 25_000), 0);
assert.equal(managedAvailableBalance(-500, 0), 0);
assert.equal(
  managedProfessorOfferWhere("teacher-owned", false).teacherId,
  "teacher-owned",
);
assert.ok(managedProfessorOfferWhere("teacher-owned", true).NOT);
const expectedEight = {
  ivoirien: [100_000, 120_000, 140_000, 170_000, 180_000, 200_000, 240_000],
  francais: [150_000, 150_000, 150_000, 200_000, 260_000, 290_000, 300_000],
};
for (const journey of ["ivoirien", "francais"])
  for (const className of MANAGED_CLASSES)
    assert.ok(isManagedSchoolSubject("Mathématiques", journey, className));
assert.ok(managedSchoolSubjectNames.includes("Mathématiques"));
assert.equal(
  isManagedSchoolSubject("Accessoires de mode", "ivoirien", "6e"),
  false,
);
assert.equal(isManagedSchoolSubject("Philosophie", "ivoirien", "6e"), false);
assert.equal(isManagedSchoolSubject("HGGSP", "francais", "Terminale"), true);
assert.equal(isManagedSchoolSubject("HGGSP", "ivoirien", "Terminale"), false);
for (const level of ["Seconde", "Première", "Terminale"]) {
  assert.equal(isManagedSchoolSubject("BAC ivoirien", "ivoirien", level), true);
  assert.equal(isManagedSchoolSubject("BAC français", "francais", level), true);
  assert.equal(
    isManagedSchoolSubject("BAC français", "ivoirien", level),
    false,
  );
  assert.equal(
    isManagedSchoolSubject("BAC ivoirien", "francais", level),
    false,
  );
  for (const subject of [
    "Anglais",
    "Espagnol",
    "Allemand",
    "Histoire-Géographie",
    "Méthodologie",
  ])
    assert.equal(
      isManagedSchoolSubject(subject, "francais", level),
      true,
      `${subject} disponible au lycée français`,
    );
}
assert.equal(isManagedSchoolSubject("BAC français", "francais", "6e"), false);
assert.equal(isManagedSchoolSubject("BAC ivoirien", "ivoirien", "3e"), false);
const exams = managedSchoolSubjectOptions([
  { id: "bac-fr", name: "BAC français" },
  { id: "bac-ci", name: "BAC ivoirien" },
  { id: "bepc", name: "Préparation BEPC" },
  { id: "bac-a", name: "Préparation BAC A" },
]);
assert.deepEqual(
  exams
    .filter((subject) => subject.programmes.includes("francais:Terminale"))
    .map((subject) => [subject.id, subject.label, subject.kind]),
  [["bac-fr", "Préparation BAC", "EXAM"]],
);
assert.equal(
  exams.filter((subject) => subject.programmes.includes("ivoirien:Terminale"))
    .length,
  2,
);
assert.equal(exams.find((subject) => subject.id === "bepc")?.kind, "EXAM");
const catalogWithLateMaths = [
  ...Array.from({ length: 590 }, (_, index) => ({
    id: String(index),
    name: `Métier ${index}`,
  })),
  { id: "maths", name: "Mathématiques" },
];
assert.deepEqual(
  managedSchoolSubjectOptions(catalogWithLateMaths).map(
    (subject) => subject.id,
  ),
  ["maths"],
  "Une matière scolaire au-delà du 250e élément reste disponible sans catalogue professionnel",
);
assert.equal(
  isManagedRequestOriginAllowed(
    "http://localhost:3315/api/managed-courses",
    "http://127.0.0.1:3315",
    ["http://127.0.0.1:3315"],
  ),
  true,
);
assert.equal(
  isManagedRequestOriginAllowed(
    "http://localhost:3000/api/managed-courses",
    "https://www.competence.ci",
    ["https://www.competence.ci"],
  ),
  true,
);
for (const origin of [
  null,
  "https://evil.example",
  "http://www.competence.ci",
  "https://www.competence.ci.evil.example",
])
  assert.equal(
    isManagedRequestOriginAllowed(
      "http://localhost:3000/api/managed-courses",
      origin,
      ["https://www.competence.ci"],
    ),
    false,
  );
assert.equal(
  isManagedRequestOriginAllowed(
    "http://localhost:3315/api/managed-courses",
    "http://127.0.0.1:9999",
    ["http://127.0.0.1:3315"],
  ),
  false,
);
for (const journey of ["ivoirien", "francais"] as const) {
  for (const [index, level] of MANAGED_CLASSES.entries()) {
    assert.equal(
      managedPrice(journey, level, 4).total,
      expectedEight[journey][index] / 2,
    );
    assert.equal(
      managedPrice(journey, level, 8).total,
      expectedEight[journey][index],
    );
    for (let count = 1; count <= MANAGED_MAX_SESSIONS; count++) {
      const price = managedPrice(journey, level, count);
      assert.equal(
        price.total,
        (MANAGED_MONTHLY_PRICES[journey][index] * count) / 4,
      );
      const split = managedSplit(price.total, 2_000);
      assert.equal(split.teacher + split.platform, price.total);
      assert.equal(split.platform, price.total * 0.2);
    }
  }
}
assert.equal(MANAGED_DURATION_MINUTES, 120);
assert.equal(managedPrice("ivoirien", "5e", 6).total, 90_000);
assert.throws(() => managedPrice("ivoirien", "CP1", 4));
assert.throws(() => managedPrice("ivoirien", "6e", 1.5));
const base = {
  amount: 15_000,
  fundedAmount: 0,
  creditedTeacherAmount: 0,
  status: "VALIDATED",
  commissionRateBps: 2_000,
};
assert.equal(
  managedPayableCredit(base),
  0,
  "Un impayé parent ne crée pas de solde payable",
);
assert.equal(
  managedPayableCredit({ ...base, fundedAmount: 15_000, status: "DONE" }),
  0,
  "La déclaration professeur ne vaut pas validation admin",
);
assert.equal(managedPayableCredit({ ...base, fundedAmount: 5_000 }), 4_000);
assert.equal(
  managedPayableCredit({
    ...base,
    fundedAmount: 15_000,
    creditedTeacherAmount: 4_000,
  }),
  8_000,
);
assert.equal(
  managedPayableCredit({
    ...base,
    fundedAmount: 15_000,
    creditedTeacherAmount: 12_000,
  }),
  0,
  "Rejeu sans double crédit",
);
assert.throws(() => managedPayableCredit({ ...base, fundedAmount: 16_000 }));
assert.equal(
  managedPayableCredit({
    ...base,
    fundedAmount: 15_000,
    commissionRateBps: 3_000,
  }),
  10_500,
);
assert.throws(() =>
  managedPayableCredit({
    ...base,
    fundedAmount: 15_000,
    commissionRateBps: null,
  }),
);
for (const rate of [-1, 10_001, 2_750.5, NaN])
  assert.throws(() => managedSplit(15_000, rate));
for (const rate of [0, 1_900, 3_100, 2_750, 10_000])
  assert.equal(
    managedSplit(15_000, rate).teacher + managedSplit(15_000, rate).platform,
    15_000,
  );
for (let percent = 20; percent <= 30; percent++) {
  let credited = 0;
  for (let funded = 1; funded <= base.amount; funded += 1) {
    const delta = managedPayableCredit({
      ...base,
      commissionRateBps: percent * 100,
      fundedAmount: funded,
      creditedTeacherAmount: credited,
    });
    assert.ok(delta >= 0);
    credited += delta;
  }
  assert.equal(credited, managedSplit(base.amount, percent * 100).teacher);
}
const input = managedRequestSchema.parse({
  termsVersion: MANAGED_TERMS_VERSION,
  clientKey: "b62a3950-f5e4-4f1e-a74f-36adb039067e",
  parentName: "Parent test",
  phone: "0700000000",
  journey: "ivoirien",
  className: "6e",
  subjectId: "maths",
  courseFormat: "ONLINE",
  cadence: "WEEKLY",
  sessions: [{ date: "2027-01-01", time: "16:00" }],
  accepted: true,
  quotedTotal: 12_500,
});
assert.equal(
  managedSlots(input, new Date("2026-12-01"))[0].durationMinutes,
  120,
);
assert.throws(() =>
  managedSlots(
    { ...input, sessions: [...input.sessions, ...input.sessions] },
    new Date("2026-12-01"),
  ),
);
const weekly = {
  mode: "WEEKLY" as const,
  startDate: "2027-01-01",
  weeks: 4,
  weeklySlots: defaultManagedWeeklySlots(4, "2027-01-01"),
};
const sixteen = managedWeeklySessions(weekly);
assert.equal(sixteen.length, 16);
assert.equal(
  new Set(sixteen.map((item) => `${item.date}T${item.time}`)).size,
  16,
);
for (const slot of weekly.weeklySlots)
  assert.equal(
    sixteen.filter(
      (item) =>
        new Date(`${item.date}T00:00:00Z`).getUTCDay() === slot.dayOfWeek &&
        item.time === slot.time,
    ).length,
    4,
  );
assert.equal(managedPrice("ivoirien", "6e", sixteen.length).total, 200_000);
assert.equal(
  managedSlots({ sessions: sixteen, schedule: weekly }, new Date("2026-12-01"))
    .length,
  16,
);
assert.throws(
  () =>
    managedSlots(
      { sessions: sixteen.slice(0, 8), schedule: weekly },
      new Date("2026-12-01"),
    ),
  /correspondent|planning/i,
);
const thirtyTwo = managedWeeklySessions({
  ...weekly,
  weeklySlots: defaultManagedWeeklySlots(8, weekly.startDate),
});
assert.equal(thirtyTwo.length, 32);
assert.equal(
  managedSlots({ sessions: thirtyTwo }, new Date("2026-12-01")).length,
  32,
);
assert.equal(
  managedWeeklySessions({
    ...weekly,
    weeks: 8,
    weeklySlots: defaultManagedWeeklySlots(8, weekly.startDate),
  }).length,
  64,
);
for (const invalid of [
  { ...weekly, startDate: "2027-02-30" },
  { ...weekly, weeks: 0 },
  { ...weekly, weeks: 9 },
  { ...weekly, weeklySlots: [] },
  { ...weekly, weeklySlots: [{ dayOfWeek: 1, time: "16:15" }] },
  {
    ...weekly,
    weeklySlots: [
      { dayOfWeek: 1, time: "16:00" },
      { dayOfWeek: 1, time: "17:00" },
    ],
  },
])
  assert.throws(() => managedWeeklySessions(invalid));
assert.equal(
  managedWeeklySessions({
    ...weekly,
    startDate: "2028-02-28",
    weeks: 2,
    weeklySlots: [{ dayOfWeek: 2, time: "08:00" }],
  })[0].date,
  "2028-02-29",
);
assert.throws(
  () =>
    managedSlots(
      {
        sessions: [
          { date: "2027-01-01", time: "10:00" },
          { date: "2027-01-01", time: "11:00" },
        ],
      },
      new Date("2026-12-01"),
    ),
  /chevauchent/,
);
assert.equal(
  managedParentTermsForVersion("managed-2026-11-24-v2").length,
  8,
  "Les engagements historiques restent inchangés",
);
assert.equal(managedParentTermsForVersion("managed-2026-11-25-v3").length, 9);
assert.equal(managedParentTermsForVersion(MANAGED_TERMS_VERSION).length, 10);
assert.equal(
  managedRequestSchema.safeParse({ ...input, age: 12 }).success,
  false,
);
assert.equal(
  managedRequestSchema.safeParse({
    ...input,
    sessions: [{ date: "2027-01-01", time: "20:30" }],
  }).success,
  false,
);
const schedule = [
  { date: "2027-01-01", amount: 15_000 },
  { date: "2027-01-08", amount: 15_000 },
  { date: "2027-01-15", amount: 15_000 },
  { date: "2027-01-22", amount: 15_000 },
];
assert.equal(managedInstallments(schedule, "WEEKLY").length, 4);
assert.equal(managedInstallments(schedule, "FORTNIGHTLY").length, 2);
assert.deepEqual(managedInstallments(schedule, "MONTHLY"), [
  { dueDate: "2027-02-01", amount: 60_000 },
]);
assert.equal(
  managedInstallments([{ date: "2027-01-31", amount: 1 }], "MONTHLY")[0]
    .dueDate,
  "2027-02-28",
);
const service = readFileSync("src/lib/managed-courses.ts", "utf8");
assert.match(service, /lockTeacherSchedule\(tx, teacherId\)/);
assert.match(service, /amountDelta: -data.amount/);
assert.match(service, /data.amount > \(total._sum.amountDelta \?\? 0\)/);
assert.match(service, /acceptedRevision !== dossier.revision/);
assert.match(
  service,
  /actorId \? null : new Date\(\)/,
  "L'admin n'accepte jamais au nom du parent",
);
assert.match(service, /phoneVerified: false/);
assert.doesNotMatch(
  service,
  /teacherWallet\.(update|create)|teacherWalletEntry\.create|jeko/i,
);
const migration = readFileSync(
  "prisma/migrations/20261124200512_managed_courses/migration.sql",
  "utf8",
);
assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE/);
assert.match(migration, /managed_ledger_append_only/);
assert.match(service, /commissionRateBps: offer.commissionRateBps/);
assert.match(migration, /managed_offer_rate_immutable/);
assert.match(migration, /managed_session_rate_immutable/);
console.log(
  "Service accompagné : matières/BAC, 14 grilles, prorata 1–64, récurrence 1–8 semaines, calendrier 2 h sans chevauchement, calcul serveur, commissions, échéances et historique vérifiés.",
);
const clientShell = readFileSync(
  "src/components/managed/public-shell.tsx",
  "utf8",
);
assert.doesNotMatch(
  clientShell,
  /from "next\/link"/,
  "Le parcours public utilise la navigation HTML native sans fan-out RSC",
);
assert.doesNotMatch(
  clientShell,
  /href=["']\/(?:professeur|admin)(?:\/|["'])/,
  "L'espace principal parent/client ne doit pas exposer les accès professionnels",
);
assert.match(clientShell, /href="\/client"/);
assert.doesNotMatch(
  readFileSync("src/components/shared/web-push-realtime.tsx", "utf8"),
  /src="\/images\/[^"\n]+\?/,
  "L'icône locale de permission doit respecter la configuration next/image sans recherche",
);
assert.equal(
  managedRequestSchema.safeParse({
    ...input,
    termsVersion: "managed-2026-11-24-v1",
  }).success,
  false,
  "Un formulaire ancien doit être rechargé avant le nouvel accord",
);
assert.equal(
  managedRequestSchema.safeParse({
    ...input,
    termsVersion: "managed-2026-11-24-v2",
  }).success,
  false,
);
assert.equal(
  managedRequestSchema.safeParse({
    ...input,
    termsVersion: "managed-2026-11-25-v3",
  }).success,
  false,
);
const teacherView = managedTeacherOfferView({
  id: "offer",
  dossierId: "dossier",
  status: "OFFERED",
  commissionRateBps: 2000,
  dossier: {
    reference: "AC-TEST",
    subjectName: "Mathématiques",
    className: "6e",
    courseFormat: "HOME",
    commune: "Cocody",
    quartier: "Angré",
    parentName: "Parent secret",
    phone: "+2250700000000",
    addressHint: "Adresse privée",
    objective: "Révisions",
    onHold: false,
  },
  sessions: [
    {
      id: "s",
      sequence: 1,
      scheduledDate: new Date("2027-01-01"),
      scheduledTime: "10:00",
      durationMinutes: 120,
      status: "PLANNED",
      amount: 90_000,
      commissionRateBps: null,
      creditedTeacherAmount: 0,
    },
  ],
});
assert.equal(teacherView.remuneration, 72_000);
assert.equal(teacherView.dossier.phone, null);
assert.doesNotMatch(
  JSON.stringify(teacherView),
  /commission|partner|totalPrice|90[ _]?000|Parent secret|Adresse privée/,
);
assert.doesNotMatch(
  managedTeacherNetTerms(72_000),
  /%|commission|partenaire|90[ _]?000/i,
);
const managedForm = readFileSync(
  "src/components/managed/request-form.tsx",
  "utf8",
);
assert.match(
  managedForm,
  /key="continue" type="button"/,
  "La transition ne doit jamais réutiliser le bouton d'envoi",
);
assert.match(
  managedForm,
  /key="send" type="submit"/,
  "L'envoi final doit avoir une identité DOM distincte",
);
assert.equal(
  (managedForm.match(/data-form-step="[012]" hidden=/g) || []).length,
  3,
  "Les trois étapes conservent leur visibilité explicite",
);
assert.match(managedForm, /setVisitedSteps\(\(visited\) => visited \| \(1 << next\)\)/,
  "Une étape déjà visitée reste montée pour préserver les champs et FormData");
assert.match(managedForm, /\(visitedSteps & 2\) !== 0 && <section data-form-step="1"/);
assert.match(managedForm, /\(visitedSteps & 4\) !== 0 && <section data-form-step="2"/);
assert.match(
  managedForm,
  /control\.checkValidity\(\)/,
  "Chaque étape valide ses propres champs avant de continuer",
);
assert.doesNotMatch(
  readFileSync("src/components/managed/managed-public.module.css", "utf8"),
  /(?:linear|radial|conic)-gradient/,
  "Le design public reste blanc sans dégradé",
);
const warningCard = readFileSync("src/components/ui/alert-dialog.tsx", "utf8");
assert.match(
  warningCard,
  /max-h-\[calc\(100dvh-2rem\)\]/,
  "Une carte d'avertissement longue reste dans l'écran mobile",
);
assert.match(
  warningCard,
  /overflow-y-auto/,
  "Les actions d'une longue confirmation restent accessibles par défilement",
);
