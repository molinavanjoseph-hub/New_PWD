<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import logoPwd from '@/assets/logo-pwd.png'
import mathLogo from '@/assets/math.png'
import titleLogo from '@/assets/pwdlogo.png'
import applicantPreview from '@/assets/register.png'
import employerPreview from '@/assets/handshake.png'

const router = useRouter()
const isVisible = ref(true)
const isNavigating = ref(false)
const hoveredRole = ref(null)
let timerId

const roleCards = computed(() => [
  {
    key: 'applicant',
    title: 'Applicant',
    description: 'Use this account to view job posts and submit applications.',
    preview: applicantPreview,
    activeVisual: applicantPreview,
    cta: 'Continue as Applicant',
    benefits: [
      'View available job listings',
      'Submit job applications',
      'Check application and interview status',
    ],
  },
  {
    key: 'employer',
    title: 'Business',
    description: 'Use this account to post jobs and review applicants.',
    preview: employerPreview,
    activeVisual: employerPreview,
    cta: 'Continue as Business',
    benefits: [
      'Create and manage job posts',
      'Review applicant records',
      'Update hiring status and interview schedules',
    ],
  },
])

const getRoleVisual = (role) => (hoveredRole.value === role.key ? role.activeVisual : role.preview)

const clearTimer = () => {
  if (timerId) {
    window.clearTimeout(timerId)
    timerId = null
  }
}

const runExitThen = (next) => {
  if (isNavigating.value) return
  isNavigating.value = true
  clearTimer()
  timerId = window.setTimeout(next, 180)
}

const goRegister = (role) => {
  localStorage.setItem('selectedRole', role)
  localStorage.setItem('uiLanguage', 'en')
  runExitThen(() => {
    router.push({
      path: '/register',
      query: { role, force: '1' },
    })
  })
}

const goBack = () => {
  localStorage.removeItem('selectedRole')
  localStorage.setItem('uiLanguage', 'en')
  runExitThen(() => {
    router.push('/login')
  })
}

onMounted(() => {
  localStorage.removeItem('selectedRole')
  localStorage.setItem('uiLanguage', 'en')
})

onBeforeUnmount(() => {
  clearTimer()
})
</script>

<template>
  <div class="role-auth-page">
    <div class="role-auth-container">
      <button type="button" class="role-back-btn" :disabled="isNavigating" @click="goBack">
        <i class="bi bi-arrow-left" aria-hidden="true" />
        <span>Back to Login</span>
      </button>

      <transition name="role-route-overlay">
        <div v-if="isNavigating" class="role-route-overlay" aria-hidden="true">
          <div class="role-route-overlay__spinner" />
        </div>
      </transition>

      <div
        class="role-auth-right"
        :class="{
          'is-visible': isVisible,
        }"
      >
        <div class="role-logo-container">
          <img :src="mathLogo" class="role-logo-img" alt="PWD Employment Assistant" />
        </div>

        <div class="role-form-heading">
          <h2 class="role-form-h2">Choose Your Role</h2>
          <p class="role-form-p">Select the account type you will use in the system.</p>
        </div>

        <div class="role-card-grid">
          <button
            v-for="role in roleCards"
            :key="role.key"
            class="role-option-card"
            :class="role.key"
            type="button"
            :disabled="isNavigating"
            @mouseenter="hoveredRole = role.key"
            @mouseleave="hoveredRole = hoveredRole === role.key ? null : hoveredRole"
            @focus="hoveredRole = role.key"
            @blur="hoveredRole = hoveredRole === role.key ? null : hoveredRole"
            @click="goRegister(role.key)"
          >
            <span class="role-option-media" aria-hidden="true">
              <img :src="role.preview" alt="" class="role-option-image" />
              <span class="role-option-media-overlay" />
            </span>

            <span class="role-option-content">
              <span class="role-option-icon-wrap" :class="role.key" aria-hidden="true">
                <img :src="getRoleVisual(role)" alt="" class="role-option-icon-gif" />
              </span>

              <span class="role-option-header">
                <span class="role-option-title">{{ role.title }}</span>
                <span class="role-option-desc">{{ role.description }}</span>
              </span>

              <span class="role-option-divider" aria-hidden="true" />

              <ul class="role-option-benefits" :aria-label="`${role.title} benefits`">
                <li v-for="benefit in role.benefits" :key="benefit">
                  <i class="bi bi-check2-circle" aria-hidden="true" />
                  <span>{{ benefit }}</span>
                </li>
              </ul>

              <span class="role-option-cta">
                {{ role.cta }}
                <i class="bi bi-arrow-right" aria-hidden="true" />
              </span>
            </span>
          </button>
        </div>

        <div class="role-tutorial-callout">
          <p class="role-tutorial-callout__text">Don't know how to continue?</p>
          <button type="button" class="role-tutorial-callout__link" :disabled="isNavigating" @click="runExitThen(() => router.push('/step-view-tutorial'))">
            Here's a tutorial
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="@/components/select_role_page.css"></style>
