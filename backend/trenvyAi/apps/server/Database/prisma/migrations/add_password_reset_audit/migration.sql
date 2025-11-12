-- CreateTable for password_resets_audit if not exists
-- This migration ensures the audit table exists with proper indexes

-- Check if table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_resets_audit') THEN
        CREATE TABLE "password_resets_audit" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "requestIp" TEXT,
            "outcome" TEXT NOT NULL,
            "meta" JSONB,

            CONSTRAINT "password_resets_audit_pkey" PRIMARY KEY ("id")
        );

        -- Create indexes
        CREATE INDEX "password_resets_audit_requestedAt_idx" ON "password_resets_audit"("requestedAt");
        CREATE INDEX "password_resets_audit_userId_idx" ON "password_resets_audit"("userId");

        -- Add foreign key constraint
        ALTER TABLE "password_resets_audit" ADD CONSTRAINT "password_resets_audit_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
