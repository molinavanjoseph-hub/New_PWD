<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import heroBackgroundAlt from '@/assets/better03.png'
import heroBackground from '@/assets/better02.jpg'
import heroBackgroundPrimary from '@/assets/bettert01.png'
import logoPwd from '@/assets/logo-pwd.png'
import pwdWordmark from '@/assets/pwdlogo.png'
import { getPublicJobs, subscribeToPublicJobs } from '@/lib/jobs'

// Main landing page state
const router = useRouter()
const scrollY = ref(0)
const currentSlide = ref(0)
const currentYear = new Date().getFullYear()
const dasmarinasMapEmbedUrl =
  'https://www.openstreetmap.org/export/embed.html?bbox=120.91%2C14.28%2C120.99%2C14.36&layer=mapnik&marker=14.3294%2C120.9367'
const selectedFeaturedJobIndex = ref(0)
const heroSearchKeyword = ref('')
const heroSearchJobCategory = ref('')
const heroSearchDisabilityCategory = ref('')
const isHeroCategoryDropdownOpen = ref(false)
const isHeroDisabilityDropdownOpen = ref(false)
const isHeroSearchLoading = ref(false)
const isLoginRouteLoading = ref(false)
const featuredJobsListRef = ref(null)
const featuredJobCardRefs = ref([])
const featuredJobPosts = ref([])
const isFeaturedJobsLoading = ref(true)
const isFeaturedJobDetailsLoading = ref(false)
const isPolicyMenuOpen = ref(false)
const isMobileNavOpen = ref(false)
const isNavScrolled = computed(() => scrollY.value > 24)
const heroSlides = [heroBackgroundPrimary, heroBackground, heroBackgroundAlt]
let slideInterval
let revealObserver
let scrollFrame = 0
let heroSearchNavigateTimeout
let loginNavigateTimeout
let featuredJobDetailsTimeout
let stopPublicJobsSubscription = () => {}

// Scroll and parallax behavior
const setScrollY = () => {
  scrollFrame = 0
  scrollY.value = window.scrollY || 0
}

const handleDocumentClick = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.nav-policy')) return
  isPolicyMenuOpen.value = false

  if (target.closest('.landing-mobile-sidebar') || target.closest('.landing-mobile-nav-toggle')) return
  isMobileNavOpen.value = false

  if (!target.closest('.hero-search__dropdown')) {
    isHeroCategoryDropdownOpen.value = false
    isHeroDisabilityDropdownOpen.value = false
  }
}

const updateScroll = () => {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(setScrollY)
}

const layerStyle = (depth) =>
  computed(() => ({
    transform: `translate3d(0, ${scrollY.value * depth}px, 0)`,
  }))

const heroImageStyle = computed(() => ({
  transform: `translate3d(0, ${scrollY.value * 0.16}px, 0) scale(${1.04 + Math.min(scrollY.value, 220) * 0.00003})`,
}))
const heroAccentStyle = computed(() => ({
  transform: `translate3d(0, ${scrollY.value * 0.12}px, 0)`,
}))
const heroContentStyle = computed(() => ({
  transform: `translate3d(0, ${scrollY.value * 0.08}px, 0)`,
}))
const featuredSectionStyle = computed(() => ({
  background: '#f5f4ef',
}))

// Reveal animation helper for sections while scrolling
const getRevealDelay = (index, step = 90, base = 0) => `${base + index * step}ms`

const getRevealObserver = () => {
  if (typeof window === 'undefined') return null
  if (!('IntersectionObserver' in window)) return null
  if (revealObserver) return revealObserver

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('scroll-fade--visible')
        revealObserver?.unobserve(entry.target)
      }
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -10% 0px',
    },
  )

  return revealObserver
}

const vReveal = {
  mounted(el, binding) {
    const resolvedDelay =
      typeof binding.value === 'string' ? binding.value : `${Number(binding.value || 0)}ms`

    el.classList.add('scroll-fade')
    el.style.setProperty('--reveal-delay', resolvedDelay)

    const observer = getRevealObserver()
    if (!observer) {
      el.classList.add('scroll-fade--visible')
      return
    }

    observer.observe(el)
  },
  updated(el, binding) {
    const resolvedDelay =
      typeof binding.value === 'string' ? binding.value : `${Number(binding.value || 0)}ms`

    el.style.setProperty('--reveal-delay', resolvedDelay)
  },
  unmounted(el) {
    revealObserver?.unobserve(el)
  },
}

const policyLinks = [
  { label: 'Help Center', href: '/support/help-center' },
  { label: 'Terms of Use', href: '/support/terms-of-use' },
  { label: 'Privacy Policy', href: '/support/privacy-policy' },
]

// Header and mobile navigation links
const navLinks = [
  { label: 'Home', href: '#home', icon: 'bi bi-house-door-fill' },
  { label: 'Jobs', href: '#featured-jobs', icon: 'bi bi-briefcase-fill' },
  { label: 'Features', href: '#section-03', icon: 'bi bi-stars' },
  { label: 'About Us', href: '#contact-us', icon: 'bi bi-people-fill' },
]

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value
}

const closeMobileNav = () => {
  isMobileNavOpen.value = false
}

const handleNavLinkClick = (href) => {
  isPolicyMenuOpen.value = false
  closeMobileNav()

  if (typeof window === 'undefined' || !href.startsWith('#')) return

  window.requestAnimationFrame(() => {
    const target = document.querySelector(href)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}
const getDisabilityIconClass = (disabilityFit) => {
  const text = String(disabilityFit || '').toLowerCase()
  if (text.includes('hearing')) return 'bi bi-ear'
  if (text.includes('speech')) return 'bi bi-chat-square-text'
  if (text.includes('visual') || text.includes('vision')) return 'bi bi-eye'
  if (text.includes('physical') || text.includes('mobility') || text.includes('wheelchair')) {
    return 'bi bi-person-wheelchair'
  }
  if (text.includes('learning')) return 'bi bi-book'
  if (text.includes('intellectual')) return 'bi bi-lightbulb'
  if (text.includes('autism')) return 'bi bi-stars'
  if (text.includes('psychosocial') || text.includes('chronic')) return 'bi bi-heart-pulse'
  return 'bi bi-universal-access-circle'
}

const getCompanyInitials = (name) =>
  String(name || 'Company')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CO'

const parseTextList = (value, delimiter = '\n') => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }

  return String(value || '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatPostedDate = (value) => {
  const raw = String(value || '').trim()
  const dateMs = raw ? Date.parse(raw) : 0
  const resolvedDate = Number.isFinite(dateMs) && dateMs > 0 ? new Date(dateMs) : new Date()
  return `Posted: ${resolvedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })}`
}

// Featured jobs list and active card state
const featuredJobs = computed(() => featuredJobPosts.value.slice(0, 10))
const selectedFeaturedJob = computed(() => featuredJobs.value[selectedFeaturedJobIndex.value] || null)
const pendingFeaturedJobIndex = ref(null)
const activeFeaturedJobIndex = computed(() =>
  pendingFeaturedJobIndex.value ?? selectedFeaturedJobIndex.value,
)
const setFeaturedJobCardRef = (el, index) => {
  featuredJobCardRefs.value[index] = el || null
}

const focusFeaturedJobCard = async (index) => {
  await nextTick()

  const card = featuredJobCardRefs.value[index]
  if (!card || typeof card.focus !== 'function') return

  card.focus({ preventScroll: true })
}

const scrollFeaturedJobIntoView = async (index) => {
  await nextTick()

  const list = featuredJobsListRef.value
  const card = featuredJobCardRefs.value[index]
  if (!list || !card) return
  if (list.scrollHeight <= list.clientHeight) return

  const cardTop = card.offsetTop
  const cardBottom = cardTop + card.offsetHeight
  const viewTop = list.scrollTop
  const viewBottom = viewTop + list.clientHeight

  if (cardTop < viewTop) {
    list.scrollTo({ top: cardTop, behavior: 'smooth' })
    return
  }

  if (cardBottom > viewBottom) {
    list.scrollTo({
      top: cardBottom - list.clientHeight,
      behavior: 'smooth',
    })
  }
}

// Onboarding cards shown in the guide section
const onboardingSteps = [
  {
    number: '1',
    title: 'Register & Build Your Profile',
    icon: 'bi bi-person-plus-fill',
    description:
      'Open an account, fill in your personal details, and showcase your skills so employers can quickly see your strengths and preferences.',
  },
  {
    number: '2',
    title: 'Get Matched & Explore',
    icon: 'bi bi-geo-alt-fill',
    description:
      'Explore job listings and discover verified opportunities that align with your experience, location, and ideal work arrangement.',
  },
  {
    number: '3',
    title: 'Discover, Apply & Connect',
    icon: 'bi bi-people-fill',
    description:
      'Apply to roles that match your goals and communicate with employers through the platform for updates and next steps.',
  },
  {
    number: '4',
    title: 'Start Your Opportunity',
    icon: 'bi bi-rocket-takeoff-fill',
    description:
      'Begin your work journey with smoother coordination, clearer onboarding, and better support as you step into new opportunities.',
  },
]

const mapJobRecordToFeaturedJob = (raw) => {
  const status = String(raw?.status || '').trim().toLowerCase()
  if (status && !['open', 'approved', 'published', 'active'].includes(status)) return null

  const title = String(raw?.title || raw?.jobTitle || raw?.job_title || raw?.position || '').trim()
  if (!title) return null

  const company = String(
    raw?.companyName || raw?.company_name || raw?.company || raw?.department || 'Company',
  ).trim()
  const languages = parseTextList(raw?.languages, ',')
  const qualifications = parseTextList(raw?.qualifications)
  const responsibilities = parseTextList(raw?.responsibilities)

  return {
    title,
    company,
    companyInitials: getCompanyInitials(company),
    logoUrl: String(raw?.logoUrl || raw?.profileImageUrl || '').trim() || '',
    description: String(raw?.description || 'No description provided.').trim(),
    category: String(raw?.category || 'General').trim(),
    type: String(raw?.type || 'Open').trim(),
    location: String(raw?.location || 'Not specified').trim(),
    setup: String(raw?.setup || 'On-site').trim(),
    vacancies: Math.max(1, Number(raw?.vacancies || 1) || 1),
    salary: String(raw?.salary || 'Negotiable').trim(),
    disabilityFit: String(raw?.disabilityType || raw?.disability || 'PWD-friendly').trim(),
    postedDate: formatPostedDate(raw?.createdAt || raw?.postedAt),
    preferredAgeRange: String(raw?.preferredAgeRange || '18 - 60 years old').trim(),
    languages: languages.length ? languages : ['English'],
    companyRating: 4.7,
    companyRatingCount: 52,
    qualifications: qualifications.length
      ? qualifications
      : ['Role-specific requirements will be discussed during screening.'],
    responsibilities: responsibilities.length
      ? responsibilities
      : ['Perform assigned tasks based on the role and team needs.'],
    createdAtMs: Date.parse(String(raw?.createdAt || raw?.postedAt || '')) || Date.now(),
  }
}

const syncFeaturedJobs = (rows = []) => {
  const mappedJobs = Array.isArray(rows)
    ? rows
        .map((row) => mapJobRecordToFeaturedJob(row))
        .filter(Boolean)
        .sort((left, right) => right.createdAtMs - left.createdAtMs)
    : []

  featuredJobPosts.value = mappedJobs

  if (selectedFeaturedJobIndex.value >= mappedJobs.length) {
    selectedFeaturedJobIndex.value = 0
  }
}

const selectFeaturedJob = (index, options = {}) => {
  const { focusCard = false } = options
  if (index < 0 || index >= featuredJobs.value.length) return
  if (index === activeFeaturedJobIndex.value && !isFeaturedJobDetailsLoading.value) {
    void scrollFeaturedJobIntoView(index)
    if (focusCard) void focusFeaturedJobCard(index)
    return
  }

  window.clearTimeout(featuredJobDetailsTimeout)
  pendingFeaturedJobIndex.value = index
  isFeaturedJobDetailsLoading.value = true

  featuredJobDetailsTimeout = window.setTimeout(() => {
    selectedFeaturedJobIndex.value = index
    pendingFeaturedJobIndex.value = null
    isFeaturedJobDetailsLoading.value = false
  }, 220)

  void scrollFeaturedJobIntoView(index)
  if (focusCard) void focusFeaturedJobCard(index)
}

const popularCategories = [
  {
    title: 'Development & IT',
    jobs: '16 jobs',
    description: 'Frontend, backend, web and app developer jobs.',
  },
  {
    title: 'Marketing & Sales',
    jobs: '8 jobs',
    description: 'Advertising, digital marketing and brand roles.',
  },
  {
    title: 'Design & Creative',
    jobs: '13 jobs',
    description: 'Graphic, digital, web, and product design jobs.',
  },
  {
    title: 'Customer Service',
    jobs: '8 jobs',
    description: 'Customer experience and account management jobs.',
  },
  {
    title: 'Administration',
    jobs: '11 jobs',
    description: 'Office support, clerical work, and coordination roles.',
  },
  {
    title: 'Education',
    jobs: '7 jobs',
    description: 'Teaching support, library, and learning assistance roles.',
  },
  {
    title: 'Retail & Sales',
    jobs: '10 jobs',
    description: 'Store operations, cashiering, and customer-facing roles.',
  },
  {
    title: 'Healthcare Support',
    jobs: '6 jobs',
    description: 'Clinic assistance, records, and patient support positions.',
  },
]
const heroJobCategoryOptions = computed(() => popularCategories.map((category) => category.title))
const heroDisabilityOptions = [
  'Autism',
  'Cancer Survivors and Rare Disease Individuals',
  'Deaf and Hard of Hearing Individuals',
  'Dwarfism',
  'Intellectual Disability',
  'Learning Disability',
  'Learning Disability (Dyslexic)',
  'Lower Limb Amputation/Deformity and Wheelchair Users',
  'Mental and Psychosocial Disability Individuals',
  'Physical Disability',
  'Speech Impairment',
  'Upper Limb Amputation/Deformity',
  'Visually Impaired',
]
const selectedHeroJobCategoryLabel = computed(() => heroSearchJobCategory.value || 'All Categories')
const selectedHeroDisabilityLabel = computed(() => heroSearchDisabilityCategory.value || 'All Disability Types')

const closeHeroSearchDropdowns = () => {
  isHeroCategoryDropdownOpen.value = false
  isHeroDisabilityDropdownOpen.value = false
}

const toggleHeroSearchDropdown = (dropdown) => {
  if (dropdown === 'category') {
    isHeroCategoryDropdownOpen.value = !isHeroCategoryDropdownOpen.value
    isHeroDisabilityDropdownOpen.value = false
    return
  }

  isHeroDisabilityDropdownOpen.value = !isHeroDisabilityDropdownOpen.value
  isHeroCategoryDropdownOpen.value = false
}

const selectHeroJobCategory = (option) => {
  heroSearchJobCategory.value = String(option || '')
  isHeroCategoryDropdownOpen.value = false
}

const selectHeroDisabilityCategory = (option) => {
  heroSearchDisabilityCategory.value = String(option || '')
  isHeroDisabilityDropdownOpen.value = false
}

const submitHeroSearch = async () => {
  if (isHeroSearchLoading.value) return
  closeHeroSearchDropdowns()
  isHeroSearchLoading.value = true

  const query = {}
  const keyword = String(heroSearchKeyword.value || '').trim()
  const jobCategory = String(heroSearchJobCategory.value || '').trim()
  const disabilityCategory = String(heroSearchDisabilityCategory.value || '').trim()

  if (keyword) query.keyword = keyword
  if (jobCategory) query.jobCategory = jobCategory
  if (disabilityCategory) query.category = disabilityCategory

  try {
    await new Promise((resolve) => {
      heroSearchNavigateTimeout = window.setTimeout(resolve, 420)
    })
    await router.push({ path: '/search-jobs', query })
  } finally {
    isHeroSearchLoading.value = false
  }
}

const navigateToLogin = async () => {
  if (isLoginRouteLoading.value) return
  isLoginRouteLoading.value = true

  try {
    await new Promise((resolve) => {
      loginNavigateTimeout = window.setTimeout(resolve, 320)
    })
    await router.push('/login')
  } finally {
    isLoginRouteLoading.value = false
  }
}

const startHeroSlider = () => {
  if (slideInterval) return
  slideInterval = window.setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % heroSlides.length
  }, 4200)
}

const stopHeroSlider = () => {
  window.clearInterval(slideInterval)
  slideInterval = undefined
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopHeroSlider()
    return
  }
  startHeroSlider()
}

// Initial page setup
onMounted(() => {
  setScrollY()
  window.addEventListener('scroll', updateScroll, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('click', handleDocumentClick)
  featuredJobPosts.value = []
  void getPublicJobs()
    .then((jobs) => {
      syncFeaturedJobs(jobs)
    })
    .finally(() => {
      isFeaturedJobsLoading.value = false
    })
  stopPublicJobsSubscription = subscribeToPublicJobs(
    (jobs) => {
      syncFeaturedJobs(jobs)
      isFeaturedJobsLoading.value = false
    },
    () => {
      isFeaturedJobsLoading.value = false
    },
  )

  startHeroSlider()
})

// Cleanup when leaving the landing page
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScroll)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('click', handleDocumentClick)
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  stopHeroSlider()
  window.clearTimeout(heroSearchNavigateTimeout)
  window.clearTimeout(loginNavigateTimeout)
  window.clearTimeout(featuredJobDetailsTimeout)
  stopPublicJobsSubscription()
  stopPublicJobsSubscription = () => {}
  revealObserver?.disconnect()
  revealObserver = null
})
</script>

<template>
  <!-- Landing page shell -->
  <div class="relative flex min-h-screen flex-col overflow-x-clip bg-[#f5f4ef] text-[#f4f1e8] transition-colors duration-500 ease-out">
    <!-- Main page content -->
    <div class="flex flex-1 flex-col transition-opacity duration-700 ease-out">
    <!-- Top navigation -->
    <header
      class="landing-rise-in sticky top-0 z-30 border-b border-[#dce6e0] shadow-[0_10px_24px_rgba(23,35,29,0.06)] backdrop-blur-md transition-[padding,transform] duration-300"
      :class="
        isNavScrolled
          ? 'bg-white pt-3'
          : 'bg-white pt-5'
      "
    >
      <nav
        class="landing-nav relative mx-auto grid w-full max-w-[1180px] grid-cols-[auto_1fr_auto] items-center gap-5 bg-transparent px-5 py-4 transition-all duration-300"
        :class="
          isNavScrolled
            ? 'bg-transparent px-5 py-4'
            : ''
        "
      >
        <button
          type="button"
          class="landing-mobile-nav-toggle hidden items-center justify-center rounded-[14px] border border-[#dce6e0] bg-white text-[#11442f] shadow-[0_12px_28px_rgba(17,68,47,0.14)] max-[900px]:inline-flex"
          :aria-expanded="isMobileNavOpen ? 'true' : 'false'"
          aria-controls="landing-mobile-sidebar"
          aria-label="Open navigation menu"
          @click="toggleMobileNav"
        >
          <i class="bi bi-list text-[1.4rem]" />
        </button>

        <a class="inline-flex items-center gap-1.5 transition-opacity duration-200" href="#home">
          <img
            class="h-[2.7rem] w-[2.7rem] shrink-0 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.26)]"
            :src="logoPwd"
            alt="PWD logo"
            decoding="async"
            fetchpriority="high"
          />
          <img
            class="h-[2.4rem] w-auto shrink object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
            :src="pwdWordmark"
            alt="PWD Platform"
            decoding="async"
            fetchpriority="high"
          />
        </a>

        <div
          class="landing-nav__links inline-flex items-center justify-center gap-6 justify-self-center text-[#17231d] font-semibold transition-colors duration-300"
          :class="isNavScrolled ? 'text-[#17231d]' : 'text-[#17231d]'"
        >
          <a
            v-for="link in navLinks"
            :key="link.label"
            class="transition duration-200 hover:-translate-y-0.5 hover:opacity-85"
            :href="link.href"
            @click.prevent="handleNavLinkClick(link.href)"
          >
            {{ link.label }}
          </a>
          <div class="nav-policy relative">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:opacity-85"
              @click="isPolicyMenuOpen = !isPolicyMenuOpen"
            >
              <span>Policy</span>
              <i
                class="bi bi-chevron-down text-[0.76rem] transition-transform duration-200"
                :class="isPolicyMenuOpen ? 'rotate-180' : ''"
              />
            </button>

            <transition name="nav-policy-dropdown">
              <div
                v-if="isPolicyMenuOpen"
                class="nav-policy__menu"
                :class="isNavScrolled ? 'nav-policy__menu--scrolled' : ''"
              >
                <a
                  v-for="link in policyLinks"
                  :key="link.label"
                  class="nav-policy__item"
                  :href="link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="isPolicyMenuOpen = false"
                >
                  <span>{{ link.label }}</span>
                </a>
              </div>
            </transition>
          </div>
        </div>

        <button
          class="nav-login-button inline-flex cursor-pointer items-center justify-center justify-self-end rounded-[10px] border px-[1.05rem] py-[0.62rem] text-[0.92rem] font-semibold tracking-[0.01em] transition duration-300"
          :class="
            isNavScrolled
              ? 'border-[#11442f] bg-[#11442f] text-white'
              : 'border-[#11442f] bg-[#11442f] text-white'
          "
          type="button"
          :disabled="isLoginRouteLoading"
          @click="navigateToLogin"
        >
          <span>Login</span>
        </button>
      </nav>

      <transition name="landing-mobile-nav-fade">
        <button
          v-if="isMobileNavOpen"
          type="button"
          class="landing-mobile-nav-backdrop"
          aria-label="Close navigation menu"
          @click="closeMobileNav"
        />
      </transition>

      <aside
        id="landing-mobile-sidebar"
        class="landing-mobile-sidebar"
        :class="{ 'landing-mobile-sidebar--open': isMobileNavOpen }"
        aria-label="Mobile navigation"
      >
        <div class="landing-mobile-sidebar__header">
          <div class="landing-mobile-sidebar__brand">
            <img class="landing-mobile-sidebar__brand-mark" :src="logoPwd" alt="PWD logo" />
            <div class="landing-mobile-sidebar__brand-copy">
              <strong>PWD Platform</strong>
              <span>Navigation</span>
            </div>
          </div>

          <button
            type="button"
            class="landing-mobile-sidebar__close"
            aria-label="Close navigation menu"
            @click="closeMobileNav"
          >
            <i class="bi bi-x-lg" />
          </button>
        </div>

        <nav class="landing-mobile-sidebar__nav">
          <a
            v-for="link in navLinks"
            :key="`mobile-${link.label}`"
            class="landing-mobile-sidebar__link"
            :href="link.href"
            @click.prevent="handleNavLinkClick(link.href)"
          >
            <span class="landing-mobile-sidebar__link-main">
              <span class="landing-mobile-sidebar__link-icon">
                <i :class="link.icon" />
              </span>
              <span class="landing-mobile-sidebar__link-copy">
                <strong>{{ link.label }}</strong>
              </span>
            </span>
            <i class="bi bi-arrow-right-short landing-mobile-sidebar__link-arrow" />
          </a>

          <button
            type="button"
            class="landing-mobile-sidebar__link landing-mobile-sidebar__link--button"
            @click="isPolicyMenuOpen = !isPolicyMenuOpen"
          >
            <span class="landing-mobile-sidebar__link-main">
              <span class="landing-mobile-sidebar__link-icon">
                <i class="bi bi-shield-lock-fill" />
              </span>
              <span class="landing-mobile-sidebar__link-copy">
                <strong>Policy</strong>
              </span>
            </span>
            <i class="bi landing-mobile-sidebar__link-arrow" :class="isPolicyMenuOpen ? 'bi-chevron-up' : 'bi-chevron-down'" />
          </button>

          <div v-if="isPolicyMenuOpen" class="landing-mobile-sidebar__policy-list">
            <a
              v-for="link in policyLinks"
              :key="`mobile-policy-${link.label}`"
              class="landing-mobile-sidebar__policy-item"
              :href="link.href"
              @click.prevent="handleNavLinkClick(link.href)"
            >
              {{ link.label }}
            </a>
          </div>
        </nav>

        <div class="landing-mobile-sidebar__footer">
          <div class="landing-mobile-sidebar__footer-note">
            <strong>HireAble Proximity</strong>
            <span>Explore opportunities, features, and support in one place.</span>
          </div>
          <button
            type="button"
            class="landing-mobile-sidebar__login"
            :disabled="isLoginRouteLoading"
            @click="navigateToLogin"
          >
            Login
          </button>
        </div>
      </aside>
    </header>

    <!-- Landing page sections -->
    <main class="relative z-[1] mx-auto flex flex-1 flex-col max-w-[1180px] px-4 pb-0 pt-12 sm:px-[clamp(1rem,3vw,2rem)] max-[640px]:px-[0.8rem]">
      <div
        class="pointer-events-none absolute left-1/2 top-0 z-0 h-[clamp(36rem,78svh,52rem)] w-screen -translate-x-1/2 overflow-hidden max-[900px]:h-[clamp(32rem,72svh,44rem)]"
        aria-hidden="true"
      >
        <div class="absolute -inset-[8%] will-change-transform" :style="heroImageStyle">
          <img
            v-for="(slide, index) in heroSlides"
            :key="slide"
            :src="slide"
            alt=""
            decoding="async"
            :fetchpriority="index === 0 ? 'high' : 'low'"
            class="absolute inset-0 h-full w-full object-cover saturate-[0.82] brightness-55 hue-rotate-[24deg] transition-opacity duration-[1200ms] ease-out motion-reduce:transition-none"
            :class="currentSlide === index ? 'opacity-100' : 'opacity-0'"
          />
        </div>
        <div
          class="absolute inset-0 bg-[linear-gradient(90deg,rgba(245,250,247,0.16)_0%,rgba(15,56,35,0.36)_28%,rgba(12,44,28,0.44)_60%,rgba(7,31,20,0.56)_100%),linear-gradient(180deg,rgba(240,248,243,0.12)_0%,rgba(10,42,27,0.26)_36%,rgba(5,25,16,0.62)_100%)]"
        />
        <div
          class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.45))]"
        />
        <div
          class="absolute left-[12%] top-[18%] h-32 w-32 rounded-full bg-white/14 blur-3xl will-change-transform"
          :style="heroAccentStyle"
        />
        <div
          class="absolute bottom-[18%] right-[16%] h-44 w-44 rounded-full bg-white/10 blur-3xl will-change-transform"
          :style="heroContentStyle"
        />
      </div>

      <!-- Hero section -->
      <section
        id="home"
        class="landing-hero relative -mt-12 w-screen pb-35 pt-[calc(6rem+clamp(1.2rem,2.5vw,2rem))] [margin-left:calc(50%-50vw)] [margin-right:calc(50%-50vw)] max-[900px]:pb-18 max-[900px]:pt-6"
      >
        <div
          class="landing-hero__grid relative z-[1] mx-auto grid w-full max-w-[1380px] grid-cols-[minmax(340px,700px)_minmax(300px,560px)] items-start gap-[clamp(2rem,4vw,4rem)] px-[clamp(1.25rem,3vw,3rem)] pt-[clamp(3.5rem,5.8vw,5.5rem)] max-[900px]:grid-cols-1 max-[900px]:pt-10 max-[640px]:px-4"
        >
          <div
            class="landing-hero__copy landing-rise-in relative z-[1] -mt-20 w-full max-w-[820px] overflow-visible self-start max-[900px]:-mt-8"
            style="animation-delay: 0.16s;"
          >
            <p class="mb-4 text-[0.92rem] font-semibold uppercase tracking-[0.22em] text-[#f3be79] max-[640px]:text-[0.8rem]">
              HireAble Proximity 
            </p>
            <h1 class="m-0 max-w-[13ch] text-[clamp(2rem,3.9vw,3.75rem)] font-bold leading-[1] tracking-[-0.035em] text-[#f7f3ea] max-[640px]:max-w-[12ch] max-[640px]:text-[clamp(1.65rem,6.2vw,2.25rem)]">
              Employment&nbsp;Assistant&nbsp;For <span class="hero-title-accent">Persons&nbsp;with&nbsp;a&nbsp;Disability</span> Powered&nbsp;by&nbsp;Decision Support&nbsp;System
            </h1>
            <p class="mt-5 inline-block min-w-[24ch] text-[clamp(1rem,1.1vw,1.05rem)] font-semibold uppercase tracking-[0.62em] text-[rgba(244,241,232,0.82)] max-[640px]:min-w-0 max-[640px]:max-w-[32ch] max-[640px]:text-[0.96rem] max-[640px]:tracking-[0.34em]">
              City Of Dasmariñas
            </p>
         
            <!-- Search jobs for the main -->
            <div class="hero-search-shell">
              <form class="hero-search" @submit.prevent="submitHeroSearch">
                <label class="hero-search__field hero-search__field--input">
                  <div class="hero-search__control">
                    <span class="hero-search__icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.8" />
                        <path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                      </svg>
                    </span>
                    <input
                      v-model="heroSearchKeyword"
                      class="hero-search__input"
                      type="text"
                      placeholder="What opportunities are you looking for?"
                    />
                  </div>
                </label>

                <div class="hero-search__field hero-search__field--select hero-search__dropdown hero-search__dropdown--category hero-search__dropdown--upward" :class="{ 'hero-search__dropdown--open': isHeroCategoryDropdownOpen }">
                  <button
                    type="button"
                    class="hero-search__control hero-search__control--select hero-search__trigger"
                    aria-label="All Categories"
                    :aria-expanded="isHeroCategoryDropdownOpen ? 'true' : 'false'"
                    @click.stop="toggleHeroSearchDropdown('category')"
                  >
                    <span class="hero-search__value" :class="{ 'hero-search__value--filled': heroSearchJobCategory }">
                      {{ selectedHeroJobCategoryLabel }}
                    </span>
                    <span class="hero-search__caret" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                  </button>

                  <transition name="hero-search-dropdown">
                    <div v-if="isHeroCategoryDropdownOpen" class="hero-search__menu" role="listbox" aria-label="All Categories">
                      <button
                        type="button"
                        class="hero-search__option"
                        :class="{ 'hero-search__option--active': !heroSearchJobCategory }"
                        @click.stop="selectHeroJobCategory('')"
                      >
                        <span class="hero-search__option-mark" aria-hidden="true" />
                        <span>All Categories</span>
                      </button>
                      <button
                        v-for="option in heroJobCategoryOptions"
                        :key="option"
                        type="button"
                        class="hero-search__option"
                        :class="{ 'hero-search__option--active': heroSearchJobCategory === option }"
                        @click.stop="selectHeroJobCategory(option)"
                      >
                        <span class="hero-search__option-mark" aria-hidden="true" />
                        <span>{{ option }}</span>
                      </button>
                    </div>
                  </transition>
                </div>

                <div class="hero-search__field hero-search__field--select hero-search__dropdown hero-search__dropdown--disability hero-search__dropdown--upward" :class="{ 'hero-search__dropdown--open': isHeroDisabilityDropdownOpen }">
                  <button
                    type="button"
                    class="hero-search__control hero-search__control--select hero-search__trigger"
                    aria-label="All Disability Types"
                    :aria-expanded="isHeroDisabilityDropdownOpen ? 'true' : 'false'"
                    @click.stop="toggleHeroSearchDropdown('disability')"
                  >
                    <span class="hero-search__value" :class="{ 'hero-search__value--filled': heroSearchDisabilityCategory }">
                      {{ selectedHeroDisabilityLabel }}
                    </span>
                    <span class="hero-search__caret" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                  </button>

                  <transition name="hero-search-dropdown">
                    <div v-if="isHeroDisabilityDropdownOpen" class="hero-search__menu" role="listbox" aria-label="All Disability Types">
                      <button
                        type="button"
                        class="hero-search__option"
                        :class="{ 'hero-search__option--active': !heroSearchDisabilityCategory }"
                        @click.stop="selectHeroDisabilityCategory('')"
                      >
                        <span class="hero-search__option-mark" aria-hidden="true" />
                        <span>All Disability Types</span>
                      </button>
                      <button
                        v-for="option in heroDisabilityOptions"
                        :key="option"
                        type="button"
                        class="hero-search__option"
                        :class="{ 'hero-search__option--active': heroSearchDisabilityCategory === option }"
                        @click.stop="selectHeroDisabilityCategory(option)"
                      >
                        <span class="hero-search__option-mark" aria-hidden="true" />
                        <span>{{ option }}</span>
                      </button>
                    </div>
                  </transition>
                </div>

                <button class="hero-search__button" :class="{ 'hero-search__button--loading': isHeroSearchLoading }" type="submit" :disabled="isHeroSearchLoading">
                  <span v-if="isHeroSearchLoading" class="hero-search__button-spinner" aria-hidden="true" />
                  <span>{{ isHeroSearchLoading ? 'Searching...' : 'Search' }}</span>
                </button>
              </form>
                 <p class="mt-5 max-w-[2000ch] text-[clamp(1rem,1.1vw,1.05rem)] leading-[1.7] text-[rgba(244,241,232,0.82)] max-[640px]:max-w-[32ch] max-[640px]:text-[0.96rem]">
              Helping persons with disabilities discover meaningful work, grow confidently, and succeed without barriers.
            </p>
           </div>
          </div>

      
          <div
            class="landing-hero__visual landing-rise-in relative z-[1] -mt-16 flex w-full max-w-[560px] self-start justify-end justify-self-end pl-0 pr-10 pt-2 max-[900px]:-mt-6 max-[900px]:justify-center max-[900px]:justify-self-center max-[900px]:pt-0 max-[900px]:pr-0"
            style="animation-delay: 0.24s;"
          >
            <div
              class="landing-hero__logo-shell hero-logo-float relative w-full max-w-[330px] overflow-visible [transform-style:preserve-3d] max-[900px]:max-w-[280px] max-[640px]:max-w-[210px]"
            >
              <img
                class="relative z-[1] w-full scale-[1.02] object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.35)] max-[900px]:scale-[1] max-[640px]:scale-[0.98]"
                :src="logoPwd"
                alt="PWD logo"
                decoding="async"
                fetchpriority="high"
              />
              <img
                class="hero-logo-sheen-image pointer-events-none absolute inset-0 z-[2] w-full scale-[1.02] object-contain max-[900px]:scale-[1] max-[640px]:scale-[0.98]"
                :src="logoPwd"
                alt=""
                aria-hidden="true"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <div
        class="sections-shell relative mt-0 w-screen pb-10 pt-0 [margin-left:calc(50%-50vw)] [margin-right:calc(50%-50vw)] sm:pb-12"
      >
      <!-- Featured jobs section -->
      <section
        id="section-03"
        class="section-steps relative z-[2] mt-0 w-full pb-0 pt-0"
      >
        <div class="section-steps__panel">
          <div class="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">
            <div v-reveal class="section-steps__header">
              <h2 class="section-steps__title">Ready to Get Started?</h2>
              <div class="section-steps__status">
                <i class="bi bi-people-fill" />
                <div class="section-steps__status-copy">
                  <strong>100+</strong>
                  <span>Applicants</span>
                </div>
              </div>
              <p class="section-steps__subtitle">
                Join thousands of PWD individuals who have found meaningful employment through our platform.
              </p>
              <a class="section-steps__cta" href="/login">
                <i class="bi bi-arrow-right-circle" />
                <span>Start Journey</span>
              </a>
            </div>

            <div class="section-steps__grid">
              <article
                v-for="step in onboardingSteps"
                :key="step.number"
                v-reveal="getRevealDelay(Number(step.number) - 1, 100, 40)"
                class="section-steps__card"
              >
                <div class="section-steps__topline" />
                <div class="section-steps__meta">
                  <span class="section-steps__number">{{ step.number }}</span>
                  <div class="section-steps__icon" aria-hidden="true">
                    <i :class="step.icon" />
                  </div>
                </div>
                <div class="section-steps__content">
                  <p class="section-steps__label">Step {{ step.number }}</p>
                  <h3 class="section-steps__card-title">{{ step.title }}</h3>
                  <p class="section-steps__description">{{ step.description }}</p>
                </div>
              </article>
            </div>

          </div>
        </div>
      </section>

      <!-- Categories and onboarding guide section -->
      <section
        id="featured-jobs"
        class="section-featured relative z-[2] mt-0 w-full pb-0 pt-0"
        :style="featuredSectionStyle"
      >
        <div class="section-featured__panel">
          <div
            class="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10"
          >
        <div v-reveal class="flex justify-center border-b border-[#dbe4de] pb-6 text-center">
          <div class="max-w-[38rem]">
            <h2 class="mt-3 text-[clamp(1.7rem,3vw,2.7rem)] font-bold leading-[1.05] text-[#17231d]">
              Inclusive Opportunities
            </h2>
            <p class="mt-3 max-w-[40rem] text-[0.98rem] leading-[1.7] text-[#62706a]">
              Explore thoughtfully selected job openings designed to support inclusive hiring,
              clear role expectations, and better opportunities for persons with disabilities.
            </p>
          </div>

        </div>

        <div
          class="mt-8 grid gap-6"
          :class="featuredJobs.length ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]' : 'grid-cols-1'"
        >
          <div
            v-if="featuredJobs.length"
            ref="featuredJobsListRef"
            class="featured-jobs-list flex flex-col gap-4"
          >
            <article
              v-for="(job, index) in featuredJobs"
              :key="`${job.title}-${job.company}-${job.postedDate}`"
              v-reveal="getRevealDelay(index, 85, 40)"
              :ref="(el) => setFeaturedJobCardRef(el, index)"
              class="featured-job-card group cursor-pointer self-start border border-[#d8e4dc] bg-white p-4 text-left"
              :class="index === activeFeaturedJobIndex ? 'featured-job-card--active border-[#1b8a54]/55 ring-1 ring-[#1b8a54]/18' : ''"
              role="button"
              tabindex="0"
              :aria-pressed="index === activeFeaturedJobIndex"
              @click="selectFeaturedJob(index)"
              @keydown.enter.prevent="selectFeaturedJob(index, { focusCard: true })"
              @keydown.space.prevent="selectFeaturedJob(index, { focusCard: true })"
            >
              <div class="mb-3 flex justify-end">
                <span class="inline-flex items-center gap-1.5 px-0 py-0 text-[0.76rem] font-semibold text-[#1f2f46]">
                  <i class="bi bi-clock text-[#8b5cf6]" />
                  <span>{{ job.postedDate.replace('Posted: ', '') }}</span>
                </span>
              </div>

              <div class="flex items-start gap-4">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-[#e2e8e3] bg-[#f8faf9] p-2 text-[0.95rem] font-bold text-[#1b8a54]"
                >
                  <img
                    v-if="job.logoUrl"
                    class="h-full w-full object-contain"
                    :src="job.logoUrl"
                    :alt="job.company"
                  />
                  <span v-else>{{ job.companyInitials }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-[1.15rem] font-semibold leading-tight text-[#17231d]">{{ job.title }}</h3>
                  <div class="mt-1 flex items-center gap-2 text-[0.92rem] text-[#5d6b74]">
                    <i class="bi bi-buildings text-[#6d7a84]" />
                    <span>{{ job.company }}</span>
                  </div>
                </div>
              </div>

              <p class="mt-4 max-w-[44rem] text-[0.92rem] leading-[1.55] text-[#46545d]">
                {{ job.description }}
              </p>

              <div class="mt-4 flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-1.5 border border-[#d8e4f0] bg-[#f7faff] px-2.5 py-1.5 text-[0.76rem] font-semibold text-[#1f2f46]">
                  <i class="bi bi-geo-alt text-[#4f6cf6]" />
                  <span>{{ job.location }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 border border-[#d8e4f0] bg-[#f7faff] px-2.5 py-1.5 text-[0.76rem] font-semibold text-[#1f2f46]">
                  <i class="bi bi-buildings text-[#4f6cf6]" />
                  <span>{{ job.setup }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 border border-[#f3e2b8] bg-[#fff9eb] px-2.5 py-1.5 text-[0.76rem] font-semibold text-[#3b3121]">
                  <i class="bi bi-people-fill text-[#f1b322]" />
                  <span>{{ job.vacancies }} Vacancy{{ job.vacancies > 1 ? 'ies' : '' }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 border border-[#dbe4de] bg-[#fbfcfb] px-2.5 py-1.5 text-[0.76rem] font-semibold text-[#1f2f46]">
                  <i class="bi bi-cash text-[#1b8a54]" />
                  <span>{{ job.salary }}</span>
                </span>
              </div>
            </article>
          </div>

          <aside
            v-reveal="getRevealDelay(1, 120, 140)"
            class="p-4 sm:p-5"
            :class="featuredJobs.length
              ? 'self-start border border-[#d9e3dc] bg-[#fbfcfb] shadow-[0_16px_30px_rgba(23,35,29,0.05)]'
              : 'mx-auto w-full max-w-[34rem] border-0 bg-transparent shadow-none'"
          >
            <div v-if="isFeaturedJobDetailsLoading" class="featured-job-details-skeleton" aria-hidden="true">
              <div class="featured-job-details-skeleton__head">
                <div class="featured-job-details-skeleton__brand skeleton-box" />
                <div class="featured-job-details-skeleton__summary">
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--title" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--company" />
                  <div class="featured-job-details-skeleton__meta-list">
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--meta" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--meta-wide" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--meta-short" />
                  </div>
                </div>
              </div>

              <div class="featured-job-details-skeleton__panel featured-job-details-skeleton__panel--large">
                <div class="featured-job-details-skeleton__panel-title skeleton-box" />
                <div class="featured-job-details-skeleton__panel-copy">
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-wide" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-short" />
                </div>
              </div>
              <div class="featured-job-details-skeleton__panel-grid">
                <div class="featured-job-details-skeleton__panel">
                  <div class="featured-job-details-skeleton__panel-title skeleton-box" />
                  <div class="featured-job-details-skeleton__panel-copy">
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--label" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--label" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-short" />
                  </div>
                </div>
                <div class="featured-job-details-skeleton__panel">
                  <div class="featured-job-details-skeleton__panel-title skeleton-box" />
                  <div class="featured-job-details-skeleton__list">
                    <div class="featured-job-details-skeleton__list-item">
                      <div class="featured-job-details-skeleton__bullet skeleton-box" />
                      <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body" />
                    </div>
                    <div class="featured-job-details-skeleton__list-item">
                      <div class="featured-job-details-skeleton__bullet skeleton-box" />
                      <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-wide" />
                    </div>
                  </div>
                </div>
                <div class="featured-job-details-skeleton__panel">
                  <div class="featured-job-details-skeleton__panel-title skeleton-box" />
                  <div class="featured-job-details-skeleton__list">
                    <div class="featured-job-details-skeleton__list-item">
                      <div class="featured-job-details-skeleton__bullet skeleton-box" />
                      <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-wide" />
                    </div>
                    <div class="featured-job-details-skeleton__list-item">
                      <div class="featured-job-details-skeleton__bullet skeleton-box" />
                      <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="featured-job-details-skeleton__panel">
                <div class="featured-job-details-skeleton__panel-title skeleton-box" />
                <div class="featured-job-details-skeleton__list">
                  <div class="featured-job-details-skeleton__list-item">
                    <div class="featured-job-details-skeleton__bullet skeleton-box" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-wide" />
                  </div>
                  <div class="featured-job-details-skeleton__list-item">
                    <div class="featured-job-details-skeleton__bullet skeleton-box" />
                    <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body" />
                  </div>
                </div>
              </div>
              <div class="featured-job-details-skeleton__stats">
                <div class="featured-job-details-skeleton__stat">
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--stat-label" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--stat-value" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--stat-value-short" />
                </div>
                <div class="featured-job-details-skeleton__stat">
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--stat-label" />
                  <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--body-short" />
                </div>
              </div>
              <div class="featured-job-details-skeleton__actions">
                <div class="featured-job-details-skeleton__action skeleton-box" />
                <div class="featured-job-details-skeleton__action skeleton-box" />
              </div>
              <div class="featured-job-details-skeleton__line skeleton-box featured-job-details-skeleton__line--footer" />
            </div>

            <div v-else-if="selectedFeaturedJob" class="featured-job-details">
            <div class="border-b border-[#e3ebe5] pb-4">
              <div class="flex gap-3">
                <div
                  class="flex h-16 w-16 items-center justify-center overflow-hidden border border-[#d6e2da] bg-white p-1.5 text-[1.2rem] font-bold text-[#1b8a54]"
                >
                  <img
                    v-if="selectedFeaturedJob.logoUrl"
                    class="h-full w-full object-contain"
                    :src="selectedFeaturedJob.logoUrl"
                    :alt="selectedFeaturedJob.company"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else>{{ selectedFeaturedJob.companyInitials }}</span>
                </div>
                <div>
                  <h3 class="text-[1.45rem] font-bold leading-tight text-[#1b2a22]">
                    {{ selectedFeaturedJob.title }}
                  </h3>
                  <p class="mt-1 flex items-center gap-2 text-[0.95rem] text-[#5f6b65]">
                    <i class="bi bi-buildings text-[#6d7a84]" />
                    <span>{{ selectedFeaturedJob.company }}</span>
                  </p>
                  <div class="mt-2 space-y-1.5 text-[0.88rem] text-[#415149]">
                    <div class="flex items-center gap-2">
                      <i class="bi bi-geo-alt text-[#1b8a54]" />
                      <span>{{ selectedFeaturedJob.location }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <i class="bi bi-briefcase text-[#1b8a54]" />
                      <span>{{ selectedFeaturedJob.category }}</span>
                      <i class="bi bi-clock text-[#e29a33]" />
                      <span>{{ selectedFeaturedJob.type }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <i class="bi bi-people text-[#7b59d1]" />
                      <span>{{ selectedFeaturedJob.vacancies }} Vacancies</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 grid gap-3">
              <section class="rounded-[1.1rem] border border-[#dce6e0] bg-white p-4">
                <h4 class="flex items-center gap-2 text-[0.98rem] font-semibold text-[#1f2d25]">
                  <i class="bi bi-file-earmark-text text-[#1b8a54]" />
                  <span>Job Description</span>
                </h4>
                <p class="mt-3 text-[0.92rem] leading-[1.7] text-[#5f6b65]">
                  {{ selectedFeaturedJob.description }}
                </p>
              </section>

              <section class="rounded-[1.1rem] border border-[#dce6e0] bg-white p-4">
                <h4 class="flex items-center gap-2 text-[0.98rem] font-semibold text-[#1f2d25]">
                  <i class="bi bi-person-vcard text-[#1b8a54]" />
                  <span>Language and Age Preference</span>
                </h4>
                <div class="mt-3 space-y-2 text-[0.92rem] text-[#5f6b65]">
                  <p>
                    <strong class="text-[#24332b]">Languages:</strong>
                    {{ selectedFeaturedJob.languages.join(', ') }}
                  </p>
                  <p>
                    <strong class="text-[#24332b]">Preferred Age:</strong>
                    {{ selectedFeaturedJob.preferredAgeRange }}
                  </p>
                </div>
              </section>

              <section class="rounded-[1.1rem] border border-[#dce6e0] bg-white p-4">
                <h4 class="flex items-center gap-2 text-[0.98rem] font-semibold text-[#1f2d25]">
                  <i class="bi bi-patch-check text-[#1b8a54]" />
                  <span>Qualifications</span>
                </h4>
                <ul class="mt-3 space-y-2 text-[0.92rem] text-[#5f6b65]">
                  <li
                    v-for="qualification in selectedFeaturedJob.qualifications"
                    :key="qualification"
                    class="flex items-start gap-2"
                  >
                    <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1b8a54]" />
                    <span>{{ qualification }}</span>
                  </li>
                </ul>
              </section>

              <section class="rounded-[1.1rem] border border-[#dce6e0] bg-white p-4">
                <h4 class="flex items-center gap-2 text-[0.98rem] font-semibold text-[#1f2d25]">
                  <i class="bi bi-list-check text-[#1b8a54]" />
                  <span>Responsibilities</span>
                </h4>
                <ul class="mt-3 space-y-2 text-[0.92rem] text-[#5f6b65]">
                  <li
                    v-for="responsibility in selectedFeaturedJob.responsibilities"
                    :key="responsibility"
                    class="flex items-start gap-2"
                  >
                    <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1b8a54]" />
                    <span>{{ responsibility }}</span>
                  </li>
                </ul>
              </section>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <section class="rounded-[1.1rem] border border-[#d8e7dd] bg-[#f6fbf7] p-4">
                <p class="text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#7b8781]">Salary Range</p>
                <p class="mt-2 text-[1.2rem] font-bold text-[#1b8a54]">{{ selectedFeaturedJob.salary }}</p>
              </section>
              <section class="rounded-[1.1rem] border border-[#d8e7dd] bg-[#f9fbfa] p-4">
                <p class="text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#7b8781]">Suitable For</p>
                <p class="mt-2 flex items-center gap-2 text-[1rem] font-semibold text-[#24332b]">
                  <i :class="`${getDisabilityIconClass(selectedFeaturedJob.disabilityFit)} text-[#1b8a54]`" />
                  <span>{{ selectedFeaturedJob.disabilityFit }}</span>
                </p>
              </section>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <a
                class="inline-flex items-center justify-center gap-2 rounded-[0.95rem] border border-[#dbe4de] bg-white px-[1.2rem] py-[0.95rem] text-[#2f3f38] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8d5cd] hover:bg-[#f7faf8]"
                href="/login"
              >
                <i class="bi bi-bookmark" />
                <span>Save</span>
              </a>
              <a
                class="inline-flex items-center justify-center gap-2 rounded-[0.95rem] bg-[#1b8a54] px-[1.2rem] py-[0.95rem] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#177547]"
                href="/login"
              >
                <i class="bi bi-send" />
                <span>Apply Now</span>
              </a>
            </div>

            <p class="mt-3 text-[0.86rem] text-[#70807a]">
              <i class="bi bi-people mr-1 text-[#7b59d1]" />
              {{ selectedFeaturedJob.vacancies }} Vacancies Available
            </p>
            </div>

            <div
              v-else
              key="featured-job-empty"
              class="flex min-h-[24rem] items-center justify-center p-6 text-center text-[#62706a]"
            >
              <div class="flex flex-col items-center">
                <div class="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#eef7f1] shadow-[inset_0_0_0_1px_rgba(27,138,84,0.12)]">
                  <i class="bi bi-briefcase-fill text-[2rem] text-[#1b8a54]" />
                  <span class="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1f1] text-[#df5b57] shadow-[0_8px_18px_rgba(223,91,87,0.16)]">
                    <i class="bi bi-slash-circle-fill text-[0.95rem]" />
                  </span>
                </div>
                <p class="mt-4 text-[0.96rem] font-semibold text-[#33433d]">
                  {{ isFeaturedJobsLoading ? 'Loading featured job details...' : 'No job post yet.' }}
                </p>
                <p class="mt-1 max-w-[16rem] text-[0.82rem] text-[#7a8882]">
                  {{ isFeaturedJobsLoading ? 'Please wait while we prepare the latest openings.' : 'Check back again later for newly featured opportunities.' }}
                </p>
              </div>
            </div>
          </aside>
        </div>
          </div>
        </div>
      </section>

      <!-- Contact section -->
      <section id="contact-us" class="section-contact relative mt-0 w-full pb-0 pt-0">
        <div class="section-contact__panel">
          <div class="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">
            <div class="section-contact__header">
              <div>
                <p class="section-contact__eyebrow">Contact Us</p>
                <h2 class="section-contact__title">Visit or Reach Us in Dasmarinas</h2>
                <p class="section-contact__subtitle">
                  Get in touch for job support, employer coordination, and accessibility assistance. Our map below is focused on Dasmarinas, Cavite only.
                </p>
              </div>
            </div>

            <div class="section-contact__layout">
              <div class="section-contact__details">
                <form class="section-contact__form" @submit.prevent>
                  <div class="section-contact__form-copy">
                    <p class="section-contact__form-kicker">We'd love to hear from you!</p>
                    <h3>Let's get in touch</h3>
                  </div>

                  <div class="section-contact__form-grid">
                    <label class="section-contact__field section-contact__field--span-2">
                      <span>Full Name</span>
                      <input type="text" placeholder="Your full name" />
                    </label>

                    <label class="section-contact__field">
                      <span>Email</span>
                      <input type="email" placeholder="example@email.com" />
                    </label>

                    <label class="section-contact__field">
                      <span>Phone Number</span>
                      <input type="tel" placeholder="+63 912 345 6789" />
                    </label>
                  </div>

                  <label class="section-contact__field">
                    <span>Address</span>
                    <input type="text" placeholder="Your address" />
                  </label>

                  <label class="section-contact__field section-contact__field--message">
                    <span>Your Message</span>
                    <textarea rows="4" placeholder="Type your message here"></textarea>
                  </label>

                  <button type="submit" class="section-contact__submit">Send Message</button>
                </form>
              </div>

              <div class="section-contact__map-shell">
                <iframe
                  class="section-contact__map"
                  :src="dasmarinasMapEmbedUrl"
                  title="Dasmarinas Cavite map"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  importance="low"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      </div>
    </main>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-footer__glow landing-footer__glow--one" aria-hidden="true" />
      <div class="landing-footer__glow landing-footer__glow--two" aria-hidden="true" />
      <div class="landing-footer__inner">
        <div class="landing-footer__brand">
          <div class="landing-footer__brand-top">
            <img class="landing-footer__logo" :src="logoPwd" alt="PWD logo" loading="lazy" decoding="async" />
            <div>
              <p class="landing-footer__eyebrow">Inclusive Employment Platform</p>
              <h3 class="landing-footer__title">PWD Employment Assistance</h3>
            </div>
          </div>
          <p class="landing-footer__copy">
            Building a more accessible path to employment for persons with disabilities through guided applications, verified job opportunities, and inclusive support.
          </p>
        </div>

        <div class="landing-footer__links">
          <div class="landing-footer__column">
            <p class="landing-footer__heading">Explore</p>
            <a href="#home">Home</a>
            <a href="#featured-jobs">Featured Jobs</a>
            <a href="#section-01">Popular Categories</a>
            <a href="/login">Start Journey</a>
          </div>

          <div class="landing-footer__column">
            <p class="landing-footer__heading">Support</p>
            <a href="#home">Accessibility Policy</a>
            <a href="#home">Terms and Conditions</a>
            <a href="#home">Privacy Policy</a>
            <a href="#home">Help Centesr</a>
          </div>

          <div class="landing-footer__column">
            <p class="landing-footer__heading">Contact</p>
            <span>Dasmarinas, Cavite</span>
            <span>support@pwdplatform.local</span>
            <span>Mon - Fri, 8:00 AM - 5:00 PM</span>
          </div>
        </div>
      </div>

      <div class="landing-footer__bottom">
        <p>&copy; {{ currentYear }} PWD Opportunity Portal. All rights reserved.</p>
        <p>Designed to support inclusive hiring and accessible career growth.</p>
      </div>
    </footer>
    </div>
  </div>
</template>

<style scoped src="@/components/main_landing.css"></style>

