<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoPwd from '@/assets/logo-pwd.png'
import pwdWordmark from '@/assets/pwdlogo.png'
import supportIcons from '@/assets/support-icons.png'
import termsImage from '@/assets/terms.png'
import privacyImage from '@/assets/privacy.png'

const route = useRoute()
const router = useRouter()
const navLinks = [
  { label: 'Home', href: '/#home' },
  { label: 'Jobs', href: '/#featured-jobs' },
  { label: 'Features', href: '/#section-03' },
  { label: 'About Us', href: '/#contact-us' },
]

const supportPages = {
  // Help Center page content
  'help-center': {
    eyebrow: 'Support Docs',
    title: 'Help Center',
    subtitle:
      'Find quick answers, login guidance, and practical steps to help applicants use the platform with less confusion.',
    heroPrimary: { label: 'View Tutorial', href: '/step-view-tutorial' },
    heroSecondary: { label: 'Back to Login', href: '/login' },
    groups: [
      {
        title: 'Getting Started',
        items: [
          {
            question: 'How do I log in to my account?',
            answer:
              'Use the email address you registered with, type your password carefully, then click the Login button to continue.',
          },
          {
            question: 'What should I do if I entered the wrong password?',
            answer:
              'Use the eye icon in the password field to check what you typed, make sure caps lock is off, then try again with the correct password.',
          },
          {
            question: 'What should I do after registration?',
            answer:
              'Watch for email verification or admin approval updates first. Once your account is ready, return to the login page and sign in again.',
          },
          {
            question: 'How do I continue to the applicant steps?',
            answer:
              'After a successful login, follow the applicant flow shown on your dashboard or open the tutorial page for the step-by-step guide.',
          },
        ],
      },
      {
        title: 'Account Access',
        items: [
          {
            question: 'Why am I seeing email verification reminders?',
            answer:
              'Some account actions stay limited until your email is verified. Check your inbox and spam folder for the latest verification message.',
          },
          {
            question: 'Why is my account still waiting for admin approval?',
            answer:
              'Some applicant and employer accounts need manual review before full access is given. Please wait for the approval notice from the platform team.',
          },
          {
            question: 'What happens when my login is temporarily locked?',
            answer:
              'Too many wrong password attempts can pause login access for a short time. The system will show the date and time when you can try again.',
          },
          {
            question: 'How does the password visibility option help?',
            answer:
              'The eye icon lets you show or hide the password so you can review possible typing mistakes before submitting again.',
          },
        ],
      },
      {
        title: 'Next Steps',
        items: [
          {
            question: 'Where can I open the tutorial page?',
            answer:
              'Use the View Tutorial button at the top of this page if you want a guided walkthrough before continuing with your account.',
          },
          {
            question: 'How do I continue to registration?',
            answer:
              'Go back to the role selection page, choose the correct role, then continue with the registration form that matches your account type.',
          },
          {
            question: 'How do I return to the login screen?',
            answer:
              'Click the Back to Login button in the hero section or use the Login button in the top navigation bar.',
          },
          {
            question: 'Where can I review role selection help?',
            answer:
              'Open the tutorial and select role guide if you are unsure whether you should register as an applicant or an employer.',
          },
        ],
      },
    ],
  },
  // Terms of Use page content
  'terms-of-use': {
    eyebrow: 'Policy Docs',
    title: 'Terms of Use',
    subtitle:
      'Review the main platform rules, account responsibilities, and proper usage standards before using the service.',
    heroPrimary: { label: 'Open Privacy Policy', href: '/support/privacy-policy' },
    heroSecondary: { label: 'Back to Login', href: '/login' },
    groups: [
      {
        title: 'Platform Use',
        items: [
          {
            question: 'What is the platform allowed to be used for?',
            answer:
              'This platform is intended for accessible employment support, job seeking, employer coordination, and related account management only.',
          },
          {
            question: 'Do I need to use truthful account details?',
            answer:
              'Yes. Users should provide correct names, contact details, and profile information so the platform can process registrations properly.',
          },
          {
            question: 'Can I use another person\'s identity?',
            answer:
              'No. Impersonating other users, employers, or administrators is not allowed and can lead to account restriction or removal.',
          },
          {
            question: 'Why do I need to follow platform workflows?',
            answer:
              'Approval, verification, and submission steps help keep the system organized, secure, and fair for applicants and employers.',
          },
        ],
      },
      {
        title: 'User Conduct',
        items: [
          {
            question: 'What behavior is not allowed on the platform?',
            answer:
              'Users must avoid abusive language, harassment, harmful uploads, and actions that negatively affect other users or administrators.',
          },
          {
            question: 'Can I bypass approval checks?',
            answer:
              'No. Attempts to avoid verification, approval review, or normal access restrictions are considered misuse of the platform.',
          },
          {
            question: 'Are false profile submissions allowed?',
            answer:
              'No. Fake details, misleading qualifications, or incorrect business information may cause the account to be flagged or suspended.',
          },
          {
            question: 'What does responsible use mean?',
            answer:
              'It means using the platform honestly, protecting your login details, and respecting the purpose of each feature and process.',
          },
        ],
      },
      {
        title: 'Account Rules',
        items: [
          {
            question: 'Can admin review be required before full access?',
            answer:
              'Yes. Some accounts need a manual check before the user can continue with all platform features.',
          },
          {
            question: 'Can an account be restricted?',
            answer:
              'Yes. Accounts may be limited when suspicious activity, policy violations, or incomplete verification is detected.',
          },
          {
            question: 'Can violations lead to suspension?',
            answer:
              'Yes. Repeated misuse or serious rule violations may result in temporary or permanent suspension of access.',
          },
          {
            question: 'Can these terms change later?',
            answer:
              'Yes. Platform rules may be updated over time, and continued use of the system means users should review the latest terms when changes are posted.',
          },
        ],
      },
    ],
  },
  // Privacy Policy page content
  'privacy-policy': {
    eyebrow: 'Policy Docs',
    title: 'Privacy Policy',
    subtitle:
      'Understand how account data, registration information, and review records are handled inside the platform.',
    heroPrimary: { label: 'Open Help Center', href: '/support/help-center' },
    heroSecondary: { label: 'Back to Login', href: '/login' },
    groups: [
      {
        title: 'Account Data',
        items: [
          {
            question: 'What account data is collected?',
            answer:
              'The platform may store your name, email, role, login details, and other account information needed to provide access and support.',
          },
          {
            question: 'What registration profile details are kept?',
            answer:
              'Information entered during registration, such as contact details and profile records, may be kept for verification and account management.',
          },
          {
            question: 'Are applicant verification records saved?',
            answer:
              'Yes. Verification-related details may be kept so administrators can review applications and account status properly.',
          },
          {
            question: 'Is login activity stored for security?',
            answer:
              'Yes. Some access activity, such as login attempts and security checks, may be stored to protect user accounts and the platform.',
          },
        ],
      },
      {
        title: 'Admin Review',
        items: [
          {
            question: 'Why is my data used in application verification?',
            answer:
              'Your submitted information may be reviewed so administrators can confirm eligibility, identity, and platform compliance.',
          },
          {
            question: 'Are approval and rejection records kept?',
            answer:
              'Yes. Decision records may be stored so the platform can track account status and maintain review history.',
          },
          {
            question: 'Who can access security review information?',
            answer:
              'Authorized administrators may access security-related account details only when needed for monitoring, review, or support.',
          },
          {
            question: 'Why is support and monitoring information needed?',
            answer:
              'It helps the platform respond to login issues, investigate suspicious activity, and assist users more effectively.',
          },
        ],
      },
      {
        title: 'Responsible Handling',
        items: [
          {
            question: 'How should platform data be used?',
            answer:
              'User information should only be used for platform operations, verification, support, and related employment service needs.',
          },
          {
            question: 'Can sensitive details be shared freely?',
            answer:
              'No. Sensitive account and review details should be handled carefully and only by authorized people.',
          },
          {
            question: 'Is my review status protected information?',
            answer:
              'Yes. Approval, rejection, and verification status should be treated as protected internal platform information.',
          },
          {
            question: 'Can privacy practices change over time?',
            answer:
              'Yes. Privacy handling may improve as the platform grows, and updates may be reflected in the latest version of this page.',
          },
        ],
      },
    ],
  },
}

const topicLinks = [
  { key: 'help-center', label: 'Help Center' },
  { key: 'terms-of-use', label: 'Terms of Use' },
  { key: 'privacy-policy', label: 'Privacy Policy' },
]

const currentYear = new Date().getFullYear()
const currentTopic = computed(() => String(route.params.topic || 'help-center'))
const pageContent = computed(() => supportPages[currentTopic.value] || supportPages['help-center'])
const isHelpCenterPage = computed(() => currentTopic.value === 'help-center')
const showHelpHeroImage = computed(() => currentTopic.value === 'help-center')
const showTermsHeroImage = computed(() => currentTopic.value === 'terms-of-use')
const showPrivacyHeroImage = computed(() => currentTopic.value === 'privacy-policy')
const heroImageSrc = computed(() => {
  if (showHelpHeroImage.value) return supportIcons
  if (showTermsHeroImage.value) return termsImage
  if (showPrivacyHeroImage.value) return privacyImage
  return ''
})
const heroImageAlt = computed(() => {
  if (showHelpHeroImage.value) return 'Help center support icons'
  if (showTermsHeroImage.value) return 'Terms of use illustration'
  if (showPrivacyHeroImage.value) return 'Privacy policy illustration'
  return ''
})
const otherTopicLinks = computed(() => topicLinks.filter((link) => link.key !== currentTopic.value))
const openQuestionKey = ref(null)
const isPageLoading = ref(true)
const isPolicyMenuOpen = ref(false)
const activeGroupTitle = ref('')
const isTopicSwitching = ref(false)
const MIN_LOADING_SCREEN_MS = 420
const LOADING_FAILSAFE_MS = 1600

let loadingFinishTimeout
let loadingFallbackTimeout
let loadingEmergencyHideTimeout
let routeLoadingTimeout
let topicSwitchTimeout
let loadingFrameRequest
let loadingSecondFrameRequest
let hasResolvedInitialLoading = false
let loadingStartedAt = 0

const updateActiveGroup = () => {
  const sections = pageContent.value.groups
    .map((group) => ({
      title: group.title,
      element: document.getElementById(getGroupId(group.title)),
    }))
    .filter((group) => group.element instanceof HTMLElement)

  if (!sections.length) return

  const scrollOffset = 180
  let currentTitle = sections[0].title

  sections.forEach((section) => {
    if (!(section.element instanceof HTMLElement)) return

    const { top } = section.element.getBoundingClientRect()
    if (top <= scrollOffset) {
      currentTitle = section.title
    }
  })

  activeGroupTitle.value = currentTitle
}

const clearLoadingTimers = () => {
  window.clearTimeout(loadingFinishTimeout)
  window.clearTimeout(loadingFallbackTimeout)
  window.clearTimeout(loadingEmergencyHideTimeout)
  window.cancelAnimationFrame(loadingFrameRequest)
  window.cancelAnimationFrame(loadingSecondFrameRequest)
}

const beginPageLoading = () => {
  clearLoadingTimers()
  loadingStartedAt = performance.now()
  hasResolvedInitialLoading = false
  isPageLoading.value = true
  document.body.style.overflow = 'hidden'
}

const resolveInitialLoading = ({ immediate = false } = {}) => {
  if (hasResolvedInitialLoading && !isPageLoading.value) {
    document.body.style.overflow = ''
    return
  }

  window.clearTimeout(loadingFinishTimeout)
  const elapsed = Math.max(0, performance.now() - loadingStartedAt)
  const delay = immediate ? 0 : Math.max(0, MIN_LOADING_SCREEN_MS - elapsed)

  loadingFinishTimeout = window.setTimeout(() => {
    window.cancelAnimationFrame(loadingFrameRequest)
    window.cancelAnimationFrame(loadingSecondFrameRequest)
    loadingFrameRequest = window.requestAnimationFrame(() => {
      loadingSecondFrameRequest = window.requestAnimationFrame(() => {
        hasResolvedInitialLoading = true
        isPageLoading.value = false
        loadingEmergencyHideTimeout = window.setTimeout(() => {
          isPageLoading.value = false
          document.body.style.overflow = ''
        }, 700)
      })
    })
  }, delay)
}

const handleLoadingOverlayAfterLeave = () => {
  window.clearTimeout(loadingEmergencyHideTimeout)
  document.body.style.overflow = ''
}

const handleInitialWindowLoad = () => {
  resolveInitialLoading()
}

const handlePageShow = () => {
  resolveInitialLoading({ immediate: true })
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    resolveInitialLoading({ immediate: true })
  }
}

const isSupportPath = (path) => path.startsWith('/support/')

const openPath = (path) => {
  if (route.path === path) return

  if (isSupportPath(route.path) && isSupportPath(path)) {
    isTopicSwitching.value = true
    window.clearTimeout(topicSwitchTimeout)
    router.push(path)
    return
  }

  beginPageLoading()
  window.clearTimeout(routeLoadingTimeout)
  routeLoadingTimeout = window.setTimeout(() => {
    router.push(path)
  }, 120)
}

const openNavPath = (path) => {
  if (path.startsWith('/#')) {
    router.push({
      path: '/',
      hash: path.slice(1),
    })
    return
  }

  openPath(path)
}

const handleDocumentClick = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.nav-policy')) return
  isPolicyMenuOpen.value = false
}

const getGroupId = (title) =>
  `support-group-${String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`

const scrollToGroup = (title) => {
  const target = document.getElementById(getGroupId(title))
  if (!(target instanceof HTMLElement)) return
  activeGroupTitle.value = title
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const toggleQuestion = (groupTitle, question) => {
  const key = `${groupTitle}:${question}`
  openQuestionKey.value = openQuestionKey.value === key ? null : key
}

const isQuestionOpen = (groupTitle, question) => openQuestionKey.value === `${groupTitle}:${question}`

onMounted(() => {
  beginPageLoading()
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('scroll', updateActiveGroup, { passive: true })
  window.addEventListener('pageshow', handlePageShow)

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    resolveInitialLoading()
  } else {
    window.addEventListener('load', handleInitialWindowLoad, { once: true })
    loadingFallbackTimeout = window.setTimeout(() => {
      resolveInitialLoading({ immediate: true })
    }, LOADING_FAILSAFE_MS)
  }

  nextTick(() => {
    activeGroupTitle.value = pageContent.value.groups[0]?.title || ''
    updateActiveGroup()
  })
})

watch(
  () => route.fullPath,
  async () => {
    openQuestionKey.value = null
    activeGroupTitle.value = pageContent.value.groups[0]?.title || ''
    resolveInitialLoading()
    await nextTick()
    updateActiveGroup()
    if (isSupportPath(route.path)) {
      window.clearTimeout(topicSwitchTimeout)
      topicSwitchTimeout = window.setTimeout(() => {
        isTopicSwitching.value = false
      }, 240)
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('load', handleInitialWindowLoad)
  window.removeEventListener('scroll', updateActiveGroup)
  window.removeEventListener('pageshow', handlePageShow)
  clearLoadingTimers()
  window.clearTimeout(routeLoadingTimeout)
  window.clearTimeout(topicSwitchTimeout)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="support-docs">
    <transition name="loading-overlay" appear @after-leave="handleLoadingOverlayAfterLeave">
      <div
        v-if="isPageLoading"
        class="loading-screen"
        role="status"
        aria-live="polite"
        aria-label="Opening support page"
      >
        <div class="loading-screen__aurora loading-screen__aurora--one" />
        <div class="loading-screen__aurora loading-screen__aurora--two" />
        <div class="loading-screen__grid" />
        <div class="loading-screen__panel">
          <div class="loading-screen__logo-shell">
            <img
              class="loading-screen__logo"
              :src="logoPwd"
              alt="PWD logo"
              decoding="async"
              fetchpriority="high"
            />
          </div>
          <img
            class="loading-screen__wordmark"
            :src="pwdWordmark"
            alt="PWD Platform"
            decoding="async"
            fetchpriority="high"
          />
          <div class="loading-screen__dots" aria-hidden="true">
            <span class="loading-screen__dot" />
            <span class="loading-screen__dot" />
            <span class="loading-screen__dot" />
          </div>
        </div>
      </div>
    </transition>

    <header class="support-docs__masthead">
      <nav class="support-docs__topbar">
        <button type="button" class="support-docs__brand" @click="openPath('/')">
          <img class="support-docs__brand-mark" :src="logoPwd" alt="PWD logo" />
          <img class="support-docs__brand-wordmark" :src="pwdWordmark" alt="PWD Platform" />
        </button>

        <div class="support-docs__nav">
          <button
            v-for="link in navLinks"
            :key="link.label"
            type="button"
            class="support-docs__nav-link"
            @click="openNavPath(link.href)"
          >
            {{ link.label }}
          </button>

          <div class="nav-policy">
            <button
              type="button"
              class="support-docs__nav-link support-docs__nav-link--policy"
              @click="isPolicyMenuOpen = !isPolicyMenuOpen"
            >
              <span>Policy</span>
              <span class="support-docs__nav-chevron" :class="{ 'is-open': isPolicyMenuOpen }">⌄</span>
            </button>

            <transition name="nav-policy-dropdown">
              <div v-if="isPolicyMenuOpen" class="nav-policy__menu">
                <button
                  v-for="link in topicLinks"
                  :key="link.key"
                  type="button"
                  class="nav-policy__item"
                  @click="openPath(`/support/${link.key}`); isPolicyMenuOpen = false"
                >
                  {{ link.label }}
                </button>
              </div>
            </transition>
          </div>
        </div>

        <button type="button" class="support-docs__login-link" @click="openPath('/login')">
          <span>Login</span>
        </button>
      </nav>
    </header>

    <header class="support-docs__hero">
      <div class="support-docs__hero-shell">
        <div class="support-docs__hero-copy">
          <p class="support-docs__eyebrow">{{ pageContent.eyebrow }}</p>
          <h1>{{ pageContent.title }}</h1>
          <p>{{ pageContent.subtitle }}</p>

          <div class="support-docs__hero-actions">
            <button
              type="button"
              class="support-docs__hero-btn support-docs__hero-btn--primary"
              @click="openPath(pageContent.heroPrimary.href)"
            >
              {{ pageContent.heroPrimary.label }}
            </button>
            <button
              type="button"
              class="support-docs__hero-btn support-docs__hero-btn--ghost"
              @click="openPath(pageContent.heroSecondary.href)"
            >
              {{ pageContent.heroSecondary.label }}
            </button>
          </div>
        </div>

        <div
          v-if="showHelpHeroImage || showTermsHeroImage || showPrivacyHeroImage"
          class="support-docs__hero-visual"
        >
          <img
            :src="heroImageSrc"
            :alt="heroImageAlt"
            class="support-docs__hero-image"
          />
        </div>
      </div>
    </header>

    <div class="support-docs__toolbar">
      <div class="support-docs__toolbar-shell">
        <div class="support-docs__section-pill">{{ pageContent.title }}</div>
      </div>
    </div>

    <main class="support-docs__content support-docs__content-shell">
      <transition name="support-topic-switch" mode="out-in">
        <div :key="currentTopic" class="support-docs__layout">
        <aside class="support-docs__sidebar">
          <p class="support-docs__sidebar-label">On this page</p>
          <div class="support-docs__sidebar-nav">
            <button
              v-for="(group, index) in pageContent.groups"
              :key="group.title"
              type="button"
              class="support-docs__sidebar-link"
              :class="{ 'is-active': activeGroupTitle === group.title }"
              @click="scrollToGroup(group.title)"
            >
              <span v-if="isHelpCenterPage" class="support-docs__sidebar-number">{{ index + 1 }}.</span>
              <span>{{ group.title }}</span>
            </button>
          </div>

          <div class="support-docs__sidebar-docs">
            <p class="support-docs__sidebar-label">Other documents</p>
            <div class="support-docs__sidebar-nav support-docs__sidebar-nav--docs">
              <button
                v-for="link in otherTopicLinks"
                :key="link.key"
                type="button"
                class="support-docs__sidebar-doc-link"
                @click="openPath(`/support/${link.key}`)"
              >
                <span>{{ link.label }}</span>
                <span class="support-docs__sidebar-doc-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </aside>

        <div class="support-docs__main" :class="{ 'support-docs__main--document': !isHelpCenterPage }">
          <div
            class="support-docs__grid"
            :class="{
              'support-docs__grid--document': !isHelpCenterPage,
              'support-docs__grid--faq': isHelpCenterPage,
            }"
          >
            <section
              v-for="group in pageContent.groups"
              :id="getGroupId(group.title)"
              :key="group.title"
              class="support-docs__group"
              :class="{ 'support-docs__group--faq': isHelpCenterPage }"
            >
              <h2>{{ group.title }}</h2>

              <div v-if="isHelpCenterPage" class="support-docs__faq-list">
                <article
                  v-for="item in group.items"
                  :key="item.question"
                  class="support-docs__faq-card"
                  :class="{ 'is-open': isQuestionOpen(group.title, item.question) }"
                >
                  <button
                    type="button"
                    class="support-docs__faq-trigger"
                    @click="toggleQuestion(group.title, item.question)"
                  >
                    <span class="support-docs__faq-question">{{ item.question }}</span>
                    <span class="support-docs__faq-icon" aria-hidden="true">+</span>
                  </button>

                  <div
                    class="support-docs__faq-answer-wrap"
                    :class="{ 'is-open': isQuestionOpen(group.title, item.question) }"
                  >
                    <div class="support-docs__faq-answer">
                      <p>{{ item.answer }}</p>
                    </div>
                  </div>
                </article>
              </div>

              <div v-else class="support-docs__policy-list">
                <article v-for="item in group.items" :key="item.question" class="support-docs__policy-block">
                  <h3>{{ item.question }}</h3>
                  <p>{{ item.answer }}</p>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
      </transition>

      <transition name="support-topic-spinner">
        <div v-if="isTopicSwitching" class="support-docs__switching" aria-live="polite" aria-label="Loading topic">
          <span class="support-docs__switching-spinner" aria-hidden="true" />
        </div>
      </transition>
    </main>

    <footer class="landing-footer">
      <div class="landing-footer__glow landing-footer__glow--one" aria-hidden="true" />
      <div class="landing-footer__glow landing-footer__glow--two" aria-hidden="true" />

      <div class="landing-footer__inner">
        <div class="landing-footer__brand">
          <div class="landing-footer__brand-top">
            <img class="landing-footer__logo" :src="logoPwd" alt="PWD logo" />
            <div>
              <p class="landing-footer__eyebrow">Inclusive Employment Platform</p>
              <h3 class="landing-footer__title">PWD Employment Assistance</h3>
            </div>
          </div>

          <p class="landing-footer__copy">
            Building a more accessible path to employment for persons with disabilities through
            guided applications, verified job opportunities, and inclusive support.
          </p>
        </div>

        <div class="landing-footer__links">
          <div class="landing-footer__column">
            <p class="landing-footer__heading">Explore</p>
            <button type="button" class="landing-footer__link-button" @click="openNavPath('/#home')">Home</button>
            <button type="button" class="landing-footer__link-button" @click="openNavPath('/#featured-jobs')">Featured Jobs</button>
            <button type="button" class="landing-footer__link-button" @click="openNavPath('/#section-01')">Popular Categories</button>
            <button type="button" class="landing-footer__link-button" @click="openPath('/login')">Start Journey</button>
          </div>

          <div class="landing-footer__column">
            <p class="landing-footer__heading">Support</p>
            <button type="button" class="landing-footer__link-button" @click="openPath('/support/help-center')">Help Center</button>
            <button type="button" class="landing-footer__link-button" @click="openPath('/support/terms-of-use')">Terms of Use</button>
            <button type="button" class="landing-footer__link-button" @click="openPath('/support/privacy-policy')">Privacy Policy</button>
            <button type="button" class="landing-footer__link-button" @click="openPath('/step-view-tutorial')">Tutorial Guide</button>
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
</template>

<style scoped src="@/components/support_pages.css"></style>
