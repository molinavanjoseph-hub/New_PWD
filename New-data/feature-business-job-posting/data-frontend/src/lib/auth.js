import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { app, auth, cloudFunctions, db, storage } from '@/firebase'

const USERS_COLLECTION = 'users'
const EMPLOYERS_COLLECTION = 'employers'
const WORKSPACE_USERS_SUBCOLLECTION = 'workspace_users'
const APPLICANT_REGISTRATION_COLLECTION = 'applicant_registration'
const DELETED_USER_HISTORY_COLLECTION = 'deleted_user_history'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const text = (value) => String(value || '').trim()
const cloneJson = (value) => JSON.parse(JSON.stringify(value))
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
const waitForAuthReady = () =>
  typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()

const ensureAuthenticatedUserSession = async (credential) => {
  const signedInUser = credential?.user
  if (!signedInUser) {
    throw new Error('Firebase Authentication did not return the newly created user session.')
  }

  await waitForAuthReady()
  await signedInUser.getIdToken(true)
  await waitForAuthReady()

  if (auth.currentUser?.uid !== signedInUser.uid) {
    throw new Error('Firebase Authentication is not ready yet for profile uploads. Please try again.')
  }

  return signedInUser
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

const getFirebaseServiceErrorMessage = (error, fallback = '') => {
  const code = text(error?.code)
  const message = text(error?.message).toLowerCase()

  if (code === 'auth/operation-not-allowed') {
    return 'Email/password sign-in is not enabled in Firebase Authentication.'
  }

  if (code === 'auth/network-request-failed') {
    return 'Firebase could not be reached. Check your internet connection and Firebase project settings.'
  }

  if (code === 'auth/invalid-api-key') {
    return 'Your Firebase API key is invalid or does not match this project.'
  }

  if (code === 'auth/app-not-authorized' || code === 'auth/unauthorized-domain') {
    return 'This app domain is not authorized in Firebase Authentication.'
  }

  if (code === 'permission-denied' || code === 'firestore/permission-denied' || code === 'storage/unauthorized') {
    return 'Firebase rules are blocking this request. Check your Firestore or Storage rules.'
  }

  if (code === 'storage/unauthenticated') {
    return 'Firebase Storage did not receive your signed-in session yet. Please try registering again.'
  }

  if (code === 'failed-precondition') {
    return 'Cloud Firestore is not ready yet. Create the Firestore Database in your Firebase project first.'
  }

  if (message.includes('client is offline')) {
    return 'Cloud Firestore could not connect to Firebase. Reload the page and try again.'
  }

  if (code === 'unavailable') {
    return 'Cloud Firestore is temporarily unavailable. Reload the page and try again.'
  }

  if (code === 'storage/bucket-not-found') {
    return 'Firebase Storage bucket is not configured for this project.'
  }

  if (code === 'storage/retry-limit-exceeded') {
    return 'Firebase Storage upload timed out. Please try again.'
  }

  if (code === 'storage/unknown') {
    return 'Firebase Storage returned an unknown error. Check the bucket and Storage rules.'
  }

  return fallback
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

const uploadStorageFile = async ({ path, file }) => {
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, file, file.type ? { contentType: file.type } : undefined)
  const url = await getDownloadURL(fileRef)
  return {
    path: fileRef.fullPath,
    url,
  }
}

const deleteUploadedFiles = async (paths) => {
  await Promise.all(
    paths.map((path) =>
      deleteObject(storageRef(storage, path)).catch(() => {}),
    ),
  )
}

const uploadRegistrationFiles = async ({ uid, role, formData }) => {
  const timestamp = Date.now()
  const uploadedPaths = []

  const uploadAndTrack = async (path, file) => {
    const uploaded = await uploadStorageFile({ path, file })
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

const mapProfileToStoredUser = (profile) => {
  const normalizedProfile = {
    id: profile.id,
    uid: profile.id,
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

  if (normalizedProfile.role === 'applicant') {
    const registration = cloneJson(profile.applicant_registration || {})
    normalizedProfile.applicant_registration = registration
    normalizedProfile.applicantRegistration = registration
  }

  if (normalizedProfile.role === 'employer') {
    normalizedProfile.company_name = text(profile.company_name || profile.name)
    normalizedProfile.company_category = text(profile.company_category)
    normalizedProfile.company_location = text(profile.company_location)
    normalizedProfile.company_contact_number = text(profile.company_contact_number)
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
  localStorage.setItem('authUser', JSON.stringify(storedUser))

  if (firebaseUser) {
    const token = await firebaseUser.getIdToken()
    localStorage.setItem('authToken', token)
  }

  return storedUser
}

const getUserDocRef = (uid) => doc(db, USERS_COLLECTION, uid)
const getEmployerDocRef = (uid) => doc(db, EMPLOYERS_COLLECTION, uid)
const getWorkspaceUserDirectoryDocRef = (workspaceOwnerId, uid) =>
  doc(db, EMPLOYERS_COLLECTION, workspaceOwnerId, WORKSPACE_USERS_SUBCOLLECTION, uid)
const getWorkspaceUserDirectoryCollectionRef = (workspaceOwnerId) =>
  collection(db, EMPLOYERS_COLLECTION, workspaceOwnerId, WORKSPACE_USERS_SUBCOLLECTION)
const getApplicantRegistrationDocRef = (uid) => doc(db, APPLICANT_REGISTRATION_COLLECTION, uid)
const getDeletedUserHistoryDocRef = (uid) => doc(db, DELETED_USER_HISTORY_COLLECTION, uid)

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

const getProfileByUid = async (uid) => {
  if (!uid) return null
  await waitForAuthReady()

  const snapshot = await getDoc(getUserDocRef(uid))
  if (snapshot.exists()) {
    return {
      id: snapshot.id,
      ...snapshot.data(),
      __collection: USERS_COLLECTION,
    }
  }

  const applicantSnapshot = await getDoc(getApplicantRegistrationDocRef(uid))
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

  const applicantSnapshot = await getDocs(
    query(collection(db, APPLICANT_REGISTRATION_COLLECTION), where('email', '==', normalizedEmail), limit(1)),
  )

  if (applicantSnapshot.empty) return null

  return toApplicantProfileDocument({
    id: applicantSnapshot.docs[0].id,
    ...applicantSnapshot.docs[0].data(),
  })
}

const getAllProfiles = async () => {
  await waitForAuthReady()
  const [userSnapshot, applicantSnapshot] = await Promise.all([
    getDocs(collection(db, USERS_COLLECTION)),
    getDocs(collection(db, APPLICANT_REGISTRATION_COLLECTION)),
  ])

  const profileMap = new Map()

  userSnapshot.docs.forEach((entry) => {
    profileMap.set(entry.id, {
      id: entry.id,
      ...entry.data(),
      __collection: USERS_COLLECTION,
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
    profile_image_path: text(registration.profile_image_path),
    pwd_id_front_file_path: text(registration.pwd_id_front_file_path),
    pwd_id_back_file_path: text(registration.pwd_id_back_file_path),
    resume_file_path: text(registration.resume_file_path),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : null,
    name: applicantName,
    email: applicantEmail,
    role: 'applicant',
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
  company_organization_type: normalizeEmployerOrganizationType(profile.company_organization_type),
  company_verification_document_1_path: text(profile.company_verification_document_1_path),
  company_verification_document_2_path: text(profile.company_verification_document_2_path),
  company_verification_document_3_path: text(profile.company_verification_document_3_path),
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
    role: 'employer',
    account_type: normalizeEmployerOrganizationType(profile.company_organization_type),
  })

const isWorkspaceUserProfile = (profile) =>
  text(profile?.role) === 'employer'
  && Boolean(text(profile?.workspace_owner_id || profile?.workspaceOwnerId))

const toWorkspaceUserDirectoryRecord = (profile) => {
  const id = text(profile?.id || profile?.uid)
  const normalizedRoleId = text(profile?.roleId || profile?.permissionRoleId)
  const permissionRoleSnapshot = normalizeWorkspacePermissionRoleSnapshot(profile)
  const permissionRoleName = text(profile?.permissionRoleName || permissionRoleSnapshot?.name)
  const workspaceOwnerId = text(profile?.workspace_owner_id || profile?.workspaceOwnerId)
  const workspaceOwnerEmail = normalizeEmail(profile?.workspace_owner_email || profile?.workspaceOwnerEmail)
  const workspaceOwnerRole = text(profile?.workspace_owner_role || profile?.workspaceOwnerRole) || 'employer'
  const workspaceOwnerName = text(profile?.workspace_owner_name || profile?.workspaceOwnerName)
  const organizationType = normalizeEmployerOrganizationType(profile?.company_organization_type)
  const businessContactEmail = normalizeEmail(profile?.business_contact_email || profile?.email)

  return stripUndefined({
    id,
    uid: id,
    email: normalizeEmail(profile?.email),
    role: 'employer',
    name: text(profile?.name || profile?.company_name) || 'Workspace User',
    approval_status: text(profile?.approval_status) || 'approved',
    email_verified: profile?.email_verified === true,
    email_verified_at: timestampText(profile?.email_verified_at),
    created_at: timestampText(profile?.created_at),
    reviewed_at: timestampText(profile?.reviewed_at),
    rejection_reason: text(profile?.rejection_reason),
    ban_reason: text(profile?.ban_reason),
    ban_duration: text(profile?.ban_duration),
    banned_until: text(profile?.banned_until),
    business_contact_email: businessContactEmail || undefined,
    company_name: text(profile?.company_name || profile?.name),
    company_category: text(profile?.company_category),
    company_location: text(profile?.company_location),
    company_contact_number: text(profile?.company_contact_number),
    company_organization_type: organizationType,
    account_type: organizationType,
    roleId: normalizedRoleId || undefined,
    permissionRoleId: normalizedRoleId || undefined,
    permissionRoleName: permissionRoleName || undefined,
    permissionRoleSnapshot: permissionRoleSnapshot || undefined,
    workspace_permission_role: permissionRoleSnapshot || undefined,
    workspace_member: true,
    workspace_owner_id: workspaceOwnerId || undefined,
    workspace_owner_email: workspaceOwnerEmail || undefined,
    workspace_owner_role: workspaceOwnerRole || undefined,
    workspace_owner_name: workspaceOwnerName || undefined,
    user: stripUndefined({
      id,
      email: normalizeEmail(profile?.email),
      name: text(profile?.name || profile?.company_name),
      role: 'employer',
      permission_role_id: normalizedRoleId || undefined,
      permission_role_name: permissionRoleName || undefined,
    }),
  })
}

const getApplicantProfileDocRef = (profileOrUid) => {
  if (typeof profileOrUid === 'string') return getApplicantRegistrationDocRef(profileOrUid)
  return text(profileOrUid?.__collection) === USERS_COLLECTION
    ? getUserDocRef(profileOrUid.id)
    : getApplicantRegistrationDocRef(profileOrUid.id)
}

const writeProfileDocuments = async (profile) => {
  const batch = writeBatch(db)
  const role = text(profile.role)

  if (role === 'applicant') {
    batch.set(getApplicantRegistrationDocRef(profile.id), toApplicantProfileDocument(profile, ''))
  } else {
    batch.set(getUserDocRef(profile.id), profile)
  }

  if (role === 'employer') {
    batch.set(getEmployerDocRef(profile.id), toEmployerCollectionRecord(profile))

    if (isWorkspaceUserProfile(profile)) {
      batch.set(
        getWorkspaceUserDirectoryDocRef(text(profile.workspace_owner_id || profile.workspaceOwnerId), profile.id),
        toWorkspaceUserDirectoryRecord(profile),
      )
    }
  }

  await batch.commit()
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
  const previousWorkspaceOwnerId = text(profile?.workspace_owner_id || profile?.workspaceOwnerId)
  const nextWorkspaceOwnerId = text(nextProfile?.workspace_owner_id || nextProfile?.workspaceOwnerId)
  batch.update(getUserDocRef(employerId), updates)
  batch.set(getEmployerDocRef(employerId), toEmployerCollectionRecord(nextProfile))

  if (previousWorkspaceOwnerId && previousWorkspaceOwnerId !== nextWorkspaceOwnerId) {
    batch.delete(getWorkspaceUserDirectoryDocRef(previousWorkspaceOwnerId, employerId))
  }

  if (isWorkspaceUserProfile(nextProfile)) {
    batch.set(
      getWorkspaceUserDirectoryDocRef(nextWorkspaceOwnerId, employerId),
      toWorkspaceUserDirectoryRecord(nextProfile),
    )
  }

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

const deleteEmployerDocuments = async (employerId) => {
  const profile = await getProfileByUid(employerId)
  const workspaceOwnerId = text(profile?.workspace_owner_id || profile?.workspaceOwnerId)
  const batch = writeBatch(db)
  batch.delete(getUserDocRef(employerId))
  batch.delete(getEmployerDocRef(employerId))

  if (workspaceOwnerId) {
    batch.delete(getWorkspaceUserDirectoryDocRef(workspaceOwnerId, employerId))
  }

  await batch.commit()
}

const deleteProfileDocuments = async ({ uid, role }) => {
  if (!uid) return

  if (role === 'employer') {
    await deleteEmployerDocuments(uid)
    return
  }

  if (role === 'applicant') {
    await deleteDoc(getApplicantRegistrationDocRef(uid))
    return
  }

  await deleteDoc(getUserDocRef(uid))
}

const toFirebaseErrorMessage = (error, mode = 'login') => {
  const code = text(error?.code)
  const serviceMessage = getFirebaseServiceErrorMessage(error)
  const activeProjectId = text(app?.options?.projectId)

  if (serviceMessage) return serviceMessage

  if (code === 'auth/email-already-in-use') {
    return activeProjectId
      ? `This email is still registered in Firebase Authentication for ${activeProjectId}. Delete it from Authentication > Users, then try again.`
      : 'This email is still registered in Firebase Authentication. Delete it from Authentication > Users, then try again.'
  }
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.'
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
  if (code === 'auth/too-many-requests') {
    return 'Too many incorrect password attempts. Please try again later.'
  }

  if (code === 'auth/user-not-found') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'No account was found for this email address.'
  }

  if (code === 'auth/wrong-password') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'Incorrect password.'
  }

  if (code === 'auth/invalid-credential') {
    return mode === 'register'
      ? 'Registration failed. Please review your account details.'
      : 'Invalid email or password.'
  }

  return mode === 'register'
    ? 'Registration failed. Please try again.'
    : 'Unable to sign in with Firebase right now.'
}

const recoverRegistrationCredential = async ({ email, password }) => {
  let credential
  try {
    credential = await signInWithEmailAndPassword(auth, email, password)
  } catch (error) {
    const code = text(error?.code)
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw new Error(
        'This email still has a Firebase Authentication account. Use its current password or delete it from Authentication > Users before registering again.',
      )
    }

    throw new Error(toFirebaseErrorMessage(error, 'register'))
  }

  try {
    const existingProfile = await getProfileByUid(credential.user.uid)
    if (existingProfile) {
      throw new Error('This email already has an account. Please sign in instead.')
    }

    return credential
  } catch (error) {
    await signOut(auth).catch(() => {})

    if (error instanceof Error) throw error

    throw new Error('Unable to load your existing Firebase account details right now.')
  }
}

export const clearAuthSession = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')
  void signOut(auth).catch(() => {})
}

export const getStoredAuthUser = () => {
  const rawUser = localStorage.getItem('authUser')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    clearAuthSession()
    return null
  }
}

const syncStoredAuthUserWithProfile = (profile) => {
  if (!profile?.id) return null

  const mappedProfile = mapProfileToStoredUser(profile)
  const existingStoredUser = getStoredAuthUser()
  const nextStoredUser = stripUndefined({
    ...(existingStoredUser || {}),
    ...mappedProfile,
  })

  if (!Object.prototype.hasOwnProperty.call(mappedProfile, 'roleId')) {
    delete nextStoredUser.roleId
    delete nextStoredUser.permissionRoleId
  }

  if (!Object.prototype.hasOwnProperty.call(mappedProfile, 'permissionRoleName')) {
    delete nextStoredUser.permissionRoleName
  }

  if (!Object.prototype.hasOwnProperty.call(mappedProfile, 'permissionRoleSnapshot')) {
    delete nextStoredUser.permissionRoleSnapshot
  }

  if (!Object.prototype.hasOwnProperty.call(mappedProfile, 'workspace_permission_role')) {
    delete nextStoredUser.workspace_permission_role
  }

  if (!Object.prototype.hasOwnProperty.call(mappedProfile, 'workspace_permission_roles')) {
    delete nextStoredUser.workspace_permission_roles
    delete nextStoredUser.workspacePermissionRoles
  }

  localStorage.setItem('authUser', JSON.stringify(nextStoredUser))
  return nextStoredUser
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
        query(getWorkspaceUserDirectoryCollectionRef(normalizedWorkspaceOwnerId)),
        (snapshot) => {
          const workspaceUsers = snapshot.docs
            .map((entry) => ({
              id: entry.id,
              ...entry.data(),
              __collection: WORKSPACE_USERS_SUBCOLLECTION,
            }))
            .sort((left, right) => {
              const leftTime = Date.parse(left?.created_at || '') || 0
              const rightTime = Date.parse(right?.created_at || '') || 0

              if (leftTime !== rightTime) return rightTime - leftTime

              return text(left?.name).localeCompare(text(right?.name))
            })
            .map((profile) => mapProfileToStoredUser(profile))

          if (typeof handleNext === 'function') handleNext(workspaceUsers)
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

  let credential
  try {
    credential = await signInWithEmailAndPassword(auth, normalizedEmail, String(password || ''))
  } catch (error) {
    throw new Error(toFirebaseErrorMessage(error, 'login'))
  }

  let profile
  try {
    profile = await getProfileByUid(credential.user.uid)
  } catch (error) {
    await signOut(auth).catch(() => {})
    throw new Error(
      getFirebaseServiceErrorMessage(error, 'Unable to load your account details from Cloud Firestore.'),
    )
  }

  if (!profile) {
    await signOut(auth).catch(() => {})
    throw new Error('No account was found for this email address.')
  }

  if (isApprovalTrackedRole(profile.role) && text(profile.approval_status) !== 'approved') {
    await signOut(auth).catch(() => {})
    throw new Error(getApprovalErrorMessage(profile))
  }

  const storedUser = await persistAuthSession(profile, credential.user)
  return {
    token: localStorage.getItem('authToken') || '',
    user: storedUser,
  }
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
      pwd_id_ocr_status: 'pending',
      pwd_id_ocr_message: 'Account created by admin. Supporting files are still empty.',
      profile_image_path: '',
      pwd_id_front_file_path: '',
      pwd_id_back_file_path: '',
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

const buildBusinessWorkspaceUserProfile = ({ uid, createdAt, payload }) => {
  const normalizedRoleId = text(payload?.roleId || payload?.permissionRoleId)
  const permissionRoleName = text(payload?.permissionRoleName)
  const permissionRoleSnapshot = normalizeWorkspacePermissionRoleSnapshot({
    roleId: normalizedRoleId,
    permissionRoleId: normalizedRoleId,
    permissionRoleName,
    permissionRoleSnapshot: payload?.permissionRoleSnapshot,
  })
  const workspaceOwnerId = text(payload?.workspaceOwnerId || payload?.workspace_owner_id)
  const workspaceOwnerEmail = normalizeEmail(payload?.workspaceOwnerEmail || payload?.workspace_owner_email)
  const workspaceOwnerRole = text(payload?.workspaceOwnerRole || payload?.workspace_owner_role) || 'employer'
  const workspaceOwnerName = text(payload?.workspaceOwnerName || payload?.workspace_owner_name)

  return stripUndefined({
    id: uid,
    uid,
    email: normalizeEmail(payload?.email),
    role: 'employer',
    name: text(payload?.fullName) || 'Workspace User',
    approval_status: 'approved',
    email_verified: true,
    email_verified_at: createdAt,
    created_at: createdAt,
    reviewed_at: createdAt,
    rejection_reason: '',
    ban_reason: '',
    ban_duration: '',
    banned_until: '',
    business_contact_email: workspaceOwnerEmail || normalizeEmail(payload?.email),
    company_name: text(payload?.companyName) || text(payload?.workspaceOwnerName) || 'Business Workspace',
    company_category: text(payload?.companyCategory),
    company_location: text(payload?.companyLocation),
    company_contact_number: text(payload?.companyContactNumber),
    company_organization_type: normalizeEmployerOrganizationType(payload?.companyOrganizationType) || 'business',
    company_verification_document_1_path: '',
    company_verification_document_2_path: '',
    company_verification_document_3_path: '',
    roleId: normalizedRoleId || undefined,
    permissionRoleId: normalizedRoleId || undefined,
    permissionRoleName: permissionRoleName || permissionRoleSnapshot?.name || undefined,
    permissionRoleSnapshot: permissionRoleSnapshot || undefined,
    workspace_permission_role: permissionRoleSnapshot || undefined,
    workspace_member: true,
    workspace_owner_id: workspaceOwnerId || undefined,
    workspace_owner_email: workspaceOwnerEmail || undefined,
    workspace_owner_role: workspaceOwnerRole || undefined,
    workspace_owner_name: workspaceOwnerName || undefined,
  })
}

const createTemporaryAdminAuth = () => {
  const appName = `admin-user-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tempApp = initializeApp(app.options, appName)
  return {
    tempApp,
    tempAuth: getAuth(tempApp),
  }
}

export const createAdminManagedAccount = async (payload) => {
  const accountType = text(payload?.accountType).toLowerCase()
  const email = normalizeEmail(payload?.email)
  const password = String(payload?.password || '')

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

  const { tempApp, tempAuth } = createTemporaryAdminAuth()
  let accountCreated = false

  try {
    const credential = await createUserWithEmailAndPassword(tempAuth, email, password)
    accountCreated = true
    const createdAt = nowIso()
    const profile =
      accountType === 'applicant'
        ? buildAdminCreatedApplicantProfile({
            uid: credential.user.uid,
            createdAt,
            form: payload,
          })
        : buildAdminCreatedEmployerProfile({
            uid: credential.user.uid,
            createdAt,
            form: payload,
          })

    try {
      await writeProfileDocuments(profile)
    } catch (firestoreError) {
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

    return {
      user: mapProfileToStoredUser(profile),
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

  let credential
  let createdNewAuthAccount = false
  let profileWritten = false
  try {
    credential = await createUserWithEmailAndPassword(auth, email, password)
    createdNewAuthAccount = true
  } catch (error) {
    if (text(error?.code) === 'auth/email-already-in-use') {
      credential = await recoverRegistrationCredential({ email, password })
    } else {
      throw new Error(toFirebaseErrorMessage(error, 'register'))
    }
  }

  let uploadedPaths = []

  const createdAt = nowIso()
  try {
    await ensureAuthenticatedUserSession(credential)

    const uploadedFiles = await uploadRegistrationFiles({
      uid: credential.user.uid,
      role,
      formData,
    })
    uploadedPaths = uploadedFiles.uploadedPaths

    const profile = stripUndefined({
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
                || 'Profile and verification files uploaded to Firebase successfully.',
              profile_image_path: uploadedFiles.profileImageUrl || '',
              pwd_id_front_file_path: uploadedFiles.pwdIdFrontUrl || '',
              pwd_id_back_file_path: uploadedFiles.pwdIdBackUrl || '',
              resume_file_path: uploadedFiles.resumeUrl || '',
              submitted_at: createdAt,
              created_at: createdAt,
            }
          : undefined,
    })

    await writeProfileDocuments(profile)
    profileWritten = true

    await signOut(auth).catch(() => {})
    clearAuthSession()

    return {
      otpRequired: false,
      otpSent: false,
      email,
      user: mapProfileToStoredUser(profile),
    }
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths)
    if (profileWritten) {
      await deleteProfileDocuments({
        uid: credential?.user?.uid,
        role,
      }).catch(() => {})
    }
    if (createdNewAuthAccount) {
      try {
        await credential.user.delete()
      } catch {
        // Ignore cleanup failures and surface the main error.
      }
    }
    await signOut(auth).catch(() => {})
    clearAuthSession()
    throw error instanceof Error
      ? error
      : new Error('Unable to save your account details right now.')
  }
}

export const completeVerifiedEmployerRegistration = async (formData) =>
  registerAccount(formData, {
    otpVerified: true,
  })

export const completeVerifiedApplicantRegistration = completeVerifiedEmployerRegistration

export const completeVerifiedRegistration = completeVerifiedEmployerRegistration

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

const isWorkspaceMemberProfile = (profile) =>
  profile?.workspace_member === true
  || Boolean(text(profile?.workspace_owner_id || profile?.workspaceOwnerId))

const mapProfilesToAdminCollections = (profiles) => ({
  applicants: sortAdminApplicants(
    profiles
      .filter((profile) => text(profile.role) === 'applicant')
      .map(toApplicantRecord),
  ),
  employers: sortAdminEmployers(
    profiles
      .filter((profile) => text(profile.role) === 'employer' && !isWorkspaceMemberProfile(profile))
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

  const emitProfiles = () => {
    const profileMap = new Map()

    userProfiles.forEach((profile) => {
      profileMap.set(profile.id, profile)
    })

    applicantProfiles.forEach((profile) => {
      profileMap.set(profile.id, profile)
    })

    handleNext(mapProfilesToAdminCollections([...profileMap.values()]))
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

      stopSnapshots = [stopUsersSnapshot, stopApplicantsSnapshot]
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
    localStorage.setItem('authUser', JSON.stringify(mapProfileToStoredUser(nextProfile)))
  }

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
    localStorage.setItem('authUser', JSON.stringify(mapProfileToStoredUser(nextProfile)))
  }

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
    localStorage.setItem('authUser', JSON.stringify(mapProfileToStoredUser(profile)))
  }

  return toEmployerRecord(profile)
}

export const updateEmployerAdminDetails = async (employerId, payload = {}) => {
  await waitForAuthReady()

  const profile = await updateEmployerDocuments(employerId, stripUndefined({
    company_name: text(payload.company_name),
    name: text(payload.company_name),
    company_contact_number: text(payload.company_contact_number),
    company_location: text(payload.company_location),
    company_category: text(payload.company_category),
  }))

  const storedUser = getStoredAuthUser()
  if (storedUser?.id === employerId) {
    localStorage.setItem('authUser', JSON.stringify(mapProfileToStoredUser(profile)))
  }

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
}

export const deleteApplicantAccountRecord = async (applicantId) => {
  await waitForAuthReady()
  const deleteManagedAccount = httpsCallable(cloudFunctions, 'deleteManagedAccount')
  try {
    await deleteManagedAccount({
      uid: applicantId,
      role: 'applicant',
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('The deleteManagedAccount Firebase function is not deployed yet. Deploy your Functions first, then try deleting again.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your Firebase admin session is not active. Sign in again, then retry deleting this account.')
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
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('The deleteManagedAccount Firebase function is not deployed yet. Deploy your Functions first, then try deleting again.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your Firebase admin session is not active. Sign in again, then retry deleting this account.')
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
  await updateDoc(getDeletedUserHistoryDocRef(historyId), {
    archived: archived === true,
  })
}

export const restoreDeletedUserHistoryRecord = async (historyId) => {
  await waitForAuthReady()
  const restoreDeletedManagedAccount = httpsCallable(cloudFunctions, 'restoreDeletedManagedAccount')

  try {
    await restoreDeletedManagedAccount({
      uid: historyId,
    })
  } catch (error) {
    const code = text(error?.code).toLowerCase()

    if (code === 'functions/not-found') {
      throw new Error('The restoreDeletedManagedAccount Firebase function is not deployed yet. Deploy your Functions first, then try restoring again.')
    }

    if (code === 'functions/unauthenticated') {
      throw new Error('Your Firebase admin session is not active. Sign in again, then retry restoring this user.')
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
