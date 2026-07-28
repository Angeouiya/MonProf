import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const BASELINE_MIGRATION = "20260727000000_baseline";
const baselineSqlPath = path.resolve("prisma", "migrations", BASELINE_MIGRATION, "migration.sql");
const baselineSql = fs.readFileSync(baselineSqlPath, "utf8");
const baselineFingerprint = parseBaselineFingerprint(baselineSql);

if (!process.env.DATABASE_URL?.trim()) {
  console.error("FAIL DATABASE_URL is required before deploying Prisma migrations.");
  process.exit(1);
}

const db = new PrismaClient();

try {
  const rows = await db.$queryRaw`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = current_schema()
  `;
  const tables = new Set(rows.map((row) => row.tableName));

  if (tables.has("_prisma_migrations")) {
    const appliedRows = await db.$queryRaw`
      SELECT migration_name AS "migrationName"
      FROM "_prisma_migrations"
      WHERE migration_name = ${BASELINE_MIGRATION}
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `;
    if (appliedRows.length > 0) {
      console.log(`OK Prisma baseline ${BASELINE_MIGRATION} is already recorded.`);
      process.exit(0);
    }
  }

  const existingBaselineTables = baselineFingerprint.tables.filter((table) => tables.has(table));
  if (existingBaselineTables.length === 0) {
    console.log("OK Empty database detected; Prisma will execute the baseline migration.");
    process.exit(0);
  }

  const fingerprintErrors = await inspectBaselineFingerprint(db, baselineFingerprint);
  if (fingerprintErrors.length > 0) {
    console.error("FAIL Refusing to mark the Prisma baseline on an incomplete or incompatible schema.");
    for (const error of fingerprintErrors.slice(0, 40)) console.error(` - ${error}`);
    if (fingerprintErrors.length > 40) {
      console.error(` - ... ${fingerprintErrors.length - 40} additional mismatch(es).`);
    }
    process.exit(1);
  }
} finally {
  await db.$disconnect();
}

console.log(
  `Existing Compétence schema detected; recording ${BASELINE_MIGRATION} without replaying its CREATE statements.`,
);

const require = createRequire(import.meta.url);
const prismaPackagePath = require.resolve("prisma/package.json");
const prismaCliPath = path.join(path.dirname(prismaPackagePath), "build", "index.js");
const result = spawnSync(
  process.execPath,
  [prismaCliPath, "migrate", "resolve", "--applied", BASELINE_MIGRATION],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`FAIL Unable to record the Prisma baseline: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`OK Prisma baseline ${BASELINE_MIGRATION} recorded safely.`);

function parseBaselineFingerprint(sql) {
  const tables = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]);
  const columns = [];
  for (const match of sql.matchAll(/CREATE TABLE "([^"]+)" \(\r?\n([\s\S]*?)\r?\n\);/g)) {
    const tableName = match[1];
    for (const line of match[2].split(/\r?\n/)) {
      const column = line.match(/^\s{4}"([^"]+)"\s+(.+?)(?:,)?$/);
      if (!column) continue;
      const definition = column[2].replace(/,$/, "");
      const quotedType = definition.match(/^"([^"]+)"/);
      const sqlType = quotedType?.[1] ?? definition.match(/^(DOUBLE PRECISION|TIMESTAMP\(\d+\)|DECIMAL\([^)]*\)|\S+)/)?.[1];
      if (!sqlType) throw new Error(`Unable to parse ${tableName}.${column[1]} from the Prisma baseline.`);
      columns.push({
        tableName,
        columnName: column[1],
        udtName: postgresUdtName(sqlType, Boolean(quotedType)),
        nullable: !/\bNOT NULL\b/.test(definition),
      });
    }
  }

  const enums = new Map();
  for (const match of sql.matchAll(/CREATE TYPE "([^"]+)" AS ENUM \(([^;]+)\);/g)) {
    enums.set(match[1], [...match[2].matchAll(/'((?:''|[^'])*)'/g)].map((item) => item[1].replace(/''/g, "'")));
  }

  const indexes = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map((match) => match[1]);
  const constraints = [...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map((match) => match[1]);
  if (tables.length === 0 || columns.length === 0 || enums.size === 0 || indexes.length === 0 || constraints.length === 0) {
    throw new Error("The Prisma baseline fingerprint could not be parsed completely.");
  }
  return { tables, columns, enums, indexes, constraints };
}

async function inspectBaselineFingerprint(prisma, expected) {
  const [columnRows, indexRows, constraintRows, enumRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT table_name AS "tableName", column_name AS "columnName",
             udt_name AS "udtName", is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `,
    prisma.$queryRaw`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `,
    prisma.$queryRaw`
      SELECT constraint_name AS "constraintName"
      FROM information_schema.table_constraints
      WHERE constraint_schema = current_schema()
    `,
    prisma.$queryRaw`
      SELECT type.typname AS "typeName", enum.enumlabel AS "label"
      FROM pg_type type
      JOIN pg_enum enum ON enum.enumtypid = type.oid
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = current_schema()
      ORDER BY type.typname, enum.enumsortorder
    `,
  ]);

  const errors = [];
  const actualColumns = new Map(columnRows.map((column) => [
    `${column.tableName}.${column.columnName}`,
    column,
  ]));
  for (const column of expected.columns) {
    const actual = actualColumns.get(`${column.tableName}.${column.columnName}`);
    if (!actual) {
      errors.push(`missing column ${column.tableName}.${column.columnName}`);
      continue;
    }
    if (actual.udtName !== column.udtName) {
      errors.push(
        `type mismatch on ${column.tableName}.${column.columnName}: expected ${column.udtName}, found ${actual.udtName}`,
      );
    }
    const actualNullable = actual.isNullable === "YES";
    if (actualNullable !== column.nullable) {
      errors.push(
        `nullability mismatch on ${column.tableName}.${column.columnName}: expected ${column.nullable ? "nullable" : "required"}`,
      );
    }
  }

  const actualIndexes = new Set(indexRows.map((index) => index.indexName));
  for (const index of expected.indexes) {
    if (!actualIndexes.has(index)) errors.push(`missing index ${index}`);
  }

  const actualConstraints = new Set(constraintRows.map((constraint) => constraint.constraintName));
  for (const constraint of expected.constraints) {
    if (!actualConstraints.has(constraint)) errors.push(`missing constraint ${constraint}`);
  }

  const actualEnums = new Map();
  for (const row of enumRows) {
    const values = actualEnums.get(row.typeName) ?? [];
    values.push(row.label);
    actualEnums.set(row.typeName, values);
  }
  for (const [name, values] of expected.enums) {
    const actualValues = actualEnums.get(name) ?? [];
    for (const value of values) {
      if (!actualValues.includes(value)) errors.push(`missing enum value ${name}.${value}`);
    }
  }

  return errors;
}

function postgresUdtName(sqlType, quoted) {
  if (quoted) return sqlType;
  if (sqlType.endsWith("[]")) return `_${postgresUdtName(sqlType.slice(0, -2), false)}`;
  if (/^TIMESTAMP\(/.test(sqlType)) return "timestamp";
  if (/^DECIMAL\(/.test(sqlType)) return "numeric";
  return {
    BIGINT: "int8",
    BOOLEAN: "bool",
    BYTEA: "bytea",
    "DOUBLE PRECISION": "float8",
    INTEGER: "int4",
    JSONB: "jsonb",
    TEXT: "text",
    UUID: "uuid",
  }[sqlType] ?? sqlType.toLowerCase();
}
