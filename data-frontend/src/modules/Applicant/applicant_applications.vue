<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  applicationRecords: {
    type: Array,
    default: () => [],
  },
  applicationStats: {
    type: Object,
    default: () => ({
      applied: 0,
      pending: 0,
      interview: 0,
      accepted: 0,
      rejected: 0,
    }),
  },
  selectedApplicationIds: {
    type: Array,
    default: () => [],
  },
  isDeletingApplications: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:selected-application-ids', 'delete-selected-applications'])

const applicationOutcomeLabel = computed(
  () => `${props.applicationStats.accepted || 0} approved / ${props.applicationStats.rejected || 0} rejected`,
)
const applicationHeroStats = computed(() => [
  {
    id: 'applied',
    label: 'Applied',
    value: props.applicationStats.applied || 0,
    tone: 'neutral',
    icon: 'bi bi-send-check',
  },
  {
    id: 'pending',
    label: 'Pending',
    value: props.applicationStats.pending || 0,
    tone: 'warning',
    icon: 'bi bi-hourglass-split',
  },
  {
    id: 'interview',
    label: 'Interview',
    value: props.applicationStats.interview || 0,
    tone: 'info',
    icon: 'bi bi-camera-video',
  },
  {
    id: 'accepted',
    label: 'Approved',
    value: props.applicationStats.accepted || 0,
    tone: 'success',
    icon: 'bi bi-patch-check',
  },
])
const preparedApplicationRecords = computed(() =>
  props.applicationRecords.map((record) => {
    const timelineItems = Array.isArray(record?.timelineItems) ? record.timelineItems : []
    let hasPreviousOpenStep = false

    const preparedTimelineItems = timelineItems.map((step, index) => {
      const tone = getTimelineStepTone(step)
      let state = 'active'

      if (tone === 'success') {
        state = 'complete'
      } else if (tone === 'danger' || tone === 'muted') {
        state = 'failed'
      } else if (hasPreviousOpenStep) {
        state = 'pending'
      }

      if (tone !== 'success') {
        hasPreviousOpenStep = true
      }

      const lineStateClass = state === 'active'
        ? 'partial'
        : state === 'pending'
          ? 'empty'
          : 'filled'

      return {
        ...step,
        visualIcon: timelineVisualIcon(step),
        itemClass: `applicant-applications-page__timeline-item--${state}`,
        dotClass: [
          `applicant-applications-page__timeline-dot--${tone}`,
          `applicant-applications-page__timeline-dot--${state}`,
        ],
        badgeClass: [
          `applicant-applications-page__timeline-badge--${tone}`,
          `applicant-applications-page__timeline-badge--${state}`,
        ],
        badgeIcon:
          state === 'complete'
            ? 'bi bi-check-lg'
            : state === 'failed'
              ? 'bi bi-x-lg'
              : '',
        lineClass:
          index === timelineItems.length - 1
            ? []
            : [
                `applicant-applications-page__timeline-line--${tone}`,
                `applicant-applications-page__timeline-line--${lineStateClass}`,
              ],
      }
    })

    return {
      ...record,
      companyInitial: getApplicationCompanyInitial(record?.company),
      timelineItems: preparedTimelineItems,
    }
  }),
)
const hasApplicationRecords = computed(() => preparedApplicationRecords.value.length > 0)
const visibleApplicationIds = computed(() =>
  preparedApplicationRecords.value.map((record) => String(record?.id || '').trim()).filter(Boolean),
)
const selectedApplicationIdSet = computed(() =>
  new Set(
    (Array.isArray(props.selectedApplicationIds) ? props.selectedApplicationIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  ),
)
const selectedVisibleApplicationIds = computed(() =>
  visibleApplicationIds.value.filter((applicationId) => selectedApplicationIdSet.value.has(applicationId)),
)
const selectedApplicationCount = computed(() => selectedVisibleApplicationIds.value.length)
const allApplicationsSelected = computed(
  () => visibleApplicationIds.value.length > 0 && selectedApplicationCount.value === visibleApplicationIds.value.length,
)
const isSelectionMode = ref(false)
const showDeleteConfirmModal = ref(false)
const pendingDeleteApplicationIds = ref([])
const deleteSelectedButtonLabel = computed(() => {
  if (props.isDeletingApplications) return 'Deleting...'
  if (!selectedApplicationCount.value) return 'Delete Selected'
  return `Delete Selected (${selectedApplicationCount.value})`
})
const pendingDeleteApplicationCount = computed(() => pendingDeleteApplicationIds.value.length)
const pendingDeleteApplicationLabel = computed(() =>
  pendingDeleteApplicationCount.value === 1 ? 'application' : 'applications',
)
const getTimelineStepTone = (step) => {
  const tone = String(step?.tone || 'warning').trim().toLowerCase()
  if (['success', 'danger', 'info', 'muted'].includes(tone)) return tone
  return 'warning'
}

const timelineVisualIcon = (step) => {
  const timelineId = String(step?.id || '').trim().toLowerCase()

  if (timelineId.startsWith('application-sent')) return 'bi bi-send'
  if (timelineId.startsWith('technical-assessment')) return 'bi bi-clipboard2-pulse'
  if (timelineId.startsWith('interview')) return 'bi bi-camera-video'
  if (timelineId.startsWith('job-offer')) return 'bi bi-briefcase'
  if (timelineId.startsWith('contract-signing')) return 'bi bi-file-earmark-check'
  if (timelineId.startsWith('training')) return 'bi bi-mortarboard'
  return 'bi bi-circle'
}

const getApplicationCompanyInitial = (value) =>
  String(value || 'C')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'

const emitSelectedApplicationIds = (applicationIds = []) => {
  emit(
    'update:selected-application-ids',
    [...new Set((Array.isArray(applicationIds) ? applicationIds : [])
      .map((value) => String(value || '').trim())
      .filter((value) => visibleApplicationIds.value.includes(value)))],
  )
}

const isApplicationSelected = (applicationId) =>
  selectedApplicationIdSet.value.has(String(applicationId || '').trim())

const enterSelectionMode = () => {
  if (props.isDeletingApplications || !visibleApplicationIds.value.length) return
  isSelectionMode.value = true
}

const exitSelectionMode = () => {
  if (props.isDeletingApplications) return
  closeDeleteConfirmModal()
  isSelectionMode.value = false
  emitSelectedApplicationIds([])
}

const toggleApplicationSelection = (applicationId) => {
  if (props.isDeletingApplications) return

  const normalizedApplicationId = String(applicationId || '').trim()
  if (!normalizedApplicationId) return

  isSelectionMode.value = true

  const nextSelectedIds = new Set(selectedVisibleApplicationIds.value)
  if (nextSelectedIds.has(normalizedApplicationId)) {
    nextSelectedIds.delete(normalizedApplicationId)
  } else {
    nextSelectedIds.add(normalizedApplicationId)
  }

  emitSelectedApplicationIds([...nextSelectedIds])
}

const toggleAllApplicationsSelection = () => {
  if (props.isDeletingApplications) return

  emitSelectedApplicationIds(allApplicationsSelected.value ? [] : visibleApplicationIds.value)
}

const requestDeleteSelectedApplications = () => {
  if (props.isDeletingApplications || !selectedVisibleApplicationIds.value.length) return
  pendingDeleteApplicationIds.value = [...selectedVisibleApplicationIds.value]
  showDeleteConfirmModal.value = true
}

const closeDeleteConfirmModal = () => {
  if (props.isDeletingApplications) return
  showDeleteConfirmModal.value = false
  pendingDeleteApplicationIds.value = []
}

const confirmDeleteSelectedApplications = () => {
  if (props.isDeletingApplications || !pendingDeleteApplicationIds.value.length) return

  const applicationIds = [...pendingDeleteApplicationIds.value]
  showDeleteConfirmModal.value = false
  pendingDeleteApplicationIds.value = []
  emit('delete-selected-applications', applicationIds)
}

watch(selectedApplicationCount, (count) => {
  if (count > 0) isSelectionMode.value = true
})

watch(visibleApplicationIds, (applicationIds) => {
  if (!applicationIds.length) {
    pendingDeleteApplicationIds.value = []
    showDeleteConfirmModal.value = false
    isSelectionMode.value = false
  }
})

watch(
  () => props.isDeletingApplications,
  (isDeleting, wasDeleting) => {
    if (wasDeleting && !isDeleting && !selectedApplicationCount.value) {
      isSelectionMode.value = false
    }
  },
)

watch(selectedApplicationCount, (count) => {
  if (!count && !props.isDeletingApplications) {
    pendingDeleteApplicationIds.value = []
    showDeleteConfirmModal.value = false
  }
})
</script>

<template>
  <section class="applicant-applications-page">

    <article class="applicant-applications-page__panel">
        <section class="applicant-applications-page__hero">
          <div class="applicant-applications-page__hero-copy">
            <p class="applicant-applications-page__eyebrow">My Applications</p>
            <h2>Track every job application in one clean workspace</h2>
            <p>Review submitted jobs, watch hiring progress, and stay ready for interview or assessment updates without touching your status line flow.</p>
          </div>

          <div class="applicant-applications-page__hero-side">
            <div class="applicant-applications-page__hero-stats" aria-label="Application overview">
              <article
                v-for="item in applicationHeroStats"
                :key="item.id"
                class="applicant-applications-page__hero-stat"
                :class="`applicant-applications-page__hero-stat--${item.tone}`"
              >
                <span><i :class="item.icon" aria-hidden="true" /> {{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </article>
            </div>
          </div>
        </section>

        <div class="applicant-panel__head applicant-panel__head--applications">
          <div>
            <h3>Application Records</h3>
            <span>Live status from your submitted jobs</span>
          </div>
          <div class="applicant-applications-page__head-actions">
            <button
              v-if="hasApplicationRecords && !isSelectionMode"
              type="button"
              class="applicant-applications-page__select-button"
              :disabled="isDeletingApplications"
              @click="enterSelectionMode"
            >
              <i class="bi bi-check2-square" aria-hidden="true" />
              Select
            </button>

            <div v-else-if="hasApplicationRecords" class="applicant-applications-page__bulk-actions">
              <label class="applicant-applications-page__bulk-toggle">
                <input
                  type="checkbox"
                  :checked="allApplicationsSelected"
                  :disabled="isDeletingApplications"
                  :aria-label="allApplicationsSelected ? 'Deselect all applications' : 'Select all applications'"
                  @change="toggleAllApplicationsSelection"
                >
                <span>{{ allApplicationsSelected ? 'Deselect all' : 'Select all' }}</span>
              </label>

              <span class="applicant-applications-page__selection-count">
                {{ selectedApplicationCount }} selected
              </span>

              <button
                type="button"
                class="applicant-applications-page__delete-button"
                :disabled="!selectedApplicationCount || isDeletingApplications"
                @click="requestDeleteSelectedApplications"
              >
                <i class="bi bi-trash3" aria-hidden="true" />
                {{ deleteSelectedButtonLabel }}
              </button>

              <button
                type="button"
                class="applicant-applications-page__secondary-button"
                :disabled="isDeletingApplications"
                @click="exitSelectionMode"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div v-if="hasApplicationRecords" class="applicant-applications-page__list">
          <article
            v-for="record in preparedApplicationRecords"
            :key="record.id"
            class="applicant-applications-page__card"
            :class="{ 'applicant-applications-page__card--inactive': record.isDiscontinued }"
          >
            <!-- Card accent bar -->
            <div class="applicant-applications-page__card-accent" aria-hidden="true" />

            <!-- Header with company initial + job title + status -->
            <div class="applicant-applications-page__card-header">
              <div class="applicant-applications-page__card-brand">
                <div class="applicant-applications-page__card-avatar" aria-hidden="true">
                  <img
                    v-if="record.logoUrl"
                    :src="record.logoUrl"
                    alt=""
                    class="applicant-applications-page__card-avatar-image"
                  >
                  <template v-else>{{ record.companyInitial }}</template>
                </div>
                <div class="applicant-applications-page__card-identity">
                  <h4>{{ record.title }}</h4>
                  <p class="applicant-applications-page__card-company">
                    <i class="bi bi-building" />
                    {{ record.company }}
                  </p>
                  <div class="applicant-applications-page__card-caption">
                    <span><i class="bi bi-calendar-check" /> Applied {{ record.submittedAtLabel }}</span>
                    <span><i class="bi bi-clock-history" /> Updated {{ record.lastUpdatedLabel }}</span>
                  </div>
                </div>
              </div>

              <div class="applicant-applications-page__card-actions">
                <label v-if="isSelectionMode" class="applicant-applications-page__card-checkbox">
                  <input
                    type="checkbox"
                    :checked="isApplicationSelected(record.id)"
                    :disabled="isDeletingApplications"
                    :aria-label="isApplicationSelected(record.id) ? `Deselect ${record.title}` : `Select ${record.title}`"
                    @change="toggleApplicationSelection(record.id)"
                  >
                  <span>Select</span>
                </label>
                <span class="applicant-status-pill" :class="`applicant-status-pill--${record.statusTone}`">
                  <i
                    class="applicant-status-pill__icon"
                    :class="{
                      'bi bi-hourglass-split': record.statusTone === 'pending',
                      'bi bi-check-circle-fill': record.statusTone === 'success',
                      'bi bi-x-circle-fill': record.statusTone === 'danger',
                      'bi bi-camera-video-fill': record.statusTone === 'info',
                    }"
                    aria-hidden="true"
                  />
                  {{ record.statusLabel }}
                </span>
              </div>
            </div>

            <!-- Meta pills in a styled bar -->
            <div class="applicant-applications-page__meta-bar">
              <div class="applicant-applications-page__meta">
                <span class="applicant-applications-page__pill applicant-applications-page__pill--location">
                  <i class="bi bi-geo-alt-fill" />
                  {{ record.location }}
                </span>
                <span class="applicant-applications-page__pill applicant-applications-page__pill--type">
                  <i class="bi bi-briefcase-fill" />
                  {{ record.jobType }}
                </span>
                <span class="applicant-applications-page__pill applicant-applications-page__pill--salary">
                  <i class="bi bi-cash-coin" />
                  {{ record.salaryLabel }}
                </span>
                <span class="applicant-applications-page__pill applicant-applications-page__pill--pwd">
                  <i class="bi bi-universal-access-circle" />
                  {{ record.disabilityLabel }}
                </span>
              </div>
              <div class="applicant-applications-page__meta-secondary">
                <span class="applicant-applications-page__meta-tag">
                  <i class="bi bi-calendar-check" />
                  Applied {{ record.submittedAtLabel }}
                </span>
                <span class="applicant-applications-page__meta-divider" aria-hidden="true" />
                <span class="applicant-applications-page__meta-tag">
                  <i class="bi bi-database" />
                  {{ record.sourceLabel }}
                </span>
              </div>
            </div>

            <!-- Status description -->
            <div class="applicant-applications-page__status-copy">
              <p v-if="!record.isDiscontinued" class="applicant-applications-page__status-note">
                <i class="bi bi-info-circle" />
                {{ record.statusDescription }}
              </p>
              <p v-if="record.isDiscontinued" class="applicant-applications-page__status-note applicant-applications-page__status-note--discontinued">
                <i class="bi bi-exclamation-triangle-fill" />
                {{ record.discontinuedReason || 'The job post was deleted and this application was discontinued.' }}
              </p>
              <p v-else-if="record.rejectionReason" class="applicant-applications-page__status-note applicant-applications-page__status-note--danger">
                <i class="bi bi-x-octagon" />
                Rejection reason: {{ record.rejectionReason }}
              </p>
            </div>

            <!-- Timeline (kept as-is — user said it's good) -->
            <section class="applicant-applications-page__timeline">
              <div class="applicant-applications-page__timeline-head">
                <h5>
                  <i class="bi bi-signpost-split" />
                  Status Timeline
                </h5>
                <span>Track the current hiring flow for this job post.</span>
              </div>

              <div class="applicant-applications-page__timeline-list">
                <article
                  v-for="(step, index) in record.timelineItems"
                  :key="step.id"
                  class="applicant-applications-page__timeline-item"
                  :class="step.itemClass"
                >
                  <div class="applicant-applications-page__timeline-marker" aria-hidden="true">
                    <span class="applicant-applications-page__timeline-dot" :class="step.dotClass">
                      <i :class="step.visualIcon" />
                    </span>
                    <span class="applicant-applications-page__timeline-badge" :class="step.badgeClass">
                      <i v-if="step.badgeIcon" :class="step.badgeIcon" />
                    </span>
                    <span
                      v-if="index !== record.timelineItems.length - 1"
                      class="applicant-applications-page__timeline-line"
                      :class="step.lineClass"
                    />
                  </div>

                  <div class="applicant-applications-page__timeline-copy">
                    <strong>{{ step.label }}</strong>
                    <span>{{ step.meta }}</span>
                  </div>
                </article>
              </div>
            </section>

            <!-- Footer -->
            <div class="applicant-applications-page__card-footer">
              <span class="applicant-applications-page__footer-updated">
                <i class="bi bi-clock-history" />
                Last updated {{ record.lastUpdatedLabel }}
              </span>
            </div>
          </article>
        </div>

        <div v-else class="applicant-applications-page__empty-shell">
          <div class="applicant-applications-page__empty">
            <section class="applicant-applications-page__empty-hero">
              <span class="applicant-applications-page__empty-icon" aria-hidden="true">
                <i class="bi bi-file-earmark-check" />
              </span>
              <p class="applicant-applications-page__empty-overline">Application Tracker</p>
              <h3>No applications yet</h3>
              <p>Once you apply to a job, your submitted applications will appear here together with status updates, interview progress, and final employer decisions.</p>
            </section>
          </div>
        </div>

        <transition name="applicant-applications-page__modal">
          <div
            v-if="showDeleteConfirmModal"
            class="applicant-applications-page__modal-overlay"
            role="presentation"
            @click.self="closeDeleteConfirmModal"
          >
            <div
              class="applicant-applications-page__modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="applicant-applications-delete-modal-title"
            >
              <span class="applicant-applications-page__modal-icon" aria-hidden="true">
                <i class="bi bi-trash3" />
              </span>
              <p class="applicant-applications-page__modal-eyebrow">Delete Application Record</p>
              <h3 id="applicant-applications-delete-modal-title">Delete selected {{ pendingDeleteApplicationLabel }}?</h3>
              <p class="applicant-applications-page__modal-copy">
                This will remove {{ pendingDeleteApplicationCount }} {{ pendingDeleteApplicationLabel }} from your application records.
              </p>
              <div class="applicant-applications-page__modal-actions">
                <button
                  type="button"
                  class="applicant-applications-page__modal-button applicant-applications-page__modal-button--ghost"
                  :disabled="isDeletingApplications"
                  @click="closeDeleteConfirmModal"
                >
                  No
                </button>
                <button
                  type="button"
                  class="applicant-applications-page__modal-button applicant-applications-page__modal-button--danger"
                  :disabled="isDeletingApplications"
                  @click="confirmDeleteSelectedApplications"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </transition>
      </article>
  </section>
</template>

<style scoped>
/* ─── Page shell ─── */
.applicant-applications-page {
  display: grid;
  gap: 1.25rem;
  padding: 0 1.5rem;
  align-content: start;
  width: 100%;
  min-height: calc(100vh - 8rem);
}

/* ─── Main panel ─── */
.applicant-applications-page__panel {
  margin-top: 20px;
  display: grid;
  align-content: start;
  gap: 1.1rem;
  padding: 2rem;
  border: 1px solid rgba(166, 184, 173, 0.52);
  border-radius: 1.25rem;
  min-height: clamp(34rem, calc(100vh - 10rem), 46rem);
  background:
    radial-gradient(ellipse at top left, rgba(236, 248, 241, 0.42), transparent 52%),
    linear-gradient(180deg, #ffffff 0%, #fafcfb 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8),
    0 20px 48px rgba(15, 23, 42, 0.05),
    0 4px 12px rgba(15, 23, 42, 0.03);
  grid-template-rows: auto minmax(0, 1fr);
}

.applicant-applications-page__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid rgba(190, 208, 198, 0.72);
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at top left, rgba(221, 243, 229, 0.92), transparent 42%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.99), rgba(246, 252, 249, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 10px 24px rgba(18, 56, 38, 0.04);
}

.applicant-applications-page__hero-copy {
  display: grid;
  gap: 0.45rem;
  max-width: 39rem;
}

.applicant-applications-page__hero-side {
  display: grid;
  gap: 0.85rem;
  min-width: min(100%, 24rem);
}

.applicant-applications-page__hero-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}

.applicant-applications-page__hero-stat,
.applicant-applications-page__hero-outcome {
  display: grid;
  gap: 0.32rem;
  padding: 0.82rem 0.9rem;
  border: 1px solid rgba(196, 210, 202, 0.72);
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.94);
}

.applicant-applications-page__hero-stat span,
.applicant-applications-page__hero-outcome span {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: #688174;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-applications-page__eyebrow {
  color: #5d7a69;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.applicant-applications-page__hero-copy h2 {
  color: #173324;
  font-size: clamp(1.5rem, 1.9vw, 1.95rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.applicant-applications-page__hero-copy p:last-child {
  color: #5f796b;
  font-size: 0.92rem;
  line-height: 1.68;
}

.applicant-applications-page__hero-stat strong {
  color: #173324;
  font-size: 1.35rem;
  line-height: 1;
}

.applicant-applications-page__hero-stat--warning strong,
.applicant-applications-page__hero-stat--warning span i {
  color: #a16207;
}

.applicant-applications-page__hero-stat--info strong,
.applicant-applications-page__hero-stat--info span i {
  color: #0f766e;
}

.applicant-applications-page__hero-stat--success strong,
.applicant-applications-page__hero-stat--success span i {
  color: #167844;
}

.applicant-applications-page__hero-outcome {
  gap: 0.24rem;
  background: linear-gradient(135deg, rgba(238, 247, 241, 0.98), rgba(255, 255, 255, 0.95));
}

.applicant-applications-page__hero-outcome strong {
  color: #183126;
  font-size: 0.98rem;
  line-height: 1.45;
}

/* ─── Reset margins ─── */
.applicant-applications-page__summary-copy,
.applicant-applications-page__summary-copy h2,
.applicant-applications-page__summary-copy p,
.applicant-applications-page__eyebrow,
.applicant-applications-page__hero-copy h2,
.applicant-applications-page__hero-copy p,
.applicant-applications-page__hero-stat span,
.applicant-applications-page__hero-stat strong,
.applicant-applications-page__hero-outcome span,
.applicant-applications-page__hero-outcome strong,
.applicant-applications-page__card h4,
.applicant-applications-page__card p,
.applicant-applications-page__empty h3,
.applicant-applications-page__empty p,
.applicant-applications-page__timeline-head h5,
.applicant-applications-page__timeline-head span {
  margin: 0;
}

/* ─── Panel head ─── */
.applicant-panel__head--applications {
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0;
  padding: 0.1rem 0 1.15rem;
  border-bottom: 1px solid rgba(208, 219, 213, 0.72);
}

.applicant-panel__head--applications > div:first-child {
  display: grid;
  gap: 0.3rem;
}

.applicant-panel__head--applications h3 {
  color: #183126;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.applicant-panel__head--applications span {
  color: #6d8175;
  font-size: 0.79rem;
  font-weight: 600;
}

/* ─── Head actions ─── */
.applicant-applications-page__head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
}

.applicant-applications-page__head-count {
  color: #5f7268;
  font-size: 0.78rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.2rem;
  padding: 0 0.95rem;
  border: 1px solid rgba(196, 208, 214, 0.88);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}

.applicant-applications-page__head-count i {
  font-size: 0.88rem;
  color: #2f7d54;
}

.applicant-applications-page__select-button,
.applicant-applications-page__secondary-button,
.applicant-applications-page__delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.15rem;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.applicant-applications-page__select-button {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(191, 219, 203, 0.92);
  border-radius: 999px;
  background: rgba(240, 253, 244, 0.98);
  color: #1f6b45;
}

.applicant-applications-page__select-button:hover {
  background: rgba(220, 252, 231, 0.98);
  border-color: rgba(52, 211, 153, 0.72);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(27, 138, 84, 0.12);
}

/* ─── Bulk actions ─── */
.applicant-applications-page__bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
  padding: 0.18rem;
  border: 1px solid rgba(205, 216, 226, 0.88);
  border-radius: 0.85rem;
  background: rgba(250, 252, 251, 0.96);
}

.applicant-applications-page__bulk-toggle,
.applicant-applications-page__card-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #355646;
  font-size: 0.76rem;
  font-weight: 600;
}

.applicant-applications-page__bulk-toggle {
  padding-left: 0.35rem;
}

.applicant-applications-page__bulk-toggle input,
.applicant-applications-page__card-checkbox input {
  width: 1.05rem;
  height: 1.05rem;
  margin: 0;
  accent-color: #1b8a54;
  cursor: pointer;
}

.applicant-applications-page__bulk-toggle input:disabled,
.applicant-applications-page__card-checkbox input:disabled {
  cursor: not-allowed;
}

.applicant-applications-page__selection-count {
  display: inline-flex;
  align-items: center;
  min-height: 2.15rem;
  padding: 0.35rem 0.82rem;
  border: 1px solid rgba(196, 208, 214, 0.92);
  border-radius: 0.6rem;
  background: rgba(255, 255, 255, 0.92);
  color: #355646;
  font-size: 0.74rem;
  font-weight: 600;
}

.applicant-applications-page__secondary-button {
  padding: 0.5rem 0.95rem;
  border: 1px solid rgba(205, 216, 226, 0.95);
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.96);
  color: #355646;
}

.applicant-applications-page__secondary-button:hover {
  background: rgba(248, 250, 249, 0.98);
  border-color: rgba(148, 163, 184, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
}

.applicant-applications-page__delete-button {
  padding: 0.5rem 0.95rem;
  border: 1px solid rgba(240, 199, 199, 0.95);
  border-radius: 0.7rem;
  background: rgba(254, 242, 242, 0.96);
  color: #b42318;
}

.applicant-applications-page__delete-button:hover {
  background: rgba(254, 226, 226, 0.96);
  border-color: rgba(229, 137, 137, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(180, 35, 24, 0.12);
}

.applicant-applications-page__select-button:disabled,
.applicant-applications-page__secondary-button:disabled,
.applicant-applications-page__delete-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.applicant-applications-page__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(6px);
}

.applicant-applications-page__modal-card {
  width: min(100%, 25rem);
  display: grid;
  gap: 0.85rem;
  padding: 1.4rem;
  border: 1px solid rgba(223, 229, 236, 0.96);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, #ffffff 0%, #fafcfb 100%);
  box-shadow:
    0 24px 50px rgba(15, 23, 42, 0.18),
    0 6px 18px rgba(15, 23, 42, 0.08);
}

.applicant-applications-page__modal-icon {
  display: inline-grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: rgba(254, 242, 242, 0.96);
  color: #b42318;
  font-size: 1.25rem;
}

.applicant-applications-page__modal-eyebrow,
.applicant-applications-page__modal-copy,
.applicant-applications-page__modal-card h3 {
  margin: 0;
}

.applicant-applications-page__modal-eyebrow {
  color: #b42318;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.applicant-applications-page__modal-card h3 {
  color: #16271f;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.applicant-applications-page__modal-copy {
  color: #60746a;
  font-size: 0.9rem;
  line-height: 1.6;
}

.applicant-applications-page__modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.applicant-applications-page__modal-button {
  min-width: 6.5rem;
  min-height: 2.4rem;
  padding: 0.55rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid transparent;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.applicant-applications-page__modal-button--ghost {
  border-color: rgba(205, 216, 226, 0.95);
  background: rgba(255, 255, 255, 0.96);
  color: #355646;
}

.applicant-applications-page__modal-button--ghost:hover {
  background: rgba(248, 250, 249, 0.98);
  border-color: rgba(148, 163, 184, 0.7);
  transform: translateY(-1px);
}

.applicant-applications-page__modal-button--danger {
  border-color: rgba(240, 199, 199, 0.95);
  background: rgba(254, 242, 242, 0.96);
  color: #b42318;
  box-shadow: 0 8px 18px rgba(180, 35, 24, 0.12);
}

.applicant-applications-page__modal-button--danger:hover {
  background: rgba(254, 226, 226, 0.96);
  border-color: rgba(229, 137, 137, 0.95);
  transform: translateY(-1px);
}

.applicant-applications-page__modal-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.applicant-applications-page__modal-enter-active,
.applicant-applications-page__modal-leave-active {
  transition: opacity 0.18s ease;
}

.applicant-applications-page__modal-enter-active .applicant-applications-page__modal-card,
.applicant-applications-page__modal-leave-active .applicant-applications-page__modal-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.applicant-applications-page__modal-enter-from,
.applicant-applications-page__modal-leave-to {
  opacity: 0;
}

.applicant-applications-page__modal-enter-from .applicant-applications-page__modal-card,
.applicant-applications-page__modal-leave-to .applicant-applications-page__modal-card {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.98);
}

/* ─── Card list ─── */
.applicant-applications-page__list {
  display: grid;
  gap: 1.25rem;
  padding-top: 0.1rem;
}

/* ─── Card ─── */
.applicant-applications-page__card {
  position: relative;
  display: grid;
  gap: 0;
  contain: layout paint;
  border: 1px solid rgba(193, 206, 214, 0.72);
  border-radius: 1.1rem;
  background: #ffffff;
  content-visibility: auto;
  contain-intrinsic-size: 34rem;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.03),
    0 8px 24px rgba(15, 23, 42, 0.04);
  transition:
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.22s ease,
    box-shadow 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.applicant-applications-page__card:hover {
  transform: translateY(-2px);
  border-color: rgba(47, 125, 84, 0.32);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.03),
    0 20px 40px rgba(15, 23, 42, 0.07),
    0 8px 16px rgba(47, 125, 84, 0.05);
}

.applicant-applications-page__card--inactive {
  border-color: rgba(203, 213, 225, 0.55);
  background: linear-gradient(180deg, #fbfcfb 0%, #f7f9f8 100%);
}

.applicant-applications-page__card--inactive .applicant-applications-page__pill,
.applicant-applications-page__card--inactive .applicant-status-pill {
  filter: saturate(0.72);
}

/* ─── Card accent bar ─── */
.applicant-applications-page__card-accent {
  height: 0.3rem;
  background: linear-gradient(90deg, #1b8a54 0%, #34d399 40%, #6ee7b7 70%, #a7f3d0 100%);
  border-radius: 1.1rem 1.1rem 0 0;
}

.applicant-applications-page__card--inactive .applicant-applications-page__card-accent {
  background: linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%);
}

/* ─── Card header ─── */
.applicant-applications-page__card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.1rem;
  padding: 1.25rem 1.35rem 0.85rem;
}

.applicant-applications-page__card-brand {
  display: flex;
  align-items: center;
  gap: 0.95rem;
  min-width: 0;
  flex: 1 1 auto;
}

.applicant-applications-page__card-avatar {
  flex-shrink: 0;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 0.85rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #1b8a54 0%, #34d399 100%);
  color: #ffffff;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  box-shadow:
    0 4px 12px rgba(27, 138, 84, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.applicant-applications-page__card--inactive .applicant-applications-page__card-avatar {
  background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.18);
}

.applicant-applications-page__card-avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.applicant-applications-page__card-identity {
  min-width: 0;
  display: grid;
  gap: 0.18rem;
}

.applicant-applications-page__card-identity h4 {
  color: #0f1f18;
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.applicant-applications-page__card-company {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.28rem;
  color: #4b6358;
  font-size: 0.86rem;
  font-weight: 600;
}

.applicant-applications-page__card-company i {
  font-size: 0.78rem;
  color: #7b9488;
}

.applicant-applications-page__card-caption {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.8rem;
  margin-top: 0.2rem;
  color: #72857a;
  font-size: 0.73rem;
  font-weight: 700;
}

.applicant-applications-page__card-caption span {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
}

.applicant-applications-page__card-caption i {
  color: #8aa192;
  font-size: 0.8rem;
}

/* ─── Card actions ─── */
.applicant-applications-page__card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.applicant-applications-page__card-checkbox {
  padding: 0.3rem 0.5rem;
  border-radius: 0.6rem;
  background: rgba(248, 250, 249, 0.96);
  border: 1px solid rgba(214, 222, 230, 0.6);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.applicant-applications-page__card-checkbox:hover {
  border-color: rgba(47, 125, 84, 0.28);
  background: rgba(236, 253, 245, 0.6);
}

/* ─── Status pill icon ─── */
.applicant-status-pill__icon {
  font-size: 0.72rem;
  margin-right: 0.15rem;
}

/* ─── Meta bar ─── */
.applicant-applications-page__meta-bar {
  display: grid;
  gap: 0.65rem;
  padding: 0.7rem 1.35rem 0.9rem;
  border-top: 1px solid rgba(229, 237, 233, 0.65);
  border-bottom: 1px solid rgba(229, 237, 233, 0.65);
  background:
    linear-gradient(180deg, rgba(248, 252, 250, 0.96) 0%, rgba(243, 249, 246, 0.88) 100%);
}

.applicant-applications-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding-top: 0.1rem;
}

.applicant-applications-page__meta-secondary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.applicant-applications-page__meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  color: #6c8376;
  font-size: 0.74rem;
  font-weight: 600;
}

.applicant-applications-page__meta-tag i {
  font-size: 0.82rem;
  color: #8da898;
}

.applicant-applications-page__meta-divider {
  width: 1px;
  height: 0.9rem;
  background: rgba(166, 184, 173, 0.45);
  border-radius: 999px;
}

/* ─── Meta pills (redesigned) ─── */
.applicant-applications-page__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 2rem;
  padding: 0.38rem 0.78rem;
  border: 1px solid rgba(213, 221, 216, 0.75);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #355646;
  font-size: 0.74rem;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.applicant-applications-page__pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
}

.applicant-applications-page__pill i {
  font-size: 0.82rem;
}

.applicant-applications-page__pill--location {
  background: rgba(237, 242, 255, 0.88);
  border-color: rgba(191, 219, 254, 0.72);
  color: #1d4ed8;
}

.applicant-applications-page__pill--location i { color: #3b82f6; }

.applicant-applications-page__pill--type {
  background: rgba(245, 243, 255, 0.88);
  border-color: rgba(199, 210, 254, 0.72);
  color: #4338ca;
}

.applicant-applications-page__pill--type i { color: #6366f1; }

.applicant-applications-page__pill--salary {
  background: rgba(255, 251, 235, 0.88);
  border-color: rgba(253, 230, 138, 0.72);
  color: #92400e;
}

.applicant-applications-page__pill--salary i { color: #f59e0b; }

.applicant-applications-page__pill--pwd {
  background: rgba(236, 253, 245, 0.88);
  border-color: rgba(167, 243, 208, 0.72);
  color: #047857;
}

.applicant-applications-page__pill--pwd i { color: #10b981; }

/* ─── Status copy ─── */
.applicant-applications-page__status-copy,
.applicant-applications-page__status-note {
  margin: 0;
}

.applicant-applications-page__status-copy {
  display: grid;
  gap: 0.35rem;
  padding: 0.8rem 1.35rem;
}

.applicant-applications-page__status-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: #4c5f55;
  font-size: 0.82rem;
  line-height: 1.65;
}

.applicant-applications-page__status-note i {
  flex-shrink: 0;
  font-size: 0.88rem;
  margin-top: 0.16rem;
  color: #7b9488;
}

.applicant-applications-page__status-note--danger {
  color: #b42318;
  font-weight: 700;
}

.applicant-applications-page__status-note--danger i {
  color: #dc2626;
}

.applicant-applications-page__status-note--discontinued {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(244, 114, 114, 0.22);
  border-radius: 0.85rem;
  background:
    linear-gradient(135deg, rgba(254, 242, 242, 0.92), rgba(254, 226, 226, 0.6));
  color: #991b1b;
  font-weight: 700;
}

.applicant-applications-page__status-note--discontinued i {
  color: #dc2626;
}

.applicant-applications-page__status-note--muted {
  color: #7b8a83;
  font-size: 0.74rem;
}

/* ─── Timeline (unchanged — user said it's good) ─── */
.applicant-applications-page__timeline {
  display: grid;
  gap: 1rem;
  margin: 0 1.35rem;
  padding: 1.15rem 1.25rem 1.25rem;
  border: 1px solid rgba(198, 211, 217, 0.72);
  border-radius: 1.05rem;
  background:
    radial-gradient(circle at top center, rgba(237, 247, 241, 0.68), transparent 52%),
    linear-gradient(180deg, #fbfdfc 0%, #f5faf7 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 2px 6px rgba(15, 23, 42, 0.03);
}

.applicant-applications-page__timeline-head {
  display: grid;
  gap: 0.18rem;
}

.applicant-applications-page__timeline-head h5 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #1f3028;
  font-size: 0.9rem;
  font-weight: 700;
}

.applicant-applications-page__timeline-head h5 i {
  font-size: 1rem;
  color: #2f7d54;
}

.applicant-applications-page__timeline-head span {
  color: #708077;
  font-size: 0.74rem;
}

.applicant-applications-page__timeline-list {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 0.15rem 0 0.35rem;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
}

.applicant-applications-page__timeline-list::-webkit-scrollbar {
  display: none;
}

.applicant-applications-page__timeline-item {
  position: relative;
  flex: 1 0 0;
  min-width: 8.8rem;
  display: grid;
  gap: 0.72rem;
  justify-items: center;
  text-align: center;
  padding: 0.12rem 0.4rem 0;
  transition: transform 0.24s ease, opacity 0.24s ease;
  scroll-snap-align: start;
}

.applicant-applications-page__timeline-item--active .applicant-applications-page__timeline-copy {
  transform: translateY(-0.08rem);
}

.applicant-applications-page__timeline-item--complete .applicant-applications-page__timeline-copy {
  opacity: 0.96;
}

.applicant-applications-page__timeline-item--failed .applicant-applications-page__timeline-copy {
  opacity: 0.96;
}

.applicant-applications-page__timeline-marker {
  position: relative;
  width: 100%;
  min-height: 4.4rem;
  display: grid;
  justify-items: center;
  align-content: start;
}

.applicant-applications-page__timeline-dot {
  position: relative;
  z-index: 2;
  width: 3.35rem;
  height: 3.35rem;
  margin-top: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 2px solid var(--applicant-timeline-accent, #2f7d54);
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92) 38%, color-mix(in srgb, var(--applicant-timeline-accent, #2f7d54) 14%, white) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 14px 24px rgba(15, 23, 42, 0.08);
  transition:
    border-color 0.24s ease,
    background-color 0.24s ease,
    color 0.24s ease,
    box-shadow 0.24s ease,
    transform 0.24s ease;
}

.applicant-applications-page__timeline-dot::after {
  content: '';
  position: absolute;
  inset: 0.42rem;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0) 100%);
  opacity: 0.72;
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.applicant-applications-page__timeline-dot i {
  position: relative;
  z-index: 1;
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1;
}

.applicant-applications-page__timeline-dot--warning {
  --applicant-timeline-accent: #f59e0b;
  --applicant-timeline-track: rgba(245, 158, 11, 0.18);
}

.applicant-applications-page__timeline-dot--success {
  --applicant-timeline-accent: #16a34a;
  --applicant-timeline-track: rgba(22, 163, 74, 0.18);
}

.applicant-applications-page__timeline-dot--danger {
  --applicant-timeline-accent: #dc2626;
  --applicant-timeline-track: rgba(220, 38, 38, 0.16);
}

.applicant-applications-page__timeline-dot--info {
  --applicant-timeline-accent: #0f766e;
  --applicant-timeline-track: rgba(15, 118, 110, 0.18);
}

.applicant-applications-page__timeline-dot--muted {
  --applicant-timeline-accent: #94a3b8;
  --applicant-timeline-track: rgba(148, 163, 184, 0.16);
}

.applicant-applications-page__timeline-dot--complete,
.applicant-applications-page__timeline-dot--failed {
  color: var(--applicant-timeline-accent, #16a34a);
}

.applicant-applications-page__timeline-dot--complete {
  border-color: var(--applicant-timeline-accent, #16a34a);
}

.applicant-applications-page__timeline-dot--failed {
  border-color: var(--applicant-timeline-accent, #dc2626);
}

.applicant-applications-page__timeline-dot--active {
  color: var(--applicant-timeline-accent, #2f7d54);
  transform: translateY(-0.06rem) scale(1.02);
  box-shadow:
    0 0 0 0.28rem color-mix(in srgb, var(--applicant-timeline-accent, #2f7d54) 14%, transparent),
    0 12px 22px rgba(15, 23, 42, 0.09);
}

.applicant-applications-page__timeline-dot--pending {
  border-color: rgba(198, 211, 217, 0.96);
  color: #8a9a91;
  box-shadow: none;
}

.applicant-applications-page__timeline-dot--pending::after {
  opacity: 0.5;
}

.applicant-applications-page__timeline-badge {
  position: absolute;
  top: -0.02rem;
  left: calc(50% + 1.08rem);
  z-index: 3;
  width: 1.08rem;
  height: 1.08rem;
  display: grid;
  place-items: center;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #dbe5df;
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
  transform: translateX(-50%);
}

.applicant-applications-page__timeline-badge i {
  font-size: 0.58rem;
  font-weight: 800;
  line-height: 1;
}

.applicant-applications-page__timeline-badge--success { background: #16a34a; }
.applicant-applications-page__timeline-badge--danger { background: #dc2626; }
.applicant-applications-page__timeline-badge--warning { background: #f59e0b; }
.applicant-applications-page__timeline-badge--info { background: #0f766e; }
.applicant-applications-page__timeline-badge--muted { background: #94a3b8; }
.applicant-applications-page__timeline-badge--pending { background: #cbd5e1; }

.applicant-applications-page__timeline-badge--active {
  animation: applicant-applications-page-timeline-pulse 1.6s ease-in-out infinite;
}

.applicant-applications-page__timeline-line {
  position: absolute;
  top: 1.54rem;
  left: calc(50% + 1.7rem);
  width: calc(100% - 3.4rem);
  height: 0.22rem;
  border-radius: 999px;
  background: repeating-linear-gradient(
    90deg,
    var(--applicant-timeline-track, rgba(148, 163, 184, 0.22)) 0 0.42rem,
    transparent 0.42rem 0.8rem
  );
  overflow: hidden;
}

.applicant-applications-page__timeline-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    var(--applicant-timeline-accent, #2f7d54) 0 0.42rem,
    transparent 0.42rem 0.8rem
  );
  transform-origin: left;
  transform: scaleX(var(--applicant-timeline-fill-scale, 0));
  transition: transform 0.3s ease, background-color 0.24s ease;
}

.applicant-applications-page__timeline-line--warning {
  --applicant-timeline-accent: #f59e0b;
  --applicant-timeline-track: rgba(245, 158, 11, 0.18);
}

.applicant-applications-page__timeline-line--success {
  --applicant-timeline-accent: #16a34a;
  --applicant-timeline-track: rgba(22, 163, 74, 0.18);
}

.applicant-applications-page__timeline-line--danger {
  --applicant-timeline-accent: #dc2626;
  --applicant-timeline-track: rgba(220, 38, 38, 0.16);
}

.applicant-applications-page__timeline-line--info {
  --applicant-timeline-accent: #0f766e;
  --applicant-timeline-track: rgba(15, 118, 110, 0.18);
}

.applicant-applications-page__timeline-line--muted {
  --applicant-timeline-accent: #94a3b8;
  --applicant-timeline-track: rgba(148, 163, 184, 0.16);
}

.applicant-applications-page__timeline-line--filled {
  --applicant-timeline-fill-scale: 1;
}

.applicant-applications-page__timeline-line--partial {
  --applicant-timeline-fill-scale: 0.56;
}

.applicant-applications-page__timeline-line--empty {
  --applicant-timeline-fill-scale: 0;
}

.applicant-applications-page__timeline-copy {
  display: grid;
  gap: 0.24rem;
  justify-items: center;
  padding: 0;
  transition: transform 0.24s ease, opacity 0.24s ease;
}

.applicant-applications-page__timeline-copy strong {
  color: #1d2b24;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.2;
}

.applicant-applications-page__timeline-copy span {
  color: #66786f;
  font-size: 0.72rem;
  line-height: 1.45;
  max-width: 11rem;
}

.applicant-applications-page__timeline-item--complete .applicant-applications-page__timeline-copy strong {
  color: #146c43;
}

.applicant-applications-page__timeline-item--active .applicant-applications-page__timeline-copy strong {
  color: #0f766e;
}

.applicant-applications-page__timeline-item--failed .applicant-applications-page__timeline-copy strong {
  color: #b91c1c;
}

@keyframes applicant-applications-page-timeline-pulse {
  0% { box-shadow: 0 0 0 0 rgba(15, 118, 110, 0.28); }
  70% { box-shadow: 0 0 0 0.34rem rgba(15, 118, 110, 0); }
  100% { box-shadow: 0 0 0 0 rgba(15, 118, 110, 0); }
}

/* ─── Card footer ─── */
.applicant-applications-page__card-footer {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 1.35rem 1rem;
}

.applicant-applications-page__footer-updated {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #7b8a83;
  font-size: 0.74rem;
  font-weight: 600;
}

.applicant-applications-page__footer-updated i {
  font-size: 0.82rem;
  color: #9caba2;
}

/* ─── Empty state ─── */
.applicant-applications-page__empty-shell {
  display: grid;
  min-height: 100%;
}

.applicant-applications-page__empty {
  min-height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.15rem;
  align-items: stretch;
  padding: 1.5rem;
  border: 1px dashed rgba(179, 203, 188, 0.82);
  border-radius: 1.3rem;
  background:
    radial-gradient(circle at top left, rgba(233, 247, 238, 0.82), transparent 32%),
    linear-gradient(180deg, rgba(253, 255, 253, 0.98) 0%, rgba(244, 250, 246, 0.96) 100%);
  color: #62706a;
}

.applicant-applications-page__empty-hero {
  display: grid;
  align-content: center;
  gap: 0.85rem;
  padding: 0.8rem 0.4rem;
  max-width: 42rem;
}

.applicant-applications-page__empty-icon {
  display: inline-grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 1.35rem;
  background: linear-gradient(135deg, rgba(28, 138, 84, 0.15), rgba(95, 186, 128, 0.08));
  color: #1b8a54;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 18px 30px rgba(27, 138, 84, 0.1);
}

.applicant-applications-page__empty-icon i {
  font-size: 2.1rem;
}

.applicant-applications-page__empty-overline {
  margin: 0;
  color: #6c8376;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.applicant-applications-page__empty h3,
.applicant-applications-page__empty p {
  margin: 0;
}

.applicant-applications-page__empty h3 {
  color: #183126;
  font-size: clamp(1.5rem, 2vw, 1.9rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.applicant-applications-page__empty > .applicant-applications-page__empty-hero > p:last-of-type {
  color: #5d7267;
  font-size: 0.93rem;
  line-height: 1.75;
  max-width: 38rem;
}

.applicant-applications-page__empty-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding-top: 0.25rem;
}

.applicant-applications-page__empty-tags span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.1rem;
  padding: 0.4rem 0.82rem;
  border: 1px solid rgba(201, 215, 206, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #385949;
  font-size: 0.75rem;
  font-weight: 700;
}

.applicant-applications-page__empty-tags span i {
  color: #1b8a54;
  font-size: 0.78rem;
}

/* ─── Responsive ─── */
@media (max-width: 1080px) {
  .applicant-applications-page__panel {
    min-height: auto;
  }

  .applicant-applications-page__hero {
    flex-direction: column;
  }

  .applicant-applications-page__hero-side {
    width: 100%;
    min-width: 0;
  }

  .applicant-applications-page__hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .applicant-applications-page__empty {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .applicant-applications-page {
    padding: 0 0.9rem;
    min-height: auto;
  }

  .applicant-applications-page__panel {
    padding: 1rem;
    border-radius: 1rem;
  }

  .applicant-applications-page__hero {
    padding: 1rem;
    border-radius: 1rem;
  }

  .applicant-applications-page__card-header {
    display: grid;
    grid-template-columns: 1fr;
    padding: 1rem 1rem 0.7rem;
  }

  .applicant-applications-page__meta-bar {
    padding: 0.6rem 1rem 0.7rem;
  }

  .applicant-applications-page__status-copy {
    padding: 0.6rem 1rem;
  }

  .applicant-applications-page__timeline {
    margin: 0 1rem;
  }

  .applicant-applications-page__card-footer {
    padding: 0.6rem 1rem 0.9rem;
  }

  .applicant-applications-page__head-actions {
    width: 100%;
    justify-content: flex-start;
    margin-left: 0;
  }

  .applicant-applications-page__bulk-actions {
    justify-content: flex-start;
    width: 100%;
    border-radius: 1rem;
  }

  .applicant-applications-page__select-button,
  .applicant-applications-page__secondary-button,
  .applicant-applications-page__delete-button,
  .applicant-applications-page__selection-count {
    width: 100%;
  }

  .applicant-applications-page__modal-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .applicant-applications-page__modal-button {
    width: 100%;
  }

  .applicant-panel__head--applications {
    align-items: start;
  }

  .applicant-applications-page__card-caption {
    flex-direction: column;
    gap: 0.32rem;
  }

  .applicant-applications-page__empty {
    padding: 1rem;
  }

  .applicant-applications-page__empty-hero {
    padding: 0.3rem 0;
  }

  .applicant-applications-page__empty-tags {
    gap: 0.5rem;
  }

  .applicant-applications-page__empty-tags span {
    width: 100%;
    justify-content: center;
  }
}
</style>
