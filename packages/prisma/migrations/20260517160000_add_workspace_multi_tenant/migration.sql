-- Migration: add_workspace_multi_tenant (F-716)
-- Adds Workspace + WorkspaceMember tables, scopes SocialAccount/PublishRecord/Draft/MediaAsset
-- by workspaceId. Backfills 1 personal workspace per existing user.

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateTable: workspaces
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");
CREATE INDEX "workspaces_deletedAt_idx" ON "workspaces"("deletedAt");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: workspace_members
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- Backfill: 1 personal workspace per existing user
-- ============================================

-- Generate workspace per user. Slug = `personal-<user_id_prefix>` để đảm bảo unique.
INSERT INTO "workspaces" ("id", "name", "slug", "isPersonal", "ownerId", "createdAt", "updatedAt")
SELECT
    'wks_' || substring(md5(random()::text || u.id), 1, 21),
    COALESCE(u.name, split_part(u.email, '@', 1)) || '''s workspace',
    'personal-' || substring(u.id, 1, 16),
    true,
    u.id,
    NOW(),
    NOW()
FROM "User" u
WHERE u."deletedAt" IS NULL;

-- Backfill WorkspaceMember rows — each user is OWNER của personal workspace
INSERT INTO "workspace_members" ("id", "workspaceId", "userId", "role", "joinedAt")
SELECT
    'wm_' || substring(md5(random()::text || w.id), 1, 21),
    w.id,
    w."ownerId",
    'OWNER',
    NOW()
FROM "workspaces" w;

-- ============================================
-- Add workspaceId columns + backfill + NOT NULL + FK + index
-- ============================================

-- SocialAccount
ALTER TABLE "SocialAccount" ADD COLUMN "workspaceId" TEXT;
UPDATE "SocialAccount" sa
SET "workspaceId" = (
    SELECT w.id FROM "workspaces" w
    WHERE w."ownerId" = sa."userId" AND w."isPersonal" = true
    LIMIT 1
);
ALTER TABLE "SocialAccount" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SocialAccount_workspaceId_idx" ON "SocialAccount"("workspaceId");

-- PublishRecord
ALTER TABLE "PublishRecord" ADD COLUMN "workspaceId" TEXT;
UPDATE "PublishRecord" pr
SET "workspaceId" = (
    SELECT w.id FROM "workspaces" w
    WHERE w."ownerId" = pr."userId" AND w."isPersonal" = true
    LIMIT 1
);
ALTER TABLE "PublishRecord" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PublishRecord_workspaceId_idx" ON "PublishRecord"("workspaceId");

-- Draft
ALTER TABLE "Draft" ADD COLUMN "workspaceId" TEXT;
UPDATE "Draft" d
SET "workspaceId" = (
    SELECT w.id FROM "workspaces" w
    WHERE w."ownerId" = d."userId" AND w."isPersonal" = true
    LIMIT 1
);
ALTER TABLE "Draft" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Draft_workspaceId_idx" ON "Draft"("workspaceId");

-- MediaAsset
ALTER TABLE "MediaAsset" ADD COLUMN "workspaceId" TEXT;
UPDATE "MediaAsset" m
SET "workspaceId" = (
    SELECT w.id FROM "workspaces" w
    WHERE w."ownerId" = m."userId" AND w."isPersonal" = true
    LIMIT 1
);
ALTER TABLE "MediaAsset" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MediaAsset_workspaceId_idx" ON "MediaAsset"("workspaceId");
