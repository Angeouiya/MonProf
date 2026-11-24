-- Read-only inventory. No personal information or secret values are returned.
SELECT json_build_object(
  'database', current_database(),
  'version', current_setting('server_version'),
  'schema', 'competence',
  'tables', (SELECT json_agg(table_name ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'competence' AND table_type = 'BASE TABLE'),
  'runtime', (SELECT json_agg(json_build_object('role', rolname, 'bypassRls', rolbypassrls, 'superuser', rolsuper)) FROM pg_roles WHERE rolname IN ('competence_runtime','competence_migrator')),
  'migrationTable', to_regclass('competence._prisma_migrations')::text,
  'pendingModuleTables', (SELECT json_agg(table_name) FROM information_schema.tables WHERE table_schema = 'competence' AND table_name LIKE 'Managed%')
) AS inspection;
