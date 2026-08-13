import assert from "node:assert/strict";
import fs from "node:fs";

const reviewReputation = read("../src/lib/review-reputation.ts");
const teacherDisplayRating = read("../src/lib/teacher-display-rating.ts");
const reviewApi = read("../src/app/api/client/reviews/route.ts");
const adminAvisPage = read("../src/app/admin/avis/page.tsx");
const adminAvisClient = read("../src/app/admin/avis/client.tsx");
const adminTeachersPage = read("../src/app/admin/professeurs/page.tsx");
const adminTeacherDetail = read("../src/app/admin/professeurs/[id]/page.tsx");
const reviewActions = read("../src/components/admin/review-operational-actions-client.tsx");
const teacherCard = read("../src/components/shared/teacher-card.tsx");
const pkg = JSON.parse(read("../package.json"));

assert.match(reviewReputation, /export function detectReviewReputationRisk/);
assert.match(reviewReputation, /REVIEW_REPUTATION_COMMENT_TERMS/);
assert.match(reviewReputation, /faux professeur/);
assert.match(reviewReputation, /paiement direct/);
assert.match(reviewReputation, /cours non assuré/);
assert.match(reviewReputation, /rating <= 2/);
assert.match(reviewReputation, /rating === 3 && matchedTerms\.length > 0/);
assert.match(reviewReputation, /adminStatus: isReputationRisk \? "ESCALATED"/);
assert.match(reviewReputation, /export function getReviewReputationPrismaWhere/);

assert.match(teacherDisplayRating, /export function getTeacherDisplayRating/);
assert.match(teacherDisplayRating, /clientRating \* clientCount/);
assert.match(teacherDisplayRating, /includeAdminRating \? adminRating : 0/);
assert.match(teacherDisplayRating, /Nouveau · aucun avis/);

assert.match(reviewApi, /detectReviewReputationRisk/);
assert.match(reviewApi, /TEACHER_REPUTATION_RISK/);
assert.match(reviewApi, /Risque réputation \/ restriction/);
assert.match(reviewApi, /status: nextTeacherStatus as any/);
assert.match(reviewApi, /shouldMoveToObservation = reputationRisk\.shouldObserveTeacher/);

assert.match(adminAvisPage, /getReviewReputationPrismaWhere/);
assert.match(adminAvisPage, /Risque réputation/);
assert.match(adminAvisPage, /isOpenReputationReview/);
assert.match(adminAvisClient, /<SelectItem value="reputation">Risque réputation<\/SelectItem>/);

assert.match(adminTeachersPage, /getReviewReputationPrismaWhere/);
assert.match(adminTeachersPage, /reputationAlerts/);
assert.match(adminTeachersPage, /Risque réputation · \{reputationAlerts\}/);

assert.match(adminTeacherDetail, /data-admin-teacher-reputation-risk-card/);
assert.match(adminTeacherDetail, /Profil sous observation réputation/);
assert.match(adminTeacherDetail, /Préparer restriction/);
assert.match(adminTeacherDetail, /getTeacherDisplayRating\(teacher\)/);

assert.match(reviewActions, /Restriction/);
assert.match(reviewActions, /action=suspend/);

assert.match(teacherCard, /getTeacherDisplayRating\(teacher\)/);
assert.match(teacherCard, /data-client-teacher-card-stars/);
assert.match(teacherCard, /data-client-teacher-card-rating="scored"/);
assert.match(teacherCard, /data-client-teacher-card-rating="empty"/);

assert.equal(pkg.scripts?.["verify:review-reputation"], "node scripts/verify-review-reputation.mjs");
assert.match(pkg.scripts?.["build:quality"] ?? "", /npm run verify:review-reputation/);

console.log("Review reputation verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
