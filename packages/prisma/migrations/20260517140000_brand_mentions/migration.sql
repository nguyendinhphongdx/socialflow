-- CreateTable
CREATE TABLE "brand_mentions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "platform" "AccountPlatform" NOT NULL,
    "platformPostId" TEXT,
    "authorName" TEXT,
    "authorPlatformId" TEXT,
    "text" TEXT NOT NULL,
    "permalink" TEXT,
    "postedAt" TIMESTAMP(3),
    "matchedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_mentions_monitorId_platform_platformPostId_key" ON "brand_mentions"("monitorId", "platform", "platformPostId");

-- CreateIndex
CREATE INDEX "brand_mentions_userId_status_createdAt_idx" ON "brand_mentions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "brand_mentions_monitorId_createdAt_idx" ON "brand_mentions"("monitorId", "createdAt");

-- CreateIndex
CREATE INDEX "brand_mentions_sentiment_idx" ON "brand_mentions"("sentiment");

-- AddForeignKey
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "BrandMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
