<script setup>
import { computed, ref, watch } from 'vue'

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
const answerDrafts = ref({})

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

const activeAssessment = computed(() =>
  props.assessmentRecords.find((record) => String(record?.id || '').trim() === String(activeAssessmentId.value || '').trim()) || null,
)

const activeAssessmentDraft = computed(() => {
  const recordId = String(activeAssessment.value?.id || '').trim()
  return recordId ? answerDrafts.value[recordId] || {} : {}
})

const activeAssessmentPendingQuestions = computed(() =>
  (activeAssessment.value?.questions || []).filter((question) =>
    Boolean(question?.required) && !normalizeResponseFilled(activeAssessmentDraft.value?.[question.id])),
)
const newAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) =>
    !record?.isStarted && !record?.isSubmitted && !record?.isCancelled).length,
)
const submittedAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) => record?.isSubmitted).length,
)
const discontinuedAssessmentCount = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).filter((record) => record?.isCancelled).length,
)
const assessmentSummaryCards = computed(() => [
  {
    id: 'assigned',
    label: 'Assigned',
    value: String((Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).length),
    copy: 'Assessments currently visible in your workspace',
  },
  {
    id: 'ready',
    label: 'Ready',
    value: String(newAssessmentCount.value),
    copy: 'New assessments that can be started right away',
  },
  {
    id: 'submitted',
    label: 'Submitted',
    value: String(submittedAssessmentCount.value),
    copy: 'Assessments already completed and sent',
  },
  {
    id: 'stopped',
    label: 'Stopped',
    value: String(discontinuedAssessmentCount.value),
    copy: 'Assignments discontinued or no longer active',
  },
])
const activeAssessmentOverviewCards = computed(() => {
  if (!activeAssessment.value) return []

  return [
    {
      id: 'questions',
      label: 'Questions',
      value: String(activeAssessment.value.questions.length || 0),
    },
    {
      id: 'pass-mark',
      label: 'Pass Mark',
      value: `${Number(activeAssessment.value.passingScorePercent || 0)}%`,
    },
    {
      id: 'required-left',
      label: 'Required Left',
      value: String(activeAssessment.value.isSubmitted ? 0 : activeAssessmentPendingQuestions.value.length),
    },
  ]
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
const activeAssessmentCompletionCards = computed(() => {
  if (!activeAssessment.value?.isSubmitted || activeAssessment.value?.isCancelled) return []

  return [
    {
      id: 'submitted-on',
      label: 'Submitted',
      value: activeAssessment.value.submittedAtLabel || 'Just now',
    },
    {
      id: 'result',
      label: 'Result',
      value: activeAssessment.value.statusLabel || 'Submitted',
    },
    {
      id: 'score',
      label: 'Score',
      value: activeAssessment.value.scoreLabel || 'Pending',
    },
    {
      id: 'pass-mark',
      label: 'Pass Mark',
      value: `${Number(activeAssessment.value.passingScorePercent || 0)}%`,
    },
  ]
})
const nextAvailableAssessment = computed(() =>
  (Array.isArray(props.assessmentRecords) ? props.assessmentRecords : []).find((record) =>
    String(record?.id || '').trim() !== String(activeAssessment.value?.id || '').trim()
      && !record?.isSubmitted
      && !record?.isCancelled) || null,
)

const selectAssessment = (assessmentId) => {
  activeAssessmentId.value = String(assessmentId || '').trim()
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

const startAssessment = () => {
  if (!activeAssessment.value?.id || activeAssessment.value?.isCancelled) return
  emit('start-assessment', activeAssessment.value.id)
}

const submitAssessment = () => {
  if (!activeAssessment.value?.id || activeAssessment.value?.isSubmitted || activeAssessment.value?.isCancelled) return
  if (activeAssessmentPendingQuestions.value.length) return

  emit('submit-assessment', {
    assessmentId: activeAssessment.value.id,
    responses: cloneJson(activeAssessmentDraft.value, {}),
  })
}

const getMultipleChoiceValue = (questionId) => Number(activeAssessmentDraft.value?.[questionId])
const isCheckboxChecked = (questionId, optionIndex) =>
  Array.isArray(activeAssessmentDraft.value?.[questionId]) && activeAssessmentDraft.value[questionId].includes(optionIndex)
</script>

<template>
  <section class="applicant-technical-assessment-page">
    <div class="applicant-technical-assessment-page__shell">
      <aside class="applicant-technical-assessment-page__rail">
        <article class="applicant-technical-assessment-page__summary-card">
          <p class="applicant-technical-assessment-page__eyebrow">Technical Assessment</p>
          <h2>Assigned Assessments</h2>
          <p>Review each assigned technical assessment and submit your answers once you are ready.</p>
          <div v-if="newAssessmentCount" class="applicant-technical-assessment-page__alert">
            <i class="bi bi-bell-fill" aria-hidden="true" />
            <span>{{ newAssessmentCount }} new assessment<span v-if="newAssessmentCount !== 1">s</span> ready to start</span>
          </div>

          <div class="applicant-technical-assessment-page__summary-grid">
            <article
              v-for="item in assessmentSummaryCards"
              :key="item.id"
              class="applicant-technical-assessment-page__summary-item"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.copy }}</small>
            </article>
          </div>
        </article>

        <div v-if="assessmentRecords.length" class="applicant-technical-assessment-page__assignment-list">
          <button
            v-for="record in assessmentRecords"
            :key="record.id"
            type="button"
            class="applicant-technical-assessment-page__assignment-card"
            :class="{ 'is-active': String(activeAssessmentId || '').trim() === String(record.id || '').trim(), 'is-inactive': record.isCancelled }"
            @click="selectAssessment(record.id)"
          >
            <div class="applicant-technical-assessment-page__assignment-head">
              <strong>{{ record.jobTitle }}</strong>
              <div class="applicant-technical-assessment-page__assignment-badges">
                <span
                  v-if="!record.isStarted && !record.isSubmitted && !record.isCancelled"
                  class="applicant-technical-assessment-page__new-badge"
                >
                  New
                </span>
                <span class="applicant-technical-assessment-page__status" :class="`is-${record.statusTone}`">
                  {{ record.statusLabel }}
                </span>
              </div>
            </div>
            <p>{{ record.company }}</p>
            <div class="applicant-technical-assessment-page__assignment-meta">
              <small>Assigned {{ record.assignedAtLabel }}</small>
              <small>{{ record.questions.length }} question<span v-if="record.questions.length !== 1">s</span></small>
              <small>Pass {{ record.passingScorePercent }}%</small>
            </div>
          </button>
        </div>
      </aside>

      <article class="applicant-technical-assessment-page__panel">
        <div v-if="!hasApplications" class="applicant-technical-assessment-page__empty">
          <i class="bi bi-send-x" aria-hidden="true" />
          <h3>No job applications yet</h3>
          <p>Apply to a job first. Once a business approves your application and assigns an assessment, it will appear here.</p>
        </div>

        <div v-else-if="!assessmentRecords.length" class="applicant-technical-assessment-page__empty">
          <i class="bi bi-ui-checks-grid" aria-hidden="true" />
          <h3>No technical assessment assigned yet</h3>
          <p>Wait for a business owner to approve your application and assign a technical assessment template.</p>
        </div>

        <div
          v-else-if="activeAssessment"
          class="applicant-technical-assessment-page__workspace"
          :class="{ 'is-inactive': activeAssessment.isCancelled }"
        >
          <section class="applicant-technical-assessment-page__hero-card">
            <header class="applicant-technical-assessment-page__header">
              <div class="applicant-technical-assessment-page__header-copy">
                <p class="applicant-technical-assessment-page__eyebrow">Assessment Details</p>
                <h3>{{ activeAssessment.title }}</h3>
                <p>{{ activeAssessment.company }} &middot; {{ activeAssessment.jobTitle }}</p>
              </div>
              <span class="applicant-technical-assessment-page__status applicant-technical-assessment-page__status--large" :class="`is-${activeAssessment.statusTone}`">
                {{ activeAssessment.statusLabel }}
              </span>
            </header>

            <div
              v-if="activeAssessment.isCancelled"
              class="applicant-technical-assessment-page__alert applicant-technical-assessment-page__alert--inline applicant-technical-assessment-page__alert--danger"
            >
              <i class="bi bi-slash-circle" aria-hidden="true" />
              <span>{{ activeAssessment.cancellationReason || 'This technical assessment was discontinued because the job post was deleted.' }}</span>
            </div>

            <div
              v-else-if="!activeAssessment.isStarted && !activeAssessment.isSubmitted"
              class="applicant-technical-assessment-page__alert applicant-technical-assessment-page__alert--inline"
            >
              <i class="bi bi-stars" aria-hidden="true" />
              <span>This technical assessment is new and ready to start.</span>
            </div>

            <div class="applicant-technical-assessment-page__meta">
              <span>Assigned {{ activeAssessment.assignedAtLabel }}</span>
              <span v-if="activeAssessment.submittedAtLabel">Submitted {{ activeAssessment.submittedAtLabel }}</span>
              <span>{{ activeAssessment.questions.length }} {{ activeAssessment.questions.length === 1 ? 'question' : 'questions' }}</span>
            </div>

            <div class="applicant-technical-assessment-page__overview-grid">
              <article
                v-for="item in activeAssessmentOverviewCards"
                :key="item.id"
                class="applicant-technical-assessment-page__overview-item"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </article>
            </div>
          </section>

          <section
            v-if="!activeAssessment.isSubmitted"
            class="applicant-technical-assessment-page__intro-card"
          >
            <p v-if="activeAssessment.description">{{ activeAssessment.description }}</p>
            <p v-else class="applicant-technical-assessment-page__muted">No extra description was added for this technical assessment.</p>

            <div class="applicant-technical-assessment-page__instructions">
              <strong>Instructions</strong>
              <p v-if="activeAssessment.instructions">{{ activeAssessment.instructions }}</p>
              <p v-else class="applicant-technical-assessment-page__muted">Read each question carefully before submitting your assessment.</p>
            </div>

            <button
              v-if="!activeAssessment.isStarted && !activeAssessment.isSubmitted && !activeAssessment.isCancelled"
              type="button"
              class="applicant-technical-assessment-page__primary"
              @click="startAssessment"
            >
              Ready to Start
            </button>
          </section>

          <section
            v-else-if="activeAssessmentCompletionState"
            class="applicant-technical-assessment-page__completion-card"
            :class="`is-${activeAssessmentCompletionState.tone}`"
          >
            <div class="applicant-technical-assessment-page__completion-hero">
              <div class="applicant-technical-assessment-page__completion-icon" aria-hidden="true">
                <i :class="activeAssessmentCompletionState.icon" />
              </div>

              <div class="applicant-technical-assessment-page__completion-copy">
                <p class="applicant-technical-assessment-page__eyebrow">Assessment Completed</p>
                <h4>{{ activeAssessmentCompletionState.title }}</h4>
                <p>{{ activeAssessmentCompletionState.message }}</p>
              </div>
            </div>

            <div class="applicant-technical-assessment-page__completion-grid">
              <article
                v-for="item in activeAssessmentCompletionCards"
                :key="item.id"
                class="applicant-technical-assessment-page__completion-item"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </article>
            </div>

            <div class="applicant-technical-assessment-page__completion-footer">
              <p class="applicant-technical-assessment-page__success">
                {{ activeAssessmentCompletionState.footnote }}
              </p>

              <button
                v-if="nextAvailableAssessment"
                type="button"
                class="applicant-technical-assessment-page__secondary"
                @click="selectAssessment(nextAvailableAssessment.id)"
              >
                Open Next Assessment
              </button>
            </div>
          </section>

          <section
            v-if="activeAssessment.isStarted && !activeAssessment.isSubmitted && !activeAssessment.isCancelled"
            class="applicant-technical-assessment-page__form"
          >
            <article
              v-for="(question, index) in activeAssessment.questions"
              :key="question.id || `${activeAssessment.id}-question-${index}`"
              class="applicant-technical-assessment-page__question"
            >
              <div class="applicant-technical-assessment-page__question-head">
                <strong>Question {{ index + 1 }}</strong>
                <span v-if="question.required">Required</span>
              </div>

              <h4>{{ question.label || `Question ${index + 1}` }}</h4>
              <p v-if="question.helpText">{{ question.helpText }}</p>

              <input
                v-if="question.type === 'short-text'"
                :value="activeAssessmentDraft[question.id] || ''"
                type="text"
                class="applicant-technical-assessment-page__input"
                :readonly="activeAssessment.isSubmitted"
                placeholder="Enter your answer"
                @input="setAnswerValue(question.id, $event.target.value)"
              />

              <textarea
                v-else-if="question.type === 'paragraph'"
                :value="activeAssessmentDraft[question.id] || ''"
                rows="5"
                class="applicant-technical-assessment-page__textarea"
                :readonly="activeAssessment.isSubmitted"
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
                    :disabled="activeAssessment.isSubmitted"
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
                    :disabled="activeAssessment.isSubmitted"
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
                  :disabled="activeAssessment.isSubmitted"
                  @click="setAnswerValue(question.id, option)"
                >
                  {{ option }}
                </button>
              </div>
            </article>

            <div class="applicant-technical-assessment-page__footer">
              <p v-if="activeAssessmentPendingQuestions.length" class="applicant-technical-assessment-page__warning">
                Complete all required questions before submitting this assessment.
              </p>

              <button
                type="button"
                class="applicant-technical-assessment-page__primary"
                :disabled="activeAssessmentPendingQuestions.length > 0"
                @click="submitAssessment"
              >
                Submit Assessment
              </button>
            </div>
          </section>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.applicant-technical-assessment-page {
  width: 100%;
  min-height: calc(100vh - 9rem);
  padding: 0 1.25rem;
}

.applicant-technical-assessment-page__shell {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 1.15rem;
  align-items: start;
}

.applicant-technical-assessment-page__rail {
  display: grid;
  gap: 0.95rem;
  align-content: start;
}

.applicant-technical-assessment-page__summary-card,
.applicant-technical-assessment-page__panel {
  border: 1px solid rgba(112, 168, 136, 0.16);
  border-radius: 1.12rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 251, 247, 0.94) 100%);
  box-shadow:
    0 16px 36px rgba(79, 129, 102, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.applicant-technical-assessment-page__summary-card {
  display: grid;
  gap: 0.95rem;
  padding: 1.15rem 1.2rem;
}

.applicant-technical-assessment-page__panel {
  min-height: calc(100vh - 10.5rem);
  padding: 1.15rem 1.2rem;
}

.applicant-technical-assessment-page__hero-card {
  display: grid;
  gap: 0.95rem;
  padding: 1.1rem 1.1rem 1rem;
  border: 1px solid rgba(126, 173, 148, 0.2);
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at top right, rgba(208, 241, 221, 0.5), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 251, 247, 0.98) 100%);
  box-shadow:
    0 18px 36px rgba(79, 129, 102, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.applicant-technical-assessment-page__eyebrow {
  margin: 0;
  color: #4e7b63;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-technical-assessment-page__summary-card h2,
.applicant-technical-assessment-page__header h3,
.applicant-technical-assessment-page__empty h3,
.applicant-technical-assessment-page__question h4 {
  margin: 0.28rem 0 0;
  color: #172033;
}

.applicant-technical-assessment-page__summary-card p,
.applicant-technical-assessment-page__header p,
.applicant-technical-assessment-page__empty p,
.applicant-technical-assessment-page__intro-card p,
.applicant-technical-assessment-page__completion-copy p,
.applicant-technical-assessment-page__question p {
  margin: 0.32rem 0 0;
  color: #64748b;
  line-height: 1.6;
}

.applicant-technical-assessment-page__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.applicant-technical-assessment-page__summary-item,
.applicant-technical-assessment-page__overview-item,
.applicant-technical-assessment-page__intro-card,
.applicant-technical-assessment-page__completion-card,
.applicant-technical-assessment-page__question,
.applicant-technical-assessment-page__assignment-card {
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 1rem;
  background: #ffffff;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.03),
    0 14px 28px rgba(15, 23, 42, 0.06);
}

.applicant-technical-assessment-page__summary-item {
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 0.95rem;
}

.applicant-technical-assessment-page__summary-item span,
.applicant-technical-assessment-page__overview-item span {
  color: #64748b;
  font-size: 0.71rem;
  font-weight: 700;
}

.applicant-technical-assessment-page__summary-item strong,
.applicant-technical-assessment-page__overview-item strong {
  color: #111827;
  font-size: 1.22rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.applicant-technical-assessment-page__overview-item strong {
  font-size: 1.5rem;
  line-height: 1;
}

.applicant-technical-assessment-page__summary-item small {
  color: #6b7280;
  font-size: 0.68rem;
  line-height: 1.45;
}

.applicant-technical-assessment-page__assignment-list {
  display: grid;
  gap: 0.75rem;
}

.applicant-technical-assessment-page__assignment-card {
  display: grid;
  gap: 0.48rem;
  padding: 0.95rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.applicant-technical-assessment-page__assignment-card.is-active {
  border-color: rgba(47, 106, 73, 0.4);
  box-shadow:
    0 18px 34px rgba(15, 23, 42, 0.1),
    0 6px 14px rgba(52, 109, 78, 0.06);
  transform: translateY(-2px);
}

.applicant-technical-assessment-page__assignment-card.is-inactive {
  border-color: rgba(203, 213, 225, 0.7);
  background: linear-gradient(180deg, #fbfcfb 0%, #f7f9f8 100%);
}

.applicant-technical-assessment-page__assignment-card:hover {
  border-color: rgba(47, 106, 73, 0.28);
  transform: translateY(-1px);
}

.applicant-technical-assessment-page__assignment-head,
.applicant-technical-assessment-page__header,
.applicant-technical-assessment-page__question-head,
.applicant-technical-assessment-page__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
}

.applicant-technical-assessment-page__assignment-head strong,
.applicant-technical-assessment-page__question-head strong {
  color: #172033;
}

.applicant-technical-assessment-page__header {
  align-items: flex-start;
}

.applicant-technical-assessment-page__header-copy {
  display: grid;
  gap: 0.22rem;
}

.applicant-technical-assessment-page__assignment-badges {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.applicant-technical-assessment-page__assignment-card p {
  margin: 0;
  color: #475569;
  font-size: 0.8rem;
}

.applicant-technical-assessment-page__assignment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.7rem;
}

.applicant-technical-assessment-page__assignment-meta small,
.applicant-technical-assessment-page__meta {
  color: #708179;
  font-size: 0.74rem;
}

.applicant-technical-assessment-page__workspace,
.applicant-technical-assessment-page__form {
  display: grid;
  gap: 0.95rem;
}

.applicant-technical-assessment-page__workspace.is-inactive .applicant-technical-assessment-page__intro-card,
.applicant-technical-assessment-page__workspace.is-inactive .applicant-technical-assessment-page__question {
  background: #fafbf9;
}

.applicant-technical-assessment-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.applicant-technical-assessment-page__meta > span {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.8rem;
  border: 1px solid rgba(205, 216, 226, 0.88);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.applicant-technical-assessment-page__overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(9.75rem, 11.5rem));
  gap: 0.75rem;
  justify-content: start;
}

.applicant-technical-assessment-page__overview-item {
  display: grid;
  gap: 0.18rem;
  min-height: 5.25rem;
  padding: 0.8rem 0.9rem;
  border-color: rgba(191, 219, 204, 0.88);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 252, 250, 0.96) 100%);
}

.applicant-technical-assessment-page__intro-card,
.applicant-technical-assessment-page__completion-card,
.applicant-technical-assessment-page__question {
  display: grid;
  gap: 0.85rem;
  padding: 1rem 1.05rem;
}

.applicant-technical-assessment-page__completion-card {
  gap: 0.82rem;
  padding: 0.88rem 0.95rem;
  border-color: rgba(134, 239, 172, 0.36);
  background:
    radial-gradient(circle at top right, rgba(240, 253, 244, 0.95), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(247, 253, 249, 0.98) 100%);
}

.applicant-technical-assessment-page__completion-card.is-warning {
  border-color: rgba(251, 191, 36, 0.32);
  background:
    radial-gradient(circle at top right, rgba(255, 251, 235, 0.98), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 251, 235, 0.92) 100%);
}

.applicant-technical-assessment-page__completion-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.82rem;
  align-items: start;
}

.applicant-technical-assessment-page__completion-icon {
  width: 2.95rem;
  height: 2.95rem;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.16) 0%, rgba(187, 247, 208, 0.3) 100%);
  color: #15803d;
  font-size: 1.02rem;
}

.applicant-technical-assessment-page__completion-card.is-warning .applicant-technical-assessment-page__completion-icon {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(254, 240, 138, 0.24) 100%);
  color: #b45309;
}

.applicant-technical-assessment-page__completion-copy {
  display: grid;
  gap: 0.22rem;
}

.applicant-technical-assessment-page__completion-copy h4 {
  margin: 0;
  color: #172033;
  font-size: 1.06rem;
  font-weight: 700;
}

.applicant-technical-assessment-page__completion-copy p:last-child {
  margin-top: 0;
}

.applicant-technical-assessment-page__completion-copy p {
  font-size: 0.94rem;
  font-weight: 500;
  line-height: 1.5;
}

.applicant-technical-assessment-page__completion-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.applicant-technical-assessment-page__completion-item {
  display: grid;
  gap: 0.22rem;
  min-height: 4.35rem;
  padding: 0.7rem 0.82rem;
  border: 1px solid rgba(221, 231, 225, 0.92);
  border-radius: 0.92rem;
  background: rgba(255, 255, 255, 0.88);
}

.applicant-technical-assessment-page__completion-item span {
  color: #64748b;
  font-size: 0.64rem;
  font-weight: 700;
}

.applicant-technical-assessment-page__completion-item strong {
  color: #0f172a;
  font-size: 0.96rem;
  font-weight: 700;
}

.applicant-technical-assessment-page__completion-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.72rem;
  flex-wrap: wrap;
}

.applicant-technical-assessment-page__completion-footer .applicant-technical-assessment-page__success {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 600;
  line-height: 1.45;
}

.applicant-technical-assessment-page__alert {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.72rem 0.9rem;
  border: 1px solid rgba(253, 186, 116, 0.36);
  border-radius: 0.95rem;
  background: rgba(255, 247, 237, 0.96);
  color: #b45309;
  font-size: 0.82rem;
  font-weight: 700;
}

.applicant-technical-assessment-page__alert--inline {
  margin-top: 0;
  width: fit-content;
  max-width: 100%;
}

.applicant-technical-assessment-page__alert--danger {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(254, 242, 242, 0.94);
  color: #b42318;
}

.applicant-technical-assessment-page__instructions {
  display: grid;
  gap: 0.35rem;
}

.applicant-technical-assessment-page__instructions strong {
  color: #172033;
}

.applicant-technical-assessment-page__input,
.applicant-technical-assessment-page__textarea {
  width: 100%;
  min-height: 2.9rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.95rem;
  background: #fcfdfd;
  padding: 0.85rem 0.95rem;
  font: inherit;
  color: #213028;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.applicant-technical-assessment-page__textarea {
  min-height: 8rem;
  resize: vertical;
}

.applicant-technical-assessment-page__input:focus,
.applicant-technical-assessment-page__textarea:focus {
  outline: none;
  border-color: rgba(47, 106, 73, 0.32);
  box-shadow: 0 0 0 4px rgba(47, 106, 73, 0.08);
  background: #ffffff;
}

.applicant-technical-assessment-page__choices {
  display: grid;
  gap: 0.65rem;
}

.applicant-technical-assessment-page__choice {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  border: 1px solid rgba(221, 231, 225, 0.92);
  border-radius: 0.95rem;
  background: #fbfcfc;
  padding: 0.8rem 0.9rem;
  color: #334155;
}

.applicant-technical-assessment-page__choice input {
  margin-top: 0.16rem;
}

.applicant-technical-assessment-page__rating {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.applicant-technical-assessment-page__secondary,
.applicant-technical-assessment-page__rating-option,
.applicant-technical-assessment-page__primary {
  min-height: 2.75rem;
  border: 1px solid rgba(205, 216, 226, 0.92);
  border-radius: 0.95rem;
  background: #ffffff;
  color: #24583d;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.applicant-technical-assessment-page__rating-option {
  min-width: 2.75rem;
  padding: 0 1rem;
}

.applicant-technical-assessment-page__secondary {
  padding: 0 1rem;
  color: #24583d;
}

.applicant-technical-assessment-page__rating-option.is-selected,
.applicant-technical-assessment-page__primary {
  background: linear-gradient(135deg, #2f6a49 0%, #4f8c67 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(47, 106, 73, 0.18);
}

.applicant-technical-assessment-page__primary {
  padding: 0 1rem;
}

.applicant-technical-assessment-page__rating-option:hover,
.applicant-technical-assessment-page__secondary:hover,
.applicant-technical-assessment-page__primary:hover {
  transform: translateY(-1px);
}

.applicant-technical-assessment-page__primary:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.applicant-technical-assessment-page__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0 0.8rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.applicant-technical-assessment-page__new-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  background: #dc2626;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.applicant-technical-assessment-page__status.is-warning {
  background: rgba(255, 244, 221, 0.98);
  color: #9a6700;
}

.applicant-technical-assessment-page__status.is-accent {
  background: rgba(230, 241, 255, 0.98);
  color: #1d4ed8;
}

.applicant-technical-assessment-page__status.is-success {
  background: rgba(218, 244, 225, 0.96);
  color: #1f7a45;
}

.applicant-technical-assessment-page__status.is-danger {
  background: rgba(254, 226, 226, 0.98);
  color: #b42318;
}

.applicant-technical-assessment-page__status.is-muted {
  background: rgba(241, 245, 249, 0.98);
  color: #475569;
}

.applicant-technical-assessment-page__status--large {
  min-height: 2.3rem;
  padding-inline: 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    0 12px 22px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.applicant-technical-assessment-page__warning {
  color: #b45309;
  font-weight: 700;
}

.applicant-technical-assessment-page__success {
  color: #047857;
  font-weight: 700;
}

.applicant-technical-assessment-page__muted {
  color: #7b8a83;
}

.applicant-technical-assessment-page__empty {
  min-height: calc(100vh - 12rem);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  text-align: center;
}

.applicant-technical-assessment-page__empty i {
  font-size: 2rem;
  color: #2f6f49;
}

@media (max-width: 1080px) {
  .applicant-technical-assessment-page__shell {
    grid-template-columns: 1fr;
  }

  .applicant-technical-assessment-page__summary-grid,
  .applicant-technical-assessment-page__completion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .applicant-technical-assessment-page__overview-grid {
    grid-template-columns: repeat(2, minmax(9.5rem, 11.5rem));
  }

  .applicant-technical-assessment-page__panel {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .applicant-technical-assessment-page {
    padding: 0 0.85rem;
  }

  .applicant-technical-assessment-page__summary-grid,
  .applicant-technical-assessment-page__completion-grid {
    grid-template-columns: 1fr;
  }

  .applicant-technical-assessment-page__hero-card {
    padding: 0.95rem;
  }

  .applicant-technical-assessment-page__overview-grid {
    grid-template-columns: 1fr;
  }

  .applicant-technical-assessment-page__header,
  .applicant-technical-assessment-page__question-head,
  .applicant-technical-assessment-page__footer,
  .applicant-technical-assessment-page__completion-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .applicant-technical-assessment-page__completion-hero {
    grid-template-columns: 1fr;
  }
}
</style>
