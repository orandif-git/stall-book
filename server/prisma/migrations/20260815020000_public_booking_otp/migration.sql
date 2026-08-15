-- CreateEnum
CREATE TYPE "HoldSource" AS ENUM ('ADMIN', 'PUBLIC_REQUEST');

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "otpVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "source" "HoldSource" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cooldownUntil" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OtpVerification_phone_key" ON "OtpVerification"("phone");
