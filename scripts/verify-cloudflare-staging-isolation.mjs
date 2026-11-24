import { readFileSync } from "node:fs";
import ts from "typescript";
const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync("wrangler.jsonc", "utf8"));
if (parsed.error) throw new Error("Invalid Cloudflare configuration");
const production = parsed.config.env?.production;
const staging = parsed.config.env?.staging;
const origin = (environment) => environment?.hyperdrive?.find((item) => item.binding === "HYPERDRIVE")?.id;
if (!origin(staging) || origin(staging) === origin(production)) throw new Error("Staging shares the production Hyperdrive binding. Deploy is blocked: configure a separate QA database before using staging. Never seed or reset this environment.");
console.log("Distinct staging/production Hyperdrive bindings verified. Verify database origins/roles as well before write tests.");
