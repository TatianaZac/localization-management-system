-- Відокремлює версії самого тексту від журналу дій редактора й рецензента.

ALTER TABLE "Translation" ADD COLUMN "currentVersion" INTEGER;

CREATE TABLE "TranslationVersion" (
    "id" SERIAL NOT NULL,
    "translationId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "sourceVersion" INTEGER,
    "authorId" INTEGER,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'TRANSLATED',
    "reviewReason" TEXT,
    "reviewerId" INTEGER,
    "reviewerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TranslationVersion_translationId_number_key"
    ON "TranslationVersion"("translationId", "number");
CREATE INDEX "TranslationVersion_translationId_createdAt_idx"
    ON "TranslationVersion"("translationId", "createdAt");

ALTER TABLE "TranslationVersion" ADD CONSTRAINT "TranslationVersion_translationId_fkey"
    FOREIGN KEY ("translationId") REFERENCES "Translation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Для наявних перекладів створюємо початкову v1. Якщо старого автора визначити
-- неможливо, чесно позначаємо запис як перенесений, а не вигадуємо користувача.
INSERT INTO "TranslationVersion" (
    "translationId",
    "number",
    "value",
    "sourceVersion",
    "authorId",
    "authorName",
    "authorRole",
    "status",
    "reviewReason",
    "reviewerId",
    "reviewerName",
    "reviewedAt",
    "createdAt"
)
SELECT
    translation."id",
    1,
    translation."value",
    translation."sourceVersion",
    author."actorId",
    COALESCE(author."actorName", 'Перенесено з попередніх даних'),
    COALESCE(author."actorRole"::text, 'SYSTEM'),
    translation."status",
    translation."reviewReason",
    reviewer."actorId",
    reviewer."actorName",
    reviewer."createdAt",
    COALESCE(author."createdAt", translation."createdAt")
FROM "Translation" AS translation
LEFT JOIN LATERAL (
    SELECT history."actorId", history."actorName", history."actorRole", history."createdAt"
    FROM "TranslationHistory" AS history
    WHERE history."translationId" = translation."id"
      AND history."actorRole" = 'EDITOR'
      AND history."value" = translation."value"
    ORDER BY history."createdAt" ASC, history."id" ASC
    LIMIT 1
) AS author ON true
LEFT JOIN LATERAL (
    SELECT history."actorId", history."actorName", history."createdAt"
    FROM "TranslationHistory" AS history
    WHERE history."translationId" = translation."id"
      AND history."actorRole" = 'REVIEWER'
      AND history."status" = 'REVIEWED'
      AND history."value" = translation."value"
    ORDER BY history."createdAt" DESC, history."id" DESC
    LIMIT 1
) AS reviewer ON true
WHERE translation."value" IS NOT NULL;

UPDATE "Translation"
SET "currentVersion" = 1
WHERE "value" IS NOT NULL;
