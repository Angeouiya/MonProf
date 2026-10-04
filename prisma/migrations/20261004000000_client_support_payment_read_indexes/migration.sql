-- Lecture des pages connectées Aide/Paiements sans balayage global.
-- CONCURRENTLY évite un verrou d'écriture prolongé sur les tables actives.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Booking_clientId_status_createdAt_idx"
  ON "Booking"("clientId", "status", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Transaction_bookingId_type_status_amount_idx"
  ON "Transaction"("bookingId", "type", "status", "amount");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Dispute_openedById_createdAt_idx"
  ON "Dispute"("openedById", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Dispute_openedById_status_idx"
  ON "Dispute"("openedById", "status");
