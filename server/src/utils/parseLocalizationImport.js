// Один файл може містити лише оригінали або готову пару «оригінал + переклад».

const { flattenLocalizationObject } = require('./flattenLocalization')
const { getLocaleCode, isValidLocaleCode } = require('./validation')

function invalid(message) {
  const error = new Error(message)
  error.status = 400
  throw error
}

function parseLocalizationImport(content) {
  const metadata = content?._localization
  // Спеціальний формат визначаємо лише за службовим блоком, щоб звичайні ключі
  // source або translation і далі можна було використовувати у звичайному JSON.
  const isBundle = metadata !== undefined

  if (!isBundle) {
    return {
      sourceEntries: flattenLocalizationObject(content),
      importedTranslation: null
    }
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    invalid('У двомовному файлі відсутній блок _localization')
  }

  const sourceLocaleCode = getLocaleCode(metadata.sourceLocale)
  const targetLocaleCode = getLocaleCode(metadata.targetLocale)
  if (!isValidLocaleCode(sourceLocaleCode) || !isValidLocaleCode(targetLocaleCode)) {
    invalid('У двомовному файлі вкажи коректні sourceLocale і targetLocale')
  }
  if (sourceLocaleCode === targetLocaleCode) {
    invalid('Мова оригіналу й мова перекладу мають відрізнятися')
  }

  const sourceEntries = flattenLocalizationObject(content.source)
  const translationEntries = flattenLocalizationObject(content.translation)
  const sourceKeys = new Set(sourceEntries.map((entry) => entry.key))
  const translations = new Map(translationEntries.map((entry) => [entry.key, entry.value]))

  const missing = [...sourceKeys].filter((key) => !translations.has(key))
  const extra = [...translations.keys()].filter((key) => !sourceKeys.has(key))
  if (missing.length || extra.length) {
    invalid('Оригінал і переклад повинні містити однакові ключі')
  }

  return {
    sourceEntries,
    sourceLocaleCode,
    importedTranslation: {
      localeCode: targetLocaleCode,
      values: translations
    }
  }
}

module.exports = { parseLocalizationImport }
