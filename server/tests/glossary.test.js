// Перевірка реальної БД в транзакції: наприкінці всі тестові дані відкочуються.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');
let transaction;
const path = require.resolve('../src/prisma');
require.cache[path].exports = {
    locale: { findFirst: (args) => transaction.locale.findFirst(args) },
    glossaryEntry: { findMany: (args) => transaction.glossaryEntry.findMany(args) },
    glossaryConcept: { updateMany: (args) => transaction.glossaryConcept.updateMany(args) },
    // Контролер працює в зовнішній тестовій транзакції, яку ми гарантовано відкочуємо.
    $transaction: (callback) => callback(transaction)
};
const controller = require('../src/controllers/glossaryController');

// Викликає контролер із перевіреною серверною роллю та автором тестового запиту.
async function call(handler, projectId, role, body, params = {}) {
    let code = 200, result;
    const res = { status(value) { code = value; return this; }, json(value) { result = value; return this; } };
    await handler({ params: { projectId: String(projectId), ...params }, projectRole: role,
        user: { id: 123456, name: role === 'REVIEWER' ? 'Тестовий рецензент' : 'Тестовий автор' }, body }, res, (error) => { throw error });
    return { code, result };
}

test('цикл глосарію, права, інші мови та межі проєкту', async () => {
    const rollback = new Error('ROLLBACK_TEST_FIXTURE');
    try {
        await prisma.$transaction(async (tx) => {
            transaction = tx;
            const project = await tx.project.create({ data: { name: 'Temporary glossary workflow verification', locales: { create: [
                { code: 'uk', name: 'Українська' }, { code: 'pl', name: 'Польська' }, { code: 'en', name: 'English', isSource: true }
            ] } } });
            const other = await tx.project.create({ data: { name: 'Temporary isolated project', locales: { create: { code: 'uk', name: 'Українська' } } } });
            const body = { term: ' Sign   IN ', translation: 'Увійти', localeCode: 'uk', definition: 'Вхід до акаунта', example: 'Please sign in' };
            const proposal = await call(controller.saveGlossaryEntry, project.id, 'EDITOR', body);
            assert.equal(proposal.code, 201);
            let entry = proposal.result;
            assert.equal(entry.status, 'PENDING');
            assert.equal(entry.authorName, 'Тестовий автор');
            assert.equal(entry.concept.normalizedTerm, 'sign in');
            const params = { entryId: String(entry.id) };
            for (const role of ['OWNER', 'EDITOR']) {
                assert.equal((await call(controller.reviewGlossaryEntry, project.id, role, { action: 'approve', updatedAt: entry.updatedAt.toISOString() }, params)).code, 403);
                assert.equal((await call(controller.updateGlossaryConcept, project.id, role, { definition: 'Зміна' }, { conceptId: String(entry.conceptId) })).code, 403);
            }
            assert.equal((await call(controller.reviewGlossaryEntry, other.id, 'REVIEWER', { action: 'approve' }, params)).code, 404);
            assert.equal((await call(controller.saveGlossaryEntry, other.id, 'OWNER', { ...body, conceptId: entry.conceptId })).code, 404);
            assert.equal((await call(controller.saveGlossaryEntry, project.id, 'OWNER', { ...body, localeCode: 'en' })).code, 400);
            assert.equal((await call(controller.saveGlossaryEntry, project.id, 'OWNER', { ...body, translation: ' ' })).code, 400);
            assert.equal((await call(controller.reviewGlossaryEntry, project.id, 'REVIEWER', { action: 'approve', updatedAt: 'old' }, params)).code, 409);
            const approved = await call(controller.reviewGlossaryEntry, project.id, 'REVIEWER', { action: 'approve', updatedAt: entry.updatedAt.toISOString() }, params);
            assert.equal(approved.code, 200);
            assert.equal(approved.result.status, 'APPROVED');
            assert.equal(approved.result.reviewerName, 'Тестовий рецензент');
            // Зміна перекладу не повинна прибирати чинну рекомендацію до погодження.
            const revision = await call(controller.saveGlossaryEntry, project.id, 'OWNER', { ...body, conceptId: entry.conceptId, translation: 'Увійти в акаунт' });
            assert.equal(revision.code, 201);
            assert.equal((await tx.glossaryEntry.findUnique({ where: { id: entry.id } })).status, 'APPROVED');
            const next = revision.result;
            await call(controller.reviewGlossaryEntry, project.id, 'REVIEWER', { action: 'approve', updatedAt: next.updatedAt.toISOString() }, { entryId: String(next.id) });
            assert.equal((await tx.glossaryEntry.findUnique({ where: { id: entry.id } })).status, 'ARCHIVED');
            assert.equal(await tx.glossaryEntry.count({ where: { conceptId: entry.conceptId, status: 'APPROVED' } }), 1);
            const polish = await call(controller.saveGlossaryEntry, project.id, 'EDITOR', { ...body, conceptId: entry.conceptId, localeCode: 'pl', translation: 'Zaloguj się' });
            assert.equal(polish.result.conceptId, entry.conceptId);
            assert.equal(await tx.glossaryConcept.count({ where: { projectId: project.id } }), 1);
            assert.equal((await call(controller.updateGlossaryConcept, project.id, 'REVIEWER', { definition: 'Спільне значення' }, { conceptId: String(entry.conceptId) })).code, 200);
            const listed = await call(controller.getGlossary, project.id, 'EDITOR', {});
            assert.equal(listed.result.length, 3);
            assert.ok(listed.result.every((item) => item.definition === 'Спільне значення'));
            const archived = await call(controller.reviewGlossaryEntry, project.id, 'REVIEWER', { action: 'archive', updatedAt: polish.result.updatedAt.toISOString(), decisionNote: 'Потрібне уточнення' }, { entryId: String(polish.result.id) });
            assert.equal(archived.result.status, 'ARCHIVED');
            assert.equal(archived.result.decisionNote, 'Потрібне уточнення');
            assert.equal((await call(controller.getGlossary, other.id, 'OWNER', {})).result.length, 0);
            throw rollback;
        }, { timeout: 20000 });
    } catch (error) { if (error !== rollback) throw error; }
    finally { await prisma.$disconnect(); }
});

test('зіставлення термінів враховує регістр, Unicode і межі слів', async () => {
    const { matchesGlossaryTerm: matches } = await import('../../client/src/utils/glossary.js');
    assert.equal(matches('Please SIGN IN now.', 'Sign in'), true);
    assert.equal(matches('category', 'cat'), false);
    assert.equal(matches('Увійти зараз', 'увійти'), true);
    assert.equal(matches('Вхідний', 'вхід'), false);
    assert.equal(matches('Use C++ here', 'C++'), true);
});
