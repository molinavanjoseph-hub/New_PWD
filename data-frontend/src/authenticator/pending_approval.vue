<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import mathLogo from '@/assets/math.png'

const route = useRoute()

const email = computed(() => String(route.query.email || '').trim())
const role = computed(() => String(route.query.role || 'applicant').trim().toLowerCase())
const organizationType = computed(() => String(route.query.organizationType || '').trim().toLowerCase())
const employerAccountLabel = computed(() =>
  organizationType.value === 'business' ? 'Business Account' : 'Company Account',
)
const employerAccountLabelLower = computed(() => employerAccountLabel.value.toLowerCase())

const statusTitle = computed(() =>
  role.value === 'employer' ? `${employerAccountLabel.value} Registration Submitted` : 'Application Submitted',
)

const statusCopy = computed(() => {
  return role.value === 'employer'
    ? `Your email is already verified and your ${employerAccountLabelLower.value} is now under admin review.`
    : 'Your email is already verified and your application is now under admin review.'
})
</script>

<template>
  <div class="approval-page">
    <main class="approval-shell">
      <section class="approval-card">
        <img :src="mathLogo" alt="PWD Platform logo" class="approval-logo" />

        <p class="approval-eyebrow">Registration Complete</p>
        <div class="approval-status-icon approval-status-icon--success" aria-hidden="true">
          <i class="bi bi-envelope-check" />
        </div>
        <h1 class="approval-title">{{ statusTitle }}</h1>
        <p class="approval-copy">{{ statusCopy }}</p>

        <p v-if="email" class="approval-email">
          <span>Registered email</span>
          <strong>{{ email }}</strong>
        </p>

        <div class="approval-note approval-note--success">
          <span>There is no need to wait on this page. We will send the result to your Gmail once your account has been reviewed.</span>
        </div>

        <div class="approval-message-list">
          <div class="approval-message-item">
            <i class="bi bi-check-circle" aria-hidden="true" />
            <span>If your {{ role === 'employer' ? employerAccountLabelLower : 'application' }} is approved, the email will include a direct link to the login page.</span>
          </div>
          <div class="approval-message-item">
            <i class="bi bi-info-circle" aria-hidden="true" />
            <span>If your {{ role === 'employer' ? employerAccountLabelLower : 'application' }} is not approved, we will also send a clear update by email.</span>
          </div>
        </div>

        <div class="approval-actions">
          <RouterLink class="approval-action approval-action--primary" to="/login">
            Go To Login
          </RouterLink>
          <RouterLink class="approval-action approval-action--secondary" to="/">
            Return Home
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped src="@/components/pending_approval.css"></style>
