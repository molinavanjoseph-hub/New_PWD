<script setup>
import { computed } from 'vue'
import DigitalSignaturePad from '@/components/DigitalSignaturePad.vue'

const props = defineProps({
  contracts: {
    type: Array,
    default: () => [],
  },
  activeContractId: {
    type: String,
    default: '',
  },
  applicantSignatureName: {
    type: String,
    default: '',
  },
  applicantConsentChecked: {
    type: Boolean,
    default: false,
  },
  activeSubmittingContractId: {
    type: String,
    default: '',
  },
  activeProviderContractId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'select-contract',
  'update:applicant-signature-name',
  'update:applicant-consent-checked',
  'sign-contract',
  'open-provider-sign',
  'refresh-provider-status',
])

const normalizeContractStatus = (value) => String(value || '').trim().toLowerCase()
const getContractCompanyLabel = (record = {}) =>
  String(record?.companyName || 'Business Workspace').trim() || 'Business Workspace'
const getContractRoleLabel = (record = {}) =>
  String(record?.jobTitle || 'Applied Role').trim() || 'Applied Role'
const getContractHeadline = (record = {}) =>
  String(record?.contractTitle || getContractRoleLabel(record) || 'Employment Contract').trim() || 'Employment Contract'
const getContractStatusLabel = (record = {}) =>
  String(record?.statusLabel || 'Pending').trim() || 'Pending'
const getContractActivityLabel = (record = {}) =>
  String(record?.sentAtLabel || record?.startDate || '').trim() || 'Recently'
const getContractLogoUrl = (record = {}) =>
  String(
    record?.logoUrl
      || record?.companyLogoUrl
      || record?.profileImageUrl
      || record?.businessAvatar
      || record?.business_avatar
      || '',
  ).trim()
const getContractCompanyInitials = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('') || 'CT'

const getContractToneClass = (record = {}) => {
  const tone = String(record?.statusTone || '').trim().toLowerCase()
  if (tone === 'success') return 'is-success'
  if (tone === 'danger') return 'is-danger'
  if (tone === 'warning') return 'is-warning'
  if (['info', 'accent'].includes(tone)) return 'is-info'

  const status = normalizeContractStatus(record?.status)
  if (status === 'completed') return 'is-success'
  if (status === 'applicant_signed') return 'is-info'
  if (status === 'sent') return 'is-warning'
  if (status === 'cancelled') return 'is-danger'
  return 'muted'
}

const getContractDescriptor = (record = {}) => {
  const employmentType = String(record?.employmentType || '').trim()
  const roleLabel = getContractRoleLabel(record)

  if (employmentType && roleLabel) return `${employmentType} for ${roleLabel}`
  return employmentType || roleLabel || 'Contract details available'
}

const getContractPreview = (record = {}) => {
  const status = normalizeContractStatus(record?.status)
  const companyLabel = getContractCompanyLabel(record)
  const roleLabel = getContractRoleLabel(record)

  if (status === 'completed') {
    return `This contract for ${roleLabel} is fully signed by you and ${companyLabel}.`
  }

  if (status === 'applicant_signed') {
    return `Your signature was returned to ${companyLabel}. Waiting for the business countersign.`
  }

  if (status === 'sent') {
    return `Review the ${roleLabel} offer, check the agreement, and sign when ready.`
  }

  if (status === 'cancelled') {
    return `This contract thread was closed by ${companyLabel}.`
  }

  return `Review the contract shared by ${companyLabel} for ${roleLabel}.`
}

const activeContract = computed(() =>
  props.contracts.find((record) => String(record?.id || '').trim() === String(props.activeContractId || '').trim())
  || props.contracts[0]
  || null,
)

const canApplicantSign = computed(() => normalizeContractStatus(activeContract.value?.status) === 'sent')
const activeSubmitState = computed(() =>
  String(props.activeSubmittingContractId || '').trim()
  && String(activeContract.value?.id || '').trim() === String(props.activeSubmittingContractId || '').trim(),
)
const activeProviderState = computed(() =>
  String(props.activeProviderContractId || '').trim()
  && String(activeContract.value?.id || '').trim() === String(props.activeProviderContractId || '').trim(),
)

const contractStats = computed(() => {
  const records = Array.isArray(props.contracts) ? props.contracts : []

  return [
    {
      id: 'total',
      label: 'Total',
      value: records.length,
    },
    {
      id: 'waiting',
      label: 'Need Signature',
      value: records.filter((item) => normalizeContractStatus(item?.status) === 'sent').length,
    },
    {
      id: 'returned',
      label: 'Sent Back',
      value: records.filter((item) => normalizeContractStatus(item?.status) === 'applicant_signed').length,
    },
    {
      id: 'completed',
      label: 'Completed',
      value: records.filter((item) => normalizeContractStatus(item?.status) === 'completed').length,
    },
  ]
})

const contractProgressToneClass = computed(() => {
  const status = normalizeContractStatus(activeContract.value?.status)
  if (status === 'completed') return 'is-success'
  if (status === 'cancelled') return 'is-danger'
  if (status === 'applicant_signed') return 'is-info'
  if (status === 'sent') return 'is-warning'
  return ''
})

const contractProgressTitle = computed(() => {
  const status = normalizeContractStatus(activeContract.value?.status)
  if (status === 'completed') return 'Contract completed'
  if (status === 'cancelled') return 'Contract closed'
  if (status === 'applicant_signed') return 'Waiting for business countersign'
  if (status === 'sent') return 'Ready for your signature'
  return 'Contract in progress'
})

const contractProgressMessage = computed(() => {
  const status = normalizeContractStatus(activeContract.value?.status)

  if (status === 'completed') {
    return 'Both you and the business owner completed the signing flow for this contract.'
  }

  if (status === 'cancelled') {
    return 'This contract is not active anymore.'
  }

  if (status === 'applicant_signed') {
    return 'Your signature was already submitted. The business can now countersign the agreement.'
  }

  if (status === 'sent') {
    return 'Review the agreement carefully, confirm your consent, and sign the contract when you are ready.'
  }

  return 'This contract is still being prepared by the business workspace.'
})

const emptyStateHighlights = [
  {
    id: 'wait',
    icon: 'bi bi-envelope-paper',
    label: 'Wait for a contract',
    copy: 'A contract appears here after the business approves your application and sends the agreement.',
  },
  {
    id: 'review',
    icon: 'bi bi-file-earmark-text',
    label: 'Review the details',
    copy: 'Check the job title, salary offer, start date, and employment type before signing.',
  },
  {
    id: 'sign',
    icon: 'bi bi-pencil-square',
    label: 'Sign digitally',
    copy: 'Draw your signature electronically, confirm consent, and send the contract back to the business.',
  },
]

const selectContract = (contractId) => {
  emit('select-contract', contractId)
}

const submitSignature = (payload = {}) => {
  if (!activeContract.value) return

  emit('sign-contract', {
    contractId: activeContract.value.id,
    signatureDataUrl: payload.signatureDataUrl,
  })
}
</script>

<template>
  <section class="applicant-contracts-page">
    <section v-if="contracts.length" class="applicant-contracts-page__hero">
      <div class="applicant-contracts-page__hero-copy">
        <p class="applicant-contracts-page__eyebrow">Contract Signing</p>
        <h1>My Contracts</h1>
        <p class="applicant-contracts-page__intro">
          Review each agreement, confirm the offer details, and complete your digital signature when the contract is ready.
        </p>
      </div>

      <div class="applicant-contracts-page__hero-side">
        <div class="applicant-contracts-page__stats">
          <article v-for="item in contractStats" :key="item.id">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </div>
    </section>

    <div v-if="contracts.length" class="applicant-contracts-page__shell">
      <aside class="applicant-contracts-page__list-pane">
        <div class="applicant-contracts-page__filters">
          <span>Contract Threads</span>
          <small>Select a contract to review the agreement and signing steps.</small>
        </div>

        <div class="applicant-contracts-page__threads">
          <button
            v-for="contract in contracts"
            :key="contract.id"
            type="button"
            class="applicant-contracts-page__thread"
            :class="{ 'is-active': activeContract?.id === contract.id }"
            @click="selectContract(contract.id)"
          >
            <span class="applicant-contracts-page__avatar" aria-hidden="true">
              <img
                v-if="getContractLogoUrl(contract)"
                :src="getContractLogoUrl(contract)"
                alt=""
                class="applicant-contracts-page__avatar-image"
              />
              <template v-else>{{ getContractCompanyInitials(contract.companyName) }}</template>
            </span>

            <span class="applicant-contracts-page__thread-copy">
              <span class="applicant-contracts-page__thread-top">
                <strong>{{ getContractCompanyLabel(contract) }}</strong>
                <small>{{ getContractActivityLabel(contract) }}</small>
              </span>

              <span class="applicant-contracts-page__thread-subject">
                {{ getContractHeadline(contract) }}
              </span>

              <span class="applicant-contracts-page__thread-preview">
                {{ getContractPreview(contract) }}
              </span>

              <span class="applicant-contracts-page__thread-tags">
                <span>{{ getContractRoleLabel(contract) }}</span>
                <span class="badge" :class="getContractToneClass(contract)">
                  {{ getContractStatusLabel(contract) }}
                </span>
              </span>
            </span>
          </button>
        </div>
      </aside>

      <section class="applicant-contracts-page__viewer">
        <article v-if="activeContract" class="applicant-contracts-page__message">
          <div class="applicant-contracts-page__badges">
            <span class="badge">Contract Notice</span>
            <span class="badge" :class="getContractToneClass(activeContract)">
              {{ getContractStatusLabel(activeContract) }}
            </span>
            <span class="badge muted">
              {{ activeContract.employmentType || 'Employment Offer' }}
            </span>
          </div>

          <header class="applicant-contracts-page__message-head">
            <h2>{{ getContractHeadline(activeContract) }}</h2>

            <div class="applicant-contracts-page__sender">
              <span class="applicant-contracts-page__avatar" aria-hidden="true">
                <img
                  v-if="getContractLogoUrl(activeContract)"
                  :src="getContractLogoUrl(activeContract)"
                  alt=""
                  class="applicant-contracts-page__avatar-image"
                />
                <template v-else>{{ getContractCompanyInitials(activeContract.companyName) }}</template>
              </span>

              <div>
                <strong>{{ getContractCompanyLabel(activeContract) }}</strong>
                <span>{{ getContractDescriptor(activeContract) }}</span>
              </div>

              <time>{{ getContractActivityLabel(activeContract) }}</time>
            </div>
          </header>

          <div class="applicant-contracts-page__body">
            <p>{{ getContractCompanyLabel(activeContract) }} sent you a contract for {{ getContractRoleLabel(activeContract) }}.</p>
            <p>{{ getContractPreview(activeContract) }}</p>
          </div>

          <div class="applicant-contracts-page__grid">
            <article>
              <span>Role</span>
              <strong>{{ getContractRoleLabel(activeContract) }}</strong>
            </article>
            <article>
              <span>Salary Offer</span>
              <strong>{{ activeContract.salaryOffer || 'Salary not set' }}</strong>
            </article>
            <article>
              <span>Start Date</span>
              <strong>{{ activeContract.startDate || 'Not set' }}</strong>
            </article>
            <article>
              <span>Employment Type</span>
              <strong>{{ activeContract.employmentType || 'Not set' }}</strong>
            </article>
            <article>
              <span>Applicant Signed</span>
              <strong>{{ activeContract.applicantSignedAtLabel || 'Pending' }}</strong>
            </article>
            <article>
              <span>Business Signed</span>
              <strong>{{ activeContract.businessSignedAtLabel || 'Pending' }}</strong>
            </article>
            <article class="wide">
              <span>Current Step</span>
              <strong>{{ contractProgressMessage }}</strong>
            </article>
          </div>

          <div class="applicant-contracts-page__box">
            <strong>Agreement</strong>
            <div class="applicant-contracts-page__document-copy">
              {{ activeContract.contractBody || 'No contract body was added yet.' }}
            </div>
          </div>

          <div v-if="activeContract.notes" class="applicant-contracts-page__box">
            <strong>Business Notes</strong>
            <span>{{ activeContract.notes }}</span>
          </div>

          <div class="applicant-contracts-page__box" :class="contractProgressToneClass">
            <strong>{{ contractProgressTitle }}</strong>
            <span>{{ contractProgressMessage }}</span>
            <span>Business sent: {{ activeContract.sentAtLabel || 'Not set' }}</span>
            <span>Applicant signed: {{ activeContract.applicantSignedAtLabel || 'Pending' }}</span>
            <span>Business countersigned: {{ activeContract.businessSignedAtLabel || 'Pending' }}</span>
          </div>

          <div v-if="canApplicantSign" class="applicant-contracts-page__signature-wrap">
            <DigitalSignaturePad
              :signer-name="applicantSignatureName"
              :consent-checked="applicantConsentChecked"
              :is-submitting="activeSubmitState"
              title="Applicant Signature"
              description="After you sign, the contract is returned to the business so they can countersign it."
              signer-name-label="Applicant Full Name"
              submit-label="Sign and Send Back"
              @update:signer-name="emit('update:applicant-signature-name', $event)"
              @update:consent-checked="emit('update:applicant-consent-checked', $event)"
              @submit="submitSignature"
            />
          </div>

          <div
            v-if="canApplicantSign || activeContract.providerEnvelopeId"
            class="applicant-contracts-page__actions"
          >
            <button
              v-if="canApplicantSign"
              type="button"
              class="primary"
              :disabled="activeProviderState"
              @click="emit('open-provider-sign', activeContract.id)"
            >
              {{ activeProviderState ? 'Opening Digital API...' : 'Open Digital API Sign' }}
            </button>

            <button
              v-if="activeContract.providerEnvelopeId"
              type="button"
              :disabled="activeProviderState"
              @click="emit('refresh-provider-status', activeContract.id)"
            >
              Refresh API Status
            </button>
          </div>
        </article>

        <div v-else class="applicant-contracts-page__empty">
          <i class="bi bi-file-earmark-check" aria-hidden="true" />
          <h2>Select a contract</h2>
          <p>Choose a contract thread from the left side to review the agreement, offer details, and signing steps.</p>
        </div>
      </section>
    </div>

    <section v-else class="applicant-contracts-page__empty-state">
      <div class="applicant-contracts-page__empty">
        <i class="bi bi-file-earmark-lock" aria-hidden="true" />
        <h2>No contracts yet</h2>
        <p>Contracts sent by businesses will appear here once your application moves into the hiring offer stage.</p>
      </div>

      <div class="applicant-contracts-page__empty-highlights">
        <article
          v-for="item in emptyStateHighlights"
          :key="item.id"
          class="applicant-contracts-page__highlight"
        >
          <span class="applicant-contracts-page__highlight-icon" aria-hidden="true">
            <i :class="item.icon" />
          </span>

          <div class="applicant-contracts-page__highlight-copy">
            <strong>{{ item.label }}</strong>
            <p>{{ item.copy }}</p>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.applicant-contracts-page {
  display: grid;
  gap: 1.25rem;
  padding: 0 1.25rem;
  width: 100%;
  min-height: min(46rem, calc(100vh - 8.75rem));
}

.applicant-contracts-page__hero,
.applicant-contracts-page__list-pane,
.applicant-contracts-page__viewer,
.applicant-contracts-page__empty-state {
  border: 1px solid rgba(66, 112, 87, 0.18);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 18px 36px rgba(31, 74, 51, 0.07);
}

.applicant-contracts-page__hero {
  display: flex;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.4rem 1.5rem;
  background:
    radial-gradient(circle at top left, rgba(214, 241, 227, 0.85), transparent 42%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 249, 0.98));
}

.applicant-contracts-page__eyebrow,
.applicant-contracts-page__intro,
.applicant-contracts-page__hero h1 {
  margin: 0;
}

.applicant-contracts-page__eyebrow {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #577564;
}

.applicant-contracts-page__hero h1 {
  color: #183927;
  font-size: clamp(1.8rem, 2vw, 2.2rem);
  line-height: 1.05;
}

.applicant-contracts-page__intro {
  color: #557061;
  font-size: 0.97rem;
  line-height: 1.65;
  max-width: 38rem;
}

.applicant-contracts-page__hero-side {
  display: grid;
  gap: 0.85rem;
  min-width: min(100%, 22rem);
}

.applicant-contracts-page__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}

.applicant-contracts-page__stats article,
.applicant-contracts-page__grid article,
.applicant-contracts-page__box {
  border: 1px solid rgba(83, 128, 98, 0.16);
  background: rgba(248, 252, 249, 0.96);
}

.applicant-contracts-page__stats article {
  display: grid;
  gap: 0.24rem;
  padding: 0.8rem 0.9rem;
}

.applicant-contracts-page__stats span,
.applicant-contracts-page__grid span {
  color: #6e887a;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-contracts-page__stats strong {
  color: #173a28;
  font-size: 1.24rem;
  line-height: 1;
}

.applicant-contracts-page__shell {
  display: grid;
  grid-template-columns: minmax(19rem, 26rem) minmax(0, 1fr);
  gap: 1.2rem;
  min-height: 0;
}

.applicant-contracts-page__list-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.applicant-contracts-page__filters {
  display: grid;
  gap: 0.18rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(83, 128, 98, 0.14);
  background: linear-gradient(180deg, rgba(247, 252, 249, 0.95), rgba(255, 255, 255, 0.95));
}

.applicant-contracts-page__filters span,
.applicant-contracts-page__filters small {
  margin: 0;
}

.applicant-contracts-page__filters span {
  color: #355745;
  font-size: 0.88rem;
  font-weight: 800;
}

.applicant-contracts-page__filters small {
  color: #6f8a7b;
  font-size: 0.78rem;
  line-height: 1.5;
}

.applicant-contracts-page__threads {
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: 0;
  overflow-y: auto;
}

.applicant-contracts-page__thread {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: flex-start;
  align-content: start;
  padding: 1rem;
  border: 0;
  border-bottom: 1px solid rgba(83, 128, 98, 0.12);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.applicant-contracts-page__thread:hover {
  background: rgba(242, 248, 245, 0.92);
}

.applicant-contracts-page__thread.is-active {
  background: linear-gradient(90deg, rgba(216, 242, 226, 0.92), rgba(255, 255, 255, 0.98));
  box-shadow: inset 4px 0 0 #2d9360;
}

.applicant-contracts-page__avatar {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  aspect-ratio: 1;
  border: 1px solid rgba(83, 128, 98, 0.18);
  border-radius: 0.9rem;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(225, 243, 233, 0.95), rgba(247, 252, 249, 0.96));
  color: #1c5138;
  font-size: 0.86rem;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.applicant-contracts-page__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.applicant-contracts-page__thread-copy,
.applicant-contracts-page__body,
.applicant-contracts-page__sender > div {
  display: grid;
  align-content: start;
  gap: 0.35rem;
  min-width: 0;
}

.applicant-contracts-page__thread-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.applicant-contracts-page__thread-top strong,
.applicant-contracts-page__thread-subject,
.applicant-contracts-page__body p,
.applicant-contracts-page__grid strong,
.applicant-contracts-page__box span,
.applicant-contracts-page__box strong,
.applicant-contracts-page__sender span,
.applicant-contracts-page__sender time,
.applicant-contracts-page__document-copy {
  overflow-wrap: anywhere;
}

.applicant-contracts-page__thread-top strong,
.applicant-contracts-page__sender strong {
  color: #193826;
  font-size: 0.95rem;
}

.applicant-contracts-page__thread-top small,
.applicant-contracts-page__sender span,
.applicant-contracts-page__sender time {
  color: #6f8a7b;
  font-size: 0.8rem;
}

.applicant-contracts-page__thread-top small {
  white-space: nowrap;
}

.applicant-contracts-page__thread-subject {
  color: #264937;
  font-size: 0.92rem;
  font-weight: 700;
}

.applicant-contracts-page__thread-preview {
  display: -webkit-box;
  color: #6b8577;
  font-size: 0.84rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.applicant-contracts-page__thread-tags,
.applicant-contracts-page__badges,
.applicant-contracts-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.applicant-contracts-page__thread-tags {
  gap: 0.55rem;
  align-items: center;
  color: #62806e;
  font-size: 0.78rem;
}

.applicant-contracts-page__thread-tags span,
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.24rem 0.5rem;
  border: 1px solid rgba(83, 128, 98, 0.16);
  border-radius: 999px;
  background: rgba(244, 250, 246, 0.92);
  color: #2a5c42;
  font-size: 0.76rem;
  font-weight: 700;
}

.badge.is-info {
  background: rgba(225, 239, 248, 0.95);
  color: #285f86;
}

.badge.is-success {
  background: rgba(221, 245, 231, 0.95);
  color: #176742;
}

.badge.is-warning {
  background: rgba(255, 245, 219, 0.96);
  color: #996d00;
}

.badge.is-danger {
  background: rgba(252, 232, 232, 0.94);
  color: #a03636;
}

.badge.muted {
  background: rgba(237, 240, 240, 0.96);
  color: #536665;
}

.applicant-contracts-page__viewer {
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.applicant-contracts-page__message,
.applicant-contracts-page__empty {
  width: 100%;
}

.applicant-contracts-page__message {
  display: grid;
  gap: 1.2rem;
  padding: 1.45rem 1.55rem 1.65rem;
  overflow-y: auto;
  background: linear-gradient(180deg, rgba(249, 253, 251, 0.98), rgba(255, 255, 255, 0.98) 22%);
}

.applicant-contracts-page__message-head {
  display: grid;
  gap: 1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid rgba(83, 128, 98, 0.16);
}

.applicant-contracts-page__message-head h2,
.applicant-contracts-page__empty h2,
.applicant-contracts-page__empty p {
  margin: 0;
}

.applicant-contracts-page__message-head h2 {
  color: #173a28;
  font-size: clamp(1.35rem, 1.8vw, 1.8rem);
  line-height: 1.2;
}

.applicant-contracts-page__sender {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: flex-start;
}

.applicant-contracts-page__body {
  gap: 0.55rem;
}

.applicant-contracts-page__body p {
  margin: 0;
  color: #4c6558;
  font-size: 0.96rem;
  line-height: 1.72;
}

.applicant-contracts-page__body p:first-child {
  color: #274737;
  font-size: 1rem;
}

.applicant-contracts-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.05rem 1.3rem;
  padding: 1.15rem 0;
  border-top: 1px solid rgba(83, 128, 98, 0.14);
  border-bottom: 1px solid rgba(83, 128, 98, 0.14);
}

.applicant-contracts-page__grid article {
  display: grid;
  gap: 0.34rem;
  min-height: 3.55rem;
  padding: 0 0 0 1rem;
  border: 0;
  border-left: 2px solid rgba(83, 128, 98, 0.18);
  background: transparent;
}

.applicant-contracts-page__grid article.wide {
  grid-column: 1 / -1;
}

.applicant-contracts-page__grid strong {
  color: #183927;
  font-size: 0.96rem;
  line-height: 1.6;
}

.applicant-contracts-page__box {
  display: grid;
  gap: 0.72rem;
  padding: 1rem 0 0 1rem;
  border: 0;
  border-top: 1px solid rgba(83, 128, 98, 0.14);
  border-left: 2px solid rgba(83, 128, 98, 0.18);
  background: transparent;
}

.applicant-contracts-page__box strong {
  color: #20312a;
  font-size: 0.9rem;
}

.applicant-contracts-page__box span,
.applicant-contracts-page__document-copy {
  color: #63756d;
  font-size: 0.84rem;
  line-height: 1.68;
}

.applicant-contracts-page__box.is-danger {
  border-left-color: rgba(239, 68, 68, 0.42);
}

.applicant-contracts-page__box.is-danger strong,
.applicant-contracts-page__box.is-danger span {
  color: #991b1b;
}

.applicant-contracts-page__box.is-success {
  border-left-color: rgba(34, 197, 94, 0.4);
}

.applicant-contracts-page__box.is-success strong,
.applicant-contracts-page__box.is-success span {
  color: #166534;
}

.applicant-contracts-page__box.is-info {
  border-left-color: rgba(37, 99, 235, 0.28);
}

.applicant-contracts-page__box.is-warning {
  border-left-color: rgba(217, 119, 6, 0.32);
}

.applicant-contracts-page__document-copy {
  white-space: pre-line;
}

.applicant-contracts-page__signature-wrap {
  padding-top: 0.1rem;
}

.applicant-contracts-page__signature-wrap :deep(.digital-signature-pad) {
  border: 1px solid rgba(83, 128, 98, 0.16);
  border-radius: 1.05rem;
  background: rgba(248, 252, 249, 0.96);
  box-shadow: none;
}

.applicant-contracts-page__signature-wrap :deep(.digital-signature-pad__submit) {
  border: 1px solid #2f6a49;
  background: #2f6a49;
  color: #ffffff;
}

.applicant-contracts-page__actions button {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.62rem 0.8rem;
  border: 1px solid rgba(83, 128, 98, 0.18);
  border-radius: 0.9rem;
  background: #fff;
  color: #355745;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.applicant-contracts-page__actions button:hover {
  transform: translateY(-1px);
}

.applicant-contracts-page__actions button.primary {
  background: #2f6a49;
  border-color: #2f6a49;
  color: #fff;
}

.applicant-contracts-page__actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.applicant-contracts-page__empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.8rem;
  padding: 2rem;
  text-align: center;
  color: #5f7a6b;
}

.applicant-contracts-page__empty i {
  font-size: 2rem;
  color: #4a7b5f;
}

.applicant-contracts-page__empty-state {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
  gap: 1rem;
  padding: 1.2rem;
  align-items: stretch;
}

.applicant-contracts-page__empty-highlights {
  display: grid;
  gap: 0.8rem;
  align-content: center;
}

.applicant-contracts-page__highlight {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
  padding: 1rem;
  border: 1px solid rgba(83, 128, 98, 0.14);
  background: rgba(248, 252, 249, 0.96);
}

.applicant-contracts-page__highlight-icon {
  display: inline-grid;
  place-items: center;
  width: 2.45rem;
  height: 2.45rem;
  border-radius: 0.9rem;
  background: rgba(29, 107, 58, 0.1);
  color: #1d6b3a;
}

.applicant-contracts-page__highlight-copy {
  display: grid;
  gap: 0.3rem;
}

.applicant-contracts-page__highlight-copy strong,
.applicant-contracts-page__highlight-copy p {
  margin: 0;
}

.applicant-contracts-page__highlight-copy strong {
  color: #173a28;
  font-size: 0.92rem;
}

.applicant-contracts-page__highlight-copy p {
  color: #5f7a6b;
  font-size: 0.84rem;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .applicant-contracts-page {
    min-height: auto;
  }

  .applicant-contracts-page__hero,
  .applicant-contracts-page__shell,
  .applicant-contracts-page__empty-state {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .applicant-contracts-page__hero-side {
    width: 100%;
    min-width: 0;
  }

  .applicant-contracts-page__list-pane {
    max-height: 28rem;
  }

  .applicant-contracts-page__viewer {
    min-height: 30rem;
  }
}

@media (max-width: 720px) {
  .applicant-contracts-page {
    padding: 0 0.85rem;
  }

  .applicant-contracts-page__hero,
  .applicant-contracts-page__message,
  .applicant-contracts-page__empty-state {
    padding-inline: 1rem;
  }

  .applicant-contracts-page__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .applicant-contracts-page__sender,
  .applicant-contracts-page__grid {
    grid-template-columns: 1fr;
  }

  .applicant-contracts-page__grid article.wide {
    grid-column: auto;
  }

  .applicant-contracts-page__actions {
    flex-direction: column;
  }

  .applicant-contracts-page__actions button {
    width: 100%;
    justify-content: center;
  }

  .applicant-contracts-page__thread-top {
    flex-direction: column;
  }

  .applicant-contracts-page__thread-top small {
    white-space: normal;
  }
}
</style>
