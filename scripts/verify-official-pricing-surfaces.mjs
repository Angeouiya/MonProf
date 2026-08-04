import fs from "node:fs";

const clientDashboard = read("src/app/client/page.tsx");
const pricingBreakdown = read("src/components/shared/booking-pricing-breakdown.tsx");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const professorProfile = read("src/app/professeur/(espace)/profil/page.tsx");
const publicTeachers = read("src/app/professeurs/page.tsx");
const publicTariffs = read("src/app/tarifs/page.tsx");
const clientTeacherSearch = read("src/app/client/rechercher/page.tsx");
const teacherCard = read("src/components/shared/teacher-card.tsx");
const teacherJourneys = read("src/lib/teacher-journeys.ts");
const replacementMatching = read("src/lib/teacher-replacement-matching.ts");
const replacementApi = read("src/app/api/admin/replacement-suggestions/route.ts");
const replacementUi = read("src/app/admin/reservations/[id]/actions-client.tsx");
const teacherForm = read("src/components/admin/teacher-form.tsx");
const teacherAdminDetail = read("src/app/admin/professeurs/[id]/page.tsx");

const checks = [
  [
    "Client recommendations expose the official engine, never a teacher profile price",
    clientDashboard.includes("Tarif officiel calculé selon le parcours")
      && !/t\.pricePerSession|indicativePrice|\/ séance 2h/.test(clientDashboard),
  ],
  [
    "Client payment breakdown explains only the official tier and retained price",
    pricingBreakdown.includes("Grille officielle appliquée")
      && pricingBreakdown.includes("Le professeur ne peut pas le modifier")
      && !/teacherIndicativePrice|Minimum professeur|différer du profil/.test(pricingBreakdown)
      && !bookingForm.includes("teacherIndicativePrice="),
  ],
  [
    "Professor profile contains no obsolete personal lesson price",
    !/pricePerSession|Ancien tarif/.test(professorProfile),
  ],
  [
    "Public teacher list does not serialize a legacy profile price into cards",
    !/pricePerSession:\s*t\.pricePerSession/.test(publicTeachers)
      && publicTeachers.includes("priceLabel={journeyConfig.priceLabel}")
      && clientTeacherSearch.includes("priceLabel={journeyConfig.priceLabel}"),
  ],
  [
    "Professional pricing is visible early and remains high contrast",
    publicTariffs.includes('id: "tarif-professionnel"')
      && publicTariffs.includes('["Formation ou apprentissage métier", 40_000]')
      && publicTariffs.includes('aria-label="Choisir une grille tarifaire"')
      && teacherJourneys.includes('priceLabel: "40 000 F / séance de 2h"')
      && teacherCard.includes("avant frais éventuels")
      && teacherCard.includes('text-[#111B4D]">{priceLabel}'),
  ],
  [
    "Automatic replacement matching ignores obsolete teacher prices",
    !/priceDiff|priceCompatible|Tarif compatible|Écart tarifaire/.test(replacementMatching)
      && !/priceDiff|priceCompatible|Tarif compatible|Écart tarifaire|pricePerSession:\s*teacher\.pricePerSession/.test(replacementApi)
      && !/priceCompatible|pricePerSession:\s*number/.test(replacementUi),
  ],
  [
    "Admin teacher form presents one official grid and keeps legacy columns hidden",
    teacherForm.includes("Grille officielle et commission")
      && teacherForm.includes("Le professeur ne fixe aucun prix")
      && teacherForm.includes('["CP1 à CM1", PRICE_TIERS.FRANCAIS_CP_CM1_37500.amount]')
      && teacherForm.includes('type="hidden" {...register("pricePerSession")}')
      && !/<Input\s+type="number"[^>]*register\("price(?:PerHour|PerSession|Pack4|Pack8)"\)/.test(teacherForm),
  ],
  [
    "Admin teacher detail leads with official Ivorian, French and professional tiers",
    teacherAdminDetail.includes("Grille officielle et répartition")
      && teacherAdminDetail.includes("Aucun prix propre au professeur n'intervient")
      && teacherAdminDetail.includes('["CP1 à CM1", PRICE_TIERS.FRANCAIS_CP_CM1_37500.amount]')
      && teacherAdminDetail.includes("Données historiques du profil")
      && teacherAdminDetail.includes("Ces valeurs sont conservées pour l'audit et ignorées par le moteur"),
  ],
];

for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
}

const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  console.error(`FAIL Official pricing surface verification: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Official pricing surfaces are consistent across client, professor, admin and replacement flows.");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}
