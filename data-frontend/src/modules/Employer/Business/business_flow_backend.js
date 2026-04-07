import { updateApplicantJobApplicationStatus } from '@/lib/apply_jobs'
import {
  deleteBusinessApplicantScoreRecord,
  saveBusinessApplicantScoreRecord,
} from '@/lib/business_applicant_scores'
import { saveBusinessInterviewSchedule } from '@/lib/business_interviews'
import {
  deleteBusinessAssessmentAssignmentRecord,
  deleteBusinessTrainingAssignmentRecord,
  saveBusinessAssessmentAssignmentRecord,
  saveBusinessTrainingAssignmentRecord,
} from '@/lib/business_workspace_records'

const getErrorMessage = (error, fallback) =>
  error instanceof Error ? error.message : fallback

const upsertApplicantAssessmentScoreRecord = async ({
  applicant = {},
  buildApplicantAssessmentScoreRecord,
}) => {
  const nextRecord = buildApplicantAssessmentScoreRecord(applicant)
  if (!nextRecord.id || !nextRecord.workspaceOwnerId) return false

  try {
    await saveBusinessApplicantScoreRecord(nextRecord)
    return true
  } catch {
    return false
  }
}

export const approveApplicantManagementApplicationProcess = async ({
  applicationId,
  authUser,
  businessName,
  isApplicantManagementDecisionSubmitting,
  applicantManagementDecisionError,
  getApplicantManagementApplicationById,
  canEditBusinessModule,
  canUpdateApplicantManagementStatus,
  showPaymentToast,
  closeApplicantManagementModal,
}) => {
  if (!canEditBusinessModule('applicant-management')) {
    showPaymentToast('Your role has view-only access for Applicant Management.', 'warning')
    return
  }

  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }
  if (!canUpdateApplicantManagementStatus(targetApplication?.status)) {
    showPaymentToast('This application is already finalized.', 'warning')
    return
  }

  if (isApplicantManagementDecisionSubmitting.value) return

  try {
    isApplicantManagementDecisionSubmitting.value = true
    applicantManagementDecisionError.value = ''
    await updateApplicantJobApplicationStatus(String(targetApplication.id || '').trim(), {
      status: 'approved',
      rejectionReason: '',
      reviewedBy: String(authUser.value?.id || authUser.value?.uid || '').trim(),
      reviewedByName: String(authUser.value?.name || businessName.value || 'Business Owner').trim(),
    })
    showPaymentToast(`${String(targetApplication.applicantName || 'Applicant').trim()} was approved successfully.`, 'success')
    closeApplicantManagementModal()
  } catch (error) {
    const message = getErrorMessage(error, 'Unable to approve the applicant right now.')
    applicantManagementDecisionError.value = message
    showPaymentToast(message, 'error')
  } finally {
    isApplicantManagementDecisionSubmitting.value = false
  }
}

export const rejectApplicantManagementApplicationProcess = async ({
  applicationId,
  authUser,
  businessName,
  isApplicantManagementDecisionSubmitting,
  applicantManagementDecisionError,
  applicantManagementDecisionReason,
  getApplicantManagementApplicationById,
  canEditBusinessModule,
  canUpdateApplicantManagementStatus,
  showPaymentToast,
  closeApplicantManagementModal,
}) => {
  if (!canEditBusinessModule('applicant-management')) {
    showPaymentToast('Your role has view-only access for Applicant Management.', 'warning')
    return
  }

  const targetApplication = getApplicantManagementApplicationById(applicationId)
  if (!targetApplication) {
    showPaymentToast('That applicant application could not be found.', 'error')
    return
  }
  if (!canUpdateApplicantManagementStatus(targetApplication?.status)) {
    showPaymentToast('This application is already finalized.', 'warning')
    return
  }

  const rejectionReason = String(applicantManagementDecisionReason.value || '').trim()
  if (!rejectionReason) {
    applicantManagementDecisionError.value = 'Enter a rejection reason before rejecting this application.'
    return
  }

  if (isApplicantManagementDecisionSubmitting.value) return

  try {
    isApplicantManagementDecisionSubmitting.value = true
    applicantManagementDecisionError.value = ''
    await updateApplicantJobApplicationStatus(String(targetApplication.id || '').trim(), {
      status: 'rejected',
      rejectionReason,
      reviewedBy: String(authUser.value?.id || authUser.value?.uid || '').trim(),
      reviewedByName: String(authUser.value?.name || businessName.value || 'Business Owner').trim(),
    })
    showPaymentToast(`${String(targetApplication.applicantName || 'Applicant').trim()} was rejected and notified with the reason.`, 'success')
    closeApplicantManagementModal()
  } catch (error) {
    const message = getErrorMessage(error, 'Unable to reject the applicant right now.')
    applicantManagementDecisionError.value = message
    showPaymentToast(message, 'error')
  } finally {
    isApplicantManagementDecisionSubmitting.value = false
  }
}

export const completeBusinessInterviewScheduleProcess = async ({
  scheduleId,
  businessInterviewSchedules,
  canEditBusinessModule,
  showPaymentToast,
  upsertBusinessInterviewScheduleState,
  buildBusinessInterviewApplicationPayload,
}) => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = businessInterviewSchedules.value.find((entry) =>
    String(entry?.id || '').trim() === String(scheduleId || '').trim())
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    showPaymentToast('That interview schedule could not be found.', 'error')
    return
  }

  try {
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduleStatus: 'completed',
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord),
    )
    showPaymentToast('Interview marked as completed.', 'success')
  } catch (error) {
    showPaymentToast(getErrorMessage(error, 'Unable to mark this interview as completed right now.'), 'error')
  }
}

export const approveBusinessInterviewRescheduleRequestProcess = async ({
  selectedBusinessInterviewReviewSchedule,
  businessInterviewRequestScheduleOptions,
  isBusinessInterviewRequestDecisionSubmitting,
  businessInterviewRequestDecisionError,
  businessInterviewSelectedCalendarDateKey,
  businessInterviewCalendarBaseDate,
  canEditBusinessModule,
  showPaymentToast,
  normalizeBusinessInterviewDecisionScheduleOptions,
  upsertBusinessInterviewScheduleState,
  buildBusinessInterviewApplicationPayload,
  closeBusinessInterviewRequestReview,
  formatBusinessInterviewDateKey,
}) => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = selectedBusinessInterviewReviewSchedule.value
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    businessInterviewRequestDecisionError.value = 'That interview request could not be found.'
    return
  }

  const availableScheduleOptions = normalizeBusinessInterviewDecisionScheduleOptions(
    businessInterviewRequestScheduleOptions.value,
  )
  if (!availableScheduleOptions.length) {
    businessInterviewRequestDecisionError.value = 'Add at least one current or future interview date before approving.'
    return
  }

  if (isBusinessInterviewRequestDecisionSubmitting.value) return

  try {
    isBusinessInterviewRequestDecisionSubmitting.value = true
    businessInterviewRequestDecisionError.value = ''
    const decisionAt = new Date().toISOString()
    const approvalNote = availableScheduleOptions.length > 1
      ? 'Reschedule approved. Review the available interview dates from the business owner and confirm one schedule.'
      : 'Reschedule approved. Review the updated interview time and confirm your attendance.'
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduledAt: availableScheduleOptions[0],
      scheduleStatus: 'scheduled',
      applicantResponseStatus: 'pending',
      applicantResponseReason: '',
      requestedScheduleAt: '',
      applicantRespondedAt: '',
      businessDecisionReason: approvalNote,
      businessDecidedAt: decisionAt,
      availableScheduleOptions,
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord, {
        interviewSchedule: nextScheduleRecord.scheduledAt,
        interviewDate: nextScheduleRecord.scheduledAt,
        interviewResponseStatus: 'pending',
        interviewRescheduleReason: '',
        interviewRequestedScheduleAt: '',
        interviewDecisionReason: approvalNote,
        interviewRespondedAt: '',
        interviewDecidedAt: decisionAt,
        interviewScheduleOptions: availableScheduleOptions,
      }),
    )

    const approvedDate = new Date(availableScheduleOptions[0])
    businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(approvedDate)
    businessInterviewCalendarBaseDate.value = new Date(approvedDate.getFullYear(), approvedDate.getMonth(), 1)
    closeBusinessInterviewRequestReview()
    showPaymentToast('Reschedule request approved. The shared interview date options are now live for the applicant.', 'success')
  } catch (error) {
    businessInterviewRequestDecisionError.value = getErrorMessage(error, 'Unable to approve the reschedule request right now.')
  } finally {
    isBusinessInterviewRequestDecisionSubmitting.value = false
  }
}

export const rejectBusinessInterviewRescheduleRequestProcess = async ({
  selectedBusinessInterviewReviewSchedule,
  businessInterviewRequestDecisionReason,
  isBusinessInterviewRequestDecisionSubmitting,
  businessInterviewRequestDecisionError,
  canEditBusinessModule,
  showPaymentToast,
  upsertBusinessInterviewScheduleState,
  buildBusinessInterviewApplicationPayload,
  closeBusinessInterviewRequestReview,
}) => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  const targetSchedule = selectedBusinessInterviewReviewSchedule.value
  if (!targetSchedule?.id || !targetSchedule?.applicationId) {
    businessInterviewRequestDecisionError.value = 'That interview request could not be found.'
    return
  }

  const rejectionReason = String(businessInterviewRequestDecisionReason.value || '').trim()
  if (!rejectionReason) {
    businessInterviewRequestDecisionError.value = 'Enter a reason before rejecting the reschedule request.'
    return
  }

  if (isBusinessInterviewRequestDecisionSubmitting.value) return

  try {
    isBusinessInterviewRequestDecisionSubmitting.value = true
    businessInterviewRequestDecisionError.value = ''
    const decisionAt = new Date().toISOString()
    const nextScheduleRecord = {
      ...targetSchedule,
      scheduleStatus: 'cancelled',
      applicantResponseStatus: 'reschedule_rejected',
      businessDecisionReason: rejectionReason,
      businessDecidedAt: decisionAt,
      availableScheduleOptions: [],
    }

    await saveBusinessInterviewSchedule(nextScheduleRecord)
    upsertBusinessInterviewScheduleState(nextScheduleRecord)
    await updateApplicantJobApplicationStatus(
      targetSchedule.applicationId,
      buildBusinessInterviewApplicationPayload(nextScheduleRecord, {
        status: 'rejected',
        interviewResponseStatus: 'reschedule_rejected',
        interviewRescheduleReason: nextScheduleRecord.applicantResponseReason,
        interviewRequestedScheduleAt: nextScheduleRecord.requestedScheduleAt,
        interviewDecisionReason: rejectionReason,
        interviewRespondedAt: nextScheduleRecord.applicantRespondedAt,
        interviewDecidedAt: decisionAt,
        interviewScheduleOptions: [],
        rejectionReason,
      }),
    )

    closeBusinessInterviewRequestReview()
    showPaymentToast('Reschedule request rejected. The reason is now visible to the applicant and the application has been closed.', 'success')
  } catch (error) {
    businessInterviewRequestDecisionError.value = getErrorMessage(error, 'Unable to reject the reschedule request right now.')
  } finally {
    isBusinessInterviewRequestDecisionSubmitting.value = false
  }
}

export const createBusinessInterviewScheduleProcess = async ({
  authUser,
  businessName,
  businessInterviewSchedulingForm,
  businessInterviewSchedulingFormError,
  businessInterviewFilteredApplicants,
  businessInterviewAvailableInterviewTypeOptions,
  businessInterviewSchedules,
  businessInterviewSelectedCalendarDateKey,
  businessInterviewCalendarBaseDate,
  canEditBusinessModule,
  showPaymentToast,
  hasBusinessInterviewPassedTechnicalAssessment,
  resolveBusinessInterviewTechnicalStage,
  normalizeBusinessInterviewScheduleStatus,
  getWorkspaceOwnerDirectoryId,
  createBusinessInterviewScheduleId,
  buildBusinessInterviewApplicationPayload,
  upsertBusinessInterviewScheduleState,
  resetBusinessInterviewSchedulingForm,
  formatBusinessInterviewDateKey,
}) => {
  if (!canEditBusinessModule('interview-scheduling')) {
    showPaymentToast('Your role has view-only access for Interview Scheduling.', 'warning')
    return
  }

  businessInterviewSchedulingFormError.value = ''
  const selectedApplicant = businessInterviewFilteredApplicants.value.find(
    (entry) => entry.id === businessInterviewSchedulingForm.value.applicationId,
  )
  if (!selectedApplicant) {
    businessInterviewSchedulingFormError.value = 'Please select an accepted applicant for the selected job.'
    return
  }

  if (!hasBusinessInterviewPassedTechnicalAssessment(selectedApplicant.id)) {
    businessInterviewSchedulingFormError.value = resolveBusinessInterviewTechnicalStage(selectedApplicant.id).text
    return
  }

  if (!businessInterviewAvailableInterviewTypeOptions.value.some(
    (option) => option.value === businessInterviewSchedulingForm.value.interviewType,
  )) {
    businessInterviewSchedulingFormError.value = 'Invalid interview selection for this applicant.'
    return
  }

  const scheduleTimestamp = Date.parse(businessInterviewSchedulingForm.value.scheduledAt)
  if (Number.isNaN(scheduleTimestamp) || scheduleTimestamp < Date.now()) {
    businessInterviewSchedulingFormError.value = 'Please select a valid future date and time.'
    return
  }

  const duplicateSchedule = businessInterviewSchedules.value.find((entry) =>
    entry.applicationId === selectedApplicant.id
    && normalizeBusinessInterviewScheduleStatus(entry.scheduleStatus) !== 'cancelled',
  )
  if (duplicateSchedule) {
    businessInterviewSchedulingFormError.value = 'A scheduled interview already exists for this applicant.'
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  const workspaceOwnerName = String(businessName.value || authUser.value?.company_name || authUser.value?.name || 'Business Workspace').trim()
  const workspaceOwnerEmail = String(authUser.value?.email || '').trim().toLowerCase()
  const nextSchedule = {
    id: createBusinessInterviewScheduleId(),
    workspaceOwnerId,
    workspaceOwnerName,
    workspaceOwnerEmail,
    applicationId: selectedApplicant.id,
    applicantName: selectedApplicant.applicantName,
    applicantEmail: selectedApplicant.applicantEmail,
    applicantId: selectedApplicant.applicantId,
    applicantAvatar: selectedApplicant.applicantAvatar,
    jobId: selectedApplicant.jobId,
    jobTitle: selectedApplicant.jobTitle,
    interviewType: businessInterviewSchedulingForm.value.interviewType,
    scheduledAt: new Date(scheduleTimestamp).toISOString(),
    mode: businessInterviewSchedulingForm.value.mode,
    locationOrLink: businessInterviewSchedulingForm.value.locationOrLink.trim(),
    interviewer: businessInterviewSchedulingForm.value.interviewer.trim(),
    notes: businessInterviewSchedulingForm.value.notes.trim(),
    scheduleStatus: 'scheduled',
    applicantResponseStatus: 'pending',
    applicantResponseReason: '',
    requestedScheduleAt: '',
    applicantRespondedAt: '',
    businessDecisionReason: '',
    businessDecidedAt: '',
  }

  try {
    await saveBusinessInterviewSchedule(nextSchedule)
    upsertBusinessInterviewScheduleState(nextSchedule)
    await updateApplicantJobApplicationStatus(selectedApplicant.id, buildBusinessInterviewApplicationPayload(nextSchedule))

    const createdDate = new Date(nextSchedule.scheduledAt)
    businessInterviewSelectedCalendarDateKey.value = formatBusinessInterviewDateKey(createdDate)
    businessInterviewCalendarBaseDate.value = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1)
    resetBusinessInterviewSchedulingForm()
    showPaymentToast('Interview schedule created in Firestore. Review it in the Interview Status tab.', 'success')
  } catch (error) {
    businessInterviewSchedulingFormError.value = getErrorMessage(error, 'Unable to save the interview schedule right now.')
  }
}

export const assignTrainingTemplateToMemberProcess = async ({
  memberId,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  findTrainingTemplateById,
  buildTrainingAssignmentRecordPayload,
  buildTrainingAssignmentSnapshotFromTemplate,
  syncLocalTrainingAssignmentRecord,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetMember = trainingTemplateAssignments.value.find((member) => member.id === memberId)
  if (!targetMember) return
  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before assigning a training template.', 'error')
    return
  }

  if (!targetMember.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the applicant.', 'warning')
    return
  }

  const selectedTemplate = findTrainingTemplateById(targetMember.selectedTemplateId)
  if (!selectedTemplate) {
    showPaymentToast('Only saved training templates can be assigned to applicants.', 'warning')
    return
  }

  const savedAssignmentRecord = trainingAssignmentRecords.value.find((record) =>
    String(record?.id || record?.memberId || record?.applicationId || '').trim() === String(memberId || '').trim())
  const shouldReuseExistingProgress =
    String(savedAssignmentRecord?.selectedTemplateId || '').trim() === String(targetMember.selectedTemplateId || '').trim()
    && Array.isArray(savedAssignmentRecord?.templateCategories)
    && savedAssignmentRecord.templateCategories.length > 0
  const nextRecord = buildTrainingAssignmentRecordPayload(
    {
      ...targetMember,
      ...savedAssignmentRecord,
    },
    {
      selectedTemplateId: targetMember.selectedTemplateId,
      templateCategories: shouldReuseExistingProgress
        ? savedAssignmentRecord.templateCategories
        : buildTrainingAssignmentSnapshotFromTemplate(selectedTemplate),
      assignmentStatus: 'Assigned',
      assignedAt: new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(new Date()),
      progressStatus: shouldReuseExistingProgress
        ? savedAssignmentRecord?.progressStatus || 'Not Started'
        : 'Not Started',
    },
  )

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
    syncLocalTrainingAssignmentRecord(nextRecord)
    showPaymentToast(`Training template assigned to ${targetMember.name}.`, 'success')
  } catch (error) {
    showPaymentToast(getErrorMessage(error, 'Unable to assign this training template right now.'), 'error')
  }
}

export const removeAssignedTrainingTemplateFromMemberProcess = async ({
  memberId,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  showPaymentToast,
  removeLocalTrainingAssignmentRecord,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const normalizedMemberId = String(memberId || '').trim()
  if (!normalizedMemberId) return

  const targetMember = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || member?.applicationId || '').trim() === normalizedMemberId)
  if (!targetMember) return

  const savedAssignmentRecord = trainingAssignmentRecords.value.find((record) =>
    String(record?.id || record?.memberId || record?.applicationId || '').trim() === normalizedMemberId)

  try {
    if (savedAssignmentRecord) {
      await deleteBusinessTrainingAssignmentRecord(
        String(savedAssignmentRecord.id || savedAssignmentRecord.memberId || savedAssignmentRecord.applicationId || normalizedMemberId).trim(),
      )
    }

    removeLocalTrainingAssignmentRecord(normalizedMemberId)
    showPaymentToast(`Training template removed from ${targetMember.name}.`, 'success')
  } catch (error) {
    showPaymentToast(getErrorMessage(error, 'Unable to remove this training template right now.'), 'error')
  }
}

export const toggleTrainingAssignmentSkillCompletionProcess = async ({
  assignmentId,
  categoryId,
  skillId,
  completed,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  trainingTrackingSavingSkillKeys,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  createTrainingTrackingSkillKey,
  cloneTrainingAssignmentProgressCategories,
  normalizeTrainingTrackingSkillGrade,
  buildTrainingAssignmentRecordPayload,
  resolveTrainingAssignmentProgressStatus,
  syncLocalTrainingAssignmentRecord,
  rebuildTrainingAssignments,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before updating training progress.', 'error')
    return
  }

  const savingKey = createTrainingTrackingSkillKey(assignmentId, categoryId, skillId)
  if (trainingTrackingSavingSkillKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        skills: category.skills.map((skill) =>
          String(skill?.id || '').trim() === String(skillId || '').trim()
            ? {
              ...skill,
              completed: Boolean(completed),
              completedAt: completed ? new Date().toISOString() : '',
              grade: completed ? normalizeTrainingTrackingSkillGrade(skill?.grade) : 0,
            }
            : skill),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingSkillKeys.value = [...trainingTrackingSavingSkillKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(getErrorMessage(error, 'Unable to update this training progress right now.'), 'error')
  } finally {
    trainingTrackingSavingSkillKeys.value = trainingTrackingSavingSkillKeys.value.filter((key) => key !== savingKey)
  }
}

export const setTrainingAssignmentSkillGradeProcess = async ({
  assignmentId,
  categoryId,
  skillId,
  gradeValue,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  trainingTrackingSavingSkillKeys,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  normalizeTrainingTrackingSkillGrade,
  createTrainingTrackingSkillKey,
  cloneTrainingAssignmentProgressCategories,
  buildTrainingAssignmentRecordPayload,
  resolveTrainingAssignmentProgressStatus,
  syncLocalTrainingAssignmentRecord,
  rebuildTrainingAssignments,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const normalizedGrade = normalizeTrainingTrackingSkillGrade(gradeValue)
  if (!normalizedGrade) {
    showPaymentToast('Choose a grade from 1 to 5 for this skill.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const targetCategory = Array.isArray(targetAssignment?.templateCategories)
    ? targetAssignment.templateCategories.find((category) => String(category?.id || '').trim() === String(categoryId || '').trim())
    : null
  const targetSkill = Array.isArray(targetCategory?.skills)
    ? targetCategory.skills.find((skill) => String(skill?.id || '').trim() === String(skillId || '').trim())
    : null

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before updating skill grades.', 'error')
    return
  }

  const savingKey = createTrainingTrackingSkillKey(assignmentId, categoryId, skillId)
  if (trainingTrackingSavingSkillKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        skills: category.skills.map((skill) =>
          String(skill?.id || '').trim() === String(skillId || '').trim()
            ? {
              ...skill,
              completed: true,
              completedAt: skill?.completedAt || new Date().toISOString(),
              grade: normalizedGrade,
            }
            : skill),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingSkillKeys.value = [...trainingTrackingSavingSkillKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(getErrorMessage(error, 'Unable to save this skill grade right now.'), 'error')
  } finally {
    trainingTrackingSavingSkillKeys.value = trainingTrackingSavingSkillKeys.value.filter((key) => key !== savingKey)
  }
}

export const saveTrainingTrackingCategoryRemarkProcess = async ({
  assignmentId,
  categoryId,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  trainingTrackingSavingCategoryKeys,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  calculateTrainingCategoryProgress,
  getTrainingTrackingCategoryRemarkDraft,
  createTrainingTrackingCategoryKey,
  cloneTrainingAssignmentProgressCategories,
  buildTrainingAssignmentRecordPayload,
  resolveTrainingAssignmentProgressStatus,
  syncLocalTrainingAssignmentRecord,
  rebuildTrainingAssignments,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === String(assignmentId || '').trim())
  if (!targetAssignment) return

  const targetCategory = Array.isArray(targetAssignment?.templateCategories)
    ? targetAssignment.templateCategories.find((category) => String(category?.id || '').trim() === String(categoryId || '').trim())
    : null
  if (!targetCategory) return

  const categoryProgress = calculateTrainingCategoryProgress(targetCategory)
  if (!categoryProgress.totalSkills || categoryProgress.completedSkills < categoryProgress.totalSkills) {
    showPaymentToast('Complete all skills in this category before saving a remark.', 'warning')
    return
  }

  const draftValue = String(getTrainingTrackingCategoryRemarkDraft(assignmentId, targetCategory) || '').trim()
  if (!draftValue) {
    showPaymentToast('Enter a remark for this training category before saving.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before saving this category remark.', 'error')
    return
  }

  const savingKey = createTrainingTrackingCategoryKey(assignmentId, categoryId)
  if (trainingTrackingSavingCategoryKeys.value.includes(savingKey)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const nextCategories = cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories).map((category) =>
    String(category?.id || '').trim() === String(categoryId || '').trim()
      ? {
        ...category,
        remark: draftValue,
        remarkedAt: new Date().toISOString(),
      }
      : category)
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: nextCategories,
    trainingCompletedAt: '',
    trainingCompletedBy: '',
    trainingCompletedByName: '',
    progressStatus: resolveTrainingAssignmentProgressStatus(nextCategories, targetAssignment.progressStatus),
  })

  trainingTrackingSavingCategoryKeys.value = [...trainingTrackingSavingCategoryKeys.value, savingKey]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(getErrorMessage(error, 'Unable to save this category remark right now.'), 'error')
  } finally {
    trainingTrackingSavingCategoryKeys.value = trainingTrackingSavingCategoryKeys.value.filter((key) => key !== savingKey)
  }
}

export const completeTrainingTrackingAssignmentProcess = async ({
  assignmentId,
  authUser,
  businessName,
  canEditTrainingAssignments,
  trainingTemplateAssignments,
  trainingAssignmentRecords,
  trainingTrackingCompletingAssignmentIds,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  canCompleteTrainingTrackingAssignmentRecord,
  cloneTrainingAssignmentProgressCategories,
  buildTrainingAssignmentRecordPayload,
  resolveTrainingAssignmentProgressStatus,
  syncLocalTrainingAssignmentRecord,
  rebuildTrainingAssignments,
}) => {
  if (!canEditTrainingAssignments.value) {
    showPaymentToast('Your role has view-only access for Assign Templates.', 'warning')
    return
  }

  const normalizedAssignmentId = String(assignmentId || '').trim()
  const targetAssignment = trainingTemplateAssignments.value.find((member) =>
    String(member?.id || '').trim() === normalizedAssignmentId)
  if (!targetAssignment) return

  if (!canCompleteTrainingTrackingAssignmentRecord(targetAssignment.templateCategories)) {
    showPaymentToast('Complete every skill, add grades, and save remarks for each training category first.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before completing this training record.', 'error')
    return
  }

  if (trainingTrackingCompletingAssignmentIds.value.includes(normalizedAssignmentId)) return

  const previousRecords = [...trainingAssignmentRecords.value]
  const completionActorId = String(authUser.value?.id || authUser.value?.uid || '').trim()
  const completionActorName = String(authUser.value?.name || businessName.value || 'Business Owner').trim()
  const completionTimestamp = new Date().toISOString()
  const nextRecord = buildTrainingAssignmentRecordPayload(targetAssignment, {
    templateCategories: cloneTrainingAssignmentProgressCategories(targetAssignment.templateCategories),
    trainingCompletedAt: completionTimestamp,
    trainingCompletedBy: completionActorId,
    trainingCompletedByName: completionActorName,
    progressStatus: resolveTrainingAssignmentProgressStatus(
      targetAssignment.templateCategories,
      targetAssignment.progressStatus,
    ),
  })

  trainingTrackingCompletingAssignmentIds.value = [
    ...trainingTrackingCompletingAssignmentIds.value,
    normalizedAssignmentId,
  ]
  syncLocalTrainingAssignmentRecord(nextRecord)

  try {
    await saveBusinessTrainingAssignmentRecord({
      ...nextRecord,
      workspaceOwnerId,
    })
    showPaymentToast(`Training monitoring completed for ${targetAssignment.name}.`, 'success')
  } catch (error) {
    trainingAssignmentRecords.value = previousRecords
    rebuildTrainingAssignments()
    showPaymentToast(getErrorMessage(error, 'Unable to complete this training record right now.'), 'error')
  } finally {
    trainingTrackingCompletingAssignmentIds.value = trainingTrackingCompletingAssignmentIds.value.filter(
      (value) => value !== normalizedAssignmentId,
    )
  }
}

export const syncAssignedApplicantAssessmentScoresProcess = async ({
  applicantAssessmentScoreEntries,
  assessmentAssignmentRecords,
  approvedApplicantProfiles,
  isBusinessApplicationLinkedToPostedJob,
  buildApplicantAssessmentScoreRecord,
}) => {
  const assignedApplicants = assessmentAssignmentRecords.value
    .filter((record) =>
      isBusinessApplicationLinkedToPostedJob(record)
      && (
        ['assigned', 'submitted'].includes(String(record?.assignmentStatus || '').trim().toLowerCase())
        && String(record?.selectedTemplateId || '').trim()
      ),
    )
    .map((record) => {
      const applicationId = String(record?.applicationId || record?.id || '').trim()
      const linkedProfile = approvedApplicantProfiles.value.find((profile) =>
        String(profile?.applicationId || profile?.id || '').trim() === applicationId,
      ) || null

      return {
        ...(linkedProfile || {}),
        ...record,
        id: applicationId || String(record?.id || '').trim(),
        applicationId: applicationId || String(record?.id || '').trim(),
        applicantId: String(record?.applicantId || linkedProfile?.applicantId || '').trim(),
        name: String(record?.name || linkedProfile?.name || 'Applicant').trim() || 'Applicant',
        email: String(record?.email || linkedProfile?.email || '').trim().toLowerCase(),
        role: String(record?.role || linkedProfile?.role || 'Applicant').trim() || 'Applicant',
        score: String(record?.score || linkedProfile?.score || 'No score yet').trim() || 'No score yet',
      }
    })
  const activeApplicantScoreIds = new Set(
    assignedApplicants
      .map((applicant) => String(applicant?.applicationId || applicant?.id || applicant?.applicantId || '').trim())
      .filter(Boolean),
  )
  const staleApplicantScoreEntries = applicantAssessmentScoreEntries.value.filter((entry) => {
    const entryId = String(entry?.id || entry?.applicantId || '').trim()
    return entryId && !activeApplicantScoreIds.has(entryId)
  })

  await Promise.allSettled(
    [
      ...assignedApplicants.map((applicant) => upsertApplicantAssessmentScoreRecord({
        applicant,
        buildApplicantAssessmentScoreRecord,
      })),
      ...staleApplicantScoreEntries.map((entry) => deleteBusinessApplicantScoreRecord(String(entry?.id || '').trim())),
    ],
  )
}

export const assignAssessmentTemplateToApplicantProcess = async ({
  applicantId,
  approvedApplicantTemplateAssignments,
  canEditBusinessModule,
  showPaymentToast,
  getWorkspaceOwnerDirectoryId,
  buildAssessmentAssignmentTemplateSnapshot,
  countScorableAssessmentQuestions,
  buildApplicantAssessmentScoreRecord,
}) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) return

  if (!targetApplicant.selectedTemplateId) {
    showPaymentToast('Select a template before assigning it to the applicant.', 'warning')
    return
  }

  const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
  if (!workspaceOwnerId) {
    showPaymentToast('Refresh the page and sign in again before assigning an assessment.', 'error')
    return
  }

  const templateSnapshot = buildAssessmentAssignmentTemplateSnapshot(targetApplicant.selectedTemplateId)
  const assignedAt = new Date().toISOString()

  try {
    await saveBusinessAssessmentAssignmentRecord({
      ...targetApplicant,
      applicationId: String(targetApplicant.applicationId || targetApplicant.id || '').trim(),
      workspaceOwnerId,
      ...templateSnapshot,
      assignmentStatus: 'Assigned',
      assessmentStatus: 'ready',
      assessmentScoreValue: 0,
      assessmentScoreLabel: 'Pending',
      correctAnswerCount: 0,
      totalQuestions: countScorableAssessmentQuestions(templateSnapshot.templateQuestions),
      assessmentResult: 'pending',
      assignedAt,
    })

    await upsertApplicantAssessmentScoreRecord({
      applicant: {
        ...targetApplicant,
        ...templateSnapshot,
        assignmentStatus: 'Assigned',
        assignedAt,
      },
      buildApplicantAssessmentScoreRecord,
    })
    showPaymentToast(`Template assigned to ${targetApplicant.name}.`, 'success')
  } catch (error) {
    showPaymentToast(getErrorMessage(error, 'Unable to assign this assessment right now.'), 'error')
  }
}

export const removeAssignedAssessmentFromApplicantProcess = async ({
  applicantId,
  approvedApplicantTemplateAssignments,
  canEditBusinessModule,
  showPaymentToast,
  findAssessmentAssignmentRecordByApplicant,
}) => {
  if (!canEditBusinessModule('assessment-management')) {
    showPaymentToast('Your role has view-only access for Assessment Management.', 'warning')
    return
  }

  const targetApplicant = approvedApplicantTemplateAssignments.value.find((applicant) => applicant.id === applicantId)
  if (!targetApplicant) {
    showPaymentToast('That assessment assignment could not be found.', 'error')
    return
  }

  const targetAssignment = findAssessmentAssignmentRecordByApplicant(targetApplicant)
  if (!targetAssignment) {
    showPaymentToast('No assigned assessment was found for this applicant.', 'warning')
    return
  }

  try {
    await deleteBusinessAssessmentAssignmentRecord(String(targetAssignment.id || targetAssignment.applicationId || '').trim())
    const targetScoreRecordId = String(
      targetAssignment.applicationId || targetAssignment.id || targetApplicant.applicationId || targetApplicant.id || '',
    ).trim()
    let scoreSyncSucceeded = true
    if (targetScoreRecordId) {
      try {
        await deleteBusinessApplicantScoreRecord(targetScoreRecordId)
      } catch {
        scoreSyncSucceeded = false
      }
    }

    showPaymentToast(
      !scoreSyncSucceeded
        ? `Assessment removed from ${targetApplicant.name}, but the score tracker will refresh on the next sync.`
        : `Assessment removed from ${targetApplicant.name}.`,
      !scoreSyncSucceeded ? 'warning' : 'success',
    )
  } catch (error) {
    showPaymentToast(getErrorMessage(error, 'Unable to remove this assessment right now.'), 'error')
  }
}
