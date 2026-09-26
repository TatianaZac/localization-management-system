const prisma = require('../prisma');
const { getProjectId } = require('../utils/validation');

// Логічне видалення зберігає історію. Lock спільний з імпортом та перекладами.
async function deleteVersion(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const versionId = getProjectId(req.params.versionId);
        if (!versionId) return res.status(400).json({ error: 'Некоректна версія' });
        const result = await prisma.$transaction(async tx => {
            const version = await tx.pageVersion.findFirst({ where: { id: versionId, deletedAt: null, page: { projectId } } });
            if (!version) return { code: 404, error: 'Версію не знайдено' };
            await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${version.pageId}::bigint)`;
            const versions = await tx.pageVersion.findMany({ where: { pageId: version.pageId, deletedAt: null }, orderBy: { number: 'desc' } });
            if (!versions.some(v => v.id === versionId)) return { code: 404, error: 'Версію вже видалено' };
            if (versions.length <= 1) return { code: 409, error: 'Не можна видалити єдину версію сторінки' };
            await tx.pageVersion.update({ where: { id: versionId }, data: { deletedAt: new Date() } });
            return { code: 200, pageId: version.pageId, versionId: versions.find(v => v.id !== versionId).id };
        });
        res.status(result.code).json(result);
    } catch (error) { next(error); }
}
module.exports = { deleteVersion };
