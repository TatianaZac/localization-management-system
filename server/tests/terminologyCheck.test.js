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
    []
  )
})

test('контекст обирає значення лише за достатнього відриву', async () => {
  const entries = [
    {
      id: 1,
      conceptId: 10,
      concept: { term: 'order' },
      translation: 'замовлення',
      example: 'Your order has been shipped'
    },
    {
      id: 2,
      conceptId: 20,
      concept: { term: 'order' },
      translation: 'порядок',
      example: 'Put items in the correct order'
    }
  ]
  const db = { glossaryEntry: { findMany: async () => entries } }

  assert.deepEqual(await checkTerminology(db, 1, 2, 'Your order has been shipped', 'Ваш порядок'), [
    { term: 'order', translation: 'замовлення' }
  ])
  assert.deepEqual(await checkTerminology(db, 1, 2, 'The order was shipped', 'Ваш порядок'), [
    { term: 'order', translation: 'замовлення' }
  ])
  assert.deepEqual(await checkTerminology(db, 1, 2, 'Check the order', 'Перевірте'), [])
})

test('кожен контекст з нового рядка порівнюється окремо', async () => {
  const entries = [
    {
      id: 1,
      conceptId: 10,
      concept: { term: 'item' },
      translation: 'товар',
      example: 'This item is out of stock.\nAbout this item'
    },
    {
      id: 2,
      conceptId: 20,
      concept: { term: 'item' },
      translation: 'елемент',
      example: 'Select an item from the list.'
    }
  ]
  const db = { glossaryEntry: { findMany: async () => entries } }

  assert.deepEqual(await checkTerminology(db, 1, 2, 'About this item', 'Про елемент'), [
    { term: 'item', translation: 'товар' }
  ])
  assert.deepEqual(await checkTerminology(db, 1, 2, 'About this item', 'Про товар'), [])
})

test('повторні входження одного терміна оцінюються за власним контекстом', async () => {
  const entries = [
    {
      id: 1,
      conceptId: 10,
      concept: { term: 'order' },
      translation: 'упорядкуйте',
      example: 'Order the items alphabetically'
    },
    {
      id: 2,
      conceptId: 20,
      concept: { term: 'order' },
      translation: 'порядок',
      example: 'Use the order shown'
    }
  ]
  const db = { glossaryEntry: { findMany: async () => entries } }

  assert.deepEqual(
    await checkTerminology(
      db,
      1,
      2,
      'Order the items in the order shown',
      'Розмістіть елементи довільно'
    ),
    [
      { term: 'order', translation: 'упорядкуйте' },
      { term: 'order', translation: 'порядок' }
    ]
  )
  assert.deepEqual(
    await checkTerminology(
      db,
      1,
      2,
      'Order the items in the order shown',
      'Упорядкуйте елементи: порядок показано'
    ),
    []
  )
})

test('довше словосполучення не дублюється вкладеним коротким терміном', async () => {
  const db = {
    glossaryEntry: {
      findMany: async () => [
        {
          id: 1,
          conceptId: 10,
          concept: { term: 'purchase order' },
          translation: 'замовлення на закупівлю',
          example: ''
        },
        {
          id: 2,
          conceptId: 20,
          concept: { term: 'order' },
          translation: 'замовлення',
          example: ''
        }
      ]
    }
  }

  assert.deepEqual(await checkTerminology(db, 1, 2, 'Create a purchase order', 'Створити'), [
    { term: 'purchase order', translation: 'замовлення на закупівлю' }
  ])
})
