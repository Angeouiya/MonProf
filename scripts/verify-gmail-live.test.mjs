import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  maskMessageId,
  parseArguments,
  readGmailConfiguration,
  validateTokenInfo,
} from "./verify-gmail-live.mjs";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

test("l'envoi reste désactivé par défaut et exige l'option explicite", () => {
  assert.deepEqual(parseArguments([]), { help: false, sendSelf: false });
  assert.deepEqual(parseArguments(["--send-self"]), { help: false, sendSelf: true });
  assert.throws(() => parseArguments(["--send-self", "--send-self"]), /Option inconnue/);
  assert.throws(() => parseArguments(["--send"]), /Option inconnue/);
});

test("la configuration est bloquée si une variable obligatoire manque", () => {
  assert.throws(
    () => readGmailConfiguration({}),
    /GMAIL_CLIENT_ID[\s\S]*GMAIL_CLIENT_SECRET[\s\S]*GMAIL_REFRESH_TOKEN[\s\S]*GMAIL_SENDER_EMAIL/,
  );
});

test("la vérification live est interdite sur un Vercel non-production", () => {
  const completeConfiguration = {
    GMAIL_CLIENT_ID: "client-id",
    GMAIL_CLIENT_SECRET: "client-secret",
    GMAIL_REFRESH_TOKEN: "refresh-token",
    GMAIL_SENDER_EMAIL: "diplomateimmobilier99@gmail.com",
  };

  assert.doesNotThrow(() => readGmailConfiguration(completeConfiguration));
  assert.doesNotThrow(() => readGmailConfiguration({
    ...completeConfiguration,
    VERCEL_ENV: "production",
  }));
  assert.throws(
    () => readGmailConfiguration({ ...completeConfiguration, VERCEL_ENV: "preview" }),
    /interdite hors Vercel Production/,
  );
  assert.throws(
    () => readGmailConfiguration({ ...completeConfiguration, VERCEL_ENV: "development" }),
    /interdite hors Vercel Production/,
  );
});

test("tokeninfo doit confirmer exactement l'email et le scope gmail.send", () => {
  assert.doesNotThrow(() =>
    validateTokenInfo(
      {
        email: "diplomateimmobilier99@gmail.com",
        scope: `openid ${GMAIL_SEND_SCOPE}`,
      },
      "diplomateimmobilier99@gmail.com",
    ),
  );
  assert.throws(
    () =>
      validateTokenInfo(
        { email: "autre@gmail.com", scope: GMAIL_SEND_SCOPE },
        "diplomateimmobilier99@gmail.com",
      ),
    /ne correspond pas exactement/,
  );
  assert.throws(
    () =>
      validateTokenInfo(
        { email: "diplomateimmobilier99@gmail.com", scope: "openid" },
        "diplomateimmobilier99@gmail.com",
      ),
    /gmail\.send/,
  );
});

test("l'identifiant Gmail n'est jamais affiché en entier", () => {
  assert.equal(maskMessageId("1234567890abcdef"), "1234…cdef");
  assert.notEqual(maskMessageId("1234567890abcdef"), "1234567890abcdef");
});

test("aucun journal ne référence directement les valeurs OAuth sensibles", () => {
  const source = fs.readFileSync(new URL("./verify-gmail-live.mjs", import.meta.url), "utf8");
  const loggerCalls = [...source.matchAll(/console\.(?:log|error)\(([\s\S]*?)\);/g)].map(
    (match) => match[1],
  );
  for (const call of loggerCalls) {
    assert.doesNotMatch(call, /\b(?:accessToken|refreshToken|clientSecret)\b/);
  }
});
