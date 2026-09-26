-- Запис належить цільовій мові, а через неї — одному проєкту.
CREATE TABLE "GlossaryEntry" (
  "id" SERIAL PRIMARY KEY,
  "localeId" INTEGER NOT NULL REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "term" TEXT NOT NULL,
  "normalizedTerm" TEXT NOT NULL,
  "translation" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "GlossaryEntry_localeId_normalizedTerm_key" ON "GlossaryEntry"("localeId", "normalizedTerm");
