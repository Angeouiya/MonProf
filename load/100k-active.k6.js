import http from "k6/http";
import { check, sleep } from "k6";
import { assertLoadTarget, assertLoadProof } from "./target-policy.mjs";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
assertLoadTarget(baseUrl, {
  distributed: __ENV.EXECUTE_DISTRIBUTED_100K === "true",
  runId: __ENV.CAPACITY_RUN_ID,
});

export function setup() {
  const response = http.get(`${baseUrl}/__load/identity`, { redirects: 0 });
  if (response.status !== 200)
    throw new Error("No isolated environment proof.");
  assertLoadProof(response.json(), __ENV.CAPACITY_RUN_ID);
}

export const options = {
  scenarios: {
    active_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: 1_000 },
        { duration: "10m", target: 10_000 },
        { duration: "15m", target: 50_000 },
        { duration: "15m", target: 100_000 },
        { duration: "10m", target: 100_000 },
        { duration: "5m", target: 0 },
      ],
      gracefulRampDown: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<2500"],
    checks: ["rate>0.999"],
  },
};

const publicJourneys = [
  "/",
  "/professeurs?journey=ivoirien",
  "/professeurs?journey=francais",
  "/professeurs?journey=professionnel",
  "/tarifs",
];

export default function activeUserJourney() {
  const route =
    publicJourneys[Math.floor(Math.random() * publicJourneys.length)];
  const response = http.get(`${baseUrl}${route}`, {
    headers: { "User-Agent": "Competence-Distributed-Capacity-Test/1.0" },
    tags: { route },
  });
  check(response, {
    "statut HTTP acceptable": (result) =>
      result.status >= 200 && result.status < 400,
    "réponse non vide": (result) => result.body?.length > 0,
  });
  sleep(2 + Math.random() * 6);
}
