-- Make the private application schema visible to Supabase admin/API tooling
-- without opening it to public browser roles.

GRANT USAGE ON SCHEMA competence TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA competence TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA competence TO service_role;

REVOKE ALL ON SCHEMA competence FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA competence FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA competence FROM anon, authenticated;
