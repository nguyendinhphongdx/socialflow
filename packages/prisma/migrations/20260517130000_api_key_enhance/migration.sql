-- AlterTable: thêm scopes (text[]) + updatedAt cho ApiKey, mở index hỗ trợ validate
ALTER TABLE "ApiKey"
  ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop default sau khi backfill (Prisma không cần default vì @updatedAt auto)
ALTER TABLE "ApiKey" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" DROP DEFAULT;

-- Index cho prefix lookup (validate path) + revokedAt (filter active keys)
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");
