-- CreateTable
CREATE TABLE "KeywordSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "eng" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordSuggestion_status_createdAt_idx" ON "KeywordSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KeywordSuggestion_userId_createdAt_idx" ON "KeywordSuggestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "KeywordSuggestion" ADD CONSTRAINT "KeywordSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
