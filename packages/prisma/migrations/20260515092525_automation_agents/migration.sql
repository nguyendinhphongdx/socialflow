-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('EXTENSION', 'DESKTOP');

-- CreateEnum
CREATE TYPE "AutomationTaskStatus" AS ENUM ('PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "agentId" TEXT;

-- CreateTable
CREATE TABLE "AutomationAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AgentType" NOT NULL DEFAULT 'EXTENSION',
    "pairCode" TEXT,
    "pairCodeExpiresAt" TIMESTAMP(3),
    "agentTokenSha256" TEXT,
    "publicId" TEXT NOT NULL,
    "os" TEXT,
    "browserName" TEXT,
    "extensionVersion" TEXT,
    "capabilities" TEXT[],
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTask" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "publishRecordId" TEXT,
    "command" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AutomationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "errorMessage" TEXT,
    "errorScreenshotUrl" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAgent_pairCode_key" ON "AutomationAgent"("pairCode");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAgent_agentTokenSha256_key" ON "AutomationAgent"("agentTokenSha256");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAgent_publicId_key" ON "AutomationAgent"("publicId");

-- CreateIndex
CREATE INDEX "AutomationAgent_userId_idx" ON "AutomationAgent"("userId");

-- CreateIndex
CREATE INDEX "AutomationAgent_online_lastSeenAt_idx" ON "AutomationAgent"("online", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AutomationAgent_pairCodeExpiresAt_idx" ON "AutomationAgent"("pairCodeExpiresAt");

-- CreateIndex
CREATE INDEX "AutomationTask_agentId_status_idx" ON "AutomationTask"("agentId", "status");

-- CreateIndex
CREATE INDEX "AutomationTask_publishRecordId_idx" ON "AutomationTask"("publishRecordId");

-- CreateIndex
CREATE INDEX "AutomationTask_timeoutAt_idx" ON "AutomationTask"("timeoutAt");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AutomationAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAgent" ADD CONSTRAINT "AutomationAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTask" ADD CONSTRAINT "AutomationTask_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AutomationAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTask" ADD CONSTRAINT "AutomationTask_publishRecordId_fkey" FOREIGN KEY ("publishRecordId") REFERENCES "PublishRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
