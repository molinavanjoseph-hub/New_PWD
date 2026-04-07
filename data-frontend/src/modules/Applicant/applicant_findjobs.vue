<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  jobsLoading: { type: Boolean, default: false },
  findJobsQuery: { type: String, default: '' },
  filteredApplicantJobs: { type: Array, default: () => [] },
  selectedFindJob: { type: Object, default: null },
  shouldShowApplicantJobNewTag: { type: Function, required: true },
  applicantDisability: { type: String, default: '' },
  applicantJobFilterMode: { type: String, default: 'matched' },
  applicantJobPwdOptions: { type: Array, default: () => [] },
  applicantJobPwdType: { type: String, default: '' },
  applicantJobSalaryOptions: { type: Array, default: () => [] },
  applicantJobSalaryRange: { type: String, default: '' },
  applicantJobSortMode: { type: String, default: 'match' },
  applicantJobSortLabel: { type: String, default: 'Strongest match' },
  applicantJobSortOptions: { type: Array, default: () => [] },
  disableCardAnimations: { type: Boolean, default: false },
  resolveApplicantJobApplicationState: { type: Function, default: null },
  isApplicantJobSaved: { type: Function, default: null },
  onSetApplicantJobFilterMode: { type: Function, default: null },
  onSetApplicantJobPwdType: { type: Function, default: null },
  onSetApplicantJobSalaryRange: { type: Function, default: null },
  onSetApplicantJobSortMode: { type: Function, default: null },
  onResetApplicantJobFilters: { type: Function, default: null },
})

const emit = defineEmits([
  'update:findJobsQuery',
  'set-applicant-job-filter-mode',
  'set-applicant-job-pwd-type',
  'set-applicant-job-salary-range',
  'set-applicant-job-sort-mode',
  'reset-applicant-job-filters',
  'select-find-job',
  'save-applicant-job',
  'apply-applicant-job',
])

const isApplicantJobFilterMenuOpen = ref(false)
const isApplicantJobSortMenuOpen = ref(false)

const onCardBeforeEnter = (el) => {
  if (props.disableCardAnimations) return
  el.style.opacity = '0'
  el.style.transform = 'translateY(1.2rem) scale(0.97)'
  el.style.filter = 'blur(2px)'
}

const onCardEnter = (el, done) => {
  if (props.disableCardAnimations) {
    done()
    return
  }
  const index = Number(el.dataset.cardIndex || 0)
  const delay = index * 55
  el.style.transition = `opacity 0.36s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter 0.32s ease ${delay}ms`
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0) scale(1)'
    el.style.filter = 'blur(0)'
  })
  const cleanupTimer = setTimeout(() => {
    el.style.transition = ''
    el.style.transform = ''
    el.style.filter = ''
    el.style.opacity = ''
    done()
  }, 400 + delay + 50)
  el._cardCleanupTimer = cleanupTimer
}

const onCardLeave = (el, done) => {
  if (props.disableCardAnimations) {
    done()
    return
  }
  const index = Number(el.dataset.cardIndex || 0)
  const delay = index * 30
  el.style.transition = `opacity 0.22s ease ${delay}ms, transform 0.24s ease ${delay}ms, filter 0.2s ease ${delay}ms`
  requestAnimationFrame(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(-0.5rem) scale(0.98)'
    el.style.filter = 'blur(1.5px)'
  })
  setTimeout(() => {
    done()
  }, 240 + delay + 20)
}
const isAroundYouFilterActive = computed(() => props.applicantJobFilterMode === 'matched')
const aroundYouButtonLabel = computed(() => (isAroundYouFilterActive.value ? 'Around You' : 'All'))
const aroundYouSummaryLabel = computed(() =>
  isAroundYouFilterActive.value
    ? (props.applicantDisability ? `Based on ${props.applicantDisability}` : 'Based on your disability')
    : 'Showing all disability-friendly jobs',
)
const fallbackApplicantJobApplicationState = {
  hasApplied: false,
  disabled: false,
  buttonLabel: 'Apply Now',
  statusLabel: '',
  statusTone: 'pending',
  helperText: '',
  rejectionReason: '',
}
const getApplicantJobApplicationState = (job) => {
  if (typeof props.resolveApplicantJobApplicationState !== 'function') {
    return fallbackApplicantJobApplicationState
  }

  return {
    ...fallbackApplicantJobApplicationState,
    ...(props.resolveApplicantJobApplicationState(job) || {}),
  }
}
const isApplicantJobSavedState = (job) =>
  typeof props.isApplicantJobSaved === 'function' ? props.isApplicantJobSaved(job) === true : false
const displayedFindJob = ref(props.selectedFindJob)
const stagedFindJob = ref(props.selectedFindJob)
const selectedFindJobApplicationState = computed(() => getApplicantJobApplicationState(displayedFindJob.value))
const normalizedDisplayedFindJobId = computed(() => String(displayedFindJob.value?.id || '').trim())
const DETAIL_SKELETON_DURATION_MS = 180
const isDetailSkeletonVisible = ref(false)
const pendingDetailJobId = ref('')
let detailSkeletonTimer = null
let detailSelectionFrameId = 0

const clearDetailSkeletonTimer = () => {
  if (!detailSkeletonTimer) return
  clearTimeout(detailSkeletonTimer)
  detailSkeletonTimer = null
}

const clearDetailSelectionFrame = () => {
  if (!detailSelectionFrameId) return
  cancelAnimationFrame(detailSelectionFrameId)
  detailSelectionFrameId = 0
}

const finishDetailSkeleton = () => {
  clearDetailSkeletonTimer()
  displayedFindJob.value = stagedFindJob.value
  isDetailSkeletonVisible.value = false
  pendingDetailJobId.value = ''
}

const scheduleDetailSkeletonFinish = () => {
  clearDetailSkeletonTimer()
  detailSkeletonTimer = setTimeout(() => {
    detailSkeletonTimer = null
    finishDetailSkeleton()
  }, DETAIL_SKELETON_DURATION_MS)
}

const handleSelectFindJob = async (jobId) => {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId) return
  if (normalizedDisplayedFindJobId.value === normalizedJobId && !isDetailSkeletonVisible.value) return

  pendingDetailJobId.value = normalizedJobId
  isDetailSkeletonVisible.value = true
  clearDetailSkeletonTimer()
  clearDetailSelectionFrame()
  await nextTick()
  detailSelectionFrameId = requestAnimationFrame(() => {
    detailSelectionFrameId = 0
    emit('select-find-job', normalizedJobId)
  })
}

watch(
  () => props.selectedFindJob,
  (nextJob) => {
    stagedFindJob.value = nextJob
    const nextId = String(nextJob?.id || '').trim()

    if (!nextId) {
      finishDetailSkeleton()
      return
    }

    if (!pendingDetailJobId.value) {
      displayedFindJob.value = nextJob
      return
    }

    if (nextId === pendingDetailJobId.value) {
      scheduleDetailSkeletonFinish()
      return
    }

    pendingDetailJobId.value = nextId
    scheduleDetailSkeletonFinish()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  clearDetailSkeletonTimer()
  clearDetailSelectionFrame()
})

const formatApplicantJobPostedDateTime = (job) => {
  const createdAtMs = Number(job?.createdAtMs || 0)
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
    return String(job?.postedDate || 'Recently posted').trim() || 'Recently posted'
  }

  const createdAt = new Date(createdAtMs)
  const timeLabel = createdAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const dateLabel = createdAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${timeLabel} • ${dateLabel}`
}
const formatApplicantVacancyCount = (count) => {
  const normalizedCount = Math.max(0, Number(count || 0) || 0)
  return `${normalizedCount} ${normalizedCount === 1 ? 'Vacancy' : 'Vacancies'}`
}
const toggleApplicantJobFilterMenu = () => {
  isApplicantJobFilterMenuOpen.value = !isApplicantJobFilterMenuOpen.value
}

const toggleApplicantJobSortMenu = () => {
  isApplicantJobSortMenuOpen.value = !isApplicantJobSortMenuOpen.value
}

const setApplicantJobAreaMode = (mode) => {
  const nextMode = String(mode || '').trim().toLowerCase()
  if (!nextMode) return

  if (props.applicantJobFilterMode !== nextMode) {
    if (typeof props.onSetApplicantJobFilterMode === 'function') {
      props.onSetApplicantJobFilterMode(nextMode)
    } else {
      emit('set-applicant-job-filter-mode', nextMode)
    }
  }

  isApplicantJobFilterMenuOpen.value = false
}

const handleApplicantJobPwdTypeChange = (event) => {
  const nextValue = event?.target?.value || ''
  if (typeof props.onSetApplicantJobPwdType === 'function') {
    props.onSetApplicantJobPwdType(nextValue)
    return
  }
  emit('set-applicant-job-pwd-type', nextValue)
}

const handleApplicantJobSalaryRangeChange = (event) => {
  const nextValue = event?.target?.value || ''
  if (typeof props.onSetApplicantJobSalaryRange === 'function') {
    props.onSetApplicantJobSalaryRange(nextValue)
    return
  }
  emit('set-applicant-job-salary-range', nextValue)
}

const selectApplicantJobSortMode = (mode) => {
  if (typeof props.onSetApplicantJobSortMode === 'function') {
    props.onSetApplicantJobSortMode(mode)
  } else {
    emit('set-applicant-job-sort-mode', mode)
  }
  isApplicantJobSortMenuOpen.value = false
}

const resetApplicantJobFilters = () => {
  if (typeof props.onResetApplicantJobFilters === 'function') {
    props.onResetApplicantJobFilters()
  } else {
    emit('reset-applicant-job-filters')
  }
  isApplicantJobFilterMenuOpen.value = false
}
</script>

<template>
  <section class="applicant-find-jobs">
    <section class="applicant-find-jobs__grid">
      <section class="applicant-find-jobs__main">
        <section class="applicant-find-jobs__hero">
          <div class="applicant-find-jobs__searchbar">
            <div class="applicant-find-jobs__filter-shell">
              <button
                type="button"
                class="applicant-find-jobs__location"
                :class="{ 'is-active': isApplicantJobFilterMenuOpen }"
                :aria-expanded="isApplicantJobFilterMenuOpen ? 'true' : 'false'"
                @click="toggleApplicantJobFilterMenu"
              >
                <i class="bi bi-geo-alt-fill" />
                <span>{{ aroundYouButtonLabel }}</span>
                <i class="bi bi-chevron-down" />
              </button>

              <Transition name="applicant-find-jobs-filter">
                <div v-if="isApplicantJobFilterMenuOpen" class="applicant-find-jobs__filter-panel applicant-find-jobs__filter-panel--location">
                  <div class="applicant-find-jobs__filter-panel-head">
                    <div>
                      <strong>Job scope</strong>
                      <p>Choose whether to show jobs matched to your disability or all available disability types.</p>
                    </div>
                  </div>

                  <div class="applicant-find-jobs__filter-mode-list applicant-find-jobs__filter-mode-list--stacked">
                    <button
                      type="button"
                      class="applicant-find-jobs__filter-mode-button"
                      :class="{ 'is-active': isAroundYouFilterActive }"
                      @click="setApplicantJobAreaMode('matched')"
                    >
                      Around You
                    </button>
                    <button
                      type="button"
                      class="applicant-find-jobs__filter-mode-button"
                      :class="{ 'is-active': applicantJobFilterMode === 'all' }"
                      @click="setApplicantJobAreaMode('all')"
                    >
                      All
                    </button>
                  </div>

                  <p class="applicant-find-jobs__filter-summary">
                    <strong>{{ aroundYouButtonLabel }}</strong> {{ aroundYouSummaryLabel }}
                  </p>
                </div>
              </Transition>
            </div>

            <label class="applicant-find-jobs__searchfield">
              <i class="bi bi-search" />
              <input
                :value="findJobsQuery"
                type="text"
                placeholder="Search by title, company or any job keyword..."
                @input="emit('update:findJobsQuery', $event.target.value)"
              >
            </label>

            <button type="button" class="applicant-find-jobs__toolbar-button applicant-find-jobs__toolbar-button--primary">
              <i class="bi bi-search" />
              <span>Find</span>
            </button>
          </div>

        </section>

        <section
          class="applicant-find-jobs__layout"
          :class="{ 'applicant-find-jobs__layout--split': filteredApplicantJobs.length }"
        >
          <div v-if="jobsLoading" class="applicant-find-jobs__loading">
            <div class="applicant-find-jobs__loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span class="applicant-find-jobs__loading-label">Loading job posts...</span>
          </div>

          <template v-else-if="filteredApplicantJobs.length">
            <TransitionGroup
              tag="div"
              class="applicant-find-jobs__list"
              :css="false"
              @before-enter="onCardBeforeEnter"
              @enter="onCardEnter"
              @leave="onCardLeave"
            >
              <article
                v-for="(job, jobCardIndex) in filteredApplicantJobs"
                :key="job.id"
                :data-card-index="jobCardIndex"
                class="applicant-job-card"
                :class="{
                  'applicant-job-card--applied': getApplicantJobApplicationState(job).hasApplied,
                  'is-selected': selectedFindJob?.id === job.id,
                }"
                role="button"
                tabindex="0"
                @click="handleSelectFindJob(job.id)"
                @keydown.enter.prevent="handleSelectFindJob(job.id)"
                @keydown.space.prevent="handleSelectFindJob(job.id)"
              >
                <div
                  v-if="shouldShowApplicantJobNewTag(job) || getApplicantJobApplicationState(job).hasApplied"
                  class="applicant-job-card__topline"
                >
                  <div class="applicant-job-card__signal">
                    <span v-if="shouldShowApplicantJobNewTag(job)" class="applicant-job-card__tag applicant-job-card__tag--new">New</span>
                    <span
                      v-if="getApplicantJobApplicationState(job).hasApplied"
                      class="applicant-job-card__tag applicant-job-card__tag--application"
                      :class="`applicant-job-card__tag--${getApplicantJobApplicationState(job).statusTone}`"
                    >
                      {{ getApplicantJobApplicationState(job).statusLabel }}
                    </span>
                  </div>

                </div>

                <div class="applicant-job-card__header">
                  <div class="applicant-job-card__brand">
                    <div class="applicant-job-card__logo applicant-job-card__logo--round" aria-hidden="true">
                      <img v-if="job.logoUrl" :src="job.logoUrl" alt="" class="applicant-job-card__logo-image" />
                      <template v-else>{{ job.companyInitials }}</template>
                    </div>

                    <div class="applicant-job-card__headline">
                      <h4>{{ job.title }}</h4>
                      <p class="applicant-job-card__company">
                        <span class="applicant-job-card__company-icon" aria-hidden="true">
                          <i class="bi bi-buildings-fill" />
                        </span>
                        <span>{{ job.companyName }}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="applicant-job-card__bookmark"
                    :class="{ 'is-saved': isApplicantJobSavedState(job) }"
                    :aria-label="`Save ${job.title}`"
                    @click.stop="$emit('save-applicant-job', job)"
                  >
                    <i :class="isApplicantJobSavedState(job) ? 'bi bi-bookmark-fill' : 'bi bi-bookmark'" />
                  </button>
                </div>

                <p class="applicant-job-card__description">{{ job.description }}</p>

                <div class="applicant-job-card__meta">
                  <span class="applicant-job-card__pill applicant-job-card__pill--meta">
                    <i class="bi bi-geo-alt" />
                    {{ job.location }}
                  </span>
                  <span class="applicant-job-card__pill applicant-job-card__pill--meta">
                    <i class="bi bi-briefcase" />
                    {{ job.setup }}
                  </span>
                  <span class="applicant-job-card__pill applicant-job-card__pill--meta">
                    <i class="bi bi-people" />
                    {{ formatApplicantVacancyCount(job.vacancies) }}
                  </span>
                </div>

                <div class="applicant-job-card__footer">
                  <span class="applicant-job-card__pill applicant-job-card__pill--salary">
                    <i class="bi bi-cash-stack" />
                    {{ job.salary }}
                  </span>
                  <span class="applicant-job-card__pill applicant-job-card__pill--date">
                    {{ formatApplicantJobPostedDateTime(job) }}
                  </span>
                </div>
              </article>
            </TransitionGroup>

            <aside
              class="applicant-find-jobs__detail-panel"
              :class="{ 'is-loading': isDetailSkeletonVisible }"
              :aria-busy="isDetailSkeletonVisible ? 'true' : 'false'"
              aria-label="Job details"
            >
              <template v-if="displayedFindJob">
                <div class="applicant-job-drawer__head">
                  <div class="applicant-job-drawer__topbar">
                    <div class="applicant-find-jobs__badges applicant-find-jobs__badges--drawer">
                      <span class="applicant-find-jobs__badge applicant-find-jobs__badge--status">
                        <i class="bi bi-dot" /> Open
                      </span>
                      <span
                        v-if="selectedFindJobApplicationState.hasApplied"
                        class="applicant-find-jobs__badge"
                        :class="`applicant-find-jobs__badge--${selectedFindJobApplicationState.statusTone}`"
                      >
                        <i class="bi bi-send-check" /> {{ selectedFindJobApplicationState.statusLabel }}
                      </span>
                      <span class="applicant-find-jobs__badge applicant-find-jobs__badge--posted">
                        {{ formatApplicantJobPostedDateTime(displayedFindJob) }}
                      </span>
                    </div>
                  </div>

                  <div class="applicant-job-drawer__head-card">
                    <div class="applicant-job-drawer__hero">
                      <div class="applicant-find-jobs__detail-brand">
                        <div class="applicant-job-card__logo applicant-job-card__logo--large" aria-hidden="true">
                          <img v-if="displayedFindJob.logoUrl" :src="displayedFindJob.logoUrl" alt="" class="applicant-job-card__logo-image" />
                          <template v-else>{{ displayedFindJob.companyInitials }}</template>
                        </div>
                        <div class="applicant-job-drawer__copy">
                          <h3>{{ displayedFindJob.title }}</h3>
                          <p class="applicant-find-jobs__detail-company">
                            <span class="applicant-find-jobs__detail-company-icon" aria-hidden="true">
                              <i class="bi bi-buildings-fill" />
                            </span>
                            <span>{{ displayedFindJob.companyName }}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="applicant-job-drawer__meta">
                      <span class="applicant-job-drawer__meta-item applicant-job-drawer__meta-item--location">
                        <i class="bi bi-geo-alt" />
                        <span>{{ displayedFindJob.location }}</span>
                      </span>
                      <span class="applicant-job-drawer__meta-dot" aria-hidden="true" />
                      <span class="applicant-job-drawer__meta-item applicant-job-drawer__meta-item--category">
                        <i class="bi bi-briefcase" />
                        <span>{{ displayedFindJob.category }}</span>
                      </span>
                      <span class="applicant-job-drawer__meta-dot" aria-hidden="true" />
                      <span class="applicant-job-drawer__meta-item applicant-job-drawer__meta-item--type">
                        <i class="bi bi-clock" />
                        <span>{{ displayedFindJob.type }}</span>
                      </span>
                      <span class="applicant-job-drawer__meta-dot" aria-hidden="true" />
                      <span class="applicant-job-drawer__meta-item applicant-job-drawer__meta-item--vacancies">
                        <i class="bi bi-people" />
                        <span>{{ formatApplicantVacancyCount(displayedFindJob.vacancies) }}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="applicant-job-drawer__body">
                  <div class="applicant-find-jobs__detail">
                    <article class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--section applicant-find-jobs__detail-block--description">
                      <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                        <i class="bi bi-file-text" />
                        <span>Job Description</span>
                      </p>
                      <p class="applicant-find-jobs__detail-text applicant-find-jobs__detail-text--lead">{{ displayedFindJob.description }}</p>
                    </article>

                    <article class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--panel applicant-find-jobs__detail-block--info">
                      <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                        <i class="bi bi-person-lines-fill" />
                        <span>Language and Age Preference</span>
                      </p>
                      <div class="applicant-find-jobs__info-list applicant-find-jobs__info-list--stacked">
                        <div class="applicant-find-jobs__info-row applicant-find-jobs__info-row--plain">
                          <i class="bi bi-translate" />
                          <span class="applicant-find-jobs__info-key">Languages:</span>
                          <strong>{{ displayedFindJob.languages.length ? displayedFindJob.languages.join(', ') : 'No language requirements provided.' }}</strong>
                        </div>
                        <div class="applicant-find-jobs__info-row applicant-find-jobs__info-row--plain">
                          <i class="bi bi-person-badge" />
                          <span class="applicant-find-jobs__info-key">Preferred Age:</span>
                          <strong>{{ displayedFindJob.preferredAgeRange }}</strong>
                        </div>
                      </div>
                    </article>

                    <div class="applicant-find-jobs__detail-grid applicant-find-jobs__detail-grid--split">
                      <article class="applicant-find-jobs__detail-block">
                        <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                          <i class="bi bi-check2-circle" />
                          <span>Qualifications</span>
                        </p>
                        <ul class="applicant-find-jobs__detail-list applicant-find-jobs__detail-list--clean">
                          <li v-for="item in (displayedFindJob.qualifications.length ? displayedFindJob.qualifications : ['No qualifications provided.'])" :key="item">
                            {{ item }}
                          </li>
                        </ul>
                      </article>

                      <article class="applicant-find-jobs__detail-block">
                        <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                          <i class="bi bi-list-task" />
                          <span>Responsibilities</span>
                        </p>
                        <ul class="applicant-find-jobs__detail-list applicant-find-jobs__detail-list--clean">
                          <li v-for="item in (displayedFindJob.responsibilities.length ? displayedFindJob.responsibilities : ['No responsibilities provided.'])" :key="item">
                            {{ item }}
                          </li>
                        </ul>
                      </article>
                    </div>

                    <div class="applicant-job-drawer__highlight-stack">
                      <article class="applicant-job-drawer__highlight-row applicant-job-drawer__highlight-row--accent">
                        <span class="applicant-job-drawer__highlight-icon">
                          <i class="bi bi-cash-stack" />
                        </span>
                        <div class="applicant-job-drawer__highlight-copy">
                          <p class="applicant-find-jobs__stat-label">Salary Range</p>
                          <p class="applicant-find-jobs__stat-value">{{ displayedFindJob.salary }}</p>
                        </div>
                      </article>

                      <article class="applicant-job-drawer__highlight-row">
                        <span class="applicant-job-drawer__highlight-icon">
                          <i class="bi bi-eye" />
                        </span>
                        <div class="applicant-job-drawer__highlight-copy">
                          <p class="applicant-find-jobs__stat-label">Suitable For</p>
                          <p class="applicant-find-jobs__stat-fit">
                            <span>{{ displayedFindJob.disabilityFit }}</span>
                          </p>
                        </div>
                      </article>
                    </div>

                    <div class="applicant-job-drawer__actions">
                      <button
                        type="button"
                        class="applicant-job-drawer__action applicant-job-drawer__action--secondary"
                        :class="{ 'is-saved': isApplicantJobSavedState(displayedFindJob) }"
                        @click="$emit('save-applicant-job', displayedFindJob)"
                      >
                        <i :class="isApplicantJobSavedState(displayedFindJob) ? 'bi bi-bookmark-fill' : 'bi bi-bookmark'" />
                        <span>{{ isApplicantJobSavedState(displayedFindJob) ? 'Saved Favorite' : 'Save Favorite' }}</span>
                      </button>
                      <button
                        type="button"
                        class="applicant-job-drawer__action applicant-job-drawer__action--primary"
                        :disabled="selectedFindJobApplicationState.disabled"
                        @click="$emit('apply-applicant-job', displayedFindJob)"
                      >
                        <i class="bi bi-send" />
                        <span>{{ selectedFindJobApplicationState.buttonLabel }}</span>
                      </button>
                    </div>

                    <div class="applicant-job-drawer__footer-meta">
                      <p v-if="selectedFindJobApplicationState.helperText" class="applicant-job-drawer__status-note">
                        <i class="bi bi-info-circle" />
                        <span>{{ selectedFindJobApplicationState.helperText }}</span>
                      </p>
                      <p
                        v-if="selectedFindJobApplicationState.rejectionReason"
                        class="applicant-job-drawer__status-note applicant-job-drawer__status-note--danger"
                      >
                        <i class="bi bi-exclamation-triangle" />
                        <span>Rejection reason: {{ selectedFindJobApplicationState.rejectionReason }}</span>
                      </p>

                      <p class="applicant-job-drawer__vacancies-note">
                        <i class="bi bi-people" />
                        <span>{{ formatApplicantVacancyCount(displayedFindJob.vacancies) }} Available</span>
                      </p>
                    </div>
                  </div>
                </div>
              </template>

              <div v-else class="applicant-find-jobs__empty applicant-find-jobs__empty--detail">
                <i class="bi bi-layout-text-sidebar-reverse" aria-hidden="true" />
                <h3>Select a job</h3>
                <p>Click a job from the list to view its full details on the right side.</p>
              </div>

              <div v-if="isDetailSkeletonVisible" class="applicant-job-drawer__skeleton-overlay" aria-hidden="true">
                <div class="applicant-job-drawer__head">
                  <div class="applicant-job-drawer__topbar applicant-job-drawer__skeleton-topbar">
                    <div class="applicant-find-jobs__badges applicant-find-jobs__badges--drawer applicant-job-drawer__skeleton-badges">
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--short" />
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--short" />
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--medium" />
                    </div>
                  </div>

                  <div class="applicant-job-drawer__head-card applicant-job-drawer__skeleton-head-card">
                    <div class="applicant-job-drawer__hero">
                      <div class="applicant-find-jobs__detail-brand">
                        <span class="applicant-job-drawer__skeleton-avatar" />
                        <div class="applicant-job-drawer__copy applicant-job-drawer__skeleton-copy">
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--title" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--company" />
                        </div>
                      </div>
                    </div>

                    <div class="applicant-job-drawer__meta applicant-job-drawer__skeleton-meta">
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--long" />
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--medium" />
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--medium" />
                      <span class="applicant-job-drawer__skeleton-pill applicant-job-drawer__skeleton-pill--medium" />
                    </div>
                  </div>
                </div>

                <div class="applicant-job-drawer__body">
                  <div class="applicant-find-jobs__detail applicant-job-drawer__skeleton-detail">
                    <section class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--section applicant-find-jobs__detail-block--description applicant-job-drawer__skeleton-section">
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--label" />
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--full" />
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--wide" />
                    </section>

                    <section class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--panel applicant-find-jobs__detail-block--info applicant-job-drawer__skeleton-panel">
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--label" />
                      <div class="applicant-job-drawer__skeleton-info-list">
                        <div class="applicant-job-drawer__skeleton-info-row">
                          <span class="applicant-job-drawer__skeleton-icon" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--info-key" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--info-value" />
                        </div>
                        <div class="applicant-job-drawer__skeleton-info-row">
                          <span class="applicant-job-drawer__skeleton-icon" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--info-key" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--info-value-short" />
                        </div>
                      </div>
                    </section>

                    <div class="applicant-find-jobs__detail-grid applicant-find-jobs__detail-grid--split applicant-job-drawer__skeleton-grid">
                      <section class="applicant-find-jobs__detail-block applicant-job-drawer__skeleton-section applicant-job-drawer__skeleton-list-block">
                        <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--label" />
                        <div class="applicant-job-drawer__skeleton-list">
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--list" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--list applicant-job-drawer__skeleton-line--list-short" />
                        </div>
                      </section>
                      <section class="applicant-find-jobs__detail-block applicant-job-drawer__skeleton-section applicant-job-drawer__skeleton-list-block">
                        <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--label" />
                        <div class="applicant-job-drawer__skeleton-list">
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--list" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--list applicant-job-drawer__skeleton-line--list-short" />
                        </div>
                      </section>
                    </div>

                    <div class="applicant-job-drawer__highlight-stack applicant-job-drawer__skeleton-stack">
                      <div class="applicant-job-drawer__highlight-row applicant-job-drawer__highlight-row--accent applicant-job-drawer__skeleton-highlight-row">
                        <span class="applicant-job-drawer__highlight-icon applicant-job-drawer__skeleton-icon-shell">
                          <span class="applicant-job-drawer__skeleton-icon applicant-job-drawer__skeleton-icon--round" />
                        </span>
                        <div class="applicant-job-drawer__highlight-copy applicant-job-drawer__skeleton-highlight-copy">
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--stat-label" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--stat-value" />
                        </div>
                      </div>
                      <div class="applicant-job-drawer__highlight-row applicant-job-drawer__skeleton-highlight-row applicant-job-drawer__skeleton-highlight-row--short">
                        <span class="applicant-job-drawer__highlight-icon applicant-job-drawer__skeleton-icon-shell">
                          <span class="applicant-job-drawer__skeleton-icon applicant-job-drawer__skeleton-icon--round" />
                        </span>
                        <div class="applicant-job-drawer__highlight-copy applicant-job-drawer__skeleton-highlight-copy">
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--stat-label" />
                          <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--stat-fit" />
                        </div>
                      </div>
                    </div>

                    <div class="applicant-job-drawer__actions applicant-job-drawer__skeleton-actions">
                      <span class="applicant-job-drawer__skeleton-button applicant-job-drawer__skeleton-button--secondary" />
                      <span class="applicant-job-drawer__skeleton-button" />
                    </div>

                    <div class="applicant-job-drawer__footer-meta applicant-job-drawer__skeleton-footer">
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--footer" />
                      <span class="applicant-job-drawer__skeleton-line applicant-job-drawer__skeleton-line--footer applicant-job-drawer__skeleton-line--footer-short" />
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </template>

          <div v-else class="applicant-find-jobs__empty">
            <i class="bi bi-briefcase" aria-hidden="true" />
            <h3>No jobs found yet.</h3>
            <p>Try another keyword or check back for newly posted jobs.</p>
          </div>
        </section>
      </section>
    </section>
  </section>
</template>

<style scoped src="@/components/applicant_dashboard.css"></style>
