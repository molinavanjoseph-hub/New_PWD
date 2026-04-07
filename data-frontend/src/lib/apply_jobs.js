import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const APPLY_JOBS_COLLECTION = 'apply_jobs'

const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)]),
  )
}
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)
const nowIso = () => new Date().toISOString()
const uniqueTextValues = (values = []) => [...new Set(values.map((value) => text(value)).filter(Boolean))]
const uniqueEmailValues = (values = []) => [...new Set(values.map((value) => normalizeEmail(value)).filter(Boolean))]
const resolveAuthorizedUserIds = (fallbackValues = []) => {
  const authUid = text(auth.currentUser?.uid)
  return authUid ? [authUid] : uniqueTextValues(fallbackValues)
}
const resolveAuthorizedEmails = (fallbackValues = []) => {
  const authEmail = normalizeEmail(auth.currentUser?.email)
  return authEmail ? [authEmail] : uniqueEmailValues(fallbackValues)
}
const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}
const cloneJson = (value) => JSON.parse(JSON.stringify(value))
const waitForAuthReady = () =>
  typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()
const isPermissionDeniedError = (error) => {
  const code = text(error?.code).toLowerCase()
  const message = text(error?.message).toLowerCase()
  return code.includes('permission-denied') || message.includes('missing or insufficient permissions')
}
const toApplicationError = (error, fallback = 'Unable to send your application right now.') => {
  if (isPermissionDeniedError(error)) {
    return new Error('Job applications are blocked by Firestore permissions right now. Please try again in a moment.')
  }

  return error instanceof Error ? error : new Error(fallback)
}

const buildApplyJobId = ({ jobId, applicantId }) => {
  const normalizedJobId = text(jobId).replace(/[^a-z0-9_-]+/gi, '-')
  const normalizedApplicantId = text(applicantId).replace(/[^a-z0-9_-]+/gi, '-')
  return `${normalizedJobId}__${normalizedApplicantId}`
}
const normalizeTextArray = (value) => {
  if (Array.isArray(value)) return value.map((entry) => text(entry)).filter(Boolean)
  return text(value) ? [text(value)] : []
}

const normalizeApplyJobRecord = (record = {}) => ({
  id: text(record.id),
  jobId: text(record.jobId || record.job_id),
  jobTitle: text(record.jobTitle || record.job_title || record.title),
  companyName: text(record.companyName || record.company_name),
  businessName: text(record.businessName || record.business_name || record.companyName || record.company_name),
  workplace: text(record.workplace || record.location || record.job_location),
  jobType: text(record.jobType || record.job_type || record.type),
  jobCategory: text(record.jobCategory || record.job_category || record.category || record?.job_snapshot?.category),
  salaryRange: text(record.salaryRange || record.salary_range || record.salary || record?.job_snapshot?.salary_range),
  jobDisabilityType: text(
    record.jobDisabilityType || record.job_disability_type || record.disabilityType || record?.job_snapshot?.disability_type,
  ),
  jobSetup: text(record.jobSetup || record.job_setup || record.setup || record?.job_snapshot?.setup),
  jobQualifications: normalizeTextArray(record.jobQualifications || record.qualifications || record?.job_snapshot?.qualifications),
  jobResponsibilities: normalizeTextArray(record.jobResponsibilities || record.responsibilities || record?.job_snapshot?.responsibilities),
  jobSnapshot: record?.jobSnapshot || record?.job_snapshot ? cloneJson(record.jobSnapshot || record.job_snapshot) : null,
  workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
  workspaceOwnerEmail: normalizeEmail(record.workspaceOwnerEmail || record.workspace_owner_email),
  workspaceOwnerName: text(record.workspaceOwnerName || record.workspace_owner_name || record.businessName || record.business_name),
  applicantId: text(record.applicantId || record.applicant_id || record.userId || record.user_id),
  applicantEmail: normalizeEmail(record.applicantEmail || record.applicant_email || record.email),
  applicantName: text(record.applicantName || record.applicant_name || record.name),
  applicantAvatar: text(record.applicantAvatar || record.applicant_avatar || record.avatar || record.avatar_url),
  applicantRole: text(record.applicantRole || record.applicant_role || record.role || 'Applicant'),
  applicantDisability: text(record.applicantDisability || record.applicant_disability || record.disability_type),
  applicantBarangay: text(record.applicantBarangay || record.applicant_barangay || record.address_barangay),
  applicantLanguage: text(record.applicantLanguage || record.applicant_language || record.preferred_language),
  applicantContactNumber: text(record.applicantContactNumber || record.applicant_contact_number || record.contact_number),
  applicantSex: text(record.applicantSex || record.applicant_sex || record.sex),
  applicantAge: text(record.applicantAge || record.applicant_age || record.age),
  applicantBirthDate: text(record.applicantBirthDate || record.applicant_birth_date || record.birth_date),
  applicantCity: text(record.applicantCity || record.applicant_city || record.address_city),
  applicantProvince: text(record.applicantProvince || record.applicant_province || record.address_province),
  applicantPresentAddress: text(record.applicantPresentAddress || record.applicant_present_address || record.present_address),
  applicantProvincialAddress: text(record.applicantProvincialAddress || record.applicant_provincial_address || record.provincial_address),
  applicantPwdId: text(record.applicantPwdId || record.applicant_pwd_id || record.pwd_id_number),
  applicantResumeUrl: text(
    record.applicantResumeUrl
      || record.applicant_resume_url
      || record.resumeUrl
      || record.resume_url
      || record?.applicant_profile_snapshot?.resume_url,
  ),
  applicantResumePath: text(
    record.applicantResumePath
      || record.applicant_resume_path
      || record.resumePath
      || record.resume_path
      || record?.applicant_profile_snapshot?.resume_path,
  ),
  applicantResumeFileName: text(
    record.applicantResumeFileName
      || record.applicant_resume_file_name
      || record.resumeFileName
      || record.resume_file_name
      || record?.applicant_profile_snapshot?.resume_file_name,
  ),
  interviewSchedule: text(record.interviewSchedule || record.interview_schedule),
  interviewDate: text(record.interviewDate || record.interview_date),
  interviewType: text(record.interviewType || record.interview_type || 'initial') || 'initial',
  interviewer: text(record.interviewer),
  interviewMode: text(record.interviewMode || record.interview_mode),
  interviewLocationOrLink: text(record.interviewLocationOrLink || record.interview_location_or_link),
  interviewNotes: text(record.interviewNotes || record.interview_notes),
  interviewResponseStatus: text(record.interviewResponseStatus || record.interview_response_status),
  interviewRescheduleReason: text(record.interviewRescheduleReason || record.interview_reschedule_reason),
  interviewRequestedScheduleAt: text(record.interviewRequestedScheduleAt || record.interview_requested_schedule_at),
  interviewDecisionReason: text(record.interviewDecisionReason || record.interview_decision_reason),
  interviewRespondedAt: text(record.interviewRespondedAt || record.interview_responded_at),
  interviewDecidedAt: text(record.interviewDecidedAt || record.interview_decided_at),
  interviewScheduleOptions: normalizeTextArray(record.interviewScheduleOptions || record.interview_schedule_options),
  technicalAssessmentStatus: text(record.technicalAssessmentStatus || record.technical_assessment_status),
  technicalAssessmentResult: text(record.technicalAssessmentResult || record.technical_assessment_result),
  technicalAssessmentScoreValue: Number(record.technicalAssessmentScoreValue ?? record.technical_assessment_score_value ?? 0) || 0,
  technicalAssessmentScoreLabel: text(record.technicalAssessmentScoreLabel || record.technical_assessment_score_label),
  technicalAssessmentSubmittedAt: text(record.technicalAssessmentSubmittedAt || record.technical_assessment_submitted_at),
  jobOfferId: text(record.jobOfferId || record.job_offer_id || record.offerId || record.offer_id),
  jobOfferStatus: text(record.jobOfferStatus || record.job_offer_status || record.offerStatus || record.offer_status),
  jobOfferTitle: text(record.jobOfferTitle || record.job_offer_title || record.offerTitle || record.offer_title),
  jobOfferLetter: text(record.jobOfferLetter || record.job_offer_letter || record.offerLetter || record.offer_letter),
  jobOfferCompensation: text(
    record.jobOfferCompensation || record.job_offer_compensation || record.compensation || record.salary || record.salary_range,
  ),
  jobOfferStartDate: text(record.jobOfferStartDate || record.job_offer_start_date || record.startDate || record.start_date),
  jobOfferResponseDeadline: text(
    record.jobOfferResponseDeadline || record.job_offer_response_deadline || record.responseDeadline || record.response_deadline,
  ),
  jobOfferInterviewType: text(
    record.jobOfferInterviewType || record.job_offer_interview_type || record.offerInterviewType || record.offer_interview_type || 'initial',
  ) || 'initial',
  jobOfferSentAt: timestampText(record.jobOfferSentAt || record.job_offer_sent_at || record.sentAt || record.sent_at),
  jobOfferCreatedAt: timestampText(
    record.jobOfferCreatedAt || record.job_offer_created_at || record.offerCreatedAt || record.offer_created_at,
  ),
  jobOfferUpdatedAt: timestampText(
    record.jobOfferUpdatedAt || record.job_offer_updated_at || record.offerUpdatedAt || record.offer_updated_at,
  ),
  jobOfferApplicantRespondedAt: timestampText(
    record.jobOfferApplicantRespondedAt
      || record.job_offer_applicant_responded_at
      || record.applicantRespondedAt
      || record.applicant_responded_at,
  ),
  jobOfferApplicantResponseNote: text(
    record.jobOfferApplicantResponseNote
      || record.job_offer_applicant_response_note
      || record.applicantResponseNote
      || record.applicant_response_note,
  ),
  rejectionReason: text(record.rejectionReason || record.rejection_reason),
  reviewedBy: text(record.reviewedBy || record.reviewed_by),
  reviewedByName: text(record.reviewedByName || record.reviewed_by_name),
  status: text(record.status || record.application_status || 'pending') || 'pending',
  appliedAt:
    timestampText(record.applied_at_server)
    || timestampText(record.appliedAt)
    || text(record.applied_at)
    || timestampText(record.submittedAt)
    || text(record.submitted_at)
    || timestampText(record.createdAt)
    || text(record.created_at),
  createdAt:
    timestampText(record.created_at_server)
    || timestampText(record.createdAt)
    || text(record.created_at),
  updatedAt:
    timestampText(record.updated_at_server)
    || timestampText(record.updatedAt)
    || text(record.updated_at),
  statusUpdatedAt:
    timestampText(record.status_updated_at_server)
    || timestampText(record.statusUpdatedAt)
    || text(record.status_updated_at),
  reviewedAt:
    timestampText(record.reviewed_at_server)
    || timestampText(record.reviewedAt)
    || text(record.reviewed_at),
  approvedAt:
    timestampText(record.approved_at_server)
    || timestampText(record.approvedAt)
    || text(record.approved_at),
  rejectedAt:
    timestampText(record.rejected_at_server)
    || timestampText(record.rejectedAt)
    || text(record.rejected_at),
})
const sortApplicationsByRecent = (records = []) =>
  [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.appliedAt || left?.createdAt || '') || 0
    const rightTime = Date.parse(right?.appliedAt || right?.createdAt || '') || 0
    return rightTime - leftTime
  })
const getApplicationRecordActivityTime = (record = {}) =>
  Date.parse(record?.statusUpdatedAt || record?.updatedAt || record?.appliedAt || record?.createdAt || '') || 0
const buildApplicationJobSnapshot = (record = {}) =>
  stripUndefined({
    id: text(record.jobId || record.job_id),
    title: text(record.jobTitle || record.job_title),
    company_name: text(record.companyName || record.company_name || record.businessName || record.business_name),
    business_name: text(record.businessName || record.business_name || record.companyName || record.company_name),
    location: text(record.workplace || record.location || record.job_location),
    job_type: text(record.jobType || record.job_type || record.type),
    category: text(record.jobCategory || record.category),
    salary_range: text(record.salaryRange || record.salary_range || record.salary),
    disability_type: text(record.jobDisabilityType || record.disabilityType || record.disability_type),
    setup: text(record.jobSetup || record.setup),
    vacancies: Number(record.jobVacancies || record.vacancies || 0) || undefined,
    qualifications: normalizeTextArray(record.jobQualifications || record.qualifications),
    responsibilities: normalizeTextArray(record.jobResponsibilities || record.responsibilities),
  })
const buildApplicationApplicantSnapshot = (record = {}) =>
  stripUndefined({
    uid: text(record.applicantId || record.applicant_id),
    email: normalizeEmail(record.applicantEmail || record.applicant_email),
    name: text(record.applicantName || record.applicant_name),
    avatar: text(record.applicantAvatar || record.applicant_avatar),
    role: text(record.applicantRole || record.applicant_role || 'Applicant'),
    disability_type: text(record.applicantDisability || record.applicant_disability),
    barangay: text(record.applicantBarangay || record.applicant_barangay),
    preferred_language: text(record.applicantLanguage || record.applicant_language),
    contact_number: text(record.applicantContactNumber || record.applicant_contact_number),
    sex: text(record.applicantSex || record.applicant_sex),
    age: text(record.applicantAge || record.applicant_age),
    birth_date: text(record.applicantBirthDate || record.applicant_birth_date),
    city: text(record.applicantCity || record.applicant_city),
    province: text(record.applicantProvince || record.applicant_province),
    present_address: text(record.applicantPresentAddress || record.applicant_present_address),
    provincial_address: text(record.applicantProvincialAddress || record.applicant_provincial_address),
    pwd_id: text(record.applicantPwdId || record.applicant_pwd_id),
    resume_url: text(record.applicantResumeUrl || record.applicant_resume_url),
    resume_path: text(record.applicantResumePath || record.applicant_resume_path),
    resume_file_name: text(record.applicantResumeFileName || record.applicant_resume_file_name),
  })
const buildApplicationWorkspaceSnapshot = (record = {}) =>
  stripUndefined({
    owner_id: text(record.workspaceOwnerId || record.workspace_owner_id),
    owner_email: normalizeEmail(record.workspaceOwnerEmail || record.workspace_owner_email),
    owner_name: text(record.workspaceOwnerName || record.workspace_owner_name),
  })

export const saveApplicantJobApplication = async (payload = {}) => {
  await waitForAuthReady()

  const firebaseAuthUid = text(auth.currentUser?.uid)
  const firebaseAuthEmail = normalizeEmail(auth.currentUser?.email)
  const normalizedRecord = normalizeApplyJobRecord({
    ...payload,
    applicantId: firebaseAuthUid || payload?.applicantId || payload?.applicant_id,
    applicantEmail: firebaseAuthEmail || payload?.applicantEmail || payload?.applicant_email,
  })
  const initialStatus = 'pending'
  if (!normalizedRecord.jobId || !normalizedRecord.applicantId || !normalizedRecord.workspaceOwnerId) {
    throw new Error('Missing job, applicant, or business owner information for this application.')
  }

  const documentId = text(payload.id) || buildApplyJobId({
    jobId: normalizedRecord.jobId,
    applicantId: normalizedRecord.applicantId,
  })

  const docRef = doc(db, APPLY_JOBS_COLLECTION, documentId)
  let existingSnapshot
  try {
    existingSnapshot = await getDoc(docRef)
  } catch (error) {
    throw toApplicationError(error)
  }

  if (existingSnapshot.exists()) {
    const existingRecord = normalizeApplyJobRecord({
      id: existingSnapshot.id,
      ...existingSnapshot.data(),
    })
    const existingStatus = text(existingRecord.status || 'pending') || 'pending'
    const formattedStatus = existingStatus
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

    throw new Error(`You already applied to this job. Current status: ${formattedStatus}.`)
  }

  try {
    await setDoc(docRef, stripUndefined({
      job_id: normalizedRecord.jobId,
      job_title: normalizedRecord.jobTitle,
      company_name: normalizedRecord.companyName || normalizedRecord.businessName,
      business_name: normalizedRecord.businessName || normalizedRecord.companyName,
      location: normalizedRecord.workplace,
      job_type: normalizedRecord.jobType,
      workspace_owner_id: normalizedRecord.workspaceOwnerId,
      workspace_owner_email: normalizedRecord.workspaceOwnerEmail,
      workspace_owner_name: normalizedRecord.workspaceOwnerName,
      applicant_id: normalizedRecord.applicantId,
      applicant_email: normalizedRecord.applicantEmail,
      applicant_name: normalizedRecord.applicantName,
      applicant_avatar: normalizedRecord.applicantAvatar,
      applicant_role: normalizedRecord.applicantRole || 'Applicant',
      applicant_disability: normalizedRecord.applicantDisability,
      applicant_barangay: normalizedRecord.applicantBarangay,
      applicant_language: normalizedRecord.applicantLanguage,
      applicant_contact_number: normalizedRecord.applicantContactNumber,
      applicant_sex: normalizedRecord.applicantSex,
      applicant_age: normalizedRecord.applicantAge,
      applicant_birth_date: normalizedRecord.applicantBirthDate,
      applicant_city: normalizedRecord.applicantCity,
      applicant_province: normalizedRecord.applicantProvince,
      applicant_present_address: normalizedRecord.applicantPresentAddress,
      applicant_provincial_address: normalizedRecord.applicantProvincialAddress,
      applicant_pwd_id: normalizedRecord.applicantPwdId,
      applicant_resume_url: normalizedRecord.applicantResumeUrl,
      applicant_resume_path: normalizedRecord.applicantResumePath,
      applicant_resume_file_name: normalizedRecord.applicantResumeFileName,
      job_snapshot: buildApplicationJobSnapshot(payload),
      applicant_profile_snapshot: buildApplicationApplicantSnapshot(normalizedRecord),
      workspace_owner_snapshot: buildApplicationWorkspaceSnapshot(normalizedRecord),
      application_status: initialStatus,
      rejection_reason: '',
      applied_at: normalizedRecord.appliedAt || nowIso(),
      applied_at_server: normalizedRecord.appliedAt ? undefined : serverTimestamp(),
      created_at: normalizedRecord.createdAt || nowIso(),
      created_at_server: normalizedRecord.createdAt ? undefined : serverTimestamp(),
      updated_at: nowIso(),
      updated_at_server: serverTimestamp(),
      status_updated_at: nowIso(),
      status_updated_at_server: serverTimestamp(),
    }), { merge: true })
  } catch (error) {
    throw toApplicationError(error)
  }

  return {
    ...normalizedRecord,
    id: documentId,
    status: initialStatus,
  }
}

export const subscribeToBusinessJobApplications = (workspaceOwnerId, handleNext, handleError) => {
  let isClosed = false
  const stopHandlers = []
  const recordsBySource = new Map()
  const emitRecords = () => {
    if (isClosed || typeof handleNext !== 'function') return

    const mergedRecords = new Map()
    recordsBySource.forEach((sourceRecords) => {
      sourceRecords.forEach((record, recordId) => {
        const currentRecord = mergedRecords.get(recordId)
        if (!currentRecord || getApplicationRecordActivityTime(record) >= getApplicationRecordActivityTime(currentRecord)) {
          mergedRecords.set(recordId, record)
        }
      })
    })

    handleNext(sortApplicationsByRecent([...mergedRecords.values()]))
  }
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }
  const syncSnapshot = (sourceKey, snapshot) => {
    const sourceRecords = new Map()
    snapshot.docs.forEach((entry) => {
      sourceRecords.set(entry.id, normalizeApplyJobRecord({
        id: entry.id,
        ...entry.data(),
      }))
    })
    recordsBySource.set(sourceKey, sourceRecords)
    emitRecords()
  }

  void waitForAuthReady()
    .then(() => {
      if (isClosed) return

      const workspaceOwnerIds = resolveAuthorizedUserIds([workspaceOwnerId])
      if (!workspaceOwnerIds.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      workspaceOwnerIds.forEach((ownerId) => {
        const sourceKey = `workspace-owner:${ownerId}`
        stopHandlers.push(onSnapshot(
          query(
            collection(db, APPLY_JOBS_COLLECTION),
            where('workspace_owner_id', '==', ownerId),
          ),
          (snapshot) => syncSnapshot(sourceKey, snapshot),
          reportError,
        ))
      })
    })
    .catch(reportError)

  return () => {
    isClosed = true
    stopHandlers.forEach((stop) => {
      if (typeof stop === 'function') stop()
    })
  }
}

export const subscribeToApplicantJobApplications = (options = {}, handleNext, handleError) => {
  let isClosed = false
  const recordsBySource = new Map()
  const emitRecords = () => {
    if (isClosed || typeof handleNext !== 'function') return

    const mergedRecords = new Map()
    recordsBySource.forEach((sourceRecords) => {
      sourceRecords.forEach((record, recordId) => {
        const currentRecord = mergedRecords.get(recordId)
        if (!currentRecord || getApplicationRecordActivityTime(record) >= getApplicationRecordActivityTime(currentRecord)) {
          mergedRecords.set(recordId, record)
        }
      })
    })

    handleNext(sortApplicationsByRecent([...mergedRecords.values()]))
  }

  const syncSnapshot = (sourceKey, snapshot) => {
    const sourceRecords = new Map()
    snapshot.docs.forEach((entry) => {
      sourceRecords.set(entry.id, normalizeApplyJobRecord({
        id: entry.id,
        ...entry.data(),
      }))
    })
    recordsBySource.set(sourceKey, sourceRecords)
    emitRecords()
  }
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }

  const stopHandlers = []
  void waitForAuthReady()
    .then(() => {
      if (isClosed) return

      const applicantIds = resolveAuthorizedUserIds([options?.applicantId])
      const applicantEmails = resolveAuthorizedEmails([options?.applicantEmail])
      if (!applicantIds.length && !applicantEmails.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      applicantIds.forEach((applicantId) => {
        const sourceKey = `applicant-id:${applicantId}`
        stopHandlers.push(onSnapshot(
          query(collection(db, APPLY_JOBS_COLLECTION), where('applicant_id', '==', applicantId)),
          (snapshot) => syncSnapshot(sourceKey, snapshot),
          reportError,
        ))
      })

      applicantEmails.forEach((applicantEmail) => {
        const sourceKey = `applicant-email:${applicantEmail}`
        stopHandlers.push(onSnapshot(
          query(collection(db, APPLY_JOBS_COLLECTION), where('applicant_email', '==', applicantEmail)),
          (snapshot) => syncSnapshot(sourceKey, snapshot),
          reportError,
        ))
      })
    })
    .catch(reportError)

  return () => {
    isClosed = true
    stopHandlers.forEach((stop) => {
      if (typeof stop === 'function') stop()
    })
  }
}

export const updateApplicantJobApplicationStatus = async (applicationId, payload = {}) => {
  await waitForAuthReady()

  const normalizedApplicationId = text(applicationId)
  if (!normalizedApplicationId) {
    throw new Error('Missing application ID for status update.')
  }

  const hasStatus = hasOwn(payload, 'status') || hasOwn(payload, 'application_status')
  const nextStatus = hasStatus
    ? text(payload.status || payload.application_status || 'pending') || 'pending'
    : ''
  const rejectionReason = text(payload.rejectionReason || payload.rejection_reason)
  if (hasStatus && nextStatus === 'rejected' && !rejectionReason) {
    throw new Error('A rejection reason is required before rejecting this application.')
  }

  const getOptionalText = (...keys) => {
    for (const key of keys) {
      if (hasOwn(payload, key)) return text(payload[key])
    }

    return undefined
  }
  const getOptionalTextArray = (...keys) => {
    for (const key of keys) {
      if (hasOwn(payload, key)) return normalizeTextArray(payload[key])
    }

    return undefined
  }
  const getOptionalNumber = (...keys) => {
    for (const key of keys) {
      if (hasOwn(payload, key)) {
        const parsedValue = Number(payload[key])
        return Number.isFinite(parsedValue) ? parsedValue : 0
      }
    }

    return undefined
  }

  const docRef = doc(db, APPLY_JOBS_COLLECTION, normalizedApplicationId)
  try {
    await setDoc(docRef, stripUndefined({
      application_status: hasStatus ? nextStatus : undefined,
      interview_schedule: getOptionalText('interviewSchedule', 'interview_schedule'),
      interview_date: getOptionalText('interviewDate', 'interview_date'),
      interview_type: getOptionalText('interviewType', 'interview_type'),
      interviewer: getOptionalText('interviewer'),
      interview_mode: getOptionalText('interviewMode', 'interview_mode'),
      interview_location_or_link: getOptionalText('interviewLocationOrLink', 'interview_location_or_link'),
      interview_notes: getOptionalText('interviewNotes', 'interview_notes'),
      interview_response_status: getOptionalText('interviewResponseStatus', 'interview_response_status'),
      interview_reschedule_reason: getOptionalText('interviewRescheduleReason', 'interview_reschedule_reason'),
      interview_requested_schedule_at: getOptionalText('interviewRequestedScheduleAt', 'interview_requested_schedule_at'),
      interview_decision_reason: getOptionalText('interviewDecisionReason', 'interview_decision_reason'),
      interview_responded_at: getOptionalText('interviewRespondedAt', 'interview_responded_at'),
      interview_decided_at: getOptionalText('interviewDecidedAt', 'interview_decided_at'),
      interview_schedule_options: getOptionalTextArray('interviewScheduleOptions', 'interview_schedule_options'),
      job_offer_id: getOptionalText('jobOfferId', 'job_offer_id'),
      job_offer_status: getOptionalText('jobOfferStatus', 'job_offer_status'),
      job_offer_title: getOptionalText('jobOfferTitle', 'job_offer_title'),
      job_offer_letter: getOptionalText('jobOfferLetter', 'job_offer_letter'),
      job_offer_compensation: getOptionalText('jobOfferCompensation', 'job_offer_compensation'),
      job_offer_start_date: getOptionalText('jobOfferStartDate', 'job_offer_start_date'),
      job_offer_response_deadline: getOptionalText('jobOfferResponseDeadline', 'job_offer_response_deadline'),
      job_offer_interview_type: getOptionalText('jobOfferInterviewType', 'job_offer_interview_type'),
      job_offer_sent_at: getOptionalText('jobOfferSentAt', 'job_offer_sent_at'),
      job_offer_created_at: getOptionalText('jobOfferCreatedAt', 'job_offer_created_at'),
      job_offer_updated_at: getOptionalText('jobOfferUpdatedAt', 'job_offer_updated_at'),
      job_offer_applicant_responded_at: getOptionalText('jobOfferApplicantRespondedAt', 'job_offer_applicant_responded_at'),
      job_offer_applicant_response_note: getOptionalText('jobOfferApplicantResponseNote', 'job_offer_applicant_response_note'),
      technical_assessment_status: getOptionalText('technicalAssessmentStatus', 'technical_assessment_status'),
      technical_assessment_result: getOptionalText('technicalAssessmentResult', 'technical_assessment_result'),
      technical_assessment_score_value: getOptionalNumber('technicalAssessmentScoreValue', 'technical_assessment_score_value'),
      technical_assessment_score_label: getOptionalText('technicalAssessmentScoreLabel', 'technical_assessment_score_label'),
      technical_assessment_submitted_at: getOptionalText('technicalAssessmentSubmittedAt', 'technical_assessment_submitted_at'),
      rejection_reason: hasStatus
        ? ['rejected', 'discontinued'].includes(nextStatus)
          ? rejectionReason
          : ''
        : getOptionalText('rejectionReason', 'rejection_reason'),
      reviewed_by: getOptionalText('reviewedBy', 'reviewed_by'),
      reviewed_by_name: getOptionalText('reviewedByName', 'reviewed_by_name'),
      updated_at: nowIso(),
      updated_at_server: serverTimestamp(),
      status_updated_at: nowIso(),
      status_updated_at_server: serverTimestamp(),
      reviewed_at: hasStatus && ['approved', 'rejected', 'discontinued', 'reviewing', 'under review', 'in_review', 'interview'].includes(nextStatus)
        ? nowIso()
        : undefined,
      reviewed_at_server: hasStatus && ['approved', 'rejected', 'discontinued', 'reviewing', 'under review', 'in_review', 'interview'].includes(nextStatus)
        ? serverTimestamp()
        : undefined,
      approved_at: hasStatus ? nextStatus === 'approved' ? nowIso() : nextStatus === 'rejected' ? '' : undefined : undefined,
      approved_at_server: hasStatus && nextStatus === 'approved' ? serverTimestamp() : undefined,
      rejected_at: hasStatus ? nextStatus === 'rejected' ? nowIso() : nextStatus === 'approved' ? '' : undefined : undefined,
      rejected_at_server: hasStatus && nextStatus === 'rejected' ? serverTimestamp() : undefined,
    }), { merge: true })
  } catch (error) {
    throw toApplicationError(error, 'Unable to update this application right now.')
  }
}

export const deleteApplicantJobApplication = async (applicationId) => {
  await waitForAuthReady()

  const normalizedApplicationId = text(applicationId)
  if (!normalizedApplicationId) {
    throw new Error('Missing application ID for deletion.')
  }

  try {
    await deleteDoc(doc(db, APPLY_JOBS_COLLECTION, normalizedApplicationId))
  } catch (error) {
    throw toApplicationError(error, 'Unable to delete this application right now.')
  }

  return normalizedApplicationId
}

export const deleteApplicantJobApplications = async (applicationIds = []) => {
  await waitForAuthReady()

  const normalizedApplicationIds = uniqueTextValues(Array.isArray(applicationIds) ? applicationIds : [applicationIds])
  if (!normalizedApplicationIds.length) {
    throw new Error('Select at least one application to delete.')
  }

  if (normalizedApplicationIds.length === 1) {
    return [await deleteApplicantJobApplication(normalizedApplicationIds[0])]
  }

  try {
    for (let index = 0; index < normalizedApplicationIds.length; index += 500) {
      const batch = writeBatch(db)
      normalizedApplicationIds.slice(index, index + 500).forEach((applicationId) => {
        batch.delete(doc(db, APPLY_JOBS_COLLECTION, applicationId))
      })
      await batch.commit()
    }
  } catch (error) {
    throw toApplicationError(error, 'Unable to delete these applications right now.')
  }

  return normalizedApplicationIds
}
