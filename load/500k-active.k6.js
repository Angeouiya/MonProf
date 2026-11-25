import http from "k6/http";
import { check, sleep } from "k6";
import execution from "k6/execution";
import { SharedArray } from "k6/data";
import { assertLoadTarget, assertLoadProof } from "./target-policy.mjs";

const origin = (__ENV.BASE_URL || "").replace(/\/$/, "");
const local = __ENV.LOCAL_CAPACITY_TEST === "true";
assertLoadTarget(origin, {
  local,
  distributed: __ENV.EXECUTE_DISTRIBUTED_500K === "true",
  runId: __ENV.CAPACITY_RUN_ID,
});
if (!__ENV.CAPACITY_USERS_FILE || !__ENV.CAPACITY_RUN_ID)
  throw new Error("Synthetic users and isolation run ID are required.");
const users = new SharedArray("synthetic-capacity-users", () => {
  const values = JSON.parse(open(__ENV.CAPACITY_USERS_FILE));
  if (
    !Array.isArray(values) ||
    !values.every(
      (user) =>
        user.id.startsWith("capacity-user-") && typeof user.cookie === "string",
    ) ||
    new Set(values.map((user) => user.id)).size !== values.length
  )
    throw new Error("Distinct synthetic identities are required.");
  return values;
});
const peak = local ? Number(__ENV.PEAK_VUS || 20) : 500_000;
if (!Number.isInteger(peak) || peak < 1 || (local && peak > 100))
  throw new Error("Local concurrency is capped at 100 VUs.");
if (users.length < peak)
  throw new Error("One distinct synthetic identity per VU is required.");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    active_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: local
        ? [
            { duration: "10s", target: peak },
            { duration: "30s", target: peak },
            { duration: "10s", target: 0 },
          ]
        : [
            { duration: "5m", target: 1_000 },
            { duration: "10m", target: 10_000 },
            { duration: "10m", target: 50_000 },
            { duration: "10m", target: 100_000 },
            { duration: "10m", target: 250_000 },
            { duration: "15m", target: peak },
            { duration: "10m", target: peak },
            { duration: "5m", target: 0 },
          ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed: [
      { threshold: "rate<0.001", abortOnFail: true, delayAbortEval: "20s" },
    ],
    checks: ["rate>0.999"],
    http_req_duration: ["p(95)<2500"],
    "http_req_duration{route:client-notifications}": ["p(95)<2500"],
    "http_req_duration{route:client-courses}": ["p(95)<2500"],
  },
};

export function setup() {
  const response = http.get(`${origin}/__load/identity`, {
    responseType: "text",
    redirects: 0,
  });
  let identity;
  try {
    identity = response.json();
  } catch {
    throw new Error("No isolated test identity; refusing traffic.");
  }
  if (response.status !== 200)
    throw new Error("Isolation proof request failed.");
  assertLoadProof(identity, __ENV.CAPACITY_RUN_ID);
  return { fixtureAccounts: identity.accounts };
}

export default function activeUserJourney() {
  const user = users[execution.vu.idInTest - 1];
  const choice = execution.scenario.iterationInTest % 10;
  const route =
    choice < 5
      ? "client-notifications"
      : choice < 8
        ? "client-courses"
        : "public-request";
  const path =
    route === "client-notifications"
      ? "/api/client/notifications"
      : route === "client-courses"
        ? "/client/accompagnement"
        : "/demande-cours";
  const response = http.get(`${origin}${path}`, {
    headers: {
      Cookie: user.cookie,
      Accept:
        route === "client-notifications" ? "application/json" : "text/html",
    },
    tags: { route },
    redirects: 0,
    timeout: "10s",
  });
  check(response, {
    "authenticated course and notification reads return 200": (result) =>
      result.status === 200,
  });
  sleep(local ? 1 + Math.random() * 2 : 15 + Math.random() * 30);
}

export function handleSummary(data) {
  const result = {
    mode: local ? "local-bounded" : "distributed-500k",
    configuredPeakVUs: peak,
    observedPeakVUs: data.metrics.vus?.values?.max ?? null,
    requests: data.metrics.http_reqs?.values?.count ?? 0,
    errorRate: data.metrics.http_req_failed?.values?.rate ?? null,
    p95Ms: data.metrics.http_req_duration?.values?.["p(95)"] ?? null,
    metrics: data.metrics,
    simultaneous500kCertified: false,
  };
  return {
    [__ENV.CAPACITY_SUMMARY_FILE || "capacity-summary.json"]: JSON.stringify(
      result,
      null,
      2,
    ),
  };
}
