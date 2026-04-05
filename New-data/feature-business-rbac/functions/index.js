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

const db = admin.firestore()

const USERS_COLLECTION = 'users'
const EMPLOYERS_COLLECTION = 'employers'
const JOBS_COLLECTION = 'jobs'
const WORKSPACE_USERS_SUBCOLLECTION = 'workspace_users'
const APPLICANT_REGISTRATION_COLLECTION = 'applicant_registration'
const DELETED_USER_HISTORY_COLLECTION = 'deleted_user_history'
const REGISTRATION_OTP_COLLECTION = 'employer_registration'
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
const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)]),
  )
}
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

const normalizePermissionModulePermissions = (permissions = {}) => ({
  view: permissions?.view === true,
  edit: permissions?.edit === true,
  full: permissions?.full === true,
})

const sanitizeWorkspacePermissionRoleSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null

  return {
    id: text(snapshot.id),
    name: text(snapshot.name),
    color: text(snapshot.color),
    modules: Array.isArray(snapshot.modules)
      ? snapshot.modules
          .map((module) => ({
            id: text(module?.id),
            label: text(module?.label),
            description: text(module?.description),
            sectionId: text(module?.sectionId),
            sectionLabel: text(module?.sectionLabel),
            permissions: normalizePermissionModulePermissions(module?.permissions),
          }))
          .filter((module) => module.id)
      : [],
  }
}

const sanitizeWorkspacePermissionRoles = (roles = []) => {
  if (!Array.isArray(roles)) return []

  const seenRoleIds = new Set()

  return roles
    .map((role, index) => {
      const sanitizedRole = sanitizeWorkspacePermissionRoleSnapshot(role)
      const roleId = text(sanitizedRole?.id)

      if (!roleId || seenRoleIds.has(roleId)) return null
      seenRoleIds.add(roleId)

      return {
        ...sanitizedRole,
        id: roleId,
        name: text(sanitizedRole?.name) || `Role ${index + 1}`,
        color: text(sanitizedRole?.color),
      }
    })
    .filter(Boolean)
}

const getWorkspacePermissionRoleSnapshotFromProfile = (profile = {}) =>
  sanitizeWorkspacePermissionRoleSnapshot(
    profile?.permissionRoleSnapshot || profile?.workspace_permission_role,
  )

const hasWorkspaceModuleEditAccess = (profile = {}, moduleId) => {
  const requesterRole = getRoleFromValue(profile?.role)
  const isWorkspaceMember = profile?.workspace_member === true || Boolean(text(profile?.workspace_owner_id))

  if (ADMIN_ROLES.has(requesterRole)) {
    return true
  }

  if (
    requesterRole === 'employer'
    && normalizeOrganizationType(profile?.company_organization_type) === 'business'
    && !isWorkspaceMember
  ) {
    return true
  }

  const roleSnapshot = getWorkspacePermissionRoleSnapshotFromProfile(profile)
  const matchedModule = Array.isArray(roleSnapshot?.modules)
    ? roleSnapshot.modules.find((module) => module.id === text(moduleId))
    : null
  const permissions = normalizePermissionModulePermissions(matchedModule?.permissions)

  return permissions.edit === true || permissions.full === true
}

const getRoleFromValue = (value) => normalizeRole(value)

const toEmployerCollectionRecord = (profile) => ({
  id: profile.id,
  uid: profile.id,
  approval_status: text(profile.approval_status) || 'pending',
  email_verified: profile.email_verified === true,
  email_verified_at: text(profile.email_verified_at),
  created_at: text(profile.created_at),
  reviewed_at: text(profile.reviewed_at),
  rejection_reason: text(profile.rejection_reason),
  ban_reason: text(profile.ban_reason),
  ban_duration: text(profile.ban_duration),
  banned_until: text(profile.banned_until),
  name: text(profile.name || profile.company_name),
  email: normalizeEmail(profile.email),
  company_name: text(profile.company_name || profile.name),
  company_category: text(profile.company_category),
  company_location: text(profile.company_location),
  company_contact_number: text(profile.company_contact_number),
  company_organization_type: normalizeOrganizationType(profile.company_organization_type),
  company_verification_document_1_path: text(profile.company_verification_document_1_path),
  company_verification_document_2_path: text(profile.company_verification_document_2_path),
  company_verification_document_3_path: text(profile.company_verification_document_3_path),
  role: 'employer',
  account_type: normalizeOrganizationType(profile.company_organization_type),
  user: {
    id: profile.id,
    email: normalizeEmail(profile.email),
    name: text(profile.name || profile.company_name),
    role: 'employer',
  },
})

const getWorkspaceUserDocRef = (workspaceOwnerId, workspaceUserId) =>
  db.collection(EMPLOYERS_COLLECTION)
    .doc(text(workspaceOwnerId))
    .collection(WORKSPACE_USERS_SUBCOLLECTION)
    .doc(text(workspaceUserId))

const toWorkspaceUserCollectionRecord = (profile) => {
  const roleId = text(profile?.roleId || profile?.permissionRoleId)
  const permissionRoleSnapshot = getWorkspacePermissionRoleSnapshotFromProfile(profile)
  const permissionRoleName = text(profile?.permissionRoleName || permissionRoleSnapshot?.name)
  const workspaceOwnerId = text(profile?.workspace_owner_id)
  const workspaceOwnerEmail = normalizeEmail(profile?.workspace_owner_email)
  const workspaceOwnerRole = normalizeRole(profile?.workspace_owner_role)
  const workspaceOwnerName = text(profile?.workspace_owner_name)
  const businessContactEmail = normalizeEmail(profile?.business_contact_email || profile?.email)
  const accountType = normalizeOrganizationType(profile?.company_organization_type)

  return stripUndefined({
    id: text(profile?.id || profile?.uid),
    uid: text(profile?.uid || profile?.id),
    approval_status: text(profile?.approval_status) || 'approved',
    email_verified: profile?.email_verified === true,
    email_verified_at: text(profile?.email_verified_at),
    created_at: text(profile?.created_at),
    reviewed_at: text(profile?.reviewed_at),
    rejection_reason: text(profile?.rejection_reason),
    ban_reason: text(profile?.ban_reason),
    ban_duration: text(profile?.ban_duration),
    banned_until: text(profile?.banned_until),
    name: text(profile?.name || profile?.company_name),
    email: normalizeEmail(profile?.email),
    business_contact_email: businessContactEmail || undefined,
    company_name: text(profile?.company_name || profile?.name),
    company_category: text(profile?.company_category),
    company_location: text(profile?.company_location),
    company_contact_number: text(profile?.company_contact_number),
    company_organization_type: accountType,
    role: 'employer',
    account_type: accountType,
    roleId: roleId || undefined,
    permissionRoleId: roleId || undefined,
    permissionRoleName: permissionRoleName || undefined,
    permissionRoleSnapshot: permissionRoleSnapshot || undefined,
    workspace_permission_role: permissionRoleSnapshot || undefined,
    workspace_member: true,
    workspace_owner_id: workspaceOwnerId || undefined,
    workspace_owner_email: workspaceOwnerEmail || undefined,
    workspace_owner_role: workspaceOwnerRole || undefined,
    workspace_owner_name: workspaceOwnerName || undefined,
    user: stripUndefined({
      id: text(profile?.id || profile?.uid),
      email: normalizeEmail(profile?.email),
      name: text(profile?.name || profile?.company_name),
      role: 'employer',
      permission_role_id: roleId || undefined,
      permission_role_name: permissionRoleName || undefined,
    }),
  })
}

const assertAdminRequest = async (request) => {
  const requesterUid = text(request?.auth?.uid)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in as an admin before deleting accounts.')
  }

  const requesterSnapshot = await db.collection(USERS_COLLECTION).doc(requesterUid).get()
  const requesterRole = getRoleFromValue(requesterSnapshot.data()?.role)

  if (!ADMIN_ROLES.has(requesterRole)) {
    throw new HttpsError('permission-denied', 'Only admins can delete managed accounts.')
  }

  return {
    requesterUid,
    requesterRole,
  }
}

const assertWorkspaceUserCreatorRequest = async (request) => {
  const requesterUid = text(request?.auth?.uid)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in before creating workspace users.')
  }

  const requesterSnapshot = await db.collection(USERS_COLLECTION).doc(requesterUid).get()
  const requesterProfile = requesterSnapshot.data() || {}
  const requesterRole = getRoleFromValue(requesterProfile.role)

  if (ADMIN_ROLES.has(requesterRole)) {
    return {
      requesterUid,
      requesterRole,
      requesterProfile,
    }
  }

  if (requesterRole !== 'employer') {
    throw new HttpsError('permission-denied', 'Only employer accounts can create workspace users.')
  }

  if (normalizeOrganizationType(requesterProfile.company_organization_type) !== 'business') {
    throw new HttpsError('permission-denied', 'Only business workspace accounts can create workspace users.')
  }

  return {
    requesterUid,
    requesterRole,
    requesterProfile,
  }
}

const assertWorkspacePermissionManagerRequest = async (request) => {
  const requesterUid = text(request?.auth?.uid)

  if (!requesterUid) {
    throw new HttpsError('unauthenticated', 'Sign in before saving workspace permissions.')
  }

  const requesterSnapshot = await db.collection(USERS_COLLECTION).doc(requesterUid).get()
  const requesterProfile = requesterSnapshot.data() || {}
  const requesterRole = getRoleFromValue(requesterProfile.role)

  if (ADMIN_ROLES.has(requesterRole)) {
    return {
      requesterUid,
      requesterRole,
      requesterProfile,
      workspaceOwnerId: requesterUid,
    }
  }

  if (requesterRole !== 'employer') {
    throw new HttpsError('permission-denied', 'Only employer accounts can manage workspace permissions.')
  }

  if (normalizeOrganizationType(requesterProfile.company_organization_type) !== 'business') {
    throw new HttpsError('permission-denied', 'Only business workspace accounts can manage workspace permissions.')
  }

  if (!hasWorkspaceModuleEditAccess(requesterProfile, 'permissions')) {
    throw new HttpsError('permission-denied', 'Your account is not allowed to manage workspace permissions.')
  }

  return {
    requesterUid,
    requesterRole,
    requesterProfile,
    workspaceOwnerId: text(requesterProfile.workspace_owner_id || requesterUid),
  }
}

const assertWorkspaceDirectoryManagerRequest = async (request, rawData = {}) => {
  const { requesterUid, requesterRole, requesterProfile } = await assertWorkspaceUserCreatorRequest(request)
  const workspaceOwnerId = text(
    rawData?.workspaceOwnerId || requesterProfile.workspace_owner_id || requesterUid,
  )

  if (!workspaceOwnerId) {
    throw new HttpsError('failed-precondition', 'The business workspace owner could not be determined.')
  }

  const workspaceOwnerSnapshot = await db.collection(USERS_COLLECTION).doc(workspaceOwnerId).get()

  if (!workspaceOwnerSnapshot.exists) {
    throw new HttpsError('not-found', 'The business workspace owner profile was not found.')
  }

  const workspaceOwnerProfile = workspaceOwnerSnapshot.data() || {}
  const workspaceOwnerRole = getRoleFromValue(workspaceOwnerProfile.role)

  if (
    !ADMIN_ROLES.has(requesterRole)
    && (
      workspaceOwnerRole !== 'employer'
      || normalizeOrganizationType(workspaceOwnerProfile.company_organization_type) !== 'business'
    )
  ) {
    throw new HttpsError('failed-precondition', 'The target workspace owner is not a business account.')
  }

  return {
    requesterUid,
    requesterRole,
    requesterProfile,
    workspaceOwnerId,
    workspaceOwnerProfile,
  }
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const otpTtlMs = OTP_EXPIRY_MINUTES * 60 * 1000
const verifiedRegistrationTtlMs = VERIFIED_REGISTRATION_TTL_MINUTES * 60 * 1000
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

const maskEmail = (email) => {
  const normalized = normalizeEmail(email)
  const [localPart, domainPart] = normalized.split('@')
  if (!localPart || !domainPart) return normalized

  const visiblePrefix = localPart.slice(0, 2)
  const hiddenPart = Math.max(localPart.length - visiblePrefix.length, 1)
  return `${visiblePrefix}${'*'.repeat(hiddenPart)}@${domainPart}`
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

const requireSendGridConfig = () => {
  if (!text(process.env.SENDGRID_API_KEY) || !text(process.env.SENDGRID_FROM_EMAIL)) {
    throw new HttpsError(
      'failed-precondition',
      'OTP email delivery is not configured yet. Add the SendGrid environment variables first.',
    )
  }
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

const syncBusinessWorkspaceUserDirectoryHandler = async (rawData, request) => {
  const { workspaceOwnerId } = await assertWorkspaceDirectoryManagerRequest(request, rawData)
  const workspaceDirectoryCollectionRef = db.collection(EMPLOYERS_COLLECTION)
    .doc(workspaceOwnerId)
    .collection(WORKSPACE_USERS_SUBCOLLECTION)
  const [workspaceUsersSnapshot, existingDirectorySnapshot] = await Promise.all([
    db.collection(USERS_COLLECTION)
      .where('workspace_owner_id', '==', workspaceOwnerId)
      .where('role', '==', 'employer')
      .get(),
    workspaceDirectoryCollectionRef.get(),
  ])

  const batch = db.batch()
  const syncedWorkspaceUserIds = new Set()

  workspaceUsersSnapshot.docs.forEach((workspaceUserSnapshot) => {
    const workspaceUserProfile = {
      id: workspaceUserSnapshot.id,
      uid: workspaceUserSnapshot.id,
      ...workspaceUserSnapshot.data(),
    }

    syncedWorkspaceUserIds.add(workspaceUserSnapshot.id)
    batch.set(
      getWorkspaceUserDocRef(workspaceOwnerId, workspaceUserSnapshot.id),
      toWorkspaceUserCollectionRecord(workspaceUserProfile),
      { merge: false },
    )
  })

  existingDirectorySnapshot.docs.forEach((workspaceUserSnapshot) => {
    if (!syncedWorkspaceUserIds.has(workspaceUserSnapshot.id)) {
      batch.delete(workspaceUserSnapshot.ref)
    }
  })

  await batch.commit()

  return {
    synced: true,
    workspaceOwnerId,
    syncedWorkspaceUserCount: syncedWorkspaceUserIds.size,
  }
}

const createBusinessWorkspaceUserHandler = async (rawData, request) => {
  const { requesterUid, requesterProfile } = await assertWorkspaceUserCreatorRequest(request)
  const fullName = text(rawData?.fullName)
  const email = normalizeEmail(rawData?.email)
  const password = String(rawData?.password || '')
  const roleId = text(rawData?.roleId || rawData?.permissionRoleId)

  if (!fullName || !email || !password.trim() || !roleId) {
    throw new HttpsError(
      'invalid-argument',
      'Please complete the full name, email, password, and assigned role fields.',
    )
  }

  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  }

  if (password.trim().length < 8) {
    throw new HttpsError('invalid-argument', 'Temporary password must be at least 8 characters long.')
  }

  const workspaceOwnerId = text(
    rawData?.workspaceOwnerId || requesterProfile.workspace_owner_id || requesterUid,
  )
  const workspaceOwnerEmail = normalizeEmail(
    rawData?.workspaceOwnerEmail
    || requesterProfile.workspace_owner_email
    || requesterProfile.business_contact_email
    || requesterProfile.email,
  )
  const workspaceOwnerRole = normalizeRole(
    rawData?.workspaceOwnerRole || requesterProfile.workspace_owner_role || requesterProfile.role || 'employer',
  ) || 'employer'
  const workspaceOwnerName = text(
    rawData?.workspaceOwnerName
    || requesterProfile.workspace_owner_name
    || requesterProfile.company_name
    || requesterProfile.name,
  )

  if (!workspaceOwnerId || !workspaceOwnerEmail) {
    throw new HttpsError(
      'failed-precondition',
      'The business workspace owner details are missing. Refresh the page and try again.',
    )
  }

  const permissionRoleSnapshot = sanitizeWorkspacePermissionRoleSnapshot(rawData?.permissionRoleSnapshot)
  const permissionRoleName = text(rawData?.permissionRoleName || permissionRoleSnapshot?.name)
  const companyOrganizationType = normalizeOrganizationType(
    rawData?.companyOrganizationType || requesterProfile.company_organization_type || 'business',
  ) || 'business'
  const createdAt = new Date().toISOString()

  let authUserRecord

  try {
    authUserRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
      disabled: false,
    })
  } catch (error) {
    const code = text(error?.code)

    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'This email address already has an account.')
    }

    if (code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'Enter a valid email address.')
    }

    if (code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Temporary password must be at least 6 characters long.')
    }

    throw new HttpsError('internal', 'Unable to create the workspace user authentication record right now.')
  }

  const profile = stripUndefined({
    id: authUserRecord.uid,
    uid: authUserRecord.uid,
    email,
    role: 'employer',
    name: fullName,
    approval_status: 'approved',
    email_verified: true,
    email_verified_at: createdAt,
    created_at: createdAt,
    reviewed_at: createdAt,
    rejection_reason: '',
    ban_reason: '',
    ban_duration: '',
    banned_until: '',
    business_contact_email: workspaceOwnerEmail,
    company_name: text(rawData?.companyName || requesterProfile.company_name || workspaceOwnerName) || 'Business Workspace',
    company_category: text(rawData?.companyCategory || requesterProfile.company_category),
    company_location: text(rawData?.companyLocation || requesterProfile.company_location),
    company_contact_number: text(rawData?.companyContactNumber || requesterProfile.company_contact_number),
    company_organization_type: companyOrganizationType,
    company_verification_document_1_path: '',
    company_verification_document_2_path: '',
    company_verification_document_3_path: '',
    roleId,
    permissionRoleId: roleId,
    permissionRoleName: permissionRoleName || undefined,
    permissionRoleSnapshot: permissionRoleSnapshot || undefined,
    workspace_permission_role: permissionRoleSnapshot || undefined,
    workspace_member: true,
    workspace_owner_id: workspaceOwnerId,
    workspace_owner_email: workspaceOwnerEmail,
    workspace_owner_role: workspaceOwnerRole,
    workspace_owner_name: workspaceOwnerName || undefined,
  })

  const batch = db.batch()
  batch.set(db.collection(USERS_COLLECTION).doc(authUserRecord.uid), profile, { merge: false })
  batch.set(
    db.collection(EMPLOYERS_COLLECTION).doc(authUserRecord.uid),
    toEmployerCollectionRecord(profile),
    { merge: false },
  )
  batch.set(
    getWorkspaceUserDocRef(workspaceOwnerId, authUserRecord.uid),
    toWorkspaceUserCollectionRecord(profile),
    { merge: false },
  )

  try {
    await batch.commit()
  } catch (error) {
    console.error('createBusinessWorkspaceUser Firestore save failed', error)
    await admin.auth().deleteUser(authUserRecord.uid).catch(() => {})
    throw new HttpsError('internal', 'Unable to save the new workspace user right now.')
  }

  return {
    user: profile,
  }
}

const publishBusinessJobPostHandler = async (rawData, request) => {
  const { requesterUid, requesterProfile, workspaceOwnerId, workspaceOwnerProfile } =
    await assertWorkspaceDirectoryManagerRequest(request, rawData)

  if (
    !ADMIN_ROLES.has(getRoleFromValue(requesterProfile.role))
    && !hasWorkspaceModuleEditAccess(requesterProfile, 'job-posting')
  ) {
    throw new HttpsError('permission-denied', 'Your account is not allowed to publish job posts.')
  }

  const title = text(rawData?.title)
  const companyName = text(rawData?.companyName || workspaceOwnerProfile?.company_name || workspaceOwnerProfile?.name)
  const description = text(rawData?.description)
  const category = text(rawData?.category)
  const type = text(rawData?.type)
  const city = text(rawData?.location)
  const barangay = text(rawData?.barangay)
  const salary = text(rawData?.salary || rawData?.salaryRange)
  const disabilityType = text(rawData?.disabilityType)
  const preferredAgeRange = text(rawData?.preferredAgeRange)
  const createdBy = text(rawData?.createdBy || rawData?.created_by || requesterUid)
  const vacancies = Math.max(1, Number(rawData?.vacancies || 1) || 1)

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
    || !createdBy
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Please complete all required job post details before publishing.',
    )
  }

  if (createdBy !== requesterUid) {
    throw new HttpsError('permission-denied', 'Job posts must be published by the signed-in account.')
  }

  const createdAt = new Date().toISOString()
  const location = [city, barangay].filter(Boolean).join(', ')
  const workspaceOwnerEmail = normalizeEmail(
    rawData?.workspaceOwnerEmail
    || requesterProfile?.workspace_owner_email
    || workspaceOwnerProfile?.business_contact_email
    || workspaceOwnerProfile?.email,
  )

  const jobDocument = stripUndefined({
    title,
    companyName,
    company_name: companyName,
    logoUrl: text(rawData?.logoUrl || rawData?.companyLogoUrl),
    companyLogoUrl: text(rawData?.logoUrl || rawData?.companyLogoUrl),
    description,
    category,
    type,
    setup: text(rawData?.setup || type),
    city,
    barangay,
    location: location || city,
    vacancies,
    salary,
    salaryRange: text(rawData?.salaryRange || salary),
    disabilityType,
    impairmentSpecification: text(rawData?.impairmentSpecification),
    preferredAgeRange,
    language: text(rawData?.language),
    languages: normalizeTextList(rawData?.languages ?? rawData?.language, /,/),
    qualifications: normalizeTextList(rawData?.qualifications),
    responsibilities: normalizeTextList(rawData?.responsibilities),
    status: normalizeJobStatus(rawData?.status || 'open'),
    createdAt,
    created_at: createdAt,
    updatedAt: createdAt,
    updated_at: createdAt,
    workspace_owner_id: workspaceOwnerId,
    workspace_owner_email: workspaceOwnerEmail || undefined,
    employer_id: requesterUid,
    created_by: createdBy,
  })

  const jobDocRef = db.collection(JOBS_COLLECTION).doc()

  try {
    await jobDocRef.set(jobDocument, { merge: false })
  } catch (error) {
    console.error('publishBusinessJobPost Firestore save failed', error)
    throw new HttpsError('internal', 'Unable to save the new job post right now.')
  }

  return {
    job: {
      id: jobDocRef.id,
      ...jobDocument,
    },
  }
}

const assertManagedJobPostRequest = async (rawData, request) => {
  const {
    requesterUid,
    requesterRole,
    requesterProfile,
    workspaceOwnerId,
    workspaceOwnerProfile,
  } = await assertWorkspaceDirectoryManagerRequest(request, rawData)
  const jobId = text(rawData?.jobId)

  if (!jobId) {
    throw new HttpsError('invalid-argument', 'Select a job post first.')
  }

  if (
    !ADMIN_ROLES.has(requesterRole)
    && !hasWorkspaceModuleEditAccess(requesterProfile, 'job-posting')
  ) {
    throw new HttpsError('permission-denied', 'Your account is not allowed to manage job posts.')
  }

  const jobDocRef = db.collection(JOBS_COLLECTION).doc(jobId)
  const jobSnapshot = await jobDocRef.get()

  if (!jobSnapshot.exists) {
    throw new HttpsError('not-found', 'The selected job post was not found.')
  }

  const existingJob = jobSnapshot.data() || {}

  if (
    !ADMIN_ROLES.has(requesterRole)
    && text(existingJob.workspace_owner_id) !== workspaceOwnerId
  ) {
    throw new HttpsError('permission-denied', 'Your account is not allowed to manage this job post.')
  }

  return {
    requesterUid,
    requesterRole,
    requesterProfile,
    workspaceOwnerId,
    workspaceOwnerProfile,
    jobId,
    jobDocRef,
    existingJob,
  }
}

const updateBusinessJobPostHandler = async (rawData, request) => {
  const {
    requesterUid,
    requesterRole,
    requesterProfile,
    workspaceOwnerId,
    workspaceOwnerProfile,
    jobId,
    jobDocRef,
    existingJob,
  } = await assertManagedJobPostRequest(rawData, request)

  const isAdminRequester = ADMIN_ROLES.has(requesterRole)
  const isWorkspaceOwnerRequester = requesterUid === workspaceOwnerId
  const mergedJob = {
    ...existingJob,
    ...rawData,
  }
  const title = text(mergedJob?.title)
  const companyName = text(mergedJob?.companyName || mergedJob?.company_name || workspaceOwnerProfile?.company_name || workspaceOwnerProfile?.name)
  const description = text(mergedJob?.description)
  const category = text(mergedJob?.category)
  const type = text(mergedJob?.type)
  const city = text(mergedJob?.location || mergedJob?.city)
  const barangay = text(mergedJob?.barangay)
  const salary = text(mergedJob?.salary || mergedJob?.salaryRange)
  const disabilityType = text(mergedJob?.disabilityType)
  const preferredAgeRange = text(mergedJob?.preferredAgeRange)
  const createdBy = text(existingJob?.created_by || requesterUid)

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
    || !createdBy
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Please complete all required job post details before saving changes.',
    )
  }

  if (!isAdminRequester && !isWorkspaceOwnerRequester && createdBy !== requesterUid) {
    throw new HttpsError('permission-denied', 'Only the business owner or the original publisher can update this job post.')
  }

  const updatedAt = new Date().toISOString()
  const location = [city, barangay].filter(Boolean).join(', ')
  const workspaceOwnerEmail = normalizeEmail(
    mergedJob?.workspaceOwnerEmail
    || mergedJob?.workspace_owner_email
    || requesterProfile?.workspace_owner_email
    || workspaceOwnerProfile?.business_contact_email
    || workspaceOwnerProfile?.email,
  )

  const nextJobDocument = stripUndefined({
    title,
    companyName,
    company_name: companyName,
    logoUrl: text(mergedJob?.logoUrl || mergedJob?.companyLogoUrl),
    companyLogoUrl: text(mergedJob?.logoUrl || mergedJob?.companyLogoUrl),
    description,
    category,
    type,
    setup: text(mergedJob?.setup || type),
    city,
    barangay,
    location: location || city,
    vacancies: Math.max(1, Number(mergedJob?.vacancies || 1) || 1),
    salary,
    salaryRange: text(mergedJob?.salaryRange || salary),
    disabilityType,
    impairmentSpecification: text(mergedJob?.impairmentSpecification),
    preferredAgeRange,
    language: text(mergedJob?.language),
    languages: normalizeTextList(mergedJob?.languages ?? mergedJob?.language, /,/),
    qualifications: normalizeTextList(mergedJob?.qualifications),
    responsibilities: normalizeTextList(mergedJob?.responsibilities),
    status: normalizeJobStatus(mergedJob?.status || existingJob?.status || 'open'),
    createdAt: text(existingJob?.createdAt || existingJob?.created_at),
    created_at: text(existingJob?.created_at || existingJob?.createdAt),
    updatedAt,
    updated_at: updatedAt,
    workspace_owner_id: text(existingJob?.workspace_owner_id || workspaceOwnerId),
    workspace_owner_email: workspaceOwnerEmail || undefined,
    employer_id: text(existingJob?.employer_id || requesterUid),
    created_by: createdBy,
  })

  try {
    await jobDocRef.set(nextJobDocument, { merge: false })
  } catch (error) {
    console.error('updateBusinessJobPost Firestore save failed', error)
    throw new HttpsError('internal', 'Unable to save the job post changes right now.')
  }

  return {
    job: {
      id: jobId,
      ...nextJobDocument,
    },
  }
}

const deleteBusinessJobPostHandler = async (rawData, request) => {
  const {
    requesterUid,
    requesterRole,
    workspaceOwnerId,
    existingJob,
    jobId,
    jobDocRef,
  } = await assertManagedJobPostRequest(rawData, request)
  const isWorkspaceOwnerRequester = requesterUid === workspaceOwnerId

  if (
    !ADMIN_ROLES.has(requesterRole)
    && !isWorkspaceOwnerRequester
    && text(existingJob?.created_by) !== requesterUid
  ) {
    throw new HttpsError('permission-denied', 'Only the business owner or the original publisher can delete this job post.')
  }

  try {
    await jobDocRef.delete()
  } catch (error) {
    console.error('deleteBusinessJobPost Firestore delete failed', error)
    throw new HttpsError('internal', 'Unable to delete the job post right now.')
  }

  return {
    deleted: true,
    jobId,
  }
}

const saveBusinessWorkspacePermissionsHandler = async (rawData, request) => {
  const {
    requesterUid,
    workspaceOwnerId,
  } = await assertWorkspacePermissionManagerRequest(request)
  await assertWorkspaceDirectoryManagerRequest(request, { workspaceOwnerId })
  const roles = sanitizeWorkspacePermissionRoles(rawData?.roles)
  const selectedRoleId = text(rawData?.selectedRoleId)

  if (!roles.length) {
    throw new HttpsError('invalid-argument', 'Create at least one workspace permission role before saving.')
  }

  const workspaceOwnerDocRef = db.collection(USERS_COLLECTION).doc(workspaceOwnerId)
  const workspaceRoleLookup = new Map(roles.map((role) => [role.id, role]))
  const workspaceUsersSnapshot = await db.collection(USERS_COLLECTION)
    .where('workspace_owner_id', '==', workspaceOwnerId)
    .get()

  const batch = db.batch()
  const updatedAt = admin.firestore.FieldValue.serverTimestamp()

  batch.set(workspaceOwnerDocRef, {
    workspace_permission_roles: roles,
    workspace_permission_roles_updated_at: updatedAt,
    workspace_permission_roles_saved_by: requesterUid,
  }, { merge: true })

  workspaceUsersSnapshot.docs.forEach((workspaceUserSnapshot) => {
    const workspaceUserProfile = workspaceUserSnapshot.data() || {}

    if (getRoleFromValue(workspaceUserProfile.role) !== 'employer') {
      return
    }

    const assignedRoleId = text(workspaceUserProfile.roleId || workspaceUserProfile.permissionRoleId)
    const matchedRole = assignedRoleId ? workspaceRoleLookup.get(assignedRoleId) || null : null
    const nextWorkspaceUserProfile = stripUndefined({
      id: workspaceUserSnapshot.id,
      uid: workspaceUserSnapshot.id,
      ...workspaceUserProfile,
      permissionRoleName: matchedRole?.name || undefined,
      permissionRoleSnapshot: matchedRole || undefined,
      workspace_permission_role: matchedRole || undefined,
    })

    batch.set(workspaceUserSnapshot.ref, {
      permissionRoleName: matchedRole?.name || admin.firestore.FieldValue.delete(),
      permissionRoleSnapshot: matchedRole || admin.firestore.FieldValue.delete(),
      workspace_permission_role: matchedRole || admin.firestore.FieldValue.delete(),
      workspace_permission_updated_at: updatedAt,
    }, { merge: true })
    batch.set(
      getWorkspaceUserDocRef(workspaceOwnerId, workspaceUserSnapshot.id),
      {
        ...toWorkspaceUserCollectionRecord(nextWorkspaceUserProfile),
        workspace_permission_updated_at: updatedAt,
      },
      { merge: false },
    )
  })

  await batch.commit()

  return {
    saved: true,
    workspaceOwnerId,
    selectedRoleId:
      roles.some((role) => role.id === selectedRoleId)
        ? selectedRoleId
        : roles[0]?.id || '',
    roles,
    updatedWorkspaceUserCount: workspaceUsersSnapshot.size,
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
      : {}
  const targetRole = normalizeRole(profile.role || requestedRole)
  const targetEmail = normalizeEmail(profile.email)
  const workspaceOwnerId = text(profile.workspace_owner_id)
  let ownedWorkspaceUsersSnapshot = null

  if (targetRole === 'employer' && !workspaceOwnerId) {
    ownedWorkspaceUsersSnapshot = await db.collection(EMPLOYERS_COLLECTION)
      .doc(targetUid)
      .collection(WORKSPACE_USERS_SUBCOLLECTION)
      .get()
  }

  const batch = db.batch()
  batch.set(deletedHistoryDocRef, {
    uid: targetUid,
    role: targetRole || requestedRole || 'user',
    email: targetEmail,
    name: text(profile.name)
      || text(profile.first_name ? `${profile.first_name} ${profile.last_name || ''}` : '')
      || text(profile.company_name),
    archived: false,
    status: 'deleted',
    deleted_at: admin.firestore.FieldValue.serverTimestamp(),
    deleted_by: requesterUid,
    deleted_by_role: requesterRole,
    user_profile: userSnapshot.exists ? userSnapshot.data() || null : null,
    applicant_profile: applicantSnapshot.exists ? applicantSnapshot.data() || null : null,
    employer_profile: employerSnapshot.exists ? employerSnapshot.data() || null : null,
  }, { merge: true })
  if (userSnapshot.exists) batch.delete(userDocRef)
  if (applicantSnapshot.exists) batch.delete(applicantDocRef)

  if (targetRole === 'employer') {
    batch.delete(employerDocRef)

    if (workspaceOwnerId) {
      batch.delete(getWorkspaceUserDocRef(workspaceOwnerId, targetUid))
    }

    ownedWorkspaceUsersSnapshot?.docs.forEach((workspaceUserSnapshot) => {
      batch.delete(workspaceUserSnapshot.ref)
    })
  }

  if (targetEmail) {
    batch.delete(db.collection(REGISTRATION_OTP_COLLECTION).doc(toEmployerRegistrationDocId(targetEmail)))
  }

  await batch.commit()

  let authState = 'missing'
  await admin.auth().updateUser(targetUid, { disabled: true }).then(() => {
    authState = 'disabled'
  }).catch((error) => {
    if (text(error?.code) === 'auth/user-not-found') return
    throw error
  })

  await deletedHistoryDocRef.set({
    auth_state: authState,
  }, { merge: true })

  return {
    deleted: true,
    uid: targetUid,
    role: targetRole || requestedRole || 'user',
    email: targetEmail,
    authState,
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

  const restoredEmployerProfile = stripUndefined({
    ...(employerProfile || {}),
    ...(userProfile || {}),
    id: targetUid,
    uid: targetUid,
  })
  const restoredWorkspaceOwnerId = text(
    restoredEmployerProfile.workspace_owner_id
    || userProfile?.workspace_owner_id
    || employerProfile?.workspace_owner_id,
  )
  const restoredEmployerOrganizationType = normalizeOrganizationType(
    restoredEmployerProfile.company_organization_type
    || userProfile?.company_organization_type
    || employerProfile?.company_organization_type,
  )
  const shouldRebuildOwnedWorkspaceDirectory = (
    getRoleFromValue(restoredEmployerProfile.role) === 'employer'
    && !restoredWorkspaceOwnerId
    && restoredEmployerOrganizationType === 'business'
  )
  const [workspaceOwnerEmployerSnapshot, ownedWorkspaceUsersSnapshot] = await Promise.all([
    restoredWorkspaceOwnerId && restoredWorkspaceOwnerId !== targetUid
      ? db.collection(EMPLOYERS_COLLECTION).doc(restoredWorkspaceOwnerId).get()
      : Promise.resolve(null),
    shouldRebuildOwnedWorkspaceDirectory
      ? db.collection(USERS_COLLECTION)
          .where('workspace_owner_id', '==', targetUid)
          .where('role', '==', 'employer')
          .get()
      : Promise.resolve(null),
  ])

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

  if (
    getRoleFromValue(restoredEmployerProfile.role) === 'employer'
    && restoredWorkspaceOwnerId
    && (
      restoredWorkspaceOwnerId === targetUid
      || workspaceOwnerEmployerSnapshot?.exists
    )
  ) {
    batch.set(
      getWorkspaceUserDocRef(restoredWorkspaceOwnerId, targetUid),
      toWorkspaceUserCollectionRecord(restoredEmployerProfile),
      { merge: false },
    )
  }

  ownedWorkspaceUsersSnapshot?.docs.forEach((workspaceUserSnapshot) => {
    batch.set(
      getWorkspaceUserDocRef(targetUid, workspaceUserSnapshot.id),
      toWorkspaceUserCollectionRecord({
        id: workspaceUserSnapshot.id,
        uid: workspaceUserSnapshot.id,
        ...workspaceUserSnapshot.data(),
      }),
      { merge: false },
    )
  })

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

exports.sendEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  sendEmployerRegistrationOtpHandler(request.data))

exports.resendEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  resendEmployerRegistrationOtpHandler(request.data))

exports.verifyEmployerRegistrationOtp = onCall(publicCallableOptions, async (request) =>
  verifyEmployerRegistrationOtpHandler(request.data))

exports.syncBusinessWorkspaceUserDirectory = onCall(publicCallableOptions, async (request) =>
  syncBusinessWorkspaceUserDirectoryHandler(request.data, request))

exports.createBusinessWorkspaceUser = onCall(publicCallableOptions, async (request) =>
  createBusinessWorkspaceUserHandler(request.data, request))

exports.publishBusinessJobPost = onCall(publicCallableOptions, async (request) =>
  publishBusinessJobPostHandler(request.data, request))

exports.updateBusinessJobPost = onCall(publicCallableOptions, async (request) =>
  updateBusinessJobPostHandler(request.data, request))

exports.deleteBusinessJobPost = onCall(publicCallableOptions, async (request) =>
  deleteBusinessJobPostHandler(request.data, request))

exports.saveBusinessWorkspacePermissions = onCall(publicCallableOptions, async (request) =>
  saveBusinessWorkspacePermissionsHandler(request.data, request))

exports.deleteManagedAccount = onCall(publicCallableOptions, async (request) =>
  deleteManagedAccountHandler(request.data, request))

exports.restoreDeletedManagedAccount = onCall(publicCallableOptions, async (request) =>
  restoreDeletedManagedAccountHandler(request.data, request))

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
