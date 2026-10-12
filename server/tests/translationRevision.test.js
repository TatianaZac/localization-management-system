// Перевіряємо правила рецензування без зміни реальних проєктів у базі.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const prismaPath = require.resolve('../src/prisma')
const saved = {
  id: 1,
  value: 'Текст',
  sourceVersion: 2,
  currentVersion: 3,
  versions: [
    {
      id: 13,
      number: 3,
      value: 'Текст',
      sourceVersion: 2,
      status: 'TRANSLATED'
    },
    {
      id: 12,
      number: 2,
      value: 'Попередній текст',
      sourceVersion: 2,
      status: 'TRANSLATED'
    },
    {
      id: 11,
      number: 1,
      value: 'Старий текст',
      sourceVersion: 1,
      status: 'REVIEWED'
    }
  ],
  locale: { isSource: false },
  translationKey: { sourceTexts: [{ version: 2 }] }
}
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    translation: {
      findFirst: async () => saved,
      update: async ({ data }) => ({ ...saved, ...data })
    },
    // У цих тестах термінів немає, але контролер все одно виконує перевірку словника.
    glossaryEntry: { findMany: async () => [] }
  }
}
const { updateTranslation } = require('../src/controllers/translationsController')

// Імітує запит до контролера та збирає HTTP-статус і відповідь.
async function send(role, status, reviewReason, value = 'Текст', versionNumber) {
  let code = 200
  let body
  const res = {
    status(nextCode) {
      code = nextCode
      return this
    },
    json(data) {
      body = data
      return this
    }
  }
  await updateTranslation(
    {
      params: { projectId: '1', translationId: '1' },
      user: { id: 7, name: 'Тестовий учасник' },
      projectRole: role,
      body: { value, status, reviewReason, versionNumber }
    },
    res,
    (error) => {
      throw error
    }
  )
  return { code, body }
}

test('рецензент повертає текст із причиною, зберігаючи його версію', async () => {
  const { code, body } = await send('REVIEWER', 'NEEDS_REVISION', 'Уточни термін')
  assert.equal(code, 200)
  assert.equal(body.status, 'NEEDS_REVISION')
  assert.equal(body.reviewReason, 'Уточни термін')
  assert.equal(body.sourceVersion, 2)
  assert.equal(body.currentVersion, 3)
  assert.equal(body.value, saved.value)
  assert.equal(body.history.create.actorId, 7)
  assert.equal(body.history.create.actorName, 'Тестовий учасник')
  assert.equal(body.history.create.actorRole, 'REVIEWER')
  assert.equal(body.history.create.reviewReason, 'Уточни термін')
})
test("причина обов'язкова й обмежена 2000 символами", async () => {
  for (const reason of [undefined, '   ', 'x'.repeat(2001)]) {
    assert.equal((await send('REVIEWER', 'NEEDS_REVISION', reason)).code, 400)
  }
})
test('власник і редактор не можуть повертати переклад', async () => {
  for (const role of ['OWNER', 'EDITOR']) {
    assert.equal((await send(role, 'NEEDS_REVISION', 'Причина')).code, 403)
  }
})
test('рецензент не може підміняти текст або повертати порожній', async () => {
  assert.equal((await send('REVIEWER', 'NEEDS_REVISION', 'Причина', 'Інший текст')).code, 403)
  assert.equal((await send('REVIEWER', 'NEEDS_REVISION', 'Причина', '')).code, 400)
})
test('редактор повторно подає переклад, очищаючи причину', async () => {
  const { code, body } = await send('EDITOR', 'TRANSLATED', undefined, 'Виправлено')
  assert.equal(code, 200)
  assert.equal(body.reviewReason, null)
  assert.equal(body.status, 'TRANSLATED')
  assert.equal(body.sourceVersion, 2)
  assert.equal(body.currentVersion, 4)
  assert.equal(body.versions.create.number, 4)
  assert.equal(body.versions.create.authorName, 'Тестовий учасник')
  assert.equal(body.history.create.actorRole, 'EDITOR')
  assert.equal(body.history.create.value, 'Виправлено')
})
test('переклад із пробілами наприкінці не зберігається', async () => {
  for (const value of ['Текст ', 'Текст\t', 'Текст\n']) {
    const { code, body } = await send('EDITOR', 'TRANSLATED', undefined, value)
    assert.equal(code, 400)
    assert.equal(body.error, 'Прибери пробіли наприкінці перекладу')
  }
})
test('затвердження рецензентом залишається доступним', async () => {
  const { code, body } = await send('REVIEWER', 'REVIEWED')
  assert.equal(code, 200)
  assert.equal(body.status, 'REVIEWED')
  assert.equal(body.reviewReason, null)
})

test('рецензент може обрати не поточну версію для затвердження', async () => {
  const { code, body } = await send('REVIEWER', 'REVIEWED', undefined, 'Попередній текст', 2)
  assert.equal(code, 200)
  assert.equal(body.value, 'Попередній текст')
  assert.equal(body.currentVersion, 2)
  assert.equal(body.versions.update.where.id, 12)
  assert.equal(body.versions.update.data.reviewerName, 'Тестовий учасник')
})

test('версію для старої редакції оригіналу не можна затвердити', async () => {
  const { code } = await send('REVIEWER', 'REVIEWED', undefined, 'Старий текст', 1)
  assert.equal(code, 409)
})
