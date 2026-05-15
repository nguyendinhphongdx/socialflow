-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('UPLOAD', 'AI_GEN', 'EXTERNAL_URL');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('PENDING', 'SCHEDULED', 'WAITING_AGENT', 'DISPATCHED', 'IN_PROGRESS', 'REVIEW_PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "source" "MediaSource" NOT NULL DEFAULT 'UPLOAD',
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "aiGenJobId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "flowId" TEXT,
    "publishMode" "PublishMode" NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "mediaIds" TEXT[],
    "platformOptions" JSONB,
    "publishTime" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'PENDING',
    "stage" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "platformPostId" TEXT,
    "workLink" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_type_idx" ON "MediaAsset"("userId", "type");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_deletedAt_idx" ON "MediaAsset"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishRecord_idempotencyKey_key" ON "PublishRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublishRecord_userId_status_idx" ON "PublishRecord"("userId", "status");

-- CreateIndex
CREATE INDEX "PublishRecord_accountId_status_idx" ON "PublishRecord"("accountId", "status");

-- CreateIndex
CREATE INDEX "PublishRecord_publishTime_status_idx" ON "PublishRecord"("publishTime", "status");

-- CreateIndex
CREATE INDEX "PublishRecord_flowId_idx" ON "PublishRecord"("flowId");

-- CreateIndex
CREATE INDEX "PublishRecord_platformPostId_idx" ON "PublishRecord"("platformPostId");

-- CreateIndex
CREATE INDEX "PublishRecord_deletedAt_idx" ON "PublishRecord"("deletedAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
