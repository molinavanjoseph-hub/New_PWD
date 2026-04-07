<script setup>
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  candidate: { type: Object, default: () => null },
  isSubmitting: { type: Boolean, default: false },
  form: { type: Object, default: () => ({}) },
  formError: { type: String, default: '' },
  submitLabel: { type: String, default: 'Send Offer' },
  minDate: { type: String, default: '' },
})

const emit = defineEmits([
  'close',
  'submit',
  'update:formTitle',
  'update:formCompensation',
  'update:formStartDate',
  'update:formResponseDeadline',
  'update:formOfferLetter',
])

const buildUserOverviewInitials = (name, fallback) => {
  if (!name) return fallback
  const parts = String(name).trim().split(' ')
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].substring(0, 2).toUpperCase()
}

const resolveBusinessJobOfferStatusTone = (offer) => {
  const status = String(offer?.offerStatus || offer?.offer_status || '').toLowerCase().trim()
  if (status === 'accepted') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'sent') return 'warning'
  return 'muted'
}

const formatBusinessJobOfferStatusLabel = (offer) => {
  const status = String(offer?.offerStatus || offer?.offer_status || '').toLowerCase().trim()
  if (status === 'accepted') return 'Accepted'
  if (status === 'rejected') return 'Declined'
  if (status === 'sent') return 'Offer Sent'
  return 'Not Sent'
}

const formatBusinessJobOfferDateLabel = (dateRaw, options = {}) => {
  if (!dateRaw) return ''
  try {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...options,
    }).format(new Date(dateRaw))
  } catch {
    return String(dateRaw)
  }
}
</script>

<template>
  <Transition name="business-trial-modal">
    <div v-if="isOpen" class="business-modal business-modal--applicant-details business-modal--issue-offer" @click.self="$emit('close')">
      <div class="business-modal__card business-applicants-modal business-applicant-details-modal business-issue-offer-modal" role="dialog" aria-modal="true">
        <div class="business-modal__copy">
          <h2>Issue job offer</h2>
          <p>Send the offer letter below to {{ candidate?.applicantName || 'the applicant' }} for the {{ candidate?.jobTitle || 'selected' }} role.</p>
        </div>

        <div v-if="candidate" class="business-applicants-modal__body">
          <div class="business-applicants-modal__identity">
            <div class="business-applicants-modal__avatar">
              <img
                v-if="candidate.applicantAvatar"
                :src="candidate.applicantAvatar"
                :alt="`${candidate.applicantName} avatar`"
              >
              <template v-else>{{ buildUserOverviewInitials(candidate.applicantName, 'AP') }}</template>
            </div>

            <div class="business-applicants-modal__identity-copy">
              <strong>{{ candidate.applicantName }}</strong>
              <span>{{ candidate.applicantEmail }}</span>
              <span class="business-issue-offer__status" :class="`is-${resolveBusinessJobOfferStatusTone(candidate)}`">
                {{ formatBusinessJobOfferStatusLabel(candidate) }}
              </span>
            </div>
          </div>

          <div class="business-applicants-modal__grid">
            <div class="business-applicants-modal__item">
              <span>Applied Job</span>
              <strong>{{ candidate.jobTitle }}</strong>
            </div>
            <div class="business-applicants-modal__item">
              <span>Passed Stage</span>
              <strong>{{ candidate.passedStageLabel }}</strong>
            </div>
            <div class="business-applicants-modal__item">
              <span>Completed At</span>
              <strong>{{ formatBusinessJobOfferDateLabel(candidate.completedAt, { hour: 'numeric', minute: '2-digit' }) }}</strong>
            </div>
            <div class="business-applicants-modal__item">
              <span>Interviewer</span>
              <strong>{{ candidate.interviewer }}</strong>
            </div>
          </div>

          <div class="business-issue-offer-modal__form">
            <label class="business-interview-review-modal__option-field">
              <span>Offer Title</span>
              <input
                :value="form.offerTitle"
                @input="$emit('update:formTitle', $event.target.value)"
                type="text"
                placeholder="Customer Support Associate Job Offer"
              >
            </label>

            <div class="business-issue-offer-modal__grid">
              <label class="business-interview-review-modal__option-field">
                <span>Compensation</span>
                <input
                  :value="form.compensation"
                  @input="$emit('update:formCompensation', $event.target.value)"
                  type="text"
                  placeholder="PHP 25,000 monthly"
                >
              </label>

              <label class="business-interview-review-modal__option-field">
                <span>Start Date</span>
                <input
                  :value="form.startDate"
                  @input="$emit('update:formStartDate', $event.target.value)"
                  type="date"
                  :min="minDate"
                >
              </label>

              <label class="business-interview-review-modal__option-field">
                <span>Response Deadline</span>
                <input
                  :value="form.responseDeadline"
                  @input="$emit('update:formResponseDeadline', $event.target.value)"
                  type="date"
                  :min="minDate"
                >
              </label>
            </div>

            <label class="business-applicants-modal__reason business-issue-offer-modal__letter">
              <span>Job Offer Letter</span>
              <textarea
                :value="form.offerLetter"
                @input="$emit('update:formOfferLetter', $event.target.value)"
                rows="9"
                placeholder="Write the full job offer details that the applicant should review on their Job Offers page."
              />
            </label>
          </div>

          <p v-if="formError" class="business-applicants-modal__error">
            {{ formError }}
          </p>
        </div>

        <div class="business-modal__actions business-issue-offer-modal__actions">
          <button
            type="button"
            class="business-modal__button business-modal__button--secondary"
            :disabled="isSubmitting"
            @click="$emit('close')"
          >
            Close
          </button>
          <button
            type="button"
            class="business-modal__button business-modal__button--primary"
            :disabled="isSubmitting"
            @click="$emit('submit')"
          >
            <span v-if="isSubmitting" class="business-issue-offer-modal__button-spinner" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>{{ isSubmitting ? 'Sending offer' : submitLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.business-modal--issue-offer {
  padding: clamp(0.85rem, 2vw, 1.5rem);
  overflow-y: auto;
}

.business-issue-offer-modal {
  width: min(64rem, calc(100vw - 1.5rem));
  max-height: min(92vh, 56rem);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 1.1rem;
  padding: clamp(1rem, 1vw + 0.9rem, 1.55rem);
  overflow: hidden;
}

.business-issue-offer-modal :deep(.business-applicants-modal__body) {
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.2rem;
  padding-bottom: 0.35rem;
}

.business-issue-offer-modal :deep(.business-applicants-modal__grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.business-issue-offer-modal :deep(.business-applicants-modal__item) {
  min-height: 6.25rem;
  align-content: start;
}

.business-issue-offer-modal__actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin-top: auto;
  padding-top: 0.9rem;
  border-top: 1px solid rgba(217, 226, 220, 0.92);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.92) 20%, #ffffff 100%);
}

.business-issue-offer-modal__actions .business-modal__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.business-issue-offer-modal__button-spinner {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
}

.business-issue-offer-modal__button-spinner span {
  width: 0.32rem;
  height: 0.32rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.32;
  animation: business-issue-offer-modal-dot 1s ease-in-out infinite;
}

.business-issue-offer-modal__button-spinner span:nth-child(2) {
  animation-delay: 0.12s;
}

.business-issue-offer-modal__button-spinner span:nth-child(3) {
  animation-delay: 0.24s;
}

.business-issue-offer__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 0.34rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.business-issue-offer__status.is-success {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.business-issue-offer__status.is-danger {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.business-issue-offer__status.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.business-issue-offer__status.is-muted {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.business-issue-offer-modal__form {
  display: grid;
  gap: 1rem;
}

.business-issue-offer-modal__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.business-issue-offer-modal__letter {
  gap: 0.55rem;
}

.business-issue-offer-modal__letter textarea {
  min-height: clamp(12rem, 28vh, 18rem);
}

@media (max-width: 980px) {
  .business-issue-offer-modal {
    width: min(56rem, calc(100vw - 1.25rem));
  }

  .business-issue-offer-modal :deep(.business-applicants-modal__grid),
  .business-issue-offer-modal__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .business-modal--issue-offer {
    padding: 0.75rem;
  }

  .business-issue-offer-modal {
    width: min(100%, calc(100vw - 0.75rem));
    max-height: calc(100vh - 1rem);
    padding: 1rem;
  }

  .business-issue-offer-modal :deep(.business-applicants-modal__grid),
  .business-issue-offer-modal__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 760px) and (orientation: landscape) {
  .business-modal--issue-offer {
    place-items: stretch center;
    padding: 0.6rem;
  }

  .business-issue-offer-modal {
    width: min(68rem, calc(100vw - 1rem));
    max-height: calc(100vh - 1.2rem);
  }

  .business-issue-offer-modal__letter textarea {
    min-height: 8.5rem;
  }
}

@keyframes business-issue-offer-modal-dot {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.32;
  }

  40% {
    transform: translateY(-0.16rem);
    opacity: 1;
  }
}
</style>
