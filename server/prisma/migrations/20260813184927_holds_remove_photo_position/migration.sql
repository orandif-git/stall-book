-- AlterTable
ALTER TABLE "Stall" DROP COLUMN "posXPct",
DROP COLUMN "posYPct";

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "exhibitorName" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "releaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldStall" (
    "id" TEXT NOT NULL,
    "holdId" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,

    CONSTRAINT "HoldStall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HoldStall_stallId_key" ON "HoldStall"("stallId");

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldStall" ADD CONSTRAINT "HoldStall_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldStall" ADD CONSTRAINT "HoldStall_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

