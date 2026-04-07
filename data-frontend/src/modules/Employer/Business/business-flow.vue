<script setup>
// Taglish guide: Ito ang main container ng buong business workspace kaya halo-halo rito ang dashboard, hiring, training, at payment flow.
// Hinati ko ang comments sa section para mas madaling sundan kahit isang file lang nakaipon ang maraming logic.

import { computed, defineAsyncComponent, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { useRoute, useRouter } from 'vue-router'
import AppToast from '@/components/AppToast.vue'
import BModals from '@/modules/Employer/Business/modals.vue'
import BIssueOfferModal from '@/modules/Employer/Business/business_issue_offer.vue'
import BNavbar from '@/modules/Employer/Business/business_Navbar.vue'
import BSidebar from '@/modules/Employer/Business/business_Sidebar.vue'
import BUserNavbar from '@/modules/Employer/Business/business_user_navbar.vue'
import BUserSidebar from '@/modules/Employer/Business/business_user_sidebar.vue'
import {
  approveApplicantManagementApplicationProcess,
  approveBusinessInterviewRescheduleRequestProcess,
  assignAssessmentTemplateToApplicantProcess,
  assignTrainingTemplateToMemberProcess,
  completeBusinessInterviewScheduleProcess,
  completeTrainingTrackingAssignmentProcess,
  createBusinessInterviewScheduleProcess,
  rejectApplicantManagementApplicationProcess,
  rejectBusinessInterviewRescheduleRequestProcess,
  removeAssignedAssessmentFromApplicantProcess,
  removeAssignedTrainingTemplateFromMemberProcess,
  saveTrainingTrackingCategoryRemarkProcess,
  setTrainingAssignmentSkillGradeProcess,
  syncAssignedApplicantAssessmentScoresProcess,
  toggleTrainingAssignmentSkillCompletionProcess,
} from '@/modules/Employer/Business/business_flow_backend'
import { createApplicantBindings, createApplicantState } from '@/modules/Employer/Business/business_applicant_bindings'
import { createAssessmentBindings } from '@/modules/Employer/Business/business_assessment_bindings'
import { createDashboardBindings, createDashboardState } from '@/modules/Employer/Business/business_dashboard_bindings'
import { createInterviewBindings } from '@/modules/Employer/Business/business_interview_bindings'
import { createRecruitmentBindings } from '@/modules/Employer/Business/business_recruitment_bindings'
import {
  createModalBindings,
  createNavbarBindings,
  createSidebarBindings,
} from '@/modules/Employer/Business/business_shell_bindings'
import {
  createPaymentBindings,
  createPaymentHistoryBindings,
  createSubscriptionBindings,
} from '@/modules/Employer/Business/business_subscription_bindings'
import {
  createPermissionBindings,
  createTeamMemberBindings,
} from '@/modules/Employer/Business/business_team_member_bindings'
import { createTrainingBindings } from '@/modules/Employer/Business/business_training_bindings'
import pwdLogo from '@/assets/logo-pwd.png'
import gcashPaymentLogo from '@/assets/gcash-payment.png'
import masterCardLogo from '@/assets/master-card.png'
import { auth, cloudFunctions } from '@/firebase'
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
  subscribeToBusinessApplicantScores,
} from '@/lib/business_applicant_scores'
import {
  migrateBusinessPaymentHistoryEntries,
  saveBusinessPaymentHistoryEntry,
  subscribeToBusinessPaymentHistory,
} from '@/lib/business_payment_history'
import {
  createContractSigningProviderSession,
  saveBusinessContractRecord,
  signBusinessContractRecord,
  subscribeToBusinessContracts,
  syncContractSigningProviderStatus,
} from '@/lib/contract_signing'
import {
  createBusinessJobPost,
  deleteBusinessJobPost,
  subscribeToWorkspaceJobs,
  updateBusinessJobPost,
} from '@/lib/jobs'
import { saveBusinessJobOfferRecord } from '@/lib/job_offers'
import { subscribeToBusinessJobApplications, updateApplicantJobApplicationStatus } from '@/lib/apply_jobs'
import { saveBusinessInterviewSchedule, subscribeToBusinessInterviewSchedules } from '@/lib/business_interviews'
import { mediaUrl } from '@/lib/media'
import {
  deleteBusinessAssessmentAssignmentRecord,
  deleteBusinessAssessmentTemplateRecord,
  deleteBusinessTrainingAssignmentRecord,
  deleteBusinessTrainingTemplateRecord,
  saveBusinessAssessmentAssignmentRecord,
  saveBusinessAssessmentTemplateRecord,
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

// Core workspace session, persisted local storage keys, at top-level UI state nagsisimula rito.
const route = useRoute()
const router = useRouter()
const renderBusinessAsyncStateCard = ({ title = '', message = '', isError = false, onAction = null, actionLabel = '' } = {}) =>
  h('section', { class: 'business-content__empty' }, [
    h('article', { class: ['business-content__empty-card', isError ? 'business-content__empty-card--error' : ''] }, [
      h('strong', String(title || '').trim() || 'Business Workspace'),
      h('p', String(message || '').trim() || 'Please wait while the workspace loads.'),
      onAction
        ? h('div', { class: 'business-content__empty-action-row' }, [
            h(
              'button',
              {
                type: 'button',
                class: 'business-content__empty-button',
                onClick: onAction,
              },
              String(actionLabel || '').trim() || 'Reload Workspace',
            ),
          ])
        : null,
    ]),
  ])

const BusinessAsyncLoadingState = defineComponent({
  name: 'BusinessAsyncLoadingState',
  setup() {
    return () =>
      renderBusinessAsyncStateCard({
        title: 'Opening business workspace...',
        message: 'The section is still loading, so I kept a visible loading card here instead of leaving a blank panel.',
      })
  },
})

const BusinessAsyncErrorState = defineComponent({
  name: 'BusinessAsyncErrorState',
  setup() {
    const reloadWorkspace = () => {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }

    return () =>
      renderBusinessAsyncStateCard({
        title: 'Business section failed to load',
        message: 'This section did not finish loading. Reload the workspace to recover instead of staying on a blank screen.',
        isError: true,
        onAction: reloadWorkspace,
        actionLabel: 'Reload Workspace',
      })
  },
})

const createBusinessAsyncSection = (loader, label) =>
  defineAsyncComponent({
    loader,
    delay: 120,
    timeout: 15000,
    loadingComponent: BusinessAsyncLoadingState,
    errorComponent: BusinessAsyncErrorState,
    onError(error, retry, fail, attempts) {
      console.error(`[business-workspace] failed to load ${label}:`, error)
      if (attempts <= 1) {
        retry()
        return
      }

      fail()
    },
  })

const BDashboard = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business-dashboard.vue'), 'dashboard section')
const BRecruitment = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business-job-posting.vue'), 'recruitment section')
const BApplicant = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business-applicant-management.vue'), 'applicant section')
const BTeamMember = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_TeamMember.vue'), 'team member section')
const BAssesment = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_Assesment.vue'), 'assessment section')
const BInterview = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_Interview.vue'), 'interview section')
const BTraining = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_Training.vue'), 'training section')
const BSubscription = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_Subscription.vue'), 'subscription section')
const BPayment = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_Payment.vue'), 'payment section')
const BPaymentHistory = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_PaymentHistory.vue'), 'payment history section')
const BIssueOffer = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_IssueOffer.vue'), 'issue offer section')
const BContractSigning = createBusinessAsyncSection(() => import('@/modules/Employer/Business/business_ContractSigning.vue'), 'contract signing section')

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
const BUSINESS_WORKSPACE_FORCE_DASHBOARD_KEY = 'businessWorkspaceForceDashboard'
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
  const employerType = normalizeEmployerOrganizationType(storedUser)
  if (['applicant', 'admin', 'system_admin'].includes(normalizedRole)) return null

  const hasWorkspaceRole = String(storedUser?.roleId || storedUser?.permissionRoleId || '').trim() !== ''
  const workspaceOwnerId = String(storedUser?.workspace_owner_id || storedUser?.workspaceOwnerId || '').trim()
  const userId = String(storedUser?.id || storedUser?.uid || '').trim()
  const workspaceOwnerEmail = String(storedUser?.workspace_owner_email || storedUser?.workspaceOwnerEmail || '').trim().toLowerCase()
  const userEmail = String(storedUser?.email || storedUser?.gmail || storedUser?.business_contact_email || '').trim().toLowerCase()
  const isWorkspaceMember =
    storedUser?.workspace_member === true
    || (workspaceOwnerId && userId && workspaceOwnerId !== userId)
    || (!workspaceOwnerId && workspaceOwnerEmail && userEmail && workspaceOwnerEmail !== userEmail)

  const isBusinessWorkspaceUser =
    employerType === 'business'
    && (hasWorkspaceRole || isWorkspaceMember)
    && (workspaceOwnerId || workspaceOwnerEmail || isWorkspaceMember)

  const isBusinessOwner =
    employerType === 'business' && !isWorkspaceMember

  return isBusinessOwner || isBusinessWorkspaceUser ? storedUser : null
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
const normalizePaymentToastState = (value) => {
  const nextValue = value && typeof value === 'object' ? value : {}
  const nextActions = Array.isArray(nextValue.actions) ? nextValue.actions : []

  return {
    ...createPaymentToastState(),
    ...nextValue,
    actions: nextActions,
  }
}
const paymentToast = reactive(createPaymentToastState())
const assignPaymentToastState = (value) => {
  Object.assign(paymentToast, normalizePaymentToastState(value))
}
const businessWorkspaceToast = computed(() =>
  paymentToast.visible
    ? {
        title: paymentToast.title,
        text: paymentToast.message,
        kind: paymentToast.tone,
        actions: paymentToast.actions,
      }
    : null,
)
const paymentContactCountryCode = ref('PH')
const isPaymentContactCountryDropdownOpen = ref(false)
const paymentContactCountryDropdownRef = ref(null)
const isNotificationMenuOpen = ref(false)
const isBusinessNotificationDetailOpen = ref(false)
const selectedBusinessNotification = ref(null)
const businessNotifications = ref([])
const BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY = 'businessSeenNotificationIds'
const BUSINESS_DELIVERED_NOTIFICATION_TOAST_STORAGE_KEY = 'businessDeliveredNotificationToastIds'
const seenBusinessNotificationIds = ref([])
const hasBusinessNotificationFeedHydrated = ref(false)
const businessDeliveredNotificationToastIds = ref([])
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
let assignedApplicantScoreSyncTimeoutId = null
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
let stopBusinessContractSync = () => {}
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
  { id: 'issue-offer', label: 'Issue Offer', icon: 'bi bi-envelope-paper-fill' },
  { id: 'contract-signing', label: 'Contract Signing', icon: 'bi bi-pen-fill' },
  { id: 'assessment-management', label: 'Assessment Management', icon: 'bi bi-ui-checks-grid' },
  { id: 'applicant-score', label: 'Applicant Score', icon: 'bi bi-bar-chart-fill' },
  { id: 'interview-scheduling', label: 'Interview Scheduling', icon: 'bi bi-calendar-event-fill' },
  { id: 'training-templates', label: 'Training Templates', icon: 'bi bi-journal-text' },
  { id: 'user-overview', label: 'Team Overview', icon: 'bi bi-people' },
  { id: 'create-user', label: 'Create User', icon: 'bi bi-person-plus-fill' },
  { id: 'add-employee', label: 'Employee Directory', icon: 'bi bi-person-vcard-fill' },
  { id: 'permissions', label: 'Permissions', icon: 'bi bi-shield-lock-fill' },
]
const premiumCelebrationPieces = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

// Dito pinagsasama ang local notifications at admin/RBAC notices para iisang navbar feed lang ang babantayan.
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

const normalizeBusinessNotificationStorageOwner = (value = currentBusinessAccountIdentity.value) =>
  String(value || '').trim().toLowerCase() || 'default'

const resolveBusinessNotificationStorageKey = (baseKey, owner = currentBusinessAccountIdentity.value) =>
  `${String(baseKey || '').trim()}:${normalizeBusinessNotificationStorageOwner(owner)}`

const readBusinessStoredNotificationIds = (baseKey, owner = currentBusinessAccountIdentity.value) => {
  if (typeof window === 'undefined') return []

  try {
    const scopedValue = window.localStorage.getItem(resolveBusinessNotificationStorageKey(baseKey, owner))
    const storedValue = scopedValue ?? (baseKey === BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY ? window.localStorage.getItem(baseKey) : null)
    const parsedValue = storedValue ? JSON.parse(storedValue) : []
    return Array.isArray(parsedValue)
      ? parsedValue.map((value) => String(value || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

const writeBusinessStoredNotificationIds = (baseKey, values = [], owner = currentBusinessAccountIdentity.value) => {
  if (typeof window === 'undefined') return

  try {
    const normalizedValues = [...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    )]
    window.localStorage.setItem(resolveBusinessNotificationStorageKey(baseKey, owner), JSON.stringify(normalizedValues))
  } catch {
    // Keep notifications usable even if storage is unavailable.
  }
}

const readSeenBusinessNotificationIds = (owner = currentBusinessAccountIdentity.value) =>
  readBusinessStoredNotificationIds(BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY, owner)

const persistSeenBusinessNotificationIds = (owner = currentBusinessAccountIdentity.value) => {
  writeBusinessStoredNotificationIds(BUSINESS_SEEN_NOTIFICATION_STORAGE_KEY, seenBusinessNotificationIds.value, owner)
}

const syncBusinessDeliveredNotificationToastIds = (notificationIds = [], owner = currentBusinessAccountIdentity.value) => {
  const normalizedIds = [...new Set(
    (Array.isArray(notificationIds) ? notificationIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )]

  businessDeliveredNotificationToastIds.value = normalizedIds
  writeBusinessStoredNotificationIds(BUSINESS_DELIVERED_NOTIFICATION_TOAST_STORAGE_KEY, normalizedIds, owner)
}

const rememberBusinessDeliveredNotificationToastIds = (notificationIds = [], owner = currentBusinessAccountIdentity.value) => {
  syncBusinessDeliveredNotificationToastIds([
    ...businessDeliveredNotificationToastIds.value,
    ...(Array.isArray(notificationIds) ? notificationIds : []),
  ], owner)
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
    kind: 'admin-access-update',
  }
}

const pushBusinessNotification = ({
  title = '',
  message = '',
  tone = 'info',
  section = activeSection.value || 'dashboard',
  applicationId = '',
} = {}) => {
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
      section: String(section || activeSection.value || 'dashboard').trim() || 'dashboard',
      applicationId: String(applicationId || '').trim(),
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
  [...businessNotifications.value, ...businessApplicationNotifications.value, ...businessJobOfferNotifications.value, ...businessSystemNotifications.value]
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

const BUSINESS_OWNER_NAVBAR_SETTINGS_ITEMS = [
  { label: 'Personalization', icon: 'bi bi-sliders2' },
  { label: 'Help Center', icon: 'bi bi-life-preserver' },
  { label: 'Terms & Policies', icon: 'bi bi-file-earmark-text' },
  { label: 'Upgrade Plan', icon: 'bi bi-stars' },
]
const BUSINESS_WORKSPACE_USER_NAVBAR_SETTINGS_ITEMS = BUSINESS_OWNER_NAVBAR_SETTINGS_ITEMS.filter(
  (item) => !['Upgrade Plan', 'Personalization'].includes(item.label),
)

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

const mapBusinessNotificationToastTone = (tone = '') => {
  const normalizedTone = String(tone || '').trim().toLowerCase()
  if (normalizedTone === 'danger' || normalizedTone === 'error') return 'error'
  if (normalizedTone === 'warning') return 'warning'
  if (normalizedTone === 'success') return 'success'
  return 'info'
}

const previewBusinessNotification = (notification = {}) => {
  const title = String(notification?.title || 'Notification').trim() || 'Notification'
  const message = String(notification?.message || notification?.copy || title).trim()
  if (!message) return

  showPaymentToast(message, mapBusinessNotificationToastTone(notification?.tone), {
    title,
  })
}

const isBusinessAutoToastNotification = (notification = {}) =>
  String(notification?.kind || '').trim() !== 'admin-access-update'

const notifyBusinessActivity = (notification = {}) => {
  if (!isBusinessAutoToastNotification(notification)) return
  previewBusinessNotification(notification)
}

const resolveBusinessNotificationSectionLabel = (value = '') => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'applicant-management') return 'Applicant Management'
  if (normalizedValue === 'issue-offer') return 'Issue Offer'
  if (normalizedValue === 'contract-signing') return 'Contract Signing'
  if (normalizedValue === 'job-posting') return 'Job Posting'
  if (normalizedValue === 'interview-scheduling') return 'Interview Scheduling'
  if (normalizedValue === 'assessment-management') return 'Assessment Management'
  if (normalizedValue === 'training-templates') return 'Training Templates'
  if (normalizedValue === 'subscriptions') return 'Subscriptions'
  if (normalizedValue === 'profile') return 'Business Profile'
  if (normalizedValue === 'dashboard') return 'Dashboard'
  if (normalizedValue === 'user-overview') return 'User Overview'
  if (normalizedValue === 'permissions') return 'Permissions'
  return 'Workspace'
}

const openBusinessNotificationDetail = (notification = {}) => {
  const normalizedNotification = notification && typeof notification === 'object' ? notification : {}
  selectedBusinessNotification.value = {
    ...normalizedNotification,
    title: String(normalizedNotification?.title || 'Notification').trim() || 'Notification',
    message: String(
      normalizedNotification?.message
      || normalizedNotification?.copy
      || normalizedNotification?.title
      || 'There is a new workspace update.',
    ).trim(),
    section: String(normalizedNotification?.section || '').trim(),
    sectionLabel: resolveBusinessNotificationSectionLabel(normalizedNotification?.section),
    timeLabel: String(normalizedNotification?.createdAtLabel || '').trim()
      || formatBusinessNotificationTime(new Date(normalizedNotification?.createdAt || Date.now())),
  }
  isBusinessNotificationDetailOpen.value = true
}

const closeBusinessNotificationDetail = () => {
  isBusinessNotificationDetailOpen.value = false
  selectedBusinessNotification.value = null
}

const businessNotificationPrimaryActionLabel = computed(() => {
  const notification = selectedBusinessNotification.value || {}
  const targetSection = String(notification?.section || '').trim()
  if (String(notification?.applicationId || '').trim()) return 'Open applicant'
  if (targetSection === 'subscriptions') return 'Open subscriptions'
  if (targetSection === 'profile') return 'Open profile'
  if (targetSection) return `Open ${String(notification?.sectionLabel || 'section').trim()}`
  return 'Open workspace'
})

const openBusinessNotificationTarget = () => {
  const matchedNotification = selectedBusinessNotification.value || {}
  const targetSection = String(matchedNotification?.section || '').trim()
  const targetApplicationId = String(matchedNotification?.applicationId || '').trim()

  closeBusinessNotificationDetail()

  if (targetApplicationId) {
    activeSection.value = 'applicant-management'
    void nextTick(() => {
      openApplicantManagementDecision(targetApplicationId, 'view')
    })
    return
  }

  if (targetSection === 'subscriptions') {
    openBusinessSubscriptionSection()
    return
  }

  if (targetSection === 'profile') {
    activeSection.value = 'profile'
    return
  }

  if (targetSection && availableSidebarSectionIds.value.includes(targetSection)) {
    activeSection.value = targetSection
    return
  }

  if (availableSidebarSectionIds.value.includes('dashboard')) {
    activeSection.value = 'dashboard'
    return
  }

  activeSection.value = resolveFirstAvailableBusinessSection()
}

const openBusinessNotification = (notificationId) => {
  const targetId = String(notificationId || '').trim()
  markBusinessNotificationsAsRead(
    businessNavbarNotifications.value.filter((notification) => !targetId || notification.id === targetId),
  )
  const matchedNotification = businessNavbarNotifications.value.find((notification) => notification.id === targetId)
  if (!matchedNotification) {
    isNotificationMenuOpen.value = false
    showPaymentToast('That notification could not be opened right now.', 'warning')
    return
  }

  openBusinessNotificationDetail(matchedNotification)
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

// Sidebar structure at visible modules dito dumadaan para automatic sumunod sa current workspace permissions.
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
        {
          id: 'issue-offer',
          label: 'Issue Offer',
        },
        {
          id: 'contract-signing',
          label: 'Contract Signing',
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
          label: 'Team Overview',
        },
        {
          id: 'create-user',
          label: 'Create User',
        },
        {
          id: 'add-employee',
          label: 'Employee Directory',
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
        item.id === 'dashboard'
          ? true
          : item.id === 'training-templates'
          ? canViewTrainingWorkspace()
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

const canRestoreBusinessViewStateForCurrentUser = (state = {}) => {
  const persistedUserId = String(state?.sessionUserId || state?.session_user_id || '').trim()
  const currentUserId = String(authUser.value?.id || authUser.value?.uid || '').trim()

  if (!persistedUserId || !currentUserId) return false
  return persistedUserId === currentUserId
}

const restoreBusinessWorkspaceViewState = (state = {}) => {
  const nextSection = canRestoreBusinessViewStateForCurrentUser(state)
    ? resolveAccessibleBusinessSection(resolvePersistedBusinessSection(state?.activeSection))
    : resolveFirstAvailableBusinessSection()
  const shouldReturnToWorkspaceLanding = nextSection === 'subscriptions'
    && hasOwnerWorkspaceAccess.value
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
  subscriptionView.value = canRestoreBusinessViewStateForCurrentUser(state)
    ? resolvePersistedBusinessSubscriptionView(state?.subscriptionView)
    : 'plans'
}

const hasUnlockedBusinessWorkspace = computed(() => Boolean(authUser.value))
const showBusinessSidebar = computed(() => true)
const availableSidebarSectionIds = computed(() =>
  sidebarGroups.value.flatMap((group) => group.items.map((item) => item.id)),
)
const resolveFirstAvailableBusinessSection = () =>
  availableSidebarSectionIds.value[0] || 'dashboard'

const getSidebarItemIcon = (itemId = '') =>
  premiumNavigationItems.find((item) => item.id === itemId)?.icon
  || ({
    'job-posting': 'bi bi-megaphone-fill',
    'applicant-management': 'bi bi-people-fill',
    'issue-offer': 'bi bi-envelope-paper-fill',
    'contract-signing': 'bi bi-pen-fill',
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
    description: 'Review applicants, keep your shortlist clean, and move candidates forward through each hiring stage.',
    cards: [
      { title: 'New Applicants', copy: 'Open the newest candidate submissions and review their fit for your roles.' },
      { title: 'Shortlist Queue', copy: 'Keep promising applicants organized so the next steps are easier to manage.' },
      { title: 'Interview Tracking', copy: 'Monitor who is ready for interview and what follow-up is still pending.' },
    ],
  },
  'issue-offer': {
    title: 'Issue Offer',
    description: 'Preview the merged offer queue so approved applicants and interview passers can receive job offers inside the business workspace.',
    cards: [
      { title: 'Offer Queue', copy: 'See which applicants are ready for job offer drafting without leaving the main recruitment flow.' },
      { title: 'Offer Modal', copy: 'Open a guided preview modal for compensation, start date, and offer letter details.' },
      { title: 'Pilot Review', copy: 'Use this preview branch to check the layout and sequence before the final live merge.' },
    ],
  },
  'contract-signing': {
    title: 'Contract Signing',
    description: 'Preview the post-offer contract handling page before we fully wire the live signing flow into the current workspace.',
    cards: [
      { title: 'Accepted Queue', copy: 'See the applicants who would move next into contract preparation once offers are confirmed.' },
      { title: 'Draft Contract', copy: 'Review how the contract editor and signature panel would look in the merged version.' },
      { title: 'Countersign Flow', copy: 'Pilot the page structure first so the full merge can stay cleaner and safer.' },
    ],
  },
  'assessment-management': {
    title: 'Assessment Management',
    description: 'Organize role-based assessments, keep reusable screening flows ready, and manage evaluation content in one place.',
    cards: [
      { title: 'Assessment Library', copy: 'Keep reusable screening templates ready for different job openings and hiring stages.' },
      { title: 'Draft Reviews', copy: 'Track assessments that still need updates before they are assigned to applicants.' },
      { title: 'Stage Mapping', copy: 'Decide where each assessment belongs in the recruitment flow before interviews begin.' },
    ],
  },
  'applicant-score': {
    title: 'Applicant Score',
    description: 'Review applicant scores, compare ranked candidates, and keep score-based decisions visible across your pipeline.',
    cards: [
      { title: 'Score Overview', copy: 'See which applicants are closest to the next hiring step with a clear scoring summary.' },
      { title: 'Category Breakdown', copy: 'Compare technical fit, communication, and training readiness in one summary.' },
      { title: 'Decision Queue', copy: 'Keep high-scoring candidates grouped together so follow-up actions stay organized.' },
    ],
  },
  'interview-scheduling': {
    title: 'Interview Scheduling',
    description: 'Plan interview slots, track assigned interviewers, and manage upcoming sessions in one scheduling flow.',
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
    description: 'Match training templates to applicants or employees and keep assignments organized from one workspace.',
    cards: [
      { title: 'Assignment Queue', copy: 'Keep a visible list of people who are ready to receive onboarding or upskilling templates.' },
      { title: 'Template Matching', copy: 'Pair each role with the most relevant training template before rollout starts.' },
      { title: 'Completion Review', copy: 'Track who has been assigned content and what still needs follow-up.' },
    ],
  },
  employees: {
    title: 'User Management',
    description: 'Review employee records, onboarding progress, and workspace access in one team management view.',
    cards: [
      { title: 'Employee Directory', copy: 'Keep your current team list visible with quick access to role and department details.' },
      { title: 'Onboarding Status', copy: 'Track which employees still need templates, interviews, or permissions updates.' },
      { title: 'Workspace Access', copy: 'Review who should be able to manage recruitment, assessments, and training tools.' },
    ],
  },
  permissions: {
    title: 'Permissions',
    description: 'Control access to recruitment, assessment, interview, training, and employee tools from one permissions panel.',
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

// Dashboard state moved to business_dashboard_bindings.js.

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
const JOB_POSTING_MAX_VACANCIES = 100
const JOB_POSTING_MAX_DESCRIPTION_WORDS = 500
const JOB_POSTING_MAX_REQUIREMENT_WORDS = 100

// Job posting builder state at CRUD helpers nagsisimula rito dahil itong file rin ang nagho-host ng posting UI.
const resolveJobPostingBusinessCategory = (fallback = '') =>
  String(profileForm.value.category || businessCategory.value || fallback || '').trim()

const createJobPostingDraft = () => ({
  title: '',
  description: '',
  category: resolveJobPostingBusinessCategory(),
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
const jobPostingCategoryValue = computed(() =>
  resolveJobPostingBusinessCategory(jobPostingDraft.value.category),
)
const jobPostingCategoryLabel = computed(() =>
  jobPostingCategoryValue.value || 'Set business category in profile',
)
const jobPostingPreviewStatusLabel = computed(() => normalizePostedJobStatus(jobPostingDraft.value.status))
const jobPostingCreatedPreview = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
}).format(new Date())
const JOB_POSTING_DISABILITY_TYPE_LOOKUP = new Map(
  JOB_POSTING_DISABILITY_TYPES.map((entry) => [
    String(entry?.value || '').trim(),
    String(entry?.label || entry?.value || '').trim(),
  ]),
)
const normalizeJobPostingDisabilityTypes = (value) => {
  const sourceValues = Array.isArray(value) ? value : [value]

  return [...new Set(
    sourceValues
      .flatMap((entry) => String(entry || '').split(/[\r\n,]+/))
      .map((entry) => entry.trim())
      .filter(Boolean),
  )]
}
const serializeJobPostingDisabilityTypes = (value) =>
  normalizeJobPostingDisabilityTypes(value).join(', ')
const resolveJobPostingDisabilityTypeLabel = (value) =>
  JOB_POSTING_DISABILITY_TYPE_LOOKUP.get(String(value || '').trim()) || String(value || '').trim()
const jobPostingQualificationsPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.qualifications))
const jobPostingResponsibilitiesPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.responsibilities))
const jobPostingSelectedDisabilityTypes = computed(() =>
  normalizeJobPostingDisabilityTypes(jobPostingDraft.value.disabilityType),
)
const jobPostingDisabilityTypeNeedsSpecification = computed(() =>
  jobPostingSelectedDisabilityTypes.value.some((entry) =>
    JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(entry || '').trim()),
  ),
)
const jobPostingTypeLabel = computed(() =>
  String(jobPostingDraft.value.type || '').trim() || 'Select job type',
)
const jobPostingBarangayLabel = computed(() =>
  JOB_POSTING_BARANGAYS.find((entry) => entry.value === jobPostingDraft.value.barangay)?.label || 'Select barangay',
)
const jobPostingDisabilityLabel = computed(() => {
  const selectedLabels = jobPostingSelectedDisabilityTypes.value
    .map((entry) => resolveJobPostingDisabilityTypeLabel(entry))
    .filter(Boolean)

  if (!selectedLabels.length) return 'Select disability types'
  if (selectedLabels.length <= 2) return selectedLabels.join(', ')
  return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`
})
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
  category: resolveJobPostingBusinessCategory(record.category || 'General') || 'General',
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
  disabilityType: serializeJobPostingDisabilityTypes(record.disabilityType || record.disabilityTypes),
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
const syncPostedJobRecordLocally = (record = {}) => {
  const nextRecord = createPostedJobRecord(record)
  if (!nextRecord.id) return

  postedJobs.value = [
    nextRecord,
    ...postedJobs.value.filter((job) => String(job?.id || '').trim() !== nextRecord.id),
  ].sort((left, right) => {
    const leftTime = Date.parse(String(left?.updatedAt || left?.createdAt || '')) || 0
    const rightTime = Date.parse(String(right?.updatedAt || right?.createdAt || '')) || 0
    return rightTime - leftTime
  })
}
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
  category: resolveJobPostingBusinessCategory(job.category),
  type: String(job.workType || '').trim(),
  location: String(job.city || 'Dasmarinas City').trim() || 'Dasmarinas City',
  barangay: String(job.barangay || '').trim(),
  vacancies: String(job.vacancies || ''),
  salaryRange: String(job.salaryRange || job.salary || '').trim(),
  disabilityType: serializeJobPostingDisabilityTypes(job.disabilityType || job.disabilityTypes),
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
          return `The job post "${normalizedJobTitle}" was deleted by the business. The interview was cancelled and the application was discontinued.`
        }
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
        const relatedTrainingAssignments = trainingAssignmentRecords.value.filter((record) =>
          affectedApplicationIds.has(String(record?.applicationId || record?.application_id || record?.id || record?.memberId || '').trim())
          || String(record?.jobId || record?.job_id || '').trim() === normalizedJobId)
        const relatedApplicantScoreEntries = applicantAssessmentScoreEntries.value.filter((entry) =>
          affectedApplicationIds.has(String(entry?.id || '').trim()))
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
            deleteBusinessAssessmentAssignmentRecord(String(assignment?.id || assignment?.applicationId || assignment?.application_id || '').trim())),
          ...relatedApplicantScoreEntries.map((entry) =>
            deleteBusinessApplicantScoreRecord(String(entry?.id || '').trim())),
          ...relatedTrainingAssignments.map((assignment) =>
            deleteBusinessTrainingAssignmentRecord(
              String(assignment?.id || assignment?.applicationId || assignment?.application_id || assignment?.memberId || '').trim(),
            )),
        ])

        await deleteBusinessJobPost(normalizedJobId, {
          workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
        })

        assessmentAssignmentRecords.value = assessmentAssignmentRecords.value.filter((record) =>
          !affectedApplicationIds.has(String(record?.applicationId || record?.application_id || record?.id || '').trim()))
        applicantAssessmentScoreEntries.value = applicantAssessmentScoreEntries.value.filter((entry) =>
          !affectedApplicationIds.has(String(entry?.id || '').trim()))
        trainingAssignmentRecords.value = trainingAssignmentRecords.value.filter((record) => {
          const applicationId = String(record?.applicationId || record?.application_id || record?.id || record?.memberId || '').trim()
          const jobId = String(record?.jobId || record?.job_id || '').trim()
          return !affectedApplicationIds.has(applicationId) && jobId !== normalizedJobId
        })
        rebuildApprovedApplicantAssignments()
        rebuildTrainingAssignments()

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
    title: 'Team Overview',
    description: 'See a quick summary of workspace users and linked team members.',
  },
  'create-user': {
    title: 'Create User',
    description: 'Create a login and assign a saved role.',
  },
  permissions: {
    title: 'Permissions',
    description: 'Create roles, update module access, and return to Create User when the role is ready to assign.',
  },
  'add-employee': {
    title: 'Employee Directory',
    description: 'Review linked employee profiles in one clean list.',
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
const resolveBusinessApplicationAppliedAt = (application = {}) =>
  String(
    application?.appliedAt
    || application?.applied_at
    || application?.submittedAt
    || application?.submitted_at
    || application?.createdAt
    || application?.created_at
    || '',
  ).trim()
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
      `User account created for ${user?.email || normalizedGmail}. You can now see it in Team Overview.`,
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
      { id: 'issue-offer', label: 'Issue Offer', description: 'Preview and prepare job offers for approved or interview-pass applicants.' },
      { id: 'contract-signing', label: 'Contract Signing', description: 'Preview contract sending and countersigning after offer acceptance.' },
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
      { id: 'user-overview', label: 'Team Overview', description: 'See user counts, linked members, and team status at a glance.' },
      { id: 'create-user', label: 'Create User', description: 'Create workspace users and assign saved roles.' },
      { id: 'add-employee', label: 'Employee Directory', description: 'Review linked employee profiles and member records.' },
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
      'issue-offer',
      'contract-signing',
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
const isWorkspaceMemberBusinessAccount = (user = authUser.value) => {
  const workspaceOwnerId = String(user?.workspace_owner_id || user?.workspaceOwnerId || '').trim()
  const userId = String(user?.id || user?.uid || '').trim()
  const workspaceOwnerEmail = String(user?.workspace_owner_email || user?.workspaceOwnerEmail || '').trim().toLowerCase()
  const userEmail = String(user?.email || user?.gmail || user?.business_contact_email || '').trim().toLowerCase()

  if (user?.workspace_member === true) return true
  if (workspaceOwnerId && userId && workspaceOwnerId !== userId) return true
  if (!workspaceOwnerId && workspaceOwnerEmail && userEmail && workspaceOwnerEmail !== userEmail) return true

  return false
}
const isCurrentWorkspaceMember = computed(() =>
  isWorkspaceMemberBusinessAccount(authUser.value),
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
  if (isCurrentWorkspaceMember.value) return false
  if (normalizedRole === 'employer') return true
  return normalizeEmployerOrganizationType(authUser.value) === 'business'
})
const isBusinessEmployeeWorkspaceMode = computed(() => isCurrentWorkspaceMember.value)
const businessWorkspaceOwnerName = computed(() =>
  String(
    authUser.value?.workspace_owner_name
    || authUser.value?.workspaceOwnerName
    || authUser.value?.company_name
    || authUser.value?.name
    || 'Business Workspace',
  ).trim() || 'Business Workspace',
)
const loggedInBusinessUserName = computed(() =>
  String(
    isCurrentWorkspaceMember.value
      ? currentWorkspacePermissionUser.value?.name
        || authUser.value?.name
      : authUser.value?.name
        || currentWorkspacePermissionUser.value?.name
    || businessWorkspaceOwnerName.value
    || 'Workspace User',
  ).trim() || 'Workspace User',
)
const loggedInBusinessUserEmail = computed(() =>
  String(
    authUser.value?.email
    || authUser.value?.gmail
    || currentWorkspacePermissionUser.value?.email
    || currentWorkspacePermissionUser.value?.gmail
    || authUser.value?.business_contact_email
    || 'workspace@local',
  ).trim().toLowerCase() || 'workspace@local',
)
const loggedInBusinessUserInitials = computed(() => {
  const parts = loggedInBusinessUserName.value.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'WU'
})
const loggedInBusinessUserAvatar = computed(() =>
  String(
    isCurrentWorkspaceMember.value
      ? currentWorkspacePermissionUser.value?.avatar
        || currentWorkspacePermissionUser.value?.profileImage
        || authUser.value?.avatar
        || authUser.value?.profile_image
      : authUser.value?.avatar
        || authUser.value?.profile_image
        || currentWorkspacePermissionUser.value?.avatar
        || currentWorkspacePermissionUser.value?.profileImage
    || '',
  ).trim(),
)
const loggedInBusinessUserRoleLabel = computed(() => {
  if (hasOwnerWorkspaceAccess.value) return 'Owner'

  const resolvedRoleName = String(
    currentWorkspacePermissionRole.value?.name
    || authUser.value?.permissionRoleName
    || authUser.value?.roleName
    || currentWorkspacePermissionUser.value?.roleName
    || '',
  ).trim()

  return resolvedRoleName || (isCurrentWorkspaceMember.value ? 'Workspace User' : 'Business User')
})
const businessSidebarBrandName = computed(() =>
  isCurrentWorkspaceMember.value ? businessWorkspaceOwnerName.value : businessName.value,
)
const businessSidebarBrandSubtitle = computed(() =>
  isCurrentWorkspaceMember.value ? 'Workspace Owner' : 'Business Workspace',
)
const businessSidebarSecondarySectionLabel = computed(() =>
  hasOwnerWorkspaceAccess.value ? 'Quick Access' : 'Employee Access',
)
const businessNavbarBreadcrumbParent = computed(() =>
  isCurrentWorkspaceMember.value ? `${loggedInBusinessUserRoleLabel.value} Workspace` : 'Business Workspace',
)
const businessNavbarSettingsItems = computed(() =>
  hasOwnerWorkspaceAccess.value
    ? BUSINESS_OWNER_NAVBAR_SETTINGS_ITEMS
    : BUSINESS_WORKSPACE_USER_NAVBAR_SETTINGS_ITEMS,
)
const canAccessOwnerWorkspaceControls = computed(() => hasOwnerWorkspaceAccess.value)
function resolveAccessibleBusinessSection(sectionId = '') {
  const normalizedSection = String(sectionId || '').trim()
  if (!normalizedSection) return resolveFirstAvailableBusinessSection()

  if (
    ['profile', 'subscriptions'].includes(normalizedSection)
    && !canAccessOwnerWorkspaceControls.value
  ) {
    return resolveFirstAvailableBusinessSection()
  }

  return availableSidebarSectionIds.value.includes(normalizedSection)
    || ['profile', 'subscriptions'].includes(normalizedSection)
    ? normalizedSection
    : resolveFirstAvailableBusinessSection()
}
watch([canAccessOwnerWorkspaceControls, availableSidebarSectionIds], () => {
  if (canAccessOwnerWorkspaceControls.value) return
  if (!['profile', 'subscriptions'].includes(activeSection.value)) return

  const fallbackSection = resolveFirstAvailableBusinessSection()
  const fallbackGroupId = sidebarGroups.value.find((group) =>
    group.items.some((item) => item.id === fallbackSection),
  )?.id || activeSidebarGroup.value

  if (fallbackSection !== activeSection.value) {
    activeSection.value = fallbackSection
  }
  if (fallbackGroupId !== activeSidebarGroup.value) {
    activeSidebarGroup.value = fallbackGroupId
  }
}, { immediate: true })
function isPermissionModuleFullAccess(module) {
  return Boolean(module?.permissions?.full)
}
function isPermissionManagedSection(sectionId) {
  return permissionModuleCatalog.some((module) => module.id === String(sectionId || '').trim())
}
function hasPendingBusinessGraceAccess(moduleId) {
  return businessSystemNotifications.value.some((notice) =>
    notice.section === String(moduleId || '').trim()
    && notice.effectiveAtValue > businessRealtimeNow.value,
  )
}
function getBusinessModuleAccess(moduleId, role = currentWorkspacePermissionRole.value) {
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
function canViewBusinessModule(moduleId) {
  return getBusinessModuleAccess(moduleId).view
}
function canEditBusinessModule(moduleId) {
  return getBusinessModuleAccess(moduleId).edit
}
function canViewTrainingWorkspace() {
  return canViewBusinessModule('training-templates') || canViewBusinessModule('assign-templates')
}
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

// Applicant management transforms raw applications into table rows at modal-ready detail objects.
const applicantManagementRows = computed(() =>
  businessJobApplications.value.map((application, index) => {
    const statusLabel = formatApplicantManagementStatusLabel(application?.status)
    const isFinalStatus = isApplicantManagementFinalStatus(statusLabel)
    const jobTitle = String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job'
    const businessLabel = String(application?.businessName || application?.companyName || businessName.value || 'Business').trim()
    const appliedAt = formatUserOverviewDate(resolveBusinessApplicationAppliedAt(application))
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
const resolveDashboardApplicantFeedTone = (value) => {
  const normalizedStatus = normalizeUserOverviewValue(formatApplicantManagementStatusLabel(value))
  if (normalizedStatus === 'pending') return 'pending'
  if (normalizedStatus === 'under review') return 'review'
  if (normalizedStatus.includes('interview')) return 'interview'
  if (normalizedStatus === 'approved') return 'approved'
  if (['rejected', 'discontinued'].includes(normalizedStatus)) return 'rejected'
  return 'neutral'
}
const dashboardApplicantFeed = computed(() => {
  const statusPriority = {
    pending: 0,
    review: 1,
    interview: 2,
    approved: 3,
    rejected: 4,
    neutral: 5,
  }

  const rows = businessJobApplications.value.map((application, index) => {
    const statusLabel = formatApplicantManagementStatusLabel(application?.status)
    const normalizedRawStatus = normalizeUserOverviewValue(application?.status || 'pending')
    const statusTone = resolveDashboardApplicantFeedTone(statusLabel)
    const appliedAtRaw = String(
      application?.appliedAt
      || application?.createdAt
      || application?.submittedAt
      || '',
    ).trim()
    const appliedAtValue = Date.parse(appliedAtRaw) || 0

    return {
      id: String(application?.id || `dashboard-application-${index + 1}`).trim() || `dashboard-application-${index + 1}`,
      name: String(application?.applicantName || 'Applicant').trim() || 'Applicant',
      role: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
      appliedAtLabel: formatUserOverviewDate(appliedAtRaw),
      avatarUrl: mediaUrl(String(application?.applicantAvatar || application?.avatar || application?.avatar_url || '').trim()),
      initials: buildUserOverviewInitials(application?.applicantName, 'AP'),
      statusLabel,
      statusTone,
      isNew: ['pending', 'applied', 'submitted'].includes(normalizedRawStatus),
      isFinalStatus: isApplicantManagementFinalStatus(statusLabel),
      appliedAtValue,
    }
  })

  const visibleRows = rows.some((row) => !row.isFinalStatus)
    ? rows.filter((row) => !row.isFinalStatus)
    : rows

  return visibleRows
    .sort((left, right) => {
      const newDifference = Number(right.isNew) - Number(left.isNew)
      if (newDifference) return newDifference

      const priorityDifference = (statusPriority[left.statusTone] ?? 99) - (statusPriority[right.statusTone] ?? 99)
      if (priorityDifference) return priorityDifference

      return right.appliedAtValue - left.appliedAtValue
    })
    .slice(0, 7)
})
const getBusinessApplicationNotificationTimestamp = (application = {}) => {
  const candidates = [
    application?.statusUpdatedAt,
    application?.status_updated_at,
    application?.updatedAt,
    application?.updated_at,
    application?.appliedAt,
    application?.applied_at,
    application?.createdAt,
    application?.created_at,
  ]

  for (const value of candidates) {
    const parsed = Date.parse(String(value || '').trim())
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return 0
}

const businessApplicationNotifications = computed(() =>
  businessJobApplications.value
    .map((application, index) => {
      const applicationId = String(application?.id || '').trim()
      const applicantName = String(application?.applicantName || 'Applicant').trim() || 'Applicant'
      const jobTitle = String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job'
      const statusLabel = formatApplicantManagementStatusLabel(application?.status)
      const normalizedStatus = normalizeUserOverviewValue(statusLabel || 'pending').replace(/\s+/g, '-') || 'pending'
      const normalizedRawStatus = normalizeUserOverviewValue(application?.status || 'pending')
      const createdAtValue = getBusinessApplicationNotificationTimestamp(application)
      const createdAt = createdAtValue ? new Date(createdAtValue) : new Date()

      let title = 'Application update'
      let message = `${applicantName} has an update for ${jobTitle}.`
      let tone = 'accent'

      if (normalizedStatus === 'pending') {
        title = 'New application received'
        message = `${applicantName} applied for ${jobTitle}. Open Applicant Management to review this application.`
      } else if (normalizedStatus === 'under-review') {
        title = 'Application needs review'
        message = `${applicantName}'s ${jobTitle} application is still waiting for your next decision.`
        tone = 'warning'
      } else if (normalizedStatus === 'interview') {
        title = 'Interview-stage applicant'
        message = `${applicantName} reached the interview stage for ${jobTitle}.`
        tone = 'success'
      } else if (['accepted', 'hired'].includes(normalizedRawStatus)) {
        title = normalizedRawStatus === 'hired' ? 'Hiring confirmed' : 'Applicant accepted'
        message = normalizedRawStatus === 'hired'
          ? `${applicantName} is now marked as hired for ${jobTitle}.`
          : `${applicantName} accepted the next step for ${jobTitle}.`
        tone = 'success'
      } else if (normalizedStatus === 'approved') {
        title = 'Applicant approved'
        message = `${applicantName} is approved for ${jobTitle}.`
        tone = 'success'
      } else if (normalizedStatus === 'rejected') {
        title = 'Application rejected'
        message = `${applicantName}'s ${jobTitle} application is marked as rejected.`
        tone = 'danger'
      } else if (normalizedStatus === 'discontinued') {
        title = 'Application discontinued'
        message = `${applicantName}'s ${jobTitle} application was discontinued.`
        tone = 'danger'
      }

      return {
        id: `business-application-${applicationId || index + 1}-${normalizedStatus}`,
        applicationId,
        title,
        message,
        tone,
        section: 'applicant-management',
        createdAt: createdAt.toISOString(),
        createdAtLabel: formatBusinessNotificationTime(createdAt),
        kind: 'application',
      }
    })
    .filter((notification) => String(notification?.id || '').trim())
    .sort((left, right) => Date.parse(String(right?.createdAt || '').trim()) - Date.parse(String(left?.createdAt || '').trim()))
    .slice(0, 8),
)

const getBusinessJobOfferNotificationTimestamp = (application = {}) => {
  const candidates = [
    application?.jobOfferApplicantRespondedAt,
    application?.job_offer_applicant_responded_at,
    application?.jobOfferUpdatedAt,
    application?.job_offer_updated_at,
    application?.jobOfferSentAt,
    application?.job_offer_sent_at,
    application?.jobOfferCreatedAt,
    application?.job_offer_created_at,
  ]

  for (const value of candidates) {
    const parsed = Date.parse(String(value || '').trim())
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return getBusinessApplicationNotificationTimestamp(application)
}

const businessJobOfferNotifications = computed(() =>
  businessJobApplications.value
    .map((application, index) => {
      const applicationId = String(application?.id || '').trim()
      const applicantName = String(application?.applicantName || 'Applicant').trim() || 'Applicant'
      const jobTitle = String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job'
      const offerStatus = String(application?.jobOfferStatus || application?.job_offer_status || '').trim().toLowerCase()
      if (!offerStatus) return null

      const createdAtValue = getBusinessJobOfferNotificationTimestamp(application)
      const createdAt = createdAtValue ? new Date(createdAtValue) : new Date()

      let title = 'Job offer update'
      let message = `${applicantName} has a job offer update for ${jobTitle}.`
      let tone = 'accent'
      let section = 'issue-offer'

      if (['sent', 'offered', 'pending'].includes(offerStatus)) {
        title = 'Job offer sent'
        message = `You sent a job offer to ${applicantName} for ${jobTitle}.`
      } else if (['accepted', 'confirmed', 'signed'].includes(offerStatus)) {
        title = 'Job offer accepted'
        message = `${applicantName} accepted the job offer for ${jobTitle}.`
        tone = 'success'
        section = 'contract-signing'
      } else if (['declined', 'rejected', 'cancelled', 'canceled', 'expired'].includes(offerStatus)) {
        title = 'Job offer declined'
        message = `${applicantName} declined or closed the job offer for ${jobTitle}.`
        tone = 'danger'
      }

      return {
        id: `business-job-offer-${applicationId || index + 1}-${offerStatus}`,
        applicationId,
        title,
        message,
        tone,
        section,
        createdAt: createdAt.toISOString(),
        createdAtLabel: formatBusinessNotificationTime(createdAt),
        kind: 'job-offer',
      }
    })
    .filter((notification) => String(notification?.id || '').trim())
    .sort((left, right) => Date.parse(String(right?.createdAt || '').trim()) - Date.parse(String(left?.createdAt || '').trim()))
    .slice(0, 8),
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
    applicantResumeUrl: mediaUrl(String(application?.applicantResumeUrl || application?.applicant_resume_url || application?.resumeUrl || application?.resume_url || '').trim()),
    applicantResumeFileName: String(application?.applicantResumeFileName || application?.applicant_resume_file_name || application?.resumeFileName || application?.resume_file_name || 'Applicant resume.pdf').trim() || 'Applicant resume.pdf',
    jobTitle: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
    statusLabel: formatApplicantManagementStatusLabel(application?.status),
    appliedAtLabel: formatUserOverviewDate(resolveBusinessApplicationAppliedAt(application)),
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
  await approveApplicantManagementApplicationProcess({
    applicationId,
    authUser,
    businessName,
    isApplicantManagementDecisionSubmitting,
    applicantManagementDecisionError,
    getApplicantManagementApplicationById,
    canEditBusinessModule,
    canUpdateApplicantManagementStatus,
    showPaymentToast,
    closeApplicantManagementModal,
  })
}

const requestApproveApplicantManagementApplication = (applicationId) => {
  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }

  showPaymentConfirmationToast({
    title: 'Approve applicant?',
    message: `Approve ${String(targetApplication.applicantName || 'this applicant').trim()} for ${String(targetApplication.jobTitle || 'the selected job').trim()}? The applicant will immediately see the approval in real time.`,
    confirmLabel: 'Approve',
    confirmVariant: 'primary',
    onConfirm: async () => {
      await approveApplicantManagementApplication(applicationId)
    },
  })
}

const rejectApplicantManagementApplication = async (applicationId = applicantManagementSelectedApplicationId.value) => {
  await rejectApplicantManagementApplicationProcess({
    applicationId,
    authUser,
    businessName,
    isApplicantManagementDecisionSubmitting,
    applicantManagementDecisionError,
    applicantManagementDecisionReason,
    getApplicantManagementApplicationById,
    canEditBusinessModule,
    canUpdateApplicantManagementStatus,
    showPaymentToast,
    closeApplicantManagementModal,
  })
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
function parsePersistedPermissionRolesState(rawState) {
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
function readPersistedBusinessPermissionRolesState() {
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
      workspaceOwnerId: String(
        authUser.value?.workspace_owner_id
        || authUser.value?.workspaceOwnerId
        || authUser.value?.id
        || '',
      ).trim(),
      workspaceUsers: workspaceUserDirectory.value,
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
    const isWorkspaceMember = isWorkspaceMemberBusinessAccount(authUser.value)

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
const isBusinessStartupPermissionIssue = (error) => {
  const normalizedCode = String(error?.code || '').trim().toLowerCase()
  const rawMessage = String(error?.message || '').trim()
  const normalizedMessage = rawMessage.toLowerCase()

  return (
    normalizedCode.includes('permission-denied')
    || normalizedCode.includes('unauthenticated')
    || normalizedMessage.includes('insufficient permissions')
    || normalizedMessage.includes('missing or insufficient permissions')
  )
}
const resolveBusinessStartupSyncMessage = (error, fallbackMessage) => {
  const rawMessage = String(error?.message || '').trim()

  if (isBusinessStartupPermissionIssue(error)) {
    return fallbackMessage
  }

  return rawMessage || fallbackMessage
}
const logBusinessStartupSyncIssue = (scope, error, fallbackMessage) => {
  const resolvedMessage = resolveBusinessStartupSyncMessage(error, fallbackMessage)
  if (!isBusinessStartupPermissionIssue(error)) {
    console.warn(`[business-workspace] ${scope}`, error)
  }
  return resolvedMessage
}
const persistEmployeeDirectoryState = () => {}
const restoreEmployeeDirectoryState = () => {
  employeeDirectory.value = createDefaultEmployeeDirectory()
  userAccountDraft.value = createDefaultUserAccountDraft()
  employeeDraft.value = createDefaultEmployeeDraft()
}
const isWorkspaceMemberDirectoryAccount = (user = authUser.value) => {
  const workspaceOwnerId = String(user?.workspace_owner_id || user?.workspaceOwnerId || '').trim()
  const actorUid = String(auth.currentUser?.uid || user?.uid || user?.id || '').trim()
  const workspaceOwnerEmail = String(user?.workspace_owner_email || user?.workspaceOwnerEmail || '').trim().toLowerCase()
  const actorEmail = String(user?.email || user?.gmail || user?.business_contact_email || auth.currentUser?.email || '').trim().toLowerCase()

  return user?.workspace_member === true
    || (workspaceOwnerId && actorUid && workspaceOwnerId !== actorUid)
    || (!workspaceOwnerId && workspaceOwnerEmail && actorEmail && workspaceOwnerEmail !== actorEmail)
}
const getWorkspaceOwnerDirectoryId = (user = authUser.value) => {
  const workspaceOwnerId = String(user?.workspace_owner_id || user?.workspaceOwnerId || '').trim()
  const actorUid = String(auth.currentUser?.uid || user?.uid || user?.id || '').trim()

  if (isWorkspaceMemberDirectoryAccount(user)) {
    return workspaceOwnerId || actorUid
  }

  return actorUid || workspaceOwnerId
}
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
      if (!isBusinessStartupPermissionIssue(error)) {
        console.warn('[business-workspace] Member employer subscription failed.', error)
      }
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
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const actorIds = [
    auth.currentUser?.uid,
    authUser.value?.uid,
    authUser.value?.id,
  ]
  if (!workspaceOwnerId) {
    postedJobs.value = []
    isPostedJobsLoading.value = false
    postedJobsSyncMessage.value = ''
    return
  }

  isPostedJobsLoading.value = true
  postedJobsSyncMessage.value = ''
  stopWorkspaceJobsSync = subscribeToWorkspaceJobs(
    {
      workspaceOwnerId,
      workspaceOwnerEmail,
      actorIds,
      ownerIds: [
        authUser.value?.workspace_owner_id,
        authUser.value?.workspaceOwnerId,
        workspaceOwnerId,
      ],
      ownerEmails: [
        authUser.value?.workspace_owner_email,
        authUser.value?.workspaceOwnerEmail,
        workspaceOwnerEmail,
      ],
    },
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

const startBusinessContractFirestoreSync = () => {
  stopBusinessContractSync()

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()

  if (!workspaceOwnerId && !workspaceOwnerEmail) {
    businessContractRecords.value = []
    return
  }

  stopBusinessContractSync = subscribeToBusinessContracts(
    {
      workspaceOwnerId,
      workspaceOwnerEmail,
    },
    (records) => {
      businessContractRecords.value = Array.isArray(records) ? records : []
    },
    (error) => {
      console.warn('[business-workspace] Contract signing subscription failed.', error)
      businessContractRecords.value = []
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
const countJobPostingWords = (value = '') =>
  (String(value || '').match(/[A-Za-z]+/g) || []).length
const sanitizeJobPostingWordsOnlyText = (
  value,
  {
    maxWords = Number.POSITIVE_INFINITY,
    allowNewlines = false,
    preserveTrailingWhitespace = false,
  } = {},
) => {
  const normalizedValue = String(value || '').replace(/\r\n?/g, '\n')
  const normalizedLines = normalizedValue.split('\n')
  const endsWithNewline = allowNewlines && preserveTrailingWhitespace && normalizedValue.endsWith('\n')

  let wordsRemaining = Number.isFinite(maxWords) ? maxWords : Number.MAX_SAFE_INTEGER
  const limitedLines = []

  for (const line of normalizedLines) {
    const sanitizedLine = line.replace(/[^A-Za-z\s]/g, ' ')
    const hasTrailingSpace = preserveTrailingWhitespace && /[ \t]+$/.test(sanitizedLine)
    const words = sanitizedLine.match(/[A-Za-z]+/g) || []

    if (!words.length) {
      if (allowNewlines && limitedLines.length && limitedLines[limitedLines.length - 1] !== '') {
        limitedLines.push('')
      }
      continue
    }

    if (wordsRemaining <= 0) break

    const keptWords = words.slice(0, wordsRemaining)
    if (!keptWords.length) break

    const normalizedLine = keptWords.join(' ')
    const shouldPreserveTrailingSpace = hasTrailingSpace && keptWords.length === words.length && wordsRemaining > keptWords.length

    limitedLines.push(shouldPreserveTrailingSpace ? `${normalizedLine} ` : normalizedLine)
    wordsRemaining -= keptWords.length

    if (keptWords.length < words.length) break
  }

  let result = allowNewlines
    ? limitedLines.join('\n')
    : limitedLines.filter(Boolean).join(' ')

  if (endsWithNewline && result && wordsRemaining > 0) {
    result = `${result}\n`
  }

  return preserveTrailingWhitespace ? result : result.trim()
}
const sanitizeJobPostingTitle = (value) =>
  sanitizeJobPostingWordsOnlyText(value, { allowNewlines: false })
const sanitizeJobPostingVacanciesInput = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 3)
  if (!digits) return ''

  return String(Math.min(Number(digits), JOB_POSTING_MAX_VACANCIES))
}
const sanitizeJobPostingPreferredAgeInput = (value) =>
  String(value || '').replace(/[^\d]/g, '').slice(0, 3)
const hasJobPostingSpamPattern = (value = '') => {
  const normalizedValue = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalizedValue) return false

  const compactValue = normalizedValue.replace(/\s+/g, '')
  if (/(.)\1{5,}/i.test(compactValue)) return true
  if (/\b([A-Za-z]+)(?:\s+\1){3,}\b/i.test(normalizedValue)) return true

  return false
}
const normalizeJobPostingDraftInput = (draft = {}) => ({
  ...draft,
  title: sanitizeJobPostingTitle(draft.title),
  description: sanitizeJobPostingWordsOnlyText(draft.description, {
    maxWords: JOB_POSTING_MAX_DESCRIPTION_WORDS,
    allowNewlines: true,
  }),
  vacancies: sanitizeJobPostingVacanciesInput(draft.vacancies),
  preferredAgeRange: sanitizeJobPostingPreferredAgeInput(draft.preferredAgeRange),
  qualifications: sanitizeJobPostingWordsOnlyText(draft.qualifications, {
    maxWords: JOB_POSTING_MAX_REQUIREMENT_WORDS,
    allowNewlines: true,
  }),
  responsibilities: sanitizeJobPostingWordsOnlyText(draft.responsibilities, {
    maxWords: JOB_POSTING_MAX_REQUIREMENT_WORDS,
    allowNewlines: true,
  }),
})
const handleJobPostingFieldChange = (key, value) => {
  if (key === 'disabilityType') {
    const normalizedDisabilityType = serializeJobPostingDisabilityTypes(value)
    const shouldKeepSpecification = normalizeJobPostingDisabilityTypes(normalizedDisabilityType).some((entry) =>
      JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(entry || '').trim()),
    )

    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      disabilityType: normalizedDisabilityType,
      impairmentSpecification: shouldKeepSpecification ? jobPostingDraft.value.impairmentSpecification : '',
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

  if (key === 'title') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      title: sanitizeJobPostingWordsOnlyText(value, {
        allowNewlines: false,
        preserveTrailingWhitespace: true,
      }),
    }
    return
  }

  if (key === 'description') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      description: sanitizeJobPostingWordsOnlyText(value, {
        maxWords: JOB_POSTING_MAX_DESCRIPTION_WORDS,
        allowNewlines: true,
        preserveTrailingWhitespace: true,
      }),
    }
    return
  }

  if (key === 'vacancies') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      vacancies: sanitizeJobPostingVacanciesInput(value),
    }
    return
  }

  if (key === 'preferredAgeRange') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      preferredAgeRange: sanitizeJobPostingPreferredAgeInput(value),
    }
    return
  }

  if (key === 'qualifications' || key === 'responsibilities') {
    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      [key]: sanitizeJobPostingWordsOnlyText(value, {
        maxWords: JOB_POSTING_MAX_REQUIREMENT_WORDS,
        allowNewlines: true,
        preserveTrailingWhitespace: true,
      }),
    }
    return
  }

  jobPostingDraft.value = {
    ...jobPostingDraft.value,
    [key]: value,
  }
}
const setJobPostingDisabilityTypes = (values = []) => {
  handleJobPostingFieldChange('disabilityType', values)
}
const saveJobPost = async () => {
  if (!canEditBusinessModule('job-posting')) {
    showPaymentToast('Your role has view-only access for Job Posting.', 'warning')
    return false
  }

  if (isSavingJobPost.value) return false

  const normalizedJobPostingDraft = normalizeJobPostingDraftInput(jobPostingDraft.value)
  jobPostingDraft.value = normalizedJobPostingDraft

  const requiredFields = [
    ['job title', normalizedJobPostingDraft.title],
    ['company name', jobPostingCompanyNameDisplay.value],
    ['description', normalizedJobPostingDraft.description],
    ['business category', jobPostingCategoryValue.value],
    ['type', normalizedJobPostingDraft.type],
    ['location', normalizedJobPostingDraft.location],
    ['barangay', normalizedJobPostingDraft.barangay],
    ['vacancies', normalizedJobPostingDraft.vacancies],
    ['salary range', normalizedJobPostingDraft.salaryRange],
    ['disability type', normalizedJobPostingDraft.disabilityType],
    ['preferred age', normalizedJobPostingDraft.preferredAgeRange],
    ['language', normalizedJobPostingDraft.language],
    ['qualifications', normalizedJobPostingDraft.qualifications],
    ['responsibilities', normalizedJobPostingDraft.responsibilities],
  ]

  const missingFields = requiredFields
    .filter(([, value]) => String(value ?? '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
    return false
  }

  const spamField = [
    ['job title', normalizedJobPostingDraft.title],
    ['description', normalizedJobPostingDraft.description],
    ['qualifications', normalizedJobPostingDraft.qualifications],
    ['responsibilities', normalizedJobPostingDraft.responsibilities],
  ].find(([, value]) => hasJobPostingSpamPattern(value))

  if (spamField) {
    showPaymentToast(`Please remove spam or repeated words from the ${spamField[0]}.`, 'warning')
    return false
  }

  if (countJobPostingWords(normalizedJobPostingDraft.description) > JOB_POSTING_MAX_DESCRIPTION_WORDS) {
    showPaymentToast(`Description must stay within ${JOB_POSTING_MAX_DESCRIPTION_WORDS} words.`, 'warning')
    return false
  }

  if (countJobPostingWords(normalizedJobPostingDraft.qualifications) > JOB_POSTING_MAX_REQUIREMENT_WORDS) {
    showPaymentToast(`Qualifications must stay within ${JOB_POSTING_MAX_REQUIREMENT_WORDS} words.`, 'warning')
    return false
  }

  if (countJobPostingWords(normalizedJobPostingDraft.responsibilities) > JOB_POSTING_MAX_REQUIREMENT_WORDS) {
    showPaymentToast(`Responsibilities must stay within ${JOB_POSTING_MAX_REQUIREMENT_WORDS} words.`, 'warning')
    return false
  }

  const vacancyCount = Number(normalizedJobPostingDraft.vacancies)
  if (!Number.isFinite(vacancyCount) || vacancyCount < 1 || vacancyCount > JOB_POSTING_MAX_VACANCIES) {
    showPaymentToast(`Vacancies must be between 1 and ${JOB_POSTING_MAX_VACANCIES}.`, 'warning')
    return false
  }

  if (!parseJobPostingSalaryRange(normalizedJobPostingDraft.salaryRange).isValid) {
    showPaymentToast('Enter the salary as minimum - maximum, for example PHP 15,000 - PHP 20,000.', 'warning')
    return false
  }

  const preferredAge = Number(normalizedJobPostingDraft.preferredAgeRange)
  if (!Number.isFinite(preferredAge) || preferredAge < 18) {
    showPaymentToast('Preferred age must be 18 or above.', 'warning')
    return false
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const employerId = String(auth.currentUser?.uid || authUser.value?.uid || authUser.value?.id || workspaceOwnerId || '').trim()

  if (!workspaceOwnerId || !employerId) {
    showPaymentToast('Refresh the page and sign in again before saving this job post.', 'error', {
      title: 'Job Post Failed',
    })
    return false
  }

  try {
    isSavingJobPost.value = true
    const wasEditingJobPost = isEditingJobPost.value

    const payload = {
      title: normalizedJobPostingDraft.title,
      companyName: jobPostingCompanyNameDisplay.value,
      logoUrl: businessAvatar.value || profileForm.value.avatar || '',
      description: normalizedJobPostingDraft.description,
      category: jobPostingCategoryValue.value,
      type: normalizedJobPostingDraft.type,
      setup: normalizedJobPostingDraft.type,
      location: normalizedJobPostingDraft.location,
      barangay: normalizedJobPostingDraft.barangay,
      vacancies: vacancyCount,
      salary: jobPostingSalaryPreview.value,
      salaryRange: normalizedJobPostingDraft.salaryRange,
      disabilityType: serializeJobPostingDisabilityTypes(normalizedJobPostingDraft.disabilityType),
      impairmentSpecification: normalizedJobPostingDraft.impairmentSpecification,
      preferredAgeRange: String(preferredAge),
      language: normalizedJobPostingDraft.language,
      languages: normalizedJobPostingDraft.language,
      qualifications: toJobPostingLineItems(normalizedJobPostingDraft.qualifications),
      responsibilities: toJobPostingLineItems(normalizedJobPostingDraft.responsibilities),
      status: String(normalizedJobPostingDraft.status || 'open').trim().toLowerCase() || 'open',
      workspaceOwnerId,
      workspaceOwnerEmail,
      employerId,
      createdBy: employerId,
    }

    const savedJob = wasEditingJobPost
      ? await updateBusinessJobPost(editingJobPostId.value, payload)
      : await createBusinessJobPost(payload)

    if (savedJob) {
      syncPostedJobRecordLocally(savedJob)
      startWorkspaceJobPostsSync()
    }

    resetJobPostingDraft()
    jobPostingTab.value = 'posted'
    showPaymentToast(
      wasEditingJobPost
        ? 'Job post updated successfully.'
        : 'Job post published. It now appears in Posted Jobs and the public landing page.',
      'success',
    )
    return true
  } catch (error) {
    showPaymentToast(
      error instanceof Error
        ? error.message
        : isEditingJobPost.value
          ? 'Unable to update the job post right now.'
          : 'Unable to publish the job post right now.',
      'error',
      {
        title: isEditingJobPost.value ? 'Save Failed' : 'Job Post Failed',
      },
    )
    return false
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
  const category = normalizeJobPostingDisabilityTypes(disabilityType)
    .map((entry) => resolveJobPostingDisabilityTypeLabel(entry))
    .join(', ')
  const specification = String(impairmentSpecification || '').trim()
  if (category && specification) return `${category} - ${specification}`
  return category || specification
}

const getJobPostingImpairmentSpecificationPlaceholder = (disabilityType) => {
  const normalizedDisabilityTypes = normalizeJobPostingDisabilityTypes(disabilityType)

  if (normalizedDisabilityTypes.length > 1) {
    return 'Example: Limited hand mobility, low vision, hard of hearing'
  }

  switch (normalizedDisabilityTypes[0] || '') {
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
// Applicant highlight state moved to business_applicant_bindings.js.

// Assessment at training builders magkasama rito para pareho ang flow ng reusable templates at module-level permissions.
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
  interviewType: 'interview',
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
const normalizeBusinessInterviewTypeValue = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  return normalizedValue ? 'interview' : 'interview'
}
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
  normalizeBusinessInterviewTypeValue(
    resolveBusinessInterviewMirrorText(record?.interviewType, record?.interview_type, 'interview'),
  )
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
const formatBusinessInterviewTypeLabel = () => 'Interview'
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
// Interview scheduling logic naka-base sa applicant status at assigned assessments bago gumawa ng slots.
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
const businessInterviewHasCompletedInterview = computed(() =>
  businessInterviewSelectedApplicantSchedules.value.some(
    (entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'completed',
  ),
)
const hasCompletedBusinessInterviewType = (applicationId) => {
  const normalizedApplicationId = String(applicationId || '').trim()

  if (!normalizedApplicationId) return false

  return businessInterviewSchedules.value.some((entry) =>
    String(entry?.applicationId || entry?.application_id || '').trim() === normalizedApplicationId
    && normalizeBusinessInterviewScheduleStatus(entry?.scheduleStatus || entry?.schedule_status) === 'completed')
}
const trainingEligibleApplicantProfiles = computed(() =>
  businessJobApplications.value
    .filter((application) =>
      isBusinessApplicationLinkedToPostedJob(application)
      && hasCompletedBusinessInterviewType(application?.id),
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
      stage: 'Interview completed',
    }))
    .filter((application) => application.id)
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const businessInterviewAvailableInterviewTypeOptions = computed(() => [{ value: 'interview', label: 'Interview' }])
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
  interviewType: normalizeBusinessInterviewTypeValue(
    overrides.interviewType ?? schedule?.interviewType ?? schedule?.interview_type ?? 'interview',
  ),
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
  await completeBusinessInterviewScheduleProcess({
    scheduleId,
    businessInterviewSchedules,
    canEditBusinessModule,
    showPaymentToast,
    upsertBusinessInterviewScheduleState,
    buildBusinessInterviewApplicationPayload,
  })
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
  await approveBusinessInterviewRescheduleRequestProcess({
    selectedBusinessInterviewReviewSchedule,
    businessInterviewRequestScheduleOptions,
    isBusinessInterviewRequestDecisionSubmitting,
    businessInterviewRequestDecisionError,
    businessInterviewSelectedCalendarDateKey,
    businessInterviewCalendarBaseDate,
    canEditBusinessModule,
    showPaymentToast,
    normalizeBusinessInterviewDecisionScheduleOptions,
    upsertBusinessInterviewScheduleState,
    buildBusinessInterviewApplicationPayload,
    closeBusinessInterviewRequestReview,
    formatBusinessInterviewDateKey,
  })
}

const rejectBusinessInterviewRescheduleRequest = async () => {
  await rejectBusinessInterviewRescheduleRequestProcess({
    selectedBusinessInterviewReviewSchedule,
    businessInterviewRequestDecisionReason,
    isBusinessInterviewRequestDecisionSubmitting,
    businessInterviewRequestDecisionError,
    canEditBusinessModule,
    showPaymentToast,
    upsertBusinessInterviewScheduleState,
    buildBusinessInterviewApplicationPayload,
    closeBusinessInterviewRequestReview,
  })
}

const createBusinessInterviewSchedule = async () => {
  await createBusinessInterviewScheduleProcess({
    authUser,
    businessName,
    businessInterviewSchedulingForm,
    businessInterviewSchedulingFormError,
    businessInterviewFilteredApplicants,
    businessInterviewAvailableInterviewTypeOptions,
    businessInterviewSchedules,
    businessInterviewSelectedCalendarDateKey,
    businessInterviewCalendarBaseDate,
    canEditBusinessModule,
    showPaymentToast,
    hasBusinessInterviewPassedTechnicalAssessment,
    resolveBusinessInterviewTechnicalStage,
    normalizeBusinessInterviewScheduleStatus,
    getWorkspaceOwnerDirectoryId,
    createBusinessInterviewScheduleId,
    buildBusinessInterviewApplicationPayload,
    upsertBusinessInterviewScheduleState,
    resetBusinessInterviewSchedulingForm,
    formatBusinessInterviewDateKey,
  })
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
  passingScorePercent: 70,
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
    passingScorePercent: normalizeAssessmentPassingScorePercent(template?.passingScorePercent || template?.passing_score_percent, 70),
    categories: normalizedCategories.length ? normalizedCategories : [createTrainingTemplateCategory()],
    updatedAt: String(template?.updatedAt || new Date().toISOString()),
  }
}

const createTrainingTemplateDraftFromRecord = (template = {}) => {
  const normalized = normalizeTrainingTemplateRecord(template)

  return {
    title: normalized.title,
    description: normalized.description,
    passingScorePercent: normalized.passingScorePercent,
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

  const passingScorePercent = normalizeAssessmentPassingScorePercent(trainingTemplateDraft.value.passingScorePercent, 70)

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
    passingScorePercent,
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
    stage: String(overrides.stage ?? assignment?.stage ?? 'Interview completed').trim() || 'Interview completed',
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
const selectedTrainingTrackingCategoryId = ref('')
const selectedTrainingTrackingSkillKey = ref('')
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
  const targetAssignment = trainingTrackingAssignments.value.find((assignment) =>
    String(assignment?.id || '').trim() === normalizedAssignmentId) || null
  selectedTrainingTrackingCategoryId.value = String(targetAssignment?.templateCategories?.[0]?.id || '').trim()
  selectedTrainingTrackingSkillKey.value = ''
  trainingTrackingViewMode.value = 'detail'
}

const returnToTrainingTrackingTable = () => {
  trainingTrackingViewMode.value = 'table'
  selectedTrainingTrackingCategoryId.value = ''
  selectedTrainingTrackingSkillKey.value = ''
}

const isTrainingTrackingCategorySelected = (categoryId) =>
  String(selectedTrainingTrackingCategoryId.value || '').trim() === String(categoryId || '').trim()

const toggleTrainingTrackingCategorySelection = (categoryId) => {
  const normalizedCategoryId = String(categoryId || '').trim()
  if (!normalizedCategoryId) return

  selectedTrainingTrackingCategoryId.value = isTrainingTrackingCategorySelected(normalizedCategoryId)
    ? ''
    : normalizedCategoryId
  selectedTrainingTrackingSkillKey.value = ''
}

const createTrainingTrackingSelectedSkillKey = (assignmentId, categoryId, skillId) =>
  [assignmentId, categoryId, skillId].map((value) => String(value || '').trim()).join(':')

const isTrainingTrackingSkillSelected = (assignmentId, categoryId, skillId) =>
  String(selectedTrainingTrackingSkillKey.value || '').trim() === createTrainingTrackingSelectedSkillKey(assignmentId, categoryId, skillId)

const toggleTrainingTrackingSkillSelection = (assignmentId, categoryId, skillId) => {
  const nextSkillKey = createTrainingTrackingSelectedSkillKey(assignmentId, categoryId, skillId)
  if (!nextSkillKey.replace(/:/g, '')) return

  selectedTrainingTrackingSkillKey.value = isTrainingTrackingSkillSelected(assignmentId, categoryId, skillId)
    ? ''
    : nextSkillKey
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

const removeLocalTrainingAssignmentRecord = (recordId = '') => {
  const normalizedId = String(recordId || '').trim()
  if (!normalizedId) return

  trainingAssignmentRecords.value = trainingAssignmentRecords.value.filter((record) =>
    String(record?.id || record?.memberId || record?.applicationId || '').trim() !== normalizedId)
  rebuildTrainingAssignments()
}

const handleTrainingAssignmentTemplateSelection = async () => Promise.resolve()

const assignTrainingTemplateToMember = async (memberId) => {
  await assignTrainingTemplateToMemberProcess({
    memberId,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    findTrainingTemplateById,
    buildTrainingAssignmentRecordPayload,
    buildTrainingAssignmentSnapshotFromTemplate,
    syncLocalTrainingAssignmentRecord,
  })
}

const removeAssignedTrainingTemplateFromMember = async (memberId) => {
  await removeAssignedTrainingTemplateFromMemberProcess({
    memberId,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    showPaymentToast,
    removeLocalTrainingAssignmentRecord,
  })
}

const toggleTrainingAssignmentSkillCompletion = async (assignmentId, categoryId, skillId, completed) => {
  await toggleTrainingAssignmentSkillCompletionProcess({
    assignmentId,
    categoryId,
    skillId,
    completed,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    trainingTrackingSavingSkillKeys,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    createTrainingTrackingSkillKey,
    cloneTrainingAssignmentProgressCategories,
    normalizeTrainingTrackingSkillGrade,
    buildTrainingAssignmentRecordPayload,
    resolveTrainingAssignmentProgressStatus,
    syncLocalTrainingAssignmentRecord,
    rebuildTrainingAssignments,
  })
}

const setTrainingAssignmentSkillGrade = async (assignmentId, categoryId, skillId, gradeValue) => {
  await setTrainingAssignmentSkillGradeProcess({
    assignmentId,
    categoryId,
    skillId,
    gradeValue,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    trainingTrackingSavingSkillKeys,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    normalizeTrainingTrackingSkillGrade,
    createTrainingTrackingSkillKey,
    cloneTrainingAssignmentProgressCategories,
    buildTrainingAssignmentRecordPayload,
    resolveTrainingAssignmentProgressStatus,
    syncLocalTrainingAssignmentRecord,
    rebuildTrainingAssignments,
  })
}

const saveTrainingTrackingCategoryRemark = async (assignmentId, categoryId) => {
  await saveTrainingTrackingCategoryRemarkProcess({
    assignmentId,
    categoryId,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    trainingTrackingSavingCategoryKeys,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    calculateTrainingCategoryProgress,
    getTrainingTrackingCategoryRemarkDraft,
    createTrainingTrackingCategoryKey,
    cloneTrainingAssignmentProgressCategories,
    buildTrainingAssignmentRecordPayload,
    resolveTrainingAssignmentProgressStatus,
    syncLocalTrainingAssignmentRecord,
    rebuildTrainingAssignments,
  })
}

const completeTrainingTrackingAssignment = async (assignmentId) => {
  await completeTrainingTrackingAssignmentProcess({
    assignmentId,
    authUser,
    businessName,
    canEditTrainingAssignments,
    trainingTemplateAssignments,
    trainingAssignmentRecords,
    trainingTrackingCompletingAssignmentIds,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    canCompleteTrainingTrackingAssignmentRecord,
    cloneTrainingAssignmentProgressCategories,
    buildTrainingAssignmentRecordPayload,
    resolveTrainingAssignmentProgressStatus,
    syncLocalTrainingAssignmentRecord,
    rebuildTrainingAssignments,
  })
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
  await syncAssignedApplicantAssessmentScoresProcess({
    applicantAssessmentScoreEntries,
    assessmentAssignmentRecords,
    approvedApplicantProfiles,
    isBusinessApplicationLinkedToPostedJob,
    buildApplicantAssessmentScoreRecord,
  })
}

const scheduleAssignedApplicantAssessmentScoreSync = (delayMs = 280) => {
  if (assignedApplicantScoreSyncTimeoutId) {
    clearTimeout(assignedApplicantScoreSyncTimeoutId)
  }

  assignedApplicantScoreSyncTimeoutId = setTimeout(() => {
    assignedApplicantScoreSyncTimeoutId = null
    void syncAssignedApplicantAssessmentScores()
  }, Math.max(80, Number(delayMs) || 280))
}

const assignAssessmentTemplateToApplicant = async (applicantId) => {
  await assignAssessmentTemplateToApplicantProcess({
    applicantId,
    approvedApplicantTemplateAssignments,
    canEditBusinessModule,
    showPaymentToast,
    getWorkspaceOwnerDirectoryId,
    buildAssessmentAssignmentTemplateSnapshot,
    countScorableAssessmentQuestions,
    buildApplicantAssessmentScoreRecord,
  })
}

const requestAssignAssessmentTemplateToApplicant = (applicantId) => {
  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) {
    showPaymentToast('That applicant could not be found.', 'error')
    return
  }

  if (!targetApplicant.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the applicant.', 'warning')
    return
  }

  const templateLabel = getAssignableTemplateLabel(targetApplicant.selectedTemplateId, targetApplicant.templateTitle)
  const actionLabel = targetApplicant.assignmentStatus === 'Assigned' ? 'update' : 'assign'

  showPaymentConfirmationToast({
    title: targetApplicant.assignmentStatus === 'Assigned' ? 'Update assessment assignment?' : 'Assign assessment template?',
    message: `Confirm ${actionLabel} for ${String(targetApplicant.name || 'this applicant').trim()}. Template: ${templateLabel}.`,
    confirmLabel: targetApplicant.assignmentStatus === 'Assigned' ? 'Update' : 'Assign',
    confirmVariant: 'primary',
    onConfirm: async () => {
      await assignAssessmentTemplateToApplicant(applicantId)
    },
  })
}

const removeAssignedAssessmentFromApplicant = async (applicantId) => {
  await removeAssignedAssessmentFromApplicantProcess({
    applicantId,
    approvedApplicantTemplateAssignments,
    canEditBusinessModule,
    showPaymentToast,
    findAssessmentAssignmentRecordByApplicant,
  })
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

const isBusinessIssueOfferOpen = ref(false)
const businessIssueOfferSelectedApplicationId = ref('')
const isBusinessJobOfferSaving = ref(false)
const businessIssueOfferFormError = ref('')
const createDefaultBusinessIssueOfferDraft = () => ({
  offerTitle: '',
  compensation: '',
  startDate: '',
  responseDeadline: '',
  offerLetter: '',
})
const businessIssueOfferDraft = ref(createDefaultBusinessIssueOfferDraft())
const businessContractRecords = ref([])
const contractSigningFilter = ref('all')
const contractSigningSelectedRowId = ref('')
const isBusinessContractSaving = ref(false)
const activeBusinessContractSigningId = ref('')
const activeBusinessProviderContractId = ref('')
const businessContractSignatureName = ref('')
const createDefaultBusinessContractDraft = () => ({
  id: '',
  applicationId: '',
  applicantId: '',
  applicantName: '',
  applicantEmail: '',
  jobId: '',
  jobTitle: '',
  companyName: '',
  businessName: '',
  workspaceOwnerId: '',
  workspaceOwnerEmail: '',
  contractTitle: '',
  employmentType: '',
  salaryOffer: '',
  startDate: '',
  notes: '',
  contractBody: '',
})
const businessContractDraft = ref(createDefaultBusinessContractDraft())

const normalizePilotBusinessOfferStatus = (application = {}) =>
  String(application?.jobOfferStatus || application?.job_offer_status || '').trim().toLowerCase() || 'not_sent'

const getPilotBusinessOfferTone = (value = '') => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'accepted') return 'success'
  if (normalizedValue === 'rejected') return 'danger'
  if (normalizedValue === 'sent') return 'warning'
  return 'muted'
}

const formatPilotBusinessOfferStatusLabel = (value = '') => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'accepted') return 'Offer Accepted'
  if (normalizedValue === 'rejected') return 'Offer Declined'
  if (normalizedValue === 'sent') return 'Offer Sent'
  return 'Ready for Offer'
}

const buildBusinessIssueOfferStageSummary = (application = {}) => {
  const applicationId = String(application?.id || '').trim()
  const latestInterview = getLatestBusinessInterviewSchedule(applicationId)
  const hasCompletedInterview = hasCompletedBusinessInterviewType(applicationId)

  return {
    interviewType: 'interview',
    passedStageLabel: hasCompletedInterview
      ? 'Interview Completed'
        : isApprovedBusinessApplication(application)
          ? 'Application Approved'
          : 'Ready for Offer',
    completedAt: String(
      latestInterview?.scheduledAt
      || latestInterview?.updatedAt
      || application?.approvedAt
      || application?.reviewedAt
      || application?.updatedAt
      || application?.appliedAt
      || application?.createdAt
      || '',
    ).trim(),
    interviewer: String(
      latestInterview?.interviewer
      || application?.reviewedByName
      || authUser.value?.name
      || businessName.value
      || 'Business Hiring Team',
    ).trim(),
  }
}

const canIssueOfferForApplication = (application = {}) => {
  if (!application || !isBusinessApplicationLinkedToPostedJob(application)) return false

  const normalizedStatus = normalizeUserOverviewValue(application?.status || 'pending')
  if (['rejected', 'discontinued'].includes(normalizedStatus)) return false

  const applicationId = String(application?.id || '').trim()
  return hasCompletedBusinessInterviewType(applicationId)
    || isApprovedBusinessApplication(application)
}

const buildBusinessIssueOfferLetter = (application = {}, stageSummary = {}) => {
  const applicantName = String(application?.applicantName || 'Applicant').trim() || 'Applicant'
  const jobTitle = String(application?.jobTitle || 'the position').trim() || 'the position'
  const companyLabel = String(businessName.value || application?.businessName || application?.companyName || 'our business').trim()
  const compensation = String(application?.salaryRange || 'the compensation package discussed').trim()

  return [
    `Hello ${applicantName},`,
    '',
    `We are pleased to offer you the ${jobTitle} role at ${companyLabel}.`,
    '',
    `Compensation: ${compensation || 'To be finalized with you.'}`,
    '',
    `This preview offer follows your ${String(stageSummary?.passedStageLabel || 'application progress').trim().toLowerCase()}.`,
    '',
    'This pilot branch lets us review the merged UI first before the final live offer flow is fully enabled.',
    '',
    `Regards,`,
    companyLabel,
  ].join('\n')
}

const buildBusinessIssueOfferCandidate = (application = {}) => {
  if (!application) return null

  const stageSummary = buildBusinessIssueOfferStageSummary(application)
  const offerStatus = normalizePilotBusinessOfferStatus(application)

  return {
    id: String(application?.id || '').trim(),
    applicationId: String(application?.id || '').trim(),
    applicantId: String(application?.applicantId || application?.applicant_id || '').trim(),
    applicantName: String(application?.applicantName || 'Applicant').trim() || 'Applicant',
    applicantEmail: String(application?.applicantEmail || '').trim().toLowerCase(),
    applicantAvatar: mediaUrl(String(application?.applicantAvatar || application?.avatar || application?.avatar_url || '').trim()),
    jobId: String(application?.jobId || application?.job_id || '').trim(),
    jobTitle: String(application?.jobTitle || 'Applied Job').trim() || 'Applied Job',
    passedStageLabel: stageSummary.passedStageLabel,
    completedAt: stageSummary.completedAt,
    interviewer: stageSummary.interviewer,
    interviewType: stageSummary.interviewType,
    offerStatus,
    offerStatusLabel: formatPilotBusinessOfferStatusLabel(offerStatus),
    offerTone: getPilotBusinessOfferTone(offerStatus),
  }
}

const issueOfferQueueRows = computed(() =>
  businessJobApplications.value
    .filter((application) => isBusinessApplicationLinkedToPostedJob(application) && canIssueOfferForApplication(application))
    .map((application) => {
      const candidate = buildBusinessIssueOfferCandidate(application)
      const lastActivityValue = Date.parse(String(candidate?.completedAt || application?.updatedAt || application?.appliedAt || application?.createdAt || '').trim()) || 0

      return {
        id: candidate.id,
        applicationId: candidate.applicationId,
        applicantName: candidate.applicantName,
        applicantEmail: candidate.applicantEmail || 'No email',
        applicantAvatar: candidate.applicantAvatar,
        applicantInitials: buildUserOverviewInitials(candidate.applicantName, 'AP'),
        jobTitle: candidate.jobTitle,
        offerTitle: String(application?.jobOfferTitle || application?.job_offer_title || '').trim(),
        passedStageLabel: candidate.passedStageLabel,
        completedAt: candidate.completedAt,
        offerStatus: candidate.offerStatus,
        offerStatusLabel: candidate.offerStatusLabel,
        offerTone: candidate.offerTone,
        offerMeta: candidate.offerStatus === 'not_sent'
          ? 'Open the preview modal to review the merged offer layout.'
          : 'This row already has mirrored offer details on the application record.',
        actionLabel: candidate.offerStatus === 'not_sent' ? 'Open Preview' : 'Review Offer',
        lastActivityValue,
      }
    })
    .sort((left, right) => right.lastActivityValue - left.lastActivityValue),
)

const selectedBusinessIssueOfferCandidate = computed(() =>
  buildBusinessIssueOfferCandidate(getApplicantManagementApplicationById(businessIssueOfferSelectedApplicationId.value)),
)

const businessIssueOfferMinDate = computed(() => new Date().toISOString().slice(0, 10))

const applyBusinessIssueOfferDraft = (application = {}) => {
  const stageSummary = buildBusinessIssueOfferStageSummary(application)
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + 7)
  const deadline = new Date(today)
  deadline.setDate(deadline.getDate() + 5)

  businessIssueOfferDraft.value = {
    offerTitle: String(application?.jobOfferTitle || application?.job_offer_title || `${String(application?.jobTitle || 'Job').trim()} Job Offer`).trim(),
    compensation: String(application?.jobOfferCompensation || application?.job_offer_compensation || application?.salaryRange || '').trim(),
    startDate: String(application?.jobOfferStartDate || application?.job_offer_start_date || startDate.toISOString().slice(0, 10)).trim(),
    responseDeadline: String(application?.jobOfferResponseDeadline || application?.job_offer_response_deadline || deadline.toISOString().slice(0, 10)).trim(),
    offerLetter: String(application?.jobOfferLetter || application?.job_offer_letter || buildBusinessIssueOfferLetter(application, stageSummary)).trim(),
  }
}

const openIssueOfferModal = (applicationId) => {
  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }

  businessIssueOfferSelectedApplicationId.value = String(targetApplication.id || '').trim()
  applyBusinessIssueOfferDraft(targetApplication)
  businessIssueOfferFormError.value = ''
  isBusinessIssueOfferOpen.value = true
}

const resetIssueOfferModalState = () => {
  isBusinessIssueOfferOpen.value = false
  businessIssueOfferSelectedApplicationId.value = ''
  businessIssueOfferDraft.value = createDefaultBusinessIssueOfferDraft()
  businessIssueOfferFormError.value = ''
}

const closeIssueOfferModal = () => {
  if (isBusinessJobOfferSaving.value) return

  resetIssueOfferModalState()
}

const setBusinessIssueOfferField = (field, value) => {
  businessIssueOfferDraft.value = {
    ...businessIssueOfferDraft.value,
    [field]: value,
  }
}

const submitBusinessIssueOffer = async () => {
  if (isBusinessJobOfferSaving.value) return

  if (!canEditBusinessModule('issue-offer') && !canEditBusinessModule('applicant-management')) {
    showPaymentToast('Your role has view-only access for Issue Offer.', 'warning')
    return
  }

  const targetApplication = getApplicantManagementApplicationById(businessIssueOfferSelectedApplicationId.value)
  if (!targetApplication) {
    businessIssueOfferFormError.value = 'That applicant application could not be found.'
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }

  const normalizedDraft = {
    offerTitle: String(businessIssueOfferDraft.value.offerTitle || '').trim(),
    compensation: String(businessIssueOfferDraft.value.compensation || '').trim(),
    startDate: String(businessIssueOfferDraft.value.startDate || '').trim(),
    responseDeadline: String(businessIssueOfferDraft.value.responseDeadline || '').trim(),
    offerLetter: String(businessIssueOfferDraft.value.offerLetter || '').trim(),
  }
  businessIssueOfferDraft.value = normalizedDraft

  const requiredFields = [
    ['offer title', normalizedDraft.offerTitle],
    ['compensation', normalizedDraft.compensation],
    ['start date', normalizedDraft.startDate],
    ['response deadline', normalizedDraft.responseDeadline],
    ['offer letter', normalizedDraft.offerLetter],
  ]
  const missingFields = requiredFields
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    businessIssueOfferFormError.value = `Please complete the ${missingFields.join(', ')} before continuing.`
    return
  }

  if (normalizedDraft.startDate < businessIssueOfferMinDate.value) {
    businessIssueOfferFormError.value = 'Choose a start date from today onward.'
    return
  }

  if (normalizedDraft.responseDeadline < businessIssueOfferMinDate.value) {
    businessIssueOfferFormError.value = 'Choose a response deadline from today onward.'
    return
  }

  const selectedCandidate = selectedBusinessIssueOfferCandidate.value
  const stageSummary = buildBusinessIssueOfferStageSummary(targetApplication)
  const workspaceOwnerId = String(
    targetApplication?.workspaceOwnerId
    || targetApplication?.workspace_owner_id
    || getWorkspaceOwnerDirectoryId()
    || '',
  ).trim()
  const workspaceOwnerEmail = String(
    targetApplication?.workspaceOwnerEmail
    || targetApplication?.workspace_owner_email
    || authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()
  const workspaceOwnerName = String(
    businessName.value
    || targetApplication?.workspaceOwnerName
    || targetApplication?.workspace_owner_name
    || targetApplication?.businessName
    || targetApplication?.companyName
    || '',
  ).trim()

  if (!workspaceOwnerId) {
    businessIssueOfferFormError.value = 'Refresh the page and sign in again before sending this offer.'
    showPaymentToast('Refresh the page and sign in again before sending this offer.', 'error')
    return
  }

  isBusinessJobOfferSaving.value = true
  businessIssueOfferFormError.value = ''

  try {
    await saveBusinessJobOfferRecord({
      id: String(targetApplication?.jobOfferId || targetApplication?.job_offer_id || targetApplication?.id || '').trim(),
      applicationId: String(targetApplication?.id || '').trim(),
      workspaceOwnerId,
      workspaceOwnerName,
      workspaceOwnerEmail,
      applicantId: String(targetApplication?.applicantId || targetApplication?.applicant_id || selectedCandidate?.applicantId || '').trim(),
      applicantName: String(targetApplication?.applicantName || selectedCandidate?.applicantName || 'Applicant').trim(),
      applicantEmail: String(targetApplication?.applicantEmail || selectedCandidate?.applicantEmail || '').trim().toLowerCase(),
      applicantAvatar: String(targetApplication?.applicantAvatar || targetApplication?.applicant_avatar || targetApplication?.avatar || selectedCandidate?.applicantAvatar || '').trim(),
      jobId: String(targetApplication?.jobId || targetApplication?.job_id || selectedCandidate?.jobId || '').trim(),
      jobTitle: String(targetApplication?.jobTitle || selectedCandidate?.jobTitle || 'Applied Job').trim(),
      interviewType: stageSummary.interviewType,
      offerTitle: normalizedDraft.offerTitle,
      offerLetter: normalizedDraft.offerLetter,
      compensation: normalizedDraft.compensation,
      startDate: normalizedDraft.startDate,
      responseDeadline: normalizedDraft.responseDeadline,
      offerStatus: 'sent',
    })

    const applicantName = String(targetApplication?.applicantName || selectedCandidate?.applicantName || 'the applicant').trim()
    resetIssueOfferModalState()
    showPaymentToast(`Job offer sent successfully to ${applicantName}.`, 'success')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to send this job offer right now.'
    businessIssueOfferFormError.value = errorMessage
    showPaymentToast(errorMessage, 'error')
  } finally {
    isBusinessJobOfferSaving.value = false
  }
}

const normalizeBusinessContractStatus = (value = '') =>
  String(value || '').trim().toLowerCase() || 'draft'

const getBusinessContractStatusLabel = (value = '') => {
  const normalizedStatus = normalizeBusinessContractStatus(value)
  if (normalizedStatus === 'not_ready') return 'Awaiting Approval'
  if (normalizedStatus === 'completed') return 'Completed'
  if (normalizedStatus === 'applicant_signed') return 'Returned by Applicant'
  if (normalizedStatus === 'sent') return 'Sent to Applicant'
  return 'Ready to Send'
}

const getBusinessContractStatusTone = (value = '') => {
  const normalizedStatus = normalizeBusinessContractStatus(value)
  if (normalizedStatus === 'not_ready') return 'muted'
  if (normalizedStatus === 'completed') return 'success'
  if (normalizedStatus === 'applicant_signed') return 'info'
  if (normalizedStatus === 'sent') return 'warning'
  return 'muted'
}

const buildBusinessContractBody = (row = {}) => {
  const applicantName = String(row?.name || row?.applicantName || 'Applicant').trim() || 'Applicant'
  const businessLabel = String(row?.businessName || row?.companyName || businessName.value || 'Business').trim()
  const jobTitle = String(row?.jobTitle || row?.role || 'Applied Job').trim() || 'Applied Job'
  const compensation = String(row?.salaryOffer || row?.compensation || 'To be finalized').trim()
  const startDate = String(row?.startDate || '').trim()
  const employmentType = String(row?.employmentType || 'Full-time').trim()

  return [
    `This Employment Contract is entered into by and between ${businessLabel} and ${applicantName}.`,
    '',
    `${applicantName} is being offered the position of ${jobTitle} under a ${employmentType.toLowerCase()} arrangement.`,
    '',
    `Compensation: ${compensation}`,
    startDate ? `Target start date: ${startDate}` : 'Target start date: To be finalized with the applicant.',
    '',
    'The applicant agrees to perform the duties of the role, follow company policies, and complete the required onboarding steps once the contract is fully signed.',
    '',
    'Compensation, employment type, start date, and any additional hiring notes are listed above and form part of this agreement.',
    '',
    'Both parties confirm that an electronic signature captured in this platform serves as acceptance of this contract version.',
  ].join('\n')
}

const buildBusinessContractDraftFromRow = (row = {}) => {
  const workspaceOwnerId = String(authUser.value?.workspace_owner_id || authUser.value?.workspaceOwnerId || authUser.value?.id || '').trim()
  const workspaceOwnerEmail = String(
    authUser.value?.workspace_owner_email
    || authUser.value?.workspaceOwnerEmail
    || authUser.value?.business_contact_email
    || authUser.value?.email
    || '',
  ).trim().toLowerCase()

  return {
    id: String(row?.contractId || '').trim(),
    applicationId: String(row?.applicationId || row?.id || '').trim(),
    applicantId: String(row?.applicantId || '').trim(),
    applicantName: String(row?.name || 'Applicant').trim() || 'Applicant',
    applicantEmail: String(row?.email || '').trim().toLowerCase(),
    jobId: String(row?.jobId || '').trim(),
    jobTitle: String(row?.jobTitle || row?.role || 'Applied Job').trim() || 'Applied Job',
    companyName: String(row?.companyName || row?.businessName || businessName.value || '').trim(),
    businessName: String(row?.businessName || row?.companyName || businessName.value || '').trim(),
    workspaceOwnerId,
    workspaceOwnerEmail,
    contractTitle: String(row?.contractTitle || 'Employment Contract').trim() || 'Employment Contract',
    employmentType: String(row?.employmentType || row?.jobType || 'Full-time').trim() || 'Full-time',
    salaryOffer: String(row?.salaryOffer || row?.compensation || '').trim(),
    startDate: String(row?.startDate || '').trim(),
    notes: String(row?.notes || '').trim(),
    contractBody: String(row?.contractBody || buildBusinessContractBody(row)).trim(),
  }
}

const contractSigningQueueRows = computed(() => {
  const contractByApplicationId = new Map(
    businessContractRecords.value.map((record) => [String(record?.applicationId || '').trim(), record]),
  )

  return businessJobApplications.value
    .filter((application) => {
      if (!isBusinessApplicationLinkedToPostedJob(application)) return false

      const normalizedStatus = normalizeUserOverviewValue(application?.status || 'pending')
      if (['rejected', 'discontinued'].includes(normalizedStatus)) return false

      return hasCompletedBusinessInterviewType(application?.id)
    })
    .map((application) => {
      const applicationId = String(application?.id || '').trim()
      const contractRecord = contractByApplicationId.get(applicationId) || null
      const contractStatus = String(contractRecord?.status || '').trim().toLowerCase()
      const contractStage = contractStatus || 'draft'
      const latestInterview = getLatestBusinessInterviewSchedule(applicationId)
      const applicantName = String(application?.applicantName || application?.applicant_name || 'Applicant').trim() || 'Applicant'
      const jobTitle = String(application?.jobTitle || application?.job_title || 'Applied Job').trim() || 'Applied Job'
      const lastContractActivity = Date.parse(String(
        contractRecord?.updatedAt
        || contractRecord?.businessSignedAt
        || contractRecord?.applicantSignedAt
        || contractRecord?.sentAt
        || contractRecord?.createdAt
        || '',
      ).trim()) || 0
      const interviewCompletedAt = String(
        latestInterview?.businessDecidedAt
        || latestInterview?.updatedAt
        || latestInterview?.scheduledAt
        || application?.updatedAt
        || application?.reviewedAt
        || '',
      ).trim()
      const interviewActivityValue = Date.parse(interviewCompletedAt) || 0

      return {
        id: applicationId,
        applicationId,
        contractId: String(contractRecord?.id || '').trim(),
        applicantId: String(application?.applicantId || application?.applicant_id || '').trim(),
        name: applicantName,
        email: String(application?.applicantEmail || application?.applicant_email || 'No email').trim() || 'No email',
        jobId: String(application?.jobId || application?.job_id || '').trim(),
        jobTitle,
        role: jobTitle,
        jobType: String(application?.jobType || application?.job_type || 'Full-time').trim() || 'Full-time',
        companyName: String(application?.companyName || application?.company_name || application?.businessName || businessName.value || '').trim(),
        businessName: String(application?.businessName || application?.business_name || application?.companyName || businessName.value || '').trim(),
        offerTitle: String(application?.jobOfferTitle || application?.job_offer_title || `${jobTitle} Employment Contract`).trim(),
        offerStatus: 'interview_completed',
        offerStatusLabel: 'Interview Completed',
        offerAcceptedAt: interviewCompletedAt,
        interviewStatus: 'completed',
        interviewStatusLabel: 'Interview Completed',
        interviewCompletedAt,
        interviewer: String(
          latestInterview?.interviewer
          || application?.reviewedByName
          || authUser.value?.name
          || businessName.value
          || 'Business Hiring Team'
        ).trim(),
        compensation: String(
          contractRecord?.salaryOffer
          || application?.jobOfferCompensation
          || application?.job_offer_compensation
          || application?.salaryRange
          || ''
        ).trim(),
        status: contractStage,
        statusLabel: getBusinessContractStatusLabel(contractStage),
        statusTone: getBusinessContractStatusTone(contractStage),
        nextStep: contractStage === 'completed'
          ? 'Contract fully signed by both parties'
          : contractStage === 'applicant_signed'
            ? 'Business should countersign the returned contract'
            : contractStage === 'sent'
              ? 'Waiting for applicant digital signature'
              : 'Prepare and send the contract to the applicant',
        contractTitle: String(contractRecord?.contractTitle || `${jobTitle} Employment Contract`).trim() || `${jobTitle} Employment Contract`,
        employmentType: String(contractRecord?.employmentType || application?.jobType || application?.job_type || 'Full-time').trim() || 'Full-time',
        salaryOffer: String(
          contractRecord?.salaryOffer
          || application?.jobOfferCompensation
          || application?.job_offer_compensation
          || application?.salaryRange
          || ''
        ).trim(),
        startDate: String(contractRecord?.startDate || application?.jobOfferStartDate || application?.job_offer_start_date || '').trim(),
        notes: String(contractRecord?.notes || '').trim(),
        contractBody: String(contractRecord?.contractBody || buildBusinessContractBody({
          ...application,
          applicantName,
          name: applicantName,
          jobTitle,
          role: jobTitle,
          interviewer: latestInterview?.interviewer,
        })).trim(),
        sentAt: String(contractRecord?.sentAt || '').trim(),
        applicantSignedAt: String(contractRecord?.applicantSignedAt || '').trim(),
        businessSignedAt: String(contractRecord?.businessSignedAt || '').trim(),
        providerEnvelopeId: String(contractRecord?.providerEnvelopeId || '').trim(),
        signatureProvider: String(contractRecord?.signatureProvider || '').trim(),
        canSend: !contractStatus || contractStatus === 'sent',
        canBusinessSign: contractStatus === 'applicant_signed',
        lastActivityValue: Math.max(interviewActivityValue, lastContractActivity),
      }
    })
    .filter((row) => row.applicationId && row.applicantId)
    .sort((left, right) => right.lastActivityValue - left.lastActivityValue)
})

const contractSigningOverviewCards = computed(() => {
  const readyCount = contractSigningQueueRows.value.filter((row) => row.status === 'draft' || row.status === 'sent').length
  const applicantSignedCount = contractSigningQueueRows.value.filter((row) => row.status === 'applicant_signed').length
  const completedCount = contractSigningQueueRows.value.filter((row) => row.status === 'completed').length

  return [
    {
      label: 'Ready For Contract',
      value: String(readyCount),
      copy: 'Applicants with a completed interview who can move into contract preparation.',
    },
    {
      label: 'Awaiting Applicant',
      value: String(contractSigningQueueRows.value.filter((row) => row.status === 'sent').length),
      copy: 'Contracts that were sent and are waiting for the applicant signature.',
    },
    {
      label: 'Returned',
      value: String(applicantSignedCount),
      copy: 'Contracts already signed by the applicant and waiting for business countersign.',
    },
    {
      label: 'Completed',
      value: String(completedCount),
      copy: 'Fully signed contracts that are ready to archive and hand off into onboarding.',
    },
  ]
})

const contractSigningFilterChips = computed(() => {
  const rows = contractSigningQueueRows.value
  return [
    { id: 'all', label: 'All', count: rows.length },
    { id: 'draft', label: 'Ready To Send', count: rows.filter((row) => row.status === 'draft').length },
    { id: 'sent', label: 'Awaiting Applicant', count: rows.filter((row) => row.status === 'sent').length },
    { id: 'applicant_signed', label: 'Returned', count: rows.filter((row) => row.status === 'applicant_signed').length },
    { id: 'completed', label: 'Completed', count: rows.filter((row) => row.status === 'completed').length },
  ]
})

const contractSigningLastSyncedLabel = computed(() =>
  contractSigningQueueRows.value.length
    ? 'Live contract queue synced from interview-completed applicants and saved contracts.'
    : 'No interview-completed applicants are visible yet.',
)

const contractSigningTraceSummary = computed(() =>
  `${contractSigningQueueRows.value.length} live contract row(s) generated from completed interviews and saved contracts.`,
)

const filteredContractSigningQueueRows = computed(() => {
  const activeFilter = String(contractSigningFilter.value || 'all').trim()
  if (activeFilter === 'all') return contractSigningQueueRows.value
  return contractSigningQueueRows.value.filter((row) => row.status === activeFilter)
})

const selectedContractSigningRow = computed(() =>
  filteredContractSigningQueueRows.value.find((row) => row.id === contractSigningSelectedRowId.value)
  || filteredContractSigningQueueRows.value[0]
  || contractSigningQueueRows.value.find((row) => row.id === contractSigningSelectedRowId.value)
  || contractSigningQueueRows.value[0]
  || null,
)

const selectedContractSigningRecord = computed(() =>
  businessContractRecords.value.find((record) => String(record?.id || '').trim() === String(selectedContractSigningRow.value?.contractId || '').trim()) || null,
)

const restoreSelectedContractSigningDraft = () => {
  businessContractDraft.value = selectedContractSigningRow.value
    ? buildBusinessContractDraftFromRow(selectedContractSigningRow.value)
    : createDefaultBusinessContractDraft()
}

const selectContractSigningRow = (rowId) => {
  const normalizedRowId = String(rowId || '').trim()
  contractSigningSelectedRowId.value = normalizedRowId
  const matchedRow = contractSigningQueueRows.value.find((row) => row.id === normalizedRowId) || null
  if (!matchedRow) return

  businessContractDraft.value = buildBusinessContractDraftFromRow(matchedRow)
  businessContractSignatureName.value = String(authUser.value?.name || businessName.value || '').trim()
}

const setContractDraftField = (field, value) => {
  businessContractDraft.value = {
    ...businessContractDraft.value,
    [field]: value,
  }
}

const refreshContractSigningQueue = () => {
  startBusinessContractFirestoreSync()
  restoreSelectedContractSigningDraft()
  showPaymentToast('Contract queue refreshed from the latest saved records.', 'success')
}

const sendContractToApplicant = async (rowId) => {
  const normalizedRowId = String(rowId || '').trim()
  if (!normalizedRowId) return

  selectContractSigningRow(normalizedRowId)
  const matchedRow = contractSigningQueueRows.value.find((row) => row.id === normalizedRowId) || null
  if (!matchedRow) return

  const today = new Date().toISOString().slice(0, 10)
  businessContractDraft.value = {
    ...buildBusinessContractDraftFromRow(matchedRow),
    salaryOffer: String(matchedRow.salaryOffer || matchedRow.compensation || '').trim() || 'To be finalized by the business',
    employmentType: String(matchedRow.employmentType || matchedRow.jobType || '').trim() || 'Full-time',
    startDate: String(matchedRow.startDate || '').trim() || today,
    contractBody: String(matchedRow.contractBody || '').trim() || buildBusinessContractBody(matchedRow),
  }

  await saveAndSendBusinessContract()
}

const saveAndSendBusinessContract = async () => {
  if (!canEditBusinessModule('contract-signing')) {
    showPaymentToast('Your role has view-only access for Contract Signing.', 'warning')
    return
  }
  if (isBusinessContractSaving.value) return

  const draft = businessContractDraft.value
  const requiredFields = [
    ['contract title', draft.contractTitle],
    ['salary offer', draft.salaryOffer],
    ['employment type', draft.employmentType],
    ['start date', draft.startDate],
    ['contract body', draft.contractBody],
  ]
  const missingFields = requiredFields
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label)

  if (missingFields.length) {
    showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
    return
  }

  if (!draft.applicationId || !draft.applicantId || !draft.jobId) {
    showPaymentToast('Choose an approved applicant before sending a contract.', 'warning')
    return
  }

  try {
    isBusinessContractSaving.value = true
    await saveBusinessContractRecord({
      ...draft,
      status: 'sent',
      workspaceOwnerId: draft.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
      workspaceOwnerName: String(authUser.value?.name || businessName.value || 'Business Owner').trim(),
      workspaceOwnerEmail: draft.workspaceOwnerEmail || String(authUser.value?.email || '').trim().toLowerCase(),
      sentAt: new Date().toISOString(),
    })
    showPaymentToast(`Contract sent to ${draft.applicantName}. The applicant can now review and sign it.`, 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to send this contract right now.', 'error')
  } finally {
    isBusinessContractSaving.value = false
  }
}

const completeBusinessContractSigning = async ({ signatureDataUrl } = {}) => {
  if (!canEditBusinessModule('contract-signing')) {
    showPaymentToast('Your role has view-only access for Contract Signing.', 'warning')
    return
  }

  const selectedRecord = selectedContractSigningRecord.value
  if (!selectedRecord) {
    showPaymentToast('Select a returned contract before countersigning it.', 'warning')
    return
  }
  if (String(selectedRecord?.status || '').trim().toLowerCase() !== 'applicant_signed') {
    showPaymentToast('Only contracts signed by the applicant can be countersigned by the business.', 'warning')
    return
  }
  if (activeBusinessContractSigningId.value) return

  try {
    activeBusinessContractSigningId.value = String(selectedRecord.id || '').trim()
    await signBusinessContractRecord(String(selectedRecord.id || '').trim(), {
      businessSignatureName: businessContractSignatureName.value || authUser.value?.name || businessName.value,
      businessSignatureDataUrl: signatureDataUrl,
    })
    showPaymentToast(`Contract completed for ${selectedContractSigningRow.value?.name || 'the applicant'}.`, 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to countersign this contract right now.', 'error')
  } finally {
    activeBusinessContractSigningId.value = ''
  }
}

const openBusinessContractDigitalApiSigning = async (contractId) => {
  const normalizedContractId = String(contractId || '').trim()
  if (!normalizedContractId || activeBusinessProviderContractId.value) return

  try {
    activeBusinessProviderContractId.value = normalizedContractId
    const session = await createContractSigningProviderSession({
      contractId: normalizedContractId,
      actorRole: 'business',
      returnUrl: typeof window !== 'undefined' ? window.location.href : '',
    })
    const signingUrl = String(session?.signingUrl || '').trim()

    if (!signingUrl) {
      throw new Error('No digital signing URL was returned by the provider.')
    }

    if (typeof window !== 'undefined') {
      window.open(signingUrl, '_blank', 'noopener,noreferrer')
    }

    showPaymentToast('Digital signing page opened in a new tab. Finish the signature there, then refresh the API status here.', 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to open the digital signing API right now.', 'error')
  } finally {
    activeBusinessProviderContractId.value = ''
  }
}

const refreshBusinessContractDigitalApiStatus = async (contractId) => {
  const normalizedContractId = String(contractId || '').trim()
  if (!normalizedContractId || activeBusinessProviderContractId.value) return

  try {
    activeBusinessProviderContractId.value = normalizedContractId
    await syncContractSigningProviderStatus(normalizedContractId)
    showPaymentToast('Digital signing status refreshed from the provider.', 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to refresh the provider status right now.', 'error')
  } finally {
    activeBusinessProviderContractId.value = ''
  }
}

watch(filteredContractSigningQueueRows, (rows) => {
  const activeId = String(contractSigningSelectedRowId.value || '').trim()
  if (rows.some((row) => row.id === activeId)) return

  const firstRow = rows[0] || null
  contractSigningSelectedRowId.value = String(firstRow?.id || '').trim()
  if (firstRow) {
    businessContractDraft.value = buildBusinessContractDraftFromRow(firstRow)
  } else {
    businessContractDraft.value = createDefaultBusinessContractDraft()
  }
}, { immediate: true })

watch(authUser, (user) => {
  if (!String(businessContractSignatureName.value || '').trim()) {
    businessContractSignatureName.value = String(user?.name || businessName.value || '').trim()
  }
}, { immediate: true })

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
      const stage = hasCompletedBusinessInterviewType(id)
        ? 'Interview completed'
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

// Subscription, checkout, at payment history logic dito naka-centralize para pareho ang trial at paid premium flow.
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
      gcashDescription: 'Complete the GCash payment in the new tab to activate your premium subscription immediately.',
      gcashStatusTitle: 'GCash payment tab',
      gcashStatusWaiting: 'Waiting to reopen payment tab',
      gcashStatusOpened: 'Opened in a new tab',
      gcashStatusHelp: 'Return here after completing the payment in the GCash checkout tab.',
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
      popupDescription: 'Review the payment details below, then confirm the GCash checkout to activate your premium subscription now.',
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
    gcashDescription: 'Open the GCash tab to authorize automatic billing for after your 30-day trial. No charge is collected today.',
    gcashStatusTitle: 'GCash authorization tab',
    gcashStatusWaiting: 'Waiting to reopen authorization tab',
    gcashStatusOpened: 'Opened in a new tab',
    gcashStatusHelp: 'Return here after authorizing the billing setup in the GCash checkout tab.',
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
    popupDescription: 'Review the billing details below, then authorize automatic billing after the 30-day premium trial. No payment is collected today.',
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

function getBusinessAccountIdentity(user = authUser.value) {
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

function findLegacyBusinessStorageKey(baseKey) {
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

function getBusinessScopedStorageKey(baseKey) {
  const identifier = getBusinessAccountIdentity() || 'anonymous-business'

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

const consumeBusinessWorkspaceForceDashboardFlag = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return false

  const shouldForceDashboard = window.sessionStorage.getItem(BUSINESS_WORKSPACE_FORCE_DASHBOARD_KEY) === '1'
  if (shouldForceDashboard) {
    window.sessionStorage.removeItem(BUSINESS_WORKSPACE_FORCE_DASHBOARD_KEY)
  }

  return shouldForceDashboard
}

const applyBusinessWorkspaceDashboardLanding = () => {
  const fallbackSection = resolveFirstAvailableBusinessSection()
  const matchingGroup = sidebarGroups.value.find((group) =>
    group.items.some((item) => item.id === fallbackSection),
  )

  activeSection.value = fallbackSection
  activeSidebarGroup.value = matchingGroup?.id || sidebarGroups.value[0]?.id || 'dashboard'
  expandedSidebarGroups.value = matchingGroup && matchingGroup.id !== 'dashboard'
    ? [matchingGroup.id]
    : []
  subscriptionView.value = 'plans'
}

const applyRestoredBusinessSubscriptionState = (restoredState = null) => {
  if (!restoredState) return false

  activeSubscriptionPlan.value = restoredState.activeSubscriptionPlan
  activeSubscriptionMode.value = restoredState.activeSubscriptionMode
  premiumTrialStartedAt.value = parsePersistedBusinessSubscriptionDate(
    restoredState.premiumTrialStartedAt,
  )
  premiumPaidStartedAt.value = restoredState.activeSubscriptionMode === 'paid'
    ? parsePersistedBusinessSubscriptionDate(restoredState.premiumPaidStartedAt) || new Date()
    : parsePersistedBusinessSubscriptionDate(restoredState.premiumPaidStartedAt)
  isSubscriptionStateHydrated.value = true

  return true
}

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
    sessionUserId: String(authUser.value?.id || authUser.value?.uid || '').trim(),
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

  const shouldForceDashboardLanding = consumeBusinessWorkspaceForceDashboardFlag()
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
      if (applyRestoredBusinessSubscriptionState(restoredState)) {
        if (shouldForceDashboardLanding) {
          applyBusinessWorkspaceDashboardLanding()
        } else {
          restoreBusinessWorkspaceViewState(restoredState)
        }
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

    if (applyRestoredBusinessSubscriptionState(storedSubscriptionState)) {
      if (shouldForceDashboardLanding) {
        applyBusinessWorkspaceDashboardLanding()
        persistBusinessSubscriptionState()
        return
      }

      restoreBusinessWorkspaceViewState(storedSubscriptionState)
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
  if (applyRestoredBusinessSubscriptionState(restoredState)) {
    if (shouldForceDashboardLanding) {
      applyBusinessWorkspaceDashboardLanding()
    } else {
      restoreBusinessWorkspaceViewState(restoredState)
    }
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
      const nextSection = resolveAccessibleBusinessSection('profile')
      if (nextSection !== activeSection.value) {
        activeSection.value = nextSection
      }
      if (subscriptionView.value !== 'plans') {
        subscriptionView.value = 'plans'
      }
      return
    }

    if (routeState.section === 'subscriptions') {
      const nextSection = resolveAccessibleBusinessSection('subscriptions')
      if (nextSection !== activeSection.value) {
        activeSection.value = nextSection
      }
      if (subscriptionView.value !== routeState.subscriptionView) {
        subscriptionView.value = routeState.subscriptionView
      }
      if (routeState.planId) {
        const nextPlanId = resolveAvailableBusinessCheckoutPlanId(routeState.planId)
        if (selectedCheckoutPlanId.value !== nextPlanId) {
          selectedCheckoutPlanId.value = nextPlanId
        }
      }
      if (routeState.subscriptionView !== 'payment' && paymentStep.value !== 1) {
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
  if (isCurrentWorkspaceMember.value) return

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
  if (isCurrentWorkspaceMember.value) return

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

const preloadBusinessProfileAvatar = (source) => new Promise((resolve, reject) => {
  const image = new window.Image()
  image.onload = () => resolve(source)
  image.onerror = () => reject(new Error('Unable to load that image preview.'))
  image.src = source
})

const applyBusinessAvatarState = ({ updatedProfile = {}, avatarUrl = '', avatarPath = '' }) => {
  const nextUser = {
    ...authUser.value,
    ...updatedProfile,
    business_avatar: avatarUrl,
    avatar: avatarUrl,
    business_avatar_path: avatarPath,
    avatar_path: avatarPath,
  }

  authUser.value = nextUser
  profileForm.value.avatar = avatarUrl
  localStorage.setItem('authUser', JSON.stringify(nextUser))
  persistBusinessProfileState()
}

const removeProfileAvatar = async () => {
  if (!authUser.value?.id || isProfileAvatarLoading.value) return

  isProfileAvatarLoading.value = true
  isProfileAvatarReady.value = false

  try {
    const updatedProfile = await updateEmployerAdminDetails(authUser.value.id, {
      clear_avatar: true,
      business_avatar: '',
      avatar: '',
      business_avatar_path: '',
      avatar_path: '',
    })

    applyBusinessAvatarState({
      updatedProfile,
      avatarUrl: '',
      avatarPath: '',
    })
    clearProfileAvatarInput()
    showPaymentToast('Business profile photo removed successfully.', 'success')
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to remove the business profile photo right now.', 'error')
  } finally {
    isProfileAvatarLoading.value = false
  }
}

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
      business_avatar: uploadedAvatar.url,
      avatar: uploadedAvatar.url,
      business_avatar_path: uploadedAvatar.path,
      avatar_path: uploadedAvatar.path,
    }

    const updatedProfile = await updateEmployerAdminDetails(authUser.value.id, payload)
    applyBusinessAvatarState({
      updatedProfile,
      avatarUrl: uploadedAvatar.url,
      avatarPath: uploadedAvatar.path,
    })
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
  assignPaymentToastState()
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

  assignPaymentToastState({
    visible: true,
    title: String(options.title || getPaymentToastTitle(message, tone)).trim(),
    message,
    tone,
    actions,
  })

  const duration = Number.isFinite(options.duration)
    ? options.duration
    : actions.length
      ? 0
      : tone === 'error'
        ? 5200
        : 2600
  if (duration > 0) {
    paymentToastTimeoutId.value = setTimeout(() => {
      assignPaymentToastState()
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
    <title>GCash Payment</title>
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

const toggleBusinessProfileMenu = () => {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
  isNotificationMenuOpen.value = false
}

const openBusinessSubscriptionSection = () => {
  if (!canAccessOwnerWorkspaceControls.value) {
    activeSection.value = resolveFirstAvailableBusinessSection()
    return
  }

  activeSection.value = 'subscriptions'
}

const applicantState = createApplicantState({
  businessJobApplications,
  normalizeUserOverviewValue,
})
const {
  businessApplicantHighlights,
} = applicantState

const dashboardState = createDashboardState({
  employeeDirectory,
  workspaceUserDirectory,
  businessJobApplications,
  normalizeUserOverviewValue,
  postedJobs,
  postedJobsSummary,
  approvedApplicantTemplateAssignments,
  trainingTemplateAssignments,
  hasUnlockedBusinessWorkspace,
  isPostedJobsLoading,
  postedJobsSyncMessage,
  isWorkspaceUserDirectoryLoading,
  workspaceUserDirectorySyncMessage,
  currentBusinessAccountIdentity,
  assessmentTemplateLibrary,
  trainingTemplateLibrary,
})
const {
  summaryCards,
  businessTrendChart,
  dashboardProgressCards,
  dashboardBarSeries,
  dashboardDonutLegend,
  dashboardDonutTotal,
  dashboardDonutStyle,
  dashboardSyncOverview,
} = dashboardState

const openBusinessProfileSection = () => {
  if (!canAccessOwnerWorkspaceControls.value) {
    activeSection.value = resolveFirstAvailableBusinessSection()
    return
  }

  activeSection.value = 'profile'
}

const openCreateUserSection = () => {
  activeSection.value = 'create-user'
  activeSidebarGroup.value = 'employees'
  if (!expandedSidebarGroups.value.includes('employees')) {
    expandedSidebarGroups.value = [...expandedSidebarGroups.value, 'employees']
  }
}

const openPermissionsSection = () => {
  activeSection.value = 'permissions'
  activeSidebarGroup.value = 'employees'
  if (!expandedSidebarGroups.value.includes('employees')) {
    expandedSidebarGroups.value = [...expandedSidebarGroups.value, 'employees']
  }
}

const openAssessmentAssignmentsSection = () => {
  activeSection.value = 'assessment-management'
  assessmentManagementTab.value = 'assignments'
}

const resetUserAccountDraft = () => {
  userAccountDraft.value = createDefaultUserAccountDraft()
}

const setInterviewSchedulingTab = (nextTab = 'schedule') => {
  interviewSchedulingTab.value = String(nextTab || 'schedule').trim() || 'schedule'
}

const createElementRefSetter = (targetRef) => (element) => {
  targetRef.value = element || null
}

const setJobPostingTypeDropdownElement = createElementRefSetter(jobPostingTypeDropdownRef)
const setJobPostingBarangayDropdownElement = createElementRefSetter(jobPostingBarangayDropdownRef)
const setJobPostingDisabilityDropdownElement = createElementRefSetter(jobPostingDisabilityDropdownRef)
const setJobPostingLanguageDropdownElement = createElementRefSetter(jobPostingLanguageDropdownRef)
const setPaymentContactCountryDropdownElement = createElementRefSetter(paymentContactCountryDropdownRef)

const paymentHistoryFilters = reactive({
  get search() {
    return paymentHistorySearch.value
  },
  set search(value) {
    paymentHistorySearch.value = value
  },
  get statusFilter() {
    return paymentHistoryStatusFilter.value
  },
  set statusFilter(value) {
    paymentHistoryStatusFilter.value = value
  },
})

const applicantManagementFilters = reactive({
  get search() {
    return applicantManagementSearch.value
  },
  set search(value) {
    applicantManagementSearch.value = value
  },
  get roleFilter() {
    return applicantManagementRoleFilter.value
  },
  set roleFilter(value) {
    applicantManagementRoleFilter.value = value
  },
  get statusFilter() {
    return applicantManagementStatusFilter.value
  },
  set statusFilter(value) {
    applicantManagementStatusFilter.value = value
  },
})

const assessmentUi = reactive({
  get managementTab() {
    return assessmentManagementTab.value
  },
  set managementTab(value) {
    assessmentManagementTab.value = String(value || 'builder').trim() || 'builder'
  },
  get assignmentTab() {
    return assessmentAssignmentTab.value
  },
  set assignmentTab(value) {
    assessmentAssignmentTab.value = String(value || 'approved-applicants').trim() || 'approved-applicants'
  },
  get questionType() {
    return selectedAssessmentQuestionType.value
  },
  set questionType(value) {
    selectedAssessmentQuestionType.value = String(value || 'multiple-choice').trim() || 'multiple-choice'
  },
})

const applicantScoreFilters = reactive({
  get search() {
    return applicantScoreSearch.value
  },
  set search(value) {
    applicantScoreSearch.value = value
  },
  get roleFilter() {
    return applicantScoreRoleFilter.value
  },
  set roleFilter(value) {
    applicantScoreRoleFilter.value = value
  },
  get statusFilter() {
    return applicantScoreStatusFilter.value
  },
  set statusFilter(value) {
    applicantScoreStatusFilter.value = value
  },
})

const applicantManagementModalState = reactive({
  get mode() {
    return applicantManagementDecisionMode.value
  },
  set mode(value) {
    applicantManagementDecisionMode.value = String(value || 'view').trim() || 'view'
  },
  get reason() {
    return applicantManagementDecisionReason.value
  },
  set reason(value) {
    applicantManagementDecisionReason.value = value
  },
  get error() {
    return applicantManagementDecisionError.value
  },
  set error(value) {
    applicantManagementDecisionError.value = value
  },
})

const businessInterviewReviewState = reactive({
  get mode() {
    return businessInterviewRequestDecisionMode.value
  },
  set mode(value) {
    businessInterviewRequestDecisionMode.value = String(value || 'view').trim() || 'view'
  },
  get reason() {
    return businessInterviewRequestDecisionReason.value
  },
  set reason(value) {
    businessInterviewRequestDecisionReason.value = value
  },
  get error() {
    return businessInterviewRequestDecisionError.value
  },
  set error(value) {
    businessInterviewRequestDecisionError.value = value
  },
})

const sidebarBindings = createSidebarBindings({
  showBusinessSidebar,
  pwdLogo,
  businessSidebarBrandName,
  businessSidebarBrandSubtitle,
  loggedInBusinessUserName,
  loggedInBusinessUserAvatar,
  loggedInBusinessUserInitials,
  loggedInBusinessUserEmail,
  loggedInBusinessUserRoleLabel,
  businessSidebarSecondarySectionLabel,
  canAccessOwnerWorkspaceControls,
  sidebarGroups,
  activeSection,
  activeSidebarGroup,
  expandedSidebarGroups,
  openSidebarGroup,
  handleSidebarSectionClick,
  setSidebarLinkRef,
  getSidebarItemIcon,
  isPremiumGuideTarget,
  isLogoutSubmitting,
  openLogoutConfirm,
  openBusinessSubscriptionSection,
  openBusinessProfileSection,
})

const navbarBindings = createNavbarBindings({
  currentSection,
  businessNavbarBreadcrumbParent,
  loggedInBusinessUserName,
  loggedInBusinessUserEmail,
  loggedInBusinessUserInitials,
  loggedInBusinessUserAvatar,
  loggedInBusinessUserRoleLabel,
  businessWorkspaceOwnerName,
  isProfileMenuOpen,
  businessNavbarSettingsItems,
  businessNavbarNotifications,
  unreadBusinessNotificationCount,
  isNotificationMenuOpen,
  toggleBusinessProfileMenu,
  toggleNotificationMenu,
  openBusinessNotification,
  handleBusinessNavbarSetting,
  openLogoutConfirm,
})

const dashboardBindings = createDashboardBindings({
  businessCategory,
  businessName,
  currentSection,
  hasUnlockedBusinessWorkspace,
  dashboardSyncOverview,
  dashboardApplicantFeed,
  summaryCards,
  businessTrendChart,
  dashboardProgressCards,
  dashboardBarSeries,
  dashboardDonutLegend,
  dashboardDonutStyle,
  dashboardDonutTotal,
})

const subscriptionBindings = createSubscriptionBindings({
  activeSubscriptionOverview,
  openPaymentHistory,
  subscriptionPlans,
  handleSubscriptionPlanClick,
})

const paymentBindings = createPaymentBindings({
  currentCheckoutFlow,
  isAdvancingPaymentStep,
  paymentLoadingMessage,
  paymentStepRows,
  paymentStep,
  paymentForm,
  handlePaymentFullNameInput,
  isPaymentContactCountryDropdownOpen,
  setPaymentContactCountryDropdownElement,
  togglePaymentContactCountryDropdown,
  getCountryFlagClass,
  paymentContactCountryCode,
  selectedPaymentPhoneCountry,
  PHONE_COUNTRIES,
  selectPaymentContactCountryOption,
  formatContactNumberDisplay,
  getPaymentLocalContactDigits,
  handlePaymentContactNumberChange,
  openCancelPaymentModal,
  validatePaymentStepOne,
  goToPaymentStepWithLoading,
  paymentMethodOptions,
  selectedPaymentMethod,
  goToPaymentStep,
  goToPaymentConfirmationStep,
  isProcessingTestModePayment,
  isFreeTrialCheckout,
  isAwaitingExternalPayment,
  openMockPaymentTab,
  markPaymentConfirmed,
  paymentSuccessRedirectSeconds,
  orderReceiptCode,
  orderReceiptDate,
  goBackToPlans,
})

const paymentHistoryBindings = createPaymentHistoryBindings({
  goBackToPlans,
  paymentHistoryFilters,
  paymentHistoryStatusOptions,
  filteredBusinessPaymentHistoryEntries,
  paymentHistoryInitialsFromName,
  businessName,
  businessEmail,
  normalizePaymentHistoryStatusClass,
  openReceiptPreview,
})

const recruitmentBindings = createRecruitmentBindings({
  jobPostingTab,
  isEditingJobPost,
  postedJobs,
  activeSubscriptionPlan,
  canEditBusinessModule,
  toggleJobPostingTab,
  saveJobPost,
  jobPostingDraft,
  jobPostingCompanyNameDisplay,
  jobPostingCategoryLabel,
  jobPostingTypeLabel,
  isJobPostingDropdownOpen,
  toggleJobPostingDropdown,
  selectJobPostingDropdownValue,
  JOB_POSTING_EMPLOYMENT_TYPES,
  JOB_POSTING_BARANGAYS,
  jobPostingBarangayLabel,
  JOB_POSTING_MAX_VACANCIES,
  JOB_POSTING_DISABILITY_TYPES,
  jobPostingDisabilityLabel,
  jobPostingSelectedDisabilityTypes,
  jobPostingDisabilityTypeNeedsSpecification,
  setJobPostingDisabilityTypes,
  getJobPostingImpairmentSpecificationPlaceholder,
  JOB_POSTING_LANGUAGE_OPTIONS,
  jobPostingLanguageLabel,
  handleJobPostingFieldChange,
  isSavingJobPost,
  cancelJobPostEditing,
  jobPostingPreviewStatusLabel,
  jobPostingCreatedPreview,
  profileForm,
  businessAvatar,
  businessInitials,
  jobPostingQualificationsPreview,
  jobPostingResponsibilitiesPreview,
  jobPostingSalaryPreview,
  buildJobPostingDisabilityFitLabel,
  jobPostHighlights,
  isPremiumGuideTarget,
  setJobPostUnlimitedHighlightRef,
  isPostedJobsLoading,
  postedJobsSyncMessage,
  resolvePostedJobStatusClass,
  jobPostPendingAction,
  openJobPostActionMenuId,
  toggleJobPostActionMenu,
  startEditingJobPost,
  updateJobPostStatus,
  isJobPostActionPending,
  permanentlyDeleteJobPost,
  setJobPostingTypeDropdownElement,
  setJobPostingBarangayDropdownElement,
  setJobPostingDisabilityDropdownElement,
  setJobPostingLanguageDropdownElement,
})

const applicantBindings = createApplicantBindings({
  businessApplicantHighlights,
  applicantManagementFilters,
  applicantManagementRoleOptions,
  reviewApplicantManagementQueue,
  applicantManagementSummary,
  filteredApplicantManagementRows,
  openApplicantManagementDecision,
  requestApproveApplicantManagementApplication,
})

const issueOfferBindings = computed(() => ({
  rows: issueOfferQueueRows.value,
  canEditBusinessModule,
  openIssueOfferModal,
}))

const contractSigningBindings = computed(() => ({
  overviewCards: contractSigningOverviewCards.value,
  filterChips: contractSigningFilterChips.value,
  activeFilter: contractSigningFilter.value,
  setFilter: (value) => { contractSigningFilter.value = String(value || 'all').trim() || 'all' },
  syncLabel: contractSigningLastSyncedLabel.value,
  traceSummary: contractSigningTraceSummary.value,
  refreshQueue: refreshContractSigningQueue,
  rows: filteredContractSigningQueueRows.value,
  selectedRowId: contractSigningSelectedRowId.value,
  selectRow: selectContractSigningRow,
  sendContractToApplicant,
  selectedRow: selectedContractSigningRow.value,
  selectedRecord: selectedContractSigningRecord.value,
  contractDraft: businessContractDraft.value,
  setContractDraftField,
  restoreContractDraft: restoreSelectedContractSigningDraft,
  saveAndSendBusinessContract,
  isBusinessContractSaving: isBusinessContractSaving.value,
  canEditBusinessModule,
  businessContractSignatureName: businessContractSignatureName.value,
  setBusinessContractSignatureName: (value) => { businessContractSignatureName.value = value },
  activeBusinessContractSigningId: activeBusinessContractSigningId.value,
  activeBusinessProviderContractId: activeBusinessProviderContractId.value,
  completeBusinessContractSigning,
  openBusinessContractDigitalApiSigning,
  refreshBusinessContractDigitalApiStatus,
}))

const permissionBindings = createPermissionBindings({
  permissionRoles,
  selectedPermissionRole,
  selectedPermissionRoleId,
  selectedPermissionEnabledModuleCount,
  selectedPermissionFullAccessCount,
  selectedPermissionAssignedUsersCount,
  permissionRolesHasUnsavedChanges,
  isSavingPermissionRoles,
  isPermissionRoleEditMode,
  permissionRoleLookupValue,
  permissionRoleDraftName,
  permissionModuleSections,
  canEditBusinessModule,
  formatPermissionRoleAccessSummary,
  getPermissionModulesForSection,
  isPermissionModuleFullAccess,
  formatPermissionAccessLabel,
  countPermissionRoleEnabledModules,
  countPermissionRoleFullAccessModules,
  countUsersAssignedToRole,
  togglePermissionRoleEditMode,
  handlePermissionRoleLookupInput,
  applyPermissionRoleLookupSelection,
  removeSelectedPermissionRole,
  createPermissionRole,
  savePermissionRoles,
  updatePermissionModuleAction,
  updatePermissionModuleFullAccess,
})

const teamMemberBindings = createTeamMemberBindings({
  activeSection,
  currentUserManagementPage,
  isWorkspaceUserDirectoryLoading,
  workspaceUserDirectory,
  permissionRoles,
  employeeDirectory,
  workspaceUserDirectorySyncMessage,
  userOverviewCards,
  filteredUserOverviewRows,
  userOverviewRoleOptions,
  userOverviewSearch,
  userOverviewRoleFilter,
  userOverviewStatusFilter,
  userOverviewSummary,
  formatUserOverviewDate,
  openCreateUserSection,
  openPermissionsSection,
  userAccountDraft,
  permissionRoleOptionsForUsers,
  selectedUserAccountRole,
  selectedUserAccountRoleSummary,
  selectedUserAccountRoleModules,
  selectedUserAccountRoleModuleSections,
  canEditBusinessModule,
  isCreatingWorkspaceUser,
  resetUserAccountDraft,
  saveWorkspaceUserAccount,
  getEmployeeRoleName,
  getEmployeeRoleAccessSummary,
  resolveEmployeeStatusClass,
  permissionBindings,
})

const assessmentBindings = createAssessmentBindings({
  activeSection,
  assessmentUi,
  canEditBusinessModule,
  editingAssessmentTemplateId,
  handleAssessmentTemplateSelection,
  assessmentTemplateLibrary,
  startNewAssessmentTemplate,
  deleteAssessmentTemplate,
  saveAssessmentTemplate,
  assessmentTemplateDraft,
  trainingQuestionTypeOptions,
  addAssessmentTemplateQuestion,
  resolveTrainingQuestionTypeMeta,
  removeAssessmentTemplateQuestion,
  addAssessmentTemplateOption,
  setAssessmentTemplateCorrectOption,
  removeAssessmentTemplateOption,
  normalizeAssessmentPassingScorePercent,
  approvedApplicantTemplateAssignments,
  assignedApplicantTemplateRows,
  assignableAssessmentTemplates,
  handleAssessmentAssignmentTemplateSelection,
  canRemoveAssignedAssessment,
  requestAssignAssessmentTemplateToApplicant,
  removeAssignedAssessmentFromApplicant,
  getAssignableTemplateLabel,
  applicantScoreRows,
  applicantScoreFilters,
  applicantScoreRoleOptions,
  openAssessmentAssignmentsSection,
  applicantScoreSummary,
  filteredApplicantScoreRows,
})

const interviewBindings = createInterviewBindings({
  interviewSchedulingTab,
  setInterviewSchedulingTab,
  businessInterviewScheduleStats,
  isBusinessInterviewRefreshing,
  refreshBusinessInterviewApplicants,
  businessInterviewSchedulingFormError,
  canEditBusinessModule,
  businessInterviewSchedulingForm,
  createBusinessInterviewSchedule,
  businessInterviewAcceptedJobOptions,
  businessInterviewFilteredApplicants,
  businessInterviewTechnicalGateHint,
  businessInterviewAvailableInterviewTypeOptions,
  businessInterviewMinScheduleDateTime,
  resetBusinessInterviewSchedulingForm,
  shiftBusinessInterviewCalendarMonth,
  businessInterviewCalendarMonthLabel,
  businessInterviewWeekdayLabels,
  businessInterviewCalendarDays,
  selectBusinessInterviewCalendarDay,
  businessInterviewSelectedCalendarLabel,
  businessInterviewSelectedDaySchedules,
  formatBusinessInterviewTime,
  businessInterviewStatusSummary,
  businessInterviewStatusRows,
  resolveBusinessInterviewStatusBadgeClass,
  openBusinessInterviewRequestReview,
  completeBusinessInterviewSchedule,
})

const trainingBindings = createTrainingBindings({
  canViewTrainingTemplateBuilder,
  canViewTrainingAssignments,
  trainingTemplatesTab,
  setTrainingTemplatesTab,
  canEditBusinessModule,
  editingTrainingTemplateId,
  handleTrainingTemplateSelection,
  trainingTemplateLibrary,
  countTrainingTemplateCategories,
  countTrainingTemplateSkills,
  startNewTrainingTemplate,
  deleteTrainingTemplate,
  saveTrainingTemplate,
  trainingTemplateDraft,
  addTrainingTemplateCategory,
  removeTrainingTemplateCategory,
  addTrainingTemplateSkill,
  removeTrainingTemplateSkill,
  readyTrainingTemplateRows,
  assignedTrainingTemplateRows,
  trainingTrackingAssignments,
  trainingAssignmentTab,
  setTrainingAssignmentTab,
  canEditTrainingAssignments,
  assignableTrainingTemplates,
  assignTrainingTemplateToMember,
  removeAssignedTrainingTemplateFromMember,
  getAssignableTrainingTemplateLabel,
  resolveTrainingTrackingProgressTone,
  isTrainingTrackingDetailView,
  selectedTrainingTrackingAssignment,
  openTrainingTrackingDetail,
  returnToTrainingTrackingTable,
  isTrainingTrackingCategorySelected,
  toggleTrainingTrackingCategorySelection,
  isTrainingTrackingSkillSelected,
  toggleTrainingTrackingSkillSelection,
  TRAINING_TRACKING_GRADE_SCALE,
  isTrainingTrackingSkillSaving,
  toggleTrainingAssignmentSkillCompletion,
  setTrainingAssignmentSkillGrade,
  isTrainingTrackingCategorySaving,
  formatBusinessInterviewDateTime,
  getTrainingTrackingCategoryRemarkDraft,
  setTrainingTrackingCategoryRemarkDraft,
  saveTrainingTrackingCategoryRemark,
  isTrainingTrackingAssignmentCompleting,
  completeTrainingTrackingAssignment,
})

const modalBindings = createModalBindings({
  isApplicantManagementModalOpen,
  closeApplicantManagementModal,
  applicantManagementModalState,
  selectedApplicantManagementDetails,
  buildUserOverviewInitials,
  normalizeUserOverviewValue,
  isApplicantManagementDecisionSubmitting,
  canUpdateSelectedApplicantManagementStatus,
  approveApplicantManagementApplication,
  rejectApplicantManagementApplication,
  isBusinessInterviewRequestReviewOpen,
  closeBusinessInterviewRequestReview,
  businessInterviewReviewState,
  selectedBusinessInterviewReviewSchedule,
  formatBusinessInterviewApplicantResponseLabel,
  formatBusinessInterviewTypeLabel,
  formatBusinessInterviewDateTime,
  businessInterviewRequestScheduleOptions,
  businessInterviewMinScheduleDateTime,
  addBusinessInterviewRequestScheduleOption,
  isBusinessInterviewRequestDecisionSubmitting,
  approveBusinessInterviewRescheduleRequest,
  rejectBusinessInterviewRescheduleRequest,
  isHelpCenterModalOpen,
  closeHelpCenterModal,
  isCreateUserConfirmOpen,
  closeCreateUserConfirm,
  createUserConfirmationName,
  createUserConfirmationEmail,
  isCreatingWorkspaceUser,
  executeWorkspaceUserAccountCreation,
  isLogoutConfirmOpen,
  closeLogoutConfirm,
  isLogoutSubmitting,
  confirmLogout,
  isTrialConfirmationOpen,
  currentCheckoutFlow,
  closeTrialConfirmation,
  proceedToPayment,
  isCancelPaymentModalOpen,
  closeCancelPaymentModal,
  isCancellingPayment,
  confirmCancelPayment,
  isAddMemberDrawerOpen,
  closeAddMemberDrawer,
  canEditBusinessModule,
  isWorkspaceUserDirectoryLoading,
  availableEmployeeLinkOptions,
  employeeDraft,
  selectedEmployeeLinkedUser,
  getWorkspaceUserRoleName,
  employeeEmploymentTypeOptions,
  employeeStatusOptions,
  selectedEmployeeRole,
  selectedEmployeeRoleSummary,
  selectedEmployeeRoleModules,
  selectedEmployeeRoleModuleSections,
  countPermissionRoleEnabledModules,
  countPermissionRoleFullAccessModules,
  createDefaultEmployeeDraft,
  saveStaticEmployee,
})

// Auth guard at initial hydration ang nagse-set ng tamang employer session bago buksan ang workspace.
const ensureEmployerAccess = async () => {
  const storedUser = getStoredAuthUser()

  try {
    const access = await resolveApprovedEmployerSession('business')

    if (access?.allowed && access?.user) {
      authUser.value = access.user
      return
    }
  } catch (error) {
    console.warn('[business-workspace] resolveApprovedEmployerSession failed:', error)
  }

  const normalizedRole = String(storedUser?.role || '').trim().toLowerCase()
  const employerType = normalizeEmployerOrganizationType(storedUser)

  const isBusinessUser =
    normalizedRole === 'employer' && employerType === 'business'

  if (isBusinessUser) {
    authUser.value = storedUser
    return
  }

  await router.replace('/login')
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
  if (hydrateBusinessWorkspaceUiPromise) return hydrateBusinessWorkspaceUiPromise

  hydrateBusinessWorkspaceUiPromise = (async () => {
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
    } finally {
      hydrateBusinessWorkspaceUiPromise = null
    }
  })()

  return hydrateBusinessWorkspaceUiPromise
}

const deferredBusinessStartupIdentity = ref('')
let hydrateBusinessWorkspaceUiPromise = null

const runBusinessTaskAfterFirstPaint = (task, delayMs = 0) => {
  const execute = () => {
    try {
      const taskResult = task()
      if (taskResult && typeof taskResult.then === 'function') {
        void taskResult
      }
    } catch (error) {
      console.warn('[business-workspace] Deferred startup task failed.', error)
    }
  }

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      if (delayMs > 0) {
        window.setTimeout(execute, delayMs)
        return
      }
      execute()
    }, { timeout: 1200 + delayMs })
    return
  }

  window.setTimeout(execute, Math.max(0, delayMs))
}

const startBusinessCoreStartupSync = () => {
  startWorkspaceUserDirectorySync()
  startBusinessMemberEmployerSync()
  startWorkspaceJobPostsSync()
  startBusinessJobApplicationsFirestoreSync()
  startBusinessContractFirestoreSync()
  restoreAdminPlanCatalog()
  restoreBusinessProfileState()
  syncProfileFormFromAuthUser()
}

const scheduleBusinessDeferredStartup = (identity = currentBusinessAccountIdentity.value) => {
  const normalizedIdentity = String(identity || '').trim()
  if (!normalizedIdentity) return
  if (deferredBusinessStartupIdentity.value === normalizedIdentity) return

  deferredBusinessStartupIdentity.value = normalizedIdentity
  const shouldRunForIdentity = () =>
    String(currentBusinessAccountIdentity.value || '').trim() === normalizedIdentity

  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startApplicantAssessmentScoreSync()
  }, 60)
  runBusinessTaskAfterFirstPaint(async () => {
    if (!shouldRunForIdentity()) return
    await startBusinessPaymentHistorySync()
    await hydrateBusinessWorkspaceUi()
  }, 120)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startApprovedApplicantSync()
  }, 180)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startAssessmentTemplateSync()
  }, 240)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startTrainingTemplateSync()
  }, 300)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startAssessmentAssignmentSync()
  }, 360)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startTrainingAssignmentSync()
  }, 420)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    startBusinessInterviewSchedulesFirestoreSync()
  }, 500)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    scheduleAssignedApplicantAssessmentScoreSync(120)
  }, 580)
  runBusinessTaskAfterFirstPaint(() => {
    if (!shouldRunForIdentity()) return
    handlePayMongoCheckoutReturn()
  }, 660)
}

// Pag mount, core subscriptions muna para mabilis ang first render; heavy sync tasks naka-defer.
onMounted(async () => {
  await ensureEmployerAccess()
  if (!authUser.value) return

  seenBusinessNotificationIds.value = readSeenBusinessNotificationIds()
  businessAccessRealtimeTimerId = window.setInterval(() => {
    businessRealtimeNow.value = Date.now()
  }, 1000)

  startAuthUserProfileSync()
  startBusinessCoreStartupSync()
  void hydrateBusinessWorkspaceUi()
  scheduleBusinessDeferredStartup(currentBusinessAccountIdentity.value)

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

watch(
  currentBusinessAccountIdentity,
  (identity) => {
    seenBusinessNotificationIds.value = readSeenBusinessNotificationIds(identity)
    syncBusinessDeliveredNotificationToastIds(
      readBusinessStoredNotificationIds(BUSINESS_DELIVERED_NOTIFICATION_TOAST_STORAGE_KEY, identity),
      identity,
    )
    hasBusinessNotificationFeedHydrated.value = false
  },
  { immediate: true },
)

watch(businessNavbarNotifications, () => {
  if (isNotificationMenuOpen.value) {
    markBusinessNotificationsAsRead()
  }
}, { deep: true })

watch(
  businessNavbarNotifications,
  (notifications) => {
    const activeNotifications = (Array.isArray(notifications) ? notifications : [])
      .map((item) => ({
        ...item,
        id: String(item?.id || '').trim(),
      }))
      .filter((item) => item.id)

    const nextNotificationIds = activeNotifications.map((item) => item.id)
    const persistedDeliveredNotificationIds = businessDeliveredNotificationToastIds.value
      .filter((notificationId) => nextNotificationIds.includes(notificationId))
    const deliveredNotificationIds = new Set(persistedDeliveredNotificationIds)

    if (persistedDeliveredNotificationIds.length !== businessDeliveredNotificationToastIds.value.length) {
      syncBusinessDeliveredNotificationToastIds(persistedDeliveredNotificationIds)
    }

    const unseenNotifications = activeNotifications.filter((item) =>
      isBusinessAutoToastNotification(item)
      && !seenBusinessNotificationIds.value.includes(item.id)
      && !deliveredNotificationIds.has(item.id))

    if (!hasBusinessNotificationFeedHydrated.value) {
      hasBusinessNotificationFeedHydrated.value = true
      if (unseenNotifications.length) {
        notifyBusinessActivity(unseenNotifications[0])
      }
    } else if (unseenNotifications.length) {
      notifyBusinessActivity(unseenNotifications[0])
    }

    if (!unseenNotifications.length) return

    rememberBusinessDeliveredNotificationToastIds(unseenNotifications.map((item) => item.id))
  },
  { deep: true },
)

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

  deferredBusinessStartupIdentity.value = ''
  startBusinessCoreStartupSync()
  void hydrateBusinessWorkspaceUi()
  scheduleBusinessDeferredStartup(nextIdentity)
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

watch(
  () => [profileForm.value.category, businessCategory.value],
  () => {
    const nextCategory = resolveJobPostingBusinessCategory(jobPostingDraft.value.category)
    if (!nextCategory || nextCategory === String(jobPostingDraft.value.category || '').trim()) return

    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      category: nextCategory,
    }
  },
  { immediate: true },
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
  scheduleAssignedApplicantAssessmentScoreSync()
}, { deep: true })

watch(businessInterviewSchedules, () => {
  rebuildTrainingAssignments()
}, { deep: true })

watch(() => businessInterviewSchedulingForm.value.selectedJobKey, () => {
  businessInterviewSchedulingForm.value = {
    ...businessInterviewSchedulingForm.value,
    applicationId: '',
    interviewType: 'interview',
  }
  businessInterviewSchedulingFormError.value = ''
})

watch(businessInterviewAvailableInterviewTypeOptions, (options) => {
  const firstAllowedType = options[0]?.value || 'interview'
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
    selectedTrainingTrackingCategoryId.value = ''
    selectedTrainingTrackingSkillKey.value = ''
    trainingTrackingViewMode.value = 'table'
    trainingTrackingCategoryRemarkDrafts.value = {}
    return
  }

  const matchingAssignment = assignments.find((assignment) => String(assignment?.id || '').trim() === normalizedSelectedId) || null
  if (!matchingAssignment) {
    selectedTrainingTrackingAssignmentId.value = String(assignments[0]?.id || '').trim()
    selectedTrainingTrackingCategoryId.value = String(assignments[0]?.templateCategories?.[0]?.id || '').trim()
    selectedTrainingTrackingSkillKey.value = ''
    return
  }

  const normalizedSelectedCategoryId = String(selectedTrainingTrackingCategoryId.value || '').trim()
  if (!normalizedSelectedCategoryId) {
    selectedTrainingTrackingCategoryId.value = String(matchingAssignment?.templateCategories?.[0]?.id || '').trim()
    selectedTrainingTrackingSkillKey.value = ''
    return
  }

  const hasSelectedCategory = matchingAssignment.templateCategories.some((category) =>
    String(category?.id || '').trim() === normalizedSelectedCategoryId)
  if (!hasSelectedCategory) {
    selectedTrainingTrackingCategoryId.value = String(matchingAssignment?.templateCategories?.[0]?.id || '').trim()
    selectedTrainingTrackingSkillKey.value = ''
    return
  }

  const normalizedSelectedSkillKey = String(selectedTrainingTrackingSkillKey.value || '').trim()
  if (!normalizedSelectedSkillKey) return

  const hasSelectedSkill = matchingAssignment.templateCategories.some((category) =>
    String(category?.id || '').trim() === normalizedSelectedCategoryId
    && category.skills.some((skill) =>
      createTrainingTrackingSelectedSkillKey(matchingAssignment.id, category.id, skill.id) === normalizedSelectedSkillKey))
  if (!hasSelectedSkill) {
    selectedTrainingTrackingSkillKey.value = ''
  }
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
      return
    }

    if (!sectionIds.includes(activeSection.value)) {
      const fallbackSection = resolveFirstAvailableBusinessSection()
      const matchingGroup = sidebarGroups.value.find((group) =>
        group.items.some((item) => item.id === fallbackSection),
      )

      activeSection.value = fallbackSection
      activeSidebarGroup.value = matchingGroup?.id || sidebarGroups.value[0]?.id || 'dashboard'
      if (matchingGroup && !expandedSidebarGroups.value.includes(matchingGroup.id)) {
        expandedSidebarGroups.value = [...expandedSidebarGroups.value, matchingGroup.id]
      }
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
  stopBusinessContractSync()
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
  if (assignedApplicantScoreSyncTimeoutId) {
    clearTimeout(assignedApplicantScoreSyncTimeoutId)
    assignedApplicantScoreSyncTimeoutId = null
  }
})
</script>

<template>
  <div
    class="business-workspace"
  >
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

    <component :is="isBusinessEmployeeWorkspaceMode ? BUserSidebar : BSidebar" v-bind="sidebarBindings" />

    <section class="business-main">
      <component :is="isBusinessEmployeeWorkspaceMode ? BUserNavbar : BNavbar" v-bind="navbarBindings" />



      <main class="business-content">
        <Transition name="business-section" mode="out-in">
          <div
            :key="activeSection"
            class="business-content__panel"
            :class="{ 'business-content__panel--subscriptions': activeSection === 'subscriptions' }"
          >
            <BDashboard v-if="activeSection === 'dashboard'" v-bind="dashboardBindings" />

            <Transition
              v-else-if="activeSection === 'subscriptions'"
              name="business-payment"
              mode="out-in"
            >
              <BSubscription
                v-if="subscriptionView === 'plans'"
                key="subscription-plans"
                v-bind="subscriptionBindings"
              />
              <BPayment
                v-else-if="subscriptionView === 'payment'"
                key="subscription-payment"
                v-bind="paymentBindings"
              />
              <BPaymentHistory
                v-else-if="subscriptionView === 'history'"
                key="subscription-history"
                v-bind="paymentHistoryBindings"
              />
            </Transition>

            <BRecruitment v-else-if="activeSection === 'job-posting'" v-bind="recruitmentBindings" />

            <BApplicant v-else-if="activeSection === 'applicant-management'" v-bind="applicantBindings" />

            <BIssueOffer v-else-if="activeSection === 'issue-offer'" v-bind="issueOfferBindings" />

            <BContractSigning v-else-if="activeSection === 'contract-signing'" v-bind="contractSigningBindings" />

            <BTeamMember
              v-else-if="activeSection === 'user-overview' || activeSection === 'create-user' || activeSection === 'add-employee' || activeSection === 'permissions'"
              v-bind="teamMemberBindings"
            />

            <!-- Legacy inline permissions block kept commented during extraction to BPermissionrules. -->
            <!--
                      <h3>{{ selectedPermissionRole?.name || 'Select a role' }}</h3>
                      <p v-if="selectedPermissionRole" class="business-permissions__role-meta">
                        {{ formatPermissionRoleAccessSummary(selectedPermissionRole) }}
                        <span aria-hidden="true">|</span>
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

            -->
            <BAssesment
              v-else-if="activeSection === 'assessment-management' || activeSection === 'applicant-score'"
              v-bind="assessmentBindings"
            />
            <BInterview v-else-if="activeSection === 'interview-scheduling'" v-bind="interviewBindings" />
            <BTraining v-else-if="activeSection === 'training-templates'" v-bind="trainingBindings" />
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
                        {{ isProfileAvatarLoading ? 'Loading image...' : profileForm.avatar ? 'Change Photo' : 'Upload Photo' }}
                      </button>
                      <button
                        v-if="profileForm.avatar"
                        type="button"
                        class="business-profile__secondary business-profile__secondary--danger"
                        :disabled="isProfileAvatarLoading"
                        @click="removeProfileAvatar"
                      >
                        Remove Photo
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

            <section v-else class="business-content__empty">
              <article class="business-content__empty-card business-content__empty-card--error">
                <strong>Workspace view refreshed</strong>
                <p>This page is not available for the current account, so the workspace is returning to a safe dashboard section.</p>
                <div class="business-content__empty-action-row">
                  <button type="button" class="business-content__empty-button" @click="applyBusinessWorkspaceDashboardLanding">
                    Open Dashboard
                  </button>
                </div>
              </article>
            </section>


          </div>
        </Transition>
      </main>
    </section>

    <Transition name="business-trial-modal">
      <div v-if="isBusinessNotificationDetailOpen && selectedBusinessNotification" class="business-modal" @click.self="closeBusinessNotificationDetail">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-notification-title">
          <div class="business-modal__copy">
            <h2 id="business-notification-title">{{ selectedBusinessNotification.title }}</h2>
            <p>{{ selectedBusinessNotification.message }}</p>
            <p class="business-modal__note">{{ selectedBusinessNotification.sectionLabel }} | {{ selectedBusinessNotification.timeLabel }}</p>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              @click="closeBusinessNotificationDetail"
            >
              Close
            </button>
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              @click="openBusinessNotificationTarget"
            >
              {{ businessNotificationPrimaryActionLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <BModals v-bind="modalBindings" />
    <AppToast :toast="businessWorkspaceToast" @close="closePaymentToast" />
    <BIssueOfferModal
      :is-open="isBusinessIssueOfferOpen"
      :candidate="selectedBusinessIssueOfferCandidate"
      :is-submitting="isBusinessJobOfferSaving"
      :form="businessIssueOfferDraft"
      :form-error="businessIssueOfferFormError"
      :min-date="businessIssueOfferMinDate"
      @close="closeIssueOfferModal"
      @submit="submitBusinessIssueOffer"
      @update:form-title="setBusinessIssueOfferField('offerTitle', $event)"
      @update:form-compensation="setBusinessIssueOfferField('compensation', $event)"
      @update:form-start-date="setBusinessIssueOfferField('startDate', $event)"
      @update:form-response-deadline="setBusinessIssueOfferField('responseDeadline', $event)"
      @update:form-offer-letter="setBusinessIssueOfferField('offerLetter', $event)"
    />
  </div>
</template>



