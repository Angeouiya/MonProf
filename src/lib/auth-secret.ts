import { randomBytes } from "crypto";

const DEV_NEXTAUTH_SECRET = "monprof-ci-dev-secret-change-me";
const UNSAFE_NEXTAUTH_SECRETS = new Set(["", "change-me", DEV_NEXTAUTH_SECRET]);
let ephemeralProductionSecret: string | null = null;

export function getNextAuthSecret() {
  const configuredSecret = process.env.NEXTAUTH_SECRET?.trim() ?? "";
  if (!UNSAFE_NEXTAUTH_SECRETS.has(configuredSecret)) return configuredSecret;

  if (process.env.NODE_ENV === "production") {
    if (!ephemeralProductionSecret) {
      ephemeralProductionSecret = randomBytes(32).toString("hex");
      console.error(
        "[security] NEXTAUTH_SECRET is missing or unsafe. Set a strong stable NEXTAUTH_SECRET in production environment variables.",
      );
    }
    return ephemeralProductionSecret;
  }

  return DEV_NEXTAUTH_SECRET;
}
