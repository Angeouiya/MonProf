#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REQUIRED_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const REQUEST_TIMEOUT_MS = 10_000;
const REQUIRED_ENVIRONMENT_VARIABLES = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
];

class SafeVerificationError extends Error {}

export function parseArguments(args) {
  if (args.length === 0) return { help: false, sendSelf: false };
  if (args.length === 1 && args[0] === "--send-self") {
    return { help: false, sendSelf: true };
  }
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return { help: true, sendSelf: false };
  }

  throw new SafeVerificationError(
    "Option inconnue. Utilisez uniquement --send-self pour autoriser un email test, ou --help.",
  );
}

export function readGmailConfiguration(environment = process.env) {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => typeof environment[name] !== "string" || environment[name].trim().length === 0,
  );
  if (missing.length > 0) {
    throw new SafeVerificationError(
      `Configuration Gmail incomplète. Variables manquantes : ${missing.join(", ")}.`,
    );
  }

  const clientId = environment.GMAIL_CLIENT_ID.trim();
  const clientSecret = environment.GMAIL_CLIENT_SECRET.trim();
  const refreshToken = environment.GMAIL_REFRESH_TOKEN.trim();
  const senderEmail = environment.GMAIL_SENDER_EMAIL.trim().toLowerCase();

  if ([clientId, clientSecret, refreshToken].some((value) => /[\r\n\0]/.test(value))) {
    throw new SafeVerificationError("La configuration OAuth Gmail contient une valeur invalide.");
  }
  if (!isSafeEmailAddress(senderEmail)) {
    throw new SafeVerificationError("GMAIL_SENDER_EMAIL n'est pas une adresse email valide.");
  }

  return { clientId, clientSecret, refreshToken, senderEmail };
}

export function validateTokenInfo(tokenInfo, senderEmail) {
  const tokenEmail = typeof tokenInfo?.email === "string" ? tokenInfo.email.trim().toLowerCase() : "";
  if (!tokenEmail) {
    throw new SafeVerificationError(
      "Google tokeninfo n'a pas fourni l'identité Gmail. Renouvelez l'autorisation avec une identité Google lisible.",
    );
  }
  if (tokenEmail !== senderEmail) {
    throw new SafeVerificationError(
      "Le compte lié au refresh token ne correspond pas exactement à GMAIL_SENDER_EMAIL.",
    );
  }

  const scopes = new Set(
    typeof tokenInfo?.scope === "string" ? tokenInfo.scope.split(/\s+/).filter(Boolean) : [],
  );
  if (!scopes.has(REQUIRED_SCOPE)) {
    throw new SafeVerificationError(
      "L'autorisation OAuth ne contient pas le scope Gmail requis : gmail.send.",
    );
  }
}

export function maskMessageId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(
      [
        "Usage : npm run verify:gmail-live -- [--send-self]",
        "Sans option : vérifie OAuth, l'expéditeur et le scope sans envoyer d'email.",
        "--send-self : envoie un unique email test à GMAIL_SENDER_EMAIL après validation.",
      ].join("\n"),
    );
    return;
  }

  const configuration = readGmailConfiguration();
  const accessToken = await exchangeRefreshToken(configuration);
  const tokenInfo = await inspectAccessToken(accessToken);
  validateTokenInfo(tokenInfo, configuration.senderEmail);

  if (!options.sendSelf) {
    console.log(
      "Vérification Gmail réussie : identité et scope gmail.send conformes. Aucun email n'a été envoyé.",
    );
    return;
  }

  const result = await sendTestEmail(accessToken, configuration.senderEmail);
  const maskedId = maskMessageId(result?.id);
  console.log(
    maskedId
      ? `Email test envoyé à l'expéditeur. ID Gmail masqué : ${maskedId}.`
      : "Email test envoyé à l'expéditeur et confirmé par Gmail.",
  );
}

async function exchangeRefreshToken(configuration) {
  const response = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        refresh_token: configuration.refreshToken,
        grant_type: "refresh_token",
      }),
    },
    "l'échange du refresh token",
  );
  const data = await readJson(response);
  const accessToken = typeof data?.access_token === "string" ? data.access_token : "";

  if (!response.ok || !accessToken) {
    throw new SafeVerificationError(
      `Google a refusé l'échange OAuth (statut ${safeStatus(response.status)}). Vérifiez le client et le refresh token.`,
    );
  }
  return accessToken;
}

async function inspectAccessToken(accessToken) {
  const url = new URL(GOOGLE_TOKENINFO_URL);
  url.searchParams.set("access_token", accessToken);
  const response = await fetchWithTimeout(url, { method: "GET" }, "la vérification tokeninfo");
  const data = await readJson(response);

  if (!response.ok || !data) {
    throw new SafeVerificationError(
      `Google tokeninfo a refusé la vérification (statut ${safeStatus(response.status)}).`,
    );
  }
  return data;
}

async function sendTestEmail(accessToken, senderEmail) {
  const raw = buildTestMessage(senderEmail);
  let response;
  try {
    response = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SafeVerificationError(
      "Gmail n'a pas confirmé l'envoi dans le délai imparti. Vérifiez la boîte avant toute nouvelle tentative.",
    );
  }

  const data = await readJson(response);
  if (!response.ok) {
    throw new SafeVerificationError(
      `Gmail a refusé l'email test (statut ${safeStatus(response.status)}).`,
    );
  }
  return data;
}

async function fetchWithTimeout(url, options, operationLabel) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SafeVerificationError(
      `Impossible de terminer ${operationLabel} dans le délai imparti.`,
    );
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildTestMessage(senderEmail) {
  const body = Buffer.from(
    "Test technique Compétence : la configuration Gmail API est opérationnelle.",
    "utf8",
  ).toString("base64");
  return [
    `From: Competence <${senderEmail}>`,
    `To: ${senderEmail}`,
    "Subject: [Competence] Verification Gmail API",
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
    "",
  ].join("\r\n");
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isSafeEmailAddress(value) {
  return !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : "inconnu";
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    const message =
      error instanceof SafeVerificationError
        ? error.message
        : "Une erreur interne a interrompu la vérification Gmail.";
    console.error(`Échec de la vérification Gmail : ${message}`);
    process.exitCode = 1;
  });
}
