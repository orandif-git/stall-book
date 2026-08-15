-- CreateEnum
CREATE TYPE "MessagePurpose" AS ENUM ('OTP');

-- CreateTable
CREATE TABLE "WhatsAppSettings" (
    "id" TEXT NOT NULL,
    "bspBaseUrl" TEXT,
    "bspApiKey" TEXT,
    "bspFromPhoneNumberId" TEXT,
    "otpLength" INTEGER NOT NULL DEFAULT 6,
    "otpTtlSeconds" INTEGER NOT NULL DEFAULT 300,
    "otpMaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "otpResendCooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "purpose" "MessagePurpose" NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'en',
    "fieldBindings" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_purpose_key" ON "MessageTemplate"("purpose");
