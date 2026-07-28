-- Least-privilege runtime access for the server-side Compétence application.
-- The LOGIN attribute and password are provisioned outside migrations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'competence_runtime'
  ) THEN
    CREATE ROLE competence_runtime NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA competence TO competence_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA competence TO competence_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA competence TO competence_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA competence TO competence_runtime;

DO $$
DECLARE
  type_record RECORD;
BEGIN
  FOR type_record IN
    SELECT namespace.nspname, type_definition.typname
    FROM pg_type AS type_definition
    JOIN pg_namespace AS namespace ON namespace.oid = type_definition.typnamespace
    WHERE namespace.nspname = 'competence'
      AND type_definition.typrelid = 0
      AND type_definition.typtype IN ('d', 'e')
  LOOP
    EXECUTE format(
      'GRANT USAGE ON TYPE %I.%I TO competence_runtime',
      type_record.nspname,
      type_record.typname
    );
  END LOOP;
END $$;

-- Apply to the role running migrations. In production that role assumes the
-- schema-owner role; in a fresh local Supabase database it is postgres.
ALTER DEFAULT PRIVILEGES IN SCHEMA competence
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO competence_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA competence
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO competence_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA competence
GRANT EXECUTE ON FUNCTIONS TO competence_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA competence
GRANT USAGE ON TYPES TO competence_runtime;

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
    policy_name := 'competence_runtime_all_' || table_record.tablename;

    EXECUTE format(
      'ALTER TABLE competence.%I ENABLE ROW LEVEL SECURITY',
      table_record.tablename
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'competence'
        AND tablename = table_record.tablename
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON competence.%I FOR ALL TO competence_runtime USING (true) WITH CHECK (true)',
        policy_name,
        table_record.tablename
      );
    END IF;
  END LOOP;
END $$;
