const prisma = require("../prisma");
const { flattenLocalizationObject } = require("../utils/flattenLocalization");

async function importSourceTexts(project, content) {
    const entries = flattenLocalizationObject(content);

    if (entries.length === 0) {
        throw new Error("Localization file is empty");
    }

    return prisma.$transaction(async (transaction) => {
        const summary = {
            total: entries.length,
            created: 0,
            updated: 0,
            unchanged: 0
        };
        const changedKeyIds = [];

        for (const entry of entries) {
            const translationKey = await transaction.translationKey.upsert({
                where: {
                    projectId_key: {
                        projectId: project.id,
                        key: entry.key
                    }
                },
                create: {
                    projectId: project.id,
                    key: entry.key
                },
                update: {}
            });

            const currentSource = await transaction.sourceText.findFirst({
                where: {
                    translationKeyId: translationKey.id,
                    isCurrent: true
                }
            });

            if (!currentSource) {
                const sourceText = await transaction.sourceText.create({
                    data: {
                        translationKeyId: translationKey.id,
                        value: entry.value,
                        version: 1
                    }
                });

                if (project.locales.length > 0) {
                    await transaction.translation.createMany({
                        data: project.locales.map((locale) => ({
                            translationKeyId: translationKey.id,
                            localeId: locale.id,
                            sourceVersion: sourceText.version
                        }))
                    });
                }

                summary.created += 1;
                continue;
            }

            if (currentSource.value === entry.value) {
                summary.unchanged += 1;
                continue;
            }

            await transaction.sourceText.update({
                where: { id: currentSource.id },
                data: { isCurrent: false }
            });

            await transaction.sourceText.create({
                data: {
                    translationKeyId: translationKey.id,
                    value: entry.value,
                    version: currentSource.version + 1
                }
            });

            changedKeyIds.push(translationKey.id);
            summary.updated += 1;
        }

        if (changedKeyIds.length > 0) {
            await transaction.translation.updateMany({
                where: {
                    translationKeyId: { in: changedKeyIds },
                    value: { not: null }
                },
                data: {
                    status: "OUTDATED"
                }
            });
        }

        return summary;
    });
}

module.exports = { importSourceTexts };
