import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { linkedSql } from "./lib/supabase-linked.mjs";
const [row] = await linkedSql(readFileSync("scripts/sql/managed-production-state.sql", "utf8"));
mkdirSync("output/managed-qa", { recursive: true });
writeFileSync("output/managed-qa/production-state-before.json", JSON.stringify(row.state, null, 2));
console.log(JSON.stringify({ counts: row.state.counts, newTables: row.state.newTables, migrations: row.state.migrations.map((item) => ({ name: item.migration_name, applied: Boolean(item.finished_at) })), runtimeSchemaUsage: row.state.runtimeSchemaUsage }, null, 2));
