import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marketplaceTransportOrigin, type MarketplaceTransportLesson } from "../src/lib/marketplace-transport-origin";
import { calculateGrandAbidjanTransportFee } from "../src/lib/pricing";

const day = new Date("2026-11-05T00:00:00.000Z");
const lessons: MarketplaceTransportLesson[] = [
  { teacherId: "teacher-1", scheduledDate: day, scheduledTime: "10:00", durationMinutes: 120, courseFormat: "HOME", commune: "Marcory", quartier: "Zone 4" },
  { teacherId: "teacher-2", scheduledDate: day, scheduledTime: "11:00", durationMinutes: 60, courseFormat: "HOME", commune: "Treichville", quartier: null },
];
const base = { teacherId: "teacher-1", teacherCommune: "Cocody", teacherQuartier: "Angré", scheduledDate: day, lessons };

assert.deepEqual(marketplaceTransportOrigin({ ...base, scheduledTime: "16:00" }), {
  commune: "Marcory", quartier: "Zone 4", source: "previous_lesson", label: "Depuis le précédent cours confirmé du professeur",
});
assert.equal(marketplaceTransportOrigin({ ...base, scheduledTime: "11:00" }).source, "declared_zone");
assert.equal(marketplaceTransportOrigin({ ...base, scheduledDate: new Date("2026-11-06T00:00:00.000Z"), scheduledTime: "16:00" }).source, "declared_zone");
assert.equal(marketplaceTransportOrigin({ ...base, scheduledTime: "16:00", lessons: [
  ...lessons, { teacherId: "teacher-1", scheduledDate: day, scheduledTime: "13:00", durationMinutes: 60, courseFormat: "ONLINE", commune: null, quartier: null },
] }).source, "declared_zone");
assert.equal(marketplaceTransportOrigin({ ...base, scheduledTime: "16:00", lessons: [
  ...lessons, { teacherId: "teacher-1", scheduledDate: day, scheduledTime: "13:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Mermoz" },
] }).quartier, "Mermoz");

const origin = marketplaceTransportOrigin({ ...base, scheduledTime: "16:00" });
const travelFromPrevious = calculateGrandAbidjanTransportFee({
  teacherCommune: origin.commune, teacherQuartier: origin.quartier,
  clientCommune: "Cocody", clientQuartier: "Mermoz",
});
const travelFromDeclaredZone = calculateGrandAbidjanTransportFee({
  teacherCommune: base.teacherCommune, teacherQuartier: base.teacherQuartier,
  clientCommune: "Cocody", clientQuartier: "Mermoz",
});
assert.ok(travelFromPrevious.amount !== null);
assert.ok(travelFromDeclaredZone.amount !== null);
assert.ok(travelFromPrevious.amount > travelFromDeclaredZone.amount);
const searchSource = readFileSync("src/lib/marketplace-search.ts", "utf8");
assert.match(searchSource, /marketplaceTransportOrigin\(\{/);
assert.match(searchSource, /teacherCommune: transportOrigin\.commune/);
assert.match(searchSource, /transportOriginLabel:/);

console.log("Marketplace V2 : origine du déplacement entre cours vérifiée.");
