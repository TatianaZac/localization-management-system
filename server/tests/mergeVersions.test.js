const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const prisma = require('../src/prisma')
const app = require('../src/app')
const { hashPassword } = require('../src/utils/passwords')

test('merge створює нову версію та не змінює батьківські знімки', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const tag = randomUUID()
  let projectId
  let userId

  async function request(path, token, method = 'GET', body, status = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const data = await response.json().catch(() => null)
    assert.equal(response.status, status, JSON.stringify({ path, data }))
    return data
  }

  try {
    const email = `merge-${tag}@example.invalid`
    const user = await prisma.user.create({
      data: {
        name: 'Merge owner',
        email,
        passwordHash: await hashPassword('Merge-test-password!')
      }
    })
    userId = user.id
    const session = await request('/auth/login', null, 'POST', {
      email,
      password: 'Merge-test-password!'
    })
    const project = await request(
      '/projects',
      session.token,
      'POST',
      { name: 'Merge test ' + tag },
      201
    )
    projectId = project.id
    await request(
      `/projects/${projectId}/locales`,
      session.token,
      'POST',
      { code: 'uk', name: 'Українська' },
      201
    )

    const v1 = await request(`/projects/${projectId}/import`, session.token, 'POST', {
      pageName: 'Product',
      fileName: 'product-v1.json',
      content: {
        _localization: { sourceLocale: 'en', targetLocale: 'uk' },
        source: { keep: 'Keep', choose: 'Old source', removed: 'Removed' },
        translation: { keep: 'Тримати', choose: 'Старий', removed: 'Видалений' }
      }
    })
    const v2 = await request(`/projects/${projectId}/import`, session.token, 'POST', {
      pageId: v1.pageId,
      fileName: 'product-v2.json',
      content: {
        _localization: { sourceLocale: 'en', targetLocale: 'uk' },
        source: { keep: 'Keep', choose: 'New source', added: 'Added' },
        translation: { keep: 'Тримати', choose: 'Новий', added: 'Доданий' }
      }
    })

    const merged = await request(
      `/projects/${projectId}/merge`,
      session.token,
      'POST',
      {
        pageId: v1.pageId,
        targetVersionId: v1.versionId,
        incomingVersionId: v2.versionId,
        localeCode: 'uk',
        decisions: { keep: 'incoming', choose: 'target' }
      },
      201
    )
    assert.equal(merged.versionNumber, 3)
    assert.equal(merged.summary.type, 'MERGE')
    assert.deepEqual(merged.summary.mergedFrom.targetVersionNumber, 1)
    assert.deepEqual(merged.summary.mergedFrom.incomingVersionNumber, 2)

    const result = await request(
      `/projects/${projectId}?pageId=${v1.pageId}&versionId=${merged.versionId}`,
      session.token
    )
    const values = Object.fromEntries(
      result.translationKeys.map((key) => [
        key.key,
        {
          source: key.sourceTexts.find((source) => source.isCurrent).value,
          translation: key.translations.find((translation) => translation.locale.code === 'uk')
            .value
        }
      ])
    )
    assert.deepEqual(values, {
      added: { source: 'Added', translation: 'Доданий' },
      choose: { source: 'Old source', translation: 'Старий' },
      keep: { source: 'Keep', translation: 'Тримати' }
    })

    const parentV1 = await request(
      `/projects/${projectId}?pageId=${v1.pageId}&versionId=${v1.versionId}`,
      session.token
    )
    const parentV2 = await request(
      `/projects/${projectId}?pageId=${v1.pageId}&versionId=${v2.versionId}`,
      session.token
    )
    assert.deepEqual(
      parentV1.translationKeys.map((key) => key.key),
      ['choose', 'keep', 'removed']
    )
    assert.deepEqual(
      parentV2.translationKeys.map((key) => key.key),
      ['added', 'choose', 'keep']
    )

    const mergedAgain = await request(
      `/projects/${projectId}/merge`,
      session.token,
      'POST',
      {
        pageId: v1.pageId,
        targetVersionId: v1.versionId,
        incomingVersionId: v2.versionId,
        localeCode: 'uk',
        decisions: {}
      },
      201
    )
    assert.equal(mergedAgain.versionNumber, 4)
    const mergedAgainData = await request(
      `/projects/${projectId}?pageId=${v1.pageId}&versionId=${mergedAgain.versionId}`,
      session.token
    )
    const mergedChoice = mergedAgainData.translationKeys
      .find((key) => key.key === 'choose')
      .translations.find((translation) => translation.locale.code === 'uk')
    assert.equal(mergedChoice.value, 'Новий')
    assert.equal(mergedChoice.status, 'OUTDATED')
  } finally {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    await new Promise((resolve) => server.close(resolve))
  }
})
