-- Read-only, aggregate-only audit of the application schema.
SELECT json_build_object(
 'migrations', (SELECT json_agg(m ORDER BY migration_name) FROM (SELECT migration_name, checksum, finished_at, rolled_back_at FROM competence._prisma_migrations) m),
 'counts', json_build_object('users', (SELECT count(*) FROM competence."User"), 'teachers', (SELECT count(*) FROM competence."Teacher"), 'bookings', (SELECT count(*) FROM competence."Booking"), 'transactions', (SELECT count(*) FROM competence."Transaction")),
 'newTables', (SELECT json_agg(table_name) FROM information_schema.tables WHERE table_schema = 'competence' AND table_name IN ('ManagedCourseDossier','MarketplaceRequest','TeacherPreciseLevel')),
 'runtimePolicies', (SELECT json_agg(json_build_object('table', tablename, 'policy', policyname, 'roles', roles)) FROM pg_policies WHERE schemaname = 'competence'),
 'runtimeSchemaUsage', has_schema_privilege('competence_runtime','competence','USAGE'),
 'maintenanceRoleOptions', (SELECT json_agg(json_build_object('inherit',inherit_option,'set',set_option,'admin',admin_option,'grantor',grantor::regrole::text)) FROM pg_auth_members WHERE roleid='competence_migrator'::regrole AND member='postgres'::regrole),
 'managedSecurity', (SELECT json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity,'runtimeSelect',has_table_privilege('competence_runtime',c.oid,'SELECT'),'publicSelect',has_table_privilege('anon',c.oid,'SELECT'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='competence' AND c.relkind='r' AND c.relname LIKE 'Managed%')
) AS state;
