-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
