import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateBookingPricing,
  calculateGrandAbidjanTransportFee,
  buildNeighborhoodAliasMap,
  GRAND_ABIDJAN_NEAR_ROUTES,
  PENDING_TRANSPORT_FEE_KEY,
} from "../src/lib/pricing";
import {
  COURSE_CATALOG,
  findCourseCatalogItem,
  isCourseCatalogItemCompatible,
  resolveBookingCourseCategory,
  resolveCourseCatalogSchoolSystem,
  validateEducationSelection,
} from "../src/lib/course-catalog";
import { bookingDraftMatchesExpected } from "../src/lib/booking-draft-consistency";
import { requiresTeacherHomeCommune } from "../src/lib/teacher-home-delivery";
import {
  confirmablePricing,
  createPricingConfirmationFingerprint,
  expectedPricingMatches,
} from "../src/lib/pricing-confirmation";

function baseBooking(overrides: Partial<Parameters<typeof calculateBookingPricing>[0]> = {}) {
  return {
    category: "soutien_scolaire",
    deliveryMode: "en_ligne" as const,
    packType: "SINGLE",
    ...overrides,
  };
}

function verifyOfficialPriceGrid() {
  const scenarios = [
    { schoolSystem: "ivoirien", preciseLevel: "CP1", amount: 15_000, key: "ivoirien_cp1_cm1_15000" },
    { schoolSystem: "ivoirien", preciseLevel: "CM2", amount: 20_000, key: "ivoirien_cm2_4e_20000" },
    { schoolSystem: "ivoirien", preciseLevel: "3e", amount: 25_000, key: "ivoirien_3e_1ere_25000" },
    { schoolSystem: "ivoirien", preciseLevel: "Terminale D", amount: 30_000, key: "ivoirien_terminale_30000" },
    { schoolSystem: "francais", preciseLevel: "CP", amount: 37_500, key: "francais_cp_cm1_37500" },
    { schoolSystem: "francais", preciseLevel: "CM2", amount: 50_000, key: "francais_cm2_4e_50000" },
    { schoolSystem: "francais", preciseLevel: "3e", amount: 62_500, key: "francais_3e_1ere_62500" },
    { schoolSystem: "francais", preciseLevel: "Terminale générale", amount: 75_000, key: "francais_terminale_75000" },
  ] as const;

  for (const scenario of scenarios) {
    const pricing = calculateBookingPricing(baseBooking({
      schoolSystem: scenario.schoolSystem,
      levelName: scenario.preciseLevel,
      preciseLevel: scenario.preciseLevel,
      teacherPricePerSession: 100_000,
    }));
    assert.equal(pricing.priceTierKey, scenario.key);
    assert.equal(pricing.unitSessionAmount, scenario.amount);
  }

  const coarseCollege = calculateBookingPricing(baseBooking({
    schoolSystem: "ivoirien",
    levelName: "Collège",
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    teacherQuartier: "Cocody Mermoz",
    clientCommune: "Cocody",
    clientQuartier: "Mermoz",
  }));
  assert.equal(coarseCollege.unitSessionAmount, 20_000);
  assert.equal(coarseCollege.transportFee, 0);
  assert.equal(coarseCollege.paymentServiceFeeAmount, 600);
  assert.equal(coarseCollege.totalClientPays, 20_600);
}

function verifyProfessionalPricing() {
  for (const teacherPricePerSession of [2_000, 10_000, 80_000]) {
    const professional = calculateBookingPricing(baseBooking({
      category: "formation_professionnelle",
      levelName: "Professionnel",
      courseCatalogName: "Power BI",
      teacherPricePerSession,
    }));
    assert.equal(professional.priceTierKey, "professionnel_40000");
    assert.equal(professional.unitSessionAmount, 40_000);
    assert.equal(professional.priceTierLabel, "Parcours professionnel");
  }

  const categoryBypassAttempt = calculateBookingPricing(baseBooking({
    category: "soutien_scolaire",
    schoolSystem: "francais",
    levelName: "Formation professionnelle",
    subjectName: "Couture",
    teacherPricePerSession: 2_000,
  }));
  assert.equal(categoryBypassAttempt.priceTierKey, "professionnel_40000");
  assert.equal(categoryBypassAttempt.unitSessionAmount, 40_000);

  const canonicalProfessionalCategory = resolveBookingCourseCategory({
    requestedCategory: "soutien_scolaire",
    levelName: "Formation professionnelle",
    subjectName: "Couture",
  });
  assert.deepEqual(canonicalProfessionalCategory, {
    category: "formation_professionnelle",
    locked: true,
  });

  const higherEducationPython = COURSE_CATALOG.find((item) => (
    item.actif
    && item.categorie === "enseignement_superieur"
    && item.matiere_ou_competence === "Python"
  ));
  assert.ok(higherEducationPython, "Le catalogue supérieur Python doit exister");
  assert.deepEqual(resolveBookingCourseCategory({
    requestedCategory: "formation_professionnelle",
    levelName: "Licence",
    subjectName: "Python",
    catalogItem: higherEducationPython,
  }), {
    category: "enseignement_superieur",
    locked: true,
  });
  assert.deepEqual(resolveBookingCourseCategory({
    requestedCategory: "enseignement_superieur",
    levelName: "Licence",
    subjectName: "Python",
  }), {
    category: "enseignement_superieur",
    locked: false,
  });

}

function verifyTransportMatrix() {
  const pendingLocation = calculateBookingPricing(baseBooking({
    deliveryMode: "domicile",
    packType: "PACK_4",
    teacherPricePerSession: 10_000,
  }));
  assert.equal(pendingLocation.transportFeeKey, PENDING_TRANSPORT_FEE_KEY);
  assert.equal(pendingLocation.transportFeePending, true);
  assert.equal(pendingLocation.transportFeePerSession, 0);
  assert.equal(pendingLocation.transportFee, 0);

  const sameNeighborhood = calculateBookingPricing(baseBooking({
    levelName: "CP1",
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    teacherQuartier: "Riviera 2",
    clientCommune: "Cocody",
    clientQuartier: "Riviera 2",
  }));
  assert.equal(sameNeighborhood.transportFeeKey, "same_neighborhood");
  assert.equal(sameNeighborhood.transportFee, 0);
  assert.equal(sameNeighborhood.priceTierKey, "ivoirien_cp1_cm1_15000");
  assert.equal(sameNeighborhood.unitSessionAmount, 15_000);

  const same = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Riviera 2",
    clientCommune: "Cocody",
    clientQuartier: "Angré 8e tranche",
  });
  assert.equal(same.key, "same_area");
  assert.equal(same.amount, 1_000);

  const configuredAliases = buildNeighborhoodAliasMap([
    { name: "Riviera Palmeraie", aliases: "Palmeraie, Riviera P" },
  ]);
  const configuredAliasNeighborhood = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Palmeraie",
    clientCommune: "Cocody",
    clientQuartier: "Riviera Palmeraie",
    neighborhoodAliases: configuredAliases,
  });
  assert.equal(configuredAliasNeighborhood.key, "same_neighborhood");
  assert.equal(configuredAliasNeighborhood.amount, 0);
  assert.equal(
    configuredAliasNeighborhood.routeLabel,
    "Cocody (Riviera Palmeraie) -> Cocody (Riviera Palmeraie)",
  );

  const cocodyCatalog = buildNeighborhoodAliasMap([
    { id: "quarter-cocody-mermoz", communeId: "commune-cocody", communeName: "Cocody", name: "Mermoz" },
    { id: "quarter-cocody-bonoumin", communeId: "commune-cocody", communeName: "Cocody", name: "Bonoumin" },
  ]);
  const sameCanonicalMermoz = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Cocody Mermoz",
    clientCommune: "Cocody",
    clientQuartier: "Mermoz",
    neighborhoodAliases: cocodyCatalog,
  });
  assert.equal(sameCanonicalMermoz.key, "same_neighborhood");
  assert.equal(sameCanonicalMermoz.amount, 0);
  assert.equal(sameCanonicalMermoz.routeLabel, "Cocody (Mermoz) -> Cocody (Mermoz)");

  const sameCanonicalMermozWithParentheses = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Cocody (Mermoz)",
    clientCommune: "Cocody",
    clientQuartier: "Mermoz",
    neighborhoodAliases: cocodyCatalog,
  });
  assert.equal(sameCanonicalMermozWithParentheses.key, "same_neighborhood");
  assert.equal(sameCanonicalMermozWithParentheses.amount, 0);

  const sameLegacyMermozWithoutCatalog = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Cocody Mermoz",
    clientCommune: "Cocody",
    clientQuartier: "Mermoz",
  });
  assert.equal(sameLegacyMermozWithoutCatalog.key, "same_neighborhood");
  assert.equal(sameLegacyMermozWithoutCatalog.amount, 0);

  const differentCanonicalCocodyNeighborhoods = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Cocody Mermoz",
    clientCommune: "Cocody",
    clientQuartier: "Bonoumin",
    neighborhoodAliases: cocodyCatalog,
  });
  assert.equal(differentCanonicalCocodyNeighborhoods.key, "same_area");
  assert.equal(differentCanonicalCocodyNeighborhoods.amount, 1_000);

  const scopedAliases = buildNeighborhoodAliasMap([
    { communeName: "Cocody", name: "Riviera Palmeraie", aliases: "Centre" },
    { communeName: "Riviera", name: "Riviera Golf", aliases: "Centre" },
  ]);
  const sameAliasInDifferentAreas = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Centre",
    clientCommune: "Riviera",
    clientQuartier: "Centre",
    neighborhoodAliases: scopedAliases,
  });
  assert.equal(sameAliasInDifferentAreas.key, "same_area");
  assert.equal(sameAliasInDifferentAreas.amount, 1_000);

  const sameTextWithoutCatalogInDifferentAreas = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Centre",
    clientCommune: "Riviera",
    clientQuartier: "Centre",
  });
  assert.equal(sameTextWithoutCatalogInDifferentAreas.key, "same_area");
  assert.equal(sameTextWithoutCatalogInDifferentAreas.amount, 1_000);

  const identicalLabelsWithDifferentCanonicalIds = buildNeighborhoodAliasMap([
    { id: "quarter-cocody-centre", communeId: "commune-cocody", communeName: "Cocody", name: "Centre" },
    { id: "quarter-riviera-centre", communeId: "commune-riviera", communeName: "Riviera", name: "Centre" },
  ]);
  const differentCanonicalCenters = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Centre",
    clientCommune: "Riviera",
    clientQuartier: "Centre",
    neighborhoodAliases: identicalLabelsWithDifferentCanonicalIds,
  });
  assert.equal(differentCanonicalCenters.key, "same_area");
  assert.equal(differentCanonicalCenters.amount, 1_000);

  const partiallyResolvedCenters = buildNeighborhoodAliasMap([
    { id: "quarter-riviera-centre", communeId: "commune-riviera", communeName: "Riviera", name: "Centre" },
  ]);
  const unresolvedOriginCannotMatchCanonicalDestination = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Centre",
    clientCommune: "Riviera",
    clientQuartier: "Centre",
    neighborhoodAliases: partiallyResolvedCenters,
  });
  assert.equal(unresolvedOriginCannotMatchCanonicalDestination.key, "same_area");
  assert.equal(unresolvedOriginCannotMatchCanonicalDestination.amount, 1_000);

  const canonicalOriginCannotMatchUnresolvedDestination = calculateGrandAbidjanTransportFee({
    teacherCommune: "Riviera",
    teacherQuartier: "Centre",
    clientCommune: "Cocody",
    clientQuartier: "Centre",
    neighborhoodAliases: partiallyResolvedCenters,
  });
  assert.equal(canonicalOriginCannotMatchUnresolvedDestination.key, "same_area");
  assert.equal(canonicalOriginCannotMatchUnresolvedDestination.amount, 1_000);

  const duplicateAliasEntries = [
    { communeName: "Cocody", name: "Quartier Alpha", aliases: "Centre" },
    { communeName: "Cocody", name: "Quartier Bêta", aliases: "Centre" },
  ];
  const ambiguousAliases = buildNeighborhoodAliasMap(duplicateAliasEntries);
  const reversedAmbiguousAliases = buildNeighborhoodAliasMap([...duplicateAliasEntries].reverse());
  assert.deepEqual(ambiguousAliases, reversedAmbiguousAliases);
  assert.equal(ambiguousAliases.resolved["cocody::centre"], undefined);
  assert.deepEqual(ambiguousAliases.ambiguous, ["cocody::centre", "cocody::cocody centre"]);
  const ambiguousSameText = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    teacherQuartier: "Centre",
    clientCommune: "Cocody",
    clientQuartier: "Centre",
    neighborhoodAliases: ambiguousAliases,
  });
  assert.equal(ambiguousSameText.key, "same_area");
  assert.equal(ambiguousSameText.amount, 1_000);

  const near = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    clientCommune: "Plateau",
  });
  assert.equal(near.key, "near_commune");
  assert.equal(near.amount, 2_500);

  const far = calculateGrandAbidjanTransportFee({
    teacherCommune: "Cocody",
    clientCommune: "Yopougon",
  });
  assert.equal(far.key, "far_commune");
  assert.equal(far.amount, 4_500);

  const nullOverride = calculateBookingPricing(baseBooking({
    category: "formation_professionnelle",
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    clientCommune: "Plateau",
    clientCommuneTransportFeeOverride: null,
  }));
  assert.equal(nullOverride.transportFeePerSession, 2_500);
  assert.equal(nullOverride.transportFee, 2_500);

  const undefinedOverride = calculateBookingPricing(baseBooking({
    category: "formation_professionnelle",
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    clientCommune: "Plateau",
    clientCommuneTransportFeeOverride: undefined,
  }));
  assert.equal(undefinedOverride.transportFeePerSession, 2_500);

  const explicitZeroOverride = calculateBookingPricing(baseBooking({
    category: "formation_professionnelle",
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    clientCommune: "Plateau",
    clientCommuneTransportFeeOverride: 0,
  }));
  assert.equal(explicitZeroOverride.transportFeePerSession, 0);

  const withoutOriginFirstOrder = calculateGrandAbidjanTransportFee({
    teacherZoneNames: ["Cocody", "Yopougon"],
    clientCommune: "Cocody",
  });
  const withoutOriginReverseOrder = calculateGrandAbidjanTransportFee({
    teacherZoneNames: ["Yopougon", "Cocody"],
    clientCommune: "Cocody",
  });
  assert.equal(withoutOriginFirstOrder.key, "outside_grand_abidjan");
  assert.equal(withoutOriginFirstOrder.amount, 8_000);
  assert.equal(withoutOriginFirstOrder.coveredByTeacherZone, true);
  assert.deepEqual(withoutOriginReverseOrder, withoutOriginFirstOrder);

  for (const [origin, destination] of GRAND_ABIDJAN_NEAR_ROUTES) {
    for (const [from, to] of [[origin, destination], [destination, origin]]) {
      const route = calculateGrandAbidjanTransportFee({
        teacherCommune: from,
        clientCommune: to,
      });
      assert.equal(route.key, "near_commune", `${from} -> ${to} doit rester un trajet proche`);
      assert.equal(route.amount, 2_500);
    }
  }
}

function verifyCatalogCompatibility() {
  const cp1Math = findCourseCatalogItem("soutien-scolaire-primaire-ivoirien-ivoirien-cp1-mathematiques");
  assert.ok(cp1Math, "CP1 mathematics catalog entry should exist");

  assert.equal(isCourseCatalogItemCompatible({
    item: cp1Math,
    category: "soutien_scolaire",
    schoolSystem: "ivoirien",
    preciseLevel: "CP1",
    selectedLevel: "CP - CE1",
    teacherSubjects: ["Mathématiques"],
    selectedSubject: "Mathématiques",
  }), true);

  assert.equal(isCourseCatalogItemCompatible({
    item: cp1Math,
    category: "soutien_scolaire",
    schoolSystem: "ivoirien",
    preciseLevel: "CP1",
    selectedLevel: "CP - CE1",
    teacherSubjects: ["Français"],
    selectedSubject: "Français",
  }), false);

  assert.equal(isCourseCatalogItemCompatible({
    item: cp1Math,
    category: "soutien_scolaire",
    schoolSystem: "ivoirien",
    preciseLevel: "CP1",
    selectedLevel: "CP - CE1",
    teacherSubjects: ["Mathématiques", "Français"],
    selectedSubject: "Français",
  }), false, "un professeur multi-matières ne doit pas autoriser le catalogue d'une autre matière");

  assert.equal(isCourseCatalogItemCompatible({
    item: cp1Math,
    category: "soutien_scolaire",
    schoolSystem: null,
    preciseLevel: "CP1",
    selectedLevel: "CP - CE1",
    teacherSubjects: ["Mathématiques"],
    selectedSubject: "Mathématiques",
  }), false, "un cours scolaire catalogué doit conserver son système scolaire");

  assert.equal(isCourseCatalogItemCompatible({
    item: cp1Math,
    category: "soutien_scolaire",
    schoolSystem: "francais",
    preciseLevel: "CP1",
    selectedLevel: "CP - CE1",
    teacherSubjects: ["Mathématiques"],
    selectedSubject: "Mathématiques",
  }), false);

  const cm2Math = findCourseCatalogItem("soutien-scolaire-primaire-ivoirien-ivoirien-cm2-mathematiques");
  assert.ok(cm2Math, "CM2 mathematics catalog entry should exist");
  assert.equal(isCourseCatalogItemCompatible({
    item: cm2Math,
    category: "soutien_scolaire",
    schoolSystem: "ivoirien",
    selectedLevel: "CP - CE1",
    teacherLevels: ["CP - CE1"],
    teacherSubjects: ["Mathématiques"],
    selectedSubject: "Mathématiques",
  }), false);

  const frenchCpMath = findCourseCatalogItem("soutien-scolaire-primaire-francais-francais-cp-mathematiques");
  assert.ok(frenchCpMath, "French CP mathematics catalog entry should exist");

  const canonicalFrenchSystem = resolveCourseCatalogSchoolSystem({
    item: frenchCpMath,
    requestedSchoolSystem: null,
  });
  assert.deepEqual(canonicalFrenchSystem, { ok: true, schoolSystem: "francais" });
  assert.equal(resolveCourseCatalogSchoolSystem({
    item: frenchCpMath,
    requestedSchoolSystem: "ivoirien",
  }).ok, false);

  assert.equal(validateEducationSelection({
    category: "soutien_scolaire",
    levelName: "CP - CE1",
    schoolSystem: null,
  }).ok, false);
  assert.equal(validateEducationSelection({
    category: "soutien_scolaire",
    levelName: "CP - CE1",
    schoolSystem: canonicalFrenchSystem.schoolSystem,
    preciseLevel: "CP",
  }).ok, true);

  const frenchCpPrice = calculateBookingPricing(baseBooking({
    levelName: "CP - CE1",
    preciseLevel: "CP",
    schoolSystem: canonicalFrenchSystem.schoolSystem,
    subjectName: "Mathématiques",
    courseCatalogName: frenchCpMath.nom,
    teacherPricePerSession: 2_000,
  }));
  assert.equal(frenchCpPrice.priceTierKey, "francais_cp_cm1_37500");
  assert.equal(frenchCpPrice.unitSessionAmount, 37_500);

  const canonicalIvorianSystem = resolveCourseCatalogSchoolSystem({
    item: cp1Math,
    requestedSchoolSystem: null,
  });
  if (!canonicalIvorianSystem.ok) throw new Error("Le catalogue ivoirien doit canoniser son système scolaire.");
  const ivorianCpPrice = calculateBookingPricing(baseBooking({
    levelName: "CP - CE1",
    preciseLevel: "CP1",
    schoolSystem: canonicalIvorianSystem.schoolSystem,
    subjectName: "Mathématiques",
    courseCatalogName: cp1Math.nom,
    teacherPricePerSession: 2_000,
  }));
  assert.equal(ivorianCpPrice.priceTierKey, "ivoirien_cp1_cm1_15000");
  assert.equal(ivorianCpPrice.unitSessionAmount, 15_000);
}

function verifyDraftIdempotence() {
  const expectedDraft = {
    teacherId: "teacher-1",
    subjectName: "Mathématiques",
    levelName: "CP - CE1",
    courseCategory: "soutien_scolaire",
    schoolSystem: "francais",
    courseCatalogId: "catalog-1",
    groupType: "INDIVIDUAL",
    participantsCount: 1,
    commune: "Cocody",
    quartier: "Riviera 2",
    preferredDays: '["samedi"]',
    preferredTime: "samedi 10h-12h",
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    packType: "SINGLE",
    unitPrice: 12_500,
    transportFee: 1_000,
    paymentServiceFeeAmount: 405,
    totalClientPays: 13_905,
    pricingSnapshot: '{"courseAmount":12500,"transportFee":1000}',
    paymentMethod: "WAVE",
    paymentProvider: "JEKO",
  };
  const existingDraft = {
    id: "booking-1",
    ...expectedDraft,
    startDate: new Date("2026-08-01T00:00:00.000Z"),
  };

  assert.equal(bookingDraftMatchesExpected(existingDraft, expectedDraft), true);
  for (const mismatch of [
    { courseCatalogId: "catalog-2" },
    { schoolSystem: "ivoirien" },
    { quartier: "Angré" },
    { preferredTime: "dimanche 10h-12h" },
    { transportFee: 2_500 },
    { pricingSnapshot: '{"courseAmount":12500,"transportFee":2500}' },
    { paymentMethod: "ORANGE_MONEY" },
  ]) {
    assert.equal(
      bookingDraftMatchesExpected({ ...existingDraft, ...mismatch }, expectedDraft),
      false,
      `le brouillon doit refuser la variation ${Object.keys(mismatch)[0]}`,
    );
  }

  assert.equal(bookingDraftMatchesExpected(
    { pricing: { transport: 1_000, course: 12_500 } },
    { pricing: { course: 12_500, transport: 1_000 } },
  ), true);
}

function verifyTeacherHomeActivation() {
  assert.equal(requiresTeacherHomeCommune({
    status: "ACTIVE",
    offersHome: true,
    commune: "",
  }), true);
  assert.equal(requiresTeacherHomeCommune({
    status: "ACTIVE",
    offersHome: true,
    commune: "  Cocody  ",
  }), false);
  assert.equal(requiresTeacherHomeCommune({
    status: "ACTIVE",
    offersHome: false,
    commune: null,
  }), false);
  assert.equal(requiresTeacherHomeCommune({
    status: "INACTIVE",
    offersHome: true,
    commune: null,
  }), false);
}

function verifyServerPriceConfirmation() {
  const canonical = confirmablePricing(calculateBookingPricing(baseBooking({
    category: "formation_professionnelle",
    courseCatalogName: "Power BI",
    teacherPricePerSession: 10_000,
  })));

  assert.equal(expectedPricingMatches({ ...canonical }, canonical), true);
  assert.equal(expectedPricingMatches({ ...canonical, totalClientPays: canonical.totalClientPays - 1 }, canonical), false);
  assert.equal(expectedPricingMatches(undefined, canonical), false);

  const first = createPricingConfirmationFingerprint(canonical, "booking:test-client-key");
  const second = createPricingConfirmationFingerprint(
    { ...canonical, transportFee: canonical.transportFee + 1_000 },
    "booking:test-client-key",
  );
  assert.match(first, /^price_v1_[a-f0-9]{64}$/);
  assert.notEqual(first, second);
}

function verifyPacksAndGroups() {
  const groupedPack = calculateBookingPricing(baseBooking({
    category: "soutien_scolaire",
    levelName: "CM2",
    teacherPricePerSession: 10_000,
    deliveryMode: "domicile",
    teacherCommune: "Cocody",
    teacherQuartier: "Riviera 2",
    clientCommune: "Cocody",
    clientQuartier: "Angré 8e tranche",
    packType: "PACK_8",
    participantsCount: 2,
  }));

  assert.equal(groupedPack.numberOfSessions, 8);
  assert.equal(groupedPack.groupMultiplier, 1.5);
  assert.equal(groupedPack.transportFeeKey, "same_area");
  assert.equal(groupedPack.priceTierKey, "ivoirien_cm2_4e_20000");
  assert.equal(groupedPack.unitSessionAmount, 20_000);
  assert.equal(groupedPack.rawCourseAmount, 240_000);
  assert.equal(groupedPack.discountRate, 0.05);
  assert.equal(groupedPack.discountAmount, 12_000);
  assert.equal(groupedPack.courseAmount, 228_000);
  assert.equal(groupedPack.transportFeePerSession, 1_000);
  assert.equal(groupedPack.transportFee, 8_000);
  assert.equal(groupedPack.teacherPayoutAmount, 168_000);
  assert.equal(groupedPack.totalTeacherReceives, 176_000);
  assert.equal(groupedPack.paymentServiceFeeRate, 300);
  assert.equal(groupedPack.paymentServiceFeeAmount, 7_080);
  assert.equal(groupedPack.totalClientPays, 243_080);

  const baseCourseAmount = groupedPack.unitSessionAmount * groupedPack.numberOfSessions;
  const groupSurchargeAmount = groupedPack.rawCourseAmount - baseCourseAmount;
  assert.equal(
    baseCourseAmount + groupSurchargeAmount - groupedPack.discountAmount,
    groupedPack.courseAmount,
    "base brute + majoration groupe brute - remise doit égaler le montant cours",
  );
}

function verifyMaterialFeeIsExcludedFromServiceFeeBase() {
  const pricing = calculateBookingPricing(baseBooking({
    teacherPricePerSession: 10_000,
    materialFee: 5_000,
  }));

  assert.equal(pricing.courseAmount, 15_000);
  assert.equal(pricing.transportFee, 0);
  assert.equal(pricing.materialFee, 5_000);
  assert.equal(pricing.totalBeforePaymentServiceFee, 20_000);
  assert.equal(pricing.paymentServiceFeeAmount, 450);
  assert.equal(pricing.totalClientPays, 20_450);
}

function verifyDiscountedGroupBreakdownCopy() {
  const bookingRoute = readFileSync(new URL("../src/app/api/bookings/route.ts", import.meta.url), "utf8");
  const pricingBreakdown = readFileSync(
    new URL("../src/components/shared/booking-pricing-breakdown.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    bookingRoute,
    /base brute .*? \+ majoration groupe brute .*?\$\{packDiscountLine\} = \$\{pricing\.courseAmount/,
  );
  assert.match(pricingBreakdown, /label="Base brute des séances"/);
  assert.match(pricingBreakdown, /label="Majoration groupe brute"/);
  assert.match(pricingBreakdown, /formatCourseEquation\(baseFormulaAmount, groupSurchargeAmount, discountAmount, courseAmount\)/);
  assert.match(pricingBreakdown, /hors assiette des frais de service/);
}

function verifyPackDiscountCommissionCaps() {
  const scenarios = [0, 3, 5, 30] as const;
  const packs = [
    { packType: "PACK_8", maximumRate: 0.05, sessions: 8 },
    { packType: "PACK_12", maximumRate: 0.07, sessions: 12 },
  ] as const;

  for (const pack of packs) {
    for (const commissionPercent of scenarios) {
      const pricing = calculateBookingPricing(baseBooking({
        levelName: "CM2",
        teacherPricePerSession: 10_000,
        packType: pack.packType,
        platformCommissionPercent: commissionPercent,
      }));
      const expectedRawAmount = pack.sessions * 20_000;
      const expectedEffectiveRate = Math.min(pack.maximumRate, commissionPercent / 100);
      const expectedDiscountAmount = Math.round(expectedRawAmount * expectedEffectiveRate);

      assert.equal(pricing.rawCourseAmount, expectedRawAmount);
      assert.equal(pricing.discountAmount, expectedDiscountAmount);
      assert.equal(pricing.discountRate, expectedEffectiveRate);
      assert.equal(pricing.courseAmount, expectedRawAmount - expectedDiscountAmount);
      assert.equal(
        pricing.discountRate,
        pricing.rawCourseAmount > 0 ? pricing.discountAmount / pricing.rawCourseAmount : 0,
        `${pack.packType}, commission ${commissionPercent}% : taux affiché et remise doivent concorder`,
      );
    }
  }
}

verifyOfficialPriceGrid();
verifyProfessionalPricing();
verifyTransportMatrix();
verifyCatalogCompatibility();
verifyDraftIdempotence();
verifyTeacherHomeActivation();
verifyServerPriceConfirmation();
verifyPacksAndGroups();
verifyMaterialFeeIsExcludedFromServiceFeeBase();
verifyDiscountedGroupBreakdownCopy();
verifyPackDiscountCommissionCaps();

console.log("OK pricing engine: official school/professional grids, ignored legacy teacher prices, transport, catalog, confirmation, packs, groups and service fees verified.");
