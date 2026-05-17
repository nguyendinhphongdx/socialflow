-- Migration: BYOK credentials (ADR-0010)
-- Adds OAuthCredential + AiCredential tables, with 3-layer fallback (workspace > system > env).

-- CreateEnum
CREATE TYPE "CredentialScope" AS ENUM ('SYSTEM', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI');

-- CreateTable: oauth_credentials
CREATE TABLE "oauth_credentials" (
    "id" TEXT NOT NULL,
    "scope" "CredentialScope" NOT NULL,
    "workspaceId" TEXT,
    "platform" "AccountPlatform" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_credentials_scope_workspaceId_platform_key"
    ON "oauth_credentials"("scope", "workspaceId", "platform");
CREATE INDEX "oauth_credentials_workspaceId_idx" ON "oauth_credentials"("workspaceId");
CREATE INDEX "oauth_credentials_platform_idx" ON "oauth_credentials"("platform");

-- AddForeignKey
ALTER TABLE "oauth_credentials"
    ADD CONSTRAINT "oauth_credentials_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ai_credentials
CREATE TABLE "ai_credentials" (
    "id" TEXT NOT NULL,
    "scope" "CredentialScope" NOT NULL,
    "workspaceId" TEXT,
    "provider" "AiProvider" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetUsd" DECIMAL(10,4),
    "monthSpentUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "monthResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_credentials_scope_workspaceId_provider_key"
    ON "ai_credentials"("scope", "workspaceId", "provider");
CREATE INDEX "ai_credentials_workspaceId_idx" ON "ai_credentials"("workspaceId");
CREATE INDEX "ai_credentials_provider_idx" ON "ai_credentials"("provider");

-- AddForeignKey
ALTER TABLE "ai_credentials"
    ADD CONSTRAINT "ai_credentials_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
