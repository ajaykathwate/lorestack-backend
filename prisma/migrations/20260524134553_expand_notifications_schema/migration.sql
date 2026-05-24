/*
  Warnings:

  - Added the required column `title` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'author_followed';
ALTER TYPE "NotificationType" ADD VALUE 'company_followed';
ALTER TYPE "NotificationType" ADD VALUE 'blog_liked';
ALTER TYPE "NotificationType" ADD VALUE 'blog_saved';
ALTER TYPE "NotificationType" ADD VALUE 'blog_shared';
ALTER TYPE "NotificationType" ADD VALUE 'blog_published_fan_out';
ALTER TYPE "NotificationType" ADD VALUE 'company_invite_received';
ALTER TYPE "NotificationType" ADD VALUE 'company_invite_accepted';
ALTER TYPE "NotificationType" ADD VALUE 'company_invite_declined';
ALTER TYPE "NotificationType" ADD VALUE 'company_milestone';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actorId" UUID,
ADD COLUMN     "entityId" UUID,
ADD COLUMN     "entityType" "EntityType",
ADD COLUMN     "title" VARCHAR(100) NOT NULL;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
