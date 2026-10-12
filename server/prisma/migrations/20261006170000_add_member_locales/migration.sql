-- Зберігає цільові мови, призначені кожному редактору або рецензенту.

CREATE TABLE "ProjectMemberLocale" (
    "memberId" INTEGER NOT NULL,
    "localeId" INTEGER NOT NULL,

    CONSTRAINT "ProjectMemberLocale_pkey" PRIMARY KEY ("memberId", "localeId")
);

CREATE INDEX "ProjectMemberLocale_localeId_idx" ON "ProjectMemberLocale"("localeId");

ALTER TABLE "ProjectMemberLocale" ADD CONSTRAINT "ProjectMemberLocale_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "ProjectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMemberLocale" ADD CONSTRAINT "ProjectMemberLocale_localeId_fkey"
    FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Наявним учасникам залишаємо всі поточні цільові мови, щоб міграція не забрала доступ.
INSERT INTO "ProjectMemberLocale" ("memberId", "localeId")
SELECT member."id", locale."id"
FROM "ProjectMember" AS member
JOIN "Locale" AS locale
  ON locale."projectId" = member."projectId"
 AND locale."isSource" = false;
