import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const liveVerifier = readFileSync(new URL("./verify-jeko-live.mjs", import.meta.url), "utf8");
const payoutLibrary = readFileSync(new URL("../src/lib/jeko-payout.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const balanceFunction = payoutLibrary.match(
  /export async function getJekoStoreBalance\([\s\S]*?\n}\r?\n\r?\nexport async function getJekoTeacherPayoutTransfer/,
)?.[0] ?? "";

assert.match(liveVerifier, /getJekoStoreBalance\(\{ config \}\)/);
assert.match(liveVerifier, /getJekoStores\(\{ config \}\)/);
assert.match(liveVerifier, /assertCompetenceJekoStoreName\(configuredStore\.name\)/);
assert.match(liveVerifier, /jeko-store-identity/);
assert.match(liveVerifier, /boutique Compétence/);
assert.match(liveVerifier, /SAFE_JEKO_PROVIDER_ID_PATTERN/);
assert.match(liveVerifier, /JEKO_STORE_ID doit être l'identifiant brut du magasin Jèko Boutique Compétence/);
assert.match(liveVerifier, /issues\.push\("JEKO_WEBHOOK_SECRET doit contenir au moins 24 caractères\."\)/);
assert.match(liveVerifier, /server-only[\s\S]*?empty\.js/);
assert.doesNotMatch(liveVerifier, /createJekoTeacherPayout|ensureJekoMobileMoneyContact|createJekoPaymentRequest/);
assert.doesNotMatch(liveVerifier, /availableAmount(?:Cents|Xof).*console|console[\s\S]{0,120}availableAmount/);
assert.match(liveVerifier, /Aucun mouvement d'argent effectué; solde non affiché/);
assert.match(balanceFunction, /method:\s*"GET"/);
assert.doesNotMatch(balanceFunction, /method:\s*"POST"/);
assert.match(payoutLibrary, /\/partner_api\/stores/);
assert.match(payoutLibrary, /liste des magasins/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run verify:jeko-live/);

console.log("Jèko live verification safety passed: store-list and balance-only GET, no contact, checkout, transfer or amount disclosure.");
