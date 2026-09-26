const prisma = require('../prisma');

// Невідомий ID не підміняємо першою сторінкою: інакше можна експортувати не ті дані.
async function selectPageVersion(projectId, query = {}) {
    // Повертаємо назви разом із номерами: name показуємо користувачу, number задає порядок.
    const pages = await prisma.localizationPage.findMany({
        where: { projectId }, orderBy: { id: 'asc' },
        include: { versions: { where: { deletedAt: null }, orderBy: { number: 'desc' } } }
    });
    const page = query.pageId === undefined ? pages[0] : pages.find(p => String(p.id) === String(query.pageId));
    const version = query.versionId === undefined ? page?.versions[0] : page?.versions.find(v => String(v.id) === String(query.versionId));
    if ((query.pageId !== undefined && !page) || (query.versionId !== undefined && !version)) {
        const error = new Error('Сторінку або версію не знайдено в цьому проєкті');
        error.status = 404; throw error;
    }
    return { pages, selectedPageId: page?.id ?? null, selectedVersionId: version?.id ?? null,
        isLatestVersion: Boolean(version && version.id === page.versions[0]?.id) };
}
module.exports = { selectPageVersion };
