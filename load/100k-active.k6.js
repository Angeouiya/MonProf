import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) throw new Error("BASE_URL est obligatoire.");
if (/https:\/\/(www\.)?competence\.ci$/i.test(baseUrl) && __ENV.ALLOW_PRODUCTION !== "true") {
  throw new Error("Le test 100k est bloqué sur la production. Utilisez un environnement de charge dédié.");
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
  const route = publicJourneys[Math.floor(Math.random() * publicJourneys.length)];
  const response = http.get(`${baseUrl}${route}`, {
    headers: { "User-Agent": "Competence-Distributed-Capacity-Test/1.0" },
    tags: { route },
  });
  check(response, {
    "statut HTTP acceptable": (result) => result.status >= 200 && result.status < 400,
    "réponse non vide": (result) => result.body?.length > 0,
  });
  sleep(2 + Math.random() * 6);
}
