-- AlterTable: add slug as nullable first so existing rows can be backfilled
ALTER TABLE "Event" ADD COLUMN "slug" TEXT;

-- Backfill existing rows from their name (kebab-case)
UPDATE "Event"
SET "slug" = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Now enforce NOT NULL + uniqueness
ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
