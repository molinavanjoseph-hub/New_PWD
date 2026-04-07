<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  offerRecords: {
    type: Array,
    default: () => [],
  },
  activeOfferActionId: {
    type: String,
    default: '',
  },
  isOfferActionSubmitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['approve-offer', 'reject-offer'])

const viewingOfferId = ref('')
const rejectingOfferId = ref('')
const rejectReasonDrafts = reactive({})

const normalizeOfferStatus = (value = '') => String(value || '').trim().toLowerCase()
const isOfferAccepted = (value = '') => ['accepted', 'confirmed', 'signed'].includes(normalizeOfferStatus(value))
const isOfferPending = (value = '') => ['sent', 'offered', 'pending'].includes(normalizeOfferStatus(value))
const isOfferHired = (value = '') => normalizeOfferStatus(value) === 'hired'

const getCompanyInitial = (value) => String(value || 'J').trim().charAt(0).toUpperCase() || 'J'
const isViewing = (offerId) => String(viewingOfferId.value || '').trim() === String(offerId || '').trim()
const isRejecting = (offerId) => String(rejectingOfferId.value || '').trim() === String(offerId || '').trim()
const canRespondToOffer = (record = {}) => Boolean(record?.canRespond) && isOfferPending(record?.offerStatus)
const selectedOfferRecord = computed(() =>
  props.offerRecords.find((record) => isViewing(record?.id)) || null,
)

const openViewOffer = (record = {}) => {
  const recordId = String(record?.id || '').trim()
  if (!recordId) return
  viewingOfferId.value = recordId
}

const closeViewOffer = () => {
  viewingOfferId.value = ''
  rejectingOfferId.value = ''
}

const startRejectingOffer = (record = {}) => {
  const recordId = String(record?.id || '').trim()
  if (!recordId) return

  viewingOfferId.value = recordId
  rejectingOfferId.value = recordId
  if (typeof rejectReasonDrafts[recordId] !== 'string') {
    rejectReasonDrafts[recordId] = ''
  }
}

const cancelRejectingOffer = () => {
  rejectingOfferId.value = ''
}

const approveOffer = (record = {}) => {
  emit('approve-offer', {
    offerId: record?.offerId || record?.id || '',
    applicationId: record?.applicationId || record?.id || '',
  })
}

const submitRejectOffer = (record = {}) => {
  const recordId = String(record?.id || '').trim()
  const reason = String(rejectReasonDrafts[recordId] || '').trim()
  if (!recordId || !reason) return

  emit('reject-offer', {
    offerId: record?.offerId || record?.id || '',
    applicationId: record?.applicationId || record?.id || '',
    reason,
  })
}

watch(
  () => props.offerRecords,
  (records) => {
    const viewedRecord = records.find((record) => isViewing(record?.id))
    if (!viewedRecord) {
      viewingOfferId.value = ''
      rejectingOfferId.value = ''
      return
    }

    if (!canRespondToOffer(viewedRecord)) {
      rejectingOfferId.value = ''
    }
  },
  { deep: true },
)
</script>

<template>
  <section class="applicant-job-offers-page">
    <article class="applicant-job-offers-page__panel">
      <div v-if="offerRecords.length" class="applicant-job-offers-page__table-wrap">
        <table class="applicant-job-offers-page__table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Offer</th>
              <th>Deadline</th>
              <th>Start Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="record in offerRecords" :key="record.id">
              <tr class="applicant-job-offers-page__row">
                <td>
                  <div class="applicant-job-offers-page__job">
                    <span class="applicant-job-offers-page__avatar" aria-hidden="true">
                      <img
                        v-if="record.logoUrl"
                        :src="record.logoUrl"
                        alt=""
                        class="applicant-job-offers-page__avatar-image"
                      >
                      <template v-else>{{ getCompanyInitial(record.company) }}</template>
                    </span>
                    <div class="applicant-job-offers-page__job-copy">
                      <strong>{{ record.title }}</strong>
                      <span>{{ record.company }}</span>
                      <small>{{ record.location }} | {{ record.jobType }}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="applicant-job-offers-page__offer-copy">
                    <strong>{{ record.offerTitle }}</strong>
                    <span>{{ record.compensationLabel }}</span>
                  </div>
                </td>
                <td class="applicant-job-offers-page__date-cell">{{ record.responseDeadlineLabel }}</td>
                <td class="applicant-job-offers-page__date-cell">{{ record.startDateLabel }}</td>
                <td>
                  <span class="applicant-job-offers-page__status-pill" :class="`is-${record.offerTone || 'success'}`">
                    {{ record.offerLabel }}
                  </span>
                </td>
                <td>
                  <div class="applicant-job-offers-page__actions">
                    <button
                      type="button"
                      class="applicant-job-offers-page__action applicant-job-offers-page__action--secondary"
                      :disabled="isOfferActionSubmitting"
                      @click="openViewOffer(record)"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>

            </template>
          </tbody>
        </table>
      </div>

      <div v-else class="applicant-job-offers-page__empty">
        <i class="bi bi-briefcase" aria-hidden="true" />
        <h3>No pending job offers</h3>
        <p>Approved or rejected job offers will update your application timeline and notifications automatically.</p>
      </div>
    </article>

    <div
      v-if="selectedOfferRecord"
      class="applicant-job-offers-page__modal-backdrop"
      role="presentation"
      @click.self="closeViewOffer"
    >
      <section
        class="applicant-job-offers-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-job-offer-modal-title"
      >
        <header class="applicant-job-offers-page__modal-header">
          <div class="applicant-job-offers-page__modal-heading">
            <p>Job offer</p>
            <h3 id="applicant-job-offer-modal-title">{{ selectedOfferRecord.offerTitle }}</h3>
            <span>{{ selectedOfferRecord.company }} · {{ selectedOfferRecord.title }}</span>
          </div>

          <button
            type="button"
            class="applicant-job-offers-page__modal-close"
            aria-label="Close offer details"
            @click="closeViewOffer"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div class="applicant-job-offers-page__modal-body">
          <div class="applicant-job-offers-page__detail-grid">
            <article class="applicant-job-offers-page__detail-card">
              <span>Company</span>
              <strong>{{ selectedOfferRecord.company }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Job</span>
              <strong>{{ selectedOfferRecord.title }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Compensation</span>
              <strong>{{ selectedOfferRecord.compensationLabel }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Response Deadline</span>
              <strong>{{ selectedOfferRecord.responseDeadlineLabel }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Start Date</span>
              <strong>{{ selectedOfferRecord.startDateLabel }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Status</span>
              <strong>{{ selectedOfferRecord.offerLabel }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Location</span>
              <strong>{{ selectedOfferRecord.location }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Employment Type</span>
              <strong>{{ selectedOfferRecord.jobType }}</strong>
            </article>
            <article class="applicant-job-offers-page__detail-card">
              <span>Offer Sent</span>
              <strong>{{ selectedOfferRecord.sentAtLabel }}</strong>
            </article>
          </div>

          <article class="applicant-job-offers-page__detail-note applicant-job-offers-page__detail-note--modal">
            <span>Offer Details</span>
            <p>{{ selectedOfferRecord.offerLetter || selectedOfferRecord.offerSummary }}</p>
          </article>

          <article
            v-if="selectedOfferRecord.responseNote && !isRejecting(selectedOfferRecord.id)"
            class="applicant-job-offers-page__detail-note applicant-job-offers-page__detail-note--response"
          >
            <span>Response Note</span>
            <p>{{ selectedOfferRecord.responseNote }}</p>
          </article>

          <div v-if="isRejecting(selectedOfferRecord.id)" class="applicant-job-offers-page__reject-box">
            <label class="applicant-job-offers-page__reject-field">
              <span>Reason for rejecting this offer</span>
              <textarea
                v-model.trim="rejectReasonDrafts[selectedOfferRecord.id]"
                rows="4"
                placeholder="Write the reason you want the employer to see."
              />
            </label>

            <div class="applicant-job-offers-page__reject-actions">
              <button
                type="button"
                class="applicant-job-offers-page__action applicant-job-offers-page__action--secondary"
                :disabled="isOfferActionSubmitting"
                @click="cancelRejectingOffer"
              >
                Cancel
              </button>
              <button
                type="button"
                class="applicant-job-offers-page__action applicant-job-offers-page__action--danger"
                :disabled="isOfferActionSubmitting || !String(rejectReasonDrafts[selectedOfferRecord.id] || '').trim()"
                @click="submitRejectOffer(selectedOfferRecord)"
              >
                {{ activeOfferActionId === selectedOfferRecord.applicationId ? 'Saving...' : 'Confirm Reject' }}
              </button>
            </div>
          </div>
        </div>

        <footer class="applicant-job-offers-page__modal-footer">
          <button
            type="button"
            class="applicant-job-offers-page__action applicant-job-offers-page__action--secondary"
            :disabled="isOfferActionSubmitting"
            @click="closeViewOffer"
          >
            Close
          </button>
          <button
            v-if="canRespondToOffer(selectedOfferRecord) && !isRejecting(selectedOfferRecord.id)"
            type="button"
            class="applicant-job-offers-page__action applicant-job-offers-page__action--danger"
            :disabled="isOfferActionSubmitting"
            @click="startRejectingOffer(selectedOfferRecord)"
          >
            Reject
          </button>
          <button
            v-if="canRespondToOffer(selectedOfferRecord)"
            type="button"
            class="applicant-job-offers-page__action applicant-job-offers-page__action--success"
            :disabled="isOfferActionSubmitting"
            @click="approveOffer(selectedOfferRecord)"
          >
            {{ activeOfferActionId === selectedOfferRecord.applicationId ? 'Saving...' : 'Approve Offer' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.applicant-job-offers-page {
  display: grid;
  min-height: 0;
  align-content: start;
  padding: 0.85rem 0.9rem 2rem;
}

.applicant-job-offers-page__panel {
  display: grid;
  gap: 1rem;
  width: 100%;
  margin: 0;
  padding: 1rem;
  border: 1px solid rgba(66, 112, 87, 0.18);
  border-radius: 1.45rem;
  background:
    radial-gradient(circle at top left, rgba(222, 243, 231, 0.72), transparent 38%),
    linear-gradient(180deg, rgba(248, 252, 250, 0.97), rgba(255, 255, 255, 0.98));
  box-shadow: 0 18px 36px rgba(31, 74, 51, 0.08);
}

.applicant-job-offers-page__table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(66, 112, 87, 0.14);
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.applicant-job-offers-page__table {
  width: 100%;
  min-width: 68rem;
  border-collapse: separate;
  border-spacing: 0;
}

.applicant-job-offers-page__table th,
.applicant-job-offers-page__table td {
  padding: 1.15rem 1rem;
  border-bottom: 1px solid rgba(66, 112, 87, 0.12);
  text-align: left;
  vertical-align: middle;
}

.applicant-job-offers-page__table th {
  color: #4f6d5d;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #f4faf6, #eef6f1);
}

.applicant-job-offers-page__table td {
  background: rgba(255, 255, 255, 0.78);
}

.applicant-job-offers-page__row {
  transition: background-color 0.18s ease;
}

.applicant-job-offers-page__row:hover {
  background: rgba(246, 251, 248, 0.94);
}

.applicant-job-offers-page__row:last-child td {
  border-bottom: none;
}

.applicant-job-offers-page__job {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
}

.applicant-job-offers-page__avatar {
  display: inline-grid;
  place-items: center;
  width: 2.9rem;
  aspect-ratio: 1;
  border: 1px solid rgba(66, 112, 87, 0.16);
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(220, 242, 228, 0.94), rgba(247, 252, 249, 0.96));
  color: #1d573b;
  font-size: 1rem;
  font-weight: 800;
  overflow: hidden;
  text-transform: uppercase;
  flex: 0 0 auto;
}

.applicant-job-offers-page__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.applicant-job-offers-page__job-copy,
.applicant-job-offers-page__offer-copy {
  display: grid;
  gap: 0.25rem;
}

.applicant-job-offers-page__job-copy strong,
.applicant-job-offers-page__offer-copy strong {
  color: #173927;
  font-size: 1rem;
  line-height: 1.35;
}

.applicant-job-offers-page__job-copy span,
.applicant-job-offers-page__offer-copy span,
.applicant-job-offers-page__job-copy small {
  color: #4e6f5d;
  font-size: 0.87rem;
  line-height: 1.5;
}

.applicant-job-offers-page__date-cell {
  color: #2f4e3d;
  font-size: 0.95rem;
  font-weight: 700;
  white-space: nowrap;
}

.applicant-job-offers-page__status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.52rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(32, 118, 76, 0.18);
  background: rgba(225, 245, 233, 0.96);
  color: #176a42;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}

.applicant-job-offers-page__status-pill.is-success {
  border-color: rgba(22, 163, 74, 0.2);
  background: rgba(225, 245, 233, 0.96);
  color: #176a42;
}

.applicant-job-offers-page__status-pill.is-accent {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 247, 237, 0.98);
  color: #b45309;
}

.applicant-job-offers-page__status-pill.is-danger {
  border-color: rgba(248, 113, 113, 0.22);
  background: rgba(254, 242, 242, 0.98);
  color: #b42318;
}

.applicant-job-offers-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.applicant-job-offers-page__action {
  min-height: 2.25rem;
  padding: 0.52rem 0.92rem;
  border: 1px solid rgba(66, 112, 87, 0.14);
  border-radius: 0.8rem;
  background: #ffffff;
  color: #1c4d34;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.applicant-job-offers-page__action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.applicant-job-offers-page__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.applicant-job-offers-page__action--secondary {
  background: #f8fbf9;
  color: #355b47;
}

.applicant-job-offers-page__action--success {
  border-color: rgba(22, 163, 74, 0.22);
  background: rgba(225, 245, 233, 0.96);
  color: #176a42;
}

.applicant-job-offers-page__action--danger {
  border-color: rgba(248, 113, 113, 0.22);
  background: rgba(254, 242, 242, 0.98);
  color: #b42318;
}

.applicant-job-offers-page__modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 260;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 1.5rem;
  background: rgba(11, 27, 18, 0.52);
  backdrop-filter: blur(6px);
}

.applicant-job-offers-page__modal {
  width: min(100%, 58rem);
  max-height: min(88vh, 52rem);
  margin: auto;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
  border-radius: 1.5rem;
  border: 1px solid rgba(66, 112, 87, 0.16);
  background:
    radial-gradient(circle at top right, rgba(223, 243, 232, 0.9), transparent 34%),
    linear-gradient(180deg, rgba(251, 254, 252, 0.98), rgba(245, 250, 247, 0.98));
  box-shadow: 0 26px 60px rgba(17, 45, 30, 0.24);
}

.applicant-job-offers-page__modal-header,
.applicant-job-offers-page__modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
}

.applicant-job-offers-page__modal-header {
  border-bottom: 1px solid rgba(66, 112, 87, 0.1);
}

.applicant-job-offers-page__modal-heading {
  display: grid;
  gap: 0.35rem;
}

.applicant-job-offers-page__modal-heading p {
  margin: 0;
  color: #5b7a69;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.applicant-job-offers-page__modal-heading h3 {
  margin: 0;
  color: #163927;
  font-size: clamp(1.25rem, 2vw, 1.8rem);
  line-height: 1.15;
}

.applicant-job-offers-page__modal-heading span {
  color: #4f6f5f;
  font-size: 0.95rem;
}

.applicant-job-offers-page__modal-close {
  display: inline-grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid rgba(66, 112, 87, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #315341;
  cursor: pointer;
}

.applicant-job-offers-page__modal-body {
  display: grid;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  overflow-y: auto;
}

.applicant-job-offers-page__detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.applicant-job-offers-page__detail-card,
.applicant-job-offers-page__detail-note,
.applicant-job-offers-page__reject-box {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(66, 112, 87, 0.12);
  background: rgba(255, 255, 255, 0.98);
}

.applicant-job-offers-page__detail-card span,
.applicant-job-offers-page__detail-note span,
.applicant-job-offers-page__reject-field span {
  color: #5f7d6c;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-job-offers-page__detail-card strong {
  color: #173927;
  font-size: 0.92rem;
  line-height: 1.5;
}

.applicant-job-offers-page__detail-note p {
  margin: 0;
  color: #274634;
  font-size: 0.92rem;
  line-height: 1.65;
}

.applicant-job-offers-page__detail-note--modal {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 249, 0.98));
}

.applicant-job-offers-page__detail-note--response {
  border-color: rgba(245, 158, 11, 0.18);
  background: rgba(255, 251, 235, 0.98);
}

.applicant-job-offers-page__reject-field {
  display: grid;
  gap: 0.45rem;
}

.applicant-job-offers-page__reject-field textarea {
  width: 100%;
  min-height: 7rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(66, 112, 87, 0.14);
  background: #ffffff;
  color: #173927;
  font: inherit;
  resize: vertical;
}

.applicant-job-offers-page__reject-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.applicant-job-offers-page__modal-footer {
  border-top: 1px solid rgba(66, 112, 87, 0.1);
  justify-content: flex-end;
  background: rgba(255, 255, 255, 0.78);
}

.applicant-job-offers-page__empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.7rem;
  min-height: 18rem;
  padding: 2rem;
  border: 1px dashed rgba(66, 112, 87, 0.24);
  background: rgba(255, 255, 255, 0.74);
  text-align: center;
}

.applicant-job-offers-page__empty i {
  color: #3f775a;
  font-size: 2rem;
}

.applicant-job-offers-page__empty h3 {
  margin: 0;
  color: #193826;
  font-size: 1.1rem;
}

.applicant-job-offers-page__empty p {
  margin: 0;
  max-width: 30rem;
  color: #5f7c6d;
  font-size: 0.93rem;
  line-height: 1.65;
}

@media (max-width: 960px) {
  .applicant-job-offers-page__table {
    min-width: 56rem;
  }

  .applicant-job-offers-page__detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .applicant-job-offers-page {
    padding: 0.85rem 0.85rem 1.4rem;
  }

  .applicant-job-offers-page__panel {
    padding: 0.7rem;
    border-radius: 1rem;
  }

  .applicant-job-offers-page__modal-backdrop {
    padding: 0.85rem;
  }

  .applicant-job-offers-page__modal-header,
  .applicant-job-offers-page__modal-body,
  .applicant-job-offers-page__modal-footer {
    padding-inline: 0.95rem;
  }

  .applicant-job-offers-page__detail-grid {
    grid-template-columns: 1fr;
  }

  .applicant-job-offers-page__modal-footer {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .applicant-job-offers-page__reject-actions {
    justify-content: stretch;
    flex-direction: column;
  }
}
</style>
