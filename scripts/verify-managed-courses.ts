import assert from "node:assert/strict";
import { isManagedSchoolSubject, managedSchoolSubjectOptions, managedSchoolSubjectNames } from "../src/lib/managed-school-subjects";
import { isManagedRequestOriginAllowed } from "../src/lib/managed-courses-origin";
import { readFileSync } from "node:fs";
import { MANAGED_CLASSES, MANAGED_MONTHLY_PRICES, MANAGED_DURATION_MINUTES, MANAGED_TERMS_VERSION, managedInstallments, managedPayableCredit, managedPrice, managedRequestSchema, managedSlots, managedSplit } from "../src/lib/managed-courses-core";
const expectedEight = {
  ivoirien: [100_000, 120_000, 140_000, 170_000, 180_000, 200_000, 240_000],
  francais: [150_000, 150_000, 150_000, 200_000, 260_000, 290_000, 300_000],
};
for (const journey of ["ivoirien", "francais"]) for (const className of MANAGED_CLASSES) assert.ok(isManagedSchoolSubject("Mathématiques", journey, className));
assert.ok(managedSchoolSubjectNames.includes("Mathématiques"));
assert.equal(isManagedSchoolSubject("Accessoires de mode", "ivoirien", "6e"), false);
assert.equal(isManagedSchoolSubject("Philosophie", "ivoirien", "6e"), false);
assert.equal(isManagedSchoolSubject("HGGSP", "francais", "Terminale"), true);
assert.equal(isManagedSchoolSubject("HGGSP", "ivoirien", "Terminale"), false);
const catalogWithLateMaths = [...Array.from({ length: 590 }, (_, index) => ({ id: String(index), name: `Métier ${index}` })), { id: "maths", name: "Mathématiques" }];
assert.deepEqual(managedSchoolSubjectOptions(catalogWithLateMaths).map((subject) => subject.id), ["maths"], "Une matière scolaire au-delà du 250e élément reste disponible sans catalogue professionnel");
assert.equal(isManagedRequestOriginAllowed("http://localhost:3315/api/managed-courses", "http://127.0.0.1:3315", ["http://127.0.0.1:3315"]), true);
assert.equal(isManagedRequestOriginAllowed("http://localhost:3000/api/managed-courses", "https://www.competence.ci", ["https://www.competence.ci"]), true);
for (const origin of [null, "https://evil.example", "http://www.competence.ci", "https://www.competence.ci.evil.example"]) assert.equal(isManagedRequestOriginAllowed("http://localhost:3000/api/managed-courses", origin, ["https://www.competence.ci"]), false);
assert.equal(isManagedRequestOriginAllowed("http://localhost:3315/api/managed-courses", "http://127.0.0.1:9999", ["http://127.0.0.1:3315"]), false);
for (const journey of ["ivoirien", "francais"] as const) {
  for (const [index, level] of MANAGED_CLASSES.entries()) {
    assert.equal(managedPrice(journey, level, 4).total, expectedEight[journey][index] / 2);
    assert.equal(managedPrice(journey, level, 8).total, expectedEight[journey][index]);
    for (let count = 1; count <= 24; count++) {
      const price = managedPrice(journey, level, count);
      assert.equal(price.total, MANAGED_MONTHLY_PRICES[journey][index] * count / 4);
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
const base = { amount: 15_000, fundedAmount: 0, creditedTeacherAmount: 0, status: "VALIDATED", commissionRateBps: 2_000 };
assert.equal(managedPayableCredit(base), 0, "Un impayé parent ne crée pas de solde payable");
assert.equal(managedPayableCredit({ ...base, fundedAmount: 15_000, status: "DONE" }), 0, "La déclaration professeur ne vaut pas validation admin");
assert.equal(managedPayableCredit({ ...base, fundedAmount: 5_000 }), 4_000);
assert.equal(managedPayableCredit({ ...base, fundedAmount: 15_000, creditedTeacherAmount: 4_000 }), 8_000);
assert.equal(managedPayableCredit({ ...base, fundedAmount: 15_000, creditedTeacherAmount: 12_000 }), 0, "Rejeu sans double crédit");
assert.throws(() => managedPayableCredit({ ...base, fundedAmount: 16_000 }));
assert.equal(managedPayableCredit({ ...base, fundedAmount: 15_000, commissionRateBps: 3_000 }), 10_500);
assert.throws(() => managedPayableCredit({ ...base, fundedAmount: 15_000, commissionRateBps: null }));
for (const rate of [1_900, 3_100, 2_750, NaN]) assert.throws(() => managedSplit(15_000, rate));
for (let percent = 20; percent <= 30; percent++) {
  let credited = 0;
  for (let funded = 1; funded <= base.amount; funded += 1) {
    const delta = managedPayableCredit({ ...base, commissionRateBps: percent * 100, fundedAmount: funded, creditedTeacherAmount: credited });
    assert.ok(delta >= 0);
    credited += delta;
  }
  assert.equal(credited, managedSplit(base.amount, percent * 100).teacher);
}
const input = managedRequestSchema.parse({ termsVersion: MANAGED_TERMS_VERSION, clientKey: "b62a3950-f5e4-4f1e-a74f-36adb039067e", parentName: "Parent test", phone: "0700000000", journey: "ivoirien", className: "6e", subjectId: "maths", courseFormat: "ONLINE", cadence: "WEEKLY", sessions: [{ date: "2027-01-01", time: "16:00" }], accepted: true, quotedTotal: 12_500 });
assert.equal(managedSlots(input, new Date("2026-12-01"))[0].durationMinutes, 120);
assert.throws(() => managedSlots({ ...input, sessions: [...input.sessions, ...input.sessions] }, new Date("2026-12-01")));
assert.equal(managedRequestSchema.safeParse({ ...input, age: 12 }).success, false);
assert.equal(managedRequestSchema.safeParse({ ...input, sessions: [{ date: "2027-01-01", time: "20:30" }] }).success, false);
const schedule = [{ date: "2027-01-01", amount: 15_000 }, { date: "2027-01-08", amount: 15_000 }, { date: "2027-01-15", amount: 15_000 }, { date: "2027-01-22", amount: 15_000 }];
assert.equal(managedInstallments(schedule, "WEEKLY").length, 4);
assert.equal(managedInstallments(schedule, "FORTNIGHTLY").length, 2);
assert.deepEqual(managedInstallments(schedule, "MONTHLY"), [{ dueDate: "2027-02-01", amount: 60_000 }]);
assert.equal(managedInstallments([{ date: "2027-01-31", amount: 1 }], "MONTHLY")[0].dueDate, "2027-02-28");
const service = readFileSync("src/lib/managed-courses.ts", "utf8");
assert.match(service, /lockTeacherSchedule\(tx, teacherId\)/);
assert.match(service, /amountDelta: -data.amount/);
assert.match(service, /data.amount > \(total._sum.amountDelta \?\? 0\)/);
assert.match(service, /acceptedRevision !== dossier.revision/);
assert.match(service, /actorId \? null : new Date\(\)/, "L'admin n'accepte jamais au nom du parent");
assert.match(service, /phoneVerified: false/);
assert.doesNotMatch(service, /teacherWallet\.(update|create)|teacherWalletEntry\.create|jeko/i);
const migration = readFileSync("prisma/migrations/20261124200512_managed_courses/migration.sql", "utf8");
assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE/);
assert.match(migration, /managed_ledger_append_only/);
assert.match(service, /commissionRateBps: offer.commissionRateBps/);
assert.match(migration, /managed_offer_rate_immutable/);
assert.match(migration, /managed_session_rate_immutable/);
console.log("Service accompagné : 14 grilles 4/8 séances, prorata 1–24, 2 h, commission 20–30 % par mission, échéances, financement partiel, rejeu, droits et migration additive vérifiés.");
const clientShell = readFileSync("src/components/managed/public-shell.tsx", "utf8");
assert.doesNotMatch(clientShell, /from "next\/link"/, "Le parcours public utilise la navigation HTML native sans fan-out RSC");
assert.doesNotMatch(clientShell, /href=["']\/(?:professeur|admin)(?:\/|["'])/, "L'espace principal parent/client ne doit pas exposer les accès professionnels");
assert.match(clientShell, /href="\/client"/);
assert.doesNotMatch(readFileSync("src/components/shared/web-push-realtime.tsx", "utf8"), /src="\/images\/[^"\n]+\?/, "L'icône locale de permission doit respecter la configuration next/image sans recherche");
assert.equal(managedRequestSchema.safeParse({ ...input, termsVersion: "managed-2026-11-24-v1" }).success, false, "Un formulaire ancien doit être rechargé avant le nouvel accord");
const managedForm = readFileSync("src/components/managed/request-form.tsx", "utf8");
assert.match(managedForm, /key="continue" type="button"/, "La transition ne doit jamais réutiliser le bouton d'envoi");
assert.match(managedForm, /key="send" type="submit"/, "L'envoi final doit avoir une identité DOM distincte");
assert.equal((managedForm.match(/data-form-step="[012]" hidden=/g) || []).length, 3, "Les trois étapes restent montées pour préserver les champs et FormData");
assert.match(managedForm, /control\.checkValidity\(\)/, "Chaque étape valide ses propres champs avant de continuer");
assert.doesNotMatch(readFileSync("src/components/managed/managed-public.module.css", "utf8"), /(?:linear|radial|conic)-gradient/, "Le design public reste blanc sans dégradé");
