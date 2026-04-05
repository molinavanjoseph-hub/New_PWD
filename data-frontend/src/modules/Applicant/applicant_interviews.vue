<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  interviews: {
    type: Array,
    default: () => [],
  },
  activeActionId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['confirm-interview', 'request-reschedule', 'notify'])

const openRescheduleInterviewId = ref('')
const rescheduleReason = ref('')
const requestedScheduleAt = ref('')
const selectedScheduleOptionByInterviewId = ref({})

const formatInterviewType = (value) =>
  String(value || 'initial').trim().toLowerCase() === 'final' ? 'Final Interview' : 'Initial Interview'

const formatInterviewMode = (value) =>
  String(value || 'in-person').trim().toLowerCase() === 'online' ? 'Online interview' : 'In-person interview'

const normalizeInterviewScheduleStatus = (value) => String(value || 'scheduled').trim().toLowerCase()

const normalizeInterviewResponseStatus = (record = {}) =>
  String(record?.applicantResponseStatus || record?.applicant_response_status || 'pending').trim().toLowerCase() || 'pending'
const normalizeAvailableScheduleOptions = (record = {}) => {
  const source = record?.availableScheduleOptions || record?.available_schedule_options
  if (!Array.isArray(source)) return []
  return [...new Set(source.map((value) => String(value || '').trim()).filter(Boolean))]
}

const formatInterviewStatus = (record = {}) => {
  const normalizedScheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const normalizedResponseStatus = normalizeInterviewResponseStatus(record)

  if (normalizedScheduleStatus === 'completed') return 'Completed'
  if (normalizedResponseStatus === 'reschedule_rejected') return 'Rejected'
  if (normalizedScheduleStatus === 'cancelled') return 'Cancelled'
  if (normalizedResponseStatus === 'confirmed') return 'Confirmed'
  if (normalizedResponseStatus === 'reschedule_requested') return 'Reschedule Requested'
  return 'Awaiting Confirmation'
}

const formatInterviewWhen = (value) => {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled'
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const toDateTimeLocalValue = (value) => {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) return ''

  const offset = parsed.getTimezoneOffset()
  const adjusted = new Date(parsed.getTime() - (offset * 60 * 1000))
  return adjusted.toISOString().slice(0, 16)
}

const minScheduleDateTime = computed(() => {
  const now = new Date()
  now.setSeconds(0, 0)
  const offset = now.getTimezoneOffset()
  const adjusted = new Date(now.getTime() - (offset * 60 * 1000))
  return adjusted.toISOString().slice(0, 16)
})

const statusClass = (record = {}) => {
  const normalizedScheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const normalizedResponseStatus = normalizeInterviewResponseStatus(record)

  if (normalizedScheduleStatus === 'completed' || normalizedResponseStatus === 'confirmed') return 'is-success'
  if (normalizedScheduleStatus === 'cancelled' || normalizedResponseStatus === 'reschedule_rejected') return 'is-danger'
  if (normalizedResponseStatus === 'reschedule_requested') return 'is-warning'
  return 'is-info'
}
const isCancelledInterview = (record = {}) =>
  normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status) === 'cancelled'
const isCompletedInterview = (record = {}) =>
  normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status) === 'completed'
const getInterviewCancellationMessage = (record = {}) =>
  String(record?.businessDecisionReason || record?.business_decision_reason || '').trim()
  || 'This interview was cancelled by the business owner.'

const canConfirmInterview = (record = {}) => {
  const normalizedScheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const normalizedResponseStatus = normalizeInterviewResponseStatus(record)
  return !['completed', 'cancelled'].includes(normalizedScheduleStatus)
    && !['confirmed', 'reschedule_requested'].includes(normalizedResponseStatus)
}

const canRequestReschedule = (record = {}) => {
  const normalizedScheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const normalizedResponseStatus = normalizeInterviewResponseStatus(record)
  return !['completed', 'cancelled'].includes(normalizedScheduleStatus)
    && !['confirmed', 'reschedule_requested'].includes(normalizedResponseStatus)
}

const getSelectedScheduleOption = (record = {}) => {
  const interviewId = String(record?.id || '').trim()
  const availableScheduleOptions = normalizeAvailableScheduleOptions(record)
  const selectedValue = String(selectedScheduleOptionByInterviewId.value[interviewId] || '').trim()

  if (availableScheduleOptions.includes(selectedValue)) return selectedValue
  if (availableScheduleOptions.includes(String(record?.scheduledAt || '').trim())) return String(record?.scheduledAt || '').trim()
  return availableScheduleOptions[0] || String(record?.scheduledAt || '').trim()
}

const updateSelectedScheduleOption = (interviewId, nextValue) => {
  const normalizedInterviewId = String(interviewId || '').trim()
  if (!normalizedInterviewId) return

  selectedScheduleOptionByInterviewId.value = {
    ...selectedScheduleOptionByInterviewId.value,
    [normalizedInterviewId]: String(nextValue || '').trim(),
  }
}

const openRescheduleForm = (record = {}) => {
  openRescheduleInterviewId.value = String(record?.id || '').trim()
  requestedScheduleAt.value = toDateTimeLocalValue(record?.requestedScheduleAt || record?.requested_schedule_at || record?.scheduledAt)
  rescheduleReason.value = String(record?.applicantResponseReason || record?.applicant_response_reason || '').trim()
}

const closeRescheduleForm = () => {
  openRescheduleInterviewId.value = ''
  requestedScheduleAt.value = ''
  rescheduleReason.value = ''
}
const notifyInterviewFormMessage = (text, kind = 'warning', title = '') => {
  emit('notify', {
    text: String(text || '').trim(),
    kind: String(kind || 'warning').trim() || 'warning',
    title: String(title || '').trim(),
  })
}

const submitConfirmInterview = (record = {}) => {
  emit('confirm-interview', {
    interviewId: String(record?.id || '').trim(),
    applicationId: String(record?.applicationId || '').trim(),
    interviewType: String(record?.interviewType || '').trim(),
    selectedScheduleAt: getSelectedScheduleOption(record),
  })
}

const submitRescheduleRequest = (record = {}) => {
  const trimmedReason = String(rescheduleReason.value || '').trim()
  if (!trimmedReason) {
    notifyInterviewFormMessage('Enter a reason before sending a reschedule request.', 'warning', 'Reason required')
    return
  }

  const requestedTimestamp = Date.parse(String(requestedScheduleAt.value || '').trim())
  if (!Number.isFinite(requestedTimestamp) || requestedTimestamp < Date.now()) {
    notifyInterviewFormMessage('Choose a current or future date and time for the reschedule request.', 'warning', 'Invalid date')
    return
  }

  const currentScheduledTimestamp = Date.parse(String(record?.scheduledAt || record?.scheduled_at || '').trim())

  if (
    Number.isFinite(requestedTimestamp)
    && Number.isFinite(currentScheduledTimestamp)
    && requestedTimestamp === currentScheduledTimestamp
  ) {
    notifyInterviewFormMessage(
      'Please change the interview date and time before submitting your reschedule request.',
      'warning',
      'Schedule unchanged',
    )
    return
  }

  emit('request-reschedule', {
    interviewId: String(record?.id || '').trim(),
    applicationId: String(record?.applicationId || '').trim(),
    interviewType: String(record?.interviewType || '').trim(),
    reason: trimmedReason,
    requestedScheduleAt: requestedScheduleAt.value,
  })
  closeRescheduleForm()
}
</script>

<template>
  <section class="applicant-interviews-page">
    <section class="applicant-interviews-page__grid">
      <aside class="applicant-interviews-page__rail">
        <article class="applicant-interviews-page__profile-card applicant-panel">
          <div class="applicant-interviews-page__profile-head">
            <span class="applicant-interviews-page__profile-badge">Applicant</span>
            <span class="applicant-interviews-page__profile-status">Interview Tracker</span>
          </div>

          <div class="applicant-interviews-page__identity">
            <p class="applicant-interviews-page__eyebrow">Interviews</p>
            <h2>Employer Schedules</h2>
            <p>Review the business that invited you, the role you applied for, and your interview schedule.</p>
          </div>

          <div class="applicant-interviews-page__mini-list">
            <div class="applicant-interviews-page__mini-item">
              <span><i class="bi bi-calendar-check" aria-hidden="true" /> Total Interviews</span>
              <strong>{{ interviews.length }}</strong>
            </div>
            <div class="applicant-interviews-page__mini-item">
              <span><i class="bi bi-hourglass-split" aria-hidden="true" /> Scheduled</span>
              <strong>{{ interviews.filter((entry) => String(entry.scheduleStatus || '').toLowerCase() === 'scheduled').length }}</strong>
            </div>
            <div class="applicant-interviews-page__mini-item">
              <span><i class="bi bi-check2-circle" aria-hidden="true" /> Completed</span>
              <strong>{{ interviews.filter((entry) => String(entry.scheduleStatus || '').toLowerCase() === 'completed').length }}</strong>
            </div>
          </div>
        </article>
      </aside>

      <article class="applicant-interviews-page__panel applicant-panel">
        <div class="applicant-panel__head">
          <div>
            <h3>Interview Schedule</h3>
            <span>Live updates from the business workspace</span>
          </div>
        </div>

        <div v-if="interviews.length" class="applicant-interviews-page__list">
          <article
            v-for="interview in interviews"
            :key="interview.id"
            class="applicant-interviews-page__card"
            :class="{
              'applicant-interviews-page__card--inactive': isCancelledInterview(interview),
              'applicant-interviews-page__card--compact': isCompletedInterview(interview),
            }"
          >
            <div class="applicant-interviews-page__card-top">
              <div>
                <h4>{{ interview.workspaceOwnerName || 'Business Workspace' }}</h4>
                <p>{{ interview.jobTitle || 'Applied Role' }}</p>
              </div>
              <span class="applicant-interviews-page__status applicant-status-pill" :class="statusClass(interview)">
                {{ formatInterviewStatus(interview) }}
              </span>
            </div>

            <div class="applicant-interviews-page__meta">
              <span><i class="bi bi-person-workspace" /> {{ formatInterviewType(interview.interviewType) }}</span>
              <span><i class="bi bi-display" /> {{ formatInterviewMode(interview.mode) }}</span>
              <span><i class="bi bi-calendar-event" /> {{ formatInterviewWhen(interview.scheduledAt) }}</span>
            </div>

            <div
              v-if="isCompletedInterview(interview)"
              class="applicant-interviews-page__response-box applicant-interviews-page__response-box--compact"
            >
              <strong>Interview completed</strong>
              <span>This interview has already been finished. Full scheduling details are hidden to keep the page cleaner.</span>
            </div>

            <div
              v-else-if="isCancelledInterview(interview)"
              class="applicant-interviews-page__response-box applicant-interviews-page__response-box--danger"
            >
              <strong>Interview Discontinued</strong>
              <span>{{ getInterviewCancellationMessage(interview) }}</span>
            </div>

            <div v-if="!isCompletedInterview(interview)" class="applicant-interviews-page__detail-grid">
              <div class="applicant-interviews-page__detail-item">
                <span>Interviewer</span>
                <strong>{{ interview.interviewer || 'To be announced' }}</strong>
              </div>
              <div class="applicant-interviews-page__detail-item">
                <span>Location / Link</span>
                <strong>{{ interview.locationOrLink || 'Will be shared by the business' }}</strong>
              </div>
              <div class="applicant-interviews-page__detail-item applicant-interviews-page__detail-item--wide">
                <span>Notes</span>
                <strong>{{ interview.notes || 'No additional interview instructions yet.' }}</strong>
              </div>
            </div>

            <div
              v-if="!isCompletedInterview(interview) && (interview.requestedScheduleAt || interview.applicantResponseReason || interview.businessDecisionReason)"
              class="applicant-interviews-page__response-box"
            >
              <strong>Interview Response</strong>
              <span v-if="interview.requestedScheduleAt">Requested schedule: {{ formatInterviewWhen(interview.requestedScheduleAt) }}</span>
              <span v-if="interview.applicantResponseReason">Reschedule reason: {{ interview.applicantResponseReason }}</span>
              <span v-if="interview.businessDecisionReason && !isCancelledInterview(interview)">Business note: {{ interview.businessDecisionReason }}</span>
            </div>

            <div
              v-if="!isCompletedInterview(interview) && normalizeAvailableScheduleOptions(interview).length"
              class="applicant-interviews-page__response-box"
            >
              <strong>Available Reschedule Dates</strong>
              <span>Select one of the dates shared by the business owner, then confirm your interview.</span>
              <label class="applicant-interviews-page__form-field">
                <span>Available date options</span>
                <select
                  :value="getSelectedScheduleOption(interview)"
                  :disabled="activeActionId === interview.id"
                  @change="updateSelectedScheduleOption(interview.id, $event.target.value)"
                >
                  <option
                    v-for="scheduleOption in normalizeAvailableScheduleOptions(interview)"
                    :key="scheduleOption"
                    :value="scheduleOption"
                  >
                    {{ formatInterviewWhen(scheduleOption) }}
                  </option>
                </select>
              </label>
            </div>

            <div
              v-if="!isCompletedInterview(interview) && (canConfirmInterview(interview) || canRequestReschedule(interview))"
              class="applicant-interviews-page__actions"
            >
              <button
                v-if="canConfirmInterview(interview)"
                type="button"
                class="applicant-interviews-page__action applicant-interviews-page__action--primary"
                :disabled="activeActionId === interview.id"
                @click="submitConfirmInterview(interview)"
              >
                {{ activeActionId === interview.id ? 'Saving...' : 'Confirm Interview' }}
              </button>
              <button
                v-if="canRequestReschedule(interview)"
                type="button"
                class="applicant-interviews-page__action applicant-interviews-page__action--secondary"
                :disabled="activeActionId === interview.id"
                @click="openRescheduleInterviewId === interview.id ? closeRescheduleForm() : openRescheduleForm(interview)"
              >
                {{ openRescheduleInterviewId === interview.id ? 'Close Form' : 'Request Reschedule' }}
              </button>
            </div>

            <form
              v-if="!isCompletedInterview(interview) && openRescheduleInterviewId === interview.id && canRequestReschedule(interview)"
              class="applicant-interviews-page__reschedule-form"
              @submit.prevent="submitRescheduleRequest(interview)"
            >
              <label class="applicant-interviews-page__form-field">
                <span>Preferred new date &amp; time</span>
                <input
                  v-model="requestedScheduleAt"
                  type="datetime-local"
                  :min="minScheduleDateTime"
                  required
                />
              </label>
              <label class="applicant-interviews-page__form-field applicant-interviews-page__form-field--wide">
                <span>Reason for rescheduling</span>
                <textarea
                  v-model.trim="rescheduleReason"
                  rows="3"
                  placeholder="Explain why you need another interview time."
                  required
                />
              </label>
              <div class="applicant-interviews-page__form-actions">
                <button
                  type="submit"
                  class="applicant-interviews-page__action applicant-interviews-page__action--primary"
                  :disabled="activeActionId === interview.id"
                >
                  {{ activeActionId === interview.id ? 'Sending...' : 'Send Request' }}
                </button>
                <button
                  type="button"
                  class="applicant-interviews-page__action applicant-interviews-page__action--secondary"
                  :disabled="activeActionId === interview.id"
                  @click="closeRescheduleForm()"
                >
                  Cancel
                </button>
              </div>
            </form>
          </article>
        </div>

        <div v-else class="applicant-interviews-page__empty applicant-dashboard-empty">
          <i class="bi bi-calendar-x" aria-hidden="true" />
          <h3>No interview schedules yet</h3>
          <p>When a business schedules your interview in Firestore, it will appear here.</p>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped src="@/components/applicant_dashboard.css"></style>

<style scoped>
.applicant-interviews-page {
  display: grid;
  gap: 1.05rem;
  padding: 0 1.25rem;
  justify-items: start;
  width: 100%;
}

.applicant-interviews-page__grid {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  width: 100%;
  max-width: none;
}

.applicant-interviews-page__rail {
  display: grid;
  gap: 1rem;
}

.applicant-interviews-page__profile-card,
.applicant-interviews-page__panel {
  display: grid;
  gap: 1.05rem;
  border: 1px solid rgba(112, 168, 136, 0.16);
  border-radius: 0.72rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 251, 247, 0.94) 100%);
  box-shadow:
    0 16px 36px rgba(79, 129, 102, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  padding: 1.15rem 1.2rem;
}

.applicant-interviews-page__profile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.applicant-interviews-page__profile-badge,
.applicant-interviews-page__profile-status {
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.45rem;
  padding: 0.26rem 0.62rem;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
}

.applicant-interviews-page__profile-badge {
  color: #4a5b54;
  background: #f8faf8;
}

.applicant-interviews-page__profile-status {
  color: #1d6b3a;
  background: #f1f9f4;
}

.applicant-interviews-page__identity,
.applicant-interviews-page__identity h2,
.applicant-interviews-page__identity p,
.applicant-interviews-page__eyebrow,
.applicant-interviews-page__card h4,
.applicant-interviews-page__card p {
  margin: 0;
}

.applicant-interviews-page__eyebrow {
  color: #7b8a83;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-interviews-page__identity h2 {
  margin-top: 0.2rem;
  color: #20312a;
  font-size: 1.15rem;
}

.applicant-interviews-page__identity p {
  margin-top: 0.28rem;
  color: #63756d;
  font-size: 0.78rem;
  line-height: 1.55;
}

.applicant-interviews-page__mini-list {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid rgba(229, 233, 230, 0.95);
  padding-top: 0.75rem;
}

.applicant-interviews-page__mini-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.62rem;
  background: #ffffff;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
}

.applicant-interviews-page__mini-item:last-child {
  border-bottom: 1px solid rgba(205, 216, 226, 0.92);
}

.applicant-interviews-page__mini-item span {
  color: #707f78;
  font-size: 0.72rem;
  font-weight: 600;
}

.applicant-interviews-page__mini-item span i {
  margin-right: 0.35rem;
}

.applicant-interviews-page__mini-item strong {
  color: #24342d;
  font-size: 0.74rem;
  font-weight: 700;
  text-align: right;
}

.applicant-interviews-page__list {
  display: grid;
  gap: 1.05rem;
}

.applicant-interviews-page__card {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.72rem;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.applicant-interviews-page__card--inactive {
  border-color: rgba(208, 215, 211, 0.95);
  background: linear-gradient(180deg, #fbfcfb 0%, #f4f7f5 100%);
  box-shadow: none;
}

.applicant-interviews-page__card--compact {
  gap: 0.75rem;
  padding: 0.95rem 1rem;
}

.applicant-interviews-page__card-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.applicant-interviews-page__card h4 {
  color: #20312a;
  font-size: 1rem;
  font-weight: 800;
}

.applicant-interviews-page__card p {
  margin-top: 0.28rem;
  color: #63756d;
  font-size: 0.8rem;
}

.applicant-interviews-page__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.1rem;
  padding: 0.38rem 0.82rem;
  border: 1px solid rgba(201, 211, 205, 0.95);
  background: #ffffff;
  color: #1d6b3a;
  font-size: 0.72rem;
  font-weight: 700;
}

.applicant-interviews-page__status.is-info {
  background: #eff6ff;
  border-color: rgba(191, 219, 254, 0.95);
  color: #1d4ed8;
}

.applicant-interviews-page__status.is-success {
  background: #ecfdf3;
  border-color: rgba(167, 243, 208, 0.95);
  color: #047857;
}

.applicant-interviews-page__status.is-warning {
  background: #fff7ed;
  border-color: rgba(253, 230, 138, 0.95);
  color: #b45309;
}

.applicant-interviews-page__status.is-danger {
  background: #fef2f2;
  border-color: rgba(254, 205, 211, 0.95);
  color: #b91c1c;
}

.applicant-interviews-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.applicant-interviews-page__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.5rem;
  padding: 0.22rem 0.5rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.4rem;
  background: #f8fbf9;
  color: #355646;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.applicant-interviews-page__meta span i {
  font-size: 0.72rem;
}

.applicant-interviews-page__detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.applicant-interviews-page__detail-item {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.62rem;
  background: #fbfcfa;
}

.applicant-interviews-page__detail-item--wide {
  grid-column: 1 / -1;
}

.applicant-interviews-page__detail-item span {
  color: #7b8781;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.applicant-interviews-page__detail-item strong {
  color: #24342d;
  font-size: 0.84rem;
  line-height: 1.55;
}

.applicant-interviews-page__response-box,
.applicant-interviews-page__reschedule-form {
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.62rem;
  background: #fbfcfa;
}

.applicant-interviews-page__response-box strong {
  color: #20312a;
  font-size: 0.84rem;
}

.applicant-interviews-page__response-box span {
  color: #63756d;
  font-size: 0.78rem;
  line-height: 1.55;
}

.applicant-interviews-page__response-box--danger {
  border-color: rgba(248, 113, 113, 0.28);
  background: rgba(254, 242, 242, 0.92);
}

.applicant-interviews-page__response-box--danger strong,
.applicant-interviews-page__response-box--danger span {
  color: #991b1b;
}

.applicant-interviews-page__response-box--compact {
  gap: 0.35rem;
  padding: 0.75rem 0.85rem;
  background: rgba(236, 253, 243, 0.75);
  border-color: rgba(134, 239, 172, 0.45);
}

.applicant-interviews-page__actions,
.applicant-interviews-page__form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.applicant-interviews-page__action {
  min-height: 2.8rem;
  padding: 0.72rem 1rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.58rem;
  background: #ffffff;
  color: #24342d;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.applicant-interviews-page__action--primary {
  background: linear-gradient(135deg, #2f6a49 0%, #4f8c67 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(47, 106, 73, 0.18);
}

.applicant-interviews-page__action--secondary {
  background: #ffffff;
}

.applicant-interviews-page__action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.applicant-interviews-page__action--primary:hover:not(:disabled) {
  box-shadow: 0 16px 28px rgba(47, 106, 73, 0.2);
}

.applicant-interviews-page__action:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.applicant-interviews-page__form-field {
  display: grid;
  gap: 0.35rem;
}

.applicant-interviews-page__form-field span {
  color: #64756d;
  font-size: 0.74rem;
  font-weight: 700;
}

.applicant-interviews-page__form-field input,
.applicant-interviews-page__form-field textarea,
.applicant-interviews-page__form-field select {
  width: 100%;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.58rem;
  background: #ffffff;
  color: #24342d;
  font: inherit;
  padding: 0.7rem 0.85rem;
}

.applicant-interviews-page__form-field textarea {
  resize: vertical;
}

.applicant-interviews-page__panel {
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  min-height: calc(100vh - 10.5rem);
}

.applicant-interviews-page__empty {
  min-height: 100%;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.55rem;
  text-align: center;
  color: #62706a;
}

.applicant-interviews-page__empty i {
  font-size: 1.6rem;
  color: #1b8a54;
}

.applicant-interviews-page__empty h3,
.applicant-interviews-page__empty p {
  margin: 0;
}

@media (max-width: 1080px) {
  .applicant-interviews-page__grid,
  .applicant-interviews-page__detail-grid {
    grid-template-columns: 1fr;
  }

  .applicant-interviews-page__panel {
    min-height: 24rem;
  }
}

@media (max-width: 720px) {
  .applicant-interviews-page {
    padding: 0 0.85rem;
  }

  .applicant-interviews-page__card-top {
    grid-template-columns: 1fr;
    display: grid;
  }

  .applicant-interviews-page__card {
    padding: 1rem;
  }

  .applicant-interviews-page__meta span,
  .applicant-interviews-page__action {
    width: 100%;
    justify-content: center;
  }

  .applicant-interviews-page__actions,
  .applicant-interviews-page__form-actions {
    flex-direction: column;
  }
}
</style>
