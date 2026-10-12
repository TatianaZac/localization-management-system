import { useState } from 'react'
import { createLocale, deleteLocale, updateLocale } from '../api/localizationApi'

export default function useLocaleManagement({
  loadProject,
  projectId,
  setError,
  setIsSaving,
  setNotice,
  setProject,
  setSelectedLocaleCode
}) {
  const [showLocaleForm, setShowLocaleForm] = useState(false)
  const [showLocaleManager, setShowLocaleManager] = useState(false)
  const [localeCode, setLocaleCode] = useState('')
  const [localeName, setLocaleName] = useState('')

  async function addLocale(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const locale = await createLocale(projectId, { code: localeCode, name: localeName })
      await loadProject()
      setSelectedLocaleCode(locale.code)
      setLocaleCode('')
      setLocaleName('')
      setShowLocaleForm(false)
      setNotice('Мову перекладу додано.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function renameLocale(localeId, name) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const updatedLocale = await updateLocale(projectId, localeId, name)
      setProject((currentProject) => ({
        ...currentProject,
        locales: currentProject.locales.map((locale) =>
          locale.id === updatedLocale.id ? updatedLocale : locale
        ),
        translationKeys: currentProject.translationKeys.map((translationKey) => ({
          ...translationKey,
          translations: translationKey.translations.map((translation) =>
            translation.locale.code === updatedLocale.code
              ? { ...translation, locale: { ...translation.locale, name: updatedLocale.name } }
              : translation
          )
        }))
      }))
      setNotice('Назву мови оновлено.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function removeLocale(localeId) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await deleteLocale(projectId, localeId)
      await loadProject()
      setNotice('Мову та пов’язані з нею переклади видалено.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function selectLanguage(language) {
    setLocaleCode(language?.code ?? '')
    setLocaleName(language?.name ?? '')
  }

  return {
    addLocale,
    localeCode,
    removeLocale,
    renameLocale,
    selectLanguage,
    setShowLocaleForm,
    setShowLocaleManager,
    showLocaleForm,
    showLocaleManager
  }
}
