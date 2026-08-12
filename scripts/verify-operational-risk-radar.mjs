import assert from "node:assert/strict";
import fs from "node:fs";

const radar = read("../src/lib/operational-risk-radar.ts");
const health = read("../src/app/api/health/route.ts");
const productionCheck = read("./check-production-config.mjs");
const pkg = JSON.parse(read("../package.json"));

assert.match(radar, /export async function getOperationalRiskRadar/);
assert.match(radar, /operationalBookingsWithoutVerifiedFunds/);
assert.match(radar, /securedBookingsWithoutProviderProof/);
assert.match(radar, /securedBookingsWithoutVerifiedTransaction/);
assert.match(radar, /staleJekoPaymentAttempts/);
assert.match(radar, /rejectedJekoEventsLast24h/);
assert.match(radar, /failedJekoEventsLast24h/);
assert.match(radar, /staleJekoPayouts/);
assert.match(radar, /dueJobs/);
assert.match(radar, /retryJobs/);
assert.match(radar, /staleProcessingJobs/);
assert.match(radar, /failedJobsLast24h/);
assert.match(radar, /ambiguousJobs/);
assert.match(radar, /criticalCount/);
assert.match(radar, /attentionCount/);
assert.match(radar, /status:\s*RiskStatus/);
assert.match(radar, /"critical"/);
assert.match(radar, /"attention"/);
assert.match(radar, /COUNT\(\*\)::integer/);
assert.match(radar, /booking\."status" IN \(/);
assert.match(radar, /booking\."paymentStatus" NOT IN \(/);
assert.match(radar, /booking\."paymentProvider" = 'JEKO'/);
assert.match(radar, /booking\."paymentProvider" = 'PAYDUNYA'/);
assert.match(radar, /UPPER\(COALESCE\(booking\."providerPaymentStatus", ''\)\) = 'SUCCESS'/);
assert.match(radar, /UPPER\(COALESCE\(booking\."paydunyaStatus", ''\)\) = 'COMPLETED'/);
assert.match(radar, /NOT EXISTS \(/);
assert.match(radar, /FROM "Transaction" AS tx/);
assert.match(radar, /tx\."type" = 'CLIENT_PAYMENT'/);
assert.match(radar, /attempt\."provider" = 'JEKO'/);
assert.match(radar, /COALESCE\(attempt\."lastCheckedAt", attempt\."updatedAt"\)/);
assert.match(radar, /payout\."provider" = 'JEKO'/);
assert.match(radar, /COALESCE\(payout\."lastCheckedAt", payout\."createdAt"\)/);
assert.match(radar, /db\.passwordEmailOutbox\.count/);
assert.match(radar, /status: "PROCESSING"/);
assert.match(radar, /lockedAt: \{ lt: stalePasswordEmailBefore \}/);
assert.doesNotMatch(
  radar,
  /select:\s*\{[\s\S]*?(?:email|recipientEmail|phone|reference:\s*true|providerOrderId:\s*true)[\s\S]*?\}/,
);

assert.match(health, /getOperationalRiskRadar/);
assert.match(health, /sensitiveFlowsHealthy/);
assert.match(health, /riskRadar\.status !== "critical"/);
assert.match(health, /operationalRisk/);
assert.match(health, /\[health\] Operational readiness check failed\./);
assert.doesNotMatch(health, /apiKey|clientSecret|refreshToken|webhookSecret/);

assert.equal(
  pkg.scripts?.["verify:operational-risk"],
  "node scripts/verify-operational-risk-radar.mjs",
);
assert.match(pkg.scripts?.["build:quality"] ?? "", /npm run verify:operational-risk/);
assert.match(productionCheck, /Operational risk radar protects Jèko and password email health/);
assert.match(productionCheck, /verify:operational-risk/);

console.log("Operational risk radar verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
