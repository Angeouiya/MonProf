-- Protect marketplace financial and mission records from direct Supabase Data
-- API access. The application continues to access them through its server-side
-- Prisma connection. No public RLS policy is created.
ALTER TABLE "MarketplaceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketplaceOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketplaceReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherWalletEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherWalletTopUp" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "MarketplaceRequest", "MarketplaceOffer", "MarketplaceReview",
  "TeacherWallet", "TeacherWalletEntry", "TeacherWalletTopUp" FROM anon, authenticated;
GRANT ALL ON TABLE "MarketplaceRequest", "MarketplaceOffer", "MarketplaceReview",
  "TeacherWallet", "TeacherWalletEntry", "TeacherWalletTopUp" TO service_role;

DO $$
DECLARE table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competence_runtime') THEN
    FOREACH table_name IN ARRAY ARRAY['MarketplaceRequest','MarketplaceOffer','MarketplaceReview','TeacherWallet','TeacherWalletEntry','TeacherWalletTopUp'] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO competence_runtime', table_name);
      EXECUTE format('CREATE POLICY competence_server_only ON %I TO competence_runtime USING (true) WITH CHECK (true)', table_name);
    END LOOP;
  END IF;
END $$;

-- The teacher filters search from subject/level/zone toward teacherId. The
-- existing composite primary keys start with teacherId and cannot serve these
-- reverse lookups efficiently at scale.
-- The join tables may already be populated in production; concurrent builds
-- avoid blocking their writes while these reverse indexes are created.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TeacherSubject_subjectId_teacherId_idx"
  ON "TeacherSubject"("subjectId", "teacherId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TeacherLevel_levelId_teacherId_idx"
  ON "TeacherLevel"("levelId", "teacherId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TeacherZone_communeId_teacherId_idx"
  ON "TeacherZone"("communeId", "teacherId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_teacherId_scheduledDate_idx"
  ON "Booking"("teacherId", "scheduledDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MarketplaceRequest_status_createdAt_id_idx"
  ON "MarketplaceRequest"("status", "createdAt", "id");
