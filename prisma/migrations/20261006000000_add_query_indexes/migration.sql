-- Indexes for the hot query paths (tracking, dashboard, alerts).
-- Idempotent: safe to run on a database already synced with `prisma db push`.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_courierId_status_idx" ON "Delivery"("courierId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_status_deliveredAt_idx" ON "Delivery"("status", "deliveredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_merchantId_idx" ON "Delivery"("merchantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourierLocation_courierId_timestamp_idx" ON "CourierLocation"("courierId", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_courierId_resolved_type_idx" ON "Alert"("courierId", "resolved", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_resolved_createdAt_idx" ON "Alert"("resolved", "createdAt");

-- CreateIndex
-- DeliveryNotification was created with `prisma db push`, not by a migration,
-- so it may be missing on a database built from migrations alone.
DO $$
BEGIN
  IF to_regclass('"DeliveryNotification"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "DeliveryNotification_createdAt_idx" ON "DeliveryNotification"("createdAt");
  END IF;
END $$;

