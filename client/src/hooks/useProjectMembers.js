import { useState } from 'react'
import {
  addProjectMember,
  deleteProjectMember,
  getProjectMembers,
  updateProjectMember
} from '../api/localizationApi'

export default function useProjectMembers({ projectId, setError, setIsSaving, setNotice }) {
  const [showMembers, setShowMembers] = useState(false)
  const [membersData, setMembersData] = useState(null)
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

  async function toggleMembers() {
    if (showMembers) {
      setShowMembers(false)
      return
    }
    setShowMembers(true)
    setError('')
    setIsLoadingMembers(true)
    try {
      setMembersData(await getProjectMembers(projectId))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoadingMembers(false)
    }
  }

  async function addMember(memberData) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const member = await addProjectMember(projectId, memberData)
      setMembersData((currentData) => ({
        ...currentData,
        members: [...currentData.members, member]
      }))
      setNotice('Учасника додано до проєкту.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function updateMember(memberId, changes, successMessage) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const updatedMember = await updateProjectMember(projectId, memberId, changes)
      setMembersData((currentData) => ({
        ...currentData,
        members: currentData.members.map((member) =>
          member.id === updatedMember.id ? updatedMember : member
        )
      }))
      setNotice(successMessage)
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function changeMemberRole(memberId, role) {
    return updateMember(memberId, { role }, 'Роль учасника змінено.')
  }

  function changeMemberLocales(memberId, localeIds) {
    return updateMember(memberId, { localeIds }, 'Мови учасника змінено.')
  }

  async function removeMember(memberId) {
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      await deleteProjectMember(projectId, memberId)
      setMembersData((currentData) => ({
        ...currentData,
        members: currentData.members.filter((member) => member.id !== memberId)
      }))
      setNotice('Доступ учасника відкликано.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return {
    addMember,
    changeMemberLocales,
    changeMemberRole,
    isLoadingMembers,
    membersData,
    removeMember,
    setShowMembers,
    showMembers,
    toggleMembers
  }
}
