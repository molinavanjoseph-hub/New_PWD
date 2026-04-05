import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION = 'business_assessment_templates'
export const BUSINESS_TRAINING_TEMPLATE_COLLECTION = 'business_training_templates'
export const BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION = 'business_assessment_assignments'
export const BUSINESS_TRAINING_ASSIGNMENT_COLLECTION = 'business_training_assignments'

const text = (value) => String(value || '').trim()
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizePercent = (value, fallback = 70) => {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(100, Math.max(1, parsedValue))
}
const normalizeScoreValue = (value) => {
  const parsedValue = Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10)
  if (!Number.isFinite(parsedValue)) return 0
  return Math.min(100, Math.max(0, parsedValue))
}
const uniqueTextValues = (values = []) => [...new Set(values.map((value) => text(value)).filter(Boolean))]
const uniqueEmailValues = (values = []) => [...new Set(values.map((value) => normalizeEmail(value)).filter(Boolean))]
const cloneJson = (value, fallback) => {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}
const waitForAuthReady = () =>
  typeof auth?.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve()

const sortWorkspaceRecords = (records = []) =>
  [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || '') || 0
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || '') || 0
    return rightTime - leftTime
  })

const subscribeToWorkspaceRecords = (collectionName, workspaceOwnerId, normalizeRecord, handleNext, handleError) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)

  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  return onSnapshot(
    query(collection(db, collectionName), where('workspace_owner_id', '==', normalizedWorkspaceOwnerId)),
    (snapshot) => {
      const records = sortWorkspaceRecords(
        snapshot.docs.map((entry) => normalizeRecord({
          id: entry.id,
          ...entry.data(),
        })),
      )

      if (typeof handleNext === 'function') handleNext(records)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )
}

const saveWorkspaceRecord = async (collectionName, record = {}, normalizeRecord) => {
  const normalizedRecord = normalizeRecord(record)

  if (!normalizedRecord.id) {
    throw new Error('A document ID is required before saving this workspace record.')
  }

  if (!normalizedRecord.workspaceOwnerId) {
    throw new Error('A workspace owner ID is required before saving this workspace record.')
  }

  await setDoc(doc(collection(db, collectionName), normalizedRecord.id), {
    ...normalizedRecord.firestorePayload,
    created_at_server: serverTimestamp(),
    updated_at_server: serverTimestamp(),
    saved_by_uid: text(auth.currentUser?.uid),
  }, { merge: true })

  return normalizedRecord.id
}

const deleteWorkspaceRecord = async (collectionName, documentId) => {
  const normalizedDocumentId = text(documentId)
  if (!normalizedDocumentId) throw new Error('A document ID is required before deleting this workspace record.')
  await deleteDoc(doc(collection(db, collectionName), normalizedDocumentId))
  return normalizedDocumentId
}

export const normalizeBusinessAssessmentTemplateRecord = (record = {}) => {
  const id = text(record.id)
  const workspaceOwnerId = text(record.workspaceOwnerId || record.workspace_owner_id)
  const createdAt = timestampText(record.createdAt || record.created_at || record.created_at_server)
  const updatedAt = timestampText(record.updatedAt || record.updated_at || record.updated_at_server)
  const title = text(record.title)
  const description = text(record.description)
  const instructions = text(record.instructions)
  const questions = Array.isArray(record.questions) ? JSON.parse(JSON.stringify(record.questions)) : []
  const passingScorePercent = normalizePercent(record.passingScorePercent || record.passing_score_percent, 70)

  return {
    id,
    workspaceOwnerId,
    title,
    description,
    instructions,
    questions,
    passingScorePercent,
    createdAt,
    updatedAt,
    firestorePayload: {
      id,
      workspace_owner_id: workspaceOwnerId,
      title,
      description,
      instructions,
      questions,
      passing_score_percent: passingScorePercent,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

export const subscribeToBusinessAssessmentTemplates = (workspaceOwnerId, handleNext, handleError) =>
  subscribeToWorkspaceRecords(
    BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION,
    workspaceOwnerId,
    normalizeBusinessAssessmentTemplateRecord,
    handleNext,
    handleError,
  )

export const saveBusinessAssessmentTemplateRecord = async (record = {}) =>
  saveWorkspaceRecord(
    BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION,
    record,
    normalizeBusinessAssessmentTemplateRecord,
  )

export const deleteBusinessAssessmentTemplateRecord = async (documentId) =>
  deleteWorkspaceRecord(BUSINESS_ASSESSMENT_TEMPLATE_COLLECTION, documentId)

export const normalizeBusinessTrainingTemplateRecord = (record = {}) => {
  const id = text(record.id)
  const workspaceOwnerId = text(record.workspaceOwnerId || record.workspace_owner_id)
  const createdAt = timestampText(record.createdAt || record.created_at || record.created_at_server)
  const updatedAt = timestampText(record.updatedAt || record.updated_at || record.updated_at_server)
  const title = text(record.title)
  const description = text(record.description)
  const legacyQuestions = Array.isArray(record.questions) ? cloneJson(record.questions, []) : []
  const categories = Array.isArray(record.categories)
    ? cloneJson(record.categories, [])
    : legacyQuestions.length
      ? [
        {
          id: 'legacy-training-category',
          title: 'Imported Category',
          description: 'Converted from the previous training template format.',
          skills: legacyQuestions
            .map((question, index) => {
              const name = text(question?.label) || `Imported Skill ${index + 1}`
              const skillDescription = text(question?.helpText)
              return name || skillDescription
                ? {
                  id: `legacy-training-skill-${index + 1}`,
                  name,
                  description: skillDescription,
                }
                : null
            })
            .filter(Boolean),
        },
      ]
      : []

  return {
    id,
    workspaceOwnerId,
    title,
    description,
    categories,
    createdAt,
    updatedAt,
    firestorePayload: {
      id,
      workspace_owner_id: workspaceOwnerId,
      title,
      description,
      categories,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

export const subscribeToBusinessTrainingTemplates = (workspaceOwnerId, handleNext, handleError) =>
  subscribeToWorkspaceRecords(
    BUSINESS_TRAINING_TEMPLATE_COLLECTION,
    workspaceOwnerId,
    normalizeBusinessTrainingTemplateRecord,
    handleNext,
    handleError,
  )

export const saveBusinessTrainingTemplateRecord = async (record = {}) =>
  saveWorkspaceRecord(
    BUSINESS_TRAINING_TEMPLATE_COLLECTION,
    record,
    normalizeBusinessTrainingTemplateRecord,
  )

export const deleteBusinessTrainingTemplateRecord = async (documentId) =>
  deleteWorkspaceRecord(BUSINESS_TRAINING_TEMPLATE_COLLECTION, documentId)

export const normalizeBusinessAssessmentAssignmentRecord = (record = {}) => {
  const id = text(record.id || record.applicationId || record.application_id || record.applicantId || record.applicant_id)
  const workspaceOwnerId = text(record.workspaceOwnerId || record.workspace_owner_id)
  const createdAt = timestampText(record.createdAt || record.created_at || record.created_at_server)
  const updatedAt = timestampText(record.updatedAt || record.updated_at || record.updated_at_server)
  const applicationId = text(record.applicationId || record.application_id || id)
  const applicantId = text(record.applicantId || record.applicant_id || id)
  const applicantName = text(record.name || record.applicantName || record.applicant_name)
  const applicantEmail = normalizeEmail(record.email || record.applicantEmail || record.applicant_email)
  const role = text(record.role)
  const approvalDate = text(record.approvalDate || record.approval_date)
  const score = text(record.score)
  const jobId = text(record.jobId || record.job_id)
  const jobTitle = text(record.jobTitle || record.job_title || role)
  const companyName = text(record.companyName || record.company_name || record.businessName || record.business_name)
  const businessName = text(record.businessName || record.business_name || record.companyName || record.company_name)
  const selectedTemplateId = text(record.selectedTemplateId || record.selected_template_id || record.templateId || record.template_id)
  const templateTitle = text(record.templateTitle || record.template_title)
  const templateDescription = text(record.templateDescription || record.template_description)
  const templateInstructions = text(record.templateInstructions || record.template_instructions)
  const templateQuestions = Array.isArray(record.templateQuestions || record.template_questions)
    ? cloneJson(record.templateQuestions || record.template_questions, [])
    : []
  const passingScorePercent = normalizePercent(record.passingScorePercent || record.passing_score_percent, 70)
  const assignmentStatus = text(record.assignmentStatus || record.assignment_status) || 'Pending'
  const assessmentStatus = text(record.assessmentStatus || record.assessment_status) || ''
  const assessmentScoreValue = normalizeScoreValue(record.assessmentScoreValue || record.assessment_score_value)
  const assessmentScoreLabel = text(record.assessmentScoreLabel || record.assessment_score_label)
  const correctAnswerCount = Math.max(0, Number(record.correctAnswerCount ?? record.correct_answer_count ?? 0) || 0)
  const totalQuestions = Math.max(0, Number(record.totalQuestions ?? record.total_questions ?? 0) || 0)
  const assessmentResult = text(record.assessmentResult || record.assessment_result || 'pending').toLowerCase() || 'pending'
  const assignedAt = text(record.assignedAt || record.assigned_at)
  const startedAt = text(record.startedAt || record.started_at)
  const submittedAt = text(record.submittedAt || record.submitted_at)
  const cancellationReason = text(
    record.cancellationReason
    || record.cancellation_reason
    || record.discontinuedReason
    || record.discontinued_reason,
  )
  const responses = record.responses && typeof record.responses === 'object' && !Array.isArray(record.responses)
    ? cloneJson(record.responses, {})
    : record.assessmentResponses && typeof record.assessmentResponses === 'object' && !Array.isArray(record.assessmentResponses)
      ? cloneJson(record.assessmentResponses, {})
      : {}

  return {
    id,
    applicationId,
    applicantId,
    name: applicantName,
    email: applicantEmail,
    role,
    approvalDate,
    score,
    jobId,
    jobTitle,
    companyName,
    businessName,
    selectedTemplateId,
    templateTitle,
    templateDescription,
    templateInstructions,
    templateQuestions,
    passingScorePercent,
    assignmentStatus,
    assessmentStatus,
    assessmentScoreValue,
    assessmentScoreLabel,
    correctAnswerCount,
    totalQuestions,
    assessmentResult,
    assignedAt,
    startedAt,
    submittedAt,
    cancellationReason,
    responses,
    workspaceOwnerId,
    createdAt,
    updatedAt,
    firestorePayload: {
      id,
      application_id: applicationId,
      applicant_id: applicantId,
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      role,
      approval_date: approvalDate,
      score,
      job_id: jobId,
      job_title: jobTitle,
      company_name: companyName,
      business_name: businessName,
      selected_template_id: selectedTemplateId,
      template_title: templateTitle,
      template_description: templateDescription,
      template_instructions: templateInstructions,
      template_questions: templateQuestions,
      passing_score_percent: passingScorePercent,
      assignment_status: assignmentStatus,
      assessment_status: assessmentStatus,
      assessment_score_value: assessmentScoreValue,
      assessment_score_label: assessmentScoreLabel,
      correct_answer_count: correctAnswerCount,
      total_questions: totalQuestions,
      assessment_result: assessmentResult,
      assigned_at: assignedAt,
      started_at: startedAt,
      submitted_at: submittedAt,
      cancellation_reason: cancellationReason,
      responses,
      workspace_owner_id: workspaceOwnerId,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

export const subscribeToBusinessAssessmentAssignments = (workspaceOwnerId, handleNext, handleError) =>
  subscribeToWorkspaceRecords(
    BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION,
    workspaceOwnerId,
    normalizeBusinessAssessmentAssignmentRecord,
    handleNext,
    handleError,
  )

export const saveBusinessAssessmentAssignmentRecord = async (record = {}) =>
  saveWorkspaceRecord(
    BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION,
    record,
    normalizeBusinessAssessmentAssignmentRecord,
  )

export const deleteBusinessAssessmentAssignmentRecord = async (documentId) =>
  deleteWorkspaceRecord(BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION, documentId)

export const subscribeToApplicantAssessmentAssignments = (options = {}, handleNext, handleError) => {
  let isClosed = false
  const recordsByKey = new Map()
  const emitRecords = () => {
    if (isClosed) return
    const rows = sortWorkspaceRecords([...recordsByKey.values()])
    if (typeof handleNext === 'function') handleNext(rows)
  }

  const syncSnapshot = (sourceKey, snapshot) => {
    const activeKeys = new Set()

    snapshot.docs.forEach((entry) => {
      const record = normalizeBusinessAssessmentAssignmentRecord({
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
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }

  void waitForAuthReady()
    .then(() => {
      if (isClosed) return

      const applicantIds = uniqueTextValues([auth.currentUser?.uid, options?.applicantId])
      const applicantEmails = uniqueEmailValues([auth.currentUser?.email, options?.applicantEmail])

      if (!applicantIds.length && !applicantEmails.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      applicantIds.forEach((applicantId) => {
        stopHandlers.push(onSnapshot(
          query(collection(db, BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION), where('applicant_id', '==', applicantId)),
          (snapshot) => syncSnapshot(`applicant-id:${applicantId}`, snapshot),
          reportError,
        ))
      })

      applicantEmails.forEach((applicantEmail) => {
        stopHandlers.push(onSnapshot(
          query(collection(db, BUSINESS_ASSESSMENT_ASSIGNMENT_COLLECTION), where('applicant_email', '==', applicantEmail)),
          (snapshot) => syncSnapshot(`applicant-email:${applicantEmail}`, snapshot),
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

const normalizeTrainingAssignmentSkillGrade = (value) => {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsedValue)) return 0
  return Math.min(5, Math.max(0, parsedValue))
}

const normalizeTrainingAssignmentSkillRecord = (skill = {}) => ({
  id: text(skill.id),
  name: text(skill.name || skill.title),
  description: text(skill.description || skill.details),
  completed: Boolean(skill.completed ?? skill.isCompleted ?? skill.checked),
  completedAt: timestampText(skill.completedAt || skill.completed_at || skill.checkedAt || skill.checked_at),
  grade: normalizeTrainingAssignmentSkillGrade(skill.grade || skill.rating || skill.score),
})

const normalizeTrainingAssignmentCategoryRecord = (category = {}) => ({
  id: text(category.id),
  title: text(category.title || category.label),
  remark: text(category.remark || category.remarks),
  remarkedAt: timestampText(category.remarkedAt || category.remarked_at),
  skills: Array.isArray(category.skills)
    ? category.skills
      .map((skill) => normalizeTrainingAssignmentSkillRecord(skill))
      .filter((skill) => skill.id || skill.name || skill.description)
    : [],
})

const deriveTrainingAssignmentProgressStatus = (categories = [], fallback = 'Not Started') => {
  const normalizedCategories = Array.isArray(categories) ? categories : []
  const totalSkills = normalizedCategories.reduce(
    (total, category) => total + (Array.isArray(category?.skills) ? category.skills.length : 0),
    0,
  )
  const completedSkills = normalizedCategories.reduce(
    (total, category) =>
      total + (Array.isArray(category?.skills) ? category.skills.filter((skill) => Boolean(skill?.completed)).length : 0),
    0,
  )

  if (!totalSkills) return text(fallback) || 'Not Started'
  if (!completedSkills) return 'Not Started'
  if (completedSkills >= totalSkills) return 'Completed'
  return 'In Progress'
}

export const normalizeBusinessTrainingAssignmentRecord = (record = {}) => {
  const id = text(record.id || record.memberId || record.member_id)
  const workspaceOwnerId = text(record.workspaceOwnerId || record.workspace_owner_id)
  const createdAt = timestampText(record.createdAt || record.created_at || record.created_at_server)
  const updatedAt = timestampText(record.updatedAt || record.updated_at || record.updated_at_server)
  const memberId = text(record.memberId || record.member_id || record.applicationId || record.application_id || id)
  const applicationId = text(record.applicationId || record.application_id || memberId || id)
  const applicantId = text(record.applicantId || record.applicant_id)
  const name = text(record.name)
  const email = text(record.email).toLowerCase()
  const role = text(record.role)
  const stage = text(record.stage)
  const jobId = text(record.jobId || record.job_id)
  const jobTitle = text(record.jobTitle || record.job_title || role)
  const selectedTemplateId = text(record.selectedTemplateId || record.selected_template_id || record.templateId || record.template_id)
  const templateTitle = text(record.templateTitle || record.template_title)
  const templateDescription = text(record.templateDescription || record.template_description)
  const templateCategories = Array.isArray(record.templateCategories || record.template_categories || record.categories)
    ? cloneJson(record.templateCategories || record.template_categories || record.categories, [])
      .map((category) => normalizeTrainingAssignmentCategoryRecord(category))
    : []
  const assignmentStatus = text(record.assignmentStatus || record.assignment_status) || 'Pending'
  const assignedAt = text(record.assignedAt || record.assigned_at)
  const trainingCompletedAt = timestampText(record.trainingCompletedAt || record.training_completed_at)
  const trainingCompletedBy = text(record.trainingCompletedBy || record.training_completed_by)
  const trainingCompletedByName = text(record.trainingCompletedByName || record.training_completed_by_name)
  const progressStatus = deriveTrainingAssignmentProgressStatus(
    templateCategories,
    text(record.progressStatus || record.progress_status) || 'Not Started',
  )

  return {
    id,
    memberId,
    applicationId,
    applicantId,
    name,
    email,
    role,
    stage,
    jobId,
    jobTitle,
    selectedTemplateId,
    templateTitle,
    templateDescription,
    templateCategories,
    assignmentStatus,
    assignedAt,
    trainingCompletedAt,
    trainingCompletedBy,
    trainingCompletedByName,
    progressStatus,
    workspaceOwnerId,
    createdAt,
    updatedAt,
    firestorePayload: {
      id,
      member_id: memberId,
      application_id: applicationId,
      applicant_id: applicantId,
      name,
      email,
      role,
      stage,
      job_id: jobId,
      job_title: jobTitle,
      selected_template_id: selectedTemplateId,
      template_title: templateTitle,
      template_description: templateDescription,
      template_categories: templateCategories,
      assignment_status: assignmentStatus,
      assigned_at: assignedAt,
      training_completed_at: trainingCompletedAt,
      training_completed_by: trainingCompletedBy,
      training_completed_by_name: trainingCompletedByName,
      progress_status: progressStatus,
      workspace_owner_id: workspaceOwnerId,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

export const subscribeToBusinessTrainingAssignments = (workspaceOwnerId, handleNext, handleError) =>
  subscribeToWorkspaceRecords(
    BUSINESS_TRAINING_ASSIGNMENT_COLLECTION,
    workspaceOwnerId,
    normalizeBusinessTrainingAssignmentRecord,
    handleNext,
    handleError,
  )

export const subscribeToApplicantTrainingAssignments = (options = {}, handleNext, handleError) => {
  let isClosed = false
  const recordsByKey = new Map()
  const emitRecords = () => {
    if (isClosed) return
    const rows = sortWorkspaceRecords([...recordsByKey.values()])
    if (typeof handleNext === 'function') handleNext(rows)
  }

  const syncSnapshot = (sourceKey, snapshot) => {
    const activeKeys = new Set()

    snapshot.docs.forEach((entry) => {
      const record = normalizeBusinessTrainingAssignmentRecord({
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
  const reportError = (error) => {
    if (isClosed) return
    if (typeof handleError === 'function') handleError(error)
  }

  void waitForAuthReady()
    .then(() => {
      if (isClosed) return

      const applicantIds = uniqueTextValues([auth.currentUser?.uid, options?.applicantId])
      const applicantEmails = uniqueEmailValues([auth.currentUser?.email, options?.applicantEmail])

      if (!applicantIds.length && !applicantEmails.length) {
        if (typeof handleNext === 'function') handleNext([])
        return
      }

      applicantIds.forEach((applicantId) => {
        stopHandlers.push(onSnapshot(
          query(collection(db, BUSINESS_TRAINING_ASSIGNMENT_COLLECTION), where('applicant_id', '==', applicantId)),
          (snapshot) => syncSnapshot(`applicant-id:${applicantId}`, snapshot),
          reportError,
        ))
      })

      applicantEmails.forEach((applicantEmail) => {
        stopHandlers.push(onSnapshot(
          query(collection(db, BUSINESS_TRAINING_ASSIGNMENT_COLLECTION), where('email', '==', applicantEmail)),
          (snapshot) => syncSnapshot(`applicant-email:${applicantEmail}`, snapshot),
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

export const saveBusinessTrainingAssignmentRecord = async (record = {}) =>
  saveWorkspaceRecord(
    BUSINESS_TRAINING_ASSIGNMENT_COLLECTION,
    record,
    normalizeBusinessTrainingAssignmentRecord,
  )
