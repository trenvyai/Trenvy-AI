/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt",
ALTER COLUMN "password" DROP NOT NULL;
