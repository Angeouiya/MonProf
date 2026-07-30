#!/usr/bin/env node

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { basename, dirname, isAbsolute, join, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeGoogleScopes } from "./verify-gmail-live.mjs";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const EXPECTED_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";
const EXPECTED_VERCEL_PROJECT = Object.freeze({
  id: "prj_nlK5X4JHHxBUz9KO5p7cLJoOli7n",
  name: "competence",
  orgId: "team_w3j30Z9r0zVQ5iTP0Vbdg3As",
});
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:53682/oauth2/callback";
const AUTHORIZATION_TIMEOUT_MS = 15 * 60_000;
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;
const VERCEL_CLI_TIMEOUT_MS = 2 * 60_000;
const VERCEL_CLI_COMMAND = "vercel";
const VERCEL_CLI_OUTPUT_LIMIT_BYTES = 128 * 1024;
const REQUIRED_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
];
const REQUIRED_NORMALIZED_SCOPES = new Set(REQUIRED_SCOPES);
const SAFE_CHILD_ENVIRONMENT_KEYS = new Set([
  "APPDATA",
  "COMSPEC",
  "DBUS_SESSION_BUS_ADDRESS",
  "DESKTOP_SESSION",
  "DISPLAY",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "LOGNAME",
  "OS",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "SHELL",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USER",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
  "WAYLAND_DISPLAY",
  "WINDIR",
  "XAUTHORITY",
  "XDG_CURRENT_DESKTOP",
  "XDG_DATA_DIRS",
  "XDG_RUNTIME_DIR",
  "XDG_SESSION_DESKTOP",
  "XDG_SESSION_TYPE",
]);

class SafeBootstrapError extends Error {}

export function parseArguments(args) {
  if (args.length === 0) return { help: false };
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return { help: true };
  }
  throw new SafeBootstrapError("Option inconnue. Utilisez uniquement --help.");
}

export function readBootstrapConfiguration(environment = process.env) {
  if (environment.VERCEL || environment.CI) {
    throw new SafeBootstrapError(
      "Cette autorisation doit être exécutée localement, jamais dans Vercel ou une CI.",
    );
  }

  const clientId = environment.GMAIL_CLIENT_ID?.trim() ?? "";
  const clientSecret = environment.GMAIL_CLIENT_SECRET?.trim() ?? "";
  const senderEmail = (environment.GMAIL_SENDER_EMAIL || EXPECTED_SENDER_EMAIL)
    .trim()
    .toLowerCase();
  const redirectUri = (environment.GMAIL_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI).trim();

  if (!clientId || !clientSecret) {
    throw new SafeBootstrapError(
      "GMAIL_CLIENT_ID et GMAIL_CLIENT_SECRET doivent être fournis uniquement dans l'environnement du processus.",
    );
  }
  if ([clientId, clientSecret].some((value) => /[\r\n\0]/.test(value))) {
    throw new SafeBootstrapError("Le client OAuth Google contient une valeur invalide.");
  }
  if (senderEmail !== EXPECTED_SENDER_EMAIL) {
    throw new SafeBootstrapError(
      `GMAIL_SENDER_EMAIL doit être exactement ${EXPECTED_SENDER_EMAIL}.`,
    );
  }

  const redirect = parseLoopbackRedirectUri(redirectUri);
  return { clientId, clientSecret, senderEmail, redirectUri: redirect.toString(), redirect };
}

export function parseLoopbackRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SafeBootstrapError("GMAIL_OAUTH_REDIRECT_URI n'est pas une URL valide.");
  }

  const port = Number(url.port);
  if (
    url.protocol !== "http:"
    || url.hostname !== "127.0.0.1"
    || !Number.isInteger(port)
    || port < 1024
    || port > 65_535
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== "/oauth2/callback"
  ) {
    throw new SafeBootstrapError(
      "Le callback OAuth doit être exactement un endpoint loopback http://127.0.0.1:<port>/oauth2/callback.",
    );
  }
  return url;
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl({ clientId, redirectUri, senderEmail, state, challenge }) {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    login_hint: senderEmail,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url;
}

export function validateAuthorizationResult(tokenData, userInfo, senderEmail) {
  const refreshToken = typeof tokenData?.refresh_token === "string"
    ? tokenData.refresh_token.trim()
    : "";
  const accessToken = typeof tokenData?.access_token === "string"
    ? tokenData.access_token.trim()
    : "";
  if (!refreshToken || !accessToken || /[\r\n\0]/.test(refreshToken)) {
    throw new SafeBootstrapError(
      "Google n'a pas fourni de refresh token exploitable. Révoquez l'ancien accès puis relancez le consentement.",
    );
  }

  validateGoogleAccessGrant(tokenData, userInfo, senderEmail);

  return { accessToken, refreshToken };
}

export function validateRefreshedAuthorizationResult(tokenData, userInfo, senderEmail) {
  const accessToken = typeof tokenData?.access_token === "string"
    ? tokenData.access_token.trim()
    : "";
  if (!accessToken) {
    throw new SafeBootstrapError("Le refresh token n'a pas produit de jeton d'accès vérifiable.");
  }
  validateGoogleAccessGrant(tokenData, userInfo, senderEmail);
  return { accessToken };
}

function validateGoogleAccessGrant(tokenData, userInfo, senderEmail) {
  const tokenType = typeof tokenData?.token_type === "string"
    ? tokenData.token_type.trim().toLowerCase()
    : "";
  if (tokenType !== "bearer") {
    throw new SafeBootstrapError("Google n'a pas fourni un jeton Bearer conforme.");
  }

  const scopes = normalizeGoogleScopes(tokenData?.scope);
  const missing = [...REQUIRED_NORMALIZED_SCOPES].filter((scope) => !scopes.has(scope));
  const additional = [...scopes].filter((scope) => !REQUIRED_NORMALIZED_SCOPES.has(scope));
  if (missing.length > 0 || additional.length > 0) {
    throw new SafeBootstrapError(
      "Google doit autoriser exactement openid, email et gmail.send, sans autre scope.",
    );
  }

  const authorizedEmail = typeof userInfo?.email === "string"
    ? userInfo.email.trim().toLowerCase()
    : "";
  if (userInfo?.email_verified !== true || authorizedEmail !== senderEmail) {
    throw new SafeBootstrapError(
      "Le compte Google autorisé et vérifié ne correspond pas exactement à l'expéditeur Compétence.",
    );
  }

}

export function validateVercelProjectLink(projectLink) {
  if (
    projectLink?.projectId !== EXPECTED_VERCEL_PROJECT.id
    || projectLink?.orgId !== EXPECTED_VERCEL_PROJECT.orgId
    || projectLink?.projectName !== EXPECTED_VERCEL_PROJECT.name
  ) {
    throw new SafeBootstrapError(
      "Le dossier local n'est pas lié exactement au projet Vercel ouiya-tech/competence attendu.",
    );
  }
  return projectLink;
}

export function buildVercelEnvironmentRequest(refreshToken) {
  return {
    path: `/v10/projects/${EXPECTED_VERCEL_PROJECT.id}/env?upsert=true&teamId=${EXPECTED_VERCEL_PROJECT.orgId}`,
    body: {
      key: "GMAIL_REFRESH_TOKEN",
      value: refreshToken,
      type: "sensitive",
      target: ["production"],
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(
      [
        "Usage : npm run gmail:authorize",
        "Pré-requis : session Vercel valide, dépôt lié à ouiya-tech/competence, GMAIL_CLIENT_ID et GMAIL_CLIENT_SECRET présents uniquement dans le processus.",
        `Callback Google Cloud : ${DEFAULT_REDIRECT_URI}`,
        "Le refresh token est validé en mémoire puis transmis par HTTPS à Vercel Production; il n'est ni affiché ni écrit dans un fichier.",
      ].join("\n"),
    );
    return;
  }

  const configuration = readBootstrapConfiguration();
  await prepareVercelAuthorization();

  const state = randomBytes(32).toString("base64url");
  const pkce = createPkcePair();
  const callback = await startAuthorizationCallback(configuration.redirect, state);
  const authorizationUrl = buildAuthorizationUrl({
    ...configuration,
    state,
    challenge: pkce.challenge,
  });

  try {
    await openSystemBrowser(authorizationUrl.toString());
    console.log(
      `Autorisation Google ouverte pour ${EXPECTED_SENDER_EMAIL}. Validez uniquement les trois permissions Compétence demandées.`,
    );
  } catch {
    callback.cancel();
    throw new SafeBootstrapError("Impossible d'ouvrir le navigateur système pour le consentement Google.");
  }

  const code = await callback.codePromise;
  const tokenData = await exchangeAuthorizationCode({
    ...configuration,
    code,
    codeVerifier: pkce.verifier,
  });
  const userInfo = await fetchUserInfo(tokenData?.access_token);
  const authorization = validateAuthorizationResult(
    tokenData,
    userInfo,
    configuration.senderEmail,
  );

  const refreshedTokenData = await exchangeRefreshToken(
    configuration,
    authorization.refreshToken,
  );
  const refreshedUserInfo = await fetchUserInfo(refreshedTokenData?.access_token);
  validateRefreshedAuthorizationResult(
    refreshedTokenData,
    refreshedUserInfo,
    configuration.senderEmail,
  );

  await installRefreshTokenInVercel(authorization.refreshToken);
  console.log(
    "Autorisation Gmail validée et GMAIL_REFRESH_TOKEN remplacé dans Vercel Production sans affichage du jeton.",
  );
}

export async function startAuthorizationCallback(
  redirect,
  expectedState,
  authorizationTimeoutMs = AUTHORIZATION_TIMEOUT_MS,
) {
  let finished = false;
  let resolveCode;
  let rejectCode;
  let timeout;
  const codePromise = new Promise((resolvePromise, rejectPromise) => {
    resolveCode = resolvePromise;
    rejectCode = rejectPromise;
  });
  // Le rejet reste observable par l'appelant, mais il est immédiatement marqué
  // comme géré si une erreur serveur survient avant que la fonction retourne.
  codePromise.catch(() => {});
  const server = createServer((request, response) => {
      if (request.method !== "GET" || !request.url) {
        writeCallbackResponse(response, 405, false);
        return;
      }

      const requestUrl = new URL(request.url, redirect.origin);
      if (requestUrl.pathname !== redirect.pathname) {
        writeCallbackResponse(response, 404, false);
        return;
      }
      if (finished) {
        writeCallbackResponse(response, 409, false);
        return;
      }

      const receivedState = requestUrl.searchParams.get("state") ?? "";
      if (!safeEqual(receivedState, expectedState)) {
        writeCallbackResponse(response, 403, false);
        return;
      }

      const providerError = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code") ?? "";
      if (providerError || !code || code.length > 4096 || /[\r\n\0]/.test(code)) {
        writeCallbackResponse(response, 400, false);
        finish(new SafeBootstrapError("Google n'a pas accordé l'autorisation demandée."));
        return;
      }

      writeCallbackResponse(response, 200, true);
      finish(null, code);
  });

  await new Promise((resolveListening, rejectListening) => {
    const listenError = () => {
      const error = new SafeBootstrapError(
        "Impossible d'ouvrir le callback OAuth local. Vérifiez que le port configuré est libre.",
      );
      finished = true;
      rejectListening(error);
    };
    server.once("error", listenError);
    server.listen(Number(redirect.port), "127.0.0.1", () => {
      server.off("error", listenError);
      server.on("error", () => {
        finish(new SafeBootstrapError("Le callback OAuth local a été interrompu."));
      });
      resolveListening();
    });
  });

  timeout = setTimeout(() => {
    finish(new SafeBootstrapError("Le consentement Google a expiré après cinq minutes."));
  }, authorizationTimeoutMs);

  return {
    codePromise,
    cancel() {
      finish(new SafeBootstrapError("Le consentement Google a été annulé localement."));
      codePromise.catch(() => {});
    },
  };

  function finish(error, code) {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    server.close();
    if (error) rejectCode(error);
    else resolveCode(code);
  }
}

function writeCallbackResponse(response, status, success) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  });
  response.end(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Compétence</title><style>body{font-family:system-ui;max-width:42rem;margin:5rem auto;padding:1rem;color:#15233b}</style><body><h1>${success ? "Autorisation reçue" : "Autorisation refusée"}</h1><p>${success ? "Vous pouvez fermer cet onglet et revenir à Compétence." : "Fermez cet onglet puis relancez l'autorisation depuis Compétence."}</p></body></html>`,
  );
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function exchangeAuthorizationCode(input) {
  const response = await fetchGoogleWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    }),
  });
  const data = await readJson(response);
  if (!response.ok || !data) {
    throw new SafeBootstrapError(
      `Google a refusé l'échange OAuth (statut ${safeStatus(response.status)}).`,
    );
  }
  return data;
}

async function exchangeRefreshToken(configuration, refreshToken) {
  const response = await fetchGoogleWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await readJson(response);
  if (!response.ok || !data) {
    throw new SafeBootstrapError(
      `Google a refusé le refresh token (statut ${safeStatus(response.status)}).`,
    );
  }
  return data;
}

async function fetchUserInfo(accessToken) {
  if (typeof accessToken !== "string" || !accessToken) {
    throw new SafeBootstrapError("Google n'a pas fourni de jeton d'accès vérifiable.");
  }
  const response = await fetchGoogleWithTimeout(GOOGLE_USERINFO_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(response);
  if (!response.ok || !data) {
    throw new SafeBootstrapError(
      `Google n'a pas confirmé l'identité OAuth (statut ${safeStatus(response.status)}).`,
    );
  }
  return data;
}

async function fetchGoogleWithTimeout(url, options) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SafeBootstrapError("Google n'a pas répondu dans le délai imparti.");
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function prepareVercelAuthorization() {
  const projectLinkPath = join(process.cwd(), ".vercel", "project.json");
  let projectLink;
  try {
    projectLink = JSON.parse(await readFile(projectLinkPath, "utf8"));
  } catch {
    throw new SafeBootstrapError(
      "Le lien local Vercel est absent ou invalide; reliez uniquement ce dossier à ouiya-tech/competence.",
    );
  }
  validateVercelProjectLink(projectLink);

  const project = await runVercelCliRequest(
    `/v9/projects/${EXPECTED_VERCEL_PROJECT.id}?teamId=${EXPECTED_VERCEL_PROJECT.orgId}`,
    { method: "GET" },
  );
  if (
    project?.id !== EXPECTED_VERCEL_PROJECT.id
    || project?.name !== EXPECTED_VERCEL_PROJECT.name
    || project?.accountId !== EXPECTED_VERCEL_PROJECT.orgId
  ) {
    throw new SafeBootstrapError(
      "La session Vercel ne confirme pas exactement le projet ouiya-tech/competence attendu.",
    );
  }
}

export async function installRefreshTokenInVercel(
  refreshToken,
  requestImpl = runVercelCliRequest,
) {
  const request = buildVercelEnvironmentRequest(refreshToken);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await requestImpl(request.path, {
        method: "POST",
        body: request.body,
        silent: true,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof SafeBootstrapError
    ? lastError
    : new SafeBootstrapError(
      "Vercel n'a pas confirmé l'installation du refresh token.",
    );
}

export function buildVercelCliInvocation(
  path,
  {
    method = "GET",
    hasBody = false,
    silent = false,
    nodeExecutable = process.execPath,
    npmExecPath = process.env.npm_execpath,
  } = {},
) {
  const normalizedMethod = typeof method === "string" ? method.trim().toUpperCase() : "";
  if (
    typeof path !== "string"
    || !path.startsWith("/")
    || /[\r\n\0]/.test(path)
    || !["GET", "POST"].includes(normalizedMethod)
  ) {
    throw new SafeBootstrapError("La requête Vercel CLI est invalide.");
  }

  const normalizedNodeExecutable = typeof nodeExecutable === "string"
    ? nodeExecutable.trim()
    : "";
  const normalizedNpmExecPath = typeof npmExecPath === "string" ? npmExecPath.trim() : "";
  if (
    !normalizedNodeExecutable
    || !isAbsolute(normalizedNodeExecutable)
    || /[\r\n\0]/.test(normalizedNodeExecutable)
    || !normalizedNpmExecPath
    || !isAbsolute(normalizedNpmExecPath)
    || basename(normalizedNpmExecPath).toLowerCase() !== "npm-cli.js"
    || /[\r\n\0]/.test(normalizedNpmExecPath)
  ) {
    throw new SafeBootstrapError(
      "La CLI npm locale est indisponible. Lancez cette autorisation avec npm run gmail:authorize.",
    );
  }

  const args = [
    join(dirname(normalizedNpmExecPath), "npx-cli.js"),
    "--no-install",
    VERCEL_CLI_COMMAND,
    "api",
    path,
    "-X",
    normalizedMethod,
    "--non-interactive",
    silent ? "--silent" : "--raw",
  ];
  if (hasBody) args.push("--input", "-");
  return { executable: normalizedNodeExecutable, args };
}

export async function runVercelCliRequest(
  path,
  {
    method = "GET",
    body,
    silent = false,
    environment = process.env,
    spawnImpl = spawn,
    nodeExecutable = process.execPath,
    npmExecPath = process.env.npm_execpath,
    timeoutMs = VERCEL_CLI_TIMEOUT_MS,
  } = {},
) {
  const hasBody = body !== undefined;
  const command = buildVercelCliInvocation(path, {
    method,
    hasBody,
    silent,
    nodeExecutable,
    npmExecPath,
  });
  const safeEnvironment = buildSafeChildEnvironment(environment);
  const serializedBody = hasBody ? JSON.stringify(body) : "";

  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawnImpl(command.executable, command.args, {
        cwd: process.cwd(),
        env: safeEnvironment,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch {
      rejectPromise(new SafeBootstrapError("Impossible de lancer la CLI Vercel authentifiée."));
      return;
    }

    let settled = false;
    let stdout = "";
    let outputBytes = 0;
    const timeout = setTimeout(() => {
      child.kill?.();
      finish(new SafeBootstrapError("La CLI Vercel n'a pas répondu dans le délai imparti."));
    }, timeoutMs);

    const consumeOutput = (chunk, capture) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > VERCEL_CLI_OUTPUT_LIMIT_BYTES) {
        child.kill?.();
        finish(new SafeBootstrapError("La réponse de la CLI Vercel est anormalement volumineuse."));
        return;
      }
      if (capture) stdout += chunk.toString("utf8");
    };

    child.stdout?.on("data", (chunk) => consumeOutput(chunk, !silent));
    child.stderr?.on("data", (chunk) => consumeOutput(chunk, false));
    child.once("error", () => {
      finish(new SafeBootstrapError("Impossible de lancer la CLI Vercel authentifiée."));
    });
    child.once("close", (code) => {
      if (code !== 0) {
        finish(
          new SafeBootstrapError(
            "La session Vercel n'est plus autorisée pour ouiya-tech/competence. Exécutez npx vercel login.",
          ),
        );
        return;
      }
      if (silent) {
        finish(null, null);
        return;
      }
      try {
        finish(null, JSON.parse(stdout));
      } catch {
        finish(new SafeBootstrapError("La CLI Vercel n'a pas fourni de réponse JSON valide."));
      }
    });
    child.stdin?.once("error", () => {
      finish(new SafeBootstrapError("La CLI Vercel n'a pas accepté la requête sécurisée."));
    });
    child.stdin?.end(serializedBody, "utf8");

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectPromise(error);
      else resolvePromise(value);
    }
  });
}

export function openSystemBrowser(
  url,
  {
    platform = process.platform,
    environment = process.env,
    spawnImpl = spawn,
  } = {},
) {
  const command = buildSystemBrowserCommand(url, platform, environment);
  const safeEnvironment = buildSafeChildEnvironment(environment);
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnImpl(command.executable, command.args, {
      detached: true,
      env: safeEnvironment,
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
    child.once("error", rejectPromise);
  });
}

function buildSystemBrowserCommand(url, platform, environment) {
  if (platform === "win32") {
    const systemRoot = readEnvironmentValue(environment, "SYSTEMROOT", "WINDIR");
    const normalizedRoot = typeof systemRoot === "string" ? win32.normalize(systemRoot.trim()) : "";
    if (
      !normalizedRoot
      || !/^[A-Za-z]:\\/.test(normalizedRoot)
      || /[\r\n\0"]/u.test(normalizedRoot)
    ) {
      throw new SafeBootstrapError(
        "Le répertoire système Windows est absent ou invalide; le navigateur n'a pas été ouvert.",
      );
    }
    const systemDirectory = win32.join(normalizedRoot, "System32");
    return {
      executable: win32.join(systemDirectory, "rundll32.exe"),
      args: [`${win32.join(systemDirectory, "url.dll")},FileProtocolHandler`, url],
    };
  }
  if (platform === "darwin") {
    return { executable: "/usr/bin/open", args: [url] };
  }
  if (platform === "linux") {
    return { executable: "/usr/bin/xdg-open", args: [url] };
  }
  throw new SafeBootstrapError(
    "Cette plateforme ne dispose pas d'un lanceur de navigateur système approuvé.",
  );
}

function buildSafeChildEnvironment(environment) {
  const safeEnvironment = {};
  for (const [key, value] of Object.entries(environment)) {
    if (
      SAFE_CHILD_ENVIRONMENT_KEYS.has(key.toUpperCase())
      && typeof value === "string"
      && !/[\r\n\0]/u.test(value)
    ) {
      safeEnvironment[key] = value;
    }
  }
  return safeEnvironment;
}

function readEnvironmentValue(environment, ...names) {
  const expectedNames = new Set(names.map((name) => name.toUpperCase()));
  for (const [key, value] of Object.entries(environment)) {
    if (expectedNames.has(key.toUpperCase()) && typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function safeStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : "inconnu";
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof SafeBootstrapError
      ? error.message
      : "Une erreur interne a interrompu l'autorisation Gmail.";
    console.error(`Échec de l'autorisation Gmail : ${message}`);
    process.exitCode = 1;
  });
}
