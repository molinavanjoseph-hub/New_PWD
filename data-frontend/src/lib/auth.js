import { deleteApp, initializeApp } from 'firebase/app'
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { app, auth, cloudFunctions, db, storage } from '@/firebase'

const USERS_COLLECTION = 'users'
const EMPLOYERS_COLLECTION = 'employers'
const WORKSPACE_USERS_SUBCOLLECTION = 'workspace_users'
const MEMBER_EMPLOYER_SUBCOLLECTION = 'member_employer'
const APPLICANT_REGISTRATION_COLLECTION = 'applicant_registration'
const DELETED_USER_HISTORY_COLLECTION = 'deleted_user_history'
const ACTIVITY_LOGS_COLLECTION = 'activity_logs'
const AUTH_USER_STORAGE_KEY = 'authUser'
const AUTH_TOKEN_STORAGE_KEY = 'authToken'
const ACCOUNT_PUBLIC_ID_CONFIG = {
  applicant: { prefix: 'PWD', start: 1, width: 3 },
  employer: { prefix: 'BUS', start: 101, width: 3 },
}
const MEMBER_EMPLOYER_ID_CONFIG = { prefix: 'TMB', start: 1, width: 4 }

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const text = (value) => String(value || '').trim()
const cloneJson = (value) => JSON.parse(JSON.stringify(value))
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
const nowIso = () => new Date().toISOString()
const daysFromNowIso = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const hoursFromNowIso = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
const secondsFromNowIso = (seconds) => new Date(Date.now() + seconds * 1000).toISOString()
const waitForAuthReady = () =>
  typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()
const waitForScopedAuthReady = (authInstance = auth) =>
  typeof authInstance?.authStateReady === 'function' ? authInstance.authStateReady() : Promise.resolve()

const getSessionStorage = () =>
  typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null

const getLocalStorage = () =>
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null

const writeAuthStorageValue = (key, value) => {
  const sessionStore = getSessionStorage()
  const localStore = getLocalStorage()

  if (value === null) {
    sessionStore?.removeItem(key)
    localStore?.removeItem(key)
    return
  }

  sessionStore?.setItem(key, value)
  localStore?.setItem(key, value)
}

const readAuthStorageValue = (key) => {
  const sessionStore = getSessionStorage()
  const localStore = getLocalStorage()
  const sessionValue = sessionStore?.getItem(key)

  if (sessionValue) return sessionValue

  const localValue = localStore?.getItem(key)
  if (!localValue) return ''

  sessionStore?.setItem(key, localValue)
  localStore?.removeItem(key)
  return localValue
}

const parsePublicIdSequence = (value, prefix) => {
  const normalized = String(value || '').trim().toUpperCase()
  const match = normalized.match(new RegExp(`^${prefix}-(\\d+)$`))
  return match ? Number(match[1]) : null
}

const formatPublicId = (role, sequence) => {
  const config = ACCOUNT_PUBLIC_ID_CONFIG[role]
  if (!config) return ''
  return `${config.prefix}-${String(sequence).padStart(config.width, '0')}`
}

const buildFallbackPublicId = (role, seed) => {
  const config = ACCOUNT_PUBLIC_ID_CONFIG[role]
  if (!config) return ''

  const normalizedSeed = String(seed || `${role}-${Date.now()}`).trim()
  let hash = 0

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = ((hash * 31) + normalizedSeed.charCodeAt(index)) % 900000
  }

  return formatPublicId(role, config.start + hash)
}

const parseMemberEmployerIdSequence = (value) =>
  parsePublicIdSequence(value, MEMBER_EMPLOYER_ID_CONFIG.prefix)

const formatMemberEmployerId = (sequence) =>
  `${MEMBER_EMPLOYER_ID_CONFIG.prefix}-${String(sequence).padStart(MEMBER_EMPLOYER_ID_CONFIG.width, '0')}`

const buildFallbackMemberEmployerId = (seed) => {
  const normalizedSeed = String(seed || `member-${Date.now()}`).trim()
  let hash = 0

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = ((hash * 31) + normalizedSeed.charCodeAt(index)) % 900000
  }

  return formatMemberEmployerId(MEMBER_EMPLOYER_ID_CONFIG.start + hash)
}

const getFirebaseServiceErrorMessage = (error, fallback = '') => {
  const code = text(error?.code)
  const message = text(error?.message).toLowerCase()
  const permissionHint = 'Firebase denied this request. Check your Firestore or Storage rules, confirm this account has access, or sign in again.'

  if (code === 'auth/operation-not-allowed') {
    return 'Sign in is not available right now.'
  }

  if (code === 'auth/network-request-failed') {
    return 'Unable to connect right now. Check your internet connection and try again.'
  }

  if (code === 'auth/invalid-api-key') {
    return 'Sign in is not available right now.'
  }

  if (code === 'auth/app-not-authorized' || code === 'auth/unauthorized-domain') {
    return 'This app is not ready for sign in on this device yet.'
  }

  if (code === 'permission-denied' || code === 'firestore/permission-denied' || code === 'storage/unauthorized') {
    return fallback ? `${fallback} ${permissionHint}` : permissionHint
  }

  if (code === 'storage/unauthenticated') {
    return 'Your session was not ready yet. Please try again.'
  }

  if (code === 'failed-precondition') {
    return 'This service is not ready yet. Please try again later.'
  }

  if (message.includes('client is offline')) {
    return 'Unable to connect right now. Reload the page and try again.'
  }

  if (code === 'unavailable') {
    return 'This service is temporarily unavailable. Reload the page and try again.'
  }

  if (code === 'storage/bucket-not-found') {
    return 'File upload is not available right now.'
  }

  if (code === 'storage/retry-limit-exceeded') {
    return 'The request timed out. Please try again.'
  }

  if (code === 'storage/unknown') {
    return 'File upload failed. Please try again.'
  }

  if (code === 'auth/internal-error') {
    return 'Sign in is temporarily unavailable. Please reload the page and try again.'
  }

  if (code === 'auth/web-storage-unsupported') {
    return 'Your browser could not start the session. Reload the page and try again.'
  }

  if (message.includes('persistence')) {
    return 'Your browser could not keep the session. Reload the page and try again.'
  }

  return fallback
}

const normalizeWorkspacePermissionRoleSnapshot = (profile) => {
  const rawSnapshot =
    profile?.permissionRoleSnapshot
    || profile?.workspace_permission_role
    || profile?.permission_role_snapshot

  if (!rawSnapshot || typeof rawSnapshot !== 'object' || Array.isArray(rawSnapshot)) {
    return null
  }

  return stripUndefined({
    id: text(rawSnapshot.id || profile?.roleId || profile?.permissionRoleId),
    name: text(rawSnapshot.name || profile?.permissionRoleName),
    color: text(rawSnapshot.color),
    modules: Array.isArray(rawSnapshot.modules)
      ? rawSnapshot.modules.map((module) =>
          stripUndefined({
            id: text(module?.id),
            label: text(module?.label),
            description: text(module?.description),
            sectionId: text(module?.sectionId),
            sectionLabel: text(module?.sectionLabel),
            permissions: stripUndefined({
              view: module?.permissions?.view === true,
              edit: module?.permissions?.edit === true,
              full: module?.permissions?.full === true,
            }),
          }))
      : [],
  })
}

const normalizeWorkspacePermissionRoles = (profile) => {
  const rawRoles = Array.isArray(profile?.workspace_permission_roles)
    ? profile.workspace_permission_roles
    : Array.isArray(profile?.workspacePermissionRoles)
      ? profile.workspacePermissionRoles
      : []

  if (!rawRoles.length) return []

  const seenRoleIds = new Set()

  return rawRoles
    .map((role, index) => {
      const normalizedRole = normalizeWorkspacePermissionRoleSnapshot({
        roleId: role?.id,
        permissionRoleId: role?.id,
        permissionRoleName: role?.name,
        permissionRoleSnapshot: role,
      })
      const roleId = text(normalizedRole?.id)

      if (!roleId || seenRoleIds.has(roleId)) return null
      seenRoleIds.add(roleId)

      return stripUndefined({
        ...normalizedRole,
        id: roleId,
        name: text(normalizedRole?.name) || `Role ${index + 1}`,
        color: text(normalizedRole?.color),
      })
    })
    .filter(Boolean)
}

const ADMIN_MODULE_REMOVAL_GRACE_SECONDS = 10
const normalizeAdminModuleAccessNotice = (notice = {}) => {
  const moduleId = text(notice?.moduleId || notice?.module_id)
  if (!moduleId) return null

  return stripUndefined({
    id: text(notice?.id || `notice-${moduleId}`),
    audience: text(notice?.audience),
    kind: text(notice?.kind || 'module-removal'),
    moduleId,
    moduleLabel: text(notice?.moduleLabel || notice?.module_label),
    section: text(notice?.section || moduleId),
    title: text(notice?.title || 'Access update'),
    message: text(notice?.message),
    createdAt: timestampText(notice?.createdAt || notice?.created_at),
    effectiveAt: timestampText(notice?.effectiveAt || notice?.effective_at),
    action: text(notice?.action || 'remove'),
  })
}

const normalizeAdminModuleAccessNotices = (notices = []) =>
  (Array.isArray(notices) ? notices : [])
    .map((notice) => normalizeAdminModuleAccessNotice(notice))
    .filter(Boolean)

const normalizeAdminApplicantModuleAccess = (modules = []) =>
  (Array.isArray(modules) ? modules : [])
    .map((module) => {
      const moduleId = text(module?.id)
      if (!moduleId) return null

      return stripUndefined({
        id: moduleId,
        label: text(module?.label),
        sectionId: text(module?.sectionId),
        sectionLabel: text(module?.sectionLabel),
        permissions: stripUndefined({
          view: module?.permissions?.view === true,
          edit: module?.permissions?.edit === true,
          full: module?.permissions?.full === true,
        }),
      })
    })
    .filter(Boolean)

const getRemovedModuleEntries = (previousModules = [], nextModules = []) => {
  const previousVisibleModules = new Map(
    (Array.isArray(previousModules) ? previousModules : [])
      .filter((module) => module?.permissions?.view === true)
      .map((module) => [text(module?.id), module]),
  )
  const nextVisibleModuleIds = new Set(
    (Array.isArray(nextModules) ? nextModules : [])
      .filter((module) => module?.permissions?.view === true)
      .map((module) => text(module?.id))
      .filter(Boolean),
  )

  return [...previousVisibleModules.entries()]
    .filter(([moduleId]) => moduleId && !nextVisibleModuleIds.has(moduleId))
    .map(([, module]) => module)
}

const buildModuleRemovalNotices = (modules = [], audience = '') => {
  const createdAt = nowIso()
  const effectiveAt = secondsFromNowIso(ADMIN_MODULE_REMOVAL_GRACE_SECONDS)

  return (Array.isArray(modules) ? modules : [])
    .map((module) => {
      const moduleId = text(module?.id)
      const moduleLabel = text(module?.label || module?.moduleLabel || moduleId)
      if (!moduleId || !moduleLabel) return null

      return {
        id: `rbac-${audience || 'user'}-${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        audience: text(audience),
        kind: 'module-removal',
        moduleId,
        moduleLabel,
        section: moduleId,
        title: 'Access update scheduled',
        message: `${moduleLabel} will be removed from your panel in ${ADMIN_MODULE_REMOVAL_GRACE_SECONDS} seconds by an admin RBAC update.`,
        createdAt,
        effectiveAt,
        action: 'remove',
      }
    })
    .filter(Boolean)
}

const mergeAdminModuleRemovalNotices = (existingNotices = [], nextNotices = []) => {
  const preservedNotices = normalizeAdminModuleAccessNotices(existingNotices)
    .filter((notice) => {
      const effectiveAt = Date.parse(notice?.effectiveAt || '')
      return Number.isFinite(effectiveAt) ? effectiveAt > Date.now() - (7 * 24 * 60 * 60 * 1000) : true
    })

  const noticesByModuleKey = new Map(
    preservedNotices.map((notice) => [`${notice.audience}:${notice.moduleId}`, notice]),
  )

  normalizeAdminModuleAccessNotices(nextNotices).forEach((notice) => {
    noticesByModuleKey.set(`${notice.audience}:${notice.moduleId}`, notice)
  })

  return [...noticesByModuleKey.values()]
    .sort((left, right) => Date.parse(right?.createdAt || '') - Date.parse(left?.createdAt || ''))
    .slice(0, 20)
}

const configureSignInPersistence = async () => {
  try {
    await setPersistence(auth, browserSessionPersistence)
  } catch (error) {
    const persistenceError = getFirebaseServiceErrorMessage(error)

    try {
      await setPersistence(auth, inMemoryPersistence)
    } catch (fallbackError) {
      throw new Error(
        getFirebaseServiceErrorMessage(
          fallbackError,
          persistenceError || 'Unable to start your session right now.',
        ),
      )
    }
  }
}

const ensureAuthenticatedUserSession = async (credential = null) => {
  await configureSignInPersistence()
  await waitForAuthReady()

  const firebaseUser = credential?.user || auth.currentUser
  if (!firebaseUser?.uid) {
    throw new Error('Your account session could not be started. Please try again.')
  }

  await firebaseUser.getIdToken(true)
  return firebaseUser
}



const safeFileName = (value) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'file'
}

const getFormFile = (formData, key) => {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : null
}

const uploadStorageFile = async ({ path, file, storageInstance = storage }) => {
  const fileRef = storageRef(storageInstance, path)
  await uploadBytes(fileRef, file, file.type ? { contentType: file.type } : undefined)
  const url = await getDownloadURL(fileRef)
  return {
    path: fileRef.fullPath,
    url,
  }
}

const deleteUploadedFiles = async (paths, storageInstance = storage) => {
  await Promise.all(
    paths.map((path) =>
      deleteObject(storageRef(storageInstance, path)).catch(() => {}),
    ),
  )
}

export const uploadEmployerBusinessAvatar = async (employerId, file) => {
  await waitForAuthReady()

  const normalizedEmployerId = text(employerId)
  if (!normalizedEmployerId) {
    throw new Error('Missing employer account ID for avatar upload.')
  }

  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('Choose a valid image file first.')
  }

  const timestamp = Date.now()
  return uploadStorageFile({
    path: `users/${normalizedEmployerId}/employer/business-avatar/${timestamp}-${safeFileName(file.name)}`,
    file,
  })
}

export const uploadApplicantProfileAvatar = async (applicantId, file) => {
  await waitForAuthReady()

  const normalizedApplicantId = text(applicantId)
  if (!normalizedApplicantId) {
    throw new Error('Missing applicant account ID for avatar upload.')
  }

  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('Choose a valid image file first.')
  }

  const timestamp = Date.now()
  return uploadStorageFile({
    path: `users/${normalizedApplicantId}/applicant/profile-avatar/${timestamp}-${safeFileName(file.name)}`,
    file,
  })
}

const uploadRegistrationFiles = async ({ uid, role, formData, storageInstance = storage }) => {
  const timestamp = Date.now()
  const uploadedPaths = []

  const uploadAndTrack = async (path, file) => {
    const uploaded = await uploadStorageFile({ path, file, storageInstance })
    uploadedPaths.push(uploaded.path)
    return uploaded.url
  }

  try {
    if (role === 'applicant') {
      const profileImageFile = getFormFile(formData, 'profileImage')
      const resumeFile = getFormFile(formData, 'resumeFile')
      const pwdIdFrontFile = getFormFile(formData, 'pwdIdFrontFile')
      const pwdIdBackFile = getFormFile(formData, 'pwdIdBackFile')
      const [profileImageUrl, resumeUrl, pwdIdFrontUrl, pwdIdBackUrl] = await Promise.all([
        profileImageFile
          ? uploadAndTrack(
              `users/${uid}/applicant/face-verification/${timestamp}-${safeFileName(profileImageFile.name)}`,
              profileImageFile,
            )
          : Promise.resolve(''),
        resumeFile
          ? uploadAndTrack(
              `users/${uid}/applicant/resume/${timestamp}-${safeFileName(resumeFile.name)}`,
              resumeFile,
            )
          : Promise.resolve(''),
        pwdIdFrontFile
          ? uploadAndTrack(
              `users/${uid}/applicant/pwd-id/front/${timestamp}-${safeFileName(pwdIdFrontFile.name)}`,
              pwdIdFrontFile,
            )
          : Promise.resolve(''),
        pwdIdBackFile
          ? uploadAndTrack(
              `users/${uid}/applicant/pwd-id/back/${timestamp}-${safeFileName(pwdIdBackFile.name)}`,
              pwdIdBackFile,
            )
          : Promise.resolve(''),
      ])

      return {
        uploadedPaths,
        profileImageUrl,
        resumeUrl,
        pwdIdFrontUrl,
        pwdIdBackUrl,
        companyVerificationUrls: ['', '', ''],
      }
    }

    const companyVerificationUrls = await Promise.all(
      [1, 2, 3].map(async (index) => {
        const file = getFormFile(formData, `companyVerificationDocument${index}`)
        if (!file) return ''

        return uploadAndTrack(
          `users/${uid}/employer/company-verification/document-${index}/${timestamp}-${safeFileName(file.name)}`,
          file,
        )
      }),
    )

    return {
      uploadedPaths,
      profileImageUrl: '',
      resumeUrl: '',
      pwdIdFrontUrl: '',
      pwdIdBackUrl: '',
      companyVerificationUrls,
    }
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths)
    throw new Error(
      getFirebaseServiceErrorMessage(error, 'Unable to upload your verification files right now.'),
    )
  }
}

const mapProfileToStoredUser = (profile) => {
  const normalizedProfile = {
    id: profile.id,
    uid: profile.id,
    public_id: text(profile.public_id),
    email: normalizeEmail(profile.email),
    role: text(profile.role),
    name: text(profile.name) || 'User',
    created_at: text(profile.created_at),
    reviewed_at: text(profile.reviewed_at),
    approval_status: text(profile.approval_status),
    email_verified: profile.email_verified === true,
    email_verified_at: text(profile.email_verified_at),
  }
  const normalizedRoleId = text(profile.roleId || profile.permissionRoleId)
  const normalizedPermissionRoleName = text(profile.permissionRoleName)
  const normalizedPermissionRoleSnapshot = normalizeWorkspacePermissionRoleSnapshot(profile)
  const normalizedWorkspacePermissionRoles = normalizeWorkspacePermissionRoles(profile)
  const workspaceOwnerId = text(profile.workspace_owner_id || profile.workspaceOwnerId)
  const workspaceOwnerEmail = normalizeEmail(profile.workspace_owner_email || profile.workspaceOwnerEmail)
  const workspaceOwnerRole = text(profile.workspace_owner_role || profile.workspaceOwnerRole)
  const workspaceOwnerName = text(profile.workspace_owner_name || profile.workspaceOwnerName)

  if (normalizedRoleId) {
    normalizedProfile.roleId = normalizedRoleId
    normalizedProfile.permissionRoleId = normalizedRoleId
  }

  if (normalizedPermissionRoleName) {
    normalizedProfile.permissionRoleName = normalizedPermissionRoleName
  }

  if (normalizedPermissionRoleSnapshot) {
    normalizedProfile.permissionRoleSnapshot = normalizedPermissionRoleSnapshot
    normalizedProfile.workspace_permission_role = cloneJson(normalizedPermissionRoleSnapshot)
  }

  if (normalizedWorkspacePermissionRoles.length) {
    normalizedProfile.workspace_permission_roles = cloneJson(normalizedWorkspacePermissionRoles)
    normalizedProfile.workspacePermissionRoles = cloneJson(normalizedWorkspacePermissionRoles)
  }

  if (workspaceOwnerId) {
    normalizedProfile.workspace_owner_id = workspaceOwnerId
    normalizedProfile.workspaceOwnerId = workspaceOwnerId
  }

  if (workspaceOwnerEmail) {
    normalizedProfile.workspace_owner_email = workspaceOwnerEmail
    normalizedProfile.workspaceOwnerEmail = workspaceOwnerEmail
  }

  if (workspaceOwnerRole) {
    normalizedProfile.workspace_owner_role = workspaceOwnerRole
    normalizedProfile.workspaceOwnerRole = workspaceOwnerRole
  }

  if (workspaceOwnerName) {
    normalizedProfile.workspace_owner_name = workspaceOwnerName
    normalizedProfile.workspaceOwnerName = workspaceOwnerName
  }

  if (profile.workspace_member === true) {
    normalizedProfile.workspace_member = true
  }

  const normalizedAdminModuleAccessNotices = normalizeAdminModuleAccessNotices(
    profile.admin_module_access_notices || profile.adminModuleAccessNotices,
  )
  if (normalizedAdminModuleAccessNotices.length) {
    normalizedProfile.admin_module_access_notices = cloneJson(normalizedAdminModuleAccessNotices)
    normalizedProfile.adminModuleAccessNotices = cloneJson(normalizedAdminModuleAccessNotices)
  }

  const normalizedApplicantModuleAccess = normalizeAdminApplicantModuleAccess(
    profile.admin_applicant_module_access || profile.adminApplicantModuleAccess,
  )
  if (normalizedApplicantModuleAccess.length) {
    normalizedProfile.admin_applicant_module_access = cloneJson(normalizedApplicantModuleAccess)
    normalizedProfile.adminApplicantModuleAccess = cloneJson(normalizedApplicantModuleAccess)
  }

  if (normalizedProfile.role === 'applicant') {
    const registration = cloneJson(profile.applicant_registration || {})
    normalizedProfile.applicant_registration = registration
    normalizedProfile.applicantRegistration = registration
    normalizedProfile.avatar = text(profile.avatar || registration.avatar)
    normalizedProfile.avatar_path = text(profile.avatar_path || registration.avatar_path)
  }

  if (normalizedProfile.role === 'employer') {
    normalizedProfile.company_name = text(profile.company_name || profile.name)
    normalizedProfile.company_category = text(profile.company_category)
    normalizedProfile.company_location = text(profile.company_location)
    normalizedProfile.company_contact_number = text(profile.company_contact_number)
    normalizedProfile.business_avatar = text(profile.business_avatar || profile.avatar)
    normalizedProfile.avatar = text(profile.avatar || profile.business_avatar)
    normalizedProfile.business_avatar_path = text(profile.business_avatar_path || profile.avatar_path)
    normalizedProfile.avatar_path = text(profile.avatar_path || profile.business_avatar_path)
    normalizedProfile.business_contact_email = normalizeEmail(
      profile.business_contact_email || profile.email,
    )
    normalizedProfile.company_organization_type = normalizeEmployerOrganizationType(profile.company_organization_type)
    normalizedProfile.companyOrganizationType = normalizedProfile.company_organization_type
  }

  return normalizedProfile
}

const persistAuthSession = async (profile, firebaseUser = null) => {
  const storedUser = mapProfileToStoredUser(profile)
  writeAuthStorageValue(AUTH_USER_STORAGE_KEY, JSON.stringify(storedUser))

  if (firebaseUser) {
    const token = await firebaseUser.getIdToken()
    writeAuthStorageValue(AUTH_TOKEN_STORAGE_KEY, token)
  }

  return storedUser
}

export const doesStoredSessionMatchFirebaseUser = async (storedUser = null) => {
  await waitForAuthReady()

  const firebaseUid = text(auth.currentUser?.uid)
  const resolvedStoredUser = storedUser || getStoredAuthUser()
  const storedUid = text(resolvedStoredUser?.uid || resolvedStoredUser?.id)

  if (!firebaseUid || !storedUid) return false

  return firebaseUid === storedUid
}

const getUserDocRef = (uid, dbInstance = db) => doc(dbInstance, USERS_COLLECTION, uid)
const getUsersCollectionRef = (dbInstance = db) => collection(dbInstance, USERS_COLLECTION)
const getEmployerDocRef = (uid, dbInstance = db) => doc(dbInstance, EMPLOYERS_COLLECTION, uid)
const getWorkspaceUserDirectoryDocRef = (workspaceOwnerId, uid) =>
  doc(db, EMPLOYERS_COLLECTION, workspaceOwnerId, WORKSPACE_USERS_SUBCOLLECTION, uid)
const getWorkspaceUserDirectoryCollectionRef = (workspaceOwnerId) =>
  collection(db, EMPLOYERS_COLLECTION, workspaceOwnerId, WORKSPACE_USERS_SUBCOLLECTION)
const getMemberEmployerDocRef = (workspaceOwnerId, uid) =>
  doc(db, EMPLOYERS_COLLECTION, workspaceOwnerId, MEMBER_EMPLOYER_SUBCOLLECTION, uid)
const getMemberEmployerCollectionRef = (workspaceOwnerId) =>
  collection(db, EMPLOYERS_COLLECTION, workspaceOwnerId, MEMBER_EMPLOYER_SUBCOLLECTION)
const getApplicantRegistrationDocRef = (uid, dbInstance = db) => doc(dbInstance, APPLICANT_REGISTRATION_COLLECTION, uid)
const getDeletedUserHistoryDocRef = (uid) => doc(db, DELETED_USER_HISTORY_COLLECTION, uid)

const buildActivityActor = (fallbackUser = null) => {
  const actor = fallbackUser || getStoredAuthUser() || {}
  return {
    uid: text(actor.uid || actor.id || auth.currentUser?.uid),
    email: normalizeEmail(actor.email || auth.currentUser?.email),
    role: text(actor.role),
    name: text(actor.name || actor.company_name),
  }
}

const buildActivityLogEntry = (entry = {}, fallbackUser = null) => {
  const actor = buildActivityActor(fallbackUser)
  return {
    action: text(entry.action),
    action_label: text(entry.actionLabel),
    description: text(entry.description),
    target_type: text(entry.targetType),
    target_id: text(entry.targetId),
    target_name: text(entry.targetName),
    target_email: normalizeEmail(entry.targetEmail),
    status: text(entry.status) || 'success',
    source: text(entry.source) || 'frontend',
    actor,
    created_at: nowIso(),
    created_at_server: serverTimestamp(),
    metadata: cloneJson(entry.metadata || {}),
  }
}

export const recordSystemActivity = async (entry = {}, fallbackUser = null) => {
  const normalizedEntry = buildActivityLogEntry(entry, fallbackUser)
  if (!normalizedEntry.action || !normalizedEntry.actor.uid) return null

  try {
    return await addDoc(collection(db, ACTIVITY_LOGS_COLLECTION), normalizedEntry)
  } catch (error) {
    console.error('Failed to record system activity', error)
    return null
  }
}

const normalizeActivityLogRecord = (record = {}) => ({
  id: text(record.id),
  action: text(record.action),
  actionLabel: text(record.action_label),
  description: text(record.description),
  targetType: text(record.target_type),
  targetId: text(record.target_id),
  targetName: text(record.target_name),
  targetEmail: normalizeEmail(record.target_email),
  status: text(record.status) || 'success',
  source: text(record.source) || 'frontend',
  actor: {
    uid: text(record.actor?.uid),
    email: normalizeEmail(record.actor?.email),
    role: text(record.actor?.role),
    name: text(record.actor?.name),
  },
  metadata: cloneJson(record.metadata || {}),
  createdAt: timestampText(record.created_at_server) || text(record.created_at),
})

const toApplicantProfileDocument = (profile, sourceCollection = APPLICANT_REGISTRATION_COLLECTION) => {
  const baseProfile = profile || {}
  const registration = cloneJson(baseProfile.applicant_registration || baseProfile || {})
  const uid = text(baseProfile.uid || baseProfile.id)
  const firstName = text(registration.first_name)
  const lastName = text(registration.last_name)
  const sortOrder = Number(baseProfile.sort_order ?? registration.sort_order)
  const normalizedSortOrder = Number.isFinite(sortOrder) ? sortOrder : undefined

  return stripUndefined({
    id: uid,
    uid,
    public_id: text(baseProfile.public_id || registration.public_id),
    email: normalizeEmail(baseProfile.email),
    role: 'applicant',
    name: text(baseProfile.name) || `${firstName} ${lastName}`.trim() || 'Applicant',
    approval_status: text(baseProfile.approval_status) || 'pending',
    email_verified: baseProfile.email_verified === true,
    email_verified_at: text(baseProfile.email_verified_at),
    created_at: text(baseProfile.created_at) || text(registration.created_at),
    reviewed_at: text(baseProfile.reviewed_at),
    rejection_reason: text(baseProfile.rejection_reason),
    ban_reason: text(baseProfile.ban_reason),
    ban_duration: text(baseProfile.ban_duration),
    banned_until: text(baseProfile.banned_until),
    sort_order: normalizedSortOrder,
    applicant_registration: stripUndefined({
      ...registration,
      first_name: firstName,
      last_name: lastName,
      created_at: text(registration.created_at) || text(baseProfile.created_at),
      submitted_at: text(registration.submitted_at) || text(baseProfile.created_at),
      sort_order: normalizedSortOrder,
    }),
    ...(sourceCollection ? { __collection: sourceCollection } : {}),
  })
}

const getProfileByUid = async (uid, options = {}) => {
  if (!uid) return null
  const dbInstance = options?.dbInstance || db
  await waitForScopedAuthReady(options?.authInstance || auth)

  const snapshot = await getDoc(getUserDocRef(uid, dbInstance))
  if (snapshot.exists()) {
    return {
      id: snapshot.id,
      ...snapshot.data(),
      __collection: USERS_COLLECTION,
    }
  }

  const employerSnapshot = await getDoc(getEmployerDocRef(uid, dbInstance))
  if (employerSnapshot.exists()) {
    return {
      ...toEmployerRecord({
        id: employerSnapshot.id,
        ...employerSnapshot.data(),
      }),
      __collection: EMPLOYERS_COLLECTION,
    }
  }

  const applicantSnapshot = await getDoc(getApplicantRegistrationDocRef(uid, dbInstance))
  if (!applicantSnapshot.exists()) return null

  return toApplicantProfileDocument({
    id: applicantSnapshot.id,
    ...applicantSnapshot.data(),
  })
}

const getProfileByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null
  await waitForAuthReady()

  const snapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where('email', '==', normalizedEmail), limit(1)),
  )

  if (!snapshot.empty) {
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
      __collection: USERS_COLLECTION,
    }
  }

  const employerSnapshot = await getDocs(
    query(collection(db, EMPLOYERS_COLLECTION), where('email', '==', normalizedEmail), limit(1)),
  )

  if (!employerSnapshot.empty) {
    return {
      ...toEmployerRecord({
        id: employerSnapshot.docs[0].id,
        ...employerSnapshot.docs[0].data(),
      }),
      __collection: EMPLOYERS_COLLECTION,
    }
  }

  const applicantSnapshot = await getDocs(
    query(collection(db, APPLICANT_REGISTRATION_COLLECTION), where('email', '==', normalizedEmail), limit(1)),
  )

  if (applicantSnapshot.empty) return null

  return toApplicantProfileDocument({
    id: applicantSnapshot.docs[0].id,
    ...applicantSnapshot.docs[0].data(),
  })
}

const getAllProfiles = async (options = {}) => {
  const dbInstance = options?.dbInstance || db
  await waitForScopedAuthReady(options?.authInstance || auth)
  const [userSnapshot, applicantSnapshot, employerSnapshot] = await Promise.all([
    getDocs(collection(dbInstance, USERS_COLLECTION)),
    getDocs(collection(dbInstance, APPLICANT_REGISTRATION_COLLECTION)),
    getDocs(collection(dbInstance, EMPLOYERS_COLLECTION)),
  ])

  const profileMap = new Map()

  userSnapshot.docs.forEach((entry) => {
    profileMap.set(entry.id, {
      id: entry.id,
      ...entry.data(),
      __collection: USERS_COLLECTION,
    })
  })

  employerSnapshot.docs.forEach((entry) => {
    const previousProfile = profileMap.get(entry.id) || {}
    profileMap.set(entry.id, {
      ...previousProfile,
      id: entry.id,
      ...entry.data(),
      __collection: text(previousProfile.__collection) || EMPLOYERS_COLLECTION,
    })
  })

  applicantSnapshot.docs.forEach((entry) => {
    profileMap.set(entry.id, toApplicantProfileDocument({
      id: entry.id,
      ...entry.data(),
    }))
  })

  return [...profileMap.values()]
}

const isApprovalTrackedRole = (role) => role === 'applicant' || role === 'employer'

const getApprovalErrorMessage = (profile) => {
  if (profile?.approval_status === 'pending') {
    return profile?.role === 'employer'
      ? 'Your employer account is still pending approval.'
      : 'Your account is still pending approval.'
  }

  if (profile?.approval_status === 'rejected') {
    return profile?.role === 'employer'
      ? 'Your employer account has been rejected by admin review.'
      : 'Your account has been rejected by admin review.'
  }

  if (profile?.approval_status === 'banned') {
    return profile?.role === 'employer'
      ? 'Your employer account has been banned.'
      : 'Your account has been banned.'
  }

  return 'Login failed. Please check your account.'
}

const toApplicantRecord = (profile) => {
  const registration = profile?.applicant_registration || {}
  const applicantName = text(profile.name)
    || `${text(registration.first_name)} ${text(registration.last_name)}`.trim()
    || 'Applicant'
  const applicantEmail = normalizeEmail(profile.email)
  const sortOrder = Number(profile?.sort_order ?? registration?.sort_order)

  return {
    id: profile.id,
    public_id: text(profile.public_id || registration.public_id),
    approval_status: text(profile.approval_status) || 'pending',
    created_at: text(profile.created_at) || text(registration.created_at),
    submitted_at: text(registration.submitted_at) || text(profile.created_at),
    reviewed_at: text(profile.reviewed_at),
    rejection_reason: text(profile.rejection_reason),
    ban_reason: text(profile.ban_reason),
    ban_duration: text(profile.ban_duration),
    banned_until: text(profile.banned_until),
    first_name: text(registration.first_name),
    last_name: text(registration.last_name),
    sex: text(registration.sex),
    birth_date: text(registration.birth_date),
    age: registration.age || '',
    disability_type: text(registration.disability_type),
    address_province: text(registration.address_province),
    address_city: text(registration.address_city),
    address_barangay: text(registration.address_barangay),
    contact_country_code: text(registration.contact_country_code),
    contact_number: text(registration.contact_number),
    preferred_language: text(registration.preferred_language),
    pwd_id_number: text(registration.pwd_id_number),
    pwd_id_ocr_status: text(registration.pwd_id_ocr_status),
    pwd_id_ocr_message: text(registration.pwd_id_ocr_message),
    avatar: text(profile.avatar || registration.avatar),
    avatar_path: text(profile.avatar_path || registration.avatar_path),
    profile_image_path: text(registration.profile_image_path),
    pwd_id_front_file_path: text(registration.pwd_id_front_file_path),
    pwd_id_back_file_path: text(registration.pwd_id_back_file_path),
    resume_file_path: text(registration.resume_file_path),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : null,
    name: applicantName,
    email: applicantEmail,
    role: 'applicant',
    admin_module_access_notices: normalizeAdminModuleAccessNotices(
      profile.admin_module_access_notices || profile.adminModuleAccessNotices,
    ),
    admin_applicant_module_access: normalizeAdminApplicantModuleAccess(
      profile.admin_applicant_module_access || profile.adminApplicantModuleAccess,
    ),
    user: {
      id: profile.id,
      email: applicantEmail,
      name: applicantName,
      role: 'applicant',
    },
  }
}

const toEmployerRecord = (profile) => ({
  id: profile.id,
  public_id: text(profile.public_id),
  approval_status: text(profile.approval_status) || 'pending',
  email_verified: profile.email_verified === true,
  email_verified_at: text(profile.email_verified_at),
  created_at: text(profile.created_at),
  sort_order: Number.isFinite(Number(profile?.sort_order)) ? Number(profile.sort_order) : null,
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
  active_subscription_plan: text(profile.active_subscription_plan || profile.activeSubscriptionPlan),
  active_subscription_mode: text(profile.active_subscription_mode || profile.activeSubscriptionMode),
  premium_trial_started_at: text(profile.premium_trial_started_at || profile.premiumTrialStartedAt),
  premium_trial_consumed_at: text(
    profile.premium_trial_consumed_at
    || profile.premiumTrialConsumedAt
    || profile.premium_trial_started_at
    || profile.premiumTrialStartedAt,
  ),
  premium_paid_started_at: text(profile.premium_paid_started_at || profile.premiumPaidStartedAt),
  company_organization_type: normalizeEmployerOrganizationType(profile.company_organization_type),
  company_verification_document_1_path: text(profile.company_verification_document_1_path),
  company_verification_document_2_path: text(profile.company_verification_document_2_path),
  company_verification_document_3_path: text(profile.company_verification_document_3_path),
  business_avatar: text(profile.business_avatar || profile.avatar),
  avatar: text(profile.avatar || profile.business_avatar),
  business_avatar_path: text(profile.business_avatar_path || profile.avatar_path),
  avatar_path: text(profile.avatar_path || profile.business_avatar_path),
  role: 'employer',
  user: {
    id: profile.id,
    email: normalizeEmail(profile.email),
    name: text(profile.name || profile.company_name),
    role: 'employer',
  },
})

const toEmployerCollectionRecord = (profile) =>
  stripUndefined({
    ...toEmployerRecord(profile),
    uid: profile.id,
    public_id: text(profile.public_id),
    role: 'employer',
    account_type: normalizeEmployerOrganizationType(profile.company_organization_type),
  })

const getApplicantProfileDocRef = (profileOrUid) => {
  if (typeof profileOrUid === 'string') return getApplicantRegistrationDocRef(profileOrUid)
  return text(profileOrUid?.__collection) === USERS_COLLECTION
    ? getUserDocRef(profileOrUid.id)
    : getApplicantRegistrationDocRef(profileOrUid.id)
}

const generateNextPublicId = async (role, options = {}) => {
  const config = ACCOUNT_PUBLIC_ID_CONFIG[role]
  if (!config) return ''

  const profiles = await getAllProfiles(options)
  const roleProfiles = profiles.filter((profile) => text(profile.role) === role)

  let maxSequence = config.start - 1 + roleProfiles.length

  roleProfiles.forEach((profile) => {
    const sequence = parsePublicIdSequence(profile?.public_id, config.prefix)
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence)
    }
  })

  return formatPublicId(role, maxSequence + 1)
}

const ensureProfilePublicId = async (profile, options = {}) => {
  const role = text(profile?.role)
  if (!ACCOUNT_PUBLIC_ID_CONFIG[role]) return profile
  if (text(profile?.public_id)) return profile

  let publicId = ''
  try {
    publicId = await generateNextPublicId(role, options)
  } catch (error) {
    const errorCode = text(error?.code)
    if (errorCode !== 'permission-denied' && errorCode !== 'firestore/permission-denied') {
      throw error
    }

    publicId = buildFallbackPublicId(role, text(profile?.id || profile?.uid || profile?.email))
  }

  return {
    ...profile,
    public_id: publicId,
  }
}

const withResolvedProfilePublicId = (profile) => {
  const role = text(profile?.role)
  if (!ACCOUNT_PUBLIC_ID_CONFIG[role]) return profile
  if (text(profile?.public_id)) return profile

  return {
    ...profile,
    public_id: buildFallbackPublicId(role, text(profile?.id || profile?.uid || profile?.email)),
  }
}

const persistMissingProfilePublicId = async (profile) => {
  const role = text(profile?.role)
  const profileId = text(profile?.id || profile?.uid)

  if (!ACCOUNT_PUBLIC_ID_CONFIG[role] || !profileId || text(profile?.public_id)) {
    return withResolvedProfilePublicId(profile)
  }

  const nextProfile = await ensureProfilePublicId(profile)
  const publicId = text(nextProfile?.public_id)

  if (!publicId) return nextProfile

  const batch = writeBatch(db)

  if (role === 'employer') {
    batch.set(getUserDocRef(profileId), { public_id: publicId }, { merge: true })
    batch.set(getEmployerDocRef(profileId), { public_id: publicId }, { merge: true })
  } else if (role === 'applicant') {
    batch.set(getApplicantRegistrationDocRef(profileId), { public_id: publicId }, { merge: true })
    batch.set(getUserDocRef(profileId), { public_id: publicId }, { merge: true })
  }

  await batch.commit()
  return nextProfile
}

const writeProfileDocuments = async (profile, options = {}) => {
  const dbInstance = options?.dbInstance || db
  const nextProfile = await ensureProfilePublicId(profile, options)
  const batch = writeBatch(dbInstance)
  const role = text(nextProfile.role)

  if (role === 'applicant') {
    batch.set(getApplicantRegistrationDocRef(nextProfile.id, dbInstance), toApplicantProfileDocument(nextProfile, ''))
  } else {
    batch.set(getUserDocRef(nextProfile.id, dbInstance), nextProfile)
  }

  if (role === 'employer') {
    batch.set(getEmployerDocRef(nextProfile.id, dbInstance), toEmployerCollectionRecord(nextProfile))
  }

  await batch.commit()
  return nextProfile
}

const updateEmployerDocuments = async (employerId, updates) => {
  const profile = await getProfileByUid(employerId)
  if (!profile) throw new Error('Failed to update employer status.')

  const nextProfile = stripUndefined({
    ...profile,
    ...updates,
    id: employerId,
    uid: employerId,
  })

  const batch = writeBatch(db)
  batch.update(getUserDocRef(employerId), updates)
  batch.set(getEmployerDocRef(employerId), toEmployerCollectionRecord(nextProfile))
  await batch.commit()

  return nextProfile
}

const updateApplicantDocuments = async (applicantId, updates, options = {}) => {
  const profile = await getProfileByUid(applicantId)
  if (!profile) throw new Error('Failed to update applicant details.')

  const nextApplicantRegistration = stripUndefined({
    ...(profile?.applicant_registration || {}),
    ...(updates?.applicant_registration || {}),
  })

  const nextProfile = stripUndefined({
    ...profile,
    ...updates,
    applicant_registration: nextApplicantRegistration,
    id: applicantId,
    uid: applicantId,
  })

  const normalizedStatus = text(nextProfile.approval_status).toLowerCase() || 'pending'
  const shouldMirrorToUsers = options.mirrorToUsers ?? normalizedStatus === 'approved'
  const batch = writeBatch(db)
  const applicantDocument = toApplicantProfileDocument(nextProfile, '')

  batch.set(getApplicantRegistrationDocRef(applicantId), applicantDocument)

  if (shouldMirrorToUsers) {
    batch.set(getUserDocRef(applicantId), applicantDocument)
  } else {
    batch.delete(getUserDocRef(applicantId))
  }

  await batch.commit()

  return nextProfile
}

const deleteEmployerDocuments = async (employerId, dbInstance = db) => {
  const batch = writeBatch(dbInstance)
  batch.delete(getUserDocRef(employerId, dbInstance))
  batch.delete(getEmployerDocRef(employerId, dbInstance))
  await batch.commit()
}

const deleteProfileDocuments = async ({ uid, role, dbInstance = db }) => {
  if (!uid) return

  if (role === 'employer') {
    await deleteEmployerDocuments(uid, dbInstance)
    return
  }

  if (role === 'applicant') {
    await deleteDoc(getApplicantRegistrationDocRef(uid, dbInstance))
    return
  }

  await deleteDoc(getUserDocRef(uid, dbInstance))
}

const toFirebaseErrorMessage = (error, mode = 'login') => {
  const code = text(error?.code)
  const rawMessage = text(error?.message)
  const serviceMessage = getFirebaseServiceErrorMessage(error)

  if (serviceMessage) return serviceMessage

  if (code === 'auth/email-already-in-use') {
    return mode === 'register'
      ? 'This email is already registered. Please sign in instead.'
      : 'This email is already in use.'
  }
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.'
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
  if (code === 'auth/too-many-requests') {
    return 'Too many incorrect password attempts. Please try again later.'
  }

  if (code === 'auth/user-not-found') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'Incorrect email or password.'
  }

  if (code === 'auth/wrong-password') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'Incorrect email or password.'
  }

  if (code === 'auth/invalid-credential') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'Incorrect email or password.'
  }

  if (code === 'auth/configuration-not-found') {
    return mode === 'register'
      ? 'Account registration is not available right now. Please try again later.'
      : 'Sign in is not available right now. Please try again later.'
  }

  if (code === 'auth/admin-restricted-operation') {
    return mode === 'register'
      ? 'Account registration is restricted right now. Please contact support.'
      : 'Sign in is restricted right now. Please contact support.'
  }

  if (rawMessage && mode === 'register' && !rawMessage.toLowerCase().includes('firebase:')) {
    return rawMessage
  }

  return mode === 'register'
    ? 'We verified your OTP, but could not finish creating your account right now. Please try again.'
    : 'Unable to sign in right now. Please try again.'
}

const recoverRegistrationCredential = async ({ email, password }, options = {}) => {
  const authInstance = options?.authInstance || auth
  const dbInstance = options?.dbInstance || db
  let credential
  try {
    credential = await signInWithEmailAndPassword(authInstance, email, password)
  } catch (error) {
    const code = text(error?.code)
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw new Error(
        'This email already has an account. Use the correct password or sign in instead.',
      )
    }

    throw new Error(toFirebaseErrorMessage(error, 'register'))
  }

  try {
    const existingProfile = await getProfileByUid(credential.user.uid, {
      authInstance,
      dbInstance,
    })
    if (existingProfile) {
      throw new Error('This email already has an account. Please sign in instead.')
    }

    return credential
  } catch (error) {
    await signOut(authInstance).catch(() => {})

    if (error instanceof Error) throw error

    throw new Error('Unable to load your account details right now.')
  }
}

const createTemporaryScopedFirebaseContext = async (scopeLabel = 'scoped-session') => {
  const appName = `${scopeLabel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tempApp = initializeApp(app.options, appName)
  const tempAuth = getAuth(tempApp)
  await setPersistence(tempAuth, inMemoryPersistence)
  const tempDb = getFirestore(tempApp)
  const tempStorage = getStorage(tempApp)

  return {
    tempApp,
    tempAuth,
    tempDb,
    tempStorage,
  }
}

export const clearAuthSession = () => {
  writeAuthStorageValue(AUTH_TOKEN_STORAGE_KEY, null)
  writeAuthStorageValue(AUTH_USER_STORAGE_KEY, null)
  void signOut(auth).catch(() => {})
}

export const getStoredAuthToken = () => readAuthStorageValue(AUTH_TOKEN_STORAGE_KEY)

export const getStoredAuthUser = () => {
  const rawUser = readAuthStorageValue(AUTH_USER_STORAGE_KEY)
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    clearAuthSession()
    return null
  }
}

const syncStoredAuthUserWithProfile = (profile) => {
  if (!profile || typeof profile !== 'object') return null

  const mappedProfile = mapProfileToStoredUser(profile)
  setStoredAuthUser(mappedProfile)
  return mappedProfile
}

export const refreshStoredAuthUserProfile = async (uid = '') => {
  const targetUid = text(uid || getStoredAuthUser()?.id || auth.currentUser?.uid)
  if (!targetUid) return null

  const profile = await getProfileByUid(targetUid)
  if (!profile) return null

  return syncStoredAuthUserWithProfile(profile)
}

export const subscribeToStoredAuthUserProfile = (handleNext, handleError) => {
  let isClosed = false
  let stopSnapshot = () => {}

  waitForAuthReady()
    .then(async () => {
      if (isClosed) return

      const targetUid = text(getStoredAuthUser()?.id || auth.currentUser?.uid)
      if (!targetUid) {
        if (typeof handleNext === 'function') handleNext(null)
        return
      }

      const profile = await getProfileByUid(targetUid)
      if (isClosed) return

      if (!profile) {
        if (typeof handleNext === 'function') handleNext(null)
        return
      }

      const profileDocRef = text(profile.__collection) === APPLICANT_REGISTRATION_COLLECTION
        ? getApplicantRegistrationDocRef(targetUid)
        : getUserDocRef(targetUid)

      stopSnapshot = onSnapshot(
        profileDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            if (typeof handleNext === 'function') handleNext(null)
            return
          }

          const nextStoredUser = syncStoredAuthUserWithProfile({
            id: snapshot.id,
            ...snapshot.data(),
            __collection: text(profile.__collection) || USERS_COLLECTION,
          })

          if (typeof handleNext === 'function') handleNext(nextStoredUser)
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopSnapshot()
  }
}

export const subscribeToBusinessWorkspaceUsers = (workspaceOwnerId, handleNext, handleError) => {
  let isClosed = false
  let stopDirectorySnapshot = () => {}
  let stopOwnerSnapshot = () => {}
  let stopOwnerCamelSnapshot = () => {}
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  let directoryUsers = []
  let ownerUsers = []
  let ownerCamelUsers = []

  const emitMergedWorkspaceUsers = () => {
    const mergedUsers = new Map()

    for (const profile of [...directoryUsers, ...ownerUsers, ...ownerCamelUsers]) {
      const normalizedProfile = mapProfileToStoredUser(profile)
      const profileId = text(normalizedProfile?.id)
      const profileEmail = normalizeEmail(normalizedProfile?.email)
      const profileKey = profileId || profileEmail

      if (!profileKey) continue

      const previousProfile = mergedUsers.get(profileKey) || {}
      mergedUsers.set(profileKey, {
        ...previousProfile,
        ...normalizedProfile,
        id: profileId || previousProfile.id || profileEmail,
        __collection: previousProfile.__collection || profile.__collection || WORKSPACE_USERS_SUBCOLLECTION,
      })
    }

    const workspaceUsers = [...mergedUsers.values()]
      .sort((left, right) => {
        const leftTime = Date.parse(left?.created_at || '') || 0
        const rightTime = Date.parse(right?.created_at || '') || 0

        if (leftTime !== rightTime) return rightTime - leftTime

        return text(left?.name).localeCompare(text(right?.name))
      })

    if (typeof handleNext === 'function') handleNext(workspaceUsers)
  }

  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  waitForAuthReady()
    .then(() => {
      if (isClosed) return

      stopDirectorySnapshot = onSnapshot(
        query(getWorkspaceUserDirectoryCollectionRef(normalizedWorkspaceOwnerId)),
        (snapshot) => {
          directoryUsers = snapshot.docs
            .map((entry) => ({
              id: entry.id,
              ...entry.data(),
              __collection: WORKSPACE_USERS_SUBCOLLECTION,
            }))
          emitMergedWorkspaceUsers()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )

      stopOwnerSnapshot = onSnapshot(
        query(getUsersCollectionRef(), where('workspace_owner_id', '==', normalizedWorkspaceOwnerId)),
        (snapshot) => {
          ownerUsers = snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
            __collection: USERS_COLLECTION,
          }))
          emitMergedWorkspaceUsers()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )

      stopOwnerCamelSnapshot = onSnapshot(
        query(getUsersCollectionRef(), where('workspaceOwnerId', '==', normalizedWorkspaceOwnerId)),
        (snapshot) => {
          ownerCamelUsers = snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
            __collection: USERS_COLLECTION,
          }))
          emitMergedWorkspaceUsers()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopDirectorySnapshot()
    stopOwnerSnapshot()
    stopOwnerCamelSnapshot()
  }
}

const normalizeMemberEmployerRecord = (record = {}) => ({
  id: text(record.memberId || record.member_id),
  memberId: text(record.memberId || record.member_id),
  linkedUserId: text(record.linkedUserId || record.linked_user_id || record.id),
  workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
  workspaceOwnerEmail: normalizeEmail(record.workspaceOwnerEmail || record.workspace_owner_email),
  workspaceOwnerRole: text(record.workspaceOwnerRole || record.workspace_owner_role),
  workspaceOwnerName: text(record.workspaceOwnerName || record.workspace_owner_name),
  businessName: text(record.businessName || record.business_name || record.workspaceOwnerName || record.workspace_owner_name),
  memberType: text(record.memberType || record.member_type || (record.member_employer === true ? 'member_employer' : '')),
  memberEmployer: record.member_employer === true || text(record.memberType || record.member_type) === 'member_employer',
  name: text(record.name),
  workEmail: normalizeEmail(record.workEmail || record.work_email || record.email),
  roleId: text(record.roleId || record.permissionRoleId || record.role_id || record.permission_role_id),
  roleName: text(record.roleName || record.permissionRoleName || record.role_name || record.permission_role_name),
  employmentType: text(record.employmentType || record.employment_type),
  phoneNumber: text(record.phoneNumber || record.phone_number),
  startDate: text(record.startDate || record.start_date),
  status: text(record.status) || 'Active',
  lastActive: text(record.lastActive || record.last_active) || 'Just now',
  createdAt: timestampText(record.created_at_server) || text(record.created_at),
  updatedAt: timestampText(record.updated_at_server) || text(record.updated_at),
})

const generateNextMemberEmployerId = async (workspaceOwnerId) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)
  if (!normalizedWorkspaceOwnerId) return ''

  const snapshot = await getDocs(getMemberEmployerCollectionRef(normalizedWorkspaceOwnerId))
  let maxSequence = MEMBER_EMPLOYER_ID_CONFIG.start - 1 + snapshot.docs.length

  snapshot.docs.forEach((entry) => {
    const sequence = parseMemberEmployerIdSequence(entry.data()?.member_id)
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence)
    }
  })

  return formatMemberEmployerId(maxSequence + 1)
}

export const subscribeToBusinessMemberEmployers = (workspaceOwnerId, handleNext, handleError) => {
  let isClosed = false
  let stopSnapshot = () => {}
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)

  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  waitForAuthReady()
    .then(() => {
      if (isClosed) return

      stopSnapshot = onSnapshot(
        query(getMemberEmployerCollectionRef(normalizedWorkspaceOwnerId), orderBy('created_at_server', 'desc')),
        (snapshot) => {
          const members = snapshot.docs
            .map((entry) => normalizeMemberEmployerRecord({
              id: entry.id,
              ...entry.data(),
            }))

          if (typeof handleNext === 'function') handleNext(members)
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopSnapshot()
  }
}

export const saveBusinessMemberEmployer = async (payload = {}) => {
  let normalizedRecord = normalizeMemberEmployerRecord(payload)

  if (!normalizedRecord.workspaceOwnerId || !normalizedRecord.linkedUserId || !normalizedRecord.name || !normalizedRecord.workEmail) {
    throw new Error('Please complete the team member, business name, and linked user details before saving.')
  }

  await waitForAuthReady()

  if (!normalizedRecord.memberId) {
    try {
      const nextMemberId = await generateNextMemberEmployerId(normalizedRecord.workspaceOwnerId)
      normalizedRecord = {
        ...normalizedRecord,
        id: nextMemberId,
        memberId: nextMemberId,
      }
    } catch (error) {
      const fallbackMemberId = buildFallbackMemberEmployerId(normalizedRecord.linkedUserId || normalizedRecord.workEmail)
      normalizedRecord = {
        ...normalizedRecord,
        id: fallbackMemberId,
        memberId: fallbackMemberId,
      }
    }
  }

  const docRef = getMemberEmployerDocRef(normalizedRecord.workspaceOwnerId, normalizedRecord.linkedUserId)
  await setDoc(docRef, stripUndefined({
    member_id: normalizedRecord.memberId,
    linked_user_id: normalizedRecord.linkedUserId,
    workspace_owner_id: normalizedRecord.workspaceOwnerId,
    workspace_owner_email: normalizedRecord.workspaceOwnerEmail,
    workspace_owner_role: normalizedRecord.workspaceOwnerRole,
    workspace_owner_name: normalizedRecord.workspaceOwnerName,
    business_name: normalizedRecord.businessName,
    member_type: normalizedRecord.memberType || 'member_employer',
    member_employer: true,
    name: normalizedRecord.name,
    work_email: normalizedRecord.workEmail,
    role_id: normalizedRecord.roleId,
    role_name: normalizedRecord.roleName,
    employment_type: normalizedRecord.employmentType,
    phone_number: normalizedRecord.phoneNumber,
    start_date: normalizedRecord.startDate,
    status: normalizedRecord.status || 'Active',
    last_active: normalizedRecord.lastActive || 'Just now',
    created_at: normalizedRecord.createdAt || nowIso(),
    created_at_server: normalizedRecord.createdAt ? undefined : serverTimestamp(),
    updated_at: nowIso(),
    updated_at_server: serverTimestamp(),
  }), { merge: true })

  return normalizedRecord
}

export const syncBusinessWorkspaceUserDirectory = async (workspaceOwnerId) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)

  if (!normalizedWorkspaceOwnerId) {
    return {
      synced: false,
      workspaceOwnerId: '',
      syncedWorkspaceUserCount: 0,
    }
  }

  try {
    await waitForAuthReady()
    const syncWorkspaceDirectory = httpsCallable(cloudFunctions, 'syncBusinessWorkspaceUserDirectory')
    const result = await syncWorkspaceDirectory({
      workspaceOwnerId: normalizedWorkspaceOwnerId,
    })

    return {
      synced: result?.data?.synced === true,
      workspaceOwnerId: text(result?.data?.workspaceOwnerId || normalizedWorkspaceOwnerId),
      syncedWorkspaceUserCount: Number(result?.data?.syncedWorkspaceUserCount || 0),
    }
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error(
        'The syncBusinessWorkspaceUserDirectory Firebase function is not deployed yet. Deploy your Functions first, then refresh the workspace directory again.',
      )
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Sign in again before syncing the workspace directory.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error(text(error?.message) || 'Your account is not allowed to sync this workspace directory.')
    }

    if (code === 'functions/invalid-argument' || code === 'functions/failed-precondition') {
      throw new Error(text(error?.message) || 'The workspace directory could not be synchronized right now.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to synchronize the workspace directory right now.',
      ),
    )
  }
}

export const signInAccount = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email)

  await configureSignInPersistence()

  let credential
  try {
    credential = await signInWithEmailAndPassword(auth, normalizedEmail, String(password || ''))
  } catch (error) {
    const code = text(error?.code)

    if (
      code === 'auth/invalid-credential'
      || code === 'auth/invalid-login-credentials'
      || code === 'auth/wrong-password'
      || code === 'auth/user-not-found'
    ) {
      throw new Error('Incorrect email or password.')
    }

    throw new Error(toFirebaseErrorMessage(error, 'login'))
  }

  let profile
  try {
    profile = await getProfileByUid(credential.user.uid)
  } catch (error) {
    await signOut(auth).catch(() => {})
    throw new Error(
      getFirebaseServiceErrorMessage(error, 'Unable to load your account details right now.'),
    )
  }

  if (!profile) {
    await signOut(auth).catch(() => {})
    throw new Error('Your sign-in worked, but no account profile was found for this user. Ask the admin to verify this applicant record is linked to a Firebase Auth account.')
  }

  if (isApprovalTrackedRole(profile.role) && text(profile.approval_status) !== 'approved') {
    await signOut(auth).catch(() => {})
    throw new Error(getApprovalErrorMessage(profile))
  }

  const storedUser = await persistAuthSession(profile, credential.user)
  await recordSystemActivity({
    action: 'auth.login',
    actionLabel: 'User signed in',
    description: `${storedUser.name || storedUser.email || 'User'} signed in.`,
    targetType: 'user',
    targetId: storedUser.id,
    targetName: storedUser.name,
    targetEmail: storedUser.email,
    metadata: {
      role: storedUser.role,
      approval_status: storedUser.approval_status,
    },
  }, storedUser)
  return {
    token: getStoredAuthToken() || '',
    user: storedUser,
  }
}

export const setStoredAuthUser = (user) => {
  if (!user) {
    writeAuthStorageValue(AUTH_USER_STORAGE_KEY, null)
    return null
  }

  const serializedUser = JSON.stringify(user)
  writeAuthStorageValue(AUTH_USER_STORAGE_KEY, serializedUser)
  return user
}

const buildAdminCreatedApplicantProfile = ({ uid, createdAt, form }) =>
  stripUndefined({
    id: uid,
    uid,
    email: normalizeEmail(form.email),
    role: 'applicant',
    name: `${text(form.firstName)} ${text(form.middleName)} ${text(form.lastName)}`.replace(/\s+/g, ' ').trim() || 'Applicant',
    approval_status: 'pending',
    email_verified: true,
    email_verified_at: createdAt,
    created_at: createdAt,
    reviewed_at: '',
    rejection_reason: '',
    ban_reason: '',
    ban_duration: '',
    banned_until: '',
    applicant_registration: {
      first_name: text(form.firstName),
      middle_name: text(form.middleName),
      last_name: text(form.lastName),
      sex: '',
      birth_date: text(form.birthdate),
      age: Number(form.age || 0) || '',
      disability_type: text(form.disabilityType),
      address_province: '',
      address_city: '',
      address_barangay: '',
      present_address: text(form.presentAddress),
      provincial_address: text(form.provincialAddress),
      same_as_present_address: form.sameAsPresentAddress === true,
      telephone_number: text(form.telephoneNumber),
      contact_country_code: text(form.phoneCountryCode) || '+63',
      contact_number: text(form.phoneNumber),
      place_of_birth: text(form.placeOfBirth),
      is_new_employee: form.isNewEmployee === true,
      preferred_language: '',
      pwd_id_number: '',
      pwd_id_ocr_status: form.pwd_id_front_file_path || form.pwd_id_back_file_path ? 'uploaded' : 'pending',
      pwd_id_ocr_message: form.pwd_id_front_file_path || form.pwd_id_back_file_path
        ? 'Account created by admin with uploaded PWD ID files.'
        : 'Account created by admin. Supporting files are still empty.',
      profile_image_path: '',
      pwd_id_front_file_path: text(form.pwd_id_front_file_path),
      pwd_id_back_file_path: text(form.pwd_id_back_file_path),
      resume_file_path: '',
      submitted_at: createdAt,
      created_at: createdAt,
    },
  })

const buildAdminCreatedEmployerProfile = ({ uid, createdAt, form }) =>
  stripUndefined({
    id: uid,
    uid,
    email: normalizeEmail(form.email),
    role: 'employer',
    name: text(form.companyName) || 'Employer',
    approval_status: 'pending',
    email_verified: true,
    email_verified_at: createdAt,
    created_at: createdAt,
    reviewed_at: '',
    rejection_reason: '',
    ban_reason: '',
    ban_duration: '',
    banned_until: '',
    company_name: text(form.companyName),
    company_category: text(form.companyIndustry),
    company_location: '',
    company_contact_number: text(form.contactNumber),
    company_organization_type: 'business',
    company_verification_document_1_path: '',
    company_verification_document_2_path: '',
    company_verification_document_3_path: '',
  })

const createTemporaryAdminAuth = async () => createTemporaryScopedFirebaseContext('admin-user-create')
const createTemporaryRegistrationContext = async () => createTemporaryScopedFirebaseContext('register-account')

export const createAdminManagedAccount = async (payload) => {
  const accountType = text(payload?.accountType).toLowerCase()
  const email = normalizeEmail(payload?.email)
  const password = String(payload?.password || '')
  const pwdIdFrontFile = payload?.pwdIdFrontFile instanceof File ? payload.pwdIdFrontFile : null
  const pwdIdBackFile = payload?.pwdIdBackFile instanceof File ? payload.pwdIdBackFile : null

  if (!email) throw new Error('The email field is required.')
  if (!password.trim()) throw new Error('The password field is required.')

  if (accountType === 'applicant') {
    if (
      !text(payload?.firstName)
      || !text(payload?.email)
      || !text(payload?.lastName)
      || !text(payload?.presentAddress)
      || !text(payload?.provincialAddress)
      || !text(payload?.age)
      || !text(payload?.birthdate)
      || !text(payload?.disabilityType)
      || !text(payload?.phoneNumber)
      || !text(payload?.placeOfBirth)
    ) {
      throw new Error('Please complete all required applicant fields.')
    }
  } else if (accountType === 'business') {
    if (!text(payload?.companyName) || !text(payload?.companyIndustry)) {
      throw new Error('Please complete the business company and industry fields.')
    }
  } else {
    throw new Error('Unsupported admin account type.')
  }

  const { tempApp, tempAuth } = await createTemporaryAdminAuth()
  let accountCreated = false
  let uploadedPaths = []

  try {
    const credential = await createUserWithEmailAndPassword(tempAuth, email, password)
    accountCreated = true
    const createdAt = nowIso()
    let pwdIdFrontUrl = ''
    let pwdIdBackUrl = ''

    if (accountType === 'applicant') {
      const uploadAndTrack = async (path, file) => {
        const uploaded = await uploadStorageFile({ path, file })
        uploadedPaths.push(uploaded.path)
        return uploaded.url
      }

      try {
        pwdIdFrontUrl = pwdIdFrontFile
          ? await uploadAndTrack(
              `users/${credential.user.uid}/applicant/pwd-id/front/admin-${Date.now()}-${safeFileName(pwdIdFrontFile.name)}`,
              pwdIdFrontFile,
            )
          : ''
        pwdIdBackUrl = pwdIdBackFile
          ? await uploadAndTrack(
              `users/${credential.user.uid}/applicant/pwd-id/back/admin-${Date.now()}-${safeFileName(pwdIdBackFile.name)}`,
              pwdIdBackFile,
            )
          : ''
      } catch (uploadError) {
        await deleteUploadedFiles(uploadedPaths)
        uploadedPaths = []
        try {
          await credential.user.delete()
          accountCreated = false
        } catch {
          // Ignore cleanup failures and surface upload error instead.
        }
        throw new Error(
          getFirebaseServiceErrorMessage(uploadError, 'Unable to upload the PWD ID files right now.'),
        )
      }
    }

    let profile =
      accountType === 'applicant'
        ? buildAdminCreatedApplicantProfile({
            uid: credential.user.uid,
            createdAt,
            form: {
              ...payload,
              pwd_id_front_file_path: pwdIdFrontUrl,
              pwd_id_back_file_path: pwdIdBackUrl,
            },
          })
        : buildAdminCreatedEmployerProfile({
            uid: credential.user.uid,
            createdAt,
            form: payload,
          })

    try {
      profile = await writeProfileDocuments(profile)
    } catch (firestoreError) {
      await deleteUploadedFiles(uploadedPaths).catch(() => {})
      try {
        await credential.user.delete()
        accountCreated = false
      } catch {
        // Ignore cleanup failures and surface the Firestore save error instead.
      }
      throw new Error(
        getFirebaseServiceErrorMessage(firestoreError, 'Unable to save the new user right now.'),
      )
    }

    const storedUser = mapProfileToStoredUser(profile)
    await recordSystemActivity({
      action: 'account.create',
      actionLabel: 'Admin created account',
      description: `${storedUser.name || storedUser.email || 'User'} account created by admin.`,
      targetType: storedUser.role || accountType,
      targetId: storedUser.id,
      targetName: storedUser.name,
      targetEmail: storedUser.email,
      metadata: {
        created_by: 'admin',
        account_type: accountType,
      },
    })

    return {
      user: storedUser,
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unable to save the new user')) {
      throw error
    }

    if (error instanceof Error && error.message.startsWith('Please complete')) {
      throw error
    }

    if (error instanceof Error && error.message === 'Unsupported admin account type.') {
      throw error
    }

    if (error instanceof Error && error.message === 'The email field is required.') {
      throw error
    }

    if (error instanceof Error && error.message === 'The password field is required.') {
      throw error
    }

    throw new Error(toFirebaseErrorMessage(error, 'register'))
  } finally {
    if (accountCreated && tempAuth.currentUser) {
      await signOut(tempAuth).catch(() => {})
    }
    await deleteApp(tempApp).catch(() => {})
  }
}

export const registerAccount = async (formData, options = {}) => {
  const email = normalizeEmail(formData.get('email'))
  const password = String(formData.get('password') || '')
  const role = text(formData.get('role')).toLowerCase()
  const otpVerified = options?.otpVerified === true

  if (!email) throw new Error('The email field is required.')
  if (!password.trim()) throw new Error('The password field is required.')
  if (!['applicant', 'employer'].includes(role)) {
    throw new Error('Unsupported registration role.')
  }
  if (!otpVerified) {
    throw new Error(
      role === 'employer'
        ? 'Complete OTP verification before creating the employer account.'
        : 'Complete OTP verification before creating the applicant account.',
    )
  }

  const { tempApp, tempAuth, tempDb, tempStorage } = await createTemporaryRegistrationContext()
  let credential
  let createdNewAuthAccount = false
  let profileWritten = false
  try {
    credential = await createUserWithEmailAndPassword(tempAuth, email, password)
    createdNewAuthAccount = true
  } catch (error) {
    if (text(error?.code) === 'auth/email-already-in-use') {
      credential = await recoverRegistrationCredential(
        { email, password },
        {
          authInstance: tempAuth,
          dbInstance: tempDb,
        },
      )
    } else {
      await deleteApp(tempApp).catch(() => {})
      throw new Error(toFirebaseErrorMessage(error, 'register'))
    }
  }

  let uploadedPaths = []

  const createdAt = nowIso()
  try {
    await waitForScopedAuthReady(tempAuth)

    if (!credential?.user?.uid) {
      throw new Error('Your account session could not be started. Please try again.')
    }

    await credential.user.getIdToken(true)

    const uploadedFiles = await uploadRegistrationFiles({
      uid: credential.user.uid,
      role,
      formData,
      storageInstance: tempStorage,
    })
    uploadedPaths = uploadedFiles.uploadedPaths

    let profile = stripUndefined({
      id: credential.user.uid,
      uid: credential.user.uid,
      email,
      role,
      name:
        role === 'employer'
          ? text(formData.get('companyName')) || 'Employer'
          : `${text(formData.get('firstName'))} ${text(formData.get('lastName'))}`.trim() || 'Applicant',
      approval_status: 'pending',
      email_verified: otpVerified,
      email_verified_at: otpVerified ? createdAt : '',
      created_at: createdAt,
      reviewed_at: '',
      rejection_reason: '',
      ban_reason: '',
      ban_duration: '',
      banned_until: '',
      company_name: role === 'employer' ? text(formData.get('companyName')) : undefined,
      company_category: role === 'employer' ? text(formData.get('companyCategory')) : undefined,
      company_location: role === 'employer' ? text(formData.get('companyLocation')) : undefined,
      company_contact_number: role === 'employer' ? text(formData.get('companyContactNumber')) : undefined,
      company_organization_type:
        role === 'employer' ? normalizeEmployerOrganizationType(formData.get('companyOrganizationType')) : undefined,
      company_verification_document_1_path: uploadedFiles.companyVerificationUrls[0] || '',
      company_verification_document_2_path: uploadedFiles.companyVerificationUrls[1] || '',
      company_verification_document_3_path: uploadedFiles.companyVerificationUrls[2] || '',
      applicant_registration:
        role === 'applicant'
          ? {
              first_name: text(formData.get('firstName')),
              last_name: text(formData.get('lastName')),
              sex: text(formData.get('sex')),
              birth_date: text(formData.get('birthDate')),
              age: Number(formData.get('age') || 0) || '',
              disability_type: text(formData.get('disabilityType')),
              address_province: text(formData.get('addressProvince')),
              address_city: text(formData.get('addressCity')),
              address_barangay: text(formData.get('addressBarangay')),
              contact_country_code: text(formData.get('contactCountryCode')),
              contact_number: text(formData.get('contactNumber')),
              preferred_language: text(formData.get('preferredLanguage')),
              pwd_id_number: text(formData.get('pwdIdOcrExtractedNumber')),
              pwd_id_ocr_status: text(formData.get('pwdIdOcrStatus')) || 'pending',
              pwd_id_ocr_message:
                text(formData.get('pwdIdOcrMessage'))
                || 'Profile and verification files uploaded successfully.',
              profile_image_path: uploadedFiles.profileImageUrl || '',
              pwd_id_front_file_path: uploadedFiles.pwdIdFrontUrl || '',
              pwd_id_back_file_path: uploadedFiles.pwdIdBackUrl || '',
              resume_file_path: uploadedFiles.resumeUrl || '',
              submitted_at: createdAt,
              created_at: createdAt,
            }
          : undefined,
    })

    profile = await writeProfileDocuments(profile, {
      dbInstance: tempDb,
      authInstance: tempAuth,
    })
    profileWritten = true

    await signOut(tempAuth).catch(() => {})

    const storedUser = mapProfileToStoredUser(profile)
    await recordSystemActivity({
      action: 'account.register',
      actionLabel: 'User registered',
      description: `${storedUser.name || storedUser.email || 'User'} completed registration.`,
      targetType: storedUser.role,
      targetId: storedUser.id,
      targetName: storedUser.name,
      targetEmail: storedUser.email,
      metadata: {
        otp_verified: otpVerified,
      },
    }, storedUser)

    return {
      otpRequired: false,
      otpSent: false,
      email,
      user: storedUser,
    }
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths, tempStorage)
    if (profileWritten) {
      await deleteProfileDocuments({
        uid: credential?.user?.uid,
        role,
        dbInstance: tempDb,
      }).catch(() => {})
    }
    if (createdNewAuthAccount) {
      try {
        await credential.user.delete()
      } catch {
        // Ignore cleanup failures and surface the main error.
      }
    }
    await signOut(tempAuth).catch(() => {})
    throw error instanceof Error
      ? error
      : new Error('Unable to save your account details right now.')
  } finally {
    if (tempAuth.currentUser) {
      await signOut(tempAuth).catch(() => {})
    }
    await deleteApp(tempApp).catch(() => {})
  }
}

export const completeVerifiedEmployerRegistration = async (formData) =>
  registerAccount(formData, {
    otpVerified: true,
  })

export const completeVerifiedApplicantRegistration = completeVerifiedEmployerRegistration

export const completeVerifiedRegistration = completeVerifiedEmployerRegistration

export const createBusinessWorkspaceUserAccount = async (payload) => {
  const fullName = text(payload?.fullName)
  const email = normalizeEmail(payload?.email)
  const password = String(payload?.password || '')
  const roleId = text(payload?.roleId || payload?.permissionRoleId)

  if (!fullName || !email || !password.trim() || !roleId) {
    throw new Error('Please complete the full name, email, password, and assigned role fields.')
  }

  try {
    await waitForAuthReady()
    const createBusinessWorkspaceUser = httpsCallable(cloudFunctions, 'createBusinessWorkspaceUser')
    const result = await createBusinessWorkspaceUser({
      ...payload,
      fullName,
      email,
      password,
      roleId,
    })
    const createdUser = result?.data?.user && typeof result.data.user === 'object'
      ? result.data.user
      : null

    if (!createdUser) {
      throw new Error('The workspace user was created, but no profile data was returned.')
    }

    return {
      user: mapProfileToStoredUser(createdUser),
    }
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (error instanceof Error && error.message.startsWith('Please complete')) {
      throw error
    }

    if (error instanceof Error && error.message.startsWith('The workspace user was created')) {
      throw error
    }

    if (code === 'functions/not-found') {
      throw new Error(
        'The createBusinessWorkspaceUser Firebase function is not deployed yet. Deploy your Functions first, then try creating the user again.',
      )
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Sign in again before creating a workspace user.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error(text(error?.message) || 'Your account is not allowed to create workspace users.')
    }

    if (code === 'functions/already-exists') {
      throw new Error('This email address already has an account.')
    }

    if (code === 'functions/invalid-argument' || code === 'functions/failed-precondition') {
      throw new Error(text(error?.message) || 'Please review the workspace user details and try again.')
    }

    if (code === 'functions/internal' || code === 'internal') {
      throw new Error('The workspace user could not be created right now. Check the deployed function logs, then try again.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to create the workspace user right now.',
      ),
    )
  }
}

export const saveBusinessWorkspacePermissions = async (payload = {}) => {
  const roles = Array.isArray(payload?.roles) ? payload.roles : []
  const selectedRoleId = text(payload?.selectedRoleId)

  if (!roles.length) {
    throw new Error('Create at least one workspace permission role before saving.')
  }

  try {
    await waitForAuthReady()
    const saveWorkspacePermissions = httpsCallable(cloudFunctions, 'saveBusinessWorkspacePermissions')
    const result = await saveWorkspacePermissions({
      roles,
      selectedRoleId,
    })

    return {
      saved: result?.data?.saved === true,
      selectedRoleId: text(result?.data?.selectedRoleId || selectedRoleId),
      roles: Array.isArray(result?.data?.roles)
        ? result.data.roles.map((role) =>
            normalizeWorkspacePermissionRoleSnapshot({
              roleId: role?.id,
              permissionRoleId: role?.id,
              permissionRoleName: role?.name,
              permissionRoleSnapshot: role,
            })).filter(Boolean)
        : roles.map((role) =>
            normalizeWorkspacePermissionRoleSnapshot({
              roleId: role?.id,
              permissionRoleId: role?.id,
              permissionRoleName: role?.name,
              permissionRoleSnapshot: role,
            })).filter(Boolean),
      updatedWorkspaceUserCount: Number(result?.data?.updatedWorkspaceUserCount || 0),
    }
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (error instanceof Error && error.message.startsWith('Create at least one')) {
      throw error
    }

    if (code === 'functions/not-found') {
      throw new Error(
        'The saveBusinessWorkspacePermissions Firebase function is not deployed yet. Deploy your Functions first, then try saving permissions again.',
      )
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Sign in again before saving workspace permissions.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error(text(error?.message) || 'Your account is not allowed to manage workspace permissions.')
    }

    if (code === 'functions/invalid-argument' || code === 'functions/failed-precondition') {
      throw new Error(text(error?.message) || 'Review the workspace permission roles, then try saving again.')
    }

    if (code === 'functions/internal' || code === 'internal') {
      throw new Error('Workspace permissions could not be saved right now. Check the deployed function logs, then try again.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to save workspace permissions right now.',
      ),
    )
  }
}

export const getAccountApprovalStatus = async (email) => {
  const normalizedEmail = normalizeEmail(email)
  const storedUser = getStoredAuthUser()
  const candidateUid = text(storedUser?.id || auth.currentUser?.uid)

  if (candidateUid) {
    const profile = await getProfileByUid(candidateUid)
    if (!profile) return null
    if (!normalizedEmail || normalizeEmail(profile.email) === normalizedEmail) {
      return {
        status: text(profile.approval_status) || 'pending',
        banReason: text(profile.ban_reason),
        banDuration: text(profile.ban_duration),
        bannedUntil: text(profile.banned_until),
      }
    }
  }

  const profile = await getProfileByEmail(email)
  if (!profile) return null

  return {
    status: text(profile.approval_status) || 'pending',
    banReason: text(profile.ban_reason),
    banDuration: text(profile.ban_duration),
    bannedUntil: text(profile.banned_until),
  }
}

export const getApplicantApprovalStatus = getAccountApprovalStatus

const sortAdminApplicants = (records) =>
  [...records].sort((left, right) => {
    const leftOrder = Number(left?.sort_order)
    const rightOrder = Number(right?.sort_order)
    const leftHasOrder = Number.isFinite(leftOrder)
    const rightHasOrder = Number.isFinite(rightOrder)

    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1
    }

    const leftTime = Date.parse(left?.created_at || left?.submitted_at || '') || 0
    const rightTime = Date.parse(right?.created_at || right?.submitted_at || '') || 0
    return rightTime - leftTime
  })

const sortAdminEmployers = (records) =>
  [...records].sort((left, right) => {
    const leftOrder = Number(left?.sort_order)
    const rightOrder = Number(right?.sort_order)
    const leftHasOrder = Number.isFinite(leftOrder)
    const rightHasOrder = Number.isFinite(rightOrder)

    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1
    }

    const leftTime = Date.parse(left?.created_at || '') || 0
    const rightTime = Date.parse(right?.created_at || '') || 0
    return rightTime - leftTime
  })

const sortAdminRecordsByCreatedAt = (records) =>
  [...records].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || '') || 0
    const rightTime = Date.parse(right.created_at || '') || 0
    return rightTime - leftTime
  })

const isWorkspaceTeamMemberProfile = (profile) => {
  const workspaceOwnerId = text(profile?.workspace_owner_id || profile?.workspaceOwnerId)
  return profile?.workspace_member === true || Boolean(workspaceOwnerId)
}

const mapProfilesToAdminCollections = (profiles) => ({
  applicants: sortAdminApplicants(
    profiles
      .filter((profile) => text(profile.role) === 'applicant')
      .map(toApplicantRecord),
  ),
  employers: sortAdminEmployers(
    profiles
      .filter((profile) => text(profile.role) === 'employer' && !isWorkspaceTeamMemberProfile(profile))
      .map(toEmployerRecord),
  ),
})

const deletedHistoryDisplayName = (record) =>
  text(record?.name)
  || text(record?.user_profile?.name)
  || text(record?.applicant_profile?.first_name ? `${record.applicant_profile.first_name} ${record.applicant_profile.last_name || ''}` : '')
  || text(record?.employer_profile?.company_name)
  || 'Deleted user'

const toDeletedUserHistoryRecord = (record) => ({
  id: text(record?.uid || record?.id),
  uid: text(record?.uid || record?.id),
  name: deletedHistoryDisplayName(record),
  email: normalizeEmail(record?.email || record?.user_profile?.email || record?.applicant_profile?.email),
  role: text(record?.role || record?.user_profile?.role || record?.applicant_profile?.role || record?.employer_profile?.role) || 'user',
  status: text(record?.status) || 'deleted',
  archived: record?.archived === true,
  auth_state: text(record?.auth_state),
  deleted_at: timestampText(record?.deleted_at),
  restored_at: timestampText(record?.restored_at),
  deleted_by: text(record?.deleted_by),
  restored_by: text(record?.restored_by),
})

const sortDeletedUserHistory = (records) =>
  [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.deleted_at || left?.restored_at || '') || 0
    const rightTime = Date.parse(right?.deleted_at || right?.restored_at || '') || 0
    return rightTime - leftTime
  })

export const getAdminApplicants = async () => {
  const profiles = await getAllProfiles()
  return mapProfilesToAdminCollections(profiles).applicants
}

export const getAdminEmployers = async () => {
  const profiles = await getAllProfiles()
  return mapProfilesToAdminCollections(profiles).employers
}

export const subscribeToAdminProfiles = (handleNext, handleError) => {
  let isClosed = false
  let stopSnapshots = []
  let userProfiles = []
  let applicantProfiles = []
  let employerProfiles = []

  const emitProfiles = () => {
    const profileMap = new Map()

    userProfiles.forEach((profile) => {
      profileMap.set(profile.id, profile)
    })

    employerProfiles.forEach((profile) => {
      const previousProfile = profileMap.get(profile.id) || {}
      profileMap.set(profile.id, {
        ...previousProfile,
        ...profile,
        id: profile.id,
      })
    })

    applicantProfiles.forEach((profile) => {
      profileMap.set(profile.id, profile)
    })

    const rawProfiles = [...profileMap.values()]
    const nextProfiles = rawProfiles.map(withResolvedProfilePublicId)
    const missingPublicIdProfiles = rawProfiles.filter(
      (profile) => ACCOUNT_PUBLIC_ID_CONFIG[text(profile?.role)] && !text(profile?.public_id),
    )

    if (missingPublicIdProfiles.length) {
      Promise.allSettled(
        missingPublicIdProfiles.map((profile) => persistMissingProfilePublicId(profile)),
      ).catch(() => {})
    }

    handleNext(mapProfilesToAdminCollections(nextProfiles))
  }

  waitForAuthReady()
    .then(() => {
      if (isClosed) return

      const stopUsersSnapshot = onSnapshot(
        collection(db, USERS_COLLECTION),
        (snapshot) => {
          userProfiles = snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
            __collection: USERS_COLLECTION,
          }))
          emitProfiles()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )

      const stopApplicantsSnapshot = onSnapshot(
        collection(db, APPLICANT_REGISTRATION_COLLECTION),
        (snapshot) => {
          applicantProfiles = snapshot.docs.map((entry) => toApplicantProfileDocument({
            id: entry.id,
            ...entry.data(),
          }))
          emitProfiles()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )

      const stopEmployersSnapshot = onSnapshot(
        collection(db, EMPLOYERS_COLLECTION),
        (snapshot) => {
          employerProfiles = snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
            __collection: EMPLOYERS_COLLECTION,
          }))
          emitProfiles()
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )

      stopSnapshots = [stopUsersSnapshot, stopApplicantsSnapshot, stopEmployersSnapshot]
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopSnapshots.forEach((stopSnapshot) => stopSnapshot())
    stopSnapshots = []
  }
}

export const subscribeToDeletedUserHistory = (handleNext, handleError) => {
  let isClosed = false
  let stopSnapshot = () => {}

  waitForAuthReady()
    .then(() => {
      if (isClosed) return

      stopSnapshot = onSnapshot(
        collection(db, DELETED_USER_HISTORY_COLLECTION),
        (snapshot) => {
          handleNext(
            sortDeletedUserHistory(
              snapshot.docs.map((entry) => toDeletedUserHistoryRecord({
                id: entry.id,
                ...entry.data(),
              })),
            ),
          )
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopSnapshot()
  }
}

export const subscribeToActivityLogs = (handleNext, handleError) => {
  let isClosed = false
  let stopSnapshot = () => {}

  waitForAuthReady()
    .then(() => {
      if (isClosed) return

      stopSnapshot = onSnapshot(
        query(collection(db, ACTIVITY_LOGS_COLLECTION), orderBy('created_at_server', 'desc'), limit(50)),
        (snapshot) => {
          handleNext(
            snapshot.docs.map((entry) => normalizeActivityLogRecord({
              id: entry.id,
              ...entry.data(),
            })),
          )
        },
        (error) => {
          if (typeof handleError === 'function') handleError(error)
        },
      )
    })
    .catch((error) => {
      if (!isClosed && typeof handleError === 'function') handleError(error)
    })

  return () => {
    isClosed = true
    stopSnapshot()
  }
}

export const updateApplicantApprovalStatus = async (applicantId, payload) => {
  await waitForAuthReady()
  const nextStatus = text(payload?.status).toLowerCase() || 'pending'

  const updates = {
    approval_status: nextStatus,
    reviewed_at: nowIso(),
    rejection_reason: nextStatus === 'rejected' ? text(payload?.rejectionReason) : '',
    ban_duration: nextStatus === 'banned' ? text(payload?.banDuration) || '1_day' : '',
    ban_reason: nextStatus === 'banned' ? text(payload?.banReason) : '',
    banned_until: '',
  }

  if (nextStatus === 'banned') {
    if (updates.ban_duration === '3_days') updates.banned_until = daysFromNowIso(3)
    else if (updates.ban_duration === '7_days') updates.banned_until = daysFromNowIso(7)
    else if (updates.ban_duration === 'permanent') updates.banned_until = ''
      else updates.banned_until = daysFromNowIso(1)
  }

  const nextProfile = await updateApplicantDocuments(applicantId, updates, {
    mirrorToUsers: nextStatus === 'approved',
  })

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === applicantId) {
    setStoredAuthUser(mapProfileToStoredUser(nextProfile))
  }

  await recordSystemActivity({
    action: 'account.applicant.approval',
    actionLabel: 'Applicant status updated',
    description: `${text(nextProfile.name) || 'Applicant'} status changed to ${nextStatus}.`,
    targetType: 'applicant',
    targetId: applicantId,
    targetName: text(nextProfile.name),
    targetEmail: nextProfile.email,
    metadata: {
      approval_status: nextStatus,
      rejection_reason: updates.rejection_reason,
      ban_reason: updates.ban_reason,
      ban_duration: updates.ban_duration,
    },
  })

  return toApplicantRecord(nextProfile)
}

export const updateApplicantAdminDetails = async (applicantId, payload = {}) => {
  await waitForAuthReady()
  const profile = await getProfileByUid(applicantId)
  if (!profile) throw new Error('Failed to update applicant details.')

  const firstName = text(payload.first_name) || text(profile?.applicant_registration?.first_name)
  const lastName = text(payload.last_name) || text(profile?.applicant_registration?.last_name)
  const nextProfile = await updateApplicantDocuments(applicantId, stripUndefined({
    name: `${firstName} ${lastName}`.trim() || text(profile.name) || 'Applicant',
    applicant_registration: {
      ...(profile?.applicant_registration || {}),
      first_name: text(payload.first_name) || text(profile?.applicant_registration?.first_name),
      last_name: text(payload.last_name) || text(profile?.applicant_registration?.last_name),
      contact_number: text(payload.contact_number) || text(profile?.applicant_registration?.contact_number),
      disability_type: text(payload.disability_type) || text(profile?.applicant_registration?.disability_type),
      age: text(payload.age) || text(profile?.applicant_registration?.age),
    },
  }))

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === applicantId) {
    setStoredAuthUser(mapProfileToStoredUser(nextProfile))
  }

  await recordSystemActivity({
    action: 'account.applicant.update',
    actionLabel: 'Applicant details updated',
    description: `${text(nextProfile.name) || 'Applicant'} details were updated by admin.`,
    targetType: 'applicant',
    targetId: applicantId,
    targetName: text(nextProfile.name),
    targetEmail: nextProfile.email,
  })

  return toApplicantRecord(nextProfile)
}

export const updateApplicantProfileDetails = async (applicantId, payload = {}) => {
  await waitForAuthReady()
  const profile = await getProfileByUid(applicantId)
  if (!profile) throw new Error('Failed to update applicant details.')

  const currentRegistration = profile?.applicant_registration || {}
  const firstName = text(payload.first_name) || text(currentRegistration.first_name)
  const lastName = text(payload.last_name) || text(currentRegistration.last_name)

  const nextProfile = await updateApplicantDocuments(applicantId, stripUndefined({
    name: `${firstName} ${lastName}`.trim() || text(profile.name) || 'Applicant',
    avatar: text(payload.avatar) || text(profile.avatar || currentRegistration.avatar),
    avatar_path: text(payload.avatar_path) || text(profile.avatar_path || currentRegistration.avatar_path),
    applicant_registration: {
      ...currentRegistration,
      first_name: firstName,
      middle_name: text(payload.middle_name) || text(currentRegistration.middle_name),
      last_name: lastName,
      sex: text(payload.sex) || text(currentRegistration.sex),
      birth_date: text(payload.birth_date) || text(currentRegistration.birth_date),
      age: text(payload.age) || text(currentRegistration.age),
      disability_type: text(payload.disability_type) || text(currentRegistration.disability_type),
      address_province: text(payload.address_province) || text(currentRegistration.address_province),
      address_city: text(payload.address_city) || text(currentRegistration.address_city),
      address_barangay: text(payload.address_barangay) || text(currentRegistration.address_barangay),
      present_address: text(payload.present_address) || text(currentRegistration.present_address),
      provincial_address: text(payload.provincial_address) || text(currentRegistration.provincial_address),
      place_of_birth: text(payload.place_of_birth) || text(currentRegistration.place_of_birth),
      contact_country_code: text(payload.contact_country_code) || text(currentRegistration.contact_country_code),
      contact_number: text(payload.contact_number) || text(currentRegistration.contact_number),
      telephone_number: text(payload.telephone_number) || text(currentRegistration.telephone_number),
      preferred_language: text(payload.preferred_language) || text(currentRegistration.preferred_language),
      pwd_id_number: text(payload.pwd_id_number) || text(currentRegistration.pwd_id_number),
      avatar: text(payload.avatar) || text(currentRegistration.avatar),
      avatar_path: text(payload.avatar_path) || text(currentRegistration.avatar_path),
    },
  }))

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === applicantId) {
    setStoredAuthUser(mapProfileToStoredUser(nextProfile))
  }

  await recordSystemActivity({
    action: 'account.applicant.profile.update',
    actionLabel: 'Applicant profile updated',
    description: `${text(nextProfile.name) || 'Applicant'} updated their applicant profile.`,
    targetType: 'applicant',
    targetId: applicantId,
    targetName: text(nextProfile.name),
    targetEmail: nextProfile.email,
  })

  return toApplicantRecord(nextProfile)
}

export const updateApplicantSortOrders = async (orderedApplicantIds = []) => {
  await waitForAuthReady()

  const applicantIds = orderedApplicantIds
    .map((value) => text(value))
    .filter(Boolean)

  if (!applicantIds.length) return

  const batch = writeBatch(db)

  applicantIds.forEach((applicantId, index) => {
    const nextSortOrder = index + 1
    batch.set(getApplicantRegistrationDocRef(applicantId), {
      sort_order: nextSortOrder,
      applicant_registration: {
        sort_order: nextSortOrder,
      },
    }, { merge: true })
  })

  await batch.commit()

  await recordSystemActivity({
    action: 'account.applicant.sort',
    actionLabel: 'Applicant order updated',
    description: `${applicantIds.length} applicant sort order entries updated.`,
    targetType: 'applicant',
    metadata: {
      applicant_ids: applicantIds,
    },
  })
}

export const updateEmployerApprovalStatus = async (employerId, payload) => {
  await waitForAuthReady()
  const nextStatus = text(payload?.status).toLowerCase() || 'pending'

  const profile = await updateEmployerDocuments(employerId, {
    approval_status: nextStatus,
    reviewed_at: nowIso(),
    rejection_reason: nextStatus === 'rejected' ? text(payload?.rejectionReason) : '',
    ban_duration: '',
    ban_reason: '',
    banned_until: '',
  })

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === employerId) {
    setStoredAuthUser(mapProfileToStoredUser(profile))
  }

  await recordSystemActivity({
    action: 'account.employer.approval',
    actionLabel: 'Business status updated',
    description: `${text(profile.name) || 'Business'} status changed to ${nextStatus}.`,
    targetType: 'employer',
    targetId: employerId,
    targetName: text(profile.name),
    targetEmail: profile.email,
    metadata: {
      approval_status: nextStatus,
      rejection_reason: text(payload?.rejectionReason),
    },
  })

  return toEmployerRecord(profile)
}

export const updateEmployerAdminDetails = async (employerId, payload = {}) => {
  await waitForAuthReady()

  const profile = await updateEmployerDocuments(employerId, stripUndefined({
    company_name: text(payload.company_name),
    name: text(payload.name || payload.company_name),
    company_contact_number: text(payload.company_contact_number),
    company_location: text(payload.company_location),
    company_category: text(payload.company_category),
    business_contact_email: normalizeEmail(payload.business_contact_email),
    business_avatar: text(payload.business_avatar || payload.avatar),
    avatar: text(payload.avatar || payload.business_avatar),
    business_avatar_path: text(payload.business_avatar_path || payload.avatar_path),
    avatar_path: text(payload.avatar_path || payload.business_avatar_path),
  }))

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === employerId) {
    setStoredAuthUser(mapProfileToStoredUser(profile))
  }

  await recordSystemActivity({
    action: 'account.employer.update',
    actionLabel: 'Business details updated',
    description: `${text(profile.name) || 'Business'} details were updated by admin.`,
    targetType: 'employer',
    targetId: employerId,
    targetName: text(profile.name),
    targetEmail: profile.email,
  })

  return toEmployerRecord(profile)
}

export const updateEmployerSubscriptionState = async (employerId, payload = {}) => {
  await waitForAuthReady()

  const profile = await updateEmployerDocuments(employerId, stripUndefined({
    active_subscription_plan: text(payload.active_subscription_plan),
    active_subscription_mode: text(payload.active_subscription_mode),
    premium_trial_started_at: text(payload.premium_trial_started_at),
    premium_trial_consumed_at: text(payload.premium_trial_consumed_at),
    premium_paid_started_at: text(payload.premium_paid_started_at),
  }))

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === employerId) {
    setStoredAuthUser(mapProfileToStoredUser(profile))
  }

  await recordSystemActivity({
    action: 'account.employer.subscription',
    actionLabel: 'Business subscription updated',
    description: `${text(profile.name) || 'Business'} subscription state synced.`,
    targetType: 'employer',
    targetId: employerId,
    targetName: text(profile.name),
    targetEmail: profile.email,
    metadata: {
      active_subscription_plan: text(payload.active_subscription_plan),
      active_subscription_mode: text(payload.active_subscription_mode),
      premium_trial_started_at: text(payload.premium_trial_started_at),
      premium_trial_consumed_at: text(payload.premium_trial_consumed_at),
      premium_paid_started_at: text(payload.premium_paid_started_at),
    },
  })

  return toEmployerRecord(profile)
}

export const updateEmployerSortOrders = async (orderedEmployerIds = []) => {
  await waitForAuthReady()

  const employerIds = orderedEmployerIds
    .map((value) => text(value))
    .filter(Boolean)

  if (!employerIds.length) return

  const batch = writeBatch(db)

  employerIds.forEach((employerId, index) => {
    const nextSortOrder = index + 1
    batch.set(getUserDocRef(employerId), {
      sort_order: nextSortOrder,
    }, { merge: true })
    batch.set(getEmployerDocRef(employerId), {
      sort_order: nextSortOrder,
    }, { merge: true })
  })

  await batch.commit()

  await recordSystemActivity({
    action: 'account.employer.sort',
    actionLabel: 'Business order updated',
    description: `${employerIds.length} business sort order entries updated.`,
    targetType: 'employer',
    metadata: {
      employer_ids: employerIds,
    },
  })
}

const normalizeAdminWorkspacePermissionRole = (role = {}, index = 0) => {
  const roleId = text(role?.id || `role-${index + 1}`)
  if (!roleId) return null

  return stripUndefined({
    id: roleId,
    name: text(role?.name || `Role ${index + 1}`),
    color: text(role?.color),
    modules: Array.isArray(role?.modules)
      ? role.modules
        .map((module) => {
          const moduleId = text(module?.id)
          if (!moduleId) return null

          return stripUndefined({
            id: moduleId,
            label: text(module?.label),
            description: text(module?.description),
            sectionId: text(module?.sectionId),
            sectionLabel: text(module?.sectionLabel),
            permissions: stripUndefined({
              view: module?.permissions?.view === true,
              edit: module?.permissions?.edit === true,
              full: module?.permissions?.full === true,
            }),
          })
        })
        .filter(Boolean)
      : [],
  })
}

export const updateAdminManagedBusinessWorkspacePermissions = async (payload = {}) => {
  await waitForAuthReady()

  const employerId = text(payload?.employerId)
  if (!employerId) {
    throw new Error('Missing business account before saving admin RBAC.')
  }

  const normalizedRoles = (Array.isArray(payload?.roles) ? payload.roles : [])
    .map((role, index) => normalizeAdminWorkspacePermissionRole(role, index))
    .filter(Boolean)
  const previousRoles = (Array.isArray(payload?.previousRoles) ? payload.previousRoles : [])
    .map((role, index) => normalizeAdminWorkspacePermissionRole(role, index))
    .filter(Boolean)

  if (!normalizedRoles.length) {
    throw new Error('Create at least one business permission role before saving admin RBAC.')
  }

  const selectedRoleId = text(payload?.selectedRoleId)
  const selectedRole = normalizedRoles.find((role) => role.id === selectedRoleId) || normalizedRoles[0] || null
  const previousSelectedRole = previousRoles.find((role) => role.id === selectedRole?.id) || null
  const workspaceUsers = Array.isArray(payload?.workspaceUsers) ? payload.workspaceUsers : []
  const batch = writeBatch(db)
  const removedModules = getRemovedModuleEntries(previousSelectedRole?.modules, selectedRole?.modules)
  const nextRemovalNotices = buildModuleRemovalNotices(removedModules, 'business')
  const affectedUserIds = [...new Set([
    employerId,
    ...workspaceUsers
      .filter((user) => text(user?.roleId || user?.permissionRoleId) === text(selectedRole?.id))
      .map((user) => text(user?.id || user?.uid))
      .filter(Boolean),
  ])]

  if (nextRemovalNotices.length && affectedUserIds.length) {
    const currentUserSnapshots = await Promise.all(
      affectedUserIds.map(async (userId) => {
        const snapshot = await getDoc(getUserDocRef(userId))
        return {
          userId,
          notices: snapshot.exists()
            ? snapshot.data()?.admin_module_access_notices || snapshot.data()?.adminModuleAccessNotices || []
            : [],
        }
      }),
    )

    currentUserSnapshots.forEach(({ userId, notices }) => {
      batch.set(getUserDocRef(userId), {
        admin_module_access_notices: mergeAdminModuleRemovalNotices(notices, nextRemovalNotices),
        updated_at: nowIso(),
      }, { merge: true })
    })
  }

  batch.set(getUserDocRef(employerId), stripUndefined({
    roleId: selectedRole?.id || '',
    permissionRoleId: selectedRole?.id || '',
    workspace_permission_roles: normalizedRoles,
    permissionRoleName: selectedRole?.name,
    permissionRoleSnapshot: selectedRole,
    workspace_permission_role: selectedRole,
    updated_at: nowIso(),
  }), { merge: true })

  batch.set(getEmployerDocRef(employerId), stripUndefined({
    role_id: selectedRole?.id || '',
    permission_role_id: selectedRole?.id || '',
    workspace_permission_roles: normalizedRoles,
    permission_role_name: selectedRole?.name,
    permission_role_snapshot: selectedRole,
    workspace_permission_role: selectedRole,
    updated_at: nowIso(),
  }), { merge: true })

  let updatedWorkspaceUserCount = 0

  workspaceUsers.forEach((user) => {
    const userId = text(user?.id || user?.uid)
    if (!userId) return

    const assignedRoleId = text(user?.roleId || user?.permissionRoleId)
    const matchedRole = normalizedRoles.find((role) => role.id === assignedRoleId) || null

    batch.set(getUserDocRef(userId), stripUndefined({
      roleId: assignedRoleId,
      permissionRoleId: assignedRoleId,
      workspace_permission_roles: normalizedRoles,
      permissionRoleName: matchedRole?.name,
      permissionRoleSnapshot: matchedRole,
      workspace_permission_role: matchedRole,
      updated_at: nowIso(),
    }), { merge: true })

    batch.set(getWorkspaceUserDirectoryDocRef(employerId, userId), stripUndefined({
      role_id: assignedRoleId,
      role_name: matchedRole?.name || text(user?.roleName || user?.permissionRoleName),
      roleSnapshot: matchedRole,
      permissionRoleSnapshot: matchedRole,
      workspace_permission_role: matchedRole,
      updated_at: nowIso(),
    }), { merge: true })

    updatedWorkspaceUserCount += 1
  })

  await batch.commit()

  await recordSystemActivity({
    action: 'account.employer.permissions.admin',
    actionLabel: 'Admin RBAC updated',
    description: `Admin updated RBAC for business ${employerId}.`,
    targetType: 'employer',
    targetId: employerId,
    metadata: {
      selected_role_id: selectedRole?.id || '',
      updated_workspace_user_count: updatedWorkspaceUserCount,
      role_ids: normalizedRoles.map((role) => role.id),
      removed_module_ids: removedModules.map((module) => text(module?.id)).filter(Boolean),
      removal_effective_after_seconds: removedModules.length ? ADMIN_MODULE_REMOVAL_GRACE_SECONDS : 0,
    },
  })

  return {
    saved: true,
    roles: normalizedRoles,
    selectedRoleId: selectedRole?.id || '',
    updatedWorkspaceUserCount,
  }
}

export const updateAdminManagedApplicantWorkspacePermissions = async (payload = {}) => {
  await waitForAuthReady()

  const applicantIds = [...new Set(
    (Array.isArray(payload?.applicantIds) ? payload.applicantIds : [])
      .map((value) => text(value))
      .filter(Boolean),
  )]
  if (!applicantIds.length) {
    throw new Error('Missing applicant accounts before saving applicant RBAC.')
  }

  const nextModules = normalizeAdminApplicantModuleAccess(payload?.modules)
  if (!nextModules.length) {
    throw new Error('Select at least one applicant module before saving applicant RBAC.')
  }

  const previousModules = normalizeAdminApplicantModuleAccess(payload?.previousModules)
  const removedModules = getRemovedModuleEntries(previousModules, nextModules)
  const nextRemovalNotices = buildModuleRemovalNotices(removedModules, 'applicant')
  const currentUserSnapshots = await Promise.all(
    applicantIds.map(async (applicantId) => {
      const [userSnapshot, registrationSnapshot] = await Promise.all([
        getDoc(getUserDocRef(applicantId)),
        getDoc(getApplicantRegistrationDocRef(applicantId)),
      ])

      return {
        applicantId,
        userNotices: userSnapshot.exists()
          ? userSnapshot.data()?.admin_module_access_notices || userSnapshot.data()?.adminModuleAccessNotices || []
          : [],
        registrationNotices: registrationSnapshot.exists()
          ? registrationSnapshot.data()?.admin_module_access_notices || registrationSnapshot.data()?.adminModuleAccessNotices || []
          : [],
      }
    }),
  )
  const batch = writeBatch(db)

  currentUserSnapshots.forEach(({ applicantId, userNotices, registrationNotices }) => {
    const mergedUserNotices = nextRemovalNotices.length
      ? mergeAdminModuleRemovalNotices(userNotices, nextRemovalNotices)
      : normalizeAdminModuleAccessNotices(userNotices)
    const mergedRegistrationNotices = nextRemovalNotices.length
      ? mergeAdminModuleRemovalNotices(registrationNotices, nextRemovalNotices)
      : normalizeAdminModuleAccessNotices(registrationNotices)

    batch.set(getUserDocRef(applicantId), stripUndefined({
      admin_applicant_module_access: nextModules,
      admin_module_access_notices: mergedUserNotices,
      updated_at: nowIso(),
    }), { merge: true })

    batch.set(getApplicantRegistrationDocRef(applicantId), stripUndefined({
      admin_applicant_module_access: nextModules,
      admin_module_access_notices: mergedRegistrationNotices,
      updated_at: nowIso(),
    }), { merge: true })
  })

  await batch.commit()

  await recordSystemActivity({
    action: 'account.applicant.permissions.admin',
    actionLabel: 'Applicant RBAC updated',
    description: `Admin updated applicant RBAC for ${applicantIds.length} account${applicantIds.length === 1 ? '' : 's'}.`,
    targetType: 'applicant',
    metadata: {
      applicant_ids: applicantIds,
      module_ids: nextModules.map((module) => text(module?.id)).filter(Boolean),
      removed_module_ids: removedModules.map((module) => text(module?.id)).filter(Boolean),
      removal_effective_after_seconds: removedModules.length ? ADMIN_MODULE_REMOVAL_GRACE_SECONDS : 0,
    },
  })

  return {
    saved: true,
    applicantIds,
    modules: nextModules,
    updatedApplicantCount: applicantIds.length,
  }
}

export const deleteApplicantAccountRecord = async (applicantId) => {
  await waitForAuthReady()
  const deleteManagedAccount = httpsCallable(cloudFunctions, 'deleteManagedAccount')
  try {
    await deleteManagedAccount({
      uid: applicantId,
      role: 'applicant',
    })
    await recordSystemActivity({
      action: 'account.applicant.delete',
      actionLabel: 'Applicant account deleted',
      description: `Applicant account ${applicantId} was deleted.`,
      targetType: 'applicant',
      targetId: applicantId,
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('Delete service is not available yet. Please try again later.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your session has expired. Sign in again, then retry deleting this account.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error('Only admin accounts can delete managed users.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to delete this applicant right now.',
      ),
    )
  }
}

export const deleteEmployerAccountRecord = async (employerId) => {
  await waitForAuthReady()
  const deleteManagedAccount = httpsCallable(cloudFunctions, 'deleteManagedAccount')
  try {
    await deleteManagedAccount({
      uid: employerId,
      role: 'employer',
    })
    await recordSystemActivity({
      action: 'account.employer.delete',
      actionLabel: 'Business account deleted',
      description: `Business account ${employerId} was deleted.`,
      targetType: 'employer',
      targetId: employerId,
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('Delete service is not available yet. Please try again later.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your session has expired. Sign in again, then retry deleting this account.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error('Only admin accounts can delete managed users.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to delete this employer right now.',
      ),
    )
  }
}

export const updateDeletedUserArchiveState = async (historyId, archived) => {
  await waitForAuthReady()
  const updateDeletedUserHistoryArchiveState = httpsCallable(cloudFunctions, 'updateDeletedUserHistoryArchiveState')

  try {
    await updateDeletedUserHistoryArchiveState({
      uid: historyId,
      archived: archived === true,
    })
    await recordSystemActivity({
      action: archived === true ? 'history.archive' : 'history.unarchive',
      actionLabel: archived === true ? 'Deleted history archived' : 'Deleted history restored to active list',
      description: `Deleted user history ${historyId} archive state updated.`,
      targetType: 'deleted_user_history',
      targetId: historyId,
      metadata: {
        archived: archived === true,
      },
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('Archive service is not available yet. Please try again later.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your session has expired. Sign in again, then retry updating this history record.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error('Only admin accounts can update deleted history records.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to update the archive state right now.',
      ),
    )
  }
}

export const deleteDeletedUserHistoryRecord = async (historyId) => {
  await waitForAuthReady()
  const deleteDeletedUserHistoryRecordCallable = httpsCallable(cloudFunctions, 'deleteDeletedUserHistoryRecord')

  try {
    await deleteDeletedUserHistoryRecordCallable({
      uid: historyId,
    })
    await recordSystemActivity({
      action: 'history.delete',
      actionLabel: 'Deleted history removed',
      description: `Deleted user history ${historyId} was permanently removed.`,
      targetType: 'deleted_user_history',
      targetId: historyId,
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('Delete service is not available yet. Please try again later.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your session has expired. Sign in again, then retry deleting this history record.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error('Only admin accounts can delete deleted history records.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to delete this history record right now.',
      ),
    )
  }
}

export const restoreDeletedUserHistoryRecord = async (historyId) => {
  await waitForAuthReady()
  const restoreDeletedManagedAccount = httpsCallable(cloudFunctions, 'restoreDeletedManagedAccount')

  try {
    await restoreDeletedManagedAccount({
      uid: historyId,
    })
    await recordSystemActivity({
      action: 'account.restore',
      actionLabel: 'Deleted account restored',
      description: `Deleted user ${historyId} was restored.`,
      targetType: 'deleted_user_history',
      targetId: historyId,
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('Restore service is not available yet. Please try again later.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your session has expired. Sign in again, then retry restoring this user.')
    }

    if (code === 'functions/permission-denied') {
      throw new Error('Only admin accounts can restore deleted users.')
    }

    throw new Error(
      getFirebaseServiceErrorMessage(
        error,
        text(error?.message) || 'Unable to restore this deleted user right now.',
      ),
    )
  }
}

export const normalizeEmployerOrganizationType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'business') return 'business'
  if (normalized === 'company') return 'company'
  return ''
}

export const getEmployerDashboardRoute = (user) => {
  const employerType = normalizeEmployerOrganizationType(
    user?.company_organization_type || user?.companyOrganizationType,
  )

  if (employerType === 'business') return '/employer/business'
  if (employerType === 'company') return '/employer/company'
  return '/login'
}
