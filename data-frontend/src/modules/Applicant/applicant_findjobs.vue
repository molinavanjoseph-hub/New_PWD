<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  jobsLoading: { type: Boolean, default: false },
  findJobsQuery: { type: String, default: '' },
  activeJobSuggestion: { type: String, default: '' },
  applicantJobSuggestions: { type: Array, default: () => [] },
  filteredApplicantJobs: { type: Array, default: () => [] },
  selectedFindJob: { type: Object, default: null },
  shouldShowApplicantJobNewTag: { type: Function, required: true },
  applicantDisability: { type: String, default: '' },
  applicantJobFilterMode: { type: String, default: 'matched' },
  applicantJobFilterLabel: { type: String, default: 'Job matching' },
  applicantJobResultsDescription: { type: String, default: '' },
  applicantJobPwdOptions: { type: Array, default: () => [] },
  applicantJobPwdType: { type: String, default: '' },
  applicantJobSalaryOptions: { type: Array, default: () => [] },
  applicantJobSalaryRange: { type: String, default: '' },
  applicantJobSortMode: { type: String, default: 'match' },
  applicantJobSortLabel: { type: String, default: 'Strongest match' },
  applicantJobSortOptions: { type: Array, default: () => [] },
  resolveApplicantJobApplicationState: { type: Function, default: null },
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
  'clear-job-suggestion',
  'apply-job-suggestion',
  'select-find-job',
  'close-find-job',
  'save-applicant-job',
  'apply-applicant-job',
])

const isApplicantJobFilterMenuOpen = ref(false)
const isApplicantJobSortMenuOpen = ref(false)
const isPwdTypeFilterActive = computed(() => props.applicantJobFilterMode === 'pwd')
const isSalaryFilterActive = computed(() => props.applicantJobFilterMode === 'salary')
const activeApplicantJobFilterLabel = computed(() => props.applicantJobFilterLabel || 'Job matching')
const activeApplicantJobSortLabel = computed(() => props.applicantJobSortLabel || 'Strongest match')
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
const selectedFindJobApplicationState = computed(() => getApplicantJobApplicationState(props.selectedFindJob))

const toggleApplicantJobFilterMenu = () => {
  isApplicantJobFilterMenuOpen.value = !isApplicantJobFilterMenuOpen.value
}

const toggleApplicantJobSortMenu = () => {
  isApplicantJobSortMenuOpen.value = !isApplicantJobSortMenuOpen.value
}

const selectApplicantJobFilterMode = (mode) => {
  if (typeof props.onSetApplicantJobFilterMode === 'function') {
    props.onSetApplicantJobFilterMode(mode)
    return
  }
  emit('set-applicant-job-filter-mode', mode)
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
      <aside class="applicant-find-jobs__rail">


      </aside>

      <article class="applicant-find-jobs__panel applicant-find-jobs__panel--main">
        <div class="applicant-panel__head">
          <div>
            <h3>Search Jobs</h3>
            <span>Search by title, company, or keyword</span>
          </div>
        </div>

        <section class="applicant-find-jobs__hero">
          <div class="applicant-find-jobs__searchbar">
            <button type="button" class="applicant-find-jobs__location">
              <i class="bi bi-geo-alt-fill" />
              <span>Around You</span>
              <i class="bi bi-chevron-down" />
            </button>

            <label class="applicant-find-jobs__searchfield">
              <i class="bi bi-search" />
              <input
                :value="findJobsQuery"
                type="text"
                placeholder="Search by title, company or any job keyword..."
                @input="emit('update:findJobsQuery', $event.target.value)"
                @input.capture="emit('clear-job-suggestion')"
              >
            </label>

            <div class="applicant-find-jobs__filter-shell">
              <button
                type="button"
                class="applicant-find-jobs__toolbar-button applicant-find-jobs__toolbar-button--ghost"
                :class="{ 'is-active': isApplicantJobFilterMenuOpen || applicantJobFilterMode !== 'matched' }"
                :aria-expanded="isApplicantJobFilterMenuOpen ? 'true' : 'false'"
                @click="toggleApplicantJobFilterMenu"
              >
                <i class="bi bi-sliders" />
                <span>Filter</span>
              </button>

              <div v-if="isApplicantJobFilterMenuOpen" class="applicant-find-jobs__filter-panel" @click.stop>
                <div class="applicant-find-jobs__filter-panel-head">
                  <div>
                    <strong>Browse jobs by</strong>
                    <p>Choose how applicants explore the live job pool.</p>
                  </div>

                  <button type="button" class="applicant-find-jobs__filter-reset" @click.stop="resetApplicantJobFilters">
                    Reset
                  </button>
                </div>

                <div class="applicant-find-jobs__filter-mode-list">
                  <button
                    type="button"
                    class="applicant-find-jobs__filter-mode-button"
                    :class="{ 'is-active': applicantJobFilterMode === 'all' }"
                    @click.stop="selectApplicantJobFilterMode('all')"
                  >
                    All jobs
                  </button>
                  <button
                    type="button"
                    class="applicant-find-jobs__filter-mode-button"
                    :class="{ 'is-active': applicantJobFilterMode === 'pwd' }"
                    @click.stop="selectApplicantJobFilterMode('pwd')"
                  >
                    PWD type
                  </button>
                  <button
                    type="button"
                    class="applicant-find-jobs__filter-mode-button"
                    :class="{ 'is-active': applicantJobFilterMode === 'salary' }"
                    @click.stop="selectApplicantJobFilterMode('salary')"
                  >
                    Salary range
                  </button>
                </div>

                <label v-if="isPwdTypeFilterActive" class="applicant-find-jobs__filter-field">
                  <span>PWD type</span>
                  <select :value="applicantJobPwdType" @change.stop="handleApplicantJobPwdTypeChange">
                    <option v-for="option in applicantJobPwdOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label v-if="isSalaryFilterActive" class="applicant-find-jobs__filter-field">
                  <span>Salary range</span>
                  <select :value="applicantJobSalaryRange" @change.stop="handleApplicantJobSalaryRangeChange">
                    <option v-for="option in applicantJobSalaryOptions" :key="option.value || 'empty-salary-range'" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <p class="applicant-find-jobs__filter-summary">
                  Active filter:
                  <strong>{{ activeApplicantJobFilterLabel }}</strong>
                </p>
              </div>
            </div>

            <button type="button" class="applicant-find-jobs__toolbar-button applicant-find-jobs__toolbar-button--primary">
              <i class="bi bi-search" />
              <span>Find</span>
            </button>
          </div>

          <div v-if="applicantJobSuggestions.length" class="applicant-find-jobs__suggestions">
            <span class="applicant-find-jobs__suggestions-label">Quick suggestions</span>
            <div class="applicant-find-jobs__suggestions-list">
              <button
                v-for="suggestion in applicantJobSuggestions"
                :key="suggestion"
                type="button"
                class="applicant-find-jobs__suggestion-chip"
                :class="{ 'is-active': activeJobSuggestion === suggestion }"
                :aria-pressed="activeJobSuggestion === suggestion ? 'true' : 'false'"
                @click="emit('apply-job-suggestion', suggestion)"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>
        </section>

        <section class="applicant-find-jobs__results-head">
          <div>
            <h3>Showing {{ filteredApplicantJobs.length }} Jobs Results</h3>
            <p>{{ applicantJobResultsDescription }}</p>
          </div>

          <div class="applicant-find-jobs__results-tools">
            <span class="applicant-find-jobs__results-chip"><i class="bi bi-sliders" /> {{ activeApplicantJobFilterLabel }}</span>
            <span class="applicant-find-jobs__results-chip"><i class="bi bi-universal-access-circle" /> {{ applicantDisability || 'PWD-friendly' }}</span>
            <div class="applicant-find-jobs__results-sort-shell">
              <button
                type="button"
                class="applicant-find-jobs__results-select"
                :class="{ 'is-active': isApplicantJobSortMenuOpen || applicantJobSortMode !== 'match' }"
                :aria-expanded="isApplicantJobSortMenuOpen ? 'true' : 'false'"
                @click.stop="toggleApplicantJobSortMenu"
              >
                <i class="bi bi-funnel" />
                <span>{{ activeApplicantJobSortLabel }}</span>
                <i class="bi bi-chevron-down" />
              </button>

              <div v-if="isApplicantJobSortMenuOpen" class="applicant-find-jobs__results-sort-menu" @click.stop>
                <button
                  v-for="option in applicantJobSortOptions"
                  :key="option.value"
                  type="button"
                  class="applicant-find-jobs__results-sort-option"
                  :class="{ 'is-active': applicantJobSortMode === option.value }"
                  @click.stop="selectApplicantJobSortMode(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="applicant-find-jobs__layout">
          <article class="applicant-panel applicant-find-jobs__list-panel">
        <div v-if="jobsLoading" class="applicant-find-jobs__loading">
          <i class="bi bi-arrow-repeat" aria-hidden="true" />
          <span>Loading job posts...</span>
        </div>

        <div v-else-if="filteredApplicantJobs.length" class="applicant-find-jobs__list">
          <button
            v-for="job in filteredApplicantJobs"
            :key="job.id"
            type="button"
            class="applicant-job-card"
            @click="$emit('select-find-job', job.id)"
          >
            <div class="applicant-job-card__header">
              <div class="applicant-job-card__logo" aria-hidden="true">
                <img v-if="job.logoUrl" :src="job.logoUrl" alt="" class="applicant-job-card__logo-image" />
                <template v-else>{{ job.companyInitials }}</template>
              </div>

              <div class="applicant-job-card__headline">
                <h4>{{ job.title }}</h4>
                <p class="applicant-job-card__company">
                  <i class="bi bi-building" />
                  <span>{{ job.companyName }}</span>
                </p>
              </div>

              <div
                v-if="shouldShowApplicantJobNewTag(job) || getApplicantJobApplicationState(job).hasApplied"
                class="applicant-job-card__badges"
              >
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

            <p class="applicant-job-card__description">{{ job.description }}</p>

            <div class="applicant-job-card__meta">
              <span class="applicant-job-card__pill">
                <i class="bi bi-geo-alt" />
                {{ job.location }}
              </span>
              <span class="applicant-job-card__pill">
                <i class="bi bi-briefcase" />
                {{ job.setup }}
              </span>
              <span class="applicant-job-card__pill">
                <i class="bi bi-people" />
                {{ job.vacancies }} Vacancy<span v-if="job.vacancies !== 1">ies</span>
              </span>
              <span class="applicant-job-card__pill applicant-job-card__pill--salary">
                <i class="bi bi-cash-stack" />
                {{ job.salary }}
              </span>
              <span class="applicant-job-card__pill applicant-job-card__pill--date">
                <i class="bi bi-calendar-event" />
                {{ job.postedDate }}
              </span>
            </div>
          </button>
        </div>

        <div v-else class="applicant-find-jobs__empty">
          <i class="bi bi-briefcase" aria-hidden="true" />
          <h3>No jobs found for this filter yet.</h3>
          <p>Try switching to all jobs, another PWD type, a different salary range, or return to job matching.</p>
        </div>
          </article>
        </section>
      </article>
    </section>

    <Transition name="applicant-job-drawer">
      <div
        v-if="selectedFindJob"
        class="applicant-job-drawer-overlay"
        @click.self="$emit('close-find-job')"
      >
        <aside class="applicant-job-drawer" aria-label="Job details">
          <div class="applicant-job-drawer__head">
            <div class="applicant-job-drawer__topbar">
              <div class="applicant-find-jobs__badges">
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
                  <i class="bi bi-clock-history" /> {{ selectedFindJob.postedDate }}
                </span>
              </div>
              <button type="button" class="applicant-job-drawer__close applicant-job-drawer__close--labeled" @click="$emit('close-find-job')">
                <i class="bi bi-x-lg" />
                <span>Close</span>
              </button>
            </div>

            <div class="applicant-job-drawer__head-card">
              <div class="applicant-job-drawer__hero">
                <div class="applicant-find-jobs__detail-brand">
                  <div class="applicant-job-card__logo applicant-job-card__logo--large" aria-hidden="true">
                    <img v-if="selectedFindJob.logoUrl" :src="selectedFindJob.logoUrl" alt="" class="applicant-job-card__logo-image" />
                    <template v-else>{{ selectedFindJob.companyInitials }}</template>
                  </div>
                  <div class="applicant-job-drawer__copy">
                    <h3>{{ selectedFindJob.title }}</h3>
                    <p class="applicant-find-jobs__detail-company">
                      <i class="bi bi-building" />
                      <span>{{ selectedFindJob.companyName }}</span>
                    </p>
                  </div>
                </div>

                <button type="button" class="applicant-job-drawer__map-button">
                  <i class="bi bi-map" />
                  <span>View Map</span>
                </button>
              </div>

              <div class="applicant-find-jobs__chips applicant-find-jobs__chips--hero">
                <span><i class="bi bi-geo-alt" /> {{ selectedFindJob.location }}</span>
                <span><i class="bi bi-briefcase" /> {{ selectedFindJob.category }}</span>
                <span><i class="bi bi-clock" /> {{ selectedFindJob.type }}</span>
                <span><i class="bi bi-people" /> {{ selectedFindJob.vacancies }} Vacancies</span>
              </div>
            </div>
          </div>

          <div class="applicant-job-drawer__body">
            <div class="applicant-find-jobs__detail">
              <article class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--full applicant-find-jobs__detail-block--description">
                <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                  <i class="bi bi-file-text" />
                  <span>Job Description</span>
                </p>
                <p class="applicant-find-jobs__detail-text applicant-find-jobs__detail-text--lead">{{ selectedFindJob.description }}</p>
              </article>

              <article class="applicant-find-jobs__detail-block applicant-find-jobs__detail-block--full applicant-find-jobs__detail-block--info">
                <p class="applicant-find-jobs__detail-label applicant-find-jobs__detail-label--with-icon">
                  <i class="bi bi-person-lines-fill" />
                  <span>Language and Age Preference</span>
                </p>
                <div class="applicant-find-jobs__info-list">
                  <div class="applicant-find-jobs__info-row">
                    <i class="bi bi-translate" />
                    <span class="applicant-find-jobs__info-key">Languages:</span>
                    <strong>{{ selectedFindJob.languages.length ? selectedFindJob.languages.join(', ') : 'No language requirements provided.' }}</strong>
                  </div>
                  <div class="applicant-find-jobs__info-row">
                    <i class="bi bi-person-badge" />
                    <span class="applicant-find-jobs__info-key">Preferred Age:</span>
                    <strong>{{ selectedFindJob.preferredAgeRange }}</strong>
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
                    <li v-for="item in (selectedFindJob.qualifications.length ? selectedFindJob.qualifications : ['No qualifications provided.'])" :key="item">
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
                    <li v-for="item in (selectedFindJob.responsibilities.length ? selectedFindJob.responsibilities : ['No responsibilities provided.'])" :key="item">
                      {{ item }}
                    </li>
                  </ul>
                </article>
              </div>

              <div class="applicant-find-jobs__stat-grid applicant-find-jobs__stat-grid--stacked">
                <article class="applicant-find-jobs__stat-card applicant-find-jobs__stat-card--accent">
                  <p class="applicant-find-jobs__stat-label">Salary Range</p>
                  <p class="applicant-find-jobs__stat-value">{{ selectedFindJob.salary }}</p>
                </article>

                <article class="applicant-find-jobs__stat-card">
                  <p class="applicant-find-jobs__stat-label">Suitable For</p>
                  <p class="applicant-find-jobs__stat-fit">
                    <i class="bi bi-universal-access-circle" />
                    <span>{{ selectedFindJob.disabilityFit }}</span>
                  </p>
                </article>
              </div>

              <div class="applicant-job-drawer__actions">
                <button type="button" class="applicant-job-drawer__action applicant-job-drawer__action--secondary" @click="$emit('save-applicant-job', selectedFindJob)">
                  <i class="bi bi-bookmark" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  class="applicant-job-drawer__action applicant-job-drawer__action--primary"
                  :disabled="selectedFindJobApplicationState.disabled"
                  @click="$emit('apply-applicant-job', selectedFindJob)"
                >
                  <i class="bi bi-send" />
                  <span>{{ selectedFindJobApplicationState.buttonLabel }}</span>
                </button>
              </div>

              <p v-if="selectedFindJobApplicationState.helperText" class="applicant-job-drawer__status-note">
                {{ selectedFindJobApplicationState.helperText }}
              </p>
              <p
                v-if="selectedFindJobApplicationState.rejectionReason"
                class="applicant-job-drawer__status-note applicant-job-drawer__status-note--danger"
              >
                Rejection reason: {{ selectedFindJobApplicationState.rejectionReason }}
              </p>

              <p class="applicant-job-drawer__vacancies-note">
                <i class="bi bi-people" />
                <span>{{ selectedFindJob.vacancies }} Vacancies Available</span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="@/components/applicant_dashboard.css"></style>
