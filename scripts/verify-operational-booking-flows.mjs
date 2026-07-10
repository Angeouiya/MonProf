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
const bookingCreateApi = read("src/app/api/bookings/route.ts");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const pricingEngine = read("src/lib/pricing.ts");
const replacementEngine = read("src/lib/teacher-replacement-matching.ts");
const missionPolicy = read("src/lib/teacher-mission-policy.ts");
const missionActions = read("src/components/professor/mission-response-actions.tsx");
const payoutPicker = read("src/components/professor/payout-method-picker.tsx");
const payoutRequestRoute = read("src/app/api/professor/payout-requests/route.ts");
const termsPage = read("src/app/conditions-utilisation/page.tsx");
const privacyPage = read("src/app/politique-confidentialite/page.tsx");

record(
  "Every new booking receives an automatic payable amount",
  /SUR_DEVIS:[\s\S]*?amount:\s*25000/.test(pricingEngine)
    && /const unitSessionAmount\s*=\s*teacherPricePerSession\s*>\s*0\s*\?\s*teacherPricePerSession\s*:\s*tier\.amount/.test(pricingEngine)
    && /isQuoteOnly:\s*false/.test(pricingEngine)
    && !/if\s*\(isQuoteOnly\)/.test(pricingEngine),
);

record(
  "Online bookings never include a transport fee",
  /ONLINE:\s*\{[\s\S]*?key:\s*"online"[\s\S]*?amount:\s*0/.test(pricingEngine)
    && /input\.deliveryMode\s*!==\s*"domicile"[\s\S]*?key:\s*TRANSPORT_FEES\.ONLINE\.key[\s\S]*?amount:\s*TRANSPORT_FEES\.ONLINE\.amount/.test(pricingEngine),
);

record(
  "Exact same-neighborhood home lessons have no transport fee",
  /SAME_NEIGHBORHOOD:\s*\{[\s\S]*?key:\s*"same_neighborhood"[\s\S]*?amount:\s*0/.test(pricingEngine)
    && /sameKnownQuartier[\s\S]*?key:\s*TRANSPORT_FEES\.SAME_NEIGHBORHOOD\.key[\s\S]*?amount:\s*TRANSPORT_FEES\.SAME_NEIGHBORHOOD\.amount/.test(pricingEngine)
    && /SAME_AREA:\s*\{[\s\S]*?key:\s*"same_area"[\s\S]*?amount:\s*1000/.test(pricingEngine),
);

record(
  "Professor explicitly chooses and persists one of four payout methods",
  /data-professor-payout-method-picker/.test(payoutPicker)
    && /role="radiogroup"/.test(payoutPicker)
    && /activePaymentMethodOptions\.map/.test(payoutPicker)
    && /defaultPayoutMethod:\s*method/.test(payoutRequestRoute)
    && /defaultPayoutPhone:\s*paymentPhone/.test(payoutRequestRoute),
);

record(
  "New bookings always enter PayDunya payment before activation",
  /isQuoteOnly:\s*false/.test(bookingCreateApi)
    && /status:\s*"PENDING_PAYMENT"/.test(bookingCreateApi)
    && /title:\s*"Brouillon de réservation - paiement requis"/.test(bookingCreateApi)
    && /type:\s*"PAYMENT_PENDING"/.test(bookingCreateApi)
    && /createPayDunyaCheckoutInvoice/.test(bookingCreateApi)
    && !/pricing\.isQuoteOnly/.test(bookingCreateApi)
    && !/booking\.isQuoteOnly/.test(bookingCreateApi)
    && !/QUOTE_REQUESTED/.test(bookingCreateApi),
);

record(
  "Client booking has no manual quote fallback",
  !/pricing\.isQuoteOnly/.test(bookingForm)
    && !/optionPricing\.isQuoteOnly/.test(bookingForm)
    && !/Validation service client requise/.test(bookingForm)
    && !/Envoyer au service client/.test(bookingForm)
    && !/Montant à recalculer/.test(bookingForm)
    && /Payer via PayDunya/.test(bookingForm),
);

record(
  "Teacher unavailable response proposes an automatic replacement to the client",
  /findBestReplacementCandidate/.test(missionRoute)
    && /status:\s*"CLIENT_NOTIFIED"/.test(missionRoute)
    && /AUTO_REPLACEMENT_PROPOSED/.test(missionRoute)
    && /RESPOND_REPLACEMENT_PROPOSAL/.test(missionRoute)
    && /AUTO_REPLACEMENT_NOT_FOUND/.test(missionRoute),
);

record(
  "Teacher unavailability inside 24h prioritizes rescheduling and urgent automatic replacement",
  /TEACHER_UNAVAILABILITY_NOTICE_HOURS\s*=\s*24/.test(missionPolicy)
    && /within24Hours/.test(missionPolicy)
    && /À moins de 24h/.test(missionActions)
    && /Signaler une urgence/.test(missionActions)
    && /getTeacherMissionTiming/.test(missionRoute)
    && /urgentUnavailability/.test(missionRoute)
    && /findBestReplacementCandidate/.test(missionRoute),
);

record(
  "Automatic replacement checks the exact requested time when available",
  /slotKeyFromTime\(booking\.scheduledTime\s*\|\|\s*booking\.preferredTime\)/.test(replacementEngine)
    && /sameSubject/.test(replacementEngine)
    && /sameLevel/.test(replacementEngine)
    && /!item\.compatibility\.activeConflict/.test(replacementEngine)
    && /item\.compatibility\.recentDisputeCount\s*===\s*0/.test(replacementEngine),
);

record(
  "Client can resume or safely delete an unpaid draft",
  /case\s+"paydunya_checkout"/.test(bookingApi)
    && /case\s+"delete_draft"/.test(bookingApi)
    && /hasVerifiedPayDunyaClientPayment\(booking\)/.test(bookingApi)
    && /source:\s*"client_draft_delete"/.test(bookingApi)
    && /terminalPayDunyaStatuses/.test(bookingApi)
    && /Object\.values\(protectedRelations\._count\)\.some/.test(bookingApi)
    && /Supprimer le brouillon/.test(bookingActions)
    && /Payer via PayDunya/.test(bookingActions),
);

record(
  "Client replacement response applies or cancels the operational workflow",
  /case\s+"accept_replacement_proposal"/.test(bookingApi)
    && /case\s+"reject_replacement_proposal"/.test(bookingApi)
    && /case\s+"cancel_after_teacher_unavailable"/.test(bookingApi)
    && /teacherId:\s*replacement\.newTeacherId/.test(bookingApi)
    && /teacherMissionLink\.create/.test(bookingApi)
    && /AUTO_REPLACEMENT_ACCEPTED/.test(bookingApi)
    && /accept_replacement_proposal/.test(replacementActions)
    && /cancel_after_teacher_unavailable/.test(replacementActions)
    && /Annuler sans pénalité/.test(replacementActions),
);

record(
  "Teacher-caused cancellation never charges a client penalty",
  /replacement\.reason\s*!==\s*"UNAVAILABLE"/.test(bookingApi)
    && /getCancellationPolicy\([\s\S]*?now,\s*"TEACHER"\)/.test(bookingApi)
    && /cancellationFeeRate:\s*0/.test(bookingApi)
    && /cancellationFeeAmount:\s*0/.test(bookingApi)
    && /cancellationPenaltyTeacherAmount:\s*0/.test(bookingApi)
    && /cancellationPenaltyPlatformAmount:\s*0/.test(bookingApi)
    && /cancellationRefundAmount:\s*policy\.refundAmount/.test(bookingApi)
    && /Aucun supplément ne vous sera demandé/.test(missionRoute)
    && !/Montant professeur ajusté/.test(missionRoute)
    && !/Impact comptable/.test(replacementActions),
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

record(
  "Legal documents describe the current payout, draft, replacement and transport rules",
  /10 juillet 2026/.test(termsPage)
    && /brouillon créé avant paiement/.test(termsPage)
    && /À moins de 24 heures/.test(termsPage)
    && /Même quartier exact/.test(termsPage)
    && /10 juillet 2026/.test(privacyPage)
    && /Données de brouillon/.test(privacyPage)
    && /moyen Mobile Money préféré/.test(privacyPage),
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
