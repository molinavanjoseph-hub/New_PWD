import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, cloudFunctions, db } from '@/firebase'
import { updateApplicantJobApplicationStatus } from '@/lib/apply_jobs'

export const JOB_OFFERS_COLLECTION = 'job_offers'

const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const nowIso = () => new Date().toISOString()
const waitForAuthReady = () =>
  typeof auth?.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()
const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)]),
  )
}
const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}
const uniqueTextValues = (values = []) => [...new Set(values.map((value) => text(value)).filter(Boolean))]
const uniqueEmailValues = (values = []) => [...new Set(values.map((value) => normalizeEmail(value)).filter(Boolean))]
const resolveAuthorizedUserIds = (fallbackValues = []) =>
  uniqueTextValues([text(auth.currentUser?.uid), ...fallbackValues])
const resolveAuthorizedEmails = (fallbackValues = []) =>
  uniqueEmailValues([normalizeEmail(auth.currentUser?.email), ...fallbackValues])
const parseOfferTimestamp = (value) => Date.parse(String(value || '').trim()) || 0
const getJobOfferActivityTime = (record = {}) =>
  Math.max(
    parseOfferTimestamp(record?.applicantRespondedAt),
    parseOfferTimestamp(record?.applicant_responded_at),
    parseOfferTimestamp(record?.sentAt),
    parseOfferTimestamp(record?.sent_at),
    parseOfferTimestamp(record?.updatedAt),
    parseOfferTimestamp(record?.updated_at),
    parseOfferTimestamp(record?.createdAt),
    parseOfferTimestamp(record?.created_at),
  )
const sortOffersByRecent = (records = []) =>
  [...records].sort((left, right) => getJobOfferActivityTime(right) - getJobOfferActivityTime(left))
const canUseDirectBusinessJobOfferWriteFallback = (workspaceOwnerId) => {
  const currentUid = text(auth?.currentUser?.uid)
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  return Boolean(currentUid && normalizedWorkspaceOwnerId && currentUid === normalizedWorkspaceOwnerId)
}
const shouldTryManagedJobOfferFunctionFallback = (error = {}) => {
  const code = text(error?.code).toLowerCase()
  return [
    'functions/not-found',
    'not-found',
    'functions/internal',
    'internal',
    'functions/unimplemented',
    'unimplemented',
    'functions/unavailable',
    'unavailable',
    'functions/deadline-exceeded',
    'deadline-exceeded',
    'functions/timeout',
    'timeout',
  ].includes(code)
}
const toJobOfferErrorMessage = (error, fallback) => {
  const code = text(error?.code).toLowerCase()

  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'This job offer action is blocked in Firebase right now. Deploy the updated Cloud Functions or the latest Firestore rules, then try again.'
  }

  if (code === 'unauthenticated') {
    return 'Sign in again before managing this job offer.'
  }

  if (code === 'unavailable') {
    return 'Cloud Firestore is temporarily unavailable. Try again in a moment.'
  }

  return fallback
}

export const normalizeJobOfferRecord = (record = {}) => ({
  id: text(record.id || record.offerId || record.offer_id || record.applicationId || record.application_id),
  applicationId: text(record.applicationId || record.application_id || record.id),
  workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
  workspaceOwnerName: text(record.workspaceOwnerName || record.workspace_owner_name || record.companyName || record.company_name),
  workspaceOwnerEmail: normalizeEmail(record.workspaceOwnerEmail || record.workspace_owner_email),
  applicantId: text(record.applicantId || record.applicant_id),
  applicantName: text(record.applicantName || record.applicant_name),
  applicantEmail: normalizeEmail(record.applicantEmail || record.applicant_email),
  applicantAvatar: text(record.applicantAvatar || record.applicant_avatar || record.avatar || record.avatar_url),
  jobId: text(record.jobId || record.job_id),
  jobTitle: text(record.jobTitle || record.job_title),
  interviewType: text(record.interviewType || record.interview_type || 'interview') || 'interview',
  offerTitle: text(record.offerTitle || record.offer_title),
  offerLetter: text(record.offerLetter || record.offer_letter),
  compensation: text(record.compensation || record.salary || record.salary_range),
  startDate: text(record.startDate || record.start_date),
  responseDeadline: text(record.responseDeadline || record.response_deadline),
  offerStatus: text(record.offerStatus || record.offer_status || 'sent') || 'sent',
  applicantResponseNote: text(record.applicantResponseNote || record.applicant_response_note),
  applicantRespondedAt: timestampText(record.applicantRespondedAt || record.applicant_responded_at),
  sentAt: timestampText(record.sentAt || record.sent_at),
  createdAt: timestampText(record.createdAt || record.created_at),
  updatedAt: timestampText(record.updatedAt || record.updated_at),
})

export const buildJobOfferRecordFromApplication = (record = {}) => {
  const offerStatus = text(record?.jobOfferStatus || record?.job_offer_status).toLowerCase()
  const applicationId = text(record?.id || record?.applicationId || record?.application_id)

  if (!offerStatus || !applicationId) return null

  return normalizeJobOfferRecord({
    id: text(record?.jobOfferId || record?.job_offer_id || applicationId),
    applicationId,
    workspaceOwnerId: text(record?.workspaceOwnerId || record?.workspace_owner_id),
    workspaceOwnerName: text(
      record?.workspaceOwnerName
      || record?.workspace_owner_name
      || record?.businessName
      || record?.business_name
      || record?.companyName
      || record?.company_name,
    ),
    workspaceOwnerEmail: normalizeEmail(record?.workspaceOwnerEmail || record?.workspace_owner_email),
    applicantId: text(record?.applicantId || record?.applicant_id),
    applicantName: text(record?.applicantName || record?.applicant_name),
    applicantEmail: normalizeEmail(record?.applicantEmail || record?.applicant_email),
    applicantAvatar: text(record?.applicantAvatar || record?.applicant_avatar),
    jobId: text(record?.jobId || record?.job_id),
    jobTitle: text(record?.jobTitle || record?.job_title),
    interviewType: text(
      record?.jobOfferInterviewType
      || record?.job_offer_interview_type
      || record?.interviewType
      || record?.interview_type
      || 'interview',
    ) || 'interview',
    offerTitle: text(record?.jobOfferTitle || record?.job_offer_title),
    offerLetter: text(record?.jobOfferLetter || record?.job_offer_letter),
    compensation: text(record?.jobOfferCompensation || record?.job_offer_compensation),
    startDate: text(record?.jobOfferStartDate || record?.job_offer_start_date),
    responseDeadline: text(record?.jobOfferResponseDeadline || record?.job_offer_response_deadline),
    offerStatus,
    applicantResponseNote: text(record?.jobOfferApplicantResponseNote || record?.job_offer_applicant_response_note),
    applicantRespondedAt: timestampText(
      record?.jobOfferApplicantRespondedAt || record?.job_offer_applicant_responded_at,
    ),
    sentAt: timestampText(record?.jobOfferSentAt || record?.job_offer_sent_at),
    createdAt: timestampText(
      record?.jobOfferCreatedAt || record?.job_offer_created_at || record?.createdAt || record?.created_at,
    ),
    updatedAt: timestampText(
      record?.jobOfferUpdatedAt || record?.job_offer_updated_at || record?.updatedAt || record?.updated_at,
    ),
  })
}

const buildJobOfferApplicationMirrorPayload = (record = {}) => stripUndefined({
  status: ['accepted', 'confirmed', 'signed'].includes(text(record?.offerStatus || record?.offer_status).toLowerCase())
    ? 'accepted'
    : ['declined', 'rejected', 'cancelled', 'canceled', 'expired'].includes(text(record?.offerStatus || record?.offer_status).toLowerCase())
      ? 'declined'
      : undefined,
  jobOfferId: text(record?.id || record?.offerId || record?.offer_id || record?.applicationId || record?.application_id),
  jobOfferStatus: text(record?.offerStatus || record?.offer_status),
  jobOfferTitle: text(record?.offerTitle || record?.offer_title),
  jobOfferLetter: text(record?.offerLetter || record?.offer_letter),
  jobOfferCompensation: text(record?.compensation || record?.salary || record?.salary_range),
  jobOfferStartDate: text(record?.startDate || record?.start_date),
  jobOfferResponseDeadline: text(record?.responseDeadline || record?.response_deadline),
  jobOfferInterviewType: text(record?.interviewType || record?.interview_type || 'interview') || 'interview',
  jobOfferSentAt: timestampText(record?.sentAt || record?.sent_at),
  jobOfferCreatedAt: timestampText(record?.createdAt || record?.created_at),
  jobOfferUpdatedAt: timestampText(record?.updatedAt || record?.updated_at) || nowIso(),
  jobOfferApplicantRespondedAt: timestampText(record?.applicantRespondedAt || record?.applicant_responded_at),
  jobOfferApplicantResponseNote: text(record?.applicantResponseNote || record?.applicant_response_note),
})

const syncJobOfferApplicationMirror = async (record = {}, options = {}) => {
  const applicationId = text(record?.applicationId || record?.application_id || record?.id)
  if (!applicationId) return

  try {
    await updateApplicantJobApplicationStatus(applicationId, buildJobOfferApplicationMirrorPayload(record))
  } catch (error) {
    if (options?.strict) throw error
    console.warn('[job-offers] Unable to mirror job offer fields onto the application record.', error)
  }
}

export const saveJobOfferRecord = async (payload = {}) => {
  await waitForAuthReady()

  const normalized = normalizeJobOfferRecord(payload)
  const documentId = text(payload.id || payload.offerId || payload.offer_id || normalized.applicationId)
  if (!documentId || !normalized.applicationId || !normalized.workspaceOwnerId || !normalized.applicantId || !normalized.jobId) {
    throw new Error('Missing application, business, applicant, or job details for this job offer.')
  }

  const createdAt = normalized.createdAt || nowIso()
  const updatedAt = nowIso()
  const sentAt = normalized.sentAt || (normalized.offerStatus === 'sent' ? updatedAt : '')
  const docRef = doc(db, JOB_OFFERS_COLLECTION, documentId)

  await setDoc(docRef, stripUndefined({
    application_id: normalized.applicationId,
    workspace_owner_id: normalized.workspaceOwnerId,
    workspace_owner_name: normalized.workspaceOwnerName,
    workspace_owner_email: normalized.workspaceOwnerEmail,
    applicant_id: normalized.applicantId,
    applicant_name: normalized.applicantName,
    applicant_email: normalized.applicantEmail,
    applicant_avatar: normalized.applicantAvatar,
    job_id: normalized.jobId,
    job_title: normalized.jobTitle,
    interview_type: normalized.interviewType,
    offer_title: normalized.offerTitle,
    offer_letter: normalized.offerLetter,
    compensation: normalized.compensation,
    start_date: normalized.startDate,
    response_deadline: normalized.responseDeadline,
    offer_status: normalized.offerStatus,
    applicant_response_note: normalized.applicantResponseNote,
    applicant_responded_at: normalized.applicantRespondedAt,
    sent_at: sentAt,
    created_at: createdAt,
    created_at_server: normalized.createdAt ? undefined : serverTimestamp(),
    updated_at: updatedAt,
    updated_at_server: serverTimestamp(),
  }), { merge: true })

  const savedOffer = {
    ...normalized,
    id: documentId,
    createdAt,
    updatedAt,
    sentAt,
  }

  await syncJobOfferApplicationMirror(savedOffer)

  return savedOffer
}

const saveBusinessJobOfferViaFunction = async (payload = {}) => {
  await waitForAuthReady()
  const saveBusinessJobOffer = httpsCallable(cloudFunctions, 'saveBusinessJobOffer', { timeout: 3000 })
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error('Function timeout')
      error.code = 'functions/not-found'
      reject(error)
    }, 3000)
  })

  const result = await Promise.race([
    saveBusinessJobOffer(payload),
    timeoutPromise,
  ])
  return normalizeJobOfferRecord(result?.data?.offer)
}

export const saveBusinessJobOfferRecord = async (payload = {}) => {
  const normalized = normalizeJobOfferRecord(payload)
  const workspaceOwnerId = text(payload?.workspaceOwnerId || payload?.workspace_owner_id || normalized.workspaceOwnerId)

  try {
    const savedOffer = await saveBusinessJobOfferViaFunction({
      ...payload,
      ...(workspaceOwnerId ? { workspaceOwnerId } : {}),
    })

    if (!savedOffer?.id || !savedOffer?.applicationId) {
      throw new Error('The job offer was saved, but no updated job offer data was returned.')
    }

    await syncJobOfferApplicationMirror(savedOffer)
    return savedOffer
  } catch (functionError) {
    const functionCode = text(functionError?.code).toLowerCase()

    if (functionCode === 'functions/unauthenticated') {
      throw new Error('Sign in again before sending this job offer.')
    }

    if (functionCode === 'functions/permission-denied') {
      throw new Error(text(functionError?.message) || 'Your account is not allowed to send this job offer.')
    }

    if (shouldTryManagedJobOfferFunctionFallback(functionError)) {
      if (!canUseDirectBusinessJobOfferWriteFallback(workspaceOwnerId)) {
        throw new Error(
          'This employee job offer action requires the deployed saveBusinessJobOffer Firebase function so workspace members can issue offers safely.',
        )
      }

      try {
        const savedOffer = await saveJobOfferRecord(payload)
        return savedOffer
      } catch (firestoreError) {
        throw new Error(
          toJobOfferErrorMessage(firestoreError, 'Unable to send this job offer right now.'),
        )
      }
    }

    throw new Error(
      toJobOfferErrorMessage(
        functionError,
        text(functionError?.message) || 'Unable to send this job offer right now.',
      ),
    )
  }
}

export const subscribeToBusinessJobOffers = (workspaceOwnerOptions, handleNext, handleError) => {
  let isClosed = false
  const stopHandlers = []
  const recordsBySource = new Map()
  const options = workspaceOwnerOptions && typeof workspaceOwnerOptions === 'object'
    ? workspaceOwnerOptions
    : { workspaceOwnerId: workspaceOwnerOptions }
  const emitRecords = () => {
    if (isClosed || typeof handleNext !== 'function') return

    const mergedRecords = new Map()
    recordsBySource.forEach((sourceRecords) => {
      sourceRecords.forEach((record, recordId) => {
        const currentRecord = mergedRecords.get(recordId)
        if (!currentRecord || getJobOfferActivityTime(record) >= getJobOfferActivityTime(currentRecord)) {
          mergedRecords.set(recordId, record)
        }
      })
    })

    handleNext(sortOffersByRecent([...mergedRecords.values()]))
  }
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }
  const syncSnapshot = (sourceKey, snapshot) => {
    const sourceRecords = new Map()
    snapshot.docs.forEach((entry) => {
      sourceRecords.set(entry.id, normalizeJobOfferRecord({
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

      const workspaceOwnerIds = resolveAuthorizedUserIds([
        ...(Array.isArray(options?.workspaceOwnerIds) ? options.workspaceOwnerIds : []),
        options?.workspaceOwnerId,
        options?.ownerId,
      ])
      const workspaceOwnerEmails = resolveAuthorizedEmails([
        ...(Array.isArray(options?.workspaceOwnerEmails) ? options.workspaceOwnerEmails : []),
        options?.workspaceOwnerEmail,
        options?.ownerEmail,
      ])
      if (!workspaceOwnerIds.length && !workspaceOwnerEmails.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      workspaceOwnerIds.forEach((ownerId) => {
        const sourceKey = `workspace-owner:${ownerId}`
        stopHandlers.push(onSnapshot(
          query(collection(db, JOB_OFFERS_COLLECTION), where('workspace_owner_id', '==', ownerId)),
          (snapshot) => syncSnapshot(sourceKey, snapshot),
          reportError,
        ))
      })

      workspaceOwnerEmails.forEach((ownerEmail) => {
        const sourceKey = `workspace-owner-email:${ownerEmail}`
        stopHandlers.push(onSnapshot(
          query(collection(db, JOB_OFFERS_COLLECTION), where('workspace_owner_email', '==', ownerEmail)),
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

export const subscribeToApplicantJobOffers = (options = {}, handleNext, handleError) => {
  let isClosed = false
  const recordsBySource = new Map()
  const stopHandlers = []
  const emitRecords = () => {
    if (isClosed || typeof handleNext !== 'function') return

    const mergedRecords = new Map()
    recordsBySource.forEach((sourceRecords) => {
      sourceRecords.forEach((record, recordId) => {
        const currentRecord = mergedRecords.get(recordId)
        if (!currentRecord || getJobOfferActivityTime(record) >= getJobOfferActivityTime(currentRecord)) {
          mergedRecords.set(recordId, record)
        }
      })
    })

    handleNext(sortOffersByRecent([...mergedRecords.values()]))
  }
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }
  const syncSnapshot = (sourceKey, snapshot) => {
    const sourceRecords = new Map()
    snapshot.docs.forEach((entry) => {
      sourceRecords.set(entry.id, normalizeJobOfferRecord({
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

      const applicantIds = resolveAuthorizedUserIds([options?.applicantId])
      const applicantEmails = resolveAuthorizedEmails([options?.applicantEmail])
      if (!applicantIds.length && !applicantEmails.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      applicantIds.forEach((applicantId) => {
        const sourceKey = `applicant-id:${applicantId}`
        stopHandlers.push(onSnapshot(
          query(collection(db, JOB_OFFERS_COLLECTION), where('applicant_id', '==', applicantId)),
          (snapshot) => syncSnapshot(sourceKey, snapshot),
          reportError,
        ))
      })

      applicantEmails.forEach((applicantEmail) => {
        const sourceKey = `applicant-email:${applicantEmail}`
        stopHandlers.push(onSnapshot(
          query(collection(db, JOB_OFFERS_COLLECTION), where('applicant_email', '==', applicantEmail)),
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
