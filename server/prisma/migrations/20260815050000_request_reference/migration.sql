-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "EventRequestCounter" (
    "eventId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventRequestCounter_pkey" PRIMARY KEY ("eventId")
);

-- AddForeignKey
ALTER TABLE "EventRequestCounter" ADD CONSTRAINT "EventRequestCounter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
