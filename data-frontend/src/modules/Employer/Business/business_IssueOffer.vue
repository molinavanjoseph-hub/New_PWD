<script setup>
import { computed } from 'vue'

const props = defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  canEditBusinessModule: {
    type: Function,
    default: () => false,
  },
  openIssueOfferModal: {
    type: Function,
    default: () => {},
  },
})

const issueOfferRows = computed(() => (Array.isArray(props.rows) ? props.rows : []))
const canEditIssueOffers = computed(() =>
  props.canEditBusinessModule('issue-offer') === true || props.canEditBusinessModule('applicant-management') === true,
)

const summaryCards = computed(() => {
  const rows = issueOfferRows.value

  return [
    {
      id: 'total',
      label: 'Offer Queue',
      value: String(rows.length),
      tone: 'mint',
      copy: 'Applicants currently visible for offer drafting or follow-up.',
    },
    {
      id: 'ready',
      label: 'Ready To Send',
      value: String(rows.filter((row) => String(row.offerStatus || '').trim() === 'not_sent').length),
      tone: 'amber',
      copy: 'Applicants who can receive a first offer right now.',
    },
    {
      id: 'sent',
      label: 'Offer Sent',
      value: String(rows.filter((row) => String(row.offerStatus || '').trim() === 'sent').length),
      tone: 'sky',
      copy: 'Offers already sent and waiting for the applicant response.',
    },
    {
      id: 'accepted',
      label: 'Accepted',
      value: String(rows.filter((row) => String(row.offerStatus || '').trim() === 'accepted').length),
      tone: 'rose',
      copy: 'Accepted offers that can move to Contract Signing.',
    },
  ]
})

const formatDateLabel = (value, options = {}) => {
  const parsedValue = new Date(String(value || '').trim())
  if (Number.isNaN(parsedValue.getTime())) return 'Not set'

  return parsedValue.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    ...options,
  })
}

const getIssueOfferStatusClass = (row = {}) => {
  const tone = String(row.offerTone || '').trim().toLowerCase()
  if (tone === 'success') return 'is-offer-accepted'
  if (tone === 'danger') return 'is-offer-declined'
  if (tone === 'warning') return 'is-offer-sent'
  return 'is-offer-ready'
}

const openRowOfferModal = (rowId) => {
  if (!canEditIssueOffers.value) return
  props.openIssueOfferModal(String(rowId || '').trim())
}

const handleIssueOfferRowKeydown = (event, rowId) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openRowOfferModal(rowId)
  }
}
</script>

<template>
  <section class="business-issue-offer">
    <div class="business-job-post__lead">
      <div class="business-job-post__copy">
        <p class="business-job-post__eyebrow">Offer Workflow</p>
        <h2>Issue Offer</h2>
        <p>
          Review offer-ready applicants, reopen sent offers, and move accepted candidates into Contract Signing
          without leaving the business workspace.
        </p>
        <div class="business-job-post__lead-meta">
          <span class="business-job-post__lead-chip">
            <i class="bi bi-envelope-paper" aria-hidden="true" />
            {{ issueOfferRows.length }} visible applicants
          </span>
          <span class="business-job-post__lead-chip">
            <i class="bi bi-shield-check" aria-hidden="true" />
            {{ canEditIssueOffers ? 'Offer editing enabled' : 'View-only access' }}
          </span>
        </div>
      </div>
    </div>

    <div class="business-job-post__highlights business-issue-offer__highlights">
      <article
        v-for="card in summaryCards"
        :key="card.id"
        class="business-job-post__highlight business-issue-offer__highlight"
        :class="`business-issue-offer__highlight--${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <p>{{ card.copy }}</p>
      </article>
    </div>

    <article class="business-job-post__panel business-issue-offer__panel">
      <div class="business-job-post__panel-head">
        <div>
          <p class="business-job-post__tips-label">Offer List</p>
          <strong>Offer-ready applicants</strong>
          <p class="business-issue-offer__panel-copy">
            Applicants stay here after approval or completed interview stages so you can draft, resend, or review offers.
          </p>
        </div>
        <span class="business-job-post__panel-chip">{{ issueOfferRows.length }} total</span>
      </div>

      <div class="business-user-overview__toolbar business-user-overview__toolbar--applicants business-issue-offer__toolbar">
        <div class="business-user-overview__summary">
          {{ canEditIssueOffers
            ? 'Select a row or use the action buttons to open the offer modal.'
            : 'You currently have view-only access for Issue Offer.' }}
        </div>
      </div>

      <div class="business-applicants__table-shell">
        <table class="business-applicants__table business-issue-offer__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Applicant</th>
              <th>Applied Role</th>
              <th>Passed Stage</th>
              <th>Offer Status</th>
              <th class="business-applicants__table-actions-head">Actions</th>
            </tr>
          </thead>

          <tbody v-if="issueOfferRows.length">
            <tr
              v-for="(row, index) in issueOfferRows"
              :key="row.id"
              class="business-applicants__table-row"
              :class="{ 'is-clickable': canEditIssueOffers }"
              :tabindex="canEditIssueOffers ? 0 : undefined"
              @click="openRowOfferModal(row.id)"
              @keydown="handleIssueOfferRowKeydown($event, row.id)"
            >
              <td class="business-applicants__table-index">{{ index + 1 }}</td>
              <td>
                <div class="business-user-overview__account">
                  <div class="business-user-overview__avatar business-issue-offer__avatar">
                    <img
                      v-if="row.applicantAvatar"
                      :src="row.applicantAvatar"
                      :alt="`${row.applicantName} avatar`"
                      class="business-user-overview__avatar-image"
                      loading="lazy"
                      decoding="async"
                    >
                    <template v-else>{{ row.applicantInitials }}</template>
                  </div>

                  <div class="business-user-overview__meta">
                    <strong>{{ row.applicantName }}</strong>
                    <span>{{ row.applicantEmail }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="business-applicants__role-copy">
                  <strong>{{ row.jobTitle }}</strong>
                  <span>{{ row.offerTitle || 'Ready for offer drafting' }}</span>
                </div>
              </td>
              <td>
                <div class="business-applicants__role-copy">
                  <strong>{{ row.passedStageLabel }}</strong>
                  <span>
                    {{ row.completedAt
                      ? `Completed ${formatDateLabel(row.completedAt, { hour: 'numeric', minute: '2-digit' })}`
                      : 'Waiting for completion date' }}
                  </span>
                </div>
              </td>
              <td>
                <div class="business-applicants__role-copy">
                  <span
                    class="business-applicants__status-pill business-issue-offer__status-pill"
                    :class="getIssueOfferStatusClass(row)"
                  >
                    {{ row.offerStatusLabel }}
                  </span>
                  <span>{{ row.offerMeta }}</span>
                </div>
              </td>
              <td class="business-applicants__table-actions-cell">
                <div class="business-applicants__row-actions">
                  <button
                    type="button"
                    class="business-applicants__row-action"
                    title="View Offer"
                    aria-label="View Offer"
                    :disabled="!canEditIssueOffers"
                    @click.stop="openRowOfferModal(row.id)"
                  >
                    <i class="bi bi-eye" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="business-applicants__row-action business-issue-offer__row-action--primary"
                    :title="row.actionLabel"
                    :aria-label="row.actionLabel"
                    :disabled="!canEditIssueOffers"
                    @click.stop="openRowOfferModal(row.id)"
                  >
                    <i class="bi bi-envelope-paper" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="6">
                <div class="business-user-overview__empty business-issue-offer__empty">
                  No offer-ready applicants yet.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

<style scoped>
.business-issue-offer {
  display: grid;
  gap: 1.5rem;
}

.business-issue-offer__panel {
  display: grid;
  gap: 1rem;
}

.business-issue-offer__highlights {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
}

.business-issue-offer__highlight {
  display: grid;
  gap: 0.35rem;
  align-content: start;
  height: 100%;
}

.business-issue-offer__highlight p,
.business-issue-offer__panel-copy {
  margin: 0;
  color: #6b7d72;
  line-height: 1.55;
}

.business-issue-offer__highlight--mint {
  background: linear-gradient(180deg, rgba(236, 248, 241, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.business-issue-offer__highlight--amber {
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.business-issue-offer__highlight--sky {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.business-issue-offer__highlight--rose {
  background: linear-gradient(180deg, rgba(255, 241, 242, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.business-issue-offer__toolbar {
  padding: 0;
  border: 0;
  background: transparent;
}

.business-issue-offer__toolbar :deep(.business-user-overview__summary) {
  width: 100%;
  min-height: 3.2rem;
  justify-content: flex-start;
  padding: 0.9rem 1rem;
  text-align: left;
  white-space: normal;
}

.business-issue-offer__table :deep(.business-user-overview__meta strong),
.business-issue-offer__table :deep(.business-applicants__role-copy strong) {
  color: #183126;
}

.business-issue-offer__status-pill.is-offer-ready {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.business-issue-offer__status-pill.is-offer-sent {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.business-issue-offer__status-pill.is-offer-accepted {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.business-issue-offer__status-pill.is-offer-declined {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.business-issue-offer__row-action--primary {
  color: #1d6b4f;
  border-color: rgba(121, 178, 147, 0.32);
  background: rgba(236, 248, 241, 0.96);
}

.business-issue-offer__row-action--primary:hover {
  color: #ffffff;
  border-color: #1d6b4f;
  background: #1d6b4f;
}

.business-issue-offer__empty {
  min-height: 11rem;
}

@media (max-width: 1280px) {
  .business-issue-offer__highlights {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .business-issue-offer__highlights {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .business-issue-offer__panel :deep(.business-job-post__panel-head) {
    flex-direction: column;
  }
}
</style>
