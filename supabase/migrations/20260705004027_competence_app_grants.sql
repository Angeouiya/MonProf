-- Runtime role permissions for the Compétence application.
-- The role password is provisioned outside migrations and must never be committed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'competence_app'
  ) THEN
    CREATE ROLE competence_app NOLOGIN;
  END IF;
END $$;

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
    SELECT tablename, tableowner
    FROM pg_tables
    WHERE schemaname = 'competence'
  LOOP
    policy_name := 'competence_app_all_' || table_record.tablename;

    IF table_record.tableowner = current_user AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'competence'
          AND tablename = table_record.tablename
          AND policyname = policy_name
      ) THEN
      EXECUTE format(
        'ALTER TABLE competence.%I ENABLE ROW LEVEL SECURITY',
        table_record.tablename
      );

      EXECUTE format(
        'CREATE POLICY %I ON competence.%I FOR ALL TO competence_app USING (true) WITH CHECK (true)',
        policy_name,
        table_record.tablename
      );
    ELSIF table_record.tableowner <> current_user THEN
      RAISE NOTICE 'Skipping RLS policy for competence.% because owner is %, current user is %',
        table_record.tablename,
        table_record.tableowner,
        current_user;
    END IF;
  END LOOP;
END $$;
