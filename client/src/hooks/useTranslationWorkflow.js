import { useEffect, useState } from 'react'
import { updateTranslation } from '../api/localizationApi'

export default function useTranslationWorkflow({
  project,
  projectId,
  selectedTranslation,
  setError,
  setNotice,
  setProject
}) {
  const [terminologyWarning, setTerminologyWarning] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewReasonDraft, setReviewReasonDraft] = useState('')

  useEffect(() => setReviewReasonDraft(''), [selectedTranslation?.id])

  function replaceTranslation(updatedTranslation) {
    setProject((currentProject) => ({
      ...currentProject,
      translationKeys: currentProject.translationKeys.map((translationKey) => ({
        ...translationKey,
        translations: translationKey.translations.map((translation) =>
          translation.id === updatedTranslation.id
            ? { ...translation, ...updatedTranslation }
            : translation
        )
      }))
    }))
  }

  async function saveTranslation(translationId, value, status, reviewReason, versionNumber) {
    setTerminologyWarning('')
    setError('')
    setNotice('')
    try {
      const updated = await updateTranslation(
        projectId,
        translationId,
        value,
        status,
        reviewReason,
        versionNumber
      )
      replaceTranslation(updated)
      if (updated.terminologyWarnings?.length) {
        const key =
          project.translationKeys.find((item) =>
            item.translations.some((translation) => translation.id === translationId)
          )?.key ?? ''
        setTerminologyWarning(
          `«${key}»: переклад збережено, але не знайдено рекомендовані терміни: ${updated.terminologyWarnings.map((item) => `${item.term} → ${item.translation}`).join('; ')}.`
        )
      }
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }

  async function approveTranslation(versionNumber) {
    const version = selectedTranslation?.versions.find((item) => item.number === versionNumber)
    if (
      project?.currentUserRole !== 'REVIEWER' ||
      !version?.value?.trim() ||
      (selectedTranslation.currentVersion === version.number &&
        selectedTranslation.status === 'REVIEWED') ||
      isReviewing
    )
      return

    const translation = selectedTranslation
    setIsReviewing(true)
    try {
      await saveTranslation(translation.id, version.value, 'REVIEWED', undefined, version.number)
    } finally {
      setIsReviewing(false)
    }
  }

  async function returnTranslation(versionNumber) {
    const version = selectedTranslation?.versions.find((item) => item.number === versionNumber)
    if (
      project?.currentUserRole !== 'REVIEWER' ||
      !version?.value?.trim() ||
      !reviewReasonDraft.trim() ||
      isReviewing
    )
      return

    const translation = selectedTranslation
    setIsReviewing(true)
    try {
      await saveTranslation(
        translation.id,
        version.value,
        'NEEDS_REVISION',
        reviewReasonDraft.trim(),
        version.number
      )
    } finally {
      setIsReviewing(false)
    }
  }

  return {
    approveTranslation,
    isReviewing,
    returnTranslation,
    reviewReasonDraft,
    saveTranslation,
    setReviewReasonDraft,
    setTerminologyWarning,
    terminologyWarning
  }
}
