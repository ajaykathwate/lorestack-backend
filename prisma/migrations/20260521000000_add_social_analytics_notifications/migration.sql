-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('user', 'platform_admin');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('draft', 'published', 'scheduled', 'archived', 'publish_failed');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('engineering_blog', 'architecture_deep_dive', 'case_study', 'scaling_story', 'failure_postmortem', 'ai_experiment', 'founder_note', 'tutorial', 'opinion_essay', 'project_showcase', 'open_source_release', 'other');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('owner', 'author');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('launch', 'user_milestone', 'infra_update', 'funding', 'feature_release', 'bug_fixed', 'partnership', 'hiring', 'experiment', 'other');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('ai', 'saas', 'dev_tools', 'fintech', 'health_tech', 'ed_tech', 'consumer', 'other');

-- CreateEnum
CREATE TYPE "CompanyStage" AS ENUM ('idea', 'mvp_stage', 'early_stage', 'growth', 'scale');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('blog', 'company', 'author', 'tag');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('follow', 'company_invite', 'blog_published');

-- DropIndex
DROP INDEX "login_attempts_identifierHash_ipAddress_key";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable
ALTER TABLE "auth_audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "email_verification_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "login_attempts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerifiedAt",
DROP COLUMN "updatedAt",
DROP COLUMN "username",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(320),
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "author_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "bio" VARCHAR(300),
    "avatarUrl" TEXT,
    "expertiseTags" TEXT[],
    "twitterHandle" VARCHAR(100),
    "linkedinUrl" TEXT,
    "githubHandle" VARCHAR(100),
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "handle" VARCHAR(50) NOT NULL,
    "tagline" VARCHAR(160) NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "industry" "IndustryType",
    "stage" "CompanyStage",
    "techStack" TEXT[],
    "founderSocialLink" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_invites" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "invitedEmail" VARCHAR(320) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "company_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blogs" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "companyId" UUID,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "summary" VARCHAR(300),
    "coverImageUrl" TEXT,
    "ogImageUrl" TEXT NOT NULL,
    "articleType" "ArticleType" NOT NULL,
    "status" "BlogStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "scheduledTimezone" VARCHAR(100),
    "seoTitleOverride" VARCHAR(60),
    "seoDescOverride" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "blogId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("blogId","tagId")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "description" TEXT,
    "blogCount" INTEGER NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_milestones" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "headline" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "impactMetric" VARCHAR(80),
    "milestoneDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_metadata" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "metaTitle" VARCHAR(60) NOT NULL,
    "metaDescription" VARCHAR(160) NOT NULL,
    "ogImageUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "schemaJson" TEXT NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_redirects" (
    "id" UUID NOT NULL,
    "fromSlug" VARCHAR(200) NOT NULL,
    "toSlug" VARCHAR(200) NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "authorProfileId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_views" (
    "id" UUID NOT NULL,
    "blogId" UUID NOT NULL,
    "viewerId" UUID,
    "ipHash" VARCHAR(64),
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" VARCHAR(300) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_userId_key" ON "author_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_username_key" ON "author_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "companies_handle_key" ON "companies"("handle");

-- CreateIndex
CREATE INDEX "companies_handle_idx" ON "companies"("handle");

-- CreateIndex
CREATE INDEX "companies_featured_idx" ON "companies"("featured");

-- CreateIndex
CREATE INDEX "idx_company_memberships_company" ON "company_memberships"("companyId");

-- CreateIndex
CREATE INDEX "idx_company_memberships_user" ON "company_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_companyId_userId_key" ON "company_memberships"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_invites_token_key" ON "company_invites"("token");

-- CreateIndex
CREATE INDEX "idx_company_invites_company" ON "company_invites"("companyId");

-- CreateIndex
CREATE INDEX "idx_company_invites_token" ON "company_invites"("token");

-- CreateIndex
CREATE INDEX "idx_company_invites_company_email" ON "company_invites"("companyId", "invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");

-- CreateIndex
CREATE INDEX "idx_blogs_author" ON "blogs"("authorId");

-- CreateIndex
CREATE INDEX "idx_blogs_company" ON "blogs"("companyId");

-- CreateIndex
CREATE INDEX "idx_blogs_status" ON "blogs"("status");

-- CreateIndex
CREATE INDEX "idx_blogs_scheduled" ON "blogs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "idx_blogs_author_status" ON "blogs"("authorId", "status");

-- CreateIndex
CREATE INDEX "idx_blogs_company_status" ON "blogs"("companyId", "status");

-- CreateIndex
CREATE INDEX "idx_blog_tags_tag" ON "blog_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "idx_tags_approved" ON "tags"("isApproved");

-- CreateIndex
CREATE INDEX "idx_milestones_company" ON "company_milestones"("companyId");

-- CreateIndex
CREATE INDEX "idx_milestones_company_date" ON "company_milestones"("companyId", "milestoneDate");

-- CreateIndex
CREATE INDEX "idx_seo_metadata_type" ON "seo_metadata"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "seo_metadata_entityId_entityType_key" ON "seo_metadata"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "idx_slug_redirects_type" ON "slug_redirects"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirects_fromSlug_entityType_key" ON "slug_redirects"("fromSlug", "entityType");

-- CreateIndex
CREATE INDEX "idx_follows_author" ON "follows"("authorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_authorProfileId_key" ON "follows"("followerId", "authorProfileId");

-- CreateIndex
CREATE INDEX "idx_company_follows_company" ON "company_follows"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_follows_followerId_companyId_key" ON "company_follows"("followerId", "companyId");

-- CreateIndex
CREATE INDEX "idx_blog_views_blog" ON "blog_views"("blogId");

-- CreateIndex
CREATE INDEX "idx_blog_views_blog_date" ON "blog_views"("blogId", "viewedAt");

-- CreateIndex
CREATE INDEX "idx_notifications_user_read" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "idx_notifications_user_date" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "login_attempts_identifierHash_key" ON "login_attempts"("identifierHash");

-- AddForeignKey
ALTER TABLE "author_profiles" ADD CONSTRAINT "author_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_tags" ADD CONSTRAINT "blog_tags_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_tags" ADD CONSTRAINT "blog_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_milestones" ADD CONSTRAINT "company_milestones_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_milestones" ADD CONSTRAINT "company_milestones_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "author_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_follows" ADD CONSTRAINT "company_follows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_views" ADD CONSTRAINT "blog_views_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_views" ADD CONSTRAINT "blog_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
