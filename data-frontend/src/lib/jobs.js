import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, cloudFunctions, db } from '@/firebase'
import { mediaUrl } from '@/lib/media'

const JOBS_COLLECTION = 'jobs'
const JOBS_STORAGE_KEY = 'pwdFrontendJobs'
const LEGACY_JOBS_STORAGE_KEY = 'pwdFrontendMockJobs'
const PUBLIC_JOB_STATUS = 'open'

const cloneJson = (value) => JSON.parse(JSON.stringify(value))
const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => text(value).toLowerCase()
const waitForAuthReady = () =>
  typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()

const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}

const readStorage = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return cloneJson(fallback)
    const parsed = JSON.parse(raw)
    return parsed ?? cloneJson(fallback)
  } catch {
    return cloneJson(fallback)
  }
}

const writeStorage = (key, value) => {
  window.localStorage.setItem(key, JSON.stringify(value))
}

const normalizeTextList = (value, delimiter = /\r?\n/) => {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean)
  }

  const raw = text(value)
  if (!raw) return []

  return raw
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

const normalizeJobStatus = (value) => {
  const normalized = text(value).toLowerCase()
  if (normalized === 'closed') return 'closed'
  if (normalized === 'draft') return 'draft'
  return 'open'
}
const isPublicJobStatus = (value) => text(value).toLowerCase() === PUBLIC_JOB_STATUS

const sortJobs = (jobs) =>
  [...jobs].sort((left, right) => {
    const leftTime = Date.parse(String(left?.createdAt || left?.updatedAt || '')) || 0
    const rightTime = Date.parse(String(right?.createdAt || right?.updatedAt || '')) || 0
    return rightTime - leftTime
  })
const filterPublicJobs = (jobs = []) =>
  sortJobs(jobs.filter((job) => isPublicJobStatus(job?.status)))

const normalizeJobRecord = (raw) => {
  const id = text(raw?.id)
  const title = text(raw?.title)

  if (!id || !title) return null

  const city = text(raw?.city)
  const barangay = text(raw?.barangay)
  const location = text(raw?.location || [city, barangay].filter(Boolean).join(', ') || 'Not specified')
  const createdAt = timestampText(raw?.createdAt || raw?.created_at || raw?.postedAt)
  const updatedAt = timestampText(raw?.updatedAt || raw?.updated_at || createdAt)

  return {
    id,
    title,
    companyName: text(raw?.companyName || raw?.company_name || raw?.company || raw?.department || 'Company'),
    logoUrl: mediaUrl(raw?.logoUrl || raw?.companyLogoUrl || raw?.profileImageUrl || ''),
    location,
    city,
    barangay,
    category: text(raw?.category || 'General'),
    type: text(raw?.type || 'Open'),
    description: text(raw?.description || 'No description provided.'),
    setup: text(raw?.setup || raw?.type || 'On-site'),
    vacancies: Math.max(1, Number(raw?.vacancies || 1) || 1),
    salary: text(raw?.salary || raw?.salaryRange || 'Negotiable'),
    salaryRange: text(raw?.salaryRange || raw?.salary || 'Negotiable'),
    disabilityType: text(raw?.disabilityType || raw?.disability || 'PWD-friendly'),
    impairmentSpecification: text(raw?.impairmentSpecification || raw?.impairment_specification),
    qualifications: normalizeTextList(raw?.qualifications),
    responsibilities: normalizeTextList(raw?.responsibilities),
    languages: normalizeTextList(raw?.languages ?? raw?.language, /,/),
    language: text(raw?.language),
    preferredAgeRange: text(raw?.preferredAgeRange || raw?.preferred_age_range || 'Not specified'),
    createdAt,
    updatedAt,
    status: normalizeJobStatus(raw?.status),
    workspaceOwnerId: text(raw?.workspace_owner_id || raw?.workspaceOwnerId),
    workspaceOwnerEmail: normalizeEmail(raw?.workspace_owner_email || raw?.workspaceOwnerEmail),
    employerId: text(raw?.employer_id || raw?.employerId),
    createdBy: text(raw?.created_by || raw?.createdBy),
  }
}

const mapSnapshotToJobs = (docs = []) => sortJobs(
  docs
    .map((entry) => normalizeJobRecord({ id: entry.id, ...entry.data() }))
    .filter(Boolean),
)

const getCachedJobs = () =>
  filterPublicJobs(
    readStorage(JOBS_STORAGE_KEY, [])
      .map((entry) => normalizeJobRecord(entry))
      .filter(Boolean),
  )

const cacheJobs = (jobs) => {
  writeStorage(JOBS_STORAGE_KEY, jobs)
  if (window.localStorage.getItem(LEGACY_JOBS_STORAGE_KEY)) {
    window.localStorage.removeItem(LEGACY_JOBS_STORAGE_KEY)
  }
}

const getJobDocRef = (jobId) => doc(db, JOBS_COLLECTION, text(jobId))
const syncCachedPublicJob = (job) => {
  const normalizedJob = normalizeJobRecord(job)
  const cachedJobs = getCachedJobs().filter((entry) => entry.id !== text(normalizedJob?.id))

  if (normalizedJob && isPublicJobStatus(normalizedJob.status)) {
    cacheJobs(filterPublicJobs([normalizedJob, ...cachedJobs]))
    return
  }

  cacheJobs(filterPublicJobs(cachedJobs))
}
const removeCachedPublicJob = (jobId) => {
  cacheJobs(filterPublicJobs(getCachedJobs().filter((job) => job.id !== text(jobId))))
}

const toJobDocument = (payload = {}, options = {}) => {
  const existingJob = options?.existingJob && typeof options.existingJob === 'object'
    ? options.existingJob
    : null
  const source = existingJob
    ? {
        ...existingJob,
        ...payload,
      }
    : payload
  const title = text(source?.title)
  const companyName = text(source?.companyName || source?.company_name)
  const description = text(source?.description)
  const category = text(source?.category)
  const type = text(source?.type)
  const city = text(source?.location || source?.city)
  const barangay = text(source?.barangay)
  const salary = text(source?.salary || source?.salaryRange)
  const disabilityType = text(source?.disabilityType)
  const preferredAgeRange = text(source?.preferredAgeRange)
  const workspaceOwnerId = text(source?.workspaceOwnerId || source?.workspace_owner_id)
  const createdBy = text(
    existingJob?.createdBy
    || existingJob?.created_by
    || source?.createdBy
    || source?.created_by
    || source?.employerId
    || source?.employer_id,
  )

  if (
    !title
    || !companyName
    || !description
    || !category
    || !type
    || !city
    || !barangay
    || !salary
    || !disabilityType
    || !preferredAgeRange
    || !workspaceOwnerId
    || !createdBy
  ) {
    throw new Error('Please complete all required job post details before saving.')
  }

  const now = new Date().toISOString()
  const createdAt = text(existingJob?.createdAt || existingJob?.created_at || source?.createdAt || source?.created_at || now)
  const location = [city, barangay].filter(Boolean).join(', ')

  return {
    title,
    companyName,
    company_name: companyName,
    logoUrl: text(source?.logoUrl || source?.companyLogoUrl),
    companyLogoUrl: text(source?.logoUrl || source?.companyLogoUrl),
    description,
    category,
    type,
    setup: text(source?.setup || type),
    city,
    barangay,
    location: location || city,
    vacancies: Math.max(1, Number(source?.vacancies || 1) || 1),
    salary,
    salaryRange: text(source?.salaryRange || salary),
    disabilityType,
    impairmentSpecification: text(source?.impairmentSpecification),
    preferredAgeRange,
    language: text(source?.language),
    languages: normalizeTextList(source?.languages ?? source?.language, /,/),
    qualifications: normalizeTextList(source?.qualifications),
    responsibilities: normalizeTextList(source?.responsibilities),
    status: normalizeJobStatus(source?.status || 'open'),
    createdAt,
    created_at: createdAt,
    updatedAt: now,
    updated_at: now,
    workspace_owner_id: workspaceOwnerId,
    workspace_owner_email: normalizeEmail(source?.workspaceOwnerEmail || source?.workspace_owner_email),
    employer_id: text(existingJob?.employerId || existingJob?.employer_id || source?.employerId || source?.employer_id || createdBy),
    created_by: createdBy,
  }
}

const toJobsErrorMessage = (error, fallback) => {
  const code = text(error?.code).toLowerCase()

  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'This job post action is blocked in Firebase right now. Deploy the updated Cloud Functions or the latest Firestore rules, then try again.'
  }

  if (code === 'unauthenticated') {
    return 'Sign in again before managing this job post.'
  }

  if (code === 'unavailable') {
    return 'Cloud Firestore is temporarily unavailable. Try again in a moment.'
  }

  return fallback
}

const shouldTryPublishJobFunctionFallback = (error) => {
  const code = text(error?.code).toLowerCase()
  return [
    'permission-denied',
    'firestore/permission-denied',
    'failed-precondition',
    'unavailable',
  ].includes(code)
}
const shouldTryManagedJobFunctionFallback = (error) => {
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
  ].includes(code)
}

const createBusinessJobPostViaFunction = async (payload = {}) => {
  await waitForAuthReady()
  const publishBusinessJobPost = httpsCallable(cloudFunctions, 'publishBusinessJobPost')
  const result = await publishBusinessJobPost(payload)
  return normalizeJobRecord(result?.data?.job)
}
const createBusinessJobPostDirectly = async (jobDocument = {}) => {
  const docRef = await addDoc(collection(db, JOBS_COLLECTION), jobDocument)
  const createdJob = normalizeJobRecord({ id: docRef.id, ...jobDocument })

  if (createdJob) {
    const cachedJobs = getCachedJobs().filter((job) => job.id !== createdJob.id)
    cacheJobs(sortJobs([createdJob, ...cachedJobs]))
  }

  return createdJob
}
const updateBusinessJobPostViaFunction = async (jobId, payload = {}, options = {}) => {
  await waitForAuthReady()
  const updateBusinessJobPost = httpsCallable(cloudFunctions, 'updateBusinessJobPost')
  const workspaceOwnerId = text(options?.workspaceOwnerId || payload?.workspaceOwnerId || payload?.workspace_owner_id)
  const result = await updateBusinessJobPost({
    jobId: text(jobId),
    ...(workspaceOwnerId ? { workspaceOwnerId } : {}),
    ...payload,
  })
  return normalizeJobRecord(result?.data?.job)
}
const deleteBusinessJobPostViaFunction = async (jobId, options = {}) => {
  await waitForAuthReady()
  const deleteBusinessJobPost = httpsCallable(cloudFunctions, 'deleteBusinessJobPost')
  const workspaceOwnerId = text(options?.workspaceOwnerId)
  const result = await deleteBusinessJobPost({
    jobId: text(jobId),
    ...(workspaceOwnerId ? { workspaceOwnerId } : {}),
  })
  return {
    deleted: result?.data?.deleted === true,
    jobId: text(result?.data?.jobId || jobId),
  }
}

export const getPublicJobs = async () => {
  try {
    const snapshot = await getDocs(
      query(collection(db, JOBS_COLLECTION), where('status', '==', PUBLIC_JOB_STATUS)),
    )
    const firestoreJobs = filterPublicJobs(mapSnapshotToJobs(snapshot.docs))
    cacheJobs(firestoreJobs)
    return firestoreJobs
  } catch {
    return []
  }
}

export const subscribeToPublicJobs = (handleNext, handleError) =>
  onSnapshot(
    query(collection(db, JOBS_COLLECTION), where('status', '==', PUBLIC_JOB_STATUS)),
    (snapshot) => {
      const jobs = filterPublicJobs(mapSnapshotToJobs(snapshot.docs))
      cacheJobs(jobs)
      if (typeof handleNext === 'function') handleNext(jobs)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )

export const subscribeToJobDocumentStates = (jobIds = [], handleNext, handleError) => {
  const normalizedJobIds = [...new Set(
    (Array.isArray(jobIds) ? jobIds : [])
      .map((jobId) => text(jobId))
      .filter(Boolean),
  )]

  if (!normalizedJobIds.length) {
    if (typeof handleNext === 'function') handleNext({})
    return () => {}
  }

  const jobStates = Object.fromEntries(normalizedJobIds.map((jobId) => [jobId, undefined]))
  const emitJobStates = () => {
    if (typeof handleNext === 'function') {
      handleNext({ ...jobStates })
    }
  }

  emitJobStates()

  const stopHandlers = normalizedJobIds.map((jobId) =>
    onSnapshot(
      getJobDocRef(jobId),
      (snapshot) => {
        jobStates[jobId] = snapshot.exists()
        emitJobStates()
      },
      (error) => {
        if (typeof handleError === 'function') handleError(error)
      },
    ))

  return () => {
    stopHandlers.forEach((stopHandler) => {
      if (typeof stopHandler === 'function') stopHandler()
    })
  }
}

export const subscribeToWorkspaceJobs = (workspaceOwnerId, handleNext, handleError) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)

  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  return onSnapshot(
    query(
      collection(db, JOBS_COLLECTION),
      where('workspace_owner_id', '==', normalizedWorkspaceOwnerId),
    ),
    (snapshot) => {
      const jobs = mapSnapshotToJobs(snapshot.docs)
      if (typeof handleNext === 'function') handleNext(jobs)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )
}

export const createBusinessJobPost = async (payload = {}) => {
  const jobDocument = toJobDocument(payload)

  try {
    const createdJob = await createBusinessJobPostViaFunction(jobDocument)

    if (!createdJob) {
      const missingDataError = new Error('The Firebase function saved the job post, but no job data was returned.')
      missingDataError.code = 'functions/internal'
      throw missingDataError
    }

    const cachedJobs = getCachedJobs().filter((job) => job.id !== createdJob.id)
    cacheJobs(sortJobs([createdJob, ...cachedJobs]))
    return createdJob
  } catch (functionError) {
    const functionCode = text(functionError?.code).toLowerCase()

    if (functionCode === 'functions/unauthenticated') {
      throw new Error('Sign in again before publishing a job post.')
    }

    if (functionCode === 'functions/permission-denied') {
      throw new Error(text(functionError?.message) || 'Your account is not allowed to publish job posts.')
    }

    if (functionCode === 'functions/invalid-argument' || functionCode === 'functions/failed-precondition') {
      throw new Error(text(functionError?.message) || 'Please review the job post details and try again.')
    }

    if (!shouldTryManagedJobFunctionFallback(functionError)) {
      throw new Error(
        toJobsErrorMessage(
          functionError,
          text(functionError?.message) || 'Unable to publish the job post right now.',
        ),
      )
    }

    try {
      return await createBusinessJobPostDirectly(jobDocument)
    } catch (firestoreError) {
      if (shouldTryPublishJobFunctionFallback(firestoreError)) {
        throw new Error(
          'The publishBusinessJobPost Firebase function is not deployed and Firestore rules are blocking direct job post writes. Deploy Functions or the latest Firestore rules, then try again.',
        )
      }

      throw new Error(
        toJobsErrorMessage(firestoreError, 'Unable to publish the job post right now.'),
      )
    }
  }
}

export const updateBusinessJobPost = async (jobId, payload = {}, options = {}) => {
  const normalizedJobId = text(jobId)
  if (!normalizedJobId) throw new Error('Select a job post before saving changes.')

  try {
    const updatedJob = await updateBusinessJobPostViaFunction(normalizedJobId, payload, options)

    if (!updatedJob) {
      throw new Error('The Firebase function saved the job post changes, but no updated job data was returned.')
    }

    syncCachedPublicJob(updatedJob)
    return updatedJob
  } catch (functionError) {
    const functionCode = text(functionError?.code).toLowerCase()

    if (functionCode === 'functions/unauthenticated') {
      throw new Error('Sign in again before updating the job post.')
    }

    if (functionCode === 'functions/permission-denied') {
      throw new Error(text(functionError?.message) || 'Your account is not allowed to update this job post.')
    }

    if (shouldTryManagedJobFunctionFallback(functionError)) {
      const snapshot = await getDoc(getJobDocRef(normalizedJobId))
      if (!snapshot.exists()) {
        throw new Error('That job post no longer exists.')
      }

      const existingJob = normalizeJobRecord({ id: snapshot.id, ...snapshot.data() })
      if (!existingJob) {
        throw new Error('That job post could not be loaded right now.')
      }

      const nextJobDocument = toJobDocument(payload, { existingJob })

      try {
        await updateDoc(getJobDocRef(normalizedJobId), nextJobDocument)
        const updatedJob = normalizeJobRecord({
          id: normalizedJobId,
          ...existingJob,
          ...nextJobDocument,
        })
        syncCachedPublicJob(updatedJob)
        return updatedJob
      } catch (firestoreError) {
        throw new Error(
          toJobsErrorMessage(firestoreError, 'Unable to update the job post right now.'),
        )
      }
    }

    throw new Error(
      toJobsErrorMessage(
        functionError,
        text(functionError?.message) || 'Unable to update the job post right now.',
      ),
    )
  }
}

export const deleteBusinessJobPost = async (jobId, options = {}) => {
  const normalizedJobId = text(jobId)
  if (!normalizedJobId) throw new Error('Select a job post before deleting it.')

  try {
    await deleteBusinessJobPostViaFunction(normalizedJobId, options)
    removeCachedPublicJob(normalizedJobId)
    return {
      deleted: true,
      jobId: normalizedJobId,
    }
  } catch (functionError) {
    const functionCode = text(functionError?.code).toLowerCase()

    if (functionCode === 'functions/unauthenticated') {
      throw new Error('Sign in again before deleting the job post.')
    }

    if (functionCode === 'functions/permission-denied') {
      throw new Error(text(functionError?.message) || 'Your account is not allowed to delete this job post.')
    }

    if (shouldTryManagedJobFunctionFallback(functionError)) {
      try {
        await deleteDoc(getJobDocRef(normalizedJobId))
        removeCachedPublicJob(normalizedJobId)
        return {
          deleted: true,
          jobId: normalizedJobId,
        }
      } catch (firestoreError) {
        throw new Error(
          toJobsErrorMessage(firestoreError, 'Unable to delete the job post right now.'),
        )
      }
    }

    throw new Error(
      toJobsErrorMessage(
        functionError,
        text(functionError?.message) || 'Unable to delete the job post right now.',
      ),
    )
  }
}
