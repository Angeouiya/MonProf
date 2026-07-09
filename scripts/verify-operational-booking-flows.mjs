import fs from "node:fs";

const checks = [];

const missionRoute = read("src/app/api/mission/[token]/route.ts");
const bookingApi = read("src/app/api/bookings/[id]/route.ts");
const reschedulePolicy = read("src/lib/reschedule-policy.ts");
const rescheduleReconciliation = read("src/lib/paydunya-reschedule-reconciliation.ts");
const replacementActions = read("src/app/client/reservations/[id]/replacement-proposal-actions.tsx");
const bookingActions = read("src/app/client/reservations/[id]/actions.tsx");
const professorRescheduleRoute = read("src/app/api/professor/reschedule-requests/[id]/route.ts");
const adminTeacherPage = read("src/app/admin/professeurs/[id]/page.tsx");
const adminTeacherPayoutClient = read("src/app/admin/professeurs/[id]/teacher-payout-client.tsx");
const professorPaymentsPage = read("src/app/professeur/(espace)/paiements/page.tsx");

record(
  "Teacher unavailable response proposes an automatic replacement to the client",
  /findBestReplacementCandidate/.test(missionRoute)
    && /status:\s*"CLIENT_NOTIFIED"/.test(missionRoute)
    && /AUTO_REPLACEMENT_PROPOSED/.test(missionRoute)
    && /RESPOND_REPLACEMENT_PROPOSAL/.test(missionRoute)
    && /AUTO_REPLACEMENT_NOT_FOUND/.test(missionRoute),
);

record(
  "Client replacement response applies or rejects the operational workflow",
  /case\s+"accept_replacement_proposal"/.test(bookingApi)
    && /case\s+"reject_replacement_proposal"/.test(bookingApi)
    && /teacherId:\s*replacement\.newTeacherId/.test(bookingApi)
    && /teacherMissionLink\.create/.test(bookingApi)
    && /AUTO_REPLACEMENT_ACCEPTED/.test(bookingApi)
    && /AUTO_REPLACEMENT_REJECTED/.test(bookingApi)
    && /accept_replacement_proposal/.test(replacementActions)
    && /reject_replacement_proposal/.test(replacementActions),
);

record(
  "Client reschedule fee policy uses the approved timing windows",
  /title:\s*"Plus de 24h"[\s\S]*?feeRate:\s*0/.test(reschedulePolicy)
    && /title:\s*"Entre 24h et 6h"[\s\S]*?feeRate:\s*25[\s\S]*?teacherRate:\s*60/.test(reschedulePolicy)
    && /title:\s*"Moins de 6h"[\s\S]*?feeRate:\s*50[\s\S]*?teacherRate:\s*70/.test(reschedulePolicy)
    && /title:\s*"Cours commencé"[\s\S]*?feeRate:\s*100[\s\S]*?teacherRate:\s*70/.test(reschedulePolicy),
);

record(
  "Client sees the reschedule fee grid before sending the request",
  /data-client-reschedule-fee-grid/.test(bookingActions)
    && /Calcul automatique sur une séance de 2h/.test(bookingActions)
    && /rescheduleAcknowledged/.test(bookingActions)
    && /Payer le supplément/.test(bookingActions)
    && /Envoyer au professeur/.test(bookingActions),
);

record(
  "Paid reschedule supplements are verified before the teacher is notified",
  /status:\s*policy\.feeAmount\s*>\s*0\s*\?\s*"PAYMENT_PENDING"\s*:\s*"AWAITING_TEACHER"/.test(bookingApi)
    && /createPayDunyaRescheduleFeeInvoice/.test(bookingApi)
    && /case\s+"reschedule_fee_verify"/.test(bookingApi)
    && /reconcilePayDunyaReschedulePayment/.test(bookingApi)
    && /if\s*\(!alreadyPaid\)\s*\{[\s\S]*?createRescheduleAwaitingTeacherNotifications/.test(rescheduleReconciliation),
);

record(
  "Reschedule supplement accounting keeps teacher and platform amounts traceable",
  /feeTeacherAmount/.test(bookingApi)
    && /feePlatformAmount/.test(bookingApi)
    && /type:\s*"RESCHEDULE_FEE"/.test(rescheduleReconciliation)
    && /status:\s*"BLOCKED"/.test(rescheduleReconciliation)
    && /teacherNet:\s*request\.feeTeacherAmount/.test(rescheduleReconciliation)
    && /commission:\s*request\.feePlatformAmount/.test(rescheduleReconciliation),
);

record(
  "Accepted reschedules increase the professor accounting base",
  /teacherPayoutAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /teacherNetAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /commissionAmount:\s*\{\s*increment:\s*request\.feePlatformAmount\s*\}/.test(professorRescheduleRoute),
);

record(
  "Admin and professor ledgers expose confirmed reschedule supplements",
  /rescheduleRequests:\s*\{[\s\S]*?where:\s*\{\s*status:\s*"APPLIED"\s*\}/.test(adminTeacherPage)
    && /rescheduleSupplementTeacherAmount/.test(adminTeacherPage)
    && /Suppléments reports/.test(adminTeacherPage)
    && /supplement_report_professeur/.test(adminTeacherPayoutClient)
    && /Supplément report/.test(professorPaymentsPage),
);

record(
  "Client cannot move a course into an unsafe or already-started slot",
  /parsedReschedule\.startsAt\.getTime\(\)\s*<\s*now\.getTime\(\)\s*\+\s*2\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(bookingApi)
    && /policy\.code\s*===\s*"NO_SHOW"/.test(bookingApi)
    && /Le cours est déjà commencé ou dépassé/.test(bookingApi),
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Operational booking flow verification failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function record(label, ok) {
  checks.push({ label, ok });
}
