-- Read-only compatibility audit. Never return identifiers, password hashes or tokens.
SELECT json_build_object(
  'users', (SELECT json_agg(s) FROM (
    SELECT role, count(*) AS accounts,
      count(*) FILTER (WHERE "passwordHash" ~ '^\$2[aby]\$[0-9]{2}\$' AND length("passwordHash") = 60) AS bcrypt_accounts,
      count(*) FILTER (WHERE email IS NOT NULL AND email <> lower(btrim(email))) AS noncanonical_emails,
      count(*) FILTER (WHERE phone IS NOT NULL AND "phoneNormalized" IS NULL) AS phones_without_normalized_identifier,
      count(*) FILTER (WHERE "passwordMustChange") AS temporary_accounts,
      count(*) FILTER (WHERE "passwordMustChange" AND ("temporaryPasswordIssuedAt" IS NULL OR "temporaryPasswordIssuedAt" < now() - interval '24 hours')) AS expired_temporary_accounts,
      count(*) FILTER (WHERE role = 'ADMIN' AND (NOT "adminAccessEnabled" OR "adminAccountStatus" IN ('SUSPENDED', 'BLOCKED') OR "adminDeletedAt" IS NOT NULL)) AS disabled_admins
    FROM competence."User" GROUP BY role
  ) s),
  'teachers', (SELECT json_agg(s) FROM (
    SELECT status, "portalAccessEnabled" AS access_enabled, "portalPasswordMustChange" AS temporary,
      count(*) AS accounts,
      count(*) FILTER (WHERE "portalPasswordHash" ~ '^\$2[aby]\$[0-9]{2}\$' AND length("portalPasswordHash") = 60) AS bcrypt_accounts,
      count(*) FILTER (WHERE "portalPhone" IS NULL OR btrim("portalPhone") = '') AS missing_portal_phone,
      count(*) FILTER (WHERE "portalPhone" IS NOT NULL AND "portalPhone" !~ '^\+225[0-9]{10}$') AS noncanonical_portal_phones,
      count(*) FILTER (WHERE "portalPasswordMustChange" AND ("portalTemporaryPasswordIssuedAt" IS NULL OR "portalTemporaryPasswordIssuedAt" < now() - interval '24 hours')) AS expired_temporary_accounts
    FROM competence."Teacher" GROUP BY status, "portalAccessEnabled", "portalPasswordMustChange"
  ) s),
  'auth_table_locations', (SELECT json_agg(s) FROM (
    SELECT n.nspname AS schema, c.relname AS model, c.reltuples::bigint AS estimated_rows
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname IN ('User', 'Teacher') AND c.relkind = 'r'
  ) s)
) AS audit;
