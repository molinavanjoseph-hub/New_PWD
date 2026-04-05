<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import pwdLogo from '@/assets/logo-pwd.png'
import gcashPaymentLogo from '@/assets/gcash-payment.png'
import masterCardLogo from '@/assets/master-card.png'
import {
  clearAuthSession,
  createBusinessWorkspaceUserAccount,
  getAccountApprovalStatus,
  getStoredAuthUser,
  refreshStoredAuthUserProfile,
  saveBusinessWorkspacePermissions,
  syncBusinessWorkspaceUserDirectory,
  subscribeToBusinessWorkspaceUsers,
  subscribeToStoredAuthUserProfile,
} from '@/lib/auth'
import {
  ADMIN_PLAN_CATALOG_STORAGE_KEY,
  normalizePlanRecord,
} from '@/lib/business_plan_access'
import {
  createBusinessJobPost,
  deleteBusinessJobPost,
  subscribeToWorkspaceJobs,
  updateBusinessJobPost,
} from '@/lib/jobs'
import 'flag-icons/css/flag-icons.min.css'

const router = useRouter()
const MOCK_PAYMENT_MESSAGE_TYPE = 'business-mock-payment-complete'
const BUSINESS_PAYMENT_HISTORY_STORAGE_KEY = 'businessPaymentHistory'
const ADMIN_PAYMENT_HISTORY_STORAGE_KEY = 'adminPaymentHistory'
const BUSINESS_SUBSCRIPTION_STATE_STORAGE_KEY = 'businessSubscriptionState'
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
const authUser = ref(null)
const isSavingPermissionRoles = ref(false)
const isWorkspaceUserDirectoryLoading = ref(false)
const workspaceUserDirectorySyncMessage = ref('')
const activeSection = ref('dashboard')
const isProfileMenuOpen = ref(false)
const isLogoutSubmitting = ref(false)
const isLogoutConfirmOpen = ref(false)
const isHelpCenterModalOpen = ref(false)
const isTrialConfirmationOpen = ref(false)
const isCancelPaymentModalOpen = ref(false)
const isProceedingToPayment = ref(false)
const isAdvancingPaymentStep = ref(false)
const isProcessingTestModePayment = ref(false)
const isAwaitingExternalPayment = ref(false)
const activeSubscriptionPlan = ref('free')
const activeSubscriptionMode = ref('none')
const premiumTrialStartedAt = ref(null)
const premiumPaidStartedAt = ref(null)
const adminPlanCatalog = ref([])
const paymentHistoryEntries = ref([])
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
const proceedToPaymentTimeoutId = ref(null)
const advancePaymentTimeoutId = ref(null)
const paymentToastTimeoutId = ref(null)
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
const seenPremiumNavItems = ref([])
const sidebarLinkRefs = ref({})
const jobPostUnlimitedHighlightRef = ref(null)
const pendingPremiumWelcomeGuideMode = ref('')
const isPremiumWelcomeGuideVisible = ref(false)
const premiumWelcomeGuideStep = ref(0)
const premiumWelcomeGuideMode = ref('paid')
const premiumGuideTargetRect = ref(null)
const activeSidebarGroup = ref('dashboard')
let stopAuthUserProfileSync = () => {}
let stopWorkspaceUserDirectorySync = () => {}

const premiumNavigationItems = [
  { id: 'assessment-management', label: 'Assessment Management', icon: 'bi bi-ui-checks-grid' },
  { id: 'applicant-score', label: 'Applicant Score', icon: 'bi bi-bar-chart-fill' },
  { id: 'interview-scheduling', label: 'Interview Scheduling', icon: 'bi bi-calendar-event-fill' },
  { id: 'training-templates', label: 'Training Templates', icon: 'bi bi-journal-text' },
]
const premiumCelebrationPieces = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

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
  const isPremiumNavItemNew = (id) =>
    activeSubscriptionPlan.value === 'premium'
    && premiumNavigationItems.some((item) => item.id === id)
    && !seenPremiumNavItems.value.includes(id)

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
        { id: 'job-posting', label: 'Job Posting' },
        { id: 'applicant-management', label: 'Applicant Management' },
      ],
    },
    {
      id: 'assessment',
      label: 'Assessment',
      icon: 'bi bi-ui-checks-grid',
      items: [
        {
          id: 'assessment-management',
          label: 'Assessment Management',
          isNew: isPremiumNavItemNew('assessment-management'),
        },
        {
          id: 'applicant-score',
          label: 'Applicant Score',
          isNew: isPremiumNavItemNew('applicant-score'),
        },
      ],
    },
    {
      id: 'interview',
      label: 'Interview',
      icon: 'bi bi-calendar-event-fill',
      items: [
        {
          id: 'interview-scheduling',
          label: 'Interview Scheduling',
          isNew: isPremiumNavItemNew('interview-scheduling'),
        },
      ],
    },
    {
      id: 'training',
      label: 'Training',
      icon: 'bi bi-journal-richtext',
      items: [
        {
          id: 'training-templates',
          label: 'Training Templates',
          isNew: isPremiumNavItemNew('training-templates'),
        },
      ],
    },
    {
      id: 'employees',
      label: 'User Management',
      icon: 'bi bi-people-fill',
      items: [
        { id: 'create-user', label: 'Create User' },
        { id: 'add-employee', label: 'Add Employee' },
      ],
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: 'bi bi-shield-lock-fill',
      items: [
        { id: 'permissions', label: 'Permissions' },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.id === 'dashboard'
        ? group.items
        : group.items.filter((item) =>
          item.id === 'training-templates'
            ? canViewTrainingWorkspace.value
            : canViewBusinessModule(item.id),
        ),
    }))
    .filter((group) => group.id === 'dashboard' || group.items.length)
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
const showBusinessSidebar = computed(() => true)
const availableSidebarSectionIds = computed(() =>
  sidebarGroups.value.flatMap((group) => group.items.map((item) => item.id)),
)

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

const summaryCards = computed(() => [
  { label: 'Business Type', value: 'Business' },
  { label: 'Category', value: businessCategory.value },
  { label: 'Location', value: businessLocation.value },
])

const dashboardProgressCards = computed(() => [
  { label: 'Hiring Cycle', value: '60%', copy: 'Applicants screened and moved to the next stage.' },
  { label: 'Interview Rate', value: '46%', copy: 'Candidates scheduled for interview this month.' },
  { label: 'Workspace Health', value: '90%', copy: 'Premium tools and team workflow are active.' },
])

const dashboardTrendMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dashboardBarSeries = [
  { label: 'Job Post', value: '18%', width: '18%' },
  { label: 'Screening', value: '52%', width: '52%' },
  { label: 'Interview', value: '71%', width: '71%' },
  { label: 'Review', value: '63%', width: '63%' },
  { label: 'Offer', value: '43%', width: '43%' },
]
const dashboardDonutLegend = [
  { label: 'Applicants', value: '15%', color: '#29b4ff' },
  { label: 'Interviews', value: '17%', color: '#5568ff' },
  { label: 'Shortlist', value: '13%', color: '#7b4bff' },
  { label: 'Training', value: '10%', color: '#d44bff' },
  { label: 'Hired', value: '14%', color: '#ff5f8f' },
  { label: 'Archive', value: '10%', color: '#ff8c42' },
]

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
]
const JOB_POSTING_EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']
const JOB_POSTING_DISABILITY_TYPES = [
  'Physical Impairment',
  'Visual Impairment',
  'Hearing Impairment',
  'Speech and Language Impairment',
  'Intellectual Disability',
  'Psychosocial Disability',
  'Learning Disability',
  'Autism Spectrum Disorder',
  'Chronic Illness / Medical Condition',
  'Multiple Disabilities',
]
const JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION = new Set([
  'Physical Impairment',
  'Visual Impairment',
  'Hearing Impairment',
  'Speech and Language Impairment',
  'Chronic Illness / Medical Condition',
  'Multiple Disabilities',
])
const JOB_POSTING_LANGUAGE_OPTIONS = ['English', 'Filipino', 'English, Filipino', 'Filipino, English, Taglish']
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
        await deleteBusinessJobPost(normalizedJobId, {
          workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
        })

        if (editingJobPostId.value === normalizedJobId) {
          resetJobPostingDraft()
          jobPostingTab.value = 'posted'
        }

        showPaymentToast('Job post deleted permanently.', 'success')
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
  'create-user': {
    title: 'Create User',
    description: 'Create a login and assign a saved role.',
  },
  'add-employee': {
    title: 'Add Employee',
    description: 'Link a created user to an employee profile.',
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
const createEmployeeRecord = (record = {}, index = 0) => ({
  id: String(record.id || `EMP-${1001 + index}`),
  linkedUserId: String(record.linkedUserId || ''),
  name: String(record.name || '').trim(),
  workEmail: String(record.workEmail || record.email || '').trim().toLowerCase(),
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
const saveWorkspaceUserAccount = async () => {
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
    userAccountDraft.value = createDefaultUserAccountDraft()
    showPaymentToast(
      `User account created for ${user?.email || normalizedGmail}. The workspace directory will update from Firebase automatically.`,
      'success',
    )
  } catch (error) {
    showPaymentToast(error instanceof Error ? error.message : 'Unable to create the user account right now.', 'error')
  } finally {
    isCreatingWorkspaceUser.value = false
  }
}
const saveStaticEmployee = () => {
  if (!canEditBusinessModule('add-employee')) {
    showPaymentToast('Your role has view-only access for Add Employee.', 'warning')
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

  const nextEmployeeNumber = 1000 + employeeDirectory.value.length + 1
  employeeDirectory.value.unshift(createEmployeeRecord({
    id: `EMP-${nextEmployeeNumber}`,
    linkedUserId: linkedUser.id,
    name: linkedUser.name,
    workEmail: linkedUser.gmail,
    employmentType: employeeDraft.value.employmentType,
    phoneNumber: employeeDraft.value.phoneNumber.trim(),
    startDate: employeeDraft.value.startDate,
    status: employeeDraft.value.status,
    lastActive: employeeDraft.value.status === 'Pending Invite' ? 'Invite sent just now' : 'Just now',
  }))
  employeeDraft.value = createDefaultEmployeeDraft()
  activeSection.value = 'add-employee'
  activeSidebarGroup.value = 'employees'
  showPaymentToast('Employee profile added to the user directory.', 'success')
}
const permissionRoleColorPalette = ['#5865f2', '#57f287', '#faa61a', '#eb459e', '#3ba55d', '#f04747', '#5d7cff']
const permissionModuleSections = [
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
        || ((meta.id === 'create-user' || meta.id === 'add-employee') ? legacyUserManagementModule : null)
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
      'job-posting',
      'applicant-management',
      'assessment-management',
      'applicant-score',
      'interview-scheduling',
      'create-user',
      'add-employee',
    ]),
  }, 1),
  createPermissionRoleRecord({
    id: 'role-training-lead',
    name: 'Training Lead',
    color: '#faa61a',
    modules: createPermissionModulePreset([
      'training-templates',
      'assign-templates',
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
  const view = Boolean(permissions.view || edit || full)

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
const selectedEmployeeRoleSummary = computed(() => formatPermissionRoleAccessSummary(selectedEmployeeLinkedUser.value?.roleId))
const selectedEmployeeRoleModules = computed(() => formatPermissionRoleSidebarSummary(selectedEmployeeLinkedUser.value?.roleId))
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
const persistEmployeeDirectoryState = () => {
  if (!authUser.value) return

  localStorage.setItem(getBusinessScopedStorageKey(BUSINESS_USER_MANAGEMENT_STATE_STORAGE_KEY), JSON.stringify({
    employees: employeeDirectory.value,
  }))
}
const restoreEmployeeDirectoryState = () => {
  if (!authUser.value) return

  try {
    const rawState = localStorage.getItem(getBusinessScopedStorageKey(BUSINESS_USER_MANAGEMENT_STATE_STORAGE_KEY))
    if (!rawState) {
      employeeDirectory.value = createDefaultEmployeeDirectory()
      userAccountDraft.value = createDefaultUserAccountDraft()
      employeeDraft.value = createDefaultEmployeeDraft()
      return
    }

    const parsedState = JSON.parse(rawState)
    const nextEmployees = Array.isArray(parsedState?.employees)
      ? parsedState.employees.map((employee, index) => createEmployeeRecord(employee, index))
      : createDefaultEmployeeDirectory()

    employeeDirectory.value = nextEmployees
    userAccountDraft.value = createDefaultUserAccountDraft()
    employeeDraft.value = createDefaultEmployeeDraft()
  } catch {
    employeeDirectory.value = createDefaultEmployeeDirectory()
    userAccountDraft.value = createDefaultUserAccountDraft()
    employeeDraft.value = createDefaultEmployeeDraft()
  }
}
const getWorkspaceOwnerDirectoryId = (user = authUser.value) =>
  String(user?.workspace_owner_id || user?.workspaceOwnerId || user?.id || '').trim()
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
      workspaceUserDirectory.value = createDefaultWorkspaceUsers()
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
      postedJobs.value = []
      isPostedJobsLoading.value = false
      postedJobsSyncMessage.value = logBusinessStartupSyncIssue(
        'Posted jobs subscription failed during startup.',
        error,
        'The posted jobs list is unavailable right now.',
      )
    },
  )
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
const businessApplicantHighlights = [
  { label: 'New Applicants', value: '0' },
  { label: 'Shortlisted', value: '0' },
  { label: 'Interview Ready', value: '0' },
]
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
const selectedTrainingQuestionType = ref('multiple-choice')
let trainingTemplateQuestionId = 1
let trainingTemplateId = 1
let assessmentTemplateQuestionId = 1
let assessmentTemplateId = 1
const createTrainingQuestionId = () => `training-question-${Date.now()}-${trainingTemplateQuestionId++}`
const createTrainingTemplateId = () => `training-template-${Date.now()}-${trainingTemplateId++}`
const createAssessmentQuestionId = () => `assessment-question-${Date.now()}-${assessmentTemplateQuestionId++}`
const createAssessmentTemplateId = () => `assessment-template-${Date.now()}-${assessmentTemplateId++}`
const fallbackAssignableTrainingTemplates = [
  { id: 'training-template-onboarding', title: 'New Hire Onboarding' },
  { id: 'training-template-accessibility', title: 'Accessibility Support Basics' },
  { id: 'training-template-operations', title: 'Operations Readiness Training' },
]
const fallbackAssignableAssessmentTemplates = [
  { id: 'sample-frontend-screen', title: 'Frontend Technical Screen' },
  { id: 'sample-customer-support', title: 'Customer Support Screening' },
  { id: 'sample-operations-check', title: 'Operations Readiness Check' },
]
const trainingTemplateAssignments = ref([
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
])
const approvedApplicantTemplateAssignments = ref([
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
])
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
const businessInterviewApplicants = ref([
  {
    id: 'business-interview-applicant-001',
    jobId: 'business-job-frontend',
    applicantName: 'Miguel Santos',
    applicantEmail: 'miguel.santos@example.com',
    applicantId: 'APP-001',
    jobTitle: 'Frontend Developer',
    status: 'accepted',
    technicalStage: 'passed',
  },
  {
    id: 'business-interview-applicant-002',
    jobId: 'business-job-customer-support',
    applicantName: 'Andrea Cruz',
    applicantEmail: 'andrea.cruz@example.com',
    applicantId: 'APP-002',
    jobTitle: 'Customer Support Associate',
    status: 'accepted',
    technicalStage: 'assigned',
  },
  {
    id: 'business-interview-applicant-003',
    jobId: 'business-job-customer-support',
    applicantName: 'Joshua Rivera',
    applicantEmail: 'joshua.rivera@example.com',
    applicantId: 'APP-003',
    jobTitle: 'Customer Support Associate',
    status: 'accepted',
    technicalStage: 'failed',
  },
  {
    id: 'business-interview-applicant-004',
    jobId: 'business-job-operations',
    applicantName: 'Camille Dela Cruz',
    applicantEmail: 'camille.delacruz@example.com',
    applicantId: 'APP-004',
    jobTitle: 'Operations Assistant',
    status: 'accepted',
    technicalStage: 'passed',
  },
  {
    id: 'business-interview-applicant-005',
    jobId: 'business-job-frontend',
    applicantName: 'Noah Mendoza',
    applicantEmail: 'noah.mendoza@example.com',
    applicantId: 'APP-005',
    jobTitle: 'Frontend Developer',
    status: 'interviewed',
    technicalStage: 'passed',
  },
])
const businessInterviewSchedules = ref([
  {
    id: 'business-interview-schedule-001',
    applicationId: 'business-interview-applicant-001',
    applicantName: 'Miguel Santos',
    applicantEmail: 'miguel.santos@example.com',
    applicantId: 'APP-001',
    jobTitle: 'Frontend Developer',
    interviewType: 'initial',
    scheduledAt: createBusinessInterviewScheduleIso({ days: 2, hours: 10, minutes: 0 }),
    mode: 'online',
    locationOrLink: 'https://meet.google.com/frontend-screen',
    interviewer: 'Angela Reyes',
    notes: 'Portfolio walkthrough and accessibility review.',
    scheduleStatus: 'scheduled',
  },
  {
    id: 'business-interview-schedule-002',
    applicationId: 'business-interview-applicant-004',
    applicantName: 'Camille Dela Cruz',
    applicantEmail: 'camille.delacruz@example.com',
    applicantId: 'APP-004',
    jobTitle: 'Operations Assistant',
    interviewType: 'initial',
    scheduledAt: createBusinessInterviewScheduleIso({ days: -1, hours: 14, minutes: 30 }),
    mode: 'in-person',
    locationOrLink: 'Operations Office - Room 204',
    interviewer: 'Marco Villanueva',
    notes: 'Completed panel interview and endorsed for final round.',
    scheduleStatus: 'completed',
  },
  {
    id: 'business-interview-schedule-003',
    applicationId: 'business-interview-applicant-005',
    applicantName: 'Noah Mendoza',
    applicantEmail: 'noah.mendoza@example.com',
    applicantId: 'APP-005',
    jobTitle: 'Frontend Developer',
    interviewType: 'initial',
    scheduledAt: createBusinessInterviewScheduleIso({ days: 4, hours: 13, minutes: 30 }),
    mode: 'online',
    locationOrLink: 'https://meet.google.com/frontend-finalists',
    interviewer: 'Liza Fernandez',
    notes: 'Focus on frontend architecture and collaboration workflow.',
    scheduleStatus: 'scheduled',
  },
])
const businessInterviewSchedulingForm = ref(createBusinessInterviewSchedulingForm())
const businessInterviewSchedulingFormError = ref('')
const isBusinessInterviewRefreshing = ref(false)
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
const businessInterviewAvailableInterviewTypeOptions = computed(() => {
  if (businessInterviewHasCompletedInitialInterview.value) {
    return [{ value: 'final', label: 'Final Interview' }]
  }

  return [{ value: 'initial', label: 'Initial Interview' }]
})
const businessInterviewScheduledEntries = computed(() =>
  businessInterviewSchedules.value.filter((entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'scheduled'),
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
  scheduled: businessInterviewSchedules.value.filter(
    (entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'scheduled',
  ).length,
  completed: businessInterviewSchedules.value.filter(
    (entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'completed',
  ).length,
}))
const getLatestBusinessInterviewSchedule = (applicationId) =>
  businessInterviewSchedules.value
    .filter((entry) => String(entry.applicationId || '').trim() === String(applicationId || '').trim())
    .slice()
    .sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime())[0] || null
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
        const statusTone = scheduleStatus === 'completed'
          ? 'completed'
          : scheduleStatus === 'scheduled'
            ? 'scheduled'
            : 'blocked'

        return {
          id: applicant.id,
          applicantName: applicant.applicantName,
          applicantEmail: applicant.applicantEmail,
          applicantId: applicant.applicantId,
          jobTitle: applicant.jobTitle,
          currentStage: formatBusinessInterviewTypeLabel(latestSchedule.interviewType),
          stageDetail: formatBusinessInterviewModeLabel(latestSchedule.mode),
          scheduleLabel: formatBusinessInterviewDateTime(latestSchedule.scheduledAt),
          interviewer: latestSchedule.interviewer || 'TBD',
          statusLabel: scheduleStatus === 'completed'
            ? 'Completed'
            : scheduleStatus === 'scheduled'
              ? 'Scheduled'
              : 'On Hold',
          statusTone,
        }
      }

      if (technicalStage === 'passed') {
        return {
          id: applicant.id,
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
        }
      }

      return {
        id: applicant.id,
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
  scheduled: businessInterviewStatusRows.value.filter((entry) => entry.statusTone === 'scheduled').length,
  completed: businessInterviewStatusRows.value.filter((entry) => entry.statusTone === 'completed').length,
}))
const syncBusinessInterviewCalendar = (rows = businessInterviewSchedules.value) => {
  const scheduledRows = rows
    .filter((entry) => normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) === 'scheduled')
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
  showPaymentToast('Applicant queue refreshed for interview scheduling.', 'success')
}
const createBusinessInterviewSchedule = () => {
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

  const nextSchedule = {
    id: createBusinessInterviewScheduleId(),
    applicationId: selectedApplicant.id,
    applicantName: selectedApplicant.applicantName,
    applicantEmail: selectedApplicant.applicantEmail,
    applicantId: selectedApplicant.applicantId,
    jobTitle: selectedApplicant.jobTitle,
    interviewType: businessInterviewSchedulingForm.value.interviewType,
    scheduledAt: new Date(scheduleTimestamp).toISOString(),
    mode: businessInterviewSchedulingForm.value.mode,
    locationOrLink: businessInterviewSchedulingForm.value.locationOrLink.trim(),
    interviewer: businessInterviewSchedulingForm.value.interviewer.trim(),
    notes: businessInterviewSchedulingForm.value.notes.trim(),
    scheduleStatus: 'scheduled',
  }

  businessInterviewSchedules.value = [
    nextSchedule,
    ...businessInterviewSchedules.value,
  ]

  const createdDate = new Date(nextSchedule.scheduledAt)
  businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(createdDate)
  businessInterviewCalendarBaseDate.value = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1)
  resetBusinessInterviewSchedulingForm()
  showPaymentToast('Interview schedule created. Review it in the Interview Status tab.', 'success')
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

const createTrainingTemplateQuestion = (type) => ({
  id: createTrainingQuestionId(),
  type,
  label: '',
  helpText: '',
  required: false,
  options: buildTemplateQuestionOptions(type),
})

const cloneTrainingTemplateQuestion = (question = {}) => {
  const resolvedType = trainingQuestionTypeOptions.some((item) => item.value === question?.type)
    ? question.type
    : 'multiple-choice'
  const resolvedOptions = Array.isArray(question?.options)
    ? question.options.map((option) => String(option || ''))
    : buildTemplateQuestionOptions(resolvedType)

  return {
    id: String(question?.id || createTrainingQuestionId()),
    type: resolvedType,
    label: String(question?.label || ''),
    helpText: String(question?.helpText || ''),
    required: Boolean(question?.required),
    options: resolvedOptions.length ? resolvedOptions : buildTemplateQuestionOptions(resolvedType),
  }
}

const createEmptyTrainingTemplateDraft = () => ({
  title: '',
  description: '',
  questions: [
    createTrainingTemplateQuestion('multiple-choice'),
  ],
})

const normalizeTrainingTemplateRecord = (template = {}) => ({
  id: String(template?.id || createTrainingTemplateId()),
  title: String(template?.title || ''),
  description: String(template?.description || ''),
  questions: Array.isArray(template?.questions) && template.questions.length
    ? template.questions.map((question) => cloneTrainingTemplateQuestion(question))
    : [createTrainingTemplateQuestion('multiple-choice')],
  updatedAt: String(template?.updatedAt || new Date().toISOString()),
})

const createTrainingTemplateDraftFromRecord = (template = {}) => {
  const normalized = normalizeTrainingTemplateRecord(template)

  return {
    title: normalized.title,
    description: normalized.description,
    questions: normalized.questions.map((question) => cloneTrainingTemplateQuestion(question)),
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

const addTrainingTemplateQuestion = () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  trainingTemplateDraft.value.questions.push(createTrainingTemplateQuestion(selectedTrainingQuestionType.value))
}

const removeTrainingTemplateQuestion = (questionId) => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  if (trainingTemplateDraft.value.questions.length <= 1) {
    showPaymentToast('Keep at least one question in the training template.', 'warning')
    return
  }

  trainingTemplateDraft.value.questions = trainingTemplateDraft.value.questions.filter((question) => question.id !== questionId)
}

const saveTrainingTemplate = () => {
  if (!canEditBusinessModule('training-templates')) {
    showPaymentToast('Your role has view-only access for Training Templates.', 'warning')
    return
  }

  const normalizedTitle = String(trainingTemplateDraft.value.title || '').trim()
  if (!normalizedTitle) {
    showPaymentToast('Add a template title before saving the training template.', 'warning')
    return
  }

  const isEditingExistingTemplate = Boolean(editingTrainingTemplateId.value)
  const nextRecord = normalizeTrainingTemplateRecord({
    ...trainingTemplateDraft.value,
    id: editingTrainingTemplateId.value || createTrainingTemplateId(),
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  })

  trainingTemplateLibrary.value = [
    nextRecord,
    ...trainingTemplateLibrary.value.filter((template) => template.id !== nextRecord.id),
  ]
  editingTrainingTemplateId.value = nextRecord.id
  trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(nextRecord)
  showPaymentToast(
    isEditingExistingTemplate
      ? 'Training template updated in your library.'
      : 'Training template saved to your library.',
    'success',
  )
}

const assignableTrainingTemplates = computed(() => {
  const savedTemplates = trainingTemplateLibrary.value.map((template) => ({
    id: template.id,
    title: template.title || 'Untitled training template',
  }))
  const usedIds = new Set(savedTemplates.map((template) => template.id))

  return [
    ...savedTemplates,
    ...fallbackAssignableTrainingTemplates.filter((template) => !usedIds.has(template.id)),
  ]
})

const assignedTrainingTemplateRows = computed(() =>
  trainingTemplateAssignments.value.filter((member) => member.assignmentStatus === 'Assigned'),
)

const getAssignableTrainingTemplateLabel = (templateId) =>
  assignableTrainingTemplates.value.find((template) => template.id === templateId)?.title || 'Unassigned'

const assignTrainingTemplateToMember = (memberId) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetMember = trainingTemplateAssignments.value.find((member) => member.id === memberId)
  if (!targetMember) return

  if (!targetMember.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the team member.', 'warning')
    return
  }

  targetMember.assignmentStatus = 'Assigned'
  targetMember.progressStatus = 'Not Started'
  targetMember.assignedAt = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date())
  showPaymentToast(`Training template assigned to ${targetMember.name}.`, 'success')
}

const resolveTrainingQuestionTypeMeta = (type) =>
  trainingQuestionTypeOptions.find((item) => item.value === type) || trainingQuestionTypeOptions[0]

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
  questions: [
    createAssessmentTemplateQuestion('multiple-choice'),
  ],
})

const normalizeAssessmentTemplateRecord = (template = {}) => ({
  id: String(template?.id || createAssessmentTemplateId()),
  title: String(template?.title || ''),
  description: String(template?.description || ''),
  instructions: String(template?.instructions || ''),
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
    questions: normalized.questions.map((question) => cloneAssessmentTemplateQuestion(question)),
  }
}

const assessmentTemplateDraft = ref(createEmptyAssessmentTemplateDraft())

const assignableAssessmentTemplates = computed(() => {
  const savedTemplates = assessmentTemplateLibrary.value.map((template) => ({
    id: template.id,
    title: template.title || 'Untitled assessment template',
  }))
  const usedIds = new Set(savedTemplates.map((template) => template.id))

  return [
    ...savedTemplates,
    ...fallbackAssignableAssessmentTemplates.filter((template) => !usedIds.has(template.id)),
  ]
})

const assignedApplicantTemplateRows = computed(() =>
  approvedApplicantTemplateAssignments.value.filter((applicant) => applicant.assignmentStatus === 'Assigned'),
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

const saveAssessmentTemplate = () => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const normalizedTitle = String(assessmentTemplateDraft.value.title || '').trim()
  if (!normalizedTitle) {
    showPaymentToast('Add a template title before saving the assessment.', 'warning')
    return
  }

  const isEditingExistingTemplate = Boolean(editingAssessmentTemplateId.value)
  const nextRecord = normalizeAssessmentTemplateRecord({
    ...assessmentTemplateDraft.value,
    id: editingAssessmentTemplateId.value || createAssessmentTemplateId(),
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  })

  assessmentTemplateLibrary.value = [
    nextRecord,
    ...assessmentTemplateLibrary.value.filter((template) => template.id !== nextRecord.id),
  ]
  editingAssessmentTemplateId.value = nextRecord.id
  assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(nextRecord)
  showPaymentToast(
    isEditingExistingTemplate
      ? 'Assessment template updated in your library.'
      : 'Assessment template saved to your library.',
    'success',
  )
}

const getAssignableTemplateLabel = (templateId) =>
  assignableAssessmentTemplates.value.find((template) => template.id === templateId)?.title || 'Unassigned'

const assignAssessmentTemplateToApplicant = (applicantId) => {
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

  targetApplicant.assignmentStatus = 'Assigned'
  targetApplicant.assignedAt = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date())
  showPaymentToast(`Template assigned to ${targetApplicant.name}.`, 'success')
}

const persistAssessmentTemplateLibrary = () => {
  if (!authUser.value) return

  localStorage.setItem(
    getBusinessScopedStorageKey(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY),
    JSON.stringify(assessmentTemplateLibrary.value),
  )
}

const restoreAssessmentTemplateLibrary = () => {
  if (!authUser.value) {
    assessmentTemplateLibrary.value = []
    editingAssessmentTemplateId.value = ''
    assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
    return
  }

  try {
    const scopedKey = getBusinessScopedStorageKey(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY)
    const legacyScopedKey = findLegacyBusinessStorageKey(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY)
    const unscopedLegacyKey = localStorage.getItem(BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY) !== null
      ? BUSINESS_ASSESSMENT_TEMPLATE_STATE_STORAGE_KEY
      : ''
    const storageKey =
      localStorage.getItem(scopedKey) !== null
        ? scopedKey
        : legacyScopedKey || unscopedLegacyKey || scopedKey
    const rawTemplates = JSON.parse(
      localStorage.getItem(storageKey) || '[]',
    )
    const restoredTemplates = Array.isArray(rawTemplates)
      ? rawTemplates.map((template) => normalizeAssessmentTemplateRecord(template))
      : []

    assessmentTemplateLibrary.value = restoredTemplates
    if (restoredTemplates.length && storageKey && storageKey !== scopedKey) {
      persistAssessmentTemplateLibrary()
    }

    if (restoredTemplates.length) {
      editingAssessmentTemplateId.value = restoredTemplates[0].id
      assessmentTemplateDraft.value = createAssessmentTemplateDraftFromRecord(restoredTemplates[0])
      return
    }
  } catch {
    assessmentTemplateLibrary.value = []
  }

  editingAssessmentTemplateId.value = ''
  assessmentTemplateDraft.value = createEmptyAssessmentTemplateDraft()
}

const persistTrainingTemplateLibrary = () => {
  if (!authUser.value) return

  localStorage.setItem(
    getBusinessScopedStorageKey(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY),
    JSON.stringify(trainingTemplateLibrary.value),
  )
}

const restoreTrainingTemplateLibrary = () => {
  if (!authUser.value) {
    trainingTemplateLibrary.value = []
    editingTrainingTemplateId.value = ''
    trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
    return
  }

  try {
    const scopedKey = getBusinessScopedStorageKey(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY)
    const legacyScopedKey = findLegacyBusinessStorageKey(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY)
    const unscopedLegacyKey = localStorage.getItem(BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY) !== null
      ? BUSINESS_TRAINING_TEMPLATE_STATE_STORAGE_KEY
      : ''
    const storageKey =
      localStorage.getItem(scopedKey) !== null
        ? scopedKey
        : legacyScopedKey || unscopedLegacyKey || scopedKey
    const rawTemplates = JSON.parse(
      localStorage.getItem(storageKey) || '[]',
    )
    const restoredTemplates = Array.isArray(rawTemplates)
      ? rawTemplates.map((template) => normalizeTrainingTemplateRecord(template))
      : []

    trainingTemplateLibrary.value = restoredTemplates
    if (restoredTemplates.length && storageKey && storageKey !== scopedKey) {
      persistTrainingTemplateLibrary()
    }

    if (restoredTemplates.length) {
      editingTrainingTemplateId.value = restoredTemplates[0].id
      trainingTemplateDraft.value = createTrainingTemplateDraftFromRecord(restoredTemplates[0])
      return
    }
  } catch {
    trainingTemplateLibrary.value = []
  }

  editingTrainingTemplateId.value = ''
  trainingTemplateDraft.value = createEmptyTrainingTemplateDraft()
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
}

const subscriptionPlans = computed(() => {
  const isPremiumActive = activeSubscriptionPlan.value === 'premium'
  const isTrialActive = activeSubscriptionMode.value === 'trial'
  const isPaidPremiumActive = activeSubscriptionMode.value === 'paid'

  return [
    {
      id: 'free-trial',
      title: 'Free Trial',
      badge: isTrialActive ? 'Current' : isPaidPremiumActive ? 'Unavailable' : 'New',
      subtitle: 'Use premium tools for 30 days first, then continue with automatic billing after the trial period.',
      tone: 'trial',
      features: [
        '30 days of premium employer access',
        'No immediate charge today',
        'Requires GCash or Credit Card for automatic billing after the trial',
      ],
      cta: isTrialActive ? 'Current Trial' : isPaidPremiumActive ? 'Unavailable' : 'Start Free Trial',
      trialNote:
        isTrialActive
          ? 'Your free trial is already active on this account'
          : isPaidPremiumActive
            ? 'This account already has premium subscription access'
            : 'Billing starts automatically after the 30-day trial unless cancelled',
      isDisabled: isPremiumActive,
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
    const storageKey =
      getBusinessScopedStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY)
      || findLegacyBusinessStorageKey(BUSINESS_PAYMENT_HISTORY_STORAGE_KEY)
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

const persistBusinessSubscriptionState = () => {
  if (!authUser.value) return

  const payload = {
    activeSubscriptionPlan: activeSubscriptionPlan.value,
    activeSubscriptionMode: activeSubscriptionMode.value,
    activeSection: activeSection.value,
    subscriptionView: subscriptionView.value,
    premiumTrialStartedAt: premiumTrialStartedAt.value
      ? new Date(premiumTrialStartedAt.value).toISOString()
      : null,
    premiumPaidStartedAt: premiumPaidStartedAt.value
      ? new Date(premiumPaidStartedAt.value).toISOString()
      : null,
  }

  localStorage.setItem(getBusinessSubscriptionStorageKey(), JSON.stringify(payload))
}

const restoreBusinessSubscriptionState = () => {
  if (!authUser.value) return

  try {
    const storageKey = localStorage.getItem(getBusinessSubscriptionStorageKey())
      ? getBusinessSubscriptionStorageKey()
      : findLegacyBusinessStorageKey(BUSINESS_SUBSCRIPTION_STATE_STORAGE_KEY)
    const rawState = storageKey ? localStorage.getItem(storageKey) : null
    if (!rawState) return

    const parsedState = JSON.parse(rawState)
    const restoreWorkspaceView = () => {
      const allowedSubscriptionViews = ['plans', 'history']
      const nextSubscriptionView = allowedSubscriptionViews.includes(parsedState?.subscriptionView)
        ? parsedState.subscriptionView
        : 'plans'
      const restoredSection = parsedState?.activeSection === 'assign-templates'
        ? 'training-templates'
        : parsedState?.activeSection

      if (parsedState?.activeSection === 'assign-templates') {
        setTrainingTemplatesTab('assignments')
      }

      if (sidebarGroups.value.some((group) => group.items.some((item) => item.id === restoredSection))) {
        activeSection.value = restoredSection
        const matchingGroup = sidebarGroups.value.find((group) => group.items.some((item) => item.id === restoredSection))
        activeSidebarGroup.value = matchingGroup?.id || 'dashboard'
        subscriptionView.value = restoredSection === 'subscriptions' ? nextSubscriptionView : 'plans'
        return
      }

      if (restoredSection === 'subscriptions' || restoredSection === 'profile') {
        activeSection.value = restoredSection
        activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
        subscriptionView.value = restoredSection === 'subscriptions' ? nextSubscriptionView : 'plans'
        return
      }

      activeSection.value = sidebarGroups.value[0]?.items?.[0]?.id || 'dashboard'
      activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
      subscriptionView.value = nextSubscriptionView
    }
    const trialStartedAt = parsedState?.premiumTrialStartedAt ? new Date(parsedState.premiumTrialStartedAt) : null
    const paidStartedAt = parsedState?.premiumPaidStartedAt ? new Date(parsedState.premiumPaidStartedAt) : null
    const hasValidTrialDate = trialStartedAt instanceof Date && !Number.isNaN(trialStartedAt.getTime())
    const hasValidPaidDate = paidStartedAt instanceof Date && !Number.isNaN(paidStartedAt.getTime())

    if (parsedState?.activeSubscriptionPlan === 'premium') {
      if (parsedState?.activeSubscriptionMode === 'paid') {
        activeSubscriptionPlan.value = 'premium'
        activeSubscriptionMode.value = 'paid'
        premiumTrialStartedAt.value = null
        premiumPaidStartedAt.value = hasValidPaidDate ? paidStartedAt : new Date()
        restoreWorkspaceView()
        if (storageKey && storageKey !== getBusinessSubscriptionStorageKey()) {
          persistBusinessSubscriptionState()
        }
        return
      }

      if (hasValidTrialDate) {
        const trialEndDate = new Date(trialStartedAt)
        trialEndDate.setDate(trialEndDate.getDate() + 30)

        if (trialEndDate.getTime() > Date.now()) {
          activeSubscriptionPlan.value = 'premium'
          activeSubscriptionMode.value = 'trial'
          premiumTrialStartedAt.value = trialStartedAt
          premiumPaidStartedAt.value = null
          restoreWorkspaceView()
          if (storageKey && storageKey !== getBusinessSubscriptionStorageKey()) {
            persistBusinessSubscriptionState()
          }
          return
        }
      }
    }
  } catch {
    // Ignore broken stored state and fall back to defaults.
  }

  activeSubscriptionPlan.value = 'free'
  activeSubscriptionMode.value = 'none'
  premiumTrialStartedAt.value = null
  premiumPaidStartedAt.value = null
  activeSection.value = sidebarGroups.value[0]?.items?.[0]?.id || 'dashboard'
  activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
  subscriptionView.value = 'plans'
  persistBusinessSubscriptionState()
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
  localStorage.setItem(getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY), JSON.stringify(seenPremiumNavItems.value))
}

const restoreSeenPremiumNavItems = () => {
  if (!authUser.value) return

  try {
    const storageKey = localStorage.getItem(getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY))
      ? getBusinessScopedStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY)
      : findLegacyBusinessStorageKey(BUSINESS_PREMIUM_NAV_SEEN_STORAGE_KEY)
    const rawItems = JSON.parse(localStorage.getItem(storageKey) || '[]')
    seenPremiumNavItems.value = Array.isArray(rawItems) ? rawItems : []
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
    actionLabel: 'Continue',
    target: '',
  },
  {
    id: 'job-post-unlimited',
    badge: 'Job Post upgrade',
    title: 'Unlimited job posts are now unlocked',
    description:
      'Your Job Post workspace is now on unlimited posting, so your team can publish as many openings as needed without the old cap.',
    note: 'This highlight is where your unlimited posting access now appears.',
    actionLabel: 'Show sidebar tools',
    target: 'job-post-unlimited',
  },
  {
    id: 'sidebar-new',
    badge: 'New premium tools',
    title: 'Watch for the red NEW tags in the sidebar',
    description:
      'These red tags point to the premium tools that just opened for your account, including assessments, interview scheduling, and training tools.',
    note: 'Open any of these when you are ready to explore the new premium workspace.',
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

  if (step === 0) {
    activeSection.value = 'subscriptions'
    subscriptionView.value = 'plans'
    await nextTick()
    premiumGuideTargetRect.value = null
    return
  }

  if (step === 1) {
    activeSection.value = 'job-posting'
    jobPostingTab.value = 'posted'
  }

  await nextTick()
  await waitForInterface(step === 1 ? 320 : 80)

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

const closeProfileMenu = (event) => {
  if (!event.target.closest('.business-navbar__account')) {
    isProfileMenuOpen.value = false
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

const openPersonalization = () => {
  activeSection.value = 'subscriptions'
  subscriptionView.value = 'plans'
  isProfileMenuOpen.value = false
}

const openUpgradePlan = () => {
  activeSection.value = 'subscriptions'
  subscriptionView.value = 'plans'
  isProfileMenuOpen.value = false
}

const openProfileAvatarPicker = () => {
  profileAvatarInputRef.value?.click()
}

const clearProfileAvatarInput = () => {
  if (profileAvatarInputRef.value) profileAvatarInputRef.value.value = ''
}

const removeProfileAvatar = () => {
  profileForm.value.avatar = ''
  clearProfileAvatarInput()
}

const handleProfileAvatarChange = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return

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

  const reader = new FileReader()
  reader.onload = () => {
    profileForm.value.avatar = typeof reader.result === 'string' ? reader.result : ''
    showPaymentToast('Profile photo selected successfully.', 'success')
  }
  reader.onerror = () => {
    showPaymentToast('Unable to read that image. Please try another file.', 'error')
  }
  reader.readAsDataURL(file)
}

const saveBusinessProfile = () => {
  if (!authUser.value) return

  const nextUser = {
    ...authUser.value,
    company_name: profileForm.value.companyName.trim() || authUser.value.company_name || authUser.value.name,
    business_contact_email:
      profileForm.value.email.trim()
      || authUser.value.business_contact_email
      || authUser.value.email,
    company_category: profileForm.value.category.trim(),
    company_location: profileForm.value.location.trim(),
    name: profileForm.value.contactPerson.trim() || authUser.value.name,
    business_avatar: profileForm.value.avatar || '',
  }

  authUser.value = nextUser
  localStorage.setItem('authUser', JSON.stringify(nextUser))
  persistBusinessProfileState()
  showPaymentToast('Business profile updated successfully.', 'success')
}

const openSidebarGroup = (group) => {
  if (!group) return

  activeSidebarGroup.value = group.id
  activeSection.value = group.items?.[0]?.id || group.id
  if (activeSection.value === 'job-posting') setJobPostingDefaultTab()

  const nextSeenItems = (group.items || [])
    .map((item) => item.id)
    .filter((itemId) =>
      premiumNavigationItems.some((premiumItem) => premiumItem.id === itemId)
      && !seenPremiumNavItems.value.includes(itemId),
    )

  if (nextSeenItems.length) {
    seenPremiumNavItems.value = [...seenPremiumNavItems.value, ...nextSeenItems]
    persistSeenPremiumNavItems()
  }
}

const handleSidebarSectionClick = (item) => {
  if (!item) return

  activeSection.value = item.id
  if (item.id === 'job-posting') setJobPostingDefaultTab()
  if (item.id === 'training-templates') setTrainingTemplatesTab(trainingTemplatesTab.value)
  const matchingGroup = sidebarGroups.value.find((group) => group.items.some((groupItem) => groupItem.id === item.id))
  if (matchingGroup) activeSidebarGroup.value = matchingGroup.id

  if (premiumNavigationItems.some((premiumItem) => premiumItem.id === item.id) && !seenPremiumNavItems.value.includes(item.id)) {
    seenPremiumNavItems.value = [...seenPremiumNavItems.value, item.id]
    persistSeenPremiumNavItems()
  }
}

const handleSubscriptionPlanClick = (plan) => {
  if (plan?.isDisabled) return

  if (plan?.id === 'free-trial' || plan?.id === 'premium') {
    openTrialConfirmation(plan.id)
  }
}

const openTrialConfirmation = (planId = 'free-trial') => {
  selectedCheckoutPlanId.value = planId
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

  return true
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

const activatePremiumPlan = () => {
  const activatedAt = new Date()
  activeSubscriptionPlan.value = 'premium'
  activeSubscriptionMode.value = selectedCheckoutPlanId.value === 'premium' ? 'paid' : 'trial'
  premiumTrialStartedAt.value = selectedCheckoutPlanId.value === 'free-trial' ? activatedAt : null
  premiumPaidStartedAt.value = selectedCheckoutPlanId.value === 'premium' ? activatedAt : null
  seenPremiumNavItems.value = []
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
  activatePremiumPlan()
  paymentStep.value = 4
  isAdvancingPaymentStep.value = false
}

const handleMockPaymentMessage = (event) => {
  if (event.origin !== window.location.origin) return
  if (event.data?.type !== MOCK_PAYMENT_MESSAGE_TYPE) return
  if (subscriptionView.value !== 'payment' || paymentStep.value !== 3 || selectedPaymentMethod.value !== 'gcash') return

  completePaymentFlow(false)
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
  isCancelPaymentModalOpen.value = false
}

const confirmCancelPayment = () => {
  resetPaymentLoadingState()
  closePaymentContactCountryDropdown()
  isCancelPaymentModalOpen.value = false
  subscriptionView.value = 'plans'
  paymentStep.value = 1
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

  if (step === 3 && selectedPaymentMethod.value === 'gcash' && !options.skipExternalTab) {
    isAwaitingExternalPayment.value = true
    openMockPaymentTab()
  }
}

const goToPaymentConfirmationStep = async () => {
  if (selectedPaymentMethod.value === 'gcash') {
    const opened = openMockPaymentTab()
    if (!opened) return
    isAwaitingExternalPayment.value = true
    await goToPaymentStepWithLoading(3, { skipExternalTab: true })
    return
  }

  await goToPaymentStepWithLoading(3)
}

const markPaymentConfirmed = async () => {
  await completePaymentFlow(true)
}

const ensureEmployerAccess = async () => {
  const user = getStoredAuthUser()

  if (!user || user.role !== 'employer') {
    router.replace('/login')
    return
  }

  let resolvedUser = user

  try {
    const refreshedUser = await refreshStoredAuthUserProfile(user.id)
    if (refreshedUser?.role === 'employer') {
      resolvedUser = refreshedUser
    }
  } catch {
    // Keep the stored session if the profile refresh fails.
  }

  if (!resolvedUser || resolvedUser.role !== 'employer') {
    clearAuthSession()
    await router.replace('/login')
    return
  }

  authUser.value = resolvedUser

  try {
    const status = await getAccountApprovalStatus(resolvedUser.email)
    if (!status || status.status !== 'approved') {
      clearAuthSession()
      await router.replace('/login')
    }
  } catch {
    clearAuthSession()
    await router.replace('/login')
  }
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

onMounted(async () => {
  await ensureEmployerAccess()
  if (!authUser.value) return

  startAuthUserProfileSync()
  startWorkspaceUserDirectorySync()
  startWorkspaceJobPostsSync()
  restoreAdminPlanCatalog()
  restoreBusinessProfileState()
  syncProfileFormFromAuthUser()
  restoreBusinessSubscriptionState()
  restoreSeenPremiumNavItems()
  restorePermissionRolesState()
  restoreEmployeeDirectoryState()
  restoreAssessmentTemplateLibrary()
  restoreTrainingTemplateLibrary()
  paymentHistoryEntries.value = readStoredPaymentHistory()
  document.addEventListener('click', closeProfileMenu)
  window.addEventListener('message', handleMockPaymentMessage)
  window.addEventListener('storage', handleBusinessSubscriptionStorageChange)
  window.addEventListener('resize', updatePremiumGuideLayout)
  window.addEventListener('scroll', updatePremiumGuideLayout, true)
})

watch(authUser, () => {
  syncProfileFormFromAuthUser()
})

watch(selectedPermissionRole, (role) => {
  permissionRoleLookupValue.value = isPermissionRoleEditMode.value
    ? String(role?.name || '').trim()
    : ''
}, { immediate: true })

watch(sidebarGroups, (groups) => {
  if (!groups.length) return
  if (!groups.some((group) => group.id === activeSidebarGroup.value)) {
    activeSidebarGroup.value = groups[0].id
  }
})

watch(activeSection, (nextSection) => {
  if (nextSection === 'assign-templates') {
    activeSection.value = 'training-templates'
    setTrainingTemplatesTab('assignments')
    activeSidebarGroup.value = 'training'
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
  }
})

watch(currentBusinessAccountIdentity, (nextIdentity, previousIdentity) => {
  if (!nextIdentity || nextIdentity === previousIdentity) return
  restorePermissionRolesState()
  restoreEmployeeDirectoryState()
  restoreAssessmentTemplateLibrary()
  restoreTrainingTemplateLibrary()
  startWorkspaceUserDirectorySync()
  startWorkspaceJobPostsSync()
})

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

watch([canViewTrainingTemplateBuilder, canViewTrainingAssignments], () => {
  setTrainingTemplatesTab(trainingTemplatesTab.value)
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

    if (!sectionIds.includes(activeSection.value)) {
      activeSection.value = sectionIds[0]
      activeSidebarGroup.value = sidebarGroups.value[0]?.id || 'dashboard'
    }
  },
  { immediate: true },
)

watch(
  [activeSubscriptionPlan, activeSubscriptionMode, activeSection, subscriptionView, premiumTrialStartedAt, premiumPaidStartedAt],
  () => {
    persistBusinessSubscriptionState()
  },
)

onBeforeUnmount(() => {
  stopAuthUserProfileSync()
  stopWorkspaceUserDirectorySync()
  stopWorkspaceJobsSync()
  document.removeEventListener('click', closeProfileMenu)
  window.removeEventListener('message', handleMockPaymentMessage)
  window.removeEventListener('storage', handleBusinessSubscriptionStorageChange)
  window.removeEventListener('resize', updatePremiumGuideLayout)
  window.removeEventListener('scroll', updatePremiumGuideLayout, true)
  resetPaymentLoadingState()
  clearPaymentToastTimeout()
})
</script>

<template>
  <div class="business-workspace" :class="{ 'business-workspace--subscription-only': !showBusinessSidebar }">
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

    <aside v-if="showBusinessSidebar" class="business-sidebar">
      <div class="business-sidebar__rail">
        <button type="button" class="business-sidebar__rail-logo" @click="activeSection = 'dashboard'">
          <img :src="pwdLogo" alt="PWD logo" class="business-sidebar__logo" />
        </button>

        <nav class="business-sidebar__rail-nav" aria-label="Business sidebar icons">
          <button
            v-for="group in sidebarGroups"
            :key="`rail-${group.id}`"
            type="button"
            class="business-sidebar__rail-link"
            :class="{ 'is-active': activeSidebarGroup === group.id }"
            :aria-label="group.label"
            :title="group.label"
            @click="openSidebarGroup(group)"
          >
            <i :class="group.icon" aria-hidden="true" />
          </button>
        </nav>

        <div class="business-sidebar__rail-footer">
          <button type="button" class="business-sidebar__rail-link" :class="{ 'is-active': activeSection === 'profile' }" aria-label="Edit Profile" title="Edit Profile" @click="activeSection = 'profile'">
            <i class="bi bi-person-circle" aria-hidden="true" />
          </button>
          <button type="button" class="business-sidebar__rail-link" :class="{ 'is-active': activeSection === 'subscriptions' }" aria-label="Settings" title="Settings" @click="activeSection = 'subscriptions'">
            <i class="bi bi-sliders" aria-hidden="true" />
          </button>
          <button type="button" class="business-sidebar__rail-link" :disabled="isLogoutSubmitting" aria-label="Log Out" title="Log Out" @click="openLogoutConfirm">
            <i class="bi bi-box-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="business-sidebar__panel">
        <div class="business-sidebar__brand">
          <p>Workspace</p>
          <strong>{{ currentSidebarGroup?.label || 'Business Workspace' }}</strong>
        </div>

        <nav class="business-sidebar__nav" aria-label="Business sidebar">
          <div v-for="item in currentSidebarItems" :key="item.id" class="business-sidebar__nav-item">
            <button
              :ref="(element) => setSidebarLinkRef(item.id, element)"
              type="button"
              class="business-sidebar__link"
              :class="{
                'is-active': activeSection === item.id,
                'business-guide-target': isPremiumGuideTarget('sidebar-new', item.id),
              }"
              @click="handleSidebarSectionClick(item)"
            >
              <span class="business-sidebar__link-label">{{ item.label }}</span>
              <span v-if="item.isNew" class="business-sidebar__new-tag">New</span>
            </button>
          </div>
        </nav>

        <div class="business-sidebar__footer">
          <button type="button" class="business-sidebar__footer-link" @click="activeSection = 'profile'">
            <span>Edit Profile</span>
          </button>
          <button type="button" class="business-sidebar__footer-link" @click="activeSection = 'subscriptions'">
            <span>Settings</span>
          </button>
          <button type="button" class="business-sidebar__footer-link" :disabled="isLogoutSubmitting" @click="openLogoutConfirm">
            <span>{{ isLogoutSubmitting ? 'Logging Out...' : 'Log Out' }}</span>
          </button>
        </div>
      </div>
    </aside>

    <section class="business-main">
      <header class="business-navbar">
        <div>
          <p class="business-navbar__eyebrow">Business Workspace</p>
          <h1>{{ currentSection.title }}</h1>
        </div>

        <div class="business-navbar__account">
          <button type="button" class="business-navbar__account-btn" @click="isProfileMenuOpen = !isProfileMenuOpen">
            <div class="business-navbar__avatar">
              <img v-if="businessAvatar" :src="businessAvatar" alt="Business avatar" class="business-navbar__avatar-image" />
              <template v-else>{{ businessInitials }}</template>
            </div>
            <div class="business-navbar__identity">
              <strong class="business-navbar__identity-name">
                <i class="bi bi-buildings" aria-hidden="true" />
                <span>{{ businessName }}</span>
              </strong>
              <span>{{ businessEmail }}</span>
            </div>
            <i class="bi bi-chevron-down" aria-hidden="true" />
          </button>

          <div v-if="isProfileMenuOpen" class="business-navbar__dropdown">
            <div class="business-navbar__dropdown-group">
              <button type="button" class="business-navbar__dropdown-link" @click="openPersonalization">
                <i class="bi bi-sliders2" aria-hidden="true" />
                <span>Personalization</span>
              </button>
            </div>
            <div class="business-navbar__dropdown-group">
              <button type="button" class="business-navbar__dropdown-link" @click="openHelpCenterModal">
                <i class="bi bi-life-preserver" aria-hidden="true" />
                <span>Help Center</span>
              </button>
              <button type="button" class="business-navbar__dropdown-link" @click="openSupportPage('/support/terms-of-use')">
                <i class="bi bi-file-earmark-text" aria-hidden="true" />
                <span>Terms & Policies</span>
              </button>
            </div>
            <div class="business-navbar__dropdown-group business-navbar__dropdown-group--actions">
              <button type="button" class="business-navbar__dropdown-link business-navbar__dropdown-link--accent" @click="openUpgradePlan">
                <i class="bi bi-stars" aria-hidden="true" />
                <span>Upgrade Plan</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="business-content">
        <Transition name="business-trial-modal">
          <div v-if="isProceedingToPayment" class="business-loading-screen" aria-live="polite" aria-busy="true">
            <div class="business-loading-screen__content">
              <div class="business-loading-screen__dots">
                <span />
                <span />
                <span />
              </div>
              <p>Proceed to payment</p>
            </div>
          </div>
        </Transition>

        <Transition name="business-section" mode="out-in">
          <div
            :key="activeSection"
            class="business-content__panel"
            :class="{ 'business-content__panel--subscriptions': activeSection === 'subscriptions' }"
          >
            <section v-if="activeSection === 'dashboard'" class="business-dashboard-analytics">
              <article class="business-dashboard-analytics__hero">
                <div class="business-dashboard-analytics__hero-copy">
                  <p class="business-dashboard-analytics__eyebrow">{{ businessCategory }}</p>
                  <h2>{{ businessName }}</h2>
                  <p>{{ currentSection.description }}</p>
                </div>
              </article>

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

              <div class="business-dashboard-analytics__grid">
                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--radar">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Team Balance</span>
                      <strong>Workload Radar</strong>
                    </div>
                  </div>
                  <div class="business-dashboard-analytics__radar">
                    <div class="business-dashboard-analytics__radar-shape business-dashboard-analytics__radar-shape--outer" />
                    <div class="business-dashboard-analytics__radar-shape business-dashboard-analytics__radar-shape--inner" />
                    <div class="business-dashboard-analytics__radar-core" />
                  </div>
                </article>

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--trend">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Performance Trend</span>
                      <strong>Hiring activity overview</strong>
                    </div>
                    <div class="business-dashboard-analytics__balance">
                      <small>Balance</small>
                      <strong>7,500 $</strong>
                    </div>
                  </div>
                  <div class="business-dashboard-analytics__line">
                    <div class="business-dashboard-analytics__line-grid" />
                    <svg viewBox="0 0 600 180" class="business-dashboard-analytics__line-svg" aria-hidden="true">
                      <path d="M0,110 C40,95 60,120 105,112 C150,104 160,72 205,78 C250,84 275,130 320,118 C365,106 382,52 430,58 C470,62 500,108 548,92 C573,85 590,75 600,82" />
                    </svg>
                    <svg viewBox="0 0 600 180" class="business-dashboard-analytics__line-svg business-dashboard-analytics__line-svg--secondary" aria-hidden="true">
                      <path d="M0,126 C42,138 68,100 112,108 C155,116 180,142 226,130 C270,118 297,90 344,96 C388,102 406,134 450,128 C490,122 520,86 562,89 C580,90 592,96 600,98" />
                    </svg>
                    <div class="business-dashboard-analytics__line-marker">
                      <span>Sep</span>
                      <strong>623</strong>
                    </div>
                  </div>
                  <div class="business-dashboard-analytics__months">
                    <span v-for="month in dashboardTrendMonths" :key="month">{{ month }}</span>
                  </div>
                </article>

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--bars">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Task Split</span>
                      <strong>Business progress</strong>
                    </div>
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

                <article class="business-dashboard-analytics__panel business-dashboard-analytics__panel--donut">
                  <div class="business-dashboard-analytics__panel-head">
                    <div>
                      <span>Distribution</span>
                      <strong>Workspace mix</strong>
                    </div>
                  </div>
                  <div class="business-dashboard-analytics__donut-wrap">
                    <div class="business-dashboard-analytics__donut">
                      <div class="business-dashboard-analytics__donut-center">
                        <span>Total</span>
                        <strong>5371</strong>
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
                </div>
                <button
                  v-if="canEditBusinessModule('job-posting')"
                  type="button"
                  class="business-job-post__button"
                  @click="toggleJobPostingTab"
                >
                  {{ jobPostingTab === 'create' ? 'Posted Jobs' : 'Create Job Post' }}
                </button>
              </div>

              <div v-if="jobPostingTab === 'create'" class="business-job-post__create">
                <div class="business-job-post__shell">
                  <form class="business-job-post__form-shell" @submit.prevent="saveJobPost">
                    <fieldset class="business-job-post__fieldset" :disabled="!canEditBusinessModule('job-posting')">
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
                          <select v-model="jobPostingDraft.type">
                            <option value="">Select job type</option>
                            <option v-for="type in JOB_POSTING_EMPLOYMENT_TYPES" :key="type" :value="type">
                              {{ type }}
                            </option>
                          </select>
                        </label>
                      </div>

                      <div class="business-job-post__grid business-job-post__grid--three">
                        <label class="business-job-post__field">
                          <span>Location</span>
                          <input :value="jobPostingDraft.location" type="text" readonly aria-readonly="true" />
                        </label>

                        <label class="business-job-post__field">
                          <span>Barangay (Dasmarinas)</span>
                          <select v-model="jobPostingDraft.barangay">
                            <option value="">Select barangay</option>
                            <option v-for="barangay in JOB_POSTING_BARANGAYS" :key="barangay" :value="barangay">
                              {{ barangay }}
                            </option>
                          </select>
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
                          <select
                            :value="jobPostingDraft.disabilityType"
                            @change="handleJobPostingFieldChange('disabilityType', $event.target.value)"
                          >
                            <option value="">Select general disability type</option>
                            <option v-for="type in JOB_POSTING_DISABILITY_TYPES" :key="type" :value="type">
                              {{ type }}
                            </option>
                          </select>
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
                          <select v-model="jobPostingDraft.language">
                            <option value="">Select language</option>
                            <option v-for="language in JOB_POSTING_LANGUAGE_OPTIONS" :key="language" :value="language">
                              {{ language }}
                            </option>
                          </select>
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
                          Cancel Edit
                        </button>
                      </div>
                    </fieldset>
                  </form>

                  <aside class="business-job-post__live-preview" aria-label="Live job preview">
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
                              Edit
                            </button>
                            <button
                              type="button"
                              class="business-job-post__menu-action"
                              :disabled="Boolean(jobPostPendingAction.jobId)"
                              @click="updateJobPostStatus(job.id, String(job.status || '').trim().toLowerCase() === 'closed' ? 'open' : 'closed')"
                            >
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
                <button type="button" class="business-applicants__button">Open Applicant List</button>
              </div>

              <div class="business-applicants__highlights">
                <article v-for="item in businessApplicantHighlights" :key="item.label" class="business-applicants__highlight">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </article>
              </div>

              <div class="business-applicants__grid">
                <article class="business-applicants__panel">
                  <div class="business-applicants__panel-head">
                    <div>
                      <p class="business-applicants__panel-label">Recent Applicants</p>
                      <h3>Hiring pipeline overview</h3>
                    </div>
                    <span class="business-applicants__panel-chip">No applicants yet</span>
                  </div>

                  <div class="business-applicants__empty">
                    <div class="business-applicants__empty-icon">
                      <i class="bi bi-people" aria-hidden="true" />
                    </div>
                    <strong>No applicants yet</strong>
                    <p>Your applicant list will appear here once candidates start applying to your job posts.</p>
                  </div>
                </article>

                <article class="business-applicants__panel business-applicants__panel--aside">
                  <div class="business-applicants__panel-head">
                    <div>
                      <p class="business-applicants__panel-label">Next Steps</p>
                      <h3>Shortlist flow</h3>
                    </div>
                  </div>

                  <div class="business-applicants__steps">
                    <article>
                      <strong>1. Screen new entries</strong>
                      <p>Review the newest applicants first and flag the strongest profiles for follow-up.</p>
                    </article>
                    <article>
                      <strong>2. Keep shortlist clean</strong>
                      <p>Move good candidates forward quickly so your hiring queue stays organized.</p>
                    </article>
                    <article>
                      <strong>3. Prepare interviews</strong>
                      <p>Use the ready list to decide who should receive interview or assessment updates next.</p>
                    </article>
                  </div>
                </article>
              </div>
            </section>

            <section v-else-if="activeSection === 'create-user' || activeSection === 'add-employee'" class="business-user-management">
              <div class="business-user-management__lead">
                <div class="business-user-management__copy">
                  <p class="business-user-management__eyebrow">User Management</p>
                  <h2>{{ currentUserManagementPage.title }}</h2>
                  <p>{{ currentUserManagementPage.description }}</p>
                </div>
                <div class="business-user-management__lead-meta">
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
              <p v-if="workspaceUserDirectorySyncMessage" class="business-user-management__notice">
                {{ workspaceUserDirectorySyncMessage }}
              </p>

              <article v-if="activeSection === 'create-user'" class="business-user-management__panel business-user-management__panel--form">
                <div class="business-user-management__panel-head">
                  <div>
                    <p class="business-user-management__panel-label">Create User</p>
                    <h3>Create a workspace login for your team</h3>
                  </div>
                  <span class="business-user-management__panel-chip">{{ permissionRoles.length }} roles available</span>
                </div>

                <fieldset class="business-user-management__fieldset" :disabled="!canEditBusinessModule('create-user') || isCreatingWorkspaceUser">
                  <div class="business-user-management__grid business-user-management__grid--two">
                    <label class="business-user-management__field">
                      <span>Full Name</span>
                      <input v-model="userAccountDraft.fullName" type="text" placeholder="Enter full name" />
                    </label>

                    <label class="business-user-management__field">
                      <span>Email Address</span>
                      <input v-model="userAccountDraft.gmail" type="email" placeholder="name@company.com" />
                    </label>

                    <label class="business-user-management__field">
                      <span>Temporary Password</span>
                      <input v-model="userAccountDraft.temporaryPassword" type="text" placeholder="Enter temporary password" />
                    </label>

                    <label class="business-user-management__field">
                      <span>Assign Role</span>
                      <select v-model="userAccountDraft.roleId">
                        <option value="">Select a role from Permissions</option>
                        <option v-for="role in permissionRoleOptionsForUsers" :key="role.id" :value="role.id">
                          {{ role.name }}
                        </option>
                      </select>
                    </label>
                  </div>

                  <div v-if="selectedUserAccountRole" class="business-user-management__inline-meta">
                    <span class="business-user-management__panel-chip">{{ selectedUserAccountRole.name }}</span>
                    <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleSummary }}</span>
                    <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleModules }}</span>
                  </div>

                  <div class="business-user-management__actions">
                    <button type="button" class="business-user-management__primary" @click="saveWorkspaceUserAccount">
                      {{ isCreatingWorkspaceUser ? 'Creating Account...' : 'Create User' }}
                    </button>
                  </div>
                </fieldset>
              </article>

              <article v-else class="business-user-management__panel business-user-management__panel--form">
                <div class="business-user-management__panel-head">
                  <div>
                    <p class="business-user-management__panel-label">Add Employee</p>
                    <h3>Link a created user to an employee profile</h3>
                  </div>
                  <span class="business-user-management__panel-chip">{{ employeeDirectory.length }} employee profiles</span>
                </div>

                <fieldset class="business-user-management__fieldset" :disabled="!canEditBusinessModule('add-employee') || isWorkspaceUserDirectoryLoading">
                  <div class="business-user-management__grid business-user-management__grid--two">
                    <label class="business-user-management__field">
                      <span>Created User Account</span>
                      <select v-model="employeeDraft.linkedUserId">
                        <option value="">{{ isWorkspaceUserDirectoryLoading ? 'Loading workspace users...' : 'Select a created user' }}</option>
                        <option v-for="user in availableEmployeeLinkOptions" :key="user.id" :value="user.id">
                          {{ user.name }} - {{ user.gmail }}
                        </option>
                      </select>
                    </label>

                    <label class="business-user-management__field">
                      <span>Assigned Role</span>
                      <input :value="selectedEmployeeLinkedUser ? getWorkspaceUserRoleName(selectedEmployeeLinkedUser) : ''" type="text" placeholder="Role auto-fills from the created user" readonly />
                    </label>

                    <label class="business-user-management__field">
                      <span>Full Name</span>
                      <input v-model="employeeDraft.fullName" type="text" placeholder="Full name auto-fills from the created user" readonly />
                    </label>

                    <label class="business-user-management__field">
                      <span>Email Address</span>
                      <input v-model="employeeDraft.workEmail" type="email" placeholder="Email auto-fills from the created user" readonly />
                    </label>

                    <label class="business-user-management__field">
                      <span>Employment Type</span>
                      <select v-model="employeeDraft.employmentType">
                        <option value="">Select employment type</option>
                        <option v-for="type in employeeEmploymentTypeOptions" :key="type" :value="type">
                          {{ type }}
                        </option>
                      </select>
                    </label>

                    <label class="business-user-management__field">
                      <span>Phone Number</span>
                      <input v-model="employeeDraft.phoneNumber" type="text" placeholder="09XX XXX XXXX" />
                    </label>

                    <label class="business-user-management__field">
                      <span>Start Date</span>
                      <input v-model="employeeDraft.startDate" type="date" />
                    </label>

                    <label class="business-user-management__field">
                      <span>Employee Status</span>
                      <select v-model="employeeDraft.status">
                        <option v-for="status in employeeStatusOptions" :key="status" :value="status">
                          {{ status }}
                        </option>
                      </select>
                    </label>
                  </div>

                  <div v-if="selectedEmployeeRole" class="business-user-management__inline-meta">
                    <span class="business-user-management__panel-chip">{{ selectedEmployeeRole.name }}</span>
                    <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleSummary }}</span>
                    <span class="business-user-management__panel-chip">{{ selectedEmployeeRoleModules }}</span>
                  </div>

                  <div class="business-user-management__actions">
                    <button type="button" class="business-user-management__primary" @click="saveStaticEmployee">
                      Add Employee
                    </button>
                  </div>
                </fieldset>

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
                      <span>{{ assessmentTemplateLibrary.length }} saved</span>
                      <small v-if="editingAssessmentTemplateId">
                        Updated {{ formatAssessmentTemplateUpdatedAt(assessmentTemplateLibrary.find((template) => template.id === editingAssessmentTemplateId)?.updatedAt) }}
                      </small>
                    </div>
                    <div class="business-template-builder__hero-actions">
                      <button
                        type="button"
                        class="business-template-builder__publish business-template-builder__publish--secondary"
                        @click="startNewAssessmentTemplate"
                      >
                        New
                      </button>
                      <button type="button" class="business-template-builder__publish" @click="saveAssessmentTemplate">
                        {{ editingAssessmentTemplateId ? 'Update' : 'Save' }}
                      </button>
                    </div>
                  </div>

                  <article class="business-template-builder__card business-assessment-builder__workspace">
                    <label class="business-template-builder__field">
                      <span>Template Title</span>
                      <input v-model="assessmentTemplateDraft.title" type="text" placeholder="Frontend developer technical screen" />
                    </label>

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
                            <button
                              type="button"
                              class="business-assign-templates__action"
                              :disabled="!canEditBusinessModule('assessment-management')"
                              @click="assignAssessmentTemplateToApplicant(applicant.id)"
                            >
                              {{ applicant.assignmentStatus === 'Assigned' ? 'Update' : 'Assign' }}
                            </button>
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
                          <td>{{ getAssignableTemplateLabel(applicant.selectedTemplateId) }}</td>
                          <td>{{ applicant.assignedAt || 'Not set' }}</td>
                          <td>
                            <span class="business-assign-templates__status is-assigned">{{ applicant.assignmentStatus }}</span>
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
                      <p>Static mock data for now. New schedules created in the first tab will also appear here.</p>
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
              class="business-results"
            >
              <article v-for="item in currentSection.cards" :key="item.title" class="business-results__card">
                <h3>{{ item.title }}</h3>
                <p>{{ item.copy }}</p>
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
                            {{ template.title || 'Untitled template' }} | {{ template.questions.length }} questions
                          </option>
                        </select>
                      </label>
                      <div class="business-assessment-builder__bar-status">
                        <span>{{ trainingTemplateLibrary.length }} saved</span>
                        <small v-if="editingTrainingTemplateId">
                          Updated {{ formatAssessmentTemplateUpdatedAt(trainingTemplateLibrary.find((template) => template.id === editingTrainingTemplateId)?.updatedAt) }}
                        </small>
                      </div>
                      <div class="business-template-builder__hero-actions">
                        <button
                          type="button"
                          class="business-template-builder__publish business-template-builder__publish--secondary"
                          @click="startNewTrainingTemplate"
                        >
                          New
                        </button>
                        <button type="button" class="business-template-builder__publish" @click="saveTrainingTemplate">
                          {{ editingTrainingTemplateId ? 'Update' : 'Save' }}
                        </button>
                      </div>
                    </div>

                    <div class="business-template-builder__hero">
                      <div>
                        <p class="business-template-builder__eyebrow">Training Builder</p>
                        <h2>Build reusable training templates in one workspace</h2>
                        <p>Prepare onboarding and upskilling flows here, then switch to the assign tab to send them out.</p>
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
                        <strong>Add Template Block</strong>
                        <span>Select a question type, then insert it into the training flow.</span>
                      </div>
                      <div class="business-template-builder__toolbar-actions">
                        <label class="business-template-builder__select-wrap">
                          <span>Question type</span>
                          <select v-model="selectedTrainingQuestionType">
                            <option v-for="type in trainingQuestionTypeOptions" :key="type.value" :value="type.value">
                              {{ type.label }}
                            </option>
                          </select>
                        </label>
                        <button type="button" class="business-template-builder__add" @click="addTrainingTemplateQuestion">
                          <i class="bi bi-plus-lg" aria-hidden="true" />
                          Add question
                        </button>
                      </div>
                    </article>

                    <TransitionGroup name="business-template-question" tag="div" class="business-template-builder__questions">
                      <article
                        v-for="(question, index) in trainingTemplateDraft.questions"
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
                          <button type="button" class="business-template-builder__remove" @click="removeTrainingTemplateQuestion(question.id)">
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
                          <span>Answer options</span>
                          <div
                            v-for="(option, optionIndex) in question.options"
                            :key="`${question.id}-option-${optionIndex}`"
                            class="business-template-builder__option-row"
                          >
                            <i :class="question.type === 'multiple-choice' ? 'bi bi-circle' : 'bi bi-square'" aria-hidden="true" />
                            <input v-model="question.options[optionIndex]" type="text" :placeholder="`Option ${optionIndex + 1}`" />
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

                      <article
                        v-for="(question, index) in trainingTemplateDraft.questions"
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
                            <input :type="question.type === 'multiple-choice' ? 'radio' : 'checkbox'" :name="question.id" disabled />
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
                        <button type="button" disabled>Start Training</button>
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
                    <p>Choose a saved training template and assign it to onboarding or upskilling members from the table below.</p>
                  </div>
                  <div class="business-assign-templates__summary">
                    <span>{{ trainingTemplateAssignments.length }} ready members</span>
                    <span>{{ assignedTrainingTemplateRows.length }} templates assigned</span>
                  </div>
                </div>

                <div class="business-assign-templates__tabs">
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'ready-members' }"
                    @click="trainingAssignmentTab = 'ready-members'"
                  >
                    Ready Members
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'assigned-templates' }"
                    @click="trainingAssignmentTab = 'assigned-templates'"
                  >
                    Assigned Templates
                  </button>
                </div>

                <article v-if="trainingAssignmentTab === 'ready-members'" class="business-assign-templates__panel">
                  <div class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
                          <th>Training Stage</th>
                          <th>Template</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="member in trainingTemplateAssignments" :key="member.id">
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
                              :disabled="!canEditTrainingAssignments"
                            >
                              <option value="">Select template</option>
                              <option v-for="template in assignableTrainingTemplates" :key="template.id" :value="template.id">
                                {{ template.title }}
                              </option>
                            </select>
                          </td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="{ 'is-assigned': member.assignmentStatus === 'Assigned' }"
                            >
                              {{ member.assignmentStatus }}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              class="business-assign-templates__action"
                              :disabled="!canEditTrainingAssignments"
                              @click="assignTrainingTemplateToMember(member.id)"
                            >
                              {{ member.assignmentStatus === 'Assigned' ? 'Update' : 'Assign' }}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>

                <article v-else class="business-assign-templates__panel">
                  <div v-if="assignedTrainingTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
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
                          <td>{{ getAssignableTrainingTemplateLabel(member.selectedTemplateId) }}</td>
                          <td>{{ member.assignedAt || 'Not set' }}</td>
                          <td>
                            <span class="business-assign-templates__status is-assigned">{{ member.progressStatus }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No training templates assigned yet</strong>
                    <p>Save a training template first, then assign it from the ready members tab.</p>
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
                    <div class="business-profile__avatar-shell">
                      <img
                        v-if="profileForm.avatar"
                        :src="profileForm.avatar"
                        alt="Business profile avatar"
                        class="business-profile__avatar-image"
                      />
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
                      <button type="button" class="business-profile__secondary" @click="openProfileAvatarPicker">Upload Image</button>
                      <button
                        v-if="profileForm.avatar"
                        type="button"
                        class="business-profile__secondary business-profile__secondary--danger"
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
                    <div class="business-profile__preview-avatar">
                      <img
                        v-if="profileForm.avatar"
                        :src="profileForm.avatar"
                        alt="Business profile preview avatar"
                        class="business-profile__preview-avatar-image"
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

              <section
                v-else-if="activeSection === 'subscriptions' && subscriptionView === 'payment'"
                key="subscription-payment"
                class="business-payment"
              >
                <div class="business-payment__main">
                  <div v-if="isAdvancingPaymentStep" class="business-payment__loading">
                    <div class="business-payment__loading-dots">
                      <span />
                      <span />
                      <span />
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
                        <input v-model="paymentForm.fullName" type="text" placeholder="Enter full name" />
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
                        v-for="method in paymentMethods"
                        :key="method.id"
                        class="business-payment__method"
                        :class="[
                          `business-payment__method--${method.accent}`,
                          { 'is-selected': selectedPaymentMethod === method.id },
                        ]"
                        @click="selectedPaymentMethod = method.id"
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
                    <template v-if="selectedPaymentMethod === 'gcash'">
                      <h3>{{ currentCheckoutFlow.gcashTitle }}</h3>
                      <p>{{ currentCheckoutFlow.gcashDescription }}</p>
                      <div class="business-payment__status-box">
                        <strong>{{ currentCheckoutFlow.gcashStatusTitle }}</strong>
                        <span>{{ isAwaitingExternalPayment ? currentCheckoutFlow.gcashStatusOpened : currentCheckoutFlow.gcashStatusWaiting }}</span>
                        <small>{{ currentCheckoutFlow.gcashStatusHelp }}</small>
                      </div>
                    </template>
                    <template v-else-if="!isProcessingTestModePayment">
                      <h3>{{ currentCheckoutFlow.cardTitle }}</h3>
                      <p>{{ currentCheckoutFlow.cardDescription }}</p>
                      <div class="business-payment__status-box">
                        <strong>{{ currentCheckoutFlow.cardStatusTitle }}</strong>
                        <span>{{ selectedPaymentMethod === 'gcash' ? 'GCash' : 'Credit Card' }}</span>
                        <small>{{ currentCheckoutFlow.cardStatusHelp }}</small>
                      </div>
                    </template>
                    <div v-else class="business-payment__test-mode">
                      <div class="business-payment__test-mode-spinner" aria-hidden="true" />
                      <strong>{{ isFreeTrialCheckout ? 'Billing setup in progress' : 'Payment in progress' }}</strong>
                      <p>{{ currentCheckoutFlow.processingText }}</p>
                    </div>
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
              </section>

              <section
                v-else-if="activeSection === 'subscriptions' && subscriptionView === 'history'"
                key="subscription-history"
                class="business-history"
              >
                <div v-if="paymentHistoryEntries.length" class="business-history__table-wrap">
                  <table class="business-history__table">
                    <thead>
                      <tr>
                        <th>Transaction ID</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="entry in paymentHistoryEntries" :key="entry.id">
                        <td>
                          <strong>{{ entry.id }}</strong>
                        </td>
                        <td>{{ entry.plan }}</td>
                        <td class="business-history__amount">{{ entry.amount }}</td>
                        <td>
                          <span class="business-history__chip">{{ entry.method }}</span>
                        </td>
                        <td>
                          <span class="business-history__status">{{ entry.status }}</span>
                        </td>
                        <td>
                          <div class="business-history__date">
                            <strong>{{ entry.date }}</strong>
                            <span>{{ entry.time }}</span>
                          </div>
                        </td>
                        <td>
                          <button type="button" class="business-history__receipt" @click="openReceiptPreview(entry)">
                            Receipt
                            <i class="bi bi-chevron-right" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="business-history__empty">
                  <i class="bi bi-receipt-cutoff" aria-hidden="true" />
                  <strong>No payment history yet</strong>
                  <p>Your completed premium transactions will appear here once payment is finished.</p>
                </div>
              </section>
            </Transition>

          </div>
        </Transition>
      </main>
    </section>

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
            <button type="button" class="business-modal__button business-modal__button--secondary" @click="closeCancelPaymentModal">
              No
            </button>
            <button type="button" class="business-modal__button business-modal__button--primary" @click="confirmCancelPayment">
              Yes, Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.business-workspace {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  background: linear-gradient(180deg, #f4f8f4 0%, #fbfdfb 100%);
  color: #1d3025;
}

.business-workspace--subscription-only {
  grid-template-columns: minmax(0, 1fr);
}

.business-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 80;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: center;
  width: min(32rem, calc(100vw - 2rem));
  padding: 0.95rem 1rem;
  border: 1px solid rgba(220, 38, 38, 0.14);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translate(-50%, -50%);
}

.business-toast.success {
  border-color: rgba(22, 163, 74, 0.16);
}

.business-toast.warning {
  border-color: rgba(245, 158, 11, 0.2);
}

.business-toast.error {
  border-color: rgba(220, 38, 38, 0.14);
}

.business-toast__icon {
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

.business-toast__icon.success {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.96) 0%, rgba(220, 252, 231, 0.82) 100%);
  color: #16a34a;
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.24);
}

.business-toast__icon.warning {
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.98) 0%, rgba(254, 243, 199, 0.84) 100%);
  color: #f59e0b;
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.24);
}

.business-toast__icon i {
  font-size: 1.1rem;
  line-height: 1;
}

.business-toast__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.business-toast__copy strong,
.business-toast__copy span {
  margin: 0;
}

.business-toast__copy strong {
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 800;
}

.business-toast__copy span {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.business-toast__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.business-toast__action {
  min-height: 2rem;
  padding: 0.38rem 0.72rem;
  border-radius: 0.8rem;
  border: 1px solid #dbe2ea;
  background: #ffffff;
  color: #334155;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
  white-space: nowrap;
}

.business-toast__action.is-primary {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}

.business-toast__action.is-secondary {
  border-color: #dbe2ea;
  background: #f8fafc;
  color: #475569;
}

.business-toast__action.is-danger {
  border-color: #f3c6c6;
  background: #fff7f7;
  color: #b42318;
}

.business-toast__action:hover {
  transform: translateY(-1px);
}

.business-toast__close {
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

.business-toast__close:hover {
  background: #fff5f5;
  border-color: #fecaca;
  color: #dc2626;
  transform: rotate(90deg);
}

.business-toast-enter-active,
.business-toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.business-toast-enter-from,
.business-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
}

.business-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 0.8rem;
  padding: 0.9rem 0.85rem;
  border-right: 1px solid #d9e4dc;
  background: #ffffff;
  overflow: hidden;
}

.business-sidebar__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 0.15rem 0;
  border-right: 1px solid #edf2ee;
}

.business-sidebar__rail-logo {
  width: 2.3rem;
  height: 2.3rem;
  padding: 0;
  border: 0;
  border-radius: 0.8rem;
  background: #f3f7f4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.business-sidebar__rail-nav,
.business-sidebar__rail-footer {
  display: grid;
  gap: 0.45rem;
}

.business-sidebar__rail-nav {
  margin-top: 0.3rem;
  margin-bottom: auto;
}

.business-sidebar__rail-link {
  width: 2.3rem;
  height: 2.3rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0.8rem;
  background: transparent;
  color: #7a8a82;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.business-sidebar__rail-link:hover {
  background: #f2f7f3;
  border-color: #d8e2db;
  color: #1d3025;
}

.business-sidebar__rail-link.is-active {
  background: #e9f3ed;
  border-color: #cfe0d5;
  color: #1b5e3b;
}

.business-sidebar__panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.business-sidebar__brand {
  display: grid;
  gap: 0.18rem;
  padding: 0.2rem 0.15rem 0.5rem;
}

.business-sidebar__logo {
  width: 1.45rem;
  height: 1.45rem;
  object-fit: contain;
}

.business-sidebar__brand p {
  margin: 0;
  color: #6d8175;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-sidebar__brand strong {
  color: #1d3025;
  font-size: 0.96rem;
}

.business-sidebar__nav {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.1rem;
  margin-bottom: auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.15rem;
}

.business-sidebar__nav-item {
  display: grid;
  gap: 0.3rem;
}

.business-sidebar__link,
.business-sidebar__footer-link,
.business-navbar__dropdown-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.68rem 0.78rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #6b7d72;
  text-align: left;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.business-sidebar__link:hover,
.business-sidebar__footer-link:hover,
.business-navbar__dropdown-link:hover {
  background: #f2f7f3;
  border-color: #d6e1d9;
  color: #1d3025;
  transform: translateX(2px);
}

.business-sidebar__link.is-active {
  background: #eaf3ed;
  border-color: #cfe0d5;
  color: #184d2f;
}

.business-sidebar__link-label {
  min-width: 0;
  white-space: normal;
  line-height: 1.2;
}

.business-sidebar__new-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.95rem;
  padding: 0.16rem 0.4rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: #fff;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 0 10px 18px rgba(220, 38, 38, 0.22);
  justify-self: end;
}

.business-sidebar__subnav {
  display: grid;
  gap: 0.22rem;
  margin-left: 0.65rem;
  padding-left: 0.7rem;
  border-left: 1px solid #e5ece7;
}

.business-sidebar__sublink {
  width: 100%;
  padding: 0.52rem 0.2rem;
  border: 0;
  background: transparent;
  color: #70817a;
  text-align: left;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

.business-sidebar__sublink:hover {
  color: #1d3025;
  transform: translateX(2px);
}

.business-sidebar__sublink.is-active {
  color: #1b5e3b;
}

.business-sidebar__footer {
  display: grid;
  gap: 0.35rem;
  padding-top: 0.55rem;
  border-top: 1px solid #edf2ee;
}

.business-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
}

.business-navbar {
  position: relative;
  z-index: 25;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid #e0e8e3;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  overflow: visible;
}

.business-navbar__eyebrow {
  margin: 0;
  color: #6d8175;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-navbar h1 {
  margin: 0.25rem 0 0;
  font-size: 1.75rem;
}

.business-navbar__account {
  position: relative;
  z-index: 30;
}

.business-navbar__account-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #d8e3db;
  border-radius: 16px;
  background: #ffffff;
  color: #1d3025;
  cursor: pointer;
}

.business-navbar__avatar {
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f7448 0%, #2e8a59 100%);
  color: #ffffff;
  font-weight: 800;
}

.business-navbar__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.business-navbar__identity {
  display: grid;
  text-align: left;
}

.business-navbar__identity strong {
  font-size: 0.92rem;
}

.business-navbar__identity-name {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.business-navbar__identity-name i {
  color: #1f7448;
  font-size: 0.9rem;
  line-height: 1;
}

.business-navbar__identity span {
  color: #6d8175;
  font-size: 0.76rem;
}

.business-navbar__dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.6rem);
  z-index: 40;
  width: 220px;
  display: grid;
  gap: 0.45rem;
  padding: 0.45rem;
  border: 1px solid #d8e3db;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(20, 49, 33, 0.12);
}

.business-navbar__dropdown-group {
  display: grid;
  gap: 0.35rem;
}

.business-navbar__dropdown-group + .business-navbar__dropdown-group {
  padding-top: 0.45rem;
  border-top: 1px solid #e7eee9;
}

.business-navbar__dropdown-link--accent {
  background: linear-gradient(135deg, rgba(31, 116, 72, 0.12) 0%, rgba(31, 116, 72, 0.05) 100%);
  color: #175f3a;
}

.business-navbar__dropdown-link--danger {
  color: #b42318;
}

.business-content {
  position: relative;
  padding: 1.5rem;
  display: grid;
  gap: 1.2rem;
}

.business-content__panel {
  display: grid;
  gap: 1.2rem;
}

.business-content__panel--subscriptions {
  gap: 1.35rem;
}

.business-section-enter-active,
.business-section-leave-active {
  transition:
    opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.business-section-enter-from,
.business-section-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.985);
  filter: blur(6px);
}

.business-section-enter-to,
.business-section-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.business-guide-enter-active,
.business-guide-leave-active {
  transition: opacity 220ms ease;
}

.business-guide-enter-from,
.business-guide-leave-to {
  opacity: 0;
}

.business-guide {
  position: fixed;
  inset: 0;
  z-index: 140;
}

.business-guide__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 18, 13, 0.52);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.business-guide__spotlight {
  position: fixed;
  z-index: 1;
  border-radius: 24px;
  border: 2px solid rgba(239, 68, 68, 0.88);
  box-shadow:
    0 0 0 9999px rgba(10, 18, 13, 0.2),
    0 20px 45px rgba(15, 23, 42, 0.18);
  pointer-events: none;
}

.business-guide__card {
  position: fixed;
  z-index: 2;
  display: grid;
  gap: 0.75rem;
  max-width: calc(100vw - 2rem);
  padding: 1.15rem 1.1rem;
  border: 1px solid #f1d4d4;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

.business-guide__card--celebration {
  overflow: visible;
  gap: 1rem;
  width: min(52rem, calc(100vw - 2rem));
  min-width: 0;
  padding: 2.6rem 1.8rem 2.3rem;
  border: 0;
  border-radius: 32px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 226, 120, 0.3), transparent 28%),
    radial-gradient(circle at 16% 18%, rgba(244, 114, 182, 0.24), transparent 20%),
    radial-gradient(circle at 84% 22%, rgba(56, 189, 248, 0.24), transparent 18%),
    linear-gradient(145deg, #0f3224 0%, #155236 54%, #0e2b1f 100%);
  box-shadow:
    0 34px 90px rgba(8, 20, 15, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

.business-guide__celebration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.business-guide__aura,
.business-guide__spark {
  position: absolute;
  pointer-events: none;
}

.business-guide__aura {
  border-radius: 999px;
  filter: blur(6px);
  animation: business-guide-aura-pulse 4.5s ease-in-out infinite;
}

.business-guide__aura--one {
  top: -2.2rem;
  left: 50%;
  width: 13rem;
  height: 13rem;
  background: radial-gradient(circle, rgba(255, 214, 102, 0.92) 0%, rgba(255, 166, 0, 0.18) 62%, transparent 78%);
  transform: translateX(-50%);
}

.business-guide__aura--two {
  bottom: -3.5rem;
  left: 50%;
  width: 28rem;
  height: 10rem;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 58%, transparent 78%);
  transform: translateX(-50%);
  animation-delay: -1.8s;
}

.business-guide__spark {
  width: 10rem;
  height: 10rem;
  background:
    linear-gradient(90deg, transparent 49%, rgba(255, 255, 255, 0.55) 50%, transparent 51%),
    linear-gradient(transparent 49%, rgba(255, 255, 255, 0.55) 50%, transparent 51%);
  opacity: 0.5;
  transform-origin: center;
  animation: business-guide-spark-spin 7s linear infinite;
}

.business-guide__spark--one {
  top: 1rem;
  left: calc(50% - 5rem);
}

.business-guide__spark--two {
  top: 0.6rem;
  left: calc(50% - 5rem);
  transform: rotate(45deg);
  animation-duration: 8.5s;
}

.business-guide__spark--three {
  top: 0.8rem;
  left: calc(50% - 5rem);
  transform: rotate(22deg);
  opacity: 0.28;
  animation-duration: 10s;
}

.business-guide__hero {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: auto;
  height: auto;
  margin: 0 auto 0.45rem;
  color: #ffd54f;
  text-shadow:
    0 0 24px rgba(255, 213, 79, 0.42),
    0 0 46px rgba(255, 184, 0, 0.28);
  animation: business-guide-hero-pulse 2.2s ease-in-out infinite;
}

.business-guide__hero i {
  font-size: 4.2rem;
  line-height: 1;
}

.business-guide__confetti {
  position: absolute;
  width: 0.74rem;
  height: 1.3rem;
  border-radius: 999px;
  opacity: 0.95;
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.18);
  animation: business-guide-confetti-float 4.8s ease-in-out infinite;
}

.business-guide__confetti--one {
  top: 0.9rem;
  left: 12%;
  background: #facc15;
  transform: rotate(18deg);
}

.business-guide__confetti--two {
  top: 1.8rem;
  left: 24%;
  background: #fb7185;
  transform: rotate(-28deg);
  animation-delay: -0.6s;
}

.business-guide__confetti--three {
  top: 0.8rem;
  right: 18%;
  background: #38bdf8;
  transform: rotate(26deg);
  animation-delay: -1.1s;
}

.business-guide__confetti--four {
  top: 1.9rem;
  right: 10%;
  background: #f97316;
  transform: rotate(-20deg);
  animation-delay: -1.7s;
}

.business-guide__confetti--five {
  top: 4.8rem;
  left: 8%;
  background: #a3e635;
  transform: rotate(34deg);
  animation-delay: -2.2s;
}

.business-guide__confetti--six {
  top: 5.3rem;
  right: 12%;
  background: #f472b6;
  transform: rotate(-32deg);
  animation-delay: -2.9s;
}

.business-guide__confetti--seven {
  top: 6.8rem;
  left: 22%;
  background: #22c55e;
  transform: rotate(-12deg);
  animation-delay: -3.4s;
}

.business-guide__confetti--eight {
  top: 6.6rem;
  right: 24%;
  background: #fb7185;
  transform: rotate(14deg);
  animation-delay: -3.9s;
}

.business-guide__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 0.38rem 0.75rem;
  border-radius: 999px;
  background: #fff1f2;
  color: #b91c1c;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-guide__card--celebration .business-guide__badge {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  background: transparent;
  color: #fef3c7;
}

.business-guide__card h2 {
  margin: 0;
  color: #173927;
  font-size: clamp(1.3rem, 2vw, 1.7rem);
  line-height: 1.15;
}

.business-guide__card--celebration h2 {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #ffffff;
  font-size: clamp(2.5rem, 5vw, 4.4rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  text-shadow:
    0 10px 40px rgba(15, 23, 42, 0.42),
    0 0 22px rgba(255, 255, 255, 0.12);
}

.business-guide__card p {
  margin: 0;
  color: #52655b;
  line-height: 1.65;
}

.business-guide__card--celebration p {
  position: relative;
  z-index: 1;
  max-width: 40rem;
  margin-inline: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.96);
  font-size: clamp(1.1rem, 2vw, 1.45rem);
  line-height: 1.5;
}

.business-guide__card small {
  color: #7a8b82;
  font-size: 0.82rem;
  line-height: 1.5;
}

.business-guide__card--celebration small {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 38rem;
  margin-inline: auto;
  color: rgba(240, 244, 247, 0.88);
  font-size: 0.98rem;
  line-height: 1.7;
}

.business-guide__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  margin-top: 0.2rem;
}

.business-guide__card--celebration .business-guide__actions {
  position: relative;
  z-index: 1;
  justify-content: center;
  margin-top: 0.9rem;
}

.business-guide__actions--single {
  justify-content: center;
}

.business-guide__button {
  min-height: 42px;
  padding: 0.72rem 1rem;
  border-radius: 12px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.business-guide__button--secondary {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #5d6d65;
}

.business-guide__button--primary {
  border: 0;
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: #ffffff;
  box-shadow: 0 16px 28px rgba(220, 38, 38, 0.22);
}

.business-guide-target {
  position: relative;
  z-index: 145;
  pointer-events: none;
}

.business-sidebar__link.business-guide-target,
.business-job-post__highlight.business-guide-target {
  border-color: rgba(239, 68, 68, 0.9) !important;
  box-shadow:
    0 0 0 4px rgba(239, 68, 68, 0.18),
    0 16px 34px rgba(15, 23, 42, 0.16);
}

.business-sidebar__link.business-guide-target {
  background: #fff5f5;
  color: #7f1d1d;
}

.business-sidebar__link.business-guide-target .business-sidebar__new-tag {
  animation: business-guide-tag-pulse 1.2s ease-in-out infinite;
}

.business-job-post__highlight.business-guide-target {
  background: linear-gradient(180deg, #fff7f7 0%, #ffffff 100%);
}

.business-hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #dce7df;
  border-radius: 24px;
  background: #ffffff;
}

.business-hero__eyebrow {
  margin: 0;
  color: #5f7e6a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-hero h2 {
  margin: 0.4rem 0 0;
  font-size: 1.8rem;
}

.business-hero p {
  margin: 0.7rem 0 0;
  max-width: 42rem;
  color: #617267;
  line-height: 1.7;
}

.business-hero__meta {
  min-width: 220px;
  padding: 1rem 1.1rem;
  border: 1px solid #dce7df;
  border-radius: 18px;
  background: #f7fbf8;
}

.business-hero__meta span,
.business-summary__card span {
  display: block;
  color: #6d8175;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-hero__meta strong,
.business-summary__card strong,
.business-results__card strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 1rem;
}

.business-summary,
.business-results {
  display: grid;
  gap: 1rem;
}

.business-summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.business-results {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.business-dashboard-analytics {
  display: grid;
  gap: 1.2rem;
}

.business-dashboard-analytics__hero,
.business-dashboard-analytics__panel,
.business-dashboard-analytics__progress-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(138, 229, 255, 0.34), transparent 34%),
    radial-gradient(circle at top right, rgba(246, 168, 255, 0.28), transparent 36%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(255, 245, 254, 0.84));
  box-shadow: 0 24px 48px rgba(204, 148, 222, 0.14);
}

.business-dashboard-analytics__hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 1.6rem 1.7rem;
}

.business-dashboard-analytics__hero-copy {
  display: grid;
  gap: 0.55rem;
  max-width: 44rem;
}

.business-dashboard-analytics__eyebrow {
  margin: 0;
  color: #9060b6;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.business-dashboard-analytics__hero h2 {
  margin: 0;
  color: #2d235f;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
}

.business-dashboard-analytics__hero p,
.business-dashboard-analytics__progress-card p,
.business-dashboard-analytics__legend-item span,
.business-dashboard-analytics__months span {
  margin: 0;
  color: #776a96;
}

.business-dashboard-analytics__hero-side {
  min-width: 15rem;
  display: grid;
  gap: 0.3rem;
  padding: 1rem 1.1rem;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(133, 76, 255, 0.12), rgba(255, 110, 199, 0.16));
  color: #463572;
}

.business-dashboard-analytics__hero-side strong,
.business-dashboard-analytics__panel-head strong,
.business-dashboard-analytics__progress-card strong,
.business-dashboard-analytics__legend-item strong,
.business-dashboard-analytics__balance strong {
  color: #34235f;
}

.business-dashboard-analytics__progress {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.business-dashboard-analytics__progress-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.95rem;
  padding: 1.1rem 1.2rem;
}

.business-dashboard-analytics__ring {
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at center, #fff 54%, transparent 55%),
    conic-gradient(#ff5ad9 0 68%, #ad63ff 68% 100%);
  box-shadow: inset 0 0 0 10px rgba(255, 255, 255, 0.88);
}

.business-dashboard-analytics__ring span {
  color: #7d3fc7;
  font-size: 0.85rem;
  font-weight: 800;
}

.business-dashboard-analytics__grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.95fr) minmax(0, 1.7fr);
  gap: 1rem;
}

.business-dashboard-analytics__panel {
  padding: 1.25rem;
}

.business-dashboard-analytics__panel--trend {
  grid-row: span 2;
}

.business-dashboard-analytics__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-dashboard-analytics__panel-head span,
.business-dashboard-analytics__balance small {
  display: block;
  color: #9278b0;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.business-dashboard-analytics__radar {
  position: relative;
  width: min(100%, 16rem);
  aspect-ratio: 1;
  margin: 1.4rem auto 0.25rem;
  display: grid;
  place-items: center;
}

.business-dashboard-analytics__radar-shape,
.business-dashboard-analytics__radar-core {
  position: absolute;
  clip-path: polygon(50% 0%, 92% 25%, 80% 90%, 20% 90%, 8% 25%);
}

.business-dashboard-analytics__radar-shape--outer {
  inset: 0;
  background: linear-gradient(180deg, rgba(70, 66, 132, 0.95), rgba(43, 30, 88, 0.88));
}

.business-dashboard-analytics__radar-shape--inner {
  inset: 16%;
  background: linear-gradient(135deg, rgba(108, 245, 255, 0.95), rgba(246, 79, 255, 0.76));
}

.business-dashboard-analytics__radar-core {
  inset: 28%;
  background: rgba(255, 255, 255, 0.66);
}

.business-dashboard-analytics__line {
  position: relative;
  min-height: 18rem;
  margin-top: 1rem;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.18)),
    linear-gradient(135deg, rgba(255, 138, 214, 0.12), rgba(77, 225, 255, 0.12));
}

.business-dashboard-analytics__line-grid {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image:
    linear-gradient(rgba(153, 136, 192, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(153, 136, 192, 0.12) 1px, transparent 1px);
  background-size: 100% 25%, 8.33% 100%;
}

.business-dashboard-analytics__line-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: #69eaff;
  stroke-width: 4;
  filter: drop-shadow(0 8px 20px rgba(105, 234, 255, 0.42));
}

.business-dashboard-analytics__line-svg--secondary {
  stroke: #ff63d8;
  stroke-width: 3;
  opacity: 0.9;
  filter: drop-shadow(0 8px 18px rgba(255, 99, 216, 0.24));
}

.business-dashboard-analytics__line-marker {
  position: absolute;
  top: 1.2rem;
  right: 1.6rem;
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 0.9rem;
  border-radius: 18px;
  background: linear-gradient(180deg, #ff557d, #b91f56);
  color: #ffffff;
  box-shadow: 0 16px 28px rgba(185, 31, 86, 0.26);
}

.business-dashboard-analytics__line-marker span,
.business-dashboard-analytics__line-marker strong {
  color: inherit;
}

.business-dashboard-analytics__months {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.25rem;
  margin-top: 0.85rem;
  text-align: center;
  font-size: 0.76rem;
}

.business-dashboard-analytics__bars {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.business-dashboard-analytics__bar-row {
  display: grid;
  grid-template-columns: 5.6rem minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.business-dashboard-analytics__bar-row span,
.business-dashboard-analytics__bar-row strong {
  color: #5d4e83;
  font-size: 0.82rem;
  font-weight: 700;
}

.business-dashboard-analytics__bar-track {
  height: 0.78rem;
  border-radius: 999px;
  background: rgba(144, 101, 212, 0.12);
  overflow: hidden;
}

.business-dashboard-analytics__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #53e9ff, #ad63ff, #ff65bf);
}

.business-dashboard-analytics__donut-wrap {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
}

.business-dashboard-analytics__donut {
  position: relative;
  width: 11.5rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(#29b4ff 0 15%, #5568ff 15% 32%, #7b4bff 32% 45%, #d44bff 45% 55%, #ff5f8f 55% 69%, #ff8c42 69% 79%, #be8cff 79% 100%);
}

.business-dashboard-analytics__donut::after {
  content: '';
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
}

.business-dashboard-analytics__donut-center {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-content: center;
  text-align: center;
}

.business-dashboard-analytics__donut-center span {
  color: #9278b0;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-dashboard-analytics__donut-center strong {
  color: #34235f;
  font-size: 1.15rem;
}

.business-dashboard-analytics__legend {
  display: grid;
  gap: 0.6rem;
}

.business-dashboard-analytics__legend-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
  font-size: 0.82rem;
}

.business-dashboard-analytics__legend-dot {
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 50%;
}

.business-profile {
  display: grid;
  gap: 1rem;
}

.business-job-post {
  display: grid;
  gap: 1rem;
}

.business-job-post__lead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-job-post__copy {
  max-width: 42rem;
}

.business-job-post__eyebrow {
  margin: 0 0 0.35rem;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-job-post__lead h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.2rem, 1.8vw, 1.55rem);
}

.business-job-post__lead p {
  margin: 0.45rem 0 0;
  color: #6b7280;
  line-height: 1.55;
}

.business-job-post__button {
  flex-shrink: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #111827;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.2em;
  transition: color 0.2s ease, opacity 0.2s ease;
  align-self: flex-start;
}

.business-job-post__button:hover {
  color: #374151;
  opacity: 0.9;
}

.business-job-post__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.business-job-post__highlight,
.business-job-post__panel {
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-job-post__highlight span,
.business-job-post__tips-label {
  display: block;
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-job-post__highlight strong,
.business-job-post__panel strong {
  display: block;
  margin-top: 0.45rem;
  color: #111827;
  font-size: 1rem;
}

.business-job-post__posted-layout {
  display: grid;
  gap: 1rem;
}

.business-job-post__create {
  display: block;
}

.business-job-post__panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.business-job-post__panel-head strong {
  margin-top: 0.28rem;
}

.business-job-post__panel-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.72rem;
  border-radius: 4px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.business-job-post__shell {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.88fr);
  gap: 1rem;
  align-items: start;
}

.business-job-post__form-shell,
.business-job-post__live-preview {
  display: grid;
  gap: 0.95rem;
}

.business-job-post__form-shell {
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-job-post__fieldset,
.business-user-management__fieldset,
.business-template-builder__fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}

.business-job-post__grid {
  display: grid;
  gap: 0.9rem;
}

.business-job-post__grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.business-job-post__grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.business-job-post__field {
  display: grid;
  gap: 0.45rem;
}

.business-job-post__field--spacer {
  visibility: hidden;
}

.business-job-post__field span {
  color: #4b5563;
  font-size: 0.8rem;
  font-weight: 700;
}

.business-job-post__field input,
.business-job-post__field select,
.business-job-post__field textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font: inherit;
  padding: 0.72rem 0.8rem;
  resize: vertical;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-job-post__field textarea {
  min-height: 96px;
}

.business-job-post__range {
  width: 100%;
}

.business-job-post__field input:focus,
.business-job-post__field select:focus,
.business-job-post__field textarea:focus {
  border-color: #9ca3af;
  box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.14);
}

.business-job-post__actions {
  display: flex;
  justify-content: flex-start;
  gap: 0.75rem;
  padding-top: 0.15rem;
}

.business-job-post__save,
.business-job-post__secondary {
  min-height: 40px;
  padding: 0.72rem 0.95rem;
  border-radius: 6px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-job-post__save {
  border: 1px solid #111827;
  background: #111827;
  color: #ffffff;
}

.business-job-post__secondary {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.business-job-post__save:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-job-post__secondary:hover {
  transform: translateY(-1px);
  background: #f9fafb;
}

.business-job-post__save:disabled,
.business-job-post__secondary:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
  box-shadow: none;
}

.business-job-post__live-preview {
  position: sticky;
  top: 1rem;
  padding: 0.9rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #f9fafb;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-job-post__preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.business-job-post__preview-status,
.business-job-post__preview-date {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.55rem;
  border-radius: 4px;
  background: #ffffff;
  border: 1px solid #d6ddd8;
  color: #374151;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-job-post__preview-status {
  background: #111827;
  border-color: #111827;
  color: #ffffff;
}

.business-job-post__preview-main,
.business-job-post__preview-meta,
.business-job-post__preview-section,
.business-job-post__preview-panel,
.business-job-post__preview-summary-card {
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-job-post__preview-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.business-job-post__preview-logo {
  width: 4.1rem;
  height: 4.1rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: #111827;
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 800;
}

.business-job-post__preview-logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.business-job-post__preview-copy-wrap {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.business-job-post__preview-copy-wrap h3 {
  margin: 0;
  color: #111827;
  font-size: 1.15rem;
}

.business-job-post__preview-company {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: #4b5563;
  line-height: 1.5;
}

.business-job-post__preview-rating {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  color: #6b7280;
  font-size: 0.82rem;
}

.business-job-post__preview-stars {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #9ca3af;
}

.business-job-post__preview-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.business-job-post__preview-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.2rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-job-post__preview-section,
.business-job-post__preview-panel {
  display: grid;
  gap: 0.7rem;
}

.business-job-post__preview-section h4,
.business-job-post__preview-panel h4 {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: #111827;
  font-size: 0.95rem;
}

.business-job-post__preview-section p,
.business-job-post__preview-panel p {
  margin: 0;
  color: #6b7280;
  line-height: 1.6;
}

.business-job-post__preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.95rem;
}

.business-job-post__preview-section ul {
  margin: 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.55rem;
  color: #374151;
}

.business-job-post__preview-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.95rem;
}

.business-job-post__preview-summary-card {
  gap: 0.4rem;
}

.business-job-post__preview-summary-card > span:not(.business-job-post__preview-summary-icon) {
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-job-post__preview-summary-card strong {
  color: #111827;
}

.business-job-post__preview-summary-icon {
  width: 2.4rem;
  height: 2.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #f3f4f6;
  color: #111827;
  font-size: 1rem;
}

.business-job-post__lead:hover,
.business-job-post__highlight:hover,
.business-job-post__panel:hover,
.business-job-post__form-shell:hover,
.business-job-post__live-preview:hover,
.business-job-post__preview-main:hover,
.business-job-post__preview-meta:hover,
.business-job-post__preview-section:hover,
.business-job-post__preview-panel:hover,
.business-job-post__preview-summary-card:hover {
  border-color: #c5cec8;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
}

.business-job-post__posted-list {
  display: grid;
  gap: 0.8rem;
}

.business-job-post__posted-empty {
  margin: 0;
  padding: 1rem;
  border: 1px dashed #d6ddd8;
  border-radius: 8px;
  background: #f9fbfa;
  color: #617267;
  line-height: 1.6;
}

.business-job-post__posted-main strong,
.business-job-post__posted-metric span,
.business-job-post__posted-side span {
  display: block;
  color: #173828;
}

.business-job-post__posted-row {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) auto auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  position: relative;
}

.business-job-post__posted-top {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.business-job-post__posted-main p,
.business-job-post__posted-main small {
  display: block;
  margin: 0.32rem 0 0;
  color: #617267;
  line-height: 1.55;
}

.business-job-post__posted-main small {
  font-size: 0.78rem;
}

.business-job-post__posted-metric,
.business-job-post__posted-side {
  min-width: 7.5rem;
  display: grid;
  justify-items: start;
  gap: 0.15rem;
}

.business-job-post__posted-metric span,
.business-job-post__posted-side span {
  color: #6d8175;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-job-post__posted-metric strong,
.business-job-post__posted-side strong {
  display: block;
  margin-top: 0.35rem;
  color: #173828;
}

.business-job-post__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.business-job-post__status.is-open {
  background: #eaf8f0;
  color: #1f7a3f;
}

.business-job-post__status.is-draft {
  background: #fff4db;
  color: #986300;
}

.business-job-post__status.is-closed {
  background: #f3f4f6;
  color: #667085;
}

.business-job-post__posted-actions {
  justify-self: end;
}

.business-job-post__menu {
  position: relative;
}

.business-job-post__menu-trigger {
  width: 2.4rem;
  min-width: 2.4rem;
  min-height: 2.4rem;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-job-post__menu-trigger:hover {
  transform: translateY(-1px);
  background: #f9fafb;
}

.business-job-post__menu-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  transform: none;
  box-shadow: none;
}

.business-job-post__menu-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 12;
  min-width: 11rem;
  display: grid;
  gap: 0.2rem;
  padding: 0.4rem;
  border: 1px solid #d6ddd8;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 16px 32px rgba(17, 24, 39, 0.12);
}

.business-job-post__menu-action {
  min-height: 2.35rem;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #111827;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease;
}

.business-job-post__menu-action:hover {
  background: #f9fafb;
}

.business-job-post__menu-action.is-danger {
  color: #b91c1c;
}

.business-job-post__menu-action:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.business-user-management {
  display: grid;
  gap: 1rem;
}

.business-user-management__lead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-user-management__copy {
  max-width: 42rem;
}

.business-user-management__lead-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}

.business-user-management__eyebrow {
  margin: 0 0 0.35rem;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-user-management__lead h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.2rem, 1.8vw, 1.55rem);
}

.business-user-management__lead p {
  margin: 0.45rem 0 0;
  color: #6b7280;
  line-height: 1.55;
}

.business-user-management__panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-user-management__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.85rem;
}

.business-user-management__panel-label {
  margin: 0;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-user-management__panel-head h3 {
  margin: 0.3rem 0 0;
  color: #111827;
  font-size: 1.05rem;
}

.business-user-management__panel-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.72rem;
  border-radius: 4px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.business-user-management__notice {
  margin: 0;
  padding: 0.9rem 1rem;
  border: 1px dashed #d6ddd8;
  border-radius: 8px;
  background: #f9fbfa;
  color: #617267;
  line-height: 1.6;
}

.business-user-management__grid {
  display: grid;
  gap: 0.9rem;
}

.business-user-management__grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.business-user-management__field {
  display: grid;
  gap: 0.45rem;
}

.business-user-management__field--full {
  grid-column: 1 / -1;
}

.business-user-management__field span {
  color: #4b5563;
  font-size: 0.8rem;
  font-weight: 700;
}

.business-user-management__field input,
.business-user-management__field select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font: inherit;
  padding: 0.72rem 0.8rem;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-user-management__field input:focus,
.business-user-management__field select:focus {
  border-color: #9ca3af;
  box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.14);
}

.business-user-management__field input[readonly] {
  background: #f9fafb;
  color: #4b5563;
}

.business-user-management__inline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.business-user-management__actions {
  display: flex;
  justify-content: flex-start;
  gap: 0.75rem;
}

.business-user-management__primary {
  min-height: 40px;
  padding: 0.72rem 0.95rem;
  border: 1px solid #111827;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-user-management__primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-user-management__meta {
  display: grid;
  gap: 0.2rem;
}

.business-user-management__meta small {
  color: #6b7280;
}

.business-user-management__table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.business-user-management__table {
  width: 100%;
  min-width: 880px;
  border-collapse: collapse;
}

.business-user-management__table th,
.business-user-management__table td {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid #eef2f0;
  text-align: left;
}

.business-user-management__table th {
  color: #4b5563;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #f9fafb;
}

.business-user-management__table tbody tr:last-child td {
  border-bottom: 0;
}

.business-user-management__table td {
  color: #374151;
  font-size: 0.9rem;
}

.business-user-management__table td strong {
  color: #111827;
}

.business-user-management__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.95rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-user-management__status.is-active {
  background: #ecfdf3;
  color: #047857;
}

.business-user-management__status.is-pending {
  background: #fff7ed;
  color: #c2410c;
}

.business-user-management__status.is-leave {
  background: #f3f4f6;
  color: #4b5563;
}

.business-user-management__status.is-disabled {
  background: #fef2f2;
  color: #b91c1c;
}

.business-user-management__lead:hover,
.business-user-management__panel:hover,
.business-user-management__table-wrap:hover {
  border-color: #c5cec8;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
}

.business-permissions {
  display: grid;
  gap: 1.05rem;
}

.business-permissions__hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.1rem;
  padding: 1.2rem 1.3rem;
  border: 1px solid #d7dfda;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfa 100%);
}

.business-permissions__hero-copy {
  display: grid;
  gap: 0.45rem;
  max-width: 46rem;
}

.business-permissions__eyebrow {
  margin: 0;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-permissions__hero h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.4rem, 2vw, 1.9rem);
}

.business-permissions__hero p {
  margin: 0;
  color: #6b7280;
  line-height: 1.65;
}

.business-permissions__hero-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.business-permissions__hero-chip,
.business-permissions__panel-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0.2rem 0.62rem;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.business-permissions__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.business-permissions__panel {
  display: grid;
  gap: 0.85rem;
  padding: 0.95rem;
  border: 1px solid #d7dfda;
  border-radius: 12px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.business-permissions__panel:hover,
.business-permissions__hero:hover {
  border-color: #c5cec8;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
}

.business-permissions__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.8rem;
}

.business-permissions__panel-label,
.business-permissions__group-label {
  margin: 0;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-permissions__panel-head h3,
.business-permissions__group-head h4 {
  margin: 0.18rem 0 0;
  color: #111827;
  font-size: 1rem;
}

.business-permissions__role-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin: 0.28rem 0 0;
  color: #6b7280;
  font-size: 0.82rem;
  line-height: 1.45;
}

.business-permissions__role-meta span[aria-hidden='true'] {
  font-size: 0;
}

.business-permissions__role-meta span[aria-hidden='true']::before {
  content: '|';
  font-size: 0.82rem;
}

.business-permissions__panel-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}

.business-permissions__panel-actions {
  display: inline-flex;
  align-items: center;
}

.business-permissions__role-tag {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0.22rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--role-color);
  background: #ffffff;
  color: #111827;
  font-size: 0.72rem;
  font-weight: 700;
}

.business-permissions__menu {
  position: relative;
}

.business-permissions__menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-permissions__menu-toggle:hover {
  border-color: #d1d5db;
  background: #f9fafb;
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.08);
  transform: translateY(-1px);
}

.business-permissions__menu-toggle i {
  font-size: 1rem;
}

.business-permissions__menu-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 15;
  width: min(92vw, 360px);
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid #dbe2de;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 34px rgba(17, 24, 39, 0.12);
  backdrop-filter: blur(14px);
}

.business-permissions__menu-section {
  display: grid;
  gap: 0.55rem;
}

.business-permissions__menu-section + .business-permissions__menu-section {
  padding-top: 0.75rem;
  border-top: 1px solid #edf1ee;
}

.business-permissions__menu-section--summary {
  gap: 0.28rem;
}

.business-permissions__menu-label {
  margin: 0;
  color: #4b5563;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-permissions__menu-section strong {
  color: #111827;
  font-size: 0.96rem;
  line-height: 1.25;
}

.business-permissions__menu-section small {
  color: #6b7280;
  font-size: 0.8rem;
  line-height: 1.45;
}

.business-permissions__menu-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.business-permissions__menu-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.business-permissions__field {
  display: grid;
  gap: 0.35rem;
}

.business-permissions__field span {
  color: #374151;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-permissions__field input,
.business-permissions__select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  font: inherit;
  padding: 0.66rem 0.8rem;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.business-permissions__field input:focus,
.business-permissions__select:focus {
  border-color: #9ca3af;
  box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.14);
}

.business-permissions__controls {
  display: grid;
  gap: 0.75rem;
}

.business-permissions__control-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

.business-permissions__field--stacked {
  grid-column: 1 / -1;
}

.business-permissions__inline-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.business-permissions__inline-action input {
  flex: 1 1 18rem;
  min-width: 0;
}

.business-permissions__inline-action--compact {
  gap: 0.45rem;
}

.business-permissions__inline-action--compact .business-permissions__action-save,
.business-permissions__inline-action--compact .business-permissions__inline-button {
  flex: 0 0 auto;
}

.business-permissions__select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #6b7280 50%),
    linear-gradient(135deg, #6b7280 50%, transparent 50%);
  background-position:
    calc(100% - 18px) calc(50% - 3px),
    calc(100% - 12px) calc(50% - 3px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 2.5rem;
}

.business-permissions__primary,
.business-permissions__secondary,
.business-permissions__danger,
.business-permissions__inline-button,
.business-permissions__ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.4rem 0.78rem;
  border-radius: 10px;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: transform 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.business-permissions__primary {
  border: 1px solid #1f2937;
  background: #1f2937;
  color: #ffffff;
}

.business-permissions__secondary {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.business-permissions__danger {
  border: 1px solid #e4e7ec;
  background: #ffffff;
  color: #b42318;
}

.business-permissions__inline-button {
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  white-space: nowrap;
}

.business-permissions__ghost-button {
  flex: 0 0 auto;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #4b5563;
  white-space: nowrap;
}

.business-permissions__mode-button {
  min-width: 5rem;
}

.business-permissions__mode-button.is-active {
  border-color: #1f2937;
  background: #1f2937;
  color: #ffffff;
}

.business-permissions__action-delete {
  min-width: 6.9rem;
}

.business-permissions__action-save {
  min-width: 7.6rem;
}

.business-permissions__action-save.is-saved {
  border-color: #d7dde5;
  background: #eef1f5;
  color: #4b5563;
}

.business-permissions__primary:hover,
.business-permissions__secondary:hover,
.business-permissions__danger:hover,
.business-permissions__inline-button:hover,
.business-permissions__ghost-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.08);
}

.business-permissions__action-save.is-saved:hover {
  transform: none;
  box-shadow: none;
}

.business-permissions__primary:disabled,
.business-permissions__secondary:disabled,
.business-permissions__danger:disabled,
.business-permissions__inline-button:disabled,
.business-permissions__ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
  transform: none;
  box-shadow: none;
}

.business-permissions__action-save.is-saved:disabled {
  opacity: 1;
  border-color: #d7dde5;
  background: #eef1f5;
  color: #4b5563;
}

.business-permissions__save-state {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: #1d4ed8;
  font-size: 0.82rem;
  font-weight: 700;
}

.business-permissions__save-state::before {
  content: '';
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: currentColor;
  flex-shrink: 0;
}

.business-permissions__save-state.is-unsaved {
  color: #b45309;
}

.business-permissions__role-swatch {
  width: 0.8rem;
  height: 2.4rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.business-permissions__role-copy {
  display: grid;
  gap: 0.15rem;
}

.business-permissions__role-cell {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.business-permissions__role-copy strong {
  color: #111827;
}

.business-permissions__role-copy small {
  color: #6b7280;
}

.business-permissions__intro-copy {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.5;
}

.business-permissions__module-copy {
  display: grid;
  gap: 0.24rem;
}

.business-permissions__module-copy strong {
  color: #111827;
  font-size: 0.95rem;
}

.business-permissions__module-copy p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
  font-size: 0.84rem;
}

.business-permissions__table-wrap {
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
}

.business-permissions__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 100%;
}

.business-permissions__table th,
.business-permissions__table td {
  padding: 0.82rem 0.9rem;
  border-bottom: 1px solid #edf1ef;
  vertical-align: middle;
  text-align: left;
}

.business-permissions__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8faf9;
  color: #4b5563;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.business-permissions__table tbody tr:last-child td {
  border-bottom: 0;
}

.business-permissions__table-row {
  transition: background-color 180ms ease;
}

.business-permissions__table-row:hover {
  background: #fafcfb;
}

.business-permissions__table-row.is-muted {
  background: #fcfcfd;
}

.business-permissions__table-row.is-active {
  background: #eef5ff;
}

.business-permissions__table-row--role {
  cursor: pointer;
}

.business-permissions__table--roles th:nth-child(2),
.business-permissions__table--roles th:nth-child(3),
.business-permissions__table--roles td:nth-child(2),
.business-permissions__table--roles td:nth-child(3) {
  width: 5.75rem;
  text-align: center;
}

.business-permissions__table--matrix {
  min-width: 860px;
}

.business-permissions__table--matrix th:nth-child(n + 3):nth-child(-n + 5),
.business-permissions__table--matrix td:nth-child(n + 3):nth-child(-n + 5) {
  text-align: center;
  width: 5.4rem;
}

.business-permissions__section-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.34rem 0.6rem;
  border-radius: 999px;
  border: 1px solid #d9e4dc;
  background: #f8faf9;
  color: #374151;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.business-permissions__switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.business-permissions__switch-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.business-permissions__switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 2.8rem;
  height: 1.55rem;
  padding: 0.12rem;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #e5e7eb;
  transition: background-color 180ms ease, border-color 180ms ease, opacity 180ms ease;
}

.business-permissions__switch-thumb {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
  transform: translateX(0);
  transition: transform 180ms ease;
}

.business-permissions__switch-input:checked + .business-permissions__switch-track {
  border-color: #0f766e;
  background: #14b8a6;
}

.business-permissions__switch-input:checked + .business-permissions__switch-track .business-permissions__switch-thumb {
  transform: translateX(1.2rem);
}

.business-permissions__switch-input:disabled + .business-permissions__switch-track {
  opacity: 0.5;
  cursor: not-allowed;
}

.business-permissions__status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.26rem 0.7rem;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.35;
}

.business-permissions__status-pill.is-hidden {
  background: #f3f4f6;
  color: #6b7280;
}

.business-permissions__status-pill.is-full {
  background: #ecfdf3;
  color: #047857;
}

.business-applicants {
  display: grid;
  gap: 1.1rem;
}

.business-applicants__lead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.35rem;
  border: 1px solid #d7e3db;
  border-radius: 10px;
  background: #ffffff;
}

.business-applicants__copy {
  display: grid;
  gap: 0.45rem;
}

.business-applicants__eyebrow {
  margin: 0;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-applicants__lead h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.5rem, 2vw, 1.95rem);
}

.business-applicants__lead p {
  margin: 0;
  max-width: 42rem;
  color: #6b7280;
  line-height: 1.65;
}

.business-applicants__button {
  min-height: 2.9rem;
  padding: 0 1rem;
  border: 1px solid #111827;
  border-radius: 8px;
  background: #111827;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.business-applicants__button:hover {
  transform: translateY(-1px);
  background: #1f2937;
}

.business-applicants__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.business-applicants__highlight,
.business-applicants__panel {
  padding: 1rem 1.1rem;
  border: 1px solid #d7e3db;
  border-radius: 10px;
  background: #ffffff;
}

.business-applicants__highlight span,
.business-applicants__panel-label {
  color: #6b7280;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-applicants__highlight strong {
  display: block;
  margin-top: 0.45rem;
  color: #111827;
  font-size: 1.55rem;
}

.business-applicants__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.8fr);
  gap: 1rem;
}

.business-applicants__panel {
  display: grid;
  gap: 1rem;
}

.business-applicants__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.85rem;
}

.business-applicants__panel-head h3 {
  margin: 0.3rem 0 0;
  color: #111827;
  font-size: 1.08rem;
}

.business-applicants__panel-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 700;
}

.business-applicants__list,
.business-applicants__steps {
  display: grid;
  gap: 0.85rem;
}

.business-applicants__empty {
  display: grid;
  justify-items: start;
  gap: 0.7rem;
  padding: 1.25rem;
  border: 1px dashed #d7e3db;
  border-radius: 8px;
  background: #f9fafb;
}

.business-applicants__empty strong {
  color: #111827;
  font-size: 1rem;
}

.business-applicants__empty p {
  margin: 0;
  max-width: 28rem;
  color: #6b7280;
  line-height: 1.65;
}

.business-applicants__empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #dbe4de;
  color: #4b5563;
  font-size: 1.2rem;
}

.business-applicants__card,
.business-applicants__steps article {
  display: grid;
  gap: 0.7rem;
  padding: 0.95rem 1rem;
  border: 1px solid #e2e8e3;
  border-radius: 8px;
  background: #f9fafb;
}

.business-applicants__card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.8rem;
}

.business-applicants__card-top > div {
  display: grid;
  gap: 0.2rem;
}

.business-applicants__card-top strong,
.business-applicants__steps strong {
  color: #111827;
  font-size: 0.98rem;
}

.business-applicants__card-top span,
.business-applicants__steps p,
.business-applicants__card p {
  color: #6b7280;
  line-height: 1.6;
}

.business-applicants__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.business-applicants__meta span,
.business-applicants__match,
.business-applicants__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-applicants__meta span {
  background: #ffffff;
  color: #4b5563;
  border: 1px solid #dbe4de;
}

.business-applicants__status {
  background: #eef2ff;
  color: #4338ca;
}

.business-applicants__status--shortlisted {
  background: #ecfdf3;
  color: #047857;
}

.business-applicants__status--interview {
  background: #fff7ed;
  color: #c2410c;
}

.business-applicants__match {
  background: #f3f4f6;
  color: #374151;
}

.business-applicants__card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.business-applicants__card-actions button {
  min-height: 2.4rem;
  padding: 0 0.95rem;
  border: 1px solid #111827;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease, transform 180ms ease;
}

.business-applicants__card-actions button:hover {
  transform: translateY(-1px);
  background: #111827;
  color: #ffffff;
}

.business-applicants__panel--aside {
  align-content: start;
}

.business-interview-scheduling {
  display: grid;
  gap: 1rem;
}

.business-interview-scheduling__header,
.business-interview-scheduling__card {
  padding: 1rem 1.1rem;
  border: 1px solid #d6ddd8;
  border-radius: 10px;
  background: #ffffff;
}

.business-interview-scheduling__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-interview-scheduling__header-copy {
  display: grid;
  gap: 0.4rem;
}

.business-interview-scheduling__kicker,
.business-interview-scheduling__card-kicker {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-interview-scheduling__header h2,
.business-interview-scheduling__card h3,
.business-interview-scheduling__calendar-head h3,
.business-interview-scheduling__day-list h4 {
  margin: 0;
  color: #111827;
}

.business-interview-scheduling__header p,
.business-interview-scheduling__card-head p,
.business-interview-scheduling__calendar-caption,
.business-interview-scheduling__day-empty {
  margin: 0;
  color: #6b7280;
  line-height: 1.55;
}

.business-interview-scheduling__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
}

.business-interview-scheduling__stat-strip {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.business-interview-scheduling__stat-strip span {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-interview-scheduling__link-btn,
.business-interview-scheduling__refresh,
.business-interview-scheduling__submit,
.business-interview-scheduling__reset,
.business-interview-scheduling__calendar-nav button {
  min-height: 40px;
  border-radius: 8px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-interview-scheduling__link-btn,
.business-interview-scheduling__submit {
  border: 1px solid #111827;
  background: #111827;
  color: #ffffff;
}

.business-interview-scheduling__refresh,
.business-interview-scheduling__reset,
.business-interview-scheduling__calendar-nav button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.business-interview-scheduling__link-btn,
.business-interview-scheduling__refresh,
.business-interview-scheduling__submit,
.business-interview-scheduling__reset {
  padding: 0.72rem 0.95rem;
}

.business-interview-scheduling__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.9fr);
  gap: 1rem;
}

.business-interview-scheduling__main,
.business-interview-scheduling__card {
  display: grid;
  gap: 1rem;
}

.business-interview-scheduling__card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-interview-scheduling__fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}

.business-interview-scheduling__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.business-interview-scheduling__field {
  display: grid;
  gap: 0.45rem;
}

.business-interview-scheduling__field--full,
.business-interview-scheduling__field-hint,
.business-interview-scheduling__actions {
  grid-column: 1 / -1;
}

.business-interview-scheduling__field span {
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-interview-scheduling__field input,
.business-interview-scheduling__field select,
.business-interview-scheduling__field textarea {
  width: 100%;
  padding: 0.78rem 0.82rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font: inherit;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-interview-scheduling__field textarea {
  resize: vertical;
  min-height: 96px;
}

.business-interview-scheduling__field input:focus,
.business-interview-scheduling__field select:focus,
.business-interview-scheduling__field textarea:focus {
  border-color: #9ca3af;
  box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.14);
}

.business-interview-scheduling__field-hint,
.business-interview-scheduling__error {
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  font-size: 0.9rem;
  line-height: 1.55;
}

.business-interview-scheduling__field-hint.is-warning {
  border: 1px solid #fed7aa;
  background: #fff7ed;
  color: #9a3412;
}

.business-interview-scheduling__error {
  margin: 0;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.business-interview-scheduling__actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.business-interview-scheduling__calendar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.business-interview-scheduling__calendar-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.business-interview-scheduling__calendar-nav strong {
  color: #111827;
  font-size: 0.95rem;
}

.business-interview-scheduling__calendar-nav button {
  width: 2.5rem;
  min-width: 2.5rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.business-interview-scheduling__calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.45rem;
}

.business-interview-scheduling__calendar-grid--week span {
  padding: 0.2rem 0;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
}

.business-interview-scheduling__day-cell {
  min-height: 74px;
  padding: 0.65rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  color: #111827;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.business-interview-scheduling__day-number {
  font-weight: 700;
}

.business-interview-scheduling__day-cell small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45rem;
  min-height: 1.45rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.72rem;
  font-weight: 700;
}

.business-interview-scheduling__day-cell.is-muted {
  color: #9ca3af;
  background: #fbfbfc;
}

.business-interview-scheduling__day-cell.is-today {
  border-color: #93c5fd;
}

.business-interview-scheduling__day-cell.is-selected {
  border-color: #111827;
  background: #ffffff;
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.08);
}

.business-interview-scheduling__day-cell.is-past {
  cursor: not-allowed;
  opacity: 0.6;
}

.business-interview-scheduling__day-list {
  display: grid;
  gap: 0.85rem;
  padding-top: 0.4rem;
  border-top: 1px solid #eef2f0;
}

.business-interview-scheduling__day-list ul {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.business-interview-scheduling__day-list li {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.business-interview-scheduling__day-list li strong {
  color: #111827;
}

.business-interview-scheduling__day-list li span {
  color: #6b7280;
}

.business-interview-scheduling__link-btn:hover,
.business-interview-scheduling__refresh:hover,
.business-interview-scheduling__submit:hover,
.business-interview-scheduling__reset:hover,
.business-interview-scheduling__calendar-nav button:hover,
.business-interview-scheduling__day-cell:hover:not(:disabled) {
  transform: translateY(-1px);
}

.business-interview-scheduling__link-btn:hover,
.business-interview-scheduling__submit:hover {
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-interview-scheduling__refresh:hover,
.business-interview-scheduling__reset:hover,
.business-interview-scheduling__calendar-nav button:hover {
  background: #f9fafb;
}

.business-interview-scheduling__refresh:disabled,
.business-interview-scheduling__submit:disabled,
.business-interview-scheduling__reset:disabled,
.business-interview-scheduling__calendar-nav button:disabled,
.business-interview-scheduling__day-cell:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.business-interview-status {
  display: grid;
  gap: 1rem;
}

.business-interview-status__panel {
  display: grid;
  gap: 1rem;
}

.business-interview-status__applicant,
.business-interview-status__stage {
  display: grid;
  gap: 0.2rem;
}

.business-interview-status__applicant strong,
.business-interview-status__stage strong {
  color: #111827;
}

.business-interview-status__applicant span,
.business-interview-status__applicant small,
.business-interview-status__stage span {
  color: #6b7280;
}

.business-interview-status__applicant small {
  font-size: 0.78rem;
}

.business-interview-status__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-interview-status__badge.is-ready {
  background: #ecfdf3;
  color: #047857;
}

.business-interview-status__badge.is-scheduled {
  background: #dbeafe;
  color: #1d4ed8;
}

.business-interview-status__badge.is-completed {
  background: #eef2ff;
  color: #4338ca;
}

.business-interview-status__badge.is-pending {
  background: #fff7ed;
  color: #c2410c;
}

.business-interview-status__badge.is-blocked {
  background: #fef2f2;
  color: #b91c1c;
}

.business-interview-status__empty {
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
}

.business-interview-status__empty strong {
  color: #111827;
}

.business-interview-status__empty p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
}

.business-assessment-management {
  display: grid;
  gap: 1.15rem;
}

.business-assessment-management__tabs {
  display: inline-flex;
  width: fit-content;
  gap: 0.45rem;
  padding: 0.35rem;
  border-radius: 8px;
  background: #f3f4f6;
}

.business-assessment-management__tab {
  min-height: 38px;
  padding: 0.6rem 0.9rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-assessment-management__tab.is-active {
  background: #111827;
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-template-builder {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.88fr);
  gap: 1rem;
}

.business-template-builder__editor {
  display: grid;
  gap: 0.85rem;
}

.business-assessment-management .business-template-builder__fieldset {
  display: grid;
  gap: 1.15rem;
}

.business-assessment-builder__bar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  gap: 1rem;
  align-items: end;
  padding: 0.2rem 0 0.35rem;
}

.business-assessment-builder__picker {
  min-width: 0;
}

.business-assessment-builder__bar-status {
  display: grid;
  gap: 0.2rem;
  align-self: center;
}

.business-assessment-builder__bar-status span {
  color: #111827;
  font-size: 0.85rem;
  font-weight: 700;
}

.business-assessment-builder__bar-status small {
  color: #6b7280;
  font-size: 0.76rem;
}

.business-template-builder__hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-template-builder__hero-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.85rem;
}

.business-template-builder__eyebrow {
  margin: 0 0 0.35rem;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-template-builder__hero h2 {
  margin: 0;
  font-size: clamp(1.2rem, 1.8vw, 1.55rem);
  color: #111827;
}

.business-template-builder__hero p {
  margin: 0.45rem 0 0;
  max-width: 42rem;
  color: #6b7280;
  line-height: 1.55;
}

.business-template-builder__publish {
  min-height: 40px;
  padding: 0.72rem 0.95rem;
  border: 1px solid #111827;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-template-builder__publish--secondary {
  background: #ffffff;
  color: #374151;
  border-color: #d1d5db;
}

.business-template-builder__card {
  padding: 1.15rem 1.2rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-template-builder__card--header,
.business-template-builder__question,
.business-template-builder__toolbar {
  display: grid;
  gap: 0.95rem;
}

.business-template-builder__field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.95rem;
}

.business-template-builder__field {
  display: grid;
  gap: 0.45rem;
}

.business-template-builder__field span,
.business-template-builder__options > span,
.business-template-builder__scale > span,
.business-template-builder__select-wrap > span {
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-template-builder__field input,
.business-template-builder__field textarea,
.business-template-builder__field select,
.business-template-builder__select-wrap select,
.business-template-builder__option-row input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font: inherit;
  padding: 0.72rem 0.8rem;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-template-builder__field textarea {
  resize: vertical;
  min-height: 96px;
}

.business-assessment-builder__workspace {
  display: grid;
  gap: 1.15rem;
}

.business-template-builder__option-add,
.business-template-builder__option-remove {
  min-height: 38px;
  padding: 0.62rem 0.85rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-assessment-builder__toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid #eef2f0;
  border-bottom: 1px solid #eef2f0;
}

.business-template-builder__toolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}

.business-template-builder__toolbar-copy span {
  display: block;
  margin-top: 0.35rem;
  color: #6b7280;
  line-height: 1.5;
}

.business-template-builder__toolbar-copy strong {
  color: #111827;
  font-size: 0.95rem;
}

.business-template-builder__toolbar-actions {
  display: flex;
  align-items: end;
  gap: 0.75rem;
}

.business-template-builder__select-wrap {
  display: grid;
  gap: 0.45rem;
  min-width: 210px;
}

.business-template-builder__add,
.business-template-builder__remove {
  min-height: 40px;
  border-radius: 6px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-template-builder__add {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.72rem 0.9rem;
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
}

.business-template-builder__questions {
  display: grid;
  gap: 1.15rem;
}

.business-template-question-enter-active,
.business-template-question-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease,
    max-height 220ms ease,
    margin 220ms ease,
    padding 220ms ease;
}

.business-template-question-move {
  transition: transform 220ms ease;
}

.business-template-question-enter-from,
.business-template-question-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

.business-template-question-leave-active {
  overflow: hidden;
}

.business-template-builder__question-top {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #eef2f0;
}

.business-template-builder__question-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.business-template-builder__question-order,
.business-template-builder__question-type {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.74rem;
  font-weight: 700;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.business-template-builder__question-order {
  background: #f3f4f6;
  color: #374151;
}

.business-template-builder__question-type {
  background: #f9fafb;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}

.business-template-builder__remove {
  padding: 0.65rem 0.85rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.business-template-builder__options {
  display: grid;
  gap: 0.7rem;
}

.business-template-builder__option-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.15rem;
}

.business-template-builder__option-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
}

.business-template-builder__option-row i {
  color: #6b7280;
  font-size: 0.95rem;
}

.business-template-builder__answer-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.business-template-builder__answer-marker input {
  margin: 0;
  accent-color: #111827;
  cursor: pointer;
}

.business-template-builder__option-add {
  color: #111827;
}

.business-template-builder__option-remove {
  justify-self: start;
}

.business-template-builder__scale {
  display: grid;
  gap: 0.65rem;
}

.business-template-builder__scale-points {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.55rem;
}

.business-template-builder__scale-points span {
  display: grid;
  place-items: center;
  min-height: 42px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-weight: 700;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.business-template-builder__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #4b5563;
  font-weight: 700;
}

.business-template-preview__shell {
  position: sticky;
  top: 1rem;
  display: grid;
  gap: 0.85rem;
  padding: 0.9rem;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #d6ddd8;
  transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

.business-template-preview__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.business-template-preview__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #e5e7eb;
  color: #374151;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-template-preview__topbar strong {
  color: #111827;
  font-size: 0.9rem;
}

.business-template-preview__form {
  display: grid;
  gap: 1rem;
}

.business-assessment-builder__preview-note {
  margin-top: 0.7rem !important;
  padding: 0.8rem 0.9rem;
  border-radius: 6px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
}

.business-template-preview__details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.business-template-preview__detail {
  display: grid;
  gap: 0.4rem;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  border: 1px solid #d6ddd8;
  background: #ffffff;
}

.business-template-preview__detail span {
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.business-template-preview__detail strong {
  color: #111827;
}

.business-template-preview__header,
.business-template-preview__question {
  padding: 1rem;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #d6ddd8;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-template-preview__header {
  border-top: 3px solid #111827;
}

.business-template-preview__header h3,
.business-template-preview__question strong {
  margin: 0;
  color: #111827;
}

.business-template-preview__placeholder {
  color: #9ca3af !important;
}

.business-template-preview__header p,
.business-template-preview__question p {
  margin: 0.45rem 0 0;
  color: #6b7280;
  line-height: 1.55;
}

.business-template-preview__question {
  display: grid;
  gap: 0.8rem;
}

.business-template-preview__question-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
}

.business-template-preview__question-head span {
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.business-template-preview__question-head small {
  color: #6b7280;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-template-preview__question > input,
.business-template-preview__question textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  color: #6b7280;
  font: inherit;
  padding: 0.72rem 0.8rem;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.business-template-preview__choices {
  display: grid;
  gap: 0.65rem;
}

.business-template-preview__choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  color: #374151;
}

.business-template-preview__choice input {
  width: auto;
  margin: 0;
  accent-color: #111827;
  flex: 0 0 auto;
}

.business-template-preview__choice span {
  line-height: 1.5;
  min-width: 0;
}

.business-template-preview__rating {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.55rem;
}

.business-template-preview__rating button,
.business-template-preview__footer button {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font: inherit;
  font-weight: 700;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-template-preview__rating button {
  min-height: 42px;
}

.business-template-preview__footer button {
  width: 100%;
  min-height: 42px;
  background: #111827;
  color: #fff;
  border: 0;
  opacity: 0.72;
}

.business-template-preview__footer-copy {
  margin: 0.65rem 0 0;
  color: #6b7280;
  font-size: 0.82rem;
  line-height: 1.5;
  text-align: center;
}

.business-template-builder__card:hover,
.business-template-preview__header:hover,
.business-template-preview__question:hover,
.business-template-preview__detail:hover,
.business-template-preview__shell:hover {
  border-color: #c5cec8;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
}

.business-template-builder__publish:hover,
.business-template-builder__option-add:hover,
.business-template-builder__option-remove:hover,
.business-template-builder__add:hover,
.business-template-builder__remove:hover,
.business-template-preview__rating button:hover,
.business-template-preview__footer button:hover {
  transform: translateY(-1px);
}

.business-template-builder__publish:hover,
.business-template-builder__option-add:hover,
.business-template-builder__add:hover,
.business-template-preview__footer button:hover {
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-template-builder__remove:hover,
.business-template-builder__publish--secondary:hover,
.business-template-builder__option-add:hover,
.business-template-builder__option-remove:hover {
  background: #f9fafb;
}

.business-template-builder__field input:focus,
.business-template-builder__field textarea:focus,
.business-template-builder__field select:focus,
.business-template-builder__select-wrap select:focus,
.business-template-builder__option-row input:focus,
.business-template-builder__answer-marker input:focus,
.business-template-preview__question input:focus,
.business-template-preview__question textarea:focus,
.business-assign-templates__select:focus {
  border-color: #9ca3af;
  box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.14);
}

.business-assign-templates {
  display: grid;
  gap: 1rem;
}

.business-assign-templates__header,
.business-assign-templates__panel {
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
}

.business-assign-templates__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-assign-templates__eyebrow {
  margin: 0 0 0.35rem;
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-assign-templates__header h2 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.2rem, 1.8vw, 1.55rem);
}

.business-assign-templates__header p {
  margin: 0.45rem 0 0;
  color: #6b7280;
  line-height: 1.55;
}

.business-assign-templates__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.business-assign-templates__summary span,
.business-assign-templates__status {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-assign-templates__status.is-assigned {
  background: #ecfdf3;
  color: #047857;
}

.business-assign-templates__tabs {
  display: inline-flex;
  width: fit-content;
  gap: 0.45rem;
  padding: 0.35rem;
  border-radius: 8px;
  background: #f3f4f6;
}

.business-assign-templates__tab {
  min-height: 38px;
  padding: 0.6rem 0.9rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-assign-templates__tab.is-active {
  background: #111827;
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-assign-templates__table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.business-assign-templates__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.business-assign-templates__table th,
.business-assign-templates__table td {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid #eef2f0;
  text-align: left;
  vertical-align: middle;
}

.business-assign-templates__table th {
  background: #f9fafb;
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-assign-templates__table tbody tr:last-child td {
  border-bottom: 0;
}

.business-assign-templates__table td {
  color: #374151;
}

.business-assign-templates__applicant {
  display: grid;
  gap: 0.2rem;
}

.business-assign-templates__applicant strong {
  color: #111827;
}

.business-assign-templates__applicant span {
  color: #6b7280;
  font-size: 0.82rem;
}

.business-assign-templates__select,
.business-assign-templates__action {
  min-height: 38px;
  border-radius: 6px;
  font: inherit;
}

.business-assign-templates__select {
  width: 100%;
  min-width: 190px;
  padding: 0.65rem 0.8rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
}

.business-assign-templates__action {
  padding: 0.65rem 0.9rem;
  border: 1px solid #111827;
  background: #111827;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.business-assign-templates__action:hover,
.business-assign-templates__tab:hover,
.business-assessment-management__tab:hover {
  transform: translateY(-1px);
}

.business-assign-templates__action:hover {
  box-shadow: 0 10px 18px rgba(17, 24, 39, 0.12);
}

.business-assign-templates__select:disabled,
.business-assign-templates__action:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
  transform: none;
}

.business-assign-templates__empty {
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
}

.business-assign-templates__empty strong {
  color: #111827;
}

.business-assign-templates__empty p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
}

.business-profile__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-profile__header h2 {
  margin: 0;
  color: #245d3e;
  font-size: 1.8rem;
  font-weight: 800;
}

.business-profile__header p {
  margin: 0.35rem 0 0;
  color: #73837b;
  font-size: 0.92rem;
}

.business-profile__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid #d7e4dc;
  border-radius: 999px;
  background: #ffffff;
  color: #1f7448;
  font-size: 0.84rem;
  font-weight: 700;
}

.business-profile__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.9fr);
  gap: 1rem;
  align-items: start;
}

.business-profile__card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid #dfe9e2;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(29, 48, 37, 0.05);
}

.business-profile__card h3 {
  margin: 0;
  color: #173927;
  font-size: 1.08rem;
}

.business-profile__avatar-section {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border: 1px solid #dfe9e2;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fcf9 0%, #f3f9f5 100%);
}

.business-profile__avatar-shell {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f7448 0%, #2e8a59 100%);
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 800;
}

.business-profile__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.business-profile__avatar-copy strong {
  display: block;
  color: #173927;
  font-size: 0.96rem;
}

.business-profile__avatar-copy span {
  display: block;
  margin-top: 0.2rem;
  color: #607167;
  font-size: 0.85rem;
  line-height: 1.5;
}

.business-profile__avatar-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.business-profile__avatar-input {
  display: none;
}

.business-profile__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.business-profile__field {
  display: grid;
  gap: 0.42rem;
}

.business-profile__field--full {
  grid-column: 1 / -1;
}

.business-profile__field span {
  color: #5f7267;
  font-size: 0.82rem;
  font-weight: 700;
}

.business-profile__field input {
  min-height: 46px;
  width: 100%;
  padding: 0.78rem 0.95rem;
  border: 1px solid #d6e2da;
  border-radius: 14px;
  background: #fbfdfb;
  color: #173927;
  font: inherit;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.business-profile__field input:focus {
  outline: none;
  border-color: #2f8f5b;
  box-shadow: 0 0 0 4px rgba(47, 143, 91, 0.12);
}

.business-profile__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.business-profile__primary,
.business-profile__secondary {
  min-height: 44px;
  padding: 0.78rem 1.15rem;
  border-radius: 14px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.business-profile__primary {
  border: 0;
  background: linear-gradient(135deg, #2f8f5b 0%, #245d3e 100%);
  color: #ffffff;
}

.business-profile__secondary {
  border: 1px solid #d7e4dc;
  background: #ffffff;
  color: #245d3e;
}

.business-profile__secondary--danger {
  color: #b42318;
  border-color: rgba(180, 35, 24, 0.18);
}

.business-profile__card--preview {
  background: linear-gradient(180deg, #ffffff 0%, #f5faf7 100%);
}

.business-profile__preview {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  padding: 1rem;
  border: 1px solid #e2ebe5;
  border-radius: 18px;
  background: #fbfdfb;
  text-align: center;
}

.business-profile__preview-avatar {
  width: 4.1rem;
  height: 4.1rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f7448 0%, #2e8a59 100%);
  color: #ffffff;
  font-size: 1.25rem;
  font-weight: 800;
}

.business-profile__preview-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.business-profile__preview strong {
  color: #173927;
  font-size: 1.02rem;
}

.business-profile__preview span {
  color: #6d8175;
  font-size: 0.84rem;
}

.business-profile__meta {
  display: grid;
  gap: 0.7rem;
}

.business-profile__meta-row {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid #e6eee8;
}

.business-profile__meta-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.business-profile__meta-row span {
  color: #6d8175;
  font-size: 0.82rem;
}

.business-profile__meta-row strong {
  color: #173927;
  font-size: 0.9rem;
  text-align: right;
}

.business-subscription-overview {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: -1.5rem -1.5rem 0;
  padding: 1.45rem 1.5rem;
  border-radius: 0;
  color: #ffffff;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.14), transparent 28%),
    linear-gradient(90deg, #3e9c68 0%, #2f8f5b 48%, #256342 100%);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
}

.business-subscription-overview__copy,
.business-subscription-overview__billing {
  display: grid;
  gap: 0.2rem;
}

.business-subscription-overview__copy strong,
.business-subscription-overview__billing strong {
  font-size: 1.15rem;
}

.business-subscription-overview__copy span,
.business-subscription-overview__billing span,
.business-subscription-overview__billing small {
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.86rem;
}

.business-subscription-overview__billing {
  min-width: 250px;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.08) 100%);
  text-align: right;
  backdrop-filter: blur(8px);
}

.business-pricing-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.business-pricing-header h2 {
  margin: 0;
  color: #245d3e;
  font-size: 2rem;
  font-weight: 800;
}

.business-pricing-header p {
  margin: 0.35rem 0 0;
  color: #75847d;
  font-size: 0.88rem;
}

.business-pricing-header__action {
  min-height: 42px;
  padding: 0.75rem 1.1rem;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #2f8f5b 0%, #245d3e 100%);
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(47, 143, 91, 0.18);
}

.business-pricing {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(2, minmax(320px, 380px));
  align-items: stretch;
  justify-content: start;
  max-width: none;
  margin: 0;
}

.business-pricing__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-height: 30rem;
  width: 100%;
  max-width: none;
  padding: 0.95rem 1rem 0.9rem;
  border: 1px solid #e8ece9;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(29, 48, 37, 0.04);
  overflow: hidden;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease;
  cursor: pointer;
}

.business-pricing__card::before,
.business-pricing__card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 240ms ease;
}

.business-pricing__card::before {
  inset: auto auto -4.5rem -3.5rem;
  width: 13rem;
  height: 13rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(109, 211, 146, 0.22) 0%, rgba(109, 211, 146, 0.08) 42%, transparent 72%);
  filter: blur(6px);
}

.business-pricing__card::after {
  background: linear-gradient(
    108deg,
    transparent 30%,
    rgba(255, 255, 255, 0.04) 38%,
    rgba(255, 255, 255, 0.55) 45%,
    rgba(255, 255, 255, 0.98) 50%,
    rgba(255, 255, 255, 0.55) 55%,
    rgba(255, 255, 255, 0.04) 62%,
    transparent 70%
  );
  background-size: 220% 100%;
  background-repeat: no-repeat;
  background-position: 140% 0;
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.42));
}

.business-pricing__card:hover {
  transform: translateY(-3px);
  border-color: #b8d8c3;
  background: linear-gradient(180deg, #ffffff 0%, #f4fbf6 100%);
  box-shadow: 0 14px 28px rgba(59, 130, 96, 0.12);
}

.business-pricing__card:hover::before,
.business-pricing__card:hover::after {
  opacity: 1;
}

.business-pricing__card:hover::after {
  animation: business-card-sheen 900ms cubic-bezier(0.22, 1, 0.36, 1) 1;
}

.business-pricing__top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.business-pricing__top h3 {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  line-height: 1.15;
  color: #183524;
}

.business-pricing__subtitle {
  margin: 0.35rem 0 0;
  color: #556a60;
  font-size: 0.9rem;
  line-height: 1.45;
  max-width: 18rem;
}

.business-pricing__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.28rem 0.85rem;
  border-radius: 999px;
  background: #e9f7ee;
  color: #2f7a50;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
}

.business-pricing__features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  margin: auto 0 0;
  padding: 1rem 0 0;
  list-style: none;
  border-top: 1px solid #e8eeea;
  align-content: start;
  align-self: start;
}

.business-pricing__footer {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.35rem;
}

.business-pricing__features li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: #263730;
  font-size: 0.77rem;
  line-height: 1.22;
}

.business-pricing__features i {
  color: #59a879;
  font-size: 0.82rem;
  margin-top: 0.08rem;
}

.business-pricing__cta {
  margin-top: 0;
  min-height: 34px;
  width: 100%;
  border: 1px solid #b7d5c2;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #245d3e;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(29, 48, 37, 0.08);
}

.business-pricing__card:hover .business-pricing__cta {
  border-color: #9fc7ae;
  background: linear-gradient(180deg, #fdfefe 0%, #e7f4eb 100%);
  color: #1f5739;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 1px 3px rgba(29, 48, 37, 0.1);
  transform: none;
}

.business-pricing__cta:active {
  transform: translateY(1px);
  border-color: #8eb79d;
  background: linear-gradient(180deg, #deeee4 0%, #d2e6da 100%);
  color: #1f5739;
  box-shadow:
    inset 0 3px 8px rgba(36, 93, 62, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.business-pricing__cta--ghost {
  border-color: #d7ddd9;
  background: #f1f3f2;
  color: #7a857f;
  cursor: default;
  box-shadow: none;
}

.business-pricing__card:hover .business-pricing__cta--ghost {
  border-color: #d7ddd9;
  background: #f1f3f2;
  color: #7a857f;
  box-shadow: none;
}

.business-pricing__cta--ghost:active {
  transform: none;
  box-shadow: none;
}

.business-pricing__cta--muted {
  color: #9aa59f;
}

.business-pricing__trial-note {
  margin: 0.35rem 0 0;
  color: #5d7868;
  font-size: 0.72rem;
  line-height: 1.3;
  text-align: center;
}

.business-payment {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
  gap: 1rem;
  align-items: start;
}

.business-payment__main,
.business-payment__summary {
  border: 1px solid #e3ebe5;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(29, 48, 37, 0.05);
}

.business-payment__main {
  position: relative;
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.business-payment__loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(245, 250, 247, 0.48);
  backdrop-filter: blur(10px);
}

.business-payment__loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.business-payment__loading-dots span {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #6ed197 0%, #2f8f5b 100%);
  box-shadow: 0 10px 20px rgba(47, 143, 91, 0.18);
  animation: business-loading-dot 0.8s ease-in-out infinite;
}

.business-payment__loading-dots span:nth-child(2) {
  animation-delay: 0.12s;
}

.business-payment__loading-dots span:nth-child(3) {
  animation-delay: 0.24s;
}

.business-payment__steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: 0;
  padding: 0.2rem 0.4rem 0.8rem;
}

.business-payment__step {
  position: relative;
  display: grid;
  justify-items: center;
  text-align: center;
}

.business-payment__step-marker {
  position: relative;
  z-index: 1;
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border: 2px solid #d8e7dd;
  border-radius: 999px;
  background: #edf5f0;
  color: #9ab1a2;
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 6px 14px rgba(29, 48, 37, 0.06);
}

.business-payment__step-marker i {
  font-size: 1rem;
  line-height: 1;
}

.business-payment__step-line {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #d8e7dd;
}

.business-payment__step:last-child .business-payment__step-line {
  display: none;
}

.business-payment__step p {
  margin: 0.65rem 0 0;
  color: #8aa096;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.3;
  max-width: 8rem;
}

.business-payment__step.is-current .business-payment__step-marker {
  border-color: #2f8f5b;
  background: #2f8f5b;
  color: #ffffff;
}

.business-payment__step.is-current p {
  color: #2f8f5b;
}

.business-payment__step.is-done .business-payment__step-marker {
  border-color: #8fcf22;
  background: #8fcf22;
  color: #ffffff;
}

.business-payment__step.is-done p {
  color: #6ea10f;
}

.business-payment__step.is-done .business-payment__step-line {
  background: #b8d78b;
}

.business-payment__panel {
  display: grid;
  gap: 0.9rem;
  padding: 0.2rem 0;
}

.business-payment__panel h3 {
  margin: 0;
  color: #173927;
  font-size: 1.18rem;
}

.business-payment__panel p {
  margin: 0;
  color: #66786f;
  font-size: 0.88rem;
  line-height: 1.5;
}

.business-payment__methods {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.business-payment__form {
  display: grid;
  gap: 0.85rem;
}

.business-payment__field {
  display: grid;
  gap: 0.35rem;
}

.business-payment__field span {
  color: #456252;
  font-size: 0.82rem;
  font-weight: 700;
}

.business-payment__field input {
  min-height: 44px;
  padding: 0.8rem 0.9rem;
  border: 1px solid #dbe5de;
  border-radius: 12px;
  background: #fbfdfb;
  color: #1d3025;
  font: inherit;
}

.business-payment__phone-wrap {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0;
  align-items: start;
}

.business-payment__phone-wrap input {
  width: 100%;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.business-payment__phone-country {
  position: relative;
}

.business-payment__phone-country-trigger {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  min-width: 8.6rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid #dbe5de;
  border-right: 0;
  border-radius: 12px 0 0 12px;
  background: #fbfdfb;
  color: #1d3025;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.business-payment__phone-country-trigger:focus {
  outline: none;
  border-color: #84b998;
  box-shadow: 0 0 0 4px rgba(47, 143, 91, 0.1);
}

.business-payment__phone-country-value {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.business-payment__country-flag {
  font-size: 1rem;
  line-height: 1;
  border-radius: 2px;
  overflow: hidden;
}

.business-payment__phone-country-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 8;
  width: 100%;
  max-height: 15rem;
  overflow-y: auto;
  padding: 0.35rem;
  border: 1px solid #dbe5de;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 16px 32px rgba(24, 53, 36, 0.12);
}

.business-payment__phone-country-option {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #1d3025;
  font: inherit;
  cursor: pointer;
}

.business-payment__phone-country-option:hover,
.business-payment__phone-country-option.is-active {
  background: #eef8f1;
}

.business-payment__phone-country-option.is-active {
  color: #245d3e;
  font-weight: 700;
}

.business-payment__field input:focus {
  outline: none;
  border-color: #84b998;
  box-shadow: 0 0 0 4px rgba(47, 143, 91, 0.1);
}

.business-payment__field input[readonly] {
  background: #f3f6f4;
  color: #6b7c73;
  cursor: not-allowed;
}

.business-payment-country-enter-active,
.business-payment-country-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.business-payment-country-enter-from,
.business-payment-country-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.business-payment__method {
  position: relative;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.85rem;
  min-height: 14rem;
  padding: 1.35rem 1.15rem 1rem;
  border: 1px solid #dce6df;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbf9 100%);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.business-payment__method:hover {
  border-color: #b8d8c3;
  background: linear-gradient(180deg, #ffffff 0%, #f1f8f4 100%);
  box-shadow: 0 10px 24px rgba(29, 48, 37, 0.06);
  transform: translateY(-1px);
}

.business-payment__method-icon {
  width: 5rem;
  height: 5rem;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(135deg, #e9f4ed 0%, #dff0e5 100%);
  color: #2f8f5b;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
}

.business-payment__method--card .business-payment__method-icon {
  background: linear-gradient(135deg, #e7eefc 0%, #dae7fb 100%);
  color: #2256b1;
}

.business-payment__method-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.business-payment__method-copy {
  display: grid;
  justify-items: center;
  gap: 0.42rem;
  max-width: 15rem;
}

.business-payment__method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  background: #edf7f1;
  color: #2f8f5b;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.business-payment__method--card .business-payment__method-badge {
  background: #edf3ff;
  color: #2256b1;
}

.business-payment__method strong {
  display: block;
  color: #173927;
  font-size: 1.08rem;
}

.business-payment__method p {
  margin: 0;
  color: #65766d;
  font-size: 0.86rem;
  line-height: 1.45;
}

.business-payment__method small {
  color: #7c8c84;
  font-size: 0.77rem;
  line-height: 1.35;
}

.business-payment__method.is-selected {
  border-color: #7db691;
  background: linear-gradient(180deg, #f7fcf8 0%, #e9f6ed 100%);
  box-shadow: 0 14px 28px rgba(47, 143, 91, 0.1);
}

.business-payment__method--card.is-selected {
  border-color: #96b8ea;
  background: linear-gradient(180deg, #f8fbff 0%, #ebf2ff 100%);
  box-shadow: 0 14px 28px rgba(34, 86, 177, 0.1);
}

.business-payment__radio {
  position: absolute;
  top: 0.95rem;
  right: 0.95rem;
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid #b6c9bb;
  border-radius: 999px;
  background: #ffffff;
  flex-shrink: 0;
}

.business-payment__method.is-selected .business-payment__radio {
  border-color: #2f8f5b;
  box-shadow: inset 0 0 0 4px #2f8f5b;
}

.business-payment__method--card.is-selected .business-payment__radio {
  border-color: #2256b1;
  box-shadow: inset 0 0 0 4px #2256b1;
}

.business-payment__status-box {
  display: grid;
  gap: 0.3rem;
  padding: 1rem;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #f8fbf9;
}

.business-payment__status-box strong {
  color: #173927;
}

.business-payment__status-box span,
.business-payment__status-box small {
  color: #65766d;
}

.business-payment__status-box--success {
  border-color: #b9d9c4;
  background: #eff8f2;
}

.business-payment__panel--success {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 1.15rem;
  padding-block: 2.5rem;
  padding-inline: 1rem;
  overflow: hidden;
  border: 0;
  border-radius: 28px;
  background:
    radial-gradient(circle at top, rgba(250, 204, 21, 0.3), transparent 32%),
    radial-gradient(circle at 14% 20%, rgba(244, 114, 182, 0.22), transparent 20%),
    radial-gradient(circle at 86% 18%, rgba(56, 189, 248, 0.18), transparent 18%),
    linear-gradient(145deg, #103325 0%, #184b35 54%, #123827 100%);
  box-shadow:
    0 24px 70px rgba(12, 25, 19, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  text-align: center;
}

.business-payment__panel--success h3 {
  margin: 0;
  font-size: clamp(2rem, 3vw, 2.7rem);
  color: #fffdf6;
}

.business-payment__panel--success > p {
  margin: 0;
  max-width: 38rem;
  color: rgba(241, 245, 249, 0.88);
  font-size: 1.02rem;
  line-height: 1.7;
}

.business-payment__success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5.75rem;
  height: 5.75rem;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #7ee2a8 0%, #2f8f5b 72%);
  color: #ffffff;
  box-shadow: 0 20px 45px rgba(47, 143, 91, 0.28);
}

.business-payment__success-icon i {
  font-size: 3rem;
  line-height: 1;
}

.business-payment__panel--success .business-payment__status-box {
  width: min(100%, 42rem);
  justify-items: center;
  gap: 0.55rem;
  padding: 1.35rem 1.5rem;
  border: 0;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.business-payment__panel--success .business-payment__status-box strong {
  font-size: 1.1rem;
  color: #fffdf7;
}

.business-payment__panel--success .business-payment__status-box span,
.business-payment__panel--success .business-payment__status-box small {
  text-align: center;
  color: rgba(241, 245, 249, 0.86);
}

.business-payment__success-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  width: min(100%, 34rem);
}

.business-payment__success-meta-item {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 1.1rem;
  border: 0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.business-payment__success-meta-item span {
  color: rgba(226, 232, 240, 0.76);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.business-payment__success-meta-item strong {
  color: #fffdf7;
  font-size: 0.95rem;
}

.business-payment__test-mode {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  padding: 2rem 1.25rem;
  border: 1px solid #d9e6dd;
  border-radius: 18px;
  background: linear-gradient(180deg, #f7fbf8 0%, #edf6f0 100%);
  text-align: center;
}

.business-payment__test-mode strong {
  color: #173927;
  font-size: 1.1rem;
}

.business-payment__test-mode p {
  margin: 0;
  max-width: 24rem;
  color: #607167;
  line-height: 1.6;
}

.business-payment__test-mode-spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid rgba(47, 143, 91, 0.16);
  border-top-color: #2f8f5b;
  border-radius: 999px;
  animation: business-spin 0.8s linear infinite;
}

.business-payment__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}

.business-payment__actions--center {
  justify-content: center;
}

.business-payment__primary,
.business-payment__secondary {
  min-height: 42px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.business-payment__primary {
  border: 0;
  background: linear-gradient(135deg, #2f8f5b 0%, #245d3e 100%);
  color: #ffffff;
}

.business-payment__secondary {
  border: 1px solid #d7e0da;
  background: #ffffff;
  color: #607167;
}

.business-payment__primary:disabled,
.business-payment__secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes business-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes business-guide-tag-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 10px 18px rgba(220, 38, 38, 0.22);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 16px 30px rgba(220, 38, 38, 0.3);
  }
}

@keyframes business-guide-hero-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow:
      0 18px 40px rgba(245, 158, 11, 0.28),
      0 0 0 10px rgba(255, 255, 255, 0.06);
  }

  50% {
    transform: scale(1.04);
    box-shadow:
      0 22px 48px rgba(245, 158, 11, 0.34),
      0 0 0 16px rgba(255, 255, 255, 0.08);
  }
}

@keyframes business-guide-confetti-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(10px) rotate(14deg);
  }
}

@keyframes business-guide-aura-pulse {
  0%,
  100% {
    opacity: 0.72;
    transform: translateX(-50%) scale(0.96);
  }

  50% {
    opacity: 1;
    transform: translateX(-50%) scale(1.08);
  }
}

@keyframes business-guide-spark-spin {
  0% {
    transform: rotate(0deg) scale(0.96);
  }

  50% {
    transform: rotate(180deg) scale(1.04);
  }

  100% {
    transform: rotate(360deg) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .business-sidebar__link.business-guide-target .business-sidebar__new-tag {
    animation: none;
  }

  .business-guide__hero,
  .business-guide__confetti,
  .business-guide__aura,
  .business-guide__spark {
    animation: none;
  }
}

.business-history {
  padding: 0.5rem 0 0;
}

.business-history__table-wrap {
  overflow-x: auto;
  border: 1px solid #e6ece8;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 18px 34px rgba(32, 68, 48, 0.08);
}

.business-history__table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.business-history__table th,
.business-history__table td {
  padding: 1.15rem 1.2rem;
  border-bottom: 1px solid #eef3f0;
  text-align: left;
}

.business-history__table th {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7b6795;
  background: linear-gradient(180deg, #fff9ff 0%, #fffefe 100%);
}

.business-history__table tbody tr:last-child td {
  border-bottom: 0;
}

.business-history__table td {
  color: #42584b;
  font-size: 0.92rem;
}

.business-history__table td strong {
  color: #173927;
}

.business-history__amount {
  color: #9a45b7;
  font-weight: 800;
}

.business-history__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.42rem 0.78rem;
  border-radius: 999px;
  border: 1px solid #e3ebe6;
  background: #f8fbf9;
  color: #50655a;
  font-weight: 700;
}

.business-history__status {
  display: inline-flex;
  align-items: center;
  padding: 0.42rem 0.78rem;
  border-radius: 999px;
  background: #eaf8f0;
  color: #2f8f5b;
  font-weight: 800;
}

.business-history__date {
  display: grid;
  gap: 0.18rem;
}

.business-history__date span {
  color: #5f8f78;
  font-size: 0.8rem;
  font-weight: 700;
}

.business-history__receipt {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  color: #9a45b7;
  font-weight: 800;
  cursor: pointer;
}

.business-history__empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  border: 1px dashed #d8e6dd;
  border-radius: 24px;
  background: linear-gradient(180deg, #fbfefc 0%, #f4faf6 100%);
  text-align: center;
}

.business-history__empty i {
  font-size: 2.2rem;
  color: #7ca58a;
}

.business-history__empty strong {
  color: #173927;
  font-size: 1.08rem;
}

.business-history__empty p {
  margin: 0;
  max-width: 28rem;
  color: #607167;
  line-height: 1.6;
}

.business-payment__summary {
  display: grid;
  gap: 0.9rem;
  padding: 1.1rem;
}

.business-payment__summary h3 {
  margin: 0;
  color: #173927;
  font-size: 1.05rem;
}

.business-payment__summary-note {
  margin: -0.2rem 0 0;
  color: #6a7b72;
  font-size: 0.8rem;
  line-height: 1.45;
}

.business-payment__receipt {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid #e8eeea;
  border-radius: 14px;
  background: #f8fbf9;
}

.business-payment__receipt-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #6f8077;
  font-size: 0.8rem;
}

.business-payment__receipt-row strong {
  color: #173927;
  font-size: 0.82rem;
}

.business-payment__item {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
  padding: 0.95rem 0;
  border-top: 1px solid #edf2ee;
  border-bottom: 1px solid #edf2ee;
}

.business-payment__item-thumb {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #eaf7ef 0%, #dcefe3 100%);
  color: #2a7a50;
  font-size: 1.1rem;
  font-weight: 800;
}

.business-payment__item-copy strong {
  display: block;
  color: #173927;
  font-size: 0.92rem;
  line-height: 1.35;
}

.business-payment__item-copy span,
.business-payment__item-copy small {
  display: block;
  margin-top: 0.25rem;
  color: #6d7f75;
  font-size: 0.78rem;
  line-height: 1.4;
}

.business-payment__summary-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #edf2ee;
  color: #677970;
  font-size: 0.88rem;
}

.business-payment__summary-row strong {
  color: #173927;
}

.business-payment__summary-row--total {
  padding-top: 0.3rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.business-payment__summary-row--total strong {
  font-size: 1.4rem;
  line-height: 1;
}

.business-payment__submit {
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #2f8f5b 0%, #245d3e 100%);
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.business-modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.35);
  will-change: opacity;
}

.business-modal__card {
  width: min(100%, 28rem);
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem;
  border: 1px solid #d7dfd9;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.16);
  transform-origin: center;
  will-change: transform, opacity;
}

.business-modal__copy h2 {
  margin: 0;
  color: #163726;
  font-size: 1.2rem;
  font-weight: 800;
}

.business-modal__copy p {
  margin: 0.35rem 0 0;
  color: #607268;
  font-size: 0.9rem;
  line-height: 1.5;
}

.business-modal__note {
  color: #73837b;
  font-size: 0.8rem;
}

.business-help-modal {
  width: min(100%, 34rem);
}

.business-help-modal__grid {
  display: grid;
  gap: 0.8rem;
  margin-top: 0.2rem;
}

.business-help-modal__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
  padding: 0.95rem 1rem;
  border: 1px solid #dfe9e2;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fcf9 0%, #f2f8f4 100%);
}

.business-help-modal__item i {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  background: rgba(31, 116, 72, 0.12);
  color: #1f7448;
  font-size: 1rem;
}

.business-help-modal__item strong {
  display: block;
  margin-bottom: 0.2rem;
  color: #173927;
  font-size: 0.95rem;
}

.business-help-modal__item span {
  display: block;
  color: #607167;
  font-size: 0.88rem;
  line-height: 1.5;
}

.business-loading-screen {
  position: absolute;
  inset: 0;
  z-index: 45;
  display: grid;
  place-items: center;
  background: rgba(243, 249, 245, 0.36);
  backdrop-filter: blur(12px);
}

.business-loading-screen__content {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
}

.business-loading-screen__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.business-loading-screen__dots span {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #6ed197 0%, #2f8f5b 100%);
  box-shadow: 0 10px 20px rgba(47, 143, 91, 0.18);
  animation: business-loading-dot 0.8s ease-in-out infinite;
}

.business-loading-screen__dots span:nth-child(2) {
  animation-delay: 0.12s;
}

.business-loading-screen__dots span:nth-child(3) {
  animation-delay: 0.24s;
}

.business-loading-screen__content p {
  margin: 0;
  color: #245d3e;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.business-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.business-modal__button {
  min-height: 40px;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
}

.business-modal__button--secondary {
  border: 1px solid #d6ddd8;
  background: #ffffff;
  color: #5f7168;
}

.business-modal__button--primary {
  border: 1px solid #2e7d53;
  background: #2f8f5b;
  color: #ffffff;
  box-shadow: none;
}

.business-modal__button:hover {
  transform: translateY(-1px);
}

.business-trial-modal-enter-active,
.business-trial-modal-leave-active {
  transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.business-trial-modal-enter-from,
.business-trial-modal-leave-to {
  opacity: 0;
}

.business-trial-modal-enter-from .business-modal__card,
.business-trial-modal-leave-to .business-modal__card {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.business-trial-modal-enter-active .business-modal__card,
.business-trial-modal-leave-active .business-modal__card {
  transition:
    opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes business-card-sheen {
  0% {
    background-position: 140% 0;
  }

  100% {
    background-position: -120% 0;
  }
}

@keyframes business-loading-dot {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  50% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

.business-payment-enter-active,
.business-payment-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.business-payment-enter-from,
.business-payment-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.99);
}

.business-summary__card,
.business-results__card {
  padding: 1.2rem;
  border: 1px solid #dce7df;
  border-radius: 20px;
  background: #ffffff;
}

.business-results__card p {
  margin: 0.65rem 0 0;
  color: #617267;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .business-workspace {
    grid-template-columns: 1fr;
  }

  .business-dashboard-analytics__hero,
  .business-dashboard-analytics__donut-wrap {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .business-dashboard-analytics__progress,
  .business-dashboard-analytics__grid {
    grid-template-columns: 1fr;
  }

  .business-dashboard-analytics__panel--trend {
    grid-row: auto;
  }

  .business-sidebar {
    position: static;
    top: auto;
    height: auto;
    grid-template-columns: 1fr;
    border-right: 0;
    border-bottom: 1px solid #d9e4dc;
    overflow: visible;
  }

  .business-sidebar__rail {
    display: none;
  }

  .business-summary,
  .business-results,
  .business-interview-scheduling__layout,
  .business-dashboard-analytics__progress,
  .business-dashboard-analytics__grid,
  .business-pricing,
  .business-applicants__highlights,
  .business-applicants__grid,
  .business-permissions__layout,
  .business-template-builder,
  .business-job-post__shell,
  .business-job-post__highlights,
  .business-job-post__grid--two,
  .business-job-post__grid--three,
  .business-job-post__preview-meta,
  .business-job-post__preview-grid,
  .business-job-post__preview-summary {
    grid-template-columns: 1fr;
  }

  .business-profile__grid,
  .business-profile__form,
  .business-user-management__grid--two {
    grid-template-columns: 1fr;
  }

  .business-profile__avatar-section {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .business-profile__avatar-actions {
    justify-content: flex-start;
  }

  .business-payment {
    grid-template-columns: 1fr;
  }

  .business-payment__methods {
    grid-template-columns: 1fr;
  }

  .business-template-builder__toolbar {
    grid-template-columns: 1fr;
  }

  .business-assessment-builder__bar,
  .business-assessment-builder__toolbar {
    grid-template-columns: 1fr;
    display: grid;
  }

  .business-template-builder__toolbar-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .business-template-builder__field-grid,
  .business-interview-scheduling__form-grid,
  .business-template-preview__details {
    grid-template-columns: 1fr;
  }

  .business-interview-scheduling__header,
  .business-assign-templates__header {
    flex-direction: column;
    align-items: stretch;
  }

  .business-template-builder__select-wrap {
    min-width: 0;
  }

  .business-job-post__live-preview {
    position: static;
  }

  .business-payment__steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 1rem;
  }

  .business-pricing__card {
    min-height: auto;
  }

  .business-pricing__features {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .business-toast {
    top: 50%;
    left: 50%;
    width: min(calc(100vw - 1.5rem), 32rem);
    grid-template-columns: auto minmax(0, 1fr);
  }

  .business-toast__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    flex-wrap: wrap;
    padding-left: 3.2rem;
  }

  .business-subscription-overview,
  .business-pricing-header,
  .business-navbar,
  .business-applicants__lead,
  .business-interview-scheduling__header-actions,
  .business-interview-scheduling__calendar-head,
  .business-hero,
  .business-template-builder__hero,
  .business-job-post__lead,
  .business-user-management__lead,
  .business-permissions__hero,
  .business-profile__header,
  .business-profile__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .business-content {
    padding: 1rem;
  }

  .business-interview-scheduling__actions,
  .business-template-builder__hero-actions,
  .business-template-builder__option-actions,
  .business-assessment-builder__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .business-assessment-management__tabs,
  .business-assign-templates__tabs {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }

  .business-template-builder__option-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .business-template-builder__option-remove {
    grid-column: 2;
  }

  .business-payment__actions {
    flex-direction: column;
  }

  .business-guide__actions {
    flex-direction: column;
  }

  .business-job-post__panel-head,
  .business-job-post__posted-top,
  .business-job-post__preview-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .business-job-post__preview-main {
    grid-template-columns: 1fr;
  }

  .business-permissions__inline-action {
    flex-direction: column;
    align-items: stretch;
  }

  .business-permissions__panel-head,
  .business-permissions__hero-stats,
  .business-permissions__panel-tools,
  .business-permissions__menu-section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .business-permissions__panel-actions,
  .business-permissions__mode-button {
    width: 100%;
  }

  .business-permissions__control-grid,
  .business-permissions__menu-actions {
    grid-template-columns: 1fr;
  }

  .business-permissions__inline-action--compact .business-permissions__action-save,
  .business-permissions__inline-action--compact .business-permissions__action-delete,
  .business-permissions__inline-action--compact .business-permissions__inline-button {
    width: 100%;
  }

  .business-permissions__menu {
    width: 100%;
  }

  .business-permissions__menu-panel {
    left: 0;
    right: 0;
    width: 100%;
  }

  .business-user-management__lead-meta,
  .business-user-management__inline-meta,
  .business-user-management__actions {
    justify-content: flex-start;
  }

  .business-job-post__posted-row {
    grid-template-columns: 1fr;
  }

  .business-job-post__posted-metric,
  .business-job-post__posted-side {
    min-width: 0;
  }

  .business-job-post__posted-actions {
    justify-self: start;
  }

  .business-job-post__menu-panel {
    left: 0;
    right: auto;
    width: min(14rem, calc(100vw - 3rem));
  }

  .business-payment__panel--success {
    padding-inline: 0.85rem;
  }

  .business-payment__success-meta {
    grid-template-columns: 1fr;
  }

  .business-template-builder__question-top,
  .business-template-preview__topbar,
  .business-template-preview__question-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
