<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoPwd from '@/assets/logo-pwd.png'
import pwdWordmark from '@/assets/pwdlogo.png'
import { subscribeToPublicJobs } from '@/lib/jobs'
import { mediaUrl } from '@/lib/media'

const router = useRouter()
const route = useRoute()

const navbarHidden = ref(false)
const isPolicyMenuOpen = ref(false)
const jobsLoading = ref(true)
const searchSubmitting = ref(false)
const loginSubmitting = ref(false)
const allJobs = ref([])
const selectedJob = ref(null)
const searchKeyword = ref('')
const searchLocation = ref('')
const searchJobCategory = ref('')
const searchCategory = ref('')
const selectedBarangay = ref('')
const quickFilters = ref({
  remoteOnly: false,
  multiVacancy: false,
  accessibilityPriority: false,
})

let searchTimer
let onScrollHandler
let onKeydownHandler
let onDocClickHandler
let loginTimer
let stopJobsFeedSync = () => {}

const disabilityOptions = [
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

const dasmaBarangayOptions = [
  'Salawag', 'San Agustin', 'San Jose', 'San Simon', 'Sampaloc I', 'Sampaloc II', 'Sampaloc III',
  'Sampaloc IV', 'Paliparan I', 'Paliparan II', 'Paliparan III', 'Sabang', 'Burol I', 'Burol II',
  'Burol III', 'Langkaan I', 'Langkaan II', 'Zone I', 'Zone II', 'Zone III', 'Zone IV',
]

const queryFilters = computed(() => ({
  keyword: String(route.query.keyword || '').trim(),
  location: String(route.query.location || '').trim(),
  jobCategory: String(route.query.jobCategory || '').trim(),
  category: String(route.query.category || '').trim(),
}))

const jobCategoryOptions = computed(() =>
  Array.from(new Set(allJobs.value.map((job) => String(job.category || '').trim()).filter(Boolean))),
)

const filteredJobs = computed(() => {
  const keyword = queryFilters.value.keyword.toLowerCase()
  const filterLocation = queryFilters.value.location.toLowerCase()
  const filterJobCategory = queryFilters.value.jobCategory.toLowerCase()
  const disability = queryFilters.value.category.toLowerCase()
  const barangay = String(selectedBarangay.value || '').trim().toLowerCase()

  return allJobs.value.filter((job) => {
    const title = String(job.title || '').toLowerCase()
    const desc = String(job.description || '').toLowerCase()
    const company = String(job.companyName || '').toLowerCase()
    const location = String(job.location || '').toLowerCase()
    const category = String(job.category || '').toLowerCase()
    const fit = String(job.disabilityFit || '').toLowerCase()
    const setup = String(job.setup || job.type || '').toLowerCase()

    return (
      (!keyword || title.includes(keyword) || desc.includes(keyword) || company.includes(keyword) || category.includes(keyword)) &&
      (!filterLocation || location.includes(filterLocation)) &&
      (!filterJobCategory || category.includes(filterJobCategory)) &&
      (!disability || normalizeDisabilityCategory(fit) === normalizeDisabilityCategory(disability)) &&
      (!quickFilters.value.remoteOnly || setup.includes('remote')) &&
      (!quickFilters.value.multiVacancy || Number(job.vacancies || 0) >= 3) &&
      (!quickFilters.value.accessibilityPriority || /(hearing|visual|physical|mobility|speech|learning|intellectual|autism|psychosocial)/i.test(fit)) &&
      (!barangay || location.includes(barangay))
    )
  })
})

function normalizeMediaUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return mediaUrl(raw)
}

function toStringList(value, splitBy) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean)
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw.split(splitBy || /\r?\n/).map((x) => String(x).trim()).filter(Boolean)
}

function normalizeDisabilityCategory(value) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!text) return ''
  if (/(autism)/.test(text)) return 'autism'
  if (/(cancer|rare|disease|chronic|illness)/.test(text)) return 'cancer survivors and rare disease individuals'
  if (/(deaf|hearing)/.test(text)) return 'deaf and hard of hearing individuals'
  if (/(dwarfism)/.test(text)) return 'dwarfism'
  if (/(intellectual|developmental|cognitive)/.test(text)) return 'intellectual disability'
  if (/(dyslex)/.test(text)) return 'learning disability dyslexic'
  if (/(learning)/.test(text)) return 'learning disability'
  if (/(lower limb|wheelchair|mobility)/.test(text)) return 'lower limb amputation deformity and wheelchair users'
  if (/(mental|psychosocial)/.test(text)) return 'mental and psychosocial disability individuals'
  if (/(physical|orthopedic)/.test(text)) return 'physical disability'
  if (/(speech|language)/.test(text)) return 'speech impairment'
  if (/(upper limb)/.test(text)) return 'upper limb amputation deformity'
  if (/(visual|visually|vision|blind)/.test(text)) return 'visually impaired'
  return text
}

function getCompanyInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (!words.length) return 'CO'
  return words.map((word) => word.charAt(0).toUpperCase()).join('')
}

function mapJobRecordToSearchJob(raw) {
  const id = String(raw?.id || '').trim()
  const title = String(raw?.title || '').trim()
  if (!id || !title) return null
  const status = String(raw?.status || '').trim().toLowerCase()
  if (status !== 'open') return null
  const createdAtRaw = String(raw?.createdAt || raw?.created_at || '').trim()
  const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : 0

  return {
    id,
    title,
    companyName: String(raw?.companyName || raw?.company || raw?.department || 'Company').trim(),
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
    postedDate:
      Number.isFinite(createdAtMs) && createdAtMs > 0
        ? `Posted: ${new Date(createdAtMs).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
        : `Posted: ${new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
    status: 'open',
  }
}

function applyJobsFeed(rows = []) {
  allJobs.value = (Array.isArray(rows) ? rows : []).map(mapJobRecordToSearchJob).filter(Boolean)
  jobsLoading.value = false
}

function startJobsFeed() {
  stopJobsFeedSync()
  jobsLoading.value = true

  stopJobsFeedSync = subscribeToPublicJobs(
    (rows) => {
      applyJobsFeed(rows)
    },
    () => {
      applyJobsFeed([])
    },
  )
}

function triggerSearchLoading() {
  window.clearTimeout(searchTimer)
  searchSubmitting.value = true
  searchTimer = window.setTimeout(() => {
    searchSubmitting.value = false
  }, 420)
}

function applySearchFilters(next = {}) {
  const query = {}
  const keyword = String(next.keyword ?? searchKeyword.value).trim()
  const location = String(next.location ?? searchLocation.value).trim()
  const jobCategory = String(next.jobCategory ?? searchJobCategory.value).trim()
  const category = String(next.category ?? searchCategory.value).trim()
  if (keyword) query.keyword = keyword
  if (location) query.location = location
  if (jobCategory) query.jobCategory = jobCategory
  if (category) query.category = category
  triggerSearchLoading()
  router.push({ path: '/search-jobs', query })
}

async function navigateToLogin() {
  if (loginSubmitting.value) return
  loginSubmitting.value = true
  try {
    await new Promise((resolve) => {
      loginTimer = window.setTimeout(resolve, 320)
    })
    await router.push('/login')
  } finally {
    loginSubmitting.value = false
  }
}

function openJobDetails(job) {
  selectedJob.value = job
}

function closeJobDetails() {
  selectedJob.value = null
}

function applyToJob(job) {
  const targetJob = job || selectedJob.value
  if (!targetJob) return
  const user = String(localStorage.getItem('authToken') || '').trim()
  if (!user) {
    router.push('/login')
    return
  }
  window.alert(`Application sent for ${targetJob.title}.`)
}

function saveJob(job) {
  const targetJob = job || selectedJob.value
  if (!targetJob) return
  window.alert(`${targetJob.companyName} saved.`)
}

function goToLandingSection(hash) {
  router.push({ path: '/', hash })
}

watch(
  () => route.fullPath,
  () => {
    searchKeyword.value = queryFilters.value.keyword
    searchLocation.value = queryFilters.value.location
    searchJobCategory.value = queryFilters.value.jobCategory
    searchCategory.value = queryFilters.value.category
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  },
  { immediate: true },
)

watch(selectedBarangay, () => {
  triggerSearchLoading()
})

onMounted(() => {
  startJobsFeed()

  let lastY = window.scrollY || 0
  onScrollHandler = () => {
    const currentY = window.scrollY || 0
    if (currentY <= 12) navbarHidden.value = false
    else {
      const delta = currentY - lastY
      if (delta > 6 && currentY > 90) navbarHidden.value = true
      if (delta < -3) navbarHidden.value = false
    }
    lastY = currentY
  }
  onKeydownHandler = (e) => {
    if (e.key === 'Escape' && selectedJob.value) closeJobDetails()
  }
  onDocClickHandler = (e) => {
    if (!e.target.closest('.search-landing-nav__policy')) isPolicyMenuOpen.value = false
  }

  window.addEventListener('scroll', onScrollHandler, { passive: true })
  window.addEventListener('keydown', onKeydownHandler)
  document.addEventListener('click', onDocClickHandler)
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(loginTimer)
  stopJobsFeedSync()
  if (onScrollHandler) window.removeEventListener('scroll', onScrollHandler)
  if (onKeydownHandler) window.removeEventListener('keydown', onKeydownHandler)
  if (onDocClickHandler) document.removeEventListener('click', onDocClickHandler)
})
</script>

<template>
  <div class="search-page">
    <div v-if="searchSubmitting" class="search-submit-overlay">
      <div class="search-submit-card">
        <div class="spinner" />
        <div>
          <p class="submit-title">Searching jobs for you</p>
          <p class="submit-subtitle">Please wait while we update the job results.</p>
        </div>
      </div>
    </div>

    <div v-if="loginSubmitting" class="loading-screen" role="status" aria-live="polite" aria-label="Opening login page">
      <div class="loading-screen__aurora loading-screen__aurora--one" />
      <div class="loading-screen__aurora loading-screen__aurora--two" />
      <div class="loading-screen__grid" />
      <div class="loading-screen__panel">
        <div class="loading-screen__logo-shell">
          <img class="loading-screen__logo" :src="logoPwd" alt="PWD logo" decoding="async" fetchpriority="high" />
        </div>
        <img class="loading-screen__wordmark" :src="pwdWordmark" alt="PWD Platform" decoding="async" fetchpriority="high" />
        <p class="submit-subtitle">Please wait while we prepare the sign in screen.</p>
        <div class="loading-screen__dots" aria-hidden="true">
          <span class="loading-screen__dot" />
          <span class="loading-screen__dot" />
          <span class="loading-screen__dot" />
        </div>
      </div>
    </div>

    <header class="search-landing-nav" :class="{ 'is-hidden': navbarHidden }">
      <nav class="search-landing-nav__inner">
        <a class="search-landing-nav__brand" href="/" @click.prevent="router.push('/')">
          <img :src="logoPwd" alt="PWD logo" class="search-landing-nav__brand-mark" />
          <img :src="pwdWordmark" alt="PWD wordmark" class="search-landing-nav__brand-wordmark" />
        </a>
        <div class="search-landing-nav__links">
          <a href="/" @click.prevent="router.push('/')">Home</a>
          <a href="/#featured-jobs" @click.prevent="goToLandingSection('#featured-jobs')">Jobs</a>
          <a href="/#section-03" @click.prevent="goToLandingSection('#section-03')">Features</a>
          <a href="/#contact-us" @click.prevent="goToLandingSection('#contact-us')">About Us</a>
          <div class="search-landing-nav__policy">
            <button type="button" @click="isPolicyMenuOpen = !isPolicyMenuOpen">
              <span>Policy</span>
              <i class="bi bi-chevron-down" :class="{ 'is-open': isPolicyMenuOpen }" />
            </button>
            <div v-if="isPolicyMenuOpen" class="search-landing-nav__policy-menu">
              <a href="/#privacy">Privacy Policy</a>
              <a href="/#privacy">Terms and Conditions</a>
              <a href="/#privacy">Accessibility Policy</a>
            </div>
          </div>
        </div>
        <button type="button" class="search-landing-nav__cta" :disabled="loginSubmitting" @click="navigateToLogin">Login</button>
      </nav>
    </header>

    <main class="results-main">
      <section class="results-shell">
        <button type="button" class="page-back-btn" @click="router.push('/')">
          <i class="bi bi-arrow-left-circle" aria-hidden="true" />
          Back to Home
        </button>

        <div class="results-head">
          <h1>Job Search Results</h1>
          <p>Showing results based on your filters from the landing page.</p>
        </div>

        <form class="results-search-form" @submit.prevent="applySearchFilters()">
          <div class="results-search-fields">
            <label class="results-search-field">
              <i class="bi bi-search" aria-hidden="true" />
              <input v-model="searchKeyword" placeholder="What opportunities are you looking for?" />
            </label>
            <label class="results-search-field results-search-field-select">
              <select v-model="searchJobCategory">
                <option value="">All Categories</option>
                <option v-for="option in jobCategoryOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="results-search-field results-search-field-select">
              <select v-model="searchCategory">
                <option value="">All Disabilities Types</option>
                <option v-for="option in disabilityOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <button type="submit" class="results-search-submit">Search</button>
          </div>
        </form>

        <div class="results-layout">
          <aside class="results-filters-card">
            <p class="results-filters-title">Quick Filters</p>
            <label class="results-check-row"><input v-model="quickFilters.remoteOnly" type="checkbox" /> <span>Remote setup only</span></label>
            <label class="results-check-row"><input v-model="quickFilters.multiVacancy" type="checkbox" /> <span>3+ vacancies</span></label>
            <label class="results-check-row"><input v-model="quickFilters.accessibilityPriority" type="checkbox" /> <span>PWD support prioritized</span></label>
            <div class="results-filter-subgroup">
              <p class="results-filter-subtitle">Barangay / Area</p>
              <select v-model="selectedBarangay" class="results-filter-select">
                <option value="">All Dasmarinas Barangays</option>
                <option v-for="option in dasmaBarangayOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </div>
          </aside>

          <div
            class="results-list-area"
            :class="[
              { 'has-scroll': !jobsLoading && filteredJobs.length >= 5 },
              !jobsLoading && filteredJobs.length === 0 ? 'results-list-area--empty' : '',
            ]"
          >
            <div v-if="jobsLoading" class="results-grid">
              <article v-for="idx in 4" :key="idx" class="result-card skeleton-card">
                <div class="skeleton-line short" />
                <div class="skeleton-head">
                  <div class="skeleton-logo" />
                  <div class="skeleton-copy">
                    <div class="skeleton-line title" />
                    <div class="skeleton-line company" />
                  </div>
                </div>
                <div class="skeleton-line" />
                <div class="skeleton-line wide" />
              </article>
            </div>

            <div v-else-if="filteredJobs.length === 0" class="empty-card">
              <div class="empty-card__icon-wrap">
                <i class="bi bi-briefcase-fill" />
                <span class="empty-card__badge">
                  <i class="bi bi-slash-circle-fill" />
                </span>
              </div>
              <h2>No job post yet.</h2>
              <p>No job posts match your current filters. Try adjusting your search.</p>
            </div>

            <div v-else class="results-grid">
              <article
                v-for="job in filteredJobs"
                :key="job.id"
                class="result-card result-card-clickable"
                :class="{ 'is-active': selectedJob?.id === job.id }"
                role="button"
                tabindex="0"
                @click="openJobDetails(job)"
                @keydown.enter.prevent="openJobDetails(job)"
                @keydown.space.prevent="openJobDetails(job)"
              >
                <div class="result-card-top">
                  <span class="result-status-inline"><i class="bi bi-dot" /> Open</span>
                  <span class="result-posted-inline"><i class="bi bi-clock-history" /> {{ String(job.postedDate).replace('Posted: ', '') }}</span>
                </div>
                <div class="result-head">
                  <div class="result-logo">
                    <img v-if="job.logoUrl" :src="job.logoUrl" alt="" class="search-job-logo-image" />
                    <template v-else>{{ getCompanyInitials(job.companyName) }}</template>
                  </div>
                  <div class="result-title-wrap">
                    <h3>{{ job.title }}</h3>
                    <p class="result-company-line"><i class="bi bi-building" /> <span>{{ job.companyName }}</span></p>
                  </div>
                </div>
                <p class="desc">{{ job.description }}</p>
                <div class="result-meta-inline">
                  <span class="result-meta-chip"><i class="bi bi-geo-alt" /> {{ job.location }}</span>
                  <span class="result-meta-chip"><i class="bi bi-briefcase" /> {{ job.category }}</span>
                  <span class="result-meta-chip"><i class="bi bi-laptop" /> {{ job.setup || job.type }}</span>
                  <span class="result-meta-chip"><i class="bi bi-people" /> {{ job.vacancies }} Vacancies</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div v-if="selectedJob" class="detail-modal-overlay" @click="closeJobDetails">
      <article class="detail-modal" @click.stop>
        <div class="detail-head">
          <div class="detail-head-card">
            <button type="button" class="detail-close-btn" @click="closeJobDetails">
              <i class="bi bi-x-lg" />
            </button>
            <div class="detail-head-main">
              <div class="detail-logo">
                <img v-if="selectedJob.logoUrl" :src="selectedJob.logoUrl" alt="" class="search-job-logo-image" />
                <template v-else>{{ getCompanyInitials(selectedJob.companyName) }}</template>
              </div>
              <div class="detail-head-copy">
                <div class="detail-head-badges">
                  <span class="result-status-inline"><i class="bi bi-dot" /> Open</span>
                  <span class="result-posted-inline"><i class="bi bi-clock-history" /> {{ String(selectedJob.postedDate).replace('Posted: ', '') }}</span>
                </div>
                <h2>{{ selectedJob.title }}</h2>
                <p class="result-company-line"><i class="bi bi-building" /> <span>{{ selectedJob.companyName }}</span></p>
                <p class="detail-meta-inline">
                  <span class="result-meta-chip"><i class="bi bi-geo-alt" /> {{ selectedJob.location }}</span>
                  <span class="result-meta-chip"><i class="bi bi-briefcase" /> {{ selectedJob.category }}</span>
                  <span class="result-meta-chip"><i class="bi bi-clock" /> {{ selectedJob.type }}</span>
                  <span class="result-meta-chip"><i class="bi bi-people" /> {{ selectedJob.vacancies }} Vacancies</span>
                </p>
              </div>
            </div>
            <button type="button" class="detail-view-map-btn">
              <i class="bi bi-map" /> View Map
            </button>
          </div>
        </div>
        <div class="detail-body">
          <section class="detail-panel">
            <h3><i class="bi bi-file-text" /> Job Description</h3>
            <p>{{ selectedJob.description }}</p>
          </section>
          <div class="detail-panels">
            <section class="detail-panel">
              <h3><i class="bi bi-check2-circle" /> Qualifications</h3>
              <ul class="detail-list">
                <li v-for="item in (selectedJob.qualifications.length ? selectedJob.qualifications : ['No qualifications provided.'])" :key="item"><i class="bi bi-dot" /> <span>{{ item }}</span></li>
              </ul>
            </section>
            <section class="detail-panel">
              <h3><i class="bi bi-list-task" /> Responsibilities</h3>
              <ul class="detail-list">
                <li v-for="item in (selectedJob.responsibilities.length ? selectedJob.responsibilities : ['No responsibilities provided.'])" :key="item"><i class="bi bi-dot" /> <span>{{ item }}</span></li>
              </ul>
            </section>
          </div>
          <div class="detail-actions">
            <button type="button" class="action-btn detail-secondary-btn" @click="saveJob(selectedJob)">Save</button>
            <button type="button" class="action-btn detail-primary-btn" @click="applyToJob(selectedJob)">Apply Now</button>
          </div>
        </div>
      </article>
    </div>

    <footer id="privacy" class="search-landing-footer">
      <div class="search-landing-footer__inner">
        <div>
          <div class="search-landing-footer__brand">
            <img :src="logoPwd" alt="PWD logo" />
            <img :src="pwdWordmark" alt="PWD wordmark" />
          </div>
          <p>Inclusive employment support for applicants, employers, and accessible opportunity matching across the PWD employment platform.</p>
        </div>
        <div class="search-landing-footer__links">
          <a href="/" @click.prevent="router.push('/')">Home</a>
          <a href="/#featured-jobs" @click.prevent="goToLandingSection('#featured-jobs')">Jobs</a>
          <a href="/#section-03" @click.prevent="goToLandingSection('#section-03')">Features</a>
          <a href="/#contact-us" @click.prevent="goToLandingSection('#contact-us')">Contact</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.search-page{min-height:100vh;background:radial-gradient(circle at 12% 10%,rgba(53,136,90,.1),transparent 24%),linear-gradient(180deg,#eef4ef 0%,#f8fbf8 100%);color:#17231d}.search-landing-nav{position:relative;z-index:30;border-bottom:1px solid #dce6e0;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);box-shadow:0 10px 24px rgba(23,35,29,.06);transition:transform .26s ease}.search-landing-nav.is-hidden{transform:translateY(-100%)}.search-landing-nav__inner{width:min(1180px,calc(100% - 2rem));margin:0 auto;padding:1rem 0;display:grid;grid-template-columns:auto 1fr auto;gap:1.25rem;align-items:center}.search-landing-nav__brand{display:inline-flex;align-items:center;gap:.55rem}.search-landing-nav__brand-mark{width:2.75rem;height:2.75rem}.search-landing-nav__brand-wordmark{height:2.35rem}.search-landing-nav__links{display:inline-flex;align-items:center;justify-content:center;gap:1.5rem;font-size:.95rem;font-weight:600}.search-landing-nav__links a,.search-landing-nav__policy button{color:#17231d;transition:transform .2s ease,opacity .2s ease}.search-landing-nav__links a:hover,.search-landing-nav__policy button:hover{transform:translateY(-1px);opacity:.82}.search-landing-nav__policy{position:relative}.search-landing-nav__policy button{display:inline-flex;align-items:center;gap:.45rem;border:0;background:transparent;font:inherit;cursor:pointer}.search-landing-nav__policy-menu{position:absolute;top:calc(100% + .85rem);left:50%;transform:translateX(-50%);min-width:12rem;padding:.35rem;border:1px solid #dce6e0;border-radius:.85rem;background:#fff;box-shadow:0 16px 28px rgba(23,35,29,.12)}.search-landing-nav__policy-menu a{display:block;padding:.68rem .8rem;border-radius:.65rem}.search-landing-nav__cta,.results-search-submit,.detail-primary-btn,.detail-view-map-btn{border:1px solid #11442f;border-radius:10px;background:linear-gradient(135deg,#11442f 0%,#1b6a49 100%);color:#fff;box-shadow:0 12px 24px rgba(17,68,47,.2)}.search-landing-nav__cta{padding:.72rem 1.08rem;font-size:.92rem;font-weight:600}.results-main{width:min(1280px,calc(100% - 2rem));margin:0 auto;padding:1.8rem 0 2.5rem}.results-shell{display:grid;gap:1.25rem}.page-back-btn{width:fit-content;border:0;background:transparent;color:#2f3f38;font-weight:600;display:inline-flex;align-items:center;gap:.55rem}.results-head h1{margin:0;font-size:clamp(2rem,3vw,2.8rem);line-height:1.05}.results-head p{margin:.35rem 0 0;color:#5f6b65}.results-search-form,.results-filters-card,.results-list-area,.detail-head-card,.detail-panel{border:1px solid #dce6e0;background:rgba(255,255,255,.96);box-shadow:0 20px 36px rgba(23,35,29,.08)}.results-search-form,.results-filters-card,.results-list-area{border-radius:1.3rem}.results-search-form{padding:1rem}.results-search-fields{display:grid;grid-template-columns:1.35fr .9fr 1fr auto;gap:.8rem}.results-search-field{display:flex;align-items:center;gap:.65rem;min-height:3.25rem;padding:0 .95rem;border:1px solid #dce6e0;border-radius:.9rem;background:#fff}.results-search-field input,.results-search-field select,.results-filter-select{width:100%;border:0;background:transparent;outline:none;font:inherit;color:#24332b}.results-search-submit{min-width:8rem;padding:0 1.2rem;font-weight:700}.results-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:1rem;align-items:start}.results-filters-card{padding:1rem;position:sticky;top:5.8rem}.results-filters-title,.results-filter-subtitle{margin:0 0 .8rem;font-weight:800}.results-check-row{display:flex;align-items:center;gap:.65rem;margin-top:.7rem}.results-filter-subgroup{margin-top:1rem}.results-filter-select{min-height:2.9rem;padding:0 .85rem;border:1px solid #dce6e0;border-radius:.85rem;background:#fff}.results-list-area{padding:1rem}.results-list-area.has-scroll{max-height:calc(100vh - 9rem);overflow-y:auto}.results-list-area--empty{border-color:transparent;background:transparent;box-shadow:none}.results-grid{display:grid;gap:.9rem}.result-card{padding:1rem;border:1px solid #dce6e0;border-radius:1rem;background:#fff;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}.result-card-clickable{cursor:pointer}.result-card-clickable:hover,.result-card-clickable.is-active{transform:translateY(-4px);border-color:rgba(27,138,84,.36);box-shadow:0 18px 28px rgba(23,35,29,.1),0 0 22px rgba(27,138,84,.08)}.result-card-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.9rem}.result-status-inline,.result-posted-inline,.result-meta-chip{display:inline-flex;align-items:center;gap:.38rem;padding:.42rem .7rem;border-radius:999px;font-size:.78rem;font-weight:700}.result-status-inline{background:#edf8f2;color:#146641}.result-posted-inline{background:#faf7ff;color:#5b43a4}.result-head,.detail-head-main{display:flex;gap:.95rem;align-items:flex-start}.result-logo,.detail-logo,.skeleton-logo{width:3.25rem;height:3.25rem;display:grid;place-items:center;border:1px solid #dce6e0;background:#f7faf8;font-weight:800;color:#1b8a54}.search-job-logo-image{width:100%;height:100%;object-fit:contain}.result-title-wrap h3,.detail-head-copy h2{margin:0;line-height:1.15}.result-company-line{margin:.3rem 0 0;display:inline-flex;align-items:center;gap:.4rem;color:#5f6b65}.desc{margin:.9rem 0 0;color:#48565f;line-height:1.65}.result-meta-inline,.detail-meta-inline{margin-top:.9rem;display:flex;flex-wrap:wrap;gap:.55rem}.result-meta-chip{background:#fbfcfb;color:#203029}.empty-card{min-height:24rem;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;text-align:center}.empty-card__icon-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:4.75rem;height:4.75rem;border-radius:999px;background:#eef7f1;box-shadow:inset 0 0 0 1px rgba(27,138,84,.12)}.empty-card__icon-wrap>.bi{font-size:2rem;color:#1b8a54}.empty-card__badge{position:absolute;right:-.15rem;bottom:-.15rem;display:flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:999px;background:#fff1f1;color:#df5b57;box-shadow:0 8px 18px rgba(223,91,87,.16)}.empty-card__badge .bi{font-size:.95rem;color:inherit}.empty-card h2{margin:1rem 0 0;font-size:1.05rem;font-weight:700;color:#33433d}.empty-card p{margin:.35rem 0 0;max-width:18rem;font-size:.84rem;line-height:1.65;color:#7a8882}.skeleton-card,.skeleton-line,.skeleton-logo{position:relative;overflow:hidden;background:linear-gradient(180deg,#e7ece9 0%,#dde5e0 100%)}.skeleton-card::after,.skeleton-line::after,.skeleton-logo::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);animation:shimmer 1.3s linear infinite}.skeleton-line{height:.95rem;border-radius:999px;margin-top:.8rem}.skeleton-line.short{width:26%}.skeleton-line.title{width:58%}.skeleton-line.company{width:42%}.skeleton-line.wide{width:72%}.skeleton-head{display:flex;gap:.95rem;align-items:center;margin-top:.9rem}.skeleton-copy{flex:1}.search-submit-overlay{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(10,24,17,.28);backdrop-filter:blur(8px)}.search-submit-card{width:min(25rem,calc(100% - 2rem));padding:1.25rem;border-radius:1.15rem;background:rgba(255,255,255,.96);box-shadow:0 26px 46px rgba(23,35,29,.16);display:flex;gap:1rem;align-items:center}.spinner{width:2.8rem;height:2.8rem;border:3px solid rgba(21,90,57,.14);border-top-color:#155a39;border-right-color:#d7a44f;border-radius:999px;animation:spin .85s linear infinite}.search-login-loading-screen{position:fixed;inset:0;z-index:55;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 18% 18%,rgba(255,214,150,.2),transparent 34%),radial-gradient(circle at 82% 16%,rgba(116,176,137,.2),transparent 30%),linear-gradient(160deg,#07110d 0%,#0e1f17 48%,#143123 100%)}.search-login-loading-screen__aurora{position:absolute;filter:blur(0);opacity:.92;mix-blend-mode:screen;animation:search-loader-float 11s ease-in-out infinite alternate}.search-login-loading-screen__aurora--one{top:-18%;left:-8%;width:22rem;height:22rem;border-radius:50%;background:radial-gradient(circle,rgba(252,223,177,.8) 0%,rgba(252,223,177,.1) 58%,transparent 76%)}.search-login-loading-screen__aurora--two{right:-12%;bottom:-16%;width:26rem;height:26rem;border-radius:50%;background:radial-gradient(circle,rgba(91,155,111,.74) 0%,rgba(91,155,111,.08) 62%,transparent 78%);animation-duration:13s;animation-delay:-2s}.search-login-loading-screen__grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:3.9rem 3.9rem;mask-image:radial-gradient(circle at center,rgba(0,0,0,.82) 0%,rgba(0,0,0,.44) 58%,transparent 100%);opacity:.32}.search-login-loading-screen__panel{position:relative;z-index:1;width:min(31rem,calc(100% - 2rem));padding:2.3rem 2rem;border:1px solid rgba(230,239,233,.16);border-radius:1.8rem;background:linear-gradient(180deg,rgba(244,248,245,.12) 0%,rgba(205,219,211,.06) 100%);backdrop-filter:blur(20px);box-shadow:0 32px 70px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.14);text-align:center}.search-login-loading-screen__logo-shell{width:5.65rem;height:5.65rem;margin:0 auto 1.15rem;border-radius:1.7rem;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.06) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 14px 26px rgba(0,0,0,.22)}.search-login-loading-screen__logo{width:3.75rem;height:3.75rem;object-fit:contain;animation:search-loader-float 4s ease-in-out infinite}.search-login-loading-screen__wordmark{display:block;height:2.9rem;width:auto;margin:0 auto .95rem;object-fit:contain}.search-login-loading-screen__dots{display:inline-flex;align-items:center;gap:.42rem;margin-top:1rem}.search-login-loading-screen__dots span{width:.62rem;height:.62rem;border-radius:999px;background:linear-gradient(180deg,#fff2d7 0%,#dcb05f 100%);animation:pulse 1.2s ease-in-out infinite}.search-login-loading-screen__dots span:nth-child(2){animation-delay:.18s}.search-login-loading-screen__dots span:nth-child(3){animation-delay:.36s}.submit-title{margin:0;font-weight:800}.submit-subtitle{margin:.2rem 0 0;color:#5f6b65}.search-login-loading-screen .submit-title{color:#f8fbf8;font-size:1.22rem}.search-login-loading-screen .submit-subtitle{color:rgba(238,245,239,.78)}.detail-modal-overlay{position:fixed;inset:0;z-index:50;padding:1.2rem;display:grid;place-items:center;background:rgba(8,20,14,.62);backdrop-filter:blur(10px)}.detail-modal{width:min(1100px,100%);max-height:calc(100vh - 2.4rem);overflow:auto;border-radius:1.6rem;background:#eff4ef;box-shadow:0 30px 60px rgba(0,0,0,.22)}.detail-head,.detail-body{padding:1.1rem}.detail-head-card{position:relative;border-radius:1.25rem;padding:1rem}.detail-close-btn{position:absolute;right:1rem;top:1rem;border:1px solid #dce6e0;border-radius:.85rem;background:#fff;min-width:2.8rem;min-height:2.8rem}.detail-head-copy{flex:1}.detail-head-badges,.detail-actions{display:flex;flex-wrap:wrap;gap:.6rem}.detail-view-map-btn{align-self:start;padding:.9rem 1.05rem;font-weight:700}.detail-body{display:grid;gap:.9rem}.detail-panel{border-radius:1.2rem;padding:1rem}.detail-panel h3{margin:0 0 .8rem;display:inline-flex;align-items:center;gap:.5rem}.detail-panel p{margin:0;color:#48565f;line-height:1.7}.detail-panels{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}.detail-list{margin:0;padding:0;list-style:none;display:grid;gap:.55rem}.detail-list li{display:flex;align-items:flex-start;gap:.45rem;color:#48565f}.detail-actions{padding:0 1.1rem 1.1rem}.detail-secondary-btn{border:1px solid #dce6e0;background:#fff;color:#21312b}.action-btn{min-height:3rem;padding:.82rem 1.15rem;border-radius:.95rem;font-weight:700}.search-landing-footer{margin-top:1rem;padding:2rem 1.2rem 1.1rem;background:linear-gradient(180deg,#10261b 0%,#091811 100%);color:#eef5ef}.search-landing-footer__inner{width:min(1180px,100%);margin:0 auto;display:grid;grid-template-columns:1.2fr .8fr;gap:1.5rem}.search-landing-footer__brand{display:inline-flex;align-items:center;gap:.6rem}.search-landing-footer__brand img:first-child{width:2.9rem;height:2.9rem}.search-landing-footer__brand img:last-child{height:2.35rem}.search-landing-footer__links{display:grid;justify-items:start;gap:.5rem}.search-landing-footer__links a{color:#eef5ef;opacity:.9}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{100%{transform:translateX(100%)}}@keyframes search-loader-float{0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(1rem,-1.25rem,0) scale(1.05)}}@keyframes pulse{0%,100%{transform:translateY(0);opacity:.52}50%{transform:translateY(-.3rem);opacity:1}}@media (max-width:1100px){.results-layout{grid-template-columns:1fr}.results-filters-card{position:static}.search-landing-nav__inner{grid-template-columns:1fr;justify-items:center}}@media (max-width:900px){.results-search-fields,.detail-panels,.search-landing-footer__inner{grid-template-columns:1fr}}@media (max-width:640px){.results-main{width:calc(100% - 1rem)}.search-landing-nav__links{flex-wrap:wrap;gap:.9rem}.detail-modal-overlay{padding:.5rem}.search-login-loading-screen__panel{padding:2rem 1.2rem}.search-login-loading-screen__wordmark{height:2.35rem}}
</style>

<style scoped>
.search-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.results-main {
  flex: 1 0 auto;
}

.search-landing-footer {
  margin-top: auto;
}

.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 18%, rgba(87, 138, 102, 0.14), transparent 30%),
    linear-gradient(180deg, rgba(7, 29, 19, 0.985) 0%, rgba(5, 21, 14, 0.995) 100%);
  backdrop-filter: blur(12px);
}

.loading-screen__aurora {
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.42;
  pointer-events: none;
}

.loading-screen__aurora--one {
  top: 10%;
  left: -10%;
  width: 34rem;
  height: 34rem;
  background: radial-gradient(circle, rgba(51, 132, 79, 0.34) 0%, rgba(51, 132, 79, 0) 68%);
  animation: loading-aurora-one 8s ease-in-out infinite alternate;
}

.loading-screen__aurora--two {
  right: -12%;
  bottom: 2%;
  width: 30rem;
  height: 30rem;
  background: radial-gradient(circle, rgba(86, 168, 112, 0.24) 0%, rgba(86, 168, 112, 0) 70%);
  animation: loading-aurora-two 9s ease-in-out infinite alternate;
}

.loading-screen__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.08));
  opacity: 0.4;
  animation: loading-grid-drift 10s linear infinite;
}

.loading-screen__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  animation: loading-panel-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.loading-screen__logo-shell {
  display: grid;
  place-items: center;
  width: 8.75rem;
  height: 8.75rem;
}

.loading-screen__logo-shell::before {
  content: '';
  position: absolute;
  width: 8.75rem;
  height: 8.75rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(61, 147, 89, 0.16) 0%, rgba(61, 147, 89, 0) 72%);
  filter: blur(8px);
  z-index: -1;
}

.loading-screen__logo-shell::after {
  content: '';
  position: absolute;
  width: 5.9rem;
  height: 5.9rem;
  border-radius: 1.8rem;
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 18px 42px rgba(0, 0, 0, 0.28);
}

.loading-screen__logo-shell,
.loading-screen__logo,
.loading-screen__wordmark {
  position: relative;
  z-index: 1;
}

.loading-screen__logo-shell {
  display: grid;
  place-items: center;
}

.loading-screen__logo {
  width: 6.15rem;
  height: 6.15rem;
  object-fit: contain;
  animation: loading-logo-float 2.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) 0.25s infinite;
}

.loading-screen__wordmark {
  width: min(15.5rem, 68vw);
  height: auto;
  object-fit: contain;
  opacity: 0.82;
  transform: translateY(-0.35rem);
}

.loading-screen__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  transform: translateY(-0.15rem);
}

.loading-screen__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: rgba(243, 190, 121, 0.88);
  animation: loading-dot-pulse 1.2s ease-in-out infinite;
}

.loading-screen__dot:nth-child(2) {
  animation-delay: 0.18s;
}

.loading-screen__dot:nth-child(3) {
  animation-delay: 0.36s;
}

.loading-screen .submit-title {
  margin: 0;
  color: rgba(232, 238, 233, 0.2);
  font-size: 1.22rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  transform: translateY(-0.15rem);
}

.loading-screen .submit-subtitle {
  margin: -0.15rem 0 0;
  color: rgba(225, 234, 228, 0.22);
  font-size: 0.98rem;
  letter-spacing: 0.01em;
}

@keyframes loading-aurora-one {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  100% {
    transform: translate3d(3rem, -1rem, 0) scale(1.08);
  }
}

@keyframes loading-aurora-two {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  100% {
    transform: translate3d(-2.5rem, 1.5rem, 0) scale(1.05);
  }
}

@keyframes loading-grid-drift {
  0% {
    transform: translate3d(0, 0, 0);
  }

  100% {
    transform: translate3d(0, 24px, 0);
  }
}

@keyframes loading-panel-in {
  0% {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes loading-logo-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@keyframes loading-dot-pulse {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }

  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .loading-screen__logo-shell {
    width: 7.4rem;
    height: 7.4rem;
  }

  .loading-screen__logo-shell::before {
    width: 7.4rem;
    height: 7.4rem;
  }

  .loading-screen__logo-shell::after {
    width: 5.1rem;
    height: 5.1rem;
  }

  .loading-screen__logo {
    width: 5.25rem;
    height: 5.25rem;
  }

  .loading-screen__wordmark {
    width: min(13rem, 74vw);
  }

  .loading-screen .submit-title {
    font-size: 1.08rem;
  }

  .loading-screen .submit-subtitle {
    font-size: 0.92rem;
  }
}

.page-back-btn {
  cursor: pointer;
  padding: 0.68rem 1rem;
  border: 1px solid rgba(17, 68, 47, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 10px 24px rgba(23, 35, 29, 0.06);
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    background-color 0.22s ease,
    box-shadow 0.22s ease,
    color 0.22s ease;
}

.page-back-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(27, 106, 73, 0.3);
  background: rgba(232, 243, 236, 0.96);
  color: #11442f;
  box-shadow: 0 16px 28px rgba(23, 35, 29, 0.1), 0 0 18px rgba(27, 138, 84, 0.08);
}

.page-back-btn:focus-visible {
  outline: none;
  border-color: rgba(27, 106, 73, 0.42);
  box-shadow: 0 0 0 4px rgba(27, 138, 84, 0.12);
}

.search-landing-nav__cta {
  border: 1px solid #11442f;
  background: linear-gradient(135deg, #11442f 0%, #1b6a49 100%);
  color: #fff;
  box-shadow: 0 12px 24px rgba(17, 68, 47, 0.2);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition:
    background 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    opacity 0.24s ease;
}

.search-landing-nav__cta::after {
  content: "";
  position: absolute;
  top: -35%;
  left: -55%;
  width: 34%;
  height: 170%;
  background: linear-gradient(115deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.14) 22%, rgba(255, 255, 255, 0.88) 48%, rgba(255, 255, 255, 0.14) 74%, rgba(255, 255, 255, 0) 100%);
  opacity: 0;
  transform: translateX(0) skewX(-22deg);
  filter: blur(1px);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease;
}

.search-landing-nav__cta:hover,
.search-landing-nav__cta:focus-visible {
  background: #0d3525;
  border-color: #0d3525;
  box-shadow: 0 10px 22px rgba(17, 68, 47, 0.18);
  opacity: 0.96;
}

.search-landing-nav__cta:hover::after,
.search-landing-nav__cta:focus-visible::after {
  opacity: 1;
  transform: translateX(540%) skewX(-22deg);
}
</style>
