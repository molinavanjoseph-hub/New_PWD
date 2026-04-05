const APPLICANT_PENDING_REGISTRATION_DRAFT_KEY = 'applicantRegistrationDraft'
const APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_DB = 'applicantRegistrationDraftFiles'
const APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE = 'files'
const APPLICANT_DEFAULT_PROVINCE = 'Cavite'
const APPLICANT_DEFAULT_CITY = 'Dasmarinas City'

const text = (value) => String(value || '').trim()

const openApplicantDraftFileDb = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_DB, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE)) {
        db.createObjectStore(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open draft file storage.'))
  })

const readApplicantDraftFiles = async () => {
  const db = await openApplicantDraftFileDb()

  const result = await new Promise((resolve, reject) => {
    const transaction = db.transaction(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE, 'readonly')
    const store = transaction.objectStore(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE)
    const request = store.get(APPLICANT_PENDING_REGISTRATION_DRAFT_KEY)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Failed to read draft files.'))
  })

  db.close()
  return result
}

const clearApplicantDraftFiles = async () => {
  const db = await openApplicantDraftFileDb()

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE, 'readwrite')
    const store = transaction.objectStore(APPLICANT_PENDING_REGISTRATION_DRAFT_FILE_STORE)
    store.delete(APPLICANT_PENDING_REGISTRATION_DRAFT_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Failed to clear draft files.'))
    transaction.onabort = () => reject(transaction.error || new Error('Draft file clear was aborted.'))
  })

  db.close()
}

const normalizeDraftFile = (value, fallbackName, fallbackType = 'application/octet-stream') => {
  if (!value) return null
  if (value instanceof File) return value
  if (value instanceof Blob) {
    return new File([value], fallbackName, {
      type: value.type || fallbackType,
      lastModified: Date.now(),
    })
  }
  return null
}

const computeApplicantAge = (birthDate) => {
  const normalizedBirthDate = text(birthDate)
  if (!normalizedBirthDate) return ''

  const dob = new Date(normalizedBirthDate)
  if (Number.isNaN(dob.getTime())) return ''

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  const dayDiff = today.getDate() - dob.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1

  return age < 0 ? '' : String(age)
}

export const getApplicantPendingRegistrationDraft = async () => {
  const rawDraft = sessionStorage.getItem(APPLICANT_PENDING_REGISTRATION_DRAFT_KEY)
  if (!rawDraft) return null

  try {
    const draft = JSON.parse(rawDraft)
    const draftFiles = await readApplicantDraftFiles()

    return {
      ...draft,
      selectedRole: text(draft?.selectedRole) || 'applicant',
      applicantStep: Number(draft?.applicantStep || 2),
      addressProvince: text(draft?.addressProvince) || APPLICANT_DEFAULT_PROVINCE,
      addressCity: text(draft?.addressCity) || APPLICANT_DEFAULT_CITY,
      contactCountryCode: text(draft?.contactCountryCode) || 'PH',
      applicantProfileImage: normalizeDraftFile(
        draftFiles?.applicantProfileImage,
        'restored-selfie.jpg',
        'image/jpeg',
      ),
      applicantResumeFile: normalizeDraftFile(
        draftFiles?.applicantResumeFile,
        'restored-resume.pdf',
        'application/pdf',
      ),
      applicantPwdIdFrontFile: normalizeDraftFile(
        draftFiles?.applicantPwdIdFrontFile,
        'restored-pwd-front.jpg',
        'image/jpeg',
      ),
      applicantPwdIdBackFile: normalizeDraftFile(
        draftFiles?.applicantPwdIdBackFile,
        'restored-pwd-back.jpg',
        'image/jpeg',
      ),
    }
  } catch {
    await clearApplicantPendingRegistrationDraft().catch(() => {})
    return null
  }
}

export const clearApplicantPendingRegistrationDraft = async () => {
  sessionStorage.removeItem(APPLICANT_PENDING_REGISTRATION_DRAFT_KEY)
  await clearApplicantDraftFiles().catch(() => {})
}

export const buildApplicantRegistrationFormData = (draft) => {
  const payload = new FormData()
  const appendValue = (key, value) => {
    if (value === null || value === undefined || value === '') return
    payload.append(key, String(value))
  }

  appendValue('email', text(draft?.email).toLowerCase())
  appendValue('password', draft?.password)
  appendValue('password_confirmation', draft?.confirmPassword)
  appendValue('role', 'applicant')
  appendValue('disabilityType', text(draft?.disabilityType))
  appendValue('firstName', text(draft?.firstName))
  appendValue('lastName', text(draft?.lastName))
  appendValue('sex', text(draft?.sex))
  appendValue('birthDate', text(draft?.birthDate))
  appendValue('age', computeApplicantAge(draft?.birthDate))
  appendValue('addressProvince', text(draft?.addressProvince) || APPLICANT_DEFAULT_PROVINCE)
  appendValue('addressCity', text(draft?.addressCity) || APPLICANT_DEFAULT_CITY)
  appendValue('addressBarangay', text(draft?.addressBarangay))
  appendValue('contactCountryCode', text(draft?.contactCountryCode) || 'PH')
  appendValue('contactNumber', text(draft?.contactNumber))
  appendValue('preferredLanguage', text(draft?.preferredLanguage))
  appendValue('pwdIdOcrStatus', text(draft?.applicantPwdIdOcrStatus))
  appendValue('pwdIdOcrMessage', text(draft?.applicantPwdIdOcrMessage))
  appendValue('pwdIdOcrExtractedNumber', text(draft?.applicantPwdIdOcrExtractedNumber))

  if (draft?.applicantProfileImage instanceof File) {
    payload.append(
      'profileImage',
      draft.applicantProfileImage,
      draft.applicantProfileImage.name || 'selfie.jpg',
    )
  }

  if (draft?.applicantResumeFile instanceof File) {
    payload.append(
      'resumeFile',
      draft.applicantResumeFile,
      draft.applicantResumeFile.name || 'resume.pdf',
    )
  }

  if (draft?.applicantPwdIdFrontFile instanceof File) {
    payload.append(
      'pwdIdFrontFile',
      draft.applicantPwdIdFrontFile,
      draft.applicantPwdIdFrontFile.name || 'pwd-front.jpg',
    )
  }

  if (draft?.applicantPwdIdBackFile instanceof File) {
    payload.append(
      'pwdIdBackFile',
      draft.applicantPwdIdBackFile,
      draft.applicantPwdIdBackFile.name || 'pwd-back.jpg',
    )
  }

  return payload
}
