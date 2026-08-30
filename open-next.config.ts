import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const cloudflareConfig = defineCloudflareConfig();

const openNextConfig = {
  ...cloudflareConfig,
  // Next.js 16 utilise Turbopack par défaut. Le bundle navigateur produit
  // actuellement des barrières de validation incompatibles avec OpenNext;
  // Webpack reste le chemin stable pour le Worker Cloudflare.
  buildCommand: "npm run build:next:webpack",
};

export default openNextConfig;
