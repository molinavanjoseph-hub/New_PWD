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

export const BUSINESS_APPLICANT_SCORE_COLLECTION = 'applicant_score_assessment'

const applicantScoreCollectionRef = collection(db, BUSINESS_APPLICANT_SCORE_COLLECTION)

const text = (value) => String(value || '').trim()
const normalizePercent = (value, fallback = 70) => {
  const parsedValue = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(100, Math.max(1, parsedValue))
}

const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}

const parseScoreValue = (value) => {
  const numericValue = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export const normalizeBusinessApplicantScoreRecord = (record = {}) => {
  const scoreValue = Number.isFinite(Number(record?.scoreValue))
    ? Number(record.scoreValue)
    : parseScoreValue(record?.score || record?.scoreLabel)

  return {
    id: text(record.id),
    applicantId: text(record.applicantId || record.applicant_id),
    applicantName: text(record.applicantName || record.applicant_name),
    applicantEmail: text(record.applicantEmail || record.applicant_email),
    role: text(record.role),
    roleKey: text(record.roleKey || record.role_key).toLowerCase(),
    approvalDate: text(record.approvalDate || record.approval_date),
    templateId: text(record.templateId || record.template_id),
    templateTitle: text(record.templateTitle || record.template_title),
    assignmentStatus: text(record.assignmentStatus || record.assignment_status),
    assessmentResult: text(record.assessmentResult || record.assessment_result || 'pending').toLowerCase() || 'pending',
    passingScorePercent: normalizePercent(record.passingScorePercent || record.passing_score_percent, 70),
    technicalStage: text(record.technicalStage || record.technical_stage),
    scoreValue,
    scoreLabel: text(record.scoreLabel || record.score) || `${scoreValue}%`,
    correctAnswerCount: Number(record.correctAnswerCount ?? record.correct_answer_count ?? 0) || 0,
    totalQuestions: Number(record.totalQuestions ?? record.total_questions ?? 0) || 0,
    workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
    workspaceOwnerRole: text(record.workspaceOwnerRole || record.workspace_owner_role),
    accountIdentity: text(record.accountIdentity || record.account_identity).toLowerCase(),
    createdAt: timestampText(record.createdAt || record.created_at || record.created_at_server),
    updatedAt: timestampText(record.updatedAt || record.updated_at || record.updated_at_server),
  }
}

export const subscribeToBusinessApplicantScores = (workspaceOwnerId, handleNext, handleError) => {
  const normalizedWorkspaceOwnerId = text(workspaceOwnerId)

  if (!normalizedWorkspaceOwnerId) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  return onSnapshot(
    query(applicantScoreCollectionRef, where('workspace_owner_id', '==', normalizedWorkspaceOwnerId)),
    (snapshot) => {
      const records = snapshot.docs
        .map((entry) => normalizeBusinessApplicantScoreRecord({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => {
          const leftTime = Date.parse(left.updatedAt || left.createdAt || '') || 0
          const rightTime = Date.parse(right.updatedAt || right.createdAt || '') || 0
          return rightTime - leftTime
        })

      if (typeof handleNext === 'function') handleNext(records)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )
}

export const saveBusinessApplicantScoreRecord = async (record = {}) => {
  const normalizedRecord = normalizeBusinessApplicantScoreRecord(record)
  const documentId = normalizedRecord.id || normalizedRecord.applicantId

  if (!documentId) {
    throw new Error('Applicant assessment score record ID is required.')
  }

  if (!normalizedRecord.workspaceOwnerId) {
    throw new Error('Applicant assessment score workspace owner ID is required.')
  }

  await setDoc(doc(applicantScoreCollectionRef, documentId), {
    id: documentId,
    applicant_id: normalizedRecord.applicantId,
    applicant_name: normalizedRecord.applicantName,
    applicant_email: normalizedRecord.applicantEmail,
    role: normalizedRecord.role,
    role_key: normalizedRecord.roleKey,
    approval_date: normalizedRecord.approvalDate,
    template_id: normalizedRecord.templateId,
    template_title: normalizedRecord.templateTitle,
    assignment_status: normalizedRecord.assignmentStatus,
    assessment_result: normalizedRecord.assessmentResult,
    passing_score_percent: normalizedRecord.passingScorePercent,
    technical_stage: normalizedRecord.technicalStage,
    score_value: normalizedRecord.scoreValue,
    score_label: normalizedRecord.scoreLabel,
    correct_answer_count: normalizedRecord.correctAnswerCount,
    total_questions: normalizedRecord.totalQuestions,
    workspace_owner_id: normalizedRecord.workspaceOwnerId,
    workspace_owner_role: normalizedRecord.workspaceOwnerRole,
    account_identity: normalizedRecord.accountIdentity,
    created_at: normalizedRecord.createdAt || new Date().toISOString(),
    created_at_server: serverTimestamp(),
    updated_at: new Date().toISOString(),
    updated_at_server: serverTimestamp(),
    saved_by_uid: text(auth.currentUser?.uid),
  }, { merge: true })

  return documentId
}

export const deleteBusinessApplicantScoreRecord = async (documentId) => {
  const normalizedDocumentId = text(documentId)
  if (!normalizedDocumentId) {
    throw new Error('Applicant assessment score record ID is required before deleting.')
  }

  await deleteDoc(doc(applicantScoreCollectionRef, normalizedDocumentId))
  return normalizedDocumentId
}
