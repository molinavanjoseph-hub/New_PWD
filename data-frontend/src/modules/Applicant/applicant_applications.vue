<script setup>
import { computed } from 'vue'

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
const visibleApplicationIds = computed(() =>
  props.applicationRecords.map((record) => String(record?.id || '').trim()).filter(Boolean),
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
const deleteSelectedButtonLabel = computed(() => {
  if (props.isDeletingApplications) return 'Deleting...'
  if (!selectedApplicationCount.value) return 'Delete Selected'
  return `Delete Selected (${selectedApplicationCount.value})`
})
const emptyStateHighlights = [
  {
    id: 'discover',
    icon: 'bi bi-search',
    label: 'Browse matching jobs',
    copy: 'Open Find Jobs and look for roles that fit your skills, preferred setup, and accessibility needs.',
  },
  {
    id: 'submit',
    icon: 'bi bi-send-check',
    label: 'Submit one application',
    copy: 'After you apply, this page starts collecting your live employer updates automatically.',
  },
  {
    id: 'track',
    icon: 'bi bi-activity',
    label: 'Track every status change',
    copy: 'Review screening progress, interview schedules, and final decisions in one submission tracker.',
  },
]

const timelineDotClass = (step) => {
  const tone = String(step?.tone || 'warning').trim().toLowerCase()
  return `applicant-applications-page__timeline-dot--${tone}`
}

const timelineLineClass = (step) => {
  const tone = String(step?.tone || 'warning').trim().toLowerCase()
  return `applicant-applications-page__timeline-line--${tone}`
}

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

const toggleApplicationSelection = (applicationId) => {
  if (props.isDeletingApplications) return

  const normalizedApplicationId = String(applicationId || '').trim()
  if (!normalizedApplicationId) return

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
  emit('delete-selected-applications', selectedVisibleApplicationIds.value)
}
</script>

<template>
  <section class="applicant-applications-page">
    <section class="applicant-applications-page__grid">
      <aside class="applicant-applications-page__rail">
        <article class="applicant-applications-page__profile-card">
          <div class="applicant-applications-page__profile-head">
            <span class="applicant-applications-page__profile-badge">Applicant</span>
            <span class="applicant-applications-page__profile-status">Applications</span>
          </div>

          <div class="applicant-applications-page__identity">
            <p class="applicant-applications-page__eyebrow">My Applications</p>
            <h2>Submission Tracker</h2>
            <p>Review every submitted job application, its current status, and your latest updates.</p>
          </div>

          <div class="applicant-applications-page__mini-list">
            <div class="applicant-applications-page__mini-item">
              <span><i class="bi bi-send-check" aria-hidden="true" /> Total Applied</span>
              <strong>{{ applicationStats.applied || 0 }}</strong>
            </div>
            <div class="applicant-applications-page__mini-item">
              <span><i class="bi bi-hourglass-split" aria-hidden="true" /> Pending</span>
              <strong>{{ applicationStats.pending || 0 }}</strong>
            </div>
            <div class="applicant-applications-page__mini-item">
              <span><i class="bi bi-calendar2-check" aria-hidden="true" /> For Interview</span>
              <strong>{{ applicationStats.interview || 0 }}</strong>
            </div>
            <div class="applicant-applications-page__mini-item applicant-applications-page__mini-item--outcome">
              <span><i class="bi bi-clipboard-data" aria-hidden="true" /> Outcome</span>
              <strong>{{ applicationOutcomeLabel }}</strong>
            </div>
          </div>
        </article>
      </aside>

      <article class="applicant-applications-page__panel">
        <div class="applicant-panel__head applicant-panel__head--applications">
          <div>
            <h3>Application Records</h3>
            <span>Live status from your submitted jobs</span>
          </div>
          <div class="applicant-applications-page__head-actions">
            <span class="applicant-applications-page__head-count">
              {{ applicationRecords.length }} application<span v-if="applicationRecords.length !== 1">s</span>
            </span>

            <div v-if="applicationRecords.length" class="applicant-applications-page__bulk-actions">
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
            </div>
          </div>
        </div>

        <div v-if="applicationRecords.length" class="applicant-applications-page__list">
          <article
            v-for="record in applicationRecords"
            :key="record.id"
            class="applicant-applications-page__card"
            :class="{ 'applicant-applications-page__card--inactive': record.isDiscontinued }"
          >
            <div class="applicant-applications-page__card-top">
              <div>
                <h4>{{ record.title }}</h4>
                <p>{{ record.company }}</p>
              </div>
              <div class="applicant-applications-page__card-actions">
                <label class="applicant-applications-page__card-checkbox">
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
                  {{ record.statusLabel }}
                </span>
              </div>
            </div>

            <div class="applicant-applications-page__meta">
              <span class="applicant-applications-page__pill applicant-applications-page__pill--location">
                <i class="bi bi-geo-alt" />
                {{ record.location }}
              </span>
              <span class="applicant-applications-page__pill applicant-applications-page__pill--type">
                <i class="bi bi-briefcase" />
                {{ record.jobType }}
              </span>
              <span class="applicant-applications-page__pill applicant-applications-page__pill--salary">
                <i class="bi bi-cash-stack" />
                {{ record.salaryLabel }}
              </span>
              <span class="applicant-applications-page__pill applicant-applications-page__pill--pwd">
                <i class="bi bi-universal-access-circle" />
                {{ record.disabilityLabel }}
              </span>
              <span class="applicant-applications-page__pill applicant-applications-page__pill--date">
                <i class="bi bi-calendar-event" />
                Applied {{ record.submittedAtLabel }}
              </span>
              <span class="applicant-applications-page__pill applicant-applications-page__pill--source">
                <i class="bi bi-database" />
                {{ record.sourceLabel }}
              </span>
            </div>

            <div class="applicant-applications-page__status-copy">
              <p v-if="!record.isDiscontinued" class="applicant-applications-page__status-note">{{ record.statusDescription }}</p>
              <p v-if="record.isDiscontinued" class="applicant-applications-page__status-note applicant-applications-page__status-note--discontinued">
                {{ record.discontinuedReason || 'The job post was deleted and this application was discontinued.' }}
              </p>
              <p v-else-if="record.rejectionReason" class="applicant-applications-page__status-note applicant-applications-page__status-note--danger">
                Rejection reason: {{ record.rejectionReason }}
              </p>
            </div>

            <section class="applicant-applications-page__timeline">
              <div class="applicant-applications-page__timeline-head">
                <h5>Status Timeline</h5>
                <span>Track the current hiring flow for this job post.</span>
              </div>

              <div class="applicant-applications-page__timeline-list">
                <article
                  v-for="(step, index) in record.timelineItems"
                  :key="step.id"
                  class="applicant-applications-page__timeline-item"
                >
                  <div class="applicant-applications-page__timeline-marker" aria-hidden="true">
                    <span class="applicant-applications-page__timeline-dot" :class="timelineDotClass(step)" />
                    <span
                      v-if="index !== record.timelineItems.length - 1"
                      class="applicant-applications-page__timeline-line"
                      :class="timelineLineClass(step)"
                    />
                  </div>

                  <div class="applicant-applications-page__timeline-copy">
                    <strong>{{ step.label }}</strong>
                    <span>{{ step.meta }}</span>
                  </div>
                </article>
              </div>
            </section>

            <p class="applicant-applications-page__status-note applicant-applications-page__status-note--muted">
              Last updated {{ record.lastUpdatedLabel }}
            </p>
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

              <div class="applicant-applications-page__empty-tags">
                <span>Status updates appear here</span>
                <span>Interview notes stay visible</span>
                <span>Everything stays in one tracker</span>
              </div>
            </section>

            <section class="applicant-applications-page__empty-highlights">
              <article
                v-for="item in emptyStateHighlights"
                :key="item.id"
                class="applicant-applications-page__empty-highlight"
              >
                <span class="applicant-applications-page__empty-highlight-icon" aria-hidden="true">
                  <i :class="item.icon" />
                </span>

                <div class="applicant-applications-page__empty-highlight-copy">
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.copy }}</p>
                </div>
              </article>
            </section>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.applicant-applications-page {
  display: grid;
  gap: 1.25rem;
  padding: 0 1.5rem;
  align-content: start;
  width: 100%;
  min-height: calc(100vh - 8rem);
}

.applicant-applications-page__grid {
  display: grid;
  grid-template-columns: minmax(17rem, 19rem) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
  width: 100%;
  min-height: 100%;
}

.applicant-applications-page__rail {
  display: grid;
  gap: 1rem;
  position: sticky;
  top: 6rem;
}

.applicant-applications-page__profile-card,
.applicant-applications-page__panel {
  display: grid;
  align-content: start;
  gap: 1.1rem;
  padding: 1.25rem;
  border: 1px solid rgba(129, 169, 143, 0.18);
  border-radius: 1.35rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(244, 251, 247, 0.95) 100%);
  box-shadow:
    0 20px 40px rgba(79, 129, 102, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.applicant-applications-page__profile-card {
  align-content: start;
  min-height: auto;
  background:
    radial-gradient(circle at top right, rgba(208, 241, 221, 0.62), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 251, 247, 0.98) 100%);
}

.applicant-applications-page__panel {
  min-height: clamp(34rem, calc(100vh - 10rem), 46rem);
  background:
    radial-gradient(circle at top right, rgba(228, 243, 233, 0.78), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 251, 247, 0.95) 100%);
}

.applicant-applications-page__profile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
}

.applicant-applications-page__profile-badge,
.applicant-applications-page__profile-status {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  border: 1px solid rgba(190, 206, 197, 0.95);
  border-radius: 999px;
  padding: 0 0.82rem;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.2;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 8px 16px rgba(15, 23, 42, 0.04);
}

.applicant-applications-page__profile-badge {
  color: #45574f;
  background: #f8fbf8;
}

.applicant-applications-page__profile-status {
  color: #1d6b3a;
  background: #eef8f1;
}

.applicant-applications-page__identity,
.applicant-applications-page__identity h2,
.applicant-applications-page__identity p,
.applicant-applications-page__eyebrow,
.applicant-applications-page__card h4,
.applicant-applications-page__card p,
.applicant-applications-page__empty h3,
.applicant-applications-page__empty p,
.applicant-applications-page__timeline-head h5,
.applicant-applications-page__timeline-head span {
  margin: 0;
}

.applicant-applications-page__eyebrow {
  color: #6c8376;
  font-size: 0.69rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.applicant-applications-page__identity h2 {
  margin-top: 0.28rem;
  color: #16271f;
  font-size: clamp(1.45rem, 2vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.applicant-applications-page__identity p {
  margin-top: 0.35rem;
  color: #5f7268;
  font-size: 0.86rem;
  line-height: 1.65;
}

.applicant-applications-page__mini-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.applicant-applications-page__mini-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: start;
  min-height: 5.4rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(193, 206, 214, 0.92);
  border-radius: 1.05rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 14px 26px rgba(15, 23, 42, 0.05);
}

.applicant-applications-page__mini-item span {
  color: #6c7c75;
  font-size: 0.73rem;
  font-weight: 700;
  line-height: 1.45;
}

.applicant-applications-page__mini-item strong {
  color: #16271f;
  font-size: 1rem;
  font-weight: 800;
  text-align: right;
  line-height: 1.35;
  word-break: break-word;
}

.applicant-applications-page__mini-item--outcome {
  grid-template-columns: 1fr;
}

.applicant-applications-page__mini-item--outcome strong {
  text-align: left;
  font-size: 0.94rem;
}

.applicant-applications-page__list {
  display: grid;
  gap: 1.1rem;
  padding-top: 0.1rem;
}

.applicant-panel__head--applications {
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0;
  padding: 0.1rem 0 1rem;
  border-bottom: 1px solid rgba(208, 219, 213, 0.9);
}

.applicant-panel__head--applications > div:first-child {
  display: grid;
  gap: 0.3rem;
}

.applicant-panel__head--applications h3 {
  color: #183126;
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.applicant-panel__head--applications span {
  color: #6d8175;
  font-size: 0.79rem;
  font-weight: 600;
}

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
  min-height: 2.2rem;
  padding: 0 0.95rem;
  border: 1px solid rgba(196, 208, 214, 0.88);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}

.applicant-applications-page__bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
  padding: 0.18rem;
  border: 1px solid rgba(205, 216, 226, 0.88);
  border-radius: 999px;
  background: rgba(250, 252, 251, 0.96);
}

.applicant-applications-page__bulk-toggle,
.applicant-applications-page__card-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #355646;
  font-size: 0.76rem;
  font-weight: 700;
}

.applicant-applications-page__bulk-toggle {
  padding-left: 0.35rem;
}

.applicant-applications-page__bulk-toggle input,
.applicant-applications-page__card-checkbox input {
  width: 1rem;
  height: 1rem;
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
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #355646;
  font-size: 0.74rem;
  font-weight: 800;
}

.applicant-applications-page__delete-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.15rem;
  padding: 0.5rem 0.95rem;
  border: 1px solid rgba(240, 199, 199, 0.95);
  border-radius: 999px;
  background: rgba(254, 242, 242, 0.96);
  color: #b42318;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.applicant-applications-page__delete-button:hover {
  background: rgba(254, 226, 226, 0.96);
  border-color: rgba(229, 137, 137, 0.95);
  transform: translateY(-1px);
}

.applicant-applications-page__delete-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.applicant-applications-page__card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid rgba(193, 206, 214, 0.92);
  border-radius: 1.2rem;
  background: #ffffff;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 18px 32px rgba(15, 23, 42, 0.06);
}

.applicant-applications-page__card--inactive {
  border-color: rgba(203, 213, 225, 0.7);
  background: linear-gradient(180deg, #fbfcfb 0%, #f7f9f8 100%);
}

.applicant-applications-page__card--inactive .applicant-applications-page__pill,
.applicant-applications-page__card--inactive .applicant-status-pill {
  filter: saturate(0.72);
}

.applicant-applications-page__card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.1rem;
}

.applicant-applications-page__card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.applicant-applications-page__card h4 {
  color: #16271f;
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.applicant-applications-page__card p {
  margin-top: 0.3rem;
  color: #63756d;
  font-size: 0.82rem;
  line-height: 1.45;
}

.applicant-applications-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  padding-top: 0.1rem;
}

.applicant-applications-page__status-copy,
.applicant-applications-page__status-note {
  margin: 0;
}

.applicant-applications-page__status-copy {
  display: grid;
  gap: 0.35rem;
  padding-top: 0.1rem;
}

.applicant-applications-page__status-note {
  color: #4c5f55;
  font-size: 0.8rem;
  line-height: 1.6;
}

.applicant-applications-page__status-note--danger {
  color: #b42318;
  font-weight: 700;
}

.applicant-applications-page__status-note--discontinued {
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(244, 114, 114, 0.28);
  border-radius: 0.95rem;
  background: rgba(254, 242, 242, 0.88);
  color: #991b1b;
  font-weight: 700;
}

.applicant-applications-page__status-note--muted {
  color: #7b8a83;
  font-size: 0.74rem;
}

.applicant-applications-page__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.15rem;
  padding: 0.46rem 0.84rem;
  border: 1px solid rgba(213, 221, 216, 0.95);
  border-radius: 999px;
  background: #f9fbfa;
  color: #355646;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.applicant-applications-page__pill--location {
  background: rgba(237, 242, 255, 0.96);
  border-color: rgba(191, 219, 254, 0.95);
  color: #1d4ed8;
}

.applicant-applications-page__pill--type {
  background: rgba(244, 247, 255, 0.98);
  border-color: rgba(199, 210, 254, 0.95);
  color: #4338ca;
}

.applicant-applications-page__pill--salary {
  background: rgba(255, 247, 237, 0.98);
  border-color: rgba(253, 230, 138, 0.95);
  color: #b45309;
}

.applicant-applications-page__pill--pwd {
  background: rgba(236, 253, 245, 0.98);
  border-color: rgba(167, 243, 208, 0.95);
  color: #047857;
}

.applicant-applications-page__pill--date {
  background: rgba(255, 247, 237, 0.98);
  border-color: rgba(253, 230, 138, 0.95);
  color: #b45309;
}

.applicant-applications-page__pill--source {
  background: rgba(236, 253, 245, 0.98);
  border-color: rgba(167, 243, 208, 0.95);
  color: #047857;
}

.applicant-applications-page__timeline {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 1.05rem;
  border: 1px solid rgba(198, 211, 217, 0.9);
  border-radius: 1.05rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 249, 0.94) 100%);
}

.applicant-applications-page__card-checkbox {
  padding: 0.25rem 0.35rem;
  border-radius: 999px;
  background: rgba(248, 250, 249, 0.96);
}

.applicant-applications-page__timeline-head {
  display: grid;
  gap: 0.18rem;
}

.applicant-applications-page__timeline-head h5 {
  color: #1f3028;
  font-size: 0.88rem;
  font-weight: 800;
}

.applicant-applications-page__timeline-head span {
  color: #708077;
  font-size: 0.74rem;
}

.applicant-applications-page__timeline-list {
  display: grid;
  gap: 0.2rem;
}

.applicant-applications-page__timeline-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.9rem;
  align-items: start;
}

.applicant-applications-page__timeline-marker {
  position: relative;
  width: 1rem;
  min-height: 3rem;
  display: grid;
  justify-items: center;
}

.applicant-applications-page__timeline-dot {
  position: relative;
  z-index: 1;
  width: 0.78rem;
  height: 0.78rem;
  margin-top: 0.2rem;
  border-radius: 999px;
  background: #f59e0b;
}

.applicant-applications-page__timeline-dot--warning {
  background: #f59e0b;
}

.applicant-applications-page__timeline-dot--success {
  background: #16a34a;
}

.applicant-applications-page__timeline-dot--danger {
  background: #dc2626;
}

.applicant-applications-page__timeline-dot--info {
  background: #f59e0b;
}

.applicant-applications-page__timeline-dot--muted {
  background: #94a3b8;
}

.applicant-applications-page__timeline-line {
  position: absolute;
  top: 1.18rem;
  bottom: 0;
  width: 2px;
  background: rgba(245, 158, 11, 0.28);
}

.applicant-applications-page__timeline-line--warning,
.applicant-applications-page__timeline-line--info {
  background: rgba(245, 158, 11, 0.28);
}

.applicant-applications-page__timeline-line--success {
  background: rgba(22, 163, 74, 0.28);
}

.applicant-applications-page__timeline-line--danger {
  background: rgba(220, 38, 38, 0.2);
}

.applicant-applications-page__timeline-line--muted {
  background: rgba(148, 163, 184, 0.28);
}

.applicant-applications-page__timeline-copy {
  display: grid;
  gap: 0.18rem;
  padding-bottom: 0.65rem;
}

.applicant-applications-page__timeline-copy strong {
  color: #16271f;
  font-size: 0.84rem;
  font-weight: 800;
}

.applicant-applications-page__timeline-copy span {
  color: #66786f;
  font-size: 0.75rem;
  line-height: 1.5;
}

.applicant-applications-page__panel {
  grid-template-rows: auto minmax(0, 1fr);
}

.applicant-applications-page__empty-shell {
  display: grid;
  min-height: 100%;
}

.applicant-applications-page__empty {
  min-height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(17rem, 22rem);
  gap: 1.15rem;
  align-items: stretch;
  padding: 1.35rem;
  border: 1px dashed rgba(179, 203, 188, 0.98);
  border-radius: 1.3rem;
  background:
    radial-gradient(circle at top left, rgba(233, 247, 238, 0.92), transparent 32%),
    linear-gradient(180deg, rgba(253, 255, 253, 0.98) 0%, rgba(244, 250, 246, 0.96) 100%);
  color: #62706a;
}

.applicant-applications-page__empty-hero,
.applicant-applications-page__empty-highlights {
  display: grid;
  align-content: center;
}

.applicant-applications-page__empty-hero {
  gap: 0.85rem;
  padding: 0.8rem 0.4rem;
}

.applicant-applications-page__empty-icon {
  display: inline-grid;
  place-items: center;
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 1.35rem;
  background: linear-gradient(135deg, rgba(28, 138, 84, 0.15), rgba(95, 186, 128, 0.08));
  color: #1b8a54;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 18px 30px rgba(27, 138, 84, 0.1);
}

.applicant-applications-page__empty-icon i {
  font-size: 2rem;
}

.applicant-applications-page__empty-overline {
  margin: 0;
  color: #6c8376;
  font-size: 0.72rem;
  font-weight: 800;
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
  font-weight: 800;
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
  min-height: 2.1rem;
  padding: 0.4rem 0.82rem;
  border: 1px solid rgba(201, 215, 206, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #385949;
  font-size: 0.75rem;
  font-weight: 700;
}

.applicant-applications-page__empty-highlights {
  gap: 0.75rem;
}

.applicant-applications-page__empty-highlight {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(199, 212, 204, 0.95);
  border-radius: 1.05rem;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.02),
    0 14px 24px rgba(15, 23, 42, 0.04);
}

.applicant-applications-page__empty-highlight-icon {
  display: inline-grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.9rem;
  background: rgba(29, 107, 58, 0.1);
  color: #1d6b3a;
}

.applicant-applications-page__empty-highlight-icon i {
  font-size: 1rem;
}

.applicant-applications-page__empty-highlight-copy {
  display: grid;
  gap: 0.3rem;
}

.applicant-applications-page__empty-highlight-copy strong {
  color: #193128;
  font-size: 0.86rem;
  font-weight: 800;
}

.applicant-applications-page__empty-highlight-copy p {
  color: #66796f;
  font-size: 0.78rem;
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .applicant-applications-page__grid {
    grid-template-columns: 1fr;
  }

  .applicant-applications-page__rail {
    position: static;
    top: auto;
  }

  .applicant-applications-page__profile-card,
  .applicant-applications-page__panel {
    min-height: auto;
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

  .applicant-applications-page__card-top {
    display: grid;
    grid-template-columns: 1fr;
  }

  .applicant-panel__head--applications {
    align-items: start;
  }

  .applicant-applications-page__mini-list {
    grid-template-columns: 1fr;
  }

  .applicant-applications-page__mini-item {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .applicant-applications-page__mini-item strong {
    text-align: left;
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
