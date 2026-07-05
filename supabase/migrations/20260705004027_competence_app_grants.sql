-- Runtime role permissions for the Compétence application.
-- The role password is provisioned outside migrations and must never be committed.

GRANT USAGE ON SCHEMA competence TO competence_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA competence TO competence_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA competence TO competence_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA competence
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO competence_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA competence
GRANT USAGE, SELECT ON SEQUENCES TO competence_app;

DO $$
DECLARE
  table_record RECORD;
  policy_name TEXT;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'competence'
  LOOP
    policy_name := 'competence_app_all_' || table_record.tablename;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'competence'
        AND tablename = table_record.tablename
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON competence.%I FOR ALL TO competence_app USING (true) WITH CHECK (true)',
        policy_name,
        table_record.tablename
      );
    END IF;
  END LOOP;
END $$;
