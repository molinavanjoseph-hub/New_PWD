const crypto = require('crypto')

const { setGlobalOptions } = require('firebase-functions/v2')
const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const sgMail = require('@sendgrid/mail')

if (!admin.apps.length) {
  admin.initializeApp()
}

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
})

const publicCallableOptions = {
  invoker: 'public',
  cors: true,
}

const publicHttpOptions = {
  invoker: 'public',
  cors: true,
}

const PAYMONGO_API_BASE_URL = 'https://api.paymongo.com/v1'

const db = admin.firestore()

const USERS_COLLECTION = 'users'
const EMPLOYERS_COLLECTION = 'employers'
const APPLICANT_REGISTRATION_COLLECTION = 'applicant_registration'
const DELETED_USER_HISTORY_COLLECTION = 'deleted_user_history'
const REGISTRATION_OTP_COLLECTION = 'employer_registration'
const JOBS_COLLECTION = 'jobs'
const APPLY_JOBS_COLLECTION = 'apply_jobs'
const BUSINESS_INTERVIEW_SCHEDULES_COLLECTION = 'business_interview_schedules'
const BUSINESS_APPLICANT_SCORE_COLLECTION = 'applicant_score_assessment'
const BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION = 'business_assessment_templates'
const BUSINESS_TRAINING_TEMPLATE_COLLECTION = 'business_training_templates'
const BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION = 'business_assessment_assignments'
const BUSINESS_TRAINING_ASSIGNMENT_COLLECTION = 'business_training_assignments'
const BUSINESS_PAYMENT_HISTORY_COLLECTION = 'business_payment_history'
const WORKSPACE_USERS_SUBCOLLECTION = 'workspace_users'
const MEMBER_EMPLOYER_SUBCOLLECTION = 'member_employer'
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 10
const VERIFIED_REGISTRATION_TTL_MINUTES = 30
const OTP_COOLDOWN_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5
const OTP_MAX_RESENDS = 5
const ADMIN_ROLES = new Set(['admin', 'system_admin'])

const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => text(value).toLowerCase()
const normalizeRole = (value) => text(value).toLowerCase()
const normalizeRegistrationRole = (value) => {
  const normalized = normalizeRole(value)
  if (normalized === 'applicant') return 'applicant'
  if (normalized === 'employer') return 'employer'
  return ''
}
const normalizeOrganizationType = (value) => {
  const normalized = text(value).toLowerCase()
  if (normalized === 'business') return 'business'
  if (normalized === 'company') return 'company'
  return ''
}
const uniqueTextValues = (values = []) => [...new Set(values.map((value) => text(value)).filter(Boolean))]
const uniqueEmailValues = (values = []) => [...new Set(values.map((value) => normalizeEmail(value)).filter(Boolean))]
const uniqueDocRefs = (refs = []) => [...new Map(
  refs
    .filter((ref) => ref?.path)
    .map((ref) => [ref.path, ref]),
).values()]
const chunkValues = (values = [], size = 10) => {
  const chunks = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

const getRoleFromValue = (value) => normalizeRole(value)

const assertAdminRequest = async (request) => {
  const requesterUid = text(request?.auth?.uid)
  const requesterToken = request?.auth?.token || {}
  const requesterEmail = normalizeEmail(requesterToken.email)
  const tokenRole = getRoleFromValue(
    requesterToken.role || requesterToken.user_role || requesterToken.accountType,
  )

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in as an admin before deleting accounts.')
  }

  const requesterSnapshot = await db.collection(USERS_COLLECTION).doc(requesterUid).get()
  let requesterRole = getRoleFromValue(
    requesterSnapshot.data()?.role
    || requesterSnapshot.data()?.user_role
    || requesterSnapshot.data()?.accountType,
  )

  if (!requesterRole && requesterEmail) {
    const requesterEmailSnapshot = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', requesterEmail)
      .limit(1)
      .get()

    if (!requesterEmailSnapshot.empty) {
      const requesterEmailProfile = requesterEmailSnapshot.docs[0].data() || {}
      requesterRole = getRoleFromValue(
        requesterEmailProfile.role
        || requesterEmailProfile.user_role
        || requesterEmailProfile.accountType,
      )
    }
  }

  const hasAdminTokenClaim =
    requesterToken.admin === true
    || requesterToken.is_admin === true
    || requesterToken.system_admin === true
    || ADMIN_ROLES.has(tokenRole)

  if (!ADMIN_ROLES.has(requesterRole) && !hasAdminTokenClaim) {
    throw new HttpsError('permission-denied', 'Only admins can delete managed accounts.')
  }

  return {
    requesterUid,
    requesterRole: requesterRole || tokenRole || 'admin',
  }
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isValidHttpUrl = (value) => /^https?:\/\//i.test(text(value))
const otpTtlMs = OTP_EXPIRY_MINUTES * 60 * 1000
const verifiedRegistrationTtlMs = VERIFIED_REGISTRATION_TTL_MINUTES * 60 * 1000
const nowIso = () => new Date().toISOString()
const escapeHtml = (value) =>
  text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const toEmployerRegistrationDocId = (email) => normalizeEmail(email)

const hashOtp = (email, code) =>
  crypto.createHash('sha256').update(`${normalizeEmail(email)}:${text(code)}`).digest('hex')

const createOtpCode = () => crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0')

const timestampToMillis = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value) || 0
}

const collectDocsFromReadRefs = async (readRefs = []) => {
  if (!readRefs.length) return []

  const snapshots = await Promise.all(readRefs.map((ref) => ref.get()))
  const docsByPath = new Map()

  snapshots.forEach((snapshot) => {
    if (Array.isArray(snapshot?.docs)) {
      snapshot.docs.forEach((docSnapshot) => {
        docsByPath.set(docSnapshot.ref.path, docSnapshot)
      })
      return
    }

    if (snapshot?.exists) {
      docsByPath.set(snapshot.ref.path, snapshot)
    }
  })

  return [...docsByPath.values()]
}

const deleteDocumentRefs = async (refs = []) => {
  const uniqueRefs = uniqueDocRefs(refs)
  if (!uniqueRefs.length) return 0

  for (let index = 0; index < uniqueRefs.length; index += 450) {
    const batch = db.batch()
    uniqueRefs.slice(index, index + 450).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  return uniqueRefs.length
}

const buildCollectionEqualityReadRefs = (collectionName, fieldName, values = [], normalizer = uniqueTextValues) =>
  normalizer(values).map((value) => db.collection(collectionName).where(fieldName, '==', value))

const buildCollectionInReadRefs = (collectionName, fieldName, values = [], normalizer = uniqueTextValues) =>
  chunkValues(normalizer(values), 10).map((chunk) => db.collection(collectionName).where(fieldName, 'in', chunk))

const assertSignedInRequest = (request, fallbackMessage = 'Sign in before continuing.') => {
  const requesterUid = text(request?.auth?.uid)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', fallbackMessage)
  }

  return requesterUid
}

const normalizeCallableJobRecord = (jobId, rawData = {}, requesterUid = '') => {
  const title = text(rawData?.title)
  const companyName = text(rawData?.companyName || rawData?.company_name)
  const description = text(rawData?.description)
  const category = text(rawData?.category)
  const type = text(rawData?.type)
  const setup = text(rawData?.setup || type)
  const city = text(rawData?.city || rawData?.location)
  const barangay = text(rawData?.barangay)
  const location = text(rawData?.location || [city, barangay].filter(Boolean).join(', '))
  const salary = text(rawData?.salary || rawData?.salaryRange)
  const salaryRange = text(rawData?.salaryRange || salary)
  const disabilityType = text(rawData?.disabilityType)
  const preferredAgeRange = text(rawData?.preferredAgeRange)
  const workspaceOwnerId = text(rawData?.workspaceOwnerId || rawData?.workspace_owner_id || requesterUid)
  const workspaceOwnerEmail = normalizeEmail(rawData?.workspaceOwnerEmail || rawData?.workspace_owner_email)
  const employerId = text(rawData?.employerId || rawData?.employer_id || requesterUid)
  const createdBy = text(rawData?.createdBy || rawData?.created_by || requesterUid)
  const vacancies = Math.max(1, Number(rawData?.vacancies || 1) || 1)
  const qualifications = Array.isArray(rawData?.qualifications)
    ? rawData.qualifications.map((entry) => text(entry)).filter(Boolean)
    : []
  const responsibilities = Array.isArray(rawData?.responsibilities)
    ? rawData.responsibilities.map((entry) => text(entry)).filter(Boolean)
    : []
  const languages = Array.isArray(rawData?.languages)
    ? rawData.languages.map((entry) => text(entry)).filter(Boolean)
    : uniqueTextValues(text(rawData?.language).split(','))
  const status = ['open', 'closed', 'draft'].includes(text(rawData?.status).toLowerCase())
    ? text(rawData?.status).toLowerCase()
    : 'open'

  if (
    !title
    || !companyName
    || !description
    || !category
    || !type
    || !location
    || !barangay
    || !salaryRange
    || !disabilityType
    || !preferredAgeRange
    || !workspaceOwnerId
  ) {
    throw new HttpsError('invalid-argument', 'Please complete all required job post details before saving.')
  }

  const timestamp = nowIso()
  const createdAt = text(rawData?.createdAt || rawData?.created_at || timestamp)

  return {
    id: text(jobId),
    title,
    companyName,
    company_name: companyName,
    logoUrl: text(rawData?.logoUrl || rawData?.companyLogoUrl),
    companyLogoUrl: text(rawData?.logoUrl || rawData?.companyLogoUrl),
    description,
    category,
    type,
    setup,
    city,
    barangay,
    location,
    vacancies,
    salary,
    salaryRange,
    disabilityType,
    impairmentSpecification: text(rawData?.impairmentSpecification),
    preferredAgeRange,
    language: text(rawData?.language),
    languages,
    qualifications,
    responsibilities,
    status,
    workspace_owner_id: workspaceOwnerId,
    workspace_owner_email: workspaceOwnerEmail,
    employer_id: employerId,
    created_by: createdBy,
    createdAt,
    created_at: createdAt,
    updatedAt: timestamp,
    updated_at: timestamp,
  }
}

const publishBusinessJobPostHandler = async (rawData, request) => {
  const requesterUid = assertSignedInRequest(request, 'Sign in again before publishing a job post.')
  const jobDocRef = db.collection(JOBS_COLLECTION).doc()
  const jobRecord = normalizeCallableJobRecord(jobDocRef.id, rawData, requesterUid)

  await jobDocRef.set(jobRecord)

  return {
    job: jobRecord,
  }
}

const updateBusinessJobPostHandler = async (rawData, request) => {
  const requesterUid = assertSignedInRequest(request, 'Sign in again before updating the job post.')
  const jobId = text(rawData?.jobId)

  if (!jobId) {
    throw new HttpsError('invalid-argument', 'Select a job post before saving changes.')
  }

  const jobDocRef = db.collection(JOBS_COLLECTION).doc(jobId)
  const snapshot = await jobDocRef.get()

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'That job post no longer exists.')
  }

  const existingJob = snapshot.data() || {}
  const ownerIds = new Set([
    text(existingJob.workspace_owner_id),
    text(existingJob.created_by),
    text(existingJob.employer_id),
  ].filter(Boolean))

  if (!ownerIds.has(requesterUid)) {
    const { requesterRole } = await assertAdminRequest(request)
    if (!ADMIN_ROLES.has(requesterRole)) {
      throw new HttpsError('permission-denied', 'Your account is not allowed to update this job post.')
    }
  }

  const jobRecord = normalizeCallableJobRecord(jobId, { ...existingJob, ...rawData }, requesterUid)
  await jobDocRef.set(jobRecord, { merge: true })

  return {
    job: jobRecord,
  }
}

const deleteBusinessJobPostHandler = async (rawData, request) => {
  const requesterUid = assertSignedInRequest(request, 'Sign in again before deleting the job post.')
  const jobId = text(rawData?.jobId)

  if (!jobId) {
    throw new HttpsError('invalid-argument', 'Select a job post before deleting it.')
  }

  const jobDocRef = db.collection(JOBS_COLLECTION).doc(jobId)
  const snapshot = await jobDocRef.get()

  if (!snapshot.exists) {
    return {
      deleted: true,
      jobId,
    }
  }

  const existingJob = snapshot.data() || {}
  const ownerIds = new Set([
    text(existingJob.workspace_owner_id),
    text(existingJob.created_by),
    text(existingJob.employer_id),
  ].filter(Boolean))

  if (!ownerIds.has(requesterUid)) {
    const { requesterRole } = await assertAdminRequest(request)
    if (!ADMIN_ROLES.has(requesterRole)) {
      throw new HttpsError('permission-denied', 'Your account is not allowed to delete this job post.')
    }
  }

  await jobDocRef.delete()

  return {
    deleted: true,
    jobId,
  }
}

const loadManagedAccountState = async (uid, requestedRole = '') => {
  const targetUid = text(uid)
  const userDocRef = db.collection(USERS_COLLECTION).doc(targetUid)
  const applicantDocRef = db.collection(APPLICANT_REGISTRATION_COLLECTION).doc(targetUid)
  const employerDocRef = db.collection(EMPLOYERS_COLLECTION).doc(targetUid)
  const deletedHistoryDocRef = db.collection(DELETED_USER_HISTORY_COLLECTION).doc(targetUid)
  const [userSnapshot, applicantSnapshot, employerSnapshot] = await Promise.all([
    userDocRef.get(),
    applicantDocRef.get(),
    employerDocRef.get(),
  ])
  const profile = userSnapshot.exists
    ? userSnapshot.data() || {}
    : applicantSnapshot.exists
      ? applicantSnapshot.data() || {}
      : employerSnapshot.exists
        ? employerSnapshot.data() || {}
        : {}

  return {
    targetUid,
    targetRole: normalizeRole(profile.role || profile.user_role || profile.accountType || requestedRole),
    targetEmail: normalizeEmail(profile.email),
    targetName:
      text(profile.name)
      || text(profile.first_name ? `${profile.first_name} ${profile.last_name || ''}` : '')
      || text(profile.company_name),
    userDocRef,
    applicantDocRef,
    employerDocRef,
    deletedHistoryDocRef,
    userSnapshot,
    applicantSnapshot,
    employerSnapshot,
  }
}

const buildDeletedHistoryPayload = ({
  accountState,
  requesterUid,
  requesterRole,
  extra = {},
}) => ({
  uid: accountState.targetUid,
  role: accountState.targetRole || 'user',
  email: accountState.targetEmail,
  name: accountState.targetName,
  archived: false,
  status: 'deleted',
  deleted_at: admin.firestore.FieldValue.serverTimestamp(),
  deleted_by: requesterUid,
  deleted_by_role: requesterRole,
  user_profile: accountState.userSnapshot.exists ? accountState.userSnapshot.data() || null : null,
  applicant_profile: accountState.applicantSnapshot.exists ? accountState.applicantSnapshot.data() || null : null,
  employer_profile: accountState.employerSnapshot.exists ? accountState.employerSnapshot.data() || null : null,
  ...extra,
})

const disableAuthUserRecord = async (uid) => {
  let authState = 'missing'

  await admin.auth().updateUser(uid, { disabled: true }).then(() => {
    authState = 'disabled'
  }).catch((error) => {
    if (text(error?.code) === 'auth/user-not-found') return
    throw error
  })

  return authState
}

const archiveAndDeleteManagedAccountState = async ({
  accountState,
  requesterUid,
  requesterRole,
  extraHistory = {},
}) => {
  const batch = db.batch()

  batch.set(
    accountState.deletedHistoryDocRef,
    buildDeletedHistoryPayload({
      accountState,
      requesterUid,
      requesterRole,
      extra: extraHistory,
    }),
    { merge: true },
  )

  if (accountState.userSnapshot.exists) batch.delete(accountState.userDocRef)
  if (accountState.applicantSnapshot.exists) batch.delete(accountState.applicantDocRef)
  if (accountState.employerSnapshot.exists) batch.delete(accountState.employerDocRef)

  if (accountState.targetEmail) {
    batch.delete(db.collection(REGISTRATION_OTP_COLLECTION).doc(toEmployerRegistrationDocId(accountState.targetEmail)))
  }

  await batch.commit()

  const authState = await disableAuthUserRecord(accountState.targetUid)
  await accountState.deletedHistoryDocRef.set({ auth_state: authState }, { merge: true })

  return authState
}

const collectWorkspaceMemberAccountDocs = async (workspaceOwnerId) =>
  collectDocsFromReadRefs([
    ...buildCollectionEqualityReadRefs(USERS_COLLECTION, 'workspace_owner_id', [workspaceOwnerId]),
    ...buildCollectionEqualityReadRefs(USERS_COLLECTION, 'workspaceOwnerId', [workspaceOwnerId]),
  ])

const deleteWorkspaceMemberAccounts = async ({
  workspaceOwnerId,
  requesterUid,
  requesterRole,
}) => {
  const workspaceMemberDocs = (await collectWorkspaceMemberAccountDocs(workspaceOwnerId))
    .filter((docSnapshot) => docSnapshot.id !== workspaceOwnerId)

  let deletedWorkspaceMemberAccountsCount = 0

  for (const docSnapshot of workspaceMemberDocs) {
    const memberRole = normalizeRole(docSnapshot.data()?.role || 'employer')
    const memberAccountState = await loadManagedAccountState(docSnapshot.id, memberRole)

    await archiveAndDeleteManagedAccountState({
      accountState: memberAccountState,
      requesterUid,
      requesterRole,
      extraHistory: {
        cascade_deleted_from_uid: workspaceOwnerId,
        cascade_deleted_from_role: 'employer',
      },
    })

    deletedWorkspaceMemberAccountsCount += 1
  }

  return deletedWorkspaceMemberAccountsCount
}

const collectWorkspaceSubcollectionDocs = async (workspaceOwnerId, subcollectionName) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  const normalizedSubcollectionName = text(subcollectionName)

  if (!normalizedWorkspaceOwnerId || !normalizedSubcollectionName) return []

  return collectDocsFromReadRefs([
    db.collection(EMPLOYERS_COLLECTION).doc(normalizedWorkspaceOwnerId).collection(normalizedSubcollectionName),
  ])
}

const collectWorkspaceMembershipDirectoryDocs = async ({
  workspaceOwnerId,
  memberUid,
}) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  const normalizedMemberUid = text(memberUid)

  if (!normalizedWorkspaceOwnerId || !normalizedMemberUid) return []

  return collectDocsFromReadRefs([
    db.collection(EMPLOYERS_COLLECTION)
      .doc(normalizedWorkspaceOwnerId)
      .collection(WORKSPACE_USERS_SUBCOLLECTION)
      .doc(normalizedMemberUid),
    db.collection(EMPLOYERS_COLLECTION)
      .doc(normalizedWorkspaceOwnerId)
      .collection(MEMBER_EMPLOYER_SUBCOLLECTION)
      .doc(normalizedMemberUid),
  ])
}

const buildBusinessAccountIdentityCandidates = ({
  accountState,
  profile = {},
  workspaceOwnerId = '',
  workspaceOwnerEmail = '',
  workspaceOwnerRole = '',
}) => uniqueTextValues([
  [
    accountState.targetUid,
    accountState.targetEmail,
    accountState.targetRole || 'employer',
  ]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
    .join('|'),
  [
    workspaceOwnerId || profile.workspace_owner_id || profile.workspaceOwnerId || accountState.targetUid,
    workspaceOwnerEmail || profile.workspace_owner_email || profile.workspaceOwnerEmail || accountState.targetEmail,
    workspaceOwnerRole || profile.workspace_owner_role || profile.workspaceOwnerRole || accountState.targetRole || 'employer',
  ]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
    .join('|'),
])

const maskEmail = (email) => {
  const normalized = normalizeEmail(email)
  const [localPart, domainPart] = normalized.split('@')
  if (!localPart || !domainPart) return normalized

  const visiblePrefix = localPart.slice(0, 2)
  const hiddenPart = Math.max(localPart.length - visiblePrefix.length, 1)
  return `${visiblePrefix}${'*'.repeat(hiddenPart)}@${domainPart}`
}

const requireSendGridConfig = () => {
  if (!text(process.env.SENDGRID_API_KEY) || !text(process.env.SENDGRID_FROM_EMAIL)) {
    throw new HttpsError(
      'failed-precondition',
      'OTP email delivery is not configured yet. Add the SendGrid environment variables first.',
    )
  }
}

const getPayMongoSecretKey = () => text(process.env.PAYMONGO_SECRET_KEY)

const requirePayMongoConfig = () => {
  if (!getPayMongoSecretKey()) {
    throw new HttpsError(
      'failed-precondition',
      'PayMongo is not configured yet. Add PAYMONGO_SECRET_KEY to Cloud Functions first.',
    )
  }
}

const buildPayMongoAuthHeader = () =>
  `Basic ${Buffer.from(`${getPayMongoSecretKey()}:`).toString('base64')}`

const extractPayMongoErrorMessage = (payload) => {
  const entries = Array.isArray(payload?.errors) ? payload.errors : []
  const messages = entries
    .map((entry) => text(entry?.detail || entry?.title || entry?.code))
    .filter(Boolean)

  return messages.join(' ')
}

const callPayMongoApi = async (path, options = {}) => {
  requirePayMongoConfig()

  const response = await fetch(`${PAYMONGO_API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      authorization: buildPayMongoAuthHeader(),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpsError(
      response.status >= 500 ? 'internal' : 'invalid-argument',
      extractPayMongoErrorMessage(payload) || 'PayMongo request failed.',
    )
  }

  return payload
}

const extractSendGridErrorMessage = (error) => {
  const responseErrors = Array.isArray(error?.response?.body?.errors)
    ? error.response.body.errors
    : []
  const messages = responseErrors
    .map((entry) => text(entry?.message))
    .filter(Boolean)

  return messages.join(' ')
}

const toSendGridHttpsError = (error) => {
  const statusCode = Number(
    error?.code || error?.statusCode || error?.response?.statusCode || error?.response?.status,
  )
  const providerMessage = extractSendGridErrorMessage(error).toLowerCase()

  if (statusCode === 401) {
    return new HttpsError(
      'permission-denied',
      'SendGrid rejected the API key. Check the deployed SENDGRID_API_KEY value.',
    )
  }

  if (
    statusCode === 403
    && (
      providerMessage.includes('sender')
      || providerMessage.includes('verified')
      || providerMessage.includes('from address')
      || providerMessage.includes('from email')
    )
  ) {
    return new HttpsError(
      'failed-precondition',
      'SendGrid rejected the sender email. Verify SENDGRID_FROM_EMAIL or your SendGrid sender identity first.',
    )
  }

  if (statusCode === 403) {
    return new HttpsError(
      'permission-denied',
      'SendGrid denied the OTP email request. Check your SendGrid account permissions and sender verification.',
    )
  }

  if (statusCode === 400 && providerMessage) {
    return new HttpsError('invalid-argument', `SendGrid rejected the OTP email request: ${providerMessage}`)
  }

  return new HttpsError('internal', 'Unable to send the OTP email right now. Please try again.')
}

const buildOtpEmail = ({ email, code, companyName, organizationType, role, fullName }) => {
  const normalizedRole = normalizeRegistrationRole(role) || 'employer'
  const accountLabel = normalizedRole === 'employer'
    ? organizationType === 'business' ? 'business account' : 'company account'
    : 'applicant account'
  const subject = 'Your PWD Platform verification code'
  const registrationSubjectName = normalizedRole === 'employer'
    ? text(companyName) || 'your organization'
    : text(fullName)
  const registrationSuffix = registrationSubjectName ? ` for ${registrationSubjectName}` : ''
  const safeRegistrationNameHtml = escapeHtml(registrationSubjectName)
  const registrationSuffixHtml = registrationSubjectName ? ` for <strong>${safeRegistrationNameHtml}</strong>` : ''
  const maskedEmailHtml = escapeHtml(maskEmail(email))
  const textBody = [
    `Hello from the PWD Employment Platform.`,
    '',
    `Use this one-time verification code to finish your ${accountLabel} registration${registrationSuffix}:`,
    '',
    code,
    '',
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    `If you did not request this code, you can ignore this email.`,
  ].join('\n')

  const htmlBody = `
    <div style="margin:0; padding:0; background-color:#f3f7f4;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        Your PWD verification code is ${code}. Finish your ${accountLabel} registration${registrationSubjectName ? ` for ${safeRegistrationNameHtml}` : ''}.
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f3f7f4; margin:0; padding:0;">
        <tr>
          <td align="center" style="padding:32px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:#ffffff; border:1px solid #dbe7df; border-radius:28px;">
              <tr>
                <td align="center" style="padding:34px 28px 20px; background:linear-gradient(180deg, #f9fcfa 0%, #f2f7f4 100%); border-bottom:1px solid #e6eeea;">
                  <div style="width:84px; height:84px; margin:0 auto 14px; border-radius:999px; background:linear-gradient(180deg, #eef8f1 0%, #deefe5 100%); color:#1f7a4e; font-size:28px; font-weight:800; line-height:84px; text-align:center;">
                    PWD
                  </div>
                  <div style="margin:0; color:#2f7a52; font-family:Arial, sans-serif; font-size:11px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase;">
                    PWD Employment Assistant
                  </div>
                  <h1 style="margin:14px 0 8px; color:#17324d; font-family:Arial, sans-serif; font-size:28px; font-weight:800; line-height:1.2;">
                    OTP Verification
                  </h1>
                  <p style="margin:0 auto; max-width:420px; color:#5f6f67; font-family:Arial, sans-serif; font-size:15px; line-height:24px;">
                    Use the one-time code below to finish your <strong>${accountLabel}</strong> registration${registrationSuffixHtml}.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:24px 28px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#fbfdfc; border:1px solid #dce7df; border-radius:20px;">
                    <tr>
                      <td style="padding:18px 20px;">
                        <div style="margin:0; color:#7b8d84; font-family:Arial, sans-serif; font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
                          Verification Email
                        </div>
                        <div style="margin:8px 0 0; color:#17324d; font-family:Arial, sans-serif; font-size:16px; font-weight:800; line-height:1.4;">
                          ${maskedEmailHtml}
                        </div>
                        <div style="margin:8px 0 0; color:#6f7f78; font-family:Arial, sans-serif; font-size:14px; line-height:22px;">
                          Enter or paste this 6-digit code on the verification page to continue.
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="padding:22px 0 8px; text-align:center;">
                    <div style="display:inline-block; padding:18px 24px; background-color:#f7faf8; border:1px solid #d9e4dc; border-radius:20px;">
                      <span style="display:inline-block; color:#0f5d8c; font-family:Arial, sans-serif; font-size:34px; font-weight:800; letter-spacing:12px;">
                        ${code}
                      </span>
                    </div>
                  </div>

                  <p style="margin:12px 0 0; color:#5f6f67; font-family:Arial, sans-serif; font-size:14px; line-height:22px; text-align:center;">
                    This code expires in <strong style="color:#17324d;">${OTP_EXPIRY_MINUTES} minutes</strong>.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-top:1px solid #e6eeea;">
                    <tr>
                      <td style="padding-top:18px; color:#73837b; font-family:Arial, sans-serif; font-size:13px; line-height:22px; text-align:center;">
                        If you did not request this code, you can safely ignore this email.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `

  return {
    subject,
    text: textBody,
    html: htmlBody,
    attachments: [],
  }
}

const assertEmployerOtpPayload = (data, { requireCode = false, requireOrganizationType = true } = {}) => {
  const email = normalizeEmail(data?.email)
  const role = normalizeRegistrationRole(data?.role || 'employer')
  const companyName = text(data?.companyName)
  const fullName = text(data?.fullName)
  const organizationType = normalizeOrganizationType(data?.organizationType)
  const code = text(data?.code).replace(/\D/g, '')

  if (!email || !isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.')
  }

  if (!role) {
    throw new HttpsError('invalid-argument', 'OTP verification is only available for applicant or employer registrations.')
  }

  if (role === 'employer' && requireOrganizationType && !organizationType) {
    throw new HttpsError('invalid-argument', 'A valid employer organization type is required.')
  }

  if (requireCode && code.length !== OTP_LENGTH) {
    throw new HttpsError('invalid-argument', 'Enter the 6-digit OTP code that was sent to your email.')
  }

  return {
    email,
    role,
    companyName,
    fullName,
    organizationType,
    code,
  }
}

const loadOtpRecord = async (email) => {
  const otpDocRef = db.collection(REGISTRATION_OTP_COLLECTION).doc(toEmployerRegistrationDocId(email))
  const otpSnapshot = await otpDocRef.get()
  return {
    otpDocRef,
    otpSnapshot,
    otpData: otpSnapshot.exists ? otpSnapshot.data() : null,
  }
}

const sendOtpEmail = async ({ email, code, companyName, organizationType, role, fullName }) => {
  requireSendGridConfig()

  const message = buildOtpEmail({
    email,
    code,
    companyName,
    organizationType,
    role,
    fullName,
  })

  await sgMail.send({
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  })
}

const assertOtpRecordMatchesPayload = (payload, otpData) => {
  if (!otpData) return

  const storedRole = normalizeRegistrationRole(otpData.role || 'employer')
  if (storedRole && payload.role !== storedRole) {
    throw new HttpsError(
      'invalid-argument',
      `This OTP request belongs to a ${storedRole} registration. Please request a new code.`,
    )
  }

  if (storedRole === 'employer') {
    const storedOrganizationType = normalizeOrganizationType(otpData.organizationType)
    if (payload.organizationType && storedOrganizationType && payload.organizationType !== storedOrganizationType) {
      throw new HttpsError(
        'invalid-argument',
        'This OTP request belongs to a different employer organization type. Please request a new code.',
      )
    }
  }
}

const HTTPS_ERROR_STATUS_MAP = {
  'cancelled': 499,
  'unknown': 500,
  'invalid-argument': 400,
  'deadline-exceeded': 408,
  'not-found': 404,
  'already-exists': 409,
  'permission-denied': 403,
  'resource-exhausted': 429,
  'failed-precondition': 400,
  'aborted': 409,
  'out-of-range': 400,
  'unimplemented': 501,
  'internal': 500,
  'unavailable': 503,
  'data-loss': 500,
  'unauthenticated': 401,
}

const readHttpPayload = (request) => {
  if (request.body && typeof request.body === 'object') {
    if (request.body.data && typeof request.body.data === 'object') {
      return request.body.data
    }

    return request.body
  }

  return {}
}

const sendHttpError = (response, error) => {
  const errorCode = text(error?.code).toLowerCase() || 'internal'
  const status = HTTPS_ERROR_STATUS_MAP[errorCode] || 500
  const message = text(error?.message) || 'Unable to process the OTP request right now.'

  response.status(status).json({
    error: {
      status: errorCode,
      message,
    },
  })
}

const persistOtpRequest = async ({
  otpDocRef,
  existingOtp,
  email,
  role,
  companyName,
  fullName,
  organizationType,
}) => {
  const now = Date.now()
  const lastSentAt = timestampToMillis(existingOtp?.lastSentAt)

  if (existingOtp?.verifiedAt) {
    throw new HttpsError('already-exists', 'This email address has already been verified.')
  }

  if (lastSentAt && now - lastSentAt < OTP_COOLDOWN_SECONDS * 1000) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - (now - lastSentAt)) / 1000),
    )

    throw new HttpsError(
      'failed-precondition',
      `Please wait ${retryAfterSeconds} seconds before requesting another OTP code.`,
    )
  }

  const resendCount = Number(existingOtp?.resendCount || 0)
  if (existingOtp && resendCount >= OTP_MAX_RESENDS) {
    throw new HttpsError(
      'resource-exhausted',
      'Too many OTP requests were made for this email. Please wait a few minutes and try again.',
    )
  }

  const nextCompanyName = companyName || text(existingOtp?.companyName)
  const nextFullName = fullName || text(existingOtp?.fullName)
  const nextOrganizationType = organizationType || normalizeOrganizationType(existingOtp?.organizationType)
  const code = createOtpCode()

  await otpDocRef.set({
    email,
    role,
    companyName: nextCompanyName,
    fullName: nextFullName,
    organizationType: role === 'employer' ? nextOrganizationType : '',
    hashedCode: hashOtp(email, code),
    attemptsRemaining: OTP_MAX_ATTEMPTS,
    resendCount: existingOtp ? resendCount + 1 : 0,
    createdAt: existingOtp?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(now + otpTtlMs),
    verifiedAt: null,
  })

  try {
    await sendOtpEmail({
      email,
      code,
      companyName: nextCompanyName,
      organizationType: nextOrganizationType,
      role,
      fullName: nextFullName,
    })
  } catch (error) {
    await otpDocRef.delete().catch(() => {})
    console.error('Failed to send OTP email', error)
    throw toSendGridHttpsError(error)
  }

  return {
    sent: true,
    email: maskEmail(email),
    expiresInSeconds: otpTtlMs / 1000,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  }
}

const sendEmployerRegistrationOtpHandler = async (rawData) => {
  const payload = assertEmployerOtpPayload(rawData, { requireOrganizationType: true })
  const { otpDocRef, otpData } = await loadOtpRecord(payload.email)

  return persistOtpRequest({
    otpDocRef,
    existingOtp: otpData,
    email: payload.email,
    role: payload.role,
    companyName: payload.companyName,
    fullName: payload.fullName,
    organizationType: payload.organizationType,
  })
}

const resendEmployerRegistrationOtpHandler = async (rawData) => {
  const payload = assertEmployerOtpPayload(rawData, { requireOrganizationType: false })
  const { otpDocRef, otpData } = await loadOtpRecord(payload.email)
  assertOtpRecordMatchesPayload(payload, otpData)

  return persistOtpRequest({
    otpDocRef,
    existingOtp: otpData,
    email: payload.email,
    role: payload.role,
    companyName: payload.companyName,
    fullName: payload.fullName,
    organizationType: payload.organizationType,
  })
}

const verifyEmployerRegistrationOtpHandler = async (rawData) => {
  const payload = assertEmployerOtpPayload(rawData, {
    requireCode: true,
    requireOrganizationType: false,
  })
  const { otpDocRef, otpData } = await loadOtpRecord(payload.email)
  const now = Date.now()

  if (!otpData) {
    throw new HttpsError('not-found', 'No OTP request was found for this email. Please request a new code.')
  }

  assertOtpRecordMatchesPayload(payload, otpData)

  if (otpData.verifiedAt) {
    await otpDocRef.set(
      {
        email: payload.email,
        role: payload.role,
        organizationType:
          payload.role === 'employer'
            ? payload.organizationType || normalizeOrganizationType(otpData.organizationType)
            : '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(now + verifiedRegistrationTtlMs),
      },
      { merge: true },
    )

    return {
      verified: true,
      email: maskEmail(payload.email),
    }
  }

  const expiresAt = timestampToMillis(otpData.expiresAt)
  if (!expiresAt || expiresAt < now) {
    await otpDocRef.delete().catch(() => {})
    throw new HttpsError('deadline-exceeded', 'This OTP code has expired. Please request a new code.')
  }

  const attemptsRemaining = Number(otpData.attemptsRemaining || OTP_MAX_ATTEMPTS)
  if (attemptsRemaining <= 0) {
    await otpDocRef.delete().catch(() => {})
    throw new HttpsError(
      'permission-denied',
      'Too many incorrect OTP attempts were made. Please request a new code.',
    )
  }

  const expectedHash = hashOtp(payload.email, payload.code)
  if (expectedHash !== otpData.hashedCode) {
    const nextAttemptsRemaining = attemptsRemaining - 1

    if (nextAttemptsRemaining <= 0) {
      await otpDocRef.delete().catch(() => {})
      throw new HttpsError(
        'permission-denied',
        'Too many incorrect OTP attempts were made. Please request a new code.',
      )
    }

    await otpDocRef.set(
      {
        attemptsRemaining: nextAttemptsRemaining,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    throw new HttpsError(
      'invalid-argument',
      `Incorrect OTP code. ${nextAttemptsRemaining} attempt${nextAttemptsRemaining === 1 ? '' : 's'} remaining.`,
    )
  }

  const verifiedAt = admin.firestore.FieldValue.serverTimestamp()
  const otpVerificationPatch = {
    email: payload.email,
    role: payload.role,
    organizationType:
      payload.role === 'employer'
        ? payload.organizationType || normalizeOrganizationType(otpData.organizationType)
        : '',
    verifiedAt,
    updatedAt: verifiedAt,
    attemptsRemaining: OTP_MAX_ATTEMPTS,
    expiresAt: admin.firestore.Timestamp.fromMillis(now + verifiedRegistrationTtlMs),
    uid: admin.firestore.FieldValue.delete(),
  }

  await otpDocRef.set(otpVerificationPatch, { merge: true })

  return {
    verified: true,
    email: maskEmail(payload.email),
  }
}

const deleteManagedAccountHandler = async (rawData, request) => {
  const { requesterUid, requesterRole } = await assertAdminRequest(request)
  const targetUid = text(rawData?.uid)
  const requestedRole = normalizeRole(rawData?.role)

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'A valid user id is required.')
  }

  if (targetUid === requesterUid) {
    throw new HttpsError('failed-precondition', 'Admins cannot delete their own account from the dashboard.')
  }

  const accountState = await loadManagedAccountState(targetUid, requestedRole)
  const userProfile = accountState.userSnapshot.exists ? accountState.userSnapshot.data() || {} : {}
  const applicantProfile = accountState.applicantSnapshot.exists ? accountState.applicantSnapshot.data() || {} : {}
  const employerProfile = accountState.employerSnapshot.exists ? accountState.employerSnapshot.data() || {} : {}
  const primaryProfile = accountState.userSnapshot.exists
    ? userProfile
    : accountState.applicantSnapshot.exists
      ? applicantProfile
      : accountState.employerSnapshot.exists
        ? employerProfile
        : {}
  const targetRole = normalizeRole(
    accountState.targetRole
    || requestedRole
    || primaryProfile.role
    || primaryProfile.user_role
    || primaryProfile.accountType,
  ) || requestedRole || 'user'
  const targetEmail = normalizeEmail(accountState.targetEmail || primaryProfile.email)
  const isApplicantTarget = targetRole === 'applicant'
  const isEmployerTarget = targetRole === 'employer'
  const workspaceOwnerId = text(
    userProfile.workspace_owner_id
    || userProfile.workspaceOwnerId
    || employerProfile.workspace_owner_id
    || employerProfile.workspaceOwnerId,
  )
  const workspaceOwnerEmail = normalizeEmail(
    userProfile.workspace_owner_email
    || userProfile.workspaceOwnerEmail
    || employerProfile.workspace_owner_email
    || employerProfile.workspaceOwnerEmail,
  )
  const workspaceOwnerRole = normalizeRole(
    userProfile.workspace_owner_role
    || userProfile.workspaceOwnerRole
    || employerProfile.workspace_owner_role
    || employerProfile.workspaceOwnerRole
    || targetRole,
  ) || 'employer'
  const isWorkspaceMember =
    userProfile.workspace_member === true
    || employerProfile.workspace_member === true
    || Boolean(workspaceOwnerId && workspaceOwnerId !== targetUid)
  const ownsWorkspace =
    isEmployerTarget
    && (
      !isWorkspaceMember
      || accountState.employerSnapshot.exists
      || workspaceOwnerId === targetUid
      || !workspaceOwnerId
    )
  const workspaceScopeId = text(ownsWorkspace ? targetUid : workspaceOwnerId)
  const workspaceScopeEmail = normalizeEmail(ownsWorkspace ? (targetEmail || workspaceOwnerEmail) : workspaceOwnerEmail)
  const businessAccountIdentityCandidates = buildBusinessAccountIdentityCandidates({
    accountState: {
      ...accountState,
      targetRole,
      targetEmail,
    },
    profile: primaryProfile,
    workspaceOwnerId: workspaceScopeId || targetUid,
    workspaceOwnerEmail: workspaceScopeEmail || targetEmail,
    workspaceOwnerRole,
  })

  const jobDocs = await collectDocsFromReadRefs([
    ...(isEmployerTarget
      ? buildCollectionEqualityReadRefs(JOBS_COLLECTION, 'employer_id', [targetUid])
      : []),
    ...(isEmployerTarget
      ? buildCollectionEqualityReadRefs(JOBS_COLLECTION, 'created_by', [targetUid])
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(JOBS_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
    ...(ownsWorkspace && targetEmail
      ? buildCollectionEqualityReadRefs(JOBS_COLLECTION, 'workspace_owner_email', [targetEmail], uniqueEmailValues)
      : []),
  ])
  const jobIds = uniqueTextValues(jobDocs.map((docSnapshot) => docSnapshot.id))

  const applicationDocs = await collectDocsFromReadRefs([
    ...buildCollectionInReadRefs(APPLY_JOBS_COLLECTION, 'job_id', jobIds),
    ...(isApplicantTarget
      ? buildCollectionEqualityReadRefs(APPLY_JOBS_COLLECTION, 'applicant_id', [targetUid])
      : []),
    ...(isApplicantTarget && targetEmail
      ? buildCollectionEqualityReadRefs(APPLY_JOBS_COLLECTION, 'applicant_email', [targetEmail], uniqueEmailValues)
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(APPLY_JOBS_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
    ...(ownsWorkspace && targetEmail
      ? buildCollectionEqualityReadRefs(APPLY_JOBS_COLLECTION, 'workspace_owner_email', [targetEmail], uniqueEmailValues)
      : []),
  ])
  const applicationIds = uniqueTextValues([
    ...applicationDocs.map((docSnapshot) => docSnapshot.id),
    ...applicationDocs.map((docSnapshot) => docSnapshot.data()?.application_id),
  ])

  const interviewDocs = await collectDocsFromReadRefs([
    ...buildCollectionInReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'application_id', applicationIds),
    ...buildCollectionInReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'job_id', jobIds),
    ...(isApplicantTarget
      ? buildCollectionEqualityReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'applicant_id', [targetUid])
      : []),
    ...(isApplicantTarget && targetEmail
      ? buildCollectionEqualityReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'applicant_email', [targetEmail], uniqueEmailValues)
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
    ...(ownsWorkspace && targetEmail
      ? buildCollectionEqualityReadRefs(BUSINESS_INTERVIEW_SCHEDULES_COLLECTION, 'workspace_owner_email', [targetEmail], uniqueEmailValues)
      : []),
  ])

  const applicantScoreDocs = await collectDocsFromReadRefs([
    ...(isApplicantTarget
      ? buildCollectionEqualityReadRefs(BUSINESS_APPLICANT_SCORE_COLLECTION, 'applicant_id', [targetUid])
      : []),
    ...(isApplicantTarget && targetEmail
      ? buildCollectionEqualityReadRefs(BUSINESS_APPLICANT_SCORE_COLLECTION, 'applicant_email', [targetEmail], uniqueEmailValues)
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(BUSINESS_APPLICANT_SCORE_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(BUSINESS_APPLICANT_SCORE_COLLECTION, 'account_identity', businessAccountIdentityCandidates)
      : []),
  ])

  const assessmentTemplateDocs = ownsWorkspace
    ? await collectDocsFromReadRefs([
      ...buildCollectionEqualityReadRefs(BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION, 'workspace_owner_id', [targetUid]),
    ])
    : []
  const trainingTemplateDocs = ownsWorkspace
    ? await collectDocsFromReadRefs([
      ...buildCollectionEqualityReadRefs(BUSINESS_TRAINING_TEMPLATE_COLLECTION, 'workspace_owner_id', [targetUid]),
    ])
    : []

  const assessmentAssignmentDocs = await collectDocsFromReadRefs([
    ...buildCollectionInReadRefs(BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION, 'application_id', applicationIds),
    ...(isApplicantTarget
      ? buildCollectionEqualityReadRefs(BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION, 'applicant_id', [targetUid])
      : []),
    ...(isApplicantTarget && targetEmail
      ? buildCollectionEqualityReadRefs(BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION, 'applicant_email', [targetEmail], uniqueEmailValues)
      : []),
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
  ])

  const trainingAssignmentDocs = await collectDocsFromReadRefs([
    ...(ownsWorkspace
      ? buildCollectionEqualityReadRefs(BUSINESS_TRAINING_ASSIGNMENT_COLLECTION, 'workspace_owner_id', [targetUid])
      : []),
    ...(isWorkspaceMember
      ? buildCollectionEqualityReadRefs(BUSINESS_TRAINING_ASSIGNMENT_COLLECTION, 'member_id', [targetUid])
      : []),
  ])
  const filteredTrainingAssignmentDocs =
    isWorkspaceMember && workspaceScopeId && !ownsWorkspace
      ? trainingAssignmentDocs.filter((docSnapshot) =>
        text(docSnapshot.data()?.workspace_owner_id) === workspaceScopeId)
      : trainingAssignmentDocs

  const paymentHistoryDocs = ownsWorkspace
    ? await collectDocsFromReadRefs([
      ...buildCollectionEqualityReadRefs(BUSINESS_PAYMENT_HISTORY_COLLECTION, 'workspace_owner_id', [targetUid]),
      ...(targetEmail
        ? buildCollectionEqualityReadRefs(BUSINESS_PAYMENT_HISTORY_COLLECTION, 'owner_email', [targetEmail], uniqueEmailValues)
        : []),
      ...buildCollectionEqualityReadRefs(BUSINESS_PAYMENT_HISTORY_COLLECTION, 'account_identity', businessAccountIdentityCandidates),
    ])
    : []

  const workspaceDirectoryDocs = ownsWorkspace
    ? [
      ...await collectWorkspaceSubcollectionDocs(targetUid, WORKSPACE_USERS_SUBCOLLECTION),
      ...await collectWorkspaceSubcollectionDocs(targetUid, MEMBER_EMPLOYER_SUBCOLLECTION),
    ]
    : await collectWorkspaceMembershipDirectoryDocs({
      workspaceOwnerId: workspaceScopeId,
      memberUid: targetUid,
    })

  let deletedWorkspaceMemberAccountsCount = 0
  if (ownsWorkspace) {
    deletedWorkspaceMemberAccountsCount = await deleteWorkspaceMemberAccounts({
      workspaceOwnerId: targetUid,
      requesterUid,
      requesterRole,
    })
  }

  const deletedJobsCount = await deleteDocumentRefs(jobDocs.map((docSnapshot) => docSnapshot.ref))
  const deletedApplicationsCount = await deleteDocumentRefs(applicationDocs.map((docSnapshot) => docSnapshot.ref))
  const deletedInterviewsCount = await deleteDocumentRefs(interviewDocs.map((docSnapshot) => docSnapshot.ref))
  const deletedApplicantScoresCount = await deleteDocumentRefs(applicantScoreDocs.map((docSnapshot) => docSnapshot.ref))
  const deletedAssessmentTemplatesCount = await deleteDocumentRefs(
    assessmentTemplateDocs.map((docSnapshot) => docSnapshot.ref),
  )
  const deletedTrainingTemplatesCount = await deleteDocumentRefs(
    trainingTemplateDocs.map((docSnapshot) => docSnapshot.ref),
  )
  const deletedAssessmentAssignmentsCount = await deleteDocumentRefs(
    assessmentAssignmentDocs.map((docSnapshot) => docSnapshot.ref),
  )
  const deletedTrainingAssignmentsCount = await deleteDocumentRefs(
    filteredTrainingAssignmentDocs.map((docSnapshot) => docSnapshot.ref),
  )
  const deletedPaymentHistoryCount = await deleteDocumentRefs(
    paymentHistoryDocs.map((docSnapshot) => docSnapshot.ref),
  )
  const deletedWorkspaceDirectoryCount = await deleteDocumentRefs(
    workspaceDirectoryDocs.map((docSnapshot) => docSnapshot.ref),
  )

  const deletedRelatedCounts = {
    applications: deletedApplicationsCount,
    interviews: deletedInterviewsCount,
    applicant_scores: deletedApplicantScoresCount,
    assessment_templates: deletedAssessmentTemplatesCount,
    training_templates: deletedTrainingTemplatesCount,
    assessment_assignments: deletedAssessmentAssignmentsCount,
    training_assignments: deletedTrainingAssignmentsCount,
    payment_history: deletedPaymentHistoryCount,
    workspace_directory_links: deletedWorkspaceDirectoryCount,
    workspace_member_accounts: deletedWorkspaceMemberAccountsCount,
  }

  const authState = await archiveAndDeleteManagedAccountState({
    accountState: {
      ...accountState,
      targetRole,
      targetEmail,
    },
    requesterUid,
    requesterRole,
    extraHistory: {
      deleted_jobs_count: deletedJobsCount,
      deleted_related_counts: deletedRelatedCounts,
      deleted_workspace_owner_id: workspaceScopeId,
      deleted_workspace_scope: ownsWorkspace ? 'workspace_owner' : isWorkspaceMember ? 'workspace_member' : '',
    },
  })

  return {
    deleted: true,
    uid: targetUid,
    role: targetRole,
    email: targetEmail,
    authState,
    deletedJobsCount,
    deletedRelatedCounts,
  }
}

const restoreDeletedManagedAccountHandler = async (rawData, request) => {
  const { requesterUid, requesterRole } = await assertAdminRequest(request)
  const targetUid = text(rawData?.uid)

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'A valid deleted user id is required.')
  }

  const deletedHistoryDocRef = db.collection(DELETED_USER_HISTORY_COLLECTION).doc(targetUid)
  const deletedHistorySnapshot = await deletedHistoryDocRef.get()

  if (!deletedHistorySnapshot.exists) {
    throw new HttpsError('not-found', 'Deleted user history was not found.')
  }

  const deletedHistory = deletedHistorySnapshot.data() || {}
  const userProfile = deletedHistory.user_profile && typeof deletedHistory.user_profile === 'object'
    ? deletedHistory.user_profile
    : null
  const applicantProfile = deletedHistory.applicant_profile && typeof deletedHistory.applicant_profile === 'object'
    ? deletedHistory.applicant_profile
    : null
  const employerProfile = deletedHistory.employer_profile && typeof deletedHistory.employer_profile === 'object'
    ? deletedHistory.employer_profile
    : null

  if (!userProfile && !applicantProfile && !employerProfile) {
    throw new HttpsError('failed-precondition', 'No stored profile snapshot is available to restore.')
  }

  const batch = db.batch()

  if (userProfile) {
    batch.set(db.collection(USERS_COLLECTION).doc(targetUid), userProfile, { merge: false })
  }

  if (applicantProfile) {
    batch.set(db.collection(APPLICANT_REGISTRATION_COLLECTION).doc(targetUid), applicantProfile, { merge: false })
  }

  if (employerProfile) {
    batch.set(db.collection(EMPLOYERS_COLLECTION).doc(targetUid), employerProfile, { merge: false })
  }

  batch.set(deletedHistoryDocRef, {
    status: 'restored',
    archived: false,
    restored_at: admin.firestore.FieldValue.serverTimestamp(),
    restored_by: requesterUid,
    restored_by_role: requesterRole,
  }, { merge: true })

  await batch.commit()

  let authState = 'missing'
  await admin.auth().updateUser(targetUid, { disabled: false }).then(() => {
    authState = 'active'
  }).catch((error) => {
    if (text(error?.code) === 'auth/user-not-found') return
    throw error
  })

  await deletedHistoryDocRef.set({
    auth_state: authState,
  }, { merge: true })

  return {
    restored: true,
    uid: targetUid,
    authState,
  }
}

const updateDeletedUserHistoryArchiveStateHandler = async (rawData, request) => {
  const { requesterUid, requesterRole } = await assertAdminRequest(request)
  const targetUid = text(rawData?.uid)

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'A valid deleted history id is required.')
  }

  const deletedHistoryDocRef = db.collection(DELETED_USER_HISTORY_COLLECTION).doc(targetUid)
  const deletedHistorySnapshot = await deletedHistoryDocRef.get()

  if (!deletedHistorySnapshot.exists) {
    throw new HttpsError('not-found', 'Deleted user history was not found.')
  }

  await deletedHistoryDocRef.set({
    archived: rawData?.archived === true,
    archive_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    archive_updated_by: requesterUid,
    archive_updated_by_role: requesterRole,
  }, { merge: true })

  return {
    updated: true,
    uid: targetUid,
    archived: rawData?.archived === true,
  }
}

const deleteDeletedUserHistoryRecordHandler = async (rawData, request) => {
  await assertAdminRequest(request)
  const targetUid = text(rawData?.uid)

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'A valid deleted history id is required.')
  }

  const deletedHistoryDocRef = db.collection(DELETED_USER_HISTORY_COLLECTION).doc(targetUid)
  const deletedHistorySnapshot = await deletedHistoryDocRef.get()

  if (!deletedHistorySnapshot.exists) {
    throw new HttpsError('not-found', 'Deleted user history was not found.')
  }

  await deletedHistoryDocRef.delete()

  return {
    deleted: true,
    uid: targetUid,
  }
}

const createBusinessPayMongoCheckoutSessionHandler = async (rawData, request) => {
  const requesterUid = text(request?.auth?.uid)
  const requesterEmail = normalizeEmail(request?.auth?.token?.email)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in before starting a PayMongo checkout.')
  }

  const paymentMethodType = text(rawData?.paymentMethodType).toLowerCase()
  const amountInCentavos = Number(rawData?.amountInCentavos)
  const successUrl = text(rawData?.successUrl)
  const cancelUrl = text(rawData?.cancelUrl)
  const billingName = text(rawData?.billingName)
  const billingEmail = normalizeEmail(rawData?.billingEmail || requesterEmail)
  const billingPhone = text(rawData?.billingPhone)
  const lineItemName = text(rawData?.lineItemName) || 'Business Subscription'
  const description = text(rawData?.description) || 'Business subscription payment'

  if (paymentMethodType !== 'gcash') {
    throw new HttpsError('invalid-argument', 'Only GCash checkout is supported in this flow.')
  }

  if (!Number.isFinite(amountInCentavos) || amountInCentavos <= 0) {
    throw new HttpsError('invalid-argument', 'A valid payment amount is required.')
  }

  if (!billingName) {
    throw new HttpsError('invalid-argument', 'Billing name is required.')
  }

  if (!isValidEmail(billingEmail)) {
    throw new HttpsError('invalid-argument', 'A valid billing email is required.')
  }

  if (!isValidHttpUrl(successUrl) || !isValidHttpUrl(cancelUrl)) {
    throw new HttpsError('invalid-argument', 'Valid success and cancel URLs are required.')
  }

  const payload = await callPayMongoApi('/checkout_sessions', {
    method: 'POST',
    body: {
      data: {
        attributes: {
          billing: {
            name: billingName,
            email: billingEmail,
            phone: billingPhone || undefined,
          },
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description,
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              name: lineItemName,
              quantity: 1,
            },
          ],
          payment_method_types: ['gcash'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            workspace_owner_uid: requesterUid,
            workspace_owner_email: billingEmail,
            subscription_plan_id: text(rawData?.subscriptionPlanId),
            receipt_code: text(rawData?.receiptCode),
            account_identity: text(rawData?.accountIdentity),
          },
        },
      },
    },
  })

  return {
    checkoutSessionId: text(payload?.data?.id),
    checkoutUrl: text(payload?.data?.attributes?.checkout_url),
    status: text(payload?.data?.attributes?.status || 'pending'),
  }
}

const verifyBusinessPayMongoCheckoutSessionHandler = async (rawData, request) => {
  const requesterUid = text(request?.auth?.uid)
  const checkoutSessionId = text(rawData?.checkoutSessionId)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in before verifying a PayMongo checkout.')
  }

  if (!checkoutSessionId) {
    throw new HttpsError('invalid-argument', 'A valid checkout session id is required.')
  }

  const payload = await callPayMongoApi(`/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`)
  const attributes = payload?.data?.attributes || {}
  const paymentIntentStatus = text(
    attributes?.payment_intent?.attributes?.status
    || attributes?.payment_intent?.status,
  ).toLowerCase()
  const paymentStatuses = (Array.isArray(attributes?.payments) ? attributes.payments : [])
    .map((entry) => text(entry?.attributes?.status || entry?.status).toLowerCase())
    .filter(Boolean)
  const checkoutStatus = text(attributes?.status).toLowerCase()
  const isPaid =
    paymentIntentStatus === 'succeeded'
    || paymentStatuses.includes('paid')
    || paymentStatuses.includes('succeeded')

  return {
    checkoutSessionId,
    checkoutStatus,
    paymentIntentStatus,
    paymentStatuses,
    isPaid,
  }
}

exports.sendEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  sendEmployerRegistrationOtpHandler(request.data))

exports.resendEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  resendEmployerRegistrationOtpHandler(request.data))

exports.verifyEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  verifyEmployerRegistrationOtpHandler(request.data))

exports.deleteManagedAccount = onCall(async (request) =>
  deleteManagedAccountHandler(request.data, request))

exports.restoreDeletedManagedAccount = onCall(async (request) =>
  restoreDeletedManagedAccountHandler(request.data, request))

exports.updateDeletedUserHistoryArchiveState = onCall(async (request) =>
  updateDeletedUserHistoryArchiveStateHandler(request.data, request))

exports.deleteDeletedUserHistoryRecord = onCall(async (request) =>
  deleteDeletedUserHistoryRecordHandler(request.data, request))

exports.publishBusinessJobPost = onCall(async (request) =>
  publishBusinessJobPostHandler(request.data, request))

exports.updateBusinessJobPost = onCall(async (request) =>
  updateBusinessJobPostHandler(request.data, request))

exports.deleteBusinessJobPost = onCall(async (request) =>
  deleteBusinessJobPostHandler(request.data, request))

exports.createBusinessPayMongoCheckoutSession = onCall(async (request) =>
  createBusinessPayMongoCheckoutSessionHandler(request.data, request))

exports.verifyBusinessPayMongoCheckoutSession = onCall(async (request) =>
  verifyBusinessPayMongoCheckoutSessionHandler(request.data, request))

exports.sendEmployerRegistrationOtpHttp = onRequest(publicHttpOptions, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: { status: 'method-not-allowed', message: 'Use POST for this endpoint.' } })
    return
  }

  try {
    const result = await sendEmployerRegistrationOtpHandler(readHttpPayload(request))
    response.status(200).json(result)
  } catch (error) {
    console.error('HTTP send employer OTP failed', error)
    sendHttpError(response, error)
  }
})

exports.resendEmployerRegistrationOtpHttp = onRequest(publicHttpOptions, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: { status: 'method-not-allowed', message: 'Use POST for this endpoint.' } })
    return
  }

  try {
    const result = await resendEmployerRegistrationOtpHandler(readHttpPayload(request))
    response.status(200).json(result)
  } catch (error) {
    console.error('HTTP resend employer OTP failed', error)
    sendHttpError(response, error)
  }
})

exports.verifyEmployerRegistrationOtpHttp = onRequest(publicHttpOptions, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: { status: 'method-not-allowed', message: 'Use POST for this endpoint.' } })
    return
  }

  try {
    const result = await verifyEmployerRegistrationOtpHandler(readHttpPayload(request))
    response.status(200).json(result)
  } catch (error) {
    console.error('HTTP verify employer OTP failed', error)
    sendHttpError(response, error)
  }
})
