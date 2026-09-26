-- Переносимо існуючі ключі без зміни їхніх ID: переклади та історія залишаються на місці.
BEGIN;
CREATE TABLE "LocalizationPage" (
  "id" SERIAL PRIMARY KEY, "projectId" INTEGER NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocalizationPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LocalizationPage_projectId_name_key" ON "LocalizationPage"("projectId", "name");
CREATE TABLE "PageVersion" (
  "id" SERIAL PRIMARY KEY, "pageId" INTEGER NOT NULL, "number" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "summary" JSONB,
  CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LocalizationPage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PageVersion_pageId_number_key" ON "PageVersion"("pageId", "number");
ALTER TABLE "TranslationKey" ADD COLUMN "pageVersionId" INTEGER;
ALTER TABLE "Translation" ADD COLUMN "copiedFromTranslationId" INTEGER;
INSERT INTO "LocalizationPage" ("projectId", "name")
SELECT DISTINCT "projectId", 'ui.json' FROM "TranslationKey";
INSERT INTO "PageVersion" ("pageId", "number", "fileName")
SELECT "id", 1, 'ui.json' FROM "LocalizationPage";
UPDATE "TranslationKey" k SET "pageVersionId" = v."id"
FROM "LocalizationPage" p JOIN "PageVersion" v ON v."pageId" = p."id"
WHERE k."projectId" = p."projectId";
ALTER TABLE "TranslationKey" ALTER COLUMN "pageVersionId" SET NOT NULL;
ALTER TABLE "TranslationKey" ADD CONSTRAINT "TranslationKey_pageVersionId_fkey" FOREIGN KEY ("pageVersionId") REFERENCES "PageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "TranslationKey_projectId_key_key";
CREATE UNIQUE INDEX "TranslationKey_pageVersionId_key_key" ON "TranslationKey"("pageVersionId", "key");
CREATE INDEX "TranslationKey_projectId_idx" ON "TranslationKey"("projectId");
COMMIT;
