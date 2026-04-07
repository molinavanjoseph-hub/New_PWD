<script setup>
import { toRefs } from 'vue'

const props = defineProps([
  'isApplicantManagementModalOpen',
  'closeApplicantManagementModal',
  'applicantManagementModalState',
  'selectedApplicantManagementDetails',
  'buildUserOverviewInitials',
  'normalizeUserOverviewValue',
  'isApplicantManagementDecisionSubmitting',
  'canUpdateSelectedApplicantManagementStatus',
  'approveApplicantManagementApplication',
  'rejectApplicantManagementApplication',
  'isBusinessInterviewRequestReviewOpen',
  'closeBusinessInterviewRequestReview',
  'businessInterviewReviewState',
  'selectedBusinessInterviewReviewSchedule',
  'formatBusinessInterviewApplicantResponseLabel',
  'formatBusinessInterviewTypeLabel',
  'formatBusinessInterviewDateTime',
  'businessInterviewRequestScheduleOptions',
  'businessInterviewMinScheduleDateTime',
  'addBusinessInterviewRequestScheduleOption',
  'isBusinessInterviewRequestDecisionSubmitting',
  'approveBusinessInterviewRescheduleRequest',
  'rejectBusinessInterviewRescheduleRequest',
  'isHelpCenterModalOpen',
  'closeHelpCenterModal',
  'isCreateUserConfirmOpen',
  'closeCreateUserConfirm',
  'createUserConfirmationName',
  'createUserConfirmationEmail',
  'isCreatingWorkspaceUser',
  'executeWorkspaceUserAccountCreation',
  'isLogoutConfirmOpen',
  'closeLogoutConfirm',
  'isLogoutSubmitting',
  'confirmLogout',
  'isTrialConfirmationOpen',
  'currentCheckoutFlow',
  'closeTrialConfirmation',
  'proceedToPayment',
  'isCancelPaymentModalOpen',
  'closeCancelPaymentModal',
  'isCancellingPayment',
  'confirmCancelPayment',
  'isAddMemberDrawerOpen',
  'closeAddMemberDrawer',
  'canEditBusinessModule',
  'isWorkspaceUserDirectoryLoading',
  'availableEmployeeLinkOptions',
  'employeeDraft',
  'selectedEmployeeLinkedUser',
  'getWorkspaceUserRoleName',
  'employeeEmploymentTypeOptions',
  'employeeStatusOptions',
  'selectedEmployeeRole',
  'selectedEmployeeRoleSummary',
  'selectedEmployeeRoleModules',
  'selectedEmployeeRoleModuleSections',
  'countPermissionRoleEnabledModules',
  'countPermissionRoleFullAccessModules',
  'resetEmployeeDraft',
  'saveStaticEmployee',
])

const {
  isApplicantManagementModalOpen,
  closeApplicantManagementModal,
  applicantManagementModalState,
  selectedApplicantManagementDetails,
  buildUserOverviewInitials,
  normalizeUserOverviewValue,
  isApplicantManagementDecisionSubmitting,
  canUpdateSelectedApplicantManagementStatus,
  approveApplicantManagementApplication,
  rejectApplicantManagementApplication,
  isBusinessInterviewRequestReviewOpen,
  closeBusinessInterviewRequestReview,
  businessInterviewReviewState,
  selectedBusinessInterviewReviewSchedule,
  formatBusinessInterviewApplicantResponseLabel,
  formatBusinessInterviewTypeLabel,
  formatBusinessInterviewDateTime,
  businessInterviewRequestScheduleOptions,
  businessInterviewMinScheduleDateTime,
  addBusinessInterviewRequestScheduleOption,
  isBusinessInterviewRequestDecisionSubmitting,
  approveBusinessInterviewRescheduleRequest,
  rejectBusinessInterviewRescheduleRequest,
  isHelpCenterModalOpen,
  closeHelpCenterModal,
  isCreateUserConfirmOpen,
  closeCreateUserConfirm,
  createUserConfirmationName,
  createUserConfirmationEmail,
  isCreatingWorkspaceUser,
  executeWorkspaceUserAccountCreation,
  isLogoutConfirmOpen,
  closeLogoutConfirm,
  isLogoutSubmitting,
  confirmLogout,
  isTrialConfirmationOpen,
  currentCheckoutFlow,
  closeTrialConfirmation,
  proceedToPayment,
  isCancelPaymentModalOpen,
  closeCancelPaymentModal,
  isCancellingPayment,
  confirmCancelPayment,
  isAddMemberDrawerOpen,
  closeAddMemberDrawer,
  canEditBusinessModule,
  isWorkspaceUserDirectoryLoading,
  availableEmployeeLinkOptions,
  employeeDraft,
  selectedEmployeeLinkedUser,
  getWorkspaceUserRoleName,
  employeeEmploymentTypeOptions,
  employeeStatusOptions,
  selectedEmployeeRole,
  selectedEmployeeRoleSummary,
  selectedEmployeeRoleModules,
  selectedEmployeeRoleModuleSections,
  countPermissionRoleEnabledModules,
  countPermissionRoleFullAccessModules,
  resetEmployeeDraft,
  saveStaticEmployee,
} = toRefs(props)
</script>

<template>
  <div>
    <Transition name="business-trial-modal">
      <div v-if="isApplicantManagementModalOpen" class="business-modal" @click.self="closeApplicantManagementModal">
        <div
          class="business-modal__card business-applicants-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-applicant-management-title"
        >
          <div class="business-modal__copy">
            <h2 id="business-applicant-management-title">
              {{ applicantManagementModalState.mode === 'reject' ? 'Reject applicant' : 'Applicant details' }}
            </h2>
            <p v-if="selectedApplicantManagementDetails">
              Review the applicant resume below and decide whether to approve or reject the application.
            </p>
          </div>

          <div v-if="selectedApplicantManagementDetails" class="business-applicants-modal__body">
            <div v-if="selectedApplicantManagementDetails.applicantResumeUrl" class="business-applicants-modal__resume">
              <div class="business-applicants-modal__resume-head">
                <div>
                  <span>Resume PDF</span>
                  <strong>{{ selectedApplicantManagementDetails.applicantResumeFileName }}</strong>
                </div>
                <a
                  class="business-applicants-modal__resume-link"
                  :href="selectedApplicantManagementDetails.applicantResumeUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in new tab
                </a>
              </div>
              <iframe
                class="business-applicants-modal__resume-frame"
                :src="selectedApplicantManagementDetails.applicantResumeUrl"
                :title="`${selectedApplicantManagementDetails.applicantName} resume`"
              />
            </div>

            <div v-else class="business-applicants-modal__resume business-applicants-modal__resume--empty">
              <span>Resume PDF</span>
              <strong>No resume PDF available for this applicant yet.</strong>
              <p>The application can still be reviewed, but there is no uploaded resume file to display.</p>
            </div>

            <label v-if="applicantManagementModalState.mode === 'reject'" class="business-applicants-modal__reason">
              <span>Reason for rejection</span>
              <textarea
                v-model.trim="applicantManagementModalState.reason"
                rows="4"
                placeholder="State the reason that the applicant should see on the My Applications page."
              />
            </label>

            <p v-if="applicantManagementModalState.error" class="business-applicants-modal__error">
              {{ applicantManagementModalState.error }}
            </p>
          </div>

          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="applicantManagementModalState.mode === 'reject' ? applicantManagementModalState.mode = 'view' : closeApplicantManagementModal()"
            >
              {{ applicantManagementModalState.mode === 'reject' ? 'Back' : 'Close' }}
            </button>
            <button
              v-if="applicantManagementModalState.mode !== 'reject' && canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--secondary business-applicants-modal__button--reject"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="applicantManagementModalState.mode = 'reject'; applicantManagementModalState.error = ''"
            >
              Reject
            </button>
            <button
              v-if="applicantManagementModalState.mode !== 'reject' && canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="approveApplicantManagementApplication()"
            >
              {{ isApplicantManagementDecisionSubmitting ? 'Saving...' : 'Approve' }}
            </button>
            <button
              v-else-if="canUpdateSelectedApplicantManagementStatus"
              type="button"
              class="business-modal__button business-modal__button--primary business-applicants-modal__button--reject-primary"
              :disabled="isApplicantManagementDecisionSubmitting"
              @click="rejectApplicantManagementApplication()"
            >
              {{ isApplicantManagementDecisionSubmitting ? 'Saving...' : 'Confirm Rejection' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isBusinessInterviewRequestReviewOpen" class="business-modal" @click.self="closeBusinessInterviewRequestReview">
        <div
          class="business-modal__card business-applicants-modal business-interview-review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-interview-review-title"
        >
          <div class="business-modal__copy">
            <h2 id="business-interview-review-title">
              {{ businessInterviewReviewState.mode === 'reject' ? 'Reject reschedule request' : 'Review reschedule request' }}
            </h2>
            <p v-if="selectedBusinessInterviewReviewSchedule">
              Review the applicant request below and decide whether to reject it or share available interview dates for the reschedule.
            </p>
          </div>

          <div v-if="selectedBusinessInterviewReviewSchedule" class="business-applicants-modal__body">
            <div class="business-applicants-modal__identity">
              <div class="business-applicants-modal__avatar">
                <img
                  v-if="selectedBusinessInterviewReviewSchedule.applicantAvatar"
                  :src="selectedBusinessInterviewReviewSchedule.applicantAvatar"
                  :alt="`${selectedBusinessInterviewReviewSchedule.applicantName} avatar`"
                >
                <template v-else>{{ buildUserOverviewInitials(selectedBusinessInterviewReviewSchedule.applicantName, 'AP') }}</template>
              </div>

              <div class="business-applicants-modal__identity-copy">
                <strong>{{ selectedBusinessInterviewReviewSchedule.applicantName }}</strong>
                <span>{{ selectedBusinessInterviewReviewSchedule.applicantEmail }}</span>
                <span class="business-interview-status__badge is-pending">
                  {{ formatBusinessInterviewApplicantResponseLabel(selectedBusinessInterviewReviewSchedule) }}
                </span>
              </div>
            </div>

            <div class="business-applicants-modal__grid">
              <div class="business-applicants-modal__item">
                <span>Interview Type</span>
                <strong>{{ formatBusinessInterviewTypeLabel(selectedBusinessInterviewReviewSchedule.interviewType) }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Job Title</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.jobTitle }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Current Schedule</span>
                <strong>{{ formatBusinessInterviewDateTime(selectedBusinessInterviewReviewSchedule.scheduledAt) }}</strong>
              </div>
              <div class="business-applicants-modal__item">
                <span>Requested Schedule</span>
                <strong>{{ formatBusinessInterviewDateTime(selectedBusinessInterviewReviewSchedule.requestedScheduleAt) }}</strong>
              </div>
              <div class="business-applicants-modal__item business-applicants-modal__item--wide">
                <span>Reschedule Reason</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.applicantResponseReason || 'No reason submitted.' }}</strong>
              </div>
              <div
                v-if="selectedBusinessInterviewReviewSchedule.businessDecisionReason && businessInterviewReviewState.mode !== 'reject'"
                class="business-applicants-modal__item business-applicants-modal__item--wide"
              >
                <span>Latest Decision Note</span>
                <strong>{{ selectedBusinessInterviewReviewSchedule.businessDecisionReason }}</strong>
              </div>
            </div>

            <label v-if="businessInterviewReviewState.mode === 'reject'" class="business-applicants-modal__reason">
              <span>Reason for rejection</span>
              <textarea
                v-model.trim="businessInterviewReviewState.reason"
                rows="4"
                placeholder="State the reason that the applicant should see on the Interviews and My Applications pages."
              />
            </label>

            <div v-else class="business-applicants-modal__reason business-interview-review-modal__options">
              <span>Available reschedule dates</span>
              <small>Share one or more current or future interview dates that the applicant can review and confirm.</small>
              <div class="business-interview-review-modal__option-grid">
                <label
                  v-for="(_, index) in businessInterviewRequestScheduleOptions"
                  :key="`business-interview-review-option-${index}`"
                  class="business-interview-review-modal__option-field"
                >
                  <span>Option {{ index + 1 }}</span>
                  <input
                    v-model="businessInterviewRequestScheduleOptions[index]"
                    type="datetime-local"
                    :min="businessInterviewMinScheduleDateTime"
                  />
                </label>
              </div>
              <div class="business-interview-review-modal__option-actions">
                <button
                  type="button"
                  class="business-interview-review-modal__option-add"
                  :disabled="isBusinessInterviewRequestDecisionSubmitting"
                  @click="addBusinessInterviewRequestScheduleOption()"
                >
                  Add another date
                </button>
              </div>
            </div>

            <p v-if="businessInterviewReviewState.error" class="business-applicants-modal__error">
              {{ businessInterviewReviewState.error }}
            </p>
          </div>

          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="businessInterviewReviewState.mode === 'reject' ? businessInterviewReviewState.mode = 'view' : closeBusinessInterviewRequestReview()"
            >
              {{ businessInterviewReviewState.mode === 'reject' ? 'Back' : 'Close' }}
            </button>
            <button
              v-if="businessInterviewReviewState.mode !== 'reject'"
              type="button"
              class="business-modal__button business-modal__button--secondary business-applicants-modal__button--reject"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="businessInterviewReviewState.mode = 'reject'; businessInterviewReviewState.error = ''"
            >
              Reject Request
            </button>
            <button
              v-if="businessInterviewReviewState.mode !== 'reject'"
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="approveBusinessInterviewRescheduleRequest()"
            >
              {{ isBusinessInterviewRequestDecisionSubmitting ? 'Saving...' : 'Approve & Share Dates' }}
            </button>
            <button
              v-else
              type="button"
              class="business-modal__button business-modal__button--primary business-applicants-modal__button--reject-primary"
              :disabled="isBusinessInterviewRequestDecisionSubmitting"
              @click="rejectBusinessInterviewRescheduleRequest()"
            >
              {{ isBusinessInterviewRequestDecisionSubmitting ? 'Saving...' : 'Confirm Rejection' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isHelpCenterModalOpen" class="business-modal" @click.self="closeHelpCenterModal">
        <div class="business-modal__card business-help-modal" role="dialog" aria-modal="true" aria-labelledby="business-help-title">
          <div class="business-modal__copy">
            <h2 id="business-help-title">Help Center</h2>
            <p>Find quick support details for your business subscription and workspace tools.</p>
          </div>
          <div class="business-help-modal__grid">
            <article class="business-help-modal__item">
              <i class="bi bi-credit-card-2-front" aria-hidden="true" />
              <div>
                <strong>Billing Support</strong>
                <span>Questions about premium access, payment steps, and trial activation.</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-journal-check" aria-hidden="true" />
              <div>
                <strong>Templates &amp; Tools</strong>
                <span>Help using Training Templates and Assessment Templates.</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-envelope-paper" aria-hidden="true" />
              <div>
                <strong>Contact</strong>
                <span>support@mathplatform.local</span>
              </div>
            </article>
            <article class="business-help-modal__item">
              <i class="bi bi-clock-history" aria-hidden="true" />
              <div>
                <strong>Support Hours</strong>
                <span>Monday to Friday, 8:00 AM to 5:00 PM</span>
              </div>
            </article>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              @click="closeHelpCenterModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isCreateUserConfirmOpen" class="business-modal" @click.self="closeCreateUserConfirm">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-create-user-title">
          <div class="business-modal__copy">
            <h2 id="business-create-user-title">Confirm user creation</h2>
            <p>Create a new workspace user for {{ createUserConfirmationName }} using {{ createUserConfirmationEmail }}?</p>
            <p class="business-modal__note">Kapag nag-Yes ka, magsisimula ang account creation at lalabas ang success toast pagkatapos ma-save.</p>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isCreatingWorkspaceUser"
              @click="closeCreateUserConfirm"
            >
              No
            </button>
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isCreatingWorkspaceUser"
              @click="executeWorkspaceUserAccountCreation"
            >
              {{ isCreatingWorkspaceUser ? 'Creating Account...' : 'Yes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isLogoutConfirmOpen" class="business-modal" @click.self="closeLogoutConfirm">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-logout-title">
          <div class="business-modal__copy">
            <h2 id="business-logout-title">Are you sure you want to log out?</h2>
            <p>Your current session will be closed and you will return to the login page.</p>
          </div>
          <div class="business-modal__actions">
            <button
              type="button"
              class="business-modal__button business-modal__button--secondary"
              :disabled="isLogoutSubmitting"
              @click="closeLogoutConfirm"
            >
              No
            </button>
            <button
              type="button"
              class="business-modal__button business-modal__button--primary"
              :disabled="isLogoutSubmitting"
              @click="confirmLogout"
            >
              {{ isLogoutSubmitting ? 'Logging Out...' : 'Yes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isTrialConfirmationOpen" class="business-modal" @click.self="closeTrialConfirmation">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-trial-title">
          <div class="business-modal__copy">
            <h2 id="business-trial-title">{{ currentCheckoutFlow.modalTitle }}</h2>
            <p>{{ currentCheckoutFlow.modalDescription }}</p>
            <p class="business-modal__note">{{ currentCheckoutFlow.modalNote }}</p>
          </div>
          <div class="business-modal__actions">
            <button type="button" class="business-modal__button business-modal__button--secondary" @click="closeTrialConfirmation">
              Cancel
            </button>
            <button type="button" class="business-modal__button business-modal__button--primary" @click="proceedToPayment">
              Continue
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="business-trial-modal">
      <div v-if="isCancelPaymentModalOpen" class="business-modal" @click.self="closeCancelPaymentModal">
        <div class="business-modal__card" role="dialog" aria-modal="true" aria-labelledby="business-cancel-title">
          <div class="business-modal__copy">
            <h2 id="business-cancel-title">Cancel payment setup?</h2>
            <p>If you cancel now, your payment progress will be closed and you will return to the subscription plans.</p>
          </div>
          <div class="business-modal__actions">
            <button type="button" class="business-modal__button business-modal__button--secondary" :disabled="isCancellingPayment" @click="closeCancelPaymentModal">
              No
            </button>
            <button type="button" class="business-modal__button business-modal__button--primary" :disabled="isCancellingPayment" @click="confirmCancelPayment">
              {{ isCancellingPayment ? 'Cancelling...' : 'Yes, Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>
