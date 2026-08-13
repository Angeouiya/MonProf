import { readFileSync } from "node:fs";

const checks = [
  {
    file: "prisma/schema.prisma",
    patterns: [
      /model PartnerReferral/,
      /model PartnerReferralLead/,
      /enum PartnerReferralStatus/,
      /enum PartnerReferralLeadStatus/,
      /commissionRate\s+Int\s+@default\(10\)/,
      /bookingId\s+String\s+@unique/,
    ],
  },
  {
    file: "src/lib/partner-referrals.ts",
    patterns: [
      /PARTNER_REFERRAL_RATE_PERCENT\s*=\s*10/,
      /isPartnerPromotionActive/,
      /calculatePartnerReferralCommission/,
      /createPartnerReferralLead/,
      /getActivePartnerReferralLeadSource/,
      /claimPartnerReferralLeadInTransaction/,
      /buildPartnerReferralSharePath/,
      /markPartnerReferralPaymentConfirmedInTransaction/,
      /markPartnerReferralBookingConfirmedInTransaction/,
      /expirePartnerReferrals/,
    ],
  },
  {
    file: "src/app/api/bookings/route.ts",
    patterns: [
      /partnerReferralName/,
      /partnerReferralCode/,
      /buildPartnerReferralCreateData/,
      /claimPartnerReferralLeadInTransaction/,
      /tx\.partnerReferral\.create/,
    ],
  },
  {
    file: "src/app/client/reserver/page.tsx",
    patterns: [
      /getActivePartnerReferralLeadSource/,
      /initialPartnerReferral/,
      /ref\?: string/,
    ],
  },
  {
    file: "src/app/client/reserver/reserver-form.tsx",
    patterns: [
      /Quelqu’un vous a recommandé Compétence\.CI/,
      /Lien apporteur détecté/,
      /partnerReferralCode/,
      /partnerReferralName/,
      /partnerReferralPhone/,
    ],
  },
  {
    file: "src/app/professeurs/page.tsx",
    patterns: [
      /normalizePartnerReferralCode/,
      /buildTeacherProfileHref/,
      /buildBookingHref/,
      /name="ref"/,
    ],
  },
  {
    file: "src/app/professeurs/[id]/page.tsx",
    patterns: [
      /normalizePartnerReferralCode/,
      /bookingDestination = `\/client\/reserver\?teacherId=\$\{teacher\.id\}&journey=\$\{activeJourney\}`/,
      /bookingDestination = `\$\{bookingDestination\}&ref=\$\{encodeURIComponent\(referralCode\)\}`/,
      /buildTeacherJourneyHref/,
    ],
  },
  {
    file: "src/lib/jeko-reconciliation.ts",
    patterns: [
      /markPartnerReferralPaymentConfirmedInTransaction/,
      /Paiement Jèko vérifié serveur/,
    ],
  },
  {
    file: "src/app/api/admin/bookings/[id]/route.ts",
    patterns: [
      /markPartnerReferralBookingConfirmedInTransaction/,
      /status: "CONFIRMED"/,
    ],
  },
  {
    file: "src/app/admin/partenariats/page.tsx",
    patterns: [
      /Registre des commissions/,
      /Lots comptables par numéro partenaire/,
      /data-partner-referral-grouped-ledger/,
      /buildPartnerReferralGroups/,
      /Pré-déclarations apporteurs/,
      /partnerReferralLead\.findMany/,
      /Transport exclu/,
      /Frais service exclus/,
      /PartnerReferralActionsClient/,
      /PartnerReferralGroupActionsClient/,
    ],
  },
  {
    file: "src/app/api/admin/partner-referrals/groups/route.ts",
    patterns: [
      /requireAdminApi\("FINANCE_MANAGE"\)/,
      /normalizePartnerReferralPhone/,
      /status: "PAYABLE"/,
      /status: "PAID"/,
      /PartnerReferralGroup/,
      /Commission partenaire payée dans un lot/,
    ],
  },
  {
    file: "src/app/admin/partenariats/partner-referral-group-actions-client.tsx",
    patterns: [
      /Payer le lot/,
      /\/api\/admin\/partner-referrals\/groups/,
      /RestrictionNoticeDialog/,
      /Référence dépôt commune/,
    ],
  },
  {
    file: "src/app/api/partner-interest/route.ts",
    patterns: [
      /createPartnerReferralLead/,
      /buildPartnerReferralSharePath/,
      /shareUrl/,
      /Code apporteur/,
    ],
  },
  {
    file: "src/app/api/admin/partner-referrals/[id]/route.ts",
    patterns: [
      /verify_identity/,
      /mark_paid/,
      /Vérifiez d'abord le nom officiel/,
      /Commission partenaire payée/,
      /FINANCE_MANAGE/,
    ],
  },
  {
    file: "src/app/partenariat/page.tsx",
    patterns: [
      /Apportez un client\. Gagnez/,
      /Créer mon lien apporteur/,
      /lien apporteur mobile/,
      /du montant cours/,
      /déclaration faite par le client/,
      /6 mois ou 1 an/,
    ],
  },
  {
    file: "src/components/layouts/client-layout.tsx",
    patterns: [
      /data-client-partnership-link/,
      /href: "\/client\/partenariat"/,
      /label: "Partenariat"/,
      /detail: "Gagnez 10 %"/,
      /const mobileNavItems:[\s\S]*?href: "\/client\/partenariat"[\s\S]*?label: "Partenariat"/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{notificationCount\} \/>/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{notificationCount\} onNavigate=\{closeMobileSurfaces\} compactAccount \/>/,
    ],
  },
  {
    file: "src/app/client/partenariat/page.tsx",
    patterns: [
      /data-client-partnership-page/,
      /ClientPageHeader/,
      /PartnerInterestForm/,
      /Recommandez Compétence\.CI/,
      /Jèko confirme le paiement/,
      /frais techniques Jèko sont exclus/,
    ],
  },
  {
    file: "src/app/api/cron/partner-referrals/route.ts",
    patterns: [
      /CRON_SECRET/,
      /expirePartnerReferrals/,
    ],
  },
  {
    file: "vercel.json",
    patterns: [
      /\/api\/cron\/partner-referrals/,
    ],
  },
  {
    file: "src/app/conditions-utilisation/page.tsx",
    patterns: [
      /Programme partenariat et apporteurs d'affaires/,
      /pendant la réservation/,
      /lien apporteur généré/,
      /six mois ou un an/,
      /frais techniques Jèko.*exclus/s,
    ],
  },
  {
    file: "src/app/politique-confidentialite/page.tsx",
    patterns: [
      /Données partenariat/,
      /code ou lien de recommandation/,
      /commission calculée/,
      /déclarations partenariat non confirmées expirent/,
    ],
  },
  {
    file: "prisma/migrations/20260812110000_partner_referral_leads/migration.sql",
    patterns: [
      /CREATE TABLE "PartnerReferralLead"/,
      /CREATE TYPE "PartnerReferralLeadStatus"/,
      /PartnerReferralLead_code_key/,
    ],
  },
];

const failures = [];
for (const check of checks) {
  const content = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      failures.push(`${check.file} missing ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Partner referral verification passed.");
