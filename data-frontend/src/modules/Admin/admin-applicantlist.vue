<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AdminSimpleModal from '@/modules/Admin/admin-simple-modal.vue'
import {
  deleteApplicantAccountRecord,
  updateApplicantAdminDetails,
  updateApplicantApprovalStatus,
  updateApplicantSortOrders,
} from '@/lib/auth'
import { mediaUrl } from '@/lib/media'

const props = defineProps({
  applicants: {
    type: Array,
    default: () => [],
  },
})

const applicantSearch = ref('')
const applicantStatusFilter = ref('all')
const activeModal = ref('')
const selectedApplicant = ref(null)
const editApplicantStatus = ref('pending')
const modalError = ref('')
const isSubmitting = ref(false)
const actionNotice = ref(null)
const isApprovalProcessing = ref(false)
const approvedApplicantName = ref('')
const deletingApplicantIds = ref([])
const selectMode = ref(false)
const selectedApplicantIds = ref([])
const isBulkDeletingApplicants = ref(false)
const applicantEditForm = ref({
  first_name: '',
  last_name: '',
  contact_number: '',
  disability_type: '',
  age: '',
})
const imagePreview = ref({
  open: false,
  src: '',
})
const draggedApplicantId = ref('')
const draggedOverApplicantId = ref('')
const draggedOverApplicantPosition = ref('after')
const previewApplicantOrderIds = ref([])
const isDeleteDropZoneActive = ref(false)
const isSavingApplicantOrder = ref(false)
const isDraggingApplicant = ref(false)
const freshApplicantIds = ref([])
let freshApplicantTimer = 0
let actionNoticeTimer = 0
let hasInitializedApplicants = false

const normalizeStatusValue = (value) => String(value || '').trim().toLowerCase()

const applicantDisplayName = (record) =>
  String(
    `${record?.first_name || ''} ${record?.last_name || ''}`.trim()
    || record?.name
    || record?.user?.name
    || 'Applicant',
  ).trim()

const applicantEmail = (record) =>
  String(record?.email || record?.user?.email || 'No email').trim() || 'No email'

const applicantInitials = (record) => {
  const parts = applicantDisplayName(record)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return 'AP'
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

const applicantAvatarUrl = (record) =>
  mediaUrl(String(
    record?.avatar
    || record?.avatar_url
    || record?.applicant_registration?.avatar
    || record?.applicantRegistration?.avatar
    || record?.user?.avatar
    || ''
  ).trim())

const formatApplicantDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const applicantAddress = (record) =>
  [
    record?.address_barangay,
    record?.address_city,
    record?.address_province,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ')
    || 'Not set'

const applicantRecordId = (record) => String(record?.id || '').trim()

const findApplicantById = (applicantId) =>
  (Array.isArray(props.applicants) ? props.applicants : []).find((record) => applicantRecordId(record) === applicantId) || null

const reorderApplicantRows = (rows, sourceApplicantId, targetApplicantId) => {
  const nextRows = [...rows]
  const sourceIndex = nextRows.findIndex((record) => applicantRecordId(record) === sourceApplicantId)
  const targetIndex = nextRows.findIndex((record) => applicantRecordId(record) === targetApplicantId)

  if (
    sourceIndex < 0
    || targetIndex < 0
    || sourceIndex === targetIndex
  ) {
    return nextRows
  }

  const [movedApplicant] = nextRows.splice(sourceIndex, 1)
  nextRows.splice(targetIndex, 0, movedApplicant)
  return nextRows
}

const reorderApplicantRowsByPlacement = (rows, sourceApplicantId, targetApplicantId, placement = 'after') => {
  const nextRows = [...rows]
  const sourceIndex = nextRows.findIndex((record) => applicantRecordId(record) === sourceApplicantId)
  const targetIndex = nextRows.findIndex((record) => applicantRecordId(record) === targetApplicantId)

  if (sourceIndex < 0 || targetIndex < 0 || sourceApplicantId === targetApplicantId) {
    return nextRows
  }

  const [movedApplicant] = nextRows.splice(sourceIndex, 1)
  const nextTargetIndex = nextRows.findIndex((record) => applicantRecordId(record) === targetApplicantId)
  const insertIndex = placement === 'before' ? nextTargetIndex : nextTargetIndex + 1
  nextRows.splice(Math.max(0, insertIndex), 0, movedApplicant)
  return nextRows
}

const sortApplicantRows = (rows) =>
  [...rows].sort((left, right) => {
    const leftOrder = Number(left?.sort_order)
    const rightOrder = Number(right?.sort_order)
    const leftHasOrder = Number.isFinite(leftOrder)
    const rightHasOrder = Number.isFinite(rightOrder)

    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1
    }

    const leftTime = Date.parse(left?.created_at || left?.submitted_at || '') || 0
    const rightTime = Date.parse(right?.created_at || right?.submitted_at || '') || 0
    return rightTime - leftTime
  })

const allApplicantsOrdered = computed(() =>
  sortApplicantRows(Array.isArray(props.applicants) ? props.applicants : []),
)

const allApplicantsPreviewOrdered = computed(() => {
  if (!previewApplicantOrderIds.value.length) return allApplicantsOrdered.value

  const orderedMap = new Map(
    allApplicantsOrdered.value.map((record) => [applicantRecordId(record), record]),
  )

  const previewRows = previewApplicantOrderIds.value
    .map((id) => orderedMap.get(id))
    .filter(Boolean)

  const previewIdSet = new Set(previewRows.map((record) => applicantRecordId(record)))
  const remainingRows = allApplicantsOrdered.value.filter((record) => !previewIdSet.has(applicantRecordId(record)))

  return [...previewRows, ...remainingRows]
})

const filteredApplicants = computed(() => {
  const rows = allApplicantsPreviewOrdered.value
  const search = String(applicantSearch.value || '').trim().toLowerCase()
  const status = String(applicantStatusFilter.value || 'all').trim().toLowerCase()

  return rows
    .filter((record) => !deletingApplicantIds.value.includes(applicantRecordId(record)))
    .filter((record) => {
      const matchesSearch = !search || [
        record?.first_name,
        record?.last_name,
        applicantEmail(record),
        record?.contact_number,
        record?.disability_type,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search))

      const matchesStatus = status === 'all' || normalizeStatusValue(record?.approval_status) === status
      return matchesSearch && matchesStatus
    })
})

const allFilteredApplicantIds = computed(() =>
  filteredApplicants.value
    .map((record) => applicantRecordId(record))
    .filter(Boolean),
)

const allApplicantsSelected = computed(() =>
  allFilteredApplicantIds.value.length > 0
  && allFilteredApplicantIds.value.every((id) => selectedApplicantIds.value.includes(id)),
)

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedApplicantIds.value = []
  }
}

const toggleApplicantSelection = (applicant) => {
  const applicantId = applicantRecordId(applicant)
  if (!applicantId) return

  selectedApplicantIds.value = selectedApplicantIds.value.includes(applicantId)
    ? selectedApplicantIds.value.filter((id) => id !== applicantId)
    : [...selectedApplicantIds.value, applicantId]
}

const toggleSelectAllApplicants = () => {
  selectedApplicantIds.value = allApplicantsSelected.value ? [] : [...allFilteredApplicantIds.value]
}

const clearFreshApplicantTimer = () => {
  if (typeof window === 'undefined' || !freshApplicantTimer) return
  window.clearTimeout(freshApplicantTimer)
  freshApplicantTimer = 0
}

const clearActionNoticeTimer = () => {
  if (typeof window === 'undefined' || !actionNoticeTimer) return
  window.clearTimeout(actionNoticeTimer)
  actionNoticeTimer = 0
}

const queueFreshApplicants = (ids) => {
  if (!ids.length) return

  freshApplicantIds.value = [...new Set([...freshApplicantIds.value, ...ids])]
  clearFreshApplicantTimer()

  if (typeof window !== 'undefined') {
    freshApplicantTimer = window.setTimeout(() => {
      freshApplicantIds.value = []
    }, 2200)
  }
}

const isFreshApplicant = (record) =>
  freshApplicantIds.value.includes(applicantRecordId(record))

watch(
  () => (Array.isArray(props.applicants) ? props.applicants.map(applicantRecordId).filter(Boolean) : []),
  (nextIds, previousIds = []) => {
    previewApplicantOrderIds.value = []
    deletingApplicantIds.value = deletingApplicantIds.value.filter((id) => nextIds.includes(id))

    if (!hasInitializedApplicants) {
      hasInitializedApplicants = true
      return
    }

    const previousIdSet = new Set(previousIds)
    const newIds = nextIds.filter((id) => !previousIdSet.has(id))
    queueFreshApplicants(newIds)
  },
  { immediate: true },
)

watch(allFilteredApplicantIds, (nextIds) => {
  selectedApplicantIds.value = selectedApplicantIds.value.filter((id) => nextIds.includes(id))
})

onBeforeUnmount(() => {
  clearFreshApplicantTimer()
  clearActionNoticeTimer()
})

const applicantModalTitle = computed(() => {
  if (activeModal.value === 'view') return 'Applicant Details'
  if (activeModal.value === 'approve') return 'Approve Applicant'
  if (activeModal.value === 'approve-success') return 'Applicant Approved'
  if (activeModal.value === 'edit') return 'Rename Applicant'
  if (activeModal.value === 'disable') return 'Disable Applicant'
  if (activeModal.value === 'delete') return 'Delete Applicant'
  return 'Applicant'
})

const applicantModalSubtitle = computed(() => {
  const applicant = selectedApplicant.value
  if (!applicant) return ''

  if (activeModal.value === 'view') {
    return `Review the account information for ${applicantDisplayName(applicant)}.`
  }

  if (activeModal.value === 'approve') {
    return `You are about to approve ${applicantDisplayName(applicant)} as a new PWD applicant.`
  }

  if (activeModal.value === 'approve-success') {
    return `${approvedApplicantName.value || applicantDisplayName(applicant)} can now continue after admin approval.`
  }

  if (activeModal.value === 'edit') {
    return `Rename or update the saved applicant details for ${applicantDisplayName(applicant)}.`
  }

  if (activeModal.value === 'disable') {
    return `This will block ${applicantDisplayName(applicant)} from using the account.`
  }

  if (activeModal.value === 'delete') {
    return `This will permanently delete ${applicantDisplayName(applicant)} from the platform.`
  }

  return ''
})

const applicantModalShowHeaderClose = computed(() => activeModal.value !== 'delete' && activeModal.value !== 'disable')

const applicantDetailRows = computed(() => {
  const applicant = selectedApplicant.value
  if (!applicant) return []

  return [
    { label: 'Name', value: applicantDisplayName(applicant) },
    { label: 'Email', value: applicantEmail(applicant) },
    { label: 'Contact', value: applicant?.contact_number || 'Not set' },
    { label: 'Status', value: applicant?.approval_status || 'pending' },
    { label: 'Disability', value: applicant?.disability_type || 'Not set' },
    { label: 'Birth Date', value: applicant?.birth_date || 'Not set' },
    { label: 'Age', value: applicant?.age || 'Not set' },
    { label: 'Address', value: applicantAddress(applicant) },
    { label: 'Preferred Language', value: applicant?.preferred_language || 'Not set' },
    { label: 'PWD ID', value: applicant?.pwd_id_number || 'Not set' },
    { label: 'Created', value: formatApplicantDate(applicant?.created_at || applicant?.submitted_at) },
  ]
})

const applicantVerificationAssets = computed(() => {
  const applicant = selectedApplicant.value
  if (!applicant) return []

  return [
    {
      label: 'Face Verification',
      path: String(applicant?.profile_image_path || '').trim(),
    },
    {
      label: 'PWD Front ID',
      path: String(applicant?.pwd_id_front_file_path || '').trim(),
    },
    {
      label: 'PWD Back ID',
      path: String(applicant?.pwd_id_back_file_path || '').trim(),
    },
  ]
})

const setActionNotice = (kind, text) => {
  actionNotice.value = { kind, text }
  clearActionNoticeTimer()

  if (typeof window !== 'undefined') {
    actionNoticeTimer = window.setTimeout(() => {
      actionNotice.value = null
      actionNoticeTimer = 0
    }, 2600)
  }
}

const actionNoticeTitle = computed(() =>
  actionNotice.value?.kind === 'error' ? 'Action failed' : 'Success',
)

const resetApplicantModal = () => {
  activeModal.value = ''
  selectedApplicant.value = null
  approvedApplicantName.value = ''
  editApplicantStatus.value = 'pending'
  modalError.value = ''
  applicantEditForm.value = {
    first_name: '',
    last_name: '',
    contact_number: '',
    disability_type: '',
    age: '',
  }
}

const openImagePreview = (asset) => {
  if (!asset?.path) return

  imagePreview.value = {
    open: true,
    src: asset.path,
  }
}

const closeImagePreview = () => {
  imagePreview.value = {
    open: false,
    src: '',
  }
}

const handleApplicantDragStart = (event, applicant) => {
  if (isSavingApplicantOrder.value) return

  const applicantId = applicantRecordId(applicant)
  if (!applicantId) return

  isDraggingApplicant.value = true
  draggedApplicantId.value = applicantId
  draggedOverApplicantId.value = applicantId
  draggedOverApplicantPosition.value = 'after'
  previewApplicantOrderIds.value = allApplicantsOrdered.value.map((record) => applicantRecordId(record))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', applicantId)
  }
}

const handleApplicantDragEnd = () => {
  isDraggingApplicant.value = false
  draggedApplicantId.value = ''
  draggedOverApplicantId.value = ''
  draggedOverApplicantPosition.value = 'after'
  previewApplicantOrderIds.value = []
  isDeleteDropZoneActive.value = false
}

const resolveApplicantDropPosition = (event) => {
  const targetRow = event.currentTarget
  if (!(targetRow instanceof HTMLElement)) return 'after'
  const rect = targetRow.getBoundingClientRect()
  const pointerY = Number(event.clientY) || rect.top
  return pointerY < rect.top + (rect.height / 2) ? 'before' : 'after'
}

const handleApplicantRowDragEnter = (event, applicant) => {
  if (!draggedApplicantId.value || isSavingApplicantOrder.value) return

  const applicantId = applicantRecordId(applicant)
  if (!applicantId || applicantId === draggedApplicantId.value) return

  event.preventDefault()
  const nextPosition = resolveApplicantDropPosition(event)
  if (draggedOverApplicantId.value === applicantId && draggedOverApplicantPosition.value === nextPosition) return

  draggedOverApplicantId.value = applicantId
  draggedOverApplicantPosition.value = nextPosition
  isDeleteDropZoneActive.value = false
  previewApplicantOrderIds.value = reorderApplicantRowsByPlacement(
    allApplicantsPreviewOrdered.value,
    draggedApplicantId.value,
    applicantId,
    nextPosition,
  ).map((record) => applicantRecordId(record))
}

const handleApplicantRowDragOver = (event, applicant) => {
  if (!draggedApplicantId.value || isSavingApplicantOrder.value) return

  event.preventDefault()
  const applicantId = applicantRecordId(applicant)
  if (applicantId && applicantId !== draggedApplicantId.value) {
    const nextPosition = resolveApplicantDropPosition(event)
    if (draggedOverApplicantId.value !== applicantId || draggedOverApplicantPosition.value !== nextPosition) {
      draggedOverApplicantId.value = applicantId
      draggedOverApplicantPosition.value = nextPosition
      previewApplicantOrderIds.value = reorderApplicantRowsByPlacement(
        allApplicantsPreviewOrdered.value,
        draggedApplicantId.value,
        applicantId,
        nextPosition,
      ).map((record) => applicantRecordId(record))
    }
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleApplicantRowDrop = async (event, applicant) => {
  event.preventDefault()

  const targetApplicantId = applicantRecordId(applicant)
  const sourceApplicantId = draggedApplicantId.value || event.dataTransfer?.getData('text/plain') || ''
  const targetPlacement = draggedOverApplicantPosition.value

  draggedApplicantId.value = ''
  draggedOverApplicantId.value = ''
  draggedOverApplicantPosition.value = 'after'
  isDeleteDropZoneActive.value = false

  if (
    !sourceApplicantId
    || !targetApplicantId
    || sourceApplicantId === targetApplicantId
    || isSavingApplicantOrder.value
  ) {
    previewApplicantOrderIds.value = []
    return
  }

  const orderedMap = new Map(
    allApplicantsOrdered.value.map((record) => [applicantRecordId(record), record]),
  )
  const nextApplicants = previewApplicantOrderIds.value.length
    ? previewApplicantOrderIds.value.map((id) => orderedMap.get(id)).filter(Boolean)
    : reorderApplicantRowsByPlacement(allApplicantsOrdered.value, sourceApplicantId, targetApplicantId, targetPlacement)
  const movedApplicant = nextApplicants.find((record) => applicantRecordId(record) === sourceApplicantId)

  if (!movedApplicant) {
    previewApplicantOrderIds.value = []
    return
  }

  isSavingApplicantOrder.value = true

  try {
    await updateApplicantSortOrders(nextApplicants.map((record) => applicantRecordId(record)))
    setActionNotice('success', `${applicantDisplayName(movedApplicant)} order was updated.`)
  } catch (error) {
    setActionNotice('error', String(error?.message || 'Unable to reorder applicants right now.'))
  } finally {
    previewApplicantOrderIds.value = []
    isSavingApplicantOrder.value = false
  }
}

const handleDeleteDropZoneDragOver = (event) => {
  if (!draggedApplicantId.value) return
  event.preventDefault()
  isDeleteDropZoneActive.value = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDeleteDropZoneDragLeave = () => {
  isDeleteDropZoneActive.value = false
}

const handleDeleteDropZoneDrop = (event) => {
  event.preventDefault()
  isDeleteDropZoneActive.value = false

  const applicantId = draggedApplicantId.value || event.dataTransfer?.getData('text/plain') || ''
  const applicant = findApplicantById(applicantId)
  isDraggingApplicant.value = false
  draggedApplicantId.value = ''
  draggedOverApplicantId.value = ''
  draggedOverApplicantPosition.value = 'after'
  previewApplicantOrderIds.value = []

  if (!applicant) return
  openApplicantModal('delete', applicant)
}

const closeApplicantModal = () => {
  if (isSubmitting.value) return
  resetApplicantModal()
}

const openApplicantModal = (type, applicant) => {
  if (selectMode.value) return
  activeModal.value = type
  selectedApplicant.value = applicant
  editApplicantStatus.value = normalizeStatusValue(applicant?.approval_status) || 'pending'
  modalError.value = ''

  if (type === 'edit') {
    applicantEditForm.value = {
      first_name: String(applicant?.first_name || '').trim(),
      last_name: String(applicant?.last_name || '').trim(),
      contact_number: String(applicant?.contact_number || '').trim(),
      disability_type: String(applicant?.disability_type || '').trim(),
      age: String(applicant?.age || '').trim(),
    }
  }
}

const buildApplicantStatusPayload = (status) => {
  const nextStatus = normalizeStatusValue(status) || 'pending'
  const payload = { status: nextStatus }

  if (nextStatus === 'rejected') {
    payload.rejectionReason = 'Updated by admin.'
  }

  if (nextStatus === 'banned') {
    payload.banDuration = 'permanent'
    payload.banReason = 'Disabled by admin.'
  }

  return payload
}

const handleApplicantStatusUpdate = async (status, successMessage) => {
  if (!selectedApplicant.value?.id) return

  const currentApplicantName = applicantDisplayName(selectedApplicant.value)
  isSubmitting.value = true
  modalError.value = ''
  if (status === 'approved') {
    isApprovalProcessing.value = true
  }

  try {
    await updateApplicantApprovalStatus(
      selectedApplicant.value.id,
      buildApplicantStatusPayload(status),
    )
    if (status === 'approved') {
      approvedApplicantName.value = currentApplicantName
      activeModal.value = 'approve-success'
    } else {
      resetApplicantModal()
    }
    setActionNotice('success', `${currentApplicantName} ${successMessage}`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to update this applicant right now.')
  } finally {
    isApprovalProcessing.value = false
    isSubmitting.value = false
  }
}

const handleApplicantApprove = async () => {
  await handleApplicantStatusUpdate('approved', 'was approved.')
}

const handleApplicantReject = async () => {
  await handleApplicantStatusUpdate('rejected', 'was rejected.')
}

const handleApplicantQuickApprove = async (applicant) => {
  if (selectMode.value) return
  openApplicantModal('approve', applicant)
}

const handleApplicantQuickReject = async (applicant) => {
  if (selectMode.value) return
  selectedApplicant.value = applicant
  activeModal.value = ''
  await handleApplicantReject()
}

const isApplicantPending = (applicant) =>
  normalizeStatusValue(applicant?.approval_status) === 'pending'

const isApplicantApproved = (applicant) =>
  normalizeStatusValue(applicant?.approval_status) === 'approved'

const isApplicantBanned = (applicant) =>
  normalizeStatusValue(applicant?.approval_status) === 'banned'

const handleApplicantSaveEdit = async () => {
  if (!selectedApplicant.value?.id) return

  const currentApplicantName = applicantDisplayName(selectedApplicant.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await updateApplicantAdminDetails(selectedApplicant.value.id, applicantEditForm.value)
    resetApplicantModal()
    setActionNotice('success', `${currentApplicantName} was updated.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to save this applicant right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleApplicantDisable = async () => {
  if (!selectedApplicant.value?.id) return

  const currentApplicantName = applicantDisplayName(selectedApplicant.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await updateApplicantApprovalStatus(
      selectedApplicant.value.id,
      buildApplicantStatusPayload('banned'),
    )
    resetApplicantModal()
    setActionNotice('success', `${currentApplicantName} was disabled.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to disable this applicant right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleApplicantDelete = async () => {
  if (!selectedApplicant.value?.id) return

  const deletedApplicantId = selectedApplicant.value.id
  const currentApplicantName = applicantDisplayName(selectedApplicant.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await deleteApplicantAccountRecord(deletedApplicantId)
    deletingApplicantIds.value = [...new Set([...deletingApplicantIds.value, deletedApplicantId])]
    resetApplicantModal()
    setActionNotice('success', `${currentApplicantName} was deleted.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to delete this applicant right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleBulkApplicantDelete = async () => {
  const applicantIds = [...new Set(selectedApplicantIds.value.filter(Boolean))]
  if (!applicantIds.length) {
    setActionNotice('error', 'Select at least one applicant to delete.')
    return
  }

  isBulkDeletingApplicants.value = true

  try {
    for (const applicantId of applicantIds) {
      await deleteApplicantAccountRecord(applicantId)
    }

    deletingApplicantIds.value = [...new Set([...deletingApplicantIds.value, ...applicantIds])]
    selectedApplicantIds.value = []
    selectMode.value = false
    setActionNotice('success', `${applicantIds.length} applicant${applicantIds.length === 1 ? '' : 's'} were deleted.`)
  } catch (error) {
    setActionNotice('error', String(error?.message || 'Unable to delete the selected applicants right now.'))
  } finally {
    isBulkDeletingApplicants.value = false
  }
}
</script>

<template>
  <section class="dashboard-applicant-list" :class="{ 'is-dragging': isDraggingApplicant }">
    <article class="applicant-list-toolbar-card">
      <div class="applicant-list-toolbar">
        <div class="applicant-list-toolbar__actions">
          <button type="button" class="applicant-list-toolbar__ghost-btn" @click="toggleSelectMode">
            <i class="bi bi-check2-square" aria-hidden="true" />
            {{ selectMode ? 'Cancel Selection' : 'Select Applicants' }}
          </button>
          <button
            v-if="selectMode"
            type="button"
            class="applicant-list-delete-dropzone"
            :class="{
              'is-active': isDeleteDropZoneActive,
              'is-disabled': isBulkDeletingApplicants || !selectedApplicantIds.length,
            }"
            :disabled="isBulkDeletingApplicants || !selectedApplicantIds.length"
            @dragover="handleDeleteDropZoneDragOver"
            @dragleave="handleDeleteDropZoneDragLeave"
            @drop="handleDeleteDropZoneDrop"
            @click="handleBulkApplicantDelete"
          >
            <i class="bi bi-trash3" aria-hidden="true" />
            <span>
              {{
                isBulkDeletingApplicants
                  ? 'Deleting...'
                  : (isDeleteDropZoneActive ? 'Drop to Delete' : `Delete Selected${selectedApplicantIds.length ? ` (${selectedApplicantIds.length})` : ''}`)
              }}
            </span>
          </button>
        </div>
      </div>

      <Transition name="applicant-list-notice">
        <div
          v-if="actionNotice"
          class="applicant-list-notice"
          :class="`is-${actionNotice.kind}`"
          role="status"
          aria-live="polite"
        >
          <div class="applicant-list-notice__icon" :class="`is-${actionNotice.kind}`" aria-hidden="true">
            <i :class="actionNotice.kind === 'error' ? 'bi bi-x-circle-fill' : 'bi bi-check-circle-fill'" />
          </div>
          <div class="applicant-list-notice__copy">
            <strong>{{ actionNoticeTitle }}</strong>
            <span>{{ actionNotice.text }}</span>
          </div>
          <button type="button" class="applicant-list-notice__close" aria-label="Close notification" @click="actionNotice = null">
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </article>

    <div class="applicant-list-table-shell">
      <table class="applicant-list-table">
        <thead>
          <tr>
            <th v-if="selectMode" class="applicant-list-table__select-head">
              <input
                type="checkbox"
                :checked="allApplicantsSelected"
                :aria-label="allApplicantsSelected ? 'Deselect all applicants' : 'Select all applicants'"
                @change="toggleSelectAllApplicants"
              >
            </th>
            <th>#</th>
            <th>Applicant</th>
            <th>Contact</th>
            <th>Disability</th>
            <th>Age</th>
            <th>Status</th>
            <th>Date</th>
            <th class="applicant-list-table__actions-head">Actions</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="applicant-row">
          <tr
            v-for="(applicant, index) in filteredApplicants"
            :key="applicant.id || `${applicantEmail(applicant)}-${index}`"
            :class="{
              'is-fresh': isFreshApplicant(applicant),
              'is-drop-target': draggedOverApplicantId === applicantRecordId(applicant) && draggedApplicantId !== applicantRecordId(applicant),
              'is-drop-target-top': draggedOverApplicantId === applicantRecordId(applicant) && draggedOverApplicantPosition === 'before' && draggedApplicantId !== applicantRecordId(applicant),
              'is-drop-target-bottom': draggedOverApplicantId === applicantRecordId(applicant) && draggedOverApplicantPosition === 'after' && draggedApplicantId !== applicantRecordId(applicant),
              'is-dragging-source': draggedApplicantId === applicantRecordId(applicant),
            }"
            :draggable="!isSavingApplicantOrder && !selectMode"
            @click="selectMode ? null : openApplicantModal('view', applicant)"
            @dragstart="handleApplicantDragStart($event, applicant)"
            @dragenter="handleApplicantRowDragEnter($event, applicant)"
            @dragover="handleApplicantRowDragOver($event, applicant)"
            @drop="handleApplicantRowDrop($event, applicant)"
            @dragend="handleApplicantDragEnd"
          >
            <td v-if="selectMode" class="applicant-list-table__select-cell" @click.stop>
              <input
                type="checkbox"
                :checked="selectedApplicantIds.includes(applicantRecordId(applicant))"
                aria-label="Select applicant"
                @change="toggleApplicantSelection(applicant)"
              >
            </td>
            <td>{{ index + 1 }}</td>
            <td>
              <div class="applicant-list-table__name">
                <span class="applicant-list-table__avatar" aria-hidden="true">
                  <img
                    v-if="applicantAvatarUrl(applicant)"
                    :src="applicantAvatarUrl(applicant)"
                    :alt="`${applicantDisplayName(applicant)} avatar`"
                    class="applicant-list-table__avatar-image"
                  >
                  <template v-else>{{ applicantInitials(applicant) }}</template>
                </span>
                <span class="applicant-list-table__identity">
                  <strong>{{ applicantDisplayName(applicant) }}</strong>
                  <span>{{ applicantEmail(applicant) }}</span>
                </span>
              </div>
            </td>
            <td>{{ applicant.contact_number || 'Not set' }}</td>
            <td>{{ applicant.disability_type || 'Not set' }}</td>
            <td>{{ applicant.age || 'Not set' }}</td>
            <td>
              <span class="applicant-status-pill" :class="`is-${normalizeStatusValue(applicant.approval_status) || 'pending'}`">
                {{ applicant.approval_status || 'pending' }}
              </span>
            </td>
            <td>{{ formatApplicantDate(applicant.created_at || applicant.submitted_at) }}</td>
            <td class="applicant-list-table__actions-cell">
              <div class="applicant-list-actions">
                <button
                  type="button"
                  class="applicant-list-action-btn"
                  title="View"
                  aria-label="View"
                  :disabled="selectMode"
                  @click.stop="openApplicantModal('view', applicant)"
                >
                  <i class="bi bi-eye" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantPending(applicant)"
                  type="button"
                  class="applicant-list-action-btn applicant-list-action-btn--approve"
                  title="Approve"
                  aria-label="Approve"
                  :disabled="selectMode"
                  @click.stop="handleApplicantQuickApprove(applicant)"
                >
                  <i class="bi bi-check2-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantPending(applicant)"
                  type="button"
                  class="applicant-list-action-btn applicant-list-action-btn--reject"
                  title="Reject"
                  aria-label="Reject"
                  :disabled="selectMode"
                  @click.stop="handleApplicantQuickReject(applicant)"
                >
                  <i class="bi bi-x-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantPending(applicant)"
                  type="button"
                  class="applicant-list-action-btn applicant-list-action-btn--danger"
                  title="Delete"
                  aria-label="Delete"
                  :disabled="selectMode"
                  @click.stop="openApplicantModal('delete', applicant)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantApproved(applicant)"
                  type="button"
                  class="applicant-list-action-btn"
                  title="Edit"
                  aria-label="Edit"
                  :disabled="selectMode"
                  @click.stop="openApplicantModal('edit', applicant)"
                >
                  <i class="bi bi-pencil-square" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantApproved(applicant)"
                  type="button"
                  class="applicant-list-action-btn"
                  title="Disable"
                  aria-label="Disable"
                  :disabled="selectMode"
                  @click.stop="openApplicantModal('disable', applicant)"
                >
                  <i class="bi bi-slash-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isApplicantApproved(applicant) || isApplicantBanned(applicant)"
                  type="button"
                  class="applicant-list-action-btn applicant-list-action-btn--danger"
                  title="Delete"
                  aria-label="Delete"
                  :disabled="selectMode"
                  @click.stop="openApplicantModal('delete', applicant)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredApplicants.length">
            <td :colspan="selectMode ? 9 : 8">
              <div class="applicant-list-empty">No applicant records found.</div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <AdminSimpleModal
      :open="Boolean(activeModal && selectedApplicant)"
      :title="applicantModalTitle"
      :subtitle="applicantModalSubtitle"
      :show-close-button="applicantModalShowHeaderClose"
      :max-width="activeModal === 'view' ? '72rem' : activeModal === 'delete' || activeModal === 'disable' ? '30rem' : '34rem'"
      @close="closeApplicantModal"
    >
      <div v-if="activeModal === 'view'" class="applicant-modal__details">
        <section class="applicant-modal__hero">
          <div class="applicant-modal__hero-avatar" aria-hidden="true">
            <img
              v-if="applicantAvatarUrl(selectedApplicant)"
              :src="applicantAvatarUrl(selectedApplicant)"
              :alt="`${applicantDisplayName(selectedApplicant)} avatar`"
              class="applicant-modal__hero-avatar-image"
            >
            <template v-else>{{ applicantInitials(selectedApplicant) }}</template>
          </div>
          <div class="applicant-modal__hero-copy">
            <strong>{{ applicantDisplayName(selectedApplicant) }}</strong>
            <span>{{ applicantEmail(selectedApplicant) }}</span>
          </div>
          <span
            class="applicant-status-pill applicant-modal__hero-status"
            :class="`is-${normalizeStatusValue(selectedApplicant?.approval_status) || 'pending'}`"
          >
            {{ selectedApplicant?.approval_status || 'pending' }}
          </span>
        </section>

        <section class="applicant-modal__section">
          <div class="applicant-modal__section-head">
            <h3>Profile Information</h3>
            <p>Applicant account details synced from Firebase.</p>
          </div>

          <div class="applicant-modal__detail-list">
            <div v-for="detail in applicantDetailRows" :key="detail.label" class="applicant-modal__detail">
              <span>{{ detail.label }}</span>
              <strong>{{ detail.value }}</strong>
            </div>
          </div>
        </section>

        <section class="applicant-modal__section applicant-modal__verification">
          <div class="applicant-modal__section-head">
            <h3>Verification Files</h3>
            <p>Click any file to open a larger preview.</p>
          </div>
          <div class="applicant-modal__verification-grid">
            <article
              v-for="asset in applicantVerificationAssets"
              :key="asset.label"
              class="applicant-modal__verification-card"
            >
              <span class="applicant-modal__verification-label">{{ asset.label }}</span>

              <a
                v-if="asset.path"
                class="applicant-modal__verification-link"
                href="#"
                @click.prevent="openImagePreview(asset)"
              >
                <img :src="asset.path" :alt="asset.label" class="applicant-modal__verification-image" />
              </a>

              <div v-else class="applicant-modal__verification-empty">
                Not uploaded
              </div>
            </article>
          </div>
        </section>
      </div>

      <div v-else-if="activeModal === 'approve'" class="applicant-modal__panel applicant-modal__panel--approve">
        <div class="applicant-modal__approve-icon" aria-hidden="true">
          <i class="bi bi-patch-check-fill" />
        </div>
        <p class="applicant-modal__copy">
          Are you sure you want to approve {{ applicantDisplayName(selectedApplicant) }} as a new PWD applicant?
        </p>
        <p class="applicant-modal__warning">
          Once approved, this applicant can proceed with the account review flow.
        </p>
      </div>

      <div v-else-if="activeModal === 'approve-success'" class="applicant-modal__panel applicant-modal__panel--success">
        <div class="applicant-modal__approve-icon applicant-modal__approve-icon--success" aria-hidden="true">
          <i class="bi bi-check-circle-fill" />
        </div>
        <p class="applicant-modal__copy">
          {{ approvedApplicantName || applicantDisplayName(selectedApplicant) }} was approved successfully.
        </p>
        <p class="applicant-modal__warning">
          The new PWD applicant is now marked as approved.
        </p>
      </div>

      <div v-else-if="activeModal === 'edit'" class="applicant-modal__form">
        <label class="applicant-modal__field">
          <span>First Name</span>
          <input v-model.trim="applicantEditForm.first_name" type="text" placeholder="Enter first name" />
        </label>
        <label class="applicant-modal__field">
          <span>Last Name</span>
          <input v-model.trim="applicantEditForm.last_name" type="text" placeholder="Enter last name" />
        </label>
        <label class="applicant-modal__field">
          <span>Contact</span>
          <input v-model.trim="applicantEditForm.contact_number" type="text" placeholder="Enter contact number" />
        </label>
        <label class="applicant-modal__field">
          <span>Disability</span>
          <input v-model.trim="applicantEditForm.disability_type" type="text" placeholder="Enter disability" />
        </label>
        <label class="applicant-modal__field">
          <span>Age</span>
          <input v-model.trim="applicantEditForm.age" type="text" placeholder="Enter age" />
        </label>
      </div>

      <div v-else-if="activeModal === 'disable'" class="applicant-modal__panel applicant-modal__panel--danger">
        <div class="applicant-modal__danger-icon" aria-hidden="true">
          <i class="bi bi-slash-circle" />
        </div>
        <p class="applicant-modal__copy">
          Are you sure you want to disable {{ applicantDisplayName(selectedApplicant) }}?
        </p>
        <p class="applicant-modal__warning">
          This will set the account status to banned.
        </p>
      </div>

      <div v-else-if="activeModal === 'delete'" class="applicant-modal__panel applicant-modal__panel--danger">
        <div class="applicant-modal__danger-icon applicant-modal__danger-icon--delete" aria-hidden="true">
          <i class="bi bi-trash3" />
        </div>
        <p class="applicant-modal__copy">
          Delete <strong>{{ applicantDisplayName(selectedApplicant) }}</strong> permanently?
        </p>
        <p class="applicant-modal__warning">
          This action cannot be undone and will remove the applicant account from the platform.
        </p>
      </div>

      <div v-if="modalError" class="applicant-modal__error">
        {{ modalError }}
      </div>

      <template v-if="activeModal !== 'view'" #actions>
        <button
          v-if="activeModal !== 'approve-success'"
          type="button"
          class="applicant-modal__button applicant-modal__button--ghost"
          :disabled="isSubmitting"
          @click="closeApplicantModal"
        >
          Cancel
        </button>

        <button
          v-if="activeModal === 'approve'"
          type="button"
          class="applicant-modal__button applicant-modal__button--primary"
          :disabled="isSubmitting"
          @click="handleApplicantApprove"
        >
          <span v-if="isSubmitting" class="applicant-modal__button-spinner" aria-hidden="true" />
          {{ isSubmitting ? 'Approving...' : 'Yes, Approve Applicant' }}
        </button>
        <button
          v-else-if="activeModal === 'approve-success'"
          type="button"
          class="applicant-modal__button applicant-modal__button--primary"
          :disabled="isSubmitting"
          @click="closeApplicantModal"
        >
          Done
        </button>
        <button
          v-if="activeModal === 'edit'"
          type="button"
          class="applicant-modal__button applicant-modal__button--primary"
          :disabled="isSubmitting"
          @click="handleApplicantSaveEdit"
        >
          {{ isSubmitting ? 'Saving...' : 'Save Rename' }}
        </button>
        <button
          v-else-if="activeModal === 'disable'"
          type="button"
          class="applicant-modal__button applicant-modal__button--warn"
          :disabled="isSubmitting"
          @click="handleApplicantDisable"
        >
          {{ isSubmitting ? 'Disabling...' : 'Disable Applicant' }}
        </button>

        <button
          v-else-if="activeModal === 'delete'"
          type="button"
          class="applicant-modal__button applicant-modal__button--danger"
          :disabled="isSubmitting"
          @click="handleApplicantDelete"
        >
          <span v-if="isSubmitting" class="applicant-modal__button-spinner" aria-hidden="true" />
          {{ isSubmitting ? 'Deleting...' : 'Delete Applicant' }}
        </button>
      </template>
    </AdminSimpleModal>

    <Teleport to="body">
      <Transition name="applicant-approval-waterfall">
        <div v-if="isApprovalProcessing" class="applicant-approval-overlay" role="status" aria-live="polite">
          <div class="applicant-approval-overlay__waterfall" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div class="applicant-approval-overlay__card">
            <div class="applicant-approval-overlay__spinner" aria-hidden="true">
              <i class="bi bi-hourglass-split" />
            </div>
            <strong>Approving new PWD applicant...</strong>
            <p>Please wait while we update the account status.</p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="applicant-image-viewer">
        <div
          v-if="imagePreview.open"
          class="applicant-image-viewer"
          role="dialog"
          aria-modal="true"
          @click.self="closeImagePreview"
        >
          <button
            type="button"
            class="applicant-image-viewer__close"
            aria-label="Close image preview"
            @click="closeImagePreview"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>

          <div class="applicant-image-viewer__stage">
            <img :src="imagePreview.src" alt="Verification image" class="applicant-image-viewer__image" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.dashboard-applicant-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.95rem;
}

.applicant-list-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px auto;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.applicant-list-filter {
  display: grid;
  gap: 0.38rem;
}

.applicant-list-filter span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.applicant-list-filter input,
.applicant-list-filter select {
  min-height: 2.65rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.55rem;
  padding: 0 0.9rem;
  outline: none;
  background: #fff;
  color: #274234;
  font: inherit;
}

.applicant-list-filter input:focus,
.applicant-list-filter select:focus {
  border-color: rgba(55, 151, 102, 0.34);
  box-shadow: 0 0 0 4px rgba(55, 151, 102, 0.08);
}

.applicant-list-toolbar__actions {
  display: flex;
  align-items: end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.applicant-list-toolbar__filter-btn,
.applicant-list-toolbar__ghost-btn,
.applicant-list-toolbar__primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.45rem;
  border-radius: 0.82rem;
  padding: 0.55rem 1rem;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.applicant-list-toolbar__filter-btn i,
.applicant-list-toolbar__ghost-btn i,
.applicant-list-toolbar__primary-btn i {
  font-size: 0.82rem;
}

.applicant-list-toolbar__filter-btn {
  border: 1px solid #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.applicant-list-toolbar__ghost-btn {
  border: 1px solid #d7dfd9;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
}

.applicant-list-toolbar__primary-btn {
  border: 1px solid #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.applicant-list-toolbar__filter-btn:hover,
.applicant-list-toolbar__ghost-btn:hover,
.applicant-list-toolbar__primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

.applicant-list-delete-dropzone {
  min-height: 2.45rem;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: 0.82rem;
  background: linear-gradient(180deg, #fff8f8 0%, #fff0f0 100%);
  color: #b42318;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.76rem;
  font-weight: 800;
  user-select: none;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.applicant-list-delete-dropzone.is-active {
  border-color: rgba(220, 38, 38, 0.32);
  background: linear-gradient(180deg, #fff1f1 0%, #ffe4e4 100%);
  color: #991b1b;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.applicant-list-delete-dropzone.is-disabled {
  opacity: 0.7;
  cursor: wait;
}


.applicant-list-notice {
  position: fixed;
  bottom: 2rem;
  left: 1.5rem;
  z-index: 24;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: center;
  width: min(28rem, calc(100% - 1.5rem));
  padding: 0.95rem 1rem;
  border: 1px solid rgba(220, 38, 38, 0.14);
  border-radius: 1rem;
  transform: none;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.applicant-list-notice.is-success {
  border-color: rgba(22, 163, 74, 0.16);
}

.applicant-list-notice.is-error {
  border-color: rgba(171, 70, 70, 0.22);
}

.applicant-list-notice__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.96) 0%, rgba(254, 226, 226, 0.78) 100%);
  color: #dc2626;
  box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.18);
  flex: 0 0 2.5rem;
}

.applicant-list-notice__icon.is-success {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.96) 0%, rgba(220, 252, 231, 0.82) 100%);
  color: #16a34a;
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.24);
}

.applicant-list-notice__icon i {
  font-size: 1.1rem;
  line-height: 1;
}

.applicant-list-notice__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.applicant-list-notice__copy strong,
.applicant-list-notice__copy span {
  margin: 0;
}

.applicant-list-notice__copy strong {
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 800;
}

.applicant-list-notice__copy span {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.applicant-list-notice__close {
  width: 2rem;
  height: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.applicant-list-notice__close:hover {
  background: #fff5f5;
  border-color: #fecaca;
  color: #dc2626;
  transform: rotate(90deg);
}

.applicant-list-notice-enter-active,
.applicant-list-notice-leave-active {
  transition: opacity 0.2s ease, transform 0.22s ease;
}

.applicant-list-notice-enter-from,
.applicant-list-notice-leave-to {
  opacity: 0;
  transform: translate3d(0, -10px, 0);
}

.applicant-list-table-shell {
  overflow: hidden;
  border: 1px solid rgba(122, 179, 145, 0.14);
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: none;
}

.applicant-list-table {
  width: 100%;
  border-collapse: collapse;
}

.applicant-list-table thead th {
  padding: 0.82rem 0.9rem;
  text-align: left;
  color: #6d8576;
  font-size: 0.76rem;
  font-weight: 700;
  background: #f7fbf8;
}

.applicant-list-table__select-head,
.applicant-list-table__select-cell {
  width: 2.8rem;
}

.applicant-list-table__select-head input,
.applicant-list-table__select-cell input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  border: 1.5px solid rgba(117, 148, 130, 0.7);
  border-radius: 0.32rem;
  background: #ffffff;
  display: inline-grid;
  place-content: center;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.applicant-list-table__select-head input::before,
.applicant-list-table__select-cell input::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  clip-path: polygon(14% 44%, 0 59%, 39% 100%, 100% 21%, 84% 7%, 38% 67%);
  transform: scale(0);
  transform-origin: center;
  transition: transform 0.16s ease;
  background: #ffffff;
}

.applicant-list-table__select-head input:hover,
.applicant-list-table__select-cell input:hover {
  border-color: #2c8a62;
  box-shadow: 0 0 0 4px rgba(44, 138, 98, 0.1);
}

.applicant-list-table__select-head input:checked,
.applicant-list-table__select-cell input:checked {
  border-color: #2c8a62;
  background: linear-gradient(135deg, #2c8a62 0%, #39a071 100%);
}

.applicant-list-table__select-head input:checked::before,
.applicant-list-table__select-cell input:checked::before {
  transform: scale(1);
}

.applicant-list-table tbody tr {
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.applicant-list-table tbody tr:active {
  cursor: grabbing;
}

.applicant-list-table tbody td {
  padding: 0.82rem 0.9rem;
  color: #35503f;
  font-size: 0.84rem;
  border-top: 1px solid rgba(122, 179, 145, 0.1);
  vertical-align: middle;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.applicant-list-table tbody tr:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.08));
}

.applicant-list-table tbody tr:hover td {
  background: #f2f4f5;
  border-color: rgba(203, 213, 225, 0.7);
}

.dashboard-applicant-list.is-dragging .applicant-list-table tbody tr:hover {
  transform: none;
  filter: none;
}

.dashboard-applicant-list.is-dragging .applicant-list-table tbody tr:hover td {
  background: inherit;
  border-color: rgba(122, 179, 145, 0.1);
}

.applicant-list-table tbody tr.is-drop-target td {
  background: rgba(228, 246, 236, 0.95);
}

.applicant-list-table tbody tr.is-drop-target-top td {
  border-top-color: rgba(44, 138, 98, 0.68);
  box-shadow: inset 0 3px 0 rgba(44, 138, 98, 0.72);
}

.applicant-list-table tbody tr.is-drop-target-bottom td {
  border-bottom-color: rgba(44, 138, 98, 0.68);
  box-shadow: inset 0 -3px 0 rgba(44, 138, 98, 0.72);
}

.applicant-list-table tbody tr.is-dragging-source td {
  opacity: 0.45;
}

.applicant-list-table tbody tr[draggable="true"] {
  user-select: none;
}

.applicant-list-table tbody tr[draggable="true"]:active td {
  opacity: 0.88;
}

.applicant-row-enter-active,
.applicant-row-leave-active,
.applicant-row-move {
  transition:
    transform 0.36s ease,
    opacity 0.36s ease;
}

.applicant-row-enter-from,
.applicant-row-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.applicant-list-table tbody tr.is-fresh td {
  animation: applicant-row-glow 2.2s ease;
}

@keyframes applicant-row-glow {
  0% {
    background: rgba(214, 240, 225, 0.94);
  }

  100% {
    background: transparent;
  }
}

.applicant-list-table__name {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.applicant-list-table__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.3rem;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(44, 138, 98, 0.18);
  background: linear-gradient(135deg, #2c8a62, #8fd0ad);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 18px rgba(44, 138, 98, 0.16);
  overflow: hidden;
}

.applicant-list-table__avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.applicant-list-table__identity {
  display: grid;
  gap: 0.16rem;
  min-width: 0;
}

.applicant-list-table__identity strong {
  color: #1f3a2d;
  font-size: 0.88rem;
  font-weight: 700;
}

.applicant-list-table__identity span {
  color: #7a9383;
  font-size: 0.76rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.applicant-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6.25rem;
  padding: 0.38rem 0.72rem;
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1;
  text-transform: capitalize;
  background: rgba(249, 115, 22, 0.08);
  color: #d97706;
}

.applicant-status-pill.is-pending {
  background: rgba(240, 154, 74, 0.14);
  border-color: rgba(240, 154, 74, 0.2);
  color: #be7b39;
}

.applicant-status-pill.is-approved {
  border-color: #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
}

.applicant-status-pill.is-rejected,
.applicant-status-pill.is-banned {
  background: rgba(223, 115, 134, 0.12);
  border-color: rgba(223, 115, 134, 0.18);
  color: #bf5f72;
}

.applicant-list-empty {
  padding: 1.2rem;
  text-align: center;
  color: #6f8578;
}

.applicant-list-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.28rem;
}

.applicant-list-action-btn {
  width: 2.2rem;
  height: 2.2rem;
  border: 0;
  border-radius: 0.45rem;
  display: grid;
  place-items: center;
  background: transparent;
  color: #8a978f;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.applicant-list-action-btn i {
  font-size: 1rem;
}

.applicant-list-action-btn:hover {
  transform: none;
  background: rgba(235, 247, 240, 0.98);
  color: #2d684d;
}

.applicant-list-action-btn:disabled {
  opacity: 0.46;
  cursor: not-allowed;
  pointer-events: none;
  transform: none;
}

.applicant-list-action-btn--approve:hover {
  background: rgba(235, 247, 240, 0.98);
  color: #228454;
}

.applicant-list-action-btn--reject:hover {
  background: rgba(252, 239, 239, 0.98);
  color: #a54545;
}

.applicant-list-action-btn--danger:hover {
  background: rgba(252, 239, 239, 0.98);
  color: #a54545;
}

.applicant-list-table__actions-head,
.applicant-list-table__actions-cell {
  width: 8rem;
}

.applicant-modal__details {
  display: grid;
  gap: 1.25rem;
}

.applicant-modal__hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid rgba(122, 179, 145, 0.16);
  background:
    radial-gradient(circle at top left, rgba(95, 178, 129, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(252, 255, 253, 0.98) 0%, rgba(244, 250, 246, 0.95) 100%);
  box-shadow:
    0 14px 30px rgba(44, 138, 98, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.applicant-modal__hero-avatar {
  display: grid;
  place-items: center;
  width: 3.6rem;
  height: 3.6rem;
  border-radius: 1rem;
  border: 1px solid rgba(44, 138, 98, 0.16);
  background: linear-gradient(135deg, #2c8a62, #8fd0ad);
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 10px 24px rgba(44, 138, 98, 0.2);
  overflow: hidden;
}

.applicant-modal__hero-avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.applicant-modal__hero-copy {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}

.applicant-modal__hero-copy strong {
  color: #1f362a;
  font-size: 1.12rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.applicant-modal__hero-copy span {
  color: #6f8b79;
  font-size: 0.84rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.applicant-modal__hero-status {
  min-width: auto;
}

.applicant-modal__section {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 1.05rem 1.05rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 252, 249, 0.95) 100%);
}

.applicant-modal__section-head {
  display: grid;
  gap: 0.18rem;
}

.applicant-modal__section-head h3 {
  margin: 0;
  color: #244132;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.applicant-modal__section-head p {
  margin: 0;
  color: #7a9383;
  font-size: 0.78rem;
  line-height: 1.5;
}

.applicant-modal__detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem 1rem;
}

.applicant-modal__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.applicant-modal__field {
  display: grid;
  gap: 0.38rem;
}

.applicant-modal__field span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.applicant-modal__field input {
  min-height: 2.7rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0;
  padding: 0 0.85rem;
  outline: none;
  background: #fff;
  color: #274234;
  font: inherit;
}

.applicant-modal__field input:focus {
  border-color: rgba(55, 151, 102, 0.34);
  box-shadow: 0 0 0 4px rgba(55, 151, 102, 0.08);
}

.applicant-modal__detail {
  min-height: 4.75rem;
  padding: 0.85rem 0.95rem 0.9rem;
  border: 1px solid rgba(122, 179, 145, 0.1);
  background: rgba(255, 255, 255, 0.88);
  display: grid;
  align-content: start;
  gap: 0.35rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.applicant-modal__detail span,
.applicant-modal__field span {
  color: #6b8574;
  font-size: 0.75rem;
  font-weight: 700;
}

.applicant-modal__detail strong {
  color: #1f362a;
  font-size: 0.95rem;
  line-height: 1.55;
  font-weight: 700;
}

.applicant-modal__verification {
  display: grid;
  gap: 0.9rem;
}

.applicant-modal__verification-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.applicant-modal__verification-card {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}

.applicant-modal__verification-label {
  color: #6b8574;
  font-size: 0.75rem;
  font-weight: 700;
}

.applicant-modal__verification-link {
  display: grid;
  place-items: center;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 0.85rem;
  background: #fff;
  text-decoration: none;
  overflow: hidden;
  cursor: zoom-in;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.applicant-modal__verification-link:hover {
  transform: translateY(-2px);
  border-color: rgba(55, 151, 102, 0.22);
  box-shadow: 0 14px 30px rgba(31, 58, 45, 0.08);
}

.applicant-modal__verification-image {
  display: block;
  width: 100%;
  height: 12.5rem;
  object-fit: contain;
  object-position: center;
  background: #f6f8f7;
}

.applicant-modal__verification-empty {
  min-height: 12.5rem;
  border: 1px solid rgba(122, 179, 145, 0.14);
  background: linear-gradient(180deg, #fbfdfb 0%, #f4f8f5 100%);
  color: #6e8578;
  font-size: 0.82rem;
  display: grid;
  place-items: center;
}

.applicant-image-viewer {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: grid;
  place-items: center;
  padding: 2rem 5.5rem 2rem 2rem;
  background: rgba(16, 24, 20, 0.78);
  backdrop-filter: blur(4px);
}

.applicant-image-viewer__stage {
  display: grid;
  place-items: center;
  width: min(100%, 72rem);
  max-height: calc(100vh - 4rem);
}

.applicant-image-viewer__image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 4rem);
  object-fit: contain;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.26);
}

.applicant-image-viewer__close {
  position: absolute;
  top: 1.4rem;
  right: 1.4rem;
  width: 2.85rem;
  height: 2.85rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font: inherit;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.applicant-image-viewer__close i {
  font-size: 1rem;
}

.applicant-image-viewer__close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.applicant-image-viewer-enter-active,
.applicant-image-viewer-leave-active {
  transition: opacity 0.2s ease;
}

.applicant-image-viewer-enter-active .applicant-image-viewer__image,
.applicant-image-viewer-leave-active .applicant-image-viewer__image {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.applicant-image-viewer-enter-from,
.applicant-image-viewer-leave-to {
  opacity: 0;
}

.applicant-image-viewer-enter-from .applicant-image-viewer__image,
.applicant-image-viewer-leave-to .applicant-image-viewer__image {
  opacity: 0;
  transform: scale(0.97);
}

.applicant-modal__panel {
  display: grid;
  gap: 0.85rem;
}

.applicant-modal__panel--danger {
  justify-items: center;
  text-align: center;
  padding: 0.35rem 0 0.15rem;
}

.applicant-modal__panel--approve,
.applicant-modal__panel--success {
  justify-items: center;
  text-align: center;
  padding: 0.35rem 0 0.15rem;
}

.applicant-modal__approve-icon {
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 1.25rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(44, 138, 98, 0.14), rgba(119, 189, 151, 0.3));
  color: #237550;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.applicant-modal__approve-icon i {
  font-size: 2rem;
}

.applicant-modal__approve-icon--success {
  background: linear-gradient(135deg, rgba(38, 132, 84, 0.18), rgba(114, 219, 162, 0.35));
  color: #1e7d4e;
}

.applicant-modal__danger-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 1.2rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(165, 106, 17, 0.12), rgba(244, 196, 48, 0.22));
  color: #9a640f;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.applicant-modal__danger-icon--delete {
  background: linear-gradient(135deg, rgba(165, 69, 69, 0.16), rgba(245, 153, 153, 0.26));
  color: #a54545;
}

.applicant-modal__danger-icon i {
  font-size: 1.75rem;
}

.applicant-modal__field {
  display: grid;
  gap: 0.4rem;
}

.applicant-modal__field select {
  min-height: 2.7rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.7rem;
  padding: 0 0.85rem;
  background: #fff;
  color: #274234;
  font: inherit;
}

.applicant-modal__copy,
.applicant-modal__warning {
  margin: 0;
  color: #567062;
  font-size: 0.83rem;
  line-height: 1.55;
}

.applicant-modal__copy strong {
  color: #264333;
}

.applicant-modal__warning {
  color: #8f5656;
  max-width: 24rem;
}

.applicant-modal__error {
  margin-top: 0.9rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(253, 241, 241, 0.98);
  color: #9c4545;
  font-size: 0.8rem;
  line-height: 1.5;
}

.applicant-modal__button {
  min-height: 2.6rem;
  border: 0;
  border-radius: 0.75rem;
  padding: 0 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.applicant-modal__button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.applicant-modal__button--ghost {
  background: #eef4f0;
  color: #476857;
}

.applicant-modal__button--primary {
  background: #2c8a62;
  color: #fff;
}

.applicant-modal__button--warn {
  background: #a56a11;
  color: #fff;
}

.applicant-modal__button--danger {
  background: #a54545;
  color: #fff;
}

.applicant-modal__button-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 999px;
  animation: applicant-button-spin 0.75s linear infinite;
}

@keyframes applicant-button-spin {
  to {
    transform: rotate(360deg);
  }
}

.applicant-approval-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: rgba(10, 28, 19, 0.48);
  backdrop-filter: blur(10px);
}

.applicant-approval-overlay__waterfall {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}

.applicant-approval-overlay__waterfall span {
  background: linear-gradient(180deg, rgba(70, 187, 125, 0.04), rgba(70, 187, 125, 0.28), rgba(255, 255, 255, 0.05));
  transform: translateY(-100%);
  animation: applicant-waterfall 1.3s ease-in-out infinite;
}

.applicant-approval-overlay__waterfall span:nth-child(2) {
  animation-delay: 0.12s;
}

.applicant-approval-overlay__waterfall span:nth-child(3) {
  animation-delay: 0.24s;
}

.applicant-approval-overlay__waterfall span:nth-child(4) {
  animation-delay: 0.36s;
}

.applicant-approval-overlay__waterfall span:nth-child(5) {
  animation-delay: 0.48s;
}

.applicant-approval-overlay__waterfall span:nth-child(6) {
  animation-delay: 0.6s;
}

.applicant-approval-overlay__card {
  position: relative;
  z-index: 1;
  min-width: min(28rem, calc(100vw - 2rem));
  padding: 1.5rem 1.6rem;
  border-radius: 1.4rem;
  border: 1px solid rgba(201, 236, 215, 0.55);
  background: rgba(251, 255, 253, 0.94);
  box-shadow:
    0 28px 80px rgba(5, 34, 19, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  text-align: center;
}

.applicant-approval-overlay__card strong {
  color: #1e382a;
  font-size: 1.08rem;
  font-weight: 800;
}

.applicant-approval-overlay__card p {
  margin: 0;
  color: #5a7567;
  font-size: 0.88rem;
}

.applicant-approval-overlay__spinner {
  width: 4rem;
  height: 4rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #237550;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.96), rgba(165, 229, 191, 0.34));
  box-shadow: 0 16px 32px rgba(44, 138, 98, 0.16);
}

.applicant-approval-overlay__spinner i {
  font-size: 1.4rem;
  animation: applicant-button-spin 0.95s linear infinite;
}

@keyframes applicant-waterfall {
  0% {
    transform: translateY(-100%);
    opacity: 0.12;
  }

  45% {
    opacity: 0.45;
  }

  100% {
    transform: translateY(100%);
    opacity: 0.08;
  }
}

.applicant-approval-waterfall-enter-active,
.applicant-approval-waterfall-leave-active {
  transition: opacity 0.28s ease;
}

.applicant-approval-waterfall-enter-from,
.applicant-approval-waterfall-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .applicant-list-toolbar {
    grid-template-columns: 1fr;
  }

  .applicant-list-toolbar__actions {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .applicant-list-notice {
    align-items: flex-start;
    flex-direction: column;
  }

  .applicant-list-table-shell {
    overflow-x: auto;
  }

  .applicant-list-table {
    min-width: 780px;
  }

  .applicant-modal__hero {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .applicant-image-viewer {
    padding: 1rem 1rem 4.75rem;
  }

  .applicant-image-viewer__close {
    right: 1rem;
    top: 1rem;
  }

  .applicant-image-viewer__close:hover {
    transform: translateY(-2px);
  }

  .applicant-modal__detail-list,
  .applicant-modal__verification-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .applicant-list-toolbar-card {
    padding: 0.92rem;
  }

  .applicant-list-toolbar__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .applicant-list-notice {
    width: min(calc(100vw - 1.5rem), 32rem);
  }

  .applicant-modal {
    width: min(100%, calc(100vw - 1.4rem));
  }
}

@media (max-width: 640px) {
  .applicant-list-toolbar-card {
    padding: 0.85rem;
  }

  .applicant-list-toolbar {
    gap: 0.68rem;
  }

  .applicant-list-toolbar__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .applicant-list-toolbar__filter-btn,
  .applicant-list-toolbar__ghost-btn,
  .applicant-list-toolbar__primary-btn {
    width: 100%;
    min-height: 2.55rem;
  }

  .applicant-list-notice {
    width: calc(100vw - 1.4rem);
    left: 0.7rem;
    bottom: 0.7rem;
  }

  .applicant-modal {
    width: min(100%, calc(100vw - 1rem));
  }
}
</style>
