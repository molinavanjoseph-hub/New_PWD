<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AdminSimpleModal from '@/modules/Admin/admin-simple-modal.vue'
import {
  deleteEmployerAccountRecord,
  updateEmployerAdminDetails,
  updateEmployerApprovalStatus,
  updateEmployerSortOrders,
} from '@/lib/auth'

const props = defineProps({
  employees: {
    type: Array,
    default: () => [],
  },
  workspaceMembersByBusinessId: {
    type: Object,
    default: () => ({}),
  },
})

const employeeSearch = ref('')
const employeeStatusFilter = ref('all')
const activeModal = ref('')
const selectedEmployee = ref(null)
const editEmployeeStatus = ref('pending')
const modalError = ref('')
const isSubmitting = ref(false)
const actionNotice = ref(null)
const deletingEmployeeIds = ref([])
const selectMode = ref(false)
const selectedEmployeeIds = ref([])
const isBulkDeletingEmployees = ref(false)
const employeeEditForm = ref({
  company_name: '',
  company_contact_number: '',
  company_location: '',
  company_category: '',
})
const imagePreview = ref({
  open: false,
  src: '',
})
const draggedEmployeeId = ref('')
const draggedOverEmployeeId = ref('')
const draggedOverEmployeePosition = ref('after')
const previewEmployeeOrderIds = ref([])
const isDeleteDropZoneActive = ref(false)
const isSavingEmployeeOrder = ref(false)
const isDraggingEmployee = ref(false)
const freshEmployeeIds = ref([])
let freshEmployeeTimer = 0
let actionNoticeTimer = 0
let hasInitializedEmployees = false

const normalizeStatusValue = (value) => String(value || '').trim().toLowerCase()

const employeeDisplayName = (record) =>
  String(
    record?.company_name
    || record?.name
    || record?.user?.name
    || 'Business',
  ).trim()

const employeeEmail = (record) =>
  String(record?.email || record?.user?.email || 'No email').trim() || 'No email'

const employeeInitials = (record) => {
  const parts = employeeDisplayName(record)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return 'EM'
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

const employeeAvatarSrc = (record) =>
  String(record?.business_avatar || record?.avatar || '').trim()

const formatEmployeeDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const titleCaseText = (value, fallback = 'Not set') => {
  const text = String(value || '').trim()
  if (!text) return fallback

  return text
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const displayText = (value, fallback = 'Not set') =>
  String(value || '').trim() || fallback

const getDocumentFileName = (value, fallback = 'Attached file') => {
  const text = String(value || '').trim()
  if (!text) return fallback

  try {
    const decoded = decodeURIComponent(text)
    const storageMarker = '/o/'
    const storageIndex = decoded.indexOf(storageMarker)

    if (storageIndex >= 0) {
      const storagePath = decoded.slice(storageIndex + storageMarker.length).split('?')[0]
      const segments = storagePath.split('/').filter(Boolean)
      return segments.at(-1) || fallback
    }

    const pathname = new URL(text).pathname
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) || fallback
  } catch {
    const sanitized = text.split('?')[0]
    const segments = sanitized.split('/').filter(Boolean)
    return segments.at(-1) || fallback
  }
}

const getDocumentFileExtension = (fileName) => {
  const value = String(fileName || '').trim().toLowerCase()
  if (!value.includes('.')) return ''
  return value.split('.').pop() || ''
}

const isImageDocument = (fileName) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(getDocumentFileExtension(fileName))

const isPdfDocument = (fileName) => getDocumentFileExtension(fileName) === 'pdf'

const documentTypeLabel = (fileName) => {
  if (isImageDocument(fileName)) return 'Image File'
  if (isPdfDocument(fileName)) return 'PDF File'

  const extension = getDocumentFileExtension(fileName)
  return extension ? `${extension.toUpperCase()} File` : 'Stored File'
}

const normalizeMemberRole = (value) => {
  const role = String(value || '').trim().toLowerCase()
  if (!role) return 'Business Member'
  if (role === 'employer') return 'Business Owner'
  return titleCaseText(role, 'Business Member')
}

const normalizeTeamMembers = (source, workspaceMembers = []) => {
  const candidateGroups = [
    source?.team_members,
    source?.teamMembers,
    source?.members,
    source?.member_list,
    source?.memberList,
    source?.staff_members,
    source?.staffMembers,
    source?.recruiters,
  ]

  const rawMembers = candidateGroups.find((entry) =>
    Array.isArray(entry) ? entry.length > 0 : entry && typeof entry === 'object' && Object.keys(entry).length > 0,
  )

  const memberList = Array.isArray(rawMembers)
    ? rawMembers
    : rawMembers && typeof rawMembers === 'object'
      ? Object.values(rawMembers)
      : []

  const normalizedStoredMembers = memberList
    .map((member, index) => {
      if (typeof member === 'string') {
        return {
          id: `member-${index}`,
          name: member.trim() || `Business Member ${index + 1}`,
          email: '',
          role: 'Business Member',
          status: '',
        }
      }

      if (!member || typeof member !== 'object') return null

      const name = String(
        member.name
        || member.full_name
        || member.fullName
        || member.display_name
        || member.displayName
        || member.email
        || '',
      ).trim()

      const email = String(member.email || member.user_email || member.userEmail || '').trim()
      const role = normalizeMemberRole(member.role || member.member_role || member.memberRole)
      const status = titleCaseText(member.status || member.member_status || member.memberStatus, '')

      if (!name && !email) return null

      return {
        id: String(member.id || member.uid || email || `member-${index}`).trim(),
        name: name || email,
        email,
        role,
        status,
      }
    })
    .filter(Boolean)

  const normalizedWorkspaceMembers = (Array.isArray(workspaceMembers) ? workspaceMembers : [])
    .map((member, index) => {
      if (!member || typeof member !== 'object') return null

      const memberId = String(member.id || member.uid || '').trim()
      const memberEmail = String(member.email || member.user_email || member.userEmail || '').trim()
      const memberRole = normalizeMemberRole(
        member.permissionRoleName
        || member.workspace_permission_role?.name
        || member.workspace_permission_role?.label
        || member.roleName
        || member.role
        || member.roleId,
      )
      const memberStatus = member.email_verified === true
        ? 'Verified'
        : titleCaseText(member.status || member.approval_status, 'Pending')
      const memberName = String(
        member.name
        || member.display_name
        || member.displayName
        || memberEmail
        || '',
      ).trim()

      if (!memberId && !memberEmail && !memberName) return null

      return {
        id: memberId || memberEmail || `workspace-member-${index}`,
        name: memberName || memberEmail || `Business Member ${index + 1}`,
        email: memberEmail,
        role: memberRole,
        status: memberStatus,
      }
    })
    .filter((member) => member && member.id !== String(source?.id || '').trim())

  const mergedMembers = [...normalizedWorkspaceMembers, ...normalizedStoredMembers]
  const seenMemberKeys = new Set()

  return mergedMembers.filter((member) => {
    const memberKey = String(member?.id || member?.email || '').trim().toLowerCase()
    if (!memberKey || seenMemberKeys.has(memberKey)) return false
    seenMemberKeys.add(memberKey)
    return true
  })
}

const employeeRecordId = (record) => String(record?.id || '').trim()

const findEmployeeById = (employeeId) =>
  (Array.isArray(props.employees) ? props.employees : []).find((record) => employeeRecordId(record) === employeeId) || null

const reorderEmployeeRows = (rows, sourceEmployeeId, targetEmployeeId) => {
  const nextRows = [...rows]
  const sourceIndex = nextRows.findIndex((record) => employeeRecordId(record) === sourceEmployeeId)
  const targetIndex = nextRows.findIndex((record) => employeeRecordId(record) === targetEmployeeId)

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return nextRows
  }

  const [movedEmployee] = nextRows.splice(sourceIndex, 1)
  nextRows.splice(targetIndex, 0, movedEmployee)
  return nextRows
}

const reorderEmployeeRowsByPlacement = (rows, sourceEmployeeId, targetEmployeeId, placement = 'after') => {
  const nextRows = [...rows]
  const sourceIndex = nextRows.findIndex((record) => employeeRecordId(record) === sourceEmployeeId)
  const targetIndex = nextRows.findIndex((record) => employeeRecordId(record) === targetEmployeeId)

  if (sourceIndex < 0 || targetIndex < 0 || sourceEmployeeId === targetEmployeeId) {
    return nextRows
  }

  const [movedEmployee] = nextRows.splice(sourceIndex, 1)
  const nextTargetIndex = nextRows.findIndex((record) => employeeRecordId(record) === targetEmployeeId)
  const insertIndex = placement === 'before' ? nextTargetIndex : nextTargetIndex + 1
  nextRows.splice(Math.max(0, insertIndex), 0, movedEmployee)
  return nextRows
}

const sortEmployeeRows = (rows) =>
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

    const leftTime = Date.parse(left?.created_at || '') || 0
    const rightTime = Date.parse(right?.created_at || '') || 0
    return rightTime - leftTime
  })

const allEmployeesOrdered = computed(() =>
  sortEmployeeRows(Array.isArray(props.employees) ? props.employees : []),
)

const allEmployeesPreviewOrdered = computed(() => {
  if (!previewEmployeeOrderIds.value.length) return allEmployeesOrdered.value

  const orderedMap = new Map(
    allEmployeesOrdered.value.map((record) => [employeeRecordId(record), record]),
  )

  const previewRows = previewEmployeeOrderIds.value
    .map((id) => orderedMap.get(id))
    .filter(Boolean)

  const previewIdSet = new Set(previewRows.map((record) => employeeRecordId(record)))
  const remainingRows = allEmployeesOrdered.value.filter((record) => !previewIdSet.has(employeeRecordId(record)))

  return [...previewRows, ...remainingRows]
})

const filteredEmployees = computed(() => {
  const rows = allEmployeesPreviewOrdered.value
  const search = String(employeeSearch.value || '').trim().toLowerCase()
  const status = String(employeeStatusFilter.value || 'all').trim().toLowerCase()

  return rows
    .filter((record) => !deletingEmployeeIds.value.includes(employeeRecordId(record)))
    .filter((record) => {
      const matchesSearch = !search || [
        employeeDisplayName(record),
        employeeEmail(record),
        record?.company_contact_number,
        record?.company_location,
        record?.company_category,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search))

      const matchesStatus = status === 'all' || normalizeStatusValue(record?.approval_status) === status
      return matchesSearch && matchesStatus
    })
})

const allFilteredEmployeeIds = computed(() =>
  filteredEmployees.value
    .map((record) => employeeRecordId(record))
    .filter(Boolean),
)

const allEmployeesSelected = computed(() =>
  allFilteredEmployeeIds.value.length > 0
  && allFilteredEmployeeIds.value.every((id) => selectedEmployeeIds.value.includes(id)),
)

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedEmployeeIds.value = []
  }
}

const toggleEmployeeSelection = (employee) => {
  const employeeId = employeeRecordId(employee)
  if (!employeeId) return

  selectedEmployeeIds.value = selectedEmployeeIds.value.includes(employeeId)
    ? selectedEmployeeIds.value.filter((id) => id !== employeeId)
    : [...selectedEmployeeIds.value, employeeId]
}

const toggleSelectAllEmployees = () => {
  selectedEmployeeIds.value = allEmployeesSelected.value ? [] : [...allFilteredEmployeeIds.value]
}

const clearFreshEmployeeTimer = () => {
  if (typeof window === 'undefined' || !freshEmployeeTimer) return
  window.clearTimeout(freshEmployeeTimer)
  freshEmployeeTimer = 0
}

const clearActionNoticeTimer = () => {
  if (typeof window === 'undefined' || !actionNoticeTimer) return
  window.clearTimeout(actionNoticeTimer)
  actionNoticeTimer = 0
}

const queueFreshEmployees = (ids) => {
  if (!ids.length) return

  freshEmployeeIds.value = [...new Set([...freshEmployeeIds.value, ...ids])]
  clearFreshEmployeeTimer()

  if (typeof window !== 'undefined') {
    freshEmployeeTimer = window.setTimeout(() => {
      freshEmployeeIds.value = []
    }, 2200)
  }
}

const isFreshEmployee = (record) =>
  freshEmployeeIds.value.includes(employeeRecordId(record))

watch(
  () => (Array.isArray(props.employees) ? props.employees.map(employeeRecordId).filter(Boolean) : []),
  (nextIds, previousIds = []) => {
    previewEmployeeOrderIds.value = []
    deletingEmployeeIds.value = deletingEmployeeIds.value.filter((id) => nextIds.includes(id))

    if (!hasInitializedEmployees) {
      hasInitializedEmployees = true
      return
    }

    const previousIdSet = new Set(previousIds)
    const newIds = nextIds.filter((id) => !previousIdSet.has(id))
    queueFreshEmployees(newIds)
  },
  { immediate: true },
)

watch(allFilteredEmployeeIds, (nextIds) => {
  selectedEmployeeIds.value = selectedEmployeeIds.value.filter((id) => nextIds.includes(id))
})

onBeforeUnmount(() => {
  clearFreshEmployeeTimer()
  clearActionNoticeTimer()
})

const employeeModalTitle = computed(() => {
  if (activeModal.value === 'view') return 'Business Details'
  if (activeModal.value === 'edit') return 'Rename Business'
  if (activeModal.value === 'disable') return 'Disable Business'
  if (activeModal.value === 'delete') return 'Delete Business'
  return 'Business'
})

const employeeModalSubtitle = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return ''

  if (activeModal.value === 'view') {
    return `Review the account information for ${employeeDisplayName(employee)}.`
  }

  if (activeModal.value === 'edit') {
    return `Rename or update the saved business details for ${employeeDisplayName(employee)}.`
  }

  if (activeModal.value === 'disable') {
    return `This will block ${employeeDisplayName(employee)} from using the account.`
  }

  if (activeModal.value === 'delete') {
    return `This will permanently delete ${employeeDisplayName(employee)} from the platform.`
  }

  return ''
})

const employeeModalShowHeaderClose = computed(() => activeModal.value !== 'delete' && activeModal.value !== 'disable')

const employeeDetailRows = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  return [
    { label: 'Name', value: employeeDisplayName(employee) },
    { label: 'Email', value: employeeEmail(employee) },
    { label: 'Contact', value: employee?.company_contact_number || 'Not set' },
    { label: 'Status', value: employee?.approval_status || 'pending' },
    { label: 'Category', value: employee?.company_category || 'Not set' },
    { label: 'Location', value: employee?.company_location || 'Not set' },
    { label: 'Organization Type', value: employee?.company_organization_type || 'Not set' },
    { label: 'Created', value: formatEmployeeDate(employee?.created_at) },
  ]
})

const employeeOverviewCards = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  const documentCount = [
    employee?.company_verification_document_1_path,
    employee?.company_verification_document_2_path,
    employee?.company_verification_document_3_path,
  ].filter((value) => String(value || '').trim()).length

  return [
    { label: 'Account ID', value: displayText(employee?.public_id, 'Pending ID') },
    { label: 'Status', value: titleCaseText(employee?.approval_status, 'Pending') },
    { label: 'Type', value: titleCaseText(employee?.company_organization_type || 'business', 'Business') },
    { label: 'Files', value: `${documentCount} document${documentCount === 1 ? '' : 's'}` },
  ]
})

const employeeProfileRows = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  return [
    { label: 'Business Name', value: employeeDisplayName(employee) },
    { label: 'Business Email', value: employeeEmail(employee) },
    { label: 'Contact Number', value: displayText(employee?.company_contact_number) },
    { label: 'Location', value: displayText(employee?.company_location) },
    { label: 'Category', value: displayText(employee?.company_category) },
    { label: 'Organization Type', value: titleCaseText(employee?.company_organization_type || 'business', 'Business') },
  ]
})

const employeeAccountRows = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  return [
    { label: 'User ID', value: displayText(employee?.id, 'Not set') },
    { label: 'Public ID', value: displayText(employee?.public_id, 'Pending ID') },
    { label: 'Email Verified', value: employee?.email_verified ? 'Verified' : 'Not verified' },
    { label: 'Created Date', value: formatEmployeeDate(employee?.created_at) },
    { label: 'Reviewed Date', value: formatEmployeeDate(employee?.reviewed_at) },
    { label: 'Current Status', value: titleCaseText(employee?.approval_status, 'Pending') },
  ]
})

const employeeVerificationDocuments = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  return [
    employee?.company_verification_document_1_path,
    employee?.company_verification_document_2_path,
    employee?.company_verification_document_3_path,
  ]
    .map((path, index) => {
      const value = String(path || '').trim()
      if (!value) return null
      const fileName = getDocumentFileName(value, `verification-document-${index + 1}`)
      return {
        id: `document-${index + 1}`,
        label: `Verification Document ${index + 1}`,
        value,
        fileName,
        fileType: documentTypeLabel(fileName),
        isImage: isImageDocument(fileName),
        isPdf: isPdfDocument(fileName),
      }
    })
    .filter(Boolean)
})

const employeeWorkspaceMembers = computed(() => {
  const employeeId = String(selectedEmployee.value?.id || '').trim()
  if (!employeeId) return []
  return Array.isArray(props.workspaceMembersByBusinessId?.[employeeId])
    ? props.workspaceMembersByBusinessId[employeeId]
    : []
})

const employeeTeamMembers = computed(() =>
  normalizeTeamMembers(selectedEmployee.value, employeeWorkspaceMembers.value),
)

const employeeSubscriptionRows = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) return []

  const plan =
    employee?.active_subscription_plan
    || employee?.activeSubscriptionPlan
    || employee?.subscription_plan
    || employee?.subscriptionPlan
    || ''
  const mode =
    employee?.active_subscription_mode
    || employee?.activeSubscriptionMode
    || employee?.subscription_mode
    || employee?.subscriptionMode
    || ''
  const trialStartedAt =
    employee?.premium_trial_started_at
    || employee?.premiumTrialStartedAt
    || ''
  const paidStartedAt =
    employee?.premium_paid_started_at
    || employee?.premiumPaidStartedAt
    || ''

  return [
    { label: 'Current Plan', value: titleCaseText(plan, 'No subscription data') },
    { label: 'Access Mode', value: titleCaseText(mode, 'Not set') },
    { label: 'Trial Started', value: formatEmployeeDate(trialStartedAt) },
    { label: 'Paid Started', value: formatEmployeeDate(paidStartedAt) },
  ]
})

const openImagePreview = (document) => {
  if (!document?.isImage || !document?.value) return

  imagePreview.value = {
    open: true,
    src: document.value,
  }
}

const closeImagePreview = () => {
  imagePreview.value = {
    open: false,
    src: '',
  }
}

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

const resetEmployeeModal = () => {
  activeModal.value = ''
  selectedEmployee.value = null
  closeImagePreview()
  editEmployeeStatus.value = 'pending'
  modalError.value = ''
  employeeEditForm.value = {
    company_name: '',
    company_contact_number: '',
    company_location: '',
    company_category: '',
  }
}

const handleEmployeeDragStart = (event, employee) => {
  if (isSavingEmployeeOrder.value) return

  const employeeId = employeeRecordId(employee)
  if (!employeeId) return

  isDraggingEmployee.value = true
  draggedEmployeeId.value = employeeId
  draggedOverEmployeeId.value = employeeId
  draggedOverEmployeePosition.value = 'after'
  previewEmployeeOrderIds.value = allEmployeesOrdered.value.map((record) => employeeRecordId(record))

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', employeeId)
  }
}

const handleEmployeeDragEnd = () => {
  isDraggingEmployee.value = false
  draggedEmployeeId.value = ''
  draggedOverEmployeeId.value = ''
  draggedOverEmployeePosition.value = 'after'
  previewEmployeeOrderIds.value = []
  isDeleteDropZoneActive.value = false
}

const resolveEmployeeDropPosition = (event) => {
  const targetRow = event.currentTarget
  if (!(targetRow instanceof HTMLElement)) return 'after'
  const rect = targetRow.getBoundingClientRect()
  const pointerY = Number(event.clientY) || rect.top
  return pointerY < rect.top + (rect.height / 2) ? 'before' : 'after'
}

const handleEmployeeRowDragEnter = (event, employee) => {
  if (!draggedEmployeeId.value || isSavingEmployeeOrder.value) return

  const employeeId = employeeRecordId(employee)
  if (!employeeId || employeeId === draggedEmployeeId.value) return

  event.preventDefault()
  const nextPosition = resolveEmployeeDropPosition(event)
  if (draggedOverEmployeeId.value === employeeId && draggedOverEmployeePosition.value === nextPosition) return

  draggedOverEmployeeId.value = employeeId
  draggedOverEmployeePosition.value = nextPosition
  isDeleteDropZoneActive.value = false
  previewEmployeeOrderIds.value = reorderEmployeeRowsByPlacement(
    allEmployeesPreviewOrdered.value,
    draggedEmployeeId.value,
    employeeId,
    nextPosition,
  ).map((record) => employeeRecordId(record))
}

const handleEmployeeRowDragOver = (event, employee) => {
  if (!draggedEmployeeId.value || isSavingEmployeeOrder.value) return

  event.preventDefault()
  const employeeId = employeeRecordId(employee)
  if (employeeId && employeeId !== draggedEmployeeId.value) {
    const nextPosition = resolveEmployeeDropPosition(event)
    if (draggedOverEmployeeId.value !== employeeId || draggedOverEmployeePosition.value !== nextPosition) {
      draggedOverEmployeeId.value = employeeId
      draggedOverEmployeePosition.value = nextPosition
      previewEmployeeOrderIds.value = reorderEmployeeRowsByPlacement(
        allEmployeesPreviewOrdered.value,
        draggedEmployeeId.value,
        employeeId,
        nextPosition,
      ).map((record) => employeeRecordId(record))
    }
  }
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleEmployeeRowDrop = async (event, employee) => {
  event.preventDefault()

  const targetEmployeeId = employeeRecordId(employee)
  const sourceEmployeeId = draggedEmployeeId.value || event.dataTransfer?.getData('text/plain') || ''
  const targetPlacement = draggedOverEmployeePosition.value

  isDraggingEmployee.value = false
  draggedEmployeeId.value = ''
  draggedOverEmployeeId.value = ''
  draggedOverEmployeePosition.value = 'after'
  isDeleteDropZoneActive.value = false

  if (
    !sourceEmployeeId
    || !targetEmployeeId
    || sourceEmployeeId === targetEmployeeId
    || isSavingEmployeeOrder.value
  ) {
    previewEmployeeOrderIds.value = []
    return
  }

  const orderedMap = new Map(
    allEmployeesOrdered.value.map((record) => [employeeRecordId(record), record]),
  )
  const nextEmployees = previewEmployeeOrderIds.value.length
    ? previewEmployeeOrderIds.value.map((id) => orderedMap.get(id)).filter(Boolean)
    : reorderEmployeeRowsByPlacement(allEmployeesOrdered.value, sourceEmployeeId, targetEmployeeId, targetPlacement)
  const movedEmployee = nextEmployees.find((record) => employeeRecordId(record) === sourceEmployeeId)

  if (!movedEmployee) {
    previewEmployeeOrderIds.value = []
    return
  }

  isSavingEmployeeOrder.value = true

  try {
    await updateEmployerSortOrders(nextEmployees.map((record) => employeeRecordId(record)))
    setActionNotice('success', `${employeeDisplayName(movedEmployee)} order was updated.`)
  } catch (error) {
    setActionNotice('error', String(error?.message || 'Unable to reorder employees right now.'))
  } finally {
    previewEmployeeOrderIds.value = []
    isSavingEmployeeOrder.value = false
  }
}

const handleDeleteDropZoneDragOver = (event) => {
  if (!draggedEmployeeId.value) return
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

  const employeeId = draggedEmployeeId.value || event.dataTransfer?.getData('text/plain') || ''
  const employee = findEmployeeById(employeeId)
  isDraggingEmployee.value = false
  draggedEmployeeId.value = ''
  draggedOverEmployeeId.value = ''
  draggedOverEmployeePosition.value = 'after'
  previewEmployeeOrderIds.value = []

  if (!employee) return
  openEmployeeModal('delete', employee)
}

const closeEmployeeModal = () => {
  if (isSubmitting.value) return
  resetEmployeeModal()
}

const openEmployeeModal = (type, employee) => {
  activeModal.value = type
  selectedEmployee.value = employee
  editEmployeeStatus.value = normalizeStatusValue(employee?.approval_status) || 'pending'
  modalError.value = ''

  if (type === 'edit') {
    employeeEditForm.value = {
      company_name: String(employee?.company_name || employee?.name || '').trim(),
      company_contact_number: String(employee?.company_contact_number || '').trim(),
      company_location: String(employee?.company_location || '').trim(),
      company_category: String(employee?.company_category || '').trim(),
    }
  }
}

const buildEmployeeStatusPayload = (status) => {
  const nextStatus = normalizeStatusValue(status) || 'pending'
  const payload = { status: nextStatus }

  if (nextStatus === 'rejected') {
    payload.rejectionReason = 'Updated by admin.'
  }

  return payload
}

const handleEmployeeStatusUpdate = async (status, successMessage) => {
  if (!selectedEmployee.value?.id) return

  const currentEmployeeName = employeeDisplayName(selectedEmployee.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await updateEmployerApprovalStatus(
      selectedEmployee.value.id,
      buildEmployeeStatusPayload(status),
    )
    resetEmployeeModal()
    setActionNotice('success', `${currentEmployeeName} ${successMessage}`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to update this employee right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleEmployeeApprove = async () => {
  await handleEmployeeStatusUpdate('approved', 'was approved.')
}

const handleEmployeeReject = async () => {
  await handleEmployeeStatusUpdate('rejected', 'was rejected.')
}

const handleEmployeeQuickApprove = async (employee) => {
  selectedEmployee.value = employee
  activeModal.value = ''
  await handleEmployeeApprove()
}

const handleEmployeeQuickReject = async (employee) => {
  selectedEmployee.value = employee
  activeModal.value = ''
  await handleEmployeeReject()
}

const isEmployeePending = (employee) =>
  normalizeStatusValue(employee?.approval_status) === 'pending'

const isEmployeeApproved = (employee) =>
  normalizeStatusValue(employee?.approval_status) === 'approved'

const isEmployeeBanned = (employee) =>
  normalizeStatusValue(employee?.approval_status) === 'banned'

const handleEmployeeSaveEdit = async () => {
  if (!selectedEmployee.value?.id) return

  const currentEmployeeName = employeeDisplayName(selectedEmployee.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await updateEmployerAdminDetails(selectedEmployee.value.id, employeeEditForm.value)
    resetEmployeeModal()
    setActionNotice('success', `${currentEmployeeName} was updated.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to save this employee right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleEmployeeDisable = async () => {
  if (!selectedEmployee.value?.id) return

  const currentEmployeeName = employeeDisplayName(selectedEmployee.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await updateEmployerApprovalStatus(
      selectedEmployee.value.id,
      buildEmployeeStatusPayload('banned'),
    )
    resetEmployeeModal()
    setActionNotice('success', `${currentEmployeeName} was disabled.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to disable this employee right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleEmployeeDelete = async () => {
  if (!selectedEmployee.value?.id) return

  const deletedEmployeeId = selectedEmployee.value.id
  const currentEmployeeName = employeeDisplayName(selectedEmployee.value)
  isSubmitting.value = true
  modalError.value = ''

  try {
    await deleteEmployerAccountRecord(deletedEmployeeId)
    deletingEmployeeIds.value = [...new Set([...deletingEmployeeIds.value, deletedEmployeeId])]
    resetEmployeeModal()
    setActionNotice('success', `${currentEmployeeName} was deleted.`)
  } catch (error) {
    modalError.value = String(error?.message || 'Unable to delete this employee right now.')
  } finally {
    isSubmitting.value = false
  }
}

const handleBulkEmployeeDelete = async () => {
  const employeeIds = [...new Set(selectedEmployeeIds.value.filter(Boolean))]
  if (!employeeIds.length) {
    setActionNotice('error', 'Select at least one business to delete.')
    return
  }

  isBulkDeletingEmployees.value = true

  try {
    for (const employeeId of employeeIds) {
      await deleteEmployerAccountRecord(employeeId)
    }

    deletingEmployeeIds.value = [...new Set([...deletingEmployeeIds.value, ...employeeIds])]
    selectedEmployeeIds.value = []
    selectMode.value = false
    setActionNotice('success', `${employeeIds.length} employee${employeeIds.length === 1 ? '' : 's'} were deleted.`)
  } catch (error) {
    setActionNotice('error', String(error?.message || 'Unable to delete the selected businesses right now.'))
  } finally {
    isBulkDeletingEmployees.value = false
  }
}
</script>

<template>
  <section class="dashboard-employee-list" :class="{ 'is-dragging': isDraggingEmployee }">
    <article class="employee-list-toolbar-card">
      <div class="employee-list-toolbar">
        <div class="employee-list-toolbar__actions">
          <button type="button" class="employee-list-toolbar__ghost-btn" @click="toggleSelectMode">
            <i class="bi bi-check2-square" aria-hidden="true" />
            {{ selectMode ? 'Cancel Selection' : 'Select Businesses' }}
          </button>
          <button
            v-if="selectMode"
            type="button"
            class="employee-list-delete-dropzone"
            :class="{
              'is-active': isDeleteDropZoneActive,
              'is-disabled': isBulkDeletingEmployees || !selectedEmployeeIds.length,
            }"
            :disabled="isBulkDeletingEmployees || !selectedEmployeeIds.length"
            @dragover="handleDeleteDropZoneDragOver"
            @dragleave="handleDeleteDropZoneDragLeave"
            @drop="handleDeleteDropZoneDrop"
            @click="handleBulkEmployeeDelete"
          >
            <i class="bi bi-trash3" aria-hidden="true" />
            <span>
              {{
                isBulkDeletingEmployees
                  ? 'Deleting...'
                  : (isDeleteDropZoneActive ? 'Drop to Delete' : `Delete Selected${selectedEmployeeIds.length ? ` (${selectedEmployeeIds.length})` : ''}`)
              }}
            </span>
          </button>
        </div>
      </div>

      <Transition name="employee-list-notice">
        <div
          v-if="actionNotice"
          class="employee-list-notice"
          :class="`is-${actionNotice.kind}`"
          role="status"
          aria-live="polite"
        >
          <div class="employee-list-notice__icon" :class="`is-${actionNotice.kind}`" aria-hidden="true">
            <i :class="actionNotice.kind === 'error' ? 'bi bi-x-circle-fill' : 'bi bi-check-circle-fill'" />
          </div>
          <div class="employee-list-notice__copy">
            <strong>{{ actionNoticeTitle }}</strong>
            <span>{{ actionNotice.text }}</span>
          </div>
          <button type="button" class="employee-list-notice__close" aria-label="Close notification" @click="actionNotice = null">
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </article>

    <div class="employee-list-table-shell">
      <table class="employee-list-table">
        <thead>
          <tr>
            <th v-if="selectMode" class="employee-list-table__select-head">
              <input
                type="checkbox"
                :checked="allEmployeesSelected"
                :aria-label="allEmployeesSelected ? 'Deselect all businesses' : 'Select all businesses'"
                @change="toggleSelectAllEmployees"
              >
            </th>
            <th>#</th>
              <th>Business</th>
            <th>Contact</th>
            <th>Location</th>
            <th>Status</th>
            <th>Date</th>
            <th class="employee-list-table__actions-head">Actions</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="employee-row">
          <tr
            v-for="(employee, index) in filteredEmployees"
            :key="employee.id || `${employeeEmail(employee)}-${index}`"
            :class="{
              'is-fresh': isFreshEmployee(employee),
              'is-drop-target': draggedOverEmployeeId === employeeRecordId(employee) && draggedEmployeeId !== employeeRecordId(employee),
              'is-drop-target-top': draggedOverEmployeeId === employeeRecordId(employee) && draggedOverEmployeePosition === 'before' && draggedEmployeeId !== employeeRecordId(employee),
              'is-drop-target-bottom': draggedOverEmployeeId === employeeRecordId(employee) && draggedOverEmployeePosition === 'after' && draggedEmployeeId !== employeeRecordId(employee),
              'is-dragging-source': draggedEmployeeId === employeeRecordId(employee),
            }"
            :draggable="!isSavingEmployeeOrder && !selectMode"
            @click="selectMode ? null : openEmployeeModal('view', employee)"
            @dragstart="handleEmployeeDragStart($event, employee)"
            @dragenter="handleEmployeeRowDragEnter($event, employee)"
            @dragover="handleEmployeeRowDragOver($event, employee)"
            @drop="handleEmployeeRowDrop($event, employee)"
            @dragend="handleEmployeeDragEnd"
          >
            <td v-if="selectMode" class="employee-list-table__select-cell" @click.stop>
              <input
                type="checkbox"
                :checked="selectedEmployeeIds.includes(employeeRecordId(employee))"
                aria-label="Select business"
                @change="toggleEmployeeSelection(employee)"
              >
            </td>
            <td>{{ index + 1 }}</td>
            <td>
              <div class="employee-list-table__name">
                <span class="employee-list-table__avatar" aria-hidden="true">
                  <img
                    v-if="employeeAvatarSrc(employee)"
                    :src="employeeAvatarSrc(employee)"
                    :alt="`${employeeDisplayName(employee)} avatar`"
                    class="employee-list-table__avatar-image"
                  >
                  <template v-else>{{ employeeInitials(employee) }}</template>
                </span>
                <span class="employee-list-table__identity">
                  <strong>{{ employeeDisplayName(employee) }}</strong>
                  <span>{{ employeeEmail(employee) }}</span>
                </span>
              </div>
            </td>
            <td>{{ employee.company_contact_number || 'Not set' }}</td>
            <td>{{ employee.company_location || employee.company_category || 'Not set' }}</td>
            <td>
              <span class="employee-status-pill" :class="`is-${normalizeStatusValue(employee.approval_status) || 'pending'}`">
                {{ employee.approval_status || 'pending' }}
              </span>
            </td>
            <td>{{ formatEmployeeDate(employee.created_at) }}</td>
            <td class="employee-list-table__actions-cell">
              <div class="employee-list-actions">
                <button
                  type="button"
                  class="employee-list-action-btn"
                  title="View"
                  aria-label="View"
                  :disabled="selectMode"
                  @click.stop="openEmployeeModal('view', employee)"
                >
                  <i class="bi bi-eye" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeePending(employee)"
                  type="button"
                  class="employee-list-action-btn employee-list-action-btn--approve"
                  title="Approve"
                  aria-label="Approve"
                  :disabled="selectMode"
                  @click.stop="handleEmployeeQuickApprove(employee)"
                >
                  <i class="bi bi-check2-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeePending(employee)"
                  type="button"
                  class="employee-list-action-btn employee-list-action-btn--reject"
                  title="Reject"
                  aria-label="Reject"
                  :disabled="selectMode"
                  @click.stop="handleEmployeeQuickReject(employee)"
                >
                  <i class="bi bi-x-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeePending(employee)"
                  type="button"
                  class="employee-list-action-btn employee-list-action-btn--danger"
                  title="Delete"
                  aria-label="Delete"
                  :disabled="selectMode"
                  @click.stop="openEmployeeModal('delete', employee)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeeApproved(employee)"
                  type="button"
                  class="employee-list-action-btn"
                  title="Edit"
                  aria-label="Edit"
                  :disabled="selectMode"
                  @click.stop="openEmployeeModal('edit', employee)"
                >
                  <i class="bi bi-pencil-square" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeeApproved(employee)"
                  type="button"
                  class="employee-list-action-btn"
                  title="Disable"
                  aria-label="Disable"
                  :disabled="selectMode"
                  @click.stop="openEmployeeModal('disable', employee)"
                >
                  <i class="bi bi-slash-circle" aria-hidden="true" />
                </button>
                <button
                  v-if="isEmployeeApproved(employee) || isEmployeeBanned(employee)"
                  type="button"
                  class="employee-list-action-btn employee-list-action-btn--danger"
                  title="Delete"
                  aria-label="Delete"
                  :disabled="selectMode"
                  @click.stop="openEmployeeModal('delete', employee)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredEmployees.length">
            <td :colspan="selectMode ? 8 : 7">
              <div class="employee-list-empty">No business records found.</div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <AdminSimpleModal
      :open="Boolean(activeModal && selectedEmployee)"
      :title="employeeModalTitle"
      :subtitle="employeeModalSubtitle"
      :show-close-button="employeeModalShowHeaderClose"
      :max-width="activeModal === 'delete' || activeModal === 'disable' ? '30rem' : '46rem'"
      @close="closeEmployeeModal"
    >
      <div v-if="activeModal === 'view'" class="employee-modal__workspace">
        <section class="employee-modal__hero">
          <div class="employee-modal__hero-main">
            <div class="employee-modal__hero-avatar" aria-hidden="true">
              <img
                v-if="employeeAvatarSrc(selectedEmployee)"
                :src="employeeAvatarSrc(selectedEmployee)"
                :alt="`${employeeDisplayName(selectedEmployee)} avatar`"
                class="employee-modal__hero-avatar-image"
              >
              <template v-else>{{ employeeInitials(selectedEmployee) }}</template>
            </div>
            <div class="employee-modal__hero-copy">
              <strong>{{ employeeDisplayName(selectedEmployee) }}</strong>
              <span>{{ employeeEmail(selectedEmployee) }}</span>
              <div class="employee-modal__hero-meta">
                <span class="employee-status-pill" :class="`is-${normalizeStatusValue(selectedEmployee?.approval_status)}`">
                  {{ titleCaseText(selectedEmployee?.approval_status, 'Pending') }}
                </span>
                <span class="employee-modal__hero-chip">
                  {{ displayText(selectedEmployee?.public_id, 'Pending ID') }}
                </span>
              </div>
            </div>
          </div>

          <div class="employee-modal__overview-grid">
            <div v-for="card in employeeOverviewCards" :key="card.label" class="employee-modal__overview-card">
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
            </div>
          </div>
        </section>

        <div class="employee-modal__section-grid">
          <section class="employee-modal__section">
            <div class="employee-modal__section-heading">
              <strong>Business Profile</strong>
              <span>Main business information saved on the account.</span>
            </div>
            <div class="employee-modal__details">
              <div v-for="detail in employeeProfileRows" :key="detail.label" class="employee-modal__detail">
                <span>{{ detail.label }}</span>
                <strong>{{ detail.value }}</strong>
              </div>
            </div>
          </section>

          <section class="employee-modal__section">
            <div class="employee-modal__section-heading">
              <strong>Account Details</strong>
              <span>Admin-facing identity and approval information.</span>
            </div>
            <div class="employee-modal__details">
              <div v-for="detail in employeeAccountRows" :key="detail.label" class="employee-modal__detail">
                <span>{{ detail.label }}</span>
                <strong>{{ detail.value }}</strong>
              </div>
            </div>
          </section>

          <section class="employee-modal__section">
            <div class="employee-modal__section-heading">
              <strong>Subscription</strong>
              <span>Current premium or trial data if available.</span>
            </div>
            <div class="employee-modal__details">
              <div v-for="detail in employeeSubscriptionRows" :key="detail.label" class="employee-modal__detail">
                <span>{{ detail.label }}</span>
                <strong>{{ detail.value }}</strong>
              </div>
            </div>
          </section>

          <section class="employee-modal__section">
            <div class="employee-modal__section-heading">
              <strong>Verification Files</strong>
              <span>Documents detected on the business profile.</span>
            </div>
            <div v-if="employeeVerificationDocuments.length" class="employee-modal__document-list">
              <div
                v-for="document in employeeVerificationDocuments"
                :key="document.id"
                class="employee-modal__document-item"
              >
                <div class="employee-modal__document-content">
                  <div v-if="document.isImage" class="employee-modal__document-preview">
                    <a
                      class="employee-modal__document-preview-link"
                      href="#"
                      @click.prevent="openImagePreview(document)"
                    >
                      <img :src="document.value" :alt="document.fileName" loading="lazy" />
                    </a>
                  </div>
                  <div class="employee-modal__document-copy">
                    <strong>{{ document.label }}</strong>
                    <span class="employee-modal__document-name">{{ document.fileName }}</span>
                    <span>{{ document.fileType }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="employee-modal__empty">
              No verification files are attached to this business account yet.
            </div>
          </section>

          <section class="employee-modal__section employee-modal__section--full">
            <div class="employee-modal__section-heading">
              <strong>Team Members</strong>
              <span>Extra business members linked to this account will appear here.</span>
            </div>
            <div v-if="employeeTeamMembers.length" class="employee-modal__member-list">
              <article
                v-for="member in employeeTeamMembers"
                :key="member.id"
                class="employee-modal__member-card"
              >
                <div class="employee-modal__member-avatar">
                  {{ employeeInitials({ name: member.name }) }}
                </div>
                <div class="employee-modal__member-copy">
                  <strong>{{ member.name }}</strong>
                  <span>{{ member.email || 'No email saved' }}</span>
                </div>
                <div class="employee-modal__member-meta">
                  <span class="employee-modal__hero-chip">{{ member.role }}</span>
                  <span v-if="member.status" class="employee-modal__hero-chip">{{ member.status }}</span>
                </div>
              </article>
            </div>
            <div v-else class="employee-modal__empty">
              No stored team members were found for this business yet.
            </div>
          </section>
        </div>
      </div>

      <div v-else-if="activeModal === 'edit'" class="employee-modal__form">
        <label class="employee-modal__field">
          <span>Company Name</span>
          <input v-model.trim="employeeEditForm.company_name" type="text" placeholder="Enter company name" />
        </label>
        <label class="employee-modal__field">
          <span>Contact</span>
          <input v-model.trim="employeeEditForm.company_contact_number" type="text" placeholder="Enter contact number" />
        </label>
        <label class="employee-modal__field">
          <span>Location</span>
          <input v-model.trim="employeeEditForm.company_location" type="text" placeholder="Enter location" />
        </label>
        <label class="employee-modal__field">
          <span>Category</span>
          <input v-model.trim="employeeEditForm.company_category" type="text" placeholder="Enter category" />
        </label>
      </div>

      <div v-else-if="activeModal === 'disable'" class="employee-modal__panel employee-modal__panel--danger">
        <div class="employee-modal__danger-icon" aria-hidden="true">
          <i class="bi bi-slash-circle" />
        </div>
        <p class="employee-modal__copy">
          Are you sure you want to disable {{ employeeDisplayName(selectedEmployee) }}?
        </p>
        <p class="employee-modal__warning">
          This will set the account status to banned.
        </p>
      </div>

      <div v-else-if="activeModal === 'delete'" class="employee-modal__panel employee-modal__panel--danger">
        <div class="employee-modal__danger-icon employee-modal__danger-icon--delete" aria-hidden="true">
          <i class="bi bi-trash3" />
        </div>
        <p class="employee-modal__copy">
          Delete <strong>{{ employeeDisplayName(selectedEmployee) }}</strong> permanently?
        </p>
        <p class="employee-modal__warning">
          This action cannot be undone and will remove the business account from the platform.
        </p>
      </div>

      <div v-if="modalError" class="employee-modal__error">
        {{ modalError }}
      </div>

      <template #actions>
        <button
          type="button"
          class="employee-modal__button employee-modal__button--ghost"
          :disabled="isSubmitting"
          @click="closeEmployeeModal"
        >
          {{ activeModal === 'view' ? 'Done' : 'Cancel' }}
        </button>

        <button
          v-if="activeModal === 'edit'"
          type="button"
          class="employee-modal__button employee-modal__button--primary"
          :disabled="isSubmitting"
          @click="handleEmployeeSaveEdit"
        >
          {{ isSubmitting ? 'Saving...' : 'Save Rename' }}
        </button>

        <button
          v-if="activeModal === 'view' && normalizeStatusValue(selectedEmployee?.approval_status) === 'pending'"
          type="button"
          class="employee-modal__button employee-modal__button--primary"
          :disabled="isSubmitting"
          @click="handleEmployeeApprove"
        >
          {{ isSubmitting ? 'Approving...' : 'Approve' }}
        </button>

        <button
          v-if="activeModal === 'view' && normalizeStatusValue(selectedEmployee?.approval_status) === 'pending'"
          type="button"
          class="employee-modal__button employee-modal__button--warn"
          :disabled="isSubmitting"
          @click="handleEmployeeReject"
        >
          {{ isSubmitting ? 'Rejecting...' : 'Reject' }}
        </button>

        <button
          v-else-if="activeModal === 'disable'"
          type="button"
          class="employee-modal__button employee-modal__button--warn"
          :disabled="isSubmitting"
          @click="handleEmployeeDisable"
        >
          {{ isSubmitting ? 'Disabling...' : 'Disable Business' }}
        </button>

        <button
          v-else-if="activeModal === 'delete'"
          type="button"
          class="employee-modal__button employee-modal__button--danger"
          :disabled="isSubmitting"
          @click="handleEmployeeDelete"
        >
          <span v-if="isSubmitting" class="employee-modal__button-spinner" aria-hidden="true" />
          {{ isSubmitting ? 'Deleting...' : 'Delete Business' }}
        </button>
      </template>
    </AdminSimpleModal>

    <Teleport to="body">
      <Transition name="employee-image-viewer">
        <div
          v-if="imagePreview.open"
          class="employee-image-viewer"
          role="dialog"
          aria-modal="true"
          @click.self="closeImagePreview"
        >
          <button
            type="button"
            class="employee-image-viewer__close"
            aria-label="Close image preview"
            @click="closeImagePreview"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>

          <div class="employee-image-viewer__stage">
            <img :src="imagePreview.src" alt="Verification image" class="employee-image-viewer__image" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.dashboard-employee-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.95rem;
}

.employee-list-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px auto;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.employee-list-filter {
  display: grid;
  gap: 0.38rem;
}

.employee-list-filter span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.employee-list-filter input,
.employee-list-filter select {
  min-height: 2.65rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.55rem;
  padding: 0 0.9rem;
  outline: none;
  background: #fff;
  color: #274234;
  font: inherit;
}

.employee-list-filter input:focus,
.employee-list-filter select:focus {
  border-color: rgba(55, 151, 102, 0.34);
  box-shadow: 0 0 0 4px rgba(55, 151, 102, 0.08);
}

.employee-list-toolbar__actions {
  display: flex;
  align-items: end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.employee-list-toolbar__filter-btn,
.employee-list-toolbar__ghost-btn,
.employee-list-toolbar__primary-btn {
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

.employee-list-toolbar__filter-btn i,
.employee-list-toolbar__ghost-btn i,
.employee-list-toolbar__primary-btn i {
  font-size: 0.82rem;
}

.employee-list-toolbar__filter-btn {
  border: 1px solid #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.employee-list-toolbar__ghost-btn {
  border: 1px solid #d7dfd9;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
}

.employee-list-toolbar__primary-btn {
  border: 1px solid #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.employee-list-toolbar__filter-btn:hover,
.employee-list-toolbar__ghost-btn:hover,
.employee-list-toolbar__primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

.employee-list-delete-dropzone {
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

.employee-list-delete-dropzone.is-active {
  border-color: rgba(220, 38, 38, 0.32);
  background: linear-gradient(180deg, #fff1f1 0%, #ffe4e4 100%);
  color: #991b1b;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.employee-list-delete-dropzone.is-disabled {
  opacity: 0.7;
  cursor: wait;
}

.employee-list-notice {
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

.employee-list-notice.is-success {
  border-color: rgba(22, 163, 74, 0.16);
}

.employee-list-notice.is-error {
  border-color: rgba(171, 70, 70, 0.22);
}

.employee-list-notice__icon {
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

.employee-list-notice__icon.is-success {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.96) 0%, rgba(220, 252, 231, 0.82) 100%);
  color: #16a34a;
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.24);
}

.employee-list-notice__icon i {
  font-size: 1.1rem;
  line-height: 1;
}

.employee-list-notice__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.employee-list-notice__copy strong,
.employee-list-notice__copy span {
  margin: 0;
}

.employee-list-notice__copy strong {
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 800;
}

.employee-list-notice__copy span {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.employee-list-notice__close {
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

.employee-list-notice__close:hover {
  background: #fff5f5;
  border-color: #fecaca;
  color: #dc2626;
  transform: rotate(90deg);
}

.employee-list-notice-enter-active,
.employee-list-notice-leave-active {
  transition: opacity 0.2s ease, transform 0.22s ease;
}

.employee-list-notice-enter-from,
.employee-list-notice-leave-to {
  opacity: 0;
  transform: translate3d(0, -10px, 0);
}

.employee-list-table-shell {
  overflow: hidden;
  border: 1px solid rgba(122, 179, 145, 0.14);
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: none;
}

.employee-list-table {
  width: 100%;
  border-collapse: collapse;
}

.employee-list-table thead th {
  padding: 0.82rem 0.9rem;
  text-align: left;
  color: #6d8576;
  font-size: 0.76rem;
  font-weight: 700;
  background: #f7fbf8;
}

.employee-list-table__select-head,
.employee-list-table__select-cell {
  width: 2.8rem;
}

.employee-list-table__select-head input,
.employee-list-table__select-cell input {
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

.employee-list-table__select-head input::before,
.employee-list-table__select-cell input::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  clip-path: polygon(14% 44%, 0 59%, 39% 100%, 100% 21%, 84% 7%, 38% 67%);
  transform: scale(0);
  transform-origin: center;
  transition: transform 0.16s ease;
  background: #ffffff;
}

.employee-list-table__select-head input:hover,
.employee-list-table__select-cell input:hover {
  border-color: #2c8a62;
  box-shadow: 0 0 0 4px rgba(44, 138, 98, 0.1);
}

.employee-list-table__select-head input:checked,
.employee-list-table__select-cell input:checked {
  border-color: #2c8a62;
  background: linear-gradient(135deg, #2c8a62 0%, #39a071 100%);
}

.employee-list-table__select-head input:checked::before,
.employee-list-table__select-cell input:checked::before {
  transform: scale(1);
}

.employee-list-table tbody tr {
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.employee-list-table tbody tr:active {
  cursor: grabbing;
}

.employee-list-table tbody td {
  padding: 0.82rem 0.9rem;
  color: #35503f;
  font-size: 0.84rem;
  border-top: 1px solid rgba(122, 179, 145, 0.1);
  vertical-align: middle;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.employee-list-table tbody tr:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.08));
}

.employee-list-table tbody tr:hover td {
  background: #f2f4f5;
  border-color: rgba(203, 213, 225, 0.7);
}

.dashboard-employee-list.is-dragging .employee-list-table tbody tr:hover {
  transform: none;
  filter: none;
}

.dashboard-employee-list.is-dragging .employee-list-table tbody tr:hover td {
  background: inherit;
  border-color: rgba(122, 179, 145, 0.1);
}

.employee-list-table tbody tr.is-drop-target td {
  background: rgba(228, 246, 236, 0.95);
}

.employee-list-table tbody tr.is-drop-target-top td {
  border-top-color: rgba(44, 138, 98, 0.68);
  box-shadow: inset 0 3px 0 rgba(44, 138, 98, 0.72);
}

.employee-list-table tbody tr.is-drop-target-bottom td {
  border-bottom-color: rgba(44, 138, 98, 0.68);
  box-shadow: inset 0 -3px 0 rgba(44, 138, 98, 0.72);
}

.employee-list-table tbody tr[draggable="true"] {
  user-select: none;
}

.employee-list-table tbody tr[draggable="true"]:active td,
.employee-list-table tbody tr.is-dragging-source td {
  opacity: 0.45;
}

.employee-row-enter-active,
.employee-row-leave-active,
.employee-row-move {
  transition:
    transform 0.36s ease,
    opacity 0.36s ease;
}

.employee-row-enter-from,
.employee-row-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.employee-list-table tbody tr.is-fresh td {
  animation: employee-row-glow 2.2s ease;
}

@keyframes employee-row-glow {
  0% {
    background: rgba(214, 240, 225, 0.94);
  }

  100% {
    background: transparent;
  }
}

.employee-list-table__name {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.employee-list-table__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.3rem;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(53, 90, 168, 0.18);
  background: linear-gradient(135deg, #355aa8, #7fa2eb);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 18px rgba(53, 90, 168, 0.16);
  overflow: hidden;
}

.employee-list-table__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.employee-list-table__identity {
  display: grid;
  gap: 0.16rem;
  min-width: 0;
}

.employee-list-table__identity strong {
  color: #1f3a2d;
  font-size: 0.88rem;
  font-weight: 700;
}

.employee-list-table__identity span {
  color: #7a9383;
  font-size: 0.76rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.employee-status-pill {
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

.employee-status-pill.is-pending {
  background: rgba(240, 154, 74, 0.14);
  border-color: rgba(240, 154, 74, 0.2);
  color: #be7b39;
}

.employee-status-pill.is-approved {
  border-color: #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
}

.employee-status-pill.is-rejected,
.employee-status-pill.is-banned {
  background: rgba(223, 115, 134, 0.12);
  border-color: rgba(223, 115, 134, 0.18);
  color: #bf5f72;
}

.employee-list-empty {
  padding: 1.2rem;
  text-align: center;
  color: #6f8578;
}

.employee-list-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.28rem;
}

.employee-list-action-btn {
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

.employee-list-action-btn i {
  font-size: 1rem;
}

.employee-list-action-btn:hover {
  transform: none;
  background: rgba(235, 247, 240, 0.98);
  color: #2d684d;
}

.employee-list-action-btn:disabled {
  opacity: 0.46;
  cursor: not-allowed;
  pointer-events: none;
  transform: none;
}

.employee-list-action-btn--approve:hover {
  background: rgba(235, 247, 240, 0.98);
  color: #228454;
}

.employee-list-action-btn--reject:hover {
  background: rgba(252, 239, 239, 0.98);
  color: #a54545;
}

.employee-list-action-btn--danger:hover {
  background: rgba(252, 239, 239, 0.98);
  color: #a54545;
}

.employee-list-table__actions-head,
.employee-list-table__actions-cell {
  width: 8rem;
}

.employee-modal__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.employee-modal__workspace {
  display: grid;
  gap: 1rem;
}

.employee-modal__hero {
  display: grid;
  gap: 0.95rem;
  padding: 1rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%);
}

.employee-modal__hero-main {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.employee-modal__hero-avatar,
.employee-modal__member-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #355aa8, #7fa2eb);
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 10px 20px rgba(53, 90, 168, 0.18);
  overflow: hidden;
}

.employee-modal__member-avatar {
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.78rem;
  font-size: 0.78rem;
}

.employee-modal__hero-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.employee-modal__hero-copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.employee-modal__hero-copy strong {
  color: #1f3a2d;
  font-size: 1rem;
  font-weight: 800;
}

.employee-modal__hero-copy span {
  color: #6e8577;
  font-size: 0.8rem;
}

.employee-modal__hero-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}

.employee-modal__hero-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.3rem 0.72rem;
  border: 1px solid #d7dfd9;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}

.employee-modal__overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.employee-modal__overview-card {
  padding: 0.8rem 0.85rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 0.9rem;
  background: #ffffff;
  display: grid;
  gap: 0.22rem;
}

.employee-modal__overview-card span {
  color: #6b8574;
  font-size: 0.72rem;
  font-weight: 700;
}

.employee-modal__overview-card strong {
  color: #234031;
  font-size: 0.88rem;
  line-height: 1.4;
}

.employee-modal__section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.employee-modal__section {
  display: grid;
  gap: 0.8rem;
  padding: 0.95rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 1rem;
  background: #fbfdfb;
}

.employee-modal__section--full {
  grid-column: 1 / -1;
}

.employee-modal__section-heading {
  display: grid;
  gap: 0.15rem;
}

.employee-modal__section-heading strong {
  color: #1f3a2d;
  font-size: 0.88rem;
  font-weight: 800;
}

.employee-modal__section-heading span {
  color: #70877a;
  font-size: 0.76rem;
  line-height: 1.45;
}

.employee-modal__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.employee-modal__field {
  display: grid;
  gap: 0.38rem;
}

.employee-modal__field span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.employee-modal__field input {
  min-height: 2.7rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.55rem;
  padding: 0 0.85rem;
  outline: none;
  background: #fff;
  color: #274234;
  font: inherit;
}

.employee-modal__field input:focus {
  border-color: rgba(55, 151, 102, 0.34);
  box-shadow: 0 0 0 4px rgba(55, 151, 102, 0.08);
}

.employee-modal__detail {
  padding: 0.75rem 0.8rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 0.8rem;
  background: #f8fbf9;
  display: grid;
  gap: 0.25rem;
}

.employee-modal__detail span,
.employee-modal__field span {
  color: #6b8574;
  font-size: 0.75rem;
  font-weight: 700;
}

.employee-modal__detail strong {
  color: #264333;
  font-size: 0.84rem;
  line-height: 1.45;
}

.employee-modal__document-list,
.employee-modal__member-list {
  display: grid;
  gap: 0.75rem;
}

.employee-modal__document-item,
.employee-modal__member-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgba(122, 179, 145, 0.12);
  border-radius: 0.9rem;
  background: #ffffff;
}

.employee-modal__document-content,
.employee-modal__member-copy {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}

.employee-modal__document-copy,
.employee-modal__member-copy {
  display: grid;
  gap: 0.2rem;
}

.employee-modal__document-preview {
  width: 100%;
  max-width: 18rem;
  border-radius: 0.85rem;
  overflow: hidden;
  border: 1px solid rgba(122, 179, 145, 0.14);
  background: #f8fbf9;
}

.employee-modal__document-preview-link {
  display: block;
  text-decoration: none;
  cursor: zoom-in;
}

.employee-modal__document-preview img {
  display: block;
  width: 100%;
  max-height: 11.5rem;
  object-fit: cover;
}

.employee-modal__document-item strong,
.employee-modal__member-copy strong {
  color: #234031;
  font-size: 0.84rem;
}

.employee-modal__document-item span,
.employee-modal__member-copy span {
  color: #70877a;
  font-size: 0.74rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.employee-modal__document-name {
  color: #264333 !important;
  font-size: 0.8rem !important;
  font-weight: 700;
}

.employee-modal__member-card {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
}

.employee-modal__member-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.employee-modal__empty {
  padding: 0.95rem 1rem;
  border: 1px dashed rgba(122, 179, 145, 0.26);
  border-radius: 0.9rem;
  background: rgba(247, 251, 248, 0.9);
  color: #6f8578;
  font-size: 0.78rem;
  line-height: 1.5;
}

.employee-image-viewer {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: grid;
  place-items: center;
  padding: 2rem 5.5rem 2rem 2rem;
  background: rgba(16, 24, 20, 0.78);
  backdrop-filter: blur(4px);
}

.employee-image-viewer__stage {
  display: grid;
  place-items: center;
  width: min(100%, 72rem);
  max-height: calc(100vh - 4rem);
}

.employee-image-viewer__image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 4rem);
  object-fit: contain;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.26);
}

.employee-image-viewer__close {
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

.employee-image-viewer__close i {
  font-size: 1rem;
}

.employee-image-viewer__close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.employee-image-viewer-enter-active,
.employee-image-viewer-leave-active {
  transition: opacity 0.2s ease;
}

.employee-image-viewer-enter-active .employee-image-viewer__image,
.employee-image-viewer-leave-active .employee-image-viewer__image {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.employee-image-viewer-enter-from,
.employee-image-viewer-leave-to {
  opacity: 0;
}

.employee-image-viewer-enter-from .employee-image-viewer__image,
.employee-image-viewer-leave-to .employee-image-viewer__image {
  opacity: 0;
  transform: scale(0.97);
}

.employee-modal__panel {
  display: grid;
  gap: 0.85rem;
}

.employee-modal__panel--danger {
  justify-items: center;
  text-align: center;
  padding: 0.35rem 0 0.15rem;
}

.employee-modal__danger-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 1.2rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(165, 106, 17, 0.12), rgba(244, 196, 48, 0.22));
  color: #9a640f;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.employee-modal__danger-icon--delete {
  background: linear-gradient(135deg, rgba(165, 69, 69, 0.16), rgba(245, 153, 153, 0.26));
  color: #a54545;
}

.employee-modal__danger-icon i {
  font-size: 1.75rem;
}

.employee-modal__field {
  display: grid;
  gap: 0.4rem;
}

.employee-modal__field select {
  min-height: 2.7rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.7rem;
  padding: 0 0.85rem;
  background: #fff;
  color: #274234;
  font: inherit;
}

.employee-modal__copy,
.employee-modal__warning {
  margin: 0;
  color: #567062;
  font-size: 0.83rem;
  line-height: 1.55;
}

.employee-modal__copy strong {
  color: #264333;
}

.employee-modal__warning {
  color: #8f5656;
  max-width: 24rem;
}

.employee-modal__error {
  margin-top: 0.9rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(253, 241, 241, 0.98);
  color: #9c4545;
  font-size: 0.8rem;
  line-height: 1.5;
}

.employee-modal__button {
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

.employee-modal__button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.employee-modal__button--ghost {
  background: #eef4f0;
  color: #476857;
}

.employee-modal__button--primary {
  background: #2c8a62;
  color: #fff;
}

.employee-modal__button--warn {
  background: #a56a11;
  color: #fff;
}

.employee-modal__button--danger {
  background: #a54545;
  color: #fff;
}

.employee-modal__button-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 999px;
  animation: employee-button-spin 0.75s linear infinite;
}

@keyframes employee-button-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .employee-list-toolbar {
    grid-template-columns: 1fr;
  }

  .employee-list-toolbar__actions {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .employee-list-notice {
    align-items: flex-start;
    flex-direction: column;
  }

  .employee-list-table-shell {
    overflow-x: auto;
  }

  .employee-list-table {
    min-width: 780px;
  }

  .employee-modal__details {
    grid-template-columns: 1fr;
  }

  .employee-modal__overview-grid,
  .employee-modal__section-grid {
    grid-template-columns: 1fr;
  }

  .employee-modal__member-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .employee-modal__member-meta {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .employee-list-toolbar-card {
    padding: 0.92rem;
  }

  .employee-list-toolbar__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .employee-list-notice {
    width: min(calc(100vw - 1.5rem), 32rem);
  }

  .employee-modal {
    width: min(100%, calc(100vw - 1.4rem));
  }
}

@media (max-width: 640px) {
  .employee-list-toolbar-card {
    padding: 0.85rem;
  }

  .employee-list-toolbar {
    gap: 0.68rem;
  }

  .employee-list-toolbar__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .employee-list-toolbar__filter-btn,
  .employee-list-toolbar__ghost-btn,
  .employee-list-toolbar__primary-btn {
    width: 100%;
    min-height: 2.55rem;
  }

  .employee-list-notice {
    width: calc(100vw - 1.4rem);
    left: 0.7rem;
    bottom: 0.7rem;
  }

  .employee-modal {
    width: min(100%, calc(100vw - 1rem));
  }
}
</style>
