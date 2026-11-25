-- Metadata-only hardening. No application row, password or accounting record changes.
ALTER FUNCTION competence.managed_accounting_append_only() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.managed_commission_snapshot_immutable() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.enqueue_web_push_notification() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.enqueue_teacher_web_push_notification() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.managed_partner_budget_guard() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.managed_partner_snapshot_guard() SET search_path = pg_catalog, competence;
ALTER FUNCTION competence.managed_parent_confirmation_guard() SET search_path = pg_catalog, competence;

-- These are internal trigger functions, never browser-callable RPC endpoints.
-- Keep SECURITY DEFINER only where the notification outbox requires its existing owner.
DO $hardening$
DECLARE fn text; role_name text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'managed_accounting_append_only', 'managed_commission_snapshot_immutable',
    'enqueue_web_push_notification', 'enqueue_teacher_web_push_notification',
    'managed_partner_budget_guard', 'managed_partner_snapshot_guard', 'managed_parent_confirmation_guard'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION competence.%I() FROM PUBLIC', fn);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION competence.%I() FROM %I', fn, role_name);
      END IF;
    END LOOP;
    FOREACH role_name IN ARRAY ARRAY['competence_runtime', 'competence_app', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION competence.%I() TO %I', fn, role_name);
      END IF;
    END LOOP;
  END LOOP;
END;
$hardening$;
