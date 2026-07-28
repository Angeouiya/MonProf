import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const applyKnownPayDunya = process.argv.includes("--apply-known-paydunya");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL || !fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value.startsWith("DATABASE_URL=")) continue;
    process.env.DATABASE_URL = value.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    return;
  }
}

function hasPayDunyaTrace(request) {
  return Boolean(
    request.paydunyaToken
    || request.paydunyaCheckoutUrl
    || request.paydunyaStatus
    || request.paydunyaReceiptUrl
    || request.paydunyaVerifiedAt
    || request.paydunyaLastCheckedAt
    || request.paydunyaFailureReason
    || request.paydunyaLastPayload,
  );
}

loadDatabaseUrl();
const prisma = new PrismaClient();

try {
  const requests = await prisma.bookingRescheduleRequest.findMany({
    select: {
      id: true,
      bookingId: true,
      status: true,
      paymentProvider: true,
      paydunyaToken: true,
      paydunyaCheckoutUrl: true,
      paydunyaStatus: true,
      paydunyaReceiptUrl: true,
      paydunyaVerifiedAt: true,
      paydunyaLastCheckedAt: true,
      paydunyaFailureReason: true,
      paydunyaLastPayload: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const knownPayDunya = requests.filter((request) => request.paymentProvider == null && hasPayDunyaTrace(request));
  const unresolvedLegacy = requests.filter((request) => request.paymentProvider == null && !hasPayDunyaTrace(request));
  const jekoWithPayDunyaTrace = requests.filter((request) => request.paymentProvider === "JEKO" && hasPayDunyaTrace(request));

  let applied = 0;
  if (applyKnownPayDunya && knownPayDunya.length > 0) {
    const result = await prisma.bookingRescheduleRequest.updateMany({
      where: { id: { in: knownPayDunya.map((request) => request.id) }, paymentProvider: null },
      data: { paymentProvider: "PAYDUNYA" },
    });
    applied = result.count;
  }

  console.log(JSON.stringify({
    mode: applyKnownPayDunya ? "apply-known-paydunya" : "dry-run",
    totalRequests: requests.length,
    knownPayDunyaCandidates: knownPayDunya.map(({ id, bookingId, status }) => ({ id, bookingId, status })),
    unresolvedLegacyNullProvider: unresolvedLegacy.map(({ id, bookingId, status }) => ({ id, bookingId, status })),
    jekoWithPayDunyaTrace: jekoWithPayDunyaTrace.map(({ id, bookingId, status }) => ({ id, bookingId, status })),
    applied,
    guidance: "Only explicit PayDunya traces may be backfilled to PAYDUNYA. Null-provider rows without a trace are intentionally left unchanged and must never be inferred as JEKO.",
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
