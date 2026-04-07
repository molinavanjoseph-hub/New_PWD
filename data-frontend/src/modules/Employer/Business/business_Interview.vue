<script setup>
import { toRefs } from 'vue'
const props = defineProps([
  'interviewSchedulingTab',
  'setInterviewSchedulingTab',
  'businessInterviewScheduleStats',
  'isBusinessInterviewRefreshing',
  'refreshBusinessInterviewApplicants',
  'businessInterviewSchedulingFormError',
  'canEditBusinessModule',
  'businessInterviewSchedulingForm',
  'createBusinessInterviewSchedule',
  'businessInterviewAcceptedJobOptions',
  'businessInterviewFilteredApplicants',
  'businessInterviewTechnicalGateHint',
  'businessInterviewAvailableInterviewTypeOptions',
  'businessInterviewMinScheduleDateTime',
  'resetBusinessInterviewSchedulingForm',
  'shiftBusinessInterviewCalendarMonth',
  'businessInterviewCalendarMonthLabel',
  'businessInterviewWeekdayLabels',
  'businessInterviewCalendarDays',
  'selectBusinessInterviewCalendarDay',
  'businessInterviewSelectedCalendarLabel',
  'businessInterviewSelectedDaySchedules',
  'formatBusinessInterviewTime',
  'businessInterviewStatusSummary',
  'businessInterviewStatusRows',
  'resolveBusinessInterviewStatusBadgeClass',
  'openBusinessInterviewRequestReview',
  'completeBusinessInterviewSchedule',
])
const {
  interviewSchedulingTab,
  setInterviewSchedulingTab,
  businessInterviewScheduleStats,
  isBusinessInterviewRefreshing,
  refreshBusinessInterviewApplicants,
  businessInterviewSchedulingFormError,
  canEditBusinessModule,
  businessInterviewSchedulingForm,
  createBusinessInterviewSchedule,
  businessInterviewAcceptedJobOptions,
  businessInterviewFilteredApplicants,
  businessInterviewTechnicalGateHint,
  businessInterviewAvailableInterviewTypeOptions,
  businessInterviewMinScheduleDateTime,
  resetBusinessInterviewSchedulingForm,
  shiftBusinessInterviewCalendarMonth,
  businessInterviewCalendarMonthLabel,
  businessInterviewWeekdayLabels,
  businessInterviewCalendarDays,
  selectBusinessInterviewCalendarDay,
  businessInterviewSelectedCalendarLabel,
  businessInterviewSelectedDaySchedules,
  formatBusinessInterviewTime,
  businessInterviewStatusSummary,
  businessInterviewStatusRows,
  resolveBusinessInterviewStatusBadgeClass,
  openBusinessInterviewRequestReview,
  completeBusinessInterviewSchedule,
} = toRefs(props)
</script>

<template>
<section class="business-interview-scheduling">
              <div class="business-interview-scheduling__header">
                <div class="business-interview-scheduling__header-copy">
                  <span class="business-interview-scheduling__kicker">HR Recruitment Flow</span>
                  <h2>Interview Scheduling</h2>
                  <p>Create interview schedules, then review each applicant's progress in the Interview Status tab.</p>
                </div>
                <div class="business-interview-scheduling__header-actions">
                  <div class="business-interview-scheduling__stat-strip" aria-label="Interview schedule stats">
                    <span>{{ businessInterviewScheduleStats.total }} total</span>
                    <span>{{ businessInterviewScheduleStats.scheduled }} scheduled</span>
                    <span>{{ businessInterviewScheduleStats.completed }} completed</span>
                  </div>
                  <button
                    type="button"
                    class="business-interview-scheduling__refresh"
                    :disabled="isBusinessInterviewRefreshing"
                    @click="refreshBusinessInterviewApplicants"
                  >
                    {{ isBusinessInterviewRefreshing ? 'Refreshing...' : 'Refresh Applicants' }}
                  </button>
                </div>
              </div>

              <div class="business-assessment-management__tabs" role="tablist" aria-label="Interview scheduling views">
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': interviewSchedulingTab === 'schedule' }"
                  @click="setInterviewSchedulingTab('schedule')"
                >
                  Create Schedule
                </button>
                <button
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': interviewSchedulingTab === 'status' }"
                  @click="setInterviewSchedulingTab('status')"
                >
                  Interview Status
                </button>
              </div>

              <div v-if="interviewSchedulingTab === 'schedule'" class="business-interview-scheduling__layout">
                <div class="business-interview-scheduling__main">
                  <section class="business-interview-scheduling__card">
                    <div class="business-interview-scheduling__card-head">
                      <div>
                        <span class="business-interview-scheduling__card-kicker">New Schedule</span>
                        <h3>Create Interview Schedule</h3>
                        <p>Interview approvals, applicant replies, and live schedule updates can be connected in the status workspace next.</p>
                      </div>
                    </div>

                    <p v-if="businessInterviewSchedulingFormError" class="business-interview-scheduling__error">
                      {{ businessInterviewSchedulingFormError }}
                    </p>

                    <fieldset class="business-interview-scheduling__fieldset" :disabled="!canEditBusinessModule('interview-scheduling')">
                      <form class="business-interview-scheduling__form-grid" @submit.prevent="createBusinessInterviewSchedule">
                        <label class="business-interview-scheduling__field">
                          <span>Job Title</span>
                          <select v-model="businessInterviewSchedulingForm.selectedJobKey" required>
                            <option value="" disabled>Select job title</option>
                            <option v-for="job in businessInterviewAcceptedJobOptions" :key="job.key" :value="job.key">
                              {{ job.title }}
                            </option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Accepted Applicant</span>
                          <select
                            v-model="businessInterviewSchedulingForm.applicationId"
                            :disabled="!businessInterviewSchedulingForm.selectedJobKey"
                            required
                          >
                            <option value="" disabled>
                              {{ businessInterviewSchedulingForm.selectedJobKey ? 'Select accepted applicant' : 'Select job title first' }}
                            </option>
                            <option v-for="applicant in businessInterviewFilteredApplicants" :key="applicant.id" :value="applicant.id">
                              {{ applicant.applicantName }}
                            </option>
                          </select>
                        </label>

                        <p
                          v-if="businessInterviewSchedulingForm.selectedJobKey && businessInterviewTechnicalGateHint"
                          class="business-interview-scheduling__field-hint is-warning"
                        >
                          {{ businessInterviewTechnicalGateHint }}
                        </p>

                        <label class="business-interview-scheduling__field">
                          <span>Interview</span>
                          <select
                            v-model="businessInterviewSchedulingForm.interviewType"
                            :disabled="!businessInterviewSchedulingForm.applicationId"
                            required
                          >
                            <option
                              v-for="option in businessInterviewAvailableInterviewTypeOptions"
                              :key="option.value"
                              :value="option.value"
                            >
                              {{ option.label }}
                            </option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Schedule Date &amp; Time</span>
                          <input
                            v-model="businessInterviewSchedulingForm.scheduledAt"
                            type="datetime-local"
                            :min="businessInterviewMinScheduleDateTime"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Mode</span>
                          <select v-model="businessInterviewSchedulingForm.mode" required>
                            <option value="in-person">In-person</option>
                            <option value="online">Online</option>
                          </select>
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>{{ businessInterviewSchedulingForm.mode === 'online' ? 'Meeting Link' : 'Location' }}</span>
                          <input
                            v-model="businessInterviewSchedulingForm.locationOrLink"
                            type="text"
                            :placeholder="businessInterviewSchedulingForm.mode === 'online' ? 'https://meet...' : 'Office / room'"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field">
                          <span>Interviewer</span>
                          <input
                            v-model="businessInterviewSchedulingForm.interviewer"
                            type="text"
                            placeholder="Enter interviewer name"
                            required
                          />
                        </label>

                        <label class="business-interview-scheduling__field business-interview-scheduling__field--full">
                          <span>Notes (Optional)</span>
                          <textarea
                            v-model="businessInterviewSchedulingForm.notes"
                            rows="3"
                            placeholder="Add interview instructions"
                          />
                        </label>

                        <div class="business-interview-scheduling__actions">
                          <button type="submit" class="business-interview-scheduling__submit">
                            Create Schedule
                          </button>
                          <button type="button" class="business-interview-scheduling__reset" @click="resetBusinessInterviewSchedulingForm">
                            Reset
                          </button>
                        </div>
                      </form>
                    </fieldset>
                  </section>
                </div>

                <aside class="business-interview-scheduling__card business-interview-scheduling__card--calendar">
                  <div class="business-interview-scheduling__calendar-head">
                    <h3>Schedule Calendar</h3>
                    <div class="business-interview-scheduling__calendar-nav">
                      <button type="button" @click="shiftBusinessInterviewCalendarMonth(-1)">&#8249;</button>
                      <strong>{{ businessInterviewCalendarMonthLabel }}</strong>
                      <button type="button" @click="shiftBusinessInterviewCalendarMonth(1)">&#8250;</button>
                    </div>
                  </div>

                  <div class="business-interview-scheduling__calendar-grid business-interview-scheduling__calendar-grid--week">
                    <span v-for="day in businessInterviewWeekdayLabels" :key="day">{{ day }}</span>
                  </div>

                  <div class="business-interview-scheduling__calendar-grid business-interview-scheduling__calendar-grid--days">
                    <button
                      v-for="day in businessInterviewCalendarDays"
                      :key="day.key"
                      type="button"
                      class="business-interview-scheduling__day-cell"
                      :class="{
                        'is-muted': !day.isCurrentMonth,
                        'is-today': day.isToday,
                        'is-selected': day.isSelected,
                        'is-busy': day.scheduleCount > 0,
                        'is-past': day.isPastDate,
                      }"
                      :disabled="day.isPastDate"
                      @click="selectBusinessInterviewCalendarDay(day)"
                    >
                      <span class="business-interview-scheduling__day-number">{{ day.label }}</span>
                      <small v-if="day.scheduleCount > 0">{{ day.scheduleCount }}</small>
                    </button>
                  </div>

                  <p class="business-interview-scheduling__calendar-caption">
                    Scheduled interviews are marked with a badge. Click a date to set it in the schedule field.
                  </p>

                  <div class="business-interview-scheduling__day-list">
                    <h4>{{ businessInterviewSelectedCalendarLabel }}</h4>
                    <ul v-if="businessInterviewSelectedDaySchedules.length">
                      <li v-for="item in businessInterviewSelectedDaySchedules" :key="item.id">
                        <strong>{{ formatBusinessInterviewTime(item.scheduledAt) }}</strong>
                        <span>{{ item.applicantName }}</span>
                      </li>
                    </ul>
                    <p v-else class="business-interview-scheduling__day-empty">No scheduled interviews for this day.</p>
                  </div>
                </aside>
              </div>

              <div v-else class="business-interview-status">
                <div class="business-interview-scheduling__stat-strip" aria-label="Interview status summary">
                  <span>{{ businessInterviewStatusSummary.total }} applicants</span>
                  <span>{{ businessInterviewStatusSummary.ready }} ready to schedule</span>
                  <span>{{ businessInterviewStatusSummary.scheduled }} scheduled</span>
                  <span>{{ businessInterviewStatusSummary.completed }} completed</span>
                </div>

                <section class="business-interview-scheduling__card business-interview-status__panel">
                  <div class="business-interview-scheduling__card-head">
                    <div>
                      <span class="business-interview-scheduling__card-kicker">Interview Status</span>
                      <h3>Applicant interview tracker</h3>
                      <p>Live applicant confirmations and reschedule requests will appear here as soon as they are submitted.</p>
                    </div>
                  </div>

                  <div v-if="businessInterviewStatusRows.length" class="business-user-management__table-wrap">
                    <table class="business-user-management__table business-interview-status__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Current Stage</th>
                          <th>Schedule</th>
                          <th>Interviewer</th>
                          <th>Status</th>
                          <th>Request Details</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in businessInterviewStatusRows" :key="`${row.id}-status`">
                          <td>
                            <div class="business-interview-status__applicant">
                              <strong>{{ row.applicantName }}</strong>
                              <span>{{ row.applicantEmail }}</span>
                              <small>{{ row.applicantId }}</small>
                            </div>
                          </td>
                          <td>{{ row.jobTitle }}</td>
                          <td>
                            <div class="business-interview-status__stage">
                              <strong>{{ row.currentStage }}</strong>
                              <span>{{ row.stageDetail }}</span>
                            </div>
                          </td>
                          <td>{{ row.scheduleLabel }}</td>
                          <td>{{ row.interviewer }}</td>
                          <td>
                            <span
                              class="business-interview-status__badge"
                              :class="resolveBusinessInterviewStatusBadgeClass(row.statusTone)"
                            >
                              {{ row.statusLabel }}
                            </span>
                          </td>
                          <td>
                            <div class="business-interview-status__detail">
                              {{ row.requestDetail }}
                            </div>
                          </td>
                          <td>
                            <button
                              v-if="row.canReviewRequest"
                              type="button"
                              class="business-interview-status__action business-interview-status__action--icon"
                              title="Review interview request"
                              aria-label="Review interview request"
                              @click="openBusinessInterviewRequestReview(row.scheduleId)"
                            >
                              <i class="bi bi-eye" aria-hidden="true" />
                            </button>
                            <button
                              v-else-if="row.canMarkCompleted"
                              type="button"
                              class="business-interview-status__action business-interview-status__action--icon"
                              title="Mark interview as completed"
                              aria-label="Mark interview as completed"
                              @click="completeBusinessInterviewSchedule(row.scheduleId)"
                            >
                              <i class="bi bi-check2-circle" aria-hidden="true" />
                            </button>
                            <span v-else class="business-interview-status__detail business-interview-status__detail--muted">No action</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div v-else class="business-interview-status__empty">
                    <strong>No interview status rows yet</strong>
                    <p>Add applicants or create interview schedules to populate this table.</p>
                  </div>
                </section>
              </div>
            </section>
</template>
