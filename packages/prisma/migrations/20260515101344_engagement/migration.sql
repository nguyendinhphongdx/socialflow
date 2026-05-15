-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('NEW', 'REPLIED', 'IGNORED', 'SPAM', 'HIDDEN', 'DELETED');

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publishRecordId" TEXT,
    "platform" "AccountPlatform" NOT NULL,
    "platformCommentId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'NEW',
    "repliedAt" TIMESTAMP(3),
    "replyText" TEXT,
    "replyPlatformId" TEXT,
    "autoReplyRuleId" TEXT,
    "platformCreatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "platforms" "AccountPlatform"[],
    "accountIds" TEXT[],
    "keywordsAny" TEXT[],
    "keywordsAll" TEXT[],
    "keywordsNone" TEXT[],
    "replyTemplate" TEXT NOT NULL,
    "replyDelaySec" INTEGER NOT NULL DEFAULT 60,
    "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 50,
    "repliesToday" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutoReplyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "platforms" "AccountPlatform"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastPolledAt" TIMESTAMP(3),
    "pollIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BrandMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostInsight" (
    "id" TEXT NOT NULL,
    "publishRecordId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reachUnique" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB,

    CONSTRAINT "PostInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountInsight" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "followersDelta" INTEGER NOT NULL DEFAULT 0,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalEngagement" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB,

    CONSTRAINT "AccountInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_userId_status_idx" ON "Comment"("userId", "status");

-- CreateIndex
CREATE INDEX "Comment_accountId_syncedAt_idx" ON "Comment"("accountId", "syncedAt");

-- CreateIndex
CREATE INDEX "Comment_publishRecordId_idx" ON "Comment"("publishRecordId");

-- CreateIndex
CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_accountId_platformCommentId_key" ON "Comment"("accountId", "platformCommentId");

-- CreateIndex
CREATE INDEX "AutoReplyRule_userId_enabled_idx" ON "AutoReplyRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "AutoReplyRule_deletedAt_idx" ON "AutoReplyRule"("deletedAt");

-- CreateIndex
CREATE INDEX "BrandMonitor_userId_enabled_idx" ON "BrandMonitor"("userId", "enabled");

-- CreateIndex
CREATE INDEX "BrandMonitor_lastPolledAt_enabled_idx" ON "BrandMonitor"("lastPolledAt", "enabled");

-- CreateIndex
CREATE INDEX "PostInsight_publishRecordId_snapshotAt_idx" ON "PostInsight"("publishRecordId", "snapshotAt");

-- CreateIndex
CREATE INDEX "AccountInsight_accountId_date_idx" ON "AccountInsight"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AccountInsight_accountId_date_key" ON "AccountInsight"("accountId", "date");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_publishRecordId_fkey" FOREIGN KEY ("publishRecordId") REFERENCES "PublishRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_autoReplyRuleId_fkey" FOREIGN KEY ("autoReplyRuleId") REFERENCES "AutoReplyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyRule" ADD CONSTRAINT "AutoReplyRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMonitor" ADD CONSTRAINT "BrandMonitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostInsight" ADD CONSTRAINT "PostInsight_publishRecordId_fkey" FOREIGN KEY ("publishRecordId") REFERENCES "PublishRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInsight" ADD CONSTRAINT "AccountInsight_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
