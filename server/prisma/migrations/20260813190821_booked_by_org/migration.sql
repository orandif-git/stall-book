-- CreateEnum
CREATE TYPE "BookedByOrg" AS ENUM ('MEC', 'CHAMBER_OF_COMMERCE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookedByOrg" "BookedByOrg" NOT NULL DEFAULT 'MEC';

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "bookedByOrg" "BookedByOrg" NOT NULL DEFAULT 'MEC';

