import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = source("src/app/page.tsx");
const publicLayout = source("src/components/layouts/public-layout.tsx");
const tariffs = source("src/app/tarifs/page.tsx");
const searchPage = source("src/app/client/trouver/page.tsx");
const searchForm = source(
  "src/components/marketplace/client-marketplace-search.tsx",
);
const entryPage = source("src/app/trouver/page.tsx");

assert.match(home, /francais: "\/trouver\?journey=francais"/);
assert.match(home, /professionnel: "\/trouver\?journey=professionnel"/);
assert.match(
  home,
  /hrefs=\{marketplaceMode \? MARKETPLACE_JOURNEY_HREFS : HOME_JOURNEY_HREFS\}/,
);
assert.match(home, /ivoirien: "\/professeurs\?journey=ivoirien"/);

assert.match(
  publicLayout,
  /marketplaceMode\s*\? buildMarketplaceJourneyHref\(activeJourney\)/,
);
assert.match(
  publicLayout,
  /marketplaceMode && item\.href === "\/professeurs"\s*\? buildMarketplaceJourneyHref\(activeJourney\)/,
);
assert.match(
  publicLayout,
  /!marketplaceMode \|\| link\.href !== "\/partenariat"/,
);
assert.match(
  publicLayout,
  /activeJourney \? `\/trouver\?journey=\$\{activeJourney\}`/,
);

assert.match(tariffs, /href=\{`\/trouver\?journey=\$\{activeJourney\}`\}/);
assert.match(
  entryPage,
  /const destination = `\/client\/trouver\?journey=\$\{journey\}`/,
);
assert.match(
  entryPage,
  /redirect\(`\/connexion\?from=\$\{encodeURIComponent\(destination\)\}`\)/,
);
assert.match(
  entryPage,
  /if \(!marketplaceEnabled\(\)\) redirect\(`\/professeurs\?journey=\$\{journey\}`\)/,
);
assert.match(
  searchPage,
  /parseTeacherJourney\(typeof params\.journey === "string" \? params\.journey : null\)/,
);
assert.match(
  searchPage,
  /encodeURIComponent\(`\/client\/trouver\?journey=\$\{initialJourney\}`\)/,
);
assert.match(searchPage, /initialJourney=\{initialJourney\}/);
assert.match(searchForm, /useState<TeacherJourney>\(initialJourney\)/);

console.log(
  "OK Marketplace V2 journey links preserve Ivoirien, Français and Pro through login and search.",
);
