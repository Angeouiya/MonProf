-- Additive follow-up groups. Historical single lessons remain unchanged.
CREATE TABLE "MarketplaceSeries" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceSeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketplaceRequest"
    ADD COLUMN "seriesId" TEXT,
    ADD COLUMN "seriesPosition" INTEGER;

CREATE UNIQUE INDEX "MarketplaceSeries_clientId_clientKey_key" ON "MarketplaceSeries"("clientId", "clientKey");
CREATE INDEX "MarketplaceSeries_clientId_createdAt_idx" ON "MarketplaceSeries"("clientId", "createdAt");
CREATE UNIQUE INDEX "MarketplaceRequest_seriesId_seriesPosition_key" ON "MarketplaceRequest"("seriesId", "seriesPosition");
CREATE INDEX "MarketplaceRequest_seriesId_scheduledDate_idx" ON "MarketplaceRequest"("seriesId", "scheduledDate");

ALTER TABLE "MarketplaceSeries" ADD CONSTRAINT "MarketplaceSeries_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceRequest" ADD CONSTRAINT "MarketplaceRequest_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "MarketplaceSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- This table is never accessed from the browser/Data API. Prisma's table owner
-- keeps its SQL access while public API roles have no direct grant or policy.
ALTER TABLE "MarketplaceSeries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MarketplaceSeries" FROM anon, authenticated;
GRANT ALL ON TABLE "MarketplaceSeries" TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competence_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "MarketplaceSeries" TO competence_runtime;
    CREATE POLICY competence_server_only ON "MarketplaceSeries" TO competence_runtime USING (true) WITH CHECK (true);
  END IF;
END $$;
