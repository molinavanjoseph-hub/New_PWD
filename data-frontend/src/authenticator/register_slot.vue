<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Tesseract from 'tesseract.js'
import FaceVerify from '@/authenticator/Face_Recognition/Face_Verify.vue'
import mathLogo from '@/assets/math.png'
import { sendRegistrationOtp } from '@/lib/email_otp'
import { saveEmployerPendingRegistrationDraft } from '@/lib/employer_registration_draft'
import 'flag-icons/css/flag-icons.min.css'

const APPLICANT_REGISTRATION_DRAFT_KEY = 'applicantRegistrationDraft'
const APPLICANT_REGISTRATION_DRAFT_FILE_DB = 'applicantRegistrationDraftFiles'
const APPLICANT_REGISTRATION_DRAFT_FILE_STORE = 'files'

const router = useRouter()
const route = useRoute()

const APPLICANT_DEFAULT_PROVINCE = 'Cavite'
const APPLICANT_DEFAULT_CITY = 'Dasmarinas City'
const MAX_PROFILE_IMAGE_BYTES = 4_000_000
const MAX_RESUME_FILE_BYTES = 5_000_000
const MAX_PWD_ID_FILE_BYTES = 5_000_000
const MAX_EMPLOYER_VERIFICATION_FILE_BYTES = 10_000_000
const MAX_NAME_LENGTH = 30
const MAX_PASSWORD_LENGTH = 16
const EMPLOYER_TYPE_TRANSITION_DELAY_MS = 720
const DASMA_BARANGAYS = ['Burol', 'Burol I', 'Burol II', 'Burol III', 'Fatima I', 'Fatima II', 'Fatima III', 'Langkaan I', 'Langkaan II', 'Paliparan I', 'Paliparan II', 'Paliparan III', 'Salawag', 'Salitran I', 'Salitran II', 'Salitran III', 'Salitran IV', 'Sampaloc I', 'Sampaloc II', 'Sampaloc III', 'Sampaloc IV', 'Sampaloc V', 'San Agustin I', 'San Agustin II', 'San Andres I', 'San Andres II', 'San Antonio De Padua I', 'San Antonio De Padua II', 'San Francisco I', 'San Francisco II', 'San Isidro Labrador I', 'San Isidro Labrador II', 'San Jose', 'San Juan I', 'San Juan II', 'San Miguel', 'San Roque', 'Santa Fe', 'Santa Lucia', 'Santa Maria', 'Santo Cristo', 'Zone I', 'Zone I-A', 'Zone II', 'Zone III', 'Zone IV']
const PWD_DISABILITY_TYPES = ['Deaf or Hard of Hearing', 'Visual Disability', 'Physical Disability', 'Psychosocial Disability', 'Intellectual Disability', 'Learning Disability', 'Speech and Language Impairment', 'Autism Spectrum Disorder', 'Chronic Illness', 'Multiple Disabilities']
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
const applicantRegistrationSteps = [
  {
    id: 'personal',
    number: '1',
    icon: 'bi bi-person-vcard',
    title: 'Personal Details',
    description: 'Basic personal and address information.',
  },
  {
    id: 'verification',
    number: '2',
    isVirtual: true,
    icon: 'bi bi-camera-video',
    title: 'Face Verification',
    description: 'Complete your live face scan before continuing.',
  },
  {
    id: 'pwd',
    number: '3',
    icon: 'bi bi-person-badge',
    title: 'PWD ID Verification',
    description: 'PWD ID, contact details, and supporting files.',
  },
  {
    id: 'account',
    number: '4',
    icon: 'bi bi-shield-lock',
    title: 'Account Setup',
    description: 'Email, password, and final confirmation.',
  },
]
const applicantStepHeaderMap = {
  1: {
    title: 'Step 1: Personal Details',
    description: 'Provide your basic personal and address information.',
  },
  2: {
    title: 'Step 3: PWD ID Verification',
    description: 'Add your PWD ID, contact details, and supporting files.',
  },
  3: {
    title: 'Step 4: Account Setup',
    description: 'Set your email, password, and complete your registration.',
  },
}

const selectedRole = ref('')
const isReady = ref(false)
const isNavigating = ref(false)
const applicantStep = ref(1)
const isInlineClientVerificationActive = ref(false)
const stepTransitionLoading = ref(false)
const stepTransitionStatus = ref('')
const isEmployerTypeTransitioning = ref(false)
const draftSaveStatus = ref('')
const loading = ref(false)
const waitingApproval = ref(false)
const toast = ref(null)
const toastClosing = ref(false)
const applicantVerificationPanelRef = ref(null)
const isLeaveConfirmOpen = ref(false)
const isApplicantImageModalOpen = ref(false)
const imageModalSource = ref('')
const imageModalTitle = ref('Uploaded image preview')
const imageModalShouldRevoke = ref(false)
const isClientVerificationModalOpen = ref(false)
const applicantImageError = ref('')
const applicantResumeFile = ref(null)
const applicantResumeError = ref('')
const applicantPwdIdFrontFile = ref(null)
const applicantPwdIdFrontError = ref('')
const applicantPwdIdBackFile = ref(null)
const applicantPwdIdBackError = ref('')
const applicantPwdIdFrontOcrText = ref('')
const applicantPwdIdBackOcrText = ref('')
const applicantPwdIdOcrStatus = ref('idle')
const applicantPwdIdOcrMessage = ref('')
const applicantPwdIdOcrExtractedNumber = ref('')
const lastPwdIdOcrToastKey = ref('')
const isClientVerificationComplete = ref(false)
const isDisabilityDropdownOpen = ref(false)
const isDisabilityDropdownClosing = ref(false)
const disabilityDropdownRef = ref(null)
const isBarangayDropdownOpen = ref(false)
const isBarangayDropdownClosing = ref(false)
const barangayDropdownRef = ref(null)
const isSexDropdownOpen = ref(false)
const isSexDropdownClosing = ref(false)
const sexDropdownRef = ref(null)
const isLanguageDropdownOpen = ref(false)
const isLanguageDropdownClosing = ref(false)
const languageDropdownRef = ref(null)
const isEmployerOrganizationTypeDropdownOpen = ref(false)
const isEmployerOrganizationTypeDropdownClosing = ref(false)
const employerOrganizationTypeDropdownRef = ref(null)
const isEmployerBarangayDropdownOpen = ref(false)
const isEmployerBarangayDropdownClosing = ref(false)
const employerBarangayDropdownRef = ref(null)
const isEmployerCategoryDropdownOpen = ref(false)
const isEmployerCategoryDropdownClosing = ref(false)
const employerCategoryDropdownRef = ref(null)
const isContactCountryDropdownOpen = ref(false)
const isContactCountryDropdownClosing = ref(false)
const contactCountryDropdownRef = ref(null)
const isEmployerContactCountryDropdownOpen = ref(false)
const isEmployerContactCountryDropdownClosing = ref(false)
const employerContactCountryDropdownRef = ref(null)
const isBirthDatePickerOpen = ref(false)
const isBirthDatePickerClosing = ref(false)
const birthDatePickerRef = ref(null)
const birthDateCalendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const isBirthMonthMenuOpen = ref(false)
const isBirthYearMenuOpen = ref(false)

const email = ref('')
const disabilityType = ref('')
const firstName = ref('')
const lastName = ref('')
const sex = ref('')
const birthDate = ref('')
const birthDateInput = ref('')
const addressProvince = ref(APPLICANT_DEFAULT_PROVINCE)
const addressCity = ref(APPLICANT_DEFAULT_CITY)
const addressBarangay = ref('')
const contactNumber = ref('')
const contactCountryCode = ref('PH')
const contactCountrySearch = ref('')
const preferredLanguage = ref('')
const applicantProfileImage = ref(null)
const applicantProfileImagePreview = ref('')
const password = ref('')
const confirmPassword = ref('')
const agreedToTerms = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const applicantFieldErrors = ref({})
const employerStep = ref(1)
const companyOrganizationType = ref('')
const pendingEmployerOrganizationType = ref('')
const companyName = ref('')
const employerStreetAddress = ref('')
const employerBarangay = ref('')
const companyLocation = ref('')
const companyContactNumber = ref('')
const employerContactCountryCode = ref('PH')
const employerContactCountrySearch = ref('')
const companyCategory = ref('')
const companyVerificationDocumentFiles = ref([null, null, null])
const companyVerificationDocumentErrors = ref(['', '', ''])
const companyVerificationDocumentPreviews = ref(['', '', ''])
const companyVerificationDocumentStatuses = ref(['idle', 'idle', 'idle'])
const companyVerificationDocumentStatusTimers = [null, null, null]
const normalizeEmployerAddress = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const isDasmarinasCaviteAddress = (value) => {
  const normalizedAddress = normalizeEmployerAddress(value.trim())
  if (!normalizedAddress) return false

  return normalizedAddress.includes('dasmarinas') && normalizedAddress.includes('cavite')
}
const companyVerificationCertified = ref(false)
let timerId
let stepStatusTimerId
let draftSaveTimerId
let notifyTimerId
let contactCountrySearchTimerId
let employerContactCountrySearchTimerId

const isEmployerRegistration = computed(() => selectedRole.value === 'employer')
const isApplicantRegistration = computed(() => selectedRole.value === 'applicant')
const roleLabel = computed(() => (isEmployerRegistration.value ? 'system admin' : selectedRole.value || 'applicant'))
const registerPageTitle = computed(() =>
  isEmployerRegistration.value ? 'PWD | Register Business' : 'PWD | Register Applicant',
)
const selectedPhoneCountry = computed(() => PHONE_COUNTRIES.find((country) => country.code === contactCountryCode.value) || PHONE_COUNTRIES[0])
const filteredPhoneCountries = computed(() => {
  const query = contactCountrySearch.value.trim().toLowerCase()
  if (!query) return PHONE_COUNTRIES

  return PHONE_COUNTRIES.filter((country) =>
    `${country.name} ${country.code} ${country.dial}`.toLowerCase().includes(query),
  )
})
const selectedEmployerPhoneCountry = computed(() => PHONE_COUNTRIES.find((country) => country.code === employerContactCountryCode.value) || PHONE_COUNTRIES[0])
const filteredEmployerPhoneCountries = computed(() => {
  const query = employerContactCountrySearch.value.trim().toLowerCase()
  if (!query) return PHONE_COUNTRIES

  return PHONE_COUNTRIES.filter((country) =>
    `${country.name} ${country.code} ${country.dial}`.toLowerCase().includes(query),
  )
})
const applicantStepHeader = computed(() => {
  if (applicantStep.value === 1 && isInlineClientVerificationActive.value) {
    return {
      title: 'Step 2: Face Verification',
      description: 'Please turn on your device camera. The face scan will start automatically.',
    }
  }

  return applicantStepHeaderMap[applicantStep.value] || applicantStepHeaderMap[1]
})
const actionStatus = computed(() => stepTransitionStatus.value || draftSaveStatus.value)
const selectedDisabilityLabel = computed(() =>
  disabilityType.value.trim() || 'Select PWD Category',
)
const selectedBarangayLabel = computed(() =>
  addressBarangay.value.trim() || 'Select barangay',
)
const selectedSexLabel = computed(() => {
  if (sex.value === 'male') return 'Male'
  if (sex.value === 'female') return 'Female'
  if (sex.value === 'prefer_not_say') return 'Prefer not to say'
  return 'Select gender'
})
const selectedLanguageLabel = computed(() =>
  preferredLanguage.value.trim() || 'Select language',
)
const selectedEmployerOrganizationTypeLabel = computed(() =>
  companyOrganizationType.value.trim() || 'Select business',
)
const selectedEmployerOrganizationTypeValue = computed(() => companyOrganizationType.value.trim())
const isEmployerOrganizationTypeSelected = computed(() => Boolean(selectedEmployerOrganizationTypeValue.value))
const normalizedEmployerOrganizationType = computed(() =>
  selectedEmployerOrganizationTypeValue.value.toLowerCase(),
)
const isBusinessOrganizationSelected = computed(() =>
  normalizedEmployerOrganizationType.value === 'business',
)
const employerOrganizationNoun = computed(() => 'business')
const employerOrganizationTitle = computed(() => 'Business')
const employerInformationTitle = computed(() => 'Business Information')
const employerOrganizationNameLabel = computed(() => `${employerOrganizationTitle.value} Name`)
const employerOrganizationNamePlaceholder = computed(() =>
  `Enter registered ${employerOrganizationNoun.value} name`,
)
const employerOrganizationAddressLabel = computed(() => `${employerOrganizationTitle.value} Street Address`)
const employerOrganizationAddressPlaceholder = computed(() =>
  `Enter street / building / unit`,
)
const selectedEmployerBarangayLabel = computed(() =>
  employerBarangay.value.trim() || 'Select barangay',
)
const employerOrganizationContactPlaceholder = computed(() =>
  `${employerOrganizationTitle.value} Contact Number`,
)
const selectedEmployerCategoryLabel = computed(() =>
  companyCategory.value.trim() || 'Select industry',
)
const employerRegistrationSteps = computed(() => [
  {
    id: 'business',
    number: '1',
    icon: 'bi bi-shop-window',
    title: employerInformationTitle.value,
    description: `Add the basic ${employerOrganizationNoun.value} details for your employer account.`,
  },
  {
    id: 'verification',
    number: '2',
    icon: 'bi bi-file-earmark-check',
    title: 'Verification Documents',
    description: `Upload the supporting document that proves your ${employerOrganizationNoun.value} is legitimate and authorized to register.`,
  },
  {
    id: 'account',
    number: '3',
    icon: 'bi bi-shield-lock',
    title: 'Account Setup',
    description: 'Set your email, password, and finish registration.',
  },
])
const employerStepHeaderMap = computed(() => ({
  1: {
    title: `Step 1: ${employerInformationTitle.value}`,
    description: `Add your ${employerOrganizationNoun.value} name, street address, barangay, and industry before continuing.`,
  },
  2: {
    title: 'Step 2: Verification Documents',
    description: `Upload the supporting document for your ${employerOrganizationNoun.value} and certify that the submission is legitimate.`,
  },
  3: {
    title: 'Step 3: Account Setup',
    description: `Add your ${employerOrganizationNoun.value} account email and password to complete employer registration.`,
  },
}))
const employerStepTitle = computed(() => employerStepHeaderMap.value[employerStep.value]?.title || employerStepHeaderMap.value[1].title)
const employerStepDescription = computed(() => {
  if (employerStep.value === 1) {
    return `Add your ${employerOrganizationNoun.value} name, street address, barangay, and industry before continuing.`
  }

  if (employerStep.value === 2) {
    return `Upload the supporting document for your ${employerOrganizationNoun.value} and certify that the submission is legitimate.`
  }

  return employerStepHeaderMap.value[3].description
})
const employerScreenTitle = computed(() => {
  if (isEmployerTypeTransitioning.value) return ''
  return employerStepTitle.value
})
const employerScreenDescription = computed(() => {
  if (isEmployerTypeTransitioning.value) return ''
  return employerStepDescription.value
})
const shouldAnimateRegisterCopy = computed(() =>
  isApplicantRegistration.value || isEmployerRegistration.value,
)
const employerPanelTransitionKey = computed(() => {
  if (isEmployerTypeTransitioning.value) return 'employer-type-loading'
  return `employer-step-${employerStep.value}`
})
const sexOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_say', label: 'Prefer not to say' },
]
const languageOptions = [
  'Filipino',
  'English',
  'Filipino & English',
  'Bisaya/Cebuano',
  'Ilocano',
  'Other',
]
const employerVerificationDocumentLabels = [
  'Mayor Permit',
  'Barangay Certificate',
  'BIR',
]
const employerVerificationDocumentPreviewKinds = computed(() =>
  companyVerificationDocumentFiles.value.map((file) => {
    if (!file) return 'empty'
    return file.type?.startsWith('image/') ? 'image' : 'document'
  }),
)
const employerCategoryOptions = [
  'Information Technology (IT) / Software Development',
  'Business Process Outsourcing (BPO) / Customer Support',
  'Retail / Sales / Merchandising',
  'Wholesale / Distribution',
  'Manufacturing / Production',
  'Construction / Engineering / Infrastructure',
  'Logistics / Transportation / Supply Chain',
  'Automotive / Vehicle Services',
  'Banking / Finance / Accounting',
  'Insurance',
  'Marketing / Advertising / Public Relations',
  'Human Resources / Recruitment / Consulting',
  'Legal Services',
  'Healthcare / Medical / Clinics / Hospitals',
  'Pharmaceuticals / Biotechnology',
  'Education / Training / Academic Institutions',
  'Government / Public Sector',
  'Non-Government Organization (NGO) / Social Services',
  'Hospitality / Hotels / Restaurants',
  'Tourism / Travel Services',
  'Food & Beverage Production / Services',
  'Real Estate / Property Management',
  'Media / Entertainment / Broadcasting',
  'Creative / Design / Multimedia',
  'E-commerce / Online Business',
  'Telecommunications / Networking',
  'Energy / Power / Utilities',
  'Agriculture / Farming / Agribusiness',
  'Fisheries / Aquaculture',
  'Mining / Natural Resources',
  'Security / Safety Services',
  'Cleaning / Maintenance / Facilities Services',
  'Personal Services (Salon, Spa, etc.)',
  'Printing / Publishing',
  'Research / Development / Science',
]
const birthDateWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const getCountryFlagClass = (countryCode) => `fi fi-${String(countryCode || '').toLowerCase()}`

const resetContactCountrySearch = () => {
  if (contactCountrySearchTimerId) {
    window.clearTimeout(contactCountrySearchTimerId)
    contactCountrySearchTimerId = null
  }
  contactCountrySearch.value = ''
}

const resetEmployerContactCountrySearch = () => {
  if (employerContactCountrySearchTimerId) {
    window.clearTimeout(employerContactCountrySearchTimerId)
    employerContactCountrySearchTimerId = null
  }
  employerContactCountrySearch.value = ''
}

const queueContactCountrySearchReset = () => {
  if (contactCountrySearchTimerId) window.clearTimeout(contactCountrySearchTimerId)
  contactCountrySearchTimerId = window.setTimeout(() => {
    contactCountrySearch.value = ''
    contactCountrySearchTimerId = null
  }, 700)
}

const queueEmployerContactCountrySearchReset = () => {
  if (employerContactCountrySearchTimerId) window.clearTimeout(employerContactCountrySearchTimerId)
  employerContactCountrySearchTimerId = window.setTimeout(() => {
    employerContactCountrySearch.value = ''
    employerContactCountrySearchTimerId = null
  }, 700)
}

const handleContactCountryTypeahead = (event) => {
  const key = String(event?.key || '')

  if (key === 'Backspace') {
    event.preventDefault()
    contactCountrySearch.value = contactCountrySearch.value.slice(0, -1)
    queueContactCountrySearchReset()
    return
  }

  if (key === 'Enter' && filteredPhoneCountries.value.length === 1) {
    event.preventDefault()
    selectContactCountryOption(filteredPhoneCountries.value[0].code)
    return
  }

  if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return

  event.preventDefault()
  contactCountrySearch.value = `${contactCountrySearch.value}${key}`.slice(0, 20)
  queueContactCountrySearchReset()
}

const handleEmployerContactCountryTypeahead = (event) => {
  const key = String(event?.key || '')

  if (key === 'Backspace') {
    event.preventDefault()
    employerContactCountrySearch.value = employerContactCountrySearch.value.slice(0, -1)
    queueEmployerContactCountrySearchReset()
    return
  }

  if (key === 'Enter' && filteredEmployerPhoneCountries.value.length === 1) {
    event.preventDefault()
    selectEmployerContactCountryOption(filteredEmployerPhoneCountries.value[0].code)
    return
  }

  if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return

  event.preventDefault()
  employerContactCountrySearch.value = `${employerContactCountrySearch.value}${key}`.slice(0, 20)
  queueEmployerContactCountrySearchReset()
}

const formatDateIso = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseIsoDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const todayDate = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const birthDateDisplay = computed(() => {
  const parsed = parseIsoDate(birthDate.value)
  if (!parsed) return 'mm/dd/yyyy'
  return parsed.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
})

const sanitizeBirthDateDigits = (value) => {
  const rawDigits = String(value || '').replace(/[^\d]/g, '').slice(0, 8)
  const currentYearText = String(todayDate().getFullYear())
  let digits = ''

  for (const nextDigit of rawDigits) {
    const nextValue = `${digits}${nextDigit}`
    const length = nextValue.length

    if (length === 1) {
      if (!/[01]/.test(nextValue)) continue
    } else if (length === 2) {
      const month = Number(nextValue)
      if (month < 1 || month > 12) continue
    } else if (length === 3) {
      if (!/[0-3]/.test(nextDigit)) continue
    } else if (length === 4) {
      const day = Number(nextValue.slice(2, 4))
      if (day < 1 || day > 31) continue
    } else {
      const yearText = nextValue.slice(4)
      const currentPrefix = currentYearText.slice(0, yearText.length)
      if (Number(yearText) > Number(currentPrefix)) continue
    }

    digits = nextValue
  }

  return digits
}

const formatBirthDateText = (value) => {
  const digits = sanitizeBirthDateDigits(value)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const parseDisplayDateToIso = (value) => {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, monthText, dayText, yearText] = match
  const month = Number(monthText)
  const day = Number(dayText)
  const year = Number(yearText)
  if (!month || !day || !year) return ''
  const parsed = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getTime() > todayDate().getTime()
  ) {
    return ''
  }
  return formatDateIso(parsed)
}

const birthDateCalendarLabel = computed(() =>
  birthDateCalendarMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  }),
)
const birthDateMonthLabel = computed(() =>
  birthDateCalendarMonth.value.toLocaleDateString('en-US', {
    month: 'long',
  }),
)
const birthDateYearLabel = computed(() => String(birthDateCalendarMonth.value.getFullYear()))
const birthDateMonthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const birthDateYearOptions = computed(() => {
  const currentYear = todayDate().getFullYear()
  return Array.from({ length: 100 }, (_, index) => currentYear - index)
})

const birthDateCalendarDays = computed(() => {
  const monthStart = new Date(
    birthDateCalendarMonth.value.getFullYear(),
    birthDateCalendarMonth.value.getMonth(),
    1,
  )
  const startOffset = monthStart.getDay()
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - startOffset)
  const selectedIso = birthDate.value
  const today = todayDate().getTime()

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart)
    cellDate.setDate(gridStart.getDate() + index)
    const iso = formatDateIso(cellDate)
    const time = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime()
    return {
      iso,
      label: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === birthDateCalendarMonth.value.getMonth(),
      isSelected: selectedIso === iso,
      isToday: time === today,
      isFuture: time > today,
    }
  })
})

const canGoNextBirthMonth = computed(() => {
  const today = todayDate()
  return (
    birthDateCalendarMonth.value.getFullYear() < today.getFullYear() ||
    birthDateCalendarMonth.value.getMonth() < today.getMonth()
  )
})

const computedAge = computed(() => {
  if (!birthDate.value) return ''
  const dob = new Date(birthDate.value)
  if (Number.isNaN(dob.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  const dayDiff = today.getDate() - dob.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1
  return age < 0 ? '' : String(age)
})

const passwordChecks = computed(() => ({
  lower: /[a-z]/.test(password.value),
  upper: /[A-Z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value),
}))

const hasPasswordValue = computed(() => password.value.length > 0)
const hasPasswordValidationError = computed(() =>
  hasApplicantFieldError('password') || hasApplicantFieldError('confirmPassword'),
)
const shouldShowPasswordRuleFeedback = computed(() =>
  hasPasswordValue.value || hasPasswordValidationError.value,
)
const meetsPasswordCharacterRequirements = computed(() =>
  passwordChecks.value.lower &&
  passwordChecks.value.upper &&
  passwordChecks.value.number &&
  passwordChecks.value.special,
)

const passwordStrength = computed(() => {
  const value = String(password.value || '')
  if (!value) {
    return {
      label: '',
      tone: 'idle',
      score: 0,
      percent: 0,
    }
  }

  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (passwordChecks.value.lower) score += 1
  if (passwordChecks.value.upper) score += 1
  if (passwordChecks.value.number) score += 1
  if (passwordChecks.value.special) score += 1
  if (!/(.)\1\1/.test(value)) score += 1

  if (score <= 2) return { label: 'Weak', tone: 'weak', score: 1, percent: 25 }
  if (score <= 4) return { label: 'Fair', tone: 'fair', score: 2, percent: 50 }
  if (score <= 6) return { label: 'Strong', tone: 'strong', score: 3, percent: 75 }
  return { label: 'Very Strong', tone: 'very-strong', score: 4, percent: 100 }
})

const normalizeEmailInput = (value) =>
  String(value || '')
    .replace(/\s+/g, '')
    .toLowerCase()

const isValidEmail = (value) => {
  const normalized = normalizeEmailInput(value)
  if (!normalized || normalized.length > 254) return false
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return false

  const [localPart = '', domainPart = ''] = normalized.split('@')
  if (!localPart || !domainPart) return false
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false
  if (domainPart.startsWith('-') || domainPart.endsWith('-') || domainPart.includes('..')) return false
  if (domainPart.split('.').some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false

  return true
}

const rules = computed(() => {
  const applicantProfileOk = isApplicantRegistration.value
    ? !!disabilityType.value.trim() &&
      !!firstName.value.trim() &&
      !!lastName.value.trim() &&
      !!sex.value &&
      !!birthDate.value &&
      !!addressProvince.value.trim() &&
      !!addressCity.value.trim() &&
      !!addressBarangay.value.trim() &&
      !!contactNumber.value.trim() &&
      !!preferredLanguage.value.trim()
    : true

  return {
    filled: !!email.value.trim() && applicantProfileOk && !!password.value && !!confirmPassword.value,
    length: password.value.length >= 8 && password.value.length <= MAX_PASSWORD_LENGTH,
    categoriesMet: meetsPasswordCharacterRequirements.value,
    noTripleRepeat: !/(.)\1\1/.test(password.value),
    match: password.value === confirmPassword.value && password.value.length > 0,
  }
})

const hasStartedRegistration = computed(() => {
  const applicantDirty =
    disabilityType.value.trim() !== '' ||
    firstName.value.trim() !== '' ||
    lastName.value.trim() !== '' ||
    sex.value !== '' ||
    birthDate.value !== '' ||
    addressProvince.value.trim() !== APPLICANT_DEFAULT_PROVINCE ||
    addressCity.value.trim() !== APPLICANT_DEFAULT_CITY ||
    addressBarangay.value.trim() !== '' ||
    contactNumber.value.trim() !== '' ||
    contactCountryCode.value !== 'PH' ||
    preferredLanguage.value.trim() !== '' ||
    !!applicantProfileImage.value

  const accountDirty =
    email.value.trim() !== '' ||
    password.value !== '' ||
    confirmPassword.value !== '' ||
    agreedToTerms.value ||
    showPassword.value ||
    showConfirmPassword.value

  const employerDirty =
    companyName.value.trim() !== '' ||
    employerStreetAddress.value.trim() !== '' ||
    employerBarangay.value.trim() !== '' ||
    companyLocation.value.trim() !== '' ||
    companyContactNumber.value.trim() !== '' ||
    companyCategory.value.trim() !== '' ||
    companyVerificationDocumentFiles.value.some(Boolean) ||
    companyVerificationCertified.value ||
    accountDirty

  return isEmployerRegistration.value ? employerDirty : applicantDirty || accountDirty
})

const clearTimer = () => {
  if (timerId) {
    window.clearTimeout(timerId)
    timerId = null
  }
}

const clearStepStatusTimer = () => {
  if (stepStatusTimerId) {
    window.clearTimeout(stepStatusTimerId)
    stepStatusTimerId = null
  }
}

const clearDraftSaveTimer = () => {
  if (draftSaveTimerId) {
    window.clearTimeout(draftSaveTimerId)
    draftSaveTimerId = null
  }
}

const clearNotifyTimer = () => {
  if (notifyTimerId) {
    window.clearTimeout(notifyTimerId)
    notifyTimerId = null
  }
}

const queueDraftSaveFeedback = () => {
  if (!isApplicantRegistration.value || stepTransitionLoading.value || loading.value || waitingApproval.value) return
  if (!hasStartedRegistration.value) {
    clearDraftSaveTimer()
    draftSaveStatus.value = ''
    return
  }
  clearDraftSaveTimer()
  draftSaveStatus.value = 'saving'
  draftSaveTimerId = window.setTimeout(() => {
    draftSaveStatus.value = 'saved'
    draftSaveTimerId = window.setTimeout(() => {
      draftSaveStatus.value = ''
      draftSaveTimerId = null
    }, 820)
  }, 480)
}

const clearApplicantImagePreview = () => {
  if (applicantProfileImagePreview.value) URL.revokeObjectURL(applicantProfileImagePreview.value)
  applicantProfileImagePreview.value = ''
}

const openApplicantDraftFileDb = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(APPLICANT_REGISTRATION_DRAFT_FILE_DB, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(APPLICANT_REGISTRATION_DRAFT_FILE_STORE)) {
        db.createObjectStore(APPLICANT_REGISTRATION_DRAFT_FILE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open draft file storage.'))
  })

const saveApplicantDraftFiles = async (files) => {
  const db = await openApplicantDraftFileDb()

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(APPLICANT_REGISTRATION_DRAFT_FILE_STORE, 'readwrite')
    const store = transaction.objectStore(APPLICANT_REGISTRATION_DRAFT_FILE_STORE)
    store.put(files, APPLICANT_REGISTRATION_DRAFT_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Failed to save draft files.'))
    transaction.onabort = () => reject(transaction.error || new Error('Draft file save was aborted.'))
  })

  db.close()
}

const readApplicantDraftFiles = async () => {
  const db = await openApplicantDraftFileDb()

  const result = await new Promise((resolve, reject) => {
    const transaction = db.transaction(APPLICANT_REGISTRATION_DRAFT_FILE_STORE, 'readonly')
    const store = transaction.objectStore(APPLICANT_REGISTRATION_DRAFT_FILE_STORE)
    const request = store.get(APPLICANT_REGISTRATION_DRAFT_KEY)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Failed to read draft files.'))
  })

  db.close()
  return result
}

const clearApplicantDraftFiles = async () => {
  const db = await openApplicantDraftFileDb()

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(APPLICANT_REGISTRATION_DRAFT_FILE_STORE, 'readwrite')
    const store = transaction.objectStore(APPLICANT_REGISTRATION_DRAFT_FILE_STORE)
    store.delete(APPLICANT_REGISTRATION_DRAFT_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Failed to clear draft files.'))
    transaction.onabort = () => reject(transaction.error || new Error('Draft file clear was aborted.'))
  })

  db.close()
}

const normalizeDraftFile = (value, fallbackName, fallbackType = 'application/octet-stream') => {
  if (!value) return null
  if (value instanceof File) return value
  if (value instanceof Blob) {
    return new File([value], fallbackName, {
      type: value.type || fallbackType,
      lastModified: Date.now(),
    })
  }
  return null
}

const buildApplicantRegistrationDraft = () => ({
  selectedRole: selectedRole.value,
  applicantStep: applicantStep.value,
  isInlineClientVerificationActive: isInlineClientVerificationActive.value,
  disabilityType: disabilityType.value,
  firstName: firstName.value,
  lastName: lastName.value,
  sex: sex.value,
  birthDate: birthDate.value,
  addressProvince: addressProvince.value,
  addressCity: addressCity.value,
  addressBarangay: addressBarangay.value,
  contactNumber: contactNumber.value,
  contactCountryCode: contactCountryCode.value,
  preferredLanguage: preferredLanguage.value,
  email: email.value,
  password: password.value,
  confirmPassword: confirmPassword.value,
  agreedToTerms: agreedToTerms.value,
  isClientVerificationComplete: isClientVerificationComplete.value,
  applicantPwdIdOcrStatus: applicantPwdIdOcrStatus.value,
  applicantPwdIdOcrMessage: applicantPwdIdOcrMessage.value,
  applicantPwdIdOcrExtractedNumber: applicantPwdIdOcrExtractedNumber.value,
  applicantPwdIdFrontOcrText: applicantPwdIdFrontOcrText.value,
  applicantPwdIdBackOcrText: applicantPwdIdBackOcrText.value,
})

const saveApplicantRegistrationDraft = async () => {
  if (!isApplicantRegistration.value) return

  sessionStorage.setItem(APPLICANT_REGISTRATION_DRAFT_KEY, JSON.stringify(buildApplicantRegistrationDraft()))
  await saveApplicantDraftFiles({
    applicantProfileImage: applicantProfileImage.value,
    applicantResumeFile: applicantResumeFile.value,
    applicantPwdIdFrontFile: applicantPwdIdFrontFile.value,
    applicantPwdIdBackFile: applicantPwdIdBackFile.value,
  })
}

const restoreApplicantRegistrationDraft = async () => {
  const rawDraft = sessionStorage.getItem(APPLICANT_REGISTRATION_DRAFT_KEY)
  if (!rawDraft) return false

  try {
    const draft = JSON.parse(rawDraft)
    const draftFiles = await readApplicantDraftFiles()
    selectedRole.value = draft.selectedRole || 'applicant'
    applicantStep.value = Number(draft.applicantStep || 2)
    isInlineClientVerificationActive.value = applicantStep.value === 1 && Boolean(draft.isInlineClientVerificationActive)
    disabilityType.value = draft.disabilityType || ''
    firstName.value = draft.firstName || ''
    lastName.value = draft.lastName || ''
    sex.value = draft.sex || ''
    birthDate.value = draft.birthDate || ''
    addressProvince.value = draft.addressProvince || APPLICANT_DEFAULT_PROVINCE
    addressCity.value = draft.addressCity || APPLICANT_DEFAULT_CITY
    addressBarangay.value = draft.addressBarangay || ''
    contactNumber.value = draft.contactNumber || ''
    contactCountryCode.value = draft.contactCountryCode || 'PH'
    preferredLanguage.value = draft.preferredLanguage || ''
    email.value = draft.email || ''
    password.value = draft.password || ''
    confirmPassword.value = draft.confirmPassword || ''
    agreedToTerms.value = Boolean(draft.agreedToTerms)
    isClientVerificationComplete.value = Boolean(draft.isClientVerificationComplete)
    applicantPwdIdOcrStatus.value = draft.applicantPwdIdOcrStatus || 'idle'
    applicantPwdIdOcrMessage.value = draft.applicantPwdIdOcrMessage || ''
    applicantPwdIdOcrExtractedNumber.value = draft.applicantPwdIdOcrExtractedNumber || ''
    applicantPwdIdFrontOcrText.value = draft.applicantPwdIdFrontOcrText || ''
    applicantPwdIdBackOcrText.value = draft.applicantPwdIdBackOcrText || ''

    if (draftFiles) {
      applicantProfileImage.value = normalizeDraftFile(
        draftFiles.applicantProfileImage,
        'restored-selfie.jpg',
        'image/jpeg',
      )
      applicantResumeFile.value = normalizeDraftFile(
        draftFiles.applicantResumeFile,
        'restored-resume.pdf',
        'application/pdf',
      )
      applicantPwdIdFrontFile.value = normalizeDraftFile(
        draftFiles.applicantPwdIdFrontFile,
        'restored-pwd-front.jpg',
        'image/jpeg',
      )
      applicantPwdIdBackFile.value = normalizeDraftFile(
        draftFiles.applicantPwdIdBackFile,
        'restored-pwd-back.jpg',
        'image/jpeg',
      )

      if (applicantProfileImage.value instanceof File) {
        clearApplicantImagePreview()
        applicantProfileImagePreview.value = URL.createObjectURL(applicantProfileImage.value)
      }
    }

    return true
  } catch {
    sessionStorage.removeItem(APPLICANT_REGISTRATION_DRAFT_KEY)
    await clearApplicantDraftFiles().catch(() => {})
    return false
  }
}

const clearApplicantRegistrationDraft = async () => {
  sessionStorage.removeItem(APPLICANT_REGISTRATION_DRAFT_KEY)
  await clearApplicantDraftFiles().catch(() => {})
}

const closeDisabilityDropdown = () => {
  if (isDisabilityDropdownOpen.value) isDisabilityDropdownClosing.value = true
  isDisabilityDropdownOpen.value = false
}

const finishDisabilityDropdownClose = () => {
  isDisabilityDropdownClosing.value = false
}

const closeSexDropdown = () => {
  if (isSexDropdownOpen.value) isSexDropdownClosing.value = true
  isSexDropdownOpen.value = false
}

const finishSexDropdownClose = () => {
  isSexDropdownClosing.value = false
}

const closeBarangayDropdown = () => {
  if (isBarangayDropdownOpen.value) isBarangayDropdownClosing.value = true
  isBarangayDropdownOpen.value = false
}

const finishBarangayDropdownClose = () => {
  isBarangayDropdownClosing.value = false
}

const closeLanguageDropdown = () => {
  if (isLanguageDropdownOpen.value) isLanguageDropdownClosing.value = true
  isLanguageDropdownOpen.value = false
}

const finishLanguageDropdownClose = () => {
  isLanguageDropdownClosing.value = false
}

const closeEmployerOrganizationTypeDropdown = () => {
  if (isEmployerOrganizationTypeDropdownOpen.value) isEmployerOrganizationTypeDropdownClosing.value = true
  isEmployerOrganizationTypeDropdownOpen.value = false
}

const finishEmployerOrganizationTypeDropdownClose = () => {
  isEmployerOrganizationTypeDropdownClosing.value = false
}

const closeEmployerBarangayDropdown = () => {
  if (isEmployerBarangayDropdownOpen.value) isEmployerBarangayDropdownClosing.value = true
  isEmployerBarangayDropdownOpen.value = false
}

const finishEmployerBarangayDropdownClose = () => {
  isEmployerBarangayDropdownClosing.value = false
}

const closeEmployerCategoryDropdown = () => {
  if (isEmployerCategoryDropdownOpen.value) isEmployerCategoryDropdownClosing.value = true
  isEmployerCategoryDropdownOpen.value = false
}

const finishEmployerCategoryDropdownClose = () => {
  isEmployerCategoryDropdownClosing.value = false
}

const closeContactCountryDropdown = () => {
  if (isContactCountryDropdownOpen.value) isContactCountryDropdownClosing.value = true
  isContactCountryDropdownOpen.value = false
  resetContactCountrySearch()
}

const finishContactCountryDropdownClose = () => {
  isContactCountryDropdownClosing.value = false
}

const closeEmployerContactCountryDropdown = () => {
  if (isEmployerContactCountryDropdownOpen.value) isEmployerContactCountryDropdownClosing.value = true
  isEmployerContactCountryDropdownOpen.value = false
  resetEmployerContactCountrySearch()
}

const finishEmployerContactCountryDropdownClose = () => {
  isEmployerContactCountryDropdownClosing.value = false
}

const closeBirthDatePicker = () => {
  if (isBirthDatePickerOpen.value) isBirthDatePickerClosing.value = true
  isBirthDatePickerOpen.value = false
  isBirthMonthMenuOpen.value = false
  isBirthYearMenuOpen.value = false
}

const finishBirthDatePickerClose = () => {
  isBirthDatePickerClosing.value = false
}

const scrollDropdownToSelectedOption = async (dropdownRef) => {
  await nextTick()

  const root = dropdownRef?.value
  if (!(root instanceof HTMLElement)) return

  const activeOption = root.querySelector('.reg-disability-select__option--active')
  if (!(activeOption instanceof HTMLElement)) return

  activeOption.scrollIntoView({
    block: 'nearest',
  })
}

const toggleDisabilityDropdown = () => {
  closeBarangayDropdown()
  closeLanguageDropdown()
  closeSexDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isDisabilityDropdownOpen.value = !isDisabilityDropdownOpen.value
  if (isDisabilityDropdownOpen.value) void scrollDropdownToSelectedOption(disabilityDropdownRef)
}

const selectDisabilityOption = (option) => {
  disabilityType.value = option
  clearApplicantFieldError('disability')
  closeDisabilityDropdown()
}

const toggleSexDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeLanguageDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isSexDropdownOpen.value = !isSexDropdownOpen.value
  if (isSexDropdownOpen.value) void scrollDropdownToSelectedOption(sexDropdownRef)
}

const selectSexOption = (option) => {
  sex.value = option
  clearApplicantFieldError('sex')
  closeSexDropdown()
}

const toggleBarangayDropdown = () => {
  closeDisabilityDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isBarangayDropdownOpen.value = !isBarangayDropdownOpen.value
  if (isBarangayDropdownOpen.value) void scrollDropdownToSelectedOption(barangayDropdownRef)
}

const selectBarangayOption = (option) => {
  addressBarangay.value = option
  clearApplicantFieldError('barangay')
  closeBarangayDropdown()
}

const toggleLanguageDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeEmployerCategoryDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isLanguageDropdownOpen.value = !isLanguageDropdownOpen.value
  if (isLanguageDropdownOpen.value) void scrollDropdownToSelectedOption(languageDropdownRef)
}

const selectLanguageOption = (option) => {
  preferredLanguage.value = option
  clearApplicantFieldError('preferredLanguage')
  closeLanguageDropdown()
}

const toggleEmployerOrganizationTypeDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeEmployerCategoryDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isEmployerOrganizationTypeDropdownOpen.value = !isEmployerOrganizationTypeDropdownOpen.value
  if (isEmployerOrganizationTypeDropdownOpen.value) void scrollDropdownToSelectedOption(employerOrganizationTypeDropdownRef)
}

const toggleEmployerBarangayDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeEmployerCategoryDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isEmployerBarangayDropdownOpen.value = !isEmployerBarangayDropdownOpen.value
  if (isEmployerBarangayDropdownOpen.value) void scrollDropdownToSelectedOption(employerBarangayDropdownRef)
}

const toggleEmployerCategoryDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeContactCountryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isEmployerCategoryDropdownOpen.value = !isEmployerCategoryDropdownOpen.value
  if (isEmployerCategoryDropdownOpen.value) void scrollDropdownToSelectedOption(employerCategoryDropdownRef)
}

const selectEmployerCategoryOption = (option) => {
  companyCategory.value = option
  clearEmployerFieldError('companyCategory')
  closeEmployerCategoryDropdown()
}

const toggleContactCountryDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeEmployerCategoryDropdown()
  closeEmployerContactCountryDropdown()
  closeBirthDatePicker()
  isContactCountryDropdownOpen.value = !isContactCountryDropdownOpen.value
  resetContactCountrySearch()
  if (isContactCountryDropdownOpen.value) void scrollDropdownToSelectedOption(contactCountryDropdownRef)
}

const selectContactCountryOption = (countryCode) => {
  handleContactCountryChange(countryCode)
  closeContactCountryDropdown()
}

const toggleEmployerContactCountryDropdown = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeLanguageDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeEmployerCategoryDropdown()
  closeContactCountryDropdown()
  closeBirthDatePicker()
  isEmployerContactCountryDropdownOpen.value = !isEmployerContactCountryDropdownOpen.value
  resetEmployerContactCountrySearch()
  if (isEmployerContactCountryDropdownOpen.value) void scrollDropdownToSelectedOption(employerContactCountryDropdownRef)
}

const selectEmployerContactCountryOption = (countryCode) => {
  handleEmployerContactCountryChange(countryCode)
  closeEmployerContactCountryDropdown()
}

const syncBirthDateCalendarMonth = (value = birthDate.value) => {
  const parsed = parseIsoDate(value)
  const baseDate = parsed || todayDate()
  birthDateCalendarMonth.value = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
}

const toggleBirthDatePicker = () => {
  closeDisabilityDropdown()
  closeBarangayDropdown()
  closeSexDropdown()
  closeContactCountryDropdown()
  closeEmployerOrganizationTypeDropdown()
  closeEmployerCategoryDropdown()
  closeEmployerContactCountryDropdown()
  if (!isBirthDatePickerOpen.value) syncBirthDateCalendarMonth()
  isBirthMonthMenuOpen.value = false
  isBirthYearMenuOpen.value = false
  isBirthDatePickerOpen.value = !isBirthDatePickerOpen.value
}

const toggleBirthMonthMenu = () => {
  isBirthYearMenuOpen.value = false
  isBirthMonthMenuOpen.value = !isBirthMonthMenuOpen.value
}

const toggleBirthYearMenu = () => {
  isBirthMonthMenuOpen.value = false
  isBirthYearMenuOpen.value = !isBirthYearMenuOpen.value
}

const showPreviousBirthMonth = () => {
  birthDateCalendarMonth.value = new Date(
    birthDateCalendarMonth.value.getFullYear(),
    birthDateCalendarMonth.value.getMonth() - 1,
    1,
  )
}

const showNextBirthMonth = () => {
  if (!canGoNextBirthMonth.value) return
  birthDateCalendarMonth.value = new Date(
    birthDateCalendarMonth.value.getFullYear(),
    birthDateCalendarMonth.value.getMonth() + 1,
    1,
  )
}

const selectBirthMonth = (monthIndex) => {
  birthDateCalendarMonth.value = new Date(
    birthDateCalendarMonth.value.getFullYear(),
    monthIndex,
    1,
  )
  isBirthMonthMenuOpen.value = false
}

const selectBirthYear = (year) => {
  const today = todayDate()
  let monthIndex = birthDateCalendarMonth.value.getMonth()
  if (year === today.getFullYear() && monthIndex > today.getMonth()) {
    monthIndex = today.getMonth()
  }
  birthDateCalendarMonth.value = new Date(year, monthIndex, 1)
  isBirthYearMenuOpen.value = false
}

const selectBirthDate = (iso, isFuture) => {
  if (isFuture) return
  birthDate.value = iso
  clearApplicantFieldError('birthDate')
  closeBirthDatePicker()
}

const clearBirthDate = () => {
  birthDate.value = ''
  birthDateInput.value = ''
  syncBirthDateCalendarMonth('')
}

const jumpBirthDateToTodayMonth = () => {
  syncBirthDateCalendarMonth(formatDateIso(todayDate()))
}

const handleBirthDateInputChange = (event) => {
  const input = event?.target
  const formatted = formatBirthDateText(input?.value || '')
  birthDateInput.value = formatted
  if (input) input.value = formatted
  if (!formatted) {
    birthDate.value = ''
    return
  }
  const iso = parseDisplayDateToIso(formatted)
  if (!iso) return
  birthDate.value = iso
  clearApplicantFieldError('birthDate')
  syncBirthDateCalendarMonth(iso)
}

const handleBirthDateInputBlur = () => {
  if (!birthDateInput.value) {
    birthDate.value = ''
    return
  }
  const iso = parseDisplayDateToIso(birthDateInput.value)
  if (iso) {
    birthDate.value = iso
    clearApplicantFieldError('birthDate')
    syncBirthDateCalendarMonth(iso)
  }
  birthDateInput.value = iso ? birthDateDisplay.value : birthDate.value ? birthDateDisplay.value : ''
}

const handleDocumentPointerDown = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const clickedDisability = disabilityDropdownRef.value?.contains(target)
  const clickedBarangay = barangayDropdownRef.value?.contains(target)
  const clickedSex = sexDropdownRef.value?.contains(target)
  const clickedLanguage = languageDropdownRef.value?.contains(target)
  const clickedEmployerOrganizationType = employerOrganizationTypeDropdownRef.value?.contains(target)
  const clickedEmployerBarangay = employerBarangayDropdownRef.value?.contains(target)
  const clickedEmployerCategory = employerCategoryDropdownRef.value?.contains(target)
  const clickedContactCountry = contactCountryDropdownRef.value?.contains(target)
  const clickedEmployerContactCountry = employerContactCountryDropdownRef.value?.contains(target)
  const clickedBirthDate = birthDatePickerRef.value?.contains(target)
  if (!clickedDisability) closeDisabilityDropdown()
  if (!clickedBarangay) closeBarangayDropdown()
  if (!clickedSex) closeSexDropdown()
  if (!clickedLanguage) closeLanguageDropdown()
  if (!clickedEmployerOrganizationType) closeEmployerOrganizationTypeDropdown()
  if (!clickedEmployerBarangay) closeEmployerBarangayDropdown()
  if (!clickedEmployerCategory) closeEmployerCategoryDropdown()
  if (!clickedContactCountry) closeContactCountryDropdown()
  if (!clickedEmployerContactCountry) closeEmployerContactCountryDropdown()
  if (!clickedBirthDate) closeBirthDatePicker()
}

watch(
  birthDate,
  (value) => {
    birthDateInput.value = value ? birthDateDisplay.value : ''
  },
  { immediate: true },
)

watch([applicantStep, isInlineClientVerificationActive], ([step, isInline]) => {
  if (step !== 1 || !isInline) {
    applicantVerificationPanelRef.value?.stopCamera?.()
  }
})

watch(
  [
    applicantStep,
    isInlineClientVerificationActive,
    disabilityType,
    firstName,
    lastName,
    sex,
    birthDate,
    addressBarangay,
    contactNumber,
    contactCountryCode,
    preferredLanguage,
    email,
    password,
    confirmPassword,
    agreedToTerms,
  ],
  () => {
    queueDraftSaveFeedback()
  },
)

watch(preferredLanguage, (value) => {
  if (value) clearApplicantFieldError('preferredLanguage')
})

watch(applicantProfileImage, (value) => {
  if (value) clearApplicantFieldError('profileImage')
})

watch([firstName, lastName], () => {
  if (applicantPwdIdFrontOcrText.value || applicantPwdIdBackOcrText.value) {
    evaluatePwdIdOcrResult()
  }
})

watch(password, (value) => {
  if (value) clearApplicantFieldError('password')
})

watch(confirmPassword, (value) => {
  if (value) clearApplicantFieldError('confirmPassword')
})

watch(agreedToTerms, (value) => {
  if (value) clearApplicantFieldError('terms')
})

const formatFileSize = (bytes) => `${(bytes / 1000000).toFixed(2)} MB`

const normalizeOcrText = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

const resetPwdIdOcrState = () => {
  applicantPwdIdOcrStatus.value = 'idle'
  applicantPwdIdOcrMessage.value = ''
  applicantPwdIdOcrExtractedNumber.value = ''
}

const getPwdIdNameTokens = () =>
  [firstName.value, lastName.value]
    .flatMap((part) => String(part || '').trim().toUpperCase().split(/\s+/))
    .filter((token) => token.length >= 2)

const extractPwdIdNumber = (text) => {
  const normalized = normalizeOcrText(text)
  const labeledMatch = normalized.match(/(?:PWD|ID)[^\dA-Z]{0,6}([A-Z0-9-]{6,})/)
  if (labeledMatch?.[1]) return labeledMatch[1]

  const genericMatch = normalized.match(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]{2,})+\b/)
  if (genericMatch?.[0]) return genericMatch[0]

  return ''
}

const evaluatePwdIdOcrResult = () => {
  const combinedText = normalizeOcrText(`${applicantPwdIdFrontOcrText.value} ${applicantPwdIdBackOcrText.value}`)
  if (!combinedText) {
    applicantPwdIdOcrStatus.value = 'needs-review'
    applicantPwdIdOcrMessage.value = 'We could not read the PWD ID clearly yet. Upload clearer front and back images.'
    applicantPwdIdOcrExtractedNumber.value = ''
    return
  }

  const documentLooksLikePwdId =
    /PERSONS WITH DISABILITY|DISABILITY|PWD|ID CARD|IDENTIFICATION/.test(combinedText)
  const nameTokens = getPwdIdNameTokens()
  const matchedNameTokens = nameTokens.filter((token) => combinedText.includes(token))
  const extractedNumber = extractPwdIdNumber(combinedText)

  applicantPwdIdOcrExtractedNumber.value = extractedNumber

  if (documentLooksLikePwdId && matchedNameTokens.length >= Math.min(2, Math.max(nameTokens.length, 1))) {
    applicantPwdIdOcrStatus.value = 'matched'
    applicantPwdIdOcrMessage.value = extractedNumber
      ? `PWD ID matched. Extracted ID: ${extractedNumber}`
      : 'PWD ID matched with your registration details.'
    return
  }

  if (documentLooksLikePwdId || matchedNameTokens.length > 0) {
    applicantPwdIdOcrStatus.value = 'partial'
    applicantPwdIdOcrMessage.value = 'PWD ID text was detected, but some details did not fully match your form. Please review it.'
    return
  }

  applicantPwdIdOcrStatus.value = 'needs-review'
  applicantPwdIdOcrMessage.value = 'The uploaded files do not look like a readable PWD ID yet. Please upload clearer front and back images.'
}

const runPwdIdOcrForSide = async (side, file) => {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    if (side === 'back') applicantPwdIdBackOcrText.value = ''
    else applicantPwdIdFrontOcrText.value = ''
    applicantPwdIdOcrStatus.value = 'needs-review'
    applicantPwdIdOcrMessage.value = 'OCR auto-check works on image files. If you upload PDF, manual review will be needed.'
    applicantPwdIdOcrExtractedNumber.value = ''
    return
  }

  applicantPwdIdOcrStatus.value = 'checking'
  applicantPwdIdOcrMessage.value = `Reading ${side === 'back' ? 'the back' : 'the front'} of your PWD ID...`

  const objectUrl = URL.createObjectURL(file)

  try {
    const result = await Tesseract.recognize(objectUrl, 'eng', {
      logger: () => {},
    })
    const extractedText = normalizeOcrText(result?.data?.text || '')
    if (side === 'back') applicantPwdIdBackOcrText.value = extractedText
    else applicantPwdIdFrontOcrText.value = extractedText
    const extractedNumber = extractPwdIdNumber(extractedText)
    if (extractedNumber) {
      applicantPwdIdOcrExtractedNumber.value = extractedNumber
    }
  } catch {
    if (side === 'back') applicantPwdIdBackOcrText.value = ''
    else applicantPwdIdFrontOcrText.value = ''
    applicantPwdIdOcrStatus.value = 'needs-review'
    applicantPwdIdOcrMessage.value = 'We could not extract text from that image. Try a clearer photo of the PWD ID.'
    applicantPwdIdOcrExtractedNumber.value = ''
    return
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  if (applicantPwdIdFrontFile.value && applicantPwdIdBackFile.value) {
    evaluatePwdIdOcrResult()
    return
  }

  applicantPwdIdOcrStatus.value = 'pending'
  applicantPwdIdOcrMessage.value = applicantPwdIdOcrExtractedNumber.value
    ? `ID number detected: ${applicantPwdIdOcrExtractedNumber.value}. Upload the other side so we can auto-check the full PWD ID.`
    : 'Front or back scanned. Upload the other side so we can auto-check the PWD ID.'
}

const applyApplicantImageFile = (file, options = {}) => {
  const { resetInput = null, notifyOnError = true } = options

  if (!file) {
    applicantImageError.value = ''
    applicantProfileImage.value = null
    isClientVerificationComplete.value = false
    clearApplicantImagePreview()
    return
  }

  if (!file.type.startsWith('image/')) {
    applicantImageError.value = 'Only JPG, PNG, or WEBP image files are allowed.'
    if (notifyOnError) notify('Please upload a valid image file.', 'error')
    applicantProfileImage.value = null
    isClientVerificationComplete.value = false
    clearApplicantImagePreview()
    if (resetInput instanceof HTMLInputElement) resetInput.value = ''
    return
  }

  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    applicantImageError.value =
      `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is 4.00 MB.`
    if (notifyOnError) notify('Image is too large. Please upload an image that is 4MB or smaller.', 'error')
    applicantProfileImage.value = null
    isClientVerificationComplete.value = false
    clearApplicantImagePreview()
    if (resetInput instanceof HTMLInputElement) resetInput.value = ''
    return
  }

  applicantImageError.value = ''
  applicantProfileImage.value = file
  clearApplicantImagePreview()
  applicantProfileImagePreview.value = URL.createObjectURL(file)
}

const handleApplicantImageChange = (event) => {
  const file = event?.target?.files?.[0] || null
  applyApplicantImageFile(file, {
    resetInput: event?.target instanceof HTMLInputElement ? event.target : null,
  })
}

const handleVerificationSelfieSelected = (file) => {
  applyApplicantImageFile(file, { notifyOnError: true })
}

const handleClientVerificationMessage = (event) => {
  if (!event || event.origin !== window.location.origin) return

  const payload = event.data
  if (!payload || payload.type !== 'client-verification-complete' || payload.completed !== true) {
    return
  }

  const selfieFile = payload.selfieFile instanceof File ? payload.selfieFile : null
  if (!selfieFile) {
    notify('Face verification finished, but the selfie file was not returned. Please try again.', 'error')
    return
  }

  handleVerificationSelfieSelected(selfieFile)
  if (!applicantProfileImage.value) return
  handleClientVerificationComplete()
}

const closeClientVerificationModal = () => {
  isClientVerificationModalOpen.value = false
}

const handleClientVerificationComplete = () => {
  applicantVerificationPanelRef.value?.stopCamera?.()
  isClientVerificationComplete.value = true
  isClientVerificationModalOpen.value = false
  isInlineClientVerificationActive.value = false
  if (applicantStep.value === 1) {
    notify('Face verification completed. Proceeding to Step 2.', 'success')
    applicantStep.value = 2
    return
  }
  notify('Face verification refreshed successfully.', 'success')
}

const handleApplicantResumeChange = (event) => {
  let file = event?.target?.files?.[0] || null

  if (!file && event?.type === 'paste') {
    const items = event.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type === 'application/pdf') {
          file = item.getAsFile()
          break
        }
      }
    }
  }

  if (!file) {
    if (event?.type !== 'paste') {
      applicantResumeError.value = ''
      applicantResumeFile.value = null
    }
    return
  }

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    applicantResumeError.value = 'Only PDF resume files are allowed.'
    notify('Please upload a valid PDF resume file.', 'error')
    applicantResumeFile.value = null
    if (event?.target && 'value' in event.target) {
      event.target.value = ''
    }
    return
  }

  if (file.size > MAX_RESUME_FILE_BYTES) {
    applicantResumeError.value =
      `Resume file is too large (${formatFileSize(file.size)}). Maximum allowed size is 5.00 MB.`
    notify('Resume file is too large. Please upload a PDF that is 5MB or smaller.', 'error')
    applicantResumeFile.value = null
    if (event?.target && 'value' in event.target) {
      event.target.value = ''
    }
    return
  }

  applicantResumeError.value = ''
  applicantResumeFile.value = file
}

const handleApplicantPwdIdChange = (event, side) => {
  let file = event?.target?.files?.[0] || null

  if (!file && event?.type === 'paste') {
    const items = event.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/') || item.type === 'application/pdf') {
          file = item.getAsFile()
          break
        }
      }
    }
  }

  const targetFile = side === 'back' ? applicantPwdIdBackFile : applicantPwdIdFrontFile
  const targetError = side === 'back' ? applicantPwdIdBackError : applicantPwdIdFrontError
  const label = side === 'back' ? 'PWD ID back' : 'PWD ID front'

  if (!file) {
    if (event?.type !== 'paste') {
      targetError.value = ''
      targetFile.value = null
    }
    return
  }

  const isAllowedFile =
    ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type) ||
    /\.(pdf|png|jpe?g|webp)$/i.test(file.name)

  if (!isAllowedFile) {
    targetError.value = `Only PDF, JPG, PNG, or WEBP files are allowed for ${label}.`
    notify(`Please upload a valid ${label}.`, 'error')
    targetFile.value = null
    if (event?.target && 'value' in event.target) {
      event.target.value = ''
    }
    return
  }

  if (file.size > MAX_PWD_ID_FILE_BYTES) {
    targetError.value =
      `${label} is too large (${formatFileSize(file.size)}). Maximum allowed size is 5.00 MB.`
    notify(`${label} is too large. Please upload a file that is 5MB or smaller.`, 'error')
    targetFile.value = null
    if (event?.target && 'value' in event.target) {
      event.target.value = ''
    }
    return
  }

  targetError.value = ''
  targetFile.value = file
  void runPwdIdOcrForSide(side, file)
}

const clearEmployerVerificationDocumentStatusTimer = (index) => {
  if (companyVerificationDocumentStatusTimers[index]) {
    window.clearTimeout(companyVerificationDocumentStatusTimers[index])
    companyVerificationDocumentStatusTimers[index] = null
  }
}

const setEmployerVerificationDocumentStatus = (index, status) => {
  companyVerificationDocumentStatuses.value = companyVerificationDocumentStatuses.value.map((currentStatus, currentIndex) =>
    currentIndex === index ? status : currentStatus,
  )
}

const handleEmployerVerificationDocumentChange = (index, event) => {
  const file = event?.target?.files?.[0] || null

  if (!file) {
    clearEmployerVerificationDocumentStatusTimer(index)
    if (companyVerificationDocumentPreviews.value[index]) {
      URL.revokeObjectURL(companyVerificationDocumentPreviews.value[index])
    }
    companyVerificationDocumentErrors.value = companyVerificationDocumentErrors.value.map((message, currentIndex) =>
      currentIndex === index ? '' : message,
    )
    companyVerificationDocumentFiles.value = companyVerificationDocumentFiles.value.map((currentFile, currentIndex) =>
      currentIndex === index ? null : currentFile,
    )
    companyVerificationDocumentPreviews.value = companyVerificationDocumentPreviews.value.map((preview, currentIndex) =>
      currentIndex === index ? '' : preview,
    )
    setEmployerVerificationDocumentStatus(index, 'idle')
    return
  }

  const isAllowedFile =
    ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type) ||
    /\.(png|jpe?g)$/i.test(file.name)

  if (!isAllowedFile) {
    clearEmployerVerificationDocumentStatusTimer(index)
    companyVerificationDocumentErrors.value = companyVerificationDocumentErrors.value.map((message, currentIndex) =>
      currentIndex === index ? 'Only PNG or JPEG image files are allowed.' : message,
    )
    setEmployerVerificationDocumentStatus(index, 'error')
    notify('Please upload a valid PNG or JPEG business verification image.', 'error')
    companyVerificationDocumentFiles.value = companyVerificationDocumentFiles.value.map((currentFile, currentIndex) =>
      currentIndex === index ? null : currentFile,
    )
    if (companyVerificationDocumentPreviews.value[index]) {
      URL.revokeObjectURL(companyVerificationDocumentPreviews.value[index])
    }
    companyVerificationDocumentPreviews.value = companyVerificationDocumentPreviews.value.map((preview, currentIndex) =>
      currentIndex === index ? '' : preview,
    )
    event.target.value = ''
    return
  }

  if (file.size > MAX_EMPLOYER_VERIFICATION_FILE_BYTES) {
    clearEmployerVerificationDocumentStatusTimer(index)
    companyVerificationDocumentErrors.value = companyVerificationDocumentErrors.value.map((message, currentIndex) =>
      currentIndex === index
        ? `Verification document is too large (${formatFileSize(file.size)}). Maximum allowed size is 10.00 MB.`
        : message,
    )
    setEmployerVerificationDocumentStatus(index, 'error')
    notify('Verification document is too large. Please upload a file that is 10MB or smaller.', 'error')
    companyVerificationDocumentFiles.value = companyVerificationDocumentFiles.value.map((currentFile, currentIndex) =>
      currentIndex === index ? null : currentFile,
    )
    if (companyVerificationDocumentPreviews.value[index]) {
      URL.revokeObjectURL(companyVerificationDocumentPreviews.value[index])
    }
    companyVerificationDocumentPreviews.value = companyVerificationDocumentPreviews.value.map((preview, currentIndex) =>
      currentIndex === index ? '' : preview,
    )
    event.target.value = ''
    return
  }

  if (companyVerificationDocumentPreviews.value[index]) {
    URL.revokeObjectURL(companyVerificationDocumentPreviews.value[index])
  }

  const nextPreview = file.type?.startsWith('image/') ? URL.createObjectURL(file) : ''

  clearEmployerVerificationDocumentStatusTimer(index)
  companyVerificationDocumentErrors.value = companyVerificationDocumentErrors.value.map((message, currentIndex) =>
    currentIndex === index ? '' : message,
  )
  companyVerificationDocumentFiles.value = companyVerificationDocumentFiles.value.map((currentFile, currentIndex) =>
    currentIndex === index ? file : currentFile,
  )
  companyVerificationDocumentPreviews.value = companyVerificationDocumentPreviews.value.map((preview, currentIndex) =>
    currentIndex === index ? nextPreview : preview,
  )
  setEmployerVerificationDocumentStatus(index, 'checking')
  companyVerificationDocumentStatusTimers[index] = window.setTimeout(() => {
    setEmployerVerificationDocumentStatus(index, 'uploaded')
    companyVerificationDocumentStatusTimers[index] = null
  }, 900)
  clearEmployerFieldError('companyVerificationDocument')
}

const removeEmployerVerificationDocument = (index, event) => {
  if (event) event.target.blur()
  clearEmployerVerificationDocumentStatusTimer(index)
  if (companyVerificationDocumentPreviews.value[index]) {
    URL.revokeObjectURL(companyVerificationDocumentPreviews.value[index])
  }
  companyVerificationDocumentErrors.value = companyVerificationDocumentErrors.value.map((message, currentIndex) =>
    currentIndex === index ? '' : message,
  )
  companyVerificationDocumentFiles.value = companyVerificationDocumentFiles.value.map((currentFile, currentIndex) =>
    currentIndex === index ? null : currentFile,
  )
  companyVerificationDocumentPreviews.value = companyVerificationDocumentPreviews.value.map((preview, currentIndex) =>
    currentIndex === index ? '' : preview,
  )
  setEmployerVerificationDocumentStatus(index, 'idle')
}

const removeApplicantImage = (event) => {
  if (event) event.target.blur()
  applicantProfileImage.value = null
  applicantImageError.value = ''
  isClientVerificationComplete.value = false
  isApplicantImageModalOpen.value = false
  clearApplicantImagePreview()
  const imageInput = document.getElementById('reg-profile-image')
  if (imageInput) imageInput.value = ''
  if (isApplicantRegistration.value && applicantStep.value >= 2) {
    notify('Please use the face scan panel on Step 1 if you need to verify again.', 'info')
  }
}

const removeApplicantResume = (event) => {
  if (event) event.target.blur()
  applicantResumeFile.value = null
  applicantResumeError.value = ''
  const resumeInput = document.getElementById('reg-resume-file')
  if (resumeInput) resumeInput.value = ''
}

const removeApplicantPwdIdFile = (side, event) => {
  if (event) event.target.blur()
  const targetFile = side === 'back' ? applicantPwdIdBackFile : applicantPwdIdFrontFile
  const targetError = side === 'back' ? applicantPwdIdBackError : applicantPwdIdFrontError
  const inputId = side === 'back' ? 'reg-pwd-id-back-file' : 'reg-pwd-id-front-file'

  targetFile.value = null
  targetError.value = ''
  if (side === 'back') applicantPwdIdBackOcrText.value = ''
  else applicantPwdIdFrontOcrText.value = ''
  if (applicantPwdIdFrontFile.value || applicantPwdIdBackFile.value) {
    applicantPwdIdOcrStatus.value = 'pending'
    applicantPwdIdOcrMessage.value = 'Upload both front and back images to auto-check the PWD ID.'
    applicantPwdIdOcrExtractedNumber.value = ''
  } else {
    resetPwdIdOcrState()
  }
  const pwdIdInput = document.getElementById(inputId)
  if (pwdIdInput) pwdIdInput.value = ''
}

const viewApplicantImage = () => {
  if (!applicantProfileImagePreview.value) return
  imageModalSource.value = applicantProfileImagePreview.value
  imageModalTitle.value = 'Applicant uploaded image preview'
  imageModalShouldRevoke.value = false
  isApplicantImageModalOpen.value = true
}

const viewApplicantResume = () => {
  if (!applicantResumeFile.value) return
  const previewUrl = URL.createObjectURL(applicantResumeFile.value)
  window.open(previewUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 1000)
}

const viewApplicantPwdIdFile = (side) => {
  const targetFile = side === 'back' ? applicantPwdIdBackFile.value : applicantPwdIdFrontFile.value
  if (!targetFile) return
  imageModalSource.value = URL.createObjectURL(targetFile)
  imageModalTitle.value = side === 'back' ? 'Back of PWD ID preview' : 'Front of PWD ID preview'
  imageModalShouldRevoke.value = true
  isApplicantImageModalOpen.value = true
}

const viewEmployerVerificationDocument = (index) => {
  const preview = companyVerificationDocumentPreviews.value[index]
  if (!preview) return
  imageModalSource.value = preview
  imageModalTitle.value = `${employerVerificationDocumentLabels[index]} preview`
  imageModalShouldRevoke.value = false
  isApplicantImageModalOpen.value = true
}

const closeApplicantImageModal = () => {
  if (imageModalShouldRevoke.value && imageModalSource.value) {
    URL.revokeObjectURL(imageModalSource.value)
  }
  isApplicantImageModalOpen.value = false
  imageModalSource.value = ''
  imageModalTitle.value = 'Uploaded image preview'
  imageModalShouldRevoke.value = false
}

const getRegisterToastTitle = (text, kind = 'error') => {
  if (kind === 'success') return 'Success'
  if (kind === 'warning') return 'Warning'
  if (kind === 'info') return 'Info'

  const normalizedText = String(text || '').toLowerCase()
  if (normalizedText.includes('step 1')) return 'Complete Step 1'
  if (normalizedText.includes('step 2')) return 'Complete Step 2'
  if (normalizedText.includes('step 3')) return 'Complete Step 3'
  if (normalizedText.includes('unable to connect')) return 'Connection Error'
  if (normalizedText.includes('still registered in firebase authentication')) return 'Email Still Exists'
  if (normalizedText.includes('account with this email already exists')) return 'Email Still Exists'

  return 'Incomplete Form'
}

const formatMissingStepFieldsMessage = (step, missingFields) => {
  const labels = missingFields.map((field) => field.label)

  if (labels.length === 1) {
    return `Please complete ${labels[0]} in Step ${step}.`
  }

  if (labels.length === 2) {
    return `Please complete ${labels[0]} and ${labels[1]} in Step ${step}.`
  }

  const lastLabel = labels[labels.length - 1]
  const otherLabels = labels.slice(0, -1).join(', ')
  return `Please complete these fields in Step ${step}: ${otherLabels}, and ${lastLabel}.`
}

const notify = (text, kind = 'error', title = getRegisterToastTitle(text, kind)) => {
  clearNotifyTimer()
  toastClosing.value = false
  toast.value = { text, kind, title }
  notifyTimerId = window.setTimeout(() => {
    closeNotify()
  }, 3000)
}

const closeNotify = () => {
  if (!toast.value || toastClosing.value) return
  clearNotifyTimer()
  toastClosing.value = true
  window.setTimeout(() => {
    toast.value = null
    toastClosing.value = false
  }, 180)
}

const navigateSafely = (path) => {
  if (isNavigating.value) return
  isNavigating.value = true
  clearTimer()
  timerId = window.setTimeout(() => router.push(path), 180)
}

watch(
  [applicantPwdIdOcrStatus, applicantPwdIdOcrMessage],
  ([status, message]) => {
    if (!message || status === 'idle' || status === 'checking' || status === 'pending' || status === 'partial') return

    const toastKey = `${status}:${message}`
    if (lastPwdIdOcrToastKey.value === toastKey) return

    lastPwdIdOcrToastKey.value = toastKey

    notify(
      message,
      status === 'matched' ? 'success' : 'warning',
    )
  },
)

const requestBackToRoles = () => {
  if (loading.value || waitingApproval.value || stepTransitionLoading.value) return
  if (!hasStartedRegistration.value) {
    navigateSafely('/select-role')
    return
  }
  isLeaveConfirmOpen.value = true
}

const confirmBackToRoles = () => {
  isLeaveConfirmOpen.value = false
  navigateSafely('/select-role')
}

const cancelBackToRoles = () => {
  isLeaveConfirmOpen.value = false
}

const resolveRole = async () => {
  const queryRole = String(route.query.role || '').trim().toLowerCase()
  const shouldRestoreDraft = route.query.restore === '1'
  const hasSavedApplicantDraft = Boolean(sessionStorage.getItem(APPLICANT_REGISTRATION_DRAFT_KEY))
  const storageRole = String(localStorage.getItem('selectedRole') || '').trim().toLowerCase()
  const role = ['applicant', 'employer'].includes(queryRole)
    ? queryRole
    : shouldRestoreDraft
      ? 'applicant'
    : ['applicant', 'employer'].includes(storageRole)
      ? storageRole
      : ''

  if (!role) {
    router.replace('/select-role')
    return
  }

  localStorage.setItem('selectedRole', role)
  selectedRole.value = role
  if (role === 'employer') {
    companyOrganizationType.value = 'Business'
    pendingEmployerOrganizationType.value = ''
    isEmployerTypeTransitioning.value = false
  }
  isReady.value = true
  document.title = registerPageTitle.value

  if (role === 'applicant' && (shouldRestoreDraft || hasSavedApplicantDraft)) {
    await restoreApplicantRegistrationDraft()
  }
}

const getApplicantStepMissingFields = (step) => {
  if (step === 1) {
    return [
      !disabilityType.value.trim() ? { key: 'disability', label: 'Disability' } : null,
      !firstName.value.trim() ? { key: 'firstName', label: 'First Name' } : null,
      !lastName.value.trim() ? { key: 'lastName', label: 'Last Name' } : null,
      !sex.value ? { key: 'sex', label: 'Gender' } : null,
      !birthDate.value ? { key: 'birthDate', label: 'Birth Date' } : null,
      !addressBarangay.value.trim() ? { key: 'barangay', label: 'Barangay' } : null,
    ].filter(Boolean)
  }

  if (step === 2) {
    const localContactDigits = getLocalContactDigits(contactNumber.value)
    return [
      !contactNumber.value.trim()
        ? { key: 'contactNumber', label: 'Contact Number' }
        : localContactDigits.length !== 10
          ? { key: 'contactNumber', label: 'Contact Number must be exactly 10 digits' }
          : null,
      !applicantPwdIdFrontFile.value ? { key: 'pwdIdFrontFile', label: 'Front of PWD ID' } : null,
      !applicantPwdIdBackFile.value ? { key: 'pwdIdBackFile', label: 'Back of PWD ID' } : null,
      !applicantResumeFile.value ? { key: 'resumeFile', label: 'Resume File' } : null,
      !preferredLanguage.value.trim() ? { key: 'preferredLanguage', label: 'Language' } : null,
    ].filter(Boolean)
  }

  if (step === 3) {
    return [
      !email.value.trim() ? { key: 'email', label: 'Email' } : null,
      !password.value ? { key: 'password', label: 'Password' } : null,
      !confirmPassword.value ? { key: 'confirmPassword', label: 'Confirm Password' } : null,
      !agreedToTerms.value ? { key: 'terms', label: 'Agreement Terms' } : null,
    ].filter(Boolean)
  }

  return []
}

const hasApplicantFieldError = (field) => Boolean(applicantFieldErrors.value[field])

const clearApplicantFieldError = (field) => {
  if (!applicantFieldErrors.value[field]) return
  applicantFieldErrors.value = {
    ...applicantFieldErrors.value,
    [field]: false,
  }
}

const clearEmployerFieldError = (field) => {
  if (!applicantFieldErrors.value[field]) return
  applicantFieldErrors.value = {
    ...applicantFieldErrors.value,
    [field]: false,
  }
}

const validateEmployerStep = (step) => {
  if (step === 1) {
    const hasRestrictedAddress =
      !!companyLocation.value.trim() && isDasmarinasCaviteAddress(companyLocation.value)
    const hasValidCompanyContactNumber = getEmployerLocalContactDigits(companyContactNumber.value).length === 10
    const companyFieldErrors = {
      companyOrganizationType: !companyOrganizationType.value.trim(),
      companyName: !companyName.value.trim(),
      companyLocation: !companyLocation.value.trim() || !hasRestrictedAddress,
      companyContactNumber: !companyContactNumber.value.trim() || !hasValidCompanyContactNumber,
      companyCategory: !companyCategory.value.trim(),
    }

    if (Object.values(companyFieldErrors).some(Boolean)) {
      applicantFieldErrors.value = {
        ...applicantFieldErrors.value,
        ...companyFieldErrors,
      }
      if (companyLocation.value.trim() && !hasRestrictedAddress) {
        notify(`${employerOrganizationTitle.value} address must be within Dasmarinas, Cavite only.`, 'error')
      } else if (companyContactNumber.value.trim() && !hasValidCompanyContactNumber) {
        notify(`${employerOrganizationTitle.value} contact number must be exactly 10 digits.`, 'error')
      } else {
        notify(`Please complete your business type, ${employerOrganizationNoun.value} name, street address, barangay, contact number, and industry.`, 'error')
      }
      return false
    }
  }

  if (step === 2) {
    const hasAllVerificationDocuments = companyVerificationDocumentFiles.value.every(Boolean)
    const verificationFieldErrors = {
      companyVerificationDocument: !hasAllVerificationDocuments,
      companyVerificationCertified: !companyVerificationCertified.value,
    }

    if (Object.values(verificationFieldErrors).some(Boolean)) {
      applicantFieldErrors.value = {
        ...applicantFieldErrors.value,
        ...verificationFieldErrors,
      }
      companyVerificationDocumentErrors.value = companyVerificationDocumentFiles.value.map((file, index) =>
        file ? '' : `Please upload ${employerVerificationDocumentLabels[index].toLowerCase()} for your ${employerOrganizationNoun.value}.`,
      )
      notify(`Please upload all 3 ${employerOrganizationNoun.value} verification documents and certify the submission before continuing.`, 'error')
      return false
    }
  }

  if (step === 3) {
    const employerFieldErrors = {
      email: !email.value.trim(),
      password: !password.value,
      confirmPassword: !confirmPassword.value,
    }

    if (Object.values(employerFieldErrors).some(Boolean)) {
      applicantFieldErrors.value = {
        ...applicantFieldErrors.value,
        ...employerFieldErrors,
      }
      notify(`Please complete your ${employerOrganizationNoun.value} account email and password.`, 'error')
      return false
    }
  }

  return true
}

const nextEmployerStep = () => {
  if (stepTransitionLoading.value) return

  clearStepStatusTimer()
  stepTransitionStatus.value = 'employer-step'
  stepTransitionLoading.value = true

  window.setTimeout(() => {
    if (!validateEmployerStep(employerStep.value)) {
      stepTransitionLoading.value = false
      stepTransitionStatus.value = ''
      return
    }

    employerStep.value = Math.min(employerStep.value + 1, 3)
    stepTransitionLoading.value = false
    stepTransitionStatus.value = ''
  }, 320)
}

const previousEmployerStep = () => {
  if (employerStep.value === 1) {
    void returnToEmployerTypeSelection()
    return
  }

  employerStep.value = Math.max(employerStep.value - 1, 1)
}

const validateApplicantStep = (step) => {
  const hasValidContactNumber = getLocalContactDigits(contactNumber.value).length === 10
  const checks = {
    1: !!disabilityType.value.trim() && !!firstName.value.trim() && !!lastName.value.trim() && !!sex.value && !!birthDate.value && !!addressBarangay.value.trim(),
    2: hasValidContactNumber && !!applicantPwdIdFrontFile.value && !!applicantPwdIdBackFile.value && !!applicantResumeFile.value && !!preferredLanguage.value.trim(),
    3: !!email.value.trim() && !!password.value && !!confirmPassword.value && !!agreedToTerms.value,
  }
  if (checks[step]) return true

  const missingFields = getApplicantStepMissingFields(step)
  if (missingFields.length) {
    applicantFieldErrors.value = missingFields.reduce((acc, field) => {
      acc[field.key] = true
      return acc
    }, {})
    if (step === 2) {
      applicantPwdIdFrontError.value = applicantPwdIdFrontFile.value ? '' : 'Please upload the front of the PWD ID.'
      applicantPwdIdBackError.value = applicantPwdIdBackFile.value ? '' : 'Please upload the back of the PWD ID.'
      applicantResumeError.value = applicantResumeFile.value ? '' : 'Please upload your resume file.'
    }
    notify(formatMissingStepFieldsMessage(step, missingFields), 'error')
    return false
  }

  notify(`Please complete all required fields in Step ${step}.`, 'error')
  return false
}

const nextApplicantStep = () => {
  if (stepTransitionLoading.value) return
  if (applicantStep.value === 1 && !isClientVerificationComplete.value) {
    if (!validateApplicantStep(applicantStep.value)) return
    clearStepStatusTimer()
    stepTransitionStatus.value = 'face-verification'
    stepTransitionLoading.value = true
    window.setTimeout(() => {
      stepTransitionLoading.value = false
      stepTransitionStatus.value = ''
      isInlineClientVerificationActive.value = true
      notify('Please allow camera access. Face scan will start automatically.', 'info')
    }, 650)
    return
  }
  clearStepStatusTimer()
  stepTransitionStatus.value = 'saving'
  stepTransitionLoading.value = true
  window.setTimeout(() => {
    if (!validateApplicantStep(applicantStep.value)) {
      stepTransitionLoading.value = false
      stepTransitionStatus.value = ''
      return
    }
    if (applicantStep.value === 1) {
      const firstNameError = validateNameValue(firstName.value, 'First name')
      if (firstNameError) {
        stepTransitionLoading.value = false
        stepTransitionStatus.value = ''
        notify(firstNameError, 'error')
        return
      }

      const lastNameError = validateNameValue(lastName.value, 'Last name', 3)
      if (lastNameError) {
        stepTransitionLoading.value = false
        stepTransitionStatus.value = ''
        notify(lastNameError, 'error')
        return
      }
    }
    if (applicantStep.value === 3 && !isValidEmail(email.value)) {
      stepTransitionLoading.value = false
      stepTransitionStatus.value = ''
      notify('Please enter a valid email address.', 'error')
      return
    }
    applicantStep.value = Math.min(applicantStep.value + 1, 3)
    stepTransitionLoading.value = false
    stepTransitionStatus.value = ''
  }, 320)
}

const prevApplicantStep = () => {
  if (applicantStep.value === 1 && isInlineClientVerificationActive.value) {
    isInlineClientVerificationActive.value = false
    return
  }
  applicantStep.value = Math.max(applicantStep.value - 1, 1)
  if (applicantStep.value === 1) {
    isInlineClientVerificationActive.value = false
  }
}

const handleContactCountryChange = (countryCode) => {
  const nextCountry = PHONE_COUNTRIES.find((country) => country.code === countryCode) || PHONE_COUNTRIES[0]
  contactCountryCode.value = nextCountry.code
  const localDigits = String(contactNumber.value || '').replace(/[^\d]/g, '').replace(/^0+/, '').slice(0, 10)
  contactNumber.value = localDigits ? `${nextCountry.dial}${localDigits}` : ''
}

const handleEmployerContactCountryChange = (countryCode) => {
  const nextCountry = PHONE_COUNTRIES.find((country) => country.code === countryCode) || PHONE_COUNTRIES[0]
  employerContactCountryCode.value = nextCountry.code
  const localDigits = String(companyContactNumber.value || '').replace(/[^\d]/g, '').slice(0, 10)
  companyContactNumber.value = localDigits ? `${nextCountry.dial}${localDigits}` : ''
  clearEmployerFieldError('companyContactNumber')
}

const sanitizeNameInput = (value) =>
  String(value || '')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, MAX_NAME_LENGTH)

const validateNameValue = (value, label, maxWords = 2) => {
  const normalized = String(value || '').trim().replace(/\s{2,}/g, ' ')
  if (!normalized) return `${label} is required.`
  if (!/^[\p{L}]+(?: [\p{L}]+)*$/gu.test(normalized)) return `${label} must contain letters only.`

  const words = normalized.split(' ').filter(Boolean)
  if (!words.length) return `${label} is required.`
  if (words.length > maxWords) return `${label} looks too long. Please enter a real ${label.toLowerCase()}.`
  if (words.some((word) => word.length < 2)) return `${label} must be at least 2 letters per word.`

  const loweredWords = words.map((word) => word.toLowerCase())
  if (new Set(loweredWords).size !== loweredWords.length) {
    return `${label} cannot contain repeated words.`
  }

  return ''
}

const handleFirstNameInput = (event) => {
  const input = event?.target
  const sanitized = sanitizeNameInput(input?.value || '')
  firstName.value = sanitized
  clearApplicantFieldError('firstName')
  if (input) input.value = sanitized
}

const handleLastNameInput = (event) => {
  const input = event?.target
  const sanitized = sanitizeNameInput(input?.value || '')
  lastName.value = sanitized
  clearApplicantFieldError('lastName')
  if (input) input.value = sanitized
}

const handleEmailInput = (event) => {
  const input = event?.target
  const normalized = normalizeEmailInput(input?.value || '')
  email.value = normalized
  clearApplicantFieldError('email')
  if (input) input.value = normalized
}

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

const getLocalContactDigits = (value) => {
  const raw = String(value || '').trim()
  const dial = String(selectedPhoneCountry.value?.dial || '')
  const withoutDial = dial && raw.startsWith(dial) ? raw.slice(dial.length) : raw
  return withoutDial.replace(/[^\d]/g, '').slice(0, 10)
}

const getEmployerLocalContactDigits = (value) => {
  const raw = String(value || '').trim()
  const dial = String(selectedEmployerPhoneCountry.value?.dial || '')
  const withoutDial = dial && raw.startsWith(dial) ? raw.slice(dial.length) : raw
  const digitsOnly = withoutDial.replace(/[^\d]/g, '').slice(0, 10)
  return employerContactCountryCode.value === 'PH' ? digitsOnly.replace(/^0+/, '') : digitsOnly
}

const handleContactNumberChange = (event) => {
  const input = event?.target
  const digitsOnly = String(input?.value || '').replace(/[^\d]/g, '').slice(0, 10)
  const normalized = contactCountryCode.value === 'PH' ? digitsOnly.replace(/^0+/, '') : digitsOnly
  const limited = normalized.slice(0, 10)
  contactNumber.value = limited ? `${selectedPhoneCountry.value.dial}${limited}` : ''
  clearApplicantFieldError('contactNumber')
  if (input) input.value = formatContactNumberDisplay(limited)
}

const handleEmployerContactNumberChange = (event) => {
  const input = event?.target
  const digitsOnly = String(input?.value || '').replace(/[^\d]/g, '').slice(0, 10)
  const normalized = employerContactCountryCode.value === 'PH' ? digitsOnly.replace(/^0+/, '') : digitsOnly
  const limited = normalized.slice(0, 10)
  companyContactNumber.value = limited ? `${selectedEmployerPhoneCountry.value.dial}${limited}` : ''
  clearEmployerFieldError('companyContactNumber')
  if (input) input.value = formatContactNumberDisplay(limited)
}

const EMPLOYER_CODELIKE_PATTERN =
  /<\s*script|<\/|<script|import\s*\{|<\s*[a-z!/]|onmounted|onbeforeunmount|nexttick|computed\s*,|ref\s*,|const\s+|let\s+|var\s+/i

const sanitizeEmployerTextValue = (value) => {
  const raw = String(value || '').replace(/[<>`{}[\]]/g, '')
  const collapsed = raw.replace(/\s{2,}/g, ' ').replace(/^\s+/g, '')
  const normalized = collapsed.trim()
  if (!normalized) return collapsed
  if (EMPLOYER_CODELIKE_PATTERN.test(normalized)) return ''
  return collapsed
}

const syncEmployerAddressParts = () => {
  const street = sanitizeEmployerTextValue(employerStreetAddress.value).trim()
  const barangay = String(employerBarangay.value || '').trim()
  const parts = [street, barangay, 'Dasmarinas', 'Cavite'].filter(Boolean)
  companyLocation.value = parts.join(', ')
}

const protectPlainTextField = (fieldRef, message) => {
  watch(fieldRef, (nextValue) => {
    const sanitized = sanitizeEmployerTextValue(nextValue)
    if (sanitized === nextValue) return

    fieldRef.value = sanitized

    if (String(nextValue || '').trim() && !sanitized) {
      notify(message, 'error')
    }
  })
}

const handleEmployerCompanyNameInput = (event) => {
  const input = event?.target
  const sanitized = sanitizeEmployerTextValue(input?.value || '')
  companyName.value = sanitized
  clearEmployerFieldError('companyName')
  if (input && input.value !== sanitized) {
    input.value = sanitized
    if (!sanitized) {
      notify('Code-like text is not allowed in the business name field.', 'error')
    }
  }
}

const handleEmployerCompanyLocationInput = (event) => {
  const input = event?.target
  const sanitized = sanitizeEmployerTextValue(input?.value || '')
  companyLocation.value = sanitized
  clearEmployerFieldError('companyLocation')
  if (input && input.value !== sanitized) {
    input.value = sanitized
    if (!sanitized) {
      notify('Code-like text is not allowed in the business address field.', 'error')
    }
  }
}

const handleEmployerStreetAddressInput = (event) => {
  const input = event?.target
  const sanitized = sanitizeEmployerTextValue(input?.value || '')
  employerStreetAddress.value = sanitized
  syncEmployerAddressParts()
  clearEmployerFieldError('companyLocation')
  if (input && input.value !== sanitized) {
    input.value = sanitized
    if (!sanitized && String(input?.value || '').trim()) {
      notify('Code-like text is not allowed in the business street address field.', 'error')
    }
  }
}

const selectEmployerBarangayOption = (option) => {
  employerBarangay.value = option
  syncEmployerAddressParts()
  clearEmployerFieldError('companyLocation')
  closeEmployerBarangayDropdown()
}

protectPlainTextField(firstName, 'Code-like text is not allowed in the first name field.')
protectPlainTextField(lastName, 'Code-like text is not allowed in the last name field.')
protectPlainTextField(addressProvince, 'Code-like text is not allowed in the province field.')
protectPlainTextField(addressCity, 'Code-like text is not allowed in the city field.')
protectPlainTextField(addressBarangay, 'Code-like text is not allowed in the barangay field.')
protectPlainTextField(disabilityType, 'Code-like text is not allowed in the disability field.')
protectPlainTextField(preferredLanguage, 'Code-like text is not allowed in the language field.')
protectPlainTextField(companyName, 'Code-like text is not allowed in the business name field.')
protectPlainTextField(companyLocation, 'Code-like text is not allowed in the business address field.')
protectPlainTextField(companyCategory, 'Code-like text is not allowed in the industry field.')

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const isAccountFormValid = computed(() => {
  if (!isValidEmail(email.value)) return false
  if (!rules.value.filled) return false
  if (!rules.value.length || !rules.value.categoriesMet || !rules.value.noTripleRepeat || !rules.value.match) {
    return false
  }
  if (isApplicantRegistration.value && !agreedToTerms.value) return false
  return true
})

const togglePasswordVisibility = () => {
  const nextVisibleState = !showPassword.value
  showPassword.value = nextVisibleState
  showConfirmPassword.value = nextVisibleState
}

const toggleConfirmPasswordVisibility = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}

const register = async () => {
  if (loading.value) return

  if (isEmployerRegistration.value) {
    if (!validateEmployerStep(1) || !validateEmployerStep(2) || !validateEmployerStep(3)) return
  }

  if (isApplicantRegistration.value && !agreedToTerms.value) {
    applicantFieldErrors.value = {
      ...applicantFieldErrors.value,
      terms: true,
    }
    notify('Please agree to the Privacy Terms and Agreement Terms.', 'error')
    return
  }

  loading.value = true
  await wait(220)
  email.value = normalizeEmailInput(email.value)

  const accountFieldErrors = {
    email: !email.value.trim(),
    password: !password.value,
    confirmPassword: !confirmPassword.value,
    terms: isApplicantRegistration.value ? !agreedToTerms.value : false,
    pwdIdFrontFile: isApplicantRegistration.value ? !applicantPwdIdFrontFile.value : false,
    pwdIdBackFile: isApplicantRegistration.value ? !applicantPwdIdBackFile.value : false,
  }

  if (Object.values(accountFieldErrors).some(Boolean)) {
    applicantFieldErrors.value = {
      ...applicantFieldErrors.value,
      ...accountFieldErrors,
    }
  }

  if (isApplicantRegistration.value) {
    applicantPwdIdFrontError.value = applicantPwdIdFrontFile.value ? '' : 'Please upload the front of the PWD ID.'
    applicantPwdIdBackError.value = applicantPwdIdBackFile.value ? '' : 'Please upload the back of the PWD ID.'
  }

  if (!isValidEmail(email.value)) {
    loading.value = false
    applicantFieldErrors.value = {
      ...applicantFieldErrors.value,
      email: true,
    }
    notify('Please enter a valid email address.', 'error')
    return
  }

  if (!rules.value.filled || !rules.value.length || !rules.value.categoriesMet || !rules.value.noTripleRepeat || !rules.value.match) {
    loading.value = false
    applicantFieldErrors.value = {
      ...applicantFieldErrors.value,
      password: !password.value || !rules.value.length || !rules.value.categoriesMet || !rules.value.noTripleRepeat,
      confirmPassword: !confirmPassword.value || !rules.value.match,
    }
    notify('Please complete all required fields and meet password requirements.', 'error')
    return
  }

  if (isApplicantRegistration.value && (!isClientVerificationComplete.value || !applicantProfileImage.value)) {
    loading.value = false
    notify('Please complete the face verification before registering.', 'error')
    return
  }

  if (isApplicantRegistration.value && (!applicantPwdIdFrontFile.value || !applicantPwdIdBackFile.value)) {
    loading.value = false
    notify('Please upload both the front and back of the PWD ID before registering.', 'error')
    return
  }

  if (isApplicantRegistration.value && getLocalContactDigits(contactNumber.value).length !== 10) {
    loading.value = false
    applicantFieldErrors.value = {
      ...applicantFieldErrors.value,
      contactNumber: true,
    }
    notify('Contact Number must be exactly 10 digits.', 'error')
    return
  }

  const payload = new FormData()
  const appendValue = (key, value) => {
    if (value === null || value === undefined || value === '') return
    payload.append(key, String(value))
  }

  appendValue('email', email.value.trim().toLowerCase())
  appendValue('password', password.value)
  appendValue('password_confirmation', confirmPassword.value)
  appendValue('role', selectedRole.value)
  appendValue('companyOrganizationType', isEmployerRegistration.value ? companyOrganizationType.value.trim() : null)
  appendValue('companyName', isEmployerRegistration.value ? companyName.value.trim() : null)
  appendValue('companyLocation', isEmployerRegistration.value ? companyLocation.value.trim() : null)
  appendValue('companyContactNumber', isEmployerRegistration.value ? companyContactNumber.value.trim() : null)
  appendValue('companyCategory', isEmployerRegistration.value ? companyCategory.value.trim() : null)
  appendValue('companyVerificationCertified', isEmployerRegistration.value ? companyVerificationCertified.value : null)
  appendValue('disabilityType', isApplicantRegistration.value ? disabilityType.value.trim() : null)
  appendValue('firstName', isApplicantRegistration.value ? firstName.value.trim() : null)
  appendValue('lastName', isApplicantRegistration.value ? lastName.value.trim() : null)
  appendValue('sex', isApplicantRegistration.value ? sex.value : null)
  appendValue('birthDate', isApplicantRegistration.value ? birthDate.value : null)
  appendValue('age', isApplicantRegistration.value && computedAge.value ? Number(computedAge.value) : null)
  appendValue('addressProvince', isApplicantRegistration.value ? addressProvince.value.trim() : null)
  appendValue('addressCity', isApplicantRegistration.value ? addressCity.value.trim() : null)
  appendValue('addressBarangay', isApplicantRegistration.value ? addressBarangay.value.trim() : null)
  appendValue('contactCountryCode', isApplicantRegistration.value ? contactCountryCode.value : null)
  appendValue('contactNumber', isApplicantRegistration.value ? contactNumber.value.trim() : null)
  appendValue('preferredLanguage', isApplicantRegistration.value ? preferredLanguage.value.trim() : null)
  appendValue('pwdIdOcrStatus', isApplicantRegistration.value ? applicantPwdIdOcrStatus.value : null)
  appendValue('pwdIdOcrMessage', isApplicantRegistration.value ? applicantPwdIdOcrMessage.value : null)
  appendValue('pwdIdOcrExtractedNumber', isApplicantRegistration.value ? applicantPwdIdOcrExtractedNumber.value : null)

  if (isApplicantRegistration.value && applicantProfileImage.value) {
    payload.append('profileImage', applicantProfileImage.value, applicantProfileImage.value.name || 'selfie.jpg')
  }

  if (isApplicantRegistration.value && applicantResumeFile.value) {
    payload.append('resumeFile', applicantResumeFile.value, applicantResumeFile.value.name || 'resume.pdf')
  }

  if (isApplicantRegistration.value && applicantPwdIdFrontFile.value) {
    payload.append('pwdIdFrontFile', applicantPwdIdFrontFile.value, applicantPwdIdFrontFile.value.name || 'pwd-front.jpg')
  }

  if (isApplicantRegistration.value && applicantPwdIdBackFile.value) {
    payload.append('pwdIdBackFile', applicantPwdIdBackFile.value, applicantPwdIdBackFile.value.name || 'pwd-back.jpg')
  }

  if (isEmployerRegistration.value) {
    companyVerificationDocumentFiles.value.forEach((file, index) => {
      if (!file) return
      payload.append(
        `companyVerificationDocument${index + 1}`,
        file,
        file.name || `verification-document-${index + 1}.pdf`,
      )
    })
  }

  try {
    if (isEmployerRegistration.value) {
      await saveEmployerPendingRegistrationDraft({
        email: email.value.trim().toLowerCase(),
        password: password.value,
        confirmPassword: confirmPassword.value,
        companyOrganizationType: companyOrganizationType.value.trim().toLowerCase(),
        companyName: companyName.value.trim(),
        companyLocation: companyLocation.value.trim(),
        companyContactNumber: companyContactNumber.value.trim(),
        companyCategory: companyCategory.value.trim(),
        companyVerificationCertified: companyVerificationCertified.value,
        companyVerificationDocumentFiles: companyVerificationDocumentFiles.value,
      })

      await sendRegistrationOtp({
        email: email.value.trim().toLowerCase(),
        role: selectedRole.value,
        companyName: companyName.value.trim(),
        organizationType: companyOrganizationType.value.trim().toLowerCase(),
      })

      await router.push({
        path: '/auth/verify-otp',
        query: {
          mode: 'register',
          email: email.value.trim().toLowerCase(),
          role: selectedRole.value,
          organizationType: companyOrganizationType.value.trim().toLowerCase(),
        },
      })
      return
    }

    await saveApplicantRegistrationDraft()

    await sendRegistrationOtp({
      email: email.value.trim().toLowerCase(),
      role: selectedRole.value,
      fullName: `${firstName.value.trim()} ${lastName.value.trim()}`.trim(),
    })

    await router.push({
      path: '/auth/verify-otp',
      query: {
        mode: 'register',
        email: email.value.trim().toLowerCase(),
        role: selectedRole.value,
      },
    })
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to connect to Firebase right now.', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await resolveRole()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('message', handleClientVerificationMessage)
})

watch(registerPageTitle, (value) => {
  document.title = value
})

onBeforeUnmount(() => {
  clearTimer()
  clearStepStatusTimer()
  clearDraftSaveTimer()
  clearNotifyTimer()
  companyVerificationDocumentStatusTimers.forEach((timer) => {
    if (timer) window.clearTimeout(timer)
  })
  companyVerificationDocumentPreviews.value.forEach((preview) => {
    if (preview) URL.revokeObjectURL(preview)
  })
  resetContactCountrySearch()
  closeApplicantImageModal()
  clearApplicantImagePreview()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('message', handleClientVerificationMessage)
})
</script>

<template>
  <div v-if="isReady" class="reg-page" :class="[`reg-page--step-${applicantStep}`, { 'reg-page--applicant': isApplicantRegistration, 'reg-page--employer': isEmployerRegistration }]">
    <button type="button" class="reg-back-btn" @click="requestBackToRoles">
      <i class="bi bi-arrow-left" aria-hidden="true" />
      <span>Back to Roles</span>
    </button>

    <transition name="register-route-overlay">
      <div v-if="isNavigating" class="register-route-overlay" aria-hidden="true">
        <div class="register-route-overlay__spinner" />
      </div>
    </transition>

    <transition name="reg-notify-popup">
      <div v-if="toast" class="reg-notify-banner" :class="toast.kind" role="status" aria-live="polite">
        <div class="reg-notify-banner__icon" :class="toast.kind" aria-hidden="true">
          <i
            class="bi"
            :class="
              toast.kind === 'success'
                ? 'bi-check-circle-fill'
                : toast.kind === 'warning'
                  ? 'bi-exclamation-triangle-fill'
                  : toast.kind === 'info'
                    ? 'bi-info-circle-fill'
                    : 'bi-x-circle-fill'
            "
          />
        </div>
        <div class="reg-notify-banner__copy">
          <h3 class="reg-notify-banner__title">
            {{ toast.title }}
          </h3>
          <p class="reg-notify-banner__message">{{ toast.text }}</p>
        </div>
        <button type="button" class="reg-notify-banner__close" aria-label="Close notification" @click="closeNotify">
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </transition>

    <transition name="reg-leave-confirm">
      <div v-if="isLeaveConfirmOpen" class="reg-notify-backdrop reg-leave-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Leave registration form">
        <div class="reg-notify-modal warning reg-leave-confirm">
          <button type="button" class="reg-notify-close" aria-label="Close confirmation" @click="cancelBackToRoles">
            <i class="bi bi-x-lg" />
          </button>
          <div class="reg-notify-icon warning" aria-hidden="true">
            <i class="bi bi-exclamation-triangle" />
          </div>
          <h3 class="reg-notify-title">Leave this form?</h3>
          <p class="reg-notify-message">You already started filling up the registration form. Are you sure you want to go back to roles?</p>
          <div class="reg-leave-confirm__actions">
            <button type="button" class="reg-leave-confirm__btn reg-leave-confirm__btn--ghost" @click="cancelBackToRoles">No</button>
            <button type="button" class="reg-leave-confirm__btn reg-leave-confirm__btn--danger" @click="confirmBackToRoles">Yes</button>
          </div>
        </div>
      </div>
    </transition>

    <div v-if="loading || waitingApproval || stepTransitionLoading" class="reg-alert-backdrop" role="dialog" aria-modal="true">
      <div class="reg-alert-card reg-alert-card-loading">
        <div class="reg-proceed-loader" aria-hidden="true" />
        <h3 class="reg-alert-title">
          {{
            waitingApproval
              ? 'Registration submitted'
              : stepTransitionLoading
                ? 'Please wait'
                : 'Submitting registration'
          }}
        </h3>
        <p class="reg-alert-text">
          {{
            waitingApproval
              ? 'Redirecting to login while your account waits for admin approval...'
              : stepTransitionLoading
                ? stepTransitionStatus === 'face-verification'
                  ? 'Preparing your device camera for face verification...'
                  : `Proceeding to Step ${Math.min((isEmployerRegistration ? employerStep : applicantStep) + 1, 3)}...`
                : 'Please wait while we process your registration details...'
          }}
        </p>
      </div>
    </div>

    <transition name="reg-leave-confirm">
      <div v-if="isApplicantImageModalOpen" class="reg-notify-backdrop reg-image-modal-backdrop" role="dialog" aria-modal="true" :aria-label="imageModalTitle" @click.self="closeApplicantImageModal">
        <div class="reg-image-modal">
          <button type="button" class="reg-notify-close" aria-label="Close image preview" @click="closeApplicantImageModal">
            <i class="bi bi-x-lg" />
          </button>
          <div class="reg-image-modal__frame">
            <img :src="imageModalSource" :alt="imageModalTitle" class="reg-image-modal__image" />
          </div>
        </div>
      </div>
    </transition>

    <div class="reg-container" :class="{ 'reg-container--applicant': isApplicantRegistration, 'reg-container--employer': isEmployerRegistration }">
      <div class="reg-left">
        <template v-if="isApplicantRegistration">
          <div class="reg-left-logo-container reg-left-logo-container--applicant">
            <img :src="mathLogo" class="reg-left-logo-img" alt="PWD Platform logo" />
          </div>
          <div class="reg-left-steps">
            <p class="reg-left-steps__eyebrow">Registration Steps</p>
            <p class="reg-left-steps__display">Application</p>
            <h3 class="reg-left-steps__title">Follow each step to complete your applicant profile clearly and correctly.</h3>
            <div class="reg-left-steps__list" aria-label="Applicant registration steps">
              <div
                v-for="step in applicantRegistrationSteps"
                :key="step.id"
                class="reg-left-step-item"
                :class="{
                  active:
                    (step.id === 'personal' && applicantStep === 1 && !isInlineClientVerificationActive) ||
                    (step.id === 'verification' && applicantStep === 1 && isInlineClientVerificationActive) ||
                    (step.id === 'pwd' && applicantStep === 2) ||
                    (step.id === 'account' && applicantStep === 3),
                  done:
                    (step.id === 'personal' && (applicantStep > 1 || isInlineClientVerificationActive)) ||
                    (step.id === 'verification' && (isClientVerificationComplete || applicantStep > 1)) ||
                    (step.id === 'pwd' && applicantStep > 2),
                }"
              >
                <span class="reg-left-step-item__number">
                  <transition name="reg-step-state" mode="out-in">
                    <i
                      v-if="
                        (step.id === 'personal' && (applicantStep > 1 || isInlineClientVerificationActive)) ||
                        (step.id === 'verification' && (isClientVerificationComplete || applicantStep > 1)) ||
                        (step.id === 'pwd' && applicantStep > 2)
                      "
                      :key="`done-${step.id}`"
                      class="bi bi-check-lg"
                      aria-hidden="true"
                    />
                    <span v-else :key="`pending-${step.id}`" class="reg-left-step-item__digit">{{ step.number }}</span>
                  </transition>
                </span>
                <div class="reg-left-step-item__copy">
                  <strong>
                    <i :class="step.icon" aria-hidden="true" />
                    <span>{{ step.title }}</span>
                  </strong>
                  <small>{{ step.description }}</small>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="reg-left-employer">
            <div class="reg-left-logo-container">
              <img :src="mathLogo" class="reg-left-logo-img" alt="PWD Platform logo" />
            </div>
            <p class="reg-left-steps__eyebrow">{{ isEmployerOrganizationTypeSelected ? `${employerOrganizationTitle} Setup` : 'Employer Setup' }}</p>
            <p class="reg-left-steps__display reg-left-steps__display--compact">Employer Panel</p>
            <h3 class="reg-left-steps__title">
              {{ isEmployerOrganizationTypeSelected ? `Follow the guided flow and complete your ${employerOrganizationNoun} registration step by step.` : 'Start by choosing what you need to register, then continue with the guided employer setup.' }}
            </h3>
            <div
              v-if="isEmployerOrganizationTypeSelected"
              class="reg-left-steps__list"
              aria-label="Employer registration steps"
            >
              <div
                v-for="step in employerRegistrationSteps"
                :key="step.id"
                class="reg-left-step-item"
                :class="{
                  active: employerStep === Number(step.number),
                  done: employerStep > Number(step.number),
                }"
              >
                <span class="reg-left-step-item__number">
                  <transition name="reg-step-state" mode="out-in">
                    <i
                      v-if="employerStep > Number(step.number)"
                      :key="`done-${step.id}`"
                      class="bi bi-check-lg"
                      aria-hidden="true"
                    />
                    <span v-else :key="`pending-${step.id}`" class="reg-left-step-item__digit">{{ step.number }}</span>
                  </transition>
                </span>
                <div class="reg-left-step-item__copy">
                  <strong>
                    <i :class="step.icon" aria-hidden="true" />
                    <span>{{ step.title }}</span>
                  </strong>
                  <small>{{ step.description }}</small>
                </div>
              </div>
            </div>
            <p v-else class="reg-left-steps__helper">
              Choose your registration type on the right panel first, then we will show the correct step-by-step flow for your form.
            </p>
          </div>
        </template>
      </div>

      <div class="reg-right fade-in" :class="{ 'reg-right--applicant': isApplicantRegistration, 'reg-right--employer': isEmployerRegistration }">
        <div
          class="reg-right-inner"
          :class="{
            'reg-right-inner--applicant': isApplicantRegistration,
            'reg-right-inner--employer': isEmployerRegistration,
            'reg-right-inner--verification': isApplicantRegistration && applicantStep === 1 && isInlineClientVerificationActive,
          }"
        >
          <template v-if="shouldAnimateRegisterCopy">
            <transition name="reg-step-copy-swap" mode="out-in">
              <h2
                :key="isApplicantRegistration ? applicantStepHeader.title : employerScreenTitle"
                class="reg-form-h2"
                :class="{ 'reg-form-h2--verification': isApplicantRegistration && applicantStep === 1 && isInlineClientVerificationActive }"
              >
                {{ isApplicantRegistration ? applicantStepHeader.title : employerScreenTitle }}
              </h2>
            </transition>
            <transition name="reg-step-copy-swap" mode="out-in">
              <p
                :key="isApplicantRegistration ? applicantStepHeader.description : employerScreenDescription"
                class="reg-form-p"
                :class="{ 'reg-form-p--verification': isApplicantRegistration && applicantStep === 1 && isInlineClientVerificationActive }"
              >
                {{ isApplicantRegistration ? applicantStepHeader.description : employerScreenDescription }}
              </p>
            </transition>
          </template>
          <template v-else>
            <h2
              class="reg-form-h2"
              :class="{ 'reg-form-h2--verification': isApplicantRegistration && applicantStep === 1 && isInlineClientVerificationActive }"
            >
              {{ isApplicantRegistration ? applicantStepHeader.title : employerScreenTitle }}
            </h2>
            <p
              class="reg-form-p"
              :class="{ 'reg-form-p--verification': isApplicantRegistration && applicantStep === 1 && isInlineClientVerificationActive }"
            >
              {{ isApplicantRegistration ? applicantStepHeader.description : employerScreenDescription }}
            </p>
          </template>
          <template v-if="isApplicantRegistration">
            <div class="reg-applicant-flow">
              <transition name="reg-step-panel-swap" mode="out-in">
                <div :key="`applicant-step-${applicantStep}`" class="reg-step-panel" :class="`step-${applicantStep}`">
                <template v-if="applicantStep === 1 && !isInlineClientVerificationActive">
                <div class="reg-form-group" :class="{ 'reg-form-group--overlay-active': isDisabilityDropdownOpen || isDisabilityDropdownClosing, 'reg-form-group--error': hasApplicantFieldError('disability') }">
                  <label class="reg-field-label" for="reg-disability">Disability</label>
                  <div
                    ref="disabilityDropdownRef"
                    class="reg-input-wrapper reg-icon-group reg-disability-select"
                    :class="{ 'reg-disability-select--open': isDisabilityDropdownOpen }"
                  >
                    <i class="bi bi-universal-access reg-input-icon" />
                    <button
                      id="reg-disability"
                      type="button"
                      class="reg-disability-select__trigger"
                      :class="{ 'reg-disability-select__trigger--filled': disabilityType, 'reg-disability-select__trigger--error': hasApplicantFieldError('disability') }"
                      aria-haspopup="listbox"
                      :aria-expanded="isDisabilityDropdownOpen ? 'true' : 'false'"
                      @click="toggleDisabilityDropdown"
                      @keydown.esc.prevent="closeDisabilityDropdown"
                    >
                      <span class="reg-disability-select__value">{{ selectedDisabilityLabel }}</span>
                      <span class="reg-disability-select__caret" aria-hidden="true" />
                    </button>

                    <transition name="reg-disability-dropdown" @after-leave="finishDisabilityDropdownClose">
                      <div
                        v-if="isDisabilityDropdownOpen"
                        class="reg-disability-select__menu"
                        role="listbox"
                        aria-label="PWD Category"
                      >
                        <button
                          v-for="option in PWD_DISABILITY_TYPES"
                          :key="option"
                          type="button"
                          class="reg-disability-select__option"
                          :class="{ 'reg-disability-select__option--active': disabilityType === option }"
                          role="option"
                          :aria-selected="disabilityType === option ? 'true' : 'false'"
                          @click="selectDisabilityOption(option)"
                        >
                          <span class="reg-disability-select__option-mark" aria-hidden="true" />
                          <span>{{ option }}</span>
                        </button>
                      </div>
                    </transition>
                  </div>
                </div>

                <div class="reg-grid-2" :class="{ 'reg-grid--under-overlay': isDisabilityDropdownOpen || isDisabilityDropdownClosing }">
                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('firstName') }">
                    <label class="reg-field-label" for="reg-first-name">First Name</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-person-fill reg-input-icon" />
                      <input
                        id="reg-first-name"
                        :value="firstName"
                        type="text"
                        placeholder="First name"
                        :maxlength="MAX_NAME_LENGTH"
                        autocomplete="given-name"
                        @input="handleFirstNameInput($event)"
                      />
                    </div>
                  </div>
                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('lastName') }">
                    <label class="reg-field-label" for="reg-last-name">Last Name</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-person-badge-fill reg-input-icon" />
                      <input
                        id="reg-last-name"
                        :value="lastName"
                        type="text"
                        placeholder="Last name"
                        :maxlength="MAX_NAME_LENGTH"
                        autocomplete="family-name"
                        @input="handleLastNameInput($event)"
                      />
                    </div>
                  </div>
                </div>

                <div class="reg-grid-3" :class="{ 'reg-grid--under-overlay': isDisabilityDropdownOpen || isDisabilityDropdownClosing }">
                  <div class="reg-form-group" :class="{ 'reg-form-group--overlay-active': isSexDropdownOpen || isSexDropdownClosing, 'reg-form-group--error': hasApplicantFieldError('sex') }">
                    <label class="reg-field-label" for="reg-sex">Gender</label>
                    <div
                      ref="sexDropdownRef"
                      class="reg-input-wrapper reg-icon-group reg-disability-select"
                      :class="{ 'reg-disability-select--open': isSexDropdownOpen || isSexDropdownClosing }"
                    >
                      <i class="bi bi-gender-ambiguous reg-input-icon" />
                      <button
                        id="reg-sex"
                        type="button"
                        class="reg-disability-select__trigger"
                        :class="{ 'reg-disability-select__trigger--filled': sex, 'reg-disability-select__trigger--error': hasApplicantFieldError('sex') }"
                        aria-haspopup="listbox"
                        :aria-expanded="isSexDropdownOpen ? 'true' : 'false'"
                        @click="toggleSexDropdown"
                        @keydown.esc.prevent="closeSexDropdown"
                      >
                        <span class="reg-disability-select__value">{{ selectedSexLabel }}</span>
                        <span class="reg-disability-select__caret" aria-hidden="true" />
                      </button>

                      <transition name="reg-dropdown" @after-leave="finishSexDropdownClose">
                        <div
                          v-if="isSexDropdownOpen"
                          class="reg-disability-select__menu"
                          role="listbox"
                          aria-label="Gender"
                        >
                          <button
                            v-for="option in sexOptions"
                            :key="option.value"
                            type="button"
                            class="reg-disability-select__option"
                            :class="{ 'reg-disability-select__option--active': sex === option.value }"
                            role="option"
                            :aria-selected="sex === option.value ? 'true' : 'false'"
                            @click="selectSexOption(option.value)"
                          >
                            <span class="reg-disability-select__option-mark" aria-hidden="true" />
                            <span>{{ option.label }}</span>
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div class="reg-form-group">
                    <label class="reg-field-label" for="reg-age">Age</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-person-lines-fill reg-input-icon" />
                      <input id="reg-age" :value="computedAge" type="text" readonly />
                    </div>
                  </div>
                  <div class="reg-form-group" :class="{ 'reg-form-group--overlay-active': isBirthDatePickerOpen || isBirthDatePickerClosing, 'reg-form-group--error': hasApplicantFieldError('birthDate') }">
                    <label class="reg-field-label" for="reg-birth-date">Birth Date</label>
                    <div
                      ref="birthDatePickerRef"
                      class="reg-input-wrapper reg-icon-group reg-date-picker reg-date-picker--upward"
                      :class="{ 'reg-date-picker--open': isBirthDatePickerOpen || isBirthDatePickerClosing }"
                    >
                      <div class="reg-date-picker__field" :class="{ 'reg-date-picker__field--error': hasApplicantFieldError('birthDate') }">
                        <button
                          type="button"
                          class="reg-date-picker__toggle"
                          aria-label="Open birth date calendar"
                          aria-haspopup="dialog"
                          :aria-expanded="isBirthDatePickerOpen ? 'true' : 'false'"
                          @click="toggleBirthDatePicker"
                          @keydown.esc.prevent="closeBirthDatePicker"
                        >
                          <i class="bi bi-calendar3 reg-date-picker__icon" aria-hidden="true" />
                        </button>
                        <input
                          id="reg-birth-date"
                          type="text"
                          class="reg-date-picker__input"
                          :value="birthDateInput"
                          placeholder="mm/dd/yyyy"
                          inputmode="numeric"
                          autocomplete="bday"
                          @input="handleBirthDateInputChange($event)"
                          @blur="handleBirthDateInputBlur"
                          @keydown.esc.prevent="closeBirthDatePicker"
                        />
                      </div>

                      <transition name="reg-dropdown" @after-leave="finishBirthDatePickerClose">
                        <div
                          v-if="isBirthDatePickerOpen"
                          class="reg-date-picker__panel"
                          role="dialog"
                          aria-label="Select birth date"
                        >
                          <div class="reg-date-picker__header">
                            <button type="button" class="reg-date-picker__nav" aria-label="Previous month" @click="showPreviousBirthMonth">
                              <i class="bi bi-chevron-left" />
                            </button>
                            <div class="reg-date-picker__header-center">
                              <div class="reg-date-picker__select-group">
                                <button
                                  type="button"
                                  class="reg-date-picker__select-toggle"
                                  :class="{ 'reg-date-picker__select-toggle--open': isBirthMonthMenuOpen }"
                                  @click="toggleBirthMonthMenu"
                                >
                                  <span>{{ birthDateMonthLabel }}</span>
                                  <i class="bi bi-chevron-down" />
                                </button>

                                <transition name="reg-dropdown">
                                  <div v-if="isBirthMonthMenuOpen" class="reg-date-picker__select-menu reg-date-picker__select-menu--months">
                                    <button
                                      v-for="(month, index) in birthDateMonthOptions"
                                      :key="month"
                                      type="button"
                                      class="reg-date-picker__select-option"
                                      :class="{ 'reg-date-picker__select-option--active': index === birthDateCalendarMonth.getMonth() }"
                                      @click="selectBirthMonth(index)"
                                    >
                                      {{ month }}
                                    </button>
                                  </div>
                                </transition>
                              </div>

                              <div class="reg-date-picker__select-group">
                                <button
                                  type="button"
                                  class="reg-date-picker__select-toggle"
                                  :class="{ 'reg-date-picker__select-toggle--open': isBirthYearMenuOpen }"
                                  @click="toggleBirthYearMenu"
                                >
                                  <span>{{ birthDateYearLabel }}</span>
                                  <i class="bi bi-chevron-down" />
                                </button>

                                <transition name="reg-dropdown">
                                  <div v-if="isBirthYearMenuOpen" class="reg-date-picker__select-menu reg-date-picker__select-menu--years">
                                    <button
                                      v-for="year in birthDateYearOptions"
                                      :key="year"
                                      type="button"
                                      class="reg-date-picker__select-option"
                                      :class="{ 'reg-date-picker__select-option--active': year === birthDateCalendarMonth.getFullYear() }"
                                      @click="selectBirthYear(year)"
                                    >
                                      {{ year }}
                                    </button>
                                  </div>
                                </transition>
                              </div>
                            </div>
                            <button
                              type="button"
                              class="reg-date-picker__nav"
                              aria-label="Next month"
                              :disabled="!canGoNextBirthMonth"
                              @click="showNextBirthMonth"
                            >
                              <i class="bi bi-chevron-right" />
                            </button>
                          </div>

                          <div class="reg-date-picker__weekdays" aria-hidden="true">
                            <span v-for="day in birthDateWeekdays" :key="day">{{ day }}</span>
                          </div>

                          <div class="reg-date-picker__grid">
                            <button
                              v-for="day in birthDateCalendarDays"
                              :key="day.iso"
                              type="button"
                              class="reg-date-picker__day"
                              :class="{
                                'reg-date-picker__day--muted': !day.isCurrentMonth,
                                'reg-date-picker__day--selected': day.isSelected,
                                'reg-date-picker__day--today': day.isToday,
                              }"
                              :disabled="day.isFuture"
                              @click="selectBirthDate(day.iso, day.isFuture)"
                            >
                              {{ day.label }}
                            </button>
                          </div>

                          <div class="reg-date-picker__actions">
                            <button type="button" class="reg-date-picker__action" @click="clearBirthDate">Clear</button>
                            <button type="button" class="reg-date-picker__action reg-date-picker__action--primary" @click="jumpBirthDateToTodayMonth">Today</button>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </div>
                </div>

                <div class="reg-grid-2" :class="{ 'reg-grid--under-overlay': isDisabilityDropdownOpen || isDisabilityDropdownClosing }">
                  <div class="reg-form-group">
                    <label class="reg-field-label" for="reg-province">Address Province</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-pin-map-fill reg-input-icon" />
                      <input id="reg-province" v-model="addressProvince" type="text" readonly />
                    </div>
                  </div>
                  <div class="reg-form-group">
                    <label class="reg-field-label" for="reg-city">City / Municipality</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-geo-alt-fill reg-input-icon" />
                      <input id="reg-city" v-model="addressCity" type="text" readonly />
                    </div>
                  </div>
                </div>

                <div
                  class="reg-form-group"
                  :class="{
                    'reg-form-group--overlay-active': isBarangayDropdownOpen || isBarangayDropdownClosing,
                    'reg-form-group--under-overlay': isDisabilityDropdownOpen || isDisabilityDropdownClosing,
                    'reg-form-group--error': hasApplicantFieldError('barangay'),
                  }"
                >
                  <label class="reg-field-label" for="reg-barangay">Barangay (Dasmarinas)</label>
                  <div
                    ref="barangayDropdownRef"
                    class="reg-input-wrapper reg-icon-group reg-disability-select reg-disability-select--upward"
                    :class="{ 'reg-disability-select--open': isBarangayDropdownOpen || isBarangayDropdownClosing }"
                  >
                    <i class="bi bi-signpost-split-fill reg-input-icon" />
                    <button
                      id="reg-barangay"
                      type="button"
                      class="reg-disability-select__trigger"
                      :class="{ 'reg-disability-select__trigger--filled': addressBarangay, 'reg-disability-select__trigger--error': hasApplicantFieldError('barangay') }"
                      aria-haspopup="listbox"
                      :aria-expanded="isBarangayDropdownOpen ? 'true' : 'false'"
                      @click="toggleBarangayDropdown"
                      @keydown.esc.prevent="closeBarangayDropdown"
                    >
                      <span class="reg-disability-select__value">{{ selectedBarangayLabel }}</span>
                      <span class="reg-disability-select__caret" aria-hidden="true" />
                    </button>

                    <transition name="reg-dropdown" @after-leave="finishBarangayDropdownClose">
                      <div
                        v-if="isBarangayDropdownOpen"
                        class="reg-disability-select__menu"
                        role="listbox"
                        aria-label="Barangay"
                      >
                        <button
                          v-for="barangay in DASMA_BARANGAYS"
                          :key="barangay"
                          type="button"
                          class="reg-disability-select__option"
                          :class="{ 'reg-disability-select__option--active': addressBarangay === barangay }"
                          role="option"
                          :aria-selected="addressBarangay === barangay ? 'true' : 'false'"
                          @click="selectBarangayOption(barangay)"
                        >
                          <span class="reg-disability-select__option-mark" aria-hidden="true" />
                          <span>{{ barangay }}</span>
                        </button>
                      </div>
                    </transition>
                  </div>
                </div>
                </template>

                <template v-else-if="applicantStep === 1 && isInlineClientVerificationActive">
                <div class="reg-step-verify">
                  <FaceVerify
                    ref="applicantVerificationPanelRef"
                    standalone
                    :has-selfie="Boolean(applicantProfileImage)"
                    :is-complete="isClientVerificationComplete"
                    :auto-start="isInlineClientVerificationActive"
                    header-eyebrow=""
                    header-title=""
                    header-description=""
                    @selfie-selected="handleVerificationSelfieSelected"
                    @complete="handleClientVerificationComplete"
                  />
                </div>
                </template>

                <template v-else-if="applicantStep === 2">
                <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('contactNumber') }">
                  <label class="reg-field-label" for="reg-contact-number">Contact Number</label>
                  <div class="reg-input-wrapper reg-icon-group reg-phone-wrap" :class="{ 'reg-phone-wrap--error': hasApplicantFieldError('contactNumber') }">
                    <div
                      ref="contactCountryDropdownRef"
                      class="reg-disability-select reg-phone-country-dropdown"
                      :class="{ 'reg-disability-select--open': isContactCountryDropdownOpen || isContactCountryDropdownClosing }"
                    >
                      <button
                        type="button"
                        class="reg-disability-select__trigger reg-phone-country-dropdown__trigger"
                        :class="{ 'reg-disability-select__trigger--filled': contactCountryCode }"
                        aria-haspopup="listbox"
                        :aria-expanded="isContactCountryDropdownOpen ? 'true' : 'false'"
                        @click="toggleContactCountryDropdown"
                        @keydown="handleContactCountryTypeahead"
                        @keydown.esc.prevent="closeContactCountryDropdown"
                      >
                        <span class="reg-disability-select__value reg-phone-country-dropdown__value">
                          <span :class="getCountryFlagClass(contactCountryCode)" class="reg-country-flag" aria-hidden="true" />
                          <span>{{ selectedPhoneCountry.code }} {{ selectedPhoneCountry.dial }}</span>
                        </span>
                        <span class="reg-disability-select__caret" aria-hidden="true" />
                      </button>

                      <transition name="reg-dropdown" @after-leave="finishContactCountryDropdownClose">
                        <div
                          v-if="isContactCountryDropdownOpen"
                          class="reg-disability-select__menu reg-phone-country-dropdown__menu"
                          role="listbox"
                          aria-label="Country code"
                        >
                          <button
                            v-for="country in filteredPhoneCountries"
                            :key="country.code"
                            type="button"
                            class="reg-disability-select__option"
                            :class="{ 'reg-disability-select__option--active': contactCountryCode === country.code }"
                            role="option"
                            :aria-selected="contactCountryCode === country.code ? 'true' : 'false'"
                            @keydown="handleContactCountryTypeahead"
                            @click="selectContactCountryOption(country.code)"
                          >
                            <span class="reg-disability-select__option-mark" aria-hidden="true" />
                            <span class="reg-phone-country-dropdown__value">
                              <span :class="getCountryFlagClass(country.code)" class="reg-country-flag" aria-hidden="true" />
                              <span>{{ country.code }} {{ country.dial }}</span>
                            </span>
                          </button>
                          <div v-if="!filteredPhoneCountries.length" class="reg-phone-country-dropdown__empty">
                            No country match
                          </div>
                        </div>
                      </transition>
                    </div>
                    <input
                      id="reg-contact-number"
                      type="text"
                      :value="formatContactNumberDisplay(contactNumber.replace(selectedPhoneCountry.dial, ''))"
                      placeholder="Enter contact number"
                      inputmode="tel"
                      maxlength="12"
                      @input="handleContactNumberChange($event)"
                    />
                  </div>
                </div>

                <div class="reg-form-group">
                  <label class="reg-field-label">PWD ID</label>
                  <div class="reg-upload-pair">
                    <div class="reg-upload-card reg-upload-card--document" tabindex="0" @paste.prevent="handleApplicantPwdIdChange($event, 'front')">
                      <div class="reg-upload-preview reg-upload-preview--empty reg-upload-preview--document" aria-hidden="true">
                        <i class="bi bi-person-vcard" />
                      </div>
                      <div class="reg-upload-copy">
                        <p class="reg-upload-title">{{ applicantPwdIdFrontFile ? applicantPwdIdFrontFile.name : 'Front of PWD ID' }}</p>
                        <p class="reg-upload-subtitle">Accepted formats: PDF, JPG, PNG, WEBP. Maximum size: 5MB.</p>
                        <p v-if="applicantPwdIdFrontError" class="reg-upload-error">{{ applicantPwdIdFrontError }}</p>
                      </div>
                      <div class="reg-upload-actions">
                        <label v-if="!applicantPwdIdFrontFile" class="reg-upload-btn" for="reg-pwd-id-front-file">Upload</label>
                        <button v-if="applicantPwdIdFrontFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="viewApplicantPwdIdFile('front')">View Image</button>
                        <button v-if="applicantPwdIdFrontFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="removeApplicantPwdIdFile('front', $event)">Remove</button>
                      </div>
                      <input
                        id="reg-pwd-id-front-file"
                        class="reg-upload-input"
                        type="file"
                        accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp"
                        @change="handleApplicantPwdIdChange($event, 'front')"
                      />
                    </div>

                    <div class="reg-upload-card reg-upload-card--document" tabindex="0" @paste.prevent="handleApplicantPwdIdChange($event, 'back')">
                      <div class="reg-upload-preview reg-upload-preview--empty reg-upload-preview--document" aria-hidden="true">
                        <i class="bi bi-person-vcard-fill" />
                      </div>
                      <div class="reg-upload-copy">
                        <p class="reg-upload-title">{{ applicantPwdIdBackFile ? applicantPwdIdBackFile.name : 'Back of PWD ID' }}</p>
                        <p class="reg-upload-subtitle">Accepted formats: PDF, JPG, PNG, WEBP. Maximum size: 5MB.</p>
                        <p v-if="applicantPwdIdBackError" class="reg-upload-error">{{ applicantPwdIdBackError }}</p>
                      </div>
                      <div class="reg-upload-actions">
                        <label v-if="!applicantPwdIdBackFile" class="reg-upload-btn" for="reg-pwd-id-back-file">Upload</label>
                        <button v-if="applicantPwdIdBackFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="viewApplicantPwdIdFile('back')">View Image</button>
                        <button v-if="applicantPwdIdBackFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="removeApplicantPwdIdFile('back', $event)">Remove</button>
                      </div>
                      <input
                        id="reg-pwd-id-back-file"
                        class="reg-upload-input"
                        type="file"
                        accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp"
                        @change="handleApplicantPwdIdChange($event, 'back')"
                      />
                    </div>
                  </div>
                </div>

                <div class="reg-form-group">
                  <label class="reg-field-label" for="reg-resume-file">Resume File</label>
                  <div class="reg-upload-card reg-upload-card--document" tabindex="0" @paste.prevent="handleApplicantResumeChange($event)">
                    <div class="reg-upload-preview reg-upload-preview--empty reg-upload-preview--document" aria-hidden="true">
                      <i class="bi bi-file-earmark-pdf" />
                    </div>
                    <div class="reg-upload-copy">
                      <p class="reg-upload-title">{{ applicantResumeFile ? applicantResumeFile.name : 'Upload applicant resume' }}</p>
                      <p class="reg-upload-subtitle">Accepted format: PDF. Maximum size: 5MB.</p>
                      <p v-if="applicantResumeError" class="reg-upload-error">{{ applicantResumeError }}</p>
                    </div>
                    <div class="reg-upload-actions">
                      <label class="reg-upload-btn" for="reg-resume-file">Choose PDF</label>
                      <button v-if="applicantResumeFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="viewApplicantResume">View PDF</button>
                      <button v-if="applicantResumeFile" type="button" class="reg-upload-btn reg-upload-btn--ghost" @click="removeApplicantResume">Remove</button>
                    </div>
                    <input id="reg-resume-file" class="reg-upload-input" type="file" accept="application/pdf,.pdf" @change="handleApplicantResumeChange" />
                  </div>
                </div>

                <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('preferredLanguage') }">
                  <label class="reg-field-label" for="reg-language">Language</label>
                  <div
                    ref="languageDropdownRef"
                    class="reg-input-wrapper reg-icon-group reg-disability-select reg-disability-select--upward"
                    :class="{ 'reg-disability-select--open': isLanguageDropdownOpen || isLanguageDropdownClosing }"
                  >
                    <i class="bi bi-translate reg-input-icon" />
                    <button
                      id="reg-language"
                      type="button"
                      class="reg-disability-select__trigger"
                      :class="{ 'reg-disability-select__trigger--filled': preferredLanguage, 'reg-disability-select__trigger--error': hasApplicantFieldError('preferredLanguage') }"
                      aria-haspopup="listbox"
                      :aria-expanded="isLanguageDropdownOpen ? 'true' : 'false'"
                      @click="toggleLanguageDropdown"
                      @keydown.esc.prevent="closeLanguageDropdown"
                    >
                      <span class="reg-disability-select__value">{{ selectedLanguageLabel }}</span>
                      <span class="reg-disability-select__caret" aria-hidden="true" />
                    </button>

                    <transition name="reg-dropdown" @after-leave="finishLanguageDropdownClose">
                      <div
                        v-if="isLanguageDropdownOpen"
                        class="reg-disability-select__menu"
                        role="listbox"
                        aria-label="Language"
                      >
                        <button
                          v-for="option in languageOptions"
                          :key="option"
                          type="button"
                          class="reg-disability-select__option"
                          :class="{ 'reg-disability-select__option--active': preferredLanguage === option }"
                          role="option"
                          :aria-selected="preferredLanguage === option ? 'true' : 'false'"
                          @click="selectLanguageOption(option)"
                        >
                          <span class="reg-disability-select__option-mark" aria-hidden="true" />
                          <span>{{ option }}</span>
                        </button>
                      </div>
                    </transition>
                  </div>
                </div>
                </template>

                <template v-else>
                <div class="reg-step-3-layout">
                  <div class="reg-step-3-fields">
                    <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('email') }">
                      <label class="reg-field-label" for="reg-email">Email</label>
                      <div class="reg-input-wrapper reg-icon-group">
                        <i class="bi bi-envelope-fill reg-input-icon" />
                        <input id="reg-email" v-model="email" type="email" placeholder="Enter email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" @input="handleEmailInput" />
                      </div>
                    </div>
                    <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('password') }">
                      <label class="reg-field-label" for="reg-password">Password</label>
                      <div class="reg-password-wrapper reg-icon-group">
                        <i class="bi bi-lock-fill reg-input-icon" />
                        <input id="reg-password" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Enter password" autocomplete="new-password" :maxlength="MAX_PASSWORD_LENGTH" />
                        <button type="button" class="reg-toggle-eye" @click="togglePasswordVisibility"><i :class="showPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'" /></button>
                      </div>
                    </div>
                    <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('confirmPassword') }">
                      <label class="reg-field-label" for="reg-confirm-password">Confirm Password</label>
                      <div class="reg-password-wrapper reg-icon-group">
                        <i class="bi bi-shield-lock-fill reg-input-icon" />
                        <input id="reg-confirm-password" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" placeholder="Confirm password" autocomplete="new-password" :maxlength="MAX_PASSWORD_LENGTH" />
                        <button type="button" class="reg-toggle-eye" @click="togglePasswordVisibility"><i :class="showPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'" /></button>
                      </div>
                      <p class="reg-field-help">Make sure your password and confirm password match.</p>
                    </div>
                    <div class="reg-form-group">
                      <div class="reg-password-strength" :class="`reg-password-strength--${passwordStrength.tone}`">
                        <div class="reg-password-strength__meta">
                          <span>Password strength</span>
                          <strong v-if="passwordStrength.label">{{ passwordStrength.label }}</strong>
                        </div>
                        <div class="reg-password-strength__bar" aria-hidden="true">
                          <span class="reg-password-strength__fill" :style="{ width: `${passwordStrength.percent}%` }" />
                        </div>
                      </div>
                      <div class="reg-password-inline-rules">
                        <p class="reg-password-inline-rules__title">Password must contain:</p>
                        <ul class="reg-password-inline-rules__list">
      <li :class="{ 'is-valid': rules.length, 'is-invalid': shouldShowPasswordRuleFeedback && !rules.length }">8 to 16 characters</li>
      <li :class="{ 'is-valid': passwordChecks.lower, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.lower }">At least one lowercase letter (a-z)</li>
      <li :class="{ 'is-valid': passwordChecks.upper, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.upper }">At least one uppercase letter (A-Z)</li>
      <li :class="{ 'is-valid': passwordChecks.number, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.number }">At least one number (0-9)</li>
      <li :class="{ 'is-valid': passwordChecks.special, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.special }">At least one special character</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="reg-rules reg-rules-side">
                    <strong>Your password must contain:</strong>
                    <ul>
                      <li :class="{ valid: rules.length, invalid: shouldShowPasswordRuleFeedback && !rules.length }">8 to 16 characters</li>
                      <li :class="{ valid: rules.categoriesMet, invalid: shouldShowPasswordRuleFeedback && !rules.categoriesMet }">All of the following:</li>
                    </ul>
                    <ul class="sub-rules">
                      <li :class="{ valid: passwordChecks.lower, invalid: shouldShowPasswordRuleFeedback && !passwordChecks.lower }">Lower case letters (a-z)</li>
                      <li :class="{ valid: passwordChecks.upper, invalid: shouldShowPasswordRuleFeedback && !passwordChecks.upper }">Upper case letters (A-Z)</li>
                      <li :class="{ valid: passwordChecks.number, invalid: shouldShowPasswordRuleFeedback && !passwordChecks.number }">Numbers (0-9)</li>
                      <li :class="{ valid: passwordChecks.special, invalid: shouldShowPasswordRuleFeedback && !passwordChecks.special }">Special characters (e.g. !@#$%^&*)</li>
                    </ul>
                    <ul>
                      <li :class="{ valid: rules.noTripleRepeat, invalid: shouldShowPasswordRuleFeedback && !rules.noTripleRepeat }">No more than 2 identical characters in a row</li>
                      <li :class="{ valid: rules.match, invalid: shouldShowPasswordRuleFeedback && !rules.match }">Passwords match</li>
                    </ul>
                  </div>
                </div>

                <div class="reg-terms-check" :class="{ 'reg-terms-check--error': hasApplicantFieldError('terms') }">
                  <label class="reg-terms-label">
                    <input v-model="agreedToTerms" type="checkbox" />
                    <span>
                      I agree to the
                      <a href="/support/privacy-policy" target="_blank" rel="noopener noreferrer"> Privacy Terms </a>
                      and
                      <a href="/support/terms-of-use" target="_blank" rel="noopener noreferrer"> Agreement Terms </a>.
                    </span>
                  </label>
                </div>
                </template>
              </div>
              </transition>

              <div class="reg-step-actions reg-step-actions--applicant">
                <button v-if="applicantStep > 1" type="button" class="reg-btn reg-btn-secondary" @click="prevApplicantStep">Back</button>
                <button v-if="applicantStep < 3 && !(applicantStep === 1 && isInlineClientVerificationActive)" type="button" class="reg-btn" :disabled="stepTransitionLoading" @click="nextApplicantStep"><span>{{ stepTransitionLoading ? 'Loading...' : 'Next Step' }}</span></button>
                <button v-if="applicantStep === 3" class="reg-btn" type="button" :disabled="loading" @click="register"><span><i class="bi bi-person-plus-fill" /> Register</span></button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="reg-company-form">
              <div class="reg-company-step-card">
                <transition name="reg-step-panel-swap" mode="out-in">
                  <div :key="employerPanelTransitionKey" class="reg-employer-panel-view">
                <template v-if="isEmployerTypeTransitioning">
                  <div
                    class="reg-employer-type-loading-center"
                    role="status"
                    aria-live="polite"
                    aria-label="Loading next employer registration step"
                  >
                    <span class="reg-employer-type-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </template>

                <template v-else-if="employerStep === 1">
                  <div class="reg-employer-step-panel reg-employer-step-panel--enter">
                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyName') }">
                    <label class="reg-field-label" for="reg-company-name">{{ employerOrganizationNameLabel }}</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-buildings-fill reg-input-icon" />
                      <input
                        id="reg-company-name"
                        :value="companyName"
                        type="text"
                        :placeholder="employerOrganizationNamePlaceholder"
                        autocomplete="off"
                        autocapitalize="words"
                        spellcheck="false"
                        @input="handleEmployerCompanyNameInput"
                      />
                    </div>
                  </div>

                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyLocation') }">
                    <label class="reg-field-label" for="reg-company-location">{{ employerOrganizationAddressLabel }}</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-geo-alt-fill reg-input-icon" />
                      <input
                        id="reg-company-location"
                        :value="employerStreetAddress"
                        type="text"
                        :placeholder="employerOrganizationAddressPlaceholder"
                        autocomplete="off"
                        autocapitalize="words"
                        spellcheck="false"
                        @input="handleEmployerStreetAddressInput"
                      />
                    </div>
                    <p class="reg-field-help">Street / building / unit only. Barangay is selected below.</p>
                  </div>

                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyLocation') }">
                    <label class="reg-field-label" for="reg-company-barangay">Barangay (Dasmarinas)</label>
                    <div
                      ref="employerBarangayDropdownRef"
                      class="reg-input-wrapper reg-icon-group reg-disability-select"
                      :class="{ 'reg-disability-select--open': isEmployerBarangayDropdownOpen || isEmployerBarangayDropdownClosing }"
                    >
                      <i class="bi bi-pin-map-fill reg-input-icon" />
                      <button
                        id="reg-company-barangay"
                        type="button"
                        class="reg-disability-select__trigger"
                        :class="{ 'reg-disability-select__trigger--filled': employerBarangay, 'reg-disability-select__trigger--error': hasApplicantFieldError('companyLocation') }"
                        aria-haspopup="listbox"
                        :aria-expanded="isEmployerBarangayDropdownOpen ? 'true' : 'false'"
                        @click="toggleEmployerBarangayDropdown"
                        @keydown.esc.prevent="closeEmployerBarangayDropdown"
                      >
                        <span class="reg-disability-select__value">{{ selectedEmployerBarangayLabel }}</span>
                        <span class="reg-disability-select__caret" aria-hidden="true" />
                      </button>

                      <transition name="reg-dropdown" @after-leave="finishEmployerBarangayDropdownClose">
                        <div
                          v-if="isEmployerBarangayDropdownOpen"
                          class="reg-disability-select__menu"
                          role="listbox"
                          aria-label="Employer barangay"
                        >
                          <button
                            v-for="barangay in DASMA_BARANGAYS"
                            :key="`employer-${barangay}`"
                            type="button"
                            class="reg-disability-select__option"
                            :class="{ 'reg-disability-select__option--active': employerBarangay === barangay }"
                            role="option"
                            :aria-selected="employerBarangay === barangay ? 'true' : 'false'"
                            @click="selectEmployerBarangayOption(barangay)"
                          >
                            <span class="reg-disability-select__option-mark" aria-hidden="true" />
                            <span>{{ barangay }}</span>
                          </button>
                        </div>
                      </transition>
                    </div>
                    <p class="reg-field-help">Saved address preview: {{ companyLocation || 'Street, Barangay, Dasmarinas, Cavite' }}</p>
                  </div>

                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyContactNumber') }">
                    <label class="reg-field-label" for="reg-company-contact-number">Contact Number</label>
                    <div class="reg-input-wrapper reg-icon-group reg-phone-wrap" :class="{ 'reg-phone-wrap--error': hasApplicantFieldError('companyContactNumber') }">
                      <div
                        ref="employerContactCountryDropdownRef"
                        class="reg-disability-select reg-phone-country-dropdown"
                        :class="{ 'reg-disability-select--open': isEmployerContactCountryDropdownOpen || isEmployerContactCountryDropdownClosing }"
                      >
                        <button
                          type="button"
                          class="reg-disability-select__trigger reg-phone-country-dropdown__trigger"
                          :class="{ 'reg-disability-select__trigger--filled': employerContactCountryCode }"
                          aria-haspopup="listbox"
                          :aria-expanded="isEmployerContactCountryDropdownOpen ? 'true' : 'false'"
                          @click="toggleEmployerContactCountryDropdown"
                          @keydown="handleEmployerContactCountryTypeahead"
                          @keydown.esc.prevent="closeEmployerContactCountryDropdown"
                        >
                          <span class="reg-disability-select__value reg-phone-country-dropdown__value">
                            <span :class="getCountryFlagClass(employerContactCountryCode)" class="reg-country-flag" aria-hidden="true" />
                            <span>{{ selectedEmployerPhoneCountry.code }} {{ selectedEmployerPhoneCountry.dial }}</span>
                          </span>
                          <span class="reg-disability-select__caret" aria-hidden="true" />
                        </button>

                        <transition name="reg-dropdown" @after-leave="finishEmployerContactCountryDropdownClose">
                          <div
                            v-if="isEmployerContactCountryDropdownOpen"
                            class="reg-disability-select__menu reg-phone-country-dropdown__menu"
                            role="listbox"
                            aria-label="Company contact country"
                          >
                            <button
                              v-for="country in filteredEmployerPhoneCountries"
                              :key="country.code"
                              type="button"
                              class="reg-disability-select__option"
                              :class="{ 'reg-disability-select__option--active': employerContactCountryCode === country.code }"
                              role="option"
                              :aria-selected="employerContactCountryCode === country.code ? 'true' : 'false'"
                              @keydown="handleEmployerContactCountryTypeahead"
                              @click="selectEmployerContactCountryOption(country.code)"
                            >
                              <span class="reg-disability-select__option-mark" aria-hidden="true" />
                              <span class="reg-phone-country-dropdown__value">
                                <span :class="getCountryFlagClass(country.code)" class="reg-country-flag" aria-hidden="true" />
                                <span>{{ country.code }} {{ country.dial }}</span>
                              </span>
                            </button>
                            <div v-if="!filteredEmployerPhoneCountries.length" class="reg-phone-country-dropdown__empty">
                              No country match
                            </div>
                          </div>
                        </transition>
                      </div>
                      <input
                        id="reg-company-contact-number"
                        type="text"
                        :value="formatContactNumberDisplay(companyContactNumber.replace(selectedEmployerPhoneCountry.dial, ''))"
                        :placeholder="employerOrganizationContactPlaceholder"
                        inputmode="tel"
                        maxlength="12"
                        autocomplete="tel"
                        @input="handleEmployerContactNumberChange($event)"
                      />
                    </div>
                    <p class="reg-field-help">Choose a country code, then enter the 10-digit contact number.</p>
                  </div>

                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyCategory') }">
                    <label class="reg-field-label" for="reg-company-category">Industry</label>
                    <div
                      ref="employerCategoryDropdownRef"
                      class="reg-input-wrapper reg-icon-group reg-disability-select reg-disability-select--upward"
                      :class="{ 'reg-disability-select--open': isEmployerCategoryDropdownOpen || isEmployerCategoryDropdownClosing }"
                    >
                      <i class="bi bi-briefcase-fill reg-input-icon" />
                      <button
                        id="reg-company-category"
                        type="button"
                        class="reg-disability-select__trigger"
                        :class="{ 'reg-disability-select__trigger--filled': companyCategory, 'reg-disability-select__trigger--error': hasApplicantFieldError('companyCategory') }"
                        aria-haspopup="listbox"
                        :aria-expanded="isEmployerCategoryDropdownOpen ? 'true' : 'false'"
                        @click="toggleEmployerCategoryDropdown"
                        @keydown.esc.prevent="closeEmployerCategoryDropdown"
                      >
                        <span class="reg-disability-select__value">{{ selectedEmployerCategoryLabel }}</span>
                        <span class="reg-disability-select__caret" aria-hidden="true" />
                      </button>

                      <transition name="reg-dropdown" @after-leave="finishEmployerCategoryDropdownClose">
                        <div
                          v-if="isEmployerCategoryDropdownOpen"
                          class="reg-disability-select__menu"
                          role="listbox"
                          aria-label="Industry"
                        >
                          <button
                            v-for="option in employerCategoryOptions"
                            :key="option"
                            type="button"
                            class="reg-disability-select__option"
                            :class="{ 'reg-disability-select__option--active': companyCategory === option }"
                            role="option"
                            :aria-selected="companyCategory === option ? 'true' : 'false'"
                            @click="selectEmployerCategoryOption(option)"
                          >
                            <span class="reg-disability-select__option-mark" aria-hidden="true" />
                            <span>{{ option }}</span>
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  </div>

                </template>

                <template v-else-if="employerStep === 2">
                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('companyVerificationDocument') }">
                    <label class="reg-field-label">
                      {{ employerOrganizationTitle }} Verification Documents
                    </label>
                    <p class="reg-field-help reg-field-help--compact">Upload 3 supporting document images for verification. Accepted formats: PNG or JPEG. Maximum size: 10MB each.</p>
                    <div class="reg-employer-proof-board">
                      <p class="reg-employer-proof-board__title">Required Documents</p>
                      <div class="reg-employer-proof-list">
                      <div
                        v-for="(label, index) in employerVerificationDocumentLabels"
                        :key="label"
                        class="reg-upload-card reg-upload-card--document reg-upload-card--employer-proof"
                        :class="`reg-upload-card--${companyVerificationDocumentStatuses[index]}`"
                      >
                        <button
                          class="reg-upload-preview reg-upload-preview--document reg-upload-preview--employer-proof"
                          :class="{ 'reg-upload-preview--empty': !companyVerificationDocumentPreviews[index] }"
                          type="button"
                          :aria-label="companyVerificationDocumentPreviews[index] ? `Preview ${label}` : `${label} preview unavailable`"
                          :disabled="!companyVerificationDocumentPreviews[index]"
                          @click="viewEmployerVerificationDocument(index)"
                        >
                          <img
                            v-if="companyVerificationDocumentPreviews[index]"
                            :src="companyVerificationDocumentPreviews[index]"
                            :alt="`${label} preview`"
                            class="reg-upload-preview__image"
                          />
                          <i v-else class="bi bi-file-earmark-arrow-up" />
                          <span
                            v-if="companyVerificationDocumentStatuses[index] === 'uploaded'"
                            class="reg-upload-preview__status-badge"
                          >
                            <i class="bi bi-check-lg" />
                          </span>
                        </button>
                        <div class="reg-upload-copy reg-upload-copy--employer-proof">
                          <p class="reg-upload-title">{{ label }}</p>
                          <p class="reg-upload-subtitle">Upload your document</p>
                          <p class="reg-upload-meta reg-upload-meta--employer-proof">PNG, JPEG only • Max 10MB</p>
                          <p v-if="companyVerificationDocumentFiles[index]" class="reg-upload-file-name">
                            {{ companyVerificationDocumentFiles[index].name }}
                          </p>
                          <p
                            v-if="companyVerificationDocumentStatuses[index] === 'checking'"
                            class="reg-upload-status"
                          >
                            <span class="reg-upload-spinner" aria-hidden="true" />
                            Checking image...
                          </p>
                          <p
                            v-else-if="companyVerificationDocumentStatuses[index] === 'uploaded'"
                            class="reg-upload-status reg-upload-status--success"
                          >
                            <i class="bi bi-check-circle-fill" />
                            Successfully uploaded
                          </p>
                          <p v-if="companyVerificationDocumentErrors[index]" class="reg-upload-error">{{ companyVerificationDocumentErrors[index] }}</p>
                        </div>
                        <div class="reg-upload-actions reg-upload-actions--employer-proof">
                          <label class="reg-upload-btn" :for="`reg-company-verification-document-${index + 1}`">
                            <i class="bi bi-upload" />
                            <span>{{ companyVerificationDocumentFiles[index] ? 'Replace Image' : 'Upload Image' }}</span>
                          </label>
                          <button
                            v-if="companyVerificationDocumentFiles[index]"
                            type="button"
                            class="reg-upload-btn reg-upload-btn--ghost"
                            @click="removeEmployerVerificationDocument(index, $event)"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          :id="`reg-company-verification-document-${index + 1}`"
                          type="file"
                          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          class="reg-hidden-input"
                          @change="handleEmployerVerificationDocumentChange(index, $event)"
                        />
                      </div>
                      </div>
                    </div>
                  </div>

                  <div class="reg-terms-check" :class="{ 'reg-terms-check--error': hasApplicantFieldError('companyVerificationCertified') }">
                    <label class="reg-terms-label">
                      <input
                        v-model="companyVerificationCertified"
                        type="checkbox"
                        @change="clearEmployerFieldError('companyVerificationCertified')"
                      />
                      <span>
                        I certify that the uploaded document is authentic, current, and may be reviewed to verify the legitimacy of this {{ employerOrganizationNoun }} registration.
                      </span>
                    </label>
                  </div>
                </template>

                <template v-else>
                  <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('email') }">
                    <label class="reg-field-label" for="reg-email-company">Email</label>
                    <div class="reg-input-wrapper reg-icon-group">
                      <i class="bi bi-envelope-fill reg-input-icon" />
                      <input id="reg-email-company" v-model="email" type="email" placeholder="Enter email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" @input="handleEmailInput" />
                    </div>
                  </div>

                  <div class="reg-company-grid-2">
                    <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('password') }">
                      <label class="reg-field-label" for="reg-password-company">Password</label>
                      <div class="reg-password-wrapper reg-icon-group">
                        <i class="bi bi-lock-fill reg-input-icon" />
                        <input id="reg-password-company" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Enter password" :maxlength="MAX_PASSWORD_LENGTH" />
                        <button type="button" class="reg-toggle-eye" @click="togglePasswordVisibility"><i :class="showPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'" /></button>
                      </div>
                    </div>
                    <div class="reg-form-group" :class="{ 'reg-form-group--error': hasApplicantFieldError('confirmPassword') }">
                      <label class="reg-field-label" for="reg-confirm-password-company">Confirm Password</label>
                      <div class="reg-password-wrapper reg-icon-group">
                        <i class="bi bi-shield-lock-fill reg-input-icon" />
                        <input id="reg-confirm-password-company" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" placeholder="Confirm password" :maxlength="MAX_PASSWORD_LENGTH" />
                        <button type="button" class="reg-toggle-eye" @click="toggleConfirmPasswordVisibility"><i :class="showConfirmPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'" /></button>
                      </div>
                    </div>
                  </div>

                  <div class="reg-password-strength" :class="`reg-password-strength--${passwordStrength.tone}`">
                    <div class="reg-password-strength__meta">
                      <span>Password strength</span>
                      <strong v-if="passwordStrength.label">{{ passwordStrength.label }}</strong>
                    </div>
                    <div class="reg-password-strength__bar" aria-hidden="true">
                      <span class="reg-password-strength__fill" :style="{ width: `${passwordStrength.percent}%` }" />
                    </div>
                  </div>

                  <div class="reg-password-inline-rules">
                    <p class="reg-password-inline-rules__title">Password must contain:</p>
                    <ul class="reg-password-inline-rules__list">
                      <li :class="{ 'is-valid': rules.length, 'is-invalid': shouldShowPasswordRuleFeedback && !rules.length }">8 to 16 characters</li>
                      <li :class="{ 'is-valid': passwordChecks.lower, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.lower }">At least one lowercase letter (a-z)</li>
                      <li :class="{ 'is-valid': passwordChecks.upper, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.upper }">At least one uppercase letter (A-Z)</li>
                      <li :class="{ 'is-valid': passwordChecks.number, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.number }">At least one number (0-9)</li>
                      <li :class="{ 'is-valid': passwordChecks.special, 'is-invalid': shouldShowPasswordRuleFeedback && !passwordChecks.special }">At least one special character</li>
                    </ul>
                  </div>
                </template>

                <div v-if="!isEmployerTypeTransitioning" class="reg-company-actions">
                  <button v-if="employerStep > 1" class="reg-btn reg-btn-secondary" type="button" :disabled="stepTransitionLoading" @click="previousEmployerStep">
                    <span>Previous</span>
                  </button>
                  <button v-if="employerStep < 3" class="reg-btn" type="button" :disabled="stepTransitionLoading" @click="nextEmployerStep">
                    <span>{{ stepTransitionLoading ? 'Loading...' : 'Next Step' }}</span>
                  </button>
                  <button v-else class="reg-btn" type="button" :disabled="loading" @click="register">
                    <span><i class="bi bi-display" /> Register</span>
                  </button>
                </div>
                  </div>
                </transition>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="isApplicantRegistration && applicantStep < 3" class="reg-form-status reg-form-status--toast" :class="{ 'reg-form-status--visible': actionStatus }">
      <span v-if="actionStatus === 'saving'" class="reg-step-status__content">
        <span class="reg-step-status__spinner" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>Saving...</span>
      </span>
      <span v-else-if="actionStatus === 'saved'" class="reg-step-status__content">
        <i class="bi bi-check-lg" aria-hidden="true" />
        <span>Saved</span>
      </span>
    </div>
  </div>
</template>

<style scoped src="@/components/register_slot.css"></style>
