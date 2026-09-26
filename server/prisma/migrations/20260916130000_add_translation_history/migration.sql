-- Історія містить знімок перекладу й автора кожної дії.
CREATE TABLE "TranslationHistory" (
    "id" SERIAL NOT NULL,
    "translationId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" "ProjectRole" NOT NULL,
    "value" TEXT,
    "status" "TranslationStatus" NOT NULL,
    "sourceVersion" INTEGER,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranslationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TranslationHistory_translationId_createdAt_idx" ON "TranslationHistory"("translationId", "createdAt");
ALTER TABLE "TranslationHistory" ADD CONSTRAINT "TranslationHistory_translationId_fkey"
FOREIGN KEY ("translationId") REFERENCES "Translation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
