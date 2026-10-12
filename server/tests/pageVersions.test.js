// Окремий тест нової версійності; створює й видаляє лише власний тимчасовий проєкт.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const prisma = require('../src/prisma')
const app = require('../src/app')

test('сторінки, незалежні версії, перенесення перекладів та експорт знімків', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const userIds = []
  let projectId
  const tag = randomUUID()
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
    const users = []
    // Створення через Prisma не запускає одноразове призначення старих проєктів першому користувачу.
    const { hashPassword } = require('../src/utils/passwords')
    for (const role of ['owner', 'editor', 'reviewer']) {
      const email = `versions-${tag}-${role}@example.invalid`
      const user = await prisma.user.create({
        data: {
          name: 'QA versions',
          email,
          passwordHash: await hashPassword('QA-versions-only!')
        }
      })
      userIds.push(user.id)
      users.push(
        await request('/auth/login', null, 'POST', {
          email,
          password: 'QA-versions-only!'
        })
      )
    }
    const [owner, editor, reviewer] = users
    const project = await request(
      '/projects',
      owner.token,
      'POST',
      { name: 'QA versions ' + tag },
      201
    )
    projectId = project.id
    const path = '/projects/' + projectId
    const ukrainian = await request(
      path + '/locales',
      owner.token,
      'POST',
      { code: 'uk', name: 'Українська' },
      201
    )
    for (const [user, role] of [
      [editor, 'EDITOR'],
      [reviewer, 'REVIEWER']
    ]) {
      await request(
        path + '/members',
        owner.token,
        'POST',
        { email: user.user.email, role, localeIds: [ukrainian.id] },
        201
      )
    }
    const members = await request(path + '/members', owner.token)
    assert.equal(members.members.length, 2)
    assert.deepEqual(
      members.members.map((member) => member.locales.map((locale) => locale.code)),
      [['uk'], ['uk']]
    )
    const reviewerMember = members.members.find((member) => member.role === 'REVIEWER')
    const reviewerWithoutLocales = await request(
      path + '/members/' + reviewerMember.id,
      owner.token,
      'PATCH',
      { localeIds: [] }
    )
    assert.deepEqual(reviewerWithoutLocales.locales, [])
    const restrictedProject = await request(path, reviewer.token)
    assert.deepEqual(
      restrictedProject.locales.filter((locale) => !locale.isSource),
      []
    )
    await request(path + '/members/' + reviewerMember.id, owner.token, 'PATCH', {
      localeIds: [ukrainian.id]
    })
    const content = { account: { save: 'Save', cancel: 'Cancel', old: 'Old' } }
    await request(path + '/import', editor.token, 'POST', { content, pageName: 'Account' }, 403)
    const v1 = await request(path + '/import', owner.token, 'POST', {
      content: {
        _localization: { sourceLocale: 'en', targetLocale: 'uk' },
        source: content,
        translation: {
          account: { save: 'Зберегти', cancel: 'Скасувати', old: 'Старе' }
        }
      },
      pageName: 'Account',
      fileName: 'account.json'
    })
    assert.equal(v1.importedLocaleCode, 'uk')
    assert.equal(v1.importedTranslations, 3)
    let data = await request(path, editor.token)
    const key = (data, name) => data.translationKeys.find((k) => k.key === name)
    const translation = (data, name) =>
      key(data, name).translations.find((t) => t.locale.code === 'uk')
    assert.equal(translation(data, 'account.old').value, 'Старе')
    assert.equal(translation(data, 'account.old').status, 'TRANSLATED')
    assert.equal(translation(data, 'account.old').currentVersion, 1)
    assert.equal(translation(data, 'account.old').versions[0].authorName, owner.user.name)
    assert.equal(translation(data, 'account.old').versions[0].sourceVersion, 1)
    for (const [name, value] of [
      ['account.save', 'Зберегти'],
      ['account.cancel', 'Скасувати']
    ]) {
      const id = translation(data, name).id
      await request(path + '/translations/' + id, editor.token, 'PATCH', {
        value,
        status: 'TRANSLATED'
      })
      await request(path + '/translations/' + id, reviewer.token, 'PATCH', {
        value,
        status: 'REVIEWED'
      })
    }
    // Рецензент може повернутися до попередньої версії перекладу й зробити її поточною.
    data = await request(path, editor.token)
    const cancelId = translation(data, 'account.cancel').id
    await request(path + '/translations/' + cancelId, editor.token, 'PATCH', {
      value: 'Відмінити',
      status: 'TRANSLATED'
    })
    const selectedOlderVersion = await request(
      path + '/translations/' + cancelId,
      reviewer.token,
      'PATCH',
      { value: 'Скасувати', status: 'REVIEWED', versionNumber: 2 }
    )
    assert.equal(selectedOlderVersion.value, 'Скасувати')
    assert.equal(selectedOlderVersion.currentVersion, 2)
    assert.equal(selectedOlderVersion.versions[0].number, 3)
    assert.equal(selectedOlderVersion.versions[1].reviewerName, reviewer.user.name)
    const original = await request(path, owner.token)
    const v2 = await request(path + '/import', owner.token, 'POST', {
      pageId: v1.pageId,
      fileName: 'account-v2.json',
      versionName: '  Оновлення профілю  ',
      content: {
        account: { save: 'Save changes', cancel: 'Cancel', added: 'New' }
      }
    })
    assert.deepEqual(
      [v2.versionNumber, v2.created, v2.updated, v2.removed, v2.unchanged],
      [2, 1, 1, 1, 1]
    )
    data = await request(path + '?pageId=' + v1.pageId, editor.token)
    assert.equal(data.selectedVersionId, v2.versionId)
    assert.equal(v2.versionName, 'Оновлення профілю')
    assert.equal(data.pages.find((p) => p.id === v1.pageId).versions[0].name, 'Оновлення профілю')
    for (const versionName of ['', '   ', 'x'.repeat(101), 42]) {
      await request(
        path + '/import',
        owner.token,
        'POST',
        { pageId: v1.pageId, content, versionName },
        400
      )
    }
    assert.equal(translation(data, 'account.save').status, 'OUTDATED')
    assert.equal(translation(data, 'account.cancel').status, 'REVIEWED')
    assert.equal(translation(data, 'account.added').status, 'NEW')
    assert.equal(key(data, 'account.old'), undefined)
    assert.notEqual(translation(data, 'account.save').id, translation(original, 'account.save').id)
    const archivedQuery = `?pageId=${v1.pageId}&versionId=${v1.versionId}`
    const archived = await request(path + archivedQuery, editor.token)
    assert.equal(archived.isLatestVersion, false)
    assert.deepEqual(archived.translationKeys, original.translationKeys)
    const oldId = translation(archived, 'account.save').id
    // Стару версію можна виправляти й перевіряти, не змінюючи нову та її оригінал.
    await request(
      path + '/translations/' + oldId,
      owner.token,
      'PATCH',
      { value: 'Зберегти файл' },
      403
    )
    await request(
      path + '/translations/' + oldId,
      reviewer.token,
      'PATCH',
      { value: 'Зберегти файл' },
      403
    )
    const editedOld = await request(path + '/translations/' + oldId, editor.token, 'PATCH', {
      value: 'Зберегти файл'
    })
    assert.equal(editedOld.status, 'TRANSLATED')
    assert.equal(editedOld.history[0].actorId, editor.user.id)
    assert.equal(editedOld.history[0].value, 'Зберегти файл')
    await request(
      path + '/translations/' + oldId,
      editor.token,
      'PATCH',
      { value: 'Зберегти файл', status: 'REVIEWED' },
      403
    )
    const reviewedOld = await request(path + '/translations/' + oldId, reviewer.token, 'PATCH', {
      value: 'Зберегти файл',
      status: 'REVIEWED'
    })
    assert.equal(reviewedOld.status, 'REVIEWED')
    await request(path + '/translations/' + oldId + '/comment', editor.token, 'PATCH', {
      comment: 'Виправлено для старого релізу'
    })
    const updatedOld = await request(path + archivedQuery, owner.token)
    assert.deepEqual(
      key(updatedOld, 'account.save').sourceTexts,
      key(original, 'account.save').sourceTexts
    )
    assert.deepEqual(
      (await request(path + '?pageId=' + v1.pageId, owner.token)).translationKeys,
      data.translationKeys
    )
    const latestId = translation(data, 'account.save').id
    await request(path + '/translations/' + latestId, editor.token, 'PATCH', {
      value: 'Зберегти зміни'
    })
    assert.deepEqual(await request(path + '/export/uk' + archivedQuery, owner.token), {
      account: { save: 'Зберегти файл', cancel: 'Скасувати', old: 'Старе' }
    })
    assert.deepEqual(await request(path + '/export/uk?pageId=' + v1.pageId, owner.token), {
      account: { save: 'Зберегти зміни', cancel: 'Скасувати', added: '' }
    })
    const home = await request(path + '/import', owner.token, 'POST', {
      pageName: 'Main',
      content: { account: { save: 'Different page' } }
    })
    assert.equal(home.versionNumber, 1)
    const homeData = await request(path + '?pageId=' + home.pageId, owner.token)
    assert.equal(homeData.translationKeys.length, 1)
    assert.equal(translation(homeData, 'account.save').value, null)
    assert.deepEqual(await request(path + '/export/uk?pageId=' + home.pageId, owner.token), {
      account: { save: '' }
    })
    await request(
      path + `?pageId=${home.pageId}&versionId=${v1.versionId}`,
      owner.token,
      'GET',
      undefined,
      404
    )
    await request(path + '/import', owner.token, 'POST', { content }, 400)
    await request(path + '/import', owner.token, 'POST', { pageName: 'Main', content }, 409)
    await request(path + '/import', owner.token, 'POST', { pageId: -1, content }, 400)
    await request(path + '/import', owner.token, 'POST', { pageName: 'Broken', content: [] }, 400)
    assert.equal((await request(path, owner.token)).pages.length, 2)
    // Повтор того самого файлу є окремим завантаженням, але без змінених рядків.
    const home2 = await request(path + '/import', owner.token, 'POST', {
      pageId: home.pageId,
      content: { account: { save: 'Different page' } }
    })
    assert.equal(home2.versionNumber, 2)
    assert.equal(home2.unchanged, 1)
    const projects = await request('/projects', owner.token)
    assert.equal(projects.find((p) => p.id === projectId).keyCount, 4)
    await request(path + '/locales', owner.token, 'POST', { code: 'de', name: 'Deutsch' }, 201)
    assert.deepEqual(await request(path + '/export/de' + archivedQuery, owner.token), {
      account: { save: '', cancel: '', old: '' }
    })
    // Видалення доступне лише власнику, не стирає історію й не перевикористовує номери.
    for (const member of [editor, reviewer]) {
      await request(path + '/versions/' + v2.versionId, member.token, 'DELETE', undefined, 403)
    }
    const deletion = await request(path + '/versions/' + v2.versionId, owner.token, 'DELETE')
    assert.equal(deletion.versionId, v1.versionId)
    const restored = await request(path + '?pageId=' + v1.pageId, owner.token)
    assert.equal(restored.selectedVersionId, v1.versionId)
    assert.equal(restored.isLatestVersion, true)
    assert.deepEqual(
      restored.translationKeys,
      updatedOld.translationKeys.map((k) => ({
        ...k,
        translations: [
          ...k.translations,
          ...restored.translationKeys
            .find((r) => r.id === k.id)
            .translations.filter((t) => t.locale.code === 'de')
        ]
      }))
    )
    const deletedQuery = `?pageId=${v1.pageId}&versionId=${v2.versionId}`
    await request(path + deletedQuery, owner.token, 'GET', undefined, 404)
    await request(path + '/export/uk' + deletedQuery, owner.token, 'GET', undefined, 404)
    await request(
      path + '/translations/' + latestId,
      editor.token,
      'PATCH',
      { value: 'Не можна' },
      409
    )
    await request(
      path + '/translations/' + latestId + '/comment',
      editor.token,
      'PATCH',
      { comment: 'Не можна' },
      409
    )
    assert.ok((await prisma.pageVersion.findUnique({ where: { id: v2.versionId } })).deletedAt)
    assert.ok(await prisma.translation.findUnique({ where: { id: latestId } }))
    await request(path + '/versions/' + v1.versionId, owner.token, 'DELETE', undefined, 409)
    const v3 = await request(path + '/import', owner.token, 'POST', {
      pageId: v1.pageId,
      content
    })
    assert.equal(v3.versionNumber, 3)
    // Реальне збереження повертає попередження й одночасно записує автора в історію.
    const v3Data = await request(path + '?pageId=' + v1.pageId, owner.token)
    const uk = v3Data.locales.find((locale) => locale.code === 'uk')
    await prisma.glossaryConcept.create({
      data: {
        projectId,
        term: 'Save',
        normalizedTerm: 'save',
        entries: {
          create: {
            localeId: uk.id,
            translation: 'Зберегти',
            status: 'APPROVED'
          }
        }
      }
    })
    const checkId = translation(v3Data, 'account.save').id
    const warned = await request(path + '/translations/' + checkId, editor.token, 'PATCH', {
      value: 'Зберігати'
    })
    assert.deepEqual(warned.terminologyWarnings, [{ term: 'Save', translation: 'Зберегти' }])
    assert.equal(warned.value, 'Зберігати')
    assert.equal(warned.history[0].actorId, editor.user.id)
    assert.ok(warned.history[0].createdAt)
    const corrected = await request(path + '/translations/' + checkId, editor.token, 'PATCH', {
      value: 'Зберегти'
    })
    assert.deepEqual(corrected.terminologyWarnings, [])
    await request(path + '/versions/' + v1.versionId, owner.token, 'DELETE')
    assert.equal(
      (await request(path + '?pageId=' + v1.pageId, owner.token)).selectedVersionId,
      v3.versionId
    )
    assert.equal(
      (await request(path + '?pageId=' + home.pageId, owner.token)).selectedVersionId,
      home2.versionId
    )
  } finally {
    if (projectId) await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: { id: { in: userIds }, email: { endsWith: '@example.invalid' } }
    })
    await new Promise((resolve) => server.close(resolve))
    await prisma.$disconnect()
  }
})
