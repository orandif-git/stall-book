-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_categoryId_idx" ON "ActivityLog"("categoryId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

