import assert from "node:assert/strict";
import { getPublicAppOrigin } from "../src/lib/public-url";

const keys = [
  "APP_URL",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NODE_ENV",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

const mutableEnv: Record<string, string | undefined> = process.env;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

try {
  mutableEnv.NODE_ENV = "production";
  mutableEnv.VERCEL_ENV = "production";
  mutableEnv.VERCEL_URL = "competence-staged-abc.vercel.app";
  mutableEnv.VERCEL_PROJECT_PRODUCTION_URL = "competence-ouiya-tech.vercel.app";
  mutableEnv.NEXT_PUBLIC_APP_URL = "https://www.competence.ci";

  assert.equal(
    getPublicAppOrigin(requestFor("https://competence-staged-abc.vercel.app")),
    "https://competence-staged-abc.vercel.app",
    "un candidat Production --skip-domain doit générer le lien vers lui-même",
  );
  assert.equal(
    getPublicAppOrigin(requestFor("https://www.competence.ci")),
    "https://www.competence.ci",
    "le domaine public promu doit conserver l'origine canonique",
  );
  assert.equal(
    getPublicAppOrigin(requestFor("https://evil.example")),
    "https://www.competence.ci",
    "un Host arbitraire ne doit jamais devenir l'origine d'un lien sensible",
  );

  mutableEnv.VERCEL_ENV = "preview";
  mutableEnv.VERCEL_URL = "competence-preview-abc.vercel.app";
  assert.equal(
    getPublicAppOrigin(requestFor("https://ignored.example")),
    "https://competence-preview-abc.vercel.app",
    "un Preview doit rester isolé sur son URL Vercel",
  );

  console.log("Public URL verification passed: canonical, preview and staged Production origins.");
} finally {
  for (const key of keys) {
    const value = previous[key];
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  }
}

function requestFor(origin: string) {
  return { nextUrl: { origin } } as any;
}
