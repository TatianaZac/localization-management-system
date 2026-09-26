// Наскрізна перевірка через справжні HTTP-маршрути, сесії та локальну базу.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const prisma = require('../src/prisma');
const app = require('../src/app');

// Прибирає лише акаунти цієї перевірки та створені ними проєкти.
async function cleanup(ids) {
    if (!ids.length) return;
    await prisma.project.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids }, email: { endsWith: '@example.invalid' }, name: { startsWith: 'QA ' } } });
}

async function checkWorkflow({ keep = false } = {}) {
    // Перший користувач у застосунку підхоплює старі проєкти; тест не має цього робити.
    assert.ok(await prisma.user.count(), 'Спочатку має існувати звичайний користувач застосунку');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const users = [], tag = randomUUID().slice(0, 8), password = 'QA-Local-Only-2026!';
    let success = false;
    // Кожен запит перевіряє статус, щоб заборони доступу також були частиною сценарію.
    async function request(path, token, method = 'GET', data, expected = 200) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body: data === undefined ? undefined : JSON.stringify(data) });
        const body = await response.json().catch(() => null);
        assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(body)}`);
        return body;
    }
    try {
        for (const role of ['owner', 'editor', 'reviewer', 'outsider']) {
            const email = `qa-${tag}-${role}@example.invalid`;
            const session = await request('/auth/register', null, 'POST', { name: 'QA ' + role, email, password }, 201);
            users.push({ ...session, role, email });
        }
        const [owner, editor, reviewer, outsider] = users;
        const project = await request('/projects', owner.token, 'POST', { name: 'QA workflow ' + tag, sourceLocale: { code: 'en', name: 'English' } }, 201);
        const path = '/projects/' + project.id;
        await request(path, null, 'GET', undefined, 401);
        await request(path, outsider.token, 'GET', undefined, 404);
        const editorMember = await request(path + '/members', owner.token, 'POST', { email: editor.email, role: 'EDITOR' }, 201);
        await request(path + '/members', owner.token, 'POST', { email: reviewer.email, role: 'REVIEWER' }, 201);
        await request(path + '/locales', owner.token, 'POST', { code: 'uk', name: 'Українська' }, 201);
        const source = { auth: { login: 'Sign in', password: 'Password' } };
        const imported = await request(path + '/import', owner.token, 'POST', { content: source });
        assert.equal(imported.created, 2);
        for (const member of [editor, reviewer]) {
            await request(path + '/import', member.token, 'POST', { content: source }, 403);
            await request(path + '/members', member.token, 'POST', { email: outsider.email, role: 'EDITOR' }, 403);
        }
        const data = await request(path, editor.token);
        assert.equal(data.currentUserRole, 'EDITOR');
        const login = data.translationKeys.find((key) => key.key === 'auth.login').translations[0];
        const pass = data.translationKeys.find((key) => key.key === 'auth.password').translations[0];
        const translationPath = (id) => path + '/translations/' + id;
        await request(translationPath(login.id), owner.token, 'PATCH', { value: 'Увійти', status: 'TRANSLATED' }, 403);
        await request(translationPath(login.id), editor.token, 'PATCH', { value: 'Увійти', status: 'TRANSLATED' });
        await request(translationPath(pass.id), editor.token, 'PATCH', { value: 'Код', status: 'TRANSLATED' });
        await request(translationPath(login.id), editor.token, 'PATCH', { value: 'Увійти', status: 'REVIEWED' }, 403);
        await request(translationPath(login.id), reviewer.token, 'PATCH', { value: 'Змінено', status: 'REVIEWED' }, 403);
        await request(translationPath(login.id), reviewer.token, 'PATCH', { value: 'Увійти', status: 'REVIEWED' });
        await request(translationPath(pass.id), reviewer.token, 'PATCH', { value: 'Код', status: 'NEEDS_REVISION', reviewReason: 'Використай термін «Пароль»' });
        const returned = await request(path, editor.token);
        assert.equal(returned.translationKeys.find((key) => key.key === 'auth.password').translations[0].reviewReason, 'Використай термін «Пароль»');
        await request(translationPath(pass.id), editor.token, 'PATCH', { value: 'Пароль', status: 'TRANSLATED' });
        await request(translationPath(pass.id), reviewer.token, 'PATCH', { value: 'Пароль', status: 'REVIEWED' });
        const proposed = await request(path + '/glossary', editor.token, 'POST', { term: 'Sign in', translation: 'Увійти', definition: 'Вхід до акаунта', localeCode: 'uk' }, 201);
        assert.equal(proposed.status, 'PENDING');
        for (const member of [owner, editor]) await request(path + '/glossary/' + proposed.id + '/review', member.token, 'PATCH', { action: 'approve', updatedAt: proposed.updatedAt }, 403);
        await request(path + '/glossary/' + proposed.id + '/review', reviewer.token, 'PATCH', { action: 'approve', updatedAt: proposed.updatedAt });
        const glossary = await request(path + '/glossary', editor.token);
        assert.equal(glossary[0].status, 'APPROVED');
        assert.equal(glossary[0].reviewerName, reviewer.user.name);
        await request(path + '/glossary', outsider.token, 'GET', undefined, 404);
        const final = await request(path, owner.token);
        const history = final.translationKeys.find((key) => key.key === 'auth.password').translations[0].history;
        assert.deepEqual(history.map((item) => item.status), ['REVIEWED', 'TRANSLATED', 'NEEDS_REVISION', 'TRANSLATED']);
        assert.ok(history.every((item) => [editor.user.id, reviewer.user.id].includes(item.actorId)));
        const exported = await request(path + '/export/uk', owner.token);
        assert.deepEqual(exported, { auth: { login: 'Увійти', password: 'Пароль' } });
        await request(path + '/members/' + editorMember.id, owner.token, 'DELETE', undefined, 204);
        await request(path, editor.token, 'GET', undefined, 404);
        await request(path + '/members', owner.token, 'POST', { email: editor.email, role: 'EDITOR' }, 201);
        await request('/auth/logout', outsider.token, 'POST', undefined, 204);
        await request('/auth/me', outsider.token, 'GET', undefined, 401);
        console.log('PASS: HTTP auth, import, roles, translations, review, glossary, history, export, access revocation, logout');
        success = true;
        // --keep залишає тільки цей набір для перевірки через браузер; токени не друкуємо.
        if (keep) console.log(JSON.stringify({ projectId: project.id, name: project.name, users: users.map(({ user, role, email }) => ({ id: user.id, role, email })), password }));
        return { projectId: project.id };
    } finally {
        if (!keep || !success) await cleanup(users.map(({ user }) => user.id));
        await new Promise((resolve) => server.close(resolve));
    }
}

if (require.main === module) checkWorkflow({ keep: process.argv.includes('--keep') })
    .catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
module.exports = { checkWorkflow, cleanup };
