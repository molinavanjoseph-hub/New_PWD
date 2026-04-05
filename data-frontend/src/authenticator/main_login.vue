<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import heroBackdrop from '@/assets/better02.jpg'
import logoPwd from '@/assets/logo-pwd.png'
import mathLogo from '@/assets/math.png'
import pwdWordmark from '@/assets/pwdlogo.png'
import { getEmployerDashboardRoute, signInAccount } from '@/lib/auth'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const fieldErrors = ref({
  email: '',
  password: '',
})
const isRouteLoading = ref(false)
const isSubmitting = ref(false)
const toast = ref(null)
const showForgotPassword = ref(false)
let routeTimerId
let toastTimerId

const REMEMBERED_LOGIN_EMAIL_KEY = 'rememberedLoginEmail'
const APPLICANT_ENTRY_TRANSITION_KEY = 'applicantDashboardEntryTransition'
const APPLICANT_WELCOME_TOAST_KEY = 'applicantWelcomeToastName'
const LOGOUT_TOAST_KEY = 'showLoggedOutToast'

const organizationType = computed(() => String(route.query.organizationType || '').trim().toLowerCase())
const employerAccountLabel = computed(() =>
  organizationType.value === 'business' ? 'Business Account' : 'Company Account',
)
const employerAccountLabelLower = computed(() => employerAccountLabel.value.toLowerCase())

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

const loginNotice = computed(() => {
  if (route.query.pendingReview === '1') {
    const isEmployer = route.query.role === 'employer'
    return {
      kind: 'warning',
      title: isEmployer ? `${employerAccountLabel.value} Under Review` : 'Application Under Review',
      text: isEmployer
        ? `Your email is already verified. Your ${employerAccountLabelLower.value} is still waiting for admin approval. Please allow around 10 minutes for review and always check your Gmail for updates.`
        : 'Your email is already verified. Your account is still waiting for admin approval. Please allow around 10 minutes for review and always check your Gmail for updates.',
    }
  }

  if (route.query.approved === '1') {
    return {
      kind: 'success',
      title: 'Account Approved',
      text: route.query.role === 'employer'
        ? `Your ${employerAccountLabelLower.value} has been approved. You can now log in and continue to your onboarding screen.`
        : 'Your account has been approved. You can now log in and continue to your applicant dashboard.',
    }
  }

  return null
})

const navigateToSelectRole = () => {
  if (isRouteLoading.value) return
  isRouteLoading.value = true
  window.clearTimeout(routeTimerId)
  routeTimerId = window.setTimeout(() => {
    router.push('/select-role')
  }, 180)
}

const getToastTitle = (text, kind = 'error') => {
  const normalizedText = String(text || '').trim().toLowerCase()

  if (kind === 'success') {
    if (normalizedText.includes('approved')) return 'Account approved'
    if (normalizedText.includes('verified')) return 'Email verified'
    if (normalizedText.includes('dashboard')) return 'Login successful'
    if (normalizedText.includes('admin panel')) return 'Admin access granted'
    return 'Success'
  }

  if (kind === 'warning') return 'Notice'
  if (normalizedText.includes('temporarily banned')) return 'Account banned'
  if (normalizedText.includes('permanently banned')) return 'Account banned'
  if (normalizedText.includes('has been permanently banned')) return 'Account banned'
  if (normalizedText.includes('has been banned')) return 'Account banned'
  if (normalizedText.includes('approvalstatus') && normalizedText.includes('banned')) return 'Account banned'
  if (normalizedText.includes('too many incorrect password attempts')) return 'Too many attempts'
  if (normalizedText.includes('no account was found')) return 'Email not found'
  if (normalizedText.includes('email not found')) return 'Email not found'
  if (normalizedText.includes('incorrect password')) return 'Wrong password'
  if (normalizedText.includes('invalid email or password')) return 'Login failed'
  if (normalizedText.includes('invalid credentials')) return 'Login failed'
  if (normalizedText.includes('credentials do not match')) return 'Login failed'
  if (normalizedText.includes('email field is required')) return 'Email required'
  if (normalizedText.includes('password field is required')) return 'Password required'
  if (normalizedText.includes('browser could not start the session')) return 'Login failed'
  if (normalizedText.includes('could not keep the session')) return 'Login failed'
  if (normalizedText.includes('unable to sign in')) return 'Login failed'

  return 'Error'
}

const notify = (text, kind = 'error', title = getToastTitle(text, kind)) => {
  toast.value = { text, kind, title }
}

const getUserFirstName = (user) => {
  const registrationFirstName = String(user?.applicant_registration?.first_name || user?.applicantRegistration?.first_name || '').trim()
  if (registrationFirstName) return registrationFirstName

  const profileName = String(user?.name || '').trim()
  if (!profileName) return 'Applicant'

  return profileName.split(/\s+/)[0] || 'Applicant'
}

const clearFieldError = (field) => {
  showForgotPassword.value = false
  if (!fieldErrors.value[field]) return
  fieldErrors.value[field] = ''
}

const resetFieldErrors = () => {
  fieldErrors.value.email = ''
  fieldErrors.value.password = ''
  showForgotPassword.value = false
}

const setFieldErrorsFromMessage = (message) => {
  let hasFieldErrors = false
  const normalizedMessage = String(message || '').trim().toLowerCase()

  if (!normalizedMessage) {
    return {
      hasFieldErrors,
      message: '',
    }
  }

  if (
    normalizedMessage.includes('no account was found') ||
    normalizedMessage.includes('email not found') ||
    normalizedMessage.includes('valid email address') ||
    normalizedMessage.includes('email field is required') ||
    normalizedMessage.includes('invalid email or password')
  ) {
    fieldErrors.value.email = message
    hasFieldErrors = true
  }

  if (
    normalizedMessage.includes('incorrect password') ||
    normalizedMessage.includes('password field is required') ||
    normalizedMessage.includes('too many incorrect password attempts') ||
    normalizedMessage.includes('invalid email or password')
  ) {
    fieldErrors.value.password = message
    hasFieldErrors = true
  }

  if (
    normalizedMessage.includes('pending approval') ||
    normalizedMessage.includes('rejected by admin review') ||
    normalizedMessage.includes('has been banned')
  ) {
    fieldErrors.value.email = fieldErrors.value.email || message
    fieldErrors.value.password = fieldErrors.value.password || message
    hasFieldErrors = true
  }

  showForgotPassword.value = hasFieldErrors
    && !normalizedMessage.includes('no account was found')
    && !normalizedMessage.includes('email not found')

  return {
    hasFieldErrors,
    message,
  }
}

const submitLogin = async () => {
  if (isSubmitting.value) return

  resetFieldErrors()

  if (!email.value.trim()) {
    fieldErrors.value.email = 'The email field is required.'
  } else if (!isValidEmail(email.value)) {
    fieldErrors.value.email = 'Please enter a valid email address.'
  }

  if (!password.value.trim()) {
    fieldErrors.value.password = 'The password field is required.'
  }

  if (fieldErrors.value.email || fieldErrors.value.password) {
    notify(fieldErrors.value.email || fieldErrors.value.password, 'error')
    return
  }

  isSubmitting.value = true

  try {
    const data = await signInAccount({
      email: normalizeEmailInput(email.value),
      password: password.value,
    })

    if (rememberMe.value) {
      localStorage.setItem(REMEMBERED_LOGIN_EMAIL_KEY, email.value.trim().toLowerCase())
    } else {
      localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_KEY)
    }

    if (data.user?.role === 'applicant') {
      const applicantFirstName = getUserFirstName(data.user)
      notify(`Login successful. Redirecting to ${applicantFirstName}'s dashboard...`, 'success', 'Login successful')
      sessionStorage.setItem(APPLICANT_ENTRY_TRANSITION_KEY, '1')
      sessionStorage.setItem(APPLICANT_WELCOME_TOAST_KEY, applicantFirstName)
      isRouteLoading.value = true
      window.clearTimeout(routeTimerId)
      routeTimerId = window.setTimeout(() => {
        router.push('/applicant')
      }, 220)
      return
    }

    if (['admin', 'system_admin'].includes(String(data.user?.role || '').trim().toLowerCase())) {
      notify('Login successful. Opening admin panel...', 'success')
      router.push('/admin')
      return
    }

    if (data.user?.role === 'employer') {
      sessionStorage.setItem('employerPricingIntro', '1')
      notify('Login successful. Redirecting...', 'success')
      router.push(getEmployerDashboardRoute(data.user))
      return
    }

    notify('Login successful. Redirecting...', 'success')
    router.push('/')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sign in right now. Please try again.'
    const { message: resolvedMessage } = setFieldErrorsFromMessage(message)
    notify(
      resolvedMessage || fieldErrors.value.email || fieldErrors.value.password || 'Login failed. Please check your account.',
      'error',
    )
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  const routeEmail = String(route.query.email || '').trim().toLowerCase()
  const rememberedEmail = String(localStorage.getItem(REMEMBERED_LOGIN_EMAIL_KEY) || '').trim()

  if (routeEmail) {
    email.value = routeEmail
    rememberMe.value = rememberedEmail === routeEmail
  } else if (rememberedEmail) {
    email.value = rememberedEmail
    rememberMe.value = true
  }

  if (route.query.approved === '1') {
    notify('Your account has been approved. You can log in now.', 'success')
  } else if (route.query.verified === '1') {
    notify('Email verified successfully. You can log in now.', 'success')
  } else if (sessionStorage.getItem(LOGOUT_TOAST_KEY) === '1') {
    sessionStorage.removeItem(LOGOUT_TOAST_KEY)
    notify('Your account has been logged out successfully.', 'success', 'Logged out')
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(routeTimerId)
  window.clearTimeout(toastTimerId)
})

watch(toast, (value) => {
  window.clearTimeout(toastTimerId)

  if (!value) return

  toastTimerId = window.setTimeout(() => {
    toast.value = null
  }, value.kind === 'error' ? 2800 : 2200)
})

watch(rememberMe, (value) => {
  if (value) return
  localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_KEY)
})
</script>

<template>
  <div class="login-page">
    <div class="login-page__backdrop" />

    <transition name="login-toast">
      <div v-if="toast" class="login-toast" :class="toast.kind === 'warning' ? 'warning' : toast.kind" role="status" aria-live="polite">
        <div class="login-toast__icon" :class="toast.kind === 'warning' ? 'warning' : toast.kind" aria-hidden="true">
          <i
            :class="
              toast.kind === 'error'
                ? 'bi bi-x-circle-fill'
                : toast.kind === 'warning'
                  ? 'bi bi-exclamation-triangle-fill'
                  : 'bi bi-check-circle-fill'
            "
          />
        </div>
        <div class="login-toast__copy">
          <strong>{{ toast.title }}</strong>
          <span>{{ toast.text }}</span>
        </div>
        <button type="button" class="login-toast__close" aria-label="Close notification" @click="toast = null">
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </transition>

    <main class="login-shell">
      <section class="login-showcase">
        <div class="login-showcase__art">
          <img :src="heroBackdrop" alt="" />
          <div class="login-showcase__overlay" />
        </div>
      </section>

      <section class="login-panel">
        <div class="login-panel__topbar">
          <div class="login-panel__brand">
            <img class="login-panel__brand-mark" :src="mathLogo" alt="PWD logo" />
          </div>
        </div>

        <div class="login-panel__content">
          <p class="login-panel__label">Welcome back</p>
          <p class="login-panel__subtitle">
            Continue exploring inclusive jobs, employer connections, and accessible opportunities.
          </p>

          <div v-if="loginNotice" class="login-notice-card" :class="`login-notice-card--${loginNotice.kind}`">
            <div class="login-notice-card__icon" aria-hidden="true">
              <i :class="loginNotice.kind === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-hourglass-split'" />
            </div>
            <div class="login-notice-card__copy">
              <strong>{{ loginNotice.title }}</strong>
              <p>{{ loginNotice.text }}</p>
            </div>
          </div>

          <form class="login-form" @submit.prevent="submitLogin">
            <label class="login-form__field" :class="{ 'login-form__field--error': fieldErrors.email }">
              <span>Email</span>
              <input
                v-model="email"
                type="email"
                placeholder="Enter your email"
                :aria-invalid="fieldErrors.email ? 'true' : 'false'"
                @input="clearFieldError('email')"
              />
            </label>

            <label class="login-form__field" :class="{ 'login-form__field--error': fieldErrors.password }">
              <span>Password</span>
              <div class="login-form__password-wrap">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  :aria-invalid="fieldErrors.password ? 'true' : 'false'"
                  @input="clearFieldError('password')"
                />
                <button
                  type="button"
                  class="login-form__password-toggle"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <i class="bi" :class="showPassword ? 'bi-eye-slash' : 'bi-eye'" />
                </button>
              </div>
            </label>

            <div class="login-form__meta">
              <label class="login-form__remember">
                <input v-model="rememberMe" type="checkbox" />
                <span>Remember me</span>
              </label>
              <a v-if="showForgotPassword" href="#home">Forgot password?</a>
            </div>

            <button type="submit" class="login-form__submit" :disabled="isSubmitting">
              <span class="login-form__submit-content">
                <span v-if="isSubmitting" class="login-form__submit-spinner" aria-hidden="true" />
                <span>{{ isSubmitting ? 'Signing in...' : 'Login' }}</span>
              </span>
            </button>
          </form>
          <p class="login-panel__signup">
            Don't have an account?
            <a href="/select-role" @click.prevent="navigateToSelectRole">Register</a>
          </p>

          <p class="login-panel__copyright">@Copyright 2026 PWD Employment</p>

          <div class="login-panel__socials" aria-label="Social links">
            <a href="/support/help-center" target="_blank" rel="noopener noreferrer">Help Center</a>
            <span aria-hidden="true">|</span>
            <a href="/support/terms-of-use" target="_blank" rel="noopener noreferrer">Terms of Use</a>
            <span aria-hidden="true">|</span>
            <a href="/support/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped src="@/components/main_login.css"></style>
