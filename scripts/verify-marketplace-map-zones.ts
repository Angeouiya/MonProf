import assert from "node:assert/strict";
import { groupMarketplaceCandidatesByCommune, marketplaceCommuneCenter } from "../src/lib/marketplace-map-zones";

assert.deepEqual(marketplaceCommuneCenter("Port-Bouët"), marketplaceCommuneCenter("Port-Bouet"));
assert.deepEqual(marketplaceCommuneCenter("Cocody"), [-3.994934, 5.357367]);
assert.equal(marketplaceCommuneCenter("Commune inconnue"), null);

const candidates = [
  { teacherId: "a", name: "A", commune: "Cocody" },
  { teacherId: "b", name: "B", commune: "cocody" },
  { teacherId: "c", name: "C", commune: "Marcory" },
  { teacherId: "d", name: "D", commune: null },
];
const result = groupMarketplaceCandidatesByCommune(candidates);
assert.equal(result.groups.length, 2);
assert.equal(result.groups[0].teachers.length, 2);
assert.equal(result.groups[1].teachers.length, 1);
assert.equal(result.withoutMapPosition, 1);

console.log("Marketplace map zones: OK");
