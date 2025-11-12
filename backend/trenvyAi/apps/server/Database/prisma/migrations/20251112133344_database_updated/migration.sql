/*
  Warnings:

  - You are about to drop the column `requestIp` on the `password_resets_audit` table. All the data in the column will be lost.
  - You are about to drop the column `requestedAt` on the `password_resets_audit` table. All the data in the column will be lost.
  - You are about to drop the `EmailChange` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'TEXT', 'OTHER');

-- DropForeignKey
ALTER TABLE "public"."EmailChange" DROP CONSTRAINT "EmailChange_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."password_resets_audit" DROP CONSTRAINT "password_resets_audit_userId_fkey";

-- DropIndex
DROP INDEX "public"."password_resets_audit_requestedAt_idx";

-- AlterTable
ALTER TABLE "password_resets_audit" DROP COLUMN "requestIp",
DROP COLUMN "requestedAt",
ADD COLUMN     "request_ip" TEXT,
ADD COLUMN     "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."EmailChange";

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(100),
    "name" VARCHAR(200),
    "email" VARCHAR(254) NOT NULL,
    "password" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "googleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "platform_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("platform_id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" INTEGER NOT NULL,
    "handle" VARCHAR(100),
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "post_id" BIGSERIAL NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "platform_account_id" INTEGER,
    "user_handle" VARCHAR(100),
    "caption" TEXT,
    "post_url" TEXT,
    "media_type" "MediaType",
    "timestamp" TIMESTAMP(3),
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "post_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "hashtags" (
    "hashtag_id" SERIAL NOT NULL,
    "hashtag_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("hashtag_id")
);

-- CreateTable
CREATE TABLE "post_hashtags" (
    "post_id" BIGINT NOT NULL,
    "hashtag_id" INTEGER NOT NULL,
    "engagement_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateTable
CREATE TABLE "email_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE INDEX "platform_accounts_userId_idx" ON "platform_accounts"("userId");

-- CreateIndex
CREATE INDEX "platform_accounts_platformId_idx" ON "platform_accounts"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_platformId_handle_key" ON "platform_accounts"("platformId", "handle");

-- CreateIndex
CREATE INDEX "posts_platform_id_idx" ON "posts"("platform_id");

-- CreateIndex
CREATE INDEX "posts_platform_account_id_idx" ON "posts"("platform_account_id");

-- CreateIndex
CREATE INDEX "posts_post_at_idx" ON "posts"("post_at");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_hashtag_name_key" ON "hashtags"("hashtag_name");

-- CreateIndex
CREATE INDEX "hashtags_created_at_idx" ON "hashtags"("created_at");

-- CreateIndex
CREATE INDEX "post_hashtags_hashtag_id_idx" ON "post_hashtags"("hashtag_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_changes_token_hash_key" ON "email_changes"("token_hash");

-- CreateIndex
CREATE INDEX "email_changes_userId_idx" ON "email_changes"("userId");

-- CreateIndex
CREATE INDEX "email_changes_token_hash_idx" ON "email_changes"("token_hash");

-- CreateIndex
CREATE INDEX "email_changes_expires_at_idx" ON "email_changes"("expires_at");

-- CreateIndex
CREATE INDEX "password_resets_audit_requested_at_idx" ON "password_resets_audit"("requested_at");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("platform_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("platform_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("hashtag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets_audit" ADD CONSTRAINT "password_resets_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_changes" ADD CONSTRAINT "email_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
