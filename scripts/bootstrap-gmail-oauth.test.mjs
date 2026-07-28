import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import fs from "node:fs";
import { createServer } from "node:net";
import test from "node:test";

import {
  buildAuthorizationUrl,
  buildVercelEnvironmentRequest,
  createPkcePair,
  installRefreshTokenInVercel,
  parseArguments,
  parseLoopbackRedirectUri,
  openSystemBrowser,
  readBootstrapConfiguration,
  startAuthorizationCallback,
  validateAuthorizationResult,
  validateRefreshedAuthorizationResult,
  validateVercelProjectLink,
} from "./bootstrap-gmail-oauth.mjs";

const SENDER = "diplomateimmobilier99@gmail.com";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

test("le bootstrap refuse les options ou contextes non locaux", () => {
  assert.deepEqual(parseArguments([]), { help: false });
  assert.deepEqual(parseArguments(["--help"]), { help: true });
  assert.throws(() => parseArguments(["--no-open"]), /Option inconnue/);
  assert.throws(() => parseArguments(["--token"]), /Option inconnue/);
  assert.throws(() => readBootstrapConfiguration({ CI: "true" }), /localement/);
  assert.throws(() => readBootstrapConfiguration({}), /GMAIL_CLIENT_ID/);
});

test("le callback est limité à 127.0.0.1 et à un port non privilégié", () => {
  assert.equal(
    parseLoopbackRedirectUri("http://127.0.0.1:53682/oauth2/callback").hostname,
    "127.0.0.1",
  );
  for (const unsafe of [
    "https://127.0.0.1:53682/oauth2/callback",
    "http://localhost:53682/oauth2/callback",
    "http://127.0.0.1:80/oauth2/callback",
    "http://127.0.0.1:53682/autre",
    "http://127.0.0.1:53682/oauth2/callback?code=x",
  ]) {
    assert.throws(() => parseLoopbackRedirectUri(unsafe), /loopback/);
  }
});

test("le callback rejette un mauvais state puis consomme une seule autorisation valide", async () => {
  const port = await findFreeLoopbackPort();
  const redirect = parseLoopbackRedirectUri(`http://127.0.0.1:${port}/oauth2/callback`);
  const callback = await startAuthorizationCallback(redirect, "state-attendu", 2_000);

  const rejected = await fetch(`${redirect}?state=state-invalide&code=code-invalide`);
  assert.equal(rejected.status, 403);

  const accepted = await fetch(`${redirect}?state=state-attendu&code=code-valide`);
  assert.equal(accepted.status, 200);
  assert.equal(await callback.codePromise, "code-valide");
});

test("le callback peut être annulé sans attendre le timeout", async () => {
  const port = await findFreeLoopbackPort();
  const redirect = parseLoopbackRedirectUri(`http://127.0.0.1:${port}/oauth2/callback`);
  const callback = await startAuthorizationCallback(redirect, "state-attendu", 2_000);
  const rejected = assert.rejects(callback.codePromise, /annulé localement/);
  callback.cancel();
  await rejected;
});

test("un port callback occupé échoue sans unhandledRejection", async () => {
  const blocker = createServer();
  blocker.listen(0, "127.0.0.1");
  await once(blocker, "listening");
  const address = blocker.address();
  const port = typeof address === "object" && address ? address.port : 0;
  assert.ok(port >= 1024);

  const unhandledRejections = [];
  const captureUnhandledRejection = (reason) => {
    unhandledRejections.push(reason);
  };
  process.on("unhandledRejection", captureUnhandledRejection);
  try {
    const redirect = parseLoopbackRedirectUri(
      `http://127.0.0.1:${port}/oauth2/callback`,
    );
    await assert.rejects(
      startAuthorizationCallback(redirect, "state-attendu", 2_000),
      /port configuré est libre/,
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  } finally {
    process.off("unhandledRejection", captureUnhandledRejection);
    blocker.close();
    await once(blocker, "close");
  }
  assert.deepEqual(unhandledRejections, []);
});

test("l'URL Google utilise PKCE et exactement les trois scopes", () => {
  const pkce = createPkcePair();
  assert.notEqual(pkce.verifier, pkce.challenge);
  const url = buildAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://127.0.0.1:53682/oauth2/callback",
    senderEmail: SENDER,
    state: "state-test",
    challenge: pkce.challenge,
  });
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), "state-test");
  assert.equal(url.searchParams.get("login_hint"), SENDER);
  assert.equal(url.searchParams.has("include_granted_scopes"), false);
  assert.deepEqual(
    new Set(url.searchParams.get("scope").split(" ")),
    new Set(["openid", "email", GMAIL_SEND_SCOPE]),
  );
});

test("le navigateur système reçoit uniquement un environnement sans secrets", async () => {
  const calls = [];
  const child = new EventEmitter();
  child.unref = () => {};
  const browserUrl = "https://accounts.google.com/o/oauth2/v2/auth?state=test";

  await openSystemBrowser(browserUrl, {
    platform: "win32",
    environment: {
      SystemRoot: "C:\\Windows",
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\Users\\test",
      GMAIL_CLIENT_SECRET: "gmail-secret-sentinel",
      VERCEL_TOKEN: "vercel-secret-sentinel",
      JEKO_API_KEY: "jeko-secret-sentinel",
      NODE_OPTIONS: "--require secret-sentinel",
    },
    spawnImpl(executable, args, options) {
      calls.push({ executable, args, options });
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
  });

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.executable, "C:\\Windows\\System32\\rundll32.exe");
  assert.deepEqual(call.args, [
    "C:\\Windows\\System32\\url.dll,FileProtocolHandler",
    browserUrl,
  ]);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.env.SystemRoot, "C:\\Windows");
  assert.equal(call.options.env.GMAIL_CLIENT_SECRET, undefined);
  assert.equal(call.options.env.VERCEL_TOKEN, undefined);
  assert.equal(call.options.env.JEKO_API_KEY, undefined);
  assert.equal(call.options.env.NODE_OPTIONS, undefined);
  assert.doesNotMatch(JSON.stringify(call.options.env), /secret-sentinel/);
});

test("le résultat OAuth exige le compte vérifié et les scopes exacts", () => {
  const token = {
    access_token: "access-token",
    refresh_token: "refresh-token",
    scope: `openid https://www.googleapis.com/auth/userinfo.email ${GMAIL_SEND_SCOPE}`,
    token_type: "Bearer",
  };
  assert.deepEqual(
    validateAuthorizationResult(token, { email: SENDER, email_verified: true }, SENDER),
    { accessToken: "access-token", refreshToken: "refresh-token" },
  );
  assert.throws(
    () => validateAuthorizationResult(token, { email: "autre@gmail.com", email_verified: true }, SENDER),
    /ne correspond pas exactement/,
  );
  assert.throws(
    () => validateAuthorizationResult(token, { email: SENDER, email_verified: false }, SENDER),
    /ne correspond pas exactement/,
  );
  assert.throws(
    () => validateAuthorizationResult({ ...token, refresh_token: "" }, { email: SENDER, email_verified: true }, SENDER),
    /refresh token/,
  );
  assert.throws(
    () => validateAuthorizationResult(
      { ...token, scope: `${token.scope} https://www.googleapis.com/auth/gmail.readonly` },
      { email: SENDER, email_verified: true },
      SENDER,
    ),
    /exactement openid, email et gmail\.send/,
  );
  assert.deepEqual(
    validateRefreshedAuthorizationResult(
      { ...token, refresh_token: undefined },
      { email: SENDER, email_verified: true },
      SENDER,
    ),
    { accessToken: "access-token" },
  );
  assert.throws(
    () => validateRefreshedAuthorizationResult(
      { ...token, access_token: "", refresh_token: undefined },
      { email: SENDER, email_verified: true },
      SENDER,
    ),
    /refresh token n'a pas produit/,
  );
});

test("le projet Vercel et la portée Production Sensitive sont verrouillés", () => {
  const link = {
    projectId: "prj_nlK5X4JHHxBUz9KO5p7cLJoOli7n",
    orgId: "team_w3j30Z9r0zVQ5iTP0Vbdg3As",
    projectName: "competence",
  };
  assert.deepEqual(validateVercelProjectLink(link), link);
  assert.throws(
    () => validateVercelProjectLink({ ...link, projectName: "autre-projet" }),
    /ouiya-tech\/competence/,
  );

  const request = buildVercelEnvironmentRequest("refresh-token-value");
  assert.match(request.path, /^\/v10\/projects\/prj_nlK5X4JHHxBUz9KO5p7cLJoOli7n\/env\?upsert=true&teamId=team_/);
  assert.deepEqual(request.body, {
    key: "GMAIL_REFRESH_TOKEN",
    value: "refresh-token-value",
    type: "sensitive",
    target: ["production"],
  });

  const source = fs.readFileSync(new URL("./bootstrap-gmail-oauth.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /npx\.cmd|runVercelCommand|buildVercelInstallCommandArgs/);
  assert.doesNotMatch(source, /writeFile|appendFile/);
  assert.match(source, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  assert.match(source, /JSON\.stringify\(body\)/);
  const loggerCalls = [...source.matchAll(/console\.(?:log|error)\(([\s\S]*?)\);/g)].map(
    (match) => match[1],
  );
  for (const call of loggerCalls) {
    assert.doesNotMatch(call, /\b(?:accessToken|refreshToken|clientSecret)\b/);
  }
});

test("l'installation Vercel est un upsert HTTPS retryable avec le même jeton en mémoire", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (calls.length < 3) {
      throw new Error("réseau simulé");
    }
    return new Response(JSON.stringify({ created: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await installRefreshTokenInVercel("refresh-token-value", "vercel-access-token", fetchImpl);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.match(call.url, /^https:\/\/api\.vercel\.com\/v10\/projects\/prj_/);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers.Authorization, "Bearer vercel-access-token");
    const body = JSON.parse(call.init.body);
    assert.deepEqual(body, {
      key: "GMAIL_REFRESH_TOKEN",
      value: "refresh-token-value",
      type: "sensitive",
      target: ["production"],
    });
  }
});

async function findFreeLoopbackPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  assert.ok(port >= 1024);
  return port;
}
