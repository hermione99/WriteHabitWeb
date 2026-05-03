-- Make passwordHash optional (social-only accounts have no password)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Apple / Google OIDC sub identifiers (stable per-provider user ID)
ALTER TABLE "User" ADD COLUMN "appleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;

CREATE UNIQUE INDEX "User_appleSub_key" ON "User"("appleSub");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
