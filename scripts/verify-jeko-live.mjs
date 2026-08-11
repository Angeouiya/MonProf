#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: {
    "server-only": fileURLToPath(
      new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
    ),
  },
});
const { getJekoServerConfig } = jiti("../src/lib/jeko-config.ts");
const {
  getJekoStoreBalance,
  getJekoStores,
  JekoPayoutApiError,
  resolveJekoCompetenceStoreConfig,
} = jiti("../src/lib/jeko-payout.ts");
const { assertCompetenceJekoStoreName } = jiti("../src/lib/jeko-store-identity.ts");

const REQUIRED_VARIABLES = [
  "JEKO_API_KEY",
  "JEKO_API_KEY_ID",
  "JEKO_STORE_ID",
  "JEKO_WEBHOOK_SECRET",
];

function mainHelpRequested(args) {
  if (args.length === 0) return false;
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return true;
  throw new Error("Option inconnue. Utilisez uniquement --help.");
}

async function main() {
  if (mainHelpRequested(process.argv.slice(2))) {
    console.log(
      [
        "Usage : npm run verify:jeko-live",
        "Effectue uniquement une lecture GET du solde marchand Jèko.",
        "Aucun paiement, contact, retrait ou montant n'est créé ou affiché.",
      ].join("\n"),
    );
    return;
  }

  const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Configuration Jèko incomplète. Variables manquantes : ${missing.join(", ")}.`);
  }
  const config = getJekoServerConfig();
  if (!config) {
    throw new Error(
      "La vérification Jèko live est désactivée hors Vercel Production. Exécutez-la localement sans VERCEL_ENV ou depuis Production.",
    );
  }

  const issues = [];
  const resolvedConfig = await resolveJekoCompetenceStoreConfig({ config });
  const balance = await getJekoStoreBalance({ config: resolvedConfig });
  const stores = await getJekoStores({ config: resolvedConfig });
  const configuredStore = stores.find((store) => store.id === resolvedConfig.storeId);
  if (!configuredStore) {
    issues.push("La boutique Compétence résolue n'existe pas dans les boutiques accessibles par cette clé API.");
  } else {
    try {
      assertCompetenceJekoStoreName(configuredStore.name);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "La boutique Jèko configurée est invalide.");
    }
  }
  if (
    balance.storeId !== resolvedConfig.storeId
    || balance.currency !== "XOF"
    || !Number.isFinite(balance.availableAmountCents)
    || balance.availableAmountCents < 0
  ) {
    issues.push("Jèko a renvoyé un solde marchand incohérent.");
  }
  if ((process.env.JEKO_WEBHOOK_SECRET?.trim().length ?? 0) < 24) {
    issues.push("JEKO_WEBHOOK_SECRET doit contenir au moins 24 caractères.");
  }
  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  console.log(
    "Vérification Jèko réussie : clé API, identifiant de clé, boutique Compétence et lecture XOF confirmés. Aucun mouvement d'argent effectué; solde non affiché.",
  );
}

main().catch((error) => {
  if (error instanceof JekoPayoutApiError) {
    const status = Number.isInteger(error.httpStatus) ? error.httpStatus : "inconnu";
    const code = error.code && /^[A-Z0-9_-]{1,64}$/i.test(error.code) ? error.code : "non communiqué";
    console.error(`Échec de la vérification Jèko : réponse fournisseur refusée (HTTP ${status}, code ${code}).`);
  } else {
    const message = error instanceof Error ? error.message : "Erreur interne.";
    console.error(`Échec de la vérification Jèko : ${message}`);
  }
  process.exitCode = 1;
});
