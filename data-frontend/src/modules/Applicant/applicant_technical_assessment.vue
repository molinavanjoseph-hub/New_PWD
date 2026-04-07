<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  assessmentRecords: {
    type: Array,
    default: () => [],
  },
  hasApplications: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['start-assessment', 'submit-assessment'])

const activeAssessmentId = ref('')
const activeFilter = ref('all')
const answerDrafts = ref({})
const examModeAssessmentId = ref('')
const dismissedAssessmentLaunchIds = ref([])
const isAssessmentSubmitConfirmOpen = ref(false)
const assessmentSubmitConfirmMode = ref('confirm')
const isAssessmentSubmitting = ref(false)
const assessmentSubmissionResult = ref(null)
const isViewerLoading = ref(false)

const VIEWER_SWITCH_DELAY_MS = 1000

let viewerSwitchToken = 0
let viewerSwitchTimeoutId = null

const cloneJson = (value, fallback) => {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

const normalizeResponseFilled = (value) => {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return String(value ?? '').trim().length > 0
}

const parseAssessmentTimestamp = (value) => {
  const parsed = typeof value === 'number' ? value : Date.parse(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

const formatAssessmentActivityDate = (value) => {
  const parsed = Number(value) || parseAssessmentTimestamp(value)
  if (!parsed) return 'Recently'
  return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const getAssessmentStatusToneClass = (value) => {
  const normalizedTone = String(value || '').trim().toLowerCase()
  if (normalizedTone === 'success') return 'is-success'
  if (normalizedTone === 'danger') return 'is-danger'
  if (normalizedTone === 'warning') return 'is-warning'
  if (normalizedTone === 'muted') return 'is-muted'
  return 'is-info'
}

const getAssessmentAvatarInitials = (company, jobTitle) =>
  String(company || jobTitle || 'TA')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('') || 'TA'

const formatAssessmentThreadPreview = (record = {}, pendingRequiredCount = 0) => {
  if (record?.isCancelled) {
    return String(record?.cancellationReason || '').trim()
      || 'This technical assessment is no longer active.'
  }

  if (record?.isSubmitted) {
    if (record?.assessmentResult === 'passed') {
      return `Submitted successfully. You passed with ${record.scoreLabel || 'a passing score'}.`
    }

    if (record?.assessmentResult === 'failed') {
      return `Submitted successfully. You finished with ${record.scoreLabel || 'a recorded score'}.`
    }

    return `Submitted ${record.submittedAtLabel || 'recently'} and now locked for review.`
  }

  if (record?.isStarted) {
    return pendingRequiredCount > 0
      ? `${pendingRequiredCount} required question${pendingRequiredCount === 1 ? '' : 's'} still need an answer.`
      : 'All required questions are filled. You can submit this assessment now.'
  }

  return 'This technical assessment is ready to start.'
}

const getAssessmentFilterId = (record = {}) => {
  if (record?.isCancelled) return 'stopped'
  if (record?.isSubmitted) return 'submitted'
  if (record?.isStarted) return 'active'
  return 'ready'
}

const clearViewerSwitchTimeout = () => {
  if (viewerSwitchTimeoutId) {
    clearTimeout(viewerSwitchTimeoutId)
    viewerSwitchTimeoutId = null
  }
}

const syncDraftsFromRecords = (records) => {
  const nextDrafts = { ...answerDrafts.value }
  const activeIds = new Set()

  ;(Array.isArray(records) ? records : []).forEach((record) => {
    const recordId = String(record?.id || '').trim()
    if (!recordId) return

    activeIds.add(recordId)
    if (!nextDrafts[recordId] || record?.isSubmitted) {
      nextDrafts[recordId] = cloneJson(record?.responses || {}, {})
    }
  })

  Object.keys(nextDrafts).forEach((recordId) => {
    if (!activeIds.has(recordId)) {
      delete nextDrafts[recordId]
    }
  })

  answerDrafts.value = nextDrafts

  const availableIds = (Array.isArray(records) ? records : [])
    .map((record) => String(record?.id || '').trim())
    .filter(Boolean)

  if (!availableIds.length) {
    activeAssessmentId.value = ''
    return
  }

  if (!availableIds.includes(String(activeAssessmentId.value || '').trim())) {
    activeAssessmentId.value = availableIds[0]
  }
}

watch(() => props.assessmentRecords, (records) => {
  syncDraftsFromRecords(records)
}, { immediate: true, deep: true })

const newAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) =>
    !record?.isStarted && !record?.isSubmitted && !record?.isCancelled).length,
)
const activeAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) =>
    record?.isStarted && !record?.isSubmitted && !record?.isCancelled).length,
)
const submittedAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) => record?.isSubmitted).length,
)
const discontinuedAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) => record?.isCancelled).length,
)
const normalizedAssessmentRecords = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : [])
    .map((record) => {
      const recordId = String(record?.id || '').trim()
      const currentResponses = recordId ? answerDrafts.value[recordId] || record?.responses || {} : record?.responses || {}
      const pendingRequiredCount = (record?.questions || []).filter((question) =>
        Boolean(question?.required) && !normalizeResponseFilled(currentResponses?.[question.id])).length
      const assignedAtValue = Number(record?.assignedAtValue) || parseAssessmentTimestamp(record?.assignedAt)
      const activityValue = Math.max(
        assignedAtValue,
        parseAssessmentTimestamp(record?.startedAt),
        parseAssessmentTimestamp(record?.submittedAt),
      )

      return {
        ...record,
        pendingRequiredCount,
        questionsCount: Array.isArray(record?.questions) ? record.questions.length : 0,
        filterId: getAssessmentFilterId(record),
        statusToneClass: getAssessmentStatusToneClass(record?.statusTone),
        avatarImageUrl: String(record?.logoUrl || record?.avatarImageUrl || record?.companyLogoUrl || '').trim(),
        avatarInitials: getAssessmentAvatarInitials(record?.company, record?.jobTitle),
        activityValue,
        activityLabel: formatAssessmentActivityDate(activityValue || assignedAtValue),
        threadPreview: formatAssessmentThreadPreview(record, pendingRequiredCount),
      }
    })
    .filter((record) => record.id)
    .sort((left, right) => (right.activityValue || 0) - (left.activityValue || 0)),
)

const filters = computed(() => [
  { id: 'all', label: 'All', count: normalizedAssessmentRecords.value.length },
  { id: 'ready', label: 'Ready', count: newAssessmentCount.value },
  { id: 'active', label: 'Active', count: activeAssessmentCount.value },
  { id: 'submitted', label: 'Submitted', count: submittedAssessmentCount.value },
  { id: 'stopped', label: 'Closed', count: discontinuedAssessmentCount.value },
])

const filteredAssessmentRecords = computed(() =>
  normalizedAssessmentRecords.value.filter((record) =>
    activeFilter.value === 'all' ? true : record.filterId === activeFilter.value),
)

const activeAssessment = computed(() =>
  filteredAssessmentRecords.value.find((record) => String(record?.id || '').trim() === String(activeAssessmentId.value || '').trim())
  || filteredAssessmentRecords.value[0]
  || null,
)

const activeAssessmentDraft = computed(() => {
  const recordId = String(activeAssessment.value?.id || '').trim()
  return recordId ? answerDrafts.value[recordId] || {} : {}
})

const activeAssessmentPendingQuestions = computed(() =>
  (activeAssessment.value?.questions || []).filter((question) =>
    Boolean(question?.required) && !normalizeResponseFilled(activeAssessmentDraft.value?.[question.id])),
)
const isAssessmentNew = (record) =>
  Boolean(record) && !record?.isStarted && !record?.isSubmitted && !record?.isCancelled

const isActiveAssessmentLaunchDismissed = computed(() =>
  Boolean(activeAssessment.value?.id)
  && dismissedAssessmentLaunchIds.value.includes(String(activeAssessment.value.id || '').trim()),
)

const showActiveAssessmentLaunchPrompt = computed(() =>
  isAssessmentNew(activeAssessment.value)
  && !isActiveAssessmentLaunchDismissed.value
  && String(examModeAssessmentId.value || '').trim() !== String(activeAssessment.value?.id || '').trim(),
)

const isActiveAssessmentInExamMode = computed(() => {
  if (!activeAssessment.value || activeAssessment.value.isSubmitted || activeAssessment.value.isCancelled) return false
  return activeAssessment.value.isStarted || String(examModeAssessmentId.value || '').trim() === String(activeAssessment.value.id || '').trim()
})
const activeAssessmentDetails = computed(() => {
  if (!activeAssessment.value) return []

  const record = activeAssessment.value
  const details = [
    {
      id: 'assigned',
      label: 'Assigned',
      value: record.assignedAtLabel || 'Recently assigned',
    },
  ]

  if (record.isSubmitted) {
    details.push(
      {
        id: 'submitted-on',
        label: 'Submitted',
        value: record.submittedAtLabel || 'Just now',
      },
      {
        id: 'result',
        label: 'Result',
        value: record.statusLabel || 'Submitted',
      },
      {
        id: 'score',
        label: 'Score',
        value: record.scoreLabel || 'Pending',
      },
      {
        id: 'pass-mark',
        label: 'Pass Mark',
        value: `${Number(record.passingScorePercent || 0)}%`,
      },
    )

    return details
  }

  details.push(
    {
      id: 'status',
      label: 'Status',
      value: record.statusLabel || (record.isStarted ? 'In progress' : 'Ready'),
    },
    {
      id: 'questions',
      label: 'Questions',
      value: String(record.questions.length || 0),
    },
    {
      id: 'required-left',
      label: 'Required Left',
      value: String(activeAssessmentPendingQuestions.value.length),
    },
    {
      id: 'pass-mark',
      label: 'Pass Mark',
      value: `${Number(record.passingScorePercent || 0)}%`,
    },
  )

  return details
})
const activeAssessmentCompletionState = computed(() => {
  if (!activeAssessment.value?.isSubmitted || activeAssessment.value?.isCancelled) return null

  const scoreLabel = String(activeAssessment.value.scoreLabel || '').trim() || 'Pending'
  const passMark = `${Number(activeAssessment.value.passingScorePercent || 0)}%`
  const companyLabel = String(activeAssessment.value.company || 'The employer').trim() || 'The employer'
  const jobTitle = String(activeAssessment.value.jobTitle || 'your application').trim() || 'your application'

  if (activeAssessment.value.assessmentResult === 'passed') {
    return {
      tone: 'success',
      icon: 'bi bi-patch-check-fill',
      title: 'Assessment submitted successfully',
      message: `${companyLabel} received your answers for ${jobTitle}. You passed with ${scoreLabel}.`,
      footnote: 'Your answers are now locked and saved in your application history.',
    }
  }

  if (activeAssessment.value.assessmentResult === 'failed') {
    return {
      tone: 'warning',
      icon: 'bi bi-clipboard2-check-fill',
      title: 'Assessment submitted successfully',
      message: `${companyLabel} received your answers for ${jobTitle}. Your score was ${scoreLabel}, below the ${passMark} pass mark.`,
      footnote: 'Your answers are now locked while the employer reviews your result.',
    }
  }

  return {
    tone: 'success',
    icon: 'bi bi-send-check-fill',
    title: 'Assessment submitted successfully',
    message: `${companyLabel} received your answers for ${jobTitle}.`,
    footnote: 'Your answers are now locked and saved in your application history.',
  }
})
const nextAvailableAssessment = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).find((record) =>
    String(record?.id || '').trim() !== String(activeAssessment.value?.id || '').trim()
      && !record?.isSubmitted
      && !record?.isCancelled) || null,
)

watch(filteredAssessmentRecords, (records) => {
  const nextRecords = Array.isArray(records) ? records : []
  if (!nextRecords.length) {
    clearViewerSwitchTimeout()
    isViewerLoading.value = false
    activeAssessmentId.value = ''
    return
  }

  if (!nextRecords.some((record) => String(record?.id || '').trim() === String(activeAssessmentId.value || '').trim())) {
    selectAssessment(nextRecords[0]?.id || '', { immediate: true })
  }
}, { immediate: true })

const selectAssessment = (assessmentId, options = {}) => {
  const normalizedAssessmentId = String(assessmentId || '').trim()
  if (!normalizedAssessmentId) return

  const immediate = options?.immediate === true
  const isSameSelection = normalizedAssessmentId === String(activeAssessmentId.value || '').trim()

  activeAssessmentId.value = normalizedAssessmentId
  dismissedAssessmentLaunchIds.value = dismissedAssessmentLaunchIds.value.filter((id) => id !== normalizedAssessmentId)
  assessmentSubmissionResult.value = null
  isAssessmentSubmitConfirmOpen.value = false

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

const setAnswerValue = (questionId, value) => {
  const recordId = String(activeAssessment.value?.id || '').trim()
  if (!recordId || !questionId) return

  answerDrafts.value = {
    ...answerDrafts.value,
    [recordId]: {
      ...(answerDrafts.value[recordId] || {}),
      [questionId]: value,
    },
  }
}

const toggleCheckboxAnswer = (questionId, optionIndex) => {
  const existingValues = Array.isArray(activeAssessmentDraft.value?.[questionId])
    ? [...activeAssessmentDraft.value[questionId]]
    : []

  const nextValues = existingValues.includes(optionIndex)
    ? existingValues.filter((value) => value !== optionIndex)
    : [...existingValues, optionIndex].sort((left, right) => left - right)

  setAnswerValue(questionId, nextValues)
}

const cancelAssessmentLaunch = () => {
  const normalizedAssessmentId = String(activeAssessment.value?.id || '').trim()
  if (!normalizedAssessmentId) return
  dismissedAssessmentLaunchIds.value = [...new Set([...dismissedAssessmentLaunchIds.value, normalizedAssessmentId])]
  examModeAssessmentId.value = ''
}

const startAssessment = () => {
  if (!activeAssessment.value?.id || activeAssessment.value?.isCancelled) return
  const normalizedAssessmentId = String(activeAssessment.value.id || '').trim()
  activeFilter.value = 'all'
  examModeAssessmentId.value = normalizedAssessmentId
  emit('start-assessment', {
    assessmentId: normalizedAssessmentId,
    onSuccess: () => {
      examModeAssessmentId.value = normalizedAssessmentId
    },
    onError: () => {
      examModeAssessmentId.value = ''
    },
  })
}

const openAssessmentSubmitConfirm = () => {
  if (!activeAssessment.value?.id || activeAssessment.value?.isSubmitted || activeAssessment.value?.isCancelled) return

  assessmentSubmitConfirmMode.value = activeAssessmentPendingQuestions.value.length ? 'missing' : 'confirm'
  isAssessmentSubmitConfirmOpen.value = true
}

const closeAssessmentSubmitConfirm = () => {
  if (isAssessmentSubmitting.value) return
  isAssessmentSubmitConfirmOpen.value = false
}

const submitAssessment = () => {
  if (!activeAssessment.value?.id || activeAssessment.value?.isSubmitted || activeAssessment.value?.isCancelled) return
  if (activeAssessmentPendingQuestions.value.length) {
    assessmentSubmitConfirmMode.value = 'missing'
    isAssessmentSubmitConfirmOpen.value = true
    return
  }

  const normalizedAssessmentId = String(activeAssessment.value.id || '').trim()
  if (!normalizedAssessmentId) return

  isAssessmentSubmitConfirmOpen.value = false
  isAssessmentSubmitting.value = true
  activeFilter.value = 'all'

  emit('submit-assessment', {
    assessmentId: normalizedAssessmentId,
    responses: cloneJson(activeAssessmentDraft.value, {}),
    onSuccess: (payload = {}) => {
      isAssessmentSubmitting.value = false
      examModeAssessmentId.value = ''
      assessmentSubmissionResult.value = {
        assessmentId: normalizedAssessmentId,
        tone: String(payload?.tone || '').trim() || 'success',
        title: String(payload?.title || 'Assessment submitted').trim() || 'Assessment submitted',
        message: String(payload?.message || '').trim() || 'Your technical assessment was submitted successfully.',
        footnote: String(payload?.footnote || '').trim(),
        scoreLabel: String(payload?.scoreLabel || '').trim(),
        passMark: String(payload?.passMark || '').trim(),
        applicationOutcome: String(payload?.applicationOutcome || '').trim(),
      }
    },
    onError: () => {
      isAssessmentSubmitting.value = false
    },
  })
}

const getMultipleChoiceValue = (questionId) => Number(activeAssessmentDraft.value?.[questionId])
const isCheckboxChecked = (questionId, optionIndex) =>
  Array.isArray(activeAssessmentDraft.value?.[questionId]) && activeAssessmentDraft.value[questionId].includes(optionIndex)

const closeAssessmentSubmissionResult = () => {
  assessmentSubmissionResult.value = null
}

onBeforeUnmount(() => {
  clearViewerSwitchTimeout()
})
</script>

<template>
  <section class="applicant-technical-assessment-page">
    <div v-if="!hasApplications" class="applicant-technical-assessment-page__empty">
      <i class="bi bi-send-x" aria-hidden="true" />
      <h2>No job applications yet</h2>
      <p>Apply to a job first. Once a business approves your application and assigns a technical assessment, it will appear here.</p>
    </div>

    <div v-else-if="!assessmentRecords.length" class="applicant-technical-assessment-page__empty">
      <i class="bi bi-ui-checks-grid" aria-hidden="true" />
      <h2>No technical assessment assigned yet</h2>
      <p>Wait for a business owner to approve your application and assign a technical assessment template.</p>
    </div>

    <div v-else class="applicant-technical-assessment-page__shell">
      <aside class="applicant-technical-assessment-page__list-pane">
        <div class="applicant-technical-assessment-page__filters">
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

        <div v-if="filteredAssessmentRecords.length" class="applicant-technical-assessment-page__threads">
          <button
            v-for="record in filteredAssessmentRecords"
            :key="record.id"
            type="button"
            class="applicant-technical-assessment-page__thread"
            :class="{ 'is-active': activeAssessment?.id === record.id }"
            @click="selectAssessment(record.id)"
          >
            <span class="applicant-technical-assessment-page__avatar" aria-hidden="true">
              <img
                v-if="record.avatarImageUrl"
                :src="record.avatarImageUrl"
                alt=""
                class="applicant-technical-assessment-page__avatar-image"
              />
              <template v-else>{{ record.avatarInitials }}</template>
            </span>
            <span class="applicant-technical-assessment-page__thread-copy">
              <span class="applicant-technical-assessment-page__thread-top">
                <strong>{{ record.company }}</strong>
                <small>{{ record.activityLabel }}</small>
              </span>
              <span class="applicant-technical-assessment-page__thread-subject">{{ record.jobTitle }}</span>
              <span class="applicant-technical-assessment-page__thread-preview">{{ record.threadPreview }}</span>
              <span class="applicant-technical-assessment-page__thread-tags">
                <span v-if="isAssessmentNew(record)" class="applicant-technical-assessment-page__thread-tag applicant-technical-assessment-page__thread-tag--new">New</span>
                <span>{{ record.statusLabel }}</span>
                <span>{{ record.questionsCount }} {{ record.questionsCount === 1 ? 'Question' : 'Questions' }}</span>
                <span>Pass {{ record.passingScorePercent }}%</span>
              </span>
            </span>
          </button>
        </div>

        <div v-else class="applicant-technical-assessment-page__empty applicant-technical-assessment-page__empty--inline">
          <i class="bi bi-search" aria-hidden="true" />
          <h2>No matching assessments</h2>
          <p>Try another filter. Your assessment threads update here automatically.</p>
        </div>
      </aside>

      <section class="applicant-technical-assessment-page__viewer">
        <div v-if="isViewerLoading" class="applicant-technical-assessment-page__viewer-loading" aria-live="polite" aria-label="Loading assessment">
          <span class="applicant-technical-assessment-page__viewer-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

        <article v-else-if="activeAssessment" class="applicant-technical-assessment-page__message">
          <div class="applicant-technical-assessment-page__badges">
            <span class="badge">Technical Assessment</span>
            <span class="badge" :class="activeAssessment.statusToneClass">{{ activeAssessment.statusLabel }}</span>
            <span class="badge muted">Pass {{ activeAssessment.passingScorePercent }}%</span>
          </div>

          <header class="applicant-technical-assessment-page__message-head">
            <h2>{{ activeAssessment.title }}</h2>
            <div class="applicant-technical-assessment-page__sender">
              <span class="applicant-technical-assessment-page__avatar" aria-hidden="true">
                <img
                  v-if="activeAssessment.avatarImageUrl"
                  :src="activeAssessment.avatarImageUrl"
                  alt=""
                  class="applicant-technical-assessment-page__avatar-image"
                />
                <template v-else>{{ activeAssessment.avatarInitials }}</template>
              </span>
              <div>
                <strong>{{ activeAssessment.company }}</strong>
                <span>{{ activeAssessment.jobTitle }}</span>
              </div>
              <time>{{ activeAssessment.submittedAtLabel || activeAssessment.assignedAtLabel || activeAssessment.activityLabel }}</time>
            </div>
          </header>

          <div class="applicant-technical-assessment-page__body">
            <p>{{ activeAssessment.company }} assigned this technical assessment for {{ activeAssessment.jobTitle }}.</p>
            <p>{{ activeAssessment.description || 'No extra description was added for this technical assessment.' }}</p>
          </div>

          <div class="applicant-technical-assessment-page__details">
            <div
              v-for="item in activeAssessmentDetails"
              :key="item.id"
              class="applicant-technical-assessment-page__detail"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <section class="applicant-technical-assessment-page__instruction">
            <span>Instructions</span>
            <p>{{ activeAssessment.instructions || 'Read each question carefully before submitting your assessment.' }}</p>
          </section>

          <div v-if="activeAssessment.isCancelled" class="applicant-technical-assessment-page__box danger">
            <strong>Assessment closed</strong>
            <span>{{ activeAssessment.cancellationReason || 'This technical assessment was discontinued because the job post was deleted.' }}</span>
          </div>

          <div
            v-else-if="activeAssessmentCompletionState"
            class="applicant-technical-assessment-page__box"
            :class="activeAssessmentCompletionState.tone === 'warning' ? 'warning' : 'success'"
          >
            <strong>{{ activeAssessmentCompletionState.title }}</strong>
            <span>{{ activeAssessmentCompletionState.message }}</span>
            <span>{{ activeAssessmentCompletionState.footnote }}</span>
          </div>

          <div v-else-if="!showActiveAssessmentLaunchPrompt || isActiveAssessmentInExamMode" class="applicant-technical-assessment-page__box">
            <strong>{{ isActiveAssessmentInExamMode ? 'Assessment in progress' : 'Assessment ready' }}</strong>
            <span v-if="isActiveAssessmentInExamMode && activeAssessmentPendingQuestions.length">
              You still need to answer {{ activeAssessmentPendingQuestions.length }} required question<span v-if="activeAssessmentPendingQuestions.length !== 1">s</span>.
            </span>
            <span v-else-if="isActiveAssessmentInExamMode">
              All required questions are answered. You can submit this assessment now.
            </span>
            <span v-else>
              This assessment is waiting for your answers. Start when you're ready.
            </span>
          </div>

          <div
            v-if="showActiveAssessmentLaunchPrompt"
            class="applicant-technical-assessment-page__launch"
          >
            <strong>New technical assessment</strong>
            <span>Review the instructions first, then continue to enter technical exam mode.</span>
            <div class="applicant-technical-assessment-page__actions applicant-technical-assessment-page__actions--launch">
              <button type="button" @click="cancelAssessmentLaunch">
                Cancel
              </button>
              <button type="button" class="primary" @click="startAssessment">
                Continue
              </button>
            </div>
          </div>

          <section
            v-if="isActiveAssessmentInExamMode && !activeAssessment.isSubmitted && !activeAssessment.isCancelled"
            class="applicant-technical-assessment-page__question-list"
          >
            <article
              v-for="(question, index) in activeAssessment.questions"
              :key="question.id || `${activeAssessment.id}-question-${index}`"
              class="applicant-technical-assessment-page__question-card"
            >
              <div class="applicant-technical-assessment-page__question-head">
                <strong>Question {{ index + 1 }}</strong>
                <span v-if="question.required">Required</span>
              </div>

              <h3>{{ question.label || `Question ${index + 1}` }}</h3>
              <p v-if="question.helpText">{{ question.helpText }}</p>

              <input
                v-if="question.type === 'short-text'"
                :value="activeAssessmentDraft[question.id] || ''"
                type="text"
                class="applicant-technical-assessment-page__input"
                placeholder="Enter your answer"
                @input="setAnswerValue(question.id, $event.target.value)"
              />

              <textarea
                v-else-if="question.type === 'paragraph'"
                :value="activeAssessmentDraft[question.id] || ''"
                rows="5"
                class="applicant-technical-assessment-page__textarea"
                placeholder="Write your answer"
                @input="setAnswerValue(question.id, $event.target.value)"
              />

              <div
                v-else-if="question.type === 'multiple-choice'"
                class="applicant-technical-assessment-page__choices"
              >
                <label
                  v-for="(option, optionIndex) in question.options || []"
                  :key="`${question.id}-choice-${optionIndex}`"
                  class="applicant-technical-assessment-page__choice"
                >
                  <input
                    type="radio"
                    :name="`${activeAssessment.id}-${question.id}`"
                    :checked="getMultipleChoiceValue(question.id) === optionIndex"
                    @change="setAnswerValue(question.id, optionIndex)"
                  />
                  <span>{{ option || `Option ${optionIndex + 1}` }}</span>
                </label>
              </div>

              <div
                v-else-if="question.type === 'checkboxes'"
                class="applicant-technical-assessment-page__choices"
              >
                <label
                  v-for="(option, optionIndex) in question.options || []"
                  :key="`${question.id}-check-${optionIndex}`"
                  class="applicant-technical-assessment-page__choice"
                >
                  <input
                    type="checkbox"
                    :checked="isCheckboxChecked(question.id, optionIndex)"
                    @change="toggleCheckboxAnswer(question.id, optionIndex)"
                  />
                  <span>{{ option || `Option ${optionIndex + 1}` }}</span>
                </label>
              </div>

              <div
                v-else-if="question.type === 'rating'"
                class="applicant-technical-assessment-page__rating"
              >
                <button
                  v-for="option in question.options || []"
                  :key="`${question.id}-${option}`"
                  type="button"
                  class="applicant-technical-assessment-page__rating-option"
                  :class="{ 'is-selected': String(activeAssessmentDraft[question.id] || '') === String(option) }"
                  @click="setAnswerValue(question.id, option)"
                >
                  {{ option }}
                </button>
              </div>
            </article>

            <div class="applicant-technical-assessment-page__actions applicant-technical-assessment-page__actions--footer">
              <p v-if="activeAssessmentPendingQuestions.length" class="applicant-technical-assessment-page__warning">
                Complete all required questions before submitting this assessment.
              </p>
              <button
                type="button"
                class="primary"
                @click="openAssessmentSubmitConfirm"
              >
                Submit Assessment
              </button>
            </div>
          </section>

          <div
            v-if="activeAssessment.isSubmitted && nextAvailableAssessment"
            class="applicant-technical-assessment-page__actions"
          >
            <button type="button" @click="activeFilter = 'all'; selectAssessment(nextAvailableAssessment.id)">
              Open Next Assessment
            </button>
          </div>
        </article>

        <div v-else class="applicant-technical-assessment-page__empty applicant-technical-assessment-page__empty--inline">
          <i class="bi bi-envelope-open" aria-hidden="true" />
          <h2>Select an assessment</h2>
          <p>Choose an assessment thread from the left side to review the questions and employer instructions.</p>
        </div>
      </section>
    </div>

    <div v-if="isAssessmentSubmitConfirmOpen" class="applicant-technical-assessment-page__modal-backdrop">
      <div class="applicant-technical-assessment-page__modal">
        <span class="applicant-technical-assessment-page__modal-label">
          {{ assessmentSubmitConfirmMode === 'missing' ? 'Incomplete answers' : 'Submit assessment' }}
        </span>
        <h3>
          {{ assessmentSubmitConfirmMode === 'missing' ? 'Complete the required questions first' : 'Are you ready to complete this technical exam?' }}
        </h3>
        <p v-if="assessmentSubmitConfirmMode === 'missing'">
          You still need to answer {{ activeAssessmentPendingQuestions.length }} required question<span v-if="activeAssessmentPendingQuestions.length !== 1">s</span> before submitting.
        </p>
        <p v-else>
          Once you submit this assessment, your answers will be locked and scored immediately.
        </p>

        <div class="applicant-technical-assessment-page__modal-actions">
          <button type="button" @click="closeAssessmentSubmitConfirm">
            {{ assessmentSubmitConfirmMode === 'missing' ? 'Back to questions' : 'Cancel' }}
          </button>
          <button
            v-if="assessmentSubmitConfirmMode !== 'missing'"
            type="button"
            class="primary"
            @click="submitAssessment"
          >
            Yes, Submit
          </button>
        </div>
      </div>
    </div>

    <div v-if="isAssessmentSubmitting" class="applicant-technical-assessment-page__loading-backdrop">
      <div class="applicant-technical-assessment-page__loading-card">
        <span class="applicant-technical-assessment-page__spinner" aria-hidden="true" />
        <strong>Submitting technical assessment</strong>
        <p>Please wait while we score your answers and update your application.</p>
      </div>
    </div>

    <div v-if="assessmentSubmissionResult" class="applicant-technical-assessment-page__modal-backdrop">
      <div class="applicant-technical-assessment-page__modal applicant-technical-assessment-page__modal--result">
        <span
          class="applicant-technical-assessment-page__result-pill"
          :class="assessmentSubmissionResult.tone === 'danger' ? 'is-danger' : 'is-success'"
        >
          {{ assessmentSubmissionResult.tone === 'danger' ? 'Failed' : 'Passed' }}
        </span>
        <h3>{{ assessmentSubmissionResult.title }}</h3>
        <p>{{ assessmentSubmissionResult.message }}</p>
        <p v-if="assessmentSubmissionResult.footnote" class="applicant-technical-assessment-page__result-footnote">
          {{ assessmentSubmissionResult.footnote }}
        </p>
        <div class="applicant-technical-assessment-page__result-summary">
          <div v-if="assessmentSubmissionResult.scoreLabel" class="applicant-technical-assessment-page__detail">
            <span>Score</span>
            <strong>{{ assessmentSubmissionResult.scoreLabel }}</strong>
          </div>
          <div v-if="assessmentSubmissionResult.passMark" class="applicant-technical-assessment-page__detail">
            <span>Pass Mark</span>
            <strong>{{ assessmentSubmissionResult.passMark }}</strong>
          </div>
          <div
            v-if="assessmentSubmissionResult.applicationOutcome === 'rejected'"
            class="applicant-technical-assessment-page__detail applicant-technical-assessment-page__detail--danger"
          >
            <span>Application Status</span>
            <strong>Failed</strong>
          </div>
        </div>
        <div class="applicant-technical-assessment-page__modal-actions">
          <button type="button" class="primary" @click="closeAssessmentSubmissionResult">
            Close
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.applicant-technical-assessment-page{display:grid;gap:1.25rem;padding:0 1.25rem;width:100%;min-height:min(46rem,calc(100vh - 8.75rem))}
.applicant-technical-assessment-page__list-pane,.applicant-technical-assessment-page__viewer{border:1px solid rgba(66,112,87,.18);background:rgba(255,255,255,.97);box-shadow:0 18px 36px rgba(31,74,51,.07)}
.applicant-technical-assessment-page__shell{display:grid;grid-template-columns:minmax(19rem,26rem) minmax(0,1fr);gap:1.2rem;min-height:0}
.applicant-technical-assessment-page__list-pane{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
.applicant-technical-assessment-page__filters{display:flex;flex-wrap:wrap;gap:.6rem;padding:1rem;border-bottom:1px solid rgba(83,128,98,.14);background:linear-gradient(180deg,rgba(247,252,249,.95),rgba(255,255,255,.95))}
.applicant-technical-assessment-page__filters button,.applicant-technical-assessment-page__actions button,.applicant-technical-assessment-page__rating-option{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;padding:.72rem .92rem;border:1px solid rgba(83,128,98,.18);background:#fff;color:#355745;font:inherit;font-weight:700;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,transform .18s ease,opacity .18s ease}
.applicant-technical-assessment-page__filters button.is-active{border-color:rgba(31,122,82,.4);background:rgba(224,243,232,.94);color:#18412c}
.applicant-technical-assessment-page__threads{display:grid;grid-auto-rows:max-content;align-content:start;overflow-y:auto}
.applicant-technical-assessment-page__thread{display:grid;grid-template-columns:auto minmax(0,1fr);align-content:start;gap:.85rem;padding:1rem;border:0;border-bottom:1px solid rgba(83,128,98,.12);background:transparent;text-align:left;cursor:pointer}
.applicant-technical-assessment-page__thread.is-active{background:linear-gradient(90deg,rgba(216,242,226,.92),rgba(255,255,255,.98));box-shadow:inset 4px 0 0 #2d9360}
.applicant-technical-assessment-page__avatar{display:inline-grid;place-items:center;width:2.8rem;aspect-ratio:1;border:1px solid rgba(83,128,98,.18);border-radius:.9rem;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(225,243,233,.95),rgba(247,252,249,.96));color:#1c5138;font-size:.86rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.applicant-technical-assessment-page__avatar-image{display:block;width:100%;height:100%;object-fit:cover}
.applicant-technical-assessment-page__thread-copy,.applicant-technical-assessment-page__body,.applicant-technical-assessment-page__sender>div,.applicant-technical-assessment-page__question-card{display:grid;gap:.35rem;min-width:0}
.applicant-technical-assessment-page__thread-top{display:flex;justify-content:space-between;gap:.75rem}
.applicant-technical-assessment-page__thread-top strong,.applicant-technical-assessment-page__thread-subject,.applicant-technical-assessment-page__thread-preview,.applicant-technical-assessment-page__body p,.applicant-technical-assessment-page__detail strong,.applicant-technical-assessment-page__instruction p,.applicant-technical-assessment-page__box span,.applicant-technical-assessment-page__box strong,.applicant-technical-assessment-page__sender span,.applicant-technical-assessment-page__sender time{overflow-wrap:anywhere}
.applicant-technical-assessment-page__thread-top strong,.applicant-technical-assessment-page__sender strong{color:#193826;font-size:.95rem}
.applicant-technical-assessment-page__thread-top small,.applicant-technical-assessment-page__sender span,.applicant-technical-assessment-page__sender time{color:#6f8a7b;font-size:.8rem}
.applicant-technical-assessment-page__thread-subject{color:#264937;font-size:.92rem;font-weight:700}
.applicant-technical-assessment-page__thread-preview{display:-webkit-box;color:#6b8577;font-size:.84rem;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.applicant-technical-assessment-page__thread-tags,.applicant-technical-assessment-page__badges,.applicant-technical-assessment-page__actions,.applicant-technical-assessment-page__rating{display:flex;flex-wrap:wrap;gap:.5rem}
.applicant-technical-assessment-page__thread-tags span,.badge{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .52rem;border:1px solid rgba(83,128,98,.16);background:rgba(244,250,246,.92);color:#2a5c42;font-size:.76rem;font-weight:700}
.applicant-technical-assessment-page__thread-tag--new{border-color:rgba(37,99,235,.18)!important;background:rgba(219,234,254,.9)!important;color:#1d4ed8!important}
.badge.is-info{background:rgba(225,239,248,.95);color:#285f86}.badge.is-success{background:rgba(221,245,231,.95);color:#176742}.badge.is-warning{background:rgba(255,245,219,.96);color:#996d00}.badge.is-danger{background:rgba(252,232,232,.94);color:#a03636}.badge.is-muted,.badge.muted{background:rgba(237,240,240,.96);color:#536665}
.applicant-technical-assessment-page__viewer{display:flex;min-height:0;overflow:hidden}
.applicant-technical-assessment-page__viewer-loading{display:grid;place-items:center;width:100%;min-height:100%;padding:2rem;background:radial-gradient(circle at top left,rgba(214,241,227,.58),transparent 42%),linear-gradient(180deg,rgba(249,253,251,.98),rgba(255,255,255,.98) 22%)}
.applicant-technical-assessment-page__viewer-loading-dots{display:inline-flex;align-items:center;gap:.6rem}
.applicant-technical-assessment-page__viewer-loading-dots span{width:.8rem;aspect-ratio:1;border-radius:50%;background:linear-gradient(180deg,#8ca497,#557b66);opacity:.35;animation:applicantTechnicalAssessmentViewerDots 1s ease-in-out infinite}
.applicant-technical-assessment-page__viewer-loading-dots span:nth-child(2){animation-delay:.15s}
.applicant-technical-assessment-page__viewer-loading-dots span:nth-child(3){animation-delay:.3s}
.applicant-technical-assessment-page__message,.applicant-technical-assessment-page__empty{width:100%}
.applicant-technical-assessment-page__message{display:grid;align-content:start;gap:1rem;padding:1.25rem 1.35rem 1.4rem;overflow-y:auto;background:linear-gradient(180deg,rgba(248,252,250,.96),rgba(255,255,255,.98) 16rem),#fff}
.applicant-technical-assessment-page__message-head{display:grid;gap:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(83,128,98,.16)}
.applicant-technical-assessment-page__message-head h2,.applicant-technical-assessment-page__empty h2,.applicant-technical-assessment-page__empty p,.applicant-technical-assessment-page__question-card h3,.applicant-technical-assessment-page__question-card p{margin:0}
.applicant-technical-assessment-page__message-head h2{color:#173a28;font-size:clamp(1.35rem,1.8vw,1.8rem);line-height:1.2}
.applicant-technical-assessment-page__sender{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.9rem;align-items:center}
.applicant-technical-assessment-page__body{gap:.55rem}
.applicant-technical-assessment-page__body p{color:#4c6558;font-size:.96rem;line-height:1.7}
.applicant-technical-assessment-page__body p:first-child{color:#274737;font-size:1rem}
.applicant-technical-assessment-page__details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem 1.25rem}
.applicant-technical-assessment-page__detail{display:grid;gap:.34rem;align-content:start;min-height:3.45rem;padding-left:.95rem;border-left:2px solid rgba(83,128,98,.18)}
.applicant-technical-assessment-page__detail span,.applicant-technical-assessment-page__instruction span,.applicant-technical-assessment-page__question-head span{color:#6e887a;font-size:.74rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.applicant-technical-assessment-page__detail strong{color:#183927;font-size:.95rem;line-height:1.55}
.applicant-technical-assessment-page__instruction{display:grid;gap:.55rem;padding-top:1rem;border-top:1px solid rgba(83,128,98,.12)}
.applicant-technical-assessment-page__instruction p{margin:0;color:#4f675a;font-size:.95rem;line-height:1.7}
.applicant-technical-assessment-page__box,.applicant-technical-assessment-page__question-card{display:grid;gap:.7rem}
.applicant-technical-assessment-page__box{padding:.2rem 0 .1rem 1rem;border:0;border-left:3px solid rgba(83,128,98,.22);background:linear-gradient(90deg,rgba(245,250,247,.94),transparent 72%)}
.applicant-technical-assessment-page__launch{display:grid;gap:.75rem;padding:1rem 1.05rem;border:1px solid rgba(83,128,98,.14);background:linear-gradient(135deg,rgba(244,250,247,.96),rgba(255,255,255,.98))}
.applicant-technical-assessment-page__launch strong{color:#183927;font-size:.96rem}
.applicant-technical-assessment-page__launch span{color:#60796c;font-size:.9rem;line-height:1.65}
.applicant-technical-assessment-page__actions--launch{padding-top:.1rem}
.applicant-technical-assessment-page__question-card{padding:.95rem 1rem;border:1px solid rgba(83,128,98,.16);background:rgba(248,252,249,.96)}
.applicant-technical-assessment-page__box strong{color:#20312a;font-size:.88rem}
.applicant-technical-assessment-page__box span,.applicant-technical-assessment-page__question-card p{color:#63756d;font-size:.84rem;line-height:1.6}
.applicant-technical-assessment-page__box.danger{border-left-color:rgba(239,68,68,.5);background:linear-gradient(90deg,rgba(254,242,242,.96),transparent 72%)}.applicant-technical-assessment-page__box.danger strong,.applicant-technical-assessment-page__box.danger span{color:#991b1b}
.applicant-technical-assessment-page__box.success{border-left-color:rgba(34,197,94,.4);background:linear-gradient(90deg,rgba(236,253,243,.94),transparent 72%)}.applicant-technical-assessment-page__box.success strong,.applicant-technical-assessment-page__box.success span{color:#166534}
.applicant-technical-assessment-page__box.warning{border-left-color:rgba(245,158,11,.42);background:linear-gradient(90deg,rgba(255,251,235,.97),transparent 72%)}.applicant-technical-assessment-page__box.warning strong,.applicant-technical-assessment-page__box.warning span{color:#92400e}
.applicant-technical-assessment-page__actions button.primary,.applicant-technical-assessment-page__rating-option.is-selected{background:#2f6a49;border-color:#2f6a49;color:#fff}
.applicant-technical-assessment-page__actions button:disabled{opacity:.65;cursor:not-allowed}
.applicant-technical-assessment-page__actions--footer{align-items:center;justify-content:space-between}
.applicant-technical-assessment-page__question-list{display:grid;gap:.9rem}
.applicant-technical-assessment-page__question-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
.applicant-technical-assessment-page__question-head strong{color:#183927;font-size:.9rem}
.applicant-technical-assessment-page__question-card h3{color:#173a28;font-size:1rem;line-height:1.45}
.applicant-technical-assessment-page__input,.applicant-technical-assessment-page__textarea{width:100%;border:1px solid rgba(205,216,226,.92);background:#fff;color:#24342d;font:inherit;padding:.82rem .9rem;transition:border-color .18s ease,box-shadow .18s ease}
.applicant-technical-assessment-page__textarea{resize:vertical}
.applicant-technical-assessment-page__input:focus,.applicant-technical-assessment-page__textarea:focus{outline:0;border-color:rgba(47,106,73,.32);box-shadow:0 0 0 4px rgba(47,106,73,.08)}
.applicant-technical-assessment-page__choices{display:grid;gap:.65rem}
.applicant-technical-assessment-page__choice{display:flex;align-items:flex-start;gap:.7rem;border:1px solid rgba(221,231,225,.92);background:#fbfcfc;padding:.8rem .9rem;color:#334155}
.applicant-technical-assessment-page__choice input{margin-top:.16rem}
.applicant-technical-assessment-page__warning{margin:0;color:#b45309;font-weight:700}
.applicant-technical-assessment-page__modal-backdrop,.applicant-technical-assessment-page__loading-backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:1.25rem;background:rgba(238,245,241,.56);backdrop-filter:blur(10px);z-index:40}
.applicant-technical-assessment-page__modal,.applicant-technical-assessment-page__loading-card{width:min(100%,30rem);display:grid;gap:1rem;padding:1.2rem 1.25rem;border:1px solid rgba(66,112,87,.18);background:rgba(255,255,255,.98);box-shadow:0 18px 40px rgba(31,74,51,.16)}
.applicant-technical-assessment-page__modal-label{color:#6e887a;font-size:.74rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.applicant-technical-assessment-page__modal h3,.applicant-technical-assessment-page__loading-card strong{margin:0;color:#183927;font-size:1.08rem}
.applicant-technical-assessment-page__modal p,.applicant-technical-assessment-page__loading-card p{margin:0;color:#5d7668;line-height:1.65}
.applicant-technical-assessment-page__modal-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.65rem}
.applicant-technical-assessment-page__modal-actions button{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;padding:.74rem .95rem;border:1px solid rgba(83,128,98,.18);background:#fff;color:#355745;font:inherit;font-weight:700;cursor:pointer}
.applicant-technical-assessment-page__modal-actions button.primary{background:#2f6a49;border-color:#2f6a49;color:#fff}
.applicant-technical-assessment-page__loading-card{justify-items:center;text-align:center}
.applicant-technical-assessment-page__spinner{width:2.6rem;height:2.6rem;border:.24rem solid rgba(47,106,73,.16);border-top-color:#2f6a49;border-radius:999px;animation:applicantTechnicalAssessmentSpin .7s linear infinite}
.applicant-technical-assessment-page__modal--result{width:min(100%,32rem)}
.applicant-technical-assessment-page__result-pill{display:inline-flex;justify-self:start;align-items:center;padding:.34rem .68rem;border:1px solid rgba(83,128,98,.18);font-size:.78rem;font-weight:700}
.applicant-technical-assessment-page__result-pill.is-success{background:rgba(221,245,231,.95);color:#176742}
.applicant-technical-assessment-page__result-pill.is-danger{background:rgba(252,232,232,.95);color:#a03636}
.applicant-technical-assessment-page__result-footnote{font-size:.9rem}
.applicant-technical-assessment-page__result-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.9rem 1.05rem;padding-top:.2rem}
.applicant-technical-assessment-page__detail--danger{border-left-color:rgba(239,68,68,.35)!important}
.applicant-technical-assessment-page__detail--danger strong{color:#991b1b}
.applicant-technical-assessment-page__empty{display:grid;place-items:center;align-content:center;gap:.8rem;padding:2rem;text-align:center;color:#5f7a6b;min-height:min(42rem,calc(100vh - 10rem))}
.applicant-technical-assessment-page__empty--inline{min-height:auto;height:100%}
.applicant-technical-assessment-page__empty i{font-size:2rem;color:#4a7b5f}
@keyframes applicantTechnicalAssessmentSpin{to{transform:rotate(360deg)}}
@keyframes applicantTechnicalAssessmentViewerDots{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-.2rem);opacity:1}}
@media (max-width:1180px){.applicant-technical-assessment-page{min-height:auto}.applicant-technical-assessment-page__shell{grid-template-columns:1fr}.applicant-technical-assessment-page__list-pane{max-height:28rem}.applicant-technical-assessment-page__viewer{min-height:30rem}}
@media (max-width:720px){.applicant-technical-assessment-page{padding:0 .85rem}.applicant-technical-assessment-page__message{padding-inline:1rem}.applicant-technical-assessment-page__sender,.applicant-technical-assessment-page__details,.applicant-technical-assessment-page__result-summary{grid-template-columns:1fr}.applicant-technical-assessment-page__actions,.applicant-technical-assessment-page__actions--footer,.applicant-technical-assessment-page__modal-actions{flex-direction:column;align-items:stretch}.applicant-technical-assessment-page__actions button,.applicant-technical-assessment-page__rating-option,.applicant-technical-assessment-page__modal-actions button{width:100%}.applicant-technical-assessment-page__question-head{flex-direction:column;align-items:flex-start}}
</style>
