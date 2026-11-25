-- Build without blocking live notification writers. Terminal deliveries stay outside this index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WebPushOutbox_active_priority_created_idx"
ON "WebPushOutbox" ((CASE "priority" WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 WHEN 'IMPORTANT' THEN 3 ELSE 4 END), "createdAt")
WHERE "status" IN ('PENDING', 'FAILED', 'PARTIAL', 'PROCESSING');
