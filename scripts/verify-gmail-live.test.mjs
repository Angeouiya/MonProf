import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  maskMessageId,
  parseArguments,
  readGmailConfiguration,
  validateAccessGrant,
} from "./verify-gmail-live.mjs";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GOOGLE_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const EXACT_SCOPES = `openid email ${GMAIL_SEND_SCOPE}`;

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
  assert.throws(
    () => readGmailConfiguration({
      ...completeConfiguration,
      GMAIL_SENDER_EMAIL: "autre@gmail.com",
    }),
    /doit être exactement diplomateimmobilier99@gmail\.com/,
  );
});

test("UserInfo et le refresh doivent confirmer le compte et les trois scopes exacts", () => {
  assert.doesNotThrow(() =>
    validateAccessGrant(
      {
        scope: EXACT_SCOPES,
        token_type: "Bearer",
      },
      { email: "diplomateimmobilier99@gmail.com", email_verified: true },
      "diplomateimmobilier99@gmail.com",
    ),
  );
  assert.doesNotThrow(() =>
    validateAccessGrant(
      {
        scope: `openid ${GOOGLE_EMAIL_SCOPE} ${GMAIL_SEND_SCOPE}`,
        token_type: "Bearer",
      },
      { email: "diplomateimmobilier99@gmail.com", email_verified: true },
      "diplomateimmobilier99@gmail.com",
    ),
  );
  assert.throws(
    () =>
      validateAccessGrant(
        { scope: EXACT_SCOPES, token_type: "Bearer" },
        { email: "autre@gmail.com", email_verified: true },
        "diplomateimmobilier99@gmail.com",
      ),
    /ne correspond pas exactement/,
  );
  for (const invalidScopes of [
    `email ${GMAIL_SEND_SCOPE}`,
    `openid ${GMAIL_SEND_SCOPE}`,
    "openid email",
    `${EXACT_SCOPES} https://www.googleapis.com/auth/gmail.readonly`,
  ]) {
    assert.throws(
      () =>
        validateAccessGrant(
          { scope: invalidScopes, token_type: "Bearer" },
          { email: "diplomateimmobilier99@gmail.com", email_verified: true },
          "diplomateimmobilier99@gmail.com",
        ),
      /exactement openid, email et gmail\.send/,
    );
  }
  assert.throws(
    () => validateAccessGrant(
      { scope: EXACT_SCOPES, token_type: "Bearer" },
      { email: "diplomateimmobilier99@gmail.com", email_verified: false },
      "diplomateimmobilier99@gmail.com",
    ),
    /identité Gmail vérifiée/,
  );
  assert.throws(
    () => validateAccessGrant(
      { scope: EXACT_SCOPES, token_type: "MAC" },
      { email: "diplomateimmobilier99@gmail.com", email_verified: true },
      "diplomateimmobilier99@gmail.com",
    ),
    /Bearer/,
  );
});

test("l'identifiant Gmail n'est jamais affiché en entier", () => {
  assert.equal(maskMessageId("1234567890abcdef"), "1234…cdef");
  assert.notEqual(maskMessageId("1234567890abcdef"), "1234567890abcdef");
});

test("aucun journal ne référence directement les valeurs OAuth sensibles", () => {
  const source = fs.readFileSync(new URL("./verify-gmail-live.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /tokeninfo|searchParams\.set\("access_token"/);
  assert.match(source, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  const loggerCalls = [...source.matchAll(/console\.(?:log|error)\(([\s\S]*?)\);/g)].map(
    (match) => match[1],
  );
  for (const call of loggerCalls) {
    assert.doesNotMatch(call, /\b(?:accessToken|refreshToken|clientSecret)\b/);
  }
});
