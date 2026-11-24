import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webPushTopicForOutbox } from "../src/lib/web-push-topic";
import { safeTeacherNotificationLink } from "../src/lib/teacher-notification-link";
import { teacherPushMayBeDelivered } from "../src/lib/web-push-expiry";

const source = (path: string) => readFileSync(path, "utf8");
const offerOne = webPushTopicForOutbox("outbox-marketplace-offer-one");
const offerTwo = webPushTopicForOutbox("outbox-marketplace-offer-two");
assert.equal(offerOne, webPushTopicForOutbox("outbox-marketplace-offer-one"));
assert.notEqual(offerOne, offerTwo, "Deux missions ne doivent pas se remplacer chez le fournisseur push.");
assert.match(offerOne, /^[A-Za-z0-9_-]{32}$/);
assert.equal(safeTeacherNotificationLink("/professeur/marche/mission-1"), "/professeur/marche/mission-1");
for (const badLink of ["https://attacker.test", "//attacker.test", "/client/demandes/1", "/professeur//attacker", "/professeur/evil\\path", "/professeur/evil\npath"]) {
  assert.equal(safeTeacherNotificationLink(badLink), null);
}
const now = new Date("2026-11-04T12:00:00.000Z");
assert.equal(teacherPushMayBeDelivered({ expiresAt: new Date("2026-11-04T12:03:00.000Z"), deletedAt: null }, now), true);
assert.equal(teacherPushMayBeDelivered({ expiresAt: now, deletedAt: null }, now), false);
assert.equal(teacherPushMayBeDelivered({ expiresAt: null, deletedAt: now }, now), false);
assert.equal(teacherPushMayBeDelivered(null, now), false);

const eventSource = source("src/lib/notification-events.ts");
const pushSource = source("src/lib/web-push.ts");
const migration = source("prisma/migrations/20261104140000_teacher_notification_links/migration.sql");
const installer = source("scripts/install-web-push-outbox.mjs");
const missionSource = source("src/lib/marketplace-missions.ts");
assert.match(eventSource, /link: safeTeacherNotificationLink\(event\.link\)/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS "link" TEXT/);
assert.match(migration, /NEW\."link" LIKE '\/professeur\/%'/);
assert.match(installer, /NEW\."link" LIKE '\/professeur\/%'/);
assert.match(pushSource, /topic: webPushTopicForOutbox\(item\.id\)/);
assert.match(pushSource, /teacherPushMayBeDelivered\(notification\)/);
assert.doesNotMatch(pushSource, /topic: topicFor\(item\)/);
assert.match(missionSource, /notifyNextTeacher\([\s\S]*?link: `\/professeur\/marche\/\$\{requestId\}`/);
assert.match(missionSource, /await publishWebPushFlushEvent\("outbox_created"\)/);

console.log("Marketplace V2 : lien professeur et topics push distincts vérifiés.");
