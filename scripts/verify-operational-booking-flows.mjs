import fs from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  hasVerifiedClientPayment,
  isOperationalBookingStatus,
} = jiti("../src/lib/payment-security.ts");
const {
  isReschedulableBookingSessionStatus,
  resolveBookingScheduleSummary,
  resolveRescheduleSessionTarget,
} = jiti("../src/lib/reschedule-session-target.ts");

const checks = [];

const missionRoute = read("src/app/api/mission/[token]/route.ts");
const adminDashboard = read("src/app/admin/page.tsx");
const adminStatsRoute = read("src/app/api/admin/stats/route.ts");
const bookingApi = read("src/app/api/bookings/[id]/route.ts");
const reschedulePolicy = read("src/lib/reschedule-policy.ts");
const rescheduleSessionTarget = read("src/lib/reschedule-session-target.ts");
const rescheduleReconciliation = read("src/lib/paydunya-reschedule-reconciliation.ts");
const jekoRescheduleReconciliation = read("src/lib/jeko-reschedule-reconciliation.ts");
const replacementActions = read("src/app/client/reservations/[id]/replacement-proposal-actions.tsx");
const bookingActions = read("src/app/client/reservations/[id]/actions.tsx");
const professorRescheduleRoute = read("src/app/api/professor/reschedule-requests/[id]/route.ts");
const adminTeacherPage = read("src/app/admin/professeurs/[id]/page.tsx");
const adminTeacherPayoutClient = read("src/app/admin/professeurs/[id]/teacher-payout-client.tsx");
const professorPaymentsPage = read("src/app/professeur/(espace)/paiements/page.tsx");
const professorProtectedLayout = read("src/app/professeur/(espace)/layout.tsx");
const bookingCreateApi = read("src/app/api/bookings/route.ts");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const pricingEngine = read("src/lib/pricing.ts");
const courseCatalog = read("src/lib/course-catalog.ts");
const pricingConfirmation = read("src/lib/pricing-confirmation.ts");
const oneActiveRescheduleMigration = read("prisma/migrations/20260728040000_one_active_reschedule_per_booking/migration.sql");
const refundActiveRescheduleMigration = read("prisma/migrations/20260728110000_reschedule_refund_active_guard/migration.sql");
const replacementEngine = read("src/lib/teacher-replacement-matching.ts");
const missionPolicy = read("src/lib/teacher-mission-policy.ts");
const missionActions = read("src/components/professor/mission-response-actions.tsx");
const payoutPicker = read("src/components/professor/payout-method-picker.tsx");
const payoutRequestRoute = read("src/app/api/professor/payout-requests/route.ts");
const termsPage = read("src/app/conditions-utilisation/page.tsx");
const privacyPage = read("src/app/politique-confidentialite/page.tsx");
const bookingSessions = read("src/lib/booking-sessions.ts");
const bookingSessionRoute = read("src/app/api/bookings/[id]/sessions/[sessionId]/route.ts");
const payoutRoute = read("src/app/api/admin/teacher-payouts/route.ts");
const payoutRequestReviewRoute = read("src/app/api/admin/teacher-payout-requests/[id]/route.ts");
const payoutAdjustmentRoute = read("src/app/api/admin/teacher-payment-adjustments/[id]/route.ts");
const payoutSanctionRoute = read("src/app/api/admin/teacher-sanctions/[id]/route.ts");
const payoutBalanceLock = read("src/lib/teacher-payout-reservations.ts");
const payoutReconciliation = read("src/lib/jeko-payout-reconciliation.ts");
const teacherPayments = read("src/lib/teacher-payments.ts");
const sessionLedger = read("src/components/shared/booking-session-ledger.tsx");
const jekoReconciliation = read("src/lib/jeko-reconciliation.ts");
const paydunyaReconciliation = read("src/lib/paydunya-reconciliation.ts");
const clientReservationDetail = read("src/app/client/reservations/[id]/page.tsx");
const clientReservationsPage = read("src/app/client/reservations/page.tsx");
const professorMissionDetail = read("src/app/professeur/(espace)/missions/[id]/page.tsx");
const professorMissionList = read("src/app/professeur/(espace)/missions/page.tsx");

record(
  "Every new booking receives an automatic payable amount",
  /PROFESSIONNEL_40000:[\s\S]*?amount:\s*40000/.test(pricingEngine)
    && /const unitSessionAmount\s*=\s*tier\.amount/.test(pricingEngine)
    && /priceTierLabel:\s*tier\.label/.test(pricingEngine)
    && !/Math\.max\(tier\.amount,\s*teacherPricePerSession\)/.test(pricingEngine)
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
    && /NEIGHBORHOOD_ALIASES[\s\S]*?mermoze:\s*"mermoz"/.test(pricingEngine)
    && /normalizeNeighborhood\(originQuartier,\s*teacherCommune,\s*neighborhoodAliases\)[\s\S]*?===\s*normalizeNeighborhood\(destinationQuartier,\s*clientCommune,\s*neighborhoodAliases\)/.test(pricingEngine)
    && /buildNeighborhoodAliasMap/.test(pricingEngine)
    && /neighborhoodAliases:\s*buildNeighborhoodAliasMap\([\s\S]*?neighborhoodAliasRows\.map/.test(bookingCreateApi)
    && /SAME_AREA:\s*\{[\s\S]*?key:\s*"same_area"[\s\S]*?amount:\s*1000/.test(pricingEngine)
    && /transport\.key\s*===\s*TRANSPORT_FEES\.SAME_NEIGHBORHOOD\.key[\s\S]*?transport\.key\s*===\s*TRANSPORT_FEES\.SAME_AREA\.key/.test(pricingEngine),
);

record(
  "Home transport remains pending until the client commune is selected",
  /PENDING_TRANSPORT_FEE_KEY\s*=\s*"pending_location"/.test(pricingEngine)
    && /key:\s*PENDING_TRANSPORT_FEE_KEY[\s\S]*?amount:\s*null/.test(pricingEngine)
    && /transportFeePending:\s*transport\.key\s*===\s*PENDING_TRANSPORT_FEE_KEY/.test(pricingEngine)
    && /pricing\.transportFeePending[\s\S]*?Déplacement en attente du choix de la commune/.test(bookingForm),
);

record(
  "Client and API enforce the same catalog compatibility rules",
  /export function isCourseCatalogItemCompatible/.test(courseCatalog)
    && /export function resolveBookingCourseCategory/.test(courseCatalog)
    && /const canonicalCourseCategory\s*=\s*resolveBookingCourseCategory/.test(bookingCreateApi)
    && /category:\s*canonicalCourseCategory/.test(bookingCreateApi)
    && /courseCategory:\s*canonicalCourseCategory/.test(bookingCreateApi)
    && /function handleJourneyChange\(journey:[\s\S]*?courseCategory:\s*canonicalCategory/.test(bookingForm)
    && /bookingJourney\s*&&/.test(bookingForm)
    && /isCourseCatalogItemCompatible\(\{[\s\S]*?teacherSubjects:\s*teacherSubjectNames/.test(bookingForm)
    && /isCourseCatalogItemCompatible\(\{[\s\S]*?teacher\.subjects\.map/.test(bookingCreateApi),
);

record(
  "A changed server price requires explicit confirmation before Jèko",
  /expectedPricingMatches\(expectedPricing,\s*canonicalConfirmablePricing\)/.test(bookingCreateApi)
    && /code:\s*"PRICE_CHANGED"/.test(bookingCreateApi)
    && /createPricingConfirmationFingerprint/.test(pricingConfirmation)
    && /confirmedPricingFingerprint/.test(bookingForm)
    && /Le tarif a été recalculé/.test(bookingForm),
);

record(
  "Initial payments and active reschedules cannot fan out into duplicate charges",
  /idempotencyKey:\s*`BOOKING:\$\{clientCreationKey\}`/.test(bookingCreateApi)
    && !/idempotencyKey:\s*`BOOKING:\$\{clientCreationKey\}:\$\{paymentMethod\}`/.test(bookingCreateApi)
    && /PAYMENT_PENDING[\s\S]*PAYMENT_FAILED[\s\S]*AWAITING_TEACHER/.test(bookingApi)
    && /CREATE UNIQUE INDEX[\s\S]*one_active_per_booking[\s\S]*PAYMENT_FAILED/.test(oneActiveRescheduleMigration),
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
  "New bookings always enter idempotent Jèko payment before activation",
  /isQuoteOnly:\s*false/.test(bookingCreateApi)
    && /status:\s*"PENDING_PAYMENT"/.test(bookingCreateApi)
    && /paymentStatus:\s*"FAILED"/.test(bookingCreateApi)
    && (
      /paymentProvider:\s*"JEKO"/.test(bookingCreateApi)
      || (
        /const\s+bookingPaymentProvider(?::[^=]+)?\s*=\s*"JEKO"/.test(bookingCreateApi)
        && /paymentProvider:\s*bookingPaymentProvider/.test(bookingCreateApi)
      )
    )
    && /providerPaymentStatus:\s*"PENDING"/.test(bookingCreateApi)
    && /title:\s*"Brouillon de réservation - paiement requis"/.test(bookingCreateApi)
    && /type:\s*"PAYMENT_PENDING"/.test(bookingCreateApi)
    && /createJekoBookingCheckout/.test(bookingCreateApi)
    && /idempotencyKey:\s*`BOOKING:\$\{clientCreationKey\}`/.test(bookingCreateApi)
    && /successUrl:\s*absoluteAppUrl\(`\/client\/reservations\/\$\{booking\.id\}\?jeko=return`/.test(bookingCreateApi)
    && /errorUrl:\s*absoluteAppUrl\(`\/client\/reservations\/\$\{booking\.id\}\?jeko=cancelled`/.test(bookingCreateApi)
    && !/createPayDunyaCheckoutInvoice/.test(bookingCreateApi)
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
    && /paymentProviderLabel="Jèko"/.test(bookingForm)
    && /Payer via Jèko/.test(bookingForm)
    && !/Payer via PayDunya/.test(bookingForm),
);

record(
  "Client booking opens Jèko with inline progress instead of non-critical success toasts",
  /data-booking-payment-inline-state/.test(bookingForm)
    && /setPaymentLaunchMessage\("Page Jèko prête\. Ouverture du paiement sécurisé\.\.\."\)/.test(bookingForm)
    && /setPaymentLaunchMessage\("Paiement confirmé\. Ouverture de votre réservation\.\.\."\)/.test(bookingForm)
    && !/toast\.success\("Redirection vers Jèko/.test(bookingForm)
    && !/toast\.success\("Paiement Jèko déjà confirmé/.test(bookingForm),
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
  "Client can freely remove an unpaid draft without activating a course",
  /case\s+"paydunya_checkout"/.test(bookingApi)
    && /case\s+"delete_draft"/.test(bookingApi)
    && /hasVerifiedPayDunyaClientPayment\(booking\)/.test(bookingApi)
    && /cancellationReason:\s*CLIENT_DELETED_DRAFT_REASON/.test(bookingApi)
    && /status:\s*"CANCELLED"/.test(bookingApi)
    && !/Le lien Jèko est encore actif/.test(bookingApi)
    && !/Le lien PayDunya est encore actif/.test(bookingApi)
    && /Supprimer le brouillon/.test(bookingActions)
    && /Vous pouvez supprimer un brouillon à tout moment/.test(bookingActions)
    && /draftDeleted",\s*"1"/.test(bookingActions)
    && !/toast\.success\("Brouillon supprimé\."\)/.test(bookingActions)
    && /data-client-draft-deleted-state/.test(clientReservationsPage)
    && /Aucun cours n'a été réservé et aucun professeur n'a été notifié/.test(clientReservationsPage)
    && /clientDeletedDraft[\s\S]*?REFUND_PENDING/.test(jekoReconciliation)
    && /clientDeletedDraft[\s\S]*?REFUND_PENDING/.test(paydunyaReconciliation)
    && /!alreadyPaid && !clientDeletedDraft/.test(paydunyaReconciliation),
);

record(
  "Client and professor phone numbers unlock only after verified provider payment",
  /phone:\s*paymentConfirmed\s*\?\s*bookingTeacher\.phone\s*:\s*null/.test(clientReservationDetail)
    && /paymentConfirmed\s*&&\s*booking\.teacher\.phone/.test(clientReservationDetail)
    && /hasVerifiedPayDunyaClientPayment\(booking\)/.test(clientReservationDetail)
    && /const verifiedClientPayment = hasVerifiedClientPayment\(b\)/.test(bookingCreateApi)
    && /phone:\s*verifiedClientPayment\s*\?\s*b\.teacher\.phone\s*\?\?\s*null\s*:\s*null/.test(bookingCreateApi)
    && /const teacher = booking\.teacher[\s\S]*?phone:\s*verifiedClientPayment\s*\?\s*booking\.teacher\.phone\s*\?\?\s*null\s*:\s*null/.test(bookingApi)
    && /verifiedPayDunyaBookingWhere/.test(professorMissionDetail)
    && /hasVerifiedPayDunyaClientPayment\(booking\)/.test(professorMissionDetail)
    && /bookings\.filter\(hasVerifiedPayDunyaClientPayment\)/.test(professorMissionList),
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
    && /createJekoRescheduleCheckout/.test(bookingApi)
    && /case\s+"reschedule_fee_verify"/.test(bookingApi)
    && /paymentProvider:\s*policy\.feeAmount\s*>\s*0\s*\?\s*"JEKO"\s*:\s*null/.test(bookingApi)
    && /if\s*\(request\.paymentProvider\s*!==\s*"JEKO"\)/.test(bookingApi)
    && /reconcilePayDunyaReschedulePayment/.test(bookingApi)
    && /reconcileJekoReschedulePaymentAttempt/.test(bookingApi)
    && /createRescheduleAwaitingTeacherNotifications/.test(jekoRescheduleReconciliation)
    && /status:\s*"AWAITING_TEACHER"/.test(jekoRescheduleReconciliation)
    && /if\s*\(!alreadyPaid\)\s*\{[\s\S]*?createRescheduleAwaitingTeacherNotifications/.test(rescheduleReconciliation),
);

record(
  "Any admin daily bookings KPI excludes unpaid drafts and requires exact verified funds",
  verifyAdminTodayBookingsScenarios()
    && (
      (!/todayBookingRows/.test(adminDashboard) && !/Cours du jour/.test(adminDashboard))
      || (
        /todayBookingRows[\s\S]*?where:\s*verifiedClientPaymentBookingWhere\(\{[\s\S]*?status:\s*\{\s*in:\s*\[\.\.\.OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT\]/.test(adminDashboard)
        && /const todayBookings\s*=\s*todayBookingRows\.filter\(hasVerifiedClientPayment\)\.length/.test(adminDashboard)
      )
    )
    && /todayBookingRows[\s\S]*?where:\s*verifiedClientPaymentBookingWhere\(\{[\s\S]*?status:\s*\{\s*in:\s*\[\.\.\.OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT\]/.test(adminStatsRoute)
    && /const todayBookings\s*=\s*todayBookingRows\.filter\(hasVerifiedClientPayment\)\.length/.test(adminStatsRoute),
);

record(
  "Professor mission badges require the shared strong PayDunya or Jeko payment proof",
  /b\."paydunyaStatus"\s*=\s*'COMPLETED'[\s\S]*?b\."paydunyaVerifiedAt"\s+IS NOT NULL[\s\S]*?OR\s*\([\s\S]*?b\."paymentProvider"\s*=\s*'JEKO'[\s\S]*?b\."providerPaymentStatus"\s*=\s*'SUCCESS'[\s\S]*?b\."paymentVerifiedAt"\s+IS NOT NULL/.test(professorProtectedLayout)
    && /tr\."type"\s*=\s*'CLIENT_PAYMENT'[\s\S]*?tr\."amount"\s*=\s*CASE[\s\S]*?b\."totalClientPays"\s*>\s*0[\s\S]*?THEN b\."totalClientPays"[\s\S]*?ELSE b\."totalPrice"[\s\S]*?END[\s\S]*?tr\."amount"\s*>\s*0/.test(professorProtectedLayout)
    && /ml\."bookingId"\s+IN\s*\(SELECT "id" FROM verified_bookings\)/.test(professorProtectedLayout),
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
  /bookingRescheduleRequest\.updateMany\(\{[\s\S]*?status:\s*"AWAITING_TEACHER"[\s\S]*?if\s*\(claim\.count\s*!==\s*1\)\s*return false/.test(professorRescheduleRoute)
    && /teacherPayoutAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /teacherNetAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /commissionAmount:\s*\{\s*increment:\s*request\.feePlatformAmount\s*\}/.test(professorRescheduleRoute)
    && /bookingSession\.update\(\{[\s\S]*?teacherCourseAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}[\s\S]*?releasedAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /action:\s*"RESCHEDULE_ACCEPTED"/.test(professorRescheduleRoute)
    && /syncBookingSessionAggregates/.test(professorRescheduleRoute),
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
  /12 août 2026/.test(termsPage)
    && /Résumé opposable/.test(termsPage)
    && /Paiement serveur exact obligatoire/.test(termsPage)
    && /brouillon créé avant paiement/.test(termsPage)
    && /L'acceptation peut être enregistrée/.test(termsPage)
    && /À moins de 24 heures/.test(termsPage)
    && /Même quartier exact/.test(termsPage)
    && /Aucun professeur ne peut remplacer la grille officielle/.test(termsPage)
    && /Boutique Compétence/.test(termsPage)
    && /référence, le marchand, le moyen de paiement et le montant exact/.test(termsPage)
    && /Mini-applications et systèmes enseignés/.test(termsPage)
    && /source de vérité opérationnelle/.test(termsPage)
    && /système décoché/.test(termsPage)
    && /mot de passe client doit contenir au moins 6 caractères/.test(termsPage)
    && /CP1 à CM1 15 000 FCFA/.test(termsPage)
    && /Professionnel : 40 000 FCFA/.test(termsPage)
    && /net professeur déjà validé/.test(termsPage)
    && /diplomateimmobilier99@gmail.com/.test(termsPage)
    && /Buildify, Bluidify ou une boutique inconnue/.test(termsPage)
    && /coordonnées directes du client et du professeur/.test(termsPage)
    && /loi n°2013-546/.test(termsPage)
    && /loi n°2013-450/.test(termsPage)
    && /12 août 2026/.test(privacyPage)
    && /Résumé de protection/.test(privacyPage)
    && /Compétence ne vend pas les données personnelles/.test(privacyPage)
    && /diplomateimmobilier99@gmail.com/.test(privacyPage)
    && /Données de consentement/.test(privacyPage)
    && /Données de brouillon/.test(privacyPage)
    && /Données de preuve/.test(privacyPage)
    && /Données de parcours/.test(privacyPage)
    && /systèmes enseignés/.test(privacyPage)
    && /règle minimale est de 6 caractères/.test(privacyPage)
    && /mot de passe en clair/.test(privacyPage)
    && /Boutique Compétence/.test(privacyPage)
    && /boutique tierce ou un marchand inattendu/.test(privacyPage)
    && /destination Mobile Money/.test(privacyPage)
    && /confirmation serveur du paiement/.test(privacyPage)
    && /Réinitialisation des mots de passe/.test(privacyPage)
    && /liens de réinitialisation temporaires/.test(privacyPage)
    && /trace minimale d'audit/.test(privacyPage)
    && /coordonnées entre client et professeur restent masquées/.test(privacyPage),
);

record(
  "Every pack creates one exact financial ledger row per session",
  /buildBookingSessionRows/.test(bookingCreateApi)
    && /bookingSession\.createMany/.test(bookingCreateApi)
    && /distributeAmount\(courseAmount, count\)/.test(bookingSessions)
    && /distributeAmount\(commissionAmount, count\)/.test(bookingSessions)
    && /distributeAmount\(transportFee, count\)/.test(bookingSessions),
);

record(
  "Client confirmation releases only the completed session",
  /action === "confirm"/.test(bookingSessionRoute)
    && /status: "RELEASED"/.test(bookingSessionRoute)
    && /releasedAmount: current\.teacherNetAmount/.test(bookingSessionRoute)
    && /updateSessionWithCas\(tx, current/.test(bookingSessionRoute)
    && /Chaque séance possède son planning, son professeur et son propre décompte financier/.test(sessionLedger),
);

record(
  "Partial teacher unavailability proposes and applies a session-only replacement",
  /findReplacementCandidatesForBooking\(bookingId, 3/.test(bookingSessionRoute)
    && /updateSessionWithCas\(tx, current, \{\s*status: nextStatus,\s*proposedTeacherId/.test(bookingSessionRoute)
    && /teacherId: proposedTeacherId, proposedTeacherId: null/.test(bookingSessionRoute)
    && /Les autres séances restent inchangées/.test(bookingSessionRoute),
);

record(
  "Professor payouts reserve exact session snapshots and debit only after Jèko confirmation",
  /status:\s*"DRAFT"/.test(payoutRoute)
    && /bookingSessionId:\s*allocation\.item\.session\?\.id\s*\?\?\s*null/.test(payoutRoute)
    && /paidAmountBefore: allocation\.item\.paid/.test(payoutRoute)
    && /releasedAmountSnapshot: allocation\.item\.payableAmount/.test(payoutRoute)
    && /retainedAmountSnapshot: allocation\.item\.retainedAmountAfter/.test(payoutRoute)
    && /ledger professeur ne sera débité qu'après confirmation finale/i.test(payoutRoute)
    && /if\s*\(transition\s*===\s*"finalize"\)/.test(payoutReconciliation)
    && /where:\s*\{ id: record\.id, status: "DRAFT" \}/.test(payoutReconciliation)
    && /session\.paidAmount\s*!==\s*allocation\.paidAmountBefore/.test(payoutReconciliation)
    && /session\.releasedAmount\s*!==\s*allocation\.releasedAmountSnapshot/.test(payoutReconciliation)
    && /const newPaid\s*=\s*allocation\.paidAmountBefore\s*\+\s*allocation\.amount/.test(payoutReconciliation)
    && /paidAmount:\s*newPaid/.test(payoutReconciliation)
    && /syncBookingSessionAggregates/.test(payoutReconciliation),
);

record(
  "Jèko drafts and applied retentions serialize on one teacher balance lock",
  /FROM\s+"Teacher"[\s\S]*?WHERE\s+"id"\s*=\s*\$\{teacherId\}[\s\S]*?FOR UPDATE/.test(payoutBalanceLock)
    && /lockTeacherPayoutBalance\(tx,\s*teacher\.id\)[\s\S]*?teacherPaymentAdjustment\.findMany\([\s\S]*?appliedAdjustmentFingerprint\(currentAppliedAdjustments\)[\s\S]*?teacherPayoutRecord\.create\(/.test(payoutRoute)
    && /lockTeacherPayoutBalance\(tx,\s*adjustment\.teacherId\)[\s\S]*?teacherPaymentAdjustment\.findUnique\([\s\S]*?hasActiveJekoPayoutReservationInTransaction\([\s\S]*?teacherPaymentAdjustment\.updateMany\(/.test(payoutAdjustmentRoute)
    && /lockTeacherPayoutBalance\(tx,\s*sanction\.teacherId\)[\s\S]*?teacherSanction\.findUnique\([\s\S]*?hasActiveJekoPayoutReservationInTransaction\([\s\S]*?teacherPaymentAdjustment\.(updateMany|create)\(/.test(payoutSanctionRoute)
    && /isolationLevel:\s*"Serializable"/.test(payoutRoute)
    && /isolationLevel:\s*"Serializable"/.test(payoutAdjustmentRoute)
    && /isolationLevel:\s*"Serializable"/.test(payoutSanctionRoute)
    && /code\s*===\s*"P2034"/.test(payoutAdjustmentRoute)
    && /"P2034"\]\.includes\(code\)/.test(payoutSanctionRoute),
);

record(
  "Professor payout requests use the exact released session and replacement ledger",
  /sessions:\s*\{\s*some:\s*\{\s*teacherId:\s*teacher\.id,\s*status:\s*\{\s*in:\s*\["RELEASED",\s*"PARTIALLY_PAID"\]/.test(payoutRequestRoute)
    && /sessions:\s*\{\s*none:\s*\{\}\s*\}[\s\S]*?teacherNetAmount:\s*\{\s*gt:\s*0\s*\}[\s\S]*?paymentStatus:\s*"TO_PAY_TEACHER"/.test(payoutRequestRoute)
    && /teacherId:\s*\{\s*not:\s*teacher\.id\s*\}[\s\S]*?sessions:\s*\{\s*some:\s*\{\s*teacherId:\s*teacher\.id/.test(payoutRequestRoute)
    && /sessions:\s*\{\s*where:\s*\{\s*teacherId:\s*teacher\.id\s*\}[\s\S]*?releasedAmount:\s*true[\s\S]*?paidAmount:\s*true[\s\S]*?retainedAmount:\s*true/.test(payoutRequestRoute)
    && /getTeacherFinancialSettlement\(booking, adjustments\)/.test(payoutRequestRoute),
);

record(
  "Professor payout request balance and reservation share one serializable transaction",
  /db\.\$transaction\(async\s*\(tx\)\s*=>\s*\{[\s\S]*?lockTeacherPayoutBalance\(tx,\s*teacher\.id\)[\s\S]*?tx\.teacherPayoutRequest\.aggregate\(\{[\s\S]*?tx\.teacherPayoutAllocation\.findMany\(\{[\s\S]*?tx\.teacherPayoutRequest\.create\(\{/.test(payoutRequestRoute)
    && /payout:\s*\{\s*teacherId:\s*teacher\.id,\s*status:\s*"DRAFT"\s*\}/.test(payoutRequestRoute)
    && /payoutRequestStatus:\s*allocation\.payout\.payoutRequest\?\.status\s*\?\?\s*null/.test(payoutRequestRoute)
    && /calculateTeacherPayoutAvailability\(\{/.test(payoutRequestRoute)
    && /isolationLevel:\s*"Serializable"/.test(payoutRequestRoute)
    && /const code\s*=\s*errorCode\(error\)/.test(payoutRequestRoute)
    && /\["P2034",\s*"TEACHER_PAYOUT_LOCK_NOT_FOUND"\]\.includes\(code\)[\s\S]*?PAYOUT_REQUEST_BALANCE_CONFLICT/.test(payoutRequestRoute),
);

record(
  "Admin payouts never fall back to a replaced booking-level balance",
  /_count:\s*\{\s*select:\s*\{\s*sessions:\s*true\s*\}\s*\}/.test(payoutRoute)
    && /booking\._count\.sessions\s*>\s*0[\s\S]*?if\s*\(booking\.sessions\.length\s*===\s*0\)\s*continue/.test(payoutRoute),
);

record(
  "Pending professor requests reserve the balance without blocking idempotent payout recovery",
  payoutRoute.indexOf("const existingPayout") >= 0
    && payoutRoute.indexOf("const existingPayout") < payoutRoute.indexOf("const oldestUnallocatedRequest")
    && payoutRoute.indexOf("const existing = await tx.teacherPayoutRecord.findUnique")
      < payoutRoute.indexOf("const currentOldestUnallocatedRequest")
    && /PENDING_PAYOUT_REQUEST_RESERVED/.test(payoutRoute)
    && /payoutRecordMatches\(raced/.test(payoutRoute),
);

record(
  "Payout request rejection cannot race a Jèko draft transfer",
  /teacherPayoutRequest\.updateMany\(\{[\s\S]*?status:\s*"PENDING"[\s\S]*?payoutRecordId:\s*null/.test(payoutRequestReviewRoute)
    && /claimed\.count\s*!==\s*1/.test(payoutRequestReviewRoute)
    && /isolationLevel:\s*"Serializable"/.test(payoutRequestReviewRoute)
    && /PAYOUT_REQUEST_REVIEW_CONFLICT/.test(payoutRequestReviewRoute),
);

record(
  "Global retentions are consumed once across paid and legacy history",
  /getTeacherGlobalRetentionLedger/.test(teacherPayments)
    && /rawSessionGlobal[\s\S]*?rawLegacyGlobal[\s\S]*?sessionByBooking[\s\S]*?legacyByBooking/.test(teacherPayments)
    && /bookingSession\.findMany\(\{[\s\S]*?retainedAmount:\s*\{\s*gt:\s*0/.test(payoutRequestRoute)
    && /status:\s*\{\s*in:\s*\["DRAFT",\s*"PAID"\]\s*\}/.test(payoutRequestRoute)
    && /globalRetentionLedger\.legacyByBooking\.get\(booking\.id\)/.test(payoutRoute)
    && /calculateTeacherPayoutAvailability\(\{[\s\S]*?globalRetentionLedger/.test(payoutRequestRoute)
    && /globalRetentionLedger\.legacyByBooking\.get\(settlement\.bookingId\)/.test(teacherPayments),
);

record(
  "Client reschedules atomically lock the selected eligible session and its exact ledger price",
  /const requestedSessionId\s*=\s*typeof bookingSessionId\s*===\s*"string"/.test(bookingApi)
    && /SELECT\s+"id"[\s\S]*?FROM\s+"Booking"[\s\S]*?"id"\s*=\s*\$\{booking\.id\}[\s\S]*?FOR UPDATE/.test(bookingApi)
    && /requiresVerifiedPayDunyaForOperationalAction\(lockedBooking\)/.test(bookingApi)
    && /\["PAID",\s*"PENDING_ADMIN_VALIDATION",\s*"CONFIRMED",\s*"ASSIGNED"\]\.includes\(lockedBooking\.status\)/.test(bookingApi)
    && /SELECT\s+"id"[\s\S]*?FROM\s+"BookingSession"[\s\S]*?"id"\s*=\s*\$\{requestedSessionId\}[\s\S]*?"bookingId"\s*=\s*\$\{booking\.id\}[\s\S]*?FOR UPDATE/.test(bookingApi)
    && /lockedSession\s*=\s*await tx\.bookingSession\.findUnique/.test(bookingApi)
    && /!isReschedulableBookingSessionStatus\(lockedSession\.status\)/.test(bookingApi)
    && /RESCHEDULABLE_BOOKING_SESSION_STATUSES\s*=\s*\["PLANNED",\s*"TEACHER_CONFIRMED"\]/.test(rescheduleSessionTarget)
    && /unitPrice:\s*lockedSession\.courseAmount[\s\S]*?sessionsCount:\s*1[\s\S]*?scheduledDate:\s*lockedSession\.scheduledDate[\s\S]*?scheduledTime:\s*lockedSession\.scheduledTime/.test(bookingApi)
    && /bookingSessionId:\s*lockedSession\?\.id\s*\?\?\s*null/.test(bookingApi)
    && /teacherId:\s*rescheduleTeacherId/.test(bookingApi)
    && /teacherTask\.create\(\{[\s\S]*?teacherId:\s*request\.teacherId/.test(rescheduleReconciliation)
    && /teacherNotification\.create\(\{[\s\S]*?teacherId:\s*request\.teacherId/.test(rescheduleReconciliation)
    && /isolationLevel:\s*"Serializable"/.test(bookingApi),
);

record(
  "Professor accepts by session ID with an unambiguous legacy-slot fallback",
  /bookingSession\.findMany\(\{\s*where:\s*\{\s*bookingId:\s*request\.bookingId\s*\}/.test(professorRescheduleRoute)
    && /resolveRescheduleSessionTarget\(sessions,\s*\{\s*bookingSessionId:\s*request\.bookingSessionId,\s*oldScheduledDate:\s*request\.oldScheduledDate,\s*oldScheduledTime:\s*request\.oldScheduledTime/.test(professorRescheduleRoute)
    && /if\s*\(request\.bookingSessionId\s*&&\s*!targetSession\)\s*\{\s*throw new Error\("RESCHEDULE_SESSION_LEDGER_MISSING"\)/.test(professorRescheduleRoute)
    && /sessions\.length\s*>\s*0[\s\S]*?!targetSession[\s\S]*?targetSession\.teacherId\s*!==\s*teacher\.id[\s\S]*?sessionMatchesRescheduleOrigin/.test(professorRescheduleRoute)
    && /if\s*\(input\.bookingSessionId\)[\s\S]*?sessions\.find\(\(session\)\s*=>\s*session\.id\s*===\s*input\.bookingSessionId\)[\s\S]*?return exactMatches\.length\s*===\s*1\s*\?\s*exactMatches\[0\]\s*:\s*null/.test(rescheduleSessionTarget)
    && /code\s*===\s*"RESCHEDULE_SESSION_LEDGER_MISSING"[\s\S]*?status:\s*409/.test(professorRescheduleRoute),
);

record(
  "Session targeting scenarios reject invalid IDs, terminal statuses and ambiguous legacy slots",
  verifyRescheduleSessionTargetScenarios(),
);

record(
  "A rescheduled pack keeps its earliest active session as the booking summary",
  verifyBookingScheduleSummaryScenarios()
    && /resolveBookingScheduleSummary\(sessions\.map/.test(professorRescheduleRoute)
    && /scheduledDate:\s*bookingScheduledDate[\s\S]*?startDate:\s*bookingScheduledDate[\s\S]*?scheduledTime:\s*bookingScheduledTime/.test(professorRescheduleRoute),
);

record(
  "A pending reschedule refund blocks a second paid reschedule",
  /status:\s*\{\s*in:\s*\["PAYMENT_PENDING",\s*"PAYMENT_FAILED",\s*"AWAITING_TEACHER",\s*"REFUND_REQUIRED"\]/.test(bookingApi)
    && /précédent changement de créneau doit être remboursé/.test(bookingApi)
    && /DROP INDEX "BookingRescheduleRequest_one_active_per_booking"/.test(refundActiveRescheduleMigration)
    && /CREATE UNIQUE INDEX "BookingRescheduleRequest_one_active_per_booking"/.test(refundActiveRescheduleMigration)
    && /REFUND_REQUIRED/.test(refundActiveRescheduleMigration)
    && /HAVING COUNT\(\*\) > 1/.test(refundActiveRescheduleMigration),
);

record(
  "Booking cancellation and reschedule creation serialize on the same booking lock",
  (bookingApi.match(/FROM\s+"Booking"[\s\S]*?FOR UPDATE/g) ?? []).length >= 2
    && /activeReschedule\s*=\s*await tx\.bookingRescheduleRequest\.findFirst\(\{[\s\S]*?PAYMENT_PENDING[\s\S]*?PAYMENT_FAILED[\s\S]*?AWAITING_TEACHER[\s\S]*?REFUND_REQUIRED/.test(bookingApi)
    && /purpose:\s*"RESCHEDULE_FEE"[\s\S]*?status:\s*\{\s*in:\s*\["CREATED",\s*"REQUESTING",\s*"PENDING"\]/.test(bookingApi)
    && /Terminez ou annulez d'abord la demande de changement de créneau en cours/.test(bookingApi),
);

record(
  "Accepted reschedules cannot change a balance reserved by a Jèko draft payout",
  /teacherPayoutRecord\.findFirst\(\{[\s\S]*?provider:\s*"JEKO"[\s\S]*?status:\s*"DRAFT"[\s\S]*?allocations:\s*\{\s*some:\s*\{\s*bookingId:\s*request\.bookingId/.test(professorRescheduleRoute)
    && /JEKO_PAYOUT_DRAFT_ACTIVE/.test(professorRescheduleRoute)
    && /bookingSession\.update\(\{[\s\S]*?releasedAmount:\s*\{\s*increment:\s*request\.feeTeacherAmount\s*\}/.test(professorRescheduleRoute)
    && /isolationLevel:\s*"Serializable"/.test(professorRescheduleRoute)
    && /code\s*===\s*"P2034"[\s\S]*?RESCHEDULE_PAYOUT_CONFLICT/.test(professorRescheduleRoute),
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

function verifyAdminTodayBookingsScenarios() {
  const verifiedOperationalBooking = {
    status: "CONFIRMED",
    paymentStatus: "BLOCKED",
    totalClientPays: 20_000,
    totalPrice: 20_000,
    paymentProvider: "JEKO",
    providerPaymentStatus: "SUCCESS",
    paymentVerifiedAt: new Date("2026-07-29T10:00:00.000Z"),
    transactions: [{ type: "CLIENT_PAYMENT", status: "BLOCKED", amount: 20_000 }],
  };
  const candidates = [
    verifiedOperationalBooking,
    {
      ...verifiedOperationalBooking,
      status: "PENDING_PAYMENT",
      paymentStatus: "FAILED",
      providerPaymentStatus: "PENDING",
      paymentVerifiedAt: null,
      transactions: [],
    },
    {
      ...verifiedOperationalBooking,
      transactions: [{ type: "CLIENT_PAYMENT", status: "BLOCKED", amount: 19_999 }],
    },
    {
      ...verifiedOperationalBooking,
      status: "CANCELLED",
    },
    {
      ...verifiedOperationalBooking,
      transactions: [],
    },
  ];

  return candidates.filter((booking) => (
    isOperationalBookingStatus(booking.status)
    && hasVerifiedClientPayment(booking)
  )).length === 1;
}

function verifyRescheduleSessionTargetScenarios() {
  const oldDate = new Date("2026-08-02T00:00:00.000Z");
  const original = {
    id: "session-original",
    teacherId: "teacher-original",
    status: "PLANNED",
    scheduledDate: oldDate,
    scheduledTime: "10h-12h",
  };
  const replacement = {
    ...original,
    id: "session-replacement",
    teacherId: "teacher-replacement",
  };
  const duplicatedSlot = [original, replacement];

  const selectedById = resolveRescheduleSessionTarget(duplicatedSlot, {
    bookingSessionId: replacement.id,
    oldScheduledDate: oldDate,
    oldScheduledTime: original.scheduledTime,
  });
  const invalidId = resolveRescheduleSessionTarget([original], {
    bookingSessionId: "session-from-another-booking",
    oldScheduledDate: oldDate,
    oldScheduledTime: original.scheduledTime,
  });
  const uniqueLegacy = resolveRescheduleSessionTarget([original], {
    bookingSessionId: null,
    oldScheduledDate: oldDate,
    oldScheduledTime: original.scheduledTime,
  });
  const ambiguousLegacy = resolveRescheduleSessionTarget(duplicatedSlot, {
    bookingSessionId: null,
    oldScheduledDate: oldDate,
    oldScheduledTime: original.scheduledTime,
  });
  const missingLegacy = resolveRescheduleSessionTarget([original], {
    bookingSessionId: null,
    oldScheduledDate: new Date("2026-08-03T00:00:00.000Z"),
    oldScheduledTime: original.scheduledTime,
  });
  const terminalLegacy = resolveRescheduleSessionTarget([{ ...original, status: "RELEASED" }], {
    bookingSessionId: null,
    oldScheduledDate: oldDate,
    oldScheduledTime: original.scheduledTime,
  });

  return selectedById?.id === replacement.id
    && selectedById.teacherId === replacement.teacherId
    && invalidId === null
    && uniqueLegacy?.id === original.id
    && ambiguousLegacy === null
    && missingLegacy === null
    && terminalLegacy === null
    && isReschedulableBookingSessionStatus("PLANNED")
    && isReschedulableBookingSessionStatus("TEACHER_CONFIRMED")
    && !isReschedulableBookingSessionStatus("IN_PROGRESS")
    && !isReschedulableBookingSessionStatus("RELEASED")
    && !isReschedulableBookingSessionStatus("PARTIALLY_PAID")
    && !isReschedulableBookingSessionStatus("PAID")
    && !isReschedulableBookingSessionStatus("DISPUTED");
}

function verifyBookingScheduleSummaryScenarios() {
  const first = {
    id: "session-1",
    sequence: 1,
    status: "PLANNED",
    scheduledDate: new Date("2026-08-02T00:00:00.000Z"),
    scheduledTime: "10h-12h",
  };
  const second = {
    id: "session-2",
    sequence: 2,
    status: "TEACHER_CONFIRMED",
    scheduledDate: new Date("2026-08-09T00:00:00.000Z"),
    scheduledTime: "08h-10h",
  };

  const laterSessionMovedLater = resolveBookingScheduleSummary([
    first,
    { ...second, scheduledDate: new Date("2026-08-16T00:00:00.000Z") },
  ]);
  const firstSessionMovedAfterSecond = resolveBookingScheduleSummary([
    { ...first, scheduledDate: new Date("2026-08-20T00:00:00.000Z") },
    second,
  ]);
  const cancelledEarlierSession = resolveBookingScheduleSummary([
    { ...first, status: "CANCELLED", scheduledDate: new Date("2026-08-01T00:00:00.000Z") },
    second,
  ]);
  const paidEarlierSession = resolveBookingScheduleSummary([
    { ...first, status: "PAID", scheduledDate: new Date("2026-08-01T00:00:00.000Z") },
    second,
  ]);

  return laterSessionMovedLater?.bookingSessionId === first.id
    && firstSessionMovedAfterSecond?.bookingSessionId === second.id
    && cancelledEarlierSession?.bookingSessionId === second.id
    && paidEarlierSession?.bookingSessionId === second.id;
}
