<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  interviews: { type: Array, default: () => [] },
  activeActionId: { type: String, default: '' },
})

const emit = defineEmits(['confirm-interview', 'request-reschedule', 'notify'])

const searchQuery = ref('')
const activeFilter = ref('all')
const selectedInterviewId = ref('')
const openRescheduleInterviewId = ref('')
const rescheduleReason = ref('')
const requestedScheduleAt = ref('')
const selectedScheduleOptionByInterviewId = ref({})
const isViewerLoading = ref(false)

const VIEWER_SWITCH_DELAY_MS = 1000

let viewerSwitchToken = 0
let viewerSwitchTimeoutId = null

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
  const scheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeInterviewResponseStatus(record)
  if (scheduleStatus === 'completed') return 'Completed'
  if (responseStatus === 'reschedule_rejected') return 'Rejected'
  if (scheduleStatus === 'cancelled') return 'Cancelled'
  if (responseStatus === 'confirmed') return 'Confirmed'
  if (responseStatus === 'reschedule_requested') return 'Reschedule Requested'
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
  return new Date(parsed.getTime() - (offset * 60 * 1000)).toISOString().slice(0, 16)
}

const parseInterviewTimestamp = (value) => {
  const parsed = Date.parse(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

const getInterviewActivityTime = (record = {}) =>
  Math.max(
    parseInterviewTimestamp(record?.updatedAt),
    parseInterviewTimestamp(record?.updated_at),
    parseInterviewTimestamp(record?.applicantRespondedAt),
    parseInterviewTimestamp(record?.applicant_responded_at),
    parseInterviewTimestamp(record?.businessDecidedAt),
    parseInterviewTimestamp(record?.business_decided_at),
    parseInterviewTimestamp(record?.requestedScheduleAt),
    parseInterviewTimestamp(record?.requested_schedule_at),
    parseInterviewTimestamp(record?.scheduledAt),
    parseInterviewTimestamp(record?.scheduled_at),
    parseInterviewTimestamp(record?.createdAt),
    parseInterviewTimestamp(record?.created_at),
  )

const formatInterviewActivityDate = (value) => {
  const parsed = Number(value) || parseInterviewTimestamp(value)
  if (!parsed) return 'Recently'
  return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const getInterviewCancellationMessage = (record = {}) =>
  String(record?.businessDecisionReason || record?.business_decision_reason || '').trim()
  || 'This interview was cancelled by the business owner.'
const isCancelledInterview = (record = {}) =>
  normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status) === 'cancelled'
const isCompletedInterview = (record = {}) =>
  normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status) === 'completed'

const statusClass = (record = {}) => {
  const scheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeInterviewResponseStatus(record)
  if (scheduleStatus === 'completed' || responseStatus === 'confirmed') return 'is-success'
  if (scheduleStatus === 'cancelled' || responseStatus === 'reschedule_rejected') return 'is-danger'
  if (responseStatus === 'reschedule_requested') return 'is-warning'
  return 'is-info'
}

const canConfirmInterview = (record = {}) => {
  const scheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeInterviewResponseStatus(record)
  return !['completed', 'cancelled'].includes(scheduleStatus) && !['confirmed', 'reschedule_requested'].includes(responseStatus)
}

const canRequestReschedule = (record = {}) => {
  const scheduleStatus = normalizeInterviewScheduleStatus(record?.scheduleStatus || record?.schedule_status)
  const responseStatus = normalizeInterviewResponseStatus(record)
  return !['completed', 'cancelled'].includes(scheduleStatus) && !['confirmed', 'reschedule_requested'].includes(responseStatus)
}

const getSelectedScheduleOption = (record = {}) => {
  const interviewId = String(record?.id || '').trim()
  const availableScheduleOptions = normalizeAvailableScheduleOptions(record)
  const selectedValue = String(selectedScheduleOptionByInterviewId.value[interviewId] || '').trim()
  if (availableScheduleOptions.includes(selectedValue)) return selectedValue
  if (availableScheduleOptions.includes(String(record?.scheduledAt || record?.scheduled_at || '').trim())) {
    return String(record?.scheduledAt || record?.scheduled_at || '').trim()
  }
  return availableScheduleOptions[0] || String(record?.scheduledAt || record?.scheduled_at || '').trim()
}

const clearViewerSwitchTimeout = () => {
  if (viewerSwitchTimeoutId) {
    clearTimeout(viewerSwitchTimeoutId)
    viewerSwitchTimeoutId = null
  }
}

const selectInterview = (interviewId, options = {}) => {
  const normalizedInterviewId = String(interviewId || '').trim()
  if (!normalizedInterviewId) return

  const immediate = options?.immediate === true
  const isSameSelection = normalizedInterviewId === selectedInterviewId.value

  selectedInterviewId.value = normalizedInterviewId

  if (immediate || VIEWER_SWITCH_DELAY_MS <= 0) {
    clearViewerSwitchTimeout()
    isViewerLoading.value = false
    return
  }

  if (isSameSelection && !isViewerLoading.value) {
    return
  }

  clearViewerSwitchTimeout()
  isViewerLoading.value = true

  const currentToken = ++viewerSwitchToken
  viewerSwitchTimeoutId = setTimeout(() => {
    if (currentToken !== viewerSwitchToken) return
    isViewerLoading.value = false
    viewerSwitchTimeoutId = null
  }, VIEWER_SWITCH_DELAY_MS)
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
  requestedScheduleAt.value = toDateTimeLocalValue(
    record?.requestedScheduleAt || record?.requested_schedule_at || record?.scheduledAt || record?.scheduled_at,
  )
  rescheduleReason.value = String(record?.applicantResponseReason || record?.applicant_response_reason || '').trim()
}

const closeRescheduleForm = () => {
  openRescheduleInterviewId.value = ''
  requestedScheduleAt.value = ''
  rescheduleReason.value = ''
}
const notifyInterviewFormMessage = (text, kind = 'warning', title = '') => {
  emit('notify', { text: String(text || '').trim(), kind: String(kind || 'warning').trim(), title: String(title || '').trim() })
}

const submitConfirmInterview = (record = {}) => {
  emit('confirm-interview', {
    interviewId: String(record?.id || '').trim(),
    applicationId: String(record?.applicationId || record?.application_id || '').trim(),
    interviewType: String(record?.interviewType || record?.interview_type || '').trim(),
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
  if (Number.isFinite(requestedTimestamp) && Number.isFinite(currentScheduledTimestamp) && requestedTimestamp === currentScheduledTimestamp) {
    notifyInterviewFormMessage('Please change the interview date and time before submitting your reschedule request.', 'warning', 'Schedule unchanged')
    return
  }

  emit('request-reschedule', {
    interviewId: String(record?.id || '').trim(),
    applicationId: String(record?.applicationId || record?.application_id || '').trim(),
    interviewType: String(record?.interviewType || record?.interview_type || '').trim(),
    reason: trimmedReason,
    requestedScheduleAt: requestedScheduleAt.value,
  })
  closeRescheduleForm()
}

const minScheduleDateTime = computed(() => {
  const now = new Date()
  now.setSeconds(0, 0)
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - (offset * 60 * 1000)).toISOString().slice(0, 16)
})

const getCompanyInitials = (value) =>
  String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join('') || 'IN'

const getInterviewThreadPreview = (record = {}) => {
  const responseStatus = normalizeInterviewResponseStatus(record)
  const requestedScheduleLabel = String(record?.requestedScheduleAt || record?.requested_schedule_at || '').trim()
  const businessNote = String(record?.businessDecisionReason || record?.business_decision_reason || '').trim()
  const availableOptions = normalizeAvailableScheduleOptions(record)
  if (isCompletedInterview(record)) return 'This interview is already completed.'
  if (isCancelledInterview(record)) return getInterviewCancellationMessage(record)
  if (responseStatus === 'confirmed') return `You confirmed attendance for ${formatInterviewWhen(record?.scheduledAt || record?.scheduled_at)}.`
  if (responseStatus === 'reschedule_requested') {
    return requestedScheduleLabel
      ? `You requested a new schedule for ${formatInterviewWhen(requestedScheduleLabel)}.`
      : 'You requested a new interview schedule.'
  }
  if (responseStatus === 'reschedule_rejected') return businessNote || 'Your reschedule request was not approved.'
  if (availableOptions.length > 1) return `${availableOptions.length} alternate interview dates were shared by the employer.`
  if (businessNote) return businessNote
  return `Scheduled for ${formatInterviewWhen(record?.scheduledAt || record?.scheduled_at)}. Review and confirm your interview.`
}

const getInterviewFilterId = (record = {}) => {
  const responseStatus = normalizeInterviewResponseStatus(record)
  if (isCancelledInterview(record) || responseStatus === 'reschedule_rejected') return 'cancelled'
  if (isCompletedInterview(record)) return 'completed'
  if (responseStatus === 'confirmed') return 'confirmed'
  return 'awaiting'
}

const normalizedInterviews = computed(() =>
  (Array.isArray(props.interviews) ? props.interviews : [])
    .map((interview) => {
      const companyLabel = String(interview?.workspaceOwnerName || interview?.workspace_owner_name || 'Business Workspace').trim() || 'Business Workspace'
      const roleLabel = String(interview?.jobTitle || interview?.job_title || 'Applied Role').trim() || 'Applied Role'
      const scheduledAtValue = String(interview?.scheduledAt || interview?.scheduled_at || '').trim()
      const activityValue = getInterviewActivityTime(interview)
      return {
        ...interview,
        id: String(interview?.id || '').trim(),
        companyLabel,
        roleLabel,
        typeLabel: formatInterviewType(interview?.interviewType || interview?.interview_type),
        modeLabel: formatInterviewMode(interview?.mode || interview?.interviewMode || interview?.interview_mode),
        statusLabel: formatInterviewStatus(interview),
        statusToneClass: statusClass(interview),
        scheduledAtLabel: formatInterviewWhen(scheduledAtValue),
        interviewerLabel: String(interview?.interviewer || '').trim() || 'To be announced',
        locationLabel: String(interview?.locationOrLink || interview?.location_or_link || '').trim() || 'Will be shared by the business',
        notesLabel: String(interview?.notes || '').trim() || 'No additional interview instructions yet.',
        businessNote: String(interview?.businessDecisionReason || interview?.business_decision_reason || '').trim(),
        requestedScheduleLabel: String(interview?.requestedScheduleAt || interview?.requested_schedule_at || '').trim()
          ? formatInterviewWhen(interview?.requestedScheduleAt || interview?.requested_schedule_at)
          : '',
        avatarImageUrl: String(interview?.logoUrl || interview?.avatarImageUrl || interview?.companyLogoUrl || '').trim(),
        preview: getInterviewThreadPreview(interview),
        filterId: getInterviewFilterId(interview),
        activityValue,
        activityLabel: formatInterviewActivityDate(activityValue || scheduledAtValue),
        avatarInitials: getCompanyInitials(companyLabel),
        availableScheduleOptions: normalizeAvailableScheduleOptions(interview),
      }
    })
    .filter((interview) => interview.id)
    .sort((left, right) => (right.activityValue || 0) - (left.activityValue || 0)),
)

const stats = computed(() => ({
  total: normalizedInterviews.value.length,
  awaiting: normalizedInterviews.value.filter((interview) => interview.filterId === 'awaiting').length,
  confirmed: normalizedInterviews.value.filter((interview) => interview.filterId === 'confirmed').length,
  closed: normalizedInterviews.value.filter((interview) => ['completed', 'cancelled'].includes(interview.filterId)).length,
}))

const filters = computed(() => [
  { id: 'all', label: 'All', count: normalizedInterviews.value.length },
  { id: 'awaiting', label: 'Awaiting', count: normalizedInterviews.value.filter((item) => item.filterId === 'awaiting').length },
  { id: 'confirmed', label: 'Confirmed', count: normalizedInterviews.value.filter((item) => item.filterId === 'confirmed').length },
  { id: 'completed', label: 'Completed', count: normalizedInterviews.value.filter((item) => item.filterId === 'completed').length },
  { id: 'cancelled', label: 'Closed', count: normalizedInterviews.value.filter((item) => item.filterId === 'cancelled').length },
])

const filteredInterviews = computed(() => {
  const query = String(searchQuery.value || '').trim().toLowerCase()
  return normalizedInterviews.value.filter((interview) => {
    const matchesFilter = activeFilter.value === 'all' ? true : interview.filterId === activeFilter.value
    if (!matchesFilter) return false
    if (!query) return true
    return [
      interview.companyLabel,
      interview.roleLabel,
      interview.typeLabel,
      interview.modeLabel,
      interview.statusLabel,
      interview.preview,
      interview.interviewerLabel,
      interview.locationLabel,
      interview.notesLabel,
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })
})

const selectedInterview = computed(() =>
  filteredInterviews.value.find((interview) => interview.id === selectedInterviewId.value) || filteredInterviews.value[0] || null,
)

watch(filteredInterviews, (items) => {
  const nextItems = Array.isArray(items) ? items : []
  if (!nextItems.length) {
    clearViewerSwitchTimeout()
    isViewerLoading.value = false
    selectedInterviewId.value = ''
    return
  }

  if (!nextItems.some((item) => item.id === selectedInterviewId.value)) {
    selectInterview(nextItems[0]?.id || '', { immediate: true })
  }
}, { immediate: true })

watch(selectedInterviewId, (nextId) => {
  if (openRescheduleInterviewId.value && openRescheduleInterviewId.value !== String(nextId || '').trim()) {
    closeRescheduleForm()
  }
})

onBeforeUnmount(() => {
  clearViewerSwitchTimeout()
})
</script>

<template>
  <section class="applicant-interviews-page">
  

    <div class="applicant-interviews-page__shell">
      <aside class="applicant-interviews-page__list-pane">
        <div class="applicant-interviews-page__filters">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            :class="{ 'is-active': activeFilter === filter.id }"
            @click="activeFilter = filter.id"
          >
            <span>{{ filter.label }}</span>
            <strong>{{ filter.count }}</strong>
          </button>
        </div>

        <div v-if="filteredInterviews.length" class="applicant-interviews-page__threads">
          <button
            v-for="interview in filteredInterviews"
            :key="interview.id"
            type="button"
            class="applicant-interviews-page__thread"
            :class="{ 'is-active': selectedInterview?.id === interview.id }"
            @click="selectInterview(interview.id)"
          >
            <span class="applicant-interviews-page__avatar" aria-hidden="true">
              <img
                v-if="interview.avatarImageUrl"
                :src="interview.avatarImageUrl"
                alt=""
                class="applicant-interviews-page__avatar-image"
              />
              <template v-else>{{ interview.avatarInitials }}</template>
            </span>
            <span class="applicant-interviews-page__thread-copy">
              <span class="applicant-interviews-page__thread-top">
                <strong>{{ interview.companyLabel }}</strong>
                <small>{{ interview.activityLabel }}</small>
              </span>
              <span class="applicant-interviews-page__thread-subject">{{ interview.roleLabel }}</span>
              <span class="applicant-interviews-page__thread-preview">{{ interview.preview }}</span>
              <span class="applicant-interviews-page__thread-tags">
                <span>{{ interview.typeLabel }}</span>
                <span>{{ interview.statusLabel }}</span>
              </span>
            </span>
          </button>
        </div>

        <div v-else class="applicant-interviews-page__empty">
          <i class="bi bi-calendar-x" aria-hidden="true" />
          <h2>No interview matches</h2>
          <p>Try another filter or search term. Employer interview updates will appear here automatically.</p>
        </div>
      </aside>

      <section class="applicant-interviews-page__viewer">
        <div v-if="isViewerLoading" class="applicant-interviews-page__viewer-loading" aria-live="polite" aria-label="Loading interview">
          <span class="applicant-interviews-page__viewer-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

        <article v-else-if="selectedInterview" class="applicant-interviews-page__message">
          <div class="applicant-interviews-page__badges">
            <span class="badge">Interview Notice</span>
            <span class="badge" :class="selectedInterview.statusToneClass">{{ selectedInterview.statusLabel }}</span>
            <span class="badge muted">{{ selectedInterview.typeLabel }}</span>
          </div>

          <header class="applicant-interviews-page__message-head">
            <h2>{{ selectedInterview.roleLabel }}</h2>
            <div class="applicant-interviews-page__sender">
              <span class="applicant-interviews-page__avatar" aria-hidden="true">
                <img
                  v-if="selectedInterview.avatarImageUrl"
                  :src="selectedInterview.avatarImageUrl"
                  alt=""
                  class="applicant-interviews-page__avatar-image"
                />
                <template v-else>{{ selectedInterview.avatarInitials }}</template>
              </span>
              <div>
                <strong>{{ selectedInterview.companyLabel }}</strong>
                <span>{{ selectedInterview.typeLabel }} for {{ selectedInterview.roleLabel }}</span>
              </div>
              <time>{{ selectedInterview.scheduledAtLabel }}</time>
            </div>
          </header>

          <div class="applicant-interviews-page__body">
            <p>{{ selectedInterview.companyLabel }} sent you an interview update for {{ selectedInterview.roleLabel }}.</p>
            <p>{{ selectedInterview.preview }}</p>
          </div>

          <div class="applicant-interviews-page__grid">
            <article><span>Schedule</span><strong>{{ selectedInterview.scheduledAtLabel }}</strong></article>
            <article><span>Mode</span><strong>{{ selectedInterview.modeLabel }}</strong></article>
            <article><span>Interviewer</span><strong>{{ selectedInterview.interviewerLabel }}</strong></article>
            <article><span>Location / Link</span><strong>{{ selectedInterview.locationLabel }}</strong></article>
            <article class="wide"><span>Notes</span><strong>{{ selectedInterview.notesLabel }}</strong></article>
          </div>

          <div v-if="isCompletedInterview(selectedInterview)" class="applicant-interviews-page__box success">
            <strong>Interview completed</strong>
            <span>The employer marked this interview as completed. Watch your applications and inbox for next steps.</span>
          </div>

          <div v-else-if="isCancelledInterview(selectedInterview)" class="applicant-interviews-page__box danger">
            <strong>Interview closed</strong>
            <span>{{ getInterviewCancellationMessage(selectedInterview) }}</span>
          </div>

          <div
            v-if="!isCompletedInterview(selectedInterview)
              && (selectedInterview.requestedScheduleLabel || selectedInterview.applicantResponseReason || selectedInterview.businessNote)"
            class="applicant-interviews-page__box"
          >
            <strong>Response history</strong>
            <span v-if="selectedInterview.requestedScheduleLabel">Requested schedule: {{ selectedInterview.requestedScheduleLabel }}</span>
            <span v-if="selectedInterview.applicantResponseReason">Reschedule reason: {{ selectedInterview.applicantResponseReason }}</span>
            <span v-if="selectedInterview.businessNote && !isCancelledInterview(selectedInterview)">Employer note: {{ selectedInterview.businessNote }}</span>
          </div>

          <div
            v-if="!isCompletedInterview(selectedInterview) && selectedInterview.availableScheduleOptions.length"
            class="applicant-interviews-page__box"
          >
            <strong>Available date options</strong>
            <span>Select one of the date options shared by the employer before confirming your interview.</span>
            <label class="applicant-interviews-page__field">
              <span>Employer date options</span>
              <select
                :value="getSelectedScheduleOption(selectedInterview)"
                :disabled="activeActionId === selectedInterview.id"
                @change="updateSelectedScheduleOption(selectedInterview.id, $event.target.value)"
              >
                <option
                  v-for="scheduleOption in selectedInterview.availableScheduleOptions"
                  :key="scheduleOption"
                  :value="scheduleOption"
                >
                  {{ formatInterviewWhen(scheduleOption) }}
                </option>
              </select>
            </label>
          </div>

          <div
            v-if="!isCompletedInterview(selectedInterview) && (canConfirmInterview(selectedInterview) || canRequestReschedule(selectedInterview))"
            class="applicant-interviews-page__actions"
          >
            <button
              v-if="canConfirmInterview(selectedInterview)"
              type="button"
              class="primary"
              :disabled="activeActionId === selectedInterview.id"
              @click="submitConfirmInterview(selectedInterview)"
            >
              {{ activeActionId === selectedInterview.id ? 'Saving...' : 'Confirm Attendance' }}
            </button>
            <button
              v-if="canRequestReschedule(selectedInterview)"
              type="button"
              :disabled="activeActionId === selectedInterview.id"
              @click="openRescheduleInterviewId === selectedInterview.id ? closeRescheduleForm() : openRescheduleForm(selectedInterview)"
            >
              {{ openRescheduleInterviewId === selectedInterview.id ? 'Close Form' : 'Request Another Time' }}
            </button>
          </div>

          <form
            v-if="!isCompletedInterview(selectedInterview)
              && openRescheduleInterviewId === selectedInterview.id
              && canRequestReschedule(selectedInterview)"
            class="applicant-interviews-page__form"
            @submit.prevent="submitRescheduleRequest(selectedInterview)"
          >
            <label class="applicant-interviews-page__field">
              <span>Preferred new date &amp; time</span>
              <input v-model="requestedScheduleAt" type="datetime-local" :min="minScheduleDateTime" required />
            </label>
            <label class="applicant-interviews-page__field">
              <span>Reason for rescheduling</span>
              <textarea v-model.trim="rescheduleReason" rows="4" placeholder="Explain why you need another interview time." required />
            </label>
            <div class="applicant-interviews-page__actions">
              <button type="submit" class="primary" :disabled="activeActionId === selectedInterview.id">
                {{ activeActionId === selectedInterview.id ? 'Sending...' : 'Send Request' }}
              </button>
              <button type="button" :disabled="activeActionId === selectedInterview.id" @click="closeRescheduleForm()">Cancel</button>
            </div>
          </form>
        </article>

        <div v-else class="applicant-interviews-page__empty">
          <i class="bi bi-envelope-open" aria-hidden="true" />
          <h2>Select an interview</h2>
          <p>Choose an interview thread from the left side to review its schedule and employer notes.</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped src="@/components/applicant_dashboard.css"></style>

<style scoped>
.applicant-interviews-page{display:grid;gap:1.25rem;padding:0 1.25rem;width:100%;min-height:min(46rem,calc(100vh - 8.75rem))}
.applicant-interviews-page__hero,.applicant-interviews-page__list-pane,.applicant-interviews-page__viewer{border:1px solid rgba(66,112,87,.18);background:rgba(255,255,255,.97);box-shadow:0 18px 36px rgba(31,74,51,.07)}
.applicant-interviews-page__hero{display:flex;justify-content:space-between;gap:1.25rem;padding:1.4rem 1.5rem;background:radial-gradient(circle at top left,rgba(214,241,227,.85),transparent 42%),linear-gradient(135deg,rgba(255,255,255,.98),rgba(246,252,249,.98))}
.applicant-interviews-page__eyebrow,.applicant-interviews-page__intro,.applicant-interviews-page__hero h1{margin:0}
.applicant-interviews-page__eyebrow{font-size:.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#577564}
.applicant-interviews-page__hero h1{color:#183927;font-size:clamp(1.8rem,2vw,2.2rem);line-height:1.05}
.applicant-interviews-page__intro{color:#557061;font-size:.97rem;line-height:1.65;max-width:38rem}
.applicant-interviews-page__hero-side{display:grid;gap:.85rem;min-width:min(100%,22rem)}
.applicant-interviews-page__search{display:flex;align-items:center;gap:.7rem;padding:.95rem 1rem;border:1px solid rgba(83,128,98,.24);background:rgba(255,255,255,.92)}
.applicant-interviews-page__search i{color:#45765a}.applicant-interviews-page__search input{width:100%;border:0;outline:0;background:transparent;color:#234532;font:inherit}
.applicant-interviews-page__stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem}
.applicant-interviews-page__stats article,.applicant-interviews-page__grid article,.applicant-interviews-page__box,.applicant-interviews-page__form{border:1px solid rgba(83,128,98,.16);background:rgba(248,252,249,.96)}
.applicant-interviews-page__stats article{display:grid;gap:.24rem;padding:.8rem .9rem}.applicant-interviews-page__stats span,.applicant-interviews-page__grid span,.applicant-interviews-page__field span{color:#6e887a;font-size:.74rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.applicant-interviews-page__stats strong{color:#173a28;font-size:1.24rem;line-height:1}
.applicant-interviews-page__shell{display:grid;grid-template-columns:minmax(19rem,26rem) minmax(0,1fr);gap:1.2rem;min-height:0}.applicant-interviews-page__list-pane{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
.applicant-interviews-page__filters{display:flex;flex-wrap:wrap;gap:.65rem;padding:1rem;border-bottom:1px solid rgba(83,128,98,.14);background:linear-gradient(180deg,rgba(247,252,249,.95),rgba(255,255,255,.95))}
.applicant-interviews-page__filters button,.applicant-interviews-page__actions button{display:inline-flex;align-items:center;gap:.55rem;padding:.62rem .8rem;border:1px solid rgba(83,128,98,.18);background:#fff;color:#355745;font:inherit;font-weight:700;cursor:pointer;transition:border-color .18s ease,background-color .18s ease,color .18s ease,transform .18s ease}
.applicant-interviews-page__filters button.is-active{border-color:rgba(31,122,82,.4);background:rgba(224,243,232,.94);color:#18412c}
.applicant-interviews-page__filters button:hover{transform:translateY(-1px)}
.applicant-interviews-page__threads{display:grid;grid-auto-rows:max-content;align-content:start;gap:0;overflow-y:auto}.applicant-interviews-page__thread{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.85rem;align-items:flex-start;align-content:start;padding:1rem;border:0;border-bottom:1px solid rgba(83,128,98,.12);background:transparent;text-align:left;cursor:pointer;transition:background-color .18s ease,box-shadow .18s ease}.applicant-interviews-page__thread:hover{background:rgba(242,248,245,.92)}.applicant-interviews-page__thread.is-active{background:linear-gradient(90deg,rgba(216,242,226,.92),rgba(255,255,255,.98));box-shadow:inset 4px 0 0 #2d9360}
.applicant-interviews-page__avatar{display:inline-grid;place-items:center;width:2.75rem;aspect-ratio:1;border:1px solid rgba(83,128,98,.18);border-radius:.9rem;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(225,243,233,.95),rgba(247,252,249,.96));color:#1c5138;font-size:.86rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.applicant-interviews-page__avatar-image{display:block;width:100%;height:100%;object-fit:cover}
.applicant-interviews-page__thread-copy,.applicant-interviews-page__body,.applicant-interviews-page__sender>div,.applicant-interviews-page__field{display:grid;align-content:start;gap:.35rem;min-width:0}.applicant-interviews-page__thread-top{display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem}
.applicant-interviews-page__thread-top strong,.applicant-interviews-page__thread-subject,.applicant-interviews-page__body p,.applicant-interviews-page__grid strong,.applicant-interviews-page__box span,.applicant-interviews-page__box strong,.applicant-interviews-page__sender span,.applicant-interviews-page__sender time{overflow-wrap:anywhere}
.applicant-interviews-page__thread-top strong,.applicant-interviews-page__sender strong{color:#193826;font-size:.95rem}.applicant-interviews-page__thread-top small,.applicant-interviews-page__sender span,.applicant-interviews-page__sender time{color:#6f8a7b;font-size:.8rem}.applicant-interviews-page__thread-top small{white-space:nowrap}
.applicant-interviews-page__thread-subject{color:#264937;font-size:.92rem;font-weight:700}.applicant-interviews-page__thread-preview{display:-webkit-box;color:#6b8577;font-size:.84rem;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.applicant-interviews-page__thread-tags,.applicant-interviews-page__badges,.applicant-interviews-page__actions{display:flex;flex-wrap:wrap;gap:.5rem}.applicant-interviews-page__thread-tags{gap:.55rem;align-items:center;color:#62806e;font-size:.78rem}.applicant-interviews-page__thread-tags span,.badge{display:inline-flex;align-items:center;gap:.4rem;padding:.24rem .5rem;border:1px solid rgba(83,128,98,.16);background:rgba(244,250,246,.92);color:#2a5c42;font-size:.76rem;font-weight:700}
.badge.is-info{background:rgba(225,239,248,.95);color:#285f86}.badge.is-success{background:rgba(221,245,231,.95);color:#176742}.badge.is-warning{background:rgba(255,245,219,.96);color:#996d00}.badge.is-danger{background:rgba(252,232,232,.94);color:#a03636}.badge.muted{background:rgba(237,240,240,.96);color:#536665}
.applicant-interviews-page__viewer{display:flex;min-height:0;overflow:hidden}.applicant-interviews-page__message,.applicant-interviews-page__empty{width:100%}.applicant-interviews-page__message{display:grid;gap:1.2rem;padding:1.45rem 1.55rem 1.65rem;overflow-y:auto;background:linear-gradient(180deg,rgba(249,253,251,.98),rgba(255,255,255,.98) 22%)}
.applicant-interviews-page__viewer-loading{display:grid;place-items:center;width:100%;min-height:100%;padding:2rem;background:radial-gradient(circle at top left,rgba(214,241,227,.58),transparent 42%),linear-gradient(180deg,rgba(249,253,251,.98),rgba(255,255,255,.98) 22%)}
.applicant-interviews-page__viewer-loading-dots{display:inline-flex;align-items:center;gap:.6rem}
.applicant-interviews-page__viewer-loading-dots span{width:.8rem;aspect-ratio:1;border-radius:50%;background:linear-gradient(180deg,#8ca497,#557b66);opacity:.35;animation:applicantInterviewsViewerDots 1s ease-in-out infinite}
.applicant-interviews-page__viewer-loading-dots span:nth-child(2){animation-delay:.15s}
.applicant-interviews-page__viewer-loading-dots span:nth-child(3){animation-delay:.3s}
.applicant-interviews-page__message-head{display:grid;gap:1rem;padding-bottom:1.1rem;border-bottom:1px solid rgba(83,128,98,.16)}.applicant-interviews-page__message-head h2,.applicant-interviews-page__empty h2,.applicant-interviews-page__empty p{margin:0}.applicant-interviews-page__message-head h2{color:#173a28;font-size:clamp(1.35rem,1.8vw,1.8rem);line-height:1.2}
.applicant-interviews-page__sender{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.9rem;align-items:flex-start}.applicant-interviews-page__body{display:grid;gap:.55rem}.applicant-interviews-page__body p{margin:0;color:#4c6558;font-size:.96rem;line-height:1.72}.applicant-interviews-page__body p:first-child{color:#274737;font-size:1rem}
.applicant-interviews-page__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.05rem 1.3rem;padding:1.15rem 0;border-top:1px solid rgba(83,128,98,.14);border-bottom:1px solid rgba(83,128,98,.14)}.applicant-interviews-page__grid article{display:grid;gap:.34rem;min-height:3.55rem;padding:0 0 0 1rem;border:0;border-left:2px solid rgba(83,128,98,.18);background:transparent}.applicant-interviews-page__grid article.wide{grid-column:1 / -1}.applicant-interviews-page__grid strong{color:#183927;font-size:.96rem;line-height:1.6}
.applicant-interviews-page__box,.applicant-interviews-page__form{display:grid;gap:.72rem;padding:1rem 0 0 1rem;border:0;border-top:1px solid rgba(83,128,98,.14);background:transparent}.applicant-interviews-page__box{border-left:2px solid rgba(83,128,98,.18)}.applicant-interviews-page__box strong{color:#20312a;font-size:.9rem}.applicant-interviews-page__box span{color:#63756d;font-size:.84rem;line-height:1.62}.applicant-interviews-page__box.danger{border-left-color:rgba(239,68,68,.42);background:transparent}.applicant-interviews-page__box.danger strong,.applicant-interviews-page__box.danger span{color:#991b1b}.applicant-interviews-page__box.success{border-left-color:rgba(34,197,94,.4);background:transparent}.applicant-interviews-page__box.success strong,.applicant-interviews-page__box.success span{color:#166534}
.applicant-interviews-page__field input,.applicant-interviews-page__field textarea,.applicant-interviews-page__field select{width:100%;border:1px solid rgba(205,216,226,.92);background:#fff;color:#24342d;font:inherit;padding:.78rem .85rem}.applicant-interviews-page__field textarea{resize:vertical}
.applicant-interviews-page__actions button.primary{background:#2f6a49;border-color:#2f6a49;color:#fff}.applicant-interviews-page__actions button:disabled{opacity:.65;cursor:not-allowed}
.applicant-interviews-page__empty{display:grid;place-items:center;align-content:center;gap:.8rem;padding:2rem;text-align:center;color:#5f7a6b}.applicant-interviews-page__empty i{font-size:2rem;color:#4a7b5f}
@keyframes applicantInterviewsViewerDots{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-.2rem);opacity:1}}
@media (max-width:1180px){.applicant-interviews-page{min-height:auto}.applicant-interviews-page__hero{flex-direction:column}.applicant-interviews-page__hero-side{width:100%;min-width:0}.applicant-interviews-page__shell{grid-template-columns:1fr}.applicant-interviews-page__list-pane{max-height:28rem}.applicant-interviews-page__viewer{min-height:30rem}}
@media (max-width:720px){.applicant-interviews-page{padding:0 .85rem}.applicant-interviews-page__hero,.applicant-interviews-page__message{padding-inline:1rem}.applicant-interviews-page__stats{grid-template-columns:repeat(2,minmax(0,1fr))}.applicant-interviews-page__sender,.applicant-interviews-page__grid{grid-template-columns:1fr}.applicant-interviews-page__grid article.wide{grid-column:auto}.applicant-interviews-page__actions{flex-direction:column}.applicant-interviews-page__actions button{width:100%;justify-content:center}}
</style>
