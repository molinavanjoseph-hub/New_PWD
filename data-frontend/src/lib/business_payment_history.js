import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const BUSINESS_PAYMENT_HISTORY_COLLECTION = 'business_payment_history'

const paymentHistoryCollectionRef = collection(db, BUSINESS_PAYMENT_HISTORY_COLLECTION)

const text = (value) => String(value || '').trim()

const timestampText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return text(value)
}

export const normalizeBusinessPaymentHistoryRecord = (record = {}) => ({
  id: text(record.id),
  plan: text(record.plan),
  amount: text(record.amount),
  method: text(record.method),
  status: text(record.status),
  date: text(record.date),
  time: text(record.time),
  receiptCode: text(record.receiptCode || record.id),
  billingNote: text(record.billingNote),
  accountIdentity: text(record.accountIdentity || record.account_identity),
  ownerEmail: text(record.ownerEmail || record.owner_email),
  ownerName: text(record.ownerName || record.owner_name),
  workspaceOwnerId: text(record.workspaceOwnerId || record.workspace_owner_id),
  workspaceOwnerRole: text(record.workspaceOwnerRole || record.workspace_owner_role),
  createdAt: timestampText(record.createdAt || record.created_at || record.created_at_server),
})

export const subscribeToBusinessPaymentHistory = (accountIdentity, handleNext, handleError) => {
  const normalizedIdentity = text(accountIdentity).toLowerCase()

  if (!normalizedIdentity) {
    if (typeof handleNext === 'function') handleNext([])
    return () => {}
  }

  return onSnapshot(
    query(paymentHistoryCollectionRef, where('account_identity', '==', normalizedIdentity)),
    (snapshot) => {
      const records = snapshot.docs
        .map((entry) => normalizeBusinessPaymentHistoryRecord({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => {
          const leftTime = Date.parse(left.createdAt || '') || 0
          const rightTime = Date.parse(right.createdAt || '') || 0
          return rightTime - leftTime
        })

      if (typeof handleNext === 'function') handleNext(records)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )
}

export const subscribeToAllBusinessPaymentHistory = (handleNext, handleError) =>
  onSnapshot(
    query(paymentHistoryCollectionRef),
    (snapshot) => {
      const records = snapshot.docs
        .map((entry) => normalizeBusinessPaymentHistoryRecord({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => {
          const leftTime = Date.parse(left.createdAt || '') || 0
          const rightTime = Date.parse(right.createdAt || '') || 0
          return rightTime - leftTime
        })

      if (typeof handleNext === 'function') handleNext(records)
    },
    (error) => {
      if (typeof handleError === 'function') handleError(error)
    },
  )

export const saveBusinessPaymentHistoryEntry = async (entry = {}) => {
  const normalizedEntry = normalizeBusinessPaymentHistoryRecord(entry)
  const documentId = normalizedEntry.id || normalizedEntry.receiptCode

  if (!documentId) {
    throw new Error('Payment history entry ID is required.')
  }

  if (!normalizedEntry.accountIdentity) {
    throw new Error('Payment history account identity is required.')
  }

  await setDoc(doc(paymentHistoryCollectionRef, documentId), {
    id: documentId,
    plan: normalizedEntry.plan,
    amount: normalizedEntry.amount,
    method: normalizedEntry.method,
    status: normalizedEntry.status,
    date: normalizedEntry.date,
    time: normalizedEntry.time,
    receiptCode: normalizedEntry.receiptCode || documentId,
    billingNote: normalizedEntry.billingNote,
    account_identity: normalizedEntry.accountIdentity.toLowerCase(),
    owner_email: normalizedEntry.ownerEmail,
    owner_name: normalizedEntry.ownerName,
    workspace_owner_id: normalizedEntry.workspaceOwnerId,
    workspace_owner_role: normalizedEntry.workspaceOwnerRole,
    created_at: normalizedEntry.createdAt || new Date().toISOString(),
    created_at_server: serverTimestamp(),
    updated_at: new Date().toISOString(),
    updated_at_server: serverTimestamp(),
    saved_by_uid: text(auth.currentUser?.uid),
  }, { merge: true })

  return documentId
}

export const migrateBusinessPaymentHistoryEntries = async (entries = []) => {
  const normalizedEntries = Array.isArray(entries)
    ? entries
      .map((entry) => normalizeBusinessPaymentHistoryRecord(entry))
      .filter((entry) => entry.id && entry.accountIdentity)
    : []

  await Promise.all(normalizedEntries.map((entry) => saveBusinessPaymentHistoryEntry(entry)))
  return normalizedEntries.length
}
