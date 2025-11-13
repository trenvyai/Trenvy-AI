/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "password_resets_audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT,
    "outcome" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "password_resets_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_resets_audit_requestedAt_idx" ON "password_resets_audit"("requestedAt");

-- CreateIndex
CREATE INDEX "password_resets_audit_userId_idx" ON "password_resets_audit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChange_tokenHash_key" ON "EmailChange"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailChange_userId_idx" ON "EmailChange"("userId");

-- CreateIndex
CREATE INDEX "EmailChange_tokenHash_idx" ON "EmailChange"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailChange_expiresAt_idx" ON "EmailChange"("expiresAt");

-- AddForeignKey
ALTER TABLE "password_resets_audit" ADD CONSTRAINT "password_resets_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChange" ADD CONSTRAINT "EmailChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
