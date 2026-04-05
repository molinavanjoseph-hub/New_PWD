<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { collection, getDocs, query, where } from 'firebase/firestore'
import AppToast from '@/components/AppToast.vue'
import ApplicantMyProfile from '@/modules/Applicant/applicant-myprofile.vue'
import ApplicantNavbar from '@/modules/Applicant/applicant_navbar.vue'
import ApplicantApplications from '@/modules/Applicant/applicant_applications.vue'
import ApplicantFindJobs from '@/modules/Applicant/applicant_findjobs.vue'
import ApplicantInterviews from '@/modules/Applicant/applicant_interviews.vue'
import ApplicantSidebar from '@/modules/Applicant/applicant_sidebar.vue'
import ApplicantTechnicalAssessment from '@/modules/Applicant/applicant_technical_assessment.vue'
import {
  clearAuthSession,
  getApplicantApprovalStatus,
  getStoredAuthUser,
  setStoredAuthUser,
  subscribeToStoredAuthUserProfile,
  updateApplicantProfileDetails,
  uploadApplicantProfileAvatar,
} from '@/lib/auth'
import { auth, db } from '@/firebase'
import {
  deleteApplicantJobApplications,
  saveApplicantJobApplication,
  subscribeToApplicantJobApplications,
  updateApplicantJobApplicationStatus,
} from '@/lib/apply_jobs'
import { saveBusinessInterviewSchedule, subscribeToApplicantInterviewSchedules } from '@/lib/business_interviews'
import {
  saveBusinessAssessmentAssignmentRecord,
  subscribeToApplicantTrainingAssignments,
  subscribeToApplicantAssessmentAssignments,
} from '@/lib/business_workspace_records'
import { getPublicJobs, subscribeToJobDocumentStates, subscribeToPublicJobs } from '@/lib/jobs'
import { mediaUrl } from '@/lib/media'

const router = useRouter()
const activeSection = ref('overview')
const authUser = ref(null)
const applicantRealtimeNow = ref(Date.now())
const banNotice = ref(null)
const isLogoutConfirmOpen = ref(false)
const isLogoutSubmitting = ref(false)
const isDashboardEntering = ref(false)
const APPLICANT_ENTRY_TRANSITION_KEY = 'applicantDashboardEntryTransition'
const APPLICANT_WELCOME_TOAST_KEY = 'applicantWelcomeToastName'
const LOGOUT_TOAST_KEY = 'showLoggedOutToast'
const welcomeToastName = ref('')
const toast = ref(null)
const jobsLoading = ref(true)
const publicJobs = ref([])
const selectedFindJobId = ref('')
const findJobsQuery = ref('')
const activeJobSuggestion = ref('')
const applicantJobFilterMode = ref('matched')
const applicantJobPwdType = ref('')
const applicantJobSalaryRange = ref('')
const applicantJobSortMode = ref('match')
const viewedApplicantJobIds = ref([])
const APPLICANT_VIEWED_JOB_POSTS_STORAGE_KEY = 'applicantViewedJobPosts'
const APPLICANT_JOB_FILTER_MODES = ['matched', 'all', 'pwd', 'salary']
const APPLICANT_JOB_SORT_MODES = ['match', 'newest']
const APPLICANT_JOB_SALARY_FILTER_OPTIONS = [
  { value: '', label: 'Choose a salary range' },
  { value: 'under-15000', label: 'Under PHP 15,000', min: 0, max: 14999 },
  { value: '15000-24999', label: 'PHP 15,000 - 24,999', min: 15000, max: 24999 },
  { value: '25000-39999', label: 'PHP 25,000 - 39,999', min: 25000, max: 39999 },
  { value: '40000-up', label: 'PHP 40,000 and above', min: 40000, max: Number.POSITIVE_INFINITY },
  { value: 'negotiable', label: 'Negotiable / Not specified' },
]
const APPLICANT_JOB_SORT_OPTIONS = [
  { value: 'match', label: 'Strongest match' },
  { value: 'newest', label: 'Newest' },
]
const applicantApplicationStats = ref({
  applied: 0,
  pending: 0,
  interview: 0,
  accepted: 0,
  rejected: 0,
})
const liveApplicantApplications = ref([])
const selectedApplicantApplicationIds = ref([])
const liveApplicantInterviewSchedules = ref([])
const liveApplicantAssessmentAssignments = ref([])
const liveApplicantTrainingAssignments = ref([])
const applicantJobDocumentStates = ref({})
const activeApplicantInterviewActionId = ref('')
const isApplicantApplicationDeleteSubmitting = ref(false)
const applicantProfileForm = ref({
  first_name: '',
  middle_name: '',
  last_name: '',
  sex: '',
  birth_date: '',
  age: '',
  disability_type: '',
  address_barangay: '',
  address_city: '',
  address_province: '',
  present_address: '',
  provincial_address: '',
  place_of_birth: '',
  contact_country_code: '+63',
  contact_number: '',
  telephone_number: '',
  preferred_language: '',
  pwd_id_number: '',
  avatar: '',
  avatar_path: '',
})
const isApplicantAvatarUploading = ref(false)
const isApplicantProfileSaving = ref(false)
const applicantProfileMessage = ref('')
const applicantProfileMessageTone = ref('success')
let banPollId
let dashboardEntryTimerId
let welcomeToastTimerId
let toastTimerId
let stopPublicJobsSubscription = null
let stopApplicantApplicationsSubscription = null
let stopApplicantInterviewSchedulesSubscription = null
let stopApplicantAssessmentAssignmentsSubscription = null
let stopApplicantTrainingAssignmentsSubscription = null
let stopApplicantJobDocumentStatesSubscription = null
let stopAuthUserProfileSync = null
let applicantAccessRealtimeTimerId = null

const APPLICANT_MODULE_LABELS = {
  overview: 'Dashboard',
  messages: 'Messages',
  profile: 'My Profile',
  settings: 'Settings',
  'help-center': 'Help Center',
  'find-jobs': 'Find Jobs',
  applications: 'My Applications',
  interviews: 'Interviews',
  'technical-assessment': 'Technical Assessment',
}
const DEFAULT_APPLICANT_MODULE_ACCESS = Object.keys(APPLICANT_MODULE_LABELS).map((id) => ({
  id,
  label: APPLICANT_MODULE_LABELS[id],
  permissions: {
    view: true,
    edit: id === 'profile',
    full: false,
  },
}))

const normalizeApplicantModulePermissions = (permissions = {}) => {
  const full = permissions?.full === true
  const edit = permissions?.edit === true || full
  const view = permissions?.view === true || edit || full
  return { view, edit, full }
}

const normalizeApplicantModuleAccess = (modules = []) =>
  (Array.isArray(modules) ? modules : [])
    .map((module) => {
      const moduleId = String(module?.id || '').trim()
      if (!moduleId) return null

      return {
        id: moduleId,
        label: String(module?.label || APPLICANT_MODULE_LABELS[moduleId] || moduleId).trim(),
        permissions: normalizeApplicantModulePermissions(module?.permissions),
      }
    })
    .filter(Boolean)

const normalizeApplicantAdminNotice = (notice = {}) => {
  const moduleId = String(notice?.moduleId || notice?.module_id || '').trim()
  const audience = String(notice?.audience || '').trim().toLowerCase()
  if (audience && audience !== 'applicant') return null
  if (!moduleId) return null

  return {
    id: String(notice?.id || `applicant-rbac-${moduleId}`).trim(),
    title: String(notice?.title || 'Access update').trim(),
    copy: String(notice?.message || '').trim(),
    message: String(notice?.message || '').trim(),
    section: String(notice?.section || moduleId).trim() || moduleId,
    moduleId,
    tone: 'warning',
    createdAtValue: Date.parse(String(notice?.createdAt || notice?.created_at || '').trim()) || Date.now(),
    effectiveAtValue: Date.parse(String(notice?.effectiveAt || notice?.effective_at || '').trim()) || 0,
    timeLabel: formatApplicantNotificationTime(String(notice?.createdAt || notice?.created_at || '').trim() || new Date()),
    kind: 'admin-access-update',
  }
}

const applicantModuleAccess = computed(() => {
  const persistedModules = authUser.value?.admin_applicant_module_access
    || authUser.value?.adminApplicantModuleAccess
    || []
  const normalizedModules = normalizeApplicantModuleAccess(persistedModules)

  return normalizedModules.length ? normalizedModules : DEFAULT_APPLICANT_MODULE_ACCESS
})

const applicantModuleAccessMap = computed(() =>
  new Map(applicantModuleAccess.value.map((module) => [module.id, normalizeApplicantModulePermissions(module.permissions)])),
)

const applicantAdminAccessNotifications = computed(() =>
  (Array.isArray(authUser.value?.admin_module_access_notices)
    ? authUser.value.admin_module_access_notices
    : Array.isArray(authUser.value?.adminModuleAccessNotices)
      ? authUser.value.adminModuleAccessNotices
      : [])
    .map((notice) => normalizeApplicantAdminNotice(notice))
    .filter((notice) => notice && notice.kind === 'admin-access-update'),
)

const hasApplicantGraceAccess = (moduleId) =>
  applicantAdminAccessNotifications.value.some((notice) =>
    notice.moduleId === String(moduleId || '').trim()
    && notice.effectiveAtValue > applicantRealtimeNow.value,
  )

const canViewApplicantModule = (moduleId) => {
  const normalizedModuleId = String(moduleId || '').trim()
  if (!normalizedModuleId) return false

  const permissions = applicantModuleAccessMap.value.get(normalizedModuleId)
  if (permissions?.view) return true

  return hasApplicantGraceAccess(normalizedModuleId)
}

const resolveFirstAvailableApplicantSection = () => {
  const preferredSections = ['overview', 'find-jobs', 'applications', 'technical-assessment', 'interviews', 'profile', 'settings']
  return preferredSections.find((sectionId) => canViewApplicantModule(sectionId)) || 'overview'
}

const getApplicantApplicationRecordId = (record) => String(record?.id || '').trim()
const doesApplicantApplicationJobExist = (record = {}) => {
  const normalizedJobId = String(record?.jobId || record?.job_id || '').trim()
  if (!normalizedJobId) return true

  const jobDocumentStates = applicantJobDocumentStates.value || {}
  return !Object.prototype.hasOwnProperty.call(jobDocumentStates, normalizedJobId)
    || jobDocumentStates[normalizedJobId] !== false
}
const visibleApplicantApplications = computed(() =>
  liveApplicantApplications.value.filter((record) =>
    !isDiscontinuedApplicationStatus(normalizeApplicationStatus(record))
    && doesApplicantApplicationJobExist(record)),
)
const activeApplicantApplicationIdSet = computed(() =>
  new Set(
    visibleApplicantApplications.value
      .map((record) => getApplicantApplicationRecordId(record))
      .filter(Boolean),
  ),
)
const sanitizeSelectedApplicantApplicationIds = (applicationIds = []) =>
  [...new Set((Array.isArray(applicationIds) ? applicationIds : [])
    .map((value) => String(value || '').trim())
    .filter((value) => activeApplicantApplicationIdSet.value.has(value)))]

const getToastTitle = (text, kind = 'error') => {
  const normalizedText = String(text || '').trim().toLowerCase()

  if (kind === 'success') {
    if (normalizedText.includes('application sent')) return 'Application submitted'
    if (normalizedText.includes('saved')) return 'Saved'
    return 'Success'
  }

  if (kind === 'warning') return 'Notice'
  if (normalizedText.includes('already applied')) return 'Already applied'
  if (normalizedText.includes('missing firestore business details')) return 'Incomplete job post'
  return 'Unable to continue'
}

const notify = (text, kind = 'error', title = getToastTitle(text, kind)) => {
  toast.value = { text, kind, title }
}

const openHelpCenter = () => {
  if (!canViewApplicantModule('help-center')) {
    notify('Help Center access is currently disabled by admin RBAC.', 'warning', 'Access unavailable')
    return
  }
  router.push('/support/help-center')
}

const openTermsAndPolicies = () => {
  router.push('/support/terms-of-use')
}

const openPersonalization = () => {
  if (!canViewApplicantModule('profile')) {
    notify('Profile access is currently disabled by admin RBAC.', 'warning', 'Access unavailable')
    return
  }
  activeSection.value = 'profile'
}

const handleApplicantNotificationOpen = (notification) => {
  const targetSection = String(notification?.section || '').trim()
  if (['applications', 'interviews', 'technical-assessment', 'find-jobs', 'overview', 'messages', 'profile', 'settings'].includes(targetSection)
    && canViewApplicantModule(targetSection)) {
    activeSection.value = targetSection
    return
  }

  activeSection.value = resolveFirstAvailableApplicantSection()
}

const applicantSidebarItemsCatalog = [
  { id: 'overview', label: 'Dashboard', icon: 'bi bi-grid' },
  { id: 'messages', label: 'Messages', icon: 'bi bi-chat-dots' },
  { id: 'find-jobs', label: 'Find Jobs', icon: 'bi bi-search' },
  { id: 'applications', label: 'My Applications', icon: 'bi bi-file-earmark-text' },
  { id: 'technical-assessment', label: 'Technical Assessment', icon: 'bi bi-ui-checks-grid' },
  { id: 'interviews', label: 'Interviews', icon: 'bi bi-calendar-check' },
]

const sidebarSettingsItem = { id: 'settings', label: 'Settings', icon: 'bi bi-sliders2' }
const sidebarItems = computed(() =>
  applicantSidebarItemsCatalog.filter((item) => canViewApplicantModule(item.id)),
)
const showApplicantProfileItem = computed(() => canViewApplicantModule('profile'))
const showApplicantSettingsItem = computed(() => canViewApplicantModule('settings'))
const showApplicantHelpCenterItem = computed(() => canViewApplicantModule('help-center'))
const currentSidebarItem = computed(() => {
  if (activeSection.value === 'profile' && canViewApplicantModule('profile')) {
    return { id: 'profile', label: 'My Profile', icon: 'bi bi-person-circle' }
  }
  if (activeSection.value === 'settings' && canViewApplicantModule('settings')) {
    return sidebarSettingsItem
  }
  return sidebarItems.value.find((item) => item.id === activeSection.value)
    || sidebarItems.value[0]
    || (showApplicantProfileItem.value ? { id: 'profile', label: 'My Profile', icon: 'bi bi-person-circle' } : sidebarSettingsItem)
})

const registration = computed(() => authUser.value?.applicant_registration || authUser.value?.applicantRegistration || null)
const applicantFirstName = computed(() => registration.value?.first_name || authUser.value?.name?.split(' ')?.[0] || 'Applicant')
const applicantLastName = computed(() => registration.value?.last_name || authUser.value?.name?.split(' ')?.slice(1).join(' ') || 'User')
const applicantName = computed(() => {
  const profile = registration.value
  if (profile?.first_name || profile?.last_name) {
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  }

  return authUser.value?.name || 'Applicant'
})
const applicantEmail = computed(() => authUser.value?.email || 'No email available')
const applicantInitials = computed(() => {
  const firstInitial = applicantFirstName.value?.trim()?.charAt(0) || ''
  const lastInitial = applicantLastName.value?.trim()?.charAt(0) || ''
  return `${firstInitial}${lastInitial}`.trim().toUpperCase() || 'AP'
})
const applicantAvatarUrl = computed(() => {
  const registrationAvatar = registration.value?.avatar || registration.value?.avatar_url
  const profileAvatar = authUser.value?.avatar || authUser.value?.avatar_url
  return mediaUrl(String(registrationAvatar || profileAvatar || '').trim())
})
const applicantBarangay = computed(() => registration.value?.address_barangay || 'Not set')
const applicantDisability = computed(() => registration.value?.disability_type || 'Not set')
const applicantLanguage = computed(() => registration.value?.preferred_language || 'Not set')
const applicantJoined = computed(() => {
  const raw = authUser.value?.created_at || registration.value?.created_at
  if (!raw) return 'Recently'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return 'Recently'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
})
const applicantAddress = computed(() => {
  const city = registration.value?.address_city || 'Dasmarinas City'
  const province = registration.value?.address_province || 'Cavite'
  const barangay = registration.value?.address_barangay || 'Not set'
  return `${barangay}, ${city}, ${province}`
})
const applicantEmploymentStatus = computed(() => 'Actively Looking')
const applicantContactNumber = computed(() => registration.value?.contact_number || 'Not set')
const applicantBirthDate = computed(() => registration.value?.birth_date || 'Not set')
const applicantSex = computed(() => registration.value?.sex || 'Not set')
const applicantAge = computed(() => registration.value?.age || 'Not set')
const applicantPwdId = computed(() => registration.value?.pwd_id_number || 'Not set')
const applicantWorkSetup = computed(() => registration.value?.preferred_work_setup || 'Open to onsite, hybrid, or remote')
const applicantAssistiveNeeds = computed(() => registration.value?.assistive_needs || 'No assistive needs listed yet')
const applicantPresentAddress = computed(() => registration.value?.present_address || 'Not set')
const applicantProvincialAddress = computed(() => registration.value?.provincial_address || 'Not set')
const applicantPlaceOfBirth = computed(() => registration.value?.place_of_birth || 'Not set')
const applicantProfileSnapshot = computed(() => [
  { id: 'email', label: 'Email Address', value: applicantEmail.value, icon: 'bi bi-envelope-paper' },
  { id: 'contact', label: 'Mobile Number', value: applicantContactNumber.value, icon: 'bi bi-telephone' },
  { id: 'disability', label: 'Disability Type', value: applicantDisability.value, icon: 'bi bi-universal-access-circle' },
  { id: 'language', label: 'Preferred Language', value: applicantLanguage.value, icon: 'bi bi-translate' },
  { id: 'birth', label: 'Birth Date', value: applicantBirthDate.value, icon: 'bi bi-calendar-heart' },
  { id: 'pwd', label: 'PWD ID Number', value: applicantPwdId.value, icon: 'bi bi-person-vcard' },
])
const applicantOverviewHighlights = computed(() => [
  { id: 'employment', label: 'Employment', value: applicantEmploymentStatus.value },
  { id: 'language', label: 'Language', value: applicantLanguage.value },
  { id: 'member-since', label: 'Member Since', value: applicantJoined.value },
  { id: 'location', label: 'Location', value: applicantAddress.value },
])
const applicationSummary = computed(() => [
  {
    id: 'applied',
    label: 'Total Applied Jobs',
    value: applicantApplicationStats.value.applied,
    subtitle: 'Applications currently tracked in your workspace',
    icon: 'bi bi-send-check',
    tone: 'navy',
  },
  {
    id: 'pending',
    label: 'Pending Applications',
    value: applicantApplicationStats.value.pending,
    subtitle: 'Waiting for employer review or approval updates',
    icon: 'bi bi-hourglass-split',
    tone: 'amber',
  },
  {
    id: 'interview',
    label: 'For Interview',
    value: applicantApplicationStats.value.interview,
    subtitle: 'Interview-stage applications and active schedule requests',
    icon: 'bi bi-calendar2-check',
    tone: 'green',
  },
  {
    id: 'result',
    label: 'Rejected / Approved',
    value: `${applicantApplicationStats.value.rejected} / ${applicantApplicationStats.value.accepted}`,
    subtitle: 'Latest final outcomes from your submitted applications',
    icon: 'bi bi-clipboard-data',
    tone: 'slate',
  },
])
const _legacyRecommendedJobs = computed(() => [
  {
    id: 1,
    title: 'Administrative Assistant',
    company: 'Inclusive Business Solutions',
    match: 92,
    explanation: 'Based on your skills: Communication, Encoding, Records Handling',
    location: 'Dasmarinas, Cavite',
  },
  {
    id: 2,
    title: 'Customer Support Associate',
    company: 'AccessWorks Contact Center',
    match: 89,
    explanation: 'Strong fit for phone etiquette, empathy, and written communication',
    location: 'Remote',
  },
  {
    id: 3,
    title: 'Data Encoder',
    company: 'Metro South Cooperative',
    match: 86,
    explanation: 'Matches your profile in documentation, detail focus, and computer literacy',
    location: 'Onsite',
  },
  {
    id: 4,
    title: 'Front Desk Coordinator',
    company: 'City Wellness Hub',
    match: 83,
    explanation: 'Good match for scheduling, communication, and public-facing tasks',
    location: 'Dasmarinas, Cavite',
  },
])
const _legacyUpcomingInterviews = computed(() => [
  {
    id: 1,
    company: 'Inclusive Business Solutions',
    role: 'Administrative Assistant',
    schedule: 'Apr 03, 2026 • 10:00 AM',
    status: 'Confirmed',
  },
  {
    id: 2,
    company: 'AccessWorks Contact Center',
    role: 'Customer Support Associate',
    schedule: 'Apr 05, 2026 • 02:30 PM',
    status: 'Pending',
  },
])
const banDurationLabel = computed(() => {
  const duration = String(banNotice.value?.banDuration || '').trim()
  if (duration === '1_day') return '1 day'
  if (duration === '3_days') return '3 days'
  if (duration === '7_days') return '7 days'
  if (duration === 'permanent') return 'permanent'

  const bannedUntil = String(banNotice.value?.bannedUntil || '').trim()
  if (!bannedUntil) return 'permanent'

  const parsed = new Date(bannedUntil)
  if (Number.isNaN(parsed.getTime())) return 'temporary'

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
})

const _legacyNotifications = computed(() => [
  {
    id: 1,
    title: 'Your application was viewed',
    copy: 'Inclusive Business Solutions opened your Administrative Assistant application today.',
    tone: 'success',
  },
  {
    id: 2,
    title: 'New job post available',
    copy: 'A new Customer Support role is now open and may fit your current strengths and preferences.',
    tone: 'accent',
  },
  {
    id: 3,
    title: 'Interview scheduled',
    copy: 'AccessWorks Contact Center requested a preliminary interview this week.',
    tone: 'neutral',
  },
])
const _legacySkillsInsight = computed(() => ({
  strengths: ['Communication', 'Encoding', 'Customer Service', 'Document Organization'],
  missing: ['Microsoft Excel', 'Calendar Management', 'CRM Familiarity'],
}))
const _legacyMessagesPreview = computed(() => ({
  unreadCount: 2,
  items: [
    {
      id: 1,
      employer: 'Inclusive Business Solutions',
      message: 'We reviewed your profile and would like to confirm your availability this Friday.',
      time: '10 mins ago',
    },
    {
      id: 2,
      employer: 'City Wellness Hub',
      message: 'Please update your resume file before we proceed to the next screening step.',
      time: '1 hour ago',
    },
  ],
}))

const normalizeApplicantInterviewScheduleState = (value) =>
  String(value || 'scheduled').trim().toLowerCase()

const normalizeApplicantInterviewResponseState = (record = {}) =>
  String(
    record?.applicantResponseStatus
      || record?.applicant_response_status
      || record?.interviewResponseStatus
      || record?.interview_response_status
      || 'pending',
  ).trim().toLowerCase() || 'pending'
const normalizeApplicantInterviewScheduleOptions = (record = {}) => {
  const source = record?.availableScheduleOptions
    || record?.available_schedule_options
    || record?.interviewScheduleOptions
    || record?.interview_schedule_options

  if (!Array.isArray(source)) return []
  return [...new Set(source.map((value) => String(value || '').trim()).filter(Boolean))]
}

const parseApplicantInterviewTimestamp = (value) => {
  const parsedValue = Date.parse(String(value || '').trim())
  return Number.isFinite(parsedValue) ? parsedValue : 0
}
const getApplicantInterviewRecordPriority = (record = {}) => {
  const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
  return ['completed', 'cancelled'].includes(scheduleStatus) ? 1 : 0
}
const shouldPreferApplicantInterviewRecord = (nextRecord = {}, currentRecord = null) => {
  if (!currentRecord) return true

  const priorityDifference = getApplicantInterviewRecordPriority(nextRecord) - getApplicantInterviewRecordPriority(currentRecord)
  if (priorityDifference !== 0) return priorityDifference < 0

  return getApplicantInterviewRecordActivityTime(nextRecord) >= getApplicantInterviewRecordActivityTime(currentRecord)
}
const getApplicantInterviewRecordActivityTime = (record = {}) => {
  return Math.max(
    parseApplicantInterviewTimestamp(record?.updatedAt),
    parseApplicantInterviewTimestamp(record?.updated_at),
    parseApplicantInterviewTimestamp(record?.applicantRespondedAt),
    parseApplicantInterviewTimestamp(record?.applicant_responded_at),
    parseApplicantInterviewTimestamp(record?.interviewRespondedAt),
    parseApplicantInterviewTimestamp(record?.interview_responded_at),
    parseApplicantInterviewTimestamp(record?.businessDecidedAt),
    parseApplicantInterviewTimestamp(record?.business_decided_at),
    parseApplicantInterviewTimestamp(record?.interviewDecidedAt),
    parseApplicantInterviewTimestamp(record?.interview_decided_at),
    parseApplicantInterviewTimestamp(record?.scheduledAt),
    parseApplicantInterviewTimestamp(record?.scheduled_at),
    parseApplicantInterviewTimestamp(record?.interviewSchedule),
    parseApplicantInterviewTimestamp(record?.interview_schedule),
    parseApplicantInterviewTimestamp(record?.interviewDate),
    parseApplicantInterviewTimestamp(record?.interview_date),
    parseApplicantInterviewTimestamp(record?.createdAt),
    parseApplicantInterviewTimestamp(record?.created_at),
  )
}

const resolveApplicantConfirmedScheduleAt = (record = {}, selectedValue = '') => {
  const availableScheduleOptions = normalizeApplicantInterviewScheduleOptions(record)
  const normalizedSelectedValue = String(selectedValue || '').trim()
  if (availableScheduleOptions.includes(normalizedSelectedValue)) return normalizedSelectedValue

  const selectedTimestamp = parseApplicantInterviewTimestamp(normalizedSelectedValue)
  if (selectedTimestamp) {
    const matchingOption = availableScheduleOptions.find((option) =>
      parseApplicantInterviewTimestamp(option) === selectedTimestamp)
    if (matchingOption) return matchingOption
  }

  const scheduledAt = String(record?.scheduledAt || record?.scheduled_at || '').trim()
  if (availableScheduleOptions.includes(scheduledAt)) return scheduledAt
  return availableScheduleOptions[0] || scheduledAt
}

const upsertLiveApplicantInterviewSchedule = (record = {}) => {
  const normalizedId = String(record?.id || '').trim()
  const normalizedApplicationId = String(record?.applicationId || record?.application_id || '').trim()
  const normalizedInterviewType = String(record?.interviewType || record?.interview_type || 'initial').trim().toLowerCase() || 'initial'

  if (!normalizedId && !normalizedApplicationId) return

  const nextRecord = {
    ...record,
    ...(normalizedId ? { id: normalizedId } : {}),
    ...(normalizedApplicationId ? { applicationId: normalizedApplicationId } : {}),
    interviewType: normalizedInterviewType,
  }

  const existingIndex = liveApplicantInterviewSchedules.value.findIndex((entry) => {
    const entryId = String(entry?.id || '').trim()
    if (normalizedId && entryId) return entryId === normalizedId

    return String(entry?.applicationId || entry?.application_id || '').trim() === normalizedApplicationId
      && (String(entry?.interviewType || entry?.interview_type || 'initial').trim().toLowerCase() || 'initial') === normalizedInterviewType
  })

  if (existingIndex >= 0) {
    liveApplicantInterviewSchedules.value = liveApplicantInterviewSchedules.value.map((entry, index) =>
      index === existingIndex ? nextRecord : entry)
    return
  }

  liveApplicantInterviewSchedules.value = [nextRecord, ...liveApplicantInterviewSchedules.value]
}

const formatApplicantInterviewTypeLabel = (value) =>
  String(value || 'initial').trim().toLowerCase() === 'final' ? 'Final Interview' : 'Initial Interview'

const formatApplicantInterviewModeLabel = (value) =>
  String(value || 'in-person').trim().toLowerCase() === 'online' ? 'Online interview' : 'In-person interview'

const formatApplicantInterviewScheduleLabel = (value) => {
  const parsed = Date.parse(String(value || '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Interview update available in Firebase'

  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatApplicantInterviewStatusLabelFromRecord = (record = {}) => {
  const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeApplicantInterviewResponseState(record)

  if (scheduleStatus === 'completed') return 'Completed'
  if (responseStatus === 'reschedule_rejected') return 'Rejected'
  if (scheduleStatus === 'cancelled') return 'Cancelled'
  if (responseStatus === 'confirmed') return 'Confirmed'
  if (responseStatus === 'reschedule_requested') return 'Reschedule Requested'
  return 'Awaiting Confirmation'
}

const upcomingInterviews = computed(() =>
  liveApplicantInterviewSchedules.value
    .filter((record) =>
      activeApplicantApplicationIdSet.value.has(String(record?.applicationId || record?.application_id || '').trim())
      && normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status) !== 'cancelled')
    .map((record) => ({
      id: String(record?.id || ''),
      company: String(record?.workspaceOwnerName || record?.workspace_owner_name || 'Company').trim(),
      role: String(record?.jobTitle || record?.job_title || 'Interview').trim(),
      schedule: formatApplicantInterviewScheduleLabel(record?.scheduledAt || record?.scheduled_at),
      status: formatApplicantInterviewStatusLabelFromRecord(record),
    }))
    .slice(0, 4),
)

const skillsInsight = computed(() => {
  const strengths = [
    applicantDisability.value !== 'Not set' ? applicantDisability.value : '',
    applicantLanguage.value !== 'Not set' ? applicantLanguage.value : '',
    applicantBarangay.value !== 'Not set' ? `Based in ${applicantBarangay.value}` : '',
    applicantApplicationStats.value.applied > 0 ? `${applicantApplicationStats.value.applied} submitted application${applicantApplicationStats.value.applied > 1 ? 's' : ''}` : '',
  ].filter(Boolean).slice(0, 4)

  const missing = [...new Set(
    publicJobs.value
      .flatMap((job) => job?.qualifications || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )].slice(0, 4)

  return {
    strengths: strengths.length ? strengths : ['Complete more profile details in Firebase to improve matching'],
    missing: missing.length ? missing : ['More job qualification data will appear here as employers publish openings'],
  }
})

const messagesPreview = computed(() => {
  const items = visibleApplicantApplications.value
    .slice(0, 2)
    .map((record) => ({
      id: String(record?.id || ''),
      employer: String(record?.companyName || record?.company_name || record?.businessName || record?.business_name || 'Employer').trim(),
      message: `Status update: ${formatApplicationStatusLabel(record)} for ${String(record?.jobTitle || record?.job_title || 'your application').trim()}.`,
      time: formatApplicationDate(record),
    }))

  return {
    unreadCount: items.length,
    items,
  }
})

const applicantInterviewPageRows = computed(() => {
  const rowsByKey = new Map()
  const upsertRow = (record = {}, applicationRecord = {}) => {
    const applicationId = String(record?.applicationId || record?.application_id || applicationRecord?.id || '').trim()
    if (!applicationId || !activeApplicantApplicationIdSet.value.has(applicationId)) return

    const interviewType = String(record?.interviewType || record?.interview_type || 'initial').trim().toLowerCase() || 'initial'
    const recordId = String(record?.id || '').trim()
    const rowKey = `${applicationId || recordId}:${interviewType}`
    if (!rowKey || rowKey === ':initial') return

    const nextRow = {
      ...record,
      id: recordId || `application-interview-${applicationId || interviewType}`,
      applicationId,
      interviewType,
      workspaceOwnerName: String(
        record?.workspaceOwnerName
          || record?.workspace_owner_name
          || applicationRecord?.companyName
          || applicationRecord?.company_name
          || applicationRecord?.businessName
          || applicationRecord?.business_name
          || 'Business Workspace',
      ).trim() || 'Business Workspace',
      jobTitle: String(
        record?.jobTitle
          || record?.job_title
          || applicationRecord?.jobTitle
          || applicationRecord?.job_title
          || 'Applied Job',
      ).trim() || 'Applied Job',
    }

    const existingRow = rowsByKey.get(rowKey)
    if (!existingRow || getApplicantInterviewRecordActivityTime(nextRow) >= getApplicantInterviewRecordActivityTime(existingRow)) {
      rowsByKey.set(rowKey, nextRow)
    }
  }

  liveApplicantInterviewSchedules.value.forEach((record) => {
    upsertRow(record)
  })

  liveApplicantApplications.value.forEach((record) => {
    const interviewRecord = getApplicantInterviewRecordForApplication(record)
    if (!interviewRecord) return
    upsertRow(interviewRecord, record)
  })

  return [...rowsByKey.values()]
    .sort((left, right) => getApplicantInterviewRecordActivityTime(right) - getApplicantInterviewRecordActivityTime(left))
})

const latestApplicantInterviewByApplication = computed(() => {
  const lookup = new Map()

  liveApplicantInterviewSchedules.value.forEach((record) => {
    const applicationId = String(record?.applicationId || record?.application_id || '').trim()
    if (!applicationId || !activeApplicantApplicationIdSet.value.has(applicationId)) return

    const existingRecord = lookup.get(applicationId)
    if (shouldPreferApplicantInterviewRecord(record, existingRecord)) {
      lookup.set(applicationId, record)
    }
  })

  return lookup
})

const latestApplicantInterviewByApplicationAndType = computed(() => {
  const lookup = new Map()

  liveApplicantInterviewSchedules.value.forEach((record) => {
    const applicationId = String(record?.applicationId || record?.application_id || '').trim()
    const interviewType = String(record?.interviewType || record?.interview_type || 'initial').trim().toLowerCase() || 'initial'
    if (!applicationId || !activeApplicantApplicationIdSet.value.has(applicationId)) return

    const key = `${applicationId}:${interviewType}`
    const existingRecord = lookup.get(key)
    if (shouldPreferApplicantInterviewRecord(record, existingRecord)) {
      lookup.set(key, record)
    }
  })

  return lookup
})

const normalizeMediaUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return mediaUrl(raw)
}

const buildApplicantProfileForm = (user) => {
  const profile = user || {}
  const currentRegistration = profile?.applicant_registration || profile?.applicantRegistration || {}

  return {
    first_name: String(currentRegistration.first_name || '').trim(),
    middle_name: String(currentRegistration.middle_name || '').trim(),
    last_name: String(currentRegistration.last_name || '').trim(),
    sex: String(currentRegistration.sex || '').trim(),
    birth_date: String(currentRegistration.birth_date || '').trim(),
    age: String(currentRegistration.age || '').trim(),
    disability_type: String(currentRegistration.disability_type || '').trim(),
    address_barangay: String(currentRegistration.address_barangay || '').trim(),
    address_city: String(currentRegistration.address_city || '').trim(),
    address_province: String(currentRegistration.address_province || '').trim(),
    present_address: String(currentRegistration.present_address || '').trim(),
    provincial_address: String(currentRegistration.provincial_address || '').trim(),
    place_of_birth: String(currentRegistration.place_of_birth || '').trim(),
    contact_country_code: String(currentRegistration.contact_country_code || '+63').trim() || '+63',
    contact_number: String(currentRegistration.contact_number || '').trim(),
    telephone_number: String(currentRegistration.telephone_number || '').trim(),
    preferred_language: String(currentRegistration.preferred_language || '').trim(),
    pwd_id_number: String(currentRegistration.pwd_id_number || '').trim(),
    avatar: String(currentRegistration.avatar || profile.avatar || '').trim(),
    avatar_path: String(currentRegistration.avatar_path || profile.avatar_path || '').trim(),
  }
}

const syncApplicantProfileForm = (user) => {
  applicantProfileForm.value = buildApplicantProfileForm(user)
}

const setApplicantProfileMessage = (message, tone = 'success') => {
  applicantProfileMessage.value = String(message || '').trim()
  applicantProfileMessageTone.value = tone
}

const toStringList = (value, splitBy) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw.split(splitBy || /\r?\n/).map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeApplicantJobDisabilityCategory = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!normalized) return ''
  if (/(autism)/.test(normalized)) return 'autism'
  if (/(cancer|rare|disease|chronic|illness)/.test(normalized)) return 'cancer survivors and rare disease individuals'
  if (/(deaf|hearing)/.test(normalized)) return 'deaf and hard of hearing individuals'
  if (/(dwarfism)/.test(normalized)) return 'dwarfism'
  if (/(intellectual|developmental|cognitive)/.test(normalized)) return 'intellectual disability'
  if (/(dyslex)/.test(normalized)) return 'learning disability dyslexic'
  if (/(learning)/.test(normalized)) return 'learning disability'
  if (/(lower limb|wheelchair|mobility)/.test(normalized)) return 'lower limb amputation deformity and wheelchair users'
  if (/(mental|psychosocial)/.test(normalized)) return 'mental and psychosocial disability individuals'
  if (/(physical|orthopedic)/.test(normalized)) return 'physical disability'
  if (/(speech|language)/.test(normalized)) return 'speech impairment'
  if (/(upper limb)/.test(normalized)) return 'upper limb amputation deformity'
  if (/(visual|visually|vision|blind)/.test(normalized)) return 'visually impaired'
  return normalized
}

const formatApplicantJobDisabilityLabel = (value) =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const getApplicantJobSalaryNumbers = (value) => {
  const matches = String(value || '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/g)

  return Array.isArray(matches)
    ? matches.map((entry) => Number.parseFloat(entry)).filter((entry) => Number.isFinite(entry))
    : []
}

const getApplicantJobSalaryRange = (value) => {
  const numbers = getApplicantJobSalaryNumbers(value)
  if (!numbers.length) {
    return {
      hasNumericValue: false,
      min: 0,
      max: 0,
    }
  }

  return {
    hasNumericValue: true,
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  }
}

const doesApplicantJobMatchSalaryRange = (job, salaryRangeKey) => {
  if (!salaryRangeKey) return true
  const selectedRange = APPLICANT_JOB_SALARY_FILTER_OPTIONS.find((option) => option.value === salaryRangeKey)
  if (!selectedRange) return true

  const numericRange = getApplicantJobSalaryRange(job?.salary)
  if (salaryRangeKey === 'negotiable') {
    return !numericRange.hasNumericValue
  }

  if (!numericRange.hasNumericValue) return false

  return numericRange.max >= Number(selectedRange.min || 0)
    && numericRange.min <= Number(selectedRange.max || Number.POSITIVE_INFINITY)
}

const doesApplicantJobMatchApplicantProfile = (job) => {
  const applicantDisabilityCategory = applicantDisabilityMatch.value
  if (!applicantDisabilityCategory) return true

  return normalizeApplicantJobDisabilityCategory(job?.disabilityFit) === applicantDisabilityCategory
}

const getApplicantJobMatchScore = (job) => {
  const applicantDisabilityCategory = applicantDisabilityMatch.value
  const jobDisabilityCategory = normalizeApplicantJobDisabilityCategory(job?.disabilityFit)
  const languageText = String(registration.value?.preferred_language || '').trim().toLowerCase()
  const barangayText = String(registration.value?.address_barangay || '').trim().toLowerCase()
  const cityText = String(registration.value?.address_city || '').trim().toLowerCase()
  const provinceText = String(registration.value?.address_province || '').trim().toLowerCase()
  const qualificationsText = [...(job?.qualifications || []), ...(job?.languages || [])].join(' ').toLowerCase()
  const locationText = String(job?.location || '').trim().toLowerCase()
  const setupText = String(job?.setup || job?.type || '').trim().toLowerCase()

  let score = 52

  if (applicantDisabilityCategory && jobDisabilityCategory && applicantDisabilityCategory === jobDisabilityCategory) {
    score += 24
  }

  if (languageText && qualificationsText.includes(languageText)) {
    score += 10
  }

  if (barangayText && locationText.includes(barangayText)) {
    score += 8
  } else if (cityText && locationText.includes(cityText)) {
    score += 6
  } else if (provinceText && locationText.includes(provinceText)) {
    score += 4
  }

  if (setupText.includes('remote')) {
    score += 3
  }

  if (Number(job?.vacancies || 0) >= 3) {
    score += 2
  }

  return score
}

const getCompanyInitials = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (!words.length) return 'CO'
  return words.map((word) => word.charAt(0).toUpperCase()).join('')
}

const isRecentJobPost = (createdAtMs) => {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return false
  return Date.now() - createdAtMs <= 3 * 24 * 60 * 60 * 1000
}

const mapJobRecordToApplicantJob = (raw) => {
  const id = String(raw?.id || '').trim()
  const title = String(raw?.title || '').trim()
  if (!id || !title) return null

  const status = String(raw?.status || 'open').trim().toLowerCase()
  if (status === 'closed') return null

  const createdAtRaw = String(raw?.createdAt || raw?.created_at || '').trim()
  const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : 0
  const companyName = String(raw?.companyName || raw?.company || raw?.department || 'Company').trim()

  return {
    id,
    title,
    companyName,
    businessName: String(raw?.businessName || raw?.business_name || companyName).trim(),
    companyInitials: getCompanyInitials(companyName),
    logoUrl: normalizeMediaUrl(raw?.logoUrl || raw?.profileImageUrl || ''),
    location: String(raw?.location || 'Not specified').trim(),
    category: String(raw?.category || 'General').trim(),
    type: String(raw?.type || 'Open').trim(),
    description: String(raw?.description || 'No description provided.').trim(),
    setup: String(raw?.setup || raw?.type || 'On-site').trim(),
    vacancies: Math.max(1, Number(raw?.vacancies || 1) || 1),
    salary: String(raw?.salary || 'Negotiable').trim(),
    disabilityFit: String(raw?.disabilityType || raw?.disability || 'PWD-friendly').trim(),
    qualifications: toStringList(raw?.qualifications),
    responsibilities: toStringList(raw?.responsibilities),
    languages: toStringList(raw?.languages ?? raw?.language, ','),
    preferredAgeRange: String(raw?.preferredAgeRange || raw?.preferred_age_range || 'Not specified').trim(),
    workspaceOwnerId: String(raw?.workspaceOwnerId || raw?.workspace_owner_id || '').trim(),
    workspaceOwnerEmail: String(raw?.workspaceOwnerEmail || raw?.workspace_owner_email || '').trim().toLowerCase(),
    workspaceOwnerName: String(raw?.workspaceOwnerName || raw?.workspace_owner_name || companyName).trim(),
    createdAtMs,
    isNew: isRecentJobPost(createdAtMs),
    postedDate:
      Number.isFinite(createdAtMs) && createdAtMs > 0
        ? new Date(createdAtMs).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
  }
}

const applicantJobSuggestions = computed(() => {
  const suggestionSet = new Set()
  const seeded = [
    registration.value?.disability_type,
    'Programmer',
    'Software Engineer',
    'Photographer',
    'Digital Marketing',
  ]

  seeded.forEach((value) => {
    const normalized = String(value || '').trim()
    if (normalized) suggestionSet.add(normalized)
  })

  publicJobs.value.forEach((job) => {
    ;[job.category, job.title].forEach((value) => {
      const normalized = String(value || '').trim()
      if (normalized) suggestionSet.add(normalized)
    })
  })

  return [...suggestionSet].slice(0, 6)
})
const applicantDisabilityMatch = computed(() => {
  return normalizeApplicantJobDisabilityCategory(registration.value?.disability_type || '')
})
const applicantJobPwdTypeOptions = computed(() => {
  const options = new Map()
  const applicantCategory = applicantDisabilityMatch.value
  const applicantDisabilityLabel = String(applicantDisability.value || '').trim()

  if (applicantCategory) {
    options.set(
      applicantCategory,
      applicantDisabilityLabel ? `My PWD type (${applicantDisabilityLabel})` : 'My PWD type',
    )
  }

  publicJobs.value.forEach((job) => {
    const category = normalizeApplicantJobDisabilityCategory(job?.disabilityFit)
    if (!category || options.has(category)) return
    options.set(category, formatApplicantJobDisabilityLabel(category))
  })

  return [...options.entries()].map(([value, label]) => ({ value, label }))
})
const applicantJobSalaryOptions = computed(() =>
  APPLICANT_JOB_SALARY_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
)
const applicantJobSortOptions = computed(() =>
  APPLICANT_JOB_SORT_OPTIONS.map(({ value, label }) => ({ value, label })),
)
const applicantJobSortLabel = computed(() => {
  const matchingOption = APPLICANT_JOB_SORT_OPTIONS.find((option) => option.value === applicantJobSortMode.value)
  return matchingOption?.label || 'Strongest match'
})
const applicantJobFilterLabel = computed(() => {
  if (applicantJobFilterMode.value === 'matched') {
    return 'Job matching'
  }

  if (applicantJobFilterMode.value === 'pwd') {
    const matchingOption = applicantJobPwdTypeOptions.value.find((option) => option.value === applicantJobPwdType.value)
    return matchingOption?.label || 'PWD type'
  }

  if (applicantJobFilterMode.value === 'salary') {
    const matchingOption = applicantJobSalaryOptions.value.find((option) => option.value === applicantJobSalaryRange.value)
    return matchingOption?.value ? `Salary: ${matchingOption.label}` : 'Salary range'
  }

  return 'All jobs'
})
const applicantJobResultsDescription = computed(() => {
  const sortDescription = applicantJobSortMode.value === 'newest'
    ? 'sorted by newest posts first'
    : 'sorted by the strongest match first'

  if (applicantJobFilterMode.value === 'matched') {
    return applicantDisabilityMatch.value
      ? `Showing live public job posts that match the applicant profile, ${sortDescription}. Click an active filter again to return here.`
      : `Showing live public job posts for applicants, ${sortDescription}. Add a disability type to make job matching more specific.`
  }

  if (applicantJobFilterMode.value === 'pwd') {
    return `Showing live public job posts filtered by ${applicantJobFilterLabel.value}, ${sortDescription}.`
  }

  if (applicantJobFilterMode.value === 'salary') {
    return applicantJobSalaryRange.value
      ? `Showing live public job posts filtered by ${applicantJobFilterLabel.value.toLowerCase()}, ${sortDescription}.`
      : 'Choose a salary range from the filter menu to narrow the results.'
  }

  return `Showing every live public job post, ${sortDescription}. Use the filter menu to narrow by PWD type or salary range.`
})

const getDefaultApplicantJobPwdType = () =>
  applicantDisabilityMatch.value || applicantJobPwdTypeOptions.value[0]?.value || ''

const getDefaultApplicantJobSalaryRange = () =>
  APPLICANT_JOB_SALARY_FILTER_OPTIONS.find((option) => option.value && option.value !== 'negotiable')?.value || ''

const setApplicantJobFilterMode = (value) => {
  const nextMode = String(value || '').trim().toLowerCase()
  if (!APPLICANT_JOB_FILTER_MODES.includes(nextMode)) return

  if (nextMode !== 'matched' && applicantJobFilterMode.value === nextMode) {
    applicantJobFilterMode.value = 'matched'
    return
  }

  applicantJobFilterMode.value = nextMode

  if (nextMode === 'pwd' && !applicantJobPwdType.value) {
    applicantJobPwdType.value = getDefaultApplicantJobPwdType()
  }

  if (nextMode === 'salary' && !applicantJobSalaryRange.value) {
    applicantJobSalaryRange.value = getDefaultApplicantJobSalaryRange()
  }
}

const updateApplicantJobPwdType = (value) => {
  applicantJobPwdType.value = String(value || '').trim()
  applicantJobFilterMode.value = 'pwd'
}

const updateApplicantJobSalaryRange = (value) => {
  applicantJobSalaryRange.value = String(value || '').trim()
  applicantJobFilterMode.value = 'salary'
}

const setApplicantJobSortMode = (value) => {
  const nextMode = String(value || '').trim().toLowerCase()
  if (!APPLICANT_JOB_SORT_MODES.includes(nextMode)) return
  applicantJobSortMode.value = nextMode
}

const resetApplicantJobFilters = () => {
  applicantJobFilterMode.value = 'matched'
  applicantJobPwdType.value = ''
  applicantJobSalaryRange.value = ''
}

const filteredApplicantJobs = computed(() => {
  const normalizedQuery = String(findJobsQuery.value || '').trim().toLowerCase()
  const rows = publicJobs.value.filter((job) => {
    if (applicantJobFilterMode.value === 'matched' && !doesApplicantJobMatchApplicantProfile(job)) {
      return false
    }

    if (applicantJobFilterMode.value === 'pwd') {
      const targetPwdType = applicantJobPwdType.value || applicantDisabilityMatch.value
      if (targetPwdType && normalizeApplicantJobDisabilityCategory(job?.disabilityFit) !== targetPwdType) {
        return false
      }
    }

    if (applicantJobFilterMode.value === 'salary' && !doesApplicantJobMatchSalaryRange(job, applicantJobSalaryRange.value)) {
      return false
    }

    if (!normalizedQuery) return true
    return [
      job.title,
      job.companyName,
      job.category,
      job.location,
      job.type,
      job.setup,
      job.description,
      job.disabilityFit,
      job.salary,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
  })

  return rows
    .slice()
    .sort((left, right) => {
      if (applicantJobSortMode.value === 'newest') {
        const recencyDifference = Number(right?.createdAtMs || 0) - Number(left?.createdAtMs || 0)
        if (recencyDifference !== 0) return recencyDifference

        const scoreDifference = getApplicantJobMatchScore(right) - getApplicantJobMatchScore(left)
        if (scoreDifference !== 0) return scoreDifference

        return String(left?.title || '').localeCompare(String(right?.title || ''))
      }

      const scoreDifference = getApplicantJobMatchScore(right) - getApplicantJobMatchScore(left)
      if (scoreDifference !== 0) return scoreDifference

      const recencyDifference = Number(right?.createdAtMs || 0) - Number(left?.createdAtMs || 0)
      if (recencyDifference !== 0) return recencyDifference

      return String(left?.title || '').localeCompare(String(right?.title || ''))
    })
    .slice(0, 12)
})
const selectedFindJob = computed(() => {
  if (!selectedFindJobId.value) return null
  return publicJobs.value.find((job) => job.id === selectedFindJobId.value) || null
})

const getApplicationJobSnapshot = (record) => {
  const snapshot = record?.jobSnapshot || record?.job_snapshot
  return snapshot && typeof snapshot === 'object' ? snapshot : {}
}

const getApplicationCompanyLabel = (record) =>
  String(
    record?.companyName
      || record?.company_name
      || record?.businessName
      || record?.business_name
      || getApplicationJobSnapshot(record)?.company_name
      || getApplicationJobSnapshot(record)?.business_name
      || record?.workspaceOwnerName
      || 'Employer',
  ).trim() || 'Employer'

const getApplicationJobTitle = (record) =>
  String(record?.jobTitle || record?.job_title || record?.title || getApplicationJobSnapshot(record)?.title || 'Applied Job').trim() || 'Applied Job'

const normalizeApplicationStatus = (record) =>
  String(record?.status || record?.application_status || record?.interview_status || '')
    .trim()
    .toLowerCase()

const isApprovedApplicationStatus = (normalizedStatus) => ['accepted', 'hired', 'approved'].includes(normalizedStatus)
const isRejectedApplicationStatus = (normalizedStatus) => ['rejected', 'declined', 'denied'].includes(normalizedStatus)
const isDiscontinuedApplicationStatus = (normalizedStatus) => ['discontinued', 'cancelled', 'canceled'].includes(normalizedStatus)
const isInterviewApplicationStatus = (normalizedStatus) => normalizedStatus.includes('interview')
const getApplicationDiscontinuedReason = (record) =>
  String(record?.rejectionReason || record?.rejection_reason || '').trim()
  || 'The job post was deleted and this application was discontinued.'

const getApplicationLocationLabel = (record) =>
  String(
    record?.location
      || record?.job_location
      || record?.work_location
      || record?.workplace
      || getApplicationJobSnapshot(record)?.location
      || 'Location not specified',
  ).trim() || 'Location not specified'

const getApplicationTypeLabel = (record) =>
  String(
    record?.jobType
      || record?.job_type
      || record?.jobSetup
      || record?.job_setup
      || record?.type
      || getApplicationJobSnapshot(record)?.job_type
      || getApplicationJobSnapshot(record)?.setup
      || 'Job type not specified',
  ).trim() || 'Job type not specified'

const getApplicationSalaryLabel = (record) =>
  String(
    record?.salaryRange
      || record?.salary_range
      || record?.salary
      || getApplicationJobSnapshot(record)?.salary_range
      || 'Salary not specified',
  ).trim() || 'Salary not specified'

const getApplicationDisabilityLabel = (record) =>
  String(
    record?.jobDisabilityType
      || record?.job_disability_type
      || getApplicationJobSnapshot(record)?.disability_type
      || 'PWD-friendly',
  ).trim() || 'PWD-friendly'

const formatApplicationStatusLabel = (record) => {
  const normalizedStatus = normalizeApplicationStatus(record)
  if (!normalizedStatus) return 'Pending'
  if (['pending', 'submitted', 'applied'].includes(normalizedStatus)) return 'Pending'
  if (isInterviewApplicationStatus(normalizedStatus)) return 'Interview'
  if (isApprovedApplicationStatus(normalizedStatus)) return 'Approved'
  if (isRejectedApplicationStatus(normalizedStatus)) return 'Rejected'
  if (isDiscontinuedApplicationStatus(normalizedStatus)) return 'Discontinued'
  if (['reviewing', 'under review', 'in_review', 'shortlisted'].includes(normalizedStatus)) return 'Under Review'
  return normalizedStatus
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatApplicationStatusTone = (record) => {
  const normalizedStatus = normalizeApplicationStatus(record)
  if (isInterviewApplicationStatus(normalizedStatus)) return 'info'
  if (isApprovedApplicationStatus(normalizedStatus)) return 'success'
  if (isRejectedApplicationStatus(normalizedStatus)) return 'danger'
  if (isDiscontinuedApplicationStatus(normalizedStatus)) return 'danger'
  return 'pending'
}

const getApplicationTimestamp = (record) => {
  const raw = String(record?.applied_at || record?.appliedAt || record?.submitted_at || record?.created_at || record?.createdAt || '').trim()
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const getApplicationStatusTimestamp = (record) => {
  const raw = String(
    record?.statusUpdatedAt
      || record?.status_updated_at
      || record?.updatedAt
      || record?.updated_at
      || record?.approvedAt
      || record?.approved_at
      || record?.rejectedAt
      || record?.rejected_at
      || record?.reviewedAt
      || record?.reviewed_at
      || record?.appliedAt
      || record?.applied_at
      || '',
  ).trim()
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : getApplicationTimestamp(record)
}

const formatApplicationDate = (record) => {
  const timestamp = getApplicationTimestamp(record)
  if (!timestamp) return 'Recently'
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const formatApplicationStatusDate = (record) => {
  const timestamp = getApplicationStatusTimestamp(record)
  if (!timestamp) return 'Recently'
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const cloneAssessmentJson = (value, fallback) => {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

const normalizeApplicantAssessmentResponses = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return cloneAssessmentJson(value, {})
}

const normalizeApplicantAssessmentStatus = (record) =>
  String(record?.assessmentStatus || record?.assessment_status || record?.assignmentStatus || record?.assignment_status || '')
    .trim()
    .toLowerCase()
const isCancelledApplicantAssessmentStatus = (normalizedStatus) =>
  ['cancelled', 'canceled', 'discontinued'].includes(normalizedStatus)
const getApplicantAssessmentCancellationReason = (record) =>
  String(
    record?.cancellationReason
      || record?.cancellation_reason
      || record?.discontinuedReason
      || record?.discontinued_reason
      || '',
  ).trim() || 'This technical assessment was discontinued because the application is no longer active.'

const normalizeApplicantAssessmentResult = (record) => {
  const normalizedValue = String(record?.assessmentResult || record?.assessment_result || '').trim().toLowerCase()
  if (normalizedValue === 'passed') return 'passed'
  if (normalizedValue === 'failed') return 'failed'
  return 'pending'
}

const getApplicantAssessmentPassingScorePercent = (record) => {
  const parsedValue = Number.parseInt(String(record?.passingScorePercent ?? record?.passing_score_percent ?? 70).trim(), 10)
  if (!Number.isFinite(parsedValue)) return 70
  return Math.min(100, Math.max(1, parsedValue))
}

const getApplicantAssessmentScoreValue = (record) =>
  Math.min(100, Math.max(0, Number(record?.assessmentScoreValue ?? record?.assessment_score_value ?? 0) || 0))

const getApplicantAssessmentScoreLabel = (record) => {
  const explicitLabel = String(record?.assessmentScoreLabel || record?.assessment_score_label || '').trim()
  if (explicitLabel) return explicitLabel
  return `${getApplicantAssessmentScoreValue(record)}%`
}

const getApplicantAssessmentTimestamp = (record) => {
  const raw = String(
    record?.submittedAt
      || record?.submitted_at
      || record?.startedAt
      || record?.started_at
      || record?.assignedAt
      || record?.assigned_at
      || record?.updatedAt
      || record?.updated_at
      || '',
  ).trim()
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatApplicantAssessmentDate = (value) => {
  const parsed = Date.parse(String(value || '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Recently'
  return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const getApplicantAssessmentQuestions = (record) =>
  Array.isArray(record?.templateQuestions || record?.template_questions)
    ? cloneAssessmentJson(record.templateQuestions || record.template_questions, [])
    : []

const evaluateApplicantAssessmentSubmission = (record, responses) => {
  const scorableQuestions = getApplicantAssessmentQuestions(record).filter((question) =>
    String(question?.type || '').trim() === 'multiple-choice'
    && Number.isInteger(question?.correctOptionIndex)
    && question.correctOptionIndex >= 0,
  )
  const totalQuestions = scorableQuestions.length
  const correctAnswerCount = scorableQuestions.reduce((count, question) => {
    const answerValue = responses?.[question.id]
    return String(answerValue ?? '').trim() === String(question.correctOptionIndex) ? count + 1 : count
  }, 0)
  const scoreValue = totalQuestions ? Math.round((correctAnswerCount / totalQuestions) * 100) : 0
  const passingScorePercent = getApplicantAssessmentPassingScorePercent(record)
  const assessmentResult = totalQuestions
    ? scoreValue >= passingScorePercent ? 'passed' : 'failed'
    : 'pending'

  return {
    passingScorePercent,
    correctAnswerCount,
    totalQuestions,
    scoreValue,
    scoreLabel: totalQuestions ? `${scoreValue}%` : 'Pending',
    assessmentResult,
  }
}

const getApplicantAssessmentStatusTone = (record) => {
  const normalizedStatus = normalizeApplicantAssessmentStatus(record)
  if (isCancelledApplicantAssessmentStatus(normalizedStatus)) return 'muted'

  const assessmentResult = normalizeApplicantAssessmentResult(record)
  if (assessmentResult === 'passed') return 'success'
  if (assessmentResult === 'failed') return 'danger'

  if (['submitted', 'completed'].includes(normalizedStatus)) return 'success'
  if (['in_progress', 'in progress', 'started'].includes(normalizedStatus)) return 'accent'
  return 'warning'
}

const getApplicantAssessmentStatusLabel = (record) => {
  const normalizedStatus = normalizeApplicantAssessmentStatus(record)
  if (isCancelledApplicantAssessmentStatus(normalizedStatus)) return 'Discontinued'

  const assessmentResult = normalizeApplicantAssessmentResult(record)
  if (assessmentResult === 'passed') return 'Passed'
  if (assessmentResult === 'failed') return 'Failed'

  if (['submitted', 'completed'].includes(normalizedStatus)) return 'Submitted'
  if (['in_progress', 'in progress', 'started'].includes(normalizedStatus)) return 'In Progress'
  return 'Assigned'
}

const formatApplicantNotificationTime = (value) => {
  const timestamp = typeof value === 'number' ? value : Date.parse(String(value || '').trim())
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Just now'

  const now = Date.now()
  const diffMs = Math.max(0, now - timestamp)
  const diffMinutes = Math.round(diffMs / (60 * 1000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMs / (60 * 60 * 1000))
  if (diffHours < 24) return `${diffHours}h ago`

  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

const buildApplicantInterviewFallbackRecord = (record = {}) => {
  const interviewType = String(record?.interviewType || record?.interview_type || 'initial').trim().toLowerCase() || 'initial'
  const scheduledAt = String(
    record?.interviewDate
      || record?.interview_date
      || record?.interviewSchedule
      || record?.interview_schedule
      || '',
  ).trim()
  const explicitScheduleStatus = String(record?.scheduleStatus || record?.schedule_status || '').trim()
  const applicationStatus = normalizeApplicationStatus(record)
  const scheduleStatus = explicitScheduleStatus
    ? normalizeApplicantInterviewScheduleState(explicitScheduleStatus)
    : isDiscontinuedApplicationStatus(applicationStatus) && scheduledAt
      ? 'cancelled'
      : 'scheduled'
  const responseStatus = normalizeApplicantInterviewResponseState(record)

  if (!scheduledAt && !isInterviewApplicationStatus(normalizeApplicationStatus(record))) return null

  return {
    id: `application-interview-${String(record?.id || '').trim()}-${interviewType}`,
    applicationId: String(record?.id || '').trim(),
    workspaceOwnerId: String(record?.workspaceOwnerId || record?.workspace_owner_id || '').trim(),
    workspaceOwnerName: String(
      record?.companyName
        || record?.company_name
        || record?.businessName
        || record?.business_name
        || 'Business Workspace',
    ).trim() || 'Business Workspace',
    workspaceOwnerEmail: String(record?.workspaceOwnerEmail || record?.workspace_owner_email || '').trim().toLowerCase(),
    applicantId: String(record?.applicantId || record?.applicant_id || '').trim(),
    applicantEmail: String(record?.applicantEmail || record?.applicant_email || '').trim().toLowerCase(),
    applicantName: String(record?.applicantName || record?.applicant_name || '').trim(),
    applicantAvatar: String(record?.applicantAvatar || record?.applicant_avatar || '').trim(),
    jobId: String(record?.jobId || record?.job_id || '').trim(),
    jobTitle: String(record?.jobTitle || record?.job_title || 'Applied Job').trim() || 'Applied Job',
    interviewType,
    scheduledAt,
    mode: String(record?.interviewMode || record?.interview_mode || 'in-person').trim() || 'in-person',
    interviewer: String(record?.interviewer || '').trim(),
    locationOrLink: String(record?.interviewLocationOrLink || record?.interview_location_or_link || '').trim(),
    notes: String(record?.interviewNotes || record?.interview_notes || '').trim(),
    scheduleStatus: scheduleStatus || 'scheduled',
    applicantResponseStatus: responseStatus,
    applicantResponseReason: String(record?.interviewRescheduleReason || record?.interview_reschedule_reason || '').trim(),
    requestedScheduleAt: String(record?.interviewRequestedScheduleAt || record?.interview_requested_schedule_at || '').trim(),
    businessDecisionReason: String(record?.interviewDecisionReason || record?.interview_decision_reason || '').trim(),
    availableScheduleOptions: normalizeApplicantInterviewScheduleOptions(record),
  }
}

const getApplicantInterviewRecordForApplication = (record, interviewType = '') => {
  const applicationId = String(record?.id || '').trim()
  if (!applicationId) return buildApplicantInterviewFallbackRecord(record)

  if (interviewType) {
    const matchedRecord = latestApplicantInterviewByApplicationAndType.value.get(
      `${applicationId}:${String(interviewType || '').trim().toLowerCase()}`,
    ) || null
    if (matchedRecord) return matchedRecord

    const fallbackRecord = buildApplicantInterviewFallbackRecord(record)
    return String(fallbackRecord?.interviewType || '').trim().toLowerCase() === String(interviewType || '').trim().toLowerCase()
      ? fallbackRecord
      : null
  }

  return latestApplicantInterviewByApplication.value.get(applicationId) || buildApplicantInterviewFallbackRecord(record)
}

const getApplicantInterviewStatusToneFromRecord = (record = {}) => {
  const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeApplicantInterviewResponseState(record)

  if (scheduleStatus === 'completed' || responseStatus === 'confirmed') return 'success'
  if (scheduleStatus === 'cancelled' || responseStatus === 'reschedule_rejected') return 'danger'
  if (responseStatus === 'reschedule_requested') return 'info'
  return 'info'
}
const getApplicantInterviewTimelineToneFromRecord = (record = {}) => {
  const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeApplicantInterviewResponseState(record)

  if (scheduleStatus === 'completed') return 'success'
  if (scheduleStatus === 'cancelled' || responseStatus === 'reschedule_rejected') return 'danger'
  if (responseStatus === 'confirmed') return 'info'
  if (responseStatus === 'reschedule_requested') return 'info'
  return 'info'
}

const getApplicantInterviewTimelineMeta = (record = {}, interviewType = 'initial') => {
  const typeLabel = formatApplicantInterviewTypeLabel(record?.interviewType || interviewType)
  const scheduleLabel = formatApplicantInterviewScheduleLabel(record?.scheduledAt || record?.scheduled_at)
  const responseStatus = normalizeApplicantInterviewResponseState(record)
  const requestReason = String(record?.applicantResponseReason || record?.applicant_response_reason || '').trim()
  const requestedScheduleLabel = formatApplicantInterviewScheduleLabel(record?.requestedScheduleAt || record?.requested_schedule_at)
  const decisionReason = String(record?.businessDecisionReason || record?.business_decision_reason || '').trim()
  const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
  const availableScheduleOptions = normalizeApplicantInterviewScheduleOptions(record)
  const availableScheduleSummary = availableScheduleOptions
    .slice(0, 3)
    .map((value) => formatApplicantInterviewScheduleLabel(value))
    .join(', ')

  if (scheduleStatus === 'completed') {
    return `${typeLabel} completed. Scheduled time: ${scheduleLabel}.`
  }

  if (scheduleStatus === 'cancelled') {
    return decisionReason
      ? `${typeLabel} was cancelled. Reason: ${decisionReason}`
      : `${typeLabel} was cancelled by the business owner.`
  }

  if (responseStatus === 'confirmed') {
    return `${typeLabel} scheduled for ${scheduleLabel}. You confirmed attendance.`
  }

  if (responseStatus === 'reschedule_requested') {
    return requestReason
      ? `Reschedule requested for ${requestedScheduleLabel}. Reason: ${requestReason}`
      : `Reschedule requested for ${requestedScheduleLabel}.`
  }

  if (responseStatus === 'reschedule_rejected') {
    return decisionReason
      ? `Reschedule request was not approved. Reason: ${decisionReason}. This application has been closed.`
      : 'Reschedule request was not approved. This application has been closed.'
  }

  if (availableScheduleSummary) {
    return decisionReason
      ? `${decisionReason} Available interview dates: ${availableScheduleSummary}.`
      : `${typeLabel} was updated by the business owner. Available interview dates: ${availableScheduleSummary}.`
  }

  return decisionReason
    ? `${typeLabel} scheduled for ${scheduleLabel}. ${decisionReason}`
    : `${typeLabel} scheduled for ${scheduleLabel}. Confirm or request a reschedule from the Interviews page.`
}

const resolveApplicationStatusDescription = (record) => {
  const normalizedStatus = normalizeApplicationStatus(record)
  const companyLabel = getApplicationCompanyLabel(record)
  const jobTitle = getApplicationJobTitle(record)
  const rejectionReason = String(record?.rejectionReason || record?.rejection_reason || '').trim()
  const latestInterview = getApplicantInterviewRecordForApplication(record)
  const technicalRecord = latestApplicantAssessmentAssignmentByApplication.value.get(String(record?.id || '').trim()) || null

  if (isDiscontinuedApplicationStatus(normalizedStatus)) {
    return getApplicationDiscontinuedReason(record)
  }

  if (latestInterview) {
    return `${companyLabel}: ${getApplicantInterviewTimelineMeta(latestInterview)}`
  }

  if (technicalRecord) {
    const technicalStatus = normalizeApplicantAssessmentStatus(technicalRecord)
    if (isCancelledApplicantAssessmentStatus(technicalStatus)) {
      return getApplicantAssessmentCancellationReason(technicalRecord)
    }

    const technicalResult = normalizeApplicantAssessmentResult(technicalRecord)
    const scoreLabel = getApplicantAssessmentScoreLabel(technicalRecord)
    if (technicalResult === 'passed') {
      return `${companyLabel} received your technical assessment for ${jobTitle}. You passed with ${scoreLabel}.`
    }

    if (technicalResult === 'failed') {
      return `${companyLabel} received your technical assessment for ${jobTitle}. You did not reach the passing score.`
    }
  }

  if (!normalizedStatus || ['pending', 'submitted', 'applied'].includes(normalizedStatus)) {
    return `${companyLabel} has received your ${jobTitle} application and it is waiting for approval.`
  }

  if (['reviewing', 'under review', 'in_review', 'shortlisted'].includes(normalizedStatus)) {
    return `${companyLabel} is reviewing your ${jobTitle} application.`
  }

  if (isInterviewApplicationStatus(normalizedStatus)) {
    return `${companyLabel} moved your ${jobTitle} application to the interview stage.`
  }

  if (isApprovedApplicationStatus(normalizedStatus)) {
    return `${companyLabel} approved your ${jobTitle} application.`
  }

  if (isRejectedApplicationStatus(normalizedStatus)) {
    return rejectionReason
      ? `Your ${jobTitle} application was rejected. Reason: ${rejectionReason}`
      : `Your ${jobTitle} application was rejected by ${companyLabel}.`
  }

  return `${companyLabel} updated your ${jobTitle} application status to ${formatApplicationStatusLabel(record)}.`
}

const buildApplicantApplicationTimeline = (record) => {
  const normalizedStatus = normalizeApplicationStatus(record)
  const rejectionReason = String(record?.rejectionReason || record?.rejection_reason || '').trim()
  const isDiscontinued = isDiscontinuedApplicationStatus(normalizedStatus)
  const discontinuedReason = getApplicationDiscontinuedReason(record)
  const linkedAssessment = latestApplicantAssessmentAssignmentByApplication.value.get(String(record?.id || '').trim()) || null
  const linkedTrainingAssignment = latestApplicantTrainingAssignmentByApplication.value.get(String(record?.id || '').trim()) || null
  const initialInterview = getApplicantInterviewRecordForApplication(record, 'initial')
  const finalInterview = getApplicantInterviewRecordForApplication(record, 'final')
  const hasAdvancedPastApplicationStage = isInterviewApplicationStatus(normalizedStatus)
  const applicationTone = isApprovedApplicationStatus(normalizedStatus)
    ? 'success'
    : isRejectedApplicationStatus(normalizedStatus)
      ? 'danger'
      : isDiscontinued
        ? 'muted'
      : hasAdvancedPastApplicationStage
        ? 'success'
      : 'warning'
  const technicalStatus = normalizeApplicantAssessmentStatus(linkedAssessment)
  const technicalResult = normalizeApplicantAssessmentResult(linkedAssessment)
  const technicalScoreLabel = getApplicantAssessmentScoreLabel(linkedAssessment)
  const technicalPassingScorePercent = getApplicantAssessmentPassingScorePercent(linkedAssessment)
  const technicalIsCancelled = linkedAssessment && isCancelledApplicantAssessmentStatus(technicalStatus)
  const technicalTone = linkedAssessment
    ? technicalIsCancelled
      ? 'muted'
      : technicalResult === 'passed'
      ? 'success'
      : technicalResult === 'failed'
        ? 'danger'
        : ['submitted', 'completed'].includes(technicalStatus)
          ? 'success'
          : 'warning'
    : isDiscontinued
      ? 'muted'
      : 'warning'
  const technicalLabel = linkedAssessment
    ? technicalIsCancelled
      ? 'Technical Assessment Discontinued'
      : technicalResult === 'passed'
      ? 'Technical Assessment Passed'
      : technicalResult === 'failed'
        ? 'Technical Assessment Failed'
        : 'Technical Assessment'
    : 'Technical Assessment'
  const technicalMeta = linkedAssessment
    ? technicalIsCancelled
      ? getApplicantAssessmentCancellationReason(linkedAssessment)
      : technicalResult === 'passed'
      ? `You passed the technical assessment with ${technicalScoreLabel}. Pass mark: ${technicalPassingScorePercent}%.`
      : technicalResult === 'failed'
        ? `You did not reach the passing score for the technical assessment. Result: ${technicalScoreLabel}. Pass mark: ${technicalPassingScorePercent}%.`
        : ['submitted', 'completed'].includes(technicalStatus)
          ? `Technical assessment submitted. Result: ${technicalScoreLabel}. Pass mark: ${technicalPassingScorePercent}%.`
          : ['in_progress', 'in progress', 'started'].includes(technicalStatus)
            ? 'Technical assessment started. Continue and submit when ready.'
            : 'Technical assessment assigned and ready to start.'
    : isDiscontinued
      ? 'Technical assessment will not continue because this application was discontinued.'
      : 'Waiting for the business owner to assign a technical assessment.'
  const trainingProgressStatus = String(linkedTrainingAssignment?.progressStatus || '').trim().toLowerCase()
  const hasCompletedTrainingMonitoring = Boolean(linkedTrainingAssignment?.trainingCompletedAt)
    || trainingProgressStatus === 'completed'
  const trainingLabel = linkedTrainingAssignment
    ? hasCompletedTrainingMonitoring
      ? 'Training Completed'
      : 'Training Assigned'
    : 'Training'
  const trainingTone = hasCompletedTrainingMonitoring ? 'success' : 'warning'
  const trainingMeta = linkedTrainingAssignment
    ? hasCompletedTrainingMonitoring
      ? 'Training monitoring was completed by the business owner.'
      : 'Training has been assigned. Waiting for the business owner to finish training monitoring.'
    : isDiscontinued
      ? 'Training will not continue because this application was discontinued.'
      : 'Training not assigned yet.'

  return [
    {
      id: `application-sent-${String(record?.id || '').trim()}`,
      label: isApprovedApplicationStatus(normalizedStatus)
        ? 'Approved'
        : isRejectedApplicationStatus(normalizedStatus)
          ? rejectionReason || 'Rejected'
          : isDiscontinued
            ? 'Discontinued'
          : hasAdvancedPastApplicationStage
            ? 'Application Advanced'
          : 'Application Sent',
      tone: applicationTone,
      meta: isApprovedApplicationStatus(normalizedStatus)
        ? 'Approved by the business owner.'
        : isRejectedApplicationStatus(normalizedStatus)
          ? rejectionReason || 'This application is no longer active.'
          : isDiscontinued
            ? discontinuedReason
          : hasAdvancedPastApplicationStage
            ? 'Your application passed the initial review and moved forward in the hiring process.'
          : 'Applied and waiting for approval.',
    },
    {
      id: `technical-assessment-${String(record?.id || '').trim()}`,
      label: technicalLabel,
      tone: technicalTone,
      meta: technicalMeta,
    },
    {
      id: `initial-interview-${String(record?.id || '').trim()}`,
      label: initialInterview ? formatApplicantInterviewStatusLabelFromRecord(initialInterview) : 'Initial Interview',
      tone: initialInterview ? getApplicantInterviewTimelineToneFromRecord(initialInterview) : isDiscontinued ? 'muted' : 'warning',
      meta: initialInterview
        ? getApplicantInterviewTimelineMeta(initialInterview, 'initial')
        : isDiscontinued
          ? 'Initial interview will not continue because this application was discontinued.'
          : 'Initial interview not scheduled yet.',
    },
    {
      id: `final-interview-${String(record?.id || '').trim()}`,
      label: finalInterview ? formatApplicantInterviewStatusLabelFromRecord(finalInterview) : 'Final Interview',
      tone: finalInterview ? getApplicantInterviewTimelineToneFromRecord(finalInterview) : isDiscontinued ? 'muted' : 'warning',
      meta: finalInterview
        ? getApplicantInterviewTimelineMeta(finalInterview, 'final')
        : isDiscontinued
          ? 'Final interview will not continue because this application was discontinued.'
          : 'Final interview not scheduled yet.',
    },
    {
      id: `training-${String(record?.id || '').trim()}`,
      label: trainingLabel,
      tone: isDiscontinued ? 'muted' : trainingTone,
      meta: trainingMeta,
    },
  ]
}

const mapApplicantApplicationRecord = (record) => {
  const title = getApplicationJobTitle(record)
  const company = String(
    record?.company_name
      || record?.companyName
      || record?.employer_name
      || record?.employerName
      || record?.business_name
      || record?.businessName
      || record?.employer_profile?.company_name
      || getApplicationJobSnapshot(record)?.company_name
      || 'Company'
  ).trim()
  const rejectionReason = String(record?.rejectionReason || record?.rejection_reason || '').trim()
  const normalizedStatus = normalizeApplicationStatus(record)
  const isDiscontinued = isDiscontinuedApplicationStatus(normalizedStatus)
  const discontinuedReason = isDiscontinued ? getApplicationDiscontinuedReason(record) : ''
  const latestInterview = getApplicantInterviewRecordForApplication(record)
  const interviewStatusLabel = latestInterview ? formatApplicantInterviewStatusLabelFromRecord(latestInterview) : ''
  const interviewStatusTone = latestInterview ? getApplicantInterviewStatusToneFromRecord(latestInterview) : ''
  const latestActivityValue = Math.max(
    getApplicationStatusTimestamp(record),
    getApplicantAssessmentTimestamp(latestApplicantAssessmentAssignmentByApplication.value.get(String(record?.id || '').trim()) || {}),
    getApplicantInterviewRecordActivityTime(latestInterview || {}),
  )

  return {
    id: String(record?.id || `${title}-${company}-${Date.now()}`),
    jobId: String(record?.jobId || record?.job_id || '').trim(),
    title,
    company,
    location: getApplicationLocationLabel(record),
    jobType: getApplicationTypeLabel(record),
    salaryLabel: getApplicationSalaryLabel(record),
    disabilityLabel: getApplicationDisabilityLabel(record),
    submittedAtLabel: formatApplicationDate(record),
    submittedAtValue: getApplicationTimestamp(record),
    statusLabel: isDiscontinued ? 'Discontinued' : interviewStatusLabel || formatApplicationStatusLabel(record),
    statusTone: isDiscontinued ? 'danger' : interviewStatusTone || formatApplicationStatusTone(record),
    statusDescription: resolveApplicationStatusDescription(record),
    rejectionReason,
    isDiscontinued,
    discontinuedReason,
    lastUpdatedValue: latestActivityValue,
    lastUpdatedLabel: latestActivityValue
      ? new Date(latestActivityValue).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      : formatApplicationStatusDate(record),
    sourceLabel: 'Live Firestore',
    timelineItems: buildApplicantApplicationTimeline(record),
  }
}

const mapApplicantAssessmentAssignmentRecord = (record) => {
  const questions = getApplicantAssessmentQuestions(record)
  const responses = normalizeApplicantAssessmentResponses(record?.responses || record?.assessmentResponses)
  const company = String(record?.companyName || record?.company_name || record?.businessName || record?.business_name || 'Business').trim() || 'Business'
  const jobTitle = String(record?.jobTitle || record?.job_title || record?.role || 'Applied Job').trim() || 'Applied Job'
  const assignedAt = String(record?.assignedAt || record?.assigned_at || '').trim()
  const assignedAtValue = getApplicantAssessmentTimestamp(record)
  const submittedAt = String(record?.submittedAt || record?.submitted_at || '').trim()
  const startedAt = String(record?.startedAt || record?.started_at || '').trim()
  const assessmentResult = normalizeApplicantAssessmentResult(record)
  const normalizedStatus = normalizeApplicantAssessmentStatus(record)
  const isCancelled = isCancelledApplicantAssessmentStatus(normalizedStatus)
  const cancellationReason = isCancelled ? getApplicantAssessmentCancellationReason(record) : ''

  return {
    id: String(record?.id || record?.applicationId || '').trim(),
    applicationId: String(record?.applicationId || record?.application_id || record?.id || '').trim(),
    applicantId: String(record?.applicantId || record?.applicant_id || '').trim(),
    workspaceOwnerId: String(record?.workspaceOwnerId || record?.workspace_owner_id || '').trim(),
    title: String(record?.templateTitle || record?.template_title || 'Technical Assessment').trim() || 'Technical Assessment',
    description: String(record?.templateDescription || record?.template_description || '').trim(),
    instructions: String(record?.templateInstructions || record?.template_instructions || '').trim(),
    company,
    jobTitle,
    assignedAt,
    assignedAtLabel: formatApplicantAssessmentDate(record?.assignedAt || record?.assigned_at),
    assignedAtValue,
    passingScorePercent: getApplicantAssessmentPassingScorePercent(record),
    scoreValue: getApplicantAssessmentScoreValue(record),
    scoreLabel: getApplicantAssessmentScoreLabel(record),
    assessmentResult,
    startedAt,
    submittedAt,
    submittedAtLabel: submittedAt ? formatApplicantAssessmentDate(submittedAt) : '',
    statusLabel: getApplicantAssessmentStatusLabel(record),
    statusTone: getApplicantAssessmentStatusTone(record),
    cancellationReason,
    questions,
    responses,
    isCancelled,
    isSubmitted: !isCancelled && ['submitted', 'completed'].includes(normalizedStatus),
    isStarted: !isCancelled && (Boolean(startedAt) || ['in_progress', 'in progress', 'started', 'submitted', 'completed'].includes(normalizedStatus)),
  }
}

const latestApplicantAssessmentAssignmentByApplication = computed(() => {
  const lookup = new Map()

  liveApplicantAssessmentAssignments.value.forEach((record) => {
    const applicationId = String(record?.applicationId || record?.application_id || record?.id || '').trim()
    if (!applicationId || !activeApplicantApplicationIdSet.value.has(applicationId)) return

    const existingRecord = lookup.get(applicationId)
    if (!existingRecord || getApplicantAssessmentTimestamp(record) >= getApplicantAssessmentTimestamp(existingRecord)) {
      lookup.set(applicationId, record)
    }
  })

  return lookup
})

const getApplicantTrainingTimestamp = (record = {}) =>
  Date.parse(
    String(
      record?.trainingCompletedAt
      || record?.training_completed_at
      || record?.updatedAt
      || record?.updated_at
      || record?.assignedAt
      || record?.assigned_at
      || record?.createdAt
      || record?.created_at
      || '',
    ).trim(),
  ) || 0

const latestApplicantTrainingAssignmentByApplication = computed(() => {
  const lookup = new Map()

  liveApplicantTrainingAssignments.value.forEach((record) => {
    const applicationId = String(record?.applicationId || record?.application_id || record?.id || '').trim()
    if (!applicationId || !activeApplicantApplicationIdSet.value.has(applicationId)) return

    const existingRecord = lookup.get(applicationId)
    if (!existingRecord || getApplicantTrainingTimestamp(record) >= getApplicantTrainingTimestamp(existingRecord)) {
      lookup.set(applicationId, record)
    }
  })

  return lookup
})

const applicantTechnicalAssessmentRecords = computed(() =>
  [...latestApplicantAssessmentAssignmentByApplication.value.values()]
    .map(mapApplicantAssessmentAssignmentRecord)
    .sort((left, right) => right.assignedAtValue - left.assignedAtValue),
)
const seenApplicantAssessmentIds = ref([])
const hasApplicantAssessmentFeedHydrated = ref(false)

const isApplicantApplicationRecord = (record, applicantId, email) => {
  const candidateValues = [
    record?.applicant_id,
    record?.applicantId,
    record?.user_id,
    record?.userId,
    record?.owner_id,
    record?.ownerId,
    record?.uid,
    record?.email,
    record?.applicant_email,
    record?.applicantEmail,
    record?.user_email,
    record?.userEmail,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  if (applicantId && candidateValues.includes(applicantId)) return true
  if (email && candidateValues.includes(email)) return true
  return false
}

const summarizeApplicantApplications = (records) => {
  const summary = {
    applied: Array.isArray(records) ? records.length : 0,
    pending: 0,
    interview: 0,
    accepted: 0,
    rejected: 0,
  }

  ;(Array.isArray(records) ? records : []).forEach((record) => {
    const normalizedStatus = normalizeApplicationStatus(record)
    if (!normalizedStatus || ['pending', 'submitted', 'applied', 'reviewing', 'under review', 'in_review', 'shortlisted'].includes(normalizedStatus)) {
      summary.pending += 1
      return
    }

    if (isInterviewApplicationStatus(normalizedStatus)) {
      summary.interview += 1
      return
    }

    if (isApprovedApplicationStatus(normalizedStatus)) {
      summary.accepted += 1
      return
    }

    if (isRejectedApplicationStatus(normalizedStatus) || isDiscontinuedApplicationStatus(normalizedStatus)) {
      summary.rejected += 1
      return
    }

    summary.pending += 1
  })

  return summary
}

const applicantJobApplicationLookup = computed(() => {
  const lookup = new Map()

  liveApplicantApplications.value.forEach((record) => {
    const jobId = String(record?.jobId || record?.job_id || '').trim()
    if (!jobId) return

    const existingRecord = lookup.get(jobId)
    if (!existingRecord || getApplicationStatusTimestamp(record) >= getApplicationStatusTimestamp(existingRecord)) {
      lookup.set(jobId, record)
    }
  })

  return lookup
})

const resolveApplicantJobApplicationState = (job) => {
  const jobId = String(job?.id || '').trim()
  if (!jobId) {
    return {
      hasApplied: false,
      disabled: false,
      buttonLabel: 'Apply Now',
      statusLabel: '',
      statusTone: 'pending',
      helperText: '',
      rejectionReason: '',
    }
  }

  const record = applicantJobApplicationLookup.value.get(jobId)
  if (!record) {
    return {
      hasApplied: false,
      disabled: false,
      buttonLabel: 'Apply Now',
      statusLabel: '',
      statusTone: 'pending',
      helperText: 'Submit your application to start the approval process.',
      rejectionReason: '',
    }
  }

  const statusLabel = formatApplicationStatusLabel(record)
  const rejectionReason = String(record?.rejectionReason || record?.rejection_reason || '').trim()

  return {
    hasApplied: true,
    disabled: true,
    buttonLabel: statusLabel,
    statusLabel,
    statusTone: formatApplicationStatusTone(record),
    helperText: resolveApplicationStatusDescription(record),
    rejectionReason,
  }
}

const applicantNotifications = computed(() => {
  const accessUpdateItems = applicantAdminAccessNotifications.value

  const applicationItems = liveApplicantApplications.value
    .map((record) => {
      const normalizedStatus = normalizeApplicationStatus(record)
      const companyLabel = getApplicationCompanyLabel(record)
      const jobTitle = getApplicationJobTitle(record)
      const rejectionReason = String(record?.rejectionReason || record?.rejection_reason || '').trim()
      const createdAtValue = getApplicationStatusTimestamp(record)

      if (!normalizedStatus || ['pending', 'submitted', 'applied'].includes(normalizedStatus)) {
        return {
          id: `application-pending-${record.id}`,
          title: 'Application submitted',
          copy: `Your ${jobTitle} application is pending approval from ${companyLabel}.`,
          section: 'applications',
          tone: 'accent',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (['reviewing', 'under review', 'in_review', 'shortlisted'].includes(normalizedStatus)) {
        return {
          id: `application-review-${record.id}`,
          title: 'Application under review',
          copy: `${companyLabel} is reviewing your ${jobTitle} application.`,
          section: 'applications',
          tone: 'neutral',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (['accepted', 'approved', 'hired'].includes(normalizedStatus)) {
        return {
          id: `application-approved-${record.id}`,
          title: 'Application approved',
          copy: `${companyLabel} approved your ${jobTitle} application.`,
          section: 'applications',
          tone: 'success',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (isDiscontinuedApplicationStatus(normalizedStatus)) {
        return {
          id: `application-discontinued-${record.id}`,
          title: 'Application discontinued',
          copy: getApplicationDiscontinuedReason(record),
          section: 'applications',
          tone: 'danger',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (['rejected', 'declined', 'denied'].includes(normalizedStatus)) {
        return {
          id: `application-rejected-${record.id}`,
          title: 'Application rejected',
          copy: rejectionReason
            ? `${companyLabel} rejected your ${jobTitle} application. Reason: ${rejectionReason}`
            : `${companyLabel} rejected your ${jobTitle} application.`,
          section: 'applications',
          tone: 'danger',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (normalizedStatus.includes('interview')) {
        return {
          id: `application-interview-${record.id}`,
          title: 'Interview stage update',
          copy: `${companyLabel} moved your ${jobTitle} application to interview.`,
          section: 'applications',
          tone: 'accent',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      return null
    })
    .filter(Boolean)

  const interviewItems = liveApplicantInterviewSchedules.value
    .filter((record) =>
      activeApplicantApplicationIdSet.value.has(String(record?.applicationId || record?.application_id || '').trim()))
    .map((record) => {
      const companyLabel = String(record?.workspaceOwnerName || record?.workspace_owner_name || 'Employer').trim() || 'Employer'
      const jobTitle = String(record?.jobTitle || record?.job_title || 'application').trim() || 'application'
      const createdAtValue = getApplicantInterviewRecordActivityTime(record)
      const scheduleLabel = String(record?.scheduledAt || record?.scheduled_at || '').trim()
      const scheduleStatus = normalizeApplicantInterviewScheduleState(record?.scheduleStatus || record?.schedule_status)
      const businessDecisionReason = String(record?.businessDecisionReason || record?.business_decision_reason || '').trim()

      if (scheduleStatus === 'cancelled') {
        return {
          id: `interview-cancelled-${record.id}`,
          title: 'Interview cancelled',
          copy: businessDecisionReason
            ? businessDecisionReason
            : `${companyLabel} cancelled the interview for your ${jobTitle} application.`,
          section: 'interviews',
          tone: 'danger',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      return {
        id: `interview-schedule-${record.id}`,
        title: 'Interview scheduled',
        copy: scheduleLabel
          ? `${companyLabel} scheduled an interview for your ${jobTitle} application.`
          : `${companyLabel} sent an interview update for your ${jobTitle} application.`,
        section: 'interviews',
        tone: 'accent',
        createdAtValue,
        timeLabel: formatApplicantNotificationTime(createdAtValue),
      }
    })
    .filter(Boolean)

  const assessmentItems = applicantTechnicalAssessmentRecords.value
    .map((record) => {
      const createdAtValue = record.assignedAtValue || Date.parse(String(record?.submittedAt || '').trim()) || 0

      if (record.isCancelled) {
        return {
          id: `assessment-cancelled-${record.id}`,
          title: 'Technical assessment discontinued',
          copy: record.cancellationReason || `${record.company} discontinued the technical assessment for your ${record.jobTitle} application.`,
          section: 'technical-assessment',
          tone: 'danger',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      if (record.isSubmitted) {
        const resultCopy = record.assessmentResult === 'passed'
          ? ` You passed with ${record.scoreLabel}.`
          : record.assessmentResult === 'failed'
            ? ` You finished with ${record.scoreLabel}, which did not meet the passing score.`
            : ''
        return {
          id: `assessment-submitted-${record.id}`,
          title: 'Technical assessment submitted',
          copy: `Your ${record.jobTitle} technical assessment was submitted to ${record.company}.${resultCopy}`,
          section: 'technical-assessment',
          tone: 'success',
          createdAtValue,
          timeLabel: formatApplicantNotificationTime(createdAtValue),
        }
      }

      return {
        id: `assessment-assigned-${record.id}`,
        title: 'Technical assessment assigned',
        copy: `${record.company} assigned a technical assessment for your ${record.jobTitle} application.`,
        section: 'technical-assessment',
        tone: 'accent',
        createdAtValue,
        timeLabel: formatApplicantNotificationTime(createdAtValue),
      }
    })
    .filter(Boolean)

  return [...accessUpdateItems, ...applicationItems, ...interviewItems, ...assessmentItems]
    .sort((left, right) => (right?.createdAtValue || 0) - (left?.createdAtValue || 0))
    .slice(0, 8)
})

const notificationCount = computed(() => applicantNotifications.value.length)
const waitForApplicantAuthReady = () =>
  typeof auth?.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()
const buildApplicantApplicationLookupTargets = (user) => {
  const authApplicantId = String(auth.currentUser?.uid || '').trim()
  const authApplicantEmail = String(auth.currentUser?.email || '').trim().toLowerCase()

  return {
    applicantIds: authApplicantId
      ? [authApplicantId]
      : [...new Set(
        [user?.id, user?.uid]
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      )],
    applicantEmails: authApplicantEmail
      ? [authApplicantEmail]
      : [...new Set(
        [user?.email]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean),
      )],
  }
}

const loadApplicantApplicationStats = async (user) => {
  await waitForApplicantAuthReady()

  const { applicantIds, applicantEmails } = buildApplicantApplicationLookupTargets(user)
  if (!applicantIds.length && !applicantEmails.length) {
    applicantApplicationStats.value = { applied: 0, pending: 0, interview: 0, accepted: 0, rejected: 0 }
    liveApplicantApplications.value = []
    return
  }

  const matchedRecordsById = new Map()
  const loadRecords = async (lookupQuery) => {
    try {
      const snapshot = await getDocs(lookupQuery)
      snapshot.docs.forEach((entry) => {
        matchedRecordsById.set(entry.id, { id: entry.id, _collectionName: 'apply_jobs', ...entry.data() })
      })
    } catch {
      // Keep the current state quiet here because the realtime listener is the primary source.
    }
  }

  await Promise.all([
    ...applicantIds.map((applicantId) => loadRecords(
      query(collection(db, 'apply_jobs'), where('applicant_id', '==', applicantId)),
    )),
    ...applicantEmails.map((applicantEmail) => loadRecords(
      query(collection(db, 'apply_jobs'), where('applicant_email', '==', applicantEmail)),
    )),
  ])

  syncApplicantApplications([...matchedRecordsById.values()])
}

const loadApplicantJobs = async () => {
  jobsLoading.value = true
  try {
    const rows = await getPublicJobs()
    const mapped = (Array.isArray(rows) ? rows : []).map(mapJobRecordToApplicantJob).filter(Boolean)
    publicJobs.value = mapped
    if (selectedFindJobId.value && !mapped.some((job) => job.id === selectedFindJobId.value)) {
      selectedFindJobId.value = ''
    }
  } catch {
    publicJobs.value = []
    selectedFindJobId.value = ''
  } finally {
    jobsLoading.value = false
  }
}

const syncApplicantApplications = (records) => {
  const rows = Array.isArray(records) ? records : []
  liveApplicantApplications.value = rows
  applicantApplicationStats.value = summarizeApplicantApplications(
    rows.filter((record) => !isDiscontinuedApplicationStatus(normalizeApplicationStatus(record))),
  )
}

const refreshApplicantJobDocumentStatesSubscription = () => {
  stopApplicantJobDocumentStatesSubscription?.()

  const jobIds = [...new Set(
    liveApplicantApplications.value
      .map((record) => String(record?.jobId || record?.job_id || '').trim())
      .filter(Boolean),
  )]

  if (!jobIds.length) {
    applicantJobDocumentStates.value = {}
    return
  }

  stopApplicantJobDocumentStatesSubscription = subscribeToJobDocumentStates(
    jobIds,
    (states) => {
      applicantJobDocumentStates.value = states && typeof states === 'object' ? states : {}
    },
    () => {
      applicantJobDocumentStates.value = {}
    },
  )
}

watch(
  liveApplicantApplications,
  () => {
    selectedApplicantApplicationIds.value = sanitizeSelectedApplicantApplicationIds(selectedApplicantApplicationIds.value)
    refreshApplicantJobDocumentStatesSubscription()
  },
  { immediate: true },
)

const applicantApplicationRecords = computed(() =>
  visibleApplicantApplications.value
    .map(mapApplicantApplicationRecord)
    .sort((left, right) => (right.lastUpdatedValue || right.submittedAtValue) - (left.lastUpdatedValue || left.submittedAtValue)),
)

watch(visibleApplicantApplications, (records) => {
  applicantApplicationStats.value = summarizeApplicantApplications(records)
}, { immediate: true })

const handleDeleteApplicantApplications = async (applicationIds = []) => {
  if (isApplicantApplicationDeleteSubmitting.value) return

  const normalizedApplicationIds = sanitizeSelectedApplicantApplicationIds(applicationIds)
  if (!normalizedApplicationIds.length) {
    notify('Select at least one application to delete.', 'warning', 'No applications selected')
    return
  }

  const applicationLabel = normalizedApplicationIds.length === 1 ? 'application' : 'applications'
  const shouldDelete = typeof window === 'undefined'
    ? true
    : window.confirm(`Delete ${normalizedApplicationIds.length} ${applicationLabel} from My Applications?`)
  if (!shouldDelete) return

  isApplicantApplicationDeleteSubmitting.value = true

  try {
    await deleteApplicantJobApplications(normalizedApplicationIds)
    selectedApplicantApplicationIds.value = []
    notify(
      `${normalizedApplicationIds.length} ${applicationLabel} deleted from your application tracker.`,
      'success',
      normalizedApplicationIds.length === 1 ? 'Application deleted' : 'Applications deleted',
    )
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to delete the selected applications right now.', 'error')
  } finally {
    isApplicantApplicationDeleteSubmitting.value = false
  }
}

const getLiveApplicantAssessmentAssignmentById = (assignmentId) =>
  liveApplicantAssessmentAssignments.value.find((record) =>
    String(record?.id || record?.applicationId || '').trim() === String(assignmentId || '').trim()) || null

const getLiveApplicantInterviewById = (interviewId) =>
  liveApplicantInterviewSchedules.value.find((record) =>
    String(record?.id || '').trim() === String(interviewId || '').trim()) || null

const buildApplicantInterviewApplicationPayload = (interviewRecord = {}, overrides = {}) => ({
  status: 'interview',
  interviewSchedule: String(overrides.interviewSchedule ?? interviewRecord?.scheduledAt ?? '').trim(),
  interviewDate: String(overrides.interviewDate ?? interviewRecord?.scheduledAt ?? '').trim(),
  interviewType: String(overrides.interviewType ?? interviewRecord?.interviewType ?? interviewRecord?.interview_type ?? 'initial').trim() || 'initial',
  interviewer: String(overrides.interviewer ?? interviewRecord?.interviewer ?? '').trim(),
  interviewMode: String(overrides.interviewMode ?? interviewRecord?.mode ?? '').trim(),
  interviewLocationOrLink: String(overrides.interviewLocationOrLink ?? interviewRecord?.locationOrLink ?? '').trim(),
  interviewNotes: String(overrides.interviewNotes ?? interviewRecord?.notes ?? '').trim(),
  interviewResponseStatus: String(overrides.interviewResponseStatus ?? interviewRecord?.applicantResponseStatus ?? '').trim(),
  interviewRescheduleReason: String(overrides.interviewRescheduleReason ?? interviewRecord?.applicantResponseReason ?? '').trim(),
  interviewRequestedScheduleAt: String(overrides.interviewRequestedScheduleAt ?? interviewRecord?.requestedScheduleAt ?? '').trim(),
  interviewDecisionReason: String(overrides.interviewDecisionReason ?? interviewRecord?.businessDecisionReason ?? '').trim(),
  interviewRespondedAt: String(overrides.interviewRespondedAt ?? interviewRecord?.applicantRespondedAt ?? '').trim(),
  interviewDecidedAt: String(overrides.interviewDecidedAt ?? interviewRecord?.businessDecidedAt ?? '').trim(),
  interviewScheduleOptions: Array.isArray(overrides.interviewScheduleOptions)
    ? overrides.interviewScheduleOptions.map((value) => String(value || '').trim()).filter(Boolean)
    : normalizeApplicantInterviewScheduleOptions(interviewRecord),
})

const resolveApplicantInterviewActionRecord = (payload = {}) => {
  const input = typeof payload === 'string' ? { interviewId: payload } : (payload || {})
  const directInterviewId = String(input?.interviewId || input?.id || '').trim()
  const directApplicationId = String(input?.applicationId || '').trim()
  const directInterviewType = String(input?.interviewType || '').trim().toLowerCase()

  const linkedPageRecord = directInterviewId
    ? applicantInterviewPageRows.value.find((record) => String(record?.id || '').trim() === directInterviewId) || null
    : null
  const applicationId = directApplicationId || String(linkedPageRecord?.applicationId || '').trim()
  const interviewType = directInterviewType || String(linkedPageRecord?.interviewType || '').trim().toLowerCase()

  const directRecord = directInterviewId ? getLiveApplicantInterviewById(directInterviewId) : null
  if (directRecord?.id && directRecord?.applicationId) return directRecord

  if (applicationId && interviewType) {
    const byApplicationAndType = latestApplicantInterviewByApplicationAndType.value.get(`${applicationId}:${interviewType}`) || null
    if (byApplicationAndType?.id && byApplicationAndType?.applicationId) return byApplicationAndType
  }

  if (applicationId) {
    const byApplication = latestApplicantInterviewByApplication.value.get(applicationId) || null
    if (byApplication?.id && byApplication?.applicationId) return byApplication
  }

  return null
}

const syncApplicantApplicationMirror = async (applicationId, payload = {}) => {
  if (!applicationId) return false

  try {
    await updateApplicantJobApplicationStatus(applicationId, payload)
    return true
  } catch (error) {
    console.warn('Applicant application mirror sync skipped.', {
      applicationId,
      error,
    })
    return false
  }
}

const startApplicantTechnicalAssessment = async (assignmentId) => {
  const targetAssignment = getLiveApplicantAssessmentAssignmentById(assignmentId)
  if (!targetAssignment?.id || !targetAssignment?.workspaceOwnerId) {
    notify('This technical assessment could not be opened right now.', 'error')
    return
  }

  const normalizedStatus = normalizeApplicantAssessmentStatus(targetAssignment)
  if (isCancelledApplicantAssessmentStatus(normalizedStatus)) {
    notify(getApplicantAssessmentCancellationReason(targetAssignment), 'warning')
    return
  }

  try {
    await saveBusinessAssessmentAssignmentRecord({
      ...targetAssignment,
      assessmentStatus: targetAssignment.submittedAt ? 'submitted' : 'in_progress',
      assignmentStatus: targetAssignment.assignmentStatus || 'Assigned',
      startedAt: targetAssignment.startedAt || new Date().toISOString(),
    })
    if (targetAssignment.applicationId) {
      await syncApplicantApplicationMirror(targetAssignment.applicationId, {
        technicalAssessmentStatus: 'in_progress',
      })
    }
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to open this technical assessment right now.', 'error')
  }
}

const submitApplicantTechnicalAssessment = async ({ assessmentId, responses }) => {
  const targetAssignment = getLiveApplicantAssessmentAssignmentById(assessmentId)
  if (!targetAssignment?.id || !targetAssignment?.workspaceOwnerId) {
    notify('This technical assessment could not be submitted right now.', 'error')
    return
  }

  const normalizedStatus = normalizeApplicantAssessmentStatus(targetAssignment)
  if (isCancelledApplicantAssessmentStatus(normalizedStatus)) {
    notify(getApplicantAssessmentCancellationReason(targetAssignment), 'warning')
    return
  }

  try {
    const normalizedResponses = normalizeApplicantAssessmentResponses(responses)
    const scoreSummary = evaluateApplicantAssessmentSubmission(targetAssignment, normalizedResponses)
    const submittedAt = new Date().toISOString()
    await saveBusinessAssessmentAssignmentRecord({
      ...targetAssignment,
      assignmentStatus: 'Submitted',
      assessmentStatus: 'submitted',
      passingScorePercent: scoreSummary.passingScorePercent,
      assessmentScoreValue: scoreSummary.scoreValue,
      assessmentScoreLabel: scoreSummary.scoreLabel,
      correctAnswerCount: scoreSummary.correctAnswerCount,
      totalQuestions: scoreSummary.totalQuestions,
      assessmentResult: scoreSummary.assessmentResult,
      startedAt: targetAssignment.startedAt || new Date().toISOString(),
      submittedAt,
      responses: normalizedResponses,
    })
    if (targetAssignment.applicationId) {
      await syncApplicantApplicationMirror(targetAssignment.applicationId, {
        technicalAssessmentStatus: 'submitted',
        technicalAssessmentResult: scoreSummary.assessmentResult,
        technicalAssessmentScoreValue: scoreSummary.scoreValue,
        technicalAssessmentScoreLabel: scoreSummary.scoreLabel,
        technicalAssessmentSubmittedAt: submittedAt,
      })
    }
    notify(
      scoreSummary.assessmentResult === 'passed'
        ? `Technical assessment submitted. You passed with ${scoreSummary.scoreLabel}.`
        : scoreSummary.assessmentResult === 'failed'
          ? `Technical assessment submitted. You finished with ${scoreSummary.scoreLabel}, which is below the passing score.`
          : `Technical assessment submitted for ${String(targetAssignment.jobTitle || 'your application').trim()}.`,
      scoreSummary.assessmentResult === 'failed' ? 'warning' : 'success',
      'Assessment submitted',
    )
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to submit this technical assessment right now.', 'error')
  }
}

const confirmApplicantInterview = async (payload) => {
  const targetInterview = resolveApplicantInterviewActionRecord(payload)
  if (!targetInterview?.id || !targetInterview?.applicationId) {
    notify('This interview schedule is still syncing. Please reopen the Interviews page and try again.', 'error')
    return
  }

  if (activeApplicantInterviewActionId.value) return

  try {
    activeApplicantInterviewActionId.value = String(targetInterview.id || '').trim()
    const respondedAt = new Date().toISOString()
    const selectedScheduleAt = String(payload?.selectedScheduleAt || '').trim()
    const nextScheduledAt = resolveApplicantConfirmedScheduleAt(targetInterview, selectedScheduleAt)
    const nextInterviewRecord = {
      ...targetInterview,
      scheduledAt: nextScheduledAt,
      applicantResponseStatus: 'confirmed',
      applicantResponseReason: '',
      requestedScheduleAt: '',
      applicantRespondedAt: respondedAt,
      businessDecisionReason: String(targetInterview.businessDecisionReason || '').trim(),
      businessDecidedAt: String(targetInterview.businessDecidedAt || '').trim(),
      availableScheduleOptions: [],
    }

    const savedInterviewRecord = await saveBusinessInterviewSchedule(nextInterviewRecord)
    await syncApplicantApplicationMirror(
      targetInterview.applicationId,
      buildApplicantInterviewApplicationPayload(nextInterviewRecord, {
        interviewSchedule: nextScheduledAt,
        interviewDate: nextScheduledAt,
        interviewResponseStatus: 'confirmed',
        interviewRescheduleReason: '',
        interviewRequestedScheduleAt: '',
        interviewDecisionReason: String(targetInterview.businessDecisionReason || '').trim(),
        interviewRespondedAt: respondedAt,
        interviewDecidedAt: String(targetInterview.businessDecidedAt || '').trim(),
        interviewScheduleOptions: [],
      }),
    )
    upsertLiveApplicantInterviewSchedule(savedInterviewRecord)
    notify('Interview confirmed. The business workspace can now see your confirmation in real time.', 'success', 'Interview confirmed')
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to confirm this interview right now.', 'error')
  } finally {
    activeApplicantInterviewActionId.value = ''
  }
}

const requestApplicantInterviewReschedule = async ({ interviewId, applicationId, interviewType, reason, requestedScheduleAt }) => {
  const targetInterview = resolveApplicantInterviewActionRecord({
    interviewId,
    applicationId,
    interviewType,
  })
  if (!targetInterview?.id || !targetInterview?.applicationId) {
    notify('This interview schedule is still syncing. Please reopen the Interviews page and try again.', 'error')
    return
  }

  const trimmedReason = String(reason || '').trim()
  if (!trimmedReason) {
    notify('Enter a reason before sending a reschedule request.', 'warning', 'Reason required')
    return
  }

  const requestedTimestamp = Date.parse(String(requestedScheduleAt || '').trim())
  if (!Number.isFinite(requestedTimestamp) || requestedTimestamp < Date.now()) {
    notify('Choose a current or future date and time for the reschedule request.', 'warning', 'Invalid date')
    return
  }

  const currentScheduledTimestamp = parseApplicantInterviewTimestamp(targetInterview.scheduledAt || targetInterview.scheduled_at)
  if (currentScheduledTimestamp && requestedTimestamp === currentScheduledTimestamp) {
    notify('Please change the interview date and time before submitting your reschedule request.', 'warning', 'Schedule unchanged')
    return
  }

  if (activeApplicantInterviewActionId.value) return

  try {
    activeApplicantInterviewActionId.value = String(targetInterview.id || '').trim()
    const respondedAt = new Date().toISOString()
    const nextRequestedScheduleAt = new Date(requestedTimestamp).toISOString()
    const nextInterviewRecord = {
      ...targetInterview,
      applicantResponseStatus: 'reschedule_requested',
      applicantResponseReason: trimmedReason,
      requestedScheduleAt: nextRequestedScheduleAt,
      applicantRespondedAt: respondedAt,
      businessDecisionReason: '',
      businessDecidedAt: '',
      availableScheduleOptions: [],
    }

    const savedInterviewRecord = await saveBusinessInterviewSchedule(nextInterviewRecord)
    await syncApplicantApplicationMirror(
      targetInterview.applicationId,
      buildApplicantInterviewApplicationPayload(nextInterviewRecord, {
        interviewResponseStatus: 'reschedule_requested',
        interviewRescheduleReason: trimmedReason,
        interviewRequestedScheduleAt: nextRequestedScheduleAt,
        interviewDecisionReason: '',
        interviewRespondedAt: respondedAt,
        interviewDecidedAt: '',
        interviewScheduleOptions: [],
      }),
    )
    upsertLiveApplicantInterviewSchedule(savedInterviewRecord)
    notify('Reschedule request sent. The business owner can now review your reason in real time.', 'success', 'Request sent')
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to send the reschedule request right now.', 'error')
  } finally {
    activeApplicantInterviewActionId.value = ''
  }
}

const startApplicantInterviewSchedulesSubscription = (user = authUser.value) => {
  stopApplicantInterviewSchedulesSubscription?.()

  const applicationIds = liveApplicantApplications.value
    .map((record) => String(record?.id || '').trim())
    .filter(Boolean)

  stopApplicantInterviewSchedulesSubscription = subscribeToApplicantInterviewSchedules(
    {
      applicantId: String(user?.id || user?.uid || '').trim(),
      applicantEmail: String(user?.email || '').trim().toLowerCase(),
      applicationIds,
    },
    (records) => {
      liveApplicantInterviewSchedules.value = Array.isArray(records) ? records : []
    },
    () => {
      liveApplicantInterviewSchedules.value = []
    },
  )
}

const startApplicantRealtimeSubscriptions = (user) => {
  stopPublicJobsSubscription?.()
  stopApplicantApplicationsSubscription?.()
  stopApplicantInterviewSchedulesSubscription?.()
  stopApplicantAssessmentAssignmentsSubscription?.()
  stopApplicantTrainingAssignmentsSubscription?.()

  stopPublicJobsSubscription = subscribeToPublicJobs(
    (rows) => {
      jobsLoading.value = false
      const mapped = (Array.isArray(rows) ? rows : []).map(mapJobRecordToApplicantJob).filter(Boolean)
      publicJobs.value = mapped
      if (selectedFindJobId.value && !mapped.some((job) => job.id === selectedFindJobId.value)) {
        selectedFindJobId.value = ''
      }
    },
    () => {
      jobsLoading.value = false
      publicJobs.value = []
    },
  )

  stopApplicantApplicationsSubscription = subscribeToApplicantJobApplications(
    {
      applicantId: String(user?.id || user?.uid || '').trim(),
      applicantEmail: String(user?.email || '').trim().toLowerCase(),
    },
    (records) => {
      syncApplicantApplications(records)
      startApplicantInterviewSchedulesSubscription(user)
    },
    () => {
      syncApplicantApplications([])
      startApplicantInterviewSchedulesSubscription(user)
    },
  )

  startApplicantInterviewSchedulesSubscription(user)

  stopApplicantAssessmentAssignmentsSubscription = subscribeToApplicantAssessmentAssignments(
    {
      applicantId: String(user?.id || user?.uid || '').trim(),
      applicantEmail: String(user?.email || '').trim().toLowerCase(),
    },
    (records) => {
      liveApplicantAssessmentAssignments.value = Array.isArray(records) ? records : []
    },
    () => {
      liveApplicantAssessmentAssignments.value = []
    },
  )

  stopApplicantTrainingAssignmentsSubscription = subscribeToApplicantTrainingAssignments(
    {
      applicantId: String(user?.id || user?.uid || '').trim(),
      applicantEmail: String(user?.email || '').trim().toLowerCase(),
    },
    (records) => {
      liveApplicantTrainingAssignments.value = Array.isArray(records) ? records : []
    },
    () => {
      liveApplicantTrainingAssignments.value = []
    },
  )
}

const loadViewedApplicantJobs = () => {
  try {
    const raw = window.localStorage.getItem(APPLICANT_VIEWED_JOB_POSTS_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]')
    viewedApplicantJobIds.value = Array.isArray(parsed)
      ? parsed.map((jobId) => String(jobId || '').trim()).filter(Boolean)
      : []
  } catch {
    viewedApplicantJobIds.value = []
  }
}

const persistViewedApplicantJobs = () => {
  try {
    window.localStorage.setItem(APPLICANT_VIEWED_JOB_POSTS_STORAGE_KEY, JSON.stringify(viewedApplicantJobIds.value))
  } catch {
    // Ignore storage failures and keep the current state in memory.
  }
}

const hasViewedApplicantJob = (job) => {
  const jobId = String(job?.id || '').trim()
  if (!jobId) return false
  return viewedApplicantJobIds.value.includes(jobId)
}

const shouldShowApplicantJobNewTag = (job) => Boolean(job?.isNew) && !hasViewedApplicantJob(job)

const markApplicantJobViewed = (jobId) => {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId || viewedApplicantJobIds.value.includes(normalizedJobId)) return
  viewedApplicantJobIds.value = [...viewedApplicantJobIds.value, normalizedJobId]
  persistViewedApplicantJobs()
}

const selectFindJob = (jobId) => {
  const normalizedJobId = String(jobId || '')
  selectedFindJobId.value = normalizedJobId
  markApplicantJobViewed(normalizedJobId)
}

const closeFindJob = () => {
  selectedFindJobId.value = ''
}

const saveApplicantJob = (job) => {
  const targetJob = job || selectedFindJob.value
  if (!targetJob) return
  notify(`${targetJob.companyName} saved.`, 'success', 'Saved')
}

const resolveApplicantApplicationPayload = (job) => {
  const targetJob = job || selectedFindJob.value
  const currentUser = authUser.value
  if (!targetJob || !currentUser) return null

  const currentRegistration = registration.value || {}

  return {
    jobId: targetJob.id,
    jobTitle: targetJob.title,
    companyName: targetJob.companyName,
    businessName: targetJob.businessName || targetJob.companyName,
    workplace: targetJob.location,
    jobType: targetJob.type || targetJob.setup,
    jobCategory: targetJob.category,
    salaryRange: targetJob.salaryRange || targetJob.salary,
    jobDisabilityType: targetJob.disabilityType || targetJob.disabilityFit,
    jobSetup: targetJob.setup,
    jobVacancies: targetJob.vacancies,
    jobQualifications: Array.isArray(targetJob.qualifications) ? [...targetJob.qualifications] : [],
    jobResponsibilities: Array.isArray(targetJob.responsibilities) ? [...targetJob.responsibilities] : [],
    workspaceOwnerId: targetJob.workspaceOwnerId,
    workspaceOwnerEmail: targetJob.workspaceOwnerEmail,
    workspaceOwnerName: targetJob.workspaceOwnerName || targetJob.businessName || targetJob.companyName,
    applicantId: String(currentUser.id || currentUser.uid || '').trim(),
    applicantEmail: String(currentUser.email || '').trim().toLowerCase(),
    applicantName: applicantName.value,
    applicantAvatar: String(currentUser.avatar || currentRegistration.avatar || '').trim(),
    applicantRole: 'Applicant',
    applicantDisability: String(currentRegistration.disability_type || '').trim(),
    applicantBarangay: String(currentRegistration.address_barangay || '').trim(),
    applicantLanguage: String(currentRegistration.preferred_language || '').trim(),
    applicantContactNumber: String(currentRegistration.contact_number || '').trim(),
    applicantSex: String(currentRegistration.sex || '').trim(),
    applicantAge: String(currentRegistration.age || '').trim(),
    applicantBirthDate: String(currentRegistration.birth_date || '').trim(),
    applicantCity: String(currentRegistration.address_city || '').trim(),
    applicantProvince: String(currentRegistration.address_province || '').trim(),
    applicantPresentAddress: String(currentRegistration.present_address || '').trim(),
    applicantProvincialAddress: String(currentRegistration.provincial_address || '').trim(),
    applicantPwdId: String(currentRegistration.pwd_id_number || '').trim(),
    status: 'pending',
  }
}

const applyApplicantJob = async (job) => {
  const targetJob = job || selectedFindJob.value
  if (!targetJob) return
  const payload = resolveApplicantApplicationPayload(targetJob)
  if (!payload?.jobId || !payload?.applicantId || !payload?.workspaceOwnerId) {
    notify('This job is missing Firestore business details, so the application cannot be sent yet.', 'warning')
    return
  }

  try {
    await saveApplicantJobApplication(payload)
    notify(`Application sent for ${targetJob.title}. Your status is now Pending while the business reviews it.`, 'success')
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to send your application right now.', 'error')
  }
}

const applyJobSuggestion = (value) => {
  const normalized = String(value || '').trim()
  activeJobSuggestion.value = normalized
  findJobsQuery.value = normalized
}

const clearJobSuggestion = () => {
  activeJobSuggestion.value = ''
}

const handleApplicantAvatarChange = async (event) => {
  const selectedFile = event?.target?.files?.[0]
  if (!selectedFile || !authUser.value?.id) return

  setApplicantProfileMessage('')
  isApplicantAvatarUploading.value = true

  try {
    const uploadedAvatar = await uploadApplicantProfileAvatar(authUser.value.id, selectedFile)
    applicantProfileForm.value = {
      ...applicantProfileForm.value,
      avatar: uploadedAvatar.url,
      avatar_path: uploadedAvatar.path,
    }
    setApplicantProfileMessage('Profile image uploaded. Save your profile to keep the changes synced.')
  } catch (error) {
    setApplicantProfileMessage(error instanceof Error ? error.message : 'Unable to upload the applicant avatar right now.', 'error')
  } finally {
    isApplicantAvatarUploading.value = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const saveApplicantProfile = async () => {
  if (!authUser.value?.id) return

  setApplicantProfileMessage('')
  isApplicantProfileSaving.value = true

  try {
    const payload = {
      ...applicantProfileForm.value,
      first_name: applicantProfileForm.value.first_name,
      middle_name: applicantProfileForm.value.middle_name,
      last_name: applicantProfileForm.value.last_name,
      sex: applicantProfileForm.value.sex,
      birth_date: applicantProfileForm.value.birth_date,
      age: applicantProfileForm.value.age,
      disability_type: applicantProfileForm.value.disability_type,
      address_barangay: applicantProfileForm.value.address_barangay,
      address_city: applicantProfileForm.value.address_city,
      address_province: applicantProfileForm.value.address_province,
      present_address: applicantProfileForm.value.present_address,
      provincial_address: applicantProfileForm.value.provincial_address,
      place_of_birth: applicantProfileForm.value.place_of_birth,
      contact_country_code: applicantProfileForm.value.contact_country_code,
      contact_number: applicantProfileForm.value.contact_number,
      telephone_number: applicantProfileForm.value.telephone_number,
      preferred_language: applicantProfileForm.value.preferred_language,
      pwd_id_number: applicantProfileForm.value.pwd_id_number,
      avatar: applicantProfileForm.value.avatar,
      avatar_path: applicantProfileForm.value.avatar_path,
    }

    const updatedProfile = await updateApplicantProfileDetails(authUser.value.id, payload)
    const nextStoredUser = {
      ...authUser.value,
      name: updatedProfile.name,
      avatar: updatedProfile.avatar || payload.avatar,
      avatar_path: updatedProfile.avatar_path || payload.avatar_path,
      applicant_registration: {
        ...(authUser.value?.applicant_registration || authUser.value?.applicantRegistration || {}),
        ...payload,
      },
    }
    nextStoredUser.applicantRegistration = nextStoredUser.applicant_registration
    authUser.value = nextStoredUser
    setStoredAuthUser(nextStoredUser)
    syncApplicantProfileForm(nextStoredUser)
    setApplicantProfileMessage('Applicant profile updated successfully.')
  } catch (error) {
    setApplicantProfileMessage(error instanceof Error ? error.message : 'Unable to save your applicant profile right now.', 'error')
  } finally {
    isApplicantProfileSaving.value = false
  }
}

const completeLogout = async () => {
  window.clearInterval(banPollId)
  banPollId = null
  clearAuthSession()
  sessionStorage.setItem(LOGOUT_TOAST_KEY, '1')
  await router.push('/login')
}
const logout = async () => {
  await completeLogout()
}

const requestLogout = () => {
  if (isLogoutSubmitting.value) return
  isLogoutConfirmOpen.value = true
}

const cancelLogout = () => {
  if (isLogoutSubmitting.value) return
  isLogoutConfirmOpen.value = false
}

const confirmLogout = async () => {
  if (isLogoutSubmitting.value) return
  isLogoutConfirmOpen.value = false
  await completeLogout()
}

const checkApplicantBanStatus = async () => {
  if (!applicantEmail.value || applicantEmail.value === 'No email available') return

  try {
    const data = await getApplicantApprovalStatus(applicantEmail.value)
    if (!data) {
      logout()
      return
    }

    if (data?.status === 'banned') {
      banNotice.value = {
        banReason: String(data?.banReason || '').trim(),
        banDuration: String(data?.banDuration || '').trim(),
        bannedUntil: String(data?.bannedUntil || '').trim(),
      }
      return
    }

    if (data?.status !== 'approved') {
      logout()
      return
    }

    banNotice.value = null
  } catch {
    logout()
  }
}

onMounted(() => {
  const user = getStoredAuthUser()
  if (!user) {
    router.replace('/login')
    return
  }

  authUser.value = user
  syncApplicantProfileForm(user)
  const normalizedDisability = String(
    user?.applicant_registration?.disability_type
    || user?.applicantRegistration?.disability_type
    || '',
  ).trim()
  if (normalizedDisability) {
    applicantJobPwdType.value = normalizeApplicantJobDisabilityCategory(normalizedDisability)
  }
  loadViewedApplicantJobs()
  syncApplicantApplications([])
  startApplicantRealtimeSubscriptions(user)
  void loadApplicantApplicationStats(user)
  stopAuthUserProfileSync = subscribeToStoredAuthUserProfile(
    (nextUser) => {
      if (!nextUser?.id) return
      authUser.value = nextUser
      syncApplicantProfileForm(nextUser)
    },
    () => {},
  )

  const storedWelcomeName = String(sessionStorage.getItem(APPLICANT_WELCOME_TOAST_KEY) || '').trim()
  const shouldShowWelcomeToast = Boolean(storedWelcomeName)

  if (!shouldShowWelcomeToast && sessionStorage.getItem(APPLICANT_ENTRY_TRANSITION_KEY) === '1') {
    sessionStorage.removeItem(APPLICANT_ENTRY_TRANSITION_KEY)
    isDashboardEntering.value = true
    dashboardEntryTimerId = window.setTimeout(() => {
      isDashboardEntering.value = false
    }, 720)
  } else {
    sessionStorage.removeItem(APPLICANT_ENTRY_TRANSITION_KEY)
  }

  if (storedWelcomeName) {
    sessionStorage.removeItem(APPLICANT_WELCOME_TOAST_KEY)
    welcomeToastName.value = storedWelcomeName
    welcomeToastTimerId = window.setTimeout(() => {
      welcomeToastName.value = ''
    }, 2600)
  }

  void checkApplicantBanStatus()
  banPollId = window.setInterval(() => {
    void checkApplicantBanStatus()
  }, 10000)
  applicantAccessRealtimeTimerId = window.setInterval(() => {
    applicantRealtimeNow.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (applicantAccessRealtimeTimerId) {
    window.clearInterval(applicantAccessRealtimeTimerId)
    applicantAccessRealtimeTimerId = null
  }
})

watch(toast, (value) => {
  window.clearTimeout(toastTimerId)
  if (!value) return

  toastTimerId = window.setTimeout(() => {
    toast.value = null
  }, value.kind === 'error' ? 3400 : 2400)
})

watch(
  [applicantModuleAccess, applicantAdminAccessNotifications],
  () => {
    if (!authUser.value?.id) return
    if (activeSection.value === 'profile' && canViewApplicantModule('profile')) return
    if (activeSection.value === 'settings' && canViewApplicantModule('settings')) return
    if (activeSection.value && canViewApplicantModule(activeSection.value)) return

    activeSection.value = resolveFirstAvailableApplicantSection()
  },
  { deep: true },
)

watch(applicantTechnicalAssessmentRecords, (records) => {
  const recordIds = (Array.isArray(records) ? records : [])
    .map((record) => String(record?.id || '').trim())
    .filter(Boolean)

  if (!hasApplicantAssessmentFeedHydrated.value) {
    seenApplicantAssessmentIds.value = recordIds
    hasApplicantAssessmentFeedHydrated.value = true
    return
  }

  const freshAssignments = (Array.isArray(records) ? records : []).filter((record) =>
    !record.isSubmitted && !seenApplicantAssessmentIds.value.includes(String(record?.id || '').trim()))

  if (freshAssignments.length) {
    const latestAssignment = freshAssignments[0]
    notify(
      `${latestAssignment.company} assigned a technical assessment for your ${latestAssignment.jobTitle} application.`,
      'success',
      'New assessment',
    )
  }

  seenApplicantAssessmentIds.value = recordIds
}, { deep: true })

onBeforeUnmount(() => {
  window.clearInterval(banPollId)
  window.clearTimeout(dashboardEntryTimerId)
  window.clearTimeout(welcomeToastTimerId)
  window.clearTimeout(toastTimerId)
  stopAuthUserProfileSync?.()
  stopPublicJobsSubscription?.()
  stopApplicantApplicationsSubscription?.()
  stopApplicantInterviewSchedulesSubscription?.()
  stopApplicantAssessmentAssignmentsSubscription?.()
  stopApplicantTrainingAssignmentsSubscription?.()
  stopApplicantJobDocumentStatesSubscription?.()
})
</script>

<template>
  <div class="applicant-app" :class="{ 'applicant-app--entering': isDashboardEntering }">
    <AppToast :toast="toast" @close="toast = null" />

    <transition name="applicant-welcome-toast">
      <div v-if="welcomeToastName" class="applicant-welcome-toast" role="status" aria-live="polite">
        <div class="applicant-welcome-toast__icon" aria-hidden="true">
          <i class="bi bi-check-circle-fill" />
        </div>
        <div class="applicant-welcome-toast__copy">
          <strong>Welcome back</strong>
          <span>{{ welcomeToastName }}, glad to see you again.</span>
        </div>
        <button type="button" class="applicant-welcome-toast__close" aria-label="Close welcome message" @click="welcomeToastName = ''">
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </transition>

    <transition name="applicant-ban-overlay">
      <div v-if="banNotice" class="applicant-ban-overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
        <div class="applicant-ban-overlay__card">
          <div class="applicant-ban-overlay__icon" aria-hidden="true">
            <i class="bi bi-shield-x" />
          </div>
          <p class="applicant-ban-overlay__eyebrow">Account Update</p>
          <h2>Your account has been banned for {{ banDurationLabel }}.</h2>
          <p class="applicant-ban-overlay__copy">
            You need to log out of your account now.
            {{ banNotice.banReason ? ` Admin reason: ${banNotice.banReason}` : ' Please contact the admin for more details about this account ban.' }}
          </p>

          <button type="button" class="applicant-ban-overlay__action" @click="logout">
            Logout Account
          </button>
        </div>
      </div>
    </transition>

    <transition name="applicant-logout-confirm">
      <div
        v-if="isLogoutConfirmOpen"
        class="applicant-logout-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-logout-title"
      >
        <div class="applicant-logout-confirm__card">
          <button
            type="button"
            class="applicant-logout-confirm__close"
            aria-label="Close logout confirmation"
            @click="cancelLogout"
          >
            <i class="bi bi-x-lg" />
          </button>
          <div class="applicant-logout-confirm__icon" aria-hidden="true">
            <i class="bi bi-exclamation-triangle" />
          </div>
          <h2 id="applicant-logout-title">Log out of your account?</h2>
          <p>You will leave your current applicant session and return to the login page.</p>
          <div class="applicant-logout-confirm__actions">
            <button type="button" class="applicant-logout-confirm__button applicant-logout-confirm__button--ghost" @click="cancelLogout">
              No
            </button>
            <button type="button" class="applicant-logout-confirm__button applicant-logout-confirm__button--primary" @click="confirmLogout">
              Yes
            </button>
          </div>
        </div>
      </div>
    </transition>

    <ApplicantSidebar
      :active-section="activeSection"
      :sidebar-items="sidebarItems"
      :sidebar-settings-item="sidebarSettingsItem"
      :show-profile-item="showApplicantProfileItem"
      :show-settings-item="showApplicantSettingsItem"
      :show-help-center-item="showApplicantHelpCenterItem"
      @select-section="activeSection = $event"
      @open-help-center="openHelpCenter"
    />

    <main class="applicant-main">
      <ApplicantNavbar
        :title="activeSection === 'overview' ? 'Applicant Dashboard' : currentSidebarItem.label"
        :applicant-initials="applicantInitials"
        :applicant-first-name="applicantFirstName"
        :applicant-last-name="applicantLastName"
        :applicant-email="applicantEmail"
        :applicant-avatar-url="applicantAvatarUrl"
        :notifications="applicantNotifications"
        :notification-count="notificationCount"
        @open-notification="handleApplicantNotificationOpen"
        @open-personalization="openPersonalization"
        @open-help-center="openHelpCenter"
        @open-terms="openTermsAndPolicies"
        @logout="requestLogout"
      />

      <transition name="applicant-page" mode="out-in">
        <section v-if="activeSection === 'overview'" key="overview" class="applicant-grid applicant-grid--overview">
          <section class="applicant-overview-intro">
            <div class="applicant-overview-intro__copy">
              <p class="applicant-overview-intro__eyebrow">Applicant Dashboard</p>
              <h2>Welcome, {{ applicantName }}</h2>
              <p>Track your opportunities, review your job activity, and stay ready for employer updates.</p>
            </div>

            <div class="applicant-overview-intro__meta">
              <div
                v-for="item in applicantOverviewHighlights"
                :key="item.id"
                class="applicant-overview-intro__meta-item"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>

          <section class="applicant-stats-grid">
            <article
              v-for="item in applicationSummary"
              :key="item.id"
              class="applicant-stat-card applicant-stat-card--summary"
              :class="`applicant-stat-card--${item.tone}`"
            >
              <div class="applicant-stat-card__top">
                <span>{{ item.label }}</span>
                <div class="applicant-stat-card__icon" aria-hidden="true">
                  <i :class="item.icon" />
                </div>
              </div>
              <div class="applicant-stat-card__body">
                <strong>{{ item.value }}</strong>
                <small class="applicant-stat-card__subtitle">{{ item.subtitle }}</small>
              </div>
            </article>
          </section>

          <section class="applicant-lower-grid">
            <article class="applicant-panel">
              <div class="applicant-panel__head">
                <div>
                  <h3>Upcoming Interviews</h3>
                  <span>Scheduled employer sessions</span>
                </div>
              </div>

              <div v-if="upcomingInterviews.length" class="applicant-interview-list">
                <article
                  v-for="interview in upcomingInterviews"
                  :key="interview.id"
                  class="applicant-interview-card"
                >
                  <div>
                    <h4>{{ interview.company }}</h4>
                    <p>{{ interview.role }}</p>
                    <span>{{ interview.schedule }}</span>
                  </div>
                  <span
                    class="applicant-status-pill"
                    :class="interview.status === 'Confirmed' ? 'applicant-status-pill--success' : 'applicant-status-pill--pending'"
                  >
                    {{ interview.status }}
                  </span>
                </article>
              </div>
              <div v-else class="applicant-dashboard-empty">
                No interview schedules found in Firebase yet.
              </div>
            </article>

            <article class="applicant-panel">
              <div class="applicant-panel__head">
                <div>
                  <h3>Messages Preview</h3>
                  <span>{{ messagesPreview.unreadCount }} unread message<span v-if="messagesPreview.unreadCount !== 1">s</span></span>
                </div>
              </div>

              <div v-if="messagesPreview.items.length" class="applicant-message-list">
                <article v-for="message in messagesPreview.items" :key="message.id" class="applicant-message-card">
                  <div class="applicant-message-card__badge" aria-hidden="true">
                    <i class="bi bi-envelope-paper" />
                  </div>
                  <div>
                    <h4>{{ message.employer }}</h4>
                    <p>{{ message.message }}</p>
                  </div>
                  <span>{{ message.time }}</span>
                </article>
              </div>
              <div v-else class="applicant-dashboard-empty">
                No recent applicant messages yet.
              </div>
            </article>
          </section>

          <section class="applicant-lower-grid">
            <article class="applicant-panel">
              <div class="applicant-panel__head">
                <div>
                  <h3>Skills & Job Matching Insight</h3>
                  <span>DSS explanation based on your current profile</span>
                </div>
              </div>

              <div class="applicant-skill-grid">
                <div class="applicant-skill-block">
                  <p class="applicant-skill-block__label">Your top skills</p>
                  <div class="applicant-tag-list">
                    <span v-for="skill in skillsInsight.strengths" :key="skill" class="applicant-tag applicant-tag--strength">
                      Strength: {{ skill }}
                    </span>
                  </div>
                </div>

                <div class="applicant-skill-block">
                  <p class="applicant-skill-block__label">Missing skills for higher-match roles</p>
                  <div class="applicant-tag-list">
                    <span v-for="skill in skillsInsight.missing" :key="skill" class="applicant-tag applicant-tag--missing">
                      Missing: {{ skill }}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <article class="applicant-panel">
              <div class="applicant-panel__head">
                <div>
                  <h3>Accessibility Preferences</h3>
                  <span>Your saved work and support preferences</span>
                </div>
              </div>

              <div class="applicant-accessibility-list">
                <div class="applicant-accessibility-list__item">
                  <span>Preferred Work Setup</span>
                  <strong>{{ applicantWorkSetup }}</strong>
                </div>
                <div class="applicant-accessibility-list__item">
                  <span>Assistive Needs</span>
                  <strong>{{ applicantAssistiveNeeds }}</strong>
                </div>
                <div class="applicant-accessibility-list__item">
                  <span>Member Since</span>
                  <strong>{{ applicantJoined }}</strong>
                </div>
              </div>
            </article>
          </section>
        </section>

        <section v-else :key="activeSection" class="applicant-placeholder">
          <ApplicantFindJobs
            v-if="activeSection === 'find-jobs'"
            :jobs-loading="jobsLoading"
            :find-jobs-query="findJobsQuery"
            :active-job-suggestion="activeJobSuggestion"
            :applicant-job-suggestions="applicantJobSuggestions"
            :filtered-applicant-jobs="filteredApplicantJobs"
            :applicant-disability="applicantDisability"
            :applicant-job-filter-mode="applicantJobFilterMode"
            :applicant-job-filter-label="applicantJobFilterLabel"
            :applicant-job-results-description="applicantJobResultsDescription"
            :applicant-job-pwd-options="applicantJobPwdTypeOptions"
            :applicant-job-pwd-type="applicantJobPwdType"
            :applicant-job-salary-options="applicantJobSalaryOptions"
            :applicant-job-salary-range="applicantJobSalaryRange"
            :applicant-job-sort-mode="applicantJobSortMode"
            :applicant-job-sort-label="applicantJobSortLabel"
            :applicant-job-sort-options="applicantJobSortOptions"
            :resolve-applicant-job-application-state="resolveApplicantJobApplicationState"
            :on-set-applicant-job-filter-mode="setApplicantJobFilterMode"
            :on-set-applicant-job-pwd-type="updateApplicantJobPwdType"
            :on-set-applicant-job-salary-range="updateApplicantJobSalaryRange"
            :on-set-applicant-job-sort-mode="setApplicantJobSortMode"
            :on-reset-applicant-job-filters="resetApplicantJobFilters"
            :selected-find-job="selectedFindJob"
            :should-show-applicant-job-new-tag="shouldShowApplicantJobNewTag"
            @update:find-jobs-query="findJobsQuery = $event"
            @clear-job-suggestion="clearJobSuggestion"
            @apply-job-suggestion="applyJobSuggestion"
            @select-find-job="selectFindJob"
            @close-find-job="closeFindJob"
            @save-applicant-job="saveApplicantJob"
            @apply-applicant-job="applyApplicantJob"
          />

          <ApplicantApplications
            v-else-if="activeSection === 'applications'"
            :application-records="applicantApplicationRecords"
            :application-stats="applicantApplicationStats"
            :selected-application-ids="selectedApplicantApplicationIds"
            :is-deleting-applications="isApplicantApplicationDeleteSubmitting"
            @update:selected-application-ids="selectedApplicantApplicationIds = $event"
            @delete-selected-applications="handleDeleteApplicantApplications"
          />

          <ApplicantTechnicalAssessment
            v-else-if="activeSection === 'technical-assessment'"
            :assessment-records="applicantTechnicalAssessmentRecords"
            :has-applications="applicantApplicationRecords.length > 0"
            @start-assessment="startApplicantTechnicalAssessment"
            @submit-assessment="submitApplicantTechnicalAssessment"
          />

          <ApplicantMyProfile
            v-else-if="activeSection === 'profile'"
            :applicant-name="applicantName"
            :applicant-initials="applicantInitials"
            :applicant-avatar-url="applicantAvatarUrl"
            :applicant-profile-form="applicantProfileForm"
            :is-applicant-avatar-uploading="isApplicantAvatarUploading"
            :is-applicant-profile-saving="isApplicantProfileSaving"
            :applicant-profile-message="applicantProfileMessage"
            :applicant-profile-message-tone="applicantProfileMessageTone"
            :applicant-profile-snapshot="applicantProfileSnapshot"
            :applicant-present-address="applicantPresentAddress"
            :applicant-provincial-address="applicantProvincialAddress"
            :applicant-place-of-birth="applicantPlaceOfBirth"
            :applicant-sex="applicantSex"
            :applicant-age="applicantAge"
            :applicant-joined="applicantJoined"
            @upload-avatar="handleApplicantAvatarChange"
            @save-profile="saveApplicantProfile"
          />

          <ApplicantInterviews
            v-else-if="activeSection === 'interviews'"
            :interviews="applicantInterviewPageRows"
            :active-action-id="activeApplicantInterviewActionId"
            @confirm-interview="confirmApplicantInterview"
            @request-reschedule="requestApplicantInterviewReschedule"
            @notify="notify($event.text, $event.kind, $event.title)"
          />

          <div v-else class="applicant-placeholder__card">
            <i class="bi bi-stars" />
            <h2>{{ currentSidebarItem.label }}</h2>
            <p>This section is ready for your next features. We can build this page next.</p>
          </div>
        </section>
      </transition>
    </main>

  </div>
</template>

<style scoped src="@/components/applicant_dashboard.css"></style>
