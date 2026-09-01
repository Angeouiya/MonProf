import assert from "node:assert/strict";
import fs from "node:fs";

const wrangler = fs.readFileSync("wrangler.jsonc", "utf8");
const worker = fs.readFileSync("cloudflare-worker.ts", "utf8");
const openNext = fs.readFileSync("open-next.config.ts", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");
const database = fs.readFileSync("src/lib/db.ts", "utf8");
const policy = fs.readFileSync("src/lib/production-integration-policy.ts", "utf8");
const webPushQueue = fs.readFileSync("src/lib/web-push-queue.ts", "utf8");
const communicationQueue = fs.readFileSync("src/lib/communication-queue.ts", "utf8");
const internalQueueRoute = fs.readFileSync("src/app/api/internal/cloudflare-queue/route.ts", "utf8");
const cloudflareNextBuild = fs.readFileSync("scripts/run-cloudflare-next-build.mjs", "utf8");

assert.match(wrangler, /"main": "\.\/cloudflare-worker\.ts"/);
assert.match(wrangler, /"compatibility_flags": \["nodejs_compat"\]/);
assert.match(wrangler, /"APP_DEPLOYMENT_ENV": "staging"/);
assert.match(wrangler, /"APP_DEPLOYMENT_ENV": "production"/);
assert.match(wrangler, /"workers_dev": false/);
assert.match(wrangler, /"crons": \["\* \* \* \* \*"\]/);
assert.match(wrangler, /WEB_PUSH_QUEUE/);
assert.match(wrangler, /COMMUNICATION_QUEUE/);
assert.match(wrangler, /"binding": "HYPERDRIVE"/);
assert.match(wrangler, /"DATABASE_SCHEMA": "competence"/);

assert.match(worker, /scheduled\(/);
assert.match(worker, /async queue\(/);
assert.match(worker, /runWithCloudflareRequestContext/);
assert.match(worker, /await import\("\.\/\.open-next\/worker\.js"\)/);
assert.match(worker, /process\.env\.DATABASE_URL = env\.HYPERDRIVE\.connectionString/);
assert.match(worker, /runWithDatabaseRequestContext/);
assert.match(openNext, /buildCommand: "npm run build:next:webpack"/);
assert.match(packageJson, /"build:next:webpack": "node scripts\/run-cloudflare-next-build\.mjs"/);
assert.match(cloudflareNextBuild, /--max-old-space-size=8192/);
assert.match(cloudflareNextBuild, /\["build", "--webpack"\]/);
assert.match(worker, /CLOUDFLARE_INTERNAL_SECRET/);
assert.match(worker, /\/api\/cron\/jeko-reconciliation/);
assert.match(worker, /\/api\/cron\/password-email-outbox/);

assert.match(database, /new PrismaPg\(/);
assert.match(database, /maxUses: 1/);
assert.match(database, /max: 5/);
assert.match(database, /new AsyncLocalStorage<AppPrismaClient>\(\)/);
assert.match(database, /Symbol\.for\('competence\.prisma\.request-context'\)/);
assert.match(database, /runWithDatabaseRequestContext/);
assert.match(database, /getCloudflareContext\(\)/);
assert.match(database, /APP_DEPLOYMENT_PLATFORM === 'cloudflare'/);
assert.match(policy, /cloudflare-non-production/);
assert.match(policy, /cloudflare-production/);
assert.match(webPushQueue, /sendCloudflareQueueMessage\("WEB_PUSH_QUEUE"/);
assert.match(communicationQueue, /sendCloudflareQueueMessage\("COMMUNICATION_QUEUE"/);
assert.match(internalQueueRoute, /timingSafeEqual/);
assert.doesNotMatch(wrangler, /JEKO_API_KEY|DATABASE_URL|NEXTAUTH_SECRET|GMAIL_CLIENT_SECRET/);

console.log("Cloudflare deployment verification passed: runtime isolation, Prisma adapter, queues, cron and secret boundaries.");
