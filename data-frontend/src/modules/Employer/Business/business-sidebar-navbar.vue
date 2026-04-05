<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { useRoute, useRouter } from 'vue-router'
import AdminNavbar from '@/modules/Admin/adminnavbar.vue'
import BusinessUserOverview from '@/modules/Employer/Business/business_user-overview.vue'
import BusinessSubscirptionPayment from '@/modules/Employer/Business/business-subscirption-payment.vue'
import pwdLogo from '@/assets/logo-pwd.png'
import gcashPaymentLogo from '@/assets/gcash-payment.png'
import masterCardLogo from '@/assets/master-card.png'
import { cloudFunctions } from '@/firebase'
import '@/components/businesss.css'
import {
  clearAuthSession,
  createBusinessWorkspaceUserAccount,
  getStoredAuthUser,
  normalizeEmployerOrganizationType,
  saveBusinessMemberEmployer,
  saveBusinessWorkspacePermissions,
  syncBusinessWorkspaceUserDirectory,
  subscribeToBusinessMemberEmployers,
  subscribeToBusinessWorkspaceUsers,
  subscribeToStoredAuthUserProfile,
  uploadEmployerBusinessAvatar,
  updateEmployerAdminDetails,
  updateEmployerSubscriptionState,
} from '@/lib/auth'
import {
  ADMIN_PLAN_CATALOG_STORAGE_KEY,
  normalizePlanRecord,
} from '@/lib/business_plan_access'
import {
  deleteBusinessApplicantScoreRecord,
  saveBusinessApplicantScoreRecord,
  subscribeToBusinessApplicantScores,
} from '@/lib/business_applicant_scores'
import {
  migrateBusinessPaymentHistoryEntries,
  saveBusinessPaymentHistoryEntry,
  subscribeToBusinessPaymentHistory,
} from '@/lib/business_payment_history'
import {
  createBusinessJobPost,
  deleteBusinessJobPost,
  subscribeToWorkspaceJobs,
  updateBusinessJobPost,
} from '@/lib/jobs'
import { subscribeToBusinessJobApplications, updateApplicantJobApplicationStatus } from '@/lib/apply_jobs'
import { saveBusinessInterviewSchedule, subscribeToBusinessInterviewSchedules } from '@/lib/business_interviews'
import { mediaUrl } from '@/lib/media'
import {
  deleteBusinessAssessmentTemplateRecord,
  deleteBusinessAssessmentAssignmentRecord,
  deleteBusinessTrainingTemplateRecord,
  saveBusinessAssessmentAssignmentRecord,
  saveBusinessAssessmentTemplateRecord,
  saveBusinessTrainingAssignmentRecord,
  saveBusinessTrainingTemplateRecord,
  subscribeToBusinessAssessmentAssignments,
  subscribeToBusinessAssessmentTemplates,
  subscribeToBusinessTrainingAssignments,
  subscribeToBusinessTrainingTemplates,
} from '@/lib/business_workspace_records'
import {
  buildBusinessSecurityRouteQuery,
  hasManagedBusinessSecurityQuery,
  managedBusinessSecurityQueryEquals,
  resolveBusinessSubscriptionAccess,
  resolveBusinessWorkspaceSecurityState,
} from '@/lib/security'
import { resolveApprovedEmployerSession } from '@/lib/security-auth'
import 'flag-icons/css/flag-icons.min.css'

const route = useRoute()
const router = useRouter()
let isApplyingBusinessSecurityRouteState = false
let isSyncingBusinessSecurityRouteState = false
const MOCK_PAYMENT_MESSAGE_TYPE = 'business-mock-payment-complete'
const BUSINESS_PAYMENT_HISTORY_STORAGE_KEY = 'businessPaymentHistory'
const ADMIN_PAYMENT_HISTORY_STORAGE_KEY = 'adminPaymentHistory'
const BUSINESS_SUBSCRIPTION_STATE_STORAGE_KEY = 'businessSubscriptionState'
const BUSINESS_PENDING_PAYMONGO_CHECKOUT_STORAGE_KEY = 'businessPendingPayMongoCheckout'
const BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY = 'businessPremiumNavSeen'
const BUSINESS_PROFILE_STATE_STORAGE_KEY = 'businessProfileState'
const BUSINESS_ROLE_PERMISSION_STATE_STORAGE_KEY = 'businessRolePermissionsState'
const BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY = 'businessAssessmentTemplateState'
const BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY = 'businessTrainingTemplateState'
const PREMIUM_SUBSCRIPTION_AMOUNT = 'PHP 1,400.00'
const BUSINESS_USER_MANAGEMENT_STATE_STORAGE_KEY = 'businessUserManagementState'
const PHONE_COUNTRIES = [
  { code: 'PH', dial: '+63', name: 'Philippines' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'CN', dial: '+86', name: 'China' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'HK', dial: '+852', name: 'Hong Kong' },
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'JP', dial: '+81', name: 'Japan' },
  { code: 'KR', dial: '+82', name: 'South Korea' },
  { code: 'MY', dial: '+60', name: 'Malaysia' },
  { code: 'NZ', dial: '+64', name: 'New Zealand' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'TH', dial: '+66', name: 'Thailand' },
  { code: 'TW', dial: '+886', name: 'Taiwan' },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates' },
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'VN', dial: '+84', name: 'Vietnam' },
]
const resolveInitialBusinessAuthUser = () => {
  const storedUser = getStoredAuthUser()
  if (!storedUser) return null

  const normalizedRole = String(storedUser?.role || '').trim().toLowerCase()
  const employerType = normalizeEmployerOrganizationType(
    storedUser?.company_organization_type || storedUser?.companyOrganizationType,
  )

  return normalizedRole === 'employer' && employerType === 'business' ? storedUser : null
}
const authUser = ref(resolveInitialBusinessAuthUser())
const businessRealtimeNow = ref(Date.now())
const isSavingPermissionRoles = ref(false)
const isWorkspaceUserDirectoryLoading = ref(false)
const workspaceUserDirectorySyncMessage = ref('')
const activeSection = ref('dashboard')
const isProfileMenuOpen = ref(false)
const isLogoutSubmitting = ref(false)
const isLogoutConfirmOpen = ref(false)
const isHelpCenterModalOpen = ref(false)
const isCreateUserConfirmOpen = ref(false)
const isTrialConfirmationOpen = ref(false)
const isCancelPaymentModalOpen = ref(false)
const isAddMemberDrawerOpen = ref(false)
const isCancellingPayment = ref(false)
const isProceedingToPayment = ref(false)
const isAdvancingPaymentStep = ref(false)
const isProcessingTestModePayment = ref(false)
const isAwaitingExternalPayment = ref(false)
const activeSubscriptionPlan = ref('free')
const activeSubscriptionMode = ref('none')
const premiumTrialStartedAt = ref(null)
const premiumTrialConsumedAt = ref(null)
const premiumPaidStartedAt = ref(null)
const isSubscriptionStateHydrated = ref(false)
const adminPlanCatalog = ref([])
const paymentHistoryEntries = ref([])
const applicantAssessmentScoreEntries = ref([])
const paymentHistorySearch = ref('')
const paymentHistoryStatusFilter = ref('all')
const subscriptionView = ref('plans')
const selectedCheckoutPlanId = ref('free-trial')
const selectedPaymentMethod = ref('gcash')
const paymentStep = ref(1)
const createPaymentToastState = () => ({
  visible: false,
  title: '',
  message: '',
  tone: 'error',
  actions: [],
})
const paymentToast = ref(createPaymentToastState())
const paymentContactCountryCode = ref('PH')
const isPaymentContactCountryDropdownOpen = ref(false)
const paymentContactCountryDropdownRef = ref(null)
const isNotificationMenuOpen = ref(false)
const businessNotifications = ref([])
const BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY = 'businessSeenNotificationIds'
const seenBusinessNotificationIds = ref([])
const proceedToPaymentTimeoutId = ref(null)
const advancePaymentTimeoutId = ref(null)
const paymentToastTimeoutId = ref(null)
const accessNotice = ref({
  visible: false,
  title: '',
  message: '',
})
let accessNoticeTimeoutId = null
let businessNotificationSequence = 0
const paymentSuccessRedirectSeconds = ref(5)
const paymentForm = ref({
  fullName: '',
  businessEmail: '',
  contactNumber: '',
})
const profileForm = ref({
  companyName: '',
  email: '',
  category: '',
  location: '',
  contactPerson: '',
  avatar: '',
})
const profileAvatarInputRef = ref(null)
const isProfileAvatarLoading = ref(false)
const isProfileAvatarReady = ref(true)
const seenPremiumNavItems = ref([])
const sidebarLinkRefs = ref({})
const jobPostUnlimitedHighlightRef = ref(null)
const pendingPremiumWelcomeGuideMode = ref('')
const isPremiumWelcomeGuideVisible = ref(false)
const premiumWelcomeGuideStep = ref(0)
const premiumWelcomeGuideMode = ref('paid')
const premiumGuideTargetRect = ref(null)
const activeSidebarGroup = ref('dashboard')
const expandedSidebarGroups = ref(['recruitment'])
let stopAuthUserProfileSync = () => {}
let stopWorkspaceUserDirectorySync = () => {}
let stopBusinessMemberEmployerSync = () => {}
let stopBusinessJobApplicationsSync = () => {}
let stopBusinessPaymentHistorySync = () => {}
let stopApplicantAssessmentScoreSync = () => {}
let stopBusinessInterviewSchedulesSync = () => {}
let stopAssessmentTemplateSync = () => {}
let stopTrainingTemplateSync = () => {}
let stopAssessmentAssignmentSync = () => {}
let stopTrainingAssignmentSync = () => {}
let stopAdminApplicantSync = () => {}
let lastSubscriptionHistoryBackfillKey = ''
let businessAccessRealtimeTimerId = null

const premiumNavigationItems = [
  { id: 'job-posting', label: 'Job Posting', icon: 'bi bi-megaphone-fill' },
  { id: 'applicant-management', label: 'Applicant Management', icon: 'bi bi-people-fill' },
  { id: 'assessment-management', label: 'Assessment Management', icon: 'bi bi-ui-checks-grid' },
  { id: 'applicant-score', label: 'Applicant Score', icon: 'bi bi-bar-chart-fill' },
  { id: 'interview-scheduling', label: 'Interview Scheduling', icon: 'bi bi-calendar-event-fill' },
  { id: 'training-templates', label: 'Training Templates', icon: 'bi bi-journal-text' },
  { id: 'user-overview', label: 'User Overview', icon: 'bi bi-people' },
  { id: 'create-user', label: 'Create User', icon: 'bi bi-person-plus-fill' },
  { id: 'add-employee', label: 'Add Employee', icon: 'bi bi-person-vcard-fill' },
  { id: 'permissions', label: 'Permissions', icon: 'bi bi-shield-lock-fill' },
]
const premiumCelebrationPieces = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

const formatBusinessNotificationTime = (value = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(value)
  } catch {
    return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
}

const readSeenBusinessNotificationIds = () => {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY)
    const parsedValue = storedValue ? JSON.parse(storedValue) : []
    return Array.isArray(parsedValue)
      ? parsedValue.map((value) => String(value || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

const persistSeenBusinessNotificationIds = () => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY, JSON.stringify(seenBusinessNotificationIds.value))
  } catch {
    // Keep notifications usable even if storage is unavailable.
  }
}

const normalizeBusinessSystemNotice = (notice = {}) => {
  const moduleId = String(notice?.moduleId || notice?.module_id || '').trim()
  const audience = String(notice?.audience || '').trim().toLowerCase()
  if (audience && audience !== 'business') return null
  if (!moduleId) return null

  const createdAt = String(notice?.createdAt || notice?.created_at || '').trim() || new Date().toISOString()
  return {
    id: String(notice?.id || `business-rbac-${moduleId}`).trim(),
    title: String(notice?.title || 'Access update').trim(),
    message: String(notice?.message || '').trim(),
    tone: 'warning',
    section: String(notice?.section || moduleId).trim() || moduleId,
    effectiveAtValue: Date.parse(String(notice?.effectiveAt || notice?.effective_at || '').trim()) || 0,
    createdAt,
    createdAtLabel: formatBusinessNotificationTime(new Date(createdAt)),
  }
}

const pushBusinessNotification = ({ title = '', message = '', tone = 'info' } = {}) => {
  const normalizedTitle = String(title || '').trim()
  const normalizedMessage = String(message || '').trim()
  if (!normalizedTitle && !normalizedMessage) return

  const createdAt = new Date()
  businessNotificationSequence += 1
  businessNotifications.value = [
    {
      id: `business-notification-${businessNotificationSequence}`,
      title: normalizedTitle || 'Notification',
      message: normalizedMessage,
      tone: String(tone || 'info').trim().toLowerCase(),
      createdAt: createdAt.toISOString(),
      createdAtLabel: formatBusinessNotificationTime(createdAt),
    },
    ...businessNotifications.value,
  ].slice(0, 8)
}

const businessSystemNotifications = computed(() =>
  (Array.isArray(authUser.value?.admin_module_access_notices)
    ? authUser.value.admin_module_access_notices
    : Array.isArray(authUser.value?.adminModuleAccessNotices)
      ? authUser.value.adminModuleAccessNotices
      : [])
    .map((notice) => normalizeBusinessSystemNotice(notice))
    .filter(Boolean),
)

const businessNavbarNotifications = computed(() =>
  [...businessNotifications.value, ...businessSystemNotifications.value]
    .sort((left, right) => Date.parse(right?.createdAt || '') - Date.parse(left?.createdAt || ''))
    .slice(0, 8)
    .map((notification) => ({
    ...notification,
    createdAt: String(notification?.createdAt || '').trim() || new Date().toISOString(),
    read: seenBusinessNotificationIds.value.includes(String(notification?.id || '').trim()),
  })),
)

const unreadBusinessNotificationCount = computed(() =>
  businessNavbarNotifications.value.filter((notification) => notification.read !== true).length,
)

const businessNavbarSettingsItems = [
  { label: 'Personalization', icon: 'bi bi-sliders2' },
  { label: 'Help Center', icon: 'bi bi-life-preserver' },
  { label: 'Terms & Policies', icon: 'bi bi-file-earmark-text' },
  { label: 'Upgrade Plan', icon: 'bi bi-stars' },
]

const markBusinessNotificationsAsRead = (notifications = businessNavbarNotifications.value) => {
  const notificationIds = (Array.isArray(notifications) ? notifications : [])
    .map((notification) => String(notification?.id || '').trim())
    .filter(Boolean)

  if (!notificationIds.length) return

  seenBusinessNotificationIds.value = [...new Set([...seenBusinessNotificationIds.value, ...notificationIds])]
  persistSeenBusinessNotificationIds()
}

const toggleNotificationMenu = () => {
  isNotificationMenuOpen.value = !isNotificationMenuOpen.value
  if (isNotificationMenuOpen.value) {
    markBusinessNotificationsAsRead()
    isProfileMenuOpen.value = false
  }
}

const openBusinessNotification = (notificationId) => {
  const targetId = String(notificationId || '').trim()
  markBusinessNotificationsAsRead(
    businessNavbarNotifications.value.filter((notification) => !targetId || notification.id === targetId),
  )
  const matchedNotification = businessNavbarNotifications.value.find((notification) => notification.id === targetId)
  if (matchedNotification?.section && availableSidebarSectionIds.value.includes(matchedNotification.section)) {
    activeSection.value = matchedNotification.section
  }
  isNotificationMenuOpen.value = false
}

const handleBusinessNavbarSetting = (label) => {
  const normalizedLabel = String(label || '').trim().toLowerCase()

  if (normalizedLabel === 'personalization') {
    openPersonalization()
    return
  }

  if (normalizedLabel === 'help center') {
    openHelpCenterModal()
    return
  }

  if (normalizedLabel === 'terms & policies') {
    openSupportPage('/support/terms-of-use')
    return
  }

  if (normalizedLabel === 'upgrade plan') {
    openUpgradePlan()
  }
}

const clearAccessNoticeTimeout = () => {
  if (accessNoticeTimeoutId !== null) {
    clearTimeout(accessNoticeTimeoutId)
    accessNoticeTimeoutId = null
  }
}

const closeAccessNotice = () => {
  clearAccessNoticeTimeout()
  accessNotice.value = {
    visible: false,
    title: '',
    message: '',
  }
}

const showAccessNotice = (message, title = 'RBAC Updated') => {
  clearAccessNoticeTimeout()
  accessNotice.value = {
    visible: true,
    title: String(title || 'RBAC Updated').trim(),
    message: String(message || '').trim(),
  }
  pushBusinessNotification({
    title,
    message,
    tone: 'warning',
  })
  accessNoticeTimeoutId = setTimeout(() => {
    closeAccessNotice()
  }, 5200)
}

const readAdminPlanCatalog = () => {
  try {
    const rawCatalog = JSON.parse(localStorage.getItem(ADMIN_PLAN_CATALOG_STORAGE_KEY) || '[]')
    return Array.isArray(rawCatalog) ? rawCatalog.map((plan) => normalizePlanRecord(plan)) : []
  } catch {
    return []
  }
}

const restoreAdminPlanCatalog = () => {
  adminPlanCatalog.value = readAdminPlanCatalog()
}

const sidebarGroups = computed(() => {
  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'bi bi-grid-1x2-fill',
      items: [
        { id: 'dashboard', label: 'Dashboard' },
      ],
    },
    {
      id: 'recruitment',
      label: 'Recruitment',
      icon: 'bi bi-briefcase-fill',
      items: [
        {
          id: 'job-posting',
          label: 'Job Posting',
        },
        {
          id: 'applicant-management',
          label: 'Applicant Management',
        },
      ],
    },
    {
      id: 'assessment',
      label: 'Assessment Management',
      icon: 'bi bi-ui-checks-grid',
      items: [
        {
          id: 'assessment-management',
          label: 'Create Assesment ',
        },
        {
          id: 'applicant-score',
          label: 'Applicant Score',
        },
      ],
    },
    {
      id: 'interview',
      label: 'Interview Management',
      icon: 'bi bi-calendar-event-fill',
      items: [
        {
          id: 'interview-scheduling',
          label: 'Interview Scheduling',
        },
      ],
    },
    {
      id: 'training',
      label: 'Training Management',
      icon: 'bi bi-journal-richtext',
      items: [
        {
          id: 'training-templates',
          label: 'Training Templates',
        },
      ],
    },
    {
      id: 'employees',
      label: 'Team Members',
      icon: 'bi bi-people-fill',
      items: [
        {
          id: 'user-overview',
          label: 'User Overview',
        },
        {
          id: 'create-user',
          label: 'Create User',
        },
        {
          id: 'add-employee',
          label: 'Add Employee',
        },
        {
          id: 'permissions',
          label: 'Permissions',
        },
      ],
    },
   
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.id === 'training-templates'
          ? canViewTrainingWorkspace.value
          : canViewBusinessModule(item.id),
      ),
    }))
    .filter((group) => group.items.length)
})

const currentSidebarGroup = computed(() => {
  if (activeSection.value === 'profile') {
    return { id: 'profile', label: 'Edit Profile', items: [] }
  }

  if (activeSection.value === 'subscriptions') {
    return { id: 'subscriptions', label: 'Settings', items: [] }
  }

  return sidebarGroups.value.find((group) => group.id === activeSidebarGroup.value) || sidebarGroups.value[0]
})

const currentSidebarItems = computed(() => currentSidebarGroup.value?.items || [])
const lastVisibleSidebarItems = ref([])
const resolvePersistedBusinessSection = (value) => {
  const normalizedValue = String(value || '').trim()

  if (normalizedValue === 'assign-templates') return 'training-templates'
  if (!normalizedValue) return 'dashboard'

  const availableSectionIds = new Set([
    'dashboard',
    'profile',
    'subscriptions',
    ...premiumNavigationItems.map((item) => item.id),
  ])

  return availableSectionIds.has(normalizedValue) ? normalizedValue : 'dashboard'
}

const resolvePersistedBusinessSubscriptionView = (value) => {
  const normalizedValue = String(value || '').trim()
  return ['plans', 'payment', 'history'].includes(normalizedValue) ? normalizedValue : 'plans'
}

const parsePersistedBusinessSubscriptionDate = (value) => {
  if (!value) return null

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const resolveLatestBusinessSubscriptionDate = (...values) => {
  const parsedDates = values
    .map((value) => parsePersistedBusinessSubscriptionDate(value))
    .filter((value) => value)
    .sort((left, right) => right.getTime() - left.getTime())

  return parsedDates[0] || null
}

const parseBusinessPaymentHistoryActivationDate = (entry = {}) => {
  const createdAt = parsePersistedBusinessSubscriptionDate(entry?.createdAt)
  if (createdAt) return createdAt

  const combinedDateTime = parsePersistedBusinessSubscriptionDate(
    `${String(entry?.date || '').trim()} ${String(entry?.time || '').trim()}`.trim(),
  )
  if (combinedDateTime) return combinedDateTime

  return parsePersistedBusinessSubscriptionDate(entry?.date)
}

const isBusinessTrialHistoryEntry = (entry = {}) => {
  const plan = String(entry?.plan || '').trim().toLowerCase()
  const status = String(entry?.status || '').trim().toLowerCase()
  const billingNote = String(entry?.billingNote || '').trim().toLowerCase()

  return (
    plan.includes('trial')
    || status.includes('trial')
    || billingNote.includes('trial')
  )
}

const resolveHistoryBackedBusinessFreeTrialConsumedDate = () => {
  const latestTrialEntry = paymentHistoryEntries.value
    .filter((entry) => isPaymentHistoryOwnedByCurrentBusiness(entry))
    .map((entry) => ({
      entry,
      activatedAt: parseBusinessPaymentHistoryActivationDate(entry),
    }))
    .filter(({ activatedAt, entry }) => activatedAt && isBusinessTrialHistoryEntry(entry))
    .sort((left, right) => right.activatedAt.getTime() - left.activatedAt.getTime())[0]

  return latestTrialEntry?.activatedAt || null
}

const resolvedBusinessFreeTrialConsumedAt = computed(() => {
  const historyBackedDate = resolveHistoryBackedBusinessFreeTrialConsumedDate()

  return resolveLatestBusinessSubscriptionDate(
    premiumTrialConsumedAt.value,
    premiumTrialStartedAt.value,
    authUser.value?.premium_trial_consumed_at,
    authUser.value?.premiumTrialConsumedAt,
    authUser.value?.premium_trial_started_at,
    authUser.value?.premiumTrialStartedAt,
    historyBackedDate ? historyBackedDate.toISOString() : '',
  )
})

const hasConsumedBusinessFreeTrial = computed(() => Boolean(resolvedBusinessFreeTrialConsumedAt.value))

const resolveAvailableBusinessCheckoutPlanId = (planId = '') => {
  const normalizedPlanId = String(planId || '').trim().toLowerCase()
  const isCurrentTrialActive = activeSubscriptionPlan.value === 'premium' && activeSubscriptionMode.value === 'trial'

  if (normalizedPlanId === 'premium') return 'premium'
  if (normalizedPlanId === 'free-trial' && (!hasConsumedBusinessFreeTrial.value || isCurrentTrialActive)) {
    return 'free-trial'
  }

  return hasConsumedBusinessFreeTrial.value && !isCurrentTrialActive ? 'premium' : 'free-trial'
}

const resolveStoredBusinessFreeTrialConsumedDate = (state = null) =>
  resolveLatestBusinessSubscriptionDate(
    state?.premiumTrialConsumedAt,
    state?.premium_trial_consumed_at,
    state?.premiumTrialStartedAt,
    state?.premium_trial_started_at,
  )

const restoreBusinessWorkspaceViewState = (state = {}) => {
  const nextSection = resolvePersistedBusinessSection(state?.activeSection)
  const shouldReturnToWorkspaceLanding = nextSection === 'subscriptions'
    && hasActiveBusinessSubscriptionState()
    && !hasManagedBusinessSecurityQuery(route.query)

  activeSection.value = shouldReturnToWorkspaceLanding ? resolveFirstAvailableBusinessSection() : nextSection
  if (['profile', 'subscriptions'].includes(activeSection.value)) {
    activeSidebarGroup.value = 'dashboard'
  } else if (availableSidebarSectionIds.value.includes(activeSection.value)) {
    activeSidebarGroup.value = sidebarGroups.value.find((group) =>
      group.items.some((item) => item.id === activeSection.value))?.id || activeSidebarGroup.value
  } else {
    activeSection.value = resolveFirstAvailableBusinessSection()
  }
  subscriptionView.value = resolvePersistedBusinessSubscriptionView(state?.subscriptionView)
}

const hasUnlockedBusinessWorkspace = computed(() => Boolean(authUser.value))
const showBusinessSidebar = computed(() => true)
const availableSidebarSectionIds = computed(() =>
  sidebarGroups.value.flatMap((group) => group.items.map((item) => item.id)),
)
const resolveFirstAvailableBusinessSection = () =>
  availableSidebarSectionIds.value[0] || 'subscriptions'

const getSidebarItemIcon = (itemId = '') =>
  premiumNavigationItems.find((item) => item.id === itemId)?.icon
  || ({
    'job-posting': 'bi bi-megaphone-fill',
    'applicant-management': 'bi bi-people-fill',
    'user-overview': 'bi bi-people',
    'create-user': 'bi bi-person-plus-fill',
    'add-employee': 'bi bi-person-vcard-fill',
    permissions: 'bi bi-shield-lock-fill',
    dashboard: 'bi bi-grid-1x2-fill',
  }[String(itemId || '').trim()] || 'bi bi-dot')

const setSidebarLinkRef = (id, element) => {
  if (element) {
    sidebarLinkRefs.value[id] = element
    return
  }

  delete sidebarLinkRefs.value[id]
}

const setJobPostUnlimitedHighlightRef = (element) => {
  jobPostUnlimitedHighlightRef.value = element || null
}

const businessName = computed(() =>
  authUser.value?.company_name || authUser.value?.name || 'Business Workspace',
)
const businessEmail = computed(() =>
  authUser.value?.business_contact_email || authUser.value?.email || 'business@workspace.local',
)
const businessCategory = computed(() => authUser.value?.company_category || 'Wholesale / Distribution')
const businessLocation = computed(() => authUser.value?.company_location || 'Dasmarinas, Cavite')
const businessInitials = computed(() => {
  const parts = businessName.value.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'BW'
})
const businessAvatar = computed(() =>
  authUser.value?.business_avatar
  || authUser.value?.avatar
  || authUser.value?.profile_image
  || '',
)
const selectedPaymentPhoneCountry = computed(() =>
  PHONE_COUNTRIES.find((country) => country.code === paymentContactCountryCode.value) || PHONE_COUNTRIES[0],
)

const staticBusinessSectionContent = {
  'job-posting': {
    title: 'Job Posting',
    description: 'Create live job openings, publish them to the public landing page, and review your current business listings in one place.',
    cards: [
      { title: 'Create New Listing', copy: 'Prepare a new opening with role details, setup, and qualification notes.' },
      { title: 'Manage Active Posts', copy: 'Review running vacancies and keep your listings updated for applicants.' },
      { title: 'Post Performance', copy: 'Track how your business posts are performing and what needs attention next.' },
    ],
  },
  'applicant-management': {
    title: 'Applicant Management',
    description: 'Review applicants, keep your shortlist clean, and move candidates forward using static mock hiring data for now.',
    cards: [
      { title: 'New Applicants', copy: 'Open the newest candidate submissions and review their fit for your roles.' },
      { title: 'Shortlist Queue', copy: 'Keep promising applicants organized so the next steps are easier to manage.' },
      { title: 'Interview Tracking', copy: 'Monitor who is ready for interview and what follow-up is still pending.' },
    ],
  },
  'assessment-management': {
    title: 'Assessment Management',
    description: 'Organize role-based assessments, keep reusable screening flows ready, and manage mock evaluation content in one place.',
    cards: [
      { title: 'Assessment Library', copy: 'Keep reusable screening templates ready for different job openings and hiring stages.' },
      { title: 'Draft Reviews', copy: 'Track assessments that still need updates before they are assigned to applicants.' },
      { title: 'Stage Mapping', copy: 'Decide where each assessment belongs in the recruitment flow before interviews begin.' },
    ],
  },
  'applicant-score': {
    title: 'Applicant Score',
    description: 'Review mock applicant scores, compare ranked candidates, and keep score-based decisions visible while backend scoring is still static.',
    cards: [
      { title: 'Score Overview', copy: 'Use placeholder scoring bands to see which applicants are closest to the next hiring step.' },
      { title: 'Category Breakdown', copy: 'Compare mock scores for technical fit, communication, and training readiness in one summary.' },
      { title: 'Decision Queue', copy: 'Keep high-scoring candidates grouped together so follow-up actions stay organized.' },
    ],
  },
  'interview-scheduling': {
    title: 'Interview Scheduling',
    description: 'Plan interview slots, track assigned interviewers, and manage upcoming sessions with static scheduling data for now.',
    cards: [
      { title: 'Upcoming Slots', copy: 'See the interview windows that are currently open before sending invitations to applicants.' },
      { title: 'Assigned Panel', copy: 'Track who from the hiring team is handling each interview session.' },
      { title: 'Reschedule Queue', copy: 'Keep moved or missed interviews together so follow-up is easier to manage.' },
    ],
  },
  'training-templates': {
    title: 'Training Templates',
    description: 'Prepare reusable onboarding and skills templates that can be assigned later once the live training flow is connected.',
    cards: [
      { title: 'Reusable Modules', copy: 'Prepare starter training templates you can reuse across roles and departments.' },
      { title: 'Assigned Learning', copy: 'Organize which templates should be assigned to the right people at the right time.' },
      { title: 'Template Library', copy: 'Keep your training content ready to launch once the dynamic workflow is wired up.' },
    ],
  },
  'assign-templates': {
    title: 'Assign Templates',
    description: 'Match training templates to applicants or employees with a simple static workflow until assignment actions are connected.',
    cards: [
      { title: 'Assignment Queue', copy: 'Keep a visible list of people who are ready to receive onboarding or upskilling templates.' },
      { title: 'Template Matching', copy: 'Pair each role with the most relevant training template before rollout starts.' },
      { title: 'Completion Review', copy: 'Track who has been assigned content and what still needs follow-up.' },
    ],
  },
  employees: {
    title: 'User Management',
    description: 'Review employee records, onboarding progress, and workspace access using static employee data for now.',
    cards: [
      { title: 'Employee Directory', copy: 'Keep your current team list visible with quick access to role and department details.' },
      { title: 'Onboarding Status', copy: 'Track which employees still need templates, interviews, or permissions updates.' },
      { title: 'Workspace Access', copy: 'Review who should be able to manage recruitment, assessments, and training tools.' },
    ],
  },
  permissions: {
    title: 'Permissions',
    description: 'Control access to recruitment, assessment, interview, training, and employee tools with static permission data for now.',
    cards: [
      { title: 'Role Access', copy: 'Keep recruiter, interviewer, and admin access clearly separated inside the business workspace.' },
      { title: 'View Rules', copy: 'Use View access to make a module visible in the sidebar and openable by that role.' },
      { title: 'Edit Review', copy: 'Check who can create or update records before saving your role changes.' },
    ],
  },
}

const currentSection = computed(() => {
  if (activeSection.value === 'profile') {
    return {
      title: 'Edit Profile',
      description: 'Update your business account details, company information, and workspace contact data.',
      cards: [],
    }
  }

  if (activeSection.value === 'subscriptions') {
    return {
      title: 'Subscriptions',
      description: 'Review your current pricing, start a free trial with saved billing, or activate premium immediately.',
      cards: [],
    }
  }

  if (staticBusinessSectionContent[activeSection.value]) {
    return staticBusinessSectionContent[activeSection.value]
  }

  return {
    title: 'Dashboard',
    description: 'Welcome to your business workspace with a simpler sidebar, top navbar, and cleaner light theme.',
    cards: [
      { title: 'Business Workspace', copy: 'Use this dashboard as your main business control center for hiring activity.' },
      { title: 'Quick Overview', copy: 'See job posts, applicant activity, and account actions from one place.' },
      { title: 'Clean Layout', copy: 'This updated business page removes the old plan-focused view and keeps the theme consistent.' },
    ],
  }
})

const summaryCards = computed(() => {
  const linkedActiveMembers = employeeDirectory.value.filter((employee) => employee.status === 'Active').length
  const totalWorkspaceMembers = workspaceUserDirectory.value.length
  const activeMembers = Math.max(linkedActiveMembers, totalWorkspaceMembers)
  const totalApplicants = businessJobApplications.value.length
  const reviewApplicants = businessJobApplications.value.filter((application) =>
    ['reviewing', 'under review', 'in_review'].includes(normalizeUserOverviewValue(application?.status)),
  ).length

  return [
    {
      label: 'Posted Jobs',
      value: String(postedJobs.value.length),
      subtitle: `${postedJobsSummary.value.openCount} open listings in the workspace`,
      icon: 'bi bi-briefcase',
      tone: 'emerald',
    },
    {
      label: 'Applicants',
      value: String(totalApplicants),
      subtitle: totalApplicants
        ? `${reviewApplicants} applicants currently under review in this workspace`
        : 'No applicant submissions have arrived in this workspace yet',
      icon: 'bi bi-people',
      tone: 'sky',
    },
    {
      label: 'Team Members',
      value: String(totalWorkspaceMembers),
      subtitle: totalWorkspaceMembers
        ? `${activeMembers} synced members connected to this business workspace`
        : 'No synced team members in this business workspace yet',
      icon: 'bi bi-person-badge',
      tone: 'amber',
    },
    {
      label: 'Workspace Access',
      value: 'Active',
      subtitle: 'Business tools and workspace pages are ready to use.',
      icon: 'bi bi-stars',
      tone: 'violet',
    },
  ]
})

const dashboardTrendMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const clampDashboardPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
const formatDashboardPercent = (value) => `${clampDashboardPercent(value)}%`
const countDashboardRecordsByMonth = (records = [], dateKeys = []) => {
  const currentYear = new Date().getFullYear()
  const monthlyCounts = Array.from({ length: 12 }, () => 0)

  records.forEach((record) => {
    const resolvedKey = dateKeys.find((key) => String(record?.[key] || '').trim())
    const rawValue = resolvedKey ? record?.[resolvedKey] : ''
    const parsedDate = new Date(String(rawValue || ''))
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() !== currentYear) return
    monthlyCounts[parsedDate.getMonth()] += 1
  })

  return monthlyCounts
}
const buildDashboardSmoothLinePath = (points = []) => {
  if (!Array.isArray(points) || !points.length) return ''
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const currentPoint = points[index]
    const nextPoint = points[index + 1]
    const controlX = currentPoint.x + ((nextPoint.x - currentPoint.x) / 2)
    path += ` C ${controlX.toFixed(2)} ${currentPoint.y.toFixed(2)}, ${controlX.toFixed(2)} ${nextPoint.y.toFixed(2)}, ${nextPoint.x.toFixed(2)} ${nextPoint.y.toFixed(2)}`
  }

  return path
}
const buildDashboardAreaPath = (points = [], chartHeight = 0) => {
  if (!points.length || chartHeight <= 0) return ''
  const linePath = buildDashboardSmoothLinePath(points)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  return `${linePath} L ${lastPoint.x.toFixed(2)} ${chartHeight.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${chartHeight.toFixed(2)} Z`
}
const calculateDashboardGrowth = (current, previous) => {
  const safeCurrent = Number(current) || 0
  const safePrevious = Number(previous) || 0
  if (safePrevious <= 0) {
    return {
      value: safeCurrent > 0 ? 100 : 0,
      isNew: safeCurrent > 0,
      trend: safeCurrent > 0 ? 'up' : 'steady',
    }
  }

  const value = Math.round(((safeCurrent - safePrevious) / safePrevious) * 100)
  return {
    value,
    isNew: false,
    trend: value > 0 ? 'up' : value < 0 ? 'down' : 'steady',
  }
}
const formatDashboardGrowthLabel = (growth) => {
  if (growth.isNew) return 'New activity'
  if (growth.value > 0) return `+${growth.value}%`
  if (growth.value < 0) return `${growth.value}%`
  return 'No change'
}
const dashboardJobTrendSeries = computed(() =>
  countDashboardRecordsByMonth(postedJobs.value, ['createdAt', 'updatedAt']),
)
const dashboardApplicantTrendSeries = computed(() =>
  countDashboardRecordsByMonth(businessJobApplications.value, ['appliedAt', 'createdAt', 'submittedAt']),
)
const businessTrendChart = computed(() => {
  const currentYear = new Date().getFullYear()
  const currentMonthIndex = new Date().getMonth()
  const months = dashboardTrendMonths.map((label, index) => {
    const jobs = dashboardJobTrendSeries.value[index] || 0
    const applicants = dashboardApplicantTrendSeries.value[index] || 0
    return {
      key: `${currentYear}-${String(index + 1).padStart(2, '0')}`,
      label,
      jobs,
      applicants,
      total: jobs + applicants,
    }
  })

  const chartWidth = 600
  const chartHeight = 188
  const maxValue = Math.max(1, ...months.map((month) => Math.max(month.jobs, month.applicants)))
  const stepX = months.length > 1 ? chartWidth / (months.length - 1) : chartWidth
  const toY = (value) => chartHeight - ((value / maxValue) * (chartHeight - 36) + 18)

  const jobPoints = months.map((month, index) => ({
    x: index * stepX,
    y: toY(month.jobs),
    value: month.jobs,
    label: month.label,
    isCurrent: index === currentMonthIndex,
  }))
  const applicantPoints = months.map((month, index) => ({
    x: index * stepX,
    y: toY(month.applicants),
    value: month.applicants,
    label: month.label,
    isCurrent: index === currentMonthIndex,
  }))

  const currentMonth = months[currentMonthIndex] || months[months.length - 1] || {
    label: 'This month',
    jobs: 0,
    applicants: 0,
    total: 0,
  }
  const previousMonth = months[Math.max(currentMonthIndex - 1, 0)] || currentMonth
  const jobGrowth = calculateDashboardGrowth(currentMonth.jobs, previousMonth.jobs)
  const applicantGrowth = calculateDashboardGrowth(currentMonth.applicants, previousMonth.applicants)
  const totalGrowth = calculateDashboardGrowth(currentMonth.total, previousMonth.total)
  const peakMonth = months.reduce((peak, month) => (month.total > peak.total ? month : peak), months[0] || {
    label: 'Jan',
    jobs: 0,
    applicants: 0,
    total: 0,
  })

  return {
    months,
    chartWidth,
    chartHeight,
    jobPath: buildDashboardSmoothLinePath(jobPoints),
    applicantPath: buildDashboardSmoothLinePath(applicantPoints),
    jobAreaPath: buildDashboardAreaPath(jobPoints, chartHeight),
    jobPoints,
    applicantPoints,
    totalJobs: months.reduce((sum, month) => sum + month.jobs, 0),
    totalApplicants: months.reduce((sum, month) => sum + month.applicants, 0),
    callout: {
      label: currentMonth.label,
      value: currentMonth.total,
      copy: `${currentMonth.jobs} jobs and ${currentMonth.applicants} applicants this month`,
    },
    highlightCards: [
      {
        label: 'Jobs This Month',
        value: String(currentMonth.jobs),
        detail: `${formatDashboardGrowthLabel(jobGrowth)} vs ${previousMonth.label}`,
        trend: jobGrowth.trend,
        tone: 'jobs',
      },
      {
        label: 'Applicants This Month',
        value: String(currentMonth.applicants),
        detail: `${formatDashboardGrowthLabel(applicantGrowth)} vs ${previousMonth.label}`,
        trend: applicantGrowth.trend,
        tone: 'applicants',
      },
      {
        label: 'Workspace Momentum',
        value: String(currentMonth.total),
        detail: `${formatDashboardGrowthLabel(totalGrowth)} with peak in ${peakMonth.label}`,
        trend: totalGrowth.trend,
        tone: 'momentum',
      },
    ],
  }
})
const dashboardInterviewReadyCount = computed(() =>
  businessJobApplications.value.filter((item) =>
    normalizeUserOverviewValue(item?.status).includes('interview'),
  ).length,
)
const dashboardApplicantsUnderReviewCount = computed(() =>
  businessJobApplications.value.filter((item) =>
    ['reviewing', 'under review', 'in_review'].includes(normalizeUserOverviewValue(item?.status)),
  ).length,
)
const dashboardPendingApplicantCount = computed(() =>
  businessJobApplications.value.filter((item) => {
    const normalizedStatus = normalizeUserOverviewValue(item?.status || 'applied')
    return ['applied', 'pending', 'reviewing', 'under review', 'in_review'].includes(normalizedStatus)
  }).length,
)
const dashboardAssignedAssessmentCount = computed(() =>
  approvedApplicantTemplateAssignments.value.filter((applicant) =>
    normalizeUserOverviewValue(applicant?.assignmentStatus) === 'assigned',
  ).length,
)
const dashboardAssignedTrainingCount = computed(() =>
  trainingTemplateAssignments.value.filter((member) =>
    normalizeUserOverviewValue(member?.assignmentStatus) === 'assigned',
  ).length,
)
const dashboardHiringCyclePercent = computed(() => {
  const totalApplicants = businessJobApplications.value.length
  if (!totalApplicants) return 0
  const progressedApplicants = dashboardApplicantsUnderReviewCount.value + dashboardInterviewReadyCount.value
  return (progressedApplicants / totalApplicants) * 100
})
const dashboardInterviewRatePercent = computed(() => {
  const totalApplicants = businessJobApplications.value.length
  if (!totalApplicants) return 0
  return (dashboardInterviewReadyCount.value / totalApplicants) * 100
})
const dashboardWorkspaceHealthPercent = computed(() => {
  const checkpointCount = 5
  const completedCheckpoints = [
    postedJobs.value.length > 0,
    businessJobApplications.value.length > 0,
    workspaceUserDirectory.value.length > 0,
    assessmentTemplateLibrary.value.length > 0 || trainingTemplateLibrary.value.length > 0,
    hasUnlockedBusinessWorkspace.value,
  ].filter(Boolean).length

  return (completedCheckpoints / checkpointCount) * 100
})
const dashboardProgressCards = computed(() => [
  {
    label: 'Hiring Cycle',
    value: formatDashboardPercent(dashboardHiringCyclePercent.value),
    copy: `${dashboardApplicantsUnderReviewCount.value + dashboardInterviewReadyCount.value} of ${businessJobApplications.value.length} applicants are already moving through screening.`,
  },
  {
    label: 'Interview Rate',
    value: formatDashboardPercent(dashboardInterviewRatePercent.value),
    copy: `${dashboardInterviewReadyCount.value} applicants are already interview-ready in this workspace.`,
  },
  {
    label: 'Workspace Health',
    value: formatDashboardPercent(dashboardWorkspaceHealthPercent.value),
    copy: `${workspaceUserDirectory.value.length} members, ${postedJobs.value.length} jobs, and ${businessJobApplications.value.length} applications are synced live.`,
  },
])
const dashboardBarSeries = computed(() => {
  const totalApplicants = businessJobApplications.value.length
  const totalJobs = postedJobs.value.length
  const openJobs = postedJobsSummary.value.openCount
  const reviewCount = dashboardApplicantsUnderReviewCount.value
  const interviewCount = dashboardInterviewReadyCount.value
  const assignedAssessmentCount = dashboardAssignedAssessmentCount.value
  const assignedTrainingCount = dashboardAssignedTrainingCount.value

  return [
    {
      label: 'Job Post',
      value: formatDashboardPercent(totalJobs ? (openJobs / totalJobs) * 100 : 0),
      width: `${clampDashboardPercent(totalJobs ? (openJobs / totalJobs) * 100 : 0)}%`,
    },
    {
      label: 'Screening',
      value: formatDashboardPercent(totalApplicants ? (reviewCount / totalApplicants) * 100 : 0),
      width: `${clampDashboardPercent(totalApplicants ? (reviewCount / totalApplicants) * 100 : 0)}%`,
    },
    {
      label: 'Interview',
      value: formatDashboardPercent(totalApplicants ? (interviewCount / totalApplicants) * 100 : 0),
      width: `${clampDashboardPercent(totalApplicants ? (interviewCount / totalApplicants) * 100 : 0)}%`,
    },
    {
      label: 'Assessment',
      value: formatDashboardPercent(totalApplicants ? (assignedAssessmentCount / totalApplicants) * 100 : 0),
      width: `${clampDashboardPercent(totalApplicants ? (assignedAssessmentCount / totalApplicants) * 100 : 0)}%`,
    },
    {
      label: 'Training',
      value: formatDashboardPercent(workspaceUserDirectory.value.length ? (assignedTrainingCount / workspaceUserDirectory.value.length) * 100 : 0),
      width: `${clampDashboardPercent(workspaceUserDirectory.value.length ? (assignedTrainingCount / workspaceUserDirectory.value.length) * 100 : 0)}%`,
    },
  ]
})
const dashboardDonutLegend = computed(() => {
  const sourceItems = [
    { label: 'Team Members', amount: workspaceUserDirectory.value.length, color: '#ef5da8' },
    { label: 'Posted Jobs', amount: postedJobs.value.length, color: '#198754' },
    { label: 'Pending', amount: dashboardPendingApplicantCount.value, color: '#f59e0b' },
    { label: 'Applicant Total', amount: businessJobApplications.value.length, color: '#29b4ff' },
  ]
  const totalAmount = sourceItems.reduce((sum, item) => sum + item.amount, 0)

  return sourceItems.map((item) => ({
    ...item,
    value: formatDashboardPercent(totalAmount ? (item.amount / totalAmount) * 100 : 0),
  }))
})
const dashboardDonutTotal = computed(() =>
  dashboardDonutLegend.value.reduce((sum, item) => sum + item.amount, 0),
)
const dashboardDonutStyle = computed(() => {
  const totalAmount = dashboardDonutTotal.value
  if (!totalAmount) {
    return {
      background: 'conic-gradient(#dbe5dd 0 100%)',
    }
  }

  let startPercent = 0
  const segments = dashboardDonutLegend.value.map((item, index) => {
    const percentage = totalAmount ? ((item.amount / totalAmount) * 100) : 0
    const endPercent = index === dashboardDonutLegend.value.length - 1 ? 100 : startPercent + percentage
    const segment = `${item.color} ${startPercent.toFixed(2)}% ${endPercent.toFixed(2)}%`
    startPercent = endPercent
    return segment
  })

  return {
    background: `conic-gradient(${segments.join(', ')})`,
  }
})

const JOB_POSTING_BARANGAYS = [
  'Burol I',
  'Burol II',
  'Burol III',
  'Burol Main',
  'Datu Esmael',
  'Emmanuel Bergado I',
  'Emmanuel Bergado II',
  'Fatima I',
  'Fatima II',
  'Fatima III',
  'H-2',
  'Langkaan I',
  'Langkaan II',
  'Luzviminda I',
  'Luzviminda II',
  'Paliparan I',
  'Paliparan II',
  'Paliparan III',
  'Salawag',
  'Salitran I',
  'Salitran II',
  'Salitran III',
  'Salitran IV',
  'Sampaloc I',
  'Sampaloc II',
  'Sampaloc III',
  'Sampaloc IV',
  'San Agustin I',
  'San Agustin II',
  'San Agustin III',
  'San Andres I',
  'San Andres II',
  'San Andres III',
  'San Antonio de Padua I',
  'San Antonio de Padua II',
  'San Dionisio',
  'San Esteban',
  'San Francisco I',
  'San Francisco II',
  'San Isidro Labrador I',
  'San Isidro Labrador II',
  'San Isidro Labrador III',
  'San Jose',
  'San Juan',
  'San Lorenzo Ruiz I',
  'San Lorenzo Ruiz II',
  'San Luis I',
  'San Luis II',
  'San Manuel I',
  'San Manuel II',
  'San Mateo',
  'San Miguel',
  'San Nicolas I',
  'San Nicolas II',
  'San Roque',
  'Santa Cristina I',
  'Santa Cristina II',
  'Santa Cruz I',
  'Santa Cruz II',
  'Santa Fe',
  'Santa Lucia',
  'Santa Maria',
  'Santo Cristo',
  'Santo Nino I',
  'Santo Nino II',
  'Victoria Reyes',
  'Zone I',
  'Zone I-A',
  'Zone I-B',
  'Zone II',
  'Zone III',
  'Zone IV',
].map((barangay) => ({
  value: barangay,
  label: barangay,
}))
const JOB_POSTING_EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']
const JOB_POSTING_DISABILITY_TYPES = [
  'Physical Impairment',
  'Visual Impairment',
  'Deaf or Hard of Hearing',
  'Hearing Impairment',
  'Speech and Language Impairment',
  'Intellectual Disability',
  'Psychosocial Disability',
  'Learning Disability',
  'Autism Spectrum Disorder',
  'Chronic Illness / Medical Condition',
  'Multiple Disabilities',
].map((type) => ({
  value: type,
  label: type === 'Chronic Illness / Medical Condition'
    ? 'Chronic Illness or Medical Condition'
    : type,
}))
const JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION = new Set([
  'Physical Impairment',
  'Visual Impairment',
  'Deaf or Hard of Hearing',
  'Hearing Impairment',
  'Speech and Language Impairment',
  'Chronic Illness / Medical Condition',
  'Multiple Disabilities',
])
const JOB_POSTING_LANGUAGE_OPTIONS = [
  { value: 'English', label: 'English' },
  { value: 'Filipino', label: 'Filipino' },
  { value: 'English, Filipino', label: 'English and Filipino' },
  { value: 'Filipino, English, Taglish', label: 'Filipino, English, and Taglish' },
]
const JOB_POSTING_MAX_VACANCIES = 500
const createJobPostingDraft = () => ({
  title: '',
  description: '',
  category: '',
  type: '',
  location: 'Dasmarinas City',
  barangay: '',
  vacancies: '',
  salaryRange: '',
  disabilityType: '',
  impairmentSpecification: '',
  preferredAgeRange: '',
  language: '',
  qualifications: '',
  responsibilities: '',
  status: 'open',
})
const jobPostingTab = ref('create')
const jobPostingDraft = ref(createJobPostingDraft())
const jobPostingOpenDropdown = ref('')
const jobPostingTypeDropdownRef = ref(null)
const jobPostingBarangayDropdownRef = ref(null)
const jobPostingDisabilityDropdownRef = ref(null)
const jobPostingLanguageDropdownRef = ref(null)
const editingJobPostId = ref('')
const openJobPostActionMenuId = ref('')
const jobPostPendingAction = ref({
  jobId: '',
  action: '',
})
const jobPostingCompanyNameDisplay = computed(() =>
  String(profileForm.value.companyName || businessName.value || '').trim(),
)
const jobPostingPreviewStatusLabel = computed(() => normalizePostedJobStatus(jobPostingDraft.value.status))
const jobPostingCreatedPreview = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
}).format(new Date())
const jobPostingQualificationsPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.qualifications))
const jobPostingResponsibilitiesPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.responsibilities))
const jobPostingDisabilityTypeNeedsSpecification = computed(() =>
  JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(jobPostingDraft.value.disabilityType || '').trim()),
)
const jobPostingTypeLabel = computed(() =>
  String(jobPostingDraft.value.type || '').trim() || 'Select job type',
)
const jobPostingBarangayLabel = computed(() =>
  JOB_POSTING_BARANGAYS.find((entry) => entry.value === jobPostingDraft.value.barangay)?.label || 'Select barangay',
)
const jobPostingDisabilityLabel = computed(() =>
  JOB_POSTING_DISABILITY_TYPES.find((entry) => entry.value === jobPostingDraft.value.disabilityType)?.label || 'Select disability type',
)
const jobPostingLanguageLabel = computed(() =>
  JOB_POSTING_LANGUAGE_OPTIONS.find((entry) => entry.value === jobPostingDraft.value.language)?.label || 'Select language',
)
const jobPostingSalaryPreview = computed(() => {
  const { min: parsedMin, max: parsedMax, label } = parseJobPostingSalaryRange(jobPostingDraft.value.salaryRange)
  if (label) return label
  const min = parsedMin > 0 && parsedMax > 0 ? Math.min(parsedMin, parsedMax) : parsedMin
  const max = parsedMin > 0 && parsedMax > 0 ? Math.max(parsedMin, parsedMax) : parsedMax
  if (min > 0 && max > 0) return `PHP ${min.toLocaleString('en-US')} - PHP ${max.toLocaleString('en-US')}`
  if (min > 0) return `PHP ${min.toLocaleString('en-US')} - Negotiable`
  if (max > 0) return `Negotiable - PHP ${max.toLocaleString('en-US')}`
  return 'Negotiable'
})
const isSavingJobPost = ref(false)
const isPostedJobsLoading = ref(false)
const postedJobsSyncMessage = ref('')
const postedJobs = ref([])
let stopWorkspaceJobsSync = () => {}
const toggleJobPostingDropdown = (dropdownId) => {
  jobPostingOpenDropdown.value = jobPostingOpenDropdown.value === dropdownId ? '' : dropdownId
}
const closeJobPostingDropdown = () => {
  jobPostingOpenDropdown.value = ''
}
const isJobPostingDropdownOpen = (dropdownId) => jobPostingOpenDropdown.value === dropdownId
const selectJobPostingDropdownValue = (key, value) => {
  handleJobPostingFieldChange(key, value)
  closeJobPostingDropdown()
}
const formatPostedJobDateLabel = (value, prefix = 'Posted') => {
  const raw = String(value || '').trim()
  const parsedValue = raw ? Date.parse(raw) : 0
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return `${prefix} recently`

  return `${prefix} ${new Date(parsedValue).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })}`
}
const normalizePostedJobStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'closed') return 'Closed'
  if (normalizedStatus === 'draft') return 'Draft'
  return 'Open'
}
const createPostedJobRecord = (record = {}) => ({
  id: String(record.id || '').trim(),
  title: String(record.title || '').trim() || 'Untitled job post',
  description: String(record.description || '').trim(),
  category: String(record.category || 'General').trim(),
  location: String(
    record.location
    || [record.city, record.barangay].filter((value) => String(value || '').trim()).join(', ')
    || 'Not specified',
  ).trim(),
  city: String(record.city || record.location || 'Dasmarinas City').trim(),
  barangay: String(record.barangay || '').trim(),
  workType: String(record.type || record.setup || 'Open').trim(),
  setup: String(record.setup || record.type || '').trim(),
  vacancies: Math.max(1, Number(record.vacancies || 1) || 1),
  salary: String(record.salary || record.salaryRange || 'Negotiable').trim(),
  salaryRange: String(record.salaryRange || record.salary || 'Negotiable').trim(),
  disabilityType: String(record.disabilityType || '').trim(),
  impairmentSpecification: String(record.impairmentSpecification || '').trim(),
  preferredAgeRange: String(record.preferredAgeRange || '').trim(),
  language: String(record.language || '').trim(),
  qualifications: Array.isArray(record.qualifications) ? record.qualifications.map((item) => String(item || '').trim()).filter(Boolean) : [],
  responsibilities: Array.isArray(record.responsibilities) ? record.responsibilities.map((item) => String(item || '').trim()).filter(Boolean) : [],
  status: normalizePostedJobStatus(record.status),
  createdAt: String(record.createdAt || record.created_at || '').trim(),
  updatedAt: String(record.updatedAt || record.updated_at || '').trim(),
  updated: formatPostedJobDateLabel(record.updatedAt || record.updated_at || record.createdAt || record.created_at, 'Updated'),
  posted: formatPostedJobDateLabel(record.createdAt || record.created_at || record.updatedAt || record.updated_at, 'Posted'),
})
const postedJobsSummary = computed(() => {
  const openCount = postedJobs.value.filter((job) => String(job.status || '').trim().toLowerCase() === 'open').length
  const draftCount = postedJobs.value.filter((job) => String(job.status || '').trim().toLowerCase() === 'draft').length
  const totalVacancies = postedJobs.value.reduce(
    (total, job) => total + (Math.max(1, Number(job.vacancies || 1) || 1)),
    0,
  )

  return {
    openCount,
    draftCount,
    totalVacancies,
  }
})
const normalizeBusinessWorkflowJobLookupValue = (value) =>
  String(value || '').trim().toLowerCase()
const businessPostedJobIds = computed(() =>
  new Set(
    postedJobs.value
      .map((job) => String(job?.id || '').trim())
      .filter(Boolean),
  ),
)
const businessPostedJobTitles = computed(() =>
  new Set(
    postedJobs.value
      .map((job) => normalizeBusinessWorkflowJobLookupValue(job?.title))
      .filter(Boolean),
  ),
)
const isBusinessApplicationLinkedToPostedJob = (application = {}) => {
  const jobId = String(application?.jobId || application?.job_id || '').trim()
  if (jobId) return businessPostedJobIds.value.has(jobId)

  const jobTitle = normalizeBusinessWorkflowJobLookupValue(application?.jobTitle || application?.job_title)
  if (jobTitle) return businessPostedJobTitles.value.has(jobTitle)

  return false
}
const jobPostHighlights = computed(() => [
  {
    label: 'Active Posts',
    value: 'Unlimited',
  },
  { label: 'Live Listings', value: String(postedJobsSummary.value.openCount) },
  { label: 'Total Vacancies', value: String(postedJobsSummary.value.totalVacancies) },
])
const resolvePostedJobStatusClass = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'open') return 'is-open'
  if (normalizedStatus === 'draft') return 'is-draft'
  if (normalizedStatus === 'closed') return 'is-closed'
  return ''
}
const isEditingJobPost = computed(() => Boolean(String(editingJobPostId.value || '').trim()))
const createJobPostingDraftFromRecord = (job = {}) => ({
  title: String(job.title || '').trim(),
  description: String(job.description || '').trim(),
  category: String(job.category || '').trim(),
  type: String(job.workType || '').trim(),
  location: String(job.city || 'Dasmarinas City').trim() || 'Dasmarinas City',
  barangay: String(job.barangay || '').trim(),
  vacancies: String(job.vacancies || ''),
  salaryRange: String(job.salaryRange || job.salary || '').trim(),
  disabilityType: String(job.disabilityType || '').trim(),
  impairmentSpecification: String(job.impairmentSpecification || '').trim(),
  preferredAgeRange: String(job.preferredAgeRange || '').trim(),
  language: String(job.language || '').trim(),
  qualifications: Array.isArray(job.qualifications) ? job.qualifications.join('\n') : '',
  responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : '',
  status: String(job.status || 'Open').trim().toLowerCase() || 'open',
})
const resetJobPostingDraft = () => {
  editingJobPostId.value = ''
  jobPostingDraft.value = createJobPostingDraft()
}
const closeJobPostActionMenu = () => {
  openJobPostActionMenuId.value = ''
}
const toggleJobPostActionMenu = (jobId) => {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId || !canEditBusinessModule('job-posting')) return

  openJobPostActionMenuId.value = openJobPostActionMenuId.value === normalizedJobId ? '' : normalizedJobId
}
const isJobPostActionPending = (jobId, action = '') =>
  jobPostPendingAction.value.jobId === String(jobId || '').trim()
  && (!action || jobPostPendingAction.value.action === action)
const startEditingJobPost = (jobId) => {
  const normalizedJobId = String(jobId || '').trim()
  const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

  if (!selectedJob) {
    showPaymentToast('That job post could not be found.', 'error')
    return
  }

  editingJobPostId.value = normalizedJobId
  jobPostingDraft.value = createJobPostingDraftFromRecord(selectedJob)
  jobPostingTab.value = 'create'
  closeJobPostActionMenu()
}
const cancelJobPostEditing = () => {
  resetJobPostingDraft()
  jobPostingTab.value = 'posted'
}
const updateJobPostStatus = async (jobId, nextStatus) => {
  const normalizedJobId = String(jobId || '').trim()
  const normalizedStatus = String(nextStatus || '').trim().toLowerCase()
  const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

  if (!selectedJob || !normalizedStatus) {
    showPaymentToast('That job post could not be updated right now.', 'error')
    return
  }

  const actionLabel = normalizedStatus === 'closed' ? 'close' : 'open'
  const confirmMessage = normalizedStatus === 'closed'
    ? `Close "${selectedJob.title}"? It will be hidden from the landing page until opened again.`
    : `Open "${selectedJob.title}"? It will appear again on the landing page and public job lists.`
  closeJobPostActionMenu()
  showPaymentConfirmationToast({
    title: normalizedStatus === 'closed' ? 'Close' : 'Open',
    message: confirmMessage,
    confirmLabel: normalizedStatus === 'closed' ? 'Close' : 'Open',
    confirmVariant: normalizedStatus === 'closed' ? 'danger' : 'primary',
    onConfirm: async () => {
      try {
        jobPostPendingAction.value = {
          jobId: normalizedJobId,
          action: actionLabel,
        }
        await updateBusinessJobPost(normalizedJobId, {
          status: normalizedStatus,
          workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
        })

        if (editingJobPostId.value === normalizedJobId) {
          jobPostingDraft.value = {
            ...jobPostingDraft.value,
            status: normalizedStatus,
          }
        }

        showPaymentToast(
          normalizedStatus === 'closed'
            ? 'Job closed. It is now hidden from the public job feed.'
            : 'Job opened. It is visible again on the public job feed.',
          'success',
        )
      } catch (error) {
        showPaymentToast(error instanceof Error ? error.message : 'Unable to update the job post status right now.', 'error')
      } finally {
        jobPostPendingAction.value = {
          jobId: '',
          action: '',
        }
      }
    },
  })
}
const permanentlyDeleteJobPost = async (jobId) => {
  const normalizedJobId = String(jobId || '').trim()
  const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

  if (!selectedJob) {
    showPaymentToast('That job post could not be found.', 'error')
    return
  }

  closeJobPostActionMenu()
  showPaymentConfirmationToast({
    title: 'Delete Job Post',
    message: `Delete "${selectedJob.title}" permanently? This cannot be undone.`,
    confirmLabel: 'Delete Permanently',
    confirmVariant: 'danger',
    onConfirm: async () => {
      try {
        jobPostPendingAction.value = {
          jobId: normalizedJobId,
          action: 'delete',
        }
        const reviewerId = String(authUser.value?.id || authUser.value?.uid || '').trim()
        const reviewerName = String(authUser.value?.name || businessName.value || 'Business Owner').trim()
        const decisionAt = new Date().toISOString()
        const normalizedJobTitle = String(selectedJob.title || 'this job post').trim() || 'this job post'
        const applicationDiscontinuationReason = `The job post "${normalizedJobTitle}" was deleted by the business. This application was discontinued.`
        const buildInterviewCancellationReason = (application = {}, schedule = {}) => {
          const interviewType = String(
            schedule?.interviewType
              || schedule?.interview_type
              || application?.interviewType
              || application?.interview_type
              || 'initial',
          ).trim().toLowerCase() || 'initial'
          const interviewLabel = interviewType === 'final' ? 'final interview' : 'initial interview'
          return `The job post "${normalizedJobTitle}" was deleted by the business. The ${interviewLabel} was cancelled and the application was discontinued.`
        }
        const assessmentDiscontinuationReason = `The job post "${normalizedJobTitle}" was deleted by the business. This technical assessment was discontinued because the application was discontinued.`
        const affectedApplications = businessJobApplications.value.filter((application) =>
          String(application?.jobId || application?.job_id || '').trim() === normalizedJobId
          && canUpdateApplicantManagementStatus(application?.status),
        )
        const affectedApplicationIds = new Set(
          affectedApplications
            .map((application) => String(application?.id || '').trim())
            .filter(Boolean),
        )
        const relatedInterviewSchedules = businessInterviewSchedules.value.filter((record) =>
          affectedApplicationIds.has(String(record?.applicationId || record?.application_id || '').trim()))
        const relatedAssessmentAssignments = assessmentAssignmentRecords.value.filter((record) =>
          affectedApplicationIds.has(String(record?.applicationId || record?.application_id || record?.id || '').trim()))
        const assessmentAssignmentsByApplicationId = new Map()
        relatedAssessmentAssignments.forEach((record) => {
          const applicationId = String(record?.applicationId || record?.application_id || record?.id || '').trim()
          if (!applicationId) return
          const existingRows = assessmentAssignmentsByApplicationId.get(applicationId) || []
          assessmentAssignmentsByApplicationId.set(applicationId, [...existingRows, record])
        })

        await Promise.all([
          ...affectedApplications.map((application) => {
            const applicationId = String(application?.id || '').trim()
            if (!applicationId) return Promise.resolve()
            const hasInterviewMirror = Boolean(
              String(
                application?.interviewDate
                  || application?.interview_date
                  || application?.interviewSchedule
                  || application?.interview_schedule
                  || '',
              ).trim(),
            )
            const interviewDecisionReason = hasInterviewMirror
              ? buildInterviewCancellationReason(application)
              : undefined
            const hasAssessmentAssignment = assessmentAssignmentsByApplicationId.has(applicationId)

            return updateApplicantJobApplicationStatus(applicationId, {
              status: 'discontinued',
              rejectionReason: applicationDiscontinuationReason,
              reviewedBy: reviewerId,
              reviewedByName: reviewerName,
              interviewDecisionReason,
              interviewDecidedAt: interviewDecisionReason ? decisionAt : undefined,
              technicalAssessmentStatus: hasAssessmentAssignment ? 'cancelled' : undefined,
            })
          }),
          ...relatedInterviewSchedules.map((schedule) => {
            const applicationId = String(schedule?.applicationId || schedule?.application_id || '').trim()
            const linkedApplication = affectedApplications.find((application) => String(application?.id || '').trim() === applicationId) || {}
            return saveBusinessInterviewSchedule({
              ...schedule,
              scheduleStatus: 'cancelled',
              businessDecisionReason: buildInterviewCancellationReason(linkedApplication, schedule),
              businessDecidedAt: decisionAt,
              availableScheduleOptions: [],
            })
          }),
          ...relatedAssessmentAssignments.map((assignment) =>
            saveBusinessAssessmentAssignmentRecord({
              ...assignment,
              assignmentStatus: 'Cancelled',
              assessmentStatus: 'cancelled',
              cancellationReason: assessmentDiscontinuationReason,
            })),
        ])

        await deleteBusinessJobPost(normalizedJobId, {
          workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
        })

        if (editingJobPostId.value === normalizedJobId) {
          resetJobPostingDraft()
          jobPostingTab.value = 'posted'
        }

        const affectedApplicationCount = affectedApplications.length
        showPaymentToast(
          affectedApplicationCount
            ? `Job post deleted permanently. ${affectedApplicationCount} application${affectedApplicationCount === 1 ? ' was' : 's were'} discontinued.`
            : 'Job post deleted permanently.',
          'success',
        )
      } catch (error) {
        showPaymentToast(error instanceof Error ? error.message : 'Unable to delete the job post right now.', 'error')
      } finally {
        jobPostPendingAction.value = {
          jobId: '',
          action: '',
        }
      }
    },
  })
}
const setJobPostingDefaultTab = () => {
  jobPostingTab.value = canEditBusinessModule('job-posting') ? 'create' : 'posted'
}
const toggleJobPostingTab = () => {
  if (!canEditBusinessModule('job-posting')) {
    jobPostingTab.value = 'posted'
    return
  }

  if (jobPostingTab.value === 'create') {
    jobPostingTab.value = 'posted'
    return
  }

  resetJobPostingDraft()
  jobPostingTab.value = 'create'
}
const userManagementPages = {
  'user-overview': {
    title: 'User Overview',
    description: 'See a quick summary of workspace users and linked team members.',
  },
  'create-user': {
    title: 'Create User',
    description: 'Create a login and assign a saved role.',
  },
  'add-employee': {
    title: 'Add Member',
    description: 'Link a created user to a team member profile.',
  },
}
const currentUserManagementPage = computed(() =>
  userManagementPages[activeSection.value] || userManagementPages['create-user'],
)
const createDefaultUserAccountDraft = () => ({
  fullName: '',
  gmail: '',
  temporaryPassword: '',
  roleId: '',
})
const userAccountDraft = ref(createDefaultUserAccountDraft())
const isCreatingWorkspaceUser = ref(false)
const createWorkspaceUserRecord = (record = {}, index = 0) => ({
  id: String(record.id || `USR-${1001 + index}`),
  name: String(record.name || '').trim(),
  email: String(record.email || record.gmail || '').trim().toLowerCase(),
  gmail: String(record.gmail || record.email || '').trim().toLowerCase(),
  temporaryPassword: String(record.temporaryPassword || ''),
  roleId: String(record.roleId || ''),
  roleSnapshot:
    (record.roleSnapshot || record.permissionRoleSnapshot) && typeof (record.roleSnapshot || record.permissionRoleSnapshot) === 'object'
      ? JSON.parse(JSON.stringify(record.roleSnapshot || record.permissionRoleSnapshot))
      : null,
  status: String(record.status || 'Active'),
  lastActive: String(
    record.lastActive
    || (String(record.status || 'Active') === 'Active' ? 'Account ready to log in' : 'Recently updated'),
  ),
})
const createDefaultWorkspaceUsers = () => ([])
const workspaceUserDirectory = ref(createDefaultWorkspaceUsers())
const createDefaultEmployeeDraft = () => ({
  linkedUserId: '',
  fullName: '',
  workEmail: '',
  employmentType: '',
  phoneNumber: '',
  startDate: '',
  status: 'Active',
})
const employeeDraft = ref(createDefaultEmployeeDraft())
const employeeEmploymentTypeOptions = ['Full-time', 'Part-time', 'Contract']
const employeeStatusOptions = ['Active', 'On Leave', 'Disabled']
const userOverviewSearch = ref('')
const userOverviewRoleFilter = ref('all')
const userOverviewStatusFilter = ref('all')
const applicantManagementSearch = ref('')
const applicantManagementRoleFilter = ref('all')
const applicantManagementStatusFilter = ref('all')
const businessJobApplications = ref([])
const isApplicantManagementModalOpen = ref(false)
const applicantManagementSelectedApplicationId = ref('')
const applicantManagementDecisionMode = ref('view')
const applicantManagementDecisionReason = ref('')
const applicantManagementDecisionError = ref('')
const isApplicantManagementDecisionSubmitting = ref(false)
const applicantScoreSearch = ref('')
const applicantScoreRoleFilter = ref('all')
const applicantScoreStatusFilter = ref('all')
const normalizeUserOverviewValue = (value) => String(value || '').trim().toLowerCase()
const formatUserOverviewDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}
const buildUserOverviewInitials = (value, fallback = 'TM') => {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return fallback
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}
const openAddMemberDrawer = () => {
  if (!canEditBusinessModule('add-employee')) {
    showPaymentToast('Your role has view-only access for Add Member.', 'warning')
    return
  }

  isAddMemberDrawerOpen.value = true
}
const closeAddMemberDrawer = () => {
  if (isWorkspaceUserDirectoryLoading.value) return
  isAddMemberDrawerOpen.value = false
}
const BUSINESS_MEMBER_ID_PREFIX = 'TMB'
const BUSINESS_MEMBER_ID_WIDTH = 4
const formatBusinessMemberDisplayId = (value, fallbackSequence = 1) => {
  const normalizedValue = String(value || '').trim().toUpperCase()
  const prefixedMatch = normalizedValue.match(/^TMB?-(\d+)$/)
  const numericMatch = normalizedValue.match(/^\d+$/)
  const matchedSequence = prefixedMatch?.[1] || numericMatch?.[0] || ''
  const fallbackNumber = Number(fallbackSequence)
  const resolvedSequence = Number(matchedSequence)
  const safeSequence = Number.isFinite(resolvedSequence) && resolvedSequence > 0
    ? resolvedSequence
    : Number.isFinite(fallbackNumber) && fallbackNumber > 0
      ? fallbackNumber
      : 1

  return `${BUSINESS_MEMBER_ID_PREFIX}-${String(safeSequence).padStart(BUSINESS_MEMBER_ID_WIDTH, '0')}`
}
const createEmployeeRecord = (record = {}, fallbackSequence = 1) => ({
  id: formatBusinessMemberDisplayId(record.memberId || record.member_id || record.id, fallbackSequence),
  linkedUserId: String(record.linkedUserId || record.linked_user_id || ''),
  name: String(record.name || '').trim(),
  workEmail: String(record.workEmail || record.email || '').trim().toLowerCase(),
  businessName: String(record.businessName || record.workspaceOwnerName || businessName.value || '').trim(),
  memberType: String(record.memberType || (record.memberEmployer === true ? 'member_employer' : '') || '').trim(),
  roleName: String(record.roleName || record.permissionRoleName || '').trim(),
  employmentType: String(record.employmentType || ''),
  phoneNumber: String(record.phoneNumber || ''),
  startDate: String(record.startDate || ''),
  status: String(record.status || 'Active'),
  lastActive: String(record.lastActive || 'Just now'),
})
const createDefaultEmployeeDirectory = () => ([])
const employeeDirectory = ref(createDefaultEmployeeDirectory())
const applyLinkedUserToEmployeeDraft = (linkedUserId) => {
  const linkedUser = workspaceUserDirectory.value.find((user) => user.id === linkedUserId)
  if (!linkedUser) return

  employeeDraft.value = {
    ...employeeDraft.value,
    linkedUserId,
    fullName: linkedUser.name,
    workEmail: linkedUser.gmail,
  }
}
const resolveEmployeeStatusClass = (status) => {
  if (status === 'Active') return 'is-active'
  if (status === 'Pending Invite') return 'is-pending'
  if (status === 'On Leave') return 'is-leave'
  if (status === 'Disabled') return 'is-disabled'
  return ''
}
const isValidWorkspaceEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(value || '').trim())
const executeWorkspaceUserAccountCreation = async () => {
  if (!canEditBusinessModule('create-user')) {
    showPaymentToast('Your role has view-only access for Create User.', 'warning')
    return
  }

  if (isCreatingWorkspaceUser.value) return

  const requiredFields = [
    ['full name', userAccountDraft.value.fullName],
    ['email address', userAccountDraft.value.gmail],
    ['temporary password', userAccountDraft.value.temporaryPassword],
    ['role', userAccountDraft.value.roleId],
  ]

  const missingFields = requiredFields
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
    return
  }

  if (!isValidWorkspaceEmail(userAccountDraft.value.gmail)) {
    showPaymentToast('Use a valid email address for the workspace user.', 'warning')
    return
  }

  if (String(userAccountDraft.value.temporaryPassword || '').trim().length < 8) {
    showPaymentToast('Temporary password must be at least 8 characters long.', 'warning')
    return
  }

  const normalizedGmail = String(userAccountDraft.value.gmail || '').trim().toLowerCase()
  if (workspaceUserDirectory.value.some((user) => user.gmail === normalizedGmail)) {
    showPaymentToast('That email address is already assigned to an existing user.', 'warning')
    return
  }

  const selectedRole = getPermissionRoleById(userAccountDraft.value.roleId)
  if (!selectedRole) {
    showPaymentToast('Choose an existing role before creating this user.', 'warning')
    return
  }

  const trimmedPassword = String(userAccountDraft.value.temporaryPassword || '').trim()
  const workspaceOwnerId = String(
    authUser.value?.workspace_owner_id
    || authUser.value?.workspaceOwnerId
    || authUser.value?.id
    || '',
  ).trim()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const workspaceOwnerRole = String(
    authUser.value?.workspace_owner_role
    || authUser.value?.workspaceOwnerRole
    || authUser.value?.role
    || 'employer',
  ).trim()
  const workspaceOwnerName = String(
    authUser.value?.workspace_owner_name
    || authUser.value?.workspaceOwnerName
    || authUser.value?.company_name
    || authUser.value?.name
    || '',
  ).trim()

  isCreatingWorkspaceUser.value = true

  try {
    isCreateUserConfirmOpen.value = false
    const { user } = await createBusinessWorkspaceUserAccount({
      fullName: userAccountDraft.value.fullName.trim(),
      email: normalizedGmail,
      password: trimmedPassword,
      roleId: selectedRole.id,
      permissionRoleId: selectedRole.id,
      permissionRoleName: selectedRole.name,
      permissionRoleSnapshot: selectedRole,
      companyName: authUser.value?.company_name || authUser.value?.name || 'Business Workspace',
      companyCategory: authUser.value?.company_category || '',
      companyLocation: authUser.value?.company_location || '',
      companyContactNumber: authUser.value?.company_contact_number || '',
      companyOrganizationType:
        authUser.value?.company_organization_type
        || authUser.value?.companyOrganizationType
        || 'business',
      workspaceOwnerId,
      workspaceOwnerEmail,
      workspaceOwnerRole,
      workspaceOwnerName,
    })
    const createdWorkspaceUser = createWorkspaceUserRecord({
      ...user,
      id: user?.id || user?.uid || normalizedGmail,
      email: user?.email || normalizedGmail,
      gmail: user?.gmail || user?.email || normalizedGmail,
      name: user?.name || userAccountDraft.value.fullName.trim(),
      roleId: user?.roleId || user?.permissionRoleId || selectedRole.id,
      roleSnapshot: user?.roleSnapshot || user?.permissionRoleSnapshot || selectedRole,
      status: user?.status || 'Active',
      lastActive: user?.lastActive || 'Account ready to log in',
    })
    const existingWorkspaceUserIndex = workspaceUserDirectory.value.findIndex((entry) =>
      String(entry.id || '').trim() === createdWorkspaceUser.id
      || String(entry.gmail || entry.email || '').trim().toLowerCase() === normalizedGmail,
    )

    if (existingWorkspaceUserIndex >= 0) {
      workspaceUserDirectory.value.splice(existingWorkspaceUserIndex, 1, createdWorkspaceUser)
    } else {
      workspaceUserDirectory.value = [createdWorkspaceUser, ...workspaceUserDirectory.value]
    }

    if (workspaceOwnerId) {
      workspaceUserDirectorySyncMessage.value = ''
      await syncBusinessWorkspaceUserDirectory(workspaceOwnerId)
    }

    userAccountDraft.value = createDefaultUserAccountDraft()
    userOverviewSearch.value = ''
    userOverviewRoleFilter.value = 'all'
    userOverviewStatusFilter.value = 'all'
    activeSection.value = 'user-overview'
    showPaymentToast(
      `User account created for ${user?.email || normalizedGmail}. You can now see it in User Overview.`,
      'success',
    )
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to create the user account right now.', 'error')
  } finally {
    isCreatingWorkspaceUser.value = false
  }
}
const closeCreateUserConfirm = () => {
  if (isCreatingWorkspaceUser.value) return
  isCreateUserConfirmOpen.value = false
}
const saveWorkspaceUserAccount = () => {
  if (!canEditBusinessModule('create-user')) {
    showPaymentToast('Your role has view-only access for Create User.', 'warning')
    return
  }

  if (isCreatingWorkspaceUser.value) return
  isCreateUserConfirmOpen.value = true
}
const saveStaticEmployee = async () => {
  if (!canEditBusinessModule('add-employee')) {
    showPaymentToast('Your role has view-only access for Add Member.', 'warning')
    return
  }

  const linkedUser = workspaceUserDirectory.value.find((user) => user.id === employeeDraft.value.linkedUserId)
  if (!linkedUser) {
    showPaymentToast('Select an existing user account before adding an employee profile.', 'warning')
    return
  }

  const requiredFields = [
    ['linked user account', employeeDraft.value.linkedUserId],
    ['employment type', employeeDraft.value.employmentType],
    ['start date', employeeDraft.value.startDate],
  ]

  const missingFields = requiredFields
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
    return
  }

  if (employeeDirectory.value.some((employee) => employee.linkedUserId === linkedUser.id)) {
    showPaymentToast('That user already has an employee profile in the directory.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const workspaceOwnerRole = String(
    authUser.value?.workspace_owner_role
    || authUser.value?.workspaceOwnerRole
    || authUser.value?.role
    || 'employer',
  ).trim()
  const workspaceOwnerName = String(
    authUser.value?.workspace_owner_name
    || authUser.value?.workspaceOwnerName
    || businessName.value
    || authUser.value?.name
    || '',
  ).trim()
  const linkedRoleName = String(
    linkedUser?.permissionRoleName
    || linkedUser?.roleSnapshot?.name
    || linkedUser?.workspace_permission_role?.name
    || 'Workspace Member',
  ).trim()

  try {
    await saveBusinessMemberEmployer({
      linkedUserId: linkedUser.id,
      workspaceOwnerId,
      workspaceOwnerEmail,
      workspaceOwnerRole,
      workspaceOwnerName,
      businessName: businessName.value || workspaceOwnerName,
      memberType: 'member_employer',
      memberEmployer: true,
      name: employeeDraft.value.fullName.trim() || linkedUser.name,
      workEmail: employeeDraft.value.workEmail.trim() || linkedUser.gmail,
      roleId: linkedUser.roleId || linkedUser.permissionRoleId || '',
      roleName: linkedRoleName,
      employmentType: employeeDraft.value.employmentType,
      phoneNumber: employeeDraft.value.phoneNumber.trim(),
      startDate: employeeDraft.value.startDate,
      status: employeeDraft.value.status,
      lastActive: employeeDraft.value.status === 'Pending Invite' ? 'Invite sent just now' : 'Just now',
    })

    employeeDraft.value = createDefaultEmployeeDraft()
    isAddMemberDrawerOpen.value = false
    activeSection.value = 'add-employee'
    activeSidebarGroup.value = 'employees'
    showPaymentToast('Team member saved to Firestore under this business account.', 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save the team member right now.', 'error')
  }
}
const permissionRoleColorPalette = ['#5865f2', '#57f287', '#faa61a', '#eb459e', '#3ba55d', '#f04747', '#5d7cff']
const permissionModuleSections = [
  {
    id: 'general-system',
    label: 'General & System',
    icon: 'bi bi-grid-1x2-fill',
    modules: [
      { id: 'dashboard', label: 'Dashboard', description: 'Open the business workspace overview and summary cards.' },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    icon: 'bi bi-briefcase-fill',
    modules: [
      { id: 'job-posting', label: 'Job Posting', description: 'Create and manage job opportunities.' },
      { id: 'applicant-management', label: 'Applicant Management', description: 'Review applicants and move them through recruitment.' },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    icon: 'bi bi-ui-checks-grid',
    modules: [
      { id: 'assessment-management', label: 'Assessment Management', description: 'Manage assessment sets and workflows.' },
      { id: 'applicant-score', label: 'Applicant Score', description: 'Review scoring summaries and results.' },
    ],
  },
  {
    id: 'interview',
    label: 'Interview',
    icon: 'bi bi-calendar-event-fill',
    modules: [
      { id: 'interview-scheduling', label: 'Interview Scheduling', description: 'Schedule panels, slots, and follow-ups.' },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    icon: 'bi bi-journal-richtext',
    modules: [
      { id: 'training-templates', label: 'Training Templates', description: 'Create and maintain training templates.' },
      { id: 'assign-templates', label: 'Assign Templates', description: 'Assign learning flows to people and roles.' },
    ],
  },
  {
    id: 'employees',
    label: 'User Management',
    icon: 'bi bi-people-fill',
    modules: [
      { id: 'user-overview', label: 'User Overview', description: 'See user counts, linked members, and team status at a glance.' },
      { id: 'create-user', label: 'Create User', description: 'Create workspace users and assign saved roles.' },
      { id: 'add-employee', label: 'Add Employee', description: 'Link created users to employee profiles.' },
    ],
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: 'bi bi-shield-lock-fill',
    modules: [
      { id: 'permissions', label: 'Permissions', description: 'Manage roles, module visibility, and access rules.' },
    ],
  },
]
const permissionModuleCatalog = permissionModuleSections.flatMap((section) =>
  section.modules.map((module) => ({
    ...module,
    sectionId: section.id,
    sectionLabel: section.label,
    sectionIcon: section.icon,
  })),
)
const normalizePermissionModulePermissions = (permissions = {}, legacyEnabled = false) => {
  const full = Boolean(
    permissions?.full
    || (permissions?.view && permissions?.edit && permissions?.disable),
  )
  const edit = Boolean(permissions?.edit || full)
  const view = Boolean(permissions?.view || legacyEnabled || edit || full)

  return {
    view,
    edit,
    full,
  }
}
const createPermissionRoleColor = (index = 0) => permissionRoleColorPalette[index % permissionRoleColorPalette.length]
const createPermissionModules = (storedModules = []) =>
  permissionModuleCatalog.map((meta) => {
    const legacyUserManagementModule = Array.isArray(storedModules)
      ? storedModules.find((module) => module?.id === 'employees')
      : null
    const storedModule = Array.isArray(storedModules)
      ? storedModules.find((module) => module?.id === meta.id)
        || ((meta.id === 'user-overview' || meta.id === 'create-user' || meta.id === 'add-employee') ? legacyUserManagementModule : null)
      : null

    return {
      id: meta.id,
      label: meta.label,
      description: meta.description,
      sectionId: meta.sectionId,
      sectionLabel: meta.sectionLabel,
      permissions: normalizePermissionModulePermissions(
        storedModule?.permissions,
        Boolean(storedModule?.enabled),
      ),
    }
  })
const createPermissionRoleRecord = (role = {}, index = 0) => ({
  id: String(role?.id || `role-${Date.now()}-${index}`),
  name: String(role?.name || `Role ${index + 1}`).trim() || `Role ${index + 1}`,
  color: String(role?.color || createPermissionRoleColor(index)),
  modules: createPermissionModules(role?.modules),
})
const createPermissionModulePreset = (enabledModuleIds = [], fullAccess = false) =>
  permissionModuleCatalog.map((module) => ({
    id: module.id,
    permissions: enabledModuleIds.includes(module.id)
      ? {
          view: true,
          edit: true,
          full: Boolean(fullAccess),
        }
      : {
          view: false,
          edit: false,
          full: false,
        },
  }))
const createDefaultPermissionRoles = () => [
  createPermissionRoleRecord({
    id: 'role-administrator',
    name: 'Administrator',
    color: '#5865f2',
    modules: createPermissionModulePreset(permissionModuleCatalog.map((module) => module.id), true),
  }, 0),
  createPermissionRoleRecord({
    id: 'role-recruiter',
    name: 'Recruiter',
    color: '#57f287',
    modules: createPermissionModulePreset([
      'dashboard',
      'job-posting',
      'applicant-management',
      'assessment-management',
      'applicant-score',
      'interview-scheduling',
      'user-overview',
      'create-user',
      'add-employee',
    ]),
  }, 1),
  createPermissionRoleRecord({
    id: 'role-training-lead',
    name: 'Training Lead',
    color: '#faa61a',
    modules: createPermissionModulePreset([
      'dashboard',
      'training-templates',
      'assign-templates',
      'user-overview',
      'create-user',
      'add-employee',
    ]),
  }, 2),
]
const permissionRoleDraftName = ref('')
const isPermissionRoleEditMode = ref(false)
const permissionRoles = ref(createDefaultPermissionRoles())
const selectedPermissionRoleId = ref(permissionRoles.value[0]?.id || '')
const permissionRoleLookupValue = ref('')
const permissionRolesSavedSnapshot = ref('')
const isPermissionRolesHydrated = ref(false)
const serializePermissionRolesState = () => JSON.stringify({
  roles: permissionRoles.value,
  selectedRoleId: selectedPermissionRoleId.value,
})
const markPermissionRolesStateAsSaved = () => {
  permissionRolesSavedSnapshot.value = serializePermissionRolesState()
}
const selectedPermissionRole = computed(() =>
  permissionRoles.value.find((role) => role.id === selectedPermissionRoleId.value) || permissionRoles.value[0] || null,
)
const getPermissionRoleById = (roleId) =>
  permissionRoles.value.find((role) => role.id === String(roleId || '').trim()) || null
const setPermissionRoleEditMode = (enabled) => {
  isPermissionRoleEditMode.value = Boolean(enabled)
  permissionRoleLookupValue.value = enabled
    ? String(selectedPermissionRole.value?.name || '').trim()
    : ''
}
const togglePermissionRoleEditMode = () => {
  setPermissionRoleEditMode(!isPermissionRoleEditMode.value)
}
const selectPermissionRoleByName = (roleName, { notifyOnMissing = false } = {}) => {
  const normalizedName = String(roleName || '').trim().toLowerCase()
  if (!normalizedName) {
    permissionRoleLookupValue.value = ''
    return null
  }

  const matchedRole = permissionRoles.value.find((role) =>
    String(role?.name || '').trim().toLowerCase() === normalizedName,
  ) || null

  if (matchedRole) {
    selectedPermissionRoleId.value = matchedRole.id
    permissionRoleLookupValue.value = matchedRole.name
    return matchedRole
  }

  if (notifyOnMissing) {
    showPaymentToast('Choose an existing role from the list before editing its permissions.', 'warning')
  }

  return null
}
const handlePermissionRoleLookupInput = (event) => {
  const nextValue = String(event?.target?.value || '')
  permissionRoleLookupValue.value = nextValue
  selectPermissionRoleByName(nextValue)
}
const applyPermissionRoleLookupSelection = () => {
  const matchedRole = selectPermissionRoleByName(permissionRoleLookupValue.value, { notifyOnMissing: true })
  if (!matchedRole) {
    permissionRoleLookupValue.value = String(selectedPermissionRole.value?.name || '').trim()
  }
}
const permissionRoleOptionsForUsers = computed(() =>
  permissionRoles.value.map((role) => ({
    id: role.id,
    name: role.name,
  })),
)
const selectedUserAccountRole = computed(() => getPermissionRoleById(userAccountDraft.value.roleId))
const selectedEmployeeLinkedUser = computed(() =>
  workspaceUserDirectory.value.find((user) => user.id === employeeDraft.value.linkedUserId) || null,
)
const selectedEmployeeRole = computed(() => getPermissionRoleById(selectedEmployeeLinkedUser.value?.roleId))
const selectedEmployeeRoleModuleSections = computed(() => {
  const role = selectedEmployeeRole.value
  if (!role || !Array.isArray(role.modules)) return []

  return permissionModuleSections
    .map((section) => ({
      ...section,
      modules: section.modules.map((meta) => {
        const roleModule = role.modules.find((module) => module.id === meta.id)
        const permissions = normalizePermissionModulePermissions(roleModule?.permissions)

        return {
          ...meta,
          permissions,
          accessLabel: !permissions.view
            ? 'Hidden from sidebar'
            : permissions.full
              ? 'Full Access'
              : permissions.edit
                ? 'Edit Access'
                : 'View Only',
        }
      }),
    }))
})
const buildPermissionRoleFromSnapshot = (snapshot, fallbackId = '', fallbackName = 'Assigned Role') => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null

  return createPermissionRoleRecord({
    ...snapshot,
    id: String(snapshot.id || fallbackId || '__role-snapshot__').trim(),
    name: String(snapshot.name || fallbackName || 'Assigned Role').trim() || 'Assigned Role',
  }, 0)
}
const availableEmployeeLinkOptions = computed(() => {
  const linkedUserIds = new Set(
    employeeDirectory.value
      .map((employee) => String(employee?.linkedUserId || '').trim())
      .filter(Boolean),
  )

  return workspaceUserDirectory.value.filter((user) =>
    user.id === employeeDraft.value.linkedUserId || !linkedUserIds.has(user.id),
  )
})
const currentWorkspacePermissionUser = computed(() => {
  const normalizedEmail = String(authUser.value?.email || authUser.value?.business_contact_email || '')
    .trim()
    .toLowerCase()
  if (!normalizedEmail) return null

  return workspaceUserDirectory.value.find((user) =>
    String(user.email || user.gmail || '').trim().toLowerCase() === normalizedEmail,
  ) || null
})
const isCurrentWorkspaceMember = computed(() =>
  authUser.value?.workspace_member === true
  || Boolean(String(authUser.value?.workspace_owner_id || authUser.value?.workspaceOwnerId || '').trim()),
)
const currentWorkspacePermissionRoleId = computed(() => {
  const explicitRoleId = String(authUser.value?.roleId || authUser.value?.permissionRoleId || '').trim()
  if (explicitRoleId) return explicitRoleId

  const snapshotRoleId = String(
    authUser.value?.permissionRoleSnapshot?.id
    || authUser.value?.workspace_permission_role?.id
    || '',
  ).trim()
  if (snapshotRoleId) return snapshotRoleId

  const matchedWorkspaceUser = currentWorkspacePermissionUser.value
  if (!matchedWorkspaceUser) return ''
  if (String(matchedWorkspaceUser.status || '').trim().toLowerCase() === 'disabled') return '__disabled__'

  return String(matchedWorkspaceUser.roleId || '').trim()
})
const currentWorkspacePermissionRoleSnapshot = computed(() =>
  buildPermissionRoleFromSnapshot(
    authUser.value?.permissionRoleSnapshot
      || authUser.value?.workspace_permission_role
      || currentWorkspacePermissionUser.value?.roleSnapshot,
    currentWorkspacePermissionRoleId.value,
    authUser.value?.permissionRoleName
      || currentWorkspacePermissionUser.value?.roleSnapshot?.name
      || 'Assigned Role',
  ),
)
const currentWorkspacePermissionRole = computed(() => {
  if (currentWorkspacePermissionRoleId.value === '__disabled__') {
    return {
      id: '__disabled__',
      name: 'Disabled',
      modules: createPermissionModules(),
    }
  }

  const snapshotRole = currentWorkspacePermissionRoleSnapshot.value
  const persistedRolesAvailable = hasPersistedBusinessPermissionRoles()
  if (snapshotRole && isCurrentWorkspaceMember.value) {
    return snapshotRole
  }

  if (snapshotRole && (!persistedRolesAvailable || !isPermissionRolesHydrated.value)) {
    return snapshotRole
  }

  const matchedRole = getPermissionRoleById(currentWorkspacePermissionRoleId.value)
  if (matchedRole) return matchedRole

  if (persistedRolesAvailable) {
    return null
  }

  return snapshotRole
})
const hasOwnerWorkspaceAccess = computed(() => {
  const normalizedRole = String(authUser.value?.role || '').trim().toLowerCase()
  return normalizedRole === 'employer' && !isCurrentWorkspaceMember.value && !currentWorkspacePermissionRoleId.value
})
const isPermissionModuleFullAccess = (module) =>
  Boolean(module?.permissions?.full)
const isPermissionManagedSection = (sectionId) =>
  permissionModuleCatalog.some((module) => module.id === String(sectionId || '').trim())
const hasPendingBusinessGraceAccess = (moduleId) =>
  businessSystemNotifications.value.some((notice) =>
    notice.section === String(moduleId || '').trim()
    && notice.effectiveAtValue > businessRealtimeNow.value,
  )
const getBusinessModuleAccess = (moduleId, role = currentWorkspacePermissionRole.value) => {
  const normalizedModuleId = String(moduleId || '').trim()
  if (!normalizedModuleId || !isPermissionManagedSection(normalizedModuleId)) {
    return { view: true, edit: true, full: true }
  }

  if (hasOwnerWorkspaceAccess.value) {
    return { view: true, edit: true, full: true }
  }

  const roleModule = Array.isArray(role?.modules)
    ? role.modules.find((module) => module.id === normalizedModuleId)
    : null
  const permissions = normalizePermissionModulePermissions(roleModule?.permissions)
  const full = Boolean(permissions.full)
  const edit = Boolean(permissions.edit || full)
  const view = Boolean(permissions.view || edit || full || hasPendingBusinessGraceAccess(normalizedModuleId))

  return { view, edit, full }
}
const canViewBusinessModule = (moduleId) => getBusinessModuleAccess(moduleId).view
const canEditBusinessModule = (moduleId) => getBusinessModuleAccess(moduleId).edit
const canViewTrainingWorkspace = computed(() =>
  canViewBusinessModule('training-templates') || canViewBusinessModule('assign-templates'),
)
const canViewTrainingTemplateBuilder = computed(() => canViewBusinessModule('training-templates'))
const canViewTrainingAssignments = computed(() => canViewBusinessModule('assign-templates'))
const canEditTrainingAssignments = computed(() => canEditBusinessModule('assign-templates'))
const formatPermissionAccessLabel = (module) => {
  if (!module?.permissions?.view) return 'Hidden from sidebar'
  if (isPermissionModuleFullAccess(module)) return 'Full Access'
  if (module?.permissions?.edit) return 'Edit Access'
  return 'View Only'
}
const countPermissionRoleEnabledModules = (role) =>
  Array.isArray(role?.modules) ? role.modules.filter((module) => module?.permissions?.view).length : 0
const countPermissionRoleFullAccessModules = (role) =>
  Array.isArray(role?.modules) ? role.modules.filter((module) => module?.permissions?.view && isPermissionModuleFullAccess(module)).length : 0
const getPermissionRoleModuleNames = (roleId) => {
  const role = typeof roleId === 'object' ? roleId : getPermissionRoleById(roleId)
  if (!role || !Array.isArray(role.modules)) return []

  return role.modules
    .filter((module) => module?.permissions?.view)
    .map((module) => module.label)
}
const formatPermissionRoleAccessSummary = (roleId) => {
  const role = typeof roleId === 'object' ? roleId : getPermissionRoleById(roleId)
  if (!role) return 'Role no longer exists in Permissions'

  const enabledCount = countPermissionRoleEnabledModules(role)
  const fullAccessCount = countPermissionRoleFullAccessModules(role)

  if (!enabledCount) return 'No modules visible'
  if (fullAccessCount) return `${enabledCount} visible modules, ${fullAccessCount} full access`
  return `${enabledCount} visible modules`
}
const formatPermissionRoleSidebarSummary = (roleId) => {
  const role = typeof roleId === 'object' ? roleId : getPermissionRoleById(roleId)
  if (!role) return 'Role no longer exists in Permissions'

  const moduleNames = getPermissionRoleModuleNames(role)
  if (!moduleNames.length) return 'No visible modules'
  if (moduleNames.length <= 3) return moduleNames.join(', ')

  return `${moduleNames.slice(0, 3).join(', ')} +${moduleNames.length - 3} more`
}
const getWorkspaceUserRoleName = (user) => getPermissionRoleById(user?.roleId)?.name || 'Deleted role'
const getWorkspaceUserAccessSummary = (user) => formatPermissionRoleAccessSummary(user?.roleId)
const getLinkedWorkspaceUser = (employee) =>
  workspaceUserDirectory.value.find((user) => user.id === String(employee?.linkedUserId || '').trim()) || null
const getLinkedEmployeeProfile = (user) =>
  employeeDirectory.value.find((employee) => String(employee?.linkedUserId || '').trim() === String(user?.id || '').trim()) || null
const getEmployeeRoleName = (employee) => getWorkspaceUserRoleName(getLinkedWorkspaceUser(employee))
const getEmployeeRoleAccessSummary = (employee) => {
  const linkedUser = getLinkedWorkspaceUser(employee)
  return formatPermissionRoleAccessSummary(linkedUser?.roleId)
}
const countUsersAssignedToRole = (roleId) =>
  workspaceUserDirectory.value.filter((user) => user.roleId === String(roleId || '').trim()).length
const selectedPermissionEnabledModuleCount = computed(() => countPermissionRoleEnabledModules(selectedPermissionRole.value))
const selectedPermissionFullAccessCount = computed(() => countPermissionRoleFullAccessModules(selectedPermissionRole.value))
const selectedPermissionAssignedUsersCount = computed(() => countUsersAssignedToRole(selectedPermissionRole.value?.id))
const permissionRolesHasUnsavedChanges = computed(() => {
  if (!authUser.value) return false
  return serializePermissionRolesState() !== permissionRolesSavedSnapshot.value
})
const selectedUserAccountRoleSummary = computed(() => formatPermissionRoleAccessSummary(userAccountDraft.value.roleId))
const selectedUserAccountRoleModules = computed(() => formatPermissionRoleSidebarSummary(userAccountDraft.value.roleId))
const createUserConfirmationName = computed(() =>
  String(userAccountDraft.value.fullName || '').trim() || 'this workspace user',
)
const createUserConfirmationEmail = computed(() =>
  String(userAccountDraft.value.gmail || '').trim().toLowerCase() || 'the entered email address',
)
const selectedUserAccountRoleModuleSections = computed(() => {
  const role = selectedUserAccountRole.value
  if (!role || !Array.isArray(role.modules)) return []

  return permissionModuleSections
    .map((section) => ({
      ...section,
      modules: section.modules.map((meta) => {
        const roleModule = role.modules.find((module) => module.id === meta.id)
        const permissions = normalizePermissionModulePermissions(roleModule?.permissions)

        return {
          ...meta,
          permissions,
          accessLabel: !permissions.view
            ? 'Hidden from sidebar'
            : permissions.full
              ? 'Full Access'
              : permissions.edit
                ? 'Edit Access'
                : 'View Only',
        }
      }),
    }))
})
const selectedEmployeeRoleSummary = computed(() => formatPermissionRoleAccessSummary(selectedEmployeeLinkedUser.value?.roleId))
const selectedEmployeeRoleModules = computed(() => formatPermissionRoleSidebarSummary(selectedEmployeeLinkedUser.value?.roleId))
const userOverviewRows = computed(() =>
  workspaceUserDirectory.value.map((user) => {
    const linkedEmployee = getLinkedEmployeeProfile(user)
    return {
      id: String(user?.id || '').trim() || 'Pending ID',
      name: String(user?.name || 'Team Member').trim(),
      email: String(user?.gmail || user?.email || 'No email').trim() || 'No email',
      role: getWorkspaceUserRoleName(user),
      roleKey: normalizeUserOverviewValue(getWorkspaceUserRoleName(user)),
      status: normalizeUserOverviewValue(linkedEmployee?.status || user?.status || 'active'),
      statusLabel: String(linkedEmployee?.status || user?.status || 'Active').trim(),
      date: linkedEmployee?.startDate || '',
      linkedMember: linkedEmployee?.name || 'Ready to link',
      linkedState: linkedEmployee ? 'Linked' : 'Ready to link',
      accessSummary: getWorkspaceUserAccessSummary(user),
      avatarClass: linkedEmployee ? 'business-user-overview__avatar--linked' : 'business-user-overview__avatar--ready',
      initials: buildUserOverviewInitials(user?.name, 'TM'),
    }
  }),
)
const filteredUserOverviewRows = computed(() => {
  const normalizedSearch = normalizeUserOverviewValue(userOverviewSearch.value)
  const normalizedRole = normalizeUserOverviewValue(userOverviewRoleFilter.value || 'all')
  const normalizedStatus = normalizeUserOverviewValue(userOverviewStatusFilter.value || 'all')

  return userOverviewRows.value.filter((record) => {
    const matchesSearch = !normalizedSearch || [
      record.id,
      record.name,
      record.email,
      record.role,
      record.statusLabel,
      record.linkedMember,
      record.linkedState,
    ]
      .map((value) => normalizeUserOverviewValue(value))
      .some((value) => value.includes(normalizedSearch))

    const matchesRole = normalizedRole === 'all' || record.roleKey === normalizedRole
    const matchesStatus = normalizedStatus === 'all' || record.status === normalizedStatus
    return matchesSearch && matchesRole && matchesStatus
  })
})
const userOverviewRoleOptions = computed(() => [
  { value: 'all', label: 'All Roles' },
  ...Array.from(new Set(userOverviewRows.value.map((row) => row.role).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({
      value: normalizeUserOverviewValue(role),
      label: role,
    })),
])
const userOverviewSummary = computed(() => `${filteredUserOverviewRows.value.length} of ${userOverviewRows.value.length} users`)
const formatApplicantManagementStatusLabel = (value) => {
  const normalizedStatus = normalizeUserOverviewValue(value || 'pending')
  if (!normalizedStatus) return 'Pending'
  if (['pending', 'applied', 'submitted'].includes(normalizedStatus)) return 'Pending'
  if (normalizedStatus.includes('interview')) return 'Interview'
  if (['accepted', 'approved', 'hired'].includes(normalizedStatus)) return 'Approved'
  if (['rejected', 'declined', 'denied'].includes(normalizedStatus)) return 'Rejected'
  if (['discontinued', 'cancelled', 'canceled'].includes(normalizedStatus)) return 'Discontinued'
  if (['reviewing', 'under review', 'in_review'].includes(normalizedStatus)) return 'Under Review'
  return normalizedStatus
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
const isApplicantManagementFinalStatus = (value) =>
  ['approved', 'rejected', 'discontinued'].includes(normalizeUserOverviewValue(formatApplicantManagementStatusLabel(value)))
const canUpdateApplicantManagementStatus = (value) => !isApplicantManagementFinalStatus(value)
const getApplicantManagementFinalActionState = (value) => {
  const normalizedStatus = normalizeUserOverviewValue(formatApplicantManagementStatusLabel(value))
  if (normalizedStatus === 'approved') {
    return {
      icon: 'bi bi-patch-check-fill',
      label: 'Approved',
      tone: 'approved',
    }
  }
  if (normalizedStatus === 'rejected') {
    return {
      icon: 'bi bi-x-circle-fill',
      label: 'Rejected',
      tone: 'rejected',
    }
  }
  if (normalizedStatus === 'discontinued') {
    return {
      icon: 'bi bi-slash-circle-fill',
      label: 'Discontinued',
      tone: 'rejected',
    }
  }
  return {
    icon: 'bi bi-lock-fill',
    label: 'Finalized',
    tone: 'neutral',
  }
}
const applicantManagementRows = computed(() =>
  businessJobApplications.value.map((application, index) => {
    const statusLabel = formatApplicantManagementStatusLabel(application?.status)
    const isFinalStatus = isApplicantManagementFinalStatus(statusLabel)
    const jobTitle = String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job'
    const businessLabel = String(application?.businessName || application?.companyName || businessName.value || 'Business').trim()
    const appliedAt = formatUserOverviewDate(application?.appliedAt || application?.createdAt)
    const disabilityLabel = String(application?.applicantDisability || 'Not specified').trim() || 'Not specified'
    const barangayLabel = String(application?.applicantBarangay || 'Not specified').trim() || 'Not specified'
    const languageLabel = String(application?.applicantLanguage || 'Not specified').trim() || 'Not specified'

    return {
      id: String(application?.id || `application-${index + 1}`).trim() || `application-${index + 1}`,
      name: String(application?.applicantName || 'Applicant').trim() || 'Applicant',
      email: String(application?.applicantEmail || 'No email').trim() || 'No email',
      role: jobTitle,
      roleKey: normalizeUserOverviewValue(jobTitle),
      status: normalizeUserOverviewValue(statusLabel),
      statusLabel,
      isFinalStatus,
      finalAction: getApplicantManagementFinalActionState(statusLabel),
      date: appliedAt,
      linkedMember: businessLabel,
      linkedState: 'Applied via Firestore',
      accessSummary: `Disability: ${disabilityLabel} | Barangay: ${barangayLabel} | Language: ${languageLabel}`,
      avatarClass: 'business-user-overview__avatar--ready',
      avatarUrl: mediaUrl(String(application?.applicantAvatar || application?.avatar || application?.avatar_url || '').trim()),
      initials: buildUserOverviewInitials(application?.applicantName, 'AP'),
    }
  }),
)
const filteredApplicantManagementRows = computed(() => {
  const normalizedSearch = normalizeUserOverviewValue(applicantManagementSearch.value)
  const normalizedRole = normalizeUserOverviewValue(applicantManagementRoleFilter.value || 'all')
  const normalizedStatus = normalizeUserOverviewValue(applicantManagementStatusFilter.value || 'all')

  return applicantManagementRows.value.filter((record) => {
    const matchesSearch = !normalizedSearch || [
      record.id,
      record.name,
      record.email,
      record.role,
      record.statusLabel,
      record.linkedMember,
      record.linkedState,
      record.accessSummary,
    ]
      .map((value) => normalizeUserOverviewValue(value))
      .some((value) => value.includes(normalizedSearch))

    const matchesRole = normalizedRole === 'all' || record.roleKey === normalizedRole
    const matchesStatus = normalizedStatus === 'all' || record.status === normalizedStatus
    return matchesSearch && matchesRole && matchesStatus
  })
})
const applicantManagementRoleOptions = computed(() => [
  { value: 'all', label: 'All Roles' },
  ...Array.from(new Set(applicantManagementRows.value.map((row) => row.role).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({
      value: normalizeUserOverviewValue(role),
      label: role,
    })),
])
const applicantManagementSummary = computed(() =>
  `${filteredApplicantManagementRows.value.length} of ${applicantManagementRows.value.length} applicants`,
)
const getApplicantManagementApplicationById = (applicationId) =>
  businessJobApplications.value.find((entry) => String(entry?.id || '').trim() === String(applicationId || '').trim()) || null

const selectedApplicantManagementApplication = computed(() =>
  getApplicantManagementApplicationById(applicantManagementSelectedApplicationId.value),
)

const selectedApplicantManagementDetails = computed(() => {
  const application = selectedApplicantManagementApplication.value
  if (!application) return null

  const fullAddress = [
    String(application?.applicantPresentAddress || '').trim(),
    String(application?.applicantBarangay || '').trim(),
    String(application?.applicantCity || '').trim(),
    String(application?.applicantProvince || '').trim(),
  ].filter(Boolean).join(', ')

  return {
    id: String(application?.id || '').trim(),
    applicantName: String(application?.applicantName || 'Applicant').trim() || 'Applicant',
    applicantEmail: String(application?.applicantEmail || 'No email').trim() || 'No email',
    applicantAvatar: mediaUrl(String(application?.applicantAvatar || application?.avatar || application?.avatar_url || '').trim()),
    jobTitle: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
    statusLabel: formatApplicantManagementStatusLabel(application?.status),
    appliedAtLabel: formatUserOverviewDate(application?.appliedAt || application?.createdAt),
    disabilityLabel: String(application?.applicantDisability || 'Not specified').trim() || 'Not specified',
    languageLabel: String(application?.applicantLanguage || 'Not specified').trim() || 'Not specified',
    barangayLabel: String(application?.applicantBarangay || 'Not specified').trim() || 'Not specified',
    contactNumber: String(application?.applicantContactNumber || 'Not provided').trim() || 'Not provided',
    sex: String(application?.applicantSex || 'Not specified').trim() || 'Not specified',
    age: String(application?.applicantAge || 'Not specified').trim() || 'Not specified',
    birthDate: String(application?.applicantBirthDate || 'Not specified').trim() || 'Not specified',
    pwdId: String(application?.applicantPwdId || 'Not provided').trim() || 'Not provided',
    fullAddress: fullAddress || 'Address not provided',
    rejectionReason: String(application?.rejectionReason || '').trim(),
  }
})
const canUpdateSelectedApplicantManagementStatus = computed(() =>
  canUpdateApplicantManagementStatus(selectedApplicantManagementDetails.value?.statusLabel),
)

const closeApplicantManagementModal = () => {
  if (isApplicantManagementDecisionSubmitting.value) return

  isApplicantManagementModalOpen.value = false
  applicantManagementSelectedApplicationId.value = ''
  applicantManagementDecisionMode.value = 'view'
  applicantManagementDecisionReason.value = ''
  applicantManagementDecisionError.value = ''
}

const openApplicantManagementModal = (applicationId, mode = 'view') => {
  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }

  applicantManagementSelectedApplicationId.value = String(targetApplication.id || '').trim()
  applicantManagementDecisionMode.value = mode
  applicantManagementDecisionReason.value = mode === 'reject'
    ? String(targetApplication?.rejectionReason || '').trim()
    : ''
  applicantManagementDecisionError.value = ''
  isApplicantManagementModalOpen.value = true
}

const approveApplicantManagementApplication = async (applicationId = applicantManagementSelectedApplicationId.value) => {
  if (!canEditBusinessModule('applicant-management')) {
    showPaymentToast('Your role has view-only access for Applicant Management.', 'warning')
    return
  }

  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }
  if (!canUpdateApplicantManagementStatus(targetApplication?.status)) {
    showPaymentToast('This application is already finalized.', 'warning')
    return
  }

  if (isApplicantManagementDecisionSubmitting.value) return

  try {
    isApplicantManagementDecisionSubmitting.value = true
    applicantManagementDecisionError.value = ''
    await updateApplicantJobApplicationStatus(String(targetApplication.id || '').trim(), {
      status: 'approved',
      rejectionReason: '',
      reviewedBy: String(authUser.value?.id || authUser.value?.uid || '').trim(),
      reviewedByName: String(authUser.value?.name || businessName.value || 'Business Owner').trim(),
    })
    showPaymentToast(`${String(targetApplication.applicantName || 'Applicant').trim()} was approved successfully.`, 'success')
    closeApplicantManagementModal()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve the applicant right now.'
    applicantManagementDecisionError.value = message
    showPaymentToast(message, 'error')
  } finally {
    isApplicantManagementDecisionSubmitting.value = false
  }
}

const rejectApplicantManagementApplication = async (applicationId = applicantManagementSelectedApplicationId.value) => {
  if (!canEditBusinessModule('applicant-management')) {
    showPaymentToast('Your role has view-only access for Applicant Management.', 'warning')
    return
  }

  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }
  if (!canUpdateApplicantManagementStatus(targetApplication?.status)) {
    showPaymentToast('This application is already finalized.', 'warning')
    return
  }

  const rejectionReason = String(applicantManagementDecisionReason.value || '').trim()
  if (!rejectionReason) {
    applicantManagementDecisionError.value = 'Enter a rejection reason before rejecting this application.'
    return
  }

  if (isApplicantManagementDecisionSubmitting.value) return

  try {
    isApplicantManagementDecisionSubmitting.value = true
    applicantManagementDecisionError.value = ''
    await updateApplicantJobApplicationStatus(String(targetApplication.id || '').trim(), {
      status: 'rejected',
      rejectionReason,
      reviewedBy: String(authUser.value?.id || authUser.value?.uid || '').trim(),
      reviewedByName: String(authUser.value?.name || businessName.value || 'Business Owner').trim(),
    })
    showPaymentToast(`${String(targetApplication.applicantName || 'Applicant').trim()} was rejected and notified with the reason.`, 'success')
    closeApplicantManagementModal()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject the applicant right now.'
    applicantManagementDecisionError.value = message
    showPaymentToast(message, 'error')
  } finally {
    isApplicantManagementDecisionSubmitting.value = false
  }
}

const openApplicantManagementDecision = (applicationId, mode = 'view') => {
  openApplicantManagementModal(applicationId, mode)
}

const reviewApplicantManagementQueue = () => {
  if (!filteredApplicantManagementRows.value.length) {
    showPaymentToast('No applicants match the current filter.', 'warning')
    return
  }

  openApplicantManagementDecision(filteredApplicantManagementRows.value[0].id, 'view')
}

const applicantScoreRows = computed(() =>
  assessmentAssignmentRecords.value
    .filter((entry) => String(entry?.selectedTemplateId || entry?.templateTitle || '').trim())
    .map((entry, index) => {
      const linkedProfile = approvedApplicantProfiles.value.find((profile) =>
        String(profile?.applicationId || profile?.id || '').trim() === String(entry?.applicationId || entry?.id || '').trim(),
      ) || null
      const scoreValue = Math.min(100, Math.max(0, Number(entry?.assessmentScoreValue || 0) || 0))
      const assessmentResult = normalizeAssessmentResultState(entry?.assessmentResult)
      const statusLabel = resolveApplicantScoreStatusLabel(entry)
      const passingScorePercent = normalizeAssessmentPassingScorePercent(entry?.passingScorePercent, 70)
      const correctAnswerCount = Math.max(0, Number(entry?.correctAnswerCount || 0) || 0)
      const totalQuestions = Math.max(0, Number(entry?.totalQuestions || 0) || 0)
      const templateDetail = totalQuestions > 0
        ? assessmentResult === 'pending'
          ? `Waiting for applicant answers · Pass mark ${passingScorePercent}%`
          : `${correctAnswerCount}/${totalQuestions} correct · Pass mark ${passingScorePercent}%`
        : `Pass mark ${passingScorePercent}%`

      return {
        rowNumber: index + 1,
        id: String(entry?.applicantId || linkedProfile?.applicantId || entry?.applicationId || entry?.id || `APP-SCORE-${index + 1}`).trim(),
        name: String(entry?.name || linkedProfile?.name || 'Applicant').trim() || 'Applicant',
        email: String(entry?.email || linkedProfile?.email || 'No email').trim() || 'No email',
        role: String(entry?.role || linkedProfile?.role || 'Unassigned Role').trim() || 'Unassigned Role',
        roleKey: normalizeUserOverviewValue(entry?.role || linkedProfile?.role),
        approvalDate: String(entry?.approvalDate || linkedProfile?.reviewed_at || linkedProfile?.submitted_at || '').trim(),
        scoreValue,
        scoreLabel: String(entry?.assessmentScoreLabel || resolveAssessmentScoreLabel(entry)).trim() || resolveAssessmentScoreLabel(entry),
        scoreTone:
          assessmentResult === 'passed'
            ? scoreValue >= 90 ? 'top-score' : 'qualified'
            : assessmentResult === 'failed'
              ? 'needs-review'
              : 'pending',
        templateTitle: String(entry?.templateTitle || 'No template assigned').trim() || 'No template assigned',
        templateDetail,
        status: normalizeUserOverviewValue(statusLabel),
        statusLabel,
        technicalLabel: formatBusinessInterviewTechnicalStageLabel(
          assessmentResult === 'passed'
            ? 'passed'
            : assessmentResult === 'failed'
              ? 'failed'
              : ['assigned', 'submitted'].includes(String(entry?.assignmentStatus || '').trim().toLowerCase())
                ? 'assigned'
                : 'unassigned',
        ),
        initials: buildUserOverviewInitials(entry?.name || linkedProfile?.name, 'AP'),
      }
    }),
)
const filteredApplicantScoreRows = computed(() => {
  const normalizedSearch = normalizeUserOverviewValue(applicantScoreSearch.value)
  const normalizedRole = normalizeUserOverviewValue(applicantScoreRoleFilter.value || 'all')
  const normalizedStatus = normalizeUserOverviewValue(applicantScoreStatusFilter.value || 'all')

  return applicantScoreRows.value.filter((record) => {
    const matchesSearch = !normalizedSearch || [
      record.id,
      record.name,
      record.email,
      record.role,
      record.scoreLabel,
      record.templateTitle,
      record.statusLabel,
      record.technicalLabel,
    ]
      .map((value) => normalizeUserOverviewValue(value))
      .some((value) => value.includes(normalizedSearch))

    const matchesRole = normalizedRole === 'all' || record.roleKey === normalizedRole
    const matchesStatus = normalizedStatus === 'all' || record.status === normalizedStatus
    return matchesSearch && matchesRole && matchesStatus
  })
})
const applicantScoreRoleOptions = computed(() => [
  { value: 'all', label: 'All Roles' },
  ...Array.from(new Set(applicantScoreRows.value.map((row) => row.role).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({
      value: normalizeUserOverviewValue(role),
      label: role,
    })),
])
const applicantScoreSummary = computed(() =>
  `${filteredApplicantScoreRows.value.length} of ${applicantScoreRows.value.length} applicants`,
)
const userOverviewCards = computed(() => {
  const totalWorkspaceUsers = workspaceUserDirectory.value.length
  const linkedMembers = employeeDirectory.value.length
  const readyToLink = Math.max(availableEmployeeLinkOptions.value.length, 0)
  const activeMembers = employeeDirectory.value.filter((employee) => employee.status === 'Active').length

  return [
    {
      label: 'Workspace Users',
      value: totalWorkspaceUsers,
      copy: 'Created logins available inside your business workspace.',
    },
    {
      label: 'Linked Members',
      value: linkedMembers,
      copy: 'User accounts already connected to a member profile.',
    },
    {
      label: 'Ready To Link',
      value: readyToLink,
      copy: 'Created users that can still be added as team members.',
    },
    {
      label: 'Active Members',
      value: activeMembers,
      copy: 'Profiles currently marked active in your team directory.',
    },
  ]
})
const resetPermissionRolesToDefault = () => {
  const defaults = createDefaultPermissionRoles()
  permissionRoles.value = defaults
  selectedPermissionRoleId.value = defaults[0]?.id || ''
}
const clonePermissionRoles = (roles = []) => JSON.parse(JSON.stringify(roles))
const parsePersistedPermissionRolesState = (rawState) => {
  if (!rawState) return null

  try {
    const parsedState = JSON.parse(rawState)
    if (!Array.isArray(parsedState?.roles) || !parsedState.roles.length) {
      return null
    }

    return parsedState
  } catch {
    return null
  }
}
const readPersistedBusinessPermissionRolesState = () => {
  if (typeof window === 'undefined' || !authUser.value) return null

  const scopedKey = getBusinessScopedStorageKey(BUSINESS_ROLE_PERMISSION_STATE_STORAGE_KEY)
  const firestoreRoles = Array.isArray(
    authUser.value?.workspace_permission_roles || authUser.value?.workspacePermissionRoles,
  )
    ? authUser.value.workspace_permission_roles || authUser.value.workspacePermissionRoles
    : []

  if (firestoreRoles.length) {
    return {
      storageKey: scopedKey,
      source: 'firestore',
      state: {
        roles: firestoreRoles,
        selectedRoleId:
          selectedPermissionRoleId.value
          || currentWorkspacePermissionRoleId.value
          || firestoreRoles[0]?.id
          || '',
      },
    }
  }

  const scopedState = parsePersistedPermissionRolesState(localStorage.getItem(scopedKey))
  if (scopedState) {
    return {
      storageKey: scopedKey,
      source: 'local',
      state: scopedState,
    }
  }

  const legacyKey = findLegacyBusinessStorageKey(BUSINESS_ROLE_PERMISSION_STATE_STORAGE_KEY)
  if (!legacyKey) return null

  const legacyState = parsePersistedPermissionRolesState(localStorage.getItem(legacyKey))
  if (!legacyState) return null

  return {
    storageKey: legacyKey,
    source: 'local',
    state: legacyState,
  }
}
const syncPermissionRolesStateToStorage = () => {
  if (!authUser.value) return

  localStorage.setItem(getBusinessScopedStorageKey(BUSINESS_ROLE_PERMISSION_STATE_STORAGE_KEY), JSON.stringify({
    roles: permissionRoles.value,
    selectedRoleId: selectedPermissionRoleId.value,
  }))
  markPermissionRolesStateAsSaved()
}
const restorePermissionRolesState = () => {
  if (!authUser.value) return

  isPermissionRolesHydrated.value = false

  try {
    const scopedKey = getBusinessScopedStorageKey(BUSINESS_ROLE_PERMISSION_STATE_STORAGE_KEY)
    const persistedState = readPersistedBusinessPermissionRolesState()
    if (!persistedState) {
      resetPermissionRolesToDefault()
      markPermissionRolesStateAsSaved()
      isPermissionRolesHydrated.value = true
      return
    }

    const nextRoles = persistedState.state.roles.map((role, index) => createPermissionRoleRecord(role, index))

    permissionRoles.value = nextRoles
    selectedPermissionRoleId.value = nextRoles.some((role) => role.id === persistedState.state?.selectedRoleId)
      ? persistedState.state.selectedRoleId
      : nextRoles[0]?.id || ''
    if (persistedState.storageKey !== scopedKey || persistedState.source === 'firestore') {
      syncPermissionRolesStateToStorage()
    }
    markPermissionRolesStateAsSaved()
    isPermissionRolesHydrated.value = true
  } catch {
    resetPermissionRolesToDefault()
    markPermissionRolesStateAsSaved()
    isPermissionRolesHydrated.value = true
  }
}
const savePermissionRoles = async () => {
  if (!authUser.value) return
  if (!canEditBusinessModule('permissions')) {
    showPaymentToast('Your role has view-only access for Permissions.', 'warning')
    return
  }

  if (isSavingPermissionRoles.value) return

  isSavingPermissionRoles.value = true

  try {
    const result = await saveBusinessWorkspacePermissions({
      roles: permissionRoles.value,
      selectedRoleId: selectedPermissionRoleId.value,
    })
    const nextRoles = Array.isArray(result?.roles) && result.roles.length
      ? result.roles.map((role, index) => createPermissionRoleRecord(role, index))
      : permissionRoles.value.map((role, index) => createPermissionRoleRecord(role, index))
    const nextSelectedRoleId = nextRoles.some((role) => role.id === result?.selectedRoleId)
      ? result.selectedRoleId
      : nextRoles[0]?.id || ''

    permissionRoles.value = nextRoles
    selectedPermissionRoleId.value = nextSelectedRoleId
    syncPermissionRolesStateToStorage()

    const currentRoleId = String(authUser.value?.roleId || authUser.value?.permissionRoleId || '').trim()
    const matchedCurrentRole = nextRoles.find((role) => role.id === currentRoleId) || null
    const nextAuthUser = {
      ...authUser.value,
      workspace_permission_roles: clonePermissionRoles(nextRoles),
      workspacePermissionRoles: clonePermissionRoles(nextRoles),
    }
    const isWorkspaceMember =
      authUser.value?.workspace_member === true
      || Boolean(String(authUser.value?.workspace_owner_id || authUser.value?.workspaceOwnerId || '').trim())

    if (isWorkspaceMember && currentRoleId) {
      if (matchedCurrentRole) {
        nextAuthUser.permissionRoleName = matchedCurrentRole.name
        nextAuthUser.permissionRoleSnapshot = clonePermissionRoles([matchedCurrentRole])[0]
        nextAuthUser.workspace_permission_role = clonePermissionRoles([matchedCurrentRole])[0]
      } else {
        delete nextAuthUser.permissionRoleName
        delete nextAuthUser.permissionRoleSnapshot
        delete nextAuthUser.workspace_permission_role
      }
    }

    authUser.value = nextAuthUser
    localStorage.setItem('authUser', JSON.stringify(nextAuthUser))
    markPermissionRolesStateAsSaved()

    const updatedUsersLabel = Number.isFinite(Number(result?.updatedWorkspaceUserCount))
      ? `${Number(result.updatedWorkspaceUserCount)} workspace user${Number(result.updatedWorkspaceUserCount) === 1 ? '' : 's'}`
      : 'workspace users'
    showPaymentToast(`Permissions saved to Firebase. Updated ${updatedUsersLabel}.`, 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save workspace permissions right now.', 'error')
  } finally {
    isSavingPermissionRoles.value = false
  }
}
const getPermissionModulesForSection = (sectionId) => {
  const role = selectedPermissionRole.value
  if (!role) return []

  const section = permissionModuleSections.find((item) => item.id === sectionId)
  if (!section) return []

  return section.modules.map((moduleMeta) => {
    const roleModule = role.modules.find((module) => module.id === moduleMeta.id)

    return {
      ...moduleMeta,
      permissions: normalizePermissionModulePermissions(roleModule?.permissions),
    }
  })
}
const updatePermissionModuleAction = (moduleId, actionKey, enabled) => {
  if (!canEditBusinessModule('permissions')) return

  const role = selectedPermissionRole.value
  if (!role) return

  const module = role.modules.find((item) => item.id === moduleId)
  if (!module) return

  if (actionKey === 'view') {
    module.permissions.view = Boolean(enabled)
    if (!enabled) {
      module.permissions.edit = false
      module.permissions.full = false
    }
    return
  }

  if (actionKey === 'edit') {
    module.permissions.edit = Boolean(enabled)
    if (enabled) {
      module.permissions.view = true
    } else {
      module.permissions.full = false
    }
  }
}
const updatePermissionModuleFullAccess = (moduleId, enabled) => {
  if (!canEditBusinessModule('permissions')) return

  const role = selectedPermissionRole.value
  if (!role) return

  const module = role.modules.find((item) => item.id === moduleId)
  if (!module) return

  module.permissions.full = Boolean(enabled)
  if (enabled) {
    module.permissions.view = true
    module.permissions.edit = true
  }
}
const createPermissionRole = () => {
  if (!canEditBusinessModule('permissions')) {
    showPaymentToast('Your role has view-only access for Permissions.', 'warning')
    return
  }

  const normalizedName = String(permissionRoleDraftName.value || '').trim()
  if (!normalizedName) {
    showPaymentToast('Enter a role name before creating a new role.', 'warning')
    return
  }

  if (permissionRoles.value.some((role) => role.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
    showPaymentToast('That role already exists. Use a different role name.', 'warning')
    return
  }

  const nextRole = createPermissionRoleRecord({
    id: `role-${Date.now()}`,
    name: normalizedName,
    color: createPermissionRoleColor(permissionRoles.value.length),
    modules: createPermissionModules(),
  }, permissionRoles.value.length)

  permissionRoles.value = [...permissionRoles.value, nextRole]
  selectedPermissionRoleId.value = nextRole.id
  permissionRoleDraftName.value = ''
  setPermissionRoleEditMode(false)
  showPaymentToast('Role created. Configure its module access, then save permissions to keep it.', 'success')
}
const executePermissionRoleRemoval = (roleId) => {
  if (!canEditBusinessModule('permissions')) {
    showPaymentToast('Your role has view-only access for Permissions.', 'warning')
    return
  }

  const role = getPermissionRoleById(roleId)
  if (!role) return

  if (permissionRoles.value.length <= 1) {
    showPaymentToast('Keep at least one role in the permissions workspace.', 'warning')
    return
  }

  permissionRoles.value = permissionRoles.value.filter((item) => item.id !== role.id)
  selectedPermissionRoleId.value = permissionRoles.value[0]?.id || ''
  showPaymentToast('Role removed from the permissions list. Save permissions to keep this change.', 'success')
}
const removeSelectedPermissionRole = () => {
  if (!canEditBusinessModule('permissions')) {
    showPaymentToast('Your role has view-only access for Permissions.', 'warning')
    return
  }

  const role = selectedPermissionRole.value
  if (!role) return

  if (permissionRoles.value.length <= 1) {
    showPaymentToast('Keep at least one role in the permissions workspace.', 'warning')
    return
  }

  const assignedUsersCount = countUsersAssignedToRole(role.id)
  const assignedUsersMessage = assignedUsersCount > 0
    ? ` ${assignedUsersCount} assigned user account${assignedUsersCount === 1 ? '' : 's'} will stay active and show as Deleted role until you update them.`
    : ''

  showPaymentToast(
    `Delete ${role.name} from the permissions list?${assignedUsersMessage}`,
    'warning',
    {
      title: 'Confirm deletion',
      duration: 0,
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
          onClick: closePaymentToast,
        },
        {
          label: 'Delete role',
          variant: 'danger',
          onClick: () => executePermissionRoleRemoval(role.id),
        },
      ],
    },
  )
}
const resetUserManagementState = () => {
  employeeDirectory.value = createDefaultEmployeeDirectory()
  userAccountDraft.value = createDefaultUserAccountDraft()
  employeeDraft.value = createDefaultEmployeeDraft()
}
const resetWorkspaceUserDirectoryState = () => {
  workspaceUserDirectory.value = createDefaultWorkspaceUsers()
  isWorkspaceUserDirectoryLoading.value = false
  workspaceUserDirectorySyncMessage.value = ''
}
const resolveBusinessStartupSyncMessage = (error, fallbackMessage) => {
  const normalizedCode = String(error?.code || '').trim().toLowerCase()
  const rawMessage = String(error?.message || '').trim()
  const normalizedMessage = rawMessage.toLowerCase()

  if (
    normalizedCode.includes('permission-denied')
    || normalizedCode.includes('unauthenticated')
    || normalizedMessage.includes('insufficient permissions')
    || normalizedMessage.includes('missing or insufficient permissions')
  ) {
    return fallbackMessage
  }

  return rawMessage || fallbackMessage
}
const logBusinessStartupSyncIssue = (scope, error, fallbackMessage) => {
  const resolvedMessage = resolveBusinessStartupSyncMessage(error, fallbackMessage)
  console.warn(`[business-workspace] ${scope}`, error)
  return resolvedMessage
}
const persistEmployeeDirectoryState = () => {}
const restoreEmployeeDirectoryState = () => {
  employeeDirectory.value = createDefaultEmployeeDirectory()
  userAccountDraft.value = createDefaultUserAccountDraft()
  employeeDraft.value = createDefaultEmployeeDraft()
}
const getWorkspaceOwnerDirectoryId = (user = authUser.value) =>
  String(user?.workspace_owner_id || user?.workspaceOwnerId || user?.id || '').trim()
const startBusinessMemberEmployerSync = () => {
  stopBusinessMemberEmployerSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    employeeDirectory.value = createDefaultEmployeeDirectory()
    return
  }

  stopBusinessMemberEmployerSync = subscribeToBusinessMemberEmployers(
    workspaceOwnerId,
    (members) => {
      employeeDirectory.value = Array.isArray(members)
        ? members.map((member, index, list) => createEmployeeRecord(member, list.length - index))
        : createDefaultEmployeeDirectory()
    },
    (error) => {
      console.warn('[business-workspace] Member employer subscription failed.', error)
    },
  )
}
const startWorkspaceUserDirectorySync = () => {
  stopWorkspaceUserDirectorySync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    resetWorkspaceUserDirectoryState()
    return
  }

  isWorkspaceUserDirectoryLoading.value = true
  workspaceUserDirectorySyncMessage.value = ''
  void syncBusinessWorkspaceUserDirectory(workspaceOwnerId).catch((error) => {
    logBusinessStartupSyncIssue(
      'Workspace user directory sync skipped during startup.',
      error,
      'The workspace user directory could not be synchronized right now.',
    )
  })
  stopWorkspaceUserDirectorySync = subscribeToBusinessWorkspaceUsers(
    workspaceOwnerId,
    (workspaceUsers) => {
      workspaceUserDirectory.value = Array.isArray(workspaceUsers)
        ? workspaceUsers.map((user, index) => createWorkspaceUserRecord(user, index))
        : createDefaultWorkspaceUsers()
      isWorkspaceUserDirectoryLoading.value = false
      workspaceUserDirectorySyncMessage.value = ''
    },
    (error) => {
      isWorkspaceUserDirectoryLoading.value = false
      workspaceUserDirectorySyncMessage.value = logBusinessStartupSyncIssue(
        'Workspace user directory subscription failed during startup.',
        error,
        'The workspace user directory is unavailable for this account right now.',
      )
    },
  )
}
const startWorkspaceJobPostsSync = () => {
  stopWorkspaceJobsSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    postedJobs.value = []
    isPostedJobsLoading.value = false
    postedJobsSyncMessage.value = ''
    return
  }

  isPostedJobsLoading.value = true
  postedJobsSyncMessage.value = ''
  stopWorkspaceJobsSync = subscribeToWorkspaceJobs(
    workspaceOwnerId,
    (jobs) => {
      postedJobs.value = Array.isArray(jobs)
        ? jobs.map((job) => createPostedJobRecord(job))
        : []
      isPostedJobsLoading.value = false
      postedJobsSyncMessage.value = ''
    },
    (error) => {
      isPostedJobsLoading.value = false
      postedJobsSyncMessage.value = logBusinessStartupSyncIssue(
        'Posted jobs subscription failed during startup.',
        error,
        'The posted jobs list is unavailable right now.',
      )
    },
  )
}
const startBusinessJobApplicationsFirestoreSync = () => {
  stopBusinessJobApplicationsSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    businessJobApplications.value = []
    return
  }

  stopBusinessJobApplicationsSync = subscribeToBusinessJobApplications(
    workspaceOwnerId,
    (applications) => {
      businessJobApplications.value = Array.isArray(applications) ? applications : []
    },
    (error) => {
      console.warn('[business-workspace] Applicant applications subscription failed.', error)
    },
  )
}

const startBusinessInterviewSchedulesFirestoreSync = () => {
  stopBusinessInterviewSchedulesSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    businessInterviewSchedules.value = []
    return
  }

  stopBusinessInterviewSchedulesSync = subscribeToBusinessInterviewSchedules(
    workspaceOwnerId,
    (rows) => {
      businessInterviewSchedules.value = Array.isArray(rows) ? rows : []
      syncBusinessInterviewCalendar(businessInterviewSchedules.value)
    },
    (error) => {
      console.warn('[business-workspace] Interview schedule subscription failed.', error)
      businessInterviewSchedules.value = []
    },
  )
}
const closeJobPostingDropdownOnOutsideClick = (event) => {
  const target = event?.target
  if (!target) return

  const clickedInsideJobPostingDropdown = [
    jobPostingTypeDropdownRef.value,
    jobPostingBarangayDropdownRef.value,
    jobPostingDisabilityDropdownRef.value,
    jobPostingLanguageDropdownRef.value,
  ].some((entry) => entry?.contains?.(target))

  if (!clickedInsideJobPostingDropdown) {
    closeJobPostingDropdown()
  }
}
const handleJobPostingFieldChange = (key, value) => {
  if (key === 'disabilityType') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      disabilityType: value,
      impairmentSpecification: JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(value || '').trim())
        ? jobPostingDraft.value.impairmentSpecification
        : '',
    }
    return
  }

  if (key === 'salaryRange') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      salaryRange: formatJobPostingSalaryRangeInput(value),
    }
    return
  }

  jobPostingDraft.value = {
    ...jobPostingDraft.value,
    [key]: value,
  }
}
const saveJobPost = async () => {
  if (!canEditBusinessModule('job-posting')) {
    showPaymentToast('Your role has view-only access for Job Posting.', 'warning')
    return
  }

  if (isSavingJobPost.value) return

  const requiredFields = [
    ['job title', jobPostingDraft.value.title],
    ['company name', jobPostingCompanyNameDisplay.value],
    ['description', jobPostingDraft.value.description],
    ['category', jobPostingDraft.value.category],
    ['type', jobPostingDraft.value.type],
    ['location', jobPostingDraft.value.location],
    ['barangay', jobPostingDraft.value.barangay],
    ['vacancies', jobPostingDraft.value.vacancies],
    ['salary range', jobPostingDraft.value.salaryRange],
    ['disability type', jobPostingDraft.value.disabilityType],
    ['preferred age', jobPostingDraft.value.preferredAgeRange],
    ['language', jobPostingDraft.value.language],
    ['qualifications', jobPostingDraft.value.qualifications],
    ['responsibilities', jobPostingDraft.value.responsibilities],
  ].concat(
    jobPostingDisabilityTypeNeedsSpecification.value
      ? [['impairment specification', jobPostingDraft.value.impairmentSpecification]]
      : [],
  )

  const missingFields = requiredFields
    .filter(([, value]) => String(value ?? '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
    return
  }

  const vacancyCount = Number(jobPostingDraft.value.vacancies)
  if (!Number.isFinite(vacancyCount) || vacancyCount < 1 || vacancyCount > JOB_POSTING_MAX_VACANCIES) {
    showPaymentToast(`Vacancies must be between 1 and ${JOB_POSTING_MAX_VACANCIES}.`, 'warning')
    return
  }

  if (!parseJobPostingSalaryRange(jobPostingDraft.value.salaryRange).isValid) {
    showPaymentToast('Enter the salary as minimum - maximum, for example PHP 15,000 - PHP 20,000.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const employerId = String(authUser.value?.id || '').trim()

  if (!workspaceOwnerId || !employerId) {
    showPaymentToast('Refresh the page and sign in again before saving this job post.', 'error')
    return
  }

  try {
    isSavingJobPost.value = true
    const wasEditingJobPost = isEditingJobPost.value

    const payload = {
      title: jobPostingDraft.value.title,
      companyName: jobPostingCompanyNameDisplay.value,
      logoUrl: businessAvatar.value || profileForm.value.avatar || '',
      description: jobPostingDraft.value.description,
      category: jobPostingDraft.value.category,
      type: jobPostingDraft.value.type,
      setup: jobPostingDraft.value.type,
      location: jobPostingDraft.value.location,
      barangay: jobPostingDraft.value.barangay,
      vacancies: vacancyCount,
      salary: jobPostingSalaryPreview.value,
      salaryRange: jobPostingDraft.value.salaryRange,
      disabilityType: jobPostingDraft.value.disabilityType,
      impairmentSpecification: jobPostingDraft.value.impairmentSpecification,
      preferredAgeRange: jobPostingDraft.value.preferredAgeRange,
      language: jobPostingDraft.value.language,
      languages: jobPostingDraft.value.language,
      qualifications: toJobPostingLineItems(jobPostingDraft.value.qualifications),
      responsibilities: toJobPostingLineItems(jobPostingDraft.value.responsibilities),
      status: String(jobPostingDraft.value.status || 'open').trim().toLowerCase() || 'open',
      workspaceOwnerId,
      workspaceOwnerEmail,
      employerId,
      createdBy: employerId,
    }

    if (wasEditingJobPost) {
      await updateBusinessJobPost(editingJobPostId.value, payload)
    } else {
      await createBusinessJobPost(payload)
    }

    resetJobPostingDraft()
    jobPostingTab.value = 'posted'
    showPaymentToast(
      wasEditingJobPost
        ? 'Job post updated successfully.'
        : 'Job post published. It now appears in Posted Jobs and the public landing page.',
      'success',
    )
  } catch (error) {
    showPaymentToast(
      error instanceof Error
        ? error.message
        : isEditingJobPost.value
          ? 'Unable to update the job post right now.'
          : 'Unable to publish the job post right now.',
      'error',
    )
  } finally {
    isSavingJobPost.value = false
  }
}
const toJobPostingLineItems = (value) =>
  String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

const parseJobPostingCurrencyNumber = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

const parseJobPostingSalaryRange = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    return { min: 0, max: 0, label: '', isValid: false }
  }

  const parts = raw.split('-').map((part) => parseJobPostingCurrencyNumber(part))
  if (parts.length < 2 || parts[0] <= 0 || parts[1] <= 0) {
    return { min: 0, max: 0, label: '', isValid: false }
  }

  const min = Math.min(parts[0], parts[1])
  const max = Math.max(parts[0], parts[1])

  return {
    min,
    max,
    label: `PHP ${min.toLocaleString('en-US')} - PHP ${max.toLocaleString('en-US')}`,
    isValid: true,
  }
}

const formatJobPostingSalarySide = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return `PHP ${Number(digits).toLocaleString('en-US')}`
}

const formatJobPostingSalaryRangeInput = (value) => {
  const raw = String(value || '')
  const hasDash = raw.includes('-')
  const [leftRaw = '', rightRaw = ''] = raw.split('-', 2)
  const left = formatJobPostingSalarySide(leftRaw)
  const right = formatJobPostingSalarySide(rightRaw)

  if (hasDash) {
    if (left && right) return `${left} - ${right}`
    if (left) return `${left} - `
    if (right) return `- ${right}`
    return '- '
  }

  return left
}

const buildJobPostingDisabilityFitLabel = (disabilityType, impairmentSpecification) => {
  const category = String(disabilityType || '').trim()
  const specification = String(impairmentSpecification || '').trim()
  if (category && specification) return `${category} - ${specification}`
  return category || specification
}

const getJobPostingImpairmentSpecificationPlaceholder = (disabilityType) => {
  switch (String(disabilityType || '').trim()) {
    case 'Physical Impairment':
      return 'Example: Right leg, left arm, limited hand mobility'
    case 'Visual Impairment':
      return 'Example: Low vision, blind in right eye, legally blind'
    case 'Deaf or Hard of Hearing':
      return 'Example: Deaf, hard of hearing, bilateral hearing loss'
    case 'Hearing Impairment':
      return 'Example: Left ear, right ear, bilateral hearing loss'
    case 'Speech and Language Impairment':
      return 'Example: Stuttering, articulation disorder, expressive language'
    case 'Chronic Illness / Medical Condition':
      return 'Example: Chronic kidney disease, heart condition'
    case 'Multiple Disabilities':
      return 'Example: Visual impairment and hearing impairment'
    default:
      return 'Enter impairment specification'
  }
}
const businessApplicantHighlights = computed(() => {
  const allApplicants = businessJobApplications.value
  const totalApplicants = allApplicants.length
  const underReviewCount = allApplicants.filter((item) =>
    ['reviewing', 'under review', 'in_review'].includes(normalizeUserOverviewValue(item?.status)),
  ).length
  const interviewReadyCount = allApplicants.filter((item) =>
    normalizeUserOverviewValue(item?.status).includes('interview'),
  ).length

  return [
    { label: 'New Applicants', value: String(totalApplicants) },
    { label: 'Under Review', value: String(underReviewCount) },
    { label: 'Interview Ready', value: String(interviewReadyCount) },
  ]
})
const buildTemplateQuestionOptions = (type) => {
  const optionPresets = {
    'multiple-choice': ['', '', ''],
    checkboxes: ['', '', ''],
    rating: ['1', '2', '3', '4', '5'],
  }

  return optionPresets[type] ? [...optionPresets[type]] : []
}
const trainingQuestionTypeOptions = [
  { value: 'short-text', label: 'Short answer', icon: 'bi bi-input-cursor-text' },
  { value: 'paragraph', label: 'Paragraph', icon: 'bi bi-text-paragraph' },
  { value: 'multiple-choice', label: 'Multiple choice', icon: 'bi bi-ui-radios-grid' },
  { value: 'checkboxes', label: 'Checkboxes', icon: 'bi bi-ui-checks' },
  { value: 'rating', label: 'Rating scale', icon: 'bi bi-star-half' },
]
const selectedAssessmentQuestionType = ref('multiple-choice')
const assessmentTemplateLibrary = ref([])
const editingAssessmentTemplateId = ref('')
const assessmentManagementTab = ref('builder')
const assessmentAssignmentTab = ref('approved-applicants')
const interviewSchedulingTab = ref('schedule')
const trainingTemplatesTab = ref('builder')
const trainingAssignmentTab = ref('ready-members')
const trainingTemplateLibrary = ref([])
const editingTrainingTemplateId = ref('')
let trainingTemplateCategoryId = 1
let trainingTemplateSkillId = 1
let trainingTemplateId = 1
let assessmentTemplateQuestionId = 1
let assessmentTemplateId = 1
const createTrainingTemplateCategoryId = () => `training-category-${Date.now()}-${trainingTemplateCategoryId++}`
const createTrainingTemplateSkillId = () => `training-skill-${Date.now()}-${trainingTemplateSkillId++}`
const createTrainingTemplateId = () => `training-template-${Date.now()}-${trainingTemplateId++}`
const createAssessmentQuestionId = () => `assessment-question-${Date.now()}-${assessmentTemplateQuestionId++}`
const createAssessmentTemplateId = () => `assessment-template-${Date.now()}-${assessmentTemplateId++}`
const fallbackAssignableAssessmentTemplates = [
  { id: 'sample-frontend-screen', title: 'Frontend Technical Screen' },
  { id: 'sample-customer-support', title: 'Customer Support Screening' },
  { id: 'sample-operations-check', title: 'Operations Readiness Check' },
]
const approvedApplicantProfiles = ref([])
const fallbackTrainingTemplateAssignments = [
  {
    id: 'training-assignee-001',
    name: 'Camille Dela Cruz',
    role: 'Operations Assistant',
    email: 'camille.delacruz@example.com',
    stage: 'New hire onboarding',
    selectedTemplateId: 'training-template-onboarding',
    assignmentStatus: 'Assigned',
    assignedAt: 'Apr 02, 2026',
    progressStatus: 'In Progress',
  },
  {
    id: 'training-assignee-002',
    name: 'Noah Mendoza',
    role: 'Frontend Developer',
    email: 'noah.mendoza@example.com',
    stage: 'Role upskilling',
    selectedTemplateId: '',
    assignmentStatus: 'Pending',
    assignedAt: '',
    progressStatus: 'Not Started',
  },
  {
    id: 'training-assignee-003',
    name: 'Andrea Cruz',
    role: 'Customer Support Associate',
    email: 'andrea.cruz@example.com',
    stage: 'Customer service refresher',
    selectedTemplateId: '',
    assignmentStatus: 'Pending',
    assignedAt: '',
    progressStatus: 'Not Started',
  },
]
const fallbackAssessmentAssignments = [
  {
    id: 'approved-applicant-001',
    name: 'Miguel Santos',
    role: 'Frontend Developer',
    email: 'miguel.santos@example.com',
    approvalDate: 'Mar 28, 2026',
    score: '91%',
    selectedTemplateId: 'sample-frontend-screen',
    assignmentStatus: 'Assigned',
    assignedAt: 'Apr 02, 2026',
  },
  {
    id: 'approved-applicant-002',
    name: 'Andrea Cruz',
    role: 'Customer Support Associate',
    email: 'andrea.cruz@example.com',
    approvalDate: 'Mar 30, 2026',
    score: '88%',
    selectedTemplateId: '',
    assignmentStatus: 'Pending',
    assignedAt: '',
  },
  {
    id: 'approved-applicant-003',
    name: 'Joshua Rivera',
    role: 'Operations Assistant',
    email: 'joshua.rivera@example.com',
    approvalDate: 'Apr 01, 2026',
    score: '86%',
    selectedTemplateId: '',
    assignmentStatus: 'Pending',
    assignedAt: '',
  },
]
const assessmentAssignmentRecords = ref([])
const trainingAssignmentRecords = ref([])
const trainingTemplateAssignments = ref([])
const approvedApplicantTemplateAssignments = ref([])
const businessInterviewWeekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const createBusinessInterviewSchedulingForm = () => ({
  selectedJobKey: '',
  applicationId: '',
  interviewType: 'initial',
  scheduledAt: '',
  mode: 'in-person',
  locationOrLink: '',
  interviewer: '',
  notes: '',
})
let businessInterviewScheduleId = 1
const createBusinessInterviewScheduleId = () => `business-interview-schedule-${Date.now()}-${businessInterviewScheduleId++}`
const createBusinessInterviewScheduleIso = ({ days = 0, hours = 9, minutes = 0 } = {}) => {
  const scheduleDate = new Date()
  scheduleDate.setDate(scheduleDate.getDate() + days)
  scheduleDate.setHours(hours, minutes, 0, 0)
  return scheduleDate.toISOString()
}
const createBusinessInterviewDecisionScheduleOptions = (count = 1) =>
  Array.from({ length: Math.max(Number(count) || 1, 1) }, () => '')
const formatBusinessInterviewDateKey = (value) => {
  if (!value) return ''

  const parsedValue = value instanceof Date ? new Date(value) : new Date(String(value))
  if (Number.isNaN(parsedValue.getTime())) return ''

  const year = parsedValue.getFullYear()
  const month = String(parsedValue.getMonth() + 1).padStart(2, '0')
  const day = String(parsedValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const normalizeBusinessInterviewScheduleStatus = (value) =>
  String(value || 'scheduled').trim().toLowerCase()
const normalizeBusinessInterviewApplicantResponseStatus = (value) =>
  String(value || 'pending').trim().toLowerCase() || 'pending'
const resolveBusinessInterviewMirrorText = (...values) => {
  for (const value of values) {
    const normalizedValue = String(value || '').trim()
    if (normalizedValue) return normalizedValue
  }

  return ''
}
const resolveBusinessInterviewApplicantResponseStatus = (record = {}) =>
  normalizeBusinessInterviewApplicantResponseStatus(
    record?.applicantResponseStatus
      || record?.applicant_response_status
      || record?.interviewResponseStatus
      || record?.interview_response_status
      || 'pending',
  )
const normalizeBusinessInterviewScheduleOptions = (record = {}) => {
  const source = record?.availableScheduleOptions
    || record?.available_schedule_options
    || record?.interviewScheduleOptions
    || record?.interview_schedule_options
    || []
  if (!Array.isArray(source)) return []
  return [...new Set(source.map((value) => String(value || '').trim()).filter(Boolean))]
}
const parseBusinessInterviewTimestamp = (value) => {
  const parsedValue = Date.parse(String(value || '').trim())
  return Number.isFinite(parsedValue) ? parsedValue : 0
}
const getBusinessInterviewApplicationMirrorActivityTime = (record = {}) =>
  Math.max(
    parseBusinessInterviewTimestamp(record?.interviewRespondedAt),
    parseBusinessInterviewTimestamp(record?.interview_responded_at),
    parseBusinessInterviewTimestamp(record?.interviewDecidedAt),
    parseBusinessInterviewTimestamp(record?.interview_decided_at),
    parseBusinessInterviewTimestamp(record?.statusUpdatedAt),
    parseBusinessInterviewTimestamp(record?.status_updated_at),
    parseBusinessInterviewTimestamp(record?.updatedAt),
    parseBusinessInterviewTimestamp(record?.updated_at),
    parseBusinessInterviewTimestamp(record?.interviewDate),
    parseBusinessInterviewTimestamp(record?.interview_date),
    parseBusinessInterviewTimestamp(record?.interviewSchedule),
    parseBusinessInterviewTimestamp(record?.interview_schedule),
  )
const getBusinessInterviewRecordInterviewType = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.interviewType, record?.interview_type, 'initial') || 'initial'
const getBusinessInterviewRecordScheduledAt = (record = {}) =>
  resolveBusinessInterviewMirrorText(
    record?.scheduledAt,
    record?.scheduled_at,
    record?.interviewDate,
    record?.interview_date,
    record?.interviewSchedule,
    record?.interview_schedule,
  )
const getBusinessInterviewRecordMode = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.mode, record?.interviewMode, record?.interview_mode, 'in-person') || 'in-person'
const getBusinessInterviewRecordLocationOrLink = (record = {}) =>
  resolveBusinessInterviewMirrorText(
    record?.locationOrLink,
    record?.location_or_link,
    record?.interviewLocationOrLink,
    record?.interview_location_or_link,
  )
const getBusinessInterviewRecordNotes = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.notes, record?.interviewNotes, record?.interview_notes)
const getBusinessInterviewRecordApplicantResponseReason = (record = {}) =>
  resolveBusinessInterviewMirrorText(
    record?.applicantResponseReason,
    record?.applicant_response_reason,
    record?.interviewRescheduleReason,
    record?.interview_reschedule_reason,
  )
const getBusinessInterviewRecordRequestedScheduleAt = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.requestedScheduleAt, record?.requested_schedule_at, record?.interviewRequestedScheduleAt, record?.interview_requested_schedule_at)
const getBusinessInterviewRecordApplicantRespondedAt = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.applicantRespondedAt, record?.applicant_responded_at, record?.interviewRespondedAt, record?.interview_responded_at)
const getBusinessInterviewRecordBusinessDecisionReason = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.businessDecisionReason, record?.business_decision_reason, record?.interviewDecisionReason, record?.interview_decision_reason)
const getBusinessInterviewRecordBusinessDecidedAt = (record = {}) =>
  resolveBusinessInterviewMirrorText(record?.businessDecidedAt, record?.business_decided_at, record?.interviewDecidedAt, record?.interview_decided_at)
const getBusinessInterviewSchedulePriority = (record = {}) => {
  const scheduleStatus = normalizeBusinessInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  return ['completed', 'cancelled'].includes(scheduleStatus) ? 1 : 0
}
const shouldPreferBusinessInterviewSchedule = (nextRecord = {}, currentRecord = null) => {
  if (!currentRecord) return true

  const priorityDifference = getBusinessInterviewSchedulePriority(nextRecord) - getBusinessInterviewSchedulePriority(currentRecord)
  if (priorityDifference !== 0) return priorityDifference < 0

  return getBusinessInterviewActivityTime(nextRecord) >= getBusinessInterviewActivityTime(currentRecord)
}
const getBusinessInterviewActivityTime = (record = {}) =>
  Math.max(
    parseBusinessInterviewTimestamp(record?.updatedAt),
    parseBusinessInterviewTimestamp(record?.updated_at),
    parseBusinessInterviewTimestamp(record?.applicantRespondedAt),
    parseBusinessInterviewTimestamp(record?.applicant_responded_at),
    parseBusinessInterviewTimestamp(record?.interviewRespondedAt),
    parseBusinessInterviewTimestamp(record?.interview_responded_at),
    parseBusinessInterviewTimestamp(record?.businessDecidedAt),
    parseBusinessInterviewTimestamp(record?.business_decided_at),
    parseBusinessInterviewTimestamp(record?.interviewDecidedAt),
    parseBusinessInterviewTimestamp(record?.interview_decided_at),
    parseBusinessInterviewTimestamp(record?.scheduledAt),
    parseBusinessInterviewTimestamp(record?.scheduled_at),
    parseBusinessInterviewTimestamp(record?.interviewSchedule),
    parseBusinessInterviewTimestamp(record?.interview_schedule),
    parseBusinessInterviewTimestamp(record?.interviewDate),
    parseBusinessInterviewTimestamp(record?.interview_date),
    parseBusinessInterviewTimestamp(record?.createdAt),
    parseBusinessInterviewTimestamp(record?.created_at),
  )
const formatBusinessInterviewTime = (value) => {
  if (!value) return '-'

  const parsedValue = new Date(String(value))
  if (Number.isNaN(parsedValue.getTime())) return '-'

  return parsedValue.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
const formatBusinessInterviewDateTime = (value) => {
  if (!value) return 'Not scheduled'

  const parsedValue = new Date(String(value))
  if (Number.isNaN(parsedValue.getTime())) return 'Not scheduled'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedValue)
}
const toBusinessInterviewDateTimeLocalValue = (value) => {
  const parsedValue = new Date(String(value || ''))
  if (Number.isNaN(parsedValue.getTime())) return ''

  const offset = parsedValue.getTimezoneOffset()
  const adjustedValue = new Date(parsedValue.getTime() - (offset * 60 * 1000))
  return adjustedValue.toISOString().slice(0, 16)
}
const buildBusinessInterviewDecisionScheduleOptionDrafts = (values = []) => {
  const normalizedValues = (Array.isArray(values) ? values : [])
    .map((value) => toBusinessInterviewDateTimeLocalValue(value))
    .filter(Boolean)

  return normalizedValues.length ? normalizedValues : createBusinessInterviewDecisionScheduleOptions()
}
const formatBusinessInterviewTypeLabel = (value) =>
  String(value || 'initial').trim().toLowerCase() === 'final' ? 'Final Interview' : 'Initial Interview'
const formatBusinessInterviewModeLabel = (value) =>
  String(value || 'in-person').trim().toLowerCase() === 'online' ? 'Online interview' : 'In-person interview'
const resolveBusinessInterviewTechnicalStageText = (state) => {
  if (state === 'assigned') return 'Technical test assigned but not submitted yet.'
  if (state === 'failed') return 'Technical test completed but did not meet the passing score.'
  if (state === 'passed') return 'Technical test passed.'
  return 'Technical test not assigned yet.'
}
const formatBusinessInterviewTechnicalStageLabel = (state) => {
  if (state === 'assigned') return 'Technical Test Pending'
  if (state === 'failed') return 'Technical Test Failed'
  if (state === 'passed') return 'Ready for Interview'
  return 'Technical Test Not Assigned'
}
const businessInterviewAssessmentStateByApplication = computed(() => {
  const lookup = new Map()

  assessmentAssignmentRecords.value.forEach((entry) => {
    const applicationId = String(entry?.applicationId || entry?.id || '').trim()
    if (!applicationId) return

    const existingRecord = lookup.get(applicationId)
    const currentTime = Date.parse(String(entry?.submittedAt || entry?.updatedAt || entry?.assignedAt || '').trim()) || 0
    const existingTime = existingRecord
      ? Date.parse(String(existingRecord?.submittedAt || existingRecord?.updatedAt || existingRecord?.assignedAt || '').trim()) || 0
      : 0

    if (!existingRecord || currentTime >= existingTime) {
      const assessmentResult = normalizeAssessmentResultState(entry?.assessmentResult)
      const assessmentStatus = String(entry?.assessmentStatus || '').trim().toLowerCase()
      const hasAssignedTemplate = Boolean(String(entry?.selectedTemplateId || entry?.templateTitle || '').trim())

      lookup.set(applicationId, assessmentResult === 'passed'
        ? 'passed'
        : assessmentResult === 'failed'
          ? 'failed'
          : hasAssignedTemplate || ['assigned', 'in_progress', 'in progress', 'started', 'submitted', 'completed'].includes(assessmentStatus)
            ? 'assigned'
            : 'unassigned')
    }
  })

  return lookup
})
const businessInterviewApplicants = computed(() =>
  businessJobApplications.value
    .filter((entry) => isBusinessApplicationLinkedToPostedJob(entry))
    .map((entry) => {
      const normalizedStatus = String(entry?.status || '').trim().toLowerCase()
      const applicationId = String(entry?.id || '').trim()
      const technicalStage = businessInterviewAssessmentStateByApplication.value.get(applicationId)
        || (['interview', 'interviewed', 'hired'].includes(normalizedStatus) ? 'passed' : 'unassigned')

      return {
        id: applicationId,
        jobId: String(entry?.jobId || '').trim(),
        applicantName: String(entry?.applicantName || 'Applicant').trim() || 'Applicant',
        applicantEmail: String(entry?.applicantEmail || '').trim().toLowerCase(),
        applicantId: String(entry?.applicantId || entry?.applicantEmail || entry?.id || '').trim(),
        applicantAvatar: String(entry?.applicantAvatar || '').trim(),
        jobTitle: String(entry?.jobTitle || 'Applied Job').trim() || 'Applied Job',
        status: normalizedStatus || 'applied',
        technicalStage,
      }
    })
    .filter((entry) => entry.id),
)
const businessInterviewApplicationsById = computed(() => {
  const lookup = new Map()

  businessJobApplications.value.forEach((entry) => {
    const applicationId = String(entry?.id || '').trim()
    if (!applicationId) return
    lookup.set(applicationId, entry)
  })

  return lookup
})
const businessInterviewSchedules = ref([])
const upsertBusinessInterviewScheduleState = (record = {}) => {
  const normalizedId = String(record?.id || '').trim()
  if (!normalizedId) return

  businessInterviewSchedules.value = [
    ...businessInterviewSchedules.value.filter((entry) => String(entry?.id || '').trim() !== normalizedId),
    record,
  ].sort((left, right) => getBusinessInterviewActivityTime(right) - getBusinessInterviewActivityTime(left))

  syncBusinessInterviewCalendar(businessInterviewSchedules.value)
}
const businessInterviewSchedulingForm = ref(createBusinessInterviewSchedulingForm())
const businessInterviewSchedulingFormError = ref('')
const isBusinessInterviewRefreshing = ref(false)
const isBusinessInterviewRequestReviewOpen = ref(false)
const businessInterviewRequestReviewScheduleId = ref('')
const businessInterviewRequestDecisionMode = ref('view')
const businessInterviewRequestDecisionReason = ref('')
const businessInterviewRequestScheduleOptions = ref(createBusinessInterviewDecisionScheduleOptions())
const businessInterviewRequestDecisionError = ref('')
const isBusinessInterviewRequestDecisionSubmitting = ref(false)
const businessInterviewCalendarBaseDate = ref(new Date())
const businessInterviewSelectedCalendarDateKey = ref(formatBusinessInterviewDateKey(new Date()))
const businessInterviewEligibleApplicants = computed(() =>
  businessInterviewApplicants.value.filter((entry) =>
    ['accepted', 'approved', 'hired', 'interviewed', 'interview'].includes(String(entry.status || '').trim().toLowerCase()),
  ),
)
const businessInterviewAcceptedJobOptions = computed(() => {
  const groupedJobs = new Map()

  businessInterviewEligibleApplicants.value.forEach((entry) => {
    const jobKey = String(entry.jobId || entry.jobTitle || '').trim()
    if (!jobKey || groupedJobs.has(jobKey)) return

    groupedJobs.set(jobKey, {
      key: jobKey,
      title: String(entry.jobTitle || 'Untitled job').trim(),
    })
  })

  return Array.from(groupedJobs.values()).sort((left, right) => left.title.localeCompare(right.title))
})
const resolveBusinessInterviewTechnicalStage = (applicationId) => {
  const matchedApplicant = businessInterviewApplicants.value.find((entry) => entry.id === applicationId)
  const state = String(matchedApplicant?.technicalStage || 'unassigned').trim().toLowerCase()

  return {
    state,
    text: resolveBusinessInterviewTechnicalStageText(state),
  }
}
const hasBusinessInterviewPassedTechnicalAssessment = (applicationId) =>
  resolveBusinessInterviewTechnicalStage(applicationId).state === 'passed'
const businessInterviewSelectedJobAcceptedApplicants = computed(() => {
  const selectedJobKey = String(businessInterviewSchedulingForm.value.selectedJobKey || '').trim()
  if (!selectedJobKey) return []

  return businessInterviewEligibleApplicants.value.filter(
    (entry) => String(entry.jobId || entry.jobTitle || '').trim() === selectedJobKey,
  )
})
const businessInterviewFilteredApplicants = computed(() => {
  const selectedJobKey = String(businessInterviewSchedulingForm.value.selectedJobKey || '').trim()
  if (!selectedJobKey) return []

  return businessInterviewEligibleApplicants.value
    .filter((entry) => String(entry.jobId || entry.jobTitle || '').trim() === selectedJobKey)
    .filter((entry) => hasBusinessInterviewPassedTechnicalAssessment(entry.id))
    .sort((left, right) => left.applicantName.localeCompare(right.applicantName))
})
const businessInterviewTechnicalGateHint = computed(() => {
  const rows = businessInterviewSelectedJobAcceptedApplicants.value
  if (!rows.length) return ''
  if (rows.some((entry) => hasBusinessInterviewPassedTechnicalAssessment(entry.id))) return ''

  const stages = rows.map((entry) => resolveBusinessInterviewTechnicalStage(entry.id).state)
  if (stages.every((state) => state === 'unassigned')) return 'No technical test is assigned yet for these applicants.'
  if (stages.some((state) => state === 'assigned')) return 'Applicants must complete and pass the technical test before interview scheduling.'
  if (stages.every((state) => state === 'failed')) return 'Applicants completed the technical test but did not reach the passing score.'
  return 'Applicants must pass the technical test before interview scheduling.'
})
const businessInterviewSelectedApplicantSchedules = computed(() => {
  const applicationId = String(businessInterviewSchedulingForm.value.applicationId || '').trim()
  if (!applicationId) return []

  return businessInterviewSchedules.value.filter((entry) => String(entry.applicationId || '').trim() === applicationId)
})
const businessInterviewHasCompletedInitialInterview = computed(() =>
  businessInterviewSelectedApplicantSchedules.value.some(
    (entry) => entry.interviewType === 'initial' && normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'completed',
  ),
)
const hasCompletedBusinessInterviewType = (applicationId, interviewType = 'initial') => {
  const normalizedApplicationId = String(applicationId || '').trim()
  const normalizedInterviewType = String(interviewType || 'initial').trim().toLowerCase() || 'initial'

  if (!normalizedApplicationId) return false

  return businessInterviewSchedules.value.some((entry) =>
    String(entry?.applicationId || entry?.application_id || '').trim() === normalizedApplicationId
    && String(entry?.interviewType || entry?.interview_type || 'initial').trim().toLowerCase() === normalizedInterviewType
    && normalizeBusinessInterviewScheduleStatus(entry?.scheduleStatus || entry?.schedule_status) === 'completed')
}
const trainingEligibleApplicantProfiles = computed(() =>
  businessJobApplications.value
    .filter((application) =>
      isBusinessApplicationLinkedToPostedJob(application)
      && hasCompletedBusinessInterviewType(application?.id, 'final'),
    )
    .map((application) => ({
      id: String(application?.id || '').trim(),
      applicationId: String(application?.id || '').trim(),
      applicantId: String(application?.applicantId || application?.applicant_id || '').trim(),
      name: String(application?.applicantName || application?.applicant_name || 'Applicant').trim() || 'Applicant',
      email: String(application?.applicantEmail || application?.applicant_email || '').trim().toLowerCase(),
      role: String(application?.jobTitle || application?.job_title || 'Applied Job').trim() || 'Applied Job',
      jobId: String(application?.jobId || application?.job_id || '').trim(),
      jobTitle: String(application?.jobTitle || application?.job_title || 'Applied Job').trim() || 'Applied Job',
      stage: 'Final interview completed',
    }))
    .filter((application) => application.id)
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const businessInterviewAvailableInterviewTypeOptions = computed(() => {
  if (businessInterviewHasCompletedInitialInterview.value) {
    return [{ value: 'final', label: 'Final Interview' }]
  }

  return [{ value: 'initial', label: 'Initial Interview' }]
})
const isBusinessInterviewScheduleActive = (record = {}) => {
  const scheduleStatus = normalizeBusinessInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  return !['completed', 'cancelled'].includes(scheduleStatus)
}
const businessInterviewScheduledEntries = computed(() =>
  businessInterviewSchedules.value.filter((entry) => isBusinessInterviewScheduleActive(entry)),
)
const businessInterviewScheduledDateCounts = computed(() =>
  businessInterviewScheduledEntries.value.reduce((counts, entry) => {
    const dateKey = formatBusinessInterviewDateKey(entry.scheduledAt)
    if (!dateKey) return counts

    counts[dateKey] = (counts[dateKey] || 0) + 1
    return counts
  }, {}),
)
const businessInterviewCalendarMonthLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(businessInterviewCalendarBaseDate.value),
)
const businessInterviewSelectedCalendarLabel = computed(() => {
  if (!businessInterviewSelectedCalendarDateKey.value) return 'Select a date'

  const parsedValue = new Date(`${businessInterviewSelectedCalendarDateKey.value}T00:00:00`)
  if (Number.isNaN(parsedValue.getTime())) return businessInterviewSelectedCalendarDateKey.value

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedValue)
})
const businessInterviewSelectedDaySchedules = computed(() =>
  businessInterviewScheduledEntries.value
    .filter((entry) => formatBusinessInterviewDateKey(entry.scheduledAt) === businessInterviewSelectedCalendarDateKey.value)
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()),
)
const businessInterviewMinScheduleDateTime = computed(() => {
  const now = new Date()
  now.setSeconds(0, 0)

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
})
const normalizeBusinessInterviewDecisionScheduleOptions = (values = []) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => {
        const parsedValue = Date.parse(value)
        return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : ''
      })
      .filter((value) => {
        const parsedValue = Date.parse(value)
        return Number.isFinite(parsedValue) && parsedValue >= Date.now()
      }),
  )].sort((left, right) => Date.parse(left) - Date.parse(right))
const businessInterviewCalendarDays = computed(() => {
  const baseDate = businessInterviewCalendarBaseDate.value
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)
  const todayKey = formatBusinessInterviewDateKey(new Date())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    const dateKey = formatBusinessInterviewDateKey(day)

    return {
      key: `${dateKey}-${index}`,
      dateKey,
      label: day.getDate(),
      isCurrentMonth: day.getMonth() === month,
      isToday: dateKey === todayKey,
      isSelected: dateKey === businessInterviewSelectedCalendarDateKey.value,
      isPastDate: dateKey < todayKey,
      scheduleCount: businessInterviewScheduledDateCounts.value[dateKey] || 0,
    }
  })
})
const businessInterviewScheduleStats = computed(() => ({
  total: businessInterviewSchedules.value.length,
  scheduled: businessInterviewSchedules.value.filter((entry) => isBusinessInterviewScheduleActive(entry)).length,
  completed: businessInterviewSchedules.value.filter(
    (entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'completed',
  ).length,
}))
const buildBusinessInterviewApplicationMirrorFallback = (application = {}) => {
  const scheduledAt = getBusinessInterviewRecordScheduledAt(application)
  const requestedScheduleAt = getBusinessInterviewRecordRequestedScheduleAt(application)
  const availableScheduleOptions = normalizeBusinessInterviewScheduleOptions(application)
  const responseStatus = resolveBusinessInterviewApplicantResponseStatus(application)
  const businessDecisionReason = getBusinessInterviewRecordBusinessDecisionReason(application)
  const applicantRespondedAt = getBusinessInterviewRecordApplicantRespondedAt(application)

  if (!scheduledAt && !requestedScheduleAt && !availableScheduleOptions.length && !businessDecisionReason && !applicantRespondedAt) {
    return null
  }

  return {
    id: '',
    applicationId: String(application?.id || '').trim(),
    applicantId: String(application?.applicantId || application?.applicant_id || '').trim(),
    applicantName: String(application?.applicantName || application?.applicant_name || 'Applicant').trim() || 'Applicant',
    applicantEmail: String(application?.applicantEmail || application?.applicant_email || '').trim().toLowerCase(),
    applicantAvatar: String(application?.applicantAvatar || application?.applicant_avatar || '').trim(),
    jobId: String(application?.jobId || application?.job_id || '').trim(),
    jobTitle: String(application?.jobTitle || application?.job_title || 'Applied Job').trim() || 'Applied Job',
    interviewType: getBusinessInterviewRecordInterviewType(application),
    scheduledAt,
    mode: getBusinessInterviewRecordMode(application),
    locationOrLink: getBusinessInterviewRecordLocationOrLink(application),
    interviewer: String(application?.interviewer || '').trim(),
    notes: getBusinessInterviewRecordNotes(application),
    scheduleStatus: 'scheduled',
    applicantResponseStatus: responseStatus,
    applicantResponseReason: getBusinessInterviewRecordApplicantResponseReason(application),
    requestedScheduleAt,
    applicantRespondedAt,
    businessDecisionReason,
    businessDecidedAt: getBusinessInterviewRecordBusinessDecidedAt(application),
    availableScheduleOptions,
  }
}
const mergeBusinessInterviewScheduleWithApplication = (schedule = {}, application = null) => {
  if (!application || typeof application !== 'object') return schedule

  const applicationMirrorIsPreferred =
    getBusinessInterviewApplicationMirrorActivityTime(application) > getBusinessInterviewActivityTime(schedule)
  const preferredRecord = applicationMirrorIsPreferred ? application : schedule
  const fallbackRecord = applicationMirrorIsPreferred ? schedule : application
  const preferredOptions = normalizeBusinessInterviewScheduleOptions(preferredRecord)
  const fallbackOptions = normalizeBusinessInterviewScheduleOptions(fallbackRecord)

  return {
    ...schedule,
    applicationId: resolveBusinessInterviewMirrorText(schedule?.applicationId, schedule?.application_id, application?.id),
    applicantId: resolveBusinessInterviewMirrorText(schedule?.applicantId, schedule?.applicant_id, application?.applicantId, application?.applicant_id),
    applicantName: resolveBusinessInterviewMirrorText(schedule?.applicantName, schedule?.applicant_name, application?.applicantName, application?.applicant_name, 'Applicant') || 'Applicant',
    applicantEmail: resolveBusinessInterviewMirrorText(schedule?.applicantEmail, schedule?.applicant_email, application?.applicantEmail, application?.applicant_email).toLowerCase(),
    applicantAvatar: resolveBusinessInterviewMirrorText(schedule?.applicantAvatar, schedule?.applicant_avatar, application?.applicantAvatar, application?.applicant_avatar),
    jobId: resolveBusinessInterviewMirrorText(schedule?.jobId, schedule?.job_id, application?.jobId, application?.job_id),
    jobTitle: resolveBusinessInterviewMirrorText(schedule?.jobTitle, schedule?.job_title, application?.jobTitle, application?.job_title, 'Applied Job') || 'Applied Job',
    interviewType: getBusinessInterviewRecordInterviewType(preferredRecord) || getBusinessInterviewRecordInterviewType(fallbackRecord),
    scheduledAt: getBusinessInterviewRecordScheduledAt(preferredRecord) || getBusinessInterviewRecordScheduledAt(fallbackRecord),
    mode: getBusinessInterviewRecordMode(preferredRecord) || getBusinessInterviewRecordMode(fallbackRecord),
    interviewer: resolveBusinessInterviewMirrorText(preferredRecord?.interviewer, fallbackRecord?.interviewer),
    locationOrLink: getBusinessInterviewRecordLocationOrLink(preferredRecord) || getBusinessInterviewRecordLocationOrLink(fallbackRecord),
    notes: getBusinessInterviewRecordNotes(preferredRecord) || getBusinessInterviewRecordNotes(fallbackRecord),
    applicantResponseStatus: resolveBusinessInterviewApplicantResponseStatus(preferredRecord) || resolveBusinessInterviewApplicantResponseStatus(fallbackRecord),
    applicantResponseReason: getBusinessInterviewRecordApplicantResponseReason(preferredRecord) || getBusinessInterviewRecordApplicantResponseReason(fallbackRecord),
    requestedScheduleAt: getBusinessInterviewRecordRequestedScheduleAt(preferredRecord) || getBusinessInterviewRecordRequestedScheduleAt(fallbackRecord),
    applicantRespondedAt: getBusinessInterviewRecordApplicantRespondedAt(preferredRecord) || getBusinessInterviewRecordApplicantRespondedAt(fallbackRecord),
    businessDecisionReason: getBusinessInterviewRecordBusinessDecisionReason(preferredRecord) || getBusinessInterviewRecordBusinessDecisionReason(fallbackRecord),
    businessDecidedAt: getBusinessInterviewRecordBusinessDecidedAt(preferredRecord) || getBusinessInterviewRecordBusinessDecidedAt(fallbackRecord),
    availableScheduleOptions: preferredOptions.length ? preferredOptions : fallbackOptions,
  }
}
const getLatestBusinessInterviewSchedule = (applicationId) => {
  const normalizedApplicationId = String(applicationId || '').trim()
  if (!normalizedApplicationId) return null

  const linkedApplication = businessInterviewApplicationsById.value.get(normalizedApplicationId) || null
  const latestSchedule = businessInterviewSchedules.value
    .filter((entry) => String(entry.applicationId || '').trim() === normalizedApplicationId)
    .reduce((selectedRecord, entry) => (shouldPreferBusinessInterviewSchedule(entry, selectedRecord) ? entry : selectedRecord), null)
  if (latestSchedule) {
    return mergeBusinessInterviewScheduleWithApplication(latestSchedule, linkedApplication)
  }

  return buildBusinessInterviewApplicationMirrorFallback(linkedApplication)
}
const formatBusinessInterviewApplicantResponseLabel = (schedule = {}) => {
  const scheduleStatus = normalizeBusinessInterviewScheduleStatus(schedule?.scheduleStatus || schedule?.schedule_status)
  const responseStatus = resolveBusinessInterviewApplicantResponseStatus(schedule)

  if (scheduleStatus === 'completed') return 'Completed'
  if (responseStatus === 'reschedule_rejected') return 'Rejected'
  if (scheduleStatus === 'cancelled') return 'Cancelled'
  if (responseStatus === 'confirmed') return 'Confirmed'
  if (responseStatus === 'reschedule_requested') return 'Reschedule Requested'
  if (normalizeBusinessInterviewScheduleOptions(schedule).length) return 'Options Shared'
  return 'Awaiting Applicant'
}
const buildBusinessInterviewApplicationPayload = (schedule = {}, overrides = {}) => ({
  status: String(overrides.status ?? 'interview').trim() || 'interview',
  interviewSchedule: String(overrides.interviewSchedule ?? schedule?.scheduledAt ?? '').trim(),
  interviewDate: String(overrides.interviewDate ?? schedule?.scheduledAt ?? '').trim(),
  interviewType: String(overrides.interviewType ?? schedule?.interviewType ?? schedule?.interview_type ?? 'initial').trim() || 'initial',
  interviewer: String(overrides.interviewer ?? schedule?.interviewer ?? '').trim(),
  interviewMode: String(overrides.interviewMode ?? schedule?.mode ?? '').trim(),
  interviewLocationOrLink: String(overrides.interviewLocationOrLink ?? schedule?.locationOrLink ?? '').trim(),
  interviewNotes: String(overrides.interviewNotes ?? schedule?.notes ?? '').trim(),
  interviewResponseStatus: String(overrides.interviewResponseStatus ?? schedule?.applicantResponseStatus ?? '').trim(),
  interviewRescheduleReason: String(overrides.interviewRescheduleReason ?? schedule?.applicantResponseReason ?? '').trim(),
  interviewRequestedScheduleAt: String(overrides.interviewRequestedScheduleAt ?? schedule?.requestedScheduleAt ?? '').trim(),
  interviewDecisionReason: String(overrides.interviewDecisionReason ?? schedule?.businessDecisionReason ?? '').trim(),
  interviewRespondedAt: String(overrides.interviewRespondedAt ?? schedule?.applicantRespondedAt ?? '').trim(),
  interviewDecidedAt: String(overrides.interviewDecidedAt ?? schedule?.businessDecidedAt ?? '').trim(),
  interviewScheduleOptions: Array.isArray(overrides.interviewScheduleOptions)
    ? overrides.interviewScheduleOptions.map((value) => String(value || '').trim()).filter(Boolean)
    : normalizeBusinessInterviewScheduleOptions(schedule),
})
const selectedBusinessInterviewReviewSchedule = computed(() =>
  (() => {
    const scheduleId = String(businessInterviewRequestReviewScheduleId.value || '').trim()
    if (!scheduleId) return null

    const schedule = businessInterviewSchedules.value.find((entry) =>
      String(entry?.id || '').trim() === scheduleId) || null
    if (!schedule) return null

    return mergeBusinessInterviewScheduleWithApplication(
      schedule,
      businessInterviewApplicationsById.value.get(String(schedule?.applicationId || '').trim()) || null,
    )
  })(),
)
const resolveBusinessInterviewStatusBadgeClass = (tone) => {
  if (tone === 'scheduled') return 'is-scheduled'
  if (tone === 'completed') return 'is-completed'
  if (tone === 'ready') return 'is-ready'
  if (tone === 'blocked') return 'is-blocked'
  return 'is-pending'
}
const businessInterviewStatusRows = computed(() => {
  const statusPriority = {
    scheduled: 0,
    ready: 1,
    pending: 2,
    completed: 3,
    blocked: 4,
  }

  return businessInterviewApplicants.value
    .map((applicant) => {
      const technicalStage = resolveBusinessInterviewTechnicalStage(applicant.id).state
      const latestSchedule = getLatestBusinessInterviewSchedule(applicant.id)

      if (latestSchedule) {
        const scheduleStatus = normalizeBusinessInterviewScheduleStatus(latestSchedule.scheduleStatus)
        const responseStatus = resolveBusinessInterviewApplicantResponseStatus(latestSchedule)
        const statusTone = scheduleStatus === 'completed'
          ? 'completed'
          : responseStatus === 'reschedule_requested'
            ? 'pending'
            : responseStatus === 'reschedule_rejected'
              ? 'blocked'
              : 'scheduled'
        const responseLabel = formatBusinessInterviewApplicantResponseLabel(latestSchedule)
        const requestedScheduleLabel = formatBusinessInterviewDateTime(latestSchedule.requestedScheduleAt)
        const requestReason = String(latestSchedule.applicantResponseReason || '').trim()
        const decisionReason = String(latestSchedule.businessDecisionReason || '').trim()
        const availableScheduleSummary = normalizeBusinessInterviewScheduleOptions(latestSchedule)
          .slice(0, 3)
          .map((value) => formatBusinessInterviewDateTime(value))
          .join(', ')

        return {
          id: applicant.id,
          scheduleId: String(latestSchedule.id || '').trim(),
          applicationId: applicant.id,
          applicantName: applicant.applicantName,
          applicantEmail: applicant.applicantEmail,
          applicantId: applicant.applicantId,
          jobTitle: applicant.jobTitle,
          currentStage: formatBusinessInterviewTypeLabel(latestSchedule.interviewType),
          stageDetail: formatBusinessInterviewModeLabel(latestSchedule.mode),
          scheduleLabel: formatBusinessInterviewDateTime(latestSchedule.scheduledAt),
          interviewer: latestSchedule.interviewer || 'TBD',
          statusLabel: responseLabel,
          statusTone,
          requestDetail: responseStatus === 'reschedule_requested'
            ? `${requestedScheduleLabel}${requestReason ? ` - ${requestReason}` : ''}`
            : responseStatus === 'reschedule_rejected'
              ? decisionReason || 'Reschedule request rejected and application closed by the business owner.'
              : availableScheduleSummary
                ? `${decisionReason || 'Available reschedule dates shared with the applicant.'} ${availableScheduleSummary}`
              : responseStatus === 'confirmed'
                ? `Applicant confirmed ${formatBusinessInterviewDateTime(latestSchedule.scheduledAt)}.`
                : 'Waiting for the applicant to confirm or request a new schedule.',
          canReviewRequest: responseStatus === 'reschedule_requested' && Boolean(String(latestSchedule.id || '').trim()),
          canMarkCompleted: scheduleStatus !== 'completed'
            && responseStatus === 'confirmed',
        }
      }

      if (technicalStage === 'passed') {
        return {
          id: applicant.id,
          scheduleId: '',
          applicationId: applicant.id,
          applicantName: applicant.applicantName,
          applicantEmail: applicant.applicantEmail,
          applicantId: applicant.applicantId,
          jobTitle: applicant.jobTitle,
          currentStage: 'Ready for Interview',
          stageDetail: resolveBusinessInterviewTechnicalStageText(technicalStage),
          scheduleLabel: 'Not scheduled',
          interviewer: 'TBD',
          statusLabel: 'Ready to Schedule',
          statusTone: 'ready',
          requestDetail: 'Technical assessment passed. This applicant can now be scheduled.',
          canReviewRequest: false,
          canMarkCompleted: false,
        }
      }

      return {
        id: applicant.id,
        scheduleId: '',
        applicationId: applicant.id,
        applicantName: applicant.applicantName,
        applicantEmail: applicant.applicantEmail,
        applicantId: applicant.applicantId,
        jobTitle: applicant.jobTitle,
        currentStage: formatBusinessInterviewTechnicalStageLabel(technicalStage),
        stageDetail: resolveBusinessInterviewTechnicalStageText(technicalStage),
        scheduleLabel: 'Not scheduled',
        interviewer: 'TBD',
        statusLabel: technicalStage === 'assigned' ? 'Awaiting Technical Test' : 'On Hold',
        statusTone: technicalStage === 'assigned' ? 'pending' : 'blocked',
        requestDetail: technicalStage === 'assigned'
          ? 'Technical assessment assigned. Waiting for the applicant to submit and pass it.'
          : 'This applicant is not yet eligible for interview scheduling.',
        canReviewRequest: false,
        canMarkCompleted: false,
      }
    })
    .sort((left, right) => {
      const priorityDifference = (statusPriority[left.statusTone] ?? 99) - (statusPriority[right.statusTone] ?? 99)
      if (priorityDifference) return priorityDifference

      return left.applicantName.localeCompare(right.applicantName)
    })
})
const businessInterviewStatusSummary = computed(() => ({
  total: businessInterviewStatusRows.value.length,
  ready: businessInterviewStatusRows.value.filter((entry) => entry.statusTone === 'ready').length,
  scheduled: businessInterviewStatusRows.value.filter((entry) => entry.scheduleId && entry.statusTone !== 'completed').length,
  completed: businessInterviewStatusRows.value.filter((entry) => entry.statusTone === 'completed').length,
}))
const syncBusinessInterviewCalendar = (rows = businessInterviewSchedules.value) => {
  const scheduledRows = rows
    .filter((entry) => isBusinessInterviewScheduleActive(entry))
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())

  if (scheduledRows.length) {
    const focusDate = new Date(String(scheduledRows[0].scheduledAt))
    businessInterviewCalendarBaseDate.value = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
    businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(focusDate)
    return
  }

  const now = new Date()
  businessInterviewCalendarBaseDate.value = new Date(now.getFullYear(), now.getMonth(), 1)
  businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(now)
}
const resetBusinessInterviewSchedulingForm = () => {
  businessInterviewSchedulingForm.value = createBusinessInterviewSchedulingForm()
  businessInterviewSchedulingFormError.value = ''
}
const refreshBusinessInterviewApplicants = async () => {
  if (isBusinessInterviewRefreshing.value) return

  isBusinessInterviewRefreshing.value = true
  await new Promise((resolve) => setTimeout(resolve, 450))
  isBusinessInterviewRefreshing.value = false
  showPaymentToast('Interview applicants sync automatically now. The queue has been refreshed.', 'success')
}
const completeBusinessInterviewSchedule = async (scheduleId) => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = businessInterviewSchedules.value.find((entry) =>
    String(entry?.id || '').trim() === String(scheduleId || '').trim())
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    showPaymentToast('That interview schedule could not be found.', 'error')
    return
  }

  try {
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduleStatus: 'completed',
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord),
    )
    showPaymentToast(
      String(targetSchedule.interviewType || '').trim().toLowerCase() === 'initial'
        ? 'Initial interview marked as completed. Final interview scheduling is now available for this applicant.'
        : 'Final interview marked as completed.',
      'success',
    )
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to mark this interview as completed right now.', 'error')
  }
}
const closeBusinessInterviewRequestReview = () => {
  isBusinessInterviewRequestReviewOpen.value = false
  businessInterviewRequestReviewScheduleId.value = ''
  businessInterviewRequestDecisionMode.value = 'view'
  businessInterviewRequestDecisionReason.value = ''
  businessInterviewRequestScheduleOptions.value = createBusinessInterviewDecisionScheduleOptions()
  businessInterviewRequestDecisionError.value = ''
}
const addBusinessInterviewRequestScheduleOption = () => {
  businessInterviewRequestScheduleOptions.value = [
    ...businessInterviewRequestScheduleOptions.value,
    '',
  ]
}

const openBusinessInterviewRequestReview = (scheduleId) => {
  const rawSchedule = businessInterviewSchedules.value.find((entry) =>
    String(entry?.id || '').trim() === String(scheduleId || '').trim())
  const targetSchedule = rawSchedule
    ? mergeBusinessInterviewScheduleWithApplication(
      rawSchedule,
      businessInterviewApplicationsById.value.get(String(rawSchedule?.applicationId || '').trim()) || null,
    )
    : null
  if (!targetSchedule) {
    showPaymentToast('That interview request could not be found.', 'error')
    return
  }

  businessInterviewRequestReviewScheduleId.value = String(targetSchedule.id || '').trim()
  businessInterviewRequestDecisionMode.value = 'view'
  businessInterviewRequestDecisionReason.value = ''
  businessInterviewRequestScheduleOptions.value = createBusinessInterviewDecisionScheduleOptions()
  businessInterviewRequestDecisionError.value = ''
  const nextOptionValues = normalizeBusinessInterviewScheduleOptions(targetSchedule)
  if (nextOptionValues.length) {
    businessInterviewRequestScheduleOptions.value = buildBusinessInterviewDecisionScheduleOptionDrafts(nextOptionValues)
  } else {
    const preferredOption = String(targetSchedule.requestedScheduleAt || targetSchedule.scheduledAt || '').trim()
    businessInterviewRequestScheduleOptions.value = buildBusinessInterviewDecisionScheduleOptionDrafts(
      preferredOption ? [preferredOption] : [],
    )
  }
  isBusinessInterviewRequestReviewOpen.value = true
}

const approveBusinessInterviewRescheduleRequest = async () => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = selectedBusinessInterviewReviewSchedule.value
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    businessInterviewRequestDecisionError.value = 'That interview request could not be found.'
    return
  }

  const availableScheduleOptions = normalizeBusinessInterviewDecisionScheduleOptions(
    businessInterviewRequestScheduleOptions.value,
  )
  if (!availableScheduleOptions.length) {
    businessInterviewRequestDecisionError.value = 'Add at least one current or future interview date before approving.'
    return
  }

  if (isBusinessInterviewRequestDecisionSubmitting.value) return

  try {
    isBusinessInterviewRequestDecisionSubmitting.value = true
    businessInterviewRequestDecisionError.value = ''
    const decisionAt = new Date().toISOString()
    const approvalNote = availableScheduleOptions.length > 1
      ? 'Reschedule approved. Review the available interview dates from the business owner and confirm one schedule.'
      : 'Reschedule approved. Review the updated interview time and confirm your attendance.'
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduledAt: availableScheduleOptions[0],
      scheduleStatus: 'scheduled',
      applicantResponseStatus: 'pending',
      applicantResponseReason: '',
      requestedScheduleAt: '',
      applicantRespondedAt: '',
      businessDecisionReason: approvalNote,
      businessDecidedAt: decisionAt,
      availableScheduleOptions,
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord, {
        interviewSchedule: nextScheduleRecord.scheduledAt,
        interviewDate: nextScheduleRecord.scheduledAt,
        interviewResponseStatus: 'pending',
        interviewRescheduleReason: '',
        interviewRequestedScheduleAt: '',
        interviewDecisionReason: approvalNote,
        interviewRespondedAt: '',
        interviewDecidedAt: decisionAt,
        interviewScheduleOptions: availableScheduleOptions,
      }),
    )

    const approvedDate = new Date(availableScheduleOptions[0])
    businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(approvedDate)
    businessInterviewCalendarBaseDate.value = new Date(approvedDate.getFullYear(), approvedDate.getMonth(), 1)
    closeBusinessInterviewRequestReview()
    showPaymentToast('Reschedule request approved. The shared interview date options are now live for the applicant.', 'success')
  } catch (error) {
    businessInterviewRequestDecisionError.value = error instanceof Error ? error.message : 'Unable to approve the reschedule request right now.'
  } finally {
    isBusinessInterviewRequestDecisionSubmitting.value = false
  }
}

const rejectBusinessInterviewRescheduleRequest = async () => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = selectedBusinessInterviewReviewSchedule.value
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    businessInterviewRequestDecisionError.value = 'That interview request could not be found.'
    return
  }

  const rejectionReason = String(businessInterviewRequestDecisionReason.value || '').trim()
  if (!rejectionReason) {
    businessInterviewRequestDecisionError.value = 'Enter a reason before rejecting the reschedule request.'
    return
  }

  if (isBusinessInterviewRequestDecisionSubmitting.value) return

  try {
    isBusinessInterviewRequestDecisionSubmitting.value = true
    businessInterviewRequestDecisionError.value = ''
    const decisionAt = new Date().toISOString()
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduleStatus: 'cancelled',
      applicantResponseStatus: 'reschedule_rejected',
      businessDecisionReason: rejectionReason,
      businessDecidedAt: decisionAt,
      availableScheduleOptions: [],
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord, {
        status: 'rejected',
        interviewResponseStatus: 'reschedule_rejected',
        interviewRescheduleReason: nextScheduleRecord.applicantResponseReason,
        interviewRequestedScheduleAt: nextScheduleRecord.requestedScheduleAt,
        interviewDecisionReason: rejectionReason,
        interviewRespondedAt: nextScheduleRecord.applicantRespondedAt,
        interviewDecidedAt: decisionAt,
        interviewScheduleOptions: [],
        rejectionReason,
      }),
    )

    closeBusinessInterviewRequestReview()
    showPaymentToast('Reschedule request rejected. The reason is now visible to the applicant and the application has been closed.', 'success')
  } catch (error) {
    businessInterviewRequestDecisionError.value = error instanceof Error ? error.message : 'Unable to reject the reschedule request right now.'
  } finally {
    isBusinessInterviewRequestDecisionSubmitting.value = false
  }
}

const createBusinessInterviewSchedule = async () => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  businessInterviewSchedulingFormError.value = ''
  const selectedApplicant = businessInterviewFilteredApplicants.value.find(
    (entry) => entry.id === businessInterviewSchedulingForm.value.applicationId,
  )
  if (!selectedApplicant) {
    businessInterviewSchedulingFormError.value = 'Please select an accepted applicant for the selected job.'
    return
  }

  if (!hasBusinessInterviewPassedTechnicalAssessment(selectedApplicant.id)) {
    businessInterviewSchedulingFormError.value = resolveBusinessInterviewTechnicalStage(selectedApplicant.id).text
    return
  }

  if (!businessInterviewAvailableInterviewTypeOptions.value.some(
    (option) => option.value === businessInterviewSchedulingForm.value.interviewType,
  )) {
    businessInterviewSchedulingFormError.value = 'Invalid interview type for this applicant stage.'
    return
  }

  const scheduleTimestamp = Date.parse(businessInterviewSchedulingForm.value.scheduledAt)
  if (Number.isNaN(scheduleTimestamp) || scheduleTimestamp < Date.now()) {
    businessInterviewSchedulingFormError.value = 'Please select a valid future date and time.'
    return
  }

  const duplicateSchedule = businessInterviewSchedules.value.find((entry) =>
    entry.applicationId === selectedApplicant.id
    && entry.interviewType === businessInterviewSchedulingForm.value.interviewType
    && normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) !== 'cancelled',
  )
  if (duplicateSchedule) {
    businessInterviewSchedulingFormError.value = `A scheduled ${businessInterviewSchedulingForm.value.interviewType} interview already exists for this applicant.`
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerName = String(businessName.value || authUser.value?.company_name || authUser.value?.name || 'Business Workspace').trim()
  const workspaceOwnerEmail = String(authUser.value?.email || '').trim().toLowerCase()
  const nextSchedule = {
    id: createBusinessInterviewScheduleId(),
    workspaceOwnerId,
    workspaceOwnerName,
    workspaceOwnerEmail,
    applicationId: selectedApplicant.id,
    applicantName: selectedApplicant.applicantName,
    applicantEmail: selectedApplicant.applicantEmail,
    applicantId: selectedApplicant.applicantId,
    applicantAvatar: selectedApplicant.applicantAvatar,
    jobId: selectedApplicant.jobId,
    jobTitle: selectedApplicant.jobTitle,
    interviewType: businessInterviewSchedulingForm.value.interviewType,
    scheduledAt: new Date(scheduleTimestamp).toISOString(),
    mode: businessInterviewSchedulingForm.value.mode,
    locationOrLink: businessInterviewSchedulingForm.value.locationOrLink.trim(),
    interviewer: businessInterviewSchedulingForm.value.interviewer.trim(),
    notes: businessInterviewSchedulingForm.value.notes.trim(),
    scheduleStatus: 'scheduled',
    applicantResponseStatus: 'pending',
    applicantResponseReason: '',
    requestedScheduleAt: '',
    applicantRespondedAt: '',
    businessDecisionReason: '',
    businessDecidedAt: '',
  }

  try {
    await saveBusinessInterviewSchedule(nextSchedule)
    upsertBusinessInterviewScheduleState(nextSchedule)
    await updateApplicantJobApplicationStatus(selectedApplicant.id, buildBusinessInterviewApplicationPayload(nextSchedule))

    const createdDate = new Date(nextSchedule.scheduledAt)
    businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(createdDate)
    businessInterviewCalendarBaseDate.value = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1)
    resetBusinessInterviewSchedulingForm()
    showPaymentToast('Interview schedule created in Firestore. Review it in the Interview Status tab.', 'success')
  } catch (error) {
    businessInterviewSchedulingFormError.value = error instanceof Error ? error.message : 'Unable to save the interview schedule right now.'
  }
}
const shiftBusinessInterviewCalendarMonth = (offset) => {
  businessInterviewCalendarBaseDate.value = new Date(
    businessInterviewCalendarBaseDate.value.getFullYear(),
    businessInterviewCalendarBaseDate.value.getMonth() + offset,
    1,
  )
}
const selectBusinessInterviewCalendarDay = (day) => {
  if (!day?.dateKey || day.isPastDate) return

  businessInterviewSelectedCalendarDateKey.value = day.dateKey
  const currentTime = String(businessInterviewSchedulingForm.value.scheduledAt || '').includes('T')
    ? businessInterviewSchedulingForm.value.scheduledAt.slice(11, 16)
    : '09:00'

  businessInterviewSchedulingForm.value = {
    ...businessInterviewSchedulingForm.value,
    scheduledAt: `${day.dateKey}T${currentTime}`,
  }
}
syncBusinessInterviewCalendar(businessInterviewSchedules.value)

const createTrainingTemplateSkill = (skill = {}) => ({
  id: String(skill?.id || createTrainingTemplateSkillId()),
  name: String(skill?.name || skill?.title || ''),
  description: String(skill?.description || skill?.details || ''),
})

const cloneTrainingTemplateSkill = (skill = {}) => ({
  id: String(skill?.id || createTrainingTemplateSkillId()),
  name: String(skill?.name || skill?.title || ''),
  description: String(skill?.description || skill?.details || ''),
})

const createTrainingTemplateCategory = (category = {}) => {
  const normalizedSkills = Array.isArray(category?.skills) && category.skills.length
    ? category.skills.map((skill) => cloneTrainingTemplateSkill(skill))
    : [createTrainingTemplateSkill()]

  return {
    id: String(category?.id || createTrainingTemplateCategoryId()),
    title: String(category?.title || category?.label || ''),
    skills: normalizedSkills,
  }
}

const cloneTrainingTemplateCategory = (category = {}) => ({
  id: String(category?.id || createTrainingTemplateCategoryId()),
  title: String(category?.title || category?.label || ''),
  skills: Array.isArray(category?.skills) && category.skills.length
    ? category.skills.map((skill) => cloneTrainingTemplateSkill(skill))
    : [createTrainingTemplateSkill()],
})

const buildLegacyTrainingTemplateCategories = (questions = []) => {
  const importedSkills = (Array.isArray(questions) ? questions : [])
    .map((question, index) => {
      const skillName = String(question?.label || '').trim()
      const skillDescription = String(question?.helpText || '').trim()
      if (!skillName && !skillDescription) return null

      return createTrainingTemplateSkill({
        name: skillName || `Imported Skill ${index + 1}`,
        description: skillDescription,
      })
    })
    .filter(Boolean)

  if (!importedSkills.length) return []

  return [
    createTrainingTemplateCategory({
      title: 'Imported Category',
      skills: importedSkills,
    }),
  ]
}

const resolveTrainingTemplateCategories = (template = {}) => {
  if (Array.isArray(template?.categories) && template.categories.length) {
    return template.categories.map((category) => cloneTrainingTemplateCategory(category))
  }

  return buildLegacyTrainingTemplateCategories(template?.questions)
}

const countTrainingTemplateCategories = (template = {}) =>
  resolveTrainingTemplateCategories(template).length

const countTrainingTemplateSkills = (template = {}) =>
  resolveTrainingTemplateCategories(template).reduce((totalSkills, category) =>
    totalSkills + (Array.isArray(category?.skills) ? category.skills.length : 0), 0)

const createEmptyTrainingTemplateDraft = () => ({
  title: '',
  description: '',
  categories: [
    createTrainingTemplateCategory(),
  ],
})

const normalizeTrainingTemplateRecord = (template = {}) => {
  const normalizedCategories = resolveTrainingTemplateCategories(template).map((category) => ({
    id: String(category?.id || createTrainingTemplateCategoryId()),
    title: String(category?.title || '').trim(),
    skills: (Array.isArray(category?.skills) ? category.skills : []).map((skill) => ({
      id: String(skill?.id || createTrainingTemplateSkillId()),
      name: String(skill?.name || '').trim(),
      description: String(skill?.description || '').trim(),
    })),
  }))

  return {
    id: String(template?.id || createTrainingTemplateId()),
    title: String(template?.title || '').trim(),
    description: String(template?.description || '').trim(),
    categories: normalizedCategories.length ? normalizedCategories : [createTrainingTemplateCategory()],
    updatedAt: String(template?.updatedAt || new Date().toISOString()),
  }
}

const createTrainingTemplateDraftFromRecord = (template = {}) => {
  const normalized = normalizeTrainingTemplateRecord(template)

  return {
    title: normalized.title,
    description: normalized.description,
    categories: normalized.categories.map((category) => cloneTrainingTemplateCategory(category)),
  }
}

const resolveTrainingTemplatesTab = (preferredTab = 'builder') => {
  if (preferredTab === 'assignments' && canViewTrainingAssignments.value) return 'assignments'
  if (preferredTab === 'builder' && canViewTrainingTemplateBuilder.value) return 'builder'
  if (canViewTrainingTemplateBuilder.value) return 'builder'
  if (canViewTrainingAssignments.value) return 'assignments'
  return 'builder'
}

const setTrainingTemplatesTab = (preferredTab = 'builder') => {
  trainingTemplatesTab.value = resolveTrainingTemplatesTab(preferredTab)
}

const trainingTemplateDraft = ref(createEmptyTrainingTemplateDraft())

const loadTrainingTemplateForEdit = (templateId) => {
  const selectedTemplate = trainingTemplateLibrary.value.find((template) => template.id === templateId)

  if (!selectedTemplate) return

  editingTrainingTemplateId.value = selectedTemplate.id
  trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(selectedTemplate)
}

const handleTrainingTemplateSelection = (templateId) => {
  if (!templateId) {
    startNewTrainingTemplate()
    return
  }

  loadTrainingTemplateForEdit(templateId)
}

const startNewTrainingTemplate = () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  editingTrainingTemplateId.value = ''
  trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
}

const addTrainingTemplateCategory = () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  trainingTemplateDraft.value.categories.push(createTrainingTemplateCategory())
}

const removeTrainingTemplateCategory = (categoryId) => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  if (trainingTemplateDraft.value.categories.length <= 1) {
    showPaymentToast('Keep at least one training category in the template.', 'warning')
    return
  }

  trainingTemplateDraft.value.categories = trainingTemplateDraft.value.categories
    .filter((category) => category.id !== categoryId)
}

const addTrainingTemplateSkill = (categoryId) => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  trainingTemplateDraft.value.categories = trainingTemplateDraft.value.categories.map((category) =>
    category.id === categoryId
      ? {
        ...category,
        skills: [...category.skills, createTrainingTemplateSkill()],
      }
      : category)
}

const removeTrainingTemplateSkill = (categoryId, skillId) => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  const targetCategory = trainingTemplateDraft.value.categories.find((category) => category.id === categoryId)
  if (!targetCategory) return

  if (targetCategory.skills.length <= 1) {
    showPaymentToast('Keep at least one skill inside every training category.', 'warning')
    return
  }

  trainingTemplateDraft.value.categories = trainingTemplateDraft.value.categories.map((category) =>
    category.id === categoryId
      ? {
        ...category,
        skills: category.skills.filter((skill) => skill.id !== skillId),
      }
      : category)
}

const saveTrainingTemplate = async () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before saving the training template.', 'error')
    return
  }

  const normalizedTitle = String(trainingTemplateDraft.value.title || '').trim()
  if (!normalizedTitle) {
    showPaymentToast('Add a template title before saving the training template.', 'warning')
    return
  }

  const hasCategories = Array.isArray(trainingTemplateDraft.value.categories) && trainingTemplateDraft.value.categories.length
  if (!hasCategories) {
    showPaymentToast('Add at least one training category before saving the template.', 'warning')
    return
  }

  if (trainingTemplateDraft.value.categories.some((category) => !String(category?.title || '').trim())) {
    showPaymentToast('Give every training category a title before saving.', 'warning')
    return
  }

  if (trainingTemplateDraft.value.categories.some((category) => !Array.isArray(category?.skills) || !category.skills.length)) {
    showPaymentToast('Add at least one skill inside every training category.', 'warning')
    return
  }

  if (trainingTemplateDraft.value.categories.some((category) =>
    category.skills.some((skill) => !String(skill?.name || '').trim()))) {
    showPaymentToast('Give every skill a name before saving the template.', 'warning')
    return
  }

  const isEditingExistingTemplate = Boolean(editingTrainingTemplateId.value)
  const nextRecord = normalizeTrainingTemplateRecord({
    ...trainingTemplateDraft.value,
    id: editingTrainingTemplateId.value || createTrainingTemplateId(),
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  })

  try {
    await saveBusinessTrainingTemplateRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
    editingTrainingTemplateId.value = nextRecord.id
    trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(nextRecord)
    showPaymentToast(
      isEditingExistingTemplate
        ? 'Training template updated in your library.'
        : 'Training template saved to your library.',
      'success',
    )
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save this training template right now.', 'error')
  }
}

const deleteTrainingTemplate = () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  const activeTemplate = trainingTemplateLibrary.value.find((template) => template.id === editingTrainingTemplateId.value)
  if (!activeTemplate?.id) {
    showPaymentToast('Select a saved training template before trying to delete it.', 'warning')
    return
  }

  showPaymentConfirmationToast({
    title: 'Delete Training Template',
    message: `${activeTemplate.title || 'This training template'} will be removed from the saved template library. Existing assigned team members keep their current training snapshot.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    onConfirm: async () => {
      try {
        await deleteBusinessTrainingTemplateRecord(activeTemplate.id)
        editingTrainingTemplateId.value = ''
        trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
        showPaymentToast('Training template removed from your library.', 'success')
      } catch (error) {
        showPaymentToast(error instanceof Error ? error.message : 'Unable to delete this training template right now.', 'error')
      }
    },
  })
}

const normalizeTrainingTrackingSkillGrade = (value) => {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsedValue)) return 0
  return Math.min(5, Math.max(0, parsedValue))
}

const cloneTrainingAssignmentProgressSkill = (skill = {}) => ({
  id: String(skill?.id || createTrainingTemplateSkillId()),
  name: String(skill?.name || skill?.title || '').trim(),
  description: String(skill?.description || skill?.details || '').trim(),
  completed: Boolean(skill?.completed ?? skill?.isCompleted ?? skill?.checked),
  completedAt: String(skill?.completedAt || skill?.completed_at || skill?.checkedAt || skill?.checked_at || '').trim(),
  grade: normalizeTrainingTrackingSkillGrade(skill?.grade ?? skill?.rating ?? skill?.score),
})

const cloneTrainingAssignmentProgressCategory = (category = {}) => ({
  id: String(category?.id || createTrainingTemplateCategoryId()),
  title: String(category?.title || category?.label || '').trim(),
  remark: String(category?.remark || category?.remarks || '').trim(),
  remarkedAt: String(category?.remarkedAt || category?.remarked_at || '').trim(),
  skills: Array.isArray(category?.skills)
    ? category.skills
      .map((skill) => cloneTrainingAssignmentProgressSkill(skill))
      .filter((skill) => skill.id || skill.name || skill.description)
    : [],
})

const cloneTrainingAssignmentProgressCategories = (categories = []) =>
  (Array.isArray(categories) ? categories : [])
    .map((category) => cloneTrainingAssignmentProgressCategory(category))
    .filter((category) => category.id || category.title || category.skills.length)

const buildTrainingAssignmentSnapshotFromTemplate = (template = null) =>
  resolveTrainingTemplateCategories(template || {})
    .map((category) => ({
      id: String(category?.id || createTrainingTemplateCategoryId()),
      title: String(category?.title || '').trim(),
      remark: '',
      remarkedAt: '',
      skills: (Array.isArray(category?.skills) ? category.skills : [])
        .map((skill) => ({
          id: String(skill?.id || createTrainingTemplateSkillId()),
          name: String(skill?.name || '').trim(),
          description: String(skill?.description || '').trim(),
          completed: false,
          completedAt: '',
          grade: 0,
        }))
        .filter((skill) => skill.id || skill.name || skill.description),
    }))
    .filter((category) => category.id || category.title || category.skills.length)

const calculateTrainingAssignmentProgressTotals = (categories = []) => {
  const normalizedCategories = cloneTrainingAssignmentProgressCategories(categories)
  const totalSkills = normalizedCategories.reduce(
    (total, category) => total + (Array.isArray(category?.skills) ? category.skills.length : 0),
    0,
  )
  const completedSkills = normalizedCategories.reduce(
    (total, category) => total + (Array.isArray(category?.skills) ? category.skills.filter((skill) => skill.completed).length : 0),
    0,
  )

  return {
    totalSkills,
    completedSkills,
    percent: totalSkills ? Math.round((completedSkills / totalSkills) * 100) : 0,
  }
}

const calculateTrainingCategoryProgress = (category = {}) => {
  const normalizedCategory = cloneTrainingAssignmentProgressCategory(category)
  const totalSkills = normalizedCategory.skills.length
  const completedSkills = normalizedCategory.skills.filter((skill) => skill.completed).length

  return {
    totalSkills,
    completedSkills,
    percent: totalSkills ? Math.round((completedSkills / totalSkills) * 100) : 0,
  }
}

const calculateTrainingCategoryScore = (category = {}) => {
  const normalizedCategory = cloneTrainingAssignmentProgressCategory(category)
  const totalSkills = normalizedCategory.skills.length
  const gradedSkills = normalizedCategory.skills.filter((skill) => skill.grade > 0).length
  const totalScore = normalizedCategory.skills.reduce((total, skill) => total + normalizeTrainingTrackingSkillGrade(skill.grade), 0)
  const maxScore = totalSkills * 5

  return {
    totalSkills,
    gradedSkills,
    totalScore,
    maxScore,
    averageScore: gradedSkills ? Number((totalScore / gradedSkills).toFixed(1)) : 0,
  }
}

const calculateTrainingAssignmentScoreTotals = (categories = []) => {
  const normalizedCategories = cloneTrainingAssignmentProgressCategories(categories)

  const summary = normalizedCategories.reduce((summaryValue, category) => {
    const nextCategoryScore = calculateTrainingCategoryScore(category)

    return {
      totalSkills: summaryValue.totalSkills + nextCategoryScore.totalSkills,
      gradedSkills: summaryValue.gradedSkills + nextCategoryScore.gradedSkills,
      totalScore: summaryValue.totalScore + nextCategoryScore.totalScore,
      maxScore: summaryValue.maxScore + nextCategoryScore.maxScore,
    }
  }, {
    totalSkills: 0,
    gradedSkills: 0,
    totalScore: 0,
    maxScore: 0,
  })

  return {
    ...summary,
    averageScore: summary.gradedSkills ? Number((summary.totalScore / summary.gradedSkills).toFixed(1)) : 0,
  }
}

const canCompleteTrainingTrackingAssignmentRecord = (categories = []) => {
  const normalizedCategories = cloneTrainingAssignmentProgressCategories(categories)
  if (!normalizedCategories.length) return false

  return normalizedCategories.every((category) => {
    const progress = calculateTrainingCategoryProgress(category)
    const score = calculateTrainingCategoryScore(category)
    const remark = String(category?.remark || '').trim()

    return (
      progress.totalSkills > 0
      && progress.completedSkills >= progress.totalSkills
      && score.gradedSkills >= progress.totalSkills
      && Boolean(remark)
    )
  })
}

const resolveTrainingAssignmentProgressStatus = (categories = [], fallback = 'Not Started') => {
  const { totalSkills, completedSkills } = calculateTrainingAssignmentProgressTotals(categories)
  if (!totalSkills) return String(fallback || 'Not Started').trim() || 'Not Started'
  if (!completedSkills) return 'Not Started'
  if (completedSkills >= totalSkills) return 'Completed'
  return 'In Progress'
}

const findTrainingTemplateById = (templateId) =>
  trainingTemplateLibrary.value.find((template) => template.id === templateId) || null

const buildTrainingAssignmentRecordPayload = (assignment = {}, overrides = {}) => {
  const selectedTemplateId = String(overrides.selectedTemplateId ?? assignment?.selectedTemplateId ?? '').trim()
  const selectedTemplate = findTrainingTemplateById(selectedTemplateId)
  const providedCategories = Array.isArray(overrides.templateCategories)
    ? overrides.templateCategories
    : Array.isArray(assignment?.templateCategories) && assignment.templateCategories.length
      ? assignment.templateCategories
      : buildTrainingAssignmentSnapshotFromTemplate(selectedTemplate)
  const templateCategories = cloneTrainingAssignmentProgressCategories(providedCategories)
  const resolvedId = String(overrides.id ?? assignment?.id ?? assignment?.memberId ?? assignment?.applicationId ?? '').trim()
  const trainingCompletedAt = String(
    overrides.trainingCompletedAt
    ?? assignment?.trainingCompletedAt
    ?? assignment?.training_completed_at
    ?? '',
  ).trim()
  const trainingCompletedBy = String(
    overrides.trainingCompletedBy
    ?? assignment?.trainingCompletedBy
    ?? assignment?.training_completed_by
    ?? '',
  ).trim()
  const trainingCompletedByName = String(
    overrides.trainingCompletedByName
    ?? assignment?.trainingCompletedByName
    ?? assignment?.training_completed_by_name
    ?? '',
  ).trim()

  return {
    id: resolvedId,
    memberId: String(overrides.memberId ?? assignment?.memberId ?? resolvedId).trim() || resolvedId,
    applicationId: String(overrides.applicationId ?? assignment?.applicationId ?? resolvedId).trim() || resolvedId,
    applicantId: String(overrides.applicantId ?? assignment?.applicantId ?? '').trim(),
    jobId: String(overrides.jobId ?? assignment?.jobId ?? '').trim(),
    jobTitle: String(overrides.jobTitle ?? assignment?.jobTitle ?? assignment?.role ?? '').trim(),
    name: String(overrides.name ?? assignment?.name ?? 'Applicant').trim() || 'Applicant',
    email: String(overrides.email ?? assignment?.email ?? '').trim().toLowerCase(),
    role: String(overrides.role ?? assignment?.role ?? 'Applicant').trim() || 'Applicant',
    stage: String(overrides.stage ?? assignment?.stage ?? 'Final interview completed').trim() || 'Final interview completed',
    selectedTemplateId,
    templateTitle: String(overrides.templateTitle ?? assignment?.templateTitle ?? selectedTemplate?.title ?? '').trim(),
    templateDescription: String(overrides.templateDescription ?? assignment?.templateDescription ?? selectedTemplate?.description ?? '').trim(),
    templateCategories,
    assignmentStatus: String(overrides.assignmentStatus ?? assignment?.assignmentStatus ?? 'Pending').trim() || 'Pending',
    assignedAt: String(overrides.assignedAt ?? assignment?.assignedAt ?? '').trim(),
    trainingCompletedAt,
    trainingCompletedBy,
    trainingCompletedByName,
    progressStatus: String(overrides.progressStatus || '').trim() || resolveTrainingAssignmentProgressStatus(
      templateCategories,
      assignment?.progressStatus || 'Not Started',
    ),
  }
}

const selectedTrainingTrackingAssignmentId = ref('')
const trainingTrackingViewMode = ref('table')
const TRAINING_TRACKING_GRADE_SCALE = [1, 2, 3, 4, 5]
const trainingTrackingSavingSkillKeys = ref([])
const trainingTrackingSavingCategoryKeys = ref([])
const trainingTrackingCompletingAssignmentIds = ref([])
const trainingTrackingCategoryRemarkDrafts = ref({})

const assignableTrainingTemplates = computed(() =>
  trainingTemplateLibrary.value.map((template) => ({
    id: template.id,
    title: template.title || 'Untitled training template',
  })),
)

const readyTrainingTemplateRows = computed(() => {
  const eligibleIds = new Set(
    trainingEligibleApplicantProfiles.value.map((applicant) => String(applicant.id || '').trim()).filter(Boolean),
  )

  return trainingTemplateAssignments.value.filter((member) =>
    eligibleIds.has(String(member?.id || member?.applicationId || '').trim()))
})

const assignedTrainingTemplateRows = computed(() =>
  trainingTemplateAssignments.value.filter((member) =>
    String(member?.assignmentStatus || '').trim().toLowerCase() === 'assigned'),
)

const trainingTrackingAssignments = computed(() =>
  assignedTrainingTemplateRows.value.map((member) => {
    const templateCategories = cloneTrainingAssignmentProgressCategories(member.templateCategories)
    const overallProgress = calculateTrainingAssignmentProgressTotals(templateCategories)
    const scoreSummary = calculateTrainingAssignmentScoreTotals(templateCategories)

    return {
      ...member,
      templateCategories: templateCategories.map((category) => {
        const progress = calculateTrainingCategoryProgress(category)
        const score = calculateTrainingCategoryScore(category)

        return {
          ...category,
          progress,
          score,
          canAddRemark: progress.totalSkills > 0 && progress.completedSkills >= progress.totalSkills,
          isFullyGraded: score.gradedSkills >= progress.totalSkills && progress.totalSkills > 0,
          hasRemark: Boolean(String(category?.remark || '').trim()),
        }
      }),
      overallProgress,
      scoreSummary,
      canCompleteTraining: canCompleteTrainingTrackingAssignmentRecord(templateCategories),
    }
  }),
)

const selectedTrainingTrackingAssignment = computed(() =>
  trainingTrackingAssignments.value.find((assignment) =>
    String(assignment?.id || '').trim() === String(selectedTrainingTrackingAssignmentId.value || '').trim())
  || trainingTrackingAssignments.value[0]
  || null,
)
const isTrainingTrackingDetailView = computed(() =>
  trainingAssignmentTab.value === 'training-tracking'
  && trainingTrackingViewMode.value === 'detail'
  && Boolean(selectedTrainingTrackingAssignment.value),
)

const setTrainingAssignmentTab = (nextTab = 'ready-members') => {
  trainingAssignmentTab.value = String(nextTab || 'ready-members').trim() || 'ready-members'
  trainingTrackingViewMode.value = 'table'
}

const openTrainingTrackingDetail = (assignmentId) => {
  const normalizedAssignmentId = String(assignmentId || '').trim()
  if (!normalizedAssignmentId) return

  selectedTrainingTrackingAssignmentId.value = normalizedAssignmentId
  trainingTrackingViewMode.value = 'detail'
}

const returnToTrainingTrackingTable = () => {
  trainingTrackingViewMode.value = 'table'
}

const getAssignableTrainingTemplateLabel = (templateId, fallbackTitle = '') =>
  assignableTrainingTemplates.value.find((template) => template.id === templateId)?.title
  || String(fallbackTitle || 'Unassigned').trim()
  || 'Unassigned'

const resolveTrainingTrackingProgressTone = (status = '') => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'completed') return 'completed'
  if (normalizedStatus === 'in progress') return 'in-progress'
  return 'not-started'
}

const createTrainingTrackingSkillKey = (assignmentId, categoryId, skillId) =>
  [assignmentId, categoryId, skillId].map((value) => String(value || '').trim()).join(':')

const createTrainingTrackingCategoryKey = (assignmentId, categoryId) =>
  [assignmentId, categoryId].map((value) => String(value || '').trim()).join(':')

const isTrainingTrackingSkillSaving = (assignmentId, categoryId, skillId) =>
  trainingTrackingSavingSkillKeys.value.includes(createTrainingTrackingSkillKey(assignmentId, categoryId, skillId))

const isTrainingTrackingCategorySaving = (assignmentId, categoryId) =>
  trainingTrackingSavingCategoryKeys.value.includes(createTrainingTrackingCategoryKey(assignmentId, categoryId))

const isTrainingTrackingAssignmentCompleting = (assignmentId) =>
  trainingTrackingCompletingAssignmentIds.value.includes(String(assignmentId || '').trim())

const getTrainingTrackingCategoryRemarkDraft = (assignmentId, category = {}) => {
  const draftKey = createTrainingTrackingCategoryKey(assignmentId, category?.id)
  return Object.prototype.hasOwnProperty.call(trainingTrackingCategoryRemarkDrafts.value, draftKey)
    ? trainingTrackingCategoryRemarkDrafts.value[draftKey]
    : String(category?.remark || '').trim()
}

const setTrainingTrackingCategoryRemarkDraft = (assignmentId, categoryId, value) => {
  const draftKey = createTrainingTrackingCategoryKey(assignmentId, categoryId)
  trainingTrackingCategoryRemarkDrafts.value = {
    ...trainingTrackingCategoryRemarkDrafts.value,
    [draftKey]: String(value ?? ''),
  }
}

const syncLocalTrainingAssignmentRecord = (nextRecord = {}) => {
  const normalizedId = String(nextRecord?.id || nextRecord?.memberId || nextRecord?.applicationId || '').trim()
  if (!normalizedId) return

  trainingAssignmentRecords.value = [
    ...trainingAssignmentRecords.value.filter((record) => String(record?.id || record?.memberId || record?.applicationId || '').trim() !== normalizedId),
    nextRecord,
  ]
  rebuildTrainingAssignments()
}

const handleTrainingAssignmentTemplateSelection = async () => Promise.resolve()

const assignTrainingTemplateToMember = async (memberId) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetMember = trainingTemplateAssignments.value.find((member) => member.id === memberId)
  if (!targetMember) return
  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before assigning a training template.', 'error')
    return
  }

  if (!targetMember.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the applicant.', 'warning')
    return
  }

  const selectedTemplate = findTrainingTemplateById(targetMember.selectedTemplateId)
  if (!selectedTemplate) {
    showPaymentToast('Only saved training templates can be assigned to applicants.', 'warning')
    return
  }

  const savedAssignmentRecord = trainingAssignmentRecords.value.find((record) =>
    String(record?.id || record?.memberId || record?.applicationId || '').trim() === String(memberId || '').trim())
  const shouldReuseExistingProgress =
    String(savedAssignmentRecord?.selectedTemplateId || '').trim() === String(targetMember.selectedTemplateId || '').trim()
    && Array.isArray(savedAssignmentRecord?.templateCategories)
    && savedAssignmentRecord.templateCategories.length > 0
  const nextRecord = buildTrainingAssignmentRecordPayload(
    {
      ...targetMember,
      ...savedAssignmentRecord,
    },
    {
      selectedTemplateId: targetMember.selectedTemplateId,
      templateCategories: shouldReuseExistingProgress
        ? savedAssignmentRecord.templateCategories
        : buildTrainingAssignmentSnapshotFromTemplate(selectedTemplate),
      assignmentStatus: 'Assigned',
      assignedAt: new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(new Date()),
      progressStatus: shouldReuseExistingProgress
        ? savedAssignmentRecord?.progressStatus || 'Not Started'
        : 'Not Started',
    },
  )

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
    syncLocalTrainingAssignmentRecord(nextRecord)
    showPaymentToast(`Training template assigned to ${targetMember.name}.`, 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to assign this training template right now.', 'error')
  }
}

const toggleTrainingAssignmentSkillCompletion = async (assignmentId, categoryId, skillId, completed) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before updating training progress.', 'error')
    return
  }

  const savingKey = createTrainingTrackingSkillKey(assignmentId, categoryId, skillId)
  if (trainingTrackingSavingSkillKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        skills: category.skills.map((skill) =>
          String(skill?.id || '').trim() === String(skillId || '').trim()
            ? {
              ...skill,
              completed: Boolean(completed),
              completedAt: completed ? new Date().toISOString() : '',
              grade: completed ? normalizeTrainingTrackingSkillGrade(skill?.grade) : 0,
            }
            : skill),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingSkillKeys.value = [...trainingTrackingSavingSkillKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(error instanceof Error ? error.message : 'Unable to update this training progress right now.', 'error')
  } finally {
    trainingTrackingSavingSkillKeys.value = trainingTrackingSavingSkillKeys.value.filter((key) => key !== savingKey)
  }
}

const setTrainingAssignmentSkillGrade = async (assignmentId, categoryId, skillId, gradeValue) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const normalizedGrade = normalizeTrainingTrackingSkillGrade(gradeValue)
  if (!normalizedGrade) {
    showPaymentToast('Choose a grade from 1 to 5 for this skill.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const targetCategory = Array.isArray(targetAssignment?.templateCategories)
    ? targetAssignment.templateCategories.find((category) => String(category?.id || '').trim() === String(categoryId || '').trim())
    : null
  const targetSkill = Array.isArray(targetCategory?.skills)
    ? targetCategory.skills.find((skill) => String(skill?.id || '').trim() === String(skillId || '').trim())
    : null

  if (!targetSkill?.completed) {
    showPaymentToast('Mark this skill as completed before assigning a grade.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before updating skill grades.', 'error')
    return
  }

  const savingKey = createTrainingTrackingSkillKey(assignmentId, categoryId, skillId)
  if (trainingTrackingSavingSkillKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        skills: category.skills.map((skill) =>
          String(skill?.id || '').trim() === String(skillId || '').trim()
            ? {
              ...skill,
              grade: normalizedGrade,
            }
            : skill),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingSkillKeys.value = [...trainingTrackingSavingSkillKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save this skill grade right now.', 'error')
  } finally {
    trainingTrackingSavingSkillKeys.value = trainingTrackingSavingSkillKeys.value.filter((key) => key !== savingKey)
  }
}

const saveTrainingTrackingCategoryRemark = async (assignmentId, categoryId) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const targetCategory = Array.isArray(targetAssignment?.templateCategories)
    ? targetAssignment.templateCategories.find((category) => String(category?.id || '').trim() === String(categoryId || '').trim())
    : null
  if (!targetCategory) return

  const categoryProgress = calculateTrainingCategoryProgress(targetCategory)
  if (!categoryProgress.totalSkills || categoryProgress.completedSkills < categoryProgress.totalSkills) {
    showPaymentToast('Complete all skills in this category before saving a remark.', 'warning')
    return
  }

  const draftValue = String(getTrainingTrackingCategoryRemarkDraft(assignmentId, targetCategory) || '').trim()
  if (!draftValue) {
    showPaymentToast('Enter a remark for this training category before saving.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before saving this category remark.', 'error')
    return
  }

  const savingKey = createTrainingTrackingCategoryKey(assignmentId, categoryId)
  if (trainingTrackingSavingCategoryKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        remark: draftValue,
        remarkedAt: new Date().toISOString(),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingCategoryKeys.value = [...trainingTrackingSavingCategoryKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save this category remark right now.', 'error')
  } finally {
    trainingTrackingSavingCategoryKeys.value = trainingTrackingSavingCategoryKeys.value.filter((key) => key !== savingKey)
  }
}

const completeTrainingTrackingAssignment = async (assignmentId) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const normalizedAssignmentId = String(assignmentId || '').trim()
  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === normalizedAssignmentId)
  if (!targetAssignment) return

  if (!canCompleteTrainingTrackingAssignmentRecord(targetAssignment.templateCategories)) {
    showPaymentToast('Complete every skill, add grades, and save remarks for each training category first.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before completing this training record.', 'error')
    return
  }

  if (trainingTrackingCompletingAssignmentIds.value.includes(normalizedAssignmentId)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const completionActorId = String(authUser.value?.id || authUser.value?.uid || '').trim()
  const completionActorName = String(authUser.value?.name || businessName.value || 'Business Owner').trim()
  const completionTimestamp = new Date().toISOString()
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories),
    trainingCompletedAt: completionTimestamp,
    trainingCompletedBy: completionActorId,
    trainingCompletedByName: completionActorName,
    progressStatus: resolveTrainingAssignmentProgressStatus(
      targetAssignment.templateCategories,
      targetAssignment.progressStatus,
    ),
  })

  trainingTrackingCompletingAssignmentIds.value = [
    ...trainingTrackingCompletingAssignmentIds.value,
    normalizedAssignmentId,
  ]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
    showPaymentToast(`Training monitoring completed for ${targetAssignment.name}.`, 'success')
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(error instanceof Error ? error.message : 'Unable to complete this training record right now.', 'error')
  } finally {
    trainingTrackingCompletingAssignmentIds.value = trainingTrackingCompletingAssignmentIds.value.filter((id) => id !== normalizedAssignmentId)
  }
}

const resolveTrainingQuestionTypeMeta = (type) =>
  trainingQuestionTypeOptions.find((item) => item.value === type) || trainingQuestionTypeOptions[0]

const normalizeAssessmentPassingScorePercent = (value, fallback = 70) => {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(100, Math.max(1, parsedValue))
}

const getScorableAssessmentQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : []).filter((question) =>
    String(question?.type || '').trim() === 'multiple-choice'
    && Number.isInteger(question?.correctOptionIndex)
    && question.correctOptionIndex >= 0,
  )

const countScorableAssessmentQuestions = (questions = []) =>
  getScorableAssessmentQuestions(questions).length

const normalizeAssessmentResultState = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'passed') return 'passed'
  if (normalizedValue === 'failed') return 'failed'
  return 'pending'
}

const formatAssessmentResultLabel = (value) => {
  const normalizedValue = normalizeAssessmentResultState(value)
  if (normalizedValue === 'passed') return 'Passed'
  if (normalizedValue === 'failed') return 'Failed'
  return 'Pending'
}

const resolveAssessmentScoreLabel = ({ scoreValue = 0, assignmentStatus = '', assessmentResult = 'pending' } = {}) => {
  const normalizedResult = normalizeAssessmentResultState(assessmentResult)
  const normalizedAssignmentStatus = String(assignmentStatus || '').trim().toLowerCase()
  const normalizedScoreValue = Math.min(100, Math.max(0, Number(scoreValue) || 0))

  if (['passed', 'failed'].includes(normalizedResult) || normalizedAssignmentStatus === 'submitted') {
    return `${normalizedScoreValue}%`
  }

  return 'Pending'
}

const resolveApplicantScoreStatusLabel = (record = {}) => {
  const normalizedResult = normalizeAssessmentResultState(record?.assessmentResult || record?.assessment_result)
  if (normalizedResult === 'passed') return 'Passed'
  if (normalizedResult === 'failed') return 'Failed'

  return String(record?.assignmentStatus || record?.assignment_status || 'Pending').trim() || 'Pending'
}

const createAssessmentTemplateQuestion = (type) => ({
  id: createAssessmentQuestionId(),
  type,
  label: '',
  helpText: '',
  required: false,
  options: buildTemplateQuestionOptions(type),
  correctOptionIndex: null,
})

const cloneAssessmentTemplateQuestion = (question = {}) => {
  const resolvedType = trainingQuestionTypeOptions.some((item) => item.value === question?.type)
    ? question.type
    : 'multiple-choice'
  const resolvedOptions = Array.isArray(question?.options)
    ? question.options.map((option) => String(option || ''))
    : buildTemplateQuestionOptions(resolvedType)

  return {
    id: String(question?.id || createAssessmentQuestionId()),
    type: resolvedType,
    label: String(question?.label || ''),
    helpText: String(question?.helpText || ''),
    required: Boolean(question?.required),
    options: resolvedOptions.length ? resolvedOptions : buildTemplateQuestionOptions(resolvedType),
    correctOptionIndex:
      resolvedType === 'multiple-choice'
        && Number.isInteger(question?.correctOptionIndex)
        && question.correctOptionIndex >= 0
        && question.correctOptionIndex < resolvedOptions.length
        ? question.correctOptionIndex
        : null,
  }
}

const createEmptyAssessmentTemplateDraft = () => ({
  title: '',
  description: '',
  instructions: '',
  passingScorePercent: 70,
  questions: [
    createAssessmentTemplateQuestion('multiple-choice'),
  ],
})

const normalizeAssessmentTemplateRecord = (template = {}) => ({
  id: String(template?.id || createAssessmentTemplateId()),
  title: String(template?.title || ''),
  description: String(template?.description || ''),
  instructions: String(template?.instructions || ''),
  passingScorePercent: normalizeAssessmentPassingScorePercent(template?.passingScorePercent || template?.passing_score_percent, 70),
  questions: Array.isArray(template?.questions) && template.questions.length
    ? template.questions.map((question) => cloneAssessmentTemplateQuestion(question))
    : [createAssessmentTemplateQuestion('multiple-choice')],
  updatedAt: String(template?.updatedAt || new Date().toISOString()),
})

const createAssessmentTemplateDraftFromRecord = (template = {}) => {
  const normalized = normalizeAssessmentTemplateRecord(template)

  return {
    title: normalized.title,
    description: normalized.description,
    instructions: normalized.instructions,
    passingScorePercent: normalized.passingScorePercent,
    questions: normalized.questions.map((question) => cloneAssessmentTemplateQuestion(question)),
  }
}

const assessmentTemplateDraft = ref(createEmptyAssessmentTemplateDraft())

const assignableAssessmentTemplates = computed(() => {
  const savedTemplates = assessmentTemplateLibrary.value.map((template) => ({
    id: template.id,
    title: template.title || 'Untitled assessment template',
  }))
  return savedTemplates
})

const assignedApplicantTemplateRows = computed(() =>
  approvedApplicantTemplateAssignments.value.filter((applicant) =>
    ['assigned', 'submitted'].includes(String(applicant.assignmentStatus || '').trim().toLowerCase())),
)

const formatAssessmentTemplateUpdatedAt = (value) => {
  const parsedValue = new Date(value)

  if (Number.isNaN(parsedValue.getTime())) {
    return 'Recently updated'
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedValue)
}

const loadAssessmentTemplateForEdit = (templateId) => {
  const selectedTemplate = assessmentTemplateLibrary.value.find((template) => template.id === templateId)

  if (!selectedTemplate) return

  editingAssessmentTemplateId.value = selectedTemplate.id
  assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(selectedTemplate)
}

const handleAssessmentTemplateSelection = (templateId) => {
  if (!templateId) {
    startNewAssessmentTemplate()
    return
  }

  loadAssessmentTemplateForEdit(templateId)
}

const startNewAssessmentTemplate = () => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  editingAssessmentTemplateId.value = ''
  assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
}

const addAssessmentTemplateQuestion = () => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  assessmentTemplateDraft.value.questions.push(createAssessmentTemplateQuestion(selectedAssessmentQuestionType.value))
}

const removeAssessmentTemplateQuestion = (questionId) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  if (assessmentTemplateDraft.value.questions.length <= 1) {
    showPaymentToast('Keep at least one question in the assessment template.', 'warning')
    return
  }

  assessmentTemplateDraft.value.questions = assessmentTemplateDraft.value.questions.filter((question) => question.id !== questionId)
}

const addAssessmentTemplateOption = (questionId) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetQuestion = assessmentTemplateDraft.value.questions.find((question) => question.id === questionId)
  if (!targetQuestion || !['multiple-choice', 'checkboxes'].includes(targetQuestion.type)) return

  targetQuestion.options.push('')
}

const setAssessmentTemplateCorrectOption = (questionId, optionIndex) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetQuestion = assessmentTemplateDraft.value.questions.find((question) => question.id === questionId)
  if (!targetQuestion || targetQuestion.type !== 'multiple-choice') return

  targetQuestion.correctOptionIndex = optionIndex
}

const removeAssessmentTemplateOption = (questionId, optionIndex) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetQuestion = assessmentTemplateDraft.value.questions.find((question) => question.id === questionId)
  if (!targetQuestion || !['multiple-choice', 'checkboxes'].includes(targetQuestion.type)) return

  if (targetQuestion.options.length <= 2) {
    showPaymentToast('Keep at least two answer options in a selectable question.', 'warning')
    return
  }

  targetQuestion.options = targetQuestion.options.filter((_, index) => index !== optionIndex)
  if (targetQuestion.correctOptionIndex === optionIndex) {
    targetQuestion.correctOptionIndex = null
  } else if (targetQuestion.correctOptionIndex !== null && targetQuestion.correctOptionIndex > optionIndex) {
    targetQuestion.correctOptionIndex -= 1
  }
}

const saveAssessmentTemplate = async () => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before saving the assessment template.', 'error')
    return
  }

  const normalizedTitle = String(assessmentTemplateDraft.value.title || '').trim()
  if (!normalizedTitle) {
    showPaymentToast('Add a template title before saving the assessment.', 'warning')
    return
  }

  const passingScorePercent = normalizeAssessmentPassingScorePercent(assessmentTemplateDraft.value.passingScorePercent, 70)
  if (!countScorableAssessmentQuestions(assessmentTemplateDraft.value.questions)) {
    showPaymentToast('Add at least one multiple-choice question and mark the correct answer before saving the assessment.', 'warning')
    return
  }

  const isEditingExistingTemplate = Boolean(editingAssessmentTemplateId.value)
  const nextRecord = normalizeAssessmentTemplateRecord({
    ...assessmentTemplateDraft.value,
    id: editingAssessmentTemplateId.value || createAssessmentTemplateId(),
    title: normalizedTitle,
    passingScorePercent,
    updatedAt: new Date().toISOString(),
  })

  await saveBusinessAssessmentTemplateRecord({
    ...nextRecord,
    workspaceOwnerId,
  })
  editingAssessmentTemplateId.value = nextRecord.id
  assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(nextRecord)
  showPaymentToast(
    isEditingExistingTemplate
      ? 'Assessment template updated in your library.'
      : 'Assessment template saved to your library.',
    'success',
  )
}

const deleteAssessmentTemplate = () => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const activeTemplate = assessmentTemplateLibrary.value.find((template) => template.id === editingAssessmentTemplateId.value)
  if (!activeTemplate?.id) {
    showPaymentToast('Select a saved assessment template before trying to delete it.', 'warning')
    return
  }

  showPaymentConfirmationToast({
    title: 'Delete Assessment Template',
    message: `${activeTemplate.title || 'This assessment template'} will be removed from the saved template library. Existing assigned applicants keep their current assessment snapshot.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    onConfirm: async () => {
      try {
        await deleteBusinessAssessmentTemplateRecord(activeTemplate.id)
        editingAssessmentTemplateId.value = ''
        assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
        showPaymentToast('Assessment template removed from your library.', 'success')
      } catch (error) {
        showPaymentToast(error instanceof Error ? error.message : 'Unable to delete this assessment template right now.', 'error')
      }
    },
  })
}

const findAssessmentTemplateById = (templateId) =>
  assessmentTemplateLibrary.value.find((template) => template.id === templateId) || null

const buildAssessmentAssignmentTemplateSnapshot = (templateId) => {
  const selectedTemplate = findAssessmentTemplateById(templateId)
  return {
    selectedTemplateId: String(templateId || '').trim(),
    templateTitle: String(selectedTemplate?.title || '').trim(),
    templateDescription: String(selectedTemplate?.description || '').trim(),
    templateInstructions: String(selectedTemplate?.instructions || '').trim(),
    passingScorePercent: normalizeAssessmentPassingScorePercent(selectedTemplate?.passingScorePercent || selectedTemplate?.passing_score_percent, 70),
    templateQuestions: Array.isArray(selectedTemplate?.questions)
      ? JSON.parse(JSON.stringify(selectedTemplate.questions))
      : [],
  }
}

const getAssignableTemplateLabel = (templateId, fallbackTitle = 'Unassigned') =>
  findAssessmentTemplateById(templateId)?.title || String(fallbackTitle || '').trim() || 'Unassigned'

const findAssessmentAssignmentRecordByApplicant = (applicant = {}) => {
  const candidateIds = new Set([
    String(applicant?.id || '').trim(),
    String(applicant?.applicationId || '').trim(),
    String(applicant?.applicantId || '').trim(),
  ].filter(Boolean))

  return assessmentAssignmentRecords.value.find((record) => candidateIds.has(String(record?.applicationId || record?.id || record?.applicantId || '').trim())) || null
}

const canRemoveAssignedAssessment = (applicant = {}) => Boolean(findAssessmentAssignmentRecordByApplicant(applicant))

const handleAssessmentAssignmentTemplateSelection = (applicantId, templateId) => {
  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) return

  const templateSnapshot = buildAssessmentAssignmentTemplateSnapshot(templateId)
  targetApplicant.selectedTemplateId = templateSnapshot.selectedTemplateId
  targetApplicant.templateTitle = templateSnapshot.templateTitle
  targetApplicant.templateDescription = templateSnapshot.templateDescription
  targetApplicant.templateInstructions = templateSnapshot.templateInstructions
  targetApplicant.passingScorePercent = templateSnapshot.passingScorePercent
  targetApplicant.templateQuestions = templateSnapshot.templateQuestions
}

const buildApplicantAssessmentScoreRecord = (applicant = {}) => {
  const linkedInterviewApplicant = businessInterviewApplicants.value.find((entry) =>
    String(entry?.applicantEmail || '').trim().toLowerCase() === String(applicant?.email || '').trim().toLowerCase()
    || String(entry?.applicantName || '').trim().toLowerCase() === String(applicant?.name || '').trim().toLowerCase(),
  )
  const rawScoreSource = applicant?.assessmentScoreValue
    ?? applicant?.assessment_score_value
    ?? applicant?.scoreValue
    ?? applicant?.score
  const scoreValue = Math.min(100, Math.max(0, Number.parseInt(
    String(rawScoreSource || '').replace(/[^\d]/g, ''),
    10,
  ) || 0))
  const templateTitle = applicant?.selectedTemplateId
    ? getAssignableTemplateLabel(applicant.selectedTemplateId, applicant?.templateTitle)
    : 'No template assigned'
  const assignmentStatus = String(applicant?.assignmentStatus || 'Pending').trim() || 'Pending'
  const assessmentResult = normalizeAssessmentResultState(applicant?.assessmentResult || applicant?.assessment_result)
  const passingScorePercent = normalizeAssessmentPassingScorePercent(applicant?.passingScorePercent || applicant?.passing_score_percent, 70)
  const technicalStage =
    assessmentResult === 'passed'
      ? 'passed'
      : assessmentResult === 'failed'
        ? 'failed'
        : ['assigned', 'submitted'].includes(assignmentStatus.trim().toLowerCase())
          ? 'assigned'
          : String(linkedInterviewApplicant?.technicalStage || 'unassigned').trim().toLowerCase()
  const correctAnswerCount = Math.max(0, Number(applicant?.correctAnswerCount ?? applicant?.correct_answer_count ?? 0) || 0)
  const totalQuestions = Math.max(0, Number(applicant?.totalQuestions ?? applicant?.total_questions ?? countScorableAssessmentQuestions(applicant?.templateQuestions)) || 0)
  const scoreLabel = String(
    applicant?.assessmentScoreLabel
    || applicant?.assessment_score_label
    || applicant?.scoreLabel
    || resolveAssessmentScoreLabel({ scoreValue, assignmentStatus, assessmentResult }),
  ).trim() || resolveAssessmentScoreLabel({ scoreValue, assignmentStatus, assessmentResult })

  return {
    id: String(applicant?.applicationId || applicant?.id || '').trim(),
    applicantId: String(applicant?.applicantId || applicant?.id || '').trim(),
    applicantName: String(applicant?.name || '').trim(),
    applicantEmail: String(applicant?.email || '').trim().toLowerCase(),
    role: String(applicant?.role || '').trim(),
    roleKey: normalizeUserOverviewValue(applicant?.role),
    approvalDate: String(applicant?.approvalDate || '').trim(),
    templateId: String(applicant?.selectedTemplateId || '').trim(),
    templateTitle: String(applicant?.templateTitle || templateTitle).trim() || templateTitle,
    assignmentStatus,
    assessmentResult,
    passingScorePercent,
    technicalStage,
    scoreValue,
    scoreLabel,
    correctAnswerCount,
    totalQuestions,
    workspaceOwnerId: getWorkspaceOwnerDirectoryId(),
    workspaceOwnerRole:
      authUser.value?.workspace_owner_role
      || authUser.value?.workspaceOwnerRole
      || authUser.value?.role
      || 'employer',
    accountIdentity: currentBusinessAccountIdentity.value,
  }
}

const upsertApplicantAssessmentScoreRecord = async (applicant = {}) => {
  const nextRecord = buildApplicantAssessmentScoreRecord(applicant)
  if (!nextRecord.id || !nextRecord.workspaceOwnerId) return false

  try {
    await saveBusinessApplicantScoreRecord(nextRecord)
    return true
  } catch {
    // Keep the local assessment assignment flow available even if Firestore sync fails.
    return false
  }
}

const startApplicantAssessmentScoreSync = () => {
  stopApplicantAssessmentScoreSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    applicantAssessmentScoreEntries.value = []
    return
  }

  stopApplicantAssessmentScoreSync = subscribeToBusinessApplicantScores(
    workspaceOwnerId,
    (entries) => {
      applicantAssessmentScoreEntries.value = Array.isArray(entries) ? entries : []
    },
    () => {
      applicantAssessmentScoreEntries.value = []
    },
  )
}

const syncAssignedApplicantAssessmentScores = async () => {
  const assignedApplicants = assessmentAssignmentRecords.value
    .filter((record) =>
      isBusinessApplicationLinkedToPostedJob(record)
      && (
      ['assigned', 'submitted'].includes(String(record?.assignmentStatus || '').trim().toLowerCase())
        && String(record?.selectedTemplateId || '').trim()
      ),
    )
    .map((record) => {
      const applicationId = String(record?.applicationId || record?.id || '').trim()
      const linkedProfile = approvedApplicantProfiles.value.find((profile) =>
        String(profile?.applicationId || profile?.id || '').trim() === applicationId,
      ) || null

      return {
        ...(linkedProfile || {}),
        ...record,
        id: applicationId || String(record?.id || '').trim(),
        applicationId: applicationId || String(record?.id || '').trim(),
        applicantId: String(record?.applicantId || linkedProfile?.applicantId || '').trim(),
        name: String(record?.name || linkedProfile?.name || 'Applicant').trim() || 'Applicant',
        email: String(record?.email || linkedProfile?.email || '').trim().toLowerCase(),
        role: String(record?.role || linkedProfile?.role || 'Applicant').trim() || 'Applicant',
        score: String(record?.score || linkedProfile?.score || 'No score yet').trim() || 'No score yet',
      }
    })
  const activeApplicantScoreIds = new Set(
    assignedApplicants
      .map((applicant) => String(applicant?.applicationId || applicant?.id || applicant?.applicantId || '').trim())
      .filter(Boolean),
  )
  const staleApplicantScoreEntries = applicantAssessmentScoreEntries.value.filter((entry) => {
    const entryId = String(entry?.id || entry?.applicantId || '').trim()
    return entryId && !activeApplicantScoreIds.has(entryId)
  })

  await Promise.allSettled(
    [
      ...assignedApplicants.map((applicant) => upsertApplicantAssessmentScoreRecord(applicant)),
      ...staleApplicantScoreEntries.map((entry) => deleteBusinessApplicantScoreRecord(String(entry?.id || '').trim())),
    ],
  )
}

const assignAssessmentTemplateToApplicant = async (applicantId) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) return

  if (!targetApplicant.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the applicant.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before assigning an assessment.', 'error')
    return
  }

  const templateSnapshot = buildAssessmentAssignmentTemplateSnapshot(targetApplicant.selectedTemplateId)
  const assignedAt = new Date().toISOString()

  try {
    await saveBusinessAssessmentAssignmentRecord({
      ...targetApplicant,
      applicationId: String(targetApplicant.applicationId || targetApplicant.id || '').trim(),
      workspaceOwnerId,
      ...templateSnapshot,
      assignmentStatus: 'Assigned',
      assessmentStatus: 'ready',
      assessmentScoreValue: 0,
      assessmentScoreLabel: 'Pending',
      correctAnswerCount: 0,
      totalQuestions: countScorableAssessmentQuestions(templateSnapshot.templateQuestions),
      assessmentResult: 'pending',
      assignedAt,
    })

    await upsertApplicantAssessmentScoreRecord({
      ...targetApplicant,
      ...templateSnapshot,
      assignmentStatus: 'Assigned',
      assignedAt,
    })
    showPaymentToast(`Template assigned to ${targetApplicant.name}.`, 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to assign this assessment right now.', 'error')
  }
}

const removeAssignedAssessmentFromApplicant = async (applicantId) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) {
    showPaymentToast('That assessment assignment could not be found.', 'error')
    return
  }

  const targetAssignment = findAssessmentAssignmentRecordByApplicant(targetApplicant)
  if (!targetAssignment) {
    showPaymentToast('No assigned assessment was found for this applicant.', 'warning')
    return
  }

  try {
    await deleteBusinessAssessmentAssignmentRecord(String(targetAssignment.id || targetAssignment.applicationId || '').trim())
    const targetScoreRecordId = String(
      targetAssignment.applicationId || targetAssignment.id || targetApplicant.applicationId || targetApplicant.id || '',
    ).trim()
    let scoreSyncSucceeded = true
    if (targetScoreRecordId) {
      try {
        await deleteBusinessApplicantScoreRecord(targetScoreRecordId)
      } catch {
        scoreSyncSucceeded = false
      }
    }

    showPaymentToast(
      !scoreSyncSucceeded
        ? `Assessment removed from ${targetApplicant.name}, but the score tracker will refresh on the next sync.`
        : `Assessment removed from ${targetApplicant.name}.`,
      !scoreSyncSucceeded ? 'warning' : 'success',
    )
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to remove this assessment right now.', 'error')
  }
}

const formatBusinessWorkspaceDate = (value) => {
  if (!value) return ''

  const parsedValue = new Date(String(value))
  if (Number.isNaN(parsedValue.getTime())) return ''

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(parsedValue)
}

const isApprovedBusinessApplication = (application = {}) => {
  const normalizedStatus = normalizeUserOverviewValue(application?.status || 'pending')
  return ['accepted', 'approved', 'hired'].includes(normalizedStatus)
}

const syncApprovedApplicantProfilesFromApplications = () => {
  approvedApplicantProfiles.value = businessJobApplications.value
    .filter((application) =>
      isApprovedBusinessApplication(application)
      && isBusinessApplicationLinkedToPostedJob(application),
    )
    .map((application) => ({
      id: String(application?.id || '').trim(),
      applicationId: String(application?.id || '').trim(),
      applicantId: String(application?.applicantId || '').trim(),
      name: String(application?.applicantName || 'Applicant').trim() || 'Applicant',
      email: String(application?.applicantEmail || '').trim().toLowerCase(),
      role: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
      jobId: String(application?.jobId || '').trim(),
      jobTitle: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
      companyName: String(application?.companyName || application?.businessName || '').trim(),
      businessName: String(application?.businessName || application?.companyName || '').trim(),
      reviewed_at: String(application?.approvedAt || application?.reviewedAt || application?.updatedAt || '').trim(),
      submitted_at: String(application?.appliedAt || application?.createdAt || '').trim(),
      score: String(application?.score || 'No score yet').trim() || 'No score yet',
    }))
  rebuildApprovedApplicantAssignments()
}

const rebuildApprovedApplicantAssignments = () => {
  const assignmentMap = new Map(
    assessmentAssignmentRecords.value
      .filter((record) => isBusinessApplicationLinkedToPostedJob(record))
      .map((record) => [
        String(record.applicationId || record.id || record.applicantId || '').trim(),
        record,
      ]),
  )
  const profileIds = approvedApplicantProfiles.value.map((profile) => String(profile.id || '').trim()).filter(Boolean)
  const orderedIds = Array.from(new Set([
    ...profileIds,
    ...Array.from(assignmentMap.keys()),
  ]))

  approvedApplicantTemplateAssignments.value = orderedIds
    .map((id) => {
      const profile = approvedApplicantProfiles.value.find((entry) => String(entry.id || '').trim() === id) || null
      const assignment = assignmentMap.get(id) || null

      return {
        id,
        applicationId: String(assignment?.applicationId || profile?.applicationId || id).trim(),
        applicantId: String(assignment?.applicantId || profile?.applicantId || '').trim(),
        name: String(assignment?.name || profile?.name || 'Applicant').trim() || 'Applicant',
        role: String(assignment?.role || 'Applicant').trim() || 'Applicant',
        email: String(assignment?.email || profile?.email || '').trim().toLowerCase(),
        jobId: String(assignment?.jobId || profile?.jobId || '').trim(),
        jobTitle: String(assignment?.jobTitle || profile?.jobTitle || profile?.role || '').trim(),
        companyName: String(assignment?.companyName || profile?.companyName || '').trim(),
        businessName: String(assignment?.businessName || profile?.businessName || '').trim(),
        approvalDate: String(
          assignment?.approvalDate
          || formatBusinessWorkspaceDate(profile?.reviewed_at || profile?.submitted_at || profile?.created_at)
          || '',
        ).trim(),
        score: String(assignment?.score || 'No score yet').trim() || 'No score yet',
        selectedTemplateId: String(assignment?.selectedTemplateId || '').trim(),
        templateTitle: String(assignment?.templateTitle || '').trim(),
        templateDescription: String(assignment?.templateDescription || '').trim(),
        templateInstructions: String(assignment?.templateInstructions || '').trim(),
        passingScorePercent: normalizeAssessmentPassingScorePercent(assignment?.passingScorePercent, 70),
        templateQuestions: Array.isArray(assignment?.templateQuestions)
          ? JSON.parse(JSON.stringify(assignment.templateQuestions))
          : [],
        assignmentStatus: String(assignment?.assignmentStatus || 'Pending').trim() || 'Pending',
        assessmentStatus: String(assignment?.assessmentStatus || '').trim(),
        assessmentScoreValue: Math.min(100, Math.max(0, Number(assignment?.assessmentScoreValue || 0) || 0)),
        assessmentScoreLabel: String(assignment?.assessmentScoreLabel || '').trim(),
        correctAnswerCount: Math.max(0, Number(assignment?.correctAnswerCount || 0) || 0),
        totalQuestions: Math.max(0, Number(assignment?.totalQuestions || 0) || 0),
        assessmentResult: normalizeAssessmentResultState(assignment?.assessmentResult),
        assignedAt: String(assignment?.assignedAt || '').trim(),
      }
    })
    .filter((record) => record.id)
}

const rebuildTrainingAssignments = () => {
  const businessApplicationLookup = new Map(
    businessJobApplications.value
      .filter((application) => isBusinessApplicationLinkedToPostedJob(application))
      .map((application) => [String(application?.id || '').trim(), application]),
  )
  const assignmentMap = new Map(
    trainingAssignmentRecords.value
      .filter((record) => {
        const applicationId = String(record?.applicationId || record?.id || record?.memberId || '').trim()
        if (!applicationId) return false
        return businessApplicationLookup.has(applicationId)
      })
      .map((record) => [String(record.applicationId || record.id || record.memberId || '').trim(), record]),
  )
  const eligibleApplicantLookup = new Map(
    trainingEligibleApplicantProfiles.value.map((applicant) => [String(applicant.id || '').trim(), applicant]),
  )
  const orderedIds = Array.from(new Set([
    ...trainingEligibleApplicantProfiles.value
      .map((applicant) => String(applicant.id || '').trim())
      .filter(Boolean),
    ...Array.from(assignmentMap.keys()),
  ]))

  trainingTemplateAssignments.value = orderedIds
    .map((id) => {
      const applicant = eligibleApplicantLookup.get(id) || null
      const linkedApplication = businessApplicationLookup.get(id) || null
      const assignment = assignmentMap.get(id) || null
      const selectedTemplateId = String(assignment?.selectedTemplateId || '').trim()
      const selectedTemplate = findTrainingTemplateById(selectedTemplateId)
      const templateCategories = Array.isArray(assignment?.templateCategories) && assignment.templateCategories.length
        ? cloneTrainingAssignmentProgressCategories(assignment.templateCategories)
        : buildTrainingAssignmentSnapshotFromTemplate(selectedTemplate)
      const stage = hasCompletedBusinessInterviewType(id, 'final')
        ? 'Final interview completed'
        : String(assignment?.stage || 'Assigned training').trim() || 'Assigned training'

      return {
        id,
        applicationId: String(assignment?.applicationId || applicant?.applicationId || linkedApplication?.id || id).trim(),
        applicantId: String(
          assignment?.applicantId
          || applicant?.applicantId
          || linkedApplication?.applicantId
          || linkedApplication?.applicant_id
          || '',
        ).trim(),
        jobId: String(assignment?.jobId || applicant?.jobId || linkedApplication?.jobId || linkedApplication?.job_id || '').trim(),
        jobTitle: String(
          assignment?.jobTitle
          || applicant?.jobTitle
          || linkedApplication?.jobTitle
          || linkedApplication?.job_title
          || applicant?.role
          || '',
        ).trim(),
        name: String(
          assignment?.name
          || applicant?.name
          || linkedApplication?.applicantName
          || linkedApplication?.applicant_name
          || 'Applicant',
        ).trim() || 'Applicant',
        role: String(
          assignment?.role
          || applicant?.role
          || linkedApplication?.jobTitle
          || linkedApplication?.job_title
          || 'Applicant',
        ).trim() || 'Applicant',
        email: String(
          assignment?.email
          || applicant?.email
          || linkedApplication?.applicantEmail
          || linkedApplication?.applicant_email
          || '',
        ).trim().toLowerCase(),
        stage,
        selectedTemplateId,
        templateTitle: String(assignment?.templateTitle || selectedTemplate?.title || '').trim(),
        templateDescription: String(assignment?.templateDescription || selectedTemplate?.description || '').trim(),
        templateCategories,
        assignmentStatus: String(assignment?.assignmentStatus || 'Pending').trim() || 'Pending',
        assignedAt: String(assignment?.assignedAt || '').trim(),
        trainingCompletedAt: String(assignment?.trainingCompletedAt || assignment?.training_completed_at || '').trim(),
        trainingCompletedBy: String(assignment?.trainingCompletedBy || assignment?.training_completed_by || '').trim(),
        trainingCompletedByName: String(assignment?.trainingCompletedByName || assignment?.training_completed_by_name || '').trim(),
        progressStatus: resolveTrainingAssignmentProgressStatus(
          templateCategories,
          assignment?.progressStatus || 'Not Started',
        ),
      }
    })
    .filter((record) => record.id)
}

const seedFallbackAssessmentAssignmentsIfNeeded = async () => {
  return Promise.resolve()
}

const startApprovedApplicantSync = () => {
  syncApprovedApplicantProfilesFromApplications()
  void seedFallbackAssessmentAssignmentsIfNeeded()
}

const startAssessmentTemplateSync = () => {
  stopAssessmentTemplateSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    assessmentTemplateLibrary.value = []
    editingAssessmentTemplateId.value = ''
    assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
    return
  }

  stopAssessmentTemplateSync = subscribeToBusinessAssessmentTemplates(
    workspaceOwnerId,
    (entries) => {
      const templates = Array.isArray(entries)
        ? entries.map((template) => normalizeAssessmentTemplateRecord(template))
        : []

      assessmentTemplateLibrary.value = templates
      if (!templates.length) {
        editingAssessmentTemplateId.value = ''
        assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
        return
      }

      const activeTemplate = templates.find((template) => template.id === editingAssessmentTemplateId.value) || templates[0]
      editingAssessmentTemplateId.value = activeTemplate.id
      assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(activeTemplate)
    },
    () => {
      assessmentTemplateLibrary.value = []
      editingAssessmentTemplateId.value = ''
      assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
    },
  )
}

const startTrainingTemplateSync = () => {
  stopTrainingTemplateSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    trainingTemplateLibrary.value = []
    editingTrainingTemplateId.value = ''
    trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
    return
  }

  stopTrainingTemplateSync = subscribeToBusinessTrainingTemplates(
    workspaceOwnerId,
    (entries) => {
      const templates = Array.isArray(entries)
        ? entries.map((template) => normalizeTrainingTemplateRecord(template))
        : []

      trainingTemplateLibrary.value = templates
      if (!templates.length) {
        editingTrainingTemplateId.value = ''
        trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
        return
      }

      const activeTemplate = templates.find((template) => template.id === editingTrainingTemplateId.value) || templates[0]
      editingTrainingTemplateId.value = activeTemplate.id
      trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(activeTemplate)
    },
    () => {
      trainingTemplateLibrary.value = []
      editingTrainingTemplateId.value = ''
      trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
    },
  )
}

const startAssessmentAssignmentSync = () => {
  stopAssessmentAssignmentSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    assessmentAssignmentRecords.value = []
    rebuildApprovedApplicantAssignments()
    return
  }

  stopAssessmentAssignmentSync = subscribeToBusinessAssessmentAssignments(
    workspaceOwnerId,
    (entries) => {
      assessmentAssignmentRecords.value = Array.isArray(entries) ? entries : []
      rebuildApprovedApplicantAssignments()
      void seedFallbackAssessmentAssignmentsIfNeeded()
    },
    () => {
      assessmentAssignmentRecords.value = []
      rebuildApprovedApplicantAssignments()
      void seedFallbackAssessmentAssignmentsIfNeeded()
    },
  )
}

const startTrainingAssignmentSync = () => {
  stopTrainingAssignmentSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    trainingAssignmentRecords.value = []
    rebuildTrainingAssignments()
    return
  }

  stopTrainingAssignmentSync = subscribeToBusinessTrainingAssignments(
    workspaceOwnerId,
    (entries) => {
      trainingAssignmentRecords.value = Array.isArray(entries) ? entries : []
      rebuildTrainingAssignments()
    },
    () => {
      trainingAssignmentRecords.value = []
      rebuildTrainingAssignments()
    },
  )
}

const syncProfileFormFromAuthUser = () => {
  profileForm.value = {
    companyName: authUser.value?.company_name || authUser.value?.name || '',
    email: authUser.value?.business_contact_email || authUser.value?.email || '',
    category: authUser.value?.company_category || '',
    location: authUser.value?.company_location || '',
    contactPerson: authUser.value?.name || '',
    avatar: businessAvatar.value,
  }
  isProfileAvatarLoading.value = false
  isProfileAvatarReady.value = Boolean(businessAvatar.value)
}

const subscriptionPlans = computed(() => {
  const isPremiumActive = activeSubscriptionPlan.value === 'premium'
  const isTrialActive = activeSubscriptionMode.value === 'trial'
  const isPaidPremiumActive = activeSubscriptionMode.value === 'paid'
  const hasUsedFreeTrial = hasConsumedBusinessFreeTrial.value && !isTrialActive

  return [
    {
      id: 'free-trial',
      title: 'Free Trial',
      badge: isTrialActive ? 'Current' : isPaidPremiumActive ? 'Unavailable' : hasUsedFreeTrial ? 'Used' : 'New',
      subtitle: 'Use premium tools for 30 days first, then continue with automatic billing after the trial period.',
      tone: 'trial',
      features: [
        '30 days of premium employer access',
        'No immediate charge today',
        'Requires GCash or Credit Card for automatic billing after the trial',
      ],
      cta: isTrialActive ? 'Current Trial' : isPaidPremiumActive ? 'Unavailable' : hasUsedFreeTrial ? 'Trial Used' : 'Start Free Trial',
      trialNote:
        isTrialActive
          ? 'Your free trial is already active on this account'
          : isPaidPremiumActive
            ? 'This account already has premium subscription access'
            : hasUsedFreeTrial
              ? 'This account already used its one-time free trial'
            : 'Billing starts automatically after the 30-day trial unless cancelled',
      isDisabled: isPremiumActive || hasUsedFreeTrial,
    },
    {
      id: 'premium',
      title: 'Premium Subscription',
      badge: isPaidPremiumActive ? 'Current' : isTrialActive ? 'Premium Active' : 'Available',
      subtitle: 'Pay the first billing cycle now and activate the full premium subscription immediately.',
      tone: 'premium',
      features: [
        'DSS (Decision Support System)',
        'Applicant ranking (auto match)',
        'Advanced filters (skills, disability type, etc.)',
        'Training templates',
        'Assign templates',
        'Interview scheduling system',
        'Attendance Monitoring',
        'Resume analytics',
        'Unlimited job posts',
        'Bulk actions',
      ],
      cta: isPaidPremiumActive ? 'Current Plan' : isTrialActive ? 'Premium Active' : 'Get Started',
      trialNote:
        isPaidPremiumActive
          ? 'Premium subscription is currently active'
          : isTrialActive
            ? 'Trial access is already active on this account'
            : 'Requires immediate payment for the subscription billing cycle',
      isDisabled: isPremiumActive,
    },
  ]
})

const isFreeTrialCheckout = computed(() => selectedCheckoutPlanId.value === 'free-trial')

const currentCheckoutFlow = computed(() => {
  if (!isFreeTrialCheckout.value) {
    return {
      headerTitle: 'Premium Payment',
      headerDescription: 'Complete the first billing payment now to activate your premium subscription immediately.',
      stepOneTitle: 'Billing Contact',
      stepOneDescription: 'Enter the main billing contact details before continuing to payment for the premium subscription.',
      stepTwoTitle: 'Choose Payment Method',
      stepTwoDescription: 'Select the payment option you want to use for the immediate premium subscription charge.',
      gcashTitle: 'Ready for Payment',
      gcashDescription: 'Complete the sample GCash payment in the new tab to activate your premium subscription immediately.',
      gcashStatusTitle: 'GCash payment tab',
      gcashStatusWaiting: 'Waiting to reopen payment tab',
      gcashStatusOpened: 'Opened in a new tab',
      gcashStatusHelp: 'Return here after completing the payment in the sample payment page.',
      cardTitle: 'Confirm Payment',
      cardDescription: 'Review your selected payment method and confirm the immediate payment for the premium subscription.',
      cardStatusTitle: 'Selected Payment Method',
      cardStatusHelp: 'The first billing cycle will be charged now.',
      processingText: 'Processing your premium subscription payment. Please wait a moment.',
      reopenAction: 'Open Payment Tab Again',
      confirmAction: 'Pay Now',
      modalTitle: 'Proceed to payment?',
      modalDescription: 'Continue to payment and pay now to activate your premium subscription.',
      modalNote: 'Your selected method will be charged immediately for the first billing cycle.',
      successTitle: 'Premium Subscription Activated',
      successDescription: 'Your premium subscription is active now and the first billing payment has been completed.',
      successStatusTitle: 'Payment received successfully',
      successStatusDescription: 'Your business account now has premium subscription access.',
      summaryNotePending: 'Your premium subscription payment is ready.',
      summaryNoteSuccess: 'Premium subscription activated successfully.',
      summaryItemTitle: 'Premium Subscription',
      summaryItemDescription: 'Immediate access to premium employer tools',
      subtotal: PREMIUM_SUBSCRIPTION_AMOUNT,
      discount: '',
      vat: 'PHP 0.00',
      total: PREMIUM_SUBSCRIPTION_AMOUNT,
      summaryMetaLabel: 'Charged today',
      summaryMetaValue: PREMIUM_SUBSCRIPTION_AMOUNT,
      popupBadge: 'Immediate payment',
      popupTitle: 'GCash payment page',
      popupDescription: 'This is a sample payment screen. Click the button below to simulate paying for the premium subscription now.',
      popupAction: 'I already paid',
      popupAmount: PREMIUM_SUBSCRIPTION_AMOUNT,
      historyPlan: 'Premium Subscription',
      historyAmount: PREMIUM_SUBSCRIPTION_AMOUNT,
      historyStatus: 'Completed',
      historyBillingNote: 'Immediate subscription payment completed.',
    }
  }

  return {
    headerTitle: 'Billing Setup',
    headerDescription: 'Save a payment method for automatic billing after your 30-day premium free trial.',
    stepOneTitle: 'Billing Contact',
    stepOneDescription: 'Enter the main billing contact details before continuing to the payment method setup for your free trial.',
    stepTwoTitle: 'Choose Billing Method',
    stepTwoDescription: 'Choose the payment method that will be used automatically after the 30-day premium trial.',
    gcashTitle: 'Ready for Billing Authorization',
    gcashDescription: 'Open the sample GCash tab to authorize automatic billing for after your 30-day trial. No charge is collected today.',
    gcashStatusTitle: 'GCash authorization tab',
    gcashStatusWaiting: 'Waiting to reopen authorization tab',
    gcashStatusOpened: 'Opened in a new tab',
    gcashStatusHelp: 'Return here after authorizing the billing setup in the sample payment page.',
    cardTitle: 'Confirm Billing Setup',
    cardDescription: 'Review your selected payment method and confirm the saved billing setup for automatic renewal after the trial.',
    cardStatusTitle: 'Selected Billing Method',
    cardStatusHelp: 'No charge will be made today.',
    processingText: 'Saving your billing setup. Please wait a moment.',
    reopenAction: 'Open Authorization Tab Again',
    confirmAction: 'Confirm Billing Setup',
    modalTitle: 'Start free trial setup?',
    modalDescription: 'Continue and save a billing method for automatic billing after your 30-day premium trial.',
    modalNote: 'No charge today. Billing starts automatically after the 30-day trial unless cancelled.',
    successTitle: 'Free Trial Activated',
    successDescription: 'Your premium free trial is active for 30 days. The selected billing method will be used automatically after the trial unless cancelled.',
    successStatusTitle: 'Billing method saved successfully',
    successStatusDescription: 'Your business account now has premium trial access.',
    summaryNotePending: 'Your premium free trial setup is ready.',
    summaryNoteSuccess: 'Free trial activated successfully.',
    summaryItemTitle: 'Premium Plan Free Trial',
    summaryItemDescription: '30-day access with billing starting after the trial',
    subtotal: PREMIUM_SUBSCRIPTION_AMOUNT,
    discount: `- ${PREMIUM_SUBSCRIPTION_AMOUNT}`,
    vat: 'PHP 0.00',
    total: 'PHP 0.00',
    summaryMetaLabel: 'Automatic billing starts',
    summaryMetaValue: 'After 30 days',
    popupBadge: 'Billing authorization',
    popupTitle: 'GCash billing setup',
    popupDescription: 'This sample screen lets you authorize automatic billing after the 30-day premium trial. No payment is collected today.',
    popupAction: 'Authorize Automatic Billing',
    popupAmount: 'PHP 0.00 today',
    historyPlan: 'Premium Free Trial',
    historyAmount: 'PHP 0.00',
    historyStatus: 'Trial Active',
    historyBillingNote: 'Automatic billing starts after the 30-day trial.',
  }
})

const paymentMethods = [
  {
    id: 'gcash',
    title: 'GCash',
    copy: 'Pay through your GCash wallet for a faster checkout.',
    image: gcashPaymentLogo,
    badge: 'E-Wallet',
    accent: 'gcash',
    meta: 'Instant wallet payment',
  },
  {
    id: 'card',
    title: 'Credit Card',
    copy: 'Use Visa, Mastercard, or other supported cards.',
    image: masterCardLogo,
    badge: 'Card Payment',
    accent: 'card',
    meta: 'Visa, Mastercard accepted',
  },
]

const paymentMethodOptions = computed(() =>
  paymentMethods.map((method) => {
    if (isFreeTrialCheckout.value && method.id === 'gcash') {
      return {
        ...method,
        badge: 'Premium Only',
        copy: 'Direct PayMongo GCash checkout is available only for the paid Premium plan.',
        meta: 'Unavailable for PHP 0.00 Free Trial',
        disabled: true,
      }
    }

    return {
      ...method,
      disabled: false,
    }
  }),
)

const generateOrderReceiptCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''

  for (let index = 0; index < 8; index += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return `#TPS${suffix}`
}

const orderReceiptCode = ref(generateOrderReceiptCode())
const orderReceiptDate = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
}).format(new Date())

const normalizePaymentHistoryStatusValue = (value) => String(value || '').trim().toLowerCase()
const normalizePaymentHistoryStatusClass = (value) =>
  normalizePaymentHistoryStatusValue(value).replace(/[^a-z0-9]+/g, '-')
const paymentHistoryInitialsFromName = (value, fallback = 'BA') =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || fallback

const paymentHistoryStatusOptions = computed(() => [
  { value: 'all', label: 'All Status' },
  { value: 'trial active', label: 'Trial Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
])

const filteredBusinessPaymentHistoryEntries = computed(() => {
  const query = String(paymentHistorySearch.value || '').trim().toLowerCase()
  const statusFilter = normalizePaymentHistoryStatusValue(paymentHistoryStatusFilter.value || 'all')

  return paymentHistoryEntries.value.filter((entry) => {
    const matchesQuery = !query || [
      entry.id,
      entry.receiptCode,
      entry.plan,
      entry.amount,
      entry.method,
      entry.status,
      entry.ownerName,
      entry.ownerEmail,
      entry.billingNote,
    ]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(query))

    const matchesStatus = statusFilter === 'all'
      || normalizePaymentHistoryStatusValue(entry.status) === statusFilter

    return matchesQuery && matchesStatus
  })
})

const formatSubscriptionDate = (value) => new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
}).format(value)

const formatPaymentHistoryDate = (value) => new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
}).format(value)

const formatPaymentHistoryTime = (value) => new Intl.DateTimeFormat('en-PH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
}).format(value)

const getBusinessAccountIdentity = (user = authUser.value) => {
  if (!user) return ''

  return [
    user.workspace_owner_id || user.workspaceOwnerId || user.id,
    user.workspace_owner_email || user.workspaceOwnerEmail || user.email,
    user.workspace_owner_role || user.workspaceOwnerRole || user.role,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
}

const currentBusinessAccountIdentity = computed(() => getBusinessAccountIdentity())

const findLegacyBusinessStorageKey = (baseKey) => {
  if (typeof window === 'undefined' || !authUser.value) return ''

  const normalizedEmail = String(
    authUser.value.workspace_owner_email
    || authUser.value.workspaceOwnerEmail
    || authUser.value.email
    || '',
  ).trim().toLowerCase()
  const normalizedRole = String(
    authUser.value.workspace_owner_role
    || authUser.value.workspaceOwnerRole
    || authUser.value.role
    || '',
  ).trim().toLowerCase()
  if (!normalizedEmail) return ''

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !key.startsWith(`${baseKey}:`)) continue

    const normalizedKey = key.toLowerCase()
    if (!normalizedKey.includes(normalizedEmail)) continue
    if (normalizedRole && !normalizedKey.includes(normalizedRole)) continue
    return key
  }

  return ''
}

function hasPersistedBusinessPermissionRoles() {
  return Boolean(readPersistedBusinessPermissionRolesState())
}

const isPaymentHistoryOwnedByCurrentBusiness = (entry) => {
  const currentIdentity = currentBusinessAccountIdentity.value
  if (!currentIdentity) return false

  if (!entry?.accountIdentity) return true

  return entry.accountIdentity === currentIdentity
}

const readStoredPaymentHistory = () => {
  if (!authUser.value) return []

  try {
    const scopedKey = getBusinessScopedStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY)
    const legacyKey = findLegacyBusinessStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY)
    const storageKey = localStorage.getItem(scopedKey) !== null ? scopedKey : legacyKey || scopedKey
    const rawEntries = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(rawEntries)) return []
    const ownedEntries = rawEntries.filter((entry) => isPaymentHistoryOwnedByCurrentBusiness(entry))
    if (storageKey && storageKey !== getBusinessScopedStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY)) {
      paymentHistoryEntries.value = ownedEntries
      syncPaymentHistoryToStorage()
    }
    return ownedEntries
  } catch {
    return []
  }
}

const syncPaymentHistoryToStorage = () => {
  if (!authUser.value) return
  const ownedEntries = paymentHistoryEntries.value.filter((entry) => isPaymentHistoryOwnedByCurrentBusiness(entry))
  localStorage.setItem(getBusinessScopedStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY), JSON.stringify(ownedEntries))
}

const syncAdminPaymentHistory = (entry) => {
  try {
    const current = JSON.parse(localStorage.getItem(ADMIN_PAYMENT_HISTORY_STORAGE_KEY) || '[]')
    const nextEntries = Array.isArray(current) ? current : []
    if (!nextEntries.some((item) => item.id === entry.id)) {
      nextEntries.unshift({
        ...entry,
        buyer: authUser.value?.company_name || authUser.value?.name || 'Business Account',
        buyerEmail: authUser.value?.email || businessEmail.value,
        role: authUser.value?.role || 'employer',
      })
      localStorage.setItem(ADMIN_PAYMENT_HISTORY_STORAGE_KEY, JSON.stringify(nextEntries))
    }
  } catch {
    localStorage.setItem(ADMIN_PAYMENT_HISTORY_STORAGE_KEY, JSON.stringify([
      {
        ...entry,
        buyer: authUser.value?.company_name || authUser.value?.name || 'Business Account',
        buyerEmail: authUser.value?.email || businessEmail.value,
        role: authUser.value?.role || 'employer',
      },
    ]))
  }
}

const resolveSubscriptionHistoryMethodLabel = (mode = '') => {
  if (selectedPaymentMethod.value === 'gcash') return 'GCash'
  if (selectedPaymentMethod.value === 'card') return 'Credit Card'
  return mode === 'trial' ? 'Saved Billing Method' : 'Unknown'
}

const buildSubscriptionHistoryBackfillEntry = (plan = '', mode = '') => {
  const normalizedPlan = String(plan || '').trim().toLowerCase()
  const normalizedMode = String(mode || '').trim().toLowerCase()

  if (normalizedPlan !== 'premium' || !['trial', 'paid'].includes(normalizedMode)) return null
  if (!authUser.value || !currentBusinessAccountIdentity.value) return null

  const sourceDate = normalizedMode === 'trial' ? premiumTrialStartedAt.value : premiumPaidStartedAt.value
  const activationDate = sourceDate ? new Date(sourceDate) : new Date()
  const safeActivationDate = Number.isNaN(activationDate.getTime()) ? new Date() : activationDate
  const receiptSeed = `${currentBusinessAccountIdentity.value}|${normalizedMode}|${safeActivationDate.toISOString()}`
  const receiptSuffixChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let receiptSuffix = ''

  for (let index = 0; index < 8; index += 1) {
    const seedCharCode = receiptSeed.charCodeAt(index % receiptSeed.length) || 0
    receiptSuffix += receiptSuffixChars.charAt(seedCharCode % receiptSuffixChars.length)
  }

  return {
    id: `${normalizedMode === 'trial' ? '#TP' : '#P'}${receiptSuffix}`,
    plan: normalizedMode === 'trial' ? 'Premium Free Trial' : 'Premium Subscription',
    amount: normalizedMode === 'trial' ? 'PHP 0.00' : PREMIUM_SUBSCRIPTION_AMOUNT,
    method: resolveSubscriptionHistoryMethodLabel(normalizedMode),
    status: normalizedMode === 'trial' ? 'Trial Active' : 'Completed',
    date: formatPaymentHistoryDate(safeActivationDate),
    time: formatPaymentHistoryTime(safeActivationDate),
    receiptCode: `${normalizedMode === 'trial' ? '#TP' : '#P'}${receiptSuffix}`,
    billingNote:
      normalizedMode === 'trial'
        ? 'Automatic billing starts after the 30-day trial.'
        : 'Immediate subscription payment completed.',
    accountIdentity: currentBusinessAccountIdentity.value,
    ownerEmail: authUser.value?.email || '',
    ownerName: authUser.value?.company_name || authUser.value?.name || 'Business Account',
    workspaceOwnerId:
      authUser.value?.workspace_owner_id
      || authUser.value?.workspaceOwnerId
      || authUser.value?.id
      || '',
    workspaceOwnerRole:
      authUser.value?.workspace_owner_role
      || authUser.value?.workspaceOwnerRole
      || authUser.value?.role
      || 'employer',
    createdAt: safeActivationDate.toISOString(),
  }
}

const ensureCurrentSubscriptionHistoryEntrySynced = async () => {
  if (!authUser.value || !currentBusinessAccountIdentity.value) return

  const normalizedPlan = String(activeSubscriptionPlan.value || '').trim().toLowerCase()
  const normalizedMode = String(activeSubscriptionMode.value || '').trim().toLowerCase()
  if (normalizedPlan !== 'premium' || !['trial', 'paid'].includes(normalizedMode)) {
    lastSubscriptionHistoryBackfillKey = ''
    return
  }

  if (hasStoredSubscriptionActivationEvidence(normalizedPlan, normalizedMode)) {
    lastSubscriptionHistoryBackfillKey = ''
    return
  }

  const sourceDate = normalizedMode === 'trial' ? premiumTrialStartedAt.value : premiumPaidStartedAt.value
  const syncKey = [
    currentBusinessAccountIdentity.value,
    normalizedPlan,
    normalizedMode,
    sourceDate ? new Date(sourceDate).toISOString() : '',
  ].join('|')

  if (lastSubscriptionHistoryBackfillKey === syncKey) return
  lastSubscriptionHistoryBackfillKey = syncKey

  const historyEntry = buildSubscriptionHistoryBackfillEntry(normalizedPlan, normalizedMode)
  if (!historyEntry) return

  if (!paymentHistoryEntries.value.some((entry) => entry.id === historyEntry.id)) {
    paymentHistoryEntries.value.unshift(historyEntry)
    syncPaymentHistoryToStorage()
    syncAdminPaymentHistory(historyEntry)
  }

  try {
    await saveBusinessPaymentHistoryEntry(historyEntry)
  } catch {
    // Keep the business-local history visible even if Firestore is temporarily unavailable.
  }
}

const startBusinessPaymentHistorySync = async () => {
  stopBusinessPaymentHistorySync()

  if (!authUser.value || !currentBusinessAccountIdentity.value) {
    paymentHistoryEntries.value = []
    return
  }

  const localEntries = readStoredPaymentHistory()
  if (localEntries.length) {
    paymentHistoryEntries.value = localEntries
    try {
      await migrateBusinessPaymentHistoryEntries(localEntries)
    } catch {
      // Keep the local fallback visible if Firestore migration fails.
    }
  }

  stopBusinessPaymentHistorySync = subscribeToBusinessPaymentHistory(
    currentBusinessAccountIdentity.value,
    (entries) => {
      paymentHistoryEntries.value = Array.isArray(entries) ? entries : []
      syncPaymentHistoryToStorage()
      void ensureCurrentSubscriptionHistoryEntrySynced()
    },
    () => {
      if (!paymentHistoryEntries.value.length) {
        paymentHistoryEntries.value = localEntries
      }
    },
  )
}

const getBusinessScopedStorageKey = (baseKey) => {
  const identifier = currentBusinessAccountIdentity.value || 'anonymous-business'

  return `${baseKey}:${identifier}`
}

const getBusinessSubscriptionStorageKey = () => {
  return getBusinessScopedStorageKey(BUSINESS_SUBSCRIPTION_STATE_STORAGE_KEY)
}

const getBusinessProfileStorageKey = () => {
  return getBusinessScopedStorageKey(BUSINESS_PROFILE_STATE_STORAGE_KEY)
}

const getBusinessPendingPayMongoCheckoutStorageKey = () =>
  getBusinessScopedStorageKey(BUSINESS_PENDING_PAYMONGO_CHECKOUT_STORAGE_KEY)

const parsePersistedTemplateLibraryState = (rawValue, normalizeRecord) => {
  try {
    const parsedValue = JSON.parse(rawValue || '[]')
    return Array.isArray(parsedValue) ? parsedValue.map((entry) => normalizeRecord(entry)) : []
  } catch {
    return []
  }
}

const restoreAssessmentTemplateLibrary = () => {
  const scopedKey = getBusinessScopedStorageKey(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY)
  const storageKey = localStorage.getItem(scopedKey) !== null ? scopedKey : BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY
  const templates = parsePersistedTemplateLibraryState(
    localStorage.getItem(storageKey) || '[]',
    normalizeAssessmentTemplateRecord,
  )

  assessmentTemplateLibrary.value = templates
  if (!templates.length) {
    editingAssessmentTemplateId.value = ''
    assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
    return
  }

  const activeTemplate = templates.find((template) => template.id === editingAssessmentTemplateId.value) || templates[0]
  editingAssessmentTemplateId.value = activeTemplate.id
  assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(activeTemplate)
}

const persistAssessmentTemplateLibrary = () => {
  localStorage.setItem(
    getBusinessScopedStorageKey(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY),
    JSON.stringify(assessmentTemplateLibrary.value),
  )
}

const restoreTrainingTemplateLibrary = () => {
  const scopedKey = getBusinessScopedStorageKey(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY)
  const storageKey = localStorage.getItem(scopedKey) !== null ? scopedKey : BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY
  const templates = parsePersistedTemplateLibraryState(
    localStorage.getItem(storageKey) || '[]',
    normalizeTrainingTemplateRecord,
  )

  trainingTemplateLibrary.value = templates
  if (!templates.length) {
    editingTrainingTemplateId.value = ''
    trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
    return
  }

  const activeTemplate = templates.find((template) => template.id === editingTrainingTemplateId.value) || templates[0]
  editingTrainingTemplateId.value = activeTemplate.id
  trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(activeTemplate)
}

const persistTrainingTemplateLibrary = () => {
  localStorage.setItem(
    getBusinessScopedStorageKey(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY),
    JSON.stringify(trainingTemplateLibrary.value),
  )
}

const persistPendingPayMongoCheckout = (payload = {}) => {
  if (!authUser.value) return
  localStorage.setItem(getBusinessPendingPayMongoCheckoutStorageKey(), JSON.stringify(payload))
}

const readPendingPayMongoCheckout = () => {
  if (!authUser.value) return null

  try {
    const rawState = localStorage.getItem(getBusinessPendingPayMongoCheckoutStorageKey())
    return rawState ? JSON.parse(rawState) : null
  } catch {
    return null
  }
}

const clearPendingPayMongoCheckout = () => {
  if (!authUser.value) return
  localStorage.removeItem(getBusinessPendingPayMongoCheckoutStorageKey())
}

const persistBusinessSubscriptionState = () => {
  if (!authUser.value) return

  const payload = {
    activeSubscriptionPlan: activeSubscriptionPlan.value,
    activeSubscriptionMode: activeSubscriptionMode.value,
    premiumTrialStartedAt: premiumTrialStartedAt.value
      ? new Date(premiumTrialStartedAt.value).toISOString()
      : null,
    premiumTrialConsumedAt: resolvedBusinessFreeTrialConsumedAt.value
      ? new Date(resolvedBusinessFreeTrialConsumedAt.value).toISOString()
      : null,
    premiumPaidStartedAt: premiumPaidStartedAt.value
      ? new Date(premiumPaidStartedAt.value).toISOString()
      : null,
    activeSection: activeSection.value,
    subscriptionView: subscriptionView.value,
  }

  localStorage.setItem(getBusinessSubscriptionStorageKey(), JSON.stringify(payload))
}

const syncBusinessSubscriptionStateToProfile = async () => {
  if (!authUser.value?.id) return

  const payload = {
    active_subscription_plan: activeSubscriptionPlan.value,
    active_subscription_mode: activeSubscriptionMode.value,
    premium_trial_started_at: premiumTrialStartedAt.value
      ? new Date(premiumTrialStartedAt.value).toISOString()
      : '',
    premium_trial_consumed_at: resolvedBusinessFreeTrialConsumedAt.value
      ? new Date(resolvedBusinessFreeTrialConsumedAt.value).toISOString()
      : '',
    premium_paid_started_at: premiumPaidStartedAt.value
      ? new Date(premiumPaidStartedAt.value).toISOString()
      : '',
  }

  authUser.value = {
    ...(authUser.value || {}),
    ...payload,
  }

  try {
    await updateEmployerSubscriptionState(authUser.value.id, payload)
  } catch {
    // Keep local state even if Firestore sync is temporarily unavailable.
  }
}

const hasStoredSubscriptionActivationEvidence = (plan = '', mode = '') => {
  const normalizedPlan = String(plan || '').trim().toLowerCase()
  const normalizedMode = String(mode || '').trim().toLowerCase()

  if (normalizedPlan !== 'premium' || !['trial', 'paid'].includes(normalizedMode)) return false

  return paymentHistoryEntries.value.some((entry) => {
    if (!isPaymentHistoryOwnedByCurrentBusiness(entry)) return false

    const entryPlan = String(entry?.plan || '').trim().toLowerCase()
    const entryStatus = String(entry?.status || '').trim().toLowerCase()
    const billingNote = String(entry?.billingNote || '').trim().toLowerCase()

    if (normalizedMode === 'trial') {
      return isBusinessTrialHistoryEntry({
        plan: entryPlan,
        status: entryStatus,
        billingNote,
      })
    }

    return (
      entryPlan.includes('premium subscription')
      || entryStatus === 'completed'
      || billingNote.includes('payment completed')
      || billingNote.includes('subscription payment')
    )
  })
}

const applyDefaultBusinessSubscriptionLanding = () => {
  activeSubscriptionPlan.value = 'free'
  activeSubscriptionMode.value = 'none'
  premiumTrialStartedAt.value = null
  premiumPaidStartedAt.value = null
  activeSection.value = 'dashboard'
  activeSidebarGroup.value = 'dashboard'
  expandedSidebarGroups.value = []
  subscriptionView.value = 'plans'
  isSubscriptionStateHydrated.value = true
}

const hasActiveBusinessSubscriptionState = () =>
  activeSubscriptionPlan.value === 'premium'
  && ['trial', 'paid'].includes(String(activeSubscriptionMode.value || '').trim().toLowerCase())

const resolveHistoryBackedBusinessSubscriptionState = () => {
  const ownedEntries = paymentHistoryEntries.value
    .filter((entry) => isPaymentHistoryOwnedByCurrentBusiness(entry))
    .map((entry) => ({
      entry,
      activatedAt: parseBusinessPaymentHistoryActivationDate(entry),
      plan: String(entry?.plan || '').trim().toLowerCase(),
      status: String(entry?.status || '').trim().toLowerCase(),
      billingNote: String(entry?.billingNote || '').trim().toLowerCase(),
    }))
    .filter((entry) => entry.activatedAt)
    .sort((left, right) => right.activatedAt.getTime() - left.activatedAt.getTime())

  const latestPaidEntry = ownedEntries.find(({ plan, status, billingNote }) =>
    plan.includes('premium subscription')
    || status === 'completed'
    || billingNote.includes('payment completed')
    || billingNote.includes('subscription payment'),
  )
  const latestTrialConsumedAt = resolveHistoryBackedBusinessFreeTrialConsumedDate()

  if (latestPaidEntry) {
    return {
      activeSubscriptionPlan: 'premium',
      activeSubscriptionMode: 'paid',
      premiumTrialStartedAt: null,
      premiumTrialConsumedAt: latestTrialConsumedAt ? latestTrialConsumedAt.toISOString() : '',
      premiumPaidStartedAt: latestPaidEntry.activatedAt.toISOString(),
    }
  }

  const latestTrialEntry = ownedEntries.find(({ plan, status, billingNote, activatedAt }) => {
    const trialEndDate = new Date(activatedAt)
    trialEndDate.setDate(trialEndDate.getDate() + 30)

    return trialEndDate.getTime() > Date.now() && isBusinessTrialHistoryEntry({
      plan,
      status,
      billingNote,
    })
  })

  if (!latestTrialEntry) return null

  return {
    activeSubscriptionPlan: 'premium',
    activeSubscriptionMode: 'trial',
    premiumTrialStartedAt: latestTrialEntry.activatedAt.toISOString(),
    premiumTrialConsumedAt: latestTrialEntry.activatedAt.toISOString(),
    premiumPaidStartedAt: null,
  }
}

const resolveRestorableBusinessSubscriptionState = (state = null, options = {}) => {
  const normalizedPlan = String(
    state?.activeSubscriptionPlan
    || state?.active_subscription_plan
    || '',
  ).trim().toLowerCase()
  const normalizedMode = String(
    state?.activeSubscriptionMode
    || state?.active_subscription_mode
    || '',
  ).trim().toLowerCase()

  if (normalizedPlan !== 'premium' || !['trial', 'paid'].includes(normalizedMode)) return null

  const trialStartedAt = parsePersistedBusinessSubscriptionDate(
    state?.premiumTrialStartedAt
    || state?.premium_trial_started_at
    || state?.premiumTrialConsumedAt
    || state?.premium_trial_consumed_at
    || '',
  )
  const paidStartedAt = parsePersistedBusinessSubscriptionDate(
    state?.premiumPaidStartedAt
    || state?.premium_paid_started_at
    || '',
  )
  const trialConsumedAt = resolveStoredBusinessFreeTrialConsumedDate(state)
  const hasStoredActivationEvidence = hasStoredSubscriptionActivationEvidence(normalizedPlan, normalizedMode)
  const allowMissingPaidDate = options?.allowMissingPaidDate === true

  if (normalizedMode === 'paid' && (paidStartedAt || hasStoredActivationEvidence || allowMissingPaidDate)) {
    return {
      activeSubscriptionPlan: 'premium',
      activeSubscriptionMode: 'paid',
      premiumTrialStartedAt: null,
      premiumTrialConsumedAt: trialConsumedAt ? trialConsumedAt.toISOString() : '',
      premiumPaidStartedAt: paidStartedAt ? paidStartedAt.toISOString() : '',
      activeSection: state?.activeSection,
      subscriptionView: state?.subscriptionView,
    }
  }

  if (normalizedMode === 'trial' && trialStartedAt) {
    const trialEndDate = new Date(trialStartedAt)
    trialEndDate.setDate(trialEndDate.getDate() + 30)

    if (trialEndDate.getTime() > Date.now()) {
      return {
        activeSubscriptionPlan: 'premium',
        activeSubscriptionMode: 'trial',
        premiumTrialStartedAt: trialStartedAt.toISOString(),
        premiumTrialConsumedAt: trialStartedAt.toISOString(),
        premiumPaidStartedAt: null,
        activeSection: state?.activeSection,
        subscriptionView: state?.subscriptionView,
      }
    }
  }

  return null
}

const buildProfileBackedSubscriptionState = () => {
  if (!authUser.value) return null

  const accessState = resolveBusinessSubscriptionAccess(authUser.value, { allowMissingPaidDate: true })
  if (!accessState.hasPremiumAccess) return null

  return {
    activeSubscriptionPlan: accessState.activeSubscriptionPlan,
    activeSubscriptionMode: accessState.activeSubscriptionMode,
    premiumTrialStartedAt: accessState.premiumTrialStartedAt,
    premiumTrialConsumedAt: accessState.premiumTrialConsumedAt,
    premiumPaidStartedAt: accessState.premiumPaidStartedAt,
    activeSection: activeSection.value,
    subscriptionView: subscriptionView.value,
  }
}

const restoreBusinessSubscriptionState = () => {
  if (!authUser.value) return

  const profileBackedState = resolveRestorableBusinessSubscriptionState(
    buildProfileBackedSubscriptionState(),
    { allowMissingPaidDate: true },
  )
  const historyBackedState = resolveHistoryBackedBusinessSubscriptionState()
  const profileBackedTrialConsumedAt = resolveLatestBusinessSubscriptionDate(
    resolveBusinessSubscriptionAccess(authUser.value, { allowMissingPaidDate: true }).premiumTrialConsumedAt,
    authUser.value?.premium_trial_consumed_at,
    authUser.value?.premiumTrialConsumedAt,
    authUser.value?.premium_trial_started_at,
    authUser.value?.premiumTrialStartedAt,
  )
  const historyBackedTrialConsumedAt = resolveHistoryBackedBusinessFreeTrialConsumedDate()

  try {
    const storageKey = localStorage.getItem(getBusinessSubscriptionStorageKey())
      ? getBusinessSubscriptionStorageKey()
      : findLegacyBusinessStorageKey(BUSINESS_SUBSCRIPTION_STATE_STORAGE_KEY)
    const rawState = storageKey ? localStorage.getItem(storageKey) : null
    if (!rawState) {
      const restoredState = profileBackedState || historyBackedState
      premiumTrialConsumedAt.value = resolveLatestBusinessSubscriptionDate(
        restoredState?.premiumTrialConsumedAt,
        profileBackedTrialConsumedAt,
        historyBackedTrialConsumedAt,
      )
      if (restoredState) {
        activeSubscriptionPlan.value = restoredState.activeSubscriptionPlan
        activeSubscriptionMode.value = restoredState.activeSubscriptionMode
        premiumTrialStartedAt.value = parsePersistedBusinessSubscriptionDate(
          restoredState.premiumTrialStartedAt,
        )
        premiumPaidStartedAt.value = parsePersistedBusinessSubscriptionDate(
          restoredState.premiumPaidStartedAt,
        )
        restoreBusinessWorkspaceViewState(restoredState)
        isSubscriptionStateHydrated.value = true
        persistBusinessSubscriptionState()
      } else if (!hasActiveBusinessSubscriptionState()) {
        applyDefaultBusinessSubscriptionLanding()
        persistBusinessSubscriptionState()
      } else {
        isSubscriptionStateHydrated.value = true
      }
      return
    }

    const parsedState = JSON.parse(rawState)
    const storedSubscriptionState = resolveRestorableBusinessSubscriptionState(parsedState)
    const storedTrialConsumedAt = resolveStoredBusinessFreeTrialConsumedDate(parsedState)
    premiumTrialConsumedAt.value = resolveLatestBusinessSubscriptionDate(
      storedTrialConsumedAt,
      profileBackedTrialConsumedAt,
      historyBackedTrialConsumedAt,
    )

    if (storedSubscriptionState) {
      activeSubscriptionPlan.value = storedSubscriptionState.activeSubscriptionPlan
      activeSubscriptionMode.value = storedSubscriptionState.activeSubscriptionMode
      premiumTrialStartedAt.value = parsePersistedBusinessSubscriptionDate(
        storedSubscriptionState.premiumTrialStartedAt,
      )
      premiumPaidStartedAt.value = storedSubscriptionState.activeSubscriptionMode === 'paid'
        ? parsePersistedBusinessSubscriptionDate(storedSubscriptionState.premiumPaidStartedAt) || new Date()
        : null
      restoreBusinessWorkspaceViewState(storedSubscriptionState)
      isSubscriptionStateHydrated.value = true
      if (storageKey && storageKey !== getBusinessSubscriptionStorageKey()) {
        persistBusinessSubscriptionState()
      }
      return
    }
  } catch {
    // Ignore broken stored state and fall back to defaults.
  }

  const restoredState = profileBackedState || historyBackedState
  premiumTrialConsumedAt.value = resolveLatestBusinessSubscriptionDate(
    restoredState?.premiumTrialConsumedAt,
    profileBackedTrialConsumedAt,
    historyBackedTrialConsumedAt,
  )
  if (restoredState) {
    activeSubscriptionPlan.value = restoredState.activeSubscriptionPlan
    activeSubscriptionMode.value = restoredState.activeSubscriptionMode
    premiumTrialStartedAt.value = parsePersistedBusinessSubscriptionDate(
      restoredState.premiumTrialStartedAt,
    )
    premiumPaidStartedAt.value = parsePersistedBusinessSubscriptionDate(
      restoredState.premiumPaidStartedAt,
    )
    restoreBusinessWorkspaceViewState(restoredState)
    isSubscriptionStateHydrated.value = true
    persistBusinessSubscriptionState()
    return
  }

  if (!hasActiveBusinessSubscriptionState()) {
    applyDefaultBusinessSubscriptionLanding()
    persistBusinessSubscriptionState()
  } else {
    isSubscriptionStateHydrated.value = true
  }
}

const buildCurrentBusinessSecurityUser = () => {
  if (!authUser.value) return null
  if (!hasActiveBusinessSubscriptionState()) return authUser.value

  return {
    ...(authUser.value || {}),
    active_subscription_plan: activeSubscriptionPlan.value,
    active_subscription_mode: activeSubscriptionMode.value,
    premium_trial_started_at: premiumTrialStartedAt.value
      ? new Date(premiumTrialStartedAt.value).toISOString()
      : '',
    premium_trial_consumed_at: resolvedBusinessFreeTrialConsumedAt.value
      ? new Date(resolvedBusinessFreeTrialConsumedAt.value).toISOString()
      : '',
    premium_paid_started_at: premiumPaidStartedAt.value
      ? new Date(premiumPaidStartedAt.value).toISOString()
      : '',
  }
}

const applyBusinessSecurityRouteState = () => {
  if (!isSubscriptionStateHydrated.value) return
  if (isSyncingBusinessSecurityRouteState) return

  const securityUser = buildCurrentBusinessSecurityUser()
  if (!securityUser) return

  const routeState = resolveBusinessWorkspaceSecurityState(securityUser, route.query)
  const hasManagedRouteQuery = hasManagedBusinessSecurityQuery(route.query)

  if (!hasManagedRouteQuery && routeState.section === 'workspace') {
    return
  }

  isApplyingBusinessSecurityRouteState = true

  try {
    if (routeState.section === 'profile') {
      activeSection.value = 'profile'
      subscriptionView.value = 'plans'
      return
    }

    if (routeState.section === 'subscriptions') {
      activeSection.value = 'subscriptions'
      subscriptionView.value = routeState.subscriptionView
      if (routeState.planId) {
        selectedCheckoutPlanId.value = resolveAvailableBusinessCheckoutPlanId(routeState.planId)
      }
      if (routeState.subscriptionView !== 'payment') {
        paymentStep.value = 1
      }
    }
  } finally {
    isApplyingBusinessSecurityRouteState = false
  }
}

const syncBusinessSecurityRouteState = async () => {
  const securityUser = buildCurrentBusinessSecurityUser()
  if (!securityUser || isApplyingBusinessSecurityRouteState) return

  const nextQuery = buildBusinessSecurityRouteQuery(
    securityUser,
    {
      section: activeSection.value,
      subscriptionView: subscriptionView.value,
      planId: selectedCheckoutPlanId.value,
    },
    route.query,
  )

  if (managedBusinessSecurityQueryEquals(route.query, nextQuery)) return

  isSyncingBusinessSecurityRouteState = true

  try {
    await router.replace({
      query: nextQuery,
      hash: route.hash,
    })
  } finally {
    isSyncingBusinessSecurityRouteState = false
  }
}

const persistBusinessProfileState = () => {
  if (!authUser.value) return

  const payload = {
    company_name: authUser.value.company_name || '',
    business_contact_email: authUser.value.business_contact_email || '',
    company_category: authUser.value.company_category || '',
    company_location: authUser.value.company_location || '',
    name: authUser.value.name || '',
    business_avatar: authUser.value.business_avatar || '',
  }

  localStorage.setItem(getBusinessProfileStorageKey(), JSON.stringify(payload))
}

const restoreBusinessProfileState = () => {
  if (!authUser.value) return

  try {
    const storageKey = localStorage.getItem(getBusinessProfileStorageKey())
      ? getBusinessProfileStorageKey()
      : findLegacyBusinessStorageKey(BUSINESS_PROFILE_STATE_STORAGE_KEY)
    const rawState = storageKey ? localStorage.getItem(storageKey) : null
    if (!rawState) return

    const parsedState = JSON.parse(rawState)
    authUser.value = {
      ...authUser.value,
      company_name: parsedState?.company_name || authUser.value.company_name,
      business_contact_email:
        parsedState?.business_contact_email
        || authUser.value.business_contact_email
        || '',
      company_category: parsedState?.company_category || authUser.value.company_category,
      company_location: parsedState?.company_location || authUser.value.company_location,
      name: parsedState?.name || authUser.value.name,
      business_avatar: parsedState?.business_avatar || '',
    }
    localStorage.setItem('authUser', JSON.stringify(authUser.value))
    if (storageKey && storageKey !== getBusinessProfileStorageKey()) {
      persistBusinessProfileState()
    }
  } catch {
    // Ignore broken stored state and keep current auth user.
  }
}

const persistSeenPremiumNavItems = () => {
  if (!authUser.value) return
  const allowedIds = new Set(premiumNavigationItems.map((item) => item.id))
  const normalizedSeenItems = Array.from(new Set(
    seenPremiumNavItems.value
      .map((item) => String(item || '').trim())
      .filter((item) => allowedIds.has(item)),
  ))

  seenPremiumNavItems.value = normalizedSeenItems
  localStorage.setItem(getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY), JSON.stringify(normalizedSeenItems))
}

const restoreSeenPremiumNavItems = () => {
  if (!authUser.value) return

  try {
    const storageKey = localStorage.getItem(getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY))
      ? getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY)
      : findLegacyBusinessStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY)
    const rawItems = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const allowedIds = new Set(premiumNavigationItems.map((item) => item.id))
    seenPremiumNavItems.value = Array.from(new Set(
      (Array.isArray(rawItems) ? rawItems : [])
        .map((item) => String(item || '').trim())
        .filter((item) => allowedIds.has(item)),
    ))
    if (storageKey && storageKey !== getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY)) {
      persistSeenPremiumNavItems()
    }
  } catch {
    seenPremiumNavItems.value = []
  }
}

const premiumTrialEndDate = computed(() => {
  if (!premiumTrialStartedAt.value) return null

  const nextDate = new Date(premiumTrialStartedAt.value)
  nextDate.setDate(nextDate.getDate() + 30)
  return nextDate
})

const premiumPaidRenewalDate = computed(() => {
  if (!premiumPaidStartedAt.value) return null

  const nextDate = new Date(premiumPaidStartedAt.value)
  nextDate.setDate(nextDate.getDate() + 30)
  return nextDate
})

const premiumTrialStartedLabel = computed(() =>
  premiumTrialStartedAt.value ? formatSubscriptionDate(premiumTrialStartedAt.value) : '',
)

const premiumTrialEndLabel = computed(() =>
  premiumTrialEndDate.value ? formatSubscriptionDate(premiumTrialEndDate.value) : '',
)

const premiumPaidStartedLabel = computed(() =>
  premiumPaidStartedAt.value ? formatSubscriptionDate(premiumPaidStartedAt.value) : '',
)

const premiumPaidRenewalLabel = computed(() =>
  premiumPaidRenewalDate.value ? formatSubscriptionDate(premiumPaidRenewalDate.value) : '',
)

const paymentLoadingMessage = computed(() => {
  if (paymentStep.value === 1) {
    return 'Proceeding to billing method...'
  }

  if (paymentStep.value === 2) {
    return 'Proceeding to payment confirmation...'
  }

  return 'Processing your payment step...'
})

const activeSubscriptionOverview = computed(() => {
  if (activeSubscriptionMode.value === 'trial') {
    return {
      plan: 'Premium Free Trial',
      label: 'Automatic billing starts',
      value: premiumTrialEndLabel.value || 'After 30 days',
      copy:
        premiumTrialStartedLabel.value && premiumTrialEndLabel.value
          ? `Trial started ${premiumTrialStartedLabel.value}. Your selected payment method will be billed on ${premiumTrialEndLabel.value} unless cancelled.`
          : 'Your premium free trial is active and will move into automatic billing after 30 days unless cancelled.',
    }
  }

  if (activeSubscriptionMode.value === 'paid') {
    return {
      plan: 'Premium Subscription',
      label: 'Next billing statement',
      value: premiumPaidRenewalLabel.value || 'Monthly renewal active',
      copy:
        premiumPaidStartedLabel.value && premiumPaidRenewalLabel.value
          ? `Premium subscription paid on ${premiumPaidStartedLabel.value}. Your next billing date is ${premiumPaidRenewalLabel.value}.`
          : 'Your premium subscription is active and billing is already in progress.',
    }
  }

  return {
    plan: 'No active subscription yet',
    label: 'Subscriptions status',
    value: 'Waiting for activation',
    copy: 'Choose Free Trial to start premium first, or Premium Subscription to pay and activate it right away.',
  }
})

const firstPremiumSidebarGuideItemId = computed(() => {
  const matchingItem = premiumNavigationItems.find((item) => !seenPremiumNavItems.value.includes(item.id))
  return matchingItem?.id || premiumNavigationItems[0]?.id || ''
})

const premiumWelcomeGuideSteps = computed(() => [
  {
    id: 'welcome',
    badge: '',
    title: `Congratulations, ${businessName.value}!`,
    description:
      premiumWelcomeGuideMode.value === 'paid'
        ? 'Your premium account is now active and ready to use.'
        : 'Your premium access is now active and ready to use.',
    note:
      premiumWelcomeGuideMode.value === 'paid'
        ? 'You can start using your premium features right now.'
        : 'You can use it right now. Reminder: after 30 days, payment will be required to keep premium active.',
    actionLabel: "Let's Go",
    target: '',
  },
  {
    id: 'sidebar-new',
    badge: 'New premium tools',
    title: 'Your premium tools are now live in the sidebar',
    description:
      'Red NEW tags now appear across your premium workspace from Job Posting up to Permissions, so your team can spot each newly unlocked tool right away.',
    note: 'You will stay on the dashboard while the new premium links remain visible in the sidebar.',
    actionLabel: 'Finish',
    target: 'sidebar-new',
  },
])

const currentPremiumWelcomeGuideStep = computed(() =>
  premiumWelcomeGuideSteps.value[premiumWelcomeGuideStep.value] || premiumWelcomeGuideSteps.value[0],
)

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max)

const waitForInterface = (delay = 0) => new Promise((resolve) => {
  window.setTimeout(resolve, delay)
})

const resolveCurrentPremiumGuideTargetElement = () => {
  const target = currentPremiumWelcomeGuideStep.value?.target

  if (target === 'job-post-unlimited') return jobPostUnlimitedHighlightRef.value
  if (target === 'sidebar-new') return firstPremiumSidebarGuideItemId.value ? sidebarLinkRefs.value[firstPremiumSidebarGuideItemId.value] : null

  return null
}

const updatePremiumGuideLayout = () => {
  if (!isPremiumWelcomeGuideVisible.value) {
    premiumGuideTargetRect.value = null
    return
  }

  const targetElement = resolveCurrentPremiumGuideTargetElement()
  if (!targetElement) {
    premiumGuideTargetRect.value = null
    return
  }

  const rect = targetElement.getBoundingClientRect()
  premiumGuideTargetRect.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  }
}

const premiumGuideSpotlightStyle = computed(() => {
  if (!premiumGuideTargetRect.value) return {}

  const padding = 10
  return {
    top: `${Math.max(12, premiumGuideTargetRect.value.top - padding)}px`,
    left: `${Math.max(12, premiumGuideTargetRect.value.left - padding)}px`,
    width: `${premiumGuideTargetRect.value.width + padding * 2}px`,
    height: `${premiumGuideTargetRect.value.height + padding * 2}px`,
  }
})

const premiumGuideCardStyle = computed(() => {
  if (typeof window === 'undefined') return {}

  const rect = premiumGuideTargetRect.value
  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const sidePadding = 16
  const cardWidth = Math.min(360, Math.max(280, window.innerWidth - sidePadding * 2))
  const estimatedCardHeight = 240
  const shouldPlaceBelow = rect.bottom + estimatedCardHeight + 24 <= window.innerHeight
  const top = shouldPlaceBelow
    ? rect.bottom + 18
    : Math.max(sidePadding, rect.top - estimatedCardHeight - 18)
  const left = clampValue(rect.left + rect.width / 2 - cardWidth / 2, sidePadding, Math.max(sidePadding, window.innerWidth - cardWidth - sidePadding))

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${cardWidth}px`,
  }
})

const isPremiumGuideTarget = (target, id = '') => {
  if (!isPremiumWelcomeGuideVisible.value) return false
  if (currentPremiumWelcomeGuideStep.value?.target !== target) return false
  if (target === 'sidebar-new') return id === firstPremiumSidebarGuideItemId.value
  return true
}

const syncPremiumWelcomeGuideStep = async (step) => {
  premiumWelcomeGuideStep.value = step
  const expandedPremiumSidebarGroups = sidebarGroups.value
    .filter((group) => group.id !== 'dashboard')
    .map((group) => group.id)

  if (step === 0) {
    activeSection.value = 'dashboard'
    activeSidebarGroup.value = 'dashboard'
    expandedSidebarGroups.value = expandedPremiumSidebarGroups
    await nextTick()
    premiumGuideTargetRect.value = null
    return
  }

  activeSection.value = 'dashboard'
  activeSidebarGroup.value = 'dashboard'
  expandedSidebarGroups.value = expandedPremiumSidebarGroups

  await nextTick()
  await waitForInterface(120)

  const targetElement = resolveCurrentPremiumGuideTargetElement()
  targetElement?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  await waitForInterface(targetElement ? 140 : 0)
  updatePremiumGuideLayout()
}

const openPremiumWelcomeGuide = async (mode = 'paid') => {
  premiumWelcomeGuideMode.value = mode
  isPremiumWelcomeGuideVisible.value = true
  await syncPremiumWelcomeGuideStep(0)
}

const closePremiumWelcomeGuide = () => {
  isPremiumWelcomeGuideVisible.value = false
  premiumGuideTargetRect.value = null
  pendingPremiumWelcomeGuideMode.value = ''
  activeSection.value = 'dashboard'
  activeSidebarGroup.value = 'dashboard'
}

const advancePremiumWelcomeGuide = async () => {
  const nextStep = premiumWelcomeGuideStep.value + 1
  if (nextStep >= premiumWelcomeGuideSteps.value.length) {
    closePremiumWelcomeGuide()
    return
  }

  await syncPremiumWelcomeGuideStep(nextStep)
}

const showPendingPremiumWelcomeGuide = async () => {
  const mode = pendingPremiumWelcomeGuideMode.value
  if (!mode) return

  pendingPremiumWelcomeGuideMode.value = ''
  await openPremiumWelcomeGuide(mode)
}

const paymentStepRows = computed(() => [
  {
    step: 'Step 1',
    title: 'Contact',
    icon: 'bi bi-person-fill',
    status: paymentStep.value === 1 ? 'Current' : paymentStep.value > 1 ? 'Done' : 'Pending',
  },
  {
    step: 'Step 2',
    title: isFreeTrialCheckout.value ? 'Billing Method' : 'Payment Method',
    icon: 'bi bi-credit-card-fill',
    status: paymentStep.value === 2 ? 'Current' : paymentStep.value > 2 ? 'Done' : 'Pending',
  },
  {
    step: 'Step 3',
    title: isFreeTrialCheckout.value ? 'Authorize' : 'Payment',
    icon: 'bi bi-hourglass-split',
    status: paymentStep.value === 3 ? 'Current' : paymentStep.value > 3 ? 'Done' : 'Pending',
  },
  {
    step: 'Step 4',
    title: 'Finish',
    icon: 'bi bi-flag-fill',
    status: paymentStep.value === 4 ? 'Current' : 'Pending',
  },
])

const getCountryFlagClass = (countryCode) => `fi fi-${String(countryCode || '').toLowerCase()}`

const formatContactNumberDisplay = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  const parts = []
  const first = digits.slice(0, 3)
  const second = digits.slice(3, 6)
  const third = digits.slice(6, 10)
  const remainder = digits.slice(10)
  if (first) parts.push(first)
  if (second) parts.push(second)
  if (third) parts.push(third)
  if (remainder) parts.push(remainder)
  return parts.join(' ')
}

const sanitizePaymentFullName = (value = '') =>
  String(value || '')
    .replace(/[^A-Za-z\s.'-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart()

const isValidPaymentFullName = (value = '') =>
  /^[A-Za-z]+(?:[A-Za-z\s.'-]*[A-Za-z])?$/.test(String(value || '').trim())

const getPaymentLocalContactDigits = (value = paymentForm.value.contactNumber) => {
  const raw = String(value || '').trim()
  const dial = String(selectedPaymentPhoneCountry.value?.dial || '')
  const withoutDial = dial && raw.startsWith(dial) ? raw.slice(dial.length) : raw
  const digitsOnly = withoutDial.replace(/[^\d]/g, '').slice(0, 10)
  return paymentContactCountryCode.value === 'PH' ? digitsOnly.replace(/^0+/, '') : digitsOnly
}

const closePaymentContactCountryDropdown = () => {
  isPaymentContactCountryDropdownOpen.value = false
}

const togglePaymentContactCountryDropdown = () => {
  isPaymentContactCountryDropdownOpen.value = !isPaymentContactCountryDropdownOpen.value
}

const selectPaymentContactCountryOption = (countryCode) => {
  const localDigits = getPaymentLocalContactDigits()
  paymentContactCountryCode.value = countryCode
  const nextCountry = PHONE_COUNTRIES.find((country) => country.code === countryCode) || PHONE_COUNTRIES[0]
  paymentForm.value.contactNumber = localDigits ? `${nextCountry.dial}${localDigits}` : ''
  closePaymentContactCountryDropdown()
}

const handlePaymentContactNumberChange = (event) => {
  const input = event?.target
  const digitsOnly = String(input?.value || '').replace(/[^\d]/g, '').slice(0, 10)
  const normalized = paymentContactCountryCode.value === 'PH' ? digitsOnly.replace(/^0+/, '') : digitsOnly
  const limited = normalized.slice(0, 10)
  paymentForm.value.contactNumber = limited ? `${selectedPaymentPhoneCountry.value.dial}${limited}` : ''
  if (input) input.value = formatContactNumberDisplay(limited)
}

const handlePaymentFullNameInput = (event) => {
  const input = event?.target
  const sanitized = sanitizePaymentFullName(input?.value || paymentForm.value.fullName)
  paymentForm.value.fullName = sanitized
  if (input && input.value !== sanitized) {
    input.value = sanitized
  }
}

const closeProfileMenu = (event) => {
  if (!event.target.closest('.admin-navbar__profile-wrap') && !event.target.closest('.business-navbar__account')) {
    isProfileMenuOpen.value = false
  }

  if (!event.target.closest('.admin-navbar__notification-wrap') && !event.target.closest('.business-navbar__notifications')) {
    isNotificationMenuOpen.value = false
  }

  if (!event.target.closest('.business-payment__phone-country')) {
    closePaymentContactCountryDropdown()
  }
}

const confirmLogout = async () => {
  if (isLogoutSubmitting.value) return
  isLogoutSubmitting.value = true
  clearAuthSession()
  sessionStorage.setItem('showLoggedOutToast', '1')
  await router.push('/login')
}

const openLogoutConfirm = () => {
  isProfileMenuOpen.value = false
  isLogoutConfirmOpen.value = true
}

const closeLogoutConfirm = () => {
  if (isLogoutSubmitting.value) return
  isLogoutConfirmOpen.value = false
}

const openSupportPage = async (path) => {
  isProfileMenuOpen.value = false
  await router.push(path)
}

const openHelpCenterModal = () => {
  isProfileMenuOpen.value = false
  isHelpCenterModalOpen.value = true
}

const closeHelpCenterModal = () => {
  isHelpCenterModalOpen.value = false
}

const openSubscriptionPlans = () => {
  activeSection.value = 'subscriptions'
  subscriptionView.value = 'plans'
}

const openPersonalization = () => {
  openSubscriptionPlans()
  isProfileMenuOpen.value = false
}

const openUpgradePlan = () => {
  openSubscriptionPlans()
  isProfileMenuOpen.value = false
}

const openProfileAvatarPicker = () => {
  profileAvatarInputRef.value?.click()
}

const clearProfileAvatarInput = () => {
  if (profileAvatarInputRef.value) profileAvatarInputRef.value.value = ''
}

const removeProfileAvatar = () => {
  isProfileAvatarLoading.value = false
  isProfileAvatarReady.value = false
  profileForm.value.avatar = ''
  clearProfileAvatarInput()
}

const preloadBusinessProfileAvatar = (source) => new Promise((resolve, reject) => {
  const image = new window.Image()
  image.onload = () => resolve(source)
  image.onerror = () => reject(new Error('Unable to load that image preview.'))
  image.src = source
})

const handleProfileAvatarChange = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  if (!authUser.value) return

  if (!file.type.startsWith('image/')) {
    showPaymentToast('Please upload a valid image file.', 'error')
    clearProfileAvatarInput()
    return
  }

  if (file.size > 4 * 1024 * 1024) {
    showPaymentToast('Image is too large. Please upload 4MB or smaller.', 'error')
    clearProfileAvatarInput()
    return
  }

  isProfileAvatarLoading.value = true
  isProfileAvatarReady.value = false

  try {
    const uploadedAvatar = await uploadEmployerBusinessAvatar(authUser.value.id, file)
    await preloadBusinessProfileAvatar(uploadedAvatar.url)

    const payload = {
      company_name: profileForm.value.companyName.trim() || authUser.value.company_name || authUser.value.name,
      name: profileForm.value.contactPerson.trim() || authUser.value.name || '',
      business_contact_email:
        profileForm.value.email.trim()
        || authUser.value.business_contact_email
        || authUser.value.email,
      company_category: profileForm.value.category.trim(),
      company_location: profileForm.value.location.trim(),
      business_avatar: uploadedAvatar.url,
      avatar: uploadedAvatar.url,
      business_avatar_path: uploadedAvatar.path,
      avatar_path: uploadedAvatar.path,
    }

    const updatedProfile = await updateEmployerAdminDetails(authUser.value.id, payload)
    const nextUser = {
      ...authUser.value,
      ...updatedProfile,
      name: payload.name || updatedProfile.name || authUser.value.name,
      company_name: payload.company_name,
      business_contact_email: payload.business_contact_email,
      company_category: payload.company_category,
      company_location: payload.company_location,
      business_avatar: payload.business_avatar,
      avatar: payload.avatar,
      business_avatar_path: payload.business_avatar_path,
      avatar_path: payload.avatar_path,
    }

    authUser.value = nextUser
    profileForm.value.avatar = uploadedAvatar.url
    localStorage.setItem('authUser', JSON.stringify(nextUser))
    persistBusinessProfileState()
    isProfileAvatarReady.value = true
    showPaymentToast('Business profile photo uploaded successfully.', 'success')
  } catch (error) {
    clearProfileAvatarInput()
    showPaymentToast(error instanceof Error ? error.message : 'Unable to upload the business profile photo right now.', 'error')
  } finally {
    isProfileAvatarLoading.value = false
  }
}

const saveBusinessProfile = async () => {
  if (!authUser.value) return

  let avatarUrl = profileForm.value.avatar || ''
  let avatarPath = authUser.value?.business_avatar_path || authUser.value?.avatar_path || ''

  try {
    const payload = {
      company_name: profileForm.value.companyName.trim() || authUser.value.company_name || authUser.value.name,
      name: profileForm.value.contactPerson.trim() || authUser.value.name || '',
      business_contact_email:
        profileForm.value.email.trim()
        || authUser.value.business_contact_email
        || authUser.value.email,
      company_category: profileForm.value.category.trim(),
      company_location: profileForm.value.location.trim(),
      business_avatar: avatarUrl,
      avatar: avatarUrl,
      business_avatar_path: avatarPath,
      avatar_path: avatarPath,
    }

    const updatedProfile = await updateEmployerAdminDetails(authUser.value.id, payload)
    const nextUser = {
      ...authUser.value,
      ...updatedProfile,
      name: payload.name || updatedProfile.name || authUser.value.name,
      company_name: payload.company_name,
      business_contact_email: payload.business_contact_email,
      company_category: payload.company_category,
      company_location: payload.company_location,
      business_avatar: payload.business_avatar,
      avatar: payload.avatar,
      business_avatar_path: payload.business_avatar_path,
      avatar_path: payload.avatar_path,
    }

    authUser.value = nextUser
    localStorage.setItem('authUser', JSON.stringify(nextUser))
    persistBusinessProfileState()
    syncProfileFormFromAuthUser()
    showPaymentToast('Business profile updated successfully.', 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to save the business profile right now.', 'error')
  }
}

const openSidebarGroup = (group) => {
  if (!group) return

  const isExpanded = expandedSidebarGroups.value.includes(group.id)
  expandedSidebarGroups.value = isExpanded
    ? expandedSidebarGroups.value.filter((entry) => entry !== group.id)
    : [...expandedSidebarGroups.value, group.id]
}

const handleSidebarSectionClick = (item) => {
  if (!item) return

  activeSection.value = item.id
  if (item.id === 'job-posting') setJobPostingDefaultTab()
  if (item.id === 'training-templates') setTrainingTemplatesTab(trainingTemplatesTab.value)
  const matchingGroup = sidebarGroups.value.find((group) => group.items.some((groupItem) => groupItem.id === item.id))
  if (matchingGroup) {
    activeSidebarGroup.value = matchingGroup.id
    if (!expandedSidebarGroups.value.includes(matchingGroup.id)) {
      expandedSidebarGroups.value = [...expandedSidebarGroups.value, matchingGroup.id]
    }
  }

  if (premiumNavigationItems.some((premiumItem) => premiumItem.id === item.id) && !seenPremiumNavItems.value.includes(item.id)) {
    seenPremiumNavItems.value = [...seenPremiumNavItems.value, item.id]
    persistSeenPremiumNavItems()
  }

  void syncBusinessSecurityRouteState()
}

const handleSubscriptionPlanClick = (plan) => {
  if (plan?.isDisabled) return

  if (plan?.id === 'free-trial' && hasConsumedBusinessFreeTrial.value && activeSubscriptionMode.value !== 'trial') {
    selectedCheckoutPlanId.value = 'premium'
    showPaymentToast('This account already used its one-time free trial. Please continue with Premium Subscription.', 'warning')
    return
  }

  if (plan?.id === 'free-trial' || plan?.id === 'premium') {
    openTrialConfirmation(plan.id)
  }
}

const openTrialConfirmation = (planId = 'free-trial') => {
  const nextPlanId = resolveAvailableBusinessCheckoutPlanId(planId)
  if (planId === 'free-trial' && nextPlanId !== 'free-trial') {
    selectedCheckoutPlanId.value = nextPlanId
    showPaymentToast('This account already used its one-time free trial. Please continue with Premium Subscription.', 'warning')
    return
  }

  selectedCheckoutPlanId.value = nextPlanId
  isTrialConfirmationOpen.value = true
}

const closeTrialConfirmation = () => {
  isTrialConfirmationOpen.value = false
}

const clearProceedToPaymentTimeout = () => {
  if (proceedToPaymentTimeoutId.value !== null) {
    clearTimeout(proceedToPaymentTimeoutId.value)
    proceedToPaymentTimeoutId.value = null
  }
}

const clearAdvancePaymentTimeout = () => {
  if (advancePaymentTimeoutId.value !== null) {
    clearTimeout(advancePaymentTimeoutId.value)
    advancePaymentTimeoutId.value = null
  }
}

const clearPaymentToastTimeout = () => {
  if (paymentToastTimeoutId.value !== null) {
    clearTimeout(paymentToastTimeoutId.value)
    paymentToastTimeoutId.value = null
  }
}

const getPaymentToastTitle = (message, tone = 'error') => {
  if (tone === 'success') return 'Success'
  if (tone === 'warning') return 'Please Confirm'

  const normalizedMessage = String(message || '').trim().toLowerCase()
  if (normalizedMessage.includes('contact number')) return 'Contact number required'
  if (normalizedMessage.includes('full name')) return 'Full name required'
  if (normalizedMessage.includes('business email')) return 'Business email required'
  if (normalizedMessage.includes('please complete')) return 'Missing information'
  if (normalizedMessage.includes('job post action is blocked in firebase')) return 'Deployment needed'
  return 'Error'
}

const closePaymentToast = () => {
  clearPaymentToastTimeout()
  paymentToast.value = createPaymentToastState()
}

const handlePaymentToastAction = (action) => {
  if (typeof action?.onClick === 'function') {
    action.onClick()
  }
}

const showPaymentToast = (message, tone = 'error', options = {}) => {
  clearPaymentToastTimeout()
  const actions = Array.isArray(options.actions)
    ? options.actions
      .filter((action) => String(action?.label || '').trim() && typeof action?.onClick === 'function')
      .map((action) => ({
        label: String(action.label).trim(),
        variant: String(action.variant || 'primary').trim().toLowerCase(),
        onClick: action.onClick,
      }))
    : []

  paymentToast.value = {
    visible: true,
    title: String(options.title || getPaymentToastTitle(message, tone)).trim(),
    message,
    tone,
    actions,
  }
  pushBusinessNotification({
    title: paymentToast.value.title,
    message,
    tone,
  })

  const duration = Number.isFinite(options.duration) ? options.duration : (actions.length ? 0 : 2600)
  if (duration > 0) {
    paymentToastTimeoutId.value = setTimeout(() => {
      paymentToast.value = createPaymentToastState()
      paymentToastTimeoutId.value = null
    }, duration)
  }
}

const showPaymentConfirmationToast = ({
  title = 'Please Confirm',
  message = '',
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  cancelLabel = 'Cancel',
} = {}) => {
  showPaymentToast(message, 'warning', {
    title,
    duration: 0,
    actions: [
      {
        label: cancelLabel,
        variant: 'secondary',
        onClick: () => {
          closePaymentToast()
        },
      },
      {
        label: confirmLabel,
        variant: confirmVariant,
        onClick: async () => {
          closePaymentToast()
          if (typeof onConfirm === 'function') {
            await onConfirm()
          }
        },
      },
    ],
  })
}

const validatePaymentStepOne = () => {
  const missingFields = []
  const normalizedFullName = sanitizePaymentFullName(paymentForm.value.fullName)

  paymentForm.value.fullName = normalizedFullName

  if (!paymentForm.value.fullName.trim()) missingFields.push('full name')
  if (!paymentForm.value.businessEmail.trim()) missingFields.push('business email')

  const contactDigits = getPaymentLocalContactDigits()
  if (!contactDigits) {
    missingFields.push('contact number')
  } else if (contactDigits.length < 10) {
    showPaymentToast('Contact number must be exactly 10 digits.', 'error')
    return false
  }

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'error')
    return false
  }

  if (!isValidPaymentFullName(paymentForm.value.fullName)) {
    showPaymentToast('Full name must only contain letters and basic name characters.', 'error')
    return false
  }

  return true
}

const getPremiumSubscriptionAmountInCentavos = () => 140000

const getPayMongoCheckoutSummary = () => {
  const payMongoPlanId = selectedCheckoutPlanId.value

  if (payMongoPlanId === 'premium') {
    return {
      planId: 'premium',
      lineItemName: 'Premium Subscription',
      description: 'Complete the first billing payment now to activate your premium subscription immediately.',
    }
  }

  return {
    planId: payMongoPlanId,
    lineItemName: currentCheckoutFlow.value.historyPlan,
    description: currentCheckoutFlow.value.headerDescription,
  }
}

const getCallableErrorMessage = (error, fallbackMessage) => {
  const firebaseMessage = String(
    error?.customData?.message
    || error?.details
    || error?.message
    || '',
  ).trim()

  if (!firebaseMessage) {
    return fallbackMessage
  }

  const normalizedMessage = firebaseMessage.toLowerCase()
  if (normalizedMessage === 'internal') {
    return fallbackMessage
  }

  return firebaseMessage
}

const buildBusinessSubscriptionReturnUrl = (status = 'success') => {
  if (typeof window === 'undefined') return ''

  const url = new URL(window.location.href)
  url.searchParams.delete('paymongo_status')
  url.searchParams.set('paymongo_status', status)
  return url.toString()
}

const clearPayMongoReturnParams = () => {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('paymongo_status')
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
}

let mockPaymentWindow = null
let paymentSuccessRedirectTimeoutId = null
let paymentSuccessRedirectIntervalId = null

const clearPaymentSuccessRedirect = () => {
  if (paymentSuccessRedirectTimeoutId !== null) {
    clearTimeout(paymentSuccessRedirectTimeoutId)
    paymentSuccessRedirectTimeoutId = null
  }

  if (paymentSuccessRedirectIntervalId !== null) {
    clearInterval(paymentSuccessRedirectIntervalId)
    paymentSuccessRedirectIntervalId = null
  }
}

const startPaymentSuccessRedirect = () => {
  clearPaymentSuccessRedirect()
  paymentSuccessRedirectSeconds.value = 5

  paymentSuccessRedirectIntervalId = setInterval(() => {
    if (paymentSuccessRedirectSeconds.value > 1) {
      paymentSuccessRedirectSeconds.value -= 1
    }
  }, 1000)

  paymentSuccessRedirectTimeoutId = setTimeout(() => {
    clearPaymentSuccessRedirect()
    goBackToPlans()
  }, 5000)
}

const activatePremiumPlan = async () => {
  const activatedAt = new Date()
  activeSubscriptionPlan.value = 'premium'
  activeSubscriptionMode.value = selectedCheckoutPlanId.value === 'premium' ? 'paid' : 'trial'
  premiumTrialStartedAt.value = selectedCheckoutPlanId.value === 'free-trial' ? activatedAt : null
  premiumTrialConsumedAt.value = selectedCheckoutPlanId.value === 'free-trial'
    ? activatedAt
    : resolveLatestBusinessSubscriptionDate(
      premiumTrialConsumedAt.value,
      resolvedBusinessFreeTrialConsumedAt.value,
    )
  premiumPaidStartedAt.value = selectedCheckoutPlanId.value === 'premium' ? activatedAt : null
  isSubscriptionStateHydrated.value = true
  seenPremiumNavItems.value = []
  activeSection.value = 'dashboard'
  activeSidebarGroup.value = 'dashboard'
  expandedSidebarGroups.value = sidebarGroups.value
    .filter((group) => group.id !== 'dashboard')
    .map((group) => group.id)
  persistBusinessSubscriptionState()
  persistSeenPremiumNavItems()
  pendingPremiumWelcomeGuideMode.value = selectedCheckoutPlanId.value === 'premium' ? 'paid' : 'trial'

  const alreadyLogged = paymentHistoryEntries.value.some((entry) => entry.id === orderReceiptCode.value)
  if (!alreadyLogged) {
    const historyEntry = {
      id: orderReceiptCode.value,
      plan: currentCheckoutFlow.value.historyPlan,
      amount: currentCheckoutFlow.value.historyAmount,
      method: selectedPaymentMethod.value === 'gcash' ? 'GCash' : 'Credit Card',
      status: currentCheckoutFlow.value.historyStatus,
      date: formatPaymentHistoryDate(activatedAt),
      time: formatPaymentHistoryTime(activatedAt),
      receiptCode: orderReceiptCode.value,
      billingNote: currentCheckoutFlow.value.historyBillingNote,
      accountIdentity: currentBusinessAccountIdentity.value,
      ownerEmail: authUser.value?.email || '',
      ownerName: authUser.value?.company_name || authUser.value?.name || 'Business Account',
    }

    paymentHistoryEntries.value.unshift(historyEntry)
    syncPaymentHistoryToStorage()
    syncAdminPaymentHistory(historyEntry)

    try {
      await saveBusinessPaymentHistoryEntry({
        ...historyEntry,
        workspaceOwnerId:
          authUser.value?.workspace_owner_id
          || authUser.value?.workspaceOwnerId
          || authUser.value?.id
          || '',
        workspaceOwnerRole:
          authUser.value?.workspace_owner_role
          || authUser.value?.workspaceOwnerRole
          || authUser.value?.role
          || 'employer',
        createdAt: activatedAt.toISOString(),
      })
    } catch {
      // Keep local/admin fallback records even if Firestore write fails.
    }
  }
}

const openPaymentHistory = () => {
  subscriptionView.value = 'history'
}

const openReceiptPreview = (entry) => {
  const receiptWindow = window.open('', '_blank', 'noopener=false,noreferrer=false')
  if (!receiptWindow) {
    showPaymentToast('Unable to open the receipt preview. Please allow pop-ups and try again.', 'error')
    return
  }

  receiptWindow.document.open()
  receiptWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Receipt ${entry.receiptCode}</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #f6fbf7;
        color: #173927;
      }
      .receipt-card {
        width: min(100%, 520px);
        margin: 0 auto;
        padding: 28px;
        border-radius: 24px;
        background: #ffffff;
        border: 1px solid #d8e6dd;
        box-shadow: 0 22px 48px rgba(23, 57, 39, 0.12);
      }
      h1 {
        margin: 0 0 6px;
        font-size: 28px;
      }
      p {
        margin: 0 0 20px;
        color: #607167;
      }
      .receipt-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid #edf3ef;
      }
      .receipt-row:last-child {
        border-bottom: 0;
      }
      .receipt-row span {
        color: #607167;
      }
      .receipt-row strong {
        color: #173927;
      }
    </style>
  </head>
  <body>
    <div class="receipt-card">
      <h1>Payment Receipt</h1>
      <p>Subscription transaction details</p>
      <div class="receipt-row"><span>Transaction ID</span><strong>${entry.id}</strong></div>
      <div class="receipt-row"><span>Plan</span><strong>${entry.plan}</strong></div>
      <div class="receipt-row"><span>Amount</span><strong>${entry.amount}</strong></div>
      <div class="receipt-row"><span>Method</span><strong>${entry.method}</strong></div>
      <div class="receipt-row"><span>Status</span><strong>${entry.status}</strong></div>
      ${entry.billingNote ? `<div class="receipt-row"><span>Billing</span><strong>${entry.billingNote}</strong></div>` : ''}
      <div class="receipt-row"><span>Date</span><strong>${entry.date} ${entry.time}</strong></div>
      <div class="receipt-row"><span>Receipt</span><strong>${entry.receiptCode}</strong></div>
    </div>
  </body>
</html>`)
  receiptWindow.document.close()
}

const buildMockPaymentHtml = () => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test Mode Payment</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background: linear-gradient(180deg, #f4fbf7 0%, #e7f3eb 100%);
        color: #173927;
      }
      .mock-shell {
        width: min(100%, 480px);
        padding: 28px;
        border-radius: 24px;
        border: 1px solid #d3e5d9;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 24px 60px rgba(23, 57, 39, 0.14);
      }
      .mock-badge {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: #eff8f2;
        color: #2f8f5b;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0 0 14px;
        color: #607167;
        line-height: 1.6;
      }
      .mock-card {
        margin: 22px 0;
        padding: 18px;
        border-radius: 18px;
        background: #f8fbf9;
        border: 1px solid #dbe8df;
      }
      .mock-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 10px;
        font-size: 14px;
      }
      .mock-row:last-child {
        margin-bottom: 0;
      }
      .mock-row span {
        color: #607167;
      }
      .mock-row strong {
        color: #173927;
      }
      .mock-button {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #2f8f5b 0%, #245d3e 100%);
        color: #fff;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main class="mock-shell">
      <span class="mock-badge">${currentCheckoutFlow.value.popupBadge}</span>
      <h1>${currentCheckoutFlow.value.popupTitle}</h1>
      <p>${currentCheckoutFlow.value.popupDescription}</p>
      <section class="mock-card">
        <div class="mock-row">
          <span>Receipt</span>
          <strong>${orderReceiptCode.value}</strong>
        </div>
        <div class="mock-row">
          <span>Payment method</span>
          <strong>GCash</strong>
        </div>
        <div class="mock-row">
          <span>${isFreeTrialCheckout.value ? 'Due today' : 'Total'}</span>
          <strong>${currentCheckoutFlow.value.popupAmount}</strong>
        </div>
      </section>
      <button class="mock-button" id="complete-payment">${currentCheckoutFlow.value.popupAction}</button>
    </main>
    <script>
      const completeButton = document.getElementById('complete-payment')
      completeButton?.addEventListener('click', () => {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: '${MOCK_PAYMENT_MESSAGE_TYPE}',
              receiptCode: '${orderReceiptCode.value}',
            },
            window.location.origin,
          )
        }
        window.close()
      })
    <\/script>
  </body>
</html>`

const openMockPaymentTab = () => {
  const paymentWindow = window.open('', '_blank', 'noopener=false,noreferrer=false')

  if (!paymentWindow) {
    showPaymentToast('Unable to open the payment tab. Please allow pop-ups and try again.', 'error')
    return false
  }

  mockPaymentWindow = paymentWindow
  paymentWindow.document.open()
  paymentWindow.document.write(buildMockPaymentHtml())
  paymentWindow.document.close()
  return true
}

const completePaymentFlow = async (useTestMode = false) => {
  if (useTestMode) isProcessingTestModePayment.value = true
  clearAdvancePaymentTimeout()
  isAdvancingPaymentStep.value = true
  await new Promise((resolve) => {
    advancePaymentTimeoutId.value = setTimeout(() => {
      advancePaymentTimeoutId.value = null
      resolve()
    }, useTestMode ? 1200 : 700)
  })
  isProcessingTestModePayment.value = false
  isAwaitingExternalPayment.value = false
  await activatePremiumPlan()
  paymentStep.value = 4
  isAdvancingPaymentStep.value = false
}

const startPayMongoGcashCheckout = async () => {
  if (!validatePaymentStepOne()) return

  if (selectedCheckoutPlanId.value !== 'premium') {
    showPaymentToast('Direct PayMongo GCash checkout is available for the paid Premium plan only. Free Trial stays at PHP 0.00 today.', 'warning')
    return
  }

  clearAdvancePaymentTimeout()
  isProcessingTestModePayment.value = true
  isAwaitingExternalPayment.value = false
  isAdvancingPaymentStep.value = true

  try {
    const payMongoCheckout = getPayMongoCheckoutSummary()
    const createCheckoutSession = httpsCallable(cloudFunctions, 'createBusinessPayMongoCheckoutSession')
    const response = await createCheckoutSession({
      paymentMethodType: 'gcash',
      amountInCentavos: getPremiumSubscriptionAmountInCentavos(),
      subscriptionPlanId: payMongoCheckout.planId,
      receiptCode: orderReceiptCode.value,
      accountIdentity: currentBusinessAccountIdentity.value,
      billingName: paymentForm.value.fullName.trim(),
      billingEmail: paymentForm.value.businessEmail.trim() || businessEmail.value,
      billingPhone: paymentForm.value.contactNumber,
      lineItemName: payMongoCheckout.lineItemName,
      description: payMongoCheckout.description,
      successUrl: buildBusinessSubscriptionReturnUrl('success'),
      cancelUrl: buildBusinessSubscriptionReturnUrl('cancel'),
    })

    const checkoutSessionId = String(response?.data?.checkoutSessionId || '').trim()
    const checkoutUrl = String(response?.data?.checkoutUrl || '').trim()

    if (!checkoutSessionId || !checkoutUrl) {
      throw new Error('PayMongo did not return a checkout URL.')
    }

    persistPendingPayMongoCheckout({
      checkoutSessionId,
      receiptCode: orderReceiptCode.value,
      subscriptionPlanId: payMongoCheckout.planId,
      paymentMethod: 'gcash',
    })

    window.location.assign(checkoutUrl)
  } catch (error) {
    isAdvancingPaymentStep.value = false
    isProcessingTestModePayment.value = false
    showPaymentToast(
      getCallableErrorMessage(error, 'Unable to start the PayMongo checkout right now. Deploy the latest Cloud Functions and check the PayMongo secret key.'),
      'error',
    )
  }
}

const handleMockPaymentMessage = (event) => {
  if (event.origin !== window.location.origin) return
  if (event.data?.type !== MOCK_PAYMENT_MESSAGE_TYPE) return
  if (subscriptionView.value !== 'payment' || paymentStep.value !== 3 || selectedPaymentMethod.value !== 'gcash') return

  completePaymentFlow(false)
}

const handlePayMongoCheckoutReturn = async () => {
  if (typeof window === 'undefined' || !authUser.value) return

  const url = new URL(window.location.href)
  const checkoutStatus = String(url.searchParams.get('paymongo_status') || '').trim().toLowerCase()
  if (!checkoutStatus) return

  const pendingCheckout = readPendingPayMongoCheckout()
  clearPayMongoReturnParams()

  if (!pendingCheckout?.checkoutSessionId) {
    return
  }

  if (checkoutStatus === 'cancel') {
    clearPendingPayMongoCheckout()
    activeSection.value = 'subscriptions'
    subscriptionView.value = 'plans'
    paymentStep.value = 1
    showPaymentToast('The PayMongo checkout was cancelled.', 'warning')
    return
  }

  if (checkoutStatus !== 'success') {
    return
  }

  try {
    selectedCheckoutPlanId.value = pendingCheckout.subscriptionPlanId || 'premium'
    selectedPaymentMethod.value = pendingCheckout.paymentMethod || 'gcash'
    orderReceiptCode.value = pendingCheckout.receiptCode || generateOrderReceiptCode()
    activeSection.value = 'subscriptions'
    subscriptionView.value = 'payment'
    paymentStep.value = 3
    isProcessingTestModePayment.value = true

    const verifyCheckoutSession = httpsCallable(cloudFunctions, 'verifyBusinessPayMongoCheckoutSession')
    const response = await verifyCheckoutSession({
      checkoutSessionId: pendingCheckout.checkoutSessionId,
    })

    if (response?.data?.isPaid === true) {
      clearPendingPayMongoCheckout()
      await completePaymentFlow(false)
      return
    }

    clearPendingPayMongoCheckout()
    subscriptionView.value = 'plans'
    paymentStep.value = 1
    showPaymentToast('The PayMongo checkout returned, but the payment is not marked as paid yet.', 'warning')
  } catch (error) {
    clearPendingPayMongoCheckout()
    subscriptionView.value = 'plans'
    paymentStep.value = 1
    isProcessingTestModePayment.value = false
    showPaymentToast(
      getCallableErrorMessage(error, 'Unable to verify the PayMongo checkout right now.'),
      'error',
    )
  }
}

const handleBusinessSubscriptionStorageChange = (event) => {
  if (!authUser.value) return

  const subscriptionKey = getBusinessSubscriptionStorageKey()
  if (!event.key || event.key === subscriptionKey) {
    restoreBusinessSubscriptionState()
  }

  if (!event.key || event.key === ADMIN_PLAN_CATALOG_STORAGE_KEY) {
    restoreAdminPlanCatalog()
  }
}

const resetPaymentLoadingState = () => {
  clearProceedToPaymentTimeout()
  clearAdvancePaymentTimeout()
  clearPaymentSuccessRedirect()
  isProceedingToPayment.value = false
  isAdvancingPaymentStep.value = false
  isProcessingTestModePayment.value = false
  isAwaitingExternalPayment.value = false
  paymentSuccessRedirectSeconds.value = 5
}

const proceedToPayment = async () => {
  const nextPlanId = resolveAvailableBusinessCheckoutPlanId(selectedCheckoutPlanId.value)
  if (selectedCheckoutPlanId.value === 'free-trial' && nextPlanId !== 'free-trial') {
    selectedCheckoutPlanId.value = nextPlanId
    isTrialConfirmationOpen.value = false
    showPaymentToast('This account already used its one-time free trial. Please continue with Premium Subscription.', 'warning')
    return
  }

  selectedCheckoutPlanId.value = nextPlanId
  isTrialConfirmationOpen.value = false
  clearProceedToPaymentTimeout()
  isProceedingToPayment.value = true
  await new Promise((resolve) => {
    proceedToPaymentTimeoutId.value = setTimeout(() => {
      proceedToPaymentTimeoutId.value = null
      resolve()
    }, 900)
  })
  activeSection.value = 'subscriptions'
  subscriptionView.value = 'payment'
  paymentStep.value = 1
  selectedPaymentMethod.value = 'gcash'
  orderReceiptCode.value = generateOrderReceiptCode()
  paymentContactCountryCode.value = 'PH'
  paymentForm.value = {
    fullName: '',
    businessEmail: businessEmail.value,
    contactNumber: '',
  }
  isProceedingToPayment.value = false
}

const goBackToPlans = () => {
  resetPaymentLoadingState()
  closePaymentContactCountryDropdown()
  activeSection.value = 'subscriptions'
  paymentStep.value = 1
  subscriptionView.value = 'plans'
  void showPendingPremiumWelcomeGuide()
}

const openCancelPaymentModal = () => {
  isCancelPaymentModalOpen.value = true
}

const closeCancelPaymentModal = () => {
  if (isCancellingPayment.value) return
  isCancelPaymentModalOpen.value = false
}

const confirmCancelPayment = async () => {
  if (isCancellingPayment.value) return

  isCancellingPayment.value = true
  await new Promise((resolve) => {
    setTimeout(resolve, 650)
  })
  resetPaymentLoadingState()
  closePaymentContactCountryDropdown()
  isCancelPaymentModalOpen.value = false
  subscriptionView.value = 'plans'
  paymentStep.value = 1
  isCancellingPayment.value = false
}

const goToPaymentStep = (step) => {
  isProcessingTestModePayment.value = false
  isAwaitingExternalPayment.value = false
  paymentStep.value = step
}

const goToPaymentStepWithLoading = async (step, options = {}) => {
  clearAdvancePaymentTimeout()
  isProcessingTestModePayment.value = false
  isAwaitingExternalPayment.value = false
  isAdvancingPaymentStep.value = true
  await new Promise((resolve) => {
    advancePaymentTimeoutId.value = setTimeout(() => {
      advancePaymentTimeoutId.value = null
      resolve()
    }, 700)
  })
  paymentStep.value = step
  isAdvancingPaymentStep.value = false
}

const goToPaymentConfirmationStep = async () => {
  if (selectedPaymentMethod.value === 'gcash') {
    await startPayMongoGcashCheckout()
    return
  }

  await goToPaymentStepWithLoading(3)
}

const markPaymentConfirmed = async () => {
  await completePaymentFlow(true)
}

const ensureEmployerAccess = async () => {
  const access = await resolveApprovedEmployerSession('business')
  if (!access.allowed || !access.user) {
    await router.replace(access.redirect || '/login')
    return
  }

  authUser.value = access.user
}

const startAuthUserProfileSync = () => {
  stopAuthUserProfileSync()
  stopAuthUserProfileSync = subscribeToStoredAuthUserProfile(
    async (nextUser) => {
      if (!nextUser) {
        clearAuthSession()
        await router.replace('/login')
        return
      }

      authUser.value = {
        ...(authUser.value || {}),
        ...nextUser,
      }
    },
    () => {},
  )
}

const hydrateBusinessWorkspaceUi = async () => {
  if (!authUser.value) return

  try {
    restoreBusinessSubscriptionState()
    applyBusinessSecurityRouteState()
    restoreSeenPremiumNavItems()
    restorePermissionRolesState()
    restoreEmployeeDirectoryState()
    restoreAssessmentTemplateLibrary()
    restoreTrainingTemplateLibrary()
    await nextTick()
  } catch (error) {
    console.warn('[business-workspace] Unable to hydrate the business workspace UI state.', error)
  }
}

onMounted(async () => {
  await ensureEmployerAccess()
  if (!authUser.value) return

  seenBusinessNotificationIds.value = readSeenBusinessNotificationIds()
  businessAccessRealtimeTimerId = window.setInterval(() => {
    businessRealtimeNow.value = Date.now()
  }, 1000)
  startAuthUserProfileSync()
  startWorkspaceUserDirectorySync()
  startBusinessMemberEmployerSync()
  startWorkspaceJobPostsSync()
  startBusinessJobApplicationsFirestoreSync()
  startApplicantAssessmentScoreSync()
  restoreAdminPlanCatalog()
  restoreBusinessProfileState()
  syncProfileFormFromAuthUser()
  await startBusinessPaymentHistorySync()
  await hydrateBusinessWorkspaceUi()
  startApprovedApplicantSync()
  startAssessmentTemplateSync()
  startTrainingTemplateSync()
  startAssessmentAssignmentSync()
  startTrainingAssignmentSync()
  startBusinessInterviewSchedulesFirestoreSync()
  await syncAssignedApplicantAssessmentScores()
  await handlePayMongoCheckoutReturn()
  document.addEventListener('click', closeProfileMenu)
  document.addEventListener('click', closeJobPostingDropdownOnOutsideClick)
  window.addEventListener('message', handleMockPaymentMessage)
  window.addEventListener('storage', handleBusinessSubscriptionStorageChange)
  window.addEventListener('resize', updatePremiumGuideLayout)
  window.addEventListener('scroll', updatePremiumGuideLayout, true)
})

watch(authUser, () => {
  syncProfileFormFromAuthUser()
  applyBusinessSecurityRouteState()
})

watch(businessNavbarNotifications, () => {
  if (isNotificationMenuOpen.value) {
    markBusinessNotificationsAsRead()
  }
}, { deep: true })

watch(
  () => ([
    currentBusinessAccountIdentity.value,
    String(authUser.value?.active_subscription_plan || authUser.value?.activeSubscriptionPlan || '').trim().toLowerCase(),
    String(authUser.value?.active_subscription_mode || authUser.value?.activeSubscriptionMode || '').trim().toLowerCase(),
    String(authUser.value?.premium_trial_started_at || authUser.value?.premiumTrialStartedAt || '').trim(),
    String(authUser.value?.premium_trial_consumed_at || authUser.value?.premiumTrialConsumedAt || '').trim(),
    String(authUser.value?.premium_paid_started_at || authUser.value?.premiumPaidStartedAt || '').trim(),
  ]),
  (nextValue, previousValue) => {
    if (!authUser.value) return
    if (JSON.stringify(nextValue) === JSON.stringify(previousValue || [])) return

    const profileAccessState = resolveBusinessSubscriptionAccess(authUser.value, { allowMissingPaidDate: true })
    if (!isSubscriptionStateHydrated.value || profileAccessState.hasPremiumAccess !== hasActiveBusinessSubscriptionState()) {
      restoreBusinessSubscriptionState()
      applyBusinessSecurityRouteState()
    }
  },
)

watch(selectedPermissionRole, (role) => {
  permissionRoleLookupValue.value = isPermissionRoleEditMode.value
    ? String(role?.name || '').trim()
    : ''
}, { immediate: true })

watch(sidebarGroups, (groups) => {
  const nextVisibleItems = groups.flatMap((group) =>
    (group.items || []).map((item) => ({
      id: item.id,
      label: item.label,
    })),
  )
  const previousVisibleItems = Array.isArray(lastVisibleSidebarItems.value) ? lastVisibleSidebarItems.value : []

  if (previousVisibleItems.length) {
    const removedItems = previousVisibleItems.filter((previousItem) =>
      !nextVisibleItems.some((nextItem) => nextItem.id === previousItem.id),
    )

    if (removedItems.length) {
      const removedLabels = removedItems.map((item) => item.label)
      const summary = removedLabels.length === 1
        ? removedLabels[0]
        : `${removedLabels.slice(0, 2).join(', ')}${removedLabels.length > 2 ? ` +${removedLabels.length - 2} more` : ''}`

      showPaymentToast(
        `${summary} was removed from your sidebar by an admin permission update.`,
        'warning',
        {
          title: 'Sidebar Access Updated',
          duration: 4200,
        },
      )
      showAccessNotice(`${summary} was removed from your sidebar by an admin permission update.`, 'Sidebar Access Updated')
    }
  }

  lastVisibleSidebarItems.value = nextVisibleItems

  if (!groups.length) return
  if (!groups.some((group) => group.id === activeSidebarGroup.value)) {
    activeSidebarGroup.value = groups[0].id
  }
  expandedSidebarGroups.value = expandedSidebarGroups.value.filter((groupId) =>
    groups.some((group) => group.id === groupId),
  )
})

watch(activeSection, (nextSection) => {
  if (nextSection === 'assign-templates') {
    activeSection.value = 'training-templates'
    setTrainingTemplatesTab('assignments')
    activeSidebarGroup.value = 'training'
    if (!expandedSidebarGroups.value.includes('training')) {
      expandedSidebarGroups.value = [...expandedSidebarGroups.value, 'training']
    }
    return
  }

  if (nextSection === 'job-posting') {
    setJobPostingDefaultTab()
  }

  if (nextSection === 'training-templates') {
    setTrainingTemplatesTab(trainingTemplatesTab.value)
  }

  const matchingGroup = sidebarGroups.value.find((group) => group.items.some((item) => item.id === nextSection))
  if (matchingGroup) {
    activeSidebarGroup.value = matchingGroup.id
    if (!expandedSidebarGroups.value.includes(matchingGroup.id)) {
      expandedSidebarGroups.value = [...expandedSidebarGroups.value, matchingGroup.id]
    }
    return
  }

  if (!['profile', 'subscriptions'].includes(nextSection) && !availableSidebarSectionIds.value.includes(nextSection)) {
    activeSection.value = resolveFirstAvailableBusinessSection()
    activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
  }
})

watch(currentBusinessAccountIdentity, (nextIdentity, previousIdentity) => {
  if (!nextIdentity || nextIdentity === previousIdentity) return
  void (async () => {
    await startBusinessPaymentHistorySync()
    await hydrateBusinessWorkspaceUi()
  })()
  startApplicantAssessmentScoreSync()
  void syncAssignedApplicantAssessmentScores()
  startApprovedApplicantSync()
  startAssessmentTemplateSync()
  startTrainingTemplateSync()
  startAssessmentAssignmentSync()
  startTrainingAssignmentSync()
  startWorkspaceUserDirectorySync()
  startBusinessMemberEmployerSync()
  startWorkspaceJobPostsSync()
  startBusinessJobApplicationsFirestoreSync()
  startBusinessInterviewSchedulesFirestoreSync()
})

watch(
  () => route.query,
  () => {
    if (isSyncingBusinessSecurityRouteState) {
      isSyncingBusinessSecurityRouteState = false
    }
    applyBusinessSecurityRouteState()
  },
  { deep: true, immediate: true },
)

watch(
  () => JSON.stringify(authUser.value?.workspace_permission_roles || authUser.value?.workspacePermissionRoles || []),
  (nextValue, previousValue) => {
    if (!authUser.value || nextValue === previousValue || isSavingPermissionRoles.value) return
    restorePermissionRolesState()
  },
)

watch(permissionRoles, (roles) => {
  if (!Array.isArray(roles) || !roles.length) {
    resetPermissionRolesToDefault()
    return
  }

  if (!roles.some((role) => role.id === selectedPermissionRoleId.value)) {
    selectedPermissionRoleId.value = roles[0].id
  }

  if (userAccountDraft.value.roleId && !roles.some((role) => role.id === userAccountDraft.value.roleId)) {
    userAccountDraft.value = {
      ...userAccountDraft.value,
      roleId: '',
    }
  }
}, { deep: true })

watch(() => employeeDraft.value.linkedUserId, (linkedUserId) => {
  if (!linkedUserId) return
  applyLinkedUserToEmployeeDraft(linkedUserId)
})

watch(employeeDirectory, () => {
  persistEmployeeDirectoryState()
}, { deep: true })

watch(businessJobApplications, () => {
  syncApprovedApplicantProfilesFromApplications()
  rebuildTrainingAssignments()
}, { deep: true })

watch(approvedApplicantTemplateAssignments, () => {
  void syncAssignedApplicantAssessmentScores()
}, { deep: true })

watch(businessInterviewSchedules, () => {
  rebuildTrainingAssignments()
}, { deep: true })

watch(() => businessInterviewSchedulingForm.value.selectedJobKey, () => {
  businessInterviewSchedulingForm.value = {
    ...businessInterviewSchedulingForm.value,
    applicationId: '',
    interviewType: 'initial',
  }
  businessInterviewSchedulingFormError.value = ''
})

watch(businessInterviewAvailableInterviewTypeOptions, (options) => {
  const firstAllowedType = options[0]?.value || 'initial'
  if (options.some((option) => option.value === businessInterviewSchedulingForm.value.interviewType)) return

  businessInterviewSchedulingForm.value = {
    ...businessInterviewSchedulingForm.value,
    interviewType: firstAllowedType,
  }
})

watch(assessmentTemplateLibrary, () => {
  persistAssessmentTemplateLibrary()
}, { deep: true })

watch(trainingTemplateLibrary, () => {
  persistTrainingTemplateLibrary()
}, { deep: true })

watch(trainingTrackingAssignments, (assignments) => {
  const normalizedSelectedId = String(selectedTrainingTrackingAssignmentId.value || '').trim()
  if (!assignments.length) {
    selectedTrainingTrackingAssignmentId.value = ''
    trainingTrackingViewMode.value = 'table'
    trainingTrackingCategoryRemarkDrafts.value = {}
    return
  }

  if (assignments.some((assignment) => String(assignment?.id || '').trim() === normalizedSelectedId)) return
  selectedTrainingTrackingAssignmentId.value = String(assignments[0]?.id || '').trim()
}, { deep: true, immediate: true })

watch([canViewTrainingTemplateBuilder, canViewTrainingAssignments], () => {
  setTrainingTemplatesTab(trainingTemplatesTab.value)
}, { immediate: true })

watch(isFreeTrialCheckout, (isFreeTrial) => {
  if (isFreeTrial && selectedPaymentMethod.value === 'gcash') {
    selectedPaymentMethod.value = 'card'
  }
}, { immediate: true })

watch(paymentStep, (step) => {
  if (step === 4) {
    startPaymentSuccessRedirect()
    return
  }

  clearPaymentSuccessRedirect()
  paymentSuccessRedirectSeconds.value = 5
})

watch(
  availableSidebarSectionIds,
  (sectionIds) => {
    if (!sectionIds.length) {
      return
    }

    if (activeSection.value === 'subscriptions' || activeSection.value === 'profile') {
      return
    }

    if (!String(activeSection.value || '').trim()) {
      activeSection.value = sectionIds[0]
      activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
      expandedSidebarGroups.value = []
    }
  },
  { immediate: true },
)

watch(
  [activeSubscriptionPlan, activeSubscriptionMode, activeSection, subscriptionView, premiumTrialStartedAt, premiumTrialConsumedAt, premiumPaidStartedAt],
  () => {
    persistBusinessSubscriptionState()
  },
)

watch(
  [activeSection, subscriptionView, selectedCheckoutPlanId, activeSubscriptionPlan, activeSubscriptionMode],
  () => {
    void syncBusinessSecurityRouteState()
  },
)

watch(
  [activeSubscriptionPlan, activeSubscriptionMode, premiumTrialStartedAt, premiumTrialConsumedAt, premiumPaidStartedAt],
  () => {
    void syncBusinessSubscriptionStateToProfile()
    void ensureCurrentSubscriptionHistoryEntrySynced()
  },
)

watch(
  resolvedBusinessFreeTrialConsumedAt,
  (nextValue) => {
    const currentValue = premiumTrialConsumedAt.value
      ? new Date(premiumTrialConsumedAt.value).toISOString()
      : ''

    if (nextValue && currentValue !== nextValue) {
      premiumTrialConsumedAt.value = new Date(nextValue)
    }
  },
  { immediate: true },
)

watch(
  () => ([hasConsumedBusinessFreeTrial.value, activeSubscriptionPlan.value, activeSubscriptionMode.value]),
  () => {
    const nextPlanId = resolveAvailableBusinessCheckoutPlanId(selectedCheckoutPlanId.value)
    if (nextPlanId !== selectedCheckoutPlanId.value) {
      selectedCheckoutPlanId.value = nextPlanId
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (businessAccessRealtimeTimerId) {
    window.clearInterval(businessAccessRealtimeTimerId)
    businessAccessRealtimeTimerId = null
  }
  stopAuthUserProfileSync()
  stopWorkspaceUserDirectorySync()
  stopBusinessMemberEmployerSync()
  stopWorkspaceJobsSync()
  stopBusinessJobApplicationsSync()
  stopBusinessInterviewSchedulesSync()
  stopBusinessPaymentHistorySync()
  stopApplicantAssessmentScoreSync()
  document.removeEventListener('click', closeProfileMenu)
  document.removeEventListener('click', closeJobPostingDropdownOnOutsideClick)
  window.removeEventListener('message', handleMockPaymentMessage)
  window.removeEventListener('storage', handleBusinessSubscriptionStorageChange)
  window.removeEventListener('resize', updatePremiumGuideLayout)
  window.removeEventListener('scroll', updatePremiumGuideLayout, true)
  resetPaymentLoadingState()
  clearPaymentToastTimeout()
  clearAccessNoticeTimeout()
})
</script>

<template>
  <div
    class="business-workspace"
  >
    <Transition name="business-toast">
      <div
        v-if="paymentToast.visible"
        class="business-toast"
        :class="paymentToast.tone"
        role="status"
        aria-live="polite"
      >
        <div class="business-toast__icon" :class="paymentToast.tone" aria-hidden="true">
          <i
            :class="
              paymentToast.tone === 'error'
                ? 'bi bi-x-circle-fill'
                : paymentToast.tone === 'warning'
                  ? 'bi bi-exclamation-triangle-fill'
                  : 'bi bi-check-circle-fill'
            "
          />
        </div>
        <div class="business-toast__copy">
          <strong>{{ paymentToast.title }}</strong>
          <span>{{ paymentToast.message }}</span>
        </div>
        <div class="business-toast__actions">
          <button
            v-for="action in paymentToast.actions"
            :key="`${action.label}-${action.variant}`"
            type="button"
            class="business-toast__action"
            :class="`is-${action.variant}`"
            @click="handlePaymentToastAction(action)"
          >
            {{ action.label }}
          </button>
          <button type="button" class="business-toast__close" aria-label="Close notification" @click="closePaymentToast">
            <i class="bi bi-x-lg" />
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="business-guide">
      <div v-if="isPremiumWelcomeGuideVisible" class="business-guide" aria-live="polite">
        <div class="business-guide__backdrop" />
        <div v-if="premiumGuideTargetRect" class="business-guide__spotlight" :style="premiumGuideSpotlightStyle" />
        <div
          class="business-guide__card"
          :class="{ 'business-guide__card--celebration': currentPremiumWelcomeGuideStep.id === 'welcome' }"
          :style="premiumGuideCardStyle"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-guide-title"
        >
          <div v-if="currentPremiumWelcomeGuideStep.id === 'welcome'" class="business-guide__celebration" aria-hidden="true">
            <span class="business-guide__aura business-guide__aura--one" />
            <span class="business-guide__aura business-guide__aura--two" />
            <span class="business-guide__burst business-guide__burst--one" />
            <span class="business-guide__burst business-guide__burst--two" />
            <span class="business-guide__burst business-guide__burst--three" />
            <span class="business-guide__spark business-guide__spark--one" />
            <span class="business-guide__spark business-guide__spark--two" />
            <span class="business-guide__spark business-guide__spark--three" />
            <span
              v-for="piece in premiumCelebrationPieces"
              :key="piece"
              class="business-guide__confetti"
              :class="`business-guide__confetti--${piece}`"
            />
            <div class="business-guide__hero">
              <i class="bi bi-stars" />
            </div>
          </div>
          <span v-if="currentPremiumWelcomeGuideStep.badge" class="business-guide__badge">{{ currentPremiumWelcomeGuideStep.badge }}</span>
          <h2 id="premium-guide-title">{{ currentPremiumWelcomeGuideStep.title }}</h2>
          <p>{{ currentPremiumWelcomeGuideStep.description }}</p>
          <small>{{ currentPremiumWelcomeGuideStep.note }}</small>
          <div class="business-guide__actions" :class="{ 'business-guide__actions--single': currentPremiumWelcomeGuideStep.id === 'welcome' }">
            <button v-if="currentPremiumWelcomeGuideStep.id !== 'welcome'" type="button" class="business-guide__button business-guide__button--secondary" @click="closePremiumWelcomeGuide">
              Skip
            </button>
            <button type="button" class="business-guide__button business-guide__button--primary" @click="advancePremiumWelcomeGuide">
              {{ currentPremiumWelcomeGuideStep.actionLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <aside v-if="showBusinessSidebar" class="business-sidebar" aria-label="Business sidebar">
      <div class="business-sidebar__brand-row">
        <div class="business-sidebar__brand">
          <span class="business-sidebar__brand-mark">
            <img :src="pwdLogo" alt="PWD logo" class="business-sidebar__logo" />
          </span>
          <span class="business-sidebar__brand-copy">
            <strong>{{ businessName }}</strong>
            <small>Business Workspace</small>
          </span>
        </div>
      </div>

      <div class="business-sidebar__section-label business-sidebar__section-label--headline">Workspace</div>

      <TransitionGroup name="business-sidebar-reveal" tag="nav" class="business-sidebar__nav" aria-label="Business sidebar">
        <button
          v-if="sidebarGroups.some((group) => group.id === 'dashboard' && group.items.some((item) => item.id === 'dashboard'))"
          key="dashboard-link"
          type="button"
          class="business-sidebar__link business-sidebar__link--group"
          :class="{ 'is-active': activeSection === 'dashboard' }"
          @click="handleSidebarSectionClick({ id: 'dashboard' })"
        >
          <span class="business-sidebar__link-main">
            <i class="bi bi-grid-1x2-fill" aria-hidden="true" />
            <span>Dashboard</span>
          </span>
        </button>

        <div
          v-for="group in sidebarGroups.filter((entry) => entry.id !== 'dashboard')"
          :key="group.id"
          class="business-sidebar__dropdown-group"
        >
          <button
            type="button"
            class="business-sidebar__link business-sidebar__link--group"
            :class="{ 'is-active-soft': activeSidebarGroup === group.id || group.items.some((item) => item.id === activeSection) }"
            :aria-expanded="expandedSidebarGroups.includes(group.id) ? 'true' : 'false'"
            @click="openSidebarGroup(group)"
          >
            <span class="business-sidebar__link-main">
              <i :class="group.icon" aria-hidden="true" />
              <span>{{ group.label }}</span>
            </span>
            <span class="business-sidebar__chevron" :class="{ 'is-open': expandedSidebarGroups.includes(group.id) }">
              <i class="bi bi-chevron-down" aria-hidden="true" />
            </span>
          </button>

          <Transition name="business-submenu-collapse">
            <div
              v-if="expandedSidebarGroups.includes(group.id)"
              class="business-sidebar__submenu"
              :aria-label="`${group.label} submenu`"
            >
              <button
                v-for="item in group.items"
                :key="item.id"
                :ref="(element) => setSidebarLinkRef(item.id, element)"
                type="button"
                class="business-sidebar__submenu-item"
                :class="{
                  'is-active': activeSection === item.id,
                  'business-guide-target': isPremiumGuideTarget('sidebar-new', item.id),
                }"
                @click="handleSidebarSectionClick(item)"
              >
                <span class="business-sidebar__link-main">
                  <i :class="getSidebarItemIcon(item.id)" aria-hidden="true" />
                  <span>{{ item.label }}</span>
                </span>
              </button>
            </div>
          </Transition>
        </div>
      </TransitionGroup>

      <div class="business-sidebar__spacer" />

      <div class="business-sidebar__secondary">
        <div class="business-sidebar__section-label">Quick Access</div>
        <div class="business-sidebar__secondary-links">
          <button type="button" class="business-sidebar__footer-link" :class="{ 'is-active': activeSection === 'subscriptions' }" @click="activeSection = 'subscriptions'">
            <span class="business-sidebar__link-main">
              <i class="bi bi-stars" aria-hidden="true" />
              <span>Subscriptions</span>
            </span>
          </button>
          <button type="button" class="business-sidebar__footer-link" :class="{ 'is-active': activeSection === 'profile' }" @click="activeSection = 'profile'">
            <span class="business-sidebar__link-main">
              <i class="bi bi-person-circle" aria-hidden="true" />
              <span>Edit Profile</span>
            </span>
          </button>
          <button type="button" class="business-sidebar__footer-link" :disabled="isLogoutSubmitting" @click="openLogoutConfirm">
            <span class="business-sidebar__link-main">
              <i class="bi bi-box-arrow-right" aria-hidden="true" />
              <span>{{ isLogoutSubmitting ? 'Logging Out...' : 'Log Out' }}</span>
            </span>
          </button>
        </div>
      </div>

      <section class="business-sidebar__profile" aria-label="Business profile">
        <div class="business-sidebar__profile-avatar">
          <img v-if="businessAvatar" :src="businessAvatar" alt="Business avatar" class="business-sidebar__profile-image" />
          <template v-else>{{ businessInitials }}</template>
        </div>
        <div class="business-sidebar__profile-meta">
          <strong>{{ businessName }}</strong>
          <span>{{ businessEmail }}</span>
        </div>
      </section>
    </aside>

    <section class="business-main">
      <AdminNavbar
        :title="currentSection.title"
        breadcrumb-parent="Business Workspace"
        :breadcrumb-current="currentSection.title"
        :subtitle="currentSection.description"
        :profile-name="businessName"
        :profile-email="businessEmail"
        :profile-initials="businessInitials"
        :profile-menu-open="isProfileMenuOpen"
        :settings-items="businessNavbarSettingsItems"
        :notifications="businessNavbarNotifications"
        :notification-count="unreadBusinessNotificationCount"
        :notification-menu-open="isNotificationMenuOpen"
        @toggle-profile="isProfileMenuOpen = !isProfileMenuOpen; isNotificationMenuOpen = false"
        @toggle-notifications="toggleNotificationMenu"
        @open-notification="openBusinessNotification"
        @open-setting="handleBusinessNavbarSetting"
        @logout="openLogoutConfirm"
      />



      <main class="business-content">
        <Transition name="business-section" mode="out-in">
          <div
            :key="activeSection"
            class="business-content__panel"
            :class="{ 'business-content__panel--subscriptions': activeSection === 'subscriptions' }"
          >
            <section v-if="activeSection === 'dashboard'" class="business-dashboard-analytics">
              <article class="business-dashboard-analytics__hero business-dashboard-analytics__motion" style="--dashboard-enter-delay: 40ms">
                <div class="business-dashboard-analytics__hero-copy">
                  <p class="business-dashboard-analytics__eyebrow">{{ businessCategory }}</p>
                  <h2>{{ businessName }}</h2>
                  <p>{{ currentSection.description }}</p>
                </div>
                <div class="business-dashboard-analytics__hero-side">
                  <span>Workspace status</span>
                  <strong>{{ hasUnlockedBusinessWorkspace ? 'Premium Access' : 'Starter Access' }}</strong>
                  <small>
                    {{ hasUnlockedBusinessWorkspace
                      ? 'All business tools are available in this dashboard.'
                      : 'Upgrade to open the full hiring workflow and premium tools.' }}
                  </small>
                </div>
              </article>

              <section class="business-dashboard-analytics__summary-grid" aria-label="Business dashboard summary">
                <article
                  v-for="(item, index) in summaryCards"
                  :key="item.label"
                  class="business-dashboard-analytics__summary-card business-dashboard-analytics__motion"
                  :class="`business-dashboard-analytics__summary-card--${item.tone}`"
                  :style="{ '--dashboard-enter-delay': `${120 + (index * 90)}ms` }"
                >
                  <div class="business-dashboard-analytics__summary-card-top">
                    <span>{{ item.label }}</span>
                    <i :class="item.icon" aria-hidden="true" />
                  </div>
                  <strong>{{ item.value }}</strong>
                  <p>{{ item.subtitle }}</p>
                </article>
              </section>

              <div class="business-dashboard-analytics__grid">
                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--trend business-dashboard-analytics__motion" style="--dashboard-enter-delay: 270ms">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Performance Trend</span>
                      <strong>Hiring activity overview</strong>
                    </div>
                    <div class="business-dashboard-analytics__balance">
                      <small>{{ businessTrendChart.callout.label }}</small>
                      <strong>{{ businessTrendChart.callout.copy }}</strong>
                    </div>
                  </div>
                  <div class="business-dashboard-analytics__trend-metrics">
                    <article
                      v-for="card in businessTrendChart.highlightCards"
                      :key="card.label"
                      class="business-dashboard-analytics__trend-metric"
                      :class="[`is-${card.trend}`, `is-${card.tone}`]"
                    >
                      <span class="business-dashboard-analytics__trend-metric-label">{{ card.label }}</span>
                      <strong class="business-dashboard-analytics__trend-metric-value">{{ card.value }}</strong>
                      <span class="business-dashboard-analytics__trend-metric-detail">{{ card.detail }}</span>
                    </article>
                  </div>
                  <div class="business-dashboard-analytics__trend-chart">
                    <div class="business-dashboard-analytics__trend-grid" />
                    <svg
                      class="business-dashboard-analytics__trend-svg"
                      :viewBox="`0 0 ${businessTrendChart.chartWidth} ${businessTrendChart.chartHeight}`"
                      aria-hidden="true"
                    >
                      <path class="business-dashboard-analytics__trend-area" :d="businessTrendChart.jobAreaPath" />
                      <path class="business-dashboard-analytics__trend-line business-dashboard-analytics__trend-line--jobs" :d="businessTrendChart.jobPath" />
                      <path class="business-dashboard-analytics__trend-line business-dashboard-analytics__trend-line--applicants" :d="businessTrendChart.applicantPath" />
                      <circle
                        v-for="point in businessTrendChart.jobPoints"
                        :key="`job-${point.label}`"
                        class="business-dashboard-analytics__trend-point business-dashboard-analytics__trend-point--jobs"
                        :class="{ 'is-current': point.isCurrent }"
                        :cx="point.x"
                        :cy="point.y"
                        :r="point.isCurrent ? 5.2 : 3.8"
                      />
                      <circle
                        v-for="point in businessTrendChart.applicantPoints"
                        :key="`applicant-${point.label}`"
                        class="business-dashboard-analytics__trend-point business-dashboard-analytics__trend-point--applicants"
                        :class="{ 'is-current': point.isCurrent }"
                        :cx="point.x"
                        :cy="point.y"
                        :r="point.isCurrent ? 4.8 : 3.4"
                      />
                    </svg>
                    <div class="business-dashboard-analytics__trend-callout">
                      <span>{{ businessTrendChart.callout.label }}</span>
                      <strong>{{ businessTrendChart.callout.value }}</strong>
                      <small>{{ businessTrendChart.callout.copy }}</small>
                    </div>
                    <div class="business-dashboard-analytics__trend-summary">
                      <span class="business-dashboard-analytics__trend-legend">
                        <i class="bi bi-dash-lg" />
                        {{ businessTrendChart.totalJobs }} job posts
                      </span>
                      <span class="business-dashboard-analytics__trend-legend is-applicants">
                        <i class="bi bi-dash-lg" />
                        {{ businessTrendChart.totalApplicants }} applicants
                      </span>
                    </div>
                    <div class="business-dashboard-analytics__trend-labels">
                      <span v-for="month in businessTrendChart.months" :key="month.key">{{ month.label }}</span>
                    </div>
                  </div>
                </article>

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--stack business-dashboard-analytics__motion" style="--dashboard-enter-delay: 360ms">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Workspace Focus</span>
                      <strong>Operations snapshot</strong>
                    </div>
                    <span class="business-dashboard-analytics__pill">Live</span>
                  </div>

                  <div class="business-dashboard-analytics__progress">
                    <article v-for="item in dashboardProgressCards" :key="item.label" class="business-dashboard-analytics__progress-card">
                      <div class="business-dashboard-analytics__ring">
                        <span>{{ item.value }}</span>
                      </div>
                      <div>
                        <strong>{{ item.label }}</strong>
                        <p>{{ item.copy }}</p>
                      </div>
                    </article>
                  </div>

                  <div class="business-dashboard-analytics__bars">
                    <div v-for="item in dashboardBarSeries" :key="item.label" class="business-dashboard-analytics__bar-row">
                      <span>{{ item.label }}</span>
                      <div class="business-dashboard-analytics__bar-track">
                        <div class="business-dashboard-analytics__bar-fill" :style="{ width: item.width }" />
                      </div>
                      <strong>{{ item.value }}</strong>
                    </div>
                  </div>
                </article>

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--donut business-dashboard-analytics__motion" style="--dashboard-enter-delay: 450ms">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Distribution</span>
                      <strong>Workspace mix</strong>
                    </div>
                    <span class="business-dashboard-analytics__pill">{{ dashboardDonutLegend.length }} live items</span>
                  </div>
                  <div class="business-dashboard-analytics__donut-wrap">
                    <div class="business-dashboard-analytics__donut" :style="dashboardDonutStyle">
                      <div class="business-dashboard-analytics__donut-center">
                        <span>Total</span>
                        <strong>{{ dashboardDonutTotal }}</strong>
                      </div>
                    </div>
                    <div class="business-dashboard-analytics__legend">
                      <div v-for="item in dashboardDonutLegend" :key="item.label" class="business-dashboard-analytics__legend-item">
                        <span class="business-dashboard-analytics__legend-dot" :style="{ background: item.color }" />
                        <span>{{ item.label }}</span>
                        <strong>{{ item.value }}</strong>
                      </div>
                    </div>
                  </div>
                </article>

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--activity business-dashboard-analytics__motion" style="--dashboard-enter-delay: 540ms">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Workspace Notes</span>
                      <strong>Business dashboard highlights</strong>
                    </div>
                    <span class="business-dashboard-analytics__pill">Updated</span>
                  </div>

                  <div class="business-dashboard-analytics__activity-list">
                    <article
                      v-for="card in currentSection.cards"
                      :key="card.title"
                      class="business-dashboard-analytics__activity-item"
                    >
                      <div class="business-dashboard-analytics__activity-icon" aria-hidden="true">
                        <i class="bi bi-check2-circle" />
                      </div>
                      <div>
                        <strong>{{ card.title }}</strong>
                        <p>{{ card.copy }}</p>
                      </div>
                    </article>
                  </div>
                </article>
              </div>
            </section>

            <section
              v-if="activeSection === 'subscriptions' && subscriptionView === 'plans'"
              class="business-subscription-overview"
            >
              <div class="business-subscription-overview__copy">
                <strong>Active Subscription</strong>
                <span>Current Plan: {{ activeSubscriptionOverview.plan }}</span>
              </div>
              <div class="business-subscription-overview__billing">
                <small>{{ activeSubscriptionOverview.label }}</small>
                <strong>{{ activeSubscriptionOverview.value }}</strong>
                <span>{{ activeSubscriptionOverview.copy }}</span>
              </div>
            </section>

            <section v-if="activeSection === 'subscriptions'" class="business-pricing-header">
              <div>
                <h2>{{ subscriptionView === 'payment' ? currentCheckoutFlow.headerTitle : subscriptionView === 'history' ? 'Payment History' : 'Business Subscription' }}</h2>
                <p>
                  {{
                    subscriptionView === 'payment'
                      ? currentCheckoutFlow.headerDescription
                      : subscriptionView === 'history'
                        ? 'Track your subscription transactions and review receipt details.'
                        : 'Activate premium to unlock the full employer workspace and tools.'
                  }}
                </p>
              </div>
              <button
                v-if="subscriptionView !== 'payment'"
                type="button"
                class="business-pricing-header__action"
                @click="subscriptionView === 'history' ? goBackToPlans() : openPaymentHistory()"
              >
                {{ subscriptionView === 'history' ? 'Back to Subscription' : 'Payment history' }}
              </button>
            </section>

            <section v-else-if="activeSection === 'job-posting'" class="business-job-post">
              <div class="business-job-post__lead">
                <div class="business-job-post__copy">
                  <p class="business-job-post__eyebrow">Recruitment</p>
                  <h2>{{ jobPostingTab === 'create' ? (isEditingJobPost ? 'Edit job post' : 'Create a new job post') : 'Posted Jobs' }}</h2>
                  <p>
                    {{
                      jobPostingTab === 'create'
                        ? isEditingJobPost
                          ? 'Update the job details below, then save your changes to refresh the live posting.'
                          : 'Fill in the job details below to prepare a complete posting draft for your recruitment team.'
                        : 'Review, edit, close, reopen, or permanently delete the job posts saved in Firebase for this business workspace.'
                    }}
                  </p>
                  <div class="business-job-post__lead-meta">
                    <span class="business-job-post__lead-chip">
                      <i class="bi bi-briefcase" aria-hidden="true" />
                      {{ postedJobs.length }} saved posts
                    </span>
                    <span class="business-job-post__lead-chip">
                      <i class="bi bi-stars" aria-hidden="true" />
                      {{ activeSubscriptionPlan === 'premium' ? 'Premium workspace' : 'Starter workspace' }}
                    </span>
                  </div>
                </div>
                <div v-if="canEditBusinessModule('job-posting')" class="business-job-post__lead-actions">
                  <button
                    type="button"
                    class="business-job-post__button business-job-post__button--ghost"
                    @click="toggleJobPostingTab"
                  >
                    <i :class="jobPostingTab === 'create' ? 'bi bi-collection' : 'bi bi-plus-circle'" aria-hidden="true" />
                    {{ jobPostingTab === 'create' ? 'Posted Jobs' : 'Create Job Post' }}
                  </button>
                </div>
              </div>

              <div v-if="jobPostingTab === 'create'" class="business-job-post__create">
                <div class="business-job-post__shell">
                  <form class="business-job-post__form-shell" @submit.prevent="saveJobPost">
                    <fieldset class="business-job-post__fieldset" :disabled="!canEditBusinessModule('job-posting')">
                      <div class="business-job-post__section-head">
                        <div>
                          <p class="business-job-post__tips-label">Job Details</p>
                          <strong>{{ isEditingJobPost ? 'Refine this posting before republishing' : 'Build a complete post with the right details' }}</strong>
                        </div>
                        <span class="business-job-post__panel-chip">{{ isEditingJobPost ? 'Editing mode' : 'Draft mode' }}</span>
                      </div>

                      <div class="business-job-post__grid business-job-post__grid--two">
                        <label class="business-job-post__field">
                          <span>Job Title</span>
                          <input
                            v-model="jobPostingDraft.title"
                            type="text"
                            placeholder="Data Encoder"
                          />
                        </label>

                        <label class="business-job-post__field">
                          <span>Company Name</span>
                          
                          <input
                            :value="jobPostingCompanyNameDisplay"
                            type="text"
                            readonly
                            aria-readonly="true"
                          />
                        </label>
                      </div>

                      <label class="business-job-post__field">
                        <span>Description</span>
                        <textarea
                          v-model="jobPostingDraft.description"
                          rows="4"
                          placeholder="Describe the role..."
                        ></textarea>
                      </label>

                      <div class="business-job-post__grid business-job-post__grid--two">
                        <label class="business-job-post__field">
                          <span>Category</span>
                          <input
                            v-model="jobPostingDraft.category"
                            type="text"
                            placeholder="Enter job category"
                          />
                        </label>

                        <label class="business-job-post__field">
                          <span>Type</span>
                          <div
                            ref="jobPostingTypeDropdownRef"
                            class="business-job-post__select-wrap"
                            :class="{ 'is-open': isJobPostingDropdownOpen('type') }"
                          >
                            <button
                              type="button"
                              class="business-job-post__select-trigger"
                              :class="{ 'is-filled': jobPostingDraft.type }"
                              :aria-expanded="isJobPostingDropdownOpen('type') ? 'true' : 'false'"
                              @click="toggleJobPostingDropdown('type')"
                            >
                              <span>{{ jobPostingTypeLabel }}</span>
                              <i class="bi bi-chevron-down business-job-post__select-icon" aria-hidden="true" />
                            </button>

                            <transition name="business-job-post__dropdown">
                              <div v-if="isJobPostingDropdownOpen('type')" class="business-job-post__select-menu">
                                <button
                                  v-for="type in JOB_POSTING_EMPLOYMENT_TYPES"
                                  :key="type"
                                  type="button"
                                  class="business-job-post__select-option"
                                  :class="{ 'is-active': jobPostingDraft.type === type }"
                                  @click="selectJobPostingDropdownValue('type', type)"
                                >
                                  <span class="business-job-post__select-option-mark" aria-hidden="true" />
                                  <span>{{ type }}</span>
                                </button>
                              </div>
                            </transition>
                          </div>
                        </label>
                      </div>

                      <div class="business-job-post__grid business-job-post__grid--three">
                        <label class="business-job-post__field">
                          <span>Location</span>
                          <input :value="jobPostingDraft.location" type="text" readonly aria-readonly="true" />
                        </label>

                        <label class="business-job-post__field">
                          <span>Barangay (Dasmarinas)</span>
                          <div
                            ref="jobPostingBarangayDropdownRef"
                            class="business-job-post__select-wrap"
                            :class="{ 'is-open': isJobPostingDropdownOpen('barangay') }"
                          >
                            <button
                              type="button"
                              class="business-job-post__select-trigger"
                              :class="{ 'is-filled': jobPostingDraft.barangay }"
                              :aria-expanded="isJobPostingDropdownOpen('barangay') ? 'true' : 'false'"
                              @click="toggleJobPostingDropdown('barangay')"
                            >
                              <span>{{ jobPostingBarangayLabel }}</span>
                              <i class="bi bi-chevron-down business-job-post__select-icon" aria-hidden="true" />
                            </button>

                            <transition name="business-job-post__dropdown">
                              <div v-if="isJobPostingDropdownOpen('barangay')" class="business-job-post__select-menu business-job-post__select-menu--scroll">
                                <button
                                  v-for="barangay in JOB_POSTING_BARANGAYS"
                                  :key="barangay.value"
                                  type="button"
                                  class="business-job-post__select-option"
                                  :class="{ 'is-active': jobPostingDraft.barangay === barangay.value }"
                                  @click="selectJobPostingDropdownValue('barangay', barangay.value)"
                                >
                                  <span class="business-job-post__select-option-mark" aria-hidden="true" />
                                  <span>{{ barangay.label }}</span>
                                </button>
                              </div>
                            </transition>
                          </div>
                        </label>

                        <label class="business-job-post__field">
                          <span>Vacancies</span>
                          <input
                            v-model="jobPostingDraft.vacancies"
                            type="number"
                            min="1"
                            :max="JOB_POSTING_MAX_VACANCIES"
                            placeholder="Enter number of vacancies"
                          />
                        </label>
                      </div>

                      <div class="business-job-post__grid business-job-post__grid--three">
                        <label class="business-job-post__field">
                          <span>Disability Type</span>
                          <div
                            ref="jobPostingDisabilityDropdownRef"
                            class="business-job-post__select-wrap"
                            :class="{ 'is-open': isJobPostingDropdownOpen('disability') }"
                          >
                            <button
                              type="button"
                              class="business-job-post__select-trigger"
                              :class="{ 'is-filled': jobPostingDraft.disabilityType }"
                              :aria-expanded="isJobPostingDropdownOpen('disability') ? 'true' : 'false'"
                              @click="toggleJobPostingDropdown('disability')"
                            >
                              <span>{{ jobPostingDisabilityLabel }}</span>
                              <i class="bi bi-chevron-down business-job-post__select-icon" aria-hidden="true" />
                            </button>

                            <transition name="business-job-post__dropdown">
                              <div v-if="isJobPostingDropdownOpen('disability')" class="business-job-post__select-menu business-job-post__select-menu--scroll">
                                <button
                                  v-for="type in JOB_POSTING_DISABILITY_TYPES"
                                  :key="type.value"
                                  type="button"
                                  class="business-job-post__select-option"
                                  :class="{ 'is-active': jobPostingDraft.disabilityType === type.value }"
                                  @click="selectJobPostingDropdownValue('disabilityType', type.value)"
                                >
                                  <span class="business-job-post__select-option-mark" aria-hidden="true" />
                                  <span>{{ type.label }}</span>
                                </button>
                              </div>
                            </transition>
                          </div>
                        </label>

                        <label v-if="jobPostingDisabilityTypeNeedsSpecification" class="business-job-post__field">
                          <span>Impairment Specification</span>
                          <input
                            v-model="jobPostingDraft.impairmentSpecification"
                            type="text"
                            :placeholder="getJobPostingImpairmentSpecificationPlaceholder(jobPostingDraft.disabilityType)"
                          />
                        </label>
                        <div v-else class="business-job-post__field business-job-post__field--spacer" aria-hidden="true"></div>

                        <label class="business-job-post__field">
                          <span>Preferred Age</span>
                          <input
                            v-model="jobPostingDraft.preferredAgeRange"
                            type="text"
                            placeholder="Enter preferred age"
                          />
                        </label>

                        <label class="business-job-post__field">
                          <span>Language</span>
                          <div
                            ref="jobPostingLanguageDropdownRef"
                            class="business-job-post__select-wrap"
                            :class="{ 'is-open': isJobPostingDropdownOpen('language') }"
                          >
                            <button
                              type="button"
                              class="business-job-post__select-trigger"
                              :class="{ 'is-filled': jobPostingDraft.language }"
                              :aria-expanded="isJobPostingDropdownOpen('language') ? 'true' : 'false'"
                              @click="toggleJobPostingDropdown('language')"
                            >
                              <span>{{ jobPostingLanguageLabel }}</span>
                              <i class="bi bi-chevron-down business-job-post__select-icon" aria-hidden="true" />
                            </button>

                            <transition name="business-job-post__dropdown">
                              <div v-if="isJobPostingDropdownOpen('language')" class="business-job-post__select-menu">
                                <button
                                  v-for="language in JOB_POSTING_LANGUAGE_OPTIONS"
                                  :key="language.value"
                                  type="button"
                                  class="business-job-post__select-option"
                                  :class="{ 'is-active': jobPostingDraft.language === language.value }"
                                  @click="selectJobPostingDropdownValue('language', language.value)"
                                >
                                  <span class="business-job-post__select-option-mark" aria-hidden="true" />
                                  <span>{{ language.label }}</span>
                                </button>
                              </div>
                            </transition>
                          </div>
                        </label>
                      </div>

                      <label class="business-job-post__field">
                        <span>Salary Range</span>
                        <div class="business-job-post__range">
                          <input
                            :value="jobPostingDraft.salaryRange"
                            type="text"
                            inputmode="text"
                            placeholder="Example: PHP 15,000 - PHP 20,000"
                            @input="handleJobPostingFieldChange('salaryRange', $event.target.value)"
                          />
                        </div>
                      </label>

                      <div class="business-job-post__grid business-job-post__grid--two">
                        <label class="business-job-post__field">
                          <span>Qualifications</span>
                          <textarea
                            v-model="jobPostingDraft.qualifications"
                            rows="5"
                            placeholder="Basic computer literacy&#10;Attention to detail"
                          ></textarea>
                        </label>

                        <label class="business-job-post__field">
                          <span>Responsibilities</span>
                          <textarea
                            v-model="jobPostingDraft.responsibilities"
                            rows="5"
                            placeholder="Encode and verify records&#10;Coordinate with admin team"
                          ></textarea>
                        </label>
                      </div>

                      <div class="business-job-post__actions">
                        <button type="submit" class="business-job-post__save" :disabled="isSavingJobPost">
                          <i :class="isSavingJobPost ? 'bi bi-arrow-repeat' : (isEditingJobPost ? 'bi bi-check2-circle' : 'bi bi-send')" aria-hidden="true" />
                          {{
                            isSavingJobPost
                              ? isEditingJobPost
                                ? 'Saving Changes...'
                                : 'Publishing...'
                              : isEditingJobPost
                                ? 'Save Changes'
                                : 'Post Job'
                          }}
                        </button>
                        <button
                          v-if="isEditingJobPost"
                          type="button"
                          class="business-job-post__secondary"
                          :disabled="isSavingJobPost"
                          @click="cancelJobPostEditing"
                        >
                          <i class="bi bi-x-circle" aria-hidden="true" />
                          Cancel Edit
                        </button>
                      </div>
                    </fieldset>
                  </form>

                  <aside class="business-job-post__live-preview" aria-label="Live job preview">
                    <div class="business-job-post__section-head business-job-post__section-head--preview">
                      <div>
                        <p class="business-job-post__tips-label">Live Preview</p>
                        <strong>See how applicants will read this post</strong>
                      </div>
                    </div>

                    <div class="business-job-post__preview-head">
                      <span class="business-job-post__preview-status">{{ jobPostingPreviewStatusLabel }}</span>
                      <span class="business-job-post__preview-date">
                        <i class="bi bi-clock" aria-hidden="true" />
                        {{ jobPostingCreatedPreview }}
                      </span>
                    </div>

                    <div class="business-job-post__preview-main">
                      <div class="business-job-post__preview-logo" aria-hidden="true">
                        <img
                          v-if="profileForm.avatar || businessAvatar"
                          :src="profileForm.avatar || businessAvatar"
                          alt=""
                          class="business-job-post__preview-logo-image"
                        />
                        <template v-else>{{ businessInitials }}</template>
                      </div>

                      <div class="business-job-post__preview-copy-wrap">
                        <h3>{{ jobPostingDraft.title.trim() || 'Job title preview' }}</h3>
                        <p class="business-job-post__preview-company">
                          <i class="bi bi-building" aria-hidden="true" />
                          {{ jobPostingCompanyNameDisplay || 'Company name' }}
                        </p>
                        <div class="business-job-post__preview-rating" aria-label="Preview rating">
                          <span class="business-job-post__preview-stars" aria-hidden="true">
                            <i v-for="index in 5" :key="`job-post-star-${index}`" class="bi bi-star" />
                          </span>
                          <strong>0.0 / 5</strong>
                          <span>(0 reviews)</span>
                        </div>
                      </div>
                    </div>

                    <div class="business-job-post__preview-meta">
                      <span>
                        <i class="bi bi-geo-alt" aria-hidden="true" />
                        {{ jobPostingDraft.barangay ? `Dasmarinas City, ${jobPostingDraft.barangay}` : 'Select barangay' }}
                      </span>
                      <span>
                        <i class="bi bi-briefcase" aria-hidden="true" />
                        {{ jobPostingDraft.category.trim() || 'Select category' }}
                      </span>
                      <span>
                        <i class="bi bi-clock" aria-hidden="true" />
                        {{ jobPostingDraft.type || 'Select type' }}
                      </span>
                      <span>
                        <i class="bi bi-people" aria-hidden="true" />
                        {{ jobPostingDraft.vacancies ? `${jobPostingDraft.vacancies} Vacancies` : 'Select vacancies' }}
                      </span>
                    </div>

                    <div class="business-job-post__preview-section">
                      <h4>
                        <i class="bi bi-file-text" aria-hidden="true" />
                        Job Description
                      </h4>
                      <p>
                        {{
                          jobPostingDraft.description.trim()
                            || 'Describe the role and what the applicant will do in this position.'
                        }}
                      </p>
                    </div>

                    <div class="business-job-post__preview-panel">
                      <h4>
                        <i class="bi bi-translate" aria-hidden="true" />
                        Language and Age Preference
                      </h4>
                      <p>
                        <strong>Languages:</strong>
                        {{ ` ${jobPostingDraft.language || 'Select language'}` }}
                      </p>
                      <p>
                        <strong>Preferred Age:</strong>
                        {{ ` ${jobPostingDraft.preferredAgeRange || 'Enter preferred age'}` }}
                      </p>
                    </div>

                    <div class="business-job-post__preview-grid">
                      <div class="business-job-post__preview-section">
                        <h4>
                          <i class="bi bi-check2-circle" aria-hidden="true" />
                          Qualifications
                        </h4>
                        <ul>
                          <li
                            v-for="(item, index) in (jobPostingQualificationsPreview.length
                              ? jobPostingQualificationsPreview
                              : ['Add qualifications to preview them here.'])"
                            :key="`job-post-qualification-${index}`"
                          >
                            {{ item }}
                          </li>
                        </ul>
                      </div>

                      <div class="business-job-post__preview-section">
                        <h4>
                          <i class="bi bi-list-task" aria-hidden="true" />
                          Responsibilities
                        </h4>
                        <ul>
                          <li
                            v-for="(item, index) in (jobPostingResponsibilitiesPreview.length
                              ? jobPostingResponsibilitiesPreview
                              : ['Add responsibilities to preview them here.'])"
                            :key="`job-post-responsibility-${index}`"
                          >
                            {{ item }}
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div class="business-job-post__preview-summary">
                      <div class="business-job-post__preview-summary-card">
                        <span class="business-job-post__preview-summary-icon" aria-hidden="true">
                          <i class="bi bi-cash-stack" />
                        </span>
                        <span>Salary Range</span>
                        <strong>{{ jobPostingSalaryPreview }}</strong>
                      </div>

                      <div class="business-job-post__preview-summary-card">
                        <span class="business-job-post__preview-summary-icon" aria-hidden="true">
                          <i class="bi bi-universal-access-circle" />
                        </span>
                        <span>Suitable For</span>
                        <strong>
                          {{
                            buildJobPostingDisabilityFitLabel(
                              jobPostingDraft.disabilityType,
                              jobPostingDisabilityTypeNeedsSpecification
                                ? jobPostingDraft.impairmentSpecification
                                : '',
                            ) || 'Select disability type'
                          }}
                        </strong>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>

              <div v-else class="business-job-post__posted-layout">
                <div class="business-job-post__highlights">
                  <article
                    v-for="item in jobPostHighlights"
                    :key="item.label"
                    class="business-job-post__highlight"
                    :class="{ 'business-guide-target': isPremiumGuideTarget('job-post-unlimited') && item.value === 'Unlimited' }"
                    :ref="item.value === 'Unlimited' ? setJobPostUnlimitedHighlightRef : undefined"
                  >
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </article>
                </div>

                <article class="business-job-post__panel business-job-post__panel--posted">
                  <div class="business-job-post__panel-head">
                    <div>
                      <p class="business-job-post__tips-label">Posted Jobs</p>
                      <strong>Manage active and closed job posts from your business workspace</strong>
                    </div>
                    <span class="business-job-post__panel-chip">{{ postedJobs.length }} total</span>
                  </div>

                  <div class="business-job-post__posted-list">
                    <p v-if="isPostedJobsLoading" class="business-job-post__posted-empty">
                      Loading posted jobs...
                    </p>
                    <p v-else-if="postedJobsSyncMessage" class="business-job-post__posted-empty">
                      {{ postedJobsSyncMessage }}
                    </p>
                    <p v-else-if="!postedJobs.length" class="business-job-post__posted-empty">
                      No job posts yet. Publish your first opening and it will appear here and on the landing page.
                    </p>
                    <article v-for="job in postedJobs" v-else :key="job.id" class="business-job-post__posted-row">
                      <div class="business-job-post__posted-main">
                        <div class="business-job-post__posted-top">
                          <strong>{{ job.title }}</strong>
                          <span class="business-job-post__status" :class="resolvePostedJobStatusClass(job.status)">{{ job.status }}</span>
                        </div>
                        <p>{{ job.category }} | {{ job.location }} | {{ job.workType }}</p>
                        <small>{{ job.id }} | {{ job.updated }}</small>
                      </div>

                      <div class="business-job-post__posted-metric">
                        <span>Vacancies</span>
                        <strong>{{ job.vacancies }}</strong>
                      </div>

                      <div class="business-job-post__posted-side">
                        <span>Salary</span>
                        <strong>{{ job.salary }}</strong>
                      </div>

                      <div v-if="canEditBusinessModule('job-posting')" class="business-job-post__posted-actions">
                        <div class="business-job-post__menu">
                          <button
                            type="button"
                            class="business-job-post__menu-trigger"
                            aria-label="Open job post actions"
                            :disabled="Boolean(jobPostPendingAction.jobId)"
                            @click="toggleJobPostActionMenu(job.id)"
                          >
                            <i class="bi bi-three-dots-vertical" aria-hidden="true" />
                          </button>

                          <div v-if="openJobPostActionMenuId === job.id" class="business-job-post__menu-panel">
                            <button
                              type="button"
                              class="business-job-post__menu-action"
                              :disabled="Boolean(jobPostPendingAction.jobId)"
                              @click="startEditingJobPost(job.id)"
                            >
                              <i class="bi bi-pencil-square" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              class="business-job-post__menu-action"
                              :disabled="Boolean(jobPostPendingAction.jobId)"
                              @click="updateJobPostStatus(job.id, String(job.status || '').trim().toLowerCase() === 'closed' ? 'open' : 'closed')"
                            >
                              <i :class="String(job.status || '').trim().toLowerCase() === 'closed' ? 'bi bi-unlock' : 'bi bi-pause-circle'" aria-hidden="true" />
                              {{
                                isJobPostActionPending(job.id, String(job.status || '').trim().toLowerCase() === 'closed' ? 'open' : 'close')
                                  ? String(job.status || '').trim().toLowerCase() === 'closed'
                                    ? 'Opening...'
                                    : 'Closing...'
                                  : String(job.status || '').trim().toLowerCase() === 'closed'
                                    ? 'Open'
                                    : 'Close'
                              }}
                            </button>
                            <button
                              type="button"
                              class="business-job-post__menu-action is-danger"
                              :disabled="Boolean(jobPostPendingAction.jobId)"
                              @click="permanentlyDeleteJobPost(job.id)"
                            >
                              <i class="bi bi-trash3" aria-hidden="true" />
                              {{ isJobPostActionPending(job.id, 'delete') ? 'Deleting...' : 'Delete' }}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </article>

              </div>
            </section>

            <section v-else-if="activeSection === 'applicant-management'" class="business-applicants">
              <div class="business-applicants__lead">
                <div class="business-applicants__copy">
                  <p class="business-applicants__eyebrow">Recruitment Pipeline</p>
                  <h2>Manage applicants and keep your shortlist organized</h2>
                  <p>
                    See incoming applicants, highlight strong matches, and track who is ready for the
                    next hiring step without leaving the business dashboard.
                  </p>
                </div>
                <div class="business-applicants__lead-meta">
                  <span class="business-applicants__panel-chip">{{ businessApplicantHighlights[0]?.value || '0' }} active applicants</span>
                  <span class="business-applicants__panel-chip">{{ businessApplicantHighlights[2]?.value || '0' }} ready to review</span>
                </div>
              </div>

              <article class="business-applicants__panel business-applicants__panel--main">
                <div class="business-applicants__panel-head">
      
            
                </div>

                <div class="business-user-overview__toolbar business-user-overview__toolbar--applicants">
                  <label class="business-user-overview__field business-user-overview__field--search">
                    <span>Search</span>
                    <input
                      v-model.trim="applicantManagementSearch"
                      type="text"
                      placeholder="Search by name, email, or applied role..."
                    />
                  </label>

                  <label class="business-user-overview__field">
                    <span>Role</span>
                    <select v-model="applicantManagementRoleFilter">
                      <option v-for="option in applicantManagementRoleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <label class="business-user-overview__field">
                    <span>Status</span>
                    <select v-model="applicantManagementStatusFilter">
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="under review">Under Review</option>
                      <option value="interview">Interview</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    class="business-user-overview__action-btn business-user-overview__action-btn--primary business-applicants__table-action"
                    @click="reviewApplicantManagementQueue"
                  >
                    <i class="bi bi-list-check" aria-hidden="true" />
                    Review Applicants
                  </button>

                  <div class="business-user-overview__summary">
                    {{ applicantManagementSummary }}
                  </div>
                </div>

                <div class="business-applicants__table-shell">
                  <table class="business-applicants__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Applicant</th>
                        <th>Applied Role</th>
                        <th>Status</th>
                        <th>Applied Date</th>
                        <th class="business-applicants__table-actions-head">Actions</th>
                      </tr>
                    </thead>

                    <TransitionGroup v-if="filteredApplicantManagementRows.length" tag="tbody" name="business-user-overview-row">
                      <tr
                        v-for="(applicant, index) in filteredApplicantManagementRows"
                        :key="`${applicant.id}-${applicant.email}-${index}`"
                        class="business-applicants__table-row"
                      >
                        <td class="business-applicants__table-index">{{ index + 1 }}</td>
                        <td>
                          <div class="business-user-overview__account">
                            <div class="business-user-overview__avatar" :class="applicant.avatarClass">
                              <img
                                v-if="applicant.avatarUrl"
                                :src="applicant.avatarUrl"
                                :alt="`${applicant.name} avatar`"
                                class="business-user-overview__avatar-image"
                              >
                              <template v-else>{{ applicant.initials }}</template>
                            </div>

                            <div class="business-user-overview__meta">
                              <strong>{{ applicant.name }}</strong>
                              <span>{{ applicant.email }}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="business-applicants__role-copy">
                            <strong>{{ applicant.role }}</strong>
                            <span :title="applicant.accessSummary">{{ applicant.accessSummary }}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            class="business-applicants__status-pill"
                            :class="`is-${applicant.status.replace(/\s+/g, '-')}`"
                          >
                            {{ applicant.statusLabel }}
                          </span>
                        </td>
                        <td>{{ applicant.date }}</td>
                        <td class="business-applicants__table-actions-cell">
                          <div class="business-applicants__row-actions">
                            <button
                              type="button"
                              class="business-applicants__row-action"
                              title="View"
                              aria-label="View"
                              @click="openApplicantManagementDecision(applicant.id, 'view')"
                            >
                              <i class="bi bi-eye" aria-hidden="true" />
                            </button>
                            <button
                              v-if="!applicant.isFinalStatus"
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--approve"
                              title="Approve"
                              aria-label="Approve"
                              @click="approveApplicantManagementApplication(applicant.id)"
                            >
                              <i class="bi bi-check-lg" aria-hidden="true" />
                            </button>
                            <button
                              v-if="!applicant.isFinalStatus"
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--reject"
                              title="Reject"
                              aria-label="Reject"
                              @click="openApplicantManagementDecision(applicant.id, 'reject')"
                            >
                              <i class="bi bi-x-lg" aria-hidden="true" />
                            </button>
                            <button
                              v-else
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--final"
                              :class="`is-${applicant.finalAction.tone}`"
                              :title="applicant.finalAction.label"
                              :aria-label="applicant.finalAction.label"
                              disabled
                            >
                              <i :class="applicant.finalAction.icon" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </TransitionGroup>

                    <tbody v-else>
                      <tr>
                        <td colspan="6">
                          <div class="business-user-overview__empty">
                            No applicants match the current filter.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            <section v-else-if="activeSection === 'user-overview' || activeSection === 'create-user' || activeSection === 'add-employee'" class="business-user-management">
              <div class="business-user-management__lead">
                <div class="business-user-management__copy">
                  <p class="business-user-management__eyebrow">User Management</p>
                  <h2>{{ currentUserManagementPage.title }}</h2>
                  <p>{{ currentUserManagementPage.description }}</p>
                </div>
                <div v-if="activeSection !== 'create-user' && activeSection !== 'user-overview'" class="business-user-management__lead-meta">
                  <span class="business-user-management__panel-chip">
                    {{
                      isWorkspaceUserDirectoryLoading
                        ? 'Syncing workspace users...'
                        : activeSection === 'create-user'
                          ? `${workspaceUserDirectory.length} workspace logins`
                          : `${workspaceUserDirectory.length} users ready to link`
                    }}
                  </span>
                  <span class="business-user-management__panel-chip">
                    {{ activeSection === 'create-user' ? `${permissionRoles.length} roles available` : `${employeeDirectory.length} employee profiles` }}
                  </span>
                </div>
              </div>
              <p v-if="workspaceUserDirectorySyncMessage && activeSection !== 'create-user'" class="business-user-management__notice">
                {{ workspaceUserDirectorySyncMessage }}
              </p>

              <section v-if="activeSection === 'user-overview'" class="business-user-management__overview">
                <div class="business-user-management__overview-head">
                  <div>
                    <p class="business-user-management__panel-label">User Overview</p>
                    <h3>Quick snapshot of your team members</h3>
                  </div>
                  <span class="business-user-management__panel-chip">
                    {{
                      activeSection === 'user-overview'
                        ? 'Team Members'
                        : activeSection === 'create-user'
                          ? 'Create User'
                          : 'Add Member'
                    }}
                  </span>
                </div>

                <div class="business-user-management__overview-grid">
                  <article
                    v-for="card in userOverviewCards"
                    :key="card.label"
                    class="business-user-management__overview-card"
                  >
                    <span>{{ card.label }}</span>
                    <strong>{{ card.value }}</strong>
                    <small>{{ card.copy }}</small>
                  </article>
                </div>
              </section>

              <BusinessUserOverview
                v-if="activeSection === 'user-overview'"
                :workspace-user-count="workspaceUserDirectory.length"
                :employee-profile-count="employeeDirectory.length"
                :rows="filteredUserOverviewRows"
                :role-options="userOverviewRoleOptions"
                :search="userOverviewSearch"
                :role-filter="userOverviewRoleFilter"
                :status-filter="userOverviewStatusFilter"
                :summary="userOverviewSummary"
                :format-date="formatUserOverviewDate"
                @update:search="userOverviewSearch = $event"
                @update:role-filter="userOverviewRoleFilter = $event"
                @update:status-filter="userOverviewStatusFilter = $event"
                @create-user="activeSection = 'create-user'"
              />

              <article v-else-if="activeSection === 'create-user'" class="business-user-management__panel business-user-management__panel--admin-create">
                <div class="business-user-management__sheet-header">
                  <div>
                    <p class="business-user-management__panel-label">Create User</p>
                    <h3>Create a workspace login for your team</h3>
                    <p class="business-user-management__sheet-copy">Enter the team member details below and assign a saved role before creating the account.</p>
                  </div>
                  <span class="business-user-management__panel-chip">{{ permissionRoles.length }} roles available</span>
                </div>

                <fieldset class="business-user-management__fieldset business-user-management__fieldset--sheet" :disabled="!canEditBusinessModule('create-user') || isCreatingWorkspaceUser">
                  <div class="business-user-management__grid business-user-management__grid--two">
                    <label class="business-user-management__field business-user-management__field--sheet">
                      <span>Full Name</span>
                      <input v-model="userAccountDraft.fullName" type="text" placeholder="Enter full name" />
                    </label>

                    <label class="business-user-management__field business-user-management__field--sheet">
                      <span>Email Address</span>
                      <input v-model="userAccountDraft.gmail" type="email" placeholder="name@company.com" />
                    </label>
                  </div>

                  <div class="business-user-management__grid business-user-management__grid--two">
                    <label class="business-user-management__field business-user-management__field--sheet">
                      <span>Temporary Password</span>
                      <input v-model="userAccountDraft.temporaryPassword" type="text" placeholder="Enter temporary password" />
                    </label>

                    <label class="business-user-management__field business-user-management__field--sheet">
                      <span>Assign Role</span>
                      <select v-model="userAccountDraft.roleId">
                        <option value="">Select a role from Permissions</option>
                        <option v-for="role in permissionRoleOptionsForUsers" :key="role.id" :value="role.id">
                          {{ role.name }}
                        </option>
                      </select>
                    </label>
                  </div>

                  <div v-if="selectedUserAccountRole" class="business-user-management__role-preview">
                    <div class="business-user-management__role-preview-head">
                      <span class="business-user-management__panel-chip">{{ selectedUserAccountRole.name }}</span>
                    </div>
                    <div class="business-user-management__inline-meta business-user-management__inline-meta--sheet">
                      <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleSummary }}</span>
                      <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleModules }}</span>
                    </div>
                    <p class="business-permissions__intro-copy">
                      Module access preview for the selected role. Ito ang exact access pattern na maa-assign sa bagong user.
                    </p>
                    <div class="business-permissions__table-wrap business-permissions__table-wrap--matrix">
                      <table class="business-permissions__table business-permissions__table--matrix">
                        <thead>
                          <tr>
                            <th>Section</th>
                            <th>Module</th>
                            <th>View</th>
                            <th>Edit</th>
                            <th>Full Access</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <template v-for="section in selectedUserAccountRoleModuleSections" :key="section.id">
                            <tr
                              v-for="module in section.modules"
                              :key="module.id"
                              class="business-permissions__table-row"
                              :class="{ 'is-muted': !module.permissions.view }"
                            >
                              <td>
                                <span class="business-permissions__section-chip">
                                  <i :class="section.icon" aria-hidden="true" />
                                  {{ section.label }}
                                </span>
                              </td>
                              <td>
                                <div class="business-permissions__module-copy">
                                  <strong>{{ module.label }}</strong>
                                  <p>{{ module.description }}</p>
                                </div>
                              </td>
                              <td>
                                <label class="business-permissions__switch" :aria-label="`View access for ${module.label}`">
                                  <input
                                    type="checkbox"
                                    class="business-permissions__switch-input"
                                    :checked="module.permissions.view"
                                    disabled
                                  />
                                  <span class="business-permissions__switch-track" aria-hidden="true">
                                    <span class="business-permissions__switch-thumb" />
                                  </span>
                                </label>
                              </td>
                              <td>
                                <label class="business-permissions__switch" :aria-label="`Edit access for ${module.label}`">
                                  <input
                                    type="checkbox"
                                    class="business-permissions__switch-input"
                                    :checked="module.permissions.edit"
                                    disabled
                                  />
                                  <span class="business-permissions__switch-track" aria-hidden="true">
                                    <span class="business-permissions__switch-thumb" />
                                  </span>
                                </label>
                              </td>
                              <td>
                                <label class="business-permissions__switch" :aria-label="`Full access for ${module.label}`">
                                  <input
                                    type="checkbox"
                                    class="business-permissions__switch-input"
                                    :checked="module.permissions.full"
                                    disabled
                                  />
                                  <span class="business-permissions__switch-track" aria-hidden="true">
                                    <span class="business-permissions__switch-thumb" />
                                  </span>
                                </label>
                              </td>
                              <td>
                                <span
                                  class="business-permissions__status-pill"
                                  :class="{
                                    'is-hidden': !module.permissions.view,
                                    'is-full': module.permissions.full,
                                  }"
                                >
                                  {{ module.accessLabel }}
                                </span>
                              </td>
                            </tr>
                          </template>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="business-user-management__actions business-user-management__actions--sheet">
                    <button type="button" class="business-user-management__action-btn business-user-management__action-btn--secondary" @click="userAccountDraft = createDefaultUserAccountDraft()">
                      <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                      Clear Form
                    </button>
                    <button type="button" class="business-user-management__action-btn business-user-management__action-btn--primary" @click="saveWorkspaceUserAccount">
                      <i class="bi bi-check-circle" aria-hidden="true" />
                      {{ isCreatingWorkspaceUser ? 'Creating Account...' : 'Create User' }}
                    </button>
                  </div>
                </fieldset>
              </article>

              <article v-else class="business-user-management__panel business-user-management__panel--form">
                <div class="business-user-management__panel-head">
                  <div>
                    <p class="business-user-management__panel-label">Add Member</p>
                    <h3>Link a created user to a team member profile</h3>
                  </div>
                  <span class="business-user-management__panel-chip">{{ employeeDirectory.length }} employee profiles</span>
                </div>

                <div class="business-user-management__drawer-launch">
                  <div class="business-user-management__drawer-copy">
                    <strong>Create a new team member entry</strong>
                    <span>Open the side panel to link a workspace user, fill in member details, and save the profile.</span>
                  </div>
                  <button type="button" class="business-user-management__action-btn business-user-management__action-btn--primary" @click="openAddMemberDrawer">
                    <i class="bi bi-person-plus" aria-hidden="true" />
                    Add Member
                  </button>
                </div>

                <section v-if="selectedEmployeeRole" class="business-user-management__access-panel">
                  <div class="business-user-management__panel-head">
                    <div>
                      <p class="business-user-management__panel-label">Module Access</p>
                      <h3>{{ selectedEmployeeRole.name }} role access</h3>
                    </div>
                    <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleSummary }}</span>
                  </div>

                  <div class="business-user-management__access-sections">
                    <article
                      v-for="section in selectedEmployeeRoleModuleSections"
                      :key="section.id"
                      class="business-user-management__access-group"
                    >
                      <div class="business-user-management__access-group-head">
                        <span class="business-user-management__access-group-title">
                          <i :class="section.icon" aria-hidden="true" />
                          {{ section.label }}
                        </span>
                      </div>

                      <div class="business-user-management__access-list">
                        <div
                          v-for="module in section.modules"
                          :key="module.id"
                          class="business-user-management__access-item"
                        >
                          <div class="business-user-management__access-copy">
                            <strong>{{ module.label }}</strong>
                            <small>{{ module.description }}</small>
                          </div>
                          <span
                            class="business-user-management__access-badge"
                            :class="{
                              'is-full': module.permissions.full,
                              'is-edit': module.permissions.edit && !module.permissions.full,
                              'is-view': module.permissions.view && !module.permissions.edit && !module.permissions.full,
                              'is-hidden': !module.permissions.view,
                            }"
                          >
                            {{ module.accessLabel }}
                          </span>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>

                <div class="business-user-management__table-wrap">
                  <table class="business-user-management__table">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Linked User</th>
                        <th>Role</th>
                        <th>Gmail</th>
                        <th>Employment Type</th>
                        <th>Status</th>
                        <th>Start Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="employee in employeeDirectory" :key="employee.id">
                        <td><strong>{{ employee.id }}</strong></td>
                        <td>
                          <div class="business-user-management__meta">
                            <strong>{{ employee.name }}</strong>
                            <small>{{ employee.linkedUserId }}</small>
                          </div>
                        </td>
                        <td>
                          <div class="business-user-management__meta">
                            <strong>{{ getEmployeeRoleName(employee) }}</strong>
                            <small>{{ getEmployeeRoleAccessSummary(employee) }}</small>
                          </div>
                        </td>
                        <td>{{ employee.workEmail }}</td>
                        <td>{{ employee.employmentType || 'Not set' }}</td>
                        <td>
                          <span class="business-user-management__status" :class="resolveEmployeeStatusClass(employee.status)">
                            {{ employee.status }}
                          </span>
                        </td>
                        <td>{{ employee.startDate || 'Not set' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            <section
              v-else-if="activeSection === 'permissions'"
              class="business-permissions"
            >
              <div class="business-permissions__hero">
                <div class="business-permissions__hero-copy">
                  <p class="business-permissions__eyebrow">Permissions</p>
                  <h2>Role and module access matrix</h2>
                  <p>Configure roles in a cleaner admin-style workspace. View makes a module visible in the sidebar, Edit unlocks changes inside it, and Full Access grants everything in that module.</p>
                </div>
                <div class="business-permissions__hero-stats">
                  <span class="business-permissions__hero-chip">{{ permissionRoles.length }} roles</span>
                  <span class="business-permissions__hero-chip">{{ selectedPermissionEnabledModuleCount }} modules visible</span>
                  <span class="business-permissions__hero-chip">{{ selectedPermissionFullAccessCount }} full access</span>
                </div>
              </div>

              <div class="business-permissions__layout">
                <div class="business-permissions__panel business-permissions__panel--editor">
                  <div class="business-permissions__panel-head">
                    <div>
                      <p class="business-permissions__panel-label">Module Access</p>
                      <h3>{{ selectedPermissionRole?.name || 'Select a role' }}</h3>
                      <p v-if="selectedPermissionRole" class="business-permissions__role-meta">
                        {{ formatPermissionRoleAccessSummary(selectedPermissionRole) }}
                        <span aria-hidden="true">•</span>
                        {{ selectedPermissionAssignedUsersCount }}
                        {{ selectedPermissionAssignedUsersCount === 1 ? 'assigned user' : 'assigned users' }}
                      </p>
                    </div>
                    <div class="business-permissions__panel-tools">
                      <p
                        class="business-permissions__save-state"
                        :class="{ 'is-unsaved': permissionRolesHasUnsavedChanges || isSavingPermissionRoles }"
                      >
                        {{ isSavingPermissionRoles ? 'Saving to Firebase' : permissionRolesHasUnsavedChanges ? 'Unsaved changes' : 'Saved to workspace' }}
                      </p>
                      <span
                        v-if="selectedPermissionRole"
                        class="business-permissions__role-tag"
                        :style="{ '--role-color': selectedPermissionRole.color }"
                      >
                        {{ selectedPermissionRole.name }}
                      </span>
                      <div class="business-permissions__panel-actions">
                        <button
                          type="button"
                          class="business-permissions__secondary business-permissions__mode-button"
                          :class="{ 'is-active': isPermissionRoleEditMode }"
                          @click="togglePermissionRoleEditMode"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="business-permissions__controls">
                    <div class="business-permissions__control-grid">
                      <label class="business-permissions__field business-permissions__field--stacked">
                        <span>{{ isPermissionRoleEditMode ? 'Search Existing Role' : 'Create New Role' }}</span>
                        <div class="business-permissions__inline-action business-permissions__inline-action--compact">
                          <template v-if="isPermissionRoleEditMode">
                            <input
                              :value="permissionRoleLookupValue"
                              list="business-permissions-role-options"
                              type="text"
                              placeholder="Search or select an existing role"
                              @input="handlePermissionRoleLookupInput"
                              @change="applyPermissionRoleLookupSelection"
                              @keydown.enter.prevent="applyPermissionRoleLookupSelection"
                            />
                            <datalist id="business-permissions-role-options">
                              <option
                                v-for="role in permissionRoles"
                                :key="role.id"
                                :value="role.name"
                              />
                            </datalist>
                            <button
                              type="button"
                              class="business-permissions__danger business-permissions__action-delete"
                              :disabled="!canEditBusinessModule('permissions') || !selectedPermissionRole"
                              @click="removeSelectedPermissionRole"
                            >
                              Delete Role
                            </button>
                          </template>
                          <template v-else>
                            <input
                              v-model="permissionRoleDraftName"
                              type="text"
                              placeholder="e.g. Recruitment Lead"
                              :disabled="!canEditBusinessModule('permissions')"
                              @keydown.enter.prevent="createPermissionRole"
                            />
                            <button
                              type="button"
                              class="business-permissions__inline-button"
                              :disabled="!canEditBusinessModule('permissions') || !String(permissionRoleDraftName || '').trim()"
                              @click="createPermissionRole"
                            >
                              Create Role
                            </button>
                          </template>
                          <button
                            type="button"
                            class="business-permissions__primary business-permissions__action-save"
                            :class="{ 'is-saved': !permissionRolesHasUnsavedChanges && !isSavingPermissionRoles }"
                            :disabled="!canEditBusinessModule('permissions') || !permissionRolesHasUnsavedChanges || isSavingPermissionRoles"
                            @click="savePermissionRoles"
                          >
                            {{ isSavingPermissionRoles ? 'Saving...' : permissionRolesHasUnsavedChanges ? 'Save Permissions' : 'Saved' }}
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>

                  <p class="business-permissions__intro-copy">
                    {{ isPermissionRoleEditMode
                      ? 'Select an existing role, then use the access matrix below to update which modules appear in the sidebar and what that role can do.'
                      : 'Create a role first, then use the access matrix below to assign which modules appear in the sidebar and what that role can do.' }}
                  </p>

                  <div v-if="selectedPermissionRole" class="business-permissions__table-wrap business-permissions__table-wrap--matrix">
                    <table class="business-permissions__table business-permissions__table--matrix">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Module</th>
                          <th>View</th>
                          <th>Edit</th>
                          <th>Full Access</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <template v-for="section in permissionModuleSections" :key="section.id">
                          <tr
                            v-for="module in getPermissionModulesForSection(section.id)"
                            :key="module.id"
                            class="business-permissions__table-row"
                            :class="{ 'is-muted': !module.permissions.view }"
                          >
                            <td>
                              <span class="business-permissions__section-chip">
                                <i :class="section.icon" aria-hidden="true" />
                                {{ section.label }}
                              </span>
                            </td>
                            <td>
                              <div class="business-permissions__module-copy">
                                <strong>{{ module.label }}</strong>
                                <p>{{ module.description }}</p>
                              </div>
                            </td>
                            <td>
                              <label class="business-permissions__switch" :aria-label="`Toggle view access for ${module.label}`">
                                <input
                                  type="checkbox"
                                  class="business-permissions__switch-input"
                                  :checked="module.permissions.view"
                                  :disabled="!canEditBusinessModule('permissions')"
                                  @change="updatePermissionModuleAction(module.id, 'view', $event.target.checked)"
                                />
                                <span class="business-permissions__switch-track" aria-hidden="true">
                                  <span class="business-permissions__switch-thumb" />
                                </span>
                              </label>
                            </td>
                            <td>
                              <label class="business-permissions__switch" :aria-label="`Toggle edit access for ${module.label}`">
                                <input
                                  type="checkbox"
                                  class="business-permissions__switch-input"
                                  :checked="module.permissions.edit"
                                  :disabled="!canEditBusinessModule('permissions')"
                                  @change="updatePermissionModuleAction(module.id, 'edit', $event.target.checked)"
                                />
                                <span class="business-permissions__switch-track" aria-hidden="true">
                                  <span class="business-permissions__switch-thumb" />
                                </span>
                              </label>
                            </td>
                            <td>
                              <label class="business-permissions__switch" :aria-label="`Toggle full access for ${module.label}`">
                                <input
                                  type="checkbox"
                                  class="business-permissions__switch-input"
                                  :checked="isPermissionModuleFullAccess(module)"
                                  :disabled="!canEditBusinessModule('permissions')"
                                  @change="updatePermissionModuleFullAccess(module.id, $event.target.checked)"
                                />
                                <span class="business-permissions__switch-track" aria-hidden="true">
                                  <span class="business-permissions__switch-thumb" />
                                </span>
                              </label>
                            </td>
                            <td>
                              <span
                                class="business-permissions__status-pill"
                                :class="{
                                  'is-hidden': !module.permissions.view,
                                  'is-full': isPermissionModuleFullAccess(module),
                                }"
                              >
                                {{ formatPermissionAccessLabel(module) }}
                              </span>
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section v-else-if="activeSection === 'assessment-management'" class="business-assessment-management">
              <div class="business-assessment-management__tabs" role="tablist" aria-label="Assessment management views">
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': assessmentManagementTab === 'builder' }"
                  @click="assessmentManagementTab = 'builder'"
                >
                  Create Template
                </button>
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': assessmentManagementTab === 'assignments' }"
                  @click="assessmentManagementTab = 'assignments'"
                >
                  Assign Assessment
                </button>
              </div>

              <div v-if="assessmentManagementTab === 'builder'" class="business-template-builder">
                <div class="business-template-builder__editor">
                <fieldset class="business-template-builder__fieldset" :disabled="!canEditBusinessModule('assessment-management')">
                  <div class="business-assessment-builder__bar">
                    <label class="business-template-builder__select-wrap business-assessment-builder__picker">
                      <span>{{ editingAssessmentTemplateId ? 'Editing Template' : 'Open Template' }}</span>
                      <select :value="editingAssessmentTemplateId" @change="handleAssessmentTemplateSelection($event.target.value)">
                        <option value="">New template</option>
                        <option v-for="template in assessmentTemplateLibrary" :key="template.id" :value="template.id">
                          {{ template.title || 'Untitled template' }} | {{ template.questions.length }} questions
                        </option>
                      </select>
                    </label>
                    <div class="business-assessment-builder__bar-status">
                      <div class="business-assessment-builder__status-card">
                        <strong>{{ assessmentTemplateLibrary.length }}</strong>
                        <span>Saved</span>
                      </div>
                    </div>
                    <div class="business-template-builder__hero-actions">
                      <button
                        type="button"
                        class="business-template-builder__publish business-template-builder__publish--secondary"
                        @click="startNewAssessmentTemplate"
                      >
                        New
                      </button>
                      <button
                        v-if="editingAssessmentTemplateId"
                        type="button"
                        class="business-template-builder__publish business-template-builder__publish--danger"
                        @click="deleteAssessmentTemplate"
                      >
                        Delete
                      </button>
                      <button type="button" class="business-template-builder__publish" @click="saveAssessmentTemplate">
                        {{ editingAssessmentTemplateId ? 'Update' : 'Save' }}
                      </button>
                    </div>
                  </div>
                  <p v-if="editingAssessmentTemplateId" class="business-assessment-builder__bar-note">
                    Deleting removes the selected saved template from the library only.
                  </p>

                  <article class="business-template-builder__card business-assessment-builder__workspace">
                    <div class="business-template-builder__field-grid">
                      <label class="business-template-builder__field">
                        <span>Template Title</span>
                        <input v-model="assessmentTemplateDraft.title" type="text" placeholder="Frontend developer technical screen" />
                      </label>

                      <label class="business-template-builder__field">
                        <span>Passing Score (%)</span>
                        <input
                          v-model.number="assessmentTemplateDraft.passingScorePercent"
                          type="number"
                          min="1"
                          max="100"
                          placeholder="70"
                        />
                      </label>
                    </div>

                    <label class="business-template-builder__field">
                      <span>Description</span>
                      <textarea
                        v-model="assessmentTemplateDraft.description"
                        rows="3"
                        placeholder="Explain what this technical assessment measures and when it should be sent."
                      />
                    </label>

                    <label class="business-template-builder__field">
                      <span>Instructions for Candidates</span>
                      <textarea
                        v-model="assessmentTemplateDraft.instructions"
                        rows="4"
                        placeholder="Add directions, scoring reminders, allowed tools, or submission rules for the candidate."
                      />
                    </label>

                    <div class="business-assessment-builder__toolbar">
                      <label class="business-template-builder__select-wrap">
                        <span>Question type</span>
                        <select v-model="selectedAssessmentQuestionType">
                          <option v-for="type in trainingQuestionTypeOptions" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </label>
                      <button type="button" class="business-template-builder__add" @click="addAssessmentTemplateQuestion">
                        <i class="bi bi-plus-lg" aria-hidden="true" />
                        Add question
                      </button>
                    </div>

                    <TransitionGroup name="business-template-question" tag="div" class="business-template-builder__questions">
                      <article
                        v-for="(question, index) in assessmentTemplateDraft.questions"
                        :key="question.id"
                        class="business-template-builder__card business-template-builder__question"
                      >
                        <div class="business-template-builder__question-top">
                          <div class="business-template-builder__question-meta">
                            <span class="business-template-builder__question-order">Question {{ index + 1 }}</span>
                            <span class="business-template-builder__question-type">
                              <i :class="resolveTrainingQuestionTypeMeta(question.type).icon" aria-hidden="true" />
                              {{ resolveTrainingQuestionTypeMeta(question.type).label }}
                            </span>
                          </div>
                          <button type="button" class="business-template-builder__remove" @click="removeAssessmentTemplateQuestion(question.id)">
                            Remove
                          </button>
                        </div>

                        <label class="business-template-builder__field">
                          <span>Question</span>
                          <input v-model="question.label" type="text" placeholder="Enter question title" />
                        </label>

                        <label class="business-template-builder__field">
                          <span>Helper text</span>
                          <input v-model="question.helpText" type="text" placeholder="Optional helper copy" />
                        </label>

                        <div
                          v-if="question.type === 'multiple-choice' || question.type === 'checkboxes'"
                          class="business-template-builder__options"
                        >
                          <div class="business-template-builder__option-actions">
                            <span>Answer options</span>
                            <button type="button" class="business-template-builder__option-add" @click="addAssessmentTemplateOption(question.id)">
                              Add option
                            </button>
                          </div>
                          <div
                            v-for="(option, optionIndex) in question.options"
                            :key="`${question.id}-option-${optionIndex}`"
                            class="business-template-builder__option-row"
                          >
                            <label
                              v-if="question.type === 'multiple-choice'"
                              class="business-template-builder__answer-marker"
                              :aria-label="`Mark option ${optionIndex + 1} as the correct answer`"
                            >
                              <input
                                type="radio"
                                :name="`${question.id}-correct-answer`"
                                :checked="question.correctOptionIndex === optionIndex"
                                @change="setAssessmentTemplateCorrectOption(question.id, optionIndex)"
                              />
                            </label>
                            <i v-else class="bi bi-square" aria-hidden="true" />
                            <input v-model="question.options[optionIndex]" type="text" :placeholder="`Option ${optionIndex + 1}`" />
                            <button
                              type="button"
                              class="business-template-builder__option-remove"
                              @click="removeAssessmentTemplateOption(question.id, optionIndex)"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div v-else-if="question.type === 'rating'" class="business-template-builder__scale">
                          <span>Scale preview</span>
                          <div class="business-template-builder__scale-points">
                            <span v-for="point in question.options" :key="`${question.id}-${point}`">{{ point }}</span>
                          </div>
                        </div>

                        <label class="business-template-builder__toggle">
                          <input v-model="question.required" type="checkbox" />
                          <span>Required question</span>
                        </label>
                      </article>
                    </TransitionGroup>
                  </article>
                </fieldset>
              </div>

              <aside class="business-template-preview">
                <div class="business-template-preview__shell">
                  <div class="business-template-preview__topbar">
                    <span class="business-template-preview__badge">Live Preview</span>
                    <strong>Assessment Preview</strong>
                  </div>
                  <article class="business-template-preview__form">
                    <div class="business-template-preview__header">
                      <h3 :class="{ 'business-template-preview__placeholder': !assessmentTemplateDraft.title }">
                        {{ assessmentTemplateDraft.title || 'Untitled assessment template' }}
                      </h3>
                      <p :class="{ 'business-template-preview__placeholder': !assessmentTemplateDraft.description }">
                        {{ assessmentTemplateDraft.description || 'Add a short description so candidates know what this technical assessment covers.' }}
                      </p>
                      <p
                        class="business-assessment-builder__preview-note"
                        :class="{ 'business-template-preview__placeholder': !assessmentTemplateDraft.instructions }"
                      >
                        {{ assessmentTemplateDraft.instructions || 'Add assessment instructions so candidates know how to answer or what tools they can use.' }}
                      </p>
                      <p class="business-assessment-builder__preview-note">
                        Pass mark: {{ normalizeAssessmentPassingScorePercent(assessmentTemplateDraft.passingScorePercent, 70) }}%
                      </p>
                    </div>

                    <article
                      v-for="(question, index) in assessmentTemplateDraft.questions"
                      :key="`${question.id}-preview`"
                      class="business-template-preview__question"
                    >
                      <div class="business-template-preview__question-head">
                        <span>Question {{ index + 1 }}</span>
                        <small v-if="question.required">Required</small>
                      </div>
                      <strong :class="{ 'business-template-preview__placeholder': !question.label }">
                        {{ question.label || 'Untitled question' }}
                      </strong>
                      <p
                        v-if="question.helpText || !['multiple-choice', 'checkboxes', 'rating'].includes(question.type)"
                        :class="{ 'business-template-preview__placeholder': !question.helpText }"
                      >
                        {{ question.helpText || 'Optional helper text appears here.' }}
                      </p>

                      <input
                        v-if="question.type === 'short-text'"
                        type="text"
                        placeholder="Short answer text"
                        readonly
                      />
                      <textarea
                        v-else-if="question.type === 'paragraph'"
                        rows="4"
                        placeholder="Long answer text"
                        readonly
                      />
                      <div
                        v-else-if="question.type === 'multiple-choice' || question.type === 'checkboxes'"
                        class="business-template-preview__choices"
                      >
                        <label
                          v-for="(option, optionIndex) in question.options"
                          :key="`${question.id}-choice-${optionIndex}`"
                          class="business-template-preview__choice"
                        >
                          <input
                            :type="question.type === 'multiple-choice' ? 'radio' : 'checkbox'"
                            :name="question.id"
                            :checked="question.type === 'multiple-choice' && question.correctOptionIndex === optionIndex"
                            disabled
                          />
                          <span :class="{ 'business-template-preview__placeholder': !option }">
                            {{ option || `Option ${optionIndex + 1}` }}
                          </span>
                        </label>
                      </div>
                      <div v-else-if="question.type === 'rating'" class="business-template-preview__rating">
                        <button v-for="point in question.options" :key="`${question.id}-rating-${point}`" type="button" disabled>
                          {{ point }}
                        </button>
                      </div>
                    </article>

                    <div class="business-template-preview__footer">
                      <button type="button" disabled>Start Assessment</button>
                    </div>
                  </article>
                </div>
              </aside>
              </div>

              <div v-else class="business-assign-templates">
                <div class="business-assign-templates__header">
                  <div>
                    <p class="business-assign-templates__eyebrow">Assessment Assignment</p>
                    <h2>Assign assessment templates to approved applicants</h2>
                    <p>Use the approved applicants table below to choose which assessment template each applicant should receive.</p>
                  </div>
                  <div class="business-assign-templates__summary">
                    <span>{{ approvedApplicantTemplateAssignments.length }} approved applicants</span>
                    <span>{{ assignedApplicantTemplateRows.length }} templates assigned</span>
                  </div>
                </div>

                <div class="business-assign-templates__tabs">
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': assessmentAssignmentTab === 'approved-applicants' }"
                    @click="assessmentAssignmentTab = 'approved-applicants'"
                  >
                    Approved Applicants
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': assessmentAssignmentTab === 'assigned-templates' }"
                    @click="assessmentAssignmentTab = 'assigned-templates'"
                  >
                    Assigned Templates
                  </button>
                </div>

                <article v-if="assessmentAssignmentTab === 'approved-applicants'" class="business-assign-templates__panel">
                  <div class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Applied Role</th>
                          <th>Approved</th>
                          <th>Score</th>
                          <th>Template</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="applicant in approvedApplicantTemplateAssignments" :key="applicant.id">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ applicant.name }}</strong>
                              <span>{{ applicant.email }}</span>
                            </div>
                          </td>
                          <td>{{ applicant.role }}</td>
                          <td>{{ applicant.approvalDate }}</td>
                          <td>{{ applicant.score }}</td>
                          <td>
                            <select
                              v-model="applicant.selectedTemplateId"
                              class="business-assign-templates__select"
                              :disabled="!canEditBusinessModule('assessment-management')"
                              @change="handleAssessmentAssignmentTemplateSelection(applicant.id, applicant.selectedTemplateId)"
                            >
                              <option value="">Select template</option>
                              <option v-for="template in assignableAssessmentTemplates" :key="template.id" :value="template.id">
                                {{ template.title }}
                              </option>
                            </select>
                          </td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="{ 'is-assigned': applicant.assignmentStatus === 'Assigned' }"
                            >
                              {{ applicant.assignmentStatus }}
                            </span>
                          </td>
                          <td>
                            <div class="business-assign-templates__actions">
                              <button
                                type="button"
                                class="business-assign-templates__action"
                                :disabled="!canEditBusinessModule('assessment-management')"
                                @click="assignAssessmentTemplateToApplicant(applicant.id)"
                              >
                                {{ applicant.assignmentStatus === 'Assigned' ? 'Update' : 'Assign' }}
                              </button>
                              <button
                                v-if="canRemoveAssignedAssessment(applicant)"
                                type="button"
                                class="business-assign-templates__action business-assign-templates__action--danger"
                                :disabled="!canEditBusinessModule('assessment-management')"
                                @click="removeAssignedAssessmentFromApplicant(applicant.id)"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>

                <article v-else class="business-assign-templates__panel">
                  <div v-if="assignedApplicantTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Applied Role</th>
                          <th>Assigned Template</th>
                          <th>Assigned Date</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="applicant in assignedApplicantTemplateRows" :key="`${applicant.id}-assigned`">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ applicant.name }}</strong>
                              <span>{{ applicant.email }}</span>
                            </div>
                          </td>
                          <td>{{ applicant.role }}</td>
                          <td>{{ getAssignableTemplateLabel(applicant.selectedTemplateId, applicant.templateTitle) }}</td>
                          <td>{{ applicant.assignedAt || 'Not set' }}</td>
                          <td>
                            <span class="business-assign-templates__status is-assigned">{{ applicant.assignmentStatus }}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              class="business-assign-templates__action business-assign-templates__action--danger"
                              :disabled="!canEditBusinessModule('assessment-management')"
                              @click="removeAssignedAssessmentFromApplicant(applicant.id)"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No templates assigned yet</strong>
                    <p>Pick a template from the approved applicants tab and assign it to see the queue here.</p>
                  </div>
                </article>
              </div>
            </section>

            <section v-else-if="activeSection === 'interview-scheduling'" class="business-interview-scheduling">
              <div class="business-interview-scheduling__header">
                <div class="business-interview-scheduling__header-copy">
                  <span class="business-interview-scheduling__kicker">HR Recruitment Flow</span>
                  <h2>Interview Scheduling</h2>
                  <p>Create interview schedules, then review each applicant's progress in the Interview Status tab.</p>
                </div>
                <div class="business-interview-scheduling__header-actions">
                  <div class="business-interview-scheduling__stat-strip" aria-label="Interview schedule stats">
                    <span>{{ businessInterviewScheduleStats.total }} total</span>
                    <span>{{ businessInterviewScheduleStats.scheduled }} scheduled</span>
                    <span>{{ businessInterviewScheduleStats.completed }} completed</span>
                  </div>
                  <button
                    type="button"
                    class="business-interview-scheduling__refresh"
                    :disabled="isBusinessInterviewRefreshing"
                    @click="refreshBusinessInterviewApplicants"
                  >
                    {{ isBusinessInterviewRefreshing ? 'Refreshing...' : 'Refresh Applicants' }}
                  </button>
                </div>
              </div>

              <div class="business-assessment-management__tabs" role="tablist" aria-label="Interview scheduling views">
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': interviewSchedulingTab === 'schedule' }"
                  @click="interviewSchedulingTab = 'schedule'"
                >
                  Create Schedule
                </button>
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': interviewSchedulingTab === 'status' }"
                  @click="interviewSchedulingTab = 'status'"
                >
                  Interview Status
                </button>
              </div>

              <div v-if="interviewSchedulingTab === 'schedule'" class="business-interview-scheduling__layout">
                <div class="business-interview-scheduling__main">
                  <section class="business-interview-scheduling__card">
                    <div class="business-interview-scheduling__card-head">
                      <div>
                        <span class="business-interview-scheduling__card-kicker">New Schedule</span>
                        <h3>Create Interview Schedule</h3>
                        <p>Interview approvals, applicant replies, and final results can be connected in the status workspace next.</p>
                      </div>
                    </div>

                    <p v-if="businessInterviewSchedulingFormError" class="business-interview-scheduling__error">
                      {{ businessInterviewSchedulingFormError }}
                    </p>

                    <fieldset class="business-interview-scheduling__fieldset" :disabled="!canEditBusinessModule('interview-scheduling')">
                      <form class="business-interview-scheduling__form-grid" @submit.prevent="createBusinessInterviewSchedule">
                        <label class="business-interview-scheduling__field">
                          <span>Job Title</span>
                          <select v-model="businessInterviewSchedulingForm.selectedJobKey" required>
                            <option value="" disabled>Select job title</option>
                            <option v-for="job in businessInterviewAcceptedJobOptions" :key="job.key" :value="job.key">
                              {{ job.title }}
                            </option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Accepted Applicant</span>
                          <select
                            v-model="businessInterviewSchedulingForm.applicationId"
                            :disabled="!businessInterviewSchedulingForm.selectedJobKey"
                            required
                          >
                            <option value="" disabled>
                              {{ businessInterviewSchedulingForm.selectedJobKey ? 'Select accepted applicant' : 'Select job title first' }}
                            </option>
                            <option v-for="applicant in businessInterviewFilteredApplicants" :key="applicant.id" :value="applicant.id">
                              {{ applicant.applicantName }}
                            </option>
                          </select>
                        </label>

                        <p
                          v-if="businessInterviewSchedulingForm.selectedJobKey && businessInterviewTechnicalGateHint"
                          class="business-interview-scheduling__field-hint is-warning"
                        >
                          {{ businessInterviewTechnicalGateHint }}
                        </p>

                        <label class="business-interview-scheduling__field">
                          <span>Interview Type</span>
                          <select
                            v-model="businessInterviewSchedulingForm.interviewType"
                            :disabled="!businessInterviewSchedulingForm.applicationId"
                            required
                          >
                            <option
                              v-for="option in businessInterviewAvailableInterviewTypeOptions"
                              :key="option.value"
                              :value="option.value"
                            >
                              {{ option.label }}
                            </option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Schedule Date &amp; Time</span>
                          <input
                            v-model="businessInterviewSchedulingForm.scheduledAt"
                            type="datetime-local"
                            :min="businessInterviewMinScheduleDateTime"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Mode</span>
                          <select v-model="businessInterviewSchedulingForm.mode" required>
                            <option value="in-person">In-person</option>
                            <option value="online">Online</option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>{{ businessInterviewSchedulingForm.mode === 'online' ? 'Meeting Link' : 'Location' }}</span>
                          <input
                            v-model="businessInterviewSchedulingForm.locationOrLink"
                            type="text"
                            :placeholder="businessInterviewSchedulingForm.mode === 'online' ? 'https://meet...' : 'Office / room'"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Interviewer</span>
                          <input
                            v-model="businessInterviewSchedulingForm.interviewer"
                            type="text"
                            placeholder="Enter interviewer name"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field business-interview-scheduling__field--full">
                          <span>Notes (Optional)</span>
                          <textarea
                            v-model="businessInterviewSchedulingForm.notes"
                            rows="3"
                            placeholder="Add interview instructions"
                          />
                        </label>

                        <div class="business-interview-scheduling__actions">
                          <button type="submit" class="business-interview-scheduling__submit">
                            Create Schedule
                          </button>
                          <button type="button" class="business-interview-scheduling__reset" @click="resetBusinessInterviewSchedulingForm">
                            Reset
                          </button>
                        </div>
                      </form>
                    </fieldset>
                  </section>
                </div>

                <aside class="business-interview-scheduling__card business-interview-scheduling__card--calendar">
                  <div class="business-interview-scheduling__calendar-head">
                    <h3>Schedule Calendar</h3>
                    <div class="business-interview-scheduling__calendar-nav">
                      <button type="button" @click="shiftBusinessInterviewCalendarMonth(-1)">&#8249;</button>
                      <strong>{{ businessInterviewCalendarMonthLabel }}</strong>
                      <button type="button" @click="shiftBusinessInterviewCalendarMonth(1)">&#8250;</button>
                    </div>
                  </div>

                  <div class="business-interview-scheduling__calendar-grid business-interview-scheduling__calendar-grid--week">
                    <span v-for="day in businessInterviewWeekdayLabels" :key="day">{{ day }}</span>
                  </div>

                  <div class="business-interview-scheduling__calendar-grid business-interview-scheduling__calendar-grid--days">
                    <button
                      v-for="day in businessInterviewCalendarDays"
                      :key="day.key"
                      type="button"
                      class="business-interview-scheduling__day-cell"
                      :class="{
                        'is-muted': !day.isCurrentMonth,
                        'is-today': day.isToday,
                        'is-selected': day.isSelected,
                        'is-busy': day.scheduleCount > 0,
                        'is-past': day.isPastDate,
                      }"
                      :disabled="day.isPastDate"
                      @click="selectBusinessInterviewCalendarDay(day)"
                    >
                      <span class="business-interview-scheduling__day-number">{{ day.label }}</span>
                      <small v-if="day.scheduleCount > 0">{{ day.scheduleCount }}</small>
                    </button>
                  </div>

                  <p class="business-interview-scheduling__calendar-caption">
                    Scheduled interviews are marked with a badge. Click a date to set it in the schedule field.
                  </p>

                  <div class="business-interview-scheduling__day-list">
                    <h4>{{ businessInterviewSelectedCalendarLabel }}</h4>
                    <ul v-if="businessInterviewSelectedDaySchedules.length">
                      <li v-for="item in businessInterviewSelectedDaySchedules" :key="item.id">
                        <strong>{{ formatBusinessInterviewTime(item.scheduledAt) }}</strong>
                        <span>{{ item.applicantName }}</span>
                      </li>
                    </ul>
                    <p v-else class="business-interview-scheduling__day-empty">No scheduled interviews for this day.</p>
                  </div>
                </aside>
              </div>

              <div v-else class="business-interview-status">
                <div class="business-interview-scheduling__stat-strip" aria-label="Interview status summary">
                  <span>{{ businessInterviewStatusSummary.total }} applicants</span>
                  <span>{{ businessInterviewStatusSummary.ready }} ready to schedule</span>
                  <span>{{ businessInterviewStatusSummary.scheduled }} scheduled</span>
                  <span>{{ businessInterviewStatusSummary.completed }} completed</span>
                </div>

                <section class="business-interview-scheduling__card business-interview-status__panel">
                  <div class="business-interview-scheduling__card-head">
                    <div>
                      <span class="business-interview-scheduling__card-kicker">Interview Status</span>
                      <h3>Applicant interview tracker</h3>
                      <p>Live applicant confirmations and reschedule requests will appear here as soon as they are submitted.</p>
                    </div>
                  </div>

                  <div v-if="businessInterviewStatusRows.length" class="business-user-management__table-wrap">
                    <table class="business-user-management__table business-interview-status__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Current Stage</th>
                          <th>Schedule</th>
                          <th>Interviewer</th>
                          <th>Status</th>
                          <th>Request Details</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in businessInterviewStatusRows" :key="`${row.id}-status`">
                          <td>
                            <div class="business-interview-status__applicant">
                              <strong>{{ row.applicantName }}</strong>
                              <span>{{ row.applicantEmail }}</span>
                              <small>{{ row.applicantId }}</small>
                            </div>
                          </td>
                          <td>{{ row.jobTitle }}</td>
                          <td>
                            <div class="business-interview-status__stage">
                              <strong>{{ row.currentStage }}</strong>
                              <span>{{ row.stageDetail }}</span>
                            </div>
                          </td>
                          <td>{{ row.scheduleLabel }}</td>
                          <td>{{ row.interviewer }}</td>
                          <td>
                            <span
                              class="business-interview-status__badge"
                              :class="resolveBusinessInterviewStatusBadgeClass(row.statusTone)"
                            >
                              {{ row.statusLabel }}
                            </span>
                          </td>
                          <td>
                            <div class="business-interview-status__detail">
                              {{ row.requestDetail }}
                            </div>
                          </td>
                          <td>
                            <button
                              v-if="row.canReviewRequest"
                              type="button"
                              class="business-interview-status__action"
                              @click="openBusinessInterviewRequestReview(row.scheduleId)"
                            >
                              Review Request
                            </button>
                            <button
                              v-else-if="row.canMarkCompleted"
                              type="button"
                              class="business-interview-status__action"
                              @click="completeBusinessInterviewSchedule(row.scheduleId)"
                            >
                              Mark Completed
                            </button>
                            <span v-else class="business-interview-status__detail business-interview-status__detail--muted">No action</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div v-else class="business-interview-status__empty">
                    <strong>No interview status rows yet</strong>
                    <p>Add mock applicants or create interview schedules to populate this table.</p>
                  </div>
                </section>
              </div>
            </section>

            <section
              v-else-if="activeSection === 'applicant-score'"
              class="business-applicant-score"
            >
              <article class="business-user-management__panel business-user-management__panel--form">
                <div class="business-user-management__panel-head">
                  <div>
                    <p class="business-user-management__panel-label">Applicant Score</p>
                    <h3>Assessment scores and shortlisted applicant results</h3>
                  </div>
                  <span class="business-user-management__panel-chip">{{ applicantScoreRows.length }} realtime rows</span>
                </div>

                <div class="business-applicant-score__toolbar">
                  <label class="business-applicant-score__field business-applicant-score__field--search">
                    <span>Search</span>
                    <input
                      v-model.trim="applicantScoreSearch"
                      type="text"
                      placeholder="Search by applicant, role, template, or score..."
                    />
                  </label>

                  <label class="business-applicant-score__field">
                    <span>Role</span>
                    <select v-model="applicantScoreRoleFilter">
                      <option v-for="option in applicantScoreRoleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <label class="business-applicant-score__field">
                    <span>Status</span>
                    <select v-model="applicantScoreStatusFilter">
                      <option value="all">All</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="submitted">Submitted</option>
                      <option value="assigned">Assigned</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    class="business-user-management__action-btn business-user-management__action-btn--primary"
                    @click="activeSection = 'assessment-management'; assessmentManagementTab = 'assignments'"
                  >
                    <i class="bi bi-ui-checks-grid" aria-hidden="true" />
                    Assign Assessment
                  </button>

                  <div class="business-applicant-score__summary">
                    {{ applicantScoreSummary }}
                  </div>
                </div>

                <div class="business-applicant-score__table-shell">
                  <div class="business-applicant-score__table">
                    <div class="business-applicant-score__head">
                      <span>#</span>
                      <span>Applicant</span>
                      <span>Applied Role</span>
                      <span>Score</span>
                      <span>Template</span>
                      <span>Status</span>
                      <span>Approved</span>
                    </div>

                    <div v-if="filteredApplicantScoreRows.length" class="business-applicant-score__body">
                      <article
                        v-for="row in filteredApplicantScoreRows"
                        :key="row.id"
                        class="business-applicant-score__row"
                      >
                        <div>{{ row.rowNumber }}</div>

                        <div class="business-applicant-score__account">
                          <div class="business-applicant-score__avatar">
                            {{ row.initials }}
                          </div>

                          <div class="business-applicant-score__meta">
                            <strong>{{ row.name }}</strong>
                            <span>{{ row.email }}</span>
                          </div>
                        </div>

                        <div class="business-applicant-score__role">
                          <strong>{{ row.role }}</strong>
                          <span>{{ row.technicalLabel }}</span>
                        </div>

                        <div>
                          <span class="business-applicant-score__score-pill" :class="`is-${row.scoreTone}`">{{ row.scoreLabel }}</span>
                        </div>

                        <div class="business-applicant-score__template">
                          <strong>{{ row.templateTitle }}</strong>
                          <span>{{ row.templateDetail }}</span>
                        </div>

                        <div>
                          <span class="business-applicant-score__status" :class="`is-${row.status.replace(/\s+/g, '-')}`">{{ row.statusLabel }}</span>
                        </div>

                        <div>{{ row.approvalDate || 'Not set' }}</div>
                      </article>
                    </div>
                  </div>
                </div>

                <div v-if="!filteredApplicantScoreRows.length" class="business-applicant-score__empty">
                  No applicant scores match the current filter.
                </div>
              </article>
            </section>

            <section v-else-if="activeSection === 'training-templates'" class="business-assessment-management business-training-management">
              <div class="business-assessment-management__tabs" role="tablist" aria-label="Training template views">
                <button
                  v-if="canViewTrainingTemplateBuilder"
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': trainingTemplatesTab === 'builder' }"
                  @click="setTrainingTemplatesTab('builder')"
                >
                  Create Template
                </button>
                <button
                  v-if="canViewTrainingAssignments"
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': trainingTemplatesTab === 'assignments' }"
                  @click="setTrainingTemplatesTab('assignments')"
                >
                  Assign Templates
                </button>
              </div>

              <div v-if="trainingTemplatesTab === 'builder' && canViewTrainingTemplateBuilder" class="business-template-builder">
                <div class="business-template-builder__editor">
                  <fieldset class="business-template-builder__fieldset" :disabled="!canEditBusinessModule('training-templates')">
                    <div class="business-assessment-builder__bar">
                      <label class="business-template-builder__select-wrap business-assessment-builder__picker">
                        <span>{{ editingTrainingTemplateId ? 'Editing Template' : 'Open Template' }}</span>
                        <select :value="editingTrainingTemplateId" @change="handleTrainingTemplateSelection($event.target.value)">
                          <option value="">New template</option>
                          <option v-for="template in trainingTemplateLibrary" :key="template.id" :value="template.id">
                            {{ template.title || 'Untitled template' }} | {{ countTrainingTemplateCategories(template) }} categories | {{ countTrainingTemplateSkills(template) }} skills
                          </option>
                        </select>
                      </label>
                      <div class="business-assessment-builder__bar-status">
                        <div class="business-assessment-builder__status-card">
                          <strong>{{ trainingTemplateLibrary.length }}</strong>
                          <span>Saved</span>
                        </div>
                      </div>
                      <div class="business-template-builder__hero-actions">
                        <button
                          type="button"
                          class="business-template-builder__publish business-template-builder__publish--secondary"
                          @click="startNewTrainingTemplate"
                        >
                          New
                        </button>
                        <button
                          v-if="editingTrainingTemplateId"
                          type="button"
                          class="business-template-builder__publish business-template-builder__publish--danger"
                          @click="deleteTrainingTemplate"
                        >
                          Delete
                        </button>
                        <button type="button" class="business-template-builder__publish" @click="saveTrainingTemplate">
                          {{ editingTrainingTemplateId ? 'Update' : 'Save' }}
                        </button>
                      </div>
                    </div>
                    <p v-if="editingTrainingTemplateId" class="business-assessment-builder__bar-note">
                      Deleting removes the selected saved template from the library only.
                    </p>

                    <div class="business-template-builder__hero">
                      <div>
                        <p class="business-template-builder__eyebrow">Training Builder</p>
                        <h2>Build reusable training templates in one workspace</h2>
                        <p>Organize each template by training category, then list the skills your team member should learn under every category.</p>
                      </div>
                    </div>

                    <article class="business-template-builder__card business-template-builder__card--header">
                      <label class="business-template-builder__field">
                        <span>Template Title</span>
                        <input v-model="trainingTemplateDraft.title" type="text" placeholder="New hire onboarding checklist" />
                      </label>
                      <label class="business-template-builder__field">
                        <span>Description</span>
                        <textarea v-model="trainingTemplateDraft.description" rows="3" placeholder="Describe what this training template covers." />
                      </label>
                    </article>

                    <article class="business-template-builder__card business-template-builder__toolbar">
                      <div class="business-template-builder__toolbar-copy">
                        <strong>Build The Training Flow</strong>
                        <span>Add training categories, then customize the skills inside each one.</span>
                      </div>
                      <div class="business-template-builder__toolbar-actions">
                        <button type="button" class="business-template-builder__add" @click="addTrainingTemplateCategory">
                          <i class="bi bi-plus-lg" aria-hidden="true" />
                          Add category
                        </button>
                      </div>
                    </article>

                    <TransitionGroup name="business-template-question" tag="div" class="business-template-builder__questions">
                      <article
                        v-for="(category, index) in trainingTemplateDraft.categories"
                        :key="category.id"
                        class="business-template-builder__card business-template-builder__question"
                      >
                        <div class="business-template-builder__question-top">
                          <div class="business-template-builder__question-meta">
                            <span class="business-template-builder__question-order">Category {{ index + 1 }}</span>
                            <span class="business-template-builder__question-type">
                              <i class="bi bi-diagram-3" aria-hidden="true" />
                              {{ category.skills.length }} skill{{ category.skills.length === 1 ? '' : 's' }}
                            </span>
                          </div>
                          <button type="button" class="business-template-builder__remove" @click="removeTrainingTemplateCategory(category.id)">
                            Remove
                          </button>
                        </div>

                        <label class="business-template-builder__field">
                          <span>Training Category</span>
                          <input v-model="category.title" type="text" placeholder="Communication Foundations" />
                        </label>

                        <div class="business-template-builder__options">
                          <div class="business-template-builder__option-actions">
                            <span>Skills</span>
                            <button type="button" class="business-template-builder__option-add" @click="addTrainingTemplateSkill(category.id)">
                              <i class="bi bi-plus-lg" aria-hidden="true" />
                              Add skill
                            </button>
                          </div>

                          <div class="business-template-builder__skill-list">
                            <div
                              v-for="skill in category.skills"
                              :key="skill.id"
                              class="business-template-builder__skill-item"
                            >
                              <div class="business-template-builder__option-row business-template-builder__option-row--skill">
                                <input v-model="skill.name" type="text" placeholder="Skill name" />
                                <button type="button" class="business-template-builder__option-remove" @click="removeTrainingTemplateSkill(category.id, skill.id)">
                                  Remove
                                </button>
                              </div>
                              <input
                                v-model="skill.description"
                                class="business-template-builder__skill-detail-input"
                                type="text"
                                placeholder="Skill details or short note"
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    </TransitionGroup>
                  </fieldset>
                </div>

                <aside class="business-template-preview">
                  <div class="business-template-preview__shell">
                    <div class="business-template-preview__topbar">
                      <span class="business-template-preview__badge">Live Preview</span>
                      <strong>Training Preview</strong>
                    </div>
                    <article class="business-template-preview__form">
                      <div class="business-template-preview__header">
                        <h3 :class="{ 'business-template-preview__placeholder': !trainingTemplateDraft.title }">
                          {{ trainingTemplateDraft.title || 'Untitled training template' }}
                        </h3>
                        <p :class="{ 'business-template-preview__placeholder': !trainingTemplateDraft.description }">
                          {{ trainingTemplateDraft.description || 'Add a short description so team members know what this training covers.' }}
                        </p>
                      </div>

                      <div class="business-template-preview__details">
                        <div class="business-template-preview__detail">
                          <span>Categories</span>
                          <strong>{{ countTrainingTemplateCategories(trainingTemplateDraft) }}</strong>
                        </div>
                        <div class="business-template-preview__detail">
                          <span>Total Skills</span>
                          <strong>{{ countTrainingTemplateSkills(trainingTemplateDraft) }}</strong>
                        </div>
                        <div class="business-template-preview__detail">
                          <span>Format</span>
                          <strong>Custom Skill Map</strong>
                        </div>
                      </div>

                      <article
                        v-for="(category, index) in trainingTemplateDraft.categories"
                        :key="`${category.id}-preview`"
                        class="business-template-preview__question"
                      >
                        <div class="business-template-preview__question-head">
                          <span>Category {{ index + 1 }}</span>
                          <small>{{ category.skills.length }} skill{{ category.skills.length === 1 ? '' : 's' }}</small>
                        </div>
                        <strong :class="{ 'business-template-preview__placeholder': !category.title }">
                          {{ category.title || 'Untitled category' }}
                        </strong>

                        <div class="business-template-preview__training-skills">
                          <div
                            v-for="skill in category.skills"
                            :key="`${skill.id}-preview`"
                            class="business-template-preview__training-skill"
                          >
                            <div class="business-template-preview__training-skill-copy">
                              <strong :class="{ 'business-template-preview__placeholder': !skill.name }">
                                {{ skill.name || 'Untitled skill' }}
                              </strong>
                              <p v-if="skill.description">{{ skill.description }}</p>
                            </div>
                          </div>
                        </div>
                      </article>

                      <div class="business-template-preview__footer">
                        <button type="button" disabled>Start Training Plan</button>
                      </div>
                    </article>
                  </div>
                </aside>
              </div>

              <div v-else-if="canViewTrainingAssignments" class="business-assign-templates">
                <div class="business-assign-templates__header">
                  <div>
                    <p class="business-assign-templates__eyebrow">Training Assignment</p>
                    <h2>Assign saved training templates without leaving this page</h2>
                    <p>Choose a saved training template and assign it only to applicants who already completed the final interview.</p>
                  </div>
                  <div class="business-assign-templates__summary">
                    <span>{{ readyTrainingTemplateRows.length }} ready applicants</span>
                    <span>{{ assignedTrainingTemplateRows.length }} templates assigned</span>
                    <span>{{ trainingTrackingAssignments.length }} in tracking</span>
                  </div>
                </div>

                <div class="business-assign-templates__tabs">
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'ready-members' }"
                    @click="setTrainingAssignmentTab('ready-members')"
                  >
                    Ready Applicants
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'assigned-templates' }"
                    @click="setTrainingAssignmentTab('assigned-templates')"
                  >
                    Assigned Templates
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'training-tracking' }"
                    @click="setTrainingAssignmentTab('training-tracking')"
                  >
                    Training Tracking
                  </button>
                </div>

                <article v-if="trainingAssignmentTab === 'ready-members'" class="business-assign-templates__panel">
                  <div v-if="readyTrainingTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Training Stage</th>
                          <th>Template</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="member in readyTrainingTemplateRows" :key="member.id">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ member.name }}</strong>
                              <span>{{ member.email }}</span>
                            </div>
                          </td>
                          <td>{{ member.role }}</td>
                          <td>{{ member.stage }}</td>
                          <td>
                            <select
                              v-model="member.selectedTemplateId"
                              class="business-assign-templates__select"
                              :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length"
                            >
                              <option value="">
                                {{ assignableTrainingTemplates.length ? 'Select template' : 'No saved templates yet' }}
                              </option>
                              <option v-for="template in assignableTrainingTemplates" :key="template.id" :value="template.id">
                                {{ template.title }}
                              </option>
                            </select>
                          </td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="{ 'is-assigned': String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' }"
                            >
                              {{ member.assignmentStatus }}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              class="business-assign-templates__action"
                              :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length"
                              @click="assignTrainingTemplateToMember(member.id)"
                            >
                              {{ String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' ? 'Update' : 'Assign' }}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No applicants are ready for training assignment yet</strong>
                    <p>Only applicants with a completed final interview will appear in this table.</p>
                  </div>
                </article>

                <article v-else-if="trainingAssignmentTab === 'assigned-templates'" class="business-assign-templates__panel">
                  <div v-if="assignedTrainingTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Assigned Template</th>
                          <th>Assigned Date</th>
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="member in assignedTrainingTemplateRows" :key="`${member.id}-assigned`">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ member.name }}</strong>
                              <span>{{ member.email }}</span>
                            </div>
                          </td>
                          <td>{{ member.role }}</td>
                          <td>{{ getAssignableTrainingTemplateLabel(member.selectedTemplateId, member.templateTitle) }}</td>
                          <td>{{ member.assignedAt || 'Not set' }}</td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="`is-progress-${resolveTrainingTrackingProgressTone(member.progressStatus)}`"
                            >
                              {{ member.progressStatus }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No training templates assigned yet</strong>
                    <p>Save a training template first, then assign it from the ready applicants tab.</p>
                  </div>
                </article>

                <article v-else-if="trainingAssignmentTab === 'training-tracking'" class="business-assign-templates__panel business-assign-templates__panel--tracking">
                  <div v-if="trainingTrackingAssignments.length" class="business-assign-templates__tracking">
                    <div v-if="!isTrainingTrackingDetailView" class="business-assign-templates__tracking-table-view">
                      <div class="business-assign-templates__tracking-view-head">
                        <div>
                          <p class="business-assign-templates__eyebrow">Training Tracking Queue</p>
                          <h3>Applicants with assigned training templates</h3>
                          <p>Select one applicant to open the dedicated training progress page.</p>
                        </div>
                      </div>

                      <div class="business-assign-templates__table-wrap">
                        <table class="business-assign-templates__table">
                          <thead>
                            <tr>
                              <th>Applicant</th>
                              <th>Position</th>
                            <th>Assigned Template</th>
                            <th>Overall Progress</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="assignment in trainingTrackingAssignments" :key="`${assignment.id}-tracking`">
                            <td>
                              <div class="business-assign-templates__applicant">
                                <strong>{{ assignment.name }}</strong>
                                <span>{{ assignment.email }}</span>
                              </div>
                            </td>
                            <td>{{ assignment.role }}</td>
                            <td>{{ getAssignableTrainingTemplateLabel(assignment.selectedTemplateId, assignment.templateTitle) }}</td>
                            <td>
                              <div class="business-assign-templates__tracking-progress-cell">
                                <strong>{{ assignment.overallProgress.percent }}%</strong>
                                <span>{{ assignment.overallProgress.completedSkills }}/{{ assignment.overallProgress.totalSkills || 0 }} skills</span>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                class="business-assign-templates__action"
                                :class="{ 'business-assign-templates__action--active': isTrainingTrackingDetailView && selectedTrainingTrackingAssignment?.id === assignment.id }"
                                @click="openTrainingTrackingDetail(assignment.id)"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    </div>

                    <section v-else-if="selectedTrainingTrackingAssignment" class="business-assign-templates__tracking-detail-view">
                      <div class="business-assign-templates__tracking-view-head business-assign-templates__tracking-view-head--detail">
                        <button
                          type="button"
                          class="business-assign-templates__back-button"
                          @click="returnToTrainingTrackingTable"
                        >
                          <i class="bi bi-arrow-left" aria-hidden="true" />
                          Back to Applicant Table
                        </button>
                        <span>Selected applicant training progress</span>
                      </div>

                      <section class="business-assign-templates__tracking-detail">
                      <div class="business-assign-templates__tracking-detail-top">
                        <div>
                          <p class="business-assign-templates__eyebrow">Training Progress</p>
                          <h3>{{ selectedTrainingTrackingAssignment.name }}</h3>
                          <p>
                            {{ getAssignableTrainingTemplateLabel(
                              selectedTrainingTrackingAssignment.selectedTemplateId,
                              selectedTrainingTrackingAssignment.templateTitle,
                            ) }}
                            <span v-if="selectedTrainingTrackingAssignment.assignedAt">
                              | Assigned {{ selectedTrainingTrackingAssignment.assignedAt }}
                            </span>
                          </p>
                        </div>
                        <span
                          class="business-assign-templates__status"
                          :class="`is-progress-${resolveTrainingTrackingProgressTone(selectedTrainingTrackingAssignment.progressStatus)}`"
                        >
                          {{ selectedTrainingTrackingAssignment.progressStatus }}
                        </span>
                      </div>

                      <div class="business-assign-templates__tracking-summary">
                        <article class="business-assign-templates__tracking-stat">
                          <span>Overall Progress</span>
                          <strong>{{ selectedTrainingTrackingAssignment.overallProgress.percent }}%</strong>
                          <small>
                            {{ selectedTrainingTrackingAssignment.overallProgress.completedSkills }}/{{ selectedTrainingTrackingAssignment.overallProgress.totalSkills || 0 }} skills complete
                          </small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Total Score</span>
                          <strong>{{ selectedTrainingTrackingAssignment.scoreSummary.totalScore }}/{{ selectedTrainingTrackingAssignment.scoreSummary.maxScore || 0 }}</strong>
                          <small>
                            {{
                              selectedTrainingTrackingAssignment.scoreSummary.gradedSkills
                                ? `${selectedTrainingTrackingAssignment.scoreSummary.gradedSkills}/${selectedTrainingTrackingAssignment.scoreSummary.totalSkills || 0} skills graded - Avg ${selectedTrainingTrackingAssignment.scoreSummary.averageScore}/5`
                                : 'No skill grades saved yet'
                            }}
                          </small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Training Categories</span>
                          <strong>{{ selectedTrainingTrackingAssignment.templateCategories.length }}</strong>
                          <small>Saved from the assigned training template</small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Position</span>
                          <strong>{{ selectedTrainingTrackingAssignment.role }}</strong>
                          <small>{{ selectedTrainingTrackingAssignment.stage }}</small>
                        </article>
                      </div>

                      <div
                        v-if="selectedTrainingTrackingAssignment.overallProgress.totalSkills"
                        class="business-assign-templates__tracking-progress-bar"
                        aria-hidden="true"
                      >
                        <span
                          class="business-assign-templates__tracking-progress-fill"
                          :style="{ width: `${selectedTrainingTrackingAssignment.overallProgress.percent}%` }"
                        />
                      </div>

                      <div class="business-assign-templates__tracking-categories">
                        <article
                          v-for="category in selectedTrainingTrackingAssignment.templateCategories"
                          :key="`${selectedTrainingTrackingAssignment.id}-${category.id}`"
                          class="business-assign-templates__tracking-category"
                        >
                          <div class="business-assign-templates__tracking-category-head">
                            <div>
                              <strong>{{ category.title || 'Untitled category' }}</strong>
                              <span>
                                {{ category.progress.completedSkills }}/{{ category.progress.totalSkills || 0 }} skills completed
                                | Score {{ category.score.totalScore }}/{{ category.score.maxScore || 0 }}
                              </span>
                            </div>
                            <div class="business-assign-templates__tracking-category-meta">
                              <strong>{{ category.progress.percent }}%</strong>
                              <small>{{ category.score.gradedSkills }}/{{ category.progress.totalSkills || 0 }} graded</small>
                            </div>
                          </div>

                          <div
                            v-if="category.progress.totalSkills"
                            class="business-assign-templates__tracking-progress-bar business-assign-templates__tracking-progress-bar--category"
                            aria-hidden="true"
                          >
                            <span
                              class="business-assign-templates__tracking-progress-fill"
                              :style="{ width: `${category.progress.percent}%` }"
                            />
                          </div>

                          <div v-if="category.skills.length" class="business-assign-templates__tracking-skills">
                            <div
                              v-for="skill in category.skills"
                              :key="`${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}`"
                              class="business-assign-templates__tracking-skill"
                              :class="{ 'is-complete': skill.completed }"
                            >
                              <div class="business-assign-templates__tracking-skill-check">
                                <input
                                  type="checkbox"
                                  :checked="skill.completed"
                                  :disabled="!canEditTrainingAssignments || isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                                  @change="toggleTrainingAssignmentSkillCompletion(
                                    selectedTrainingTrackingAssignment.id,
                                    category.id,
                                    skill.id,
                                    $event.target.checked,
                                  )"
                                />
                              </div>
                              <div class="business-assign-templates__tracking-skill-copy">
                                <strong>{{ skill.name || 'Untitled skill' }}</strong>
                                <span v-if="skill.description">{{ skill.description }}</span>
                                <small>
                                  {{
                                    isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)
                                      ? 'Saving...'
                                      : skill.completed
                                        ? skill.grade
                                          ? `Completed - Rated ${skill.grade}/5`
                                          : 'Completed - Waiting for grade'
                                        : 'Pending'
                                  }}
                                </small>
                                <div v-if="skill.completed" class="business-assign-templates__tracking-grade">
                                  <span class="business-assign-templates__tracking-grade-label">Skill Grade</span>
                                  <div class="business-assign-templates__tracking-grade-scale">
                                    <label
                                      v-for="gradeOption in TRAINING_TRACKING_GRADE_SCALE"
                                      :key="`${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}-${gradeOption}`"
                                      class="business-assign-templates__tracking-grade-option"
                                    >
                                      <input
                                        type="radio"
                                        :name="`training-grade-${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}`"
                                        :checked="skill.grade === gradeOption"
                                        :disabled="!canEditTrainingAssignments || isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                                        @change="setTrainingAssignmentSkillGrade(
                                          selectedTrainingTrackingAssignment.id,
                                          category.id,
                                          skill.id,
                                          gradeOption,
                                        )"
                                      />
                                      <span>{{ gradeOption }}</span>
                                    </label>
                                  </div>
                                  <small class="business-assign-templates__tracking-grade-note">
                                    {{
                                      skill.grade
                                        ? `${skill.grade}/5 selected for this skill.`
                                        : 'Choose a score from 1 to 5 after checking this skill.'
                                    }}
                                  </small>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div v-else class="business-assign-templates__empty business-assign-templates__empty--compact">
                            <strong>No skills listed in this category yet</strong>
                            <p>Edit the saved training template if you want to add more skills for future assignments.</p>
                          </div>

                          <div
                            v-if="category.canAddRemark"
                            class="business-assign-templates__tracking-remark"
                          >
                            <div class="business-assign-templates__tracking-remark-head">
                              <div>
                                <strong>Category Remark</strong>
                                <span>
                                  {{
                                    category.isFullyGraded
                                      ? 'All skills are checked and graded. Add your final remark for this category.'
                                      : 'This remark is unlocked because all skills are checked. Finish grading each skill, then save your final category remark.'
                                  }}
                                </span>
                              </div>
                              <span
                                v-if="category.remarkedAt"
                                class="business-assign-templates__tracking-remark-time"
                              >
                                Saved {{ formatBusinessInterviewDateTime(category.remarkedAt) }}
                              </span>
                            </div>
                            <textarea
                              class="business-assign-templates__tracking-remark-input"
                              rows="4"
                              :disabled="!canEditTrainingAssignments || isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)"
                              :value="getTrainingTrackingCategoryRemarkDraft(selectedTrainingTrackingAssignment.id, category)"
                              placeholder="Add your training remark for this category..."
                              @input="setTrainingTrackingCategoryRemarkDraft(selectedTrainingTrackingAssignment.id, category.id, $event.target.value)"
                            />
                            <div class="business-assign-templates__tracking-remark-actions">
                              <small>
                                {{
                                  isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)
                                    ? 'Saving category remark...'
                                    : category.hasRemark
                                      ? 'A saved remark is required before you can complete the full training record.'
                                      : 'Save a remark for this category after reviewing every skill.'
                                }}
                              </small>
                              <button
                                type="button"
                                class="business-assign-templates__action"
                                :disabled="!canEditTrainingAssignments || isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)"
                                @click="saveTrainingTrackingCategoryRemark(selectedTrainingTrackingAssignment.id, category.id)"
                              >
                                Save Remark
                              </button>
                            </div>
                          </div>
                          <div
                            v-else
                            class="business-assign-templates__tracking-remark business-assign-templates__tracking-remark--locked"
                          >
                            <strong>Category remark locked</strong>
                            <p>This remark field will appear only after all skills in this category are checked as completed.</p>
                          </div>
                        </article>
                      </div>

                      <div class="business-assign-templates__tracking-footer">
                        <div
                          v-if="selectedTrainingTrackingAssignment.trainingCompletedAt"
                          class="business-assign-templates__tracking-complete business-assign-templates__tracking-complete--done"
                        >
                          <strong>Training monitoring completed</strong>
                          <p>
                            Completed {{ formatBusinessInterviewDateTime(selectedTrainingTrackingAssignment.trainingCompletedAt) }}
                            <span v-if="selectedTrainingTrackingAssignment.trainingCompletedByName">
                              by {{ selectedTrainingTrackingAssignment.trainingCompletedByName }}
                            </span>.
                          </p>
                        </div>
                        <div
                          v-else-if="selectedTrainingTrackingAssignment.canCompleteTraining"
                          class="business-assign-templates__tracking-complete"
                        >
                          <div>
                            <strong>Ready to complete this training record</strong>
                            <p>All categories are checked, every skill has a 1-5 grade, and each category already has a saved remark.</p>
                          </div>
                          <button
                            type="button"
                            class="business-assign-templates__action"
                            :disabled="!canEditTrainingAssignments || isTrainingTrackingAssignmentCompleting(selectedTrainingTrackingAssignment.id)"
                            @click="completeTrainingTrackingAssignment(selectedTrainingTrackingAssignment.id)"
                          >
                            {{ isTrainingTrackingAssignmentCompleting(selectedTrainingTrackingAssignment.id) ? 'Completing...' : 'Complete Training' }}
                          </button>
                        </div>
                        <div
                          v-else
                          class="business-assign-templates__tracking-complete business-assign-templates__tracking-complete--pending"
                        >
                          <strong>Finish monitoring each training category first</strong>
                          <p>Check all skills, add a 1-5 grade for every completed skill, and save a remark for each category to unlock the final complete training action.</p>
                        </div>
                      </div>
                      </section>
                    </section>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No tracked applicants yet</strong>
                    <p>Assigned applicants will appear here so you can monitor skills and mark completed training checks.</p>
                  </div>
                </article>
              </div>
            </section>

            <section v-else-if="activeSection === 'profile'" class="business-profile">
              <div class="business-profile__header">
                <div>
                  <h2>Business Profile</h2>
                  <p>Manage the details shown for your business account and workspace identity.</p>
                </div>
                <div class="business-profile__badge">
                  <i class="bi bi-buildings" aria-hidden="true" />
                  <span>Business Account</span>
                </div>
              </div>

              <div class="business-profile__grid">
                <article class="business-profile__card">
                  <h3>Company Information</h3>
                  <div class="business-profile__avatar-section">
                    <div class="business-profile__avatar-shell" :class="{ 'is-loading': isProfileAvatarLoading }">
                      <img
                        v-if="profileForm.avatar"
                        :src="profileForm.avatar"
                        alt="Business profile avatar"
                        class="business-profile__avatar-image"
                        :class="{ 'is-visible': isProfileAvatarReady || isProfileAvatarLoading }"
                      />
                      <div v-if="isProfileAvatarLoading" class="business-profile__avatar-loader" aria-hidden="true" />
                      <span v-else>{{ businessInitials }}</span>
                    </div>
                    <div class="business-profile__avatar-copy">
                      <strong>Profile Photo</strong>
                      <span>Upload your business image or logo to update the account avatar.</span>
                    </div>
                    <div class="business-profile__avatar-actions">
                      <input
                        ref="profileAvatarInputRef"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        class="business-profile__avatar-input"
                        @change="handleProfileAvatarChange"
                      />
                      <button type="button" class="business-profile__secondary" :disabled="isProfileAvatarLoading" @click="openProfileAvatarPicker">
                        {{ isProfileAvatarLoading ? 'Loading image...' : 'Upload Image' }}
                      </button>
                      <button
                        v-if="profileForm.avatar"
                        type="button"
                        class="business-profile__secondary business-profile__secondary--danger"
                        :disabled="isProfileAvatarLoading"
                        @click="removeProfileAvatar"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div class="business-profile__form">
                    <label class="business-profile__field">
                      <span>Company Name</span>
                      <input v-model="profileForm.companyName" type="text" placeholder="Enter company name" />
                    </label>
                    <label class="business-profile__field">
                      <span>Business Email</span>
                      <input v-model="profileForm.email" type="email" placeholder="Enter business email" />
                    </label>
                    <label class="business-profile__field">
                      <span>Category</span>
                      <input v-model="profileForm.category" type="text" placeholder="Enter business category" />
                    </label>
                    <label class="business-profile__field">
                      <span>Location</span>
                      <input v-model="profileForm.location" type="text" placeholder="Enter business location" />
                    </label>
                    <label class="business-profile__field business-profile__field--full">
                      <span>Contact Person</span>
                      <input v-model="profileForm.contactPerson" type="text" placeholder="Enter contact person name" />
                    </label>
                  </div>
                  <div class="business-profile__actions">
                    <button type="button" class="business-profile__secondary" @click="syncProfileFormFromAuthUser">Reset</button>
                    <button type="button" class="business-profile__primary" @click="saveBusinessProfile">Save Changes</button>
                  </div>
                </article>

                <aside class="business-profile__card business-profile__card--preview">
                  <h3>Profile Preview</h3>
                  <div class="business-profile__preview">
                    <div class="business-profile__preview-avatar" :class="{ 'is-loading': isProfileAvatarLoading }">
                      <img
                        v-if="profileForm.avatar"
                        :src="profileForm.avatar"
                        alt="Business profile preview avatar"
                        class="business-profile__preview-avatar-image"
                        :class="{ 'is-visible': isProfileAvatarReady || isProfileAvatarLoading }"
                      />
                      <template v-else>{{ businessInitials }}</template>
                    </div>
                    <strong>{{ profileForm.companyName || businessName }}</strong>
                    <span>{{ profileForm.email || businessEmail }}</span>
                  </div>
                  <div class="business-profile__meta">
                    <div class="business-profile__meta-row">
                      <span>Category</span>
                      <strong>{{ profileForm.category || businessCategory }}</strong>
                    </div>
                    <div class="business-profile__meta-row">
                      <span>Location</span>
                      <strong>{{ profileForm.location || businessLocation }}</strong>
                    </div>
                    <div class="business-profile__meta-row">
                      <span>Contact Person</span>
                      <strong>{{ profileForm.contactPerson || authUser?.name || 'Not set' }}</strong>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <Transition name="business-payment" mode="out-in">
              <section
                v-if="activeSection === 'subscriptions' && subscriptionView === 'plans'"
                key="subscription-plans"
                class="business-pricing"
              >
                <article
                  v-for="plan in subscriptionPlans"
                  :key="plan.id"
                  class="business-pricing__card"
                  :class="`business-pricing__card--${plan.tone}`"
                >
                  <div class="business-pricing__top">
                    <div>
                      <h3>{{ plan.title }}</h3>
                      <p class="business-pricing__subtitle">{{ plan.subtitle }}</p>
                    </div>
                    <div v-if="plan.badge" class="business-pricing__pill">{{ plan.badge }}</div>
                  </div>

                  <ul class="business-pricing__features">
                    <li v-for="feature in plan.features" :key="feature">
                      <i class="bi bi-check2-circle" aria-hidden="true" />
                      <span>{{ feature }}</span>
                    </li>
                  </ul>

                  <div class="business-pricing__footer">
                    <button
                      type="button"
                      class="business-pricing__cta"
                      :disabled="plan.isDisabled"
                      @click="handleSubscriptionPlanClick(plan)"
                    >
                      {{ plan.cta }}
                    </button>
                    <p v-if="plan.trialNote" class="business-pricing__trial-note">{{ plan.trialNote }}</p>
                  </div>
                </article>
              </section>

              <BusinessSubscirptionPayment
                v-else-if="activeSection === 'subscriptions' && subscriptionView === 'payment'"
                key="subscription-payment"
              >
                <template #main>
                  <div class="business-payment__main">
                  <div v-if="isAdvancingPaymentStep" class="business-payment__loading">
                    <div class="business-payment__loading-inner">
                      <div class="business-payment__loading-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p class="business-payment__loading-text">{{ paymentLoadingMessage }}</p>
                    </div>
                  </div>

                  <div class="business-payment__steps">
                    <div
                      v-for="(row, index) in paymentStepRows"
                      :key="row.step"
                      class="business-payment__step"
                      :class="{
                        'is-current': paymentStep === index + 1,
                        'is-done': paymentStep > index + 1,
                      }"
                    >
                      <div class="business-payment__step-marker">
                        <i :class="row.icon" aria-hidden="true" />
                      </div>
                      <div class="business-payment__step-line" aria-hidden="true" />
                      <p>{{ row.title }}</p>
                    </div>
                  </div>

                  <div v-if="paymentStep === 1" class="business-payment__panel">
                    <h3>{{ currentCheckoutFlow.stepOneTitle }}</h3>
                    <p>{{ currentCheckoutFlow.stepOneDescription }}</p>
                    <div class="business-payment__form">
                      <label class="business-payment__field">
                        <span>Full Name</span>
                        <input v-model="paymentForm.fullName" type="text" placeholder="Enter full name" @input="handlePaymentFullNameInput" />
                      </label>
                      <label class="business-payment__field">
                        <span>Business Email</span>
                        <input v-model="paymentForm.businessEmail" type="email" placeholder="Enter business email" readonly />
                      </label>
                      <label class="business-payment__field">
                        <span>Contact Number</span>
                        <div class="business-payment__phone-wrap">
                          <div
                            ref="paymentContactCountryDropdownRef"
                            class="business-payment__phone-country"
                            :class="{ 'is-open': isPaymentContactCountryDropdownOpen }"
                          >
                            <button
                              type="button"
                              class="business-payment__phone-country-trigger"
                              aria-haspopup="listbox"
                              :aria-expanded="isPaymentContactCountryDropdownOpen ? 'true' : 'false'"
                              @click="togglePaymentContactCountryDropdown"
                            >
                              <span class="business-payment__phone-country-value">
                                <span :class="getCountryFlagClass(paymentContactCountryCode)" class="business-payment__country-flag" aria-hidden="true" />
                                <span>{{ selectedPaymentPhoneCountry.code }} {{ selectedPaymentPhoneCountry.dial }}</span>
                              </span>
                              <i class="bi bi-chevron-down" aria-hidden="true" />
                            </button>

                            <Transition name="business-payment-country">
                              <div
                                v-if="isPaymentContactCountryDropdownOpen"
                                class="business-payment__phone-country-menu"
                                role="listbox"
                                aria-label="Payment contact country"
                              >
                                <button
                                  v-for="country in PHONE_COUNTRIES"
                                  :key="country.code"
                                  type="button"
                                  class="business-payment__phone-country-option"
                                  :class="{ 'is-active': paymentContactCountryCode === country.code }"
                                  role="option"
                                  :aria-selected="paymentContactCountryCode === country.code ? 'true' : 'false'"
                                  @click="selectPaymentContactCountryOption(country.code)"
                                >
                                  <span class="business-payment__phone-country-value">
                                    <span :class="getCountryFlagClass(country.code)" class="business-payment__country-flag" aria-hidden="true" />
                                    <span>{{ country.code }} {{ country.dial }}</span>
                                  </span>
                                </button>
                              </div>
                            </Transition>
                          </div>

                          <input
                            type="text"
                            :value="formatContactNumberDisplay(getPaymentLocalContactDigits())"
                            placeholder="Enter contact number"
                            inputmode="tel"
                            maxlength="12"
                            @input="handlePaymentContactNumberChange"
                          />
                        </div>
                      </label>
                    </div>
                    <div class="business-payment__actions">
                      <button type="button" class="business-payment__secondary" @click="openCancelPaymentModal">Cancel</button>
                      <button
                        type="button"
                        class="business-payment__primary"
                        @click="validatePaymentStepOne() && goToPaymentStepWithLoading(2)"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>

                  <div v-else-if="paymentStep === 2" class="business-payment__panel">
                    <h3>{{ currentCheckoutFlow.stepTwoTitle }}</h3>
                    <p>{{ currentCheckoutFlow.stepTwoDescription }}</p>
                    <div class="business-payment__methods">
                      <article
                        v-for="method in paymentMethodOptions"
                        :key="method.id"
                        class="business-payment__method"
                        :class="[
                          `business-payment__method--${method.accent}`,
                          {
                            'is-selected': selectedPaymentMethod === method.id,
                            'is-disabled': method.disabled,
                          },
                        ]"
                        @click="!method.disabled && (selectedPaymentMethod = method.id)"
                      >
                        <div class="business-payment__method-icon" aria-hidden="true">
                          <img :src="method.image" :alt="`${method.title} logo`" class="business-payment__method-image" />
                        </div>
                        <div class="business-payment__method-copy">
                          <span class="business-payment__method-badge">{{ method.badge }}</span>
                          <strong>{{ method.title }}</strong>
                          <p>{{ method.copy }}</p>
                          <small>{{ method.meta }}</small>
                        </div>
                        <span class="business-payment__radio" aria-hidden="true" />
                      </article>
                    </div>
                    <div class="business-payment__actions">
                      <button type="button" class="business-payment__secondary" @click="goToPaymentStep(1)">Previous</button>
                      <button type="button" class="business-payment__primary" @click="goToPaymentConfirmationStep">Next Step</button>
                    </div>
                  </div>

                  <div v-else-if="paymentStep === 3" class="business-payment__panel">
                    <div v-if="isProcessingTestModePayment" class="business-payment__test-mode">
                      <div class="business-payment__test-mode-spinner" aria-hidden="true" />
                      <strong>{{ selectedPaymentMethod === 'gcash' ? 'Redirecting to PayMongo' : isFreeTrialCheckout ? 'Billing setup in progress' : 'Payment in progress' }}</strong>
                      <p>{{ selectedPaymentMethod === 'gcash' ? 'Please wait while we continue your GCash checkout securely through PayMongo.' : currentCheckoutFlow.processingText }}</p>
                    </div>
                    <template v-else-if="selectedPaymentMethod === 'gcash'">
                      <h3>{{ currentCheckoutFlow.gcashTitle }}</h3>
                      <p>{{ currentCheckoutFlow.gcashDescription }}</p>
                      <div class="business-payment__status-box">
                        <strong>{{ currentCheckoutFlow.gcashStatusTitle }}</strong>
                        <span>{{ isAwaitingExternalPayment ? currentCheckoutFlow.gcashStatusOpened : currentCheckoutFlow.gcashStatusWaiting }}</span>
                        <small>{{ currentCheckoutFlow.gcashStatusHelp }}</small>
                      </div>
                    </template>
                    <template v-else>
                      <h3>{{ currentCheckoutFlow.cardTitle }}</h3>
                      <p>{{ currentCheckoutFlow.cardDescription }}</p>
                      <div class="business-payment__status-box">
                        <strong>{{ currentCheckoutFlow.cardStatusTitle }}</strong>
                        <span>{{ selectedPaymentMethod === 'gcash' ? 'GCash' : 'Credit Card' }}</span>
                        <small>{{ currentCheckoutFlow.cardStatusHelp }}</small>
                      </div>
                    </template>
                    <div class="business-payment__actions">
                      <button
                        type="button"
                        class="business-payment__secondary"
                        :disabled="isProcessingTestModePayment || isAwaitingExternalPayment"
                        @click="goToPaymentStep(2)"
                      >
                        Previous
                      </button>
                      <button
                        v-if="selectedPaymentMethod === 'gcash'"
                        type="button"
                        class="business-payment__primary"
                        :disabled="isProcessingTestModePayment"
                        @click="openMockPaymentTab"
                      >
                        {{ currentCheckoutFlow.reopenAction }}
                      </button>
                      <button
                        v-else
                        type="button"
                        class="business-payment__primary"
                        :disabled="isProcessingTestModePayment"
                        @click="markPaymentConfirmed"
                      >
                        {{ isProcessingTestModePayment ? 'Processing...' : currentCheckoutFlow.confirmAction }}
                      </button>
                    </div>
                  </div>

                  <div v-else class="business-payment__panel business-payment__panel--success">
                    <div class="business-payment__success-icon" aria-hidden="true">
                      <i class="bi bi-check-circle-fill" />
                    </div>
                    <h3>{{ currentCheckoutFlow.successTitle }}</h3>
                    <p>{{ currentCheckoutFlow.successDescription }}</p>
                    <div class="business-payment__status-box business-payment__status-box--success">
                      <strong>{{ currentCheckoutFlow.successStatusTitle }}</strong>
                      <span>{{ currentCheckoutFlow.successStatusDescription }}</span>
                      <small>Redirecting to subscriptions in {{ paymentSuccessRedirectSeconds }} seconds.</small>
                    </div>
                    <div class="business-payment__success-meta">
                      <div class="business-payment__success-meta-item">
                        <span>Reference Number</span>
                        <strong>{{ orderReceiptCode }}</strong>
                      </div>
                      <div class="business-payment__success-meta-item">
                        <span>Date</span>
                        <strong>{{ orderReceiptDate }}</strong>
                      </div>
                    </div>
                    <div class="business-payment__actions business-payment__actions--center">
                      <button type="button" class="business-payment__primary" @click="goBackToPlans">Go to Subscriptions</button>
                    </div>
                  </div>
                  </div>
                </template>

                <template #summary>
                  <aside class="business-payment__summary">
                  <h3>Order Summary</h3>
                  <p class="business-payment__summary-note">
                    {{ paymentStep >= 4 ? currentCheckoutFlow.summaryNoteSuccess : currentCheckoutFlow.summaryNotePending }}
                  </p>
                  <div class="business-payment__receipt">
                    <div class="business-payment__receipt-row">
                      <span>Receipt</span>
                      <strong>{{ orderReceiptCode }}</strong>
                    </div>
                    <div class="business-payment__receipt-row">
                      <span>Date</span>
                      <strong>{{ orderReceiptDate }}</strong>
                    </div>
                  </div>
                  <div class="business-payment__item">
                    <div class="business-payment__item-thumb">P</div>
                    <div class="business-payment__item-copy">
                      <strong>{{ currentCheckoutFlow.summaryItemTitle }}</strong>
                      <span>{{ currentCheckoutFlow.summaryItemDescription }}</span>
                      <small>Qty: 1</small>
                    </div>
                  </div>
                  <div class="business-payment__summary-row">
                    <span>Recipient</span>
                    <strong>PWD Employment Platform</strong>
                  </div>
                  <div class="business-payment__summary-row">
                    <span>Subtotal</span>
                    <strong>{{ currentCheckoutFlow.subtotal }}</strong>
                  </div>
                  <div v-if="currentCheckoutFlow.discount" class="business-payment__summary-row">
                    <span>New User Discount</span>
                    <strong>{{ currentCheckoutFlow.discount }}</strong>
                  </div>
                  <div class="business-payment__summary-row">
                    <span>VAT</span>
                    <strong>{{ currentCheckoutFlow.vat }}</strong>
                  </div>
                  <div class="business-payment__summary-row">
                    <span>{{ currentCheckoutFlow.summaryMetaLabel }}</span>
                    <strong>{{ currentCheckoutFlow.summaryMetaValue }}</strong>
                  </div>
                  <div class="business-payment__summary-row business-payment__summary-row--total">
                    <span>Total</span>
                    <strong>{{ currentCheckoutFlow.total }}</strong>
                  </div>
                  </aside>
                </template>
              </BusinessSubscirptionPayment>

              <section
                v-else-if="activeSection === 'subscriptions' && subscriptionView === 'history'"
                key="subscription-history"
                class="business-history"
              >
                <div class="business-history__panel-head">
                  <div>
                    <h3>Payment History</h3>
                    <p>Latest subscription activity for this business account only.</p>
                  </div>
                  <span class="business-history__pill">{{ filteredBusinessPaymentHistoryEntries.length }} records</span>
                </div>

                <div class="business-history__search-card">
                  <div class="business-history__toolbar">
                    <label class="business-history__filter business-history__filter--search">
                      <span>Search</span>
                      <div class="business-history__search">
                        <i class="bi bi-search" aria-hidden="true" />
                        <input
                          v-model.trim="paymentHistorySearch"
                          type="text"
                          placeholder="Search payment history..."
                        />
                      </div>
                    </label>

                    <label class="business-history__filter business-history__filter--status">
                      <span>Status</span>
                      <div class="business-history__select-wrap">
                        <i class="bi bi-funnel" aria-hidden="true" />
                        <select v-model="paymentHistoryStatusFilter" class="business-history__select">
                          <option
                            v-for="option in paymentHistoryStatusOptions"
                            :key="option.value"
                            :value="option.value"
                          >
                            {{ option.label }}
                          </option>
                        </select>
                      </div>
                    </label>
                  </div>
                </div>

                <div v-if="filteredBusinessPaymentHistoryEntries.length" class="business-history__table-shell">
                  <div class="business-history__table">
                    <div class="business-history__head">
                      <span>Receipt</span>
                      <span>Business</span>
                      <span>Plan</span>
                      <span>Method</span>
                      <span>Amount</span>
                      <span>Date</span>
                      <span>Status</span>
                      <span>Actions</span>
                    </div>

                    <article
                      v-for="entry in filteredBusinessPaymentHistoryEntries"
                      :key="entry.id"
                      class="business-history__row"
                    >
                      <div class="business-history__id">{{ entry.receiptCode || entry.id }}</div>

                      <div class="business-history__account">
                        <div class="business-history__avatar">
                          {{ paymentHistoryInitialsFromName(entry.ownerName, 'BA') }}
                        </div>
                        <div class="business-history__meta">
                          <strong>{{ entry.ownerName || businessName }}</strong>
                          <span>{{ entry.ownerEmail || businessEmail }}</span>
                        </div>
                      </div>

                      <div class="business-history__plan">{{ entry.plan }}</div>
                      <div class="business-history__method">{{ entry.method }}</div>
                      <div class="business-history__amount">{{ entry.amount }}</div>
                      <div class="business-history__date">{{ entry.date }} {{ entry.time }}</div>
                      <div class="business-history__status-wrap">
                        <span class="business-history__status-pill" :class="`is-${normalizePaymentHistoryStatusClass(entry.status)}`">
                          {{ entry.status }}
                        </span>
                      </div>
                      <div class="business-history__actions">
                        <button
                          type="button"
                          class="business-history__action-btn"
                          title="Open receipt"
                          aria-label="Open receipt"
                          @click="openReceiptPreview(entry)"
                        >
                          <i class="bi bi-printer" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  </div>
                </div>
                <div v-else class="business-history__empty">
                  <i class="bi bi-receipt-cutoff" aria-hidden="true" />
                  <strong>No payment history records match the current filter.</strong>
                  <p>Your completed premium or trial transactions for this account will appear here once they are synced.</p>
                </div>
              </section>
            </Transition>

          </div>
        </Transition>
      </main>
    </section>

    <Transition name="business-trial-modal">
      <div v-if="isApplicantManagementModalOpen" class="business-modal" @click.self="closeApplicantManagementModal">
        <div
          class="business-modal__card business-applicants-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-applicant-management-title"
        >
          <div class="business-modal__copy">
            <h2 id="business-applicant-management-title">
              {{ applicantManagementDecisionMode === 'reject' ? 'Reject applicant' : 'Applicant details' }}
            </h2>
            <p v-if="selectedApplicantManagementDetails">
              Review the applicant details below and decide whether to approve or reject the application.
            </p>
          </div>

          <div v-if="selectedApplicantManagementDetails" class="business-applicants-modal__body">
            <div class="business-applicants-modal__identity">
              <div class="business-applicants-modal__avatar">
                <img
                  v-if="selectedApplicantManagementDetails.applicantAvatar"
                  :src="selectedApplicantManagementDetails.applicantAvatar"
                  :alt="`${selectedApplicantManagementDetails.applicantName} avatar`"
                >
                <template v-else>{{ buildUserOverviewInitials(selectedApplicantManagementDetails.applicantName, 'AP') }}</template>
              </div>

              <div class="business-applicants-modal__identity-copy">
                <strong>{{ selectedApplicantManagementDetails.applicantName }}</strong>
                <span>{{ selectedApplicantManagementDetails.applicantEmail }}</span>
                <span class="business-user-overview__status" :class="`is-${normalizeUserOverviewValue(selectedApplicantManagementDetails.statusLabel).replace(/\s+/g, '-')}`">
                  {{ selectedApplicantManagementDetails.statusLabel }}
                </span>
              </div>
            </div>

            <div class="business-applicants-modal__grid">
              <div class="business-applicants-modal__item">
                <span>Application ID</span>
                <strong>{{ selectedApplicantManagementDetails.id }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Applied Job</span>
                <strong>{{ selectedApplicantManagementDetails.jobTitle }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Applied Date</span>
                <strong>{{ selectedApplicantManagementDetails.appliedAtLabel }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Disability Type</span>
                <strong>{{ selectedApplicantManagementDetails.disabilityLabel }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Preferred Language</span>
                <strong>{{ selectedApplicantManagementDetails.languageLabel }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Barangay</span>
                <strong>{{ selectedApplicantManagementDetails.barangayLabel }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Contact Number</span>
                <strong>{{ selectedApplicantManagementDetails.contactNumber }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Sex / Age</span>
                <strong>{{ selectedApplicantManagementDetails.sex }} / {{ selectedApplicantManagementDetails.age }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Birth Date</span>
                <strong>{{ selectedApplicantManagementDetails.birthDate }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>PWD ID</span>
                <strong>{{ selectedApplicantManagementDetails.pwdId }}</strong>
              </div>
              <div class="business-applicants-modal__item business-applicants-modal__item--wide">
                <span>Address</span>
                <strong>{{ selectedApplicantManagementDetails.fullAddress }}</strong>
              </div>
              <div
                v-if="selectedApplicantManagementDetails.rejectionReason && applicantManagementDecisionMode !== 'reject'"
                class="business-applicants-modal__item business-applicants-modal__item--wide"
              >
                <span>Saved Rejection Reason</span>
                <strong>{{ selectedApplicantManagementDetails.rejectionReason }}</strong>
              </div>
            </div>

            <label v-if="applicantManagementDecisionMode === 'reject'" class="business-applicants-modal__reason">
              <span>Reason for rejection</span>
              <textarea
                v-model.trim="applicantManagementDecisionReason"
                rows="4"
                placeholder="State the reason that the applicant should see on the My Applications page."
              />
            </label>

            <p v-if="applicantManagementDecisionError" class="business-applicants-modal__error">
              {{ applicantManagementDecisionError }}
            </p>
          </div>

          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="applicantManagementDecisionMode === 'reject' ? applicantManagementDecisionMode = 'view' : closeApplicantManagementModal()"
            >
              {{ applicantManagementDecisionMode === 'reject' ? 'Back' : 'Close' }}
            </button>
            <button
              v-if="applicantManagementDecisionMode !== 'reject' && canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--secondary business-applicants-modal__button--reject"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="applicantManagementDecisionMode = 'reject'; applicantManagementDecisionError = ''"
            >
              Reject
            </button>
            <button
              v-if="applicantManagementDecisionMode !== 'reject' && canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="approveApplicantManagementApplication()"
            >
              {{ isApplicantManagementDecisionSubmitting ? 'Saving...' : 'Approve' }}
            </button>
            <button
              v-else-if="canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--primary business-applicants-modal__button--reject-primary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="rejectApplicantManagementApplication()"
            >
              {{ isApplicantManagementDecisionSubmitting ? 'Saving...' : 'Confirm Rejection' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isBusinessInterviewRequestReviewOpen" class="business-modal" @click.self="closeBusinessInterviewRequestReview">
        <div
          class="business-modal__card business-applicants-modal business-interview-review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-interview-review-title"
        >
          <div class="business-modal__copy">
            <h2 id="business-interview-review-title">
              {{ businessInterviewRequestDecisionMode === 'reject' ? 'Reject reschedule request' : 'Review reschedule request' }}
            </h2>
            <p v-if="selectedBusinessInterviewReviewSchedule">
              Review the applicant request below and decide whether to reject it or share available interview dates for the reschedule.
            </p>
          </div>

          <div v-if="selectedBusinessInterviewReviewSchedule" class="business-applicants-modal__body">
            <div class="business-applicants-modal__identity">
              <div class="business-applicants-modal__avatar">
                <img
                  v-if="selectedBusinessInterviewReviewSchedule.applicantAvatar"
                  :src="selectedBusinessInterviewReviewSchedule.applicantAvatar"
                  :alt="`${selectedBusinessInterviewReviewSchedule.applicantName} avatar`"
                >
                <template v-else>{{ buildUserOverviewInitials(selectedBusinessInterviewReviewSchedule.applicantName, 'AP') }}</template>
              </div>

              <div class="business-applicants-modal__identity-copy">
                <strong>{{ selectedBusinessInterviewReviewSchedule.applicantName }}</strong>
                <span>{{ selectedBusinessInterviewReviewSchedule.applicantEmail }}</span>
                <span class="business-interview-status__badge is-pending">
                  {{ formatBusinessInterviewApplicantResponseLabel(selectedBusinessInterviewReviewSchedule) }}
                </span>
              </div>
            </div>

            <div class="business-applicants-modal__grid">
              <div class="business-applicants-modal__item">
                <span>Interview Type</span>
                <strong>{{ formatBusinessInterviewTypeLabel(selectedBusinessInterviewReviewSchedule.interviewType) }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Job Title</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.jobTitle }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Current Schedule</span>
                <strong>{{ formatBusinessInterviewDateTime(selectedBusinessInterviewReviewSchedule.scheduledAt) }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Requested Schedule</span>
                <strong>{{ formatBusinessInterviewDateTime(selectedBusinessInterviewReviewSchedule.requestedScheduleAt) }}</strong>
              </div>
              <div class="business-applicants-modal__item business-applicants-modal__item--wide">
                <span>Reschedule Reason</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.applicantResponseReason || 'No reason submitted.' }}</strong>
              </div>
              <div
                v-if="selectedBusinessInterviewReviewSchedule.businessDecisionReason && businessInterviewRequestDecisionMode !== 'reject'"
                class="business-applicants-modal__item business-applicants-modal__item--wide"
              >
                <span>Latest Decision Note</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.businessDecisionReason }}</strong>
              </div>
            </div>

            <label v-if="businessInterviewRequestDecisionMode === 'reject'" class="business-applicants-modal__reason">
              <span>Reason for rejection</span>
              <textarea
                v-model.trim="businessInterviewRequestDecisionReason"
                rows="4"
                placeholder="State the reason that the applicant should see on the Interviews and My Applications pages."
              />
            </label>

            <div v-else class="business-applicants-modal__reason business-interview-review-modal__options">
              <span>Available reschedule dates</span>
              <small>Share one or more current or future interview dates that the applicant can review and confirm.</small>
              <div class="business-interview-review-modal__option-grid">
                <label
                  v-for="(_, index) in businessInterviewRequestScheduleOptions"
                  :key="`business-interview-review-option-${index}`"
                  class="business-interview-review-modal__option-field"
                >
                  <span>Option {{ index + 1 }}</span>
                  <input
                    v-model="businessInterviewRequestScheduleOptions[index]"
                    type="datetime-local"
                    :min="businessInterviewMinScheduleDateTime"
                  />
                </label>
              </div>
              <div class="business-interview-review-modal__option-actions">
                <button
                  type="button"
                  class="business-interview-review-modal__option-add"
                  :disabled="isBusinessInterviewRequestDecisionSubmitting"
                  @click="addBusinessInterviewRequestScheduleOption()"
                >
                  Add another date
                </button>
              </div>
            </div>

            <p v-if="businessInterviewRequestDecisionError" class="business-applicants-modal__error">
              {{ businessInterviewRequestDecisionError }}
            </p>
          </div>

          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="businessInterviewRequestDecisionMode === 'reject' ? businessInterviewRequestDecisionMode = 'view' : closeBusinessInterviewRequestReview()"
            >
              {{ businessInterviewRequestDecisionMode === 'reject' ? 'Back' : 'Close' }}
            </button>
            <button
              v-if="businessInterviewRequestDecisionMode !== 'reject'"
              type="button"
              class="business-modal__button business-modal__button--secondary business-applicants-modal__button--reject"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="businessInterviewRequestDecisionMode = 'reject'; businessInterviewRequestDecisionError = ''"
            >
              Reject Request
            </button>
            <button
              v-if="businessInterviewRequestDecisionMode !== 'reject'"
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="approveBusinessInterviewRescheduleRequest()"
            >
              {{ isBusinessInterviewRequestDecisionSubmitting ? 'Saving...' : 'Approve & Share Dates' }}
            </button>
            <button
              v-else
              type="button"
              class="business-modal__button business-modal__button--primary business-applicants-modal__button--reject-primary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="rejectBusinessInterviewRescheduleRequest()"
            >
              {{ isBusinessInterviewRequestDecisionSubmitting ? 'Saving...' : 'Confirm Rejection' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isHelpCenterModalOpen" class="business-modal" @click.self="closeHelpCenterModal">
        <div class="business-modal__card business-help-modal" role="dialog" aria-modal="true" aria-labelledby="business-help-title">
          <div class="business-modal__copy">
            <h2 id="business-help-title">Help Center</h2>
            <p>Find quick support details for your business subscription and workspace tools.</p>
          </div>
          <div class="business-help-modal__grid">
            <article class="business-help-modal__item">
              <i class="bi bi-credit-card-2-front" aria-hidden="true" />
              <div>
                <strong>Billing Support</strong>
                <span>Questions about premium access, payment steps, and trial activation.</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-journal-check" aria-hidden="true" />
              <div>
                <strong>Templates & Tools</strong>
                <span>Help using Training Templates and Assessment Templates.</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-envelope-paper" aria-hidden="true" />
              <div>
                <strong>Contact</strong>
                <span>support@mathplatform.local</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-clock-history" aria-hidden="true" />
              <div>
                <strong>Support Hours</strong>
                <span>Monday to Friday, 8:00 AM to 5:00 PM</span>
              </div>
            </article>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              @click="closeHelpCenterModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isCreateUserConfirmOpen" class="business-modal" @click.self="closeCreateUserConfirm">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-create-user-title">
          <div class="business-modal__copy">
            <h2 id="business-create-user-title">Confirm user creation</h2>
            <p>Create a new workspace user for {{ createUserConfirmationName }} using {{ createUserConfirmationEmail }}?</p>
            <p class="business-modal__note">Kapag nag-Yes ka, magsisimula ang account creation at lalabas ang success toast pagkatapos ma-save.</p>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isCreatingWorkspaceUser"
              @click="closeCreateUserConfirm"
            >
              No
            </button>
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isCreatingWorkspaceUser"
              @click="executeWorkspaceUserAccountCreation"
            >
              {{ isCreatingWorkspaceUser ? 'Creating Account...' : 'Yes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isLogoutConfirmOpen" class="business-modal" @click.self="closeLogoutConfirm">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-logout-title">
          <div class="business-modal__copy">
            <h2 id="business-logout-title">Are you sure you want to log out?</h2>
            <p>Your current session will be closed and you will return to the login page.</p>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isLogoutSubmitting"
              @click="closeLogoutConfirm"
            >
              No
            </button>
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isLogoutSubmitting"
              @click="confirmLogout"
            >
              {{ isLogoutSubmitting ? 'Logging Out...' : 'Yes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isTrialConfirmationOpen" class="business-modal" @click.self="closeTrialConfirmation">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-trial-title">
          <div class="business-modal__copy">
            <h2 id="business-trial-title">{{ currentCheckoutFlow.modalTitle }}</h2>
            <p>{{ currentCheckoutFlow.modalDescription }}</p>
            <p class="business-modal__note">{{ currentCheckoutFlow.modalNote }}</p>
          </div>
          <div class="business-modal__actions">
            <button type="button" class="business-modal__button business-modal__button--secondary" @click="closeTrialConfirmation">
              Cancel
            </button>
            <button type="button" class="business-modal__button business-modal__button--primary" @click="proceedToPayment">
              Continue
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isCancelPaymentModalOpen" class="business-modal" @click.self="closeCancelPaymentModal">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-cancel-title">
          <div class="business-modal__copy">
            <h2 id="business-cancel-title">Cancel payment setup?</h2>
            <p>If you cancel now, your payment progress will be closed and you will return to the subscription plans.</p>
          </div>
          <div class="business-modal__actions">
            <button type="button" class="business-modal__button business-modal__button--secondary" :disabled="isCancellingPayment" @click="closeCancelPaymentModal">
              No
            </button>
            <button type="button" class="business-modal__button business-modal__button--primary" :disabled="isCancellingPayment" @click="confirmCancelPayment">
              {{ isCancellingPayment ? 'Cancelling...' : 'Yes, Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-drawer-modal">
      <div v-if="isAddMemberDrawerOpen" class="business-modal business-modal--drawer" @click.self="closeAddMemberDrawer">
        <aside class="business-modal__card business-modal__card--drawer" role="dialog" aria-modal="true" aria-labelledby="business-add-member-title">
          <div class="business-drawer__header">
            <div class="business-modal__copy business-drawer__intro">
              <p class="business-user-management__panel-label">Add Member</p>
              <h2 id="business-add-member-title">Create a team member profile</h2>
              <p>Link a created user account, review the assigned role, and save the member profile from this side panel.</p>
            </div>
            <button type="button" class="business-drawer__close" @click="closeAddMemberDrawer">
              <i class="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>

          <fieldset class="business-user-management__fieldset business-user-management__fieldset--sheet" :disabled="!canEditBusinessModule('add-employee') || isWorkspaceUserDirectoryLoading">
            <section class="business-user-management__drawer-section business-user-management__drawer-section--hero">
              <div class="business-user-management__drawer-section-head">
                <div>
                  <p class="business-user-management__panel-label">Member Setup</p>
                  <h3>Connect a workspace user</h3>
                </div>
                <span class="business-user-management__panel-chip">
                  {{ availableEmployeeLinkOptions.length }} available user{{ availableEmployeeLinkOptions.length === 1 ? '' : 's' }}
                </span>
              </div>

              <div class="business-user-management__grid business-user-management__grid--two">
                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Created User Account</span>
                  <select v-model="employeeDraft.linkedUserId">
                    <option value="">{{ isWorkspaceUserDirectoryLoading ? 'Loading workspace users...' : 'Select a created user' }}</option>
                    <option v-for="user in availableEmployeeLinkOptions" :key="user.id" :value="user.id">
                      {{ user.name }} - {{ user.gmail }}
                    </option>
                  </select>
                </label>

                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Assigned Role</span>
                  <input :value="selectedEmployeeLinkedUser ? getWorkspaceUserRoleName(selectedEmployeeLinkedUser) : ''" type="text" placeholder="Role auto-fills from the created user" readonly />
                </label>
              </div>

            </section>

            <section class="business-user-management__drawer-section">
              <div class="business-user-management__drawer-section-head">
                <div>
                  <p class="business-user-management__panel-label">Member Details</p>
                  <h3>Fill in the profile information</h3>
                </div>
              </div>

              <div class="business-user-management__grid business-user-management__grid--two">
                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Full Name</span>
                  <input v-model="employeeDraft.fullName" type="text" placeholder="Full name auto-fills from the created user" readonly />
                </label>

                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Email Address</span>
                  <input v-model="employeeDraft.workEmail" type="email" placeholder="Email auto-fills from the created user" readonly />
                </label>
              </div>

              <div class="business-user-management__grid business-user-management__grid--two">
                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Employment Type</span>
                  <select v-model="employeeDraft.employmentType">
                    <option value="">Select employment type</option>
                    <option v-for="type in employeeEmploymentTypeOptions" :key="type" :value="type">
                      {{ type }}
                    </option>
                  </select>
                </label>

                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Phone Number</span>
                  <input v-model="employeeDraft.phoneNumber" type="text" placeholder="09XX XXX XXXX" />
                </label>
              </div>

              <div class="business-user-management__grid business-user-management__grid--two">
                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Start Date</span>
                  <input v-model="employeeDraft.startDate" type="date" />
                </label>

                <label class="business-user-management__field business-user-management__field--sheet">
                  <span>Employee Status</span>
                  <select v-model="employeeDraft.status">
                    <option v-for="status in employeeStatusOptions" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </label>
              </div>
            </section>

            <div v-if="selectedEmployeeRole" class="business-user-management__role-preview">
              <div class="business-user-management__role-preview-head">
                <span class="business-user-management__panel-chip">{{ selectedEmployeeRole.name }}</span>
              </div>
              <div class="business-user-management__inline-meta business-user-management__inline-meta--sheet">
                <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleSummary }}</span>
                <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleModules }}</span>
              </div>
            </div>

            <section v-if="selectedEmployeeRole" class="business-user-management__access-panel business-user-management__access-panel--drawer">
              <div class="business-user-management__panel-head">
                <div>
                  <p class="business-user-management__panel-label">Module Access</p>
                  <h3>{{ selectedEmployeeRole.name }} role access</h3>
                  <p class="business-user-management__panel-copy">This shows exactly which tools the member can open, edit, or fully manage after they are added.</p>
                </div>
                <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleSummary }}</span>
              </div>

              <div class="business-user-management__drawer-module-summary">
                <div class="business-user-management__drawer-module-pill">
                  <strong>{{ countPermissionRoleEnabledModules(selectedEmployeeRole) }}</strong>
                  <span>Visible Modules</span>
                </div>
                <div class="business-user-management__drawer-module-pill">
                  <strong>{{ countPermissionRoleFullAccessModules(selectedEmployeeRole) }}</strong>
                  <span>Full Access</span>
                </div>
                <div class="business-user-management__drawer-module-pill">
                  <strong>{{ Math.max((selectedEmployeeRole?.modules?.length || 0) - countPermissionRoleEnabledModules(selectedEmployeeRole), 0) }}</strong>
                  <span>Hidden</span>
                </div>
              </div>

              <div class="business-user-management__access-sections">
                <article
                  v-for="section in selectedEmployeeRoleModuleSections"
                  :key="section.id"
                  class="business-user-management__access-group"
                >
                  <div class="business-user-management__access-group-head">
                    <span class="business-user-management__access-group-title">
                      <i :class="section.icon" aria-hidden="true" />
                      {{ section.label }}
                    </span>
                  </div>

                  <div class="business-user-management__access-list">
                    <div
                      v-for="module in section.modules"
                      :key="module.id"
                      class="business-user-management__access-item"
                    >
                      <div class="business-user-management__access-copy">
                        <strong>{{ module.label }}</strong>
                        <small>{{ module.description }}</small>
                      </div>
                      <span
                        class="business-user-management__access-badge"
                        :class="{
                          'is-full': module.permissions.full,
                          'is-edit': module.permissions.edit && !module.permissions.full,
                          'is-view': module.permissions.view && !module.permissions.edit && !module.permissions.full,
                          'is-hidden': !module.permissions.view,
                        }"
                      >
                        {{ module.accessLabel }}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <div class="business-user-management__actions business-user-management__actions--sheet">
              <button
                type="button"
                class="business-user-management__action-btn business-user-management__action-btn--secondary"
                @click="employeeDraft = createDefaultEmployeeDraft()"
              >
                <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                Clear Form
              </button>
              <button type="button" class="business-user-management__action-btn business-user-management__action-btn--primary" @click="saveStaticEmployee">
                <i class="bi bi-check-circle" aria-hidden="true" />
                Continue and Add Member
              </button>
            </div>
          </fieldset>
        </aside>
      </div>
    </Transition>

  </div>
</template>
