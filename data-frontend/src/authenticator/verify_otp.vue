<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import mathLogo from '@/assets/math.png'
import { completeVerifiedRegistration } from '@/lib/auth'
import {
  buildApplicantRegistrationFormData,
  clearApplicantPendingRegistrationDraft,
  getApplicantPendingRegistrationDraft,
} from '@/lib/applicant_registration_draft'
import {
  buildEmployerRegistrationFormData,
  clearEmployerPendingRegistrationDraft,
  getEmployerPendingRegistrationDraft,
} from '@/lib/employer_registration_draft'
import { resendRegistrationOtp, verifyRegistrationOtp } from '@/lib/email_otp'

const route = useRoute()
const router = useRouter()

const otpInputRef = ref(null)
const code = ref('')
const isSubmitting = ref(false)
const isResending = ref(false)
const resendCooldownSeconds = ref(0)
const toast = ref(null)

let toastTimerId
let resendTimerId

const email = computed(() => String(route.query.email || '').trim().toLowerCase())
const mode = computed(() => String(route.query.mode || '').trim().toLowerCase())
const role = computed(() => String(route.query.role || 'employer').trim().toLowerCase())
const organizationType = computed(() => String(route.query.organizationType || '').trim().toLowerCase())
const isApplicantRole = computed(() => role.value === 'applicant')
const isEmployerRole = computed(() => role.value === 'employer')

const accountLabel = computed(() =>
  isEmployerRole.value
    ? organizationType.value === 'business'
      ? 'Business Account'
      : 'Employer Account'
    : 'Applicant Account',
)
const registrationLabelLower = computed(() => accountLabel.value.toLowerCase())

const maskedEmail = computed(() => {
  const [localPart, domainPart] = email.value.split('@')
  if (!localPart || !domainPart) return email.value

  const visiblePrefix = localPart.slice(0, 2)
  return `${visiblePrefix}${'*'.repeat(Math.max(localPart.length - visiblePrefix.length, 1))}@${domainPart}`
})

const noticeTitle = computed(() =>
  mode.value === 'register' ? `${accountLabel.value} email` : 'Verification email',
)

const noticeText = computed(() =>
  mode.value === 'register'
    ? isEmployerRole.value
      ? `We will only create your ${registrationLabelLower.value}, UID, and employer profile after this OTP is verified.`
      : `We will only create your ${registrationLabelLower.value} after this OTP is verified.`
    : 'Always use the newest OTP from your inbox. Older codes stop working after a resend.',
)

const otpDigits = computed(() => Array.from({ length: 6 }, (_, index) => code.value[index] || ''))
const isOtpComplete = computed(() => code.value.length === 6)
const activeOtpIndex = computed(() => {
  if (isSubmitting.value) return 5
  return Math.min(code.value.length, 5)
})

const otpStatusText = computed(() => {
  if (isSubmitting.value) return 'Checking OTP...'
  if (isOtpComplete.value) return 'Code complete. Verifying automatically...'
  return 'Paste or type the 6 digits we sent to your inbox.'
})

const resendButtonLabel = computed(() => {
  if (isResending.value) return 'Sending OTP...'
  if (resendCooldownSeconds.value > 0) return `Resend OTP (wait ${resendCooldownSeconds.value}s)`
  return 'Resend OTP'
})

const resendHint = computed(() =>
  resendCooldownSeconds.value > 0
    ? `Need another code? You can request a fresh OTP after ${resendCooldownSeconds.value}s.`
    : "Didn't receive the code yet?",
)

const submitButtonLabel = computed(() => (isSubmitting.value ? 'Verifying...' : 'Verify OTP'))
const toastKindClass = computed(() => toast.value?.kind || 'error')

const notify = (text, kind = 'error', title = kind === 'success' ? 'Success' : kind === 'info' ? 'Notice' : 'Error') => {
  toast.value = { text, kind, title }
}

const resolveRegistrationCompletionError = (error) => {
  const fallback = `Your OTP was verified, but we could not finish creating the ${registrationLabelLower.value} right now. Please try again.`

  if (!(error instanceof Error)) return fallback

  const message = String(error.message || '').trim()
  if (!message) return fallback

  if (message === 'Registration failed. Please try again.') {
    return fallback
  }

  return message
}

const focusOtpInput = () => {
  otpInputRef.value?.focus()
}

const startResendCooldown = (seconds = 60) => {
  resendCooldownSeconds.value = Math.max(0, Number(seconds) || 0)
  window.clearInterval(resendTimerId)

  if (!resendCooldownSeconds.value) return

  resendTimerId = window.setInterval(() => {
    resendCooldownSeconds.value = Math.max(0, resendCooldownSeconds.value - 1)
    if (!resendCooldownSeconds.value) {
      window.clearInterval(resendTimerId)
    }
  }, 1000)
}

const handleCodeInput = (event) => {
  code.value = String(event?.target?.value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

const goToLogin = async () => {
  await router.push('/login')
}

const goToRegistration = async () => {
  localStorage.setItem('selectedRole', role.value || 'employer')
  await router.push('/register')
}

const goToEntryPage = async () => {
  if (mode.value === 'register') {
    await goToRegistration()
    return
  }

  await goToLogin()
}

const getPendingRegistrationDraft = async () =>
  isApplicantRole.value
    ? getApplicantPendingRegistrationDraft()
    : getEmployerPendingRegistrationDraft()

const clearPendingRegistrationDraft = async () => {
  if (isApplicantRole.value) {
    await clearApplicantPendingRegistrationDraft()
    return
  }

  await clearEmployerPendingRegistrationDraft()
}

const buildRegistrationFormData = (draft) =>
  isApplicantRole.value
    ? buildApplicantRegistrationFormData(draft)
    : buildEmployerRegistrationFormData(draft)

const submitOtpVerification = async () => {
  if (isSubmitting.value) return

  if (!email.value) {
    notify('The OTP session is missing its email address. Please register again.', 'error')
    await goToEntryPage()
    return
  }

  if (code.value.length !== 6) {
    notify('Enter the 6-digit OTP code sent to your email.', 'error')
    focusOtpInput()
    return
  }

  isSubmitting.value = true

  try {
    await verifyRegistrationOtp({
      email: email.value,
      role: role.value || 'employer',
      organizationType: organizationType.value,
      code: code.value,
    })
  } catch (error) {
    console.error('Registration OTP verify failed', error)
    notify(error instanceof Error ? error.message : 'Unable to verify the OTP code right now.', 'error')
    isSubmitting.value = false
    return
  }

  try {
    if (mode.value === 'register') {
      const pendingDraft = await getPendingRegistrationDraft()
      if (!pendingDraft) {
        throw new Error(
          isEmployerRole.value
            ? 'Your employer registration draft is missing. Please register again before verifying OTP.'
            : 'Your applicant registration draft is missing. Please register again before verifying OTP.',
        )
      }

      await completeVerifiedRegistration(
        buildRegistrationFormData(pendingDraft),
      )
      await clearPendingRegistrationDraft()
      localStorage.removeItem('selectedRole')
    }

    await router.replace({
      path: '/login',
      query: {
        verified: '1',
        pendingReview: '1',
        email: email.value,
        role: role.value || 'employer',
        organizationType: isEmployerRole.value ? organizationType.value || undefined : undefined,
      },
    })
  } catch (error) {
    console.error('OTP registration completion failed', error)
    notify(
      resolveRegistrationCompletionError(error),
      'error',
      'OTP verified',
    )
  } finally {
    isSubmitting.value = false
  }
}

const resendOtpCode = async () => {
  if (isResending.value || resendCooldownSeconds.value > 0) return

  if (!email.value) {
    notify('The OTP session is missing its email address. Please register again.', 'error')
    await goToEntryPage()
    return
  }

  isResending.value = true

  try {
    const response = await resendRegistrationOtp({
      email: email.value,
      role: role.value || 'employer',
      organizationType: organizationType.value,
    })

    code.value = ''
    startResendCooldown(response?.cooldownSeconds || 60)
    notify(
      `A new OTP code was sent to ${response?.email || maskedEmail.value || email.value}.`,
      'success',
      'OTP sent',
    )
    await nextTick()
    focusOtpInput()
  } catch (error) {
    console.error('Registration OTP resend failed', error)
    notify(error instanceof Error ? error.message : 'Unable to resend the OTP email right now.', 'error')
  } finally {
    isResending.value = false
  }
}

onMounted(async () => {
  if (
    !email.value
    || !['applicant', 'employer'].includes(role.value)
    || (isEmployerRole.value && organizationType.value !== 'business')
  ) {
    notify('The OTP verification page is missing registration details. Please register again.', 'error')
    await goToEntryPage()
    return
  }

  if (mode.value === 'register') {
    const pendingDraft = await getPendingRegistrationDraft()
    if (!pendingDraft || String(pendingDraft.email || '').trim().toLowerCase() !== email.value) {
      notify(
        isEmployerRole.value
          ? 'The pending employer registration draft is missing on this device. Please register again.'
          : 'The pending applicant registration draft is missing on this device. Please register again.',
        'error',
      )
      await goToEntryPage()
      return
    }
  }

  startResendCooldown(60)
  await nextTick()
  focusOtpInput()
})

watch(code, (nextCode, previousCode) => {
  if (nextCode.length !== 6 || nextCode === previousCode || isSubmitting.value) return
  void submitOtpVerification()
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimerId)
  window.clearInterval(resendTimerId)
})

watch(toast, (value) => {
  window.clearTimeout(toastTimerId)

  if (!value) return

  toastTimerId = window.setTimeout(() => {
    toast.value = null
  }, value.kind === 'error' ? 3200 : 2200)
})
</script>

<template>
  <div class="otp-page">
    <button v-if="mode !== 'register'" type="button" class="reg-back-btn" @click="goToEntryPage">
      <i class="bi bi-arrow-left" aria-hidden="true" />
      <span>Back to login</span>
    </button>

    <transition name="reg-notify-popup">
      <div v-if="toast" class="reg-notify-banner" :class="toastKindClass" role="status" aria-live="polite">
        <div class="reg-notify-banner__icon" :class="toastKindClass" aria-hidden="true">
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
          <h3 class="reg-notify-banner__title">{{ toast.title }}</h3>
          <p class="reg-notify-banner__message">{{ toast.text }}</p>
        </div>
        <button type="button" class="reg-notify-banner__close" aria-label="Close notification" @click="toast = null">
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </transition>

    <main class="otp-card" aria-labelledby="otp-title">
      <img :src="mathLogo" alt="PWD Employment Assistant" class="otp-card__brand" />

      <div class="otp-card__eyebrow">
        <span class="otp-card__eyebrow-pill">{{ accountLabel }}</span>
      </div>

      <h1 id="otp-title" class="otp-card__title">OTP Verification</h1>
      <p class="otp-card__subtitle">Confirm your email with the 6-digit code we sent.</p>

      <section class="otp-info-card" aria-label="Verification email">
        <div class="otp-info-card__icon" aria-hidden="true">
          <i class="bi bi-envelope-paper" />
        </div>
        <div class="otp-info-card__copy">
          <p class="otp-info-card__label">{{ noticeTitle }}</p>
          <strong class="otp-info-card__value">{{ maskedEmail || email }}</strong>
          <p class="otp-info-card__text">{{ noticeText }}</p>
        </div>
      </section>

      <form class="otp-form" @submit.prevent="submitOtpVerification">
        <label class="otp-field-label" for="otp-code">OTP Code</label>

        <div class="otp-code-shell" @click="focusOtpInput">
          <input
            id="otp-code"
            ref="otpInputRef"
            class="otp-code-input"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            :value="code"
            :disabled="isSubmitting"
            aria-label="6-digit OTP code"
            @input="handleCodeInput"
          />

          <div
            v-for="(digit, index) in otpDigits"
            :key="`otp-digit-${index}`"
            class="otp-digit"
            :class="{
              filled: Boolean(digit),
              active: index === activeOtpIndex && !isSubmitting,
              submitting: isSubmitting,
            }"
            aria-hidden="true"
          >
            <span>{{ digit }}</span>
          </div>
        </div>

        <p class="otp-status" :class="{ 'otp-status--ready': isOtpComplete || isSubmitting }" aria-live="polite">
          {{ otpStatusText }}
        </p>

        <button type="submit" class="otp-primary-btn" :disabled="isSubmitting || !isOtpComplete">
          <i class="bi" :class="isSubmitting ? 'bi-shield-check' : 'bi-patch-check'" aria-hidden="true" />
          <span>{{ submitButtonLabel }}</span>
        </button>
      </form>

      <section class="otp-info-card otp-info-card--resend" aria-label="Resend code">
        <div class="otp-info-card__icon otp-info-card__icon--soft" aria-hidden="true">
          <i class="bi bi-arrow-clockwise" />
        </div>
        <div class="otp-info-card__copy">
          <p class="otp-info-card__label otp-info-card__label--dark">Need another code?</p>
          <p class="otp-info-card__text otp-info-card__text--inline">
            <span>{{ resendHint }}</span>
            <button
              type="button"
              class="otp-inline-link"
              :disabled="isResending || resendCooldownSeconds > 0"
              @click="resendOtpCode"
            >
              {{ resendButtonLabel }}
            </button>
          </p>
        </div>
      </section>

      <p v-if="mode !== 'register'" class="otp-footer">
        <span>Wrong email?</span>
        <button type="button" class="otp-footer__link" @click="goToEntryPage">
          Back to login
        </button>
      </p>
    </main>
  </div>
</template>

<style scoped src="@/components/register_slot.css"></style>

<style scoped>
.otp-page {
  position: relative;
  min-height: 100vh;
  padding: 4.75rem 1.25rem 1.5rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 16% 18%, rgba(74, 160, 107, 0.25) 0%, rgba(74, 160, 107, 0) 26%),
    radial-gradient(circle at 84% 82%, rgba(243, 190, 121, 0.14) 0%, rgba(243, 190, 121, 0) 20%),
    linear-gradient(180deg, #071811 0%, #03100b 100%);
}

.otp-page::before,
.otp-page::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.otp-page::before {
  background:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.08));
}

.otp-page::after {
  inset: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 2rem;
}

.otp-card {
  position: relative;
  z-index: 1;
  width: min(100%, 35rem);
  padding: clamp(1.2rem, 3vw, 1.85rem);
  border: 1px solid rgba(219, 230, 223, 0.92);
  border-radius:1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.985) 0%, rgba(248, 250, 249, 0.985) 100%);
  box-shadow:
    0 24px 56px rgba(3, 18, 12, 0.28),
    0 10px 20px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.otp-card__brand {
  display: block;
  width: min(100%, 11.5rem);
  margin: 0 auto 0.65rem;
  height: auto;
}

.otp-card__eyebrow {
  display: flex;
  justify-content: center;
  margin-bottom: 0.45rem;
}

.otp-card__eyebrow-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.7rem;
  padding: 0.34rem 0.72rem;
  border-radius: 999px;
  background: rgba(20, 102, 65, 0.08);
  color: #19653f;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.otp-card__title {
  margin: 0;
  color: #16231d;
  text-align: center;
  font-size: clamp(1.65rem, 3.1vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.otp-card__subtitle {
  margin: 0.45rem auto 0;
  max-width: 24rem;
  color: #6b7c74;
  text-align: center;
  font-size: 0.88rem;
  line-height: 1.55;
}

.otp-info-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.8rem;
  align-items: center;
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border: 1px solid #dce7df;
  border-radius: 1.15rem;
  background: linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 10px 28px rgba(15, 23, 42, 0.045);
}

.otp-info-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.85rem;
  background: linear-gradient(180deg, #eef8f1 0%, #e1f1e7 100%);
  color: #2d7f55;
  box-shadow: inset 0 0 0 1px rgba(47, 116, 76, 0.08);
}

.otp-info-card__icon i {
  font-size: 0.95rem;
}

.otp-info-card__icon--soft {
  background: linear-gradient(180deg, #f1f7f3 0%, #e5efe8 100%);
  color: #6f8c7a;
}

.otp-info-card__copy {
  min-width: 0;
}

.otp-info-card__label {
  margin: 0;
  color: #7b8d84;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.otp-info-card__label--dark {
  color: #16231d;
  font-size: 0.88rem;
  letter-spacing: 0;
  text-transform: none;
}

.otp-info-card__value {
  display: block;
  margin-top: 0.22rem;
  color: #16231d;
  font-size: 0.96rem;
  font-weight: 800;
  line-height: 1.35;
  word-break: break-word;
}

.otp-info-card__text {
  margin: 0.2rem 0 0;
  color: #72827a;
  font-size: 0.8rem;
  line-height: 1.5;
}

.otp-info-card__text--inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.otp-form {
  margin-top: 1rem;
}

.otp-field-label {
  display: block;
  margin-bottom: 0.55rem;
  color: #44534b;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.otp-code-shell {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 0.48rem;
  padding: 0.8rem 0.7rem;
  border: 1px solid #dce7df;
  border-radius: 1.2rem;
  background: linear-gradient(180deg, #fbfdfb 0%, #f2f7f4 100%);
  cursor: text;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.otp-code-shell:focus-within {
  border-color: rgba(43, 126, 82, 0.48);
  box-shadow:
    0 0 0 3px rgba(27, 138, 84, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.otp-code-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: text;
}

.otp-digit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(2.45rem, 8vw, 2.95rem);
  height: clamp(2.85rem, 9vw, 3.35rem);
  border: 1px solid #d9e4dc;
  border-radius: 0.82rem;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfa 100%);
  color: #16231d;
  font-size: clamp(1.05rem, 2.5vw, 1.3rem);
  font-weight: 800;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.045);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.otp-digit span {
  min-width: 0.6ch;
  text-align: center;
}

.otp-digit.filled {
  border-color: #c8d9cd;
}

.otp-digit.active {
  border-color: #6fa585;
  box-shadow:
    0 0 0 3px rgba(27, 138, 84, 0.11),
    0 10px 18px rgba(20, 102, 65, 0.08);
  transform: translateY(-1px);
}

.otp-digit.submitting {
  border-color: rgba(43, 126, 82, 0.45);
}

.otp-status {
  min-height: 1.5rem;
  margin: 0.55rem 0 0;
  color: #74837c;
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.45;
}

.otp-status--ready {
  color: #17653f;
}

.otp-primary-btn {
  width: 100%;
  margin-top: 0.75rem;
  min-height: 3.1rem;
  border: 0;
  border-radius: 0.95rem;
  background: linear-gradient(180deg, #2f8058 0%, #1d623f 100%);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  font-size: 0.92rem;
  font-weight: 800;
  box-shadow: 0 14px 26px rgba(20, 102, 65, 0.22);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.otp-primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(20, 102, 65, 0.28);
}

.otp-primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  box-shadow: none;
}

.otp-info-card--resend {
  margin-top: 0.8rem;
  align-items: start;
}

.otp-inline-link {
  border: 0;
  background: transparent;
  padding: 0;
  color: #1f7a4e;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.otp-inline-link:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.otp-footer {
  margin: 0.9rem 0 0;
  color: #7a8a82;
  text-align: center;
  font-size: 0.82rem;
}

.otp-footer__link {
  border: 0;
  background: transparent;
  padding: 0;
  margin-left: 0.35rem;
  color: #17653f;
  font-size: inherit;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 720px) {
  .otp-page {
    padding-top: 4.5rem;
  }

  .otp-card {
    border-radius: 1.3rem;
    padding: 1rem 0.9rem;
  }

  .otp-info-card {
    grid-template-columns: 1fr;
    gap: 0.8rem;
    text-align: left;
  }

  .otp-info-card__icon {
    width: 2.35rem;
    height: 2.35rem;
  }

  .otp-code-shell {
    gap: 0.38rem;
    padding: 0.68rem 0.5rem;
  }

  .otp-status {
    font-size: 0.76rem;
  }
}

@media (max-width: 520px) {
  .otp-page {
    padding-inline: 0.85rem;
  }

  .otp-card__brand {
    width: min(100%, 10.5rem);
  }

  .otp-card__subtitle {
    font-size: 0.84rem;
  }

  .otp-digit {
    width: clamp(2.15rem, 11vw, 2.5rem);
    height: clamp(2.65rem, 12vw, 2.95rem);
    border-radius: 0.72rem;
  }

  .reg-back-btn {
    top: 0.9rem;
    left: 0.9rem;
    padding-inline: 0.8rem;
  }

  .reg-back-btn span {
    display: none;
  }
}
</style>
