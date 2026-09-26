-- Зберігаємо історію та не використовуємо номер видаленої версії повторно.
ALTER TABLE "PageVersion" ADD COLUMN "deletedAt" TIMESTAMP(3);
