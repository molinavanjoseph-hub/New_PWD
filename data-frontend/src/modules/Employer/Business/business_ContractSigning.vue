<script setup>
import { computed } from 'vue'
import DigitalSignaturePad from '@/components/DigitalSignaturePad.vue'

const props = defineProps({
  overviewCards: {
    type: Array,
    default: () => [],
  },
  filterChips: {
    type: Array,
    default: () => [],
  },
  activeFilter: {
    type: String,
    default: 'all',
  },
  setFilter: {
    type: Function,
    default: () => {},
  },
  syncLabel: {
    type: String,
    default: '',
  },
  traceSummary: {
    type: String,
    default: '',
  },
  refreshQueue: {
    type: Function,
    default: () => {},
  },
  rows: {
    type: Array,
    default: () => [],
  },
  selectedRowId: {
    type: String,
    default: '',
  },
  selectRow: {
    type: Function,
    default: () => {},
  },
  sendContractToApplicant: {
    type: Function,
    default: () => {},
  },
  selectedRow: {
    type: Object,
    default: null,
  },
  selectedRecord: {
    type: Object,
    default: null,
  },
  contractDraft: {
    type: Object,
    default: () => ({}),
  },
  setContractDraftField: {
    type: Function,
    default: () => {},
  },
  restoreContractDraft: {
    type: Function,
    default: () => {},
  },
  saveAndSendBusinessContract: {
    type: Function,
    default: () => {},
  },
  isBusinessContractSaving: {
    type: Boolean,
    default: false,
  },
  canEditBusinessModule: {
    type: Function,
    default: () => false,
  },
  businessContractSignatureName: {
    type: String,
    default: '',
  },
  setBusinessContractSignatureName: {
    type: Function,
    default: () => {},
  },
  activeBusinessContractSigningId: {
    type: String,
    default: '',
  },
  completeBusinessContractSigning: {
    type: Function,
    default: () => {},
  },
})

const contractRows = computed(() => (Array.isArray(props.rows) ? props.rows : []))
const summaryCards = computed(() => (Array.isArray(props.overviewCards) ? props.overviewCards : []))
const filters = computed(() => (Array.isArray(props.filterChips) ? props.filterChips : []))
const currentRow = computed(() => props.selectedRow || null)
const currentRecord = computed(() => props.selectedRecord || null)
const canEditContracts = computed(() => props.canEditBusinessModule('contract-signing') === true)

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

const resolveRowStatusTone = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'completed') return 'success'
  if (normalizedValue === 'applicant_signed') return 'info'
  if (normalizedValue === 'sent') return 'warning'
  return 'muted'
}

const resolveRowStatusLabel = (row = {}) =>
  String(row?.statusLabel || row?.status || 'Ready').trim() || 'Ready'

const isSelectedRow = (rowId) => String(props.selectedRowId || '').trim() === String(rowId || '').trim()
const isActiveSigning = (recordId) =>
  String(props.activeBusinessContractSigningId || '').trim() === String(recordId || '').trim()
</script>

<template>
  <section class="business-contract-signing">
    <div class="business-contract-signing__hero business-job-post__lead">
      <div class="business-contract-signing__hero-copy business-job-post__copy">
        <span class="business-contract-signing__eyebrow business-job-post__eyebrow">Offer &amp; Onboarding</span>
        <h2>Contract Signing</h2>
        <p>
          Dito lang lalabas ang applicants na na-issue-han ng offer at nag-confirm na sa kanilang Job Offers page.
          Mula rito puwede nang i-send ang contract at tapusin ang countersign flow.
        </p>
        <div class="business-job-post__lead-meta business-contract-signing__lead-meta">
          <span class="business-job-post__lead-chip">
            <i class="bi bi-clock-history" aria-hidden="true" />
            {{ syncLabel }}
          </span>
          <span class="business-job-post__lead-chip">
            <i class="bi bi-diagram-3" aria-hidden="true" />
            {{ traceSummary }}
          </span>
        </div>
      </div>
    </div>

    <div class="business-job-post__highlights business-contract-signing__summary-grid">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="business-job-post__highlight business-contract-signing__summary-card"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <p>{{ card.copy }}</p>
      </article>
    </div>

    <div class="business-contract-signing__toolbar">
      <div class="business-contract-signing__filters">
        <button
          v-for="chip in filters"
          :key="chip.id"
          type="button"
          class="business-contract-signing__filter"
          :class="{ 'is-active': activeFilter === chip.id }"
          @click="setFilter(chip.id)"
        >
          <span>{{ chip.label }}</span>
          <strong>{{ chip.count }}</strong>
        </button>
      </div>

      <button
        type="button"
        class="business-contract-signing__button business-contract-signing__button--secondary business-job-post__button business-job-post__button--ghost"
        @click="refreshQueue"
      >
        <i class="bi bi-arrow-clockwise" aria-hidden="true" />
        <span>Refresh Fetch</span>
      </button>
    </div>

    <div class="business-contract-signing__layout">
      <article class="business-contract-signing__panel business-job-post__panel">
        <div class="business-contract-signing__panel-head business-job-post__panel-head">
          <div>
            <p class="business-contract-signing__panel-label business-job-post__tips-label">Contract Queue</p>
            <h3>Confirmed applicant table</h3>
            <p>Kapag accepted na ang job offer, dito na sila lalabas para sa contract assignment.</p>
          </div>
          <span class="business-contract-signing__count business-job-post__panel-chip">
            {{ contractRows.length }} {{ contractRows.length === 1 ? 'record' : 'records' }}
          </span>
        </div>

        <div class="business-contract-signing__table-shell">
          <table class="business-contract-signing__table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody v-if="contractRows.length">
              <tr
                v-for="row in contractRows"
                :key="row.id"
                class="business-contract-signing__row"
                :class="{ 'is-selected': isSelectedRow(row.id) }"
                @click="selectRow(row.id)"
              >
                <td>
                  <div class="business-contract-signing__identity">
                    <span class="business-contract-signing__avatar">
                      {{ String(row.name || 'A').charAt(0).toUpperCase() }}
                    </span>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <small>ID: {{ row.applicationId || row.id }}</small>
                      <small>{{ row.jobId ? `Job: ${row.jobId}` : 'No job id' }}</small>
                    </div>
                  </div>
                </td>
                <td>{{ row.email || 'No email' }}</td>
                <td>
                  <strong>{{ row.role || row.jobTitle }}</strong>
                  <small>{{ row.offerTitle || 'Issued Job Offer' }}</small>
                </td>
                <td>
                  <span
                    class="business-contract-signing__status"
                    :class="`is-${resolveRowStatusTone(row.status)}`"
                  >
                    {{ resolveRowStatusLabel(row) }}
                  </span>
                  <small>
                    {{ row.status === 'completed'
                      ? 'Fully signed'
                      : row.status === 'applicant_signed'
                        ? 'Applicant already signed'
                        : row.status === 'sent'
                          ? 'Waiting for applicant signature'
                          : row.offerAcceptedAt
                            ? `Offer confirmed ${formatDateLabel(row.offerAcceptedAt, { hour: 'numeric', minute: '2-digit' })}`
                            : 'Ready to send contract' }}
                  </small>
                </td>
                <td>
                  <div class="business-contract-signing__actions business-contract-signing__actions--table">
                    <button
                      type="button"
                      class="business-contract-signing__row-button business-job-post__secondary"
                      @click.stop="selectRow(row.id)"
                    >
                      Open
                    </button>
                    <button
                      v-if="row.canSend"
                      type="button"
                      class="business-contract-signing__button business-contract-signing__button--primary business-job-post__save"
                      :disabled="isBusinessContractSaving"
                      @click.stop="sendContractToApplicant(row.id)"
                    >
                      {{
                        isBusinessContractSaving && isSelectedRow(row.id)
                          ? 'Sending...'
                          : row.contractId
                            ? 'Resend Contract'
                            : 'Send Contract'
                      }}
                    </button>
                    <button
                      v-else-if="row.canBusinessSign || row.status === 'completed'"
                      type="button"
                      class="business-contract-signing__button business-contract-signing__button--secondary business-job-post__secondary"
                      @click.stop="selectRow(row.id)"
                    >
                      {{ row.status === 'completed' ? 'View Signatures' : 'Countersign' }}
                    </button>
                    <span v-else class="business-contract-signing__state-note">
                      {{ row.status === 'completed' ? 'Completed' : 'Waiting' }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr>
                <td colspan="5" class="business-contract-signing__empty-cell">
                  <div class="business-contract-signing__empty business-contract-signing__empty--table">
                    <i class="bi bi-file-earmark-lock" aria-hidden="true" />
                    <h3>No confirmed offers yet</h3>
                    <p>
                      Kailangan munang ma-send ang offer mula sa Issue Offer at i-confirm ng applicant sa Job Offers page
                      bago sila pumasok dito sa Contract Signing.
                    </p>
                    <small>{{ traceSummary }}</small>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="business-contract-signing__panel business-contract-signing__panel--editor business-job-post__panel">
        <template v-if="currentRow">
          <div class="business-contract-signing__panel-head business-job-post__panel-head">
            <div>
              <p class="business-contract-signing__panel-label business-job-post__tips-label">Contract Composer</p>
              <h3>{{ currentRow.name }}</h3>
              <p>{{ currentRow.jobTitle }} at {{ currentRow.businessName || 'Business Workspace' }}</p>
            </div>
            <span
              class="business-contract-signing__status business-contract-signing__status--head"
              :class="`is-${resolveRowStatusTone(currentRow.status)}`"
            >
              {{ resolveRowStatusLabel(currentRow) }}
            </span>
          </div>

          <div class="business-contract-signing__meta-grid">
            <div>
              <span>Offer Status</span>
              <strong>{{ currentRow.offerStatusLabel || 'Accepted' }}</strong>
            </div>
            <div>
              <span>Compensation</span>
              <strong>{{ currentRow.compensation || 'To be finalized' }}</strong>
            </div>
            <div>
              <span>Offer Confirmed</span>
              <strong>{{ currentRow.offerAcceptedAt ? formatDateLabel(currentRow.offerAcceptedAt, { hour: 'numeric', minute: '2-digit' }) : 'Not set' }}</strong>
            </div>
            <div>
              <span>Contract Sent</span>
              <strong>{{ currentRow.sentAt ? formatDateLabel(currentRow.sentAt, { hour: 'numeric', minute: '2-digit' }) : 'Pending' }}</strong>
            </div>
          </div>

          <div class="business-contract-signing__form-grid">
            <label class="business-contract-signing__field business-job-post__field">
              <span>Contract Title</span>
              <input
                :value="contractDraft.contractTitle"
                type="text"
                :disabled="!canEditContracts || isBusinessContractSaving"
                placeholder="Employment Contract"
                @input="setContractDraftField('contractTitle', $event.target.value)"
              >
            </label>

            <label class="business-contract-signing__field business-job-post__field">
              <span>Employment Type</span>
              <input
                :value="contractDraft.employmentType"
                type="text"
                :disabled="!canEditContracts || isBusinessContractSaving"
                placeholder="Full-time"
                @input="setContractDraftField('employmentType', $event.target.value)"
              >
            </label>

            <label class="business-contract-signing__field business-job-post__field">
              <span>Salary Offer</span>
              <input
                :value="contractDraft.salaryOffer"
                type="text"
                :disabled="!canEditContracts || isBusinessContractSaving"
                placeholder="PHP 25,000 monthly"
                @input="setContractDraftField('salaryOffer', $event.target.value)"
              >
            </label>

            <label class="business-contract-signing__field business-job-post__field">
              <span>Start Date</span>
              <input
                :value="contractDraft.startDate"
                type="date"
                :disabled="!canEditContracts || isBusinessContractSaving"
                @input="setContractDraftField('startDate', $event.target.value)"
              >
            </label>
          </div>

          <label class="business-contract-signing__field business-contract-signing__field--wide business-job-post__field">
            <span>Notes</span>
            <textarea
              :value="contractDraft.notes"
              rows="3"
              :disabled="!canEditContracts || isBusinessContractSaving"
              placeholder="Add onboarding reminders or signing instructions."
              @input="setContractDraftField('notes', $event.target.value)"
            />
          </label>

          <label class="business-contract-signing__field business-contract-signing__field--wide business-job-post__field">
            <span>Contract Body</span>
            <textarea
              :value="contractDraft.contractBody"
              rows="8"
              :disabled="!canEditContracts || isBusinessContractSaving"
              placeholder="Write the contract clauses for the applicant."
              @input="setContractDraftField('contractBody', $event.target.value)"
            />
          </label>

          <div class="business-contract-signing__actions business-job-post__actions">
            <button
              type="button"
              class="business-contract-signing__button business-contract-signing__button--secondary business-job-post__secondary"
              :disabled="!canEditContracts || isBusinessContractSaving"
              @click="restoreContractDraft"
            >
              Reset From Offer
            </button>
            <button
              type="button"
              class="business-contract-signing__button business-contract-signing__button--primary business-job-post__save"
              :disabled="!canEditContracts || !currentRow.canSend || isBusinessContractSaving"
              @click="saveAndSendBusinessContract"
            >
              {{ isBusinessContractSaving ? 'Saving...' : currentRow.contractId ? 'Update & Resend Contract' : 'Send Contract' }}
            </button>
          </div>

          <div class="business-contract-signing__timeline">
            <div class="business-contract-signing__timeline-item">
              <span>Contract sent</span>
              <strong>{{ currentRow.sentAt ? formatDateLabel(currentRow.sentAt, { hour: 'numeric', minute: '2-digit' }) : 'Pending' }}</strong>
            </div>
            <div class="business-contract-signing__timeline-item">
              <span>Applicant signed</span>
              <strong>{{ currentRow.applicantSignedAt ? formatDateLabel(currentRow.applicantSignedAt, { hour: 'numeric', minute: '2-digit' }) : 'Pending' }}</strong>
            </div>
            <div class="business-contract-signing__timeline-item">
              <span>Business countersigned</span>
              <strong>{{ currentRow.businessSignedAt ? formatDateLabel(currentRow.businessSignedAt, { hour: 'numeric', minute: '2-digit' }) : 'Pending' }}</strong>
            </div>
          </div>

          <div
            v-if="currentRecord?.applicantSignatureDataUrl || currentRecord?.businessSignatureDataUrl"
            class="business-contract-signing__signature-grid"
          >
            <div
              v-if="currentRecord?.applicantSignatureDataUrl"
              class="business-contract-signing__signature-preview"
            >
              <span>Applicant Signature</span>
              <img
                :src="currentRecord.applicantSignatureDataUrl"
                :alt="`${currentRow.name} signature`"
              >
            </div>

            <div
              v-if="currentRecord?.businessSignatureDataUrl"
              class="business-contract-signing__signature-preview"
            >
              <span>Business Signature</span>
              <img
                :src="currentRecord.businessSignatureDataUrl"
                :alt="`${businessContractSignatureName || 'Business'} signature`"
              >
            </div>
          </div>

          <DigitalSignaturePad
            v-if="currentRow.canBusinessSign || currentRow.status === 'completed'"
            title="Business Countersign"
            description="Add the business signature after the applicant has signed the returned contract."
            :signer-name="businessContractSignatureName"
            signer-name-label="Business signer"
            :show-consent="false"
            submit-label="Complete Contract"
            :disabled="!canEditContracts || !currentRow.canBusinessSign"
            :is-submitting="isActiveSigning(currentRecord?.id)"
            @update:signer-name="setBusinessContractSignatureName($event)"
            @submit="completeBusinessContractSigning"
          />
        </template>

        <div v-else class="business-contract-signing__empty business-contract-signing__empty--detail">
          <i class="bi bi-pen" aria-hidden="true" />
          <h3>Select an applicant</h3>
          <p>
            Pumili ng applicant sa table para ma-prepare ang contract, ma-resend ito, o ma-complete ang countersign.
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.business-contract-signing {
  display: grid;
  gap: 1.5rem;
}

.business-contract-signing__hero,
.business-contract-signing__panel,
.business-contract-signing__summary-card {
  border: 1px solid rgba(214, 227, 219, 0.92);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(249, 252, 250, 0.97) 100%);
  box-shadow: 0 14px 26px rgba(71, 112, 90, 0.08);
}

.business-contract-signing__hero {
  display: grid;
  gap: 1.2rem;
  padding: 1.35rem;
}

.business-contract-signing__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.business-contract-signing__eyebrow,
.business-contract-signing__panel-label,
.business-contract-signing__field span,
.business-contract-signing__meta-grid span,
.business-contract-signing__timeline-item span,
.business-contract-signing__signature-preview span {
  color: #5d7467;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-contract-signing__hero-copy h2,
.business-contract-signing__hero-copy p,
.business-contract-signing__panel-head h3,
.business-contract-signing__panel-head p,
.business-contract-signing__summary-card p,
.business-contract-signing__empty h3,
.business-contract-signing__empty p {
  margin: 0;
}

.business-contract-signing__hero-copy {
  display: grid;
  gap: 0.55rem;
}

.business-contract-signing__hero-copy h2 {
  color: #183126;
  font-size: 1.8rem;
  font-weight: 800;
}

.business-contract-signing__hero-copy p,
.business-contract-signing__panel-head p,
.business-contract-signing__summary-card p,
.business-contract-signing__empty p,
.business-contract-signing__table small,
.business-contract-signing__meta-grid strong,
.business-contract-signing__timeline-item strong {
  color: #60786a;
  line-height: 1.55;
}

.business-contract-signing__summary-grid,
.business-contract-signing__meta-grid,
.business-contract-signing__form-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}

.business-contract-signing__summary-card {
  padding: 1rem 1.1rem;
}

.business-contract-signing__summary-card span {
  display: block;
  color: #6b8576;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.business-contract-signing__summary-card strong {
  display: block;
  margin-top: 0.45rem;
  color: #183126;
  font-size: 1.6rem;
}

.business-contract-signing__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.business-contract-signing__filter,
.business-contract-signing__button,
.business-contract-signing__row-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 0.82rem;
  font: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.business-contract-signing__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.72rem 1rem;
  background: #edf4ef;
  color: #244534;
  font-weight: 700;
}

.business-contract-signing__filter strong {
  display: inline-flex;
  min-width: 1.8rem;
  justify-content: center;
}

.business-contract-signing__filter.is-active {
  background: linear-gradient(135deg, #198754, #2f9f6c);
  color: #fff;
  box-shadow: 0 14px 24px rgba(25, 135, 84, 0.2);
}

.business-contract-signing__layout {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
}

.business-contract-signing__panel {
  padding: 1.1rem;
}

.business-contract-signing__panel--editor {
  display: grid;
  align-content: start;
  gap: 1rem;
}

.business-contract-signing__panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.business-contract-signing__panel-head h3 {
  color: #183126;
  font-size: 1.15rem;
}

.business-contract-signing__count {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.business-contract-signing__table-shell {
  overflow: auto;
  border: 1px solid rgba(223, 232, 226, 0.95);
  border-radius: 1rem;
  background: #ffffff;
}

.business-contract-signing__table {
  width: 100%;
  border-collapse: collapse;
}

.business-contract-signing__table th,
.business-contract-signing__table td {
  padding: 0.9rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(224, 231, 226, 0.95);
  vertical-align: top;
}

.business-contract-signing__table th {
  color: #658072;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.business-contract-signing__row {
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.business-contract-signing__row:hover,
.business-contract-signing__row.is-selected {
  background: rgba(236, 247, 240, 0.9);
}

.business-contract-signing__identity {
  display: flex;
  gap: 0.7rem;
  align-items: center;
}

.business-contract-signing__identity strong,
.business-contract-signing__table strong,
.business-contract-signing__meta-grid strong,
.business-contract-signing__timeline-item strong {
  display: block;
  color: #183126;
}

.business-contract-signing__avatar {
  width: 2.45rem;
  height: 2.45rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #dff3e6, #ecf8f1);
  color: #1c6d43;
  font-weight: 800;
}

.business-contract-signing__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-contract-signing__status.is-success {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.business-contract-signing__status.is-info {
  background: rgba(14, 165, 233, 0.12);
  color: #075985;
}

.business-contract-signing__status.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.business-contract-signing__status.is-muted {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.business-contract-signing__row-button,
.business-contract-signing__button {
  padding: 0.72rem 1rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.business-contract-signing__row-button,
.business-contract-signing__button--secondary {
  border-color: #d7dfd9;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
}

.business-contract-signing__button--primary {
  border-color: #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.business-contract-signing__button:disabled,
.business-contract-signing__row-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.business-contract-signing__field {
  display: grid;
  gap: 0.45rem;
}

.business-contract-signing__field--wide {
  grid-column: 1 / -1;
}

.business-contract-signing__field input,
.business-contract-signing__field textarea {
  width: 100%;
  border: 1px solid rgba(203, 213, 208, 0.96);
  border-radius: 0;
  padding: 0.82rem 0.95rem;
  background: #ffffff;
  color: #183126;
  font: inherit;
}

.business-contract-signing__field textarea {
  resize: vertical;
}

.business-contract-signing__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.business-contract-signing__actions--table {
  align-items: center;
}

.business-contract-signing__state-note {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  padding: 0.7rem 1rem;
  border-radius: 0.82rem;
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
  font-size: 0.8rem;
  font-weight: 700;
}

.business-contract-signing__timeline {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.business-contract-signing__timeline-item {
  padding: 0.9rem 1rem;
  border-radius: 0.95rem;
  background: #ffffff;
  border: 1px solid rgba(223, 232, 226, 0.95);
}

.business-contract-signing__signature-preview {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(223, 232, 226, 0.95);
  background: #ffffff;
}

.business-contract-signing__signature-preview img {
  max-width: 16rem;
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid rgba(212, 221, 215, 0.95);
  background: #fff;
}

.business-contract-signing__signature-grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.business-contract-signing__empty {
  display: grid;
  place-items: center;
  gap: 0.55rem;
  min-height: 18rem;
  text-align: center;
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px dashed rgba(192, 205, 197, 0.95);
  background: #fbfdfb;
}

.business-contract-signing__empty i {
  color: #198754;
  font-size: 1.8rem;
}

.business-contract-signing__empty-cell {
  padding: 0 !important;
  border-bottom: 0 !important;
}

.business-contract-signing__empty--table {
  min-height: auto;
  border: 0;
  border-radius: 0;
}

@media (max-width: 1180px) {
  .business-contract-signing__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .business-contract-signing__hero,
  .business-contract-signing__panel {
    padding: 1rem;
  }

  .business-contract-signing__toolbar,
  .business-contract-signing__panel-head {
    flex-direction: column;
  }

  .business-contract-signing__filters,
  .business-contract-signing__actions {
    flex-direction: column;
  }

  .business-contract-signing__filter,
  .business-contract-signing__button,
  .business-contract-signing__row-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
