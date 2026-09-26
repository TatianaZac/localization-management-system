// Кожний імпорт створює незалежний знімок сторінки, не переписуючи старі ключі.
const prisma = require('../prisma');
const { flattenLocalizationObject } = require('../utils/flattenLocalization');

function invalid(message, status = 400) {
    const error = new Error(message); error.status = status; throw error;
}

async function importSourceTexts(project, content, options = {}) {
    const entries = flattenLocalizationObject(content);
    if (!entries.length) invalid('Localization file is empty');
    const incomingKeys = new Set(entries.map(e => e.key));
    if (incomingKeys.size !== entries.length) invalid('Localization file contains ambiguous keys');
    const pageName = typeof options.pageName === 'string' ? options.pageName.trim() : '';
    if (pageName.length > 100) invalid('Назва сторінки: не більше 100 символів');
    if (options.pageId && pageName) invalid('Обери існуючу сторінку або створи нову');
    const fileName = typeof options.fileName === 'string' ? options.fileName.trim() : 'source.json';
    const versionName = typeof options.versionName === 'string' ? options.versionName.trim() : null;
    // Старі клієнти можуть не передавати назву; явно порожню або некоректну відхиляємо.
    if (options.versionName !== undefined && (!versionName || versionName.length > 100)) invalid('Назва версії має містити від 1 до 100 символів');
    if (!fileName || fileName.length > 255) invalid('Некоректна назва файлу');

    // Serializable не дозволить двом імпортам створити однаковий номер версії
    // або скопіювати наполовину оновлені переклади.
    return prisma.$transaction(async tx => {
        let page;
        if (options.pageId !== undefined) {
            if (!Number.isSafeInteger(options.pageId) || options.pageId < 1) invalid('Некоректна сторінка');
            page = await tx.localizationPage.findFirst({ where: { id: options.pageId, projectId: project.id } });
            if (!page) invalid('Сторінку не знайдено', 404);
        } else if (pageName) {
            page = await tx.localizationPage.create({ data: { projectId: project.id, name: pageName } });
        } else {
            const pages = await tx.localizationPage.findMany({ where: { projectId: project.id } });
            if (pages.length > 1) invalid('Обери сторінку для імпорту');
            page = pages[0] ?? await tx.localizationPage.create({ data: { projectId: project.id, name: 'ui.json' } });
        }
        // Імпорт і збереження перекладу однієї сторінки не виконуються одночасно:
        // завершена версія не може отримати запізнілий запис після створення наступної.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${page.id}::bigint)`;
        const lastNumber = await tx.pageVersion.aggregate({ where: { pageId: page.id }, _max: { number: true } });
        const previous = await tx.pageVersion.findFirst({ where: { pageId: page.id, deletedAt: null }, orderBy: { number: 'desc' },
            include: { translationKeys: { include: { sourceTexts: { where: { isCurrent: true } }, translations: true } } } });
        const oldKeys = new Map((previous?.translationKeys ?? []).map(k => [k.key, k]));
        const summary = { total: entries.length, created: 0, updated: 0, unchanged: 0,
            removed: [...oldKeys.keys()].filter(key => !incomingKeys.has(key)).length };
        const version = await tx.pageVersion.create({ data: { pageId: page.id, number: (lastNumber._max.number ?? 0) + 1, name: versionName, fileName } });
        const locales = await tx.locale.findMany({ where: { projectId: project.id, isSource: false } });
        for (const entry of entries) {
            const old = oldKeys.get(entry.key);
            const source = old?.sourceTexts[0];
            const same = source?.value === entry.value;
            summary[!old ? 'created' : same ? 'unchanged' : 'updated']++;
            // Номер тексту зберігає сумісність зі старою історією рядків після міграції.
            const sourceNumber = source ? source.version + (same ? 0 : 1) : 1;
            await tx.translationKey.create({ data: {
                projectId: project.id, pageVersionId: version.id, key: entry.key,
                sourceTexts: { create: { value: entry.value, version: sourceNumber } },
                translations: { create: locales.map(locale => {
                    const saved = old?.translations.find(t => t.localeId === locale.id);
                    return { localeId: locale.id, value: saved?.value ?? null,
                        status: saved?.value ? (same ? saved.status : 'OUTDATED') : 'NEW',
                        sourceVersion: saved?.value ? saved.sourceVersion : sourceNumber,
                        comment: saved?.comment ?? null, reviewReason: same ? saved?.reviewReason : null,
                        copiedFromTranslationId: saved?.id ?? null };
                }) }
            } });
        }
        // Відсутні в новому файлі ключі не копіюємо; у попередній версії вони залишаються.
        await tx.pageVersion.update({ where: { id: version.id }, data: { summary } });
        return { ...summary, pageId: page.id, versionId: version.id, versionNumber: version.number, versionName: version.name };
    }, { isolationLevel: 'Serializable', timeout: 60000 });
}

module.exports = { importSourceTexts };
