-- La route Cadeaux recommence automatiquement après chaque série de sept paiements.
UPDATE "Setting"
SET "value" = 'true'
WHERE "key" = 'loyalty_gifts_cycle_enabled'
  AND "value" = 'false';
