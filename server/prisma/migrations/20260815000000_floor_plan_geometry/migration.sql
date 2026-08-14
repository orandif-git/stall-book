-- CreateEnum
CREATE TYPE "DecorKind" AS ENUM ('WALL', 'AISLE', 'STAIRS', 'LABEL', 'ARROW');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "canvasHeight" DOUBLE PRECISION NOT NULL DEFAULT 850,
ADD COLUMN     "canvasWidth" DOUBLE PRECISION NOT NULL DEFAULT 1500;

-- AlterTable
ALTER TABLE "Stall" ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "posX" DOUBLE PRECISION,
ADD COLUMN     "posY" DOUBLE PRECISION,
ADD COLUMN     "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "width" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "FloorPlanDecor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "DecorKind" NOT NULL,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "text" TEXT,
    "points" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],

    CONSTRAINT "FloorPlanDecor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FloorPlanDecor_eventId_idx" ON "FloorPlanDecor"("eventId");

-- AddForeignKey
ALTER TABLE "FloorPlanDecor" ADD CONSTRAINT "FloorPlanDecor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
