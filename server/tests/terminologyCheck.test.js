// Тут окремо перевіряю пошук термінів, щоб зміни словника не ламали перевірку перекладу.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { containsTerm, checkTerminology } = require('../src/services/terminologyCheck')

test('терміни враховують межі слів, регістр і пробіли', () => {
  assert.equal(containsTerm('Your ACCOUNT.', 'account'), true)
  assert.equal(containsTerm('accounting', 'account'), false)
  assert.equal(containsTerm('Мій обліковий   запис!', 'обліковий запис'), true)
  assert.equal(containsTerm('акаунт', 'обліковий запис'), false)
  assert.equal(containsTerm('обліковий записаний', 'обліковий запис'), false)
})

test('перевірка повертає рекомендацію лише за наявності терміна в оригіналі', async () => {
  const db = {
    glossaryEntry: {
      findMany: async (query) => {
        assert.deepEqual(query.where, {
          status: 'APPROVED',
          localeId: 2,
          concept: { projectId: 1 }
        })
        return [{ concept: { term: 'account' }, translation: 'обліковий запис' }]
      }
    }
  }
  assert.deepEqual(await checkTerminology(db, 1, 2, 'Your account', 'Ваш акаунт'), [
    { term: 'account', translation: 'обліковий запис' }
  ])
  assert.deepEqual(await checkTerminology(db, 1, 2, 'Your account', 'Ваш обліковий запис'), [])
  assert.deepEqual(await checkTerminology(db, 1, 2, 'Your profile', 'Ваш профіль'), [])
  assert.deepEqual(
    await checkTerminology(
      db,
      1,
      2,
      'Add a new address',
      'Додати нову адресу',
      'account.addresses.add'
    ),
    [{ term: 'account', translation: 'обліковий запис' }]
  )
})
