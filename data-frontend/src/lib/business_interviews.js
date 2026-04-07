import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase'

export const BUSINESS_INTERVIEW_SCHEDULES_COLLECTION = 'business_interview_schedules'

const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizeTimestampArray = (value) => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((entry) => timestampText(entry)).filter(Boolean))]
}
const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)]),
  )
}
const nowIso = () => new Date().toISOString()
const parseInterviewRecordTimestamp = (value) => {
  const parsedValue = Date.parse(String(value || '').trim())
  return Number.isFinite(parsedValue) ? parsedValue : 0
}
const getInterviewRecordActivityTime = (record = {}) =>
  Math.max(
    parseInterviewRecordTimestamp(record?.updatedAt),
    parseInterviewRecordTimestamp(record?.updated_at),
    parseInterviewRecordTimestamp(record?.applicantRespondedAt),
    parseInterviewRecordTimestamp(record?.applicant_responded_at),
    parseInterviewRecordTimestamp(record?.businessDecidedAt),
    parseInterviewRecordTimestamp(record?.business_decided_at),
    parseInterviewRecordTimestamp(record?.scheduledAt),
    parseInterviewRecordTimestamp(record?.scheduled_at),
    parseInterviewRecordTimestamp(record?.createdAt),
    parseInterviewRecordTimestamp(record?.created_at),
  )
const sortBusinessInterviewRows = (rows = []) =>
  [...rows].sort((left, right) => getInterviewRecordActivityTime(right) - getInterviewRecordActivityTime(left))
const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}

const createInterviewScheduleId = ({ applicationId, scheduledAt, workspaceOwnerId }) => {
  const normalizedApplicationId = text(applicationId).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
  const normalizedScheduledAt = text(scheduledAt).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
  return `${normalizedWorkspaceOwnerId}__${normalizedApplicationId}__${normalizedScheduledAt || Date.now()}`
}

export const normalizeBusinessInterviewScheduleRecord = (record = {}) => ({
  id: text(record.id),
  workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
  workspaceOwnerName: text(record.workspaceOwnerName || record.workspace_owner_name || record.companyName || record.company_name),
  workspaceOwnerEmail: normalizeEmail(record.workspaceOwnerEmail || record.workspace_owner_email),
  applicationId: text(record.applicationId || record.application_id),
  applicantId: text(record.applicantId || record.applicant_id),
  applicantName: text(record.applicantName || record.applicant_name),
  applicantEmail: normalizeEmail(record.applicantEmail || record.applicant_email),
  applicantAvatar: text(record.applicantAvatar || record.applicant_avatar || record.avatar || record.avatar_url),
  jobId: text(record.jobId || record.job_id),
  jobTitle: text(record.jobTitle || record.job_title),
  interviewType: text(record.interviewType || record.interview_type || 'interview') || 'interview',
  scheduledAt: timestampText(record.scheduledAt || record.scheduled_at),
  mode: text(record.mode || 'in-person') || 'in-person',
  locationOrLink: text(record.locationOrLink || record.location_or_link),
  interviewer: text(record.interviewer),
  notes: text(record.notes),
  scheduleStatus: text(record.scheduleStatus || record.schedule_status || 'scheduled') || 'scheduled',
  applicantResponseStatus: text(record.applicantResponseStatus || record.applicant_response_status || 'pending') || 'pending',
  applicantResponseReason: text(record.applicantResponseReason || record.applicant_response_reason || record.rescheduleReason || record.reschedule_reason),
  requestedScheduleAt: timestampText(record.requestedScheduleAt || record.requested_schedule_at),
  applicantRespondedAt: timestampText(record.applicantRespondedAt || record.applicant_responded_at),
  businessDecisionReason: text(record.businessDecisionReason || record.business_decision_reason),
  businessDecidedAt: timestampText(record.businessDecidedAt || record.business_decided_at),
  availableScheduleOptions: normalizeTimestampArray(record.availableScheduleOptions || record.available_schedule_options),
  createdAt: timestampText(record.createdAt || record.created_at),
  updatedAt: timestampText(record.updatedAt || record.updated_at),
})

export const saveBusinessInterviewSchedule = async (payload = {}) => {
  const normalized = normalizeBusinessInterviewScheduleRecord(payload)
  if (!normalized.workspaceOwnerId || !normalized.applicationId || !normalized.applicantId || !normalized.jobId) {
    throw new Error('Missing business, application, applicant, or job details for the interview schedule.')
  }

  const documentId = text(payload.id) || createInterviewScheduleId(normalized)
  const docRef = doc(db, BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, documentId)

  await setDoc(docRef, stripUndefined({
    workspace_owner_id: normalized.workspaceOwnerId,
    workspace_owner_name: normalized.workspaceOwnerName,
    workspace_owner_email: normalized.workspaceOwnerEmail,
    application_id: normalized.applicationId,
    applicant_id: normalized.applicantId,
    applicant_name: normalized.applicantName,
    applicant_email: normalized.applicantEmail,
    applicant_avatar: normalized.applicantAvatar,
    job_id: normalized.jobId,
    job_title: normalized.jobTitle,
    interview_type: normalized.interviewType,
    scheduled_at: normalized.scheduledAt,
    mode: normalized.mode,
    location_or_link: normalized.locationOrLink,
    interviewer: normalized.interviewer,
    notes: normalized.notes,
    schedule_status: normalized.scheduleStatus,
    applicant_response_status: normalized.applicantResponseStatus,
    applicant_response_reason: normalized.applicantResponseReason,
    requested_schedule_at: normalized.requestedScheduleAt,
    applicant_responded_at: normalized.applicantRespondedAt,
    business_decision_reason: normalized.businessDecisionReason,
    business_decided_at: normalized.businessDecidedAt,
    available_schedule_options: normalized.availableScheduleOptions,
    created_at: normalized.createdAt || nowIso(),
    created_at_server: normalized.createdAt ? undefined : serverTimestamp(),
    updated_at: nowIso(),
    updated_at_server: serverTimestamp(),
  }), { merge: true })

  return {
    ...normalized,
    id: documentId,
  }
}

export const subscribeToBusinessInterviewSchedules = (workspaceOwnerId, handleNext, handleError) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  return onSnapshot(
    query(
      collection(db, BUSINESS_INTERVIEW_SCHEDULES_COLLECTION),
      where('workspace_owner_id', '==', normalizedWorkspaceOwnerId),
    ),
    (snapshot) => {
      const rows = sortBusinessInterviewRows(snapshot.docs.map((entry) => normalizeBusinessInterviewScheduleRecord({
        id: entry.id,
        ...entry.data(),
      })))
      if (typeof handleNext === 'function') handleNext(rows)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )
}

export const subscribeToApplicantInterviewSchedules = (options = {}, handleNext, handleError) => {
  const normalizedApplicantId = text(options?.applicantId)
  const normalizedApplicantEmail = normalizeEmail(options?.applicantEmail)
  const normalizedApplicationIds = [...new Set(
    (Array.isArray(options?.applicationIds) ? options.applicationIds : [])
      .map((value) => text(value))
      .filter(Boolean),
  )]

  if (!normalizedApplicantId && !normalizedApplicantEmail && !normalizedApplicationIds.length) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  const recordsByKey = new Map()
  const emitRecords = () => {
    const mergedRecords = new Map()

    recordsByKey.forEach((record) => {
      const recordKey = text(record?.id) || [
        text(record?.applicationId),
        text(record?.interviewType),
        text(record?.scheduledAt),
      ].filter(Boolean).join(':')
      if (!recordKey) return

      const existingRecord = mergedRecords.get(recordKey)
      if (!existingRecord || getInterviewRecordActivityTime(record) >= getInterviewRecordActivityTime(existingRecord)) {
        mergedRecords.set(recordKey, record)
      }
    })

    const rows = sortBusinessInterviewRows([...mergedRecords.values()])

    if (typeof handleNext === 'function') handleNext(rows)
  }

  const syncSnapshot = (sourceKey, snapshot) => {
    const activeKeys = new Set()

    snapshot.docs.forEach((entry) => {
      const record = normalizeBusinessInterviewScheduleRecord({
        id: entry.id,
        ...entry.data(),
      })
      const compositeKey = `${sourceKey}:${entry.id}`
      activeKeys.add(compositeKey)
      recordsByKey.set(compositeKey, record)
    })

    for (const key of [...recordsByKey.keys()]) {
      if (key.startsWith(`${sourceKey}:`) && !activeKeys.has(key)) {
        recordsByKey.delete(key)
      }
    }

    emitRecords()
  }

  const stopHandlers = []

  if (normalizedApplicantId) {
    stopHandlers.push(onSnapshot(
      query(collection(db, BUSINESS_INTERVIEW_SCHEDULES_COLLECTION), where('applicant_id', '==', normalizedApplicantId)),
      (snapshot) => syncSnapshot('applicant-id', snapshot),
      (error) => {
        if (typeof handleError === 'function') handleError(error)
      },
    ))
  }

  if (normalizedApplicantEmail) {
    stopHandlers.push(onSnapshot(
      query(collection(db, BUSINESS_INTERVIEW_SCHEDULES_COLLECTION), where('applicant_email', '==', normalizedApplicantEmail)),
      (snapshot) => syncSnapshot('applicant-email', snapshot),
      (error) => {
        if (typeof handleError === 'function') handleError(error)
      },
    ))
  }

  normalizedApplicationIds.forEach((applicationId) => {
    stopHandlers.push(onSnapshot(
      query(collection(db, BUSINESS_INTERVIEW_SCHEDULES_COLLECTION), where('application_id', '==', applicationId)),
      (snapshot) => syncSnapshot(`application-id:${applicationId}`, snapshot),
      (error) => {
        if (typeof handleError === 'function') handleError(error)
      },
    ))
  })

  return () => {
    stopHandlers.forEach((stop) => {
      if (typeof stop === 'function') stop()
    })
  }
}
