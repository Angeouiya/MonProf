import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const liveVerifier = readFileSync(new URL("./verify-jeko-live.mjs", import.meta.url), "utf8");
const payoutLibrary = readFileSync(new URL("../src/lib/jeko-payout.ts", import.meta.url), "utf8");
const balanceFunction = payoutLibrary.match(
  /export async function getJekoStoreBalance\([\s\S]*?\n}\r?\n\r?\nexport async function getJekoTeacherPayoutTransfer/,
)?.[0] ?? "";

assert.match(liveVerifier, /getJekoStoreBalance\(\{ config \}\)/);
assert.match(liveVerifier, /server-only[\s\S]*?empty\.js/);
assert.doesNotMatch(liveVerifier, /createJekoTeacherPayout|ensureJekoMobileMoneyContact|createJekoPaymentRequest/);
assert.doesNotMatch(liveVerifier, /availableAmount(?:Cents|Xof).*console|console[\s\S]{0,120}availableAmount/);
assert.match(liveVerifier, /Aucun mouvement d'argent effectué; solde non affiché/);
assert.match(balanceFunction, /method:\s*"GET"/);
assert.doesNotMatch(balanceFunction, /method:\s*"POST"/);

console.log("Jèko live verification safety passed: balance-only GET, no contact, checkout, transfer or amount disclosure.");
