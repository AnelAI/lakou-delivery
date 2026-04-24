-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "category" TEXT,
ADD COLUMN     "deliveryDescription" TEXT,
ADD COLUMN     "locationConfirmed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "merchantId" TEXT;

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "osmId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_osmId_key" ON "Merchant"("osmId");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
