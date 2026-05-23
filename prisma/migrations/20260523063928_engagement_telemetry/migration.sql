/*
  Warnings:

  - You are about to drop the `follows` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "follows" DROP CONSTRAINT "follows_authorProfileId_fkey";

-- DropForeignKey
ALTER TABLE "follows" DROP CONSTRAINT "follows_followerId_fkey";

-- AlterTable
ALTER TABLE "blog_views" ADD COLUMN     "device" VARCHAR(20),
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "sessionId" VARCHAR(64),
ADD COLUMN     "source" VARCHAR(50);

-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "readingTimeMinutes" INTEGER;

-- DropTable
DROP TABLE "follows";

-- CreateTable
CREATE TABLE "author_follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "authorProfileId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_likes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "blogId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_saves" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "blogId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_shares" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "blogId" UUID NOT NULL,
    "channel" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_read_sessions" (
    "id" UUID NOT NULL,
    "blogId" UUID NOT NULL,
    "userId" UUID,
    "sessionId" VARCHAR(64) NOT NULL,
    "maxScrollDepth" INTEGER NOT NULL DEFAULT 0,
    "readDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_read_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_engagement_counters" (
    "blogId" UUID NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_engagement_counters_pkey" PRIMARY KEY ("blogId")
);

-- CreateIndex
CREATE INDEX "idx_author_follows_author" ON "author_follows"("authorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "author_follows_followerId_authorProfileId_key" ON "author_follows"("followerId", "authorProfileId");

-- CreateIndex
CREATE INDEX "idx_tag_follows_tag" ON "tag_follows"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_follows_followerId_tagId_key" ON "tag_follows"("followerId", "tagId");

-- CreateIndex
CREATE INDEX "idx_blog_likes_blog" ON "blog_likes"("blogId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_likes_userId_blogId_key" ON "blog_likes"("userId", "blogId");

-- CreateIndex
CREATE INDEX "idx_blog_saves_blog" ON "blog_saves"("blogId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_saves_userId_blogId_key" ON "blog_saves"("userId", "blogId");

-- CreateIndex
CREATE INDEX "idx_blog_shares_blog" ON "blog_shares"("blogId");

-- CreateIndex
CREATE INDEX "idx_read_sessions_blog" ON "blog_read_sessions"("blogId");

-- CreateIndex
CREATE INDEX "idx_read_sessions_user" ON "blog_read_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_read_sessions_blogId_sessionId_key" ON "blog_read_sessions"("blogId", "sessionId");

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "author_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_saves" ADD CONSTRAINT "blog_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_saves" ADD CONSTRAINT "blog_saves_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_shares" ADD CONSTRAINT "blog_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_shares" ADD CONSTRAINT "blog_shares_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_read_sessions" ADD CONSTRAINT "blog_read_sessions_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_read_sessions" ADD CONSTRAINT "blog_read_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_engagement_counters" ADD CONSTRAINT "blog_engagement_counters_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
