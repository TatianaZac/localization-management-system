-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('NEW', 'TRANSLATED', 'REVIEWED', 'OUTDATED');

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceLocaleCode" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locale" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationKey" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceText" (
    "id" SERIAL NOT NULL,
    "translationKeyId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" SERIAL NOT NULL,
    "translationKeyId" INTEGER NOT NULL,
    "localeId" INTEGER NOT NULL,
    "value" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'NEW',
    "sourceVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Locale_projectId_code_key" ON "Locale"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationKey_projectId_key_key" ON "TranslationKey"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SourceText_translationKeyId_version_key" ON "SourceText"("translationKeyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_translationKeyId_localeId_key" ON "Translation"("translationKeyId", "localeId");

-- AddForeignKey
ALTER TABLE "Locale" ADD CONSTRAINT "Locale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationKey" ADD CONSTRAINT "TranslationKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceText" ADD CONSTRAINT "SourceText_translationKeyId_fkey" FOREIGN KEY ("translationKeyId") REFERENCES "TranslationKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_translationKeyId_fkey" FOREIGN KEY ("translationKeyId") REFERENCES "TranslationKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
