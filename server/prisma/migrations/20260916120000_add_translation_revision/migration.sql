-- Причина рецензента зберігається окремо від звичайного коментаря.
ALTER TYPE "TranslationStatus" ADD VALUE 'NEEDS_REVISION';
ALTER TABLE "Translation" ADD COLUMN "reviewReason" TEXT;
