-- Historique des avis d'un client : pagination sans balayage de tous les avis.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_clientId_createdAt_idx"
  ON "Review"("clientId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_clientId_bookingId_idx"
  ON "Review"("clientId", "bookingId");
