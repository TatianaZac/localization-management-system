-- Переносимо старі записи без втрати тексту. Авторство не вигадуємо.
CREATE TYPE "GlossaryStatus" AS ENUM ('PENDING', 'APPROVED', 'ARCHIVED');
CREATE TABLE "GlossaryConcept" (
 "id" SERIAL PRIMARY KEY,
 "projectId" INTEGER NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "term" TEXT NOT NULL, "normalizedTerm" TEXT NOT NULL, "definition" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "GlossaryConcept_projectId_normalizedTerm_key" ON "GlossaryConcept"("projectId", "normalizedTerm");
INSERT INTO "GlossaryConcept" ("projectId", "term", "normalizedTerm", "definition")
SELECT DISTINCT ON (l."projectId", e."normalizedTerm") l."projectId", e."term", e."normalizedTerm", e."note"
FROM "GlossaryEntry" e JOIN "Locale" l ON l."id" = e."localeId" ORDER BY l."projectId", e."normalizedTerm", e."id";
ALTER TABLE "GlossaryEntry" ADD COLUMN "conceptId" INTEGER,
 ADD COLUMN "example" TEXT NOT NULL DEFAULT '', ADD COLUMN "status" "GlossaryStatus" NOT NULL DEFAULT 'PENDING',
 ADD COLUMN "authorId" INTEGER, ADD COLUMN "authorName" TEXT, ADD COLUMN "reviewerName" TEXT,
 ADD COLUMN "reviewerId" INTEGER, ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "decisionNote" TEXT NOT NULL DEFAULT '';
UPDATE "GlossaryEntry" e SET "conceptId" = c."id" FROM "Locale" l, "GlossaryConcept" c
WHERE l."id" = e."localeId" AND c."projectId" = l."projectId" AND c."normalizedTerm" = e."normalizedTerm";
ALTER TABLE "GlossaryEntry" ALTER COLUMN "conceptId" SET NOT NULL;
ALTER TABLE "GlossaryEntry" ADD CONSTRAINT "GlossaryEntry_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "GlossaryConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "GlossaryEntry_localeId_normalizedTerm_key";
ALTER TABLE "GlossaryEntry" DROP COLUMN "term", DROP COLUMN "normalizedTerm";
CREATE INDEX "GlossaryEntry_conceptId_localeId_idx" ON "GlossaryEntry"("conceptId", "localeId");
CREATE UNIQUE INDEX "GlossaryEntry_one_pending" ON "GlossaryEntry"("conceptId", "localeId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "GlossaryEntry_one_approved" ON "GlossaryEntry"("conceptId", "localeId") WHERE "status" = 'APPROVED';
