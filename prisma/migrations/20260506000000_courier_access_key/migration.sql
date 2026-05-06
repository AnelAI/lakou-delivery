-- Add accessKey column for mobile courier login
ALTER TABLE "Courier" ADD COLUMN "accessKey" TEXT;
CREATE UNIQUE INDEX "Courier_accessKey_key" ON "Courier"("accessKey");
