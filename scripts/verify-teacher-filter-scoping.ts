import assert from "node:assert/strict";
import fs from "node:fs";
import {
  filterLevelsForJourney,
  filterSubjectsForJourney,
} from "../src/lib/catalog-journey";

const subjects = [
  { name: "Mathématiques", icon: null },
  { name: "Anglais", icon: null },
  { name: "Informatique", icon: null },
  { name: "Marketing digital", icon: null },
  { name: "Génie civil pratique", icon: null },
  { name: "Anglais scolaire", icon: null },
];
const levels = [
  { name: "Terminale", order: 12 },
  { name: "BAC", order: 16 },
  { name: "BTS", order: 17 },
  { name: "Formation adulte", order: 30 },
];

const schoolSubjects = filterSubjectsForJourney(subjects, "ivoirien").map((item) => item.name);
const professionalSubjects = filterSubjectsForJourney(subjects, "professionnel").map((item) => item.name);
const schoolLevels = filterLevelsForJourney(levels, "francais").map((item) => item.name);
const professionalLevels = filterLevelsForJourney(levels, "professionnel").map((item) => item.name);

assert.deepEqual(schoolSubjects, ["Mathématiques", "Anglais", "Informatique", "Anglais scolaire"]);
assert.deepEqual(professionalSubjects, ["Marketing digital", "Génie civil pratique"]);
assert.deepEqual(schoolLevels, ["Terminale", "BAC"]);
assert.deepEqual(professionalLevels, ["BTS", "Formation adulte"]);

const publicSearch = read("src/app/professeurs/page.tsx");
const clientSearch = read("src/app/client/rechercher/page.tsx");
const publicTeachersApi = read("src/app/api/teachers/route.ts");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const select = read("src/components/shared/searchable-catalog-select.tsx");

assert.match(publicSearch, /filterSubjectsForJourney\(catalog\.subjects, journey\)/);
assert.match(publicSearch, /filterLevelsForJourney\(catalog\.levels, journey\)/);
assert.match(publicSearch, /teacherJourneyCatalogClauses\(subjects, levels\)/);
assert.doesNotMatch(publicSearch, /allowCustomValue/);
assert.match(clientSearch, /filterSubjectsForJourney\(catalog\.subjects, journey\)/);
assert.match(clientSearch, /filterLevelsForJourney\(catalog\.levels, journey\)/);
assert.match(clientSearch, /teacherJourneyCatalogClauses\(subjects, levels\)/);
assert.match(clientSearch, /\["journey", "q", "subject", "level", "commune", "format", "sort"\]/);
assert.match(clientSearch, /href=\{`\/client\/rechercher\?journey=\$\{journey\}`\}/);
assert.doesNotMatch(clientSearch, /allowCustomValue/);
assert.doesNotMatch(publicSearch, /Scolaire, université, concours, métiers/);
assert.doesNotMatch(publicSearch, /t\.subjects\[0\]\?\.subject\.name/);
assert.doesNotMatch(clientSearch, /t\.subjects\[0\]\?\.subject\.name/);
assert.match(publicTeachersApi, /subjects: journeySubjects\.map\(\(item\) => item\.name\)/);
assert.match(publicTeachersApi, /levels: journeyLevels\.map\(\(item\) => item\.name\)/);
assert.match(publicTeachersApi, /teacherJourneyCatalogClauses\(subjects, levels\)/);
assert.match(bookingForm, /filterSubjectsForJourney\(subjects, bookingJourney\)/);
assert.match(bookingForm, /filterLevelsForJourney\(levels, bookingJourney\)/);
assert.match(select, /localSelection\.externalValue === externalValue/);

console.log("OK Teacher filters stay scoped to the selected mini-application, preserve journey context and reject unknown communes.");

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}
