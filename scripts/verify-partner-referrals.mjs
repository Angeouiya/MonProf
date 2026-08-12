import { readFileSync } from "node:fs";

const checks = [
  {
    file: "prisma/schema.prisma",
    patterns: [
      /model PartnerReferral/,
      /enum PartnerReferralStatus/,
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
      /markPartnerReferralPaymentConfirmedInTransaction/,
      /markPartnerReferralBookingConfirmedInTransaction/,
      /expirePartnerReferrals/,
    ],
  },
  {
    file: "src/app/api/bookings/route.ts",
    patterns: [
      /partnerReferralName/,
      /buildPartnerReferralCreateData/,
      /tx\.partnerReferral\.create/,
    ],
  },
  {
    file: "src/app/client/reserver/reserver-form.tsx",
    patterns: [
      /Quelqu’un vous a recommandé Compétence\.CI/,
      /partnerReferralName/,
      /partnerReferralPhone/,
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
      /Transport exclu/,
      /Frais service exclus/,
      /PartnerReferralActionsClient/,
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
      /du montant cours/,
      /déclaration faite par le client/,
      /6 mois ou 1 an/,
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
      /six mois ou un an/,
      /frais techniques Jèko.*exclus/s,
    ],
  },
  {
    file: "src/app/politique-confidentialite/page.tsx",
    patterns: [
      /Données partenariat/,
      /commission calculée/,
      /déclarations partenariat non confirmées peuvent expirer/,
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
