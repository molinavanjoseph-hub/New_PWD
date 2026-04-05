const EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY = 'employerPendingRegistrationDraft'
const EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_DB = 'employerPendingRegistrationDraftFiles'
const EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE = 'files'

const text = (value) => String(value || '').trim()

const openEmployerDraftFileDb = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_DB, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE)) {
        db.createObjectStore(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open employer draft file storage.'))
  })

const saveEmployerDraftFiles = async (files) => {
  const db = await openEmployerDraftFileDb()

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE, 'readwrite')
    const store = transaction.objectStore(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE)
    store.put(files, EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Failed to save employer draft files.'))
    transaction.onabort = () => reject(transaction.error || new Error('Employer draft file save was aborted.'))
  })

  db.close()
}

const readEmployerDraftFiles = async () => {
  const db = await openEmployerDraftFileDb()

  const result = await new Promise((resolve, reject) => {
    const transaction = db.transaction(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE, 'readonly')
    const store = transaction.objectStore(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE)
    const request = store.get(EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Failed to read employer draft files.'))
  })

  db.close()
  return result
}

const clearEmployerDraftFiles = async () => {
  const db = await openEmployerDraftFileDb()

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE, 'readwrite')
    const store = transaction.objectStore(EMPLOYER_PENDING_REGISTRATION_DRAFT_FILE_STORE)
    store.delete(EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Failed to clear employer draft files.'))
    transaction.onabort = () => reject(transaction.error || new Error('Employer draft file clear was aborted.'))
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

const normalizeEmployerDraftFilesForStorage = (value) => {
  const source = Array.isArray(value) ? value : [null, null, null]

  return [0, 1, 2].map((index) => {
    const file = normalizeDraftFile(
      source[index],
      `employer-verification-document-${index + 1}.pdf`,
      'application/pdf',
    )

    if (!(file instanceof File)) return null

    // Re-wrap files into fresh File objects so IndexedDB receives a plain,
    // structured-clone-friendly payload instead of a reactive array payload.
    return new File([file], file.name || `verification-document-${index + 1}.pdf`, {
      type: file.type || 'application/pdf',
      lastModified: file.lastModified || Date.now(),
    })
  })
}

export const saveEmployerPendingRegistrationDraft = async (draft) => {
  const normalizedDraft = {
    role: 'employer',
    email: text(draft?.email).toLowerCase(),
    password: String(draft?.password || ''),
    confirmPassword: String(draft?.confirmPassword || ''),
    companyOrganizationType: text(draft?.companyOrganizationType).toLowerCase(),
    companyName: text(draft?.companyName),
    companyLocation: text(draft?.companyLocation),
    companyContactNumber: text(draft?.companyContactNumber),
    companyCategory: text(draft?.companyCategory),
    companyVerificationCertified: Boolean(draft?.companyVerificationCertified),
  }

  sessionStorage.setItem(
    EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY,
    JSON.stringify(normalizedDraft),
  )

  await saveEmployerDraftFiles({
    companyVerificationDocumentFiles: normalizeEmployerDraftFilesForStorage(
      draft?.companyVerificationDocumentFiles,
    ),
  })
}

export const getEmployerPendingRegistrationDraft = async () => {
  const rawDraft = sessionStorage.getItem(EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY)
  if (!rawDraft) return null

  try {
    const draft = JSON.parse(rawDraft)
    const draftFiles = await readEmployerDraftFiles()
    const storedFiles = Array.isArray(draftFiles?.companyVerificationDocumentFiles)
      ? draftFiles.companyVerificationDocumentFiles
      : [null, null, null]

    return {
      ...draft,
      companyVerificationDocumentFiles: [0, 1, 2].map((index) =>
        normalizeDraftFile(
          storedFiles[index],
          `employer-verification-document-${index + 1}.pdf`,
          'application/pdf',
        ),
      ),
    }
  } catch {
    await clearEmployerPendingRegistrationDraft().catch(() => {})
    return null
  }
}

export const clearEmployerPendingRegistrationDraft = async () => {
  sessionStorage.removeItem(EMPLOYER_PENDING_REGISTRATION_DRAFT_KEY)
  await clearEmployerDraftFiles().catch(() => {})
}

export const buildEmployerRegistrationFormData = (draft) => {
  const payload = new FormData()
  const appendValue = (key, value) => {
    if (value === null || value === undefined || value === '') return
    payload.append(key, String(value))
  }

  appendValue('email', text(draft?.email).toLowerCase())
  appendValue('password', draft?.password)
  appendValue('password_confirmation', draft?.confirmPassword)
  appendValue('role', 'employer')
  appendValue('companyOrganizationType', text(draft?.companyOrganizationType).toLowerCase())
  appendValue('companyName', text(draft?.companyName))
  appendValue('companyLocation', text(draft?.companyLocation))
  appendValue('companyContactNumber', text(draft?.companyContactNumber))
  appendValue('companyCategory', text(draft?.companyCategory))
  appendValue('companyVerificationCertified', Boolean(draft?.companyVerificationCertified))

  const verificationFiles = Array.isArray(draft?.companyVerificationDocumentFiles)
    ? draft.companyVerificationDocumentFiles
    : []

  verificationFiles.forEach((file, index) => {
    if (!(file instanceof File)) return
    payload.append(
      `companyVerificationDocument${index + 1}`,
      file,
      file.name || `verification-document-${index + 1}.pdf`,
    )
  })

  return payload
}
