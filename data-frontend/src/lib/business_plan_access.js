import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { recordSystemActivity } from '@/lib/auth'

export const ADMIN_PLAN_CATALOG_STORAGE_KEY = 'subscription_details'
export const LEGACY_ADMIN_PLAN_CATALOG_STORAGE_KEYS = ['adminPlanCatalog', 'subscription_plan']
export const SUBSCRIPTION_DETAILS_COLLECTION = 'subscription_details'
export const PREMIUM_PLAN_ID = 'plan-premium'
export const PREMIUM_PLAN_NAME = 'Premium Plan'
export const PREMIUM_SUBSCRIPTION_NAME = 'Premium Subscription'
const AUTH_USER_STORAGE_KEY = 'authUser'

export const BUSINESS_MODULE_CATALOG = [
  { id: 'dashboard', label: 'Dashboard', group: 'Workspace' },
  { id: 'user-management', label: 'User Management', group: 'Hiring' },
  { id: 'create-employee', label: 'Create Employee', group: 'Hiring' },
  { id: 'permission-rules', label: 'Permission Rules', group: 'Security' },
  { id: 'role-access', label: 'Role Access', group: 'Security' },
  { id: 'attendance-monitoring', label: 'Attendance Monitoring', group: 'Attendance' },
  { id: 'attendance-reports', label: 'Attendance Reports', group: 'Attendance' },
  { id: 'training-templates', label: 'Training Templates', group: 'Assessment' },
  { id: 'assessment-templates', label: 'Assessment Templates', group: 'Assessment' },
]

const BUSINESS_MODULE_IDS = new Set(BUSINESS_MODULE_CATALOG.map((module) => module.id))
const subscriptionDetailsCollectionRef = collection(db, SUBSCRIPTION_DETAILS_COLLECTION)
let adminPlanCatalogReadyPromise = null

export const DEFAULT_PREMIUM_MODULE_ACCESS = BUSINESS_MODULE_CATALOG.map((module) => module.id)

export const DEFAULT_PLAN_TONE = 'premium'

export const PLAN_TONE_OPTIONS = [
  { id: 'premium', label: 'Premium' },
  { id: 'trial', label: 'Trial' },
  { id: 'starter', label: 'Starter' },
  { id: 'free', label: 'Free' },
]

const text = (value) => String(value || '').trim()
const nowIso = () => new Date().toISOString()

const getStoredAuthUserRole = () => {
  if (typeof window === 'undefined') return ''

  const parseStoredUser = (rawValue) => {
    try {
      return JSON.parse(rawValue || '{}')
    } catch {
      return {}
    }
  }

  const sessionUser = parseStoredUser(window.sessionStorage?.getItem(AUTH_USER_STORAGE_KEY))
  const localUser = parseStoredUser(window.localStorage?.getItem(AUTH_USER_STORAGE_KEY))
  return text(sessionUser?.role || localUser?.role).toLowerCase()
}

const canSeedAdminPlanCatalog = () => ['admin', 'system_admin'].includes(getStoredAuthUserRole())

const cacheAdminPlanCatalog = (plans = []) => {
  if (typeof window === 'undefined') return plans

  try {
    window.localStorage.setItem(
      ADMIN_PLAN_CATALOG_STORAGE_KEY,
      JSON.stringify(withRequiredPremiumPlan(plans)),
    )
  } catch {
    // Ignore local storage write errors and continue using Firestore as source of truth.
  }

  return plans
}

export const readCachedAdminPlanCatalog = () => {
  if (typeof window === 'undefined') return []

  try {
    const rawCatalog = JSON.parse(window.localStorage.getItem(ADMIN_PLAN_CATALOG_STORAGE_KEY) || '[]')
    if (!Array.isArray(rawCatalog)) return []
    return withRequiredPremiumPlan(rawCatalog.map((plan) => normalizePlanRecord(plan)))
  } catch {
    return []
  }
}

export const isPremiumPlanRecord = (plan) =>
  text(plan?.id) === PREMIUM_PLAN_ID
  || [PREMIUM_PLAN_NAME.toLowerCase(), PREMIUM_SUBSCRIPTION_NAME.toLowerCase()].includes(text(plan?.name).toLowerCase())

export const DEFAULT_PREMIUM_PLAN_RECORD = {
  id: PREMIUM_PLAN_ID,
  name: PREMIUM_SUBSCRIPTION_NAME,
  subtitle: 'Pay the first billing cycle now and activate the full premium subscription immediately.',
  description: 'PHP 1,400.00 / month',
  price: 'PHP 1,400.00',
  badge: 'Available',
  cta: 'Get Started',
  trialNote: 'Requires immediate payment for the subscription billing cycle',
  tone: 'premium',
  features: [
    'DSS (Decision Support System)',
    'Applicant ranking (auto match)',
    'Advanced filters (skills, disability type, etc.)',
    'Training templates',
    'Assign templates',
    'Interview scheduling system',
    'Attendance Monitoring',
    'Resume analytics',
    'Unlimited job posts',
    'Bulk actions',
  ],
  moduleAccess: [...DEFAULT_PREMIUM_MODULE_ACCESS],
  isEnabled: true,
}

export const normalizePlanModuleAccess = (plan) => {
  if (Array.isArray(plan?.moduleAccess)) {
    return [...new Set(
      plan.moduleAccess
        .map((value) => text(value))
        .filter((value) => BUSINESS_MODULE_IDS.has(value)),
    )]
  }

  return isPremiumPlanRecord(plan) ? [...DEFAULT_PREMIUM_MODULE_ACCESS] : []
}

export const normalizePlanRecord = (plan) => ({
  ...plan,
  id: text(plan?.id),
  name: text(plan?.name) || 'Untitled Plan',
  subtitle: text(plan?.subtitle),
  description: text(plan?.description),
  price: text(plan?.price) || 'PHP 0.00',
  badge: text(plan?.badge),
  cta: text(plan?.cta) || 'Choose Plan',
  trialNote: text(plan?.trialNote),
  tone: PLAN_TONE_OPTIONS.some((option) => option.id === text(plan?.tone)) ? text(plan?.tone) : DEFAULT_PLAN_TONE,
  features: isPremiumPlanRecord(plan)
    ? [...DEFAULT_PREMIUM_PLAN_RECORD.features]
    : (
        Array.isArray(plan?.features)
          ? plan.features.map((feature) => text(feature)).filter(Boolean)
          : []
      ),
  moduleAccess: isPremiumPlanRecord(plan)
    ? [...DEFAULT_PREMIUM_MODULE_ACCESS]
    : normalizePlanModuleAccess(plan),
  isEnabled: typeof plan?.isEnabled === 'boolean'
    ? plan.isEnabled
    : isPremiumPlanRecord(plan),
  createdAt: text(plan?.createdAt),
  updatedAt: text(plan?.updatedAt),
})

const sortPlanCatalog = (plans = []) =>
  [...plans].sort((left, right) => {
    if (isPremiumPlanRecord(left) && !isPremiumPlanRecord(right)) return -1
    if (!isPremiumPlanRecord(left) && isPremiumPlanRecord(right)) return 1
    const leftTime = Date.parse(text(left?.updatedAt || left?.createdAt)) || 0
    const rightTime = Date.parse(text(right?.updatedAt || right?.createdAt)) || 0
    return rightTime - leftTime
  })

const withRequiredPremiumPlan = (plans = []) => {
  const normalizedPlans = Array.isArray(plans) ? plans.map((plan) => normalizePlanRecord(plan)) : []
  const hasPremiumPlan = normalizedPlans.some((plan) => isPremiumPlanRecord(plan))
  return sortPlanCatalog(
    hasPremiumPlan
      ? normalizedPlans
      : [normalizePlanRecord(DEFAULT_PREMIUM_PLAN_RECORD), ...normalizedPlans],
  )
}

export const resolvePremiumPlanRecord = (plans = []) =>
  plans.find((plan) => isPremiumPlanRecord(plan)) || null

export const buildPlanIdFromName = (name) => {
  const normalized = text(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized ? `plan-${normalized}` : `plan-${Date.now()}`
}

const getLegacyAdminPlanCatalog = () => {
  if (typeof window === 'undefined') return []

  for (const key of LEGACY_ADMIN_PLAN_CATALOG_STORAGE_KEYS) {
    try {
      const rawCatalog = JSON.parse(window.localStorage.getItem(key) || '[]')
      if (Array.isArray(rawCatalog) && rawCatalog.length) {
        return rawCatalog.map((plan) => normalizePlanRecord(plan)).filter((plan) => plan.id)
      }
    } catch {
      // Ignore malformed local storage payloads and continue checking legacy keys.
    }
  }

  return []
}

const ensureAdminPlanCatalogSeeded = async ({ allowSeed = true } = {}) => {
  if (adminPlanCatalogReadyPromise) return adminPlanCatalogReadyPromise

  adminPlanCatalogReadyPromise = (async () => {
    const snapshot = await getDocs(query(subscriptionDetailsCollectionRef))
    if (!snapshot.empty) {
      const docs = snapshot.docs.map((entry) => normalizePlanRecord({ id: entry.id, ...entry.data() }))
      const premiumPlan = resolvePremiumPlanRecord(docs)
      if (premiumPlan) {
        const normalizedDocs = withRequiredPremiumPlan(docs)
        cacheAdminPlanCatalog(normalizedDocs)
        return normalizedDocs
      }
    }

    const seedPlans = withRequiredPremiumPlan(getLegacyAdminPlanCatalog())
    if (!allowSeed || !canSeedAdminPlanCatalog()) {
      cacheAdminPlanCatalog(seedPlans)
      return seedPlans
    }

    const batch = writeBatch(db)
    seedPlans.forEach((plan) => {
      const normalizedPlan = normalizePlanRecord({
        ...plan,
        id: text(plan?.id) || buildPlanIdFromName(plan?.name),
        createdAt: text(plan?.createdAt) || nowIso(),
        updatedAt: text(plan?.updatedAt) || nowIso(),
      })
      batch.set(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, normalizedPlan.id), normalizedPlan, { merge: true })
    })
    await batch.commit()
    cacheAdminPlanCatalog(seedPlans)
    return seedPlans
  })()

  try {
    return await adminPlanCatalogReadyPromise
  } catch (error) {
    adminPlanCatalogReadyPromise = null
    throw error
  }
}

export const readAdminPlanCatalog = async () => {
  await ensureAdminPlanCatalogSeeded({ allowSeed: false })
  const snapshot = await getDocs(query(subscriptionDetailsCollectionRef))
  const plans = withRequiredPremiumPlan(
    snapshot.docs.map((entry) => normalizePlanRecord({ id: entry.id, ...entry.data() })),
  )
  cacheAdminPlanCatalog(plans)
  return plans
}

export const subscribeToAdminPlanCatalog = async (callback, onError) => {
  await ensureAdminPlanCatalogSeeded({ allowSeed: false })

  return onSnapshot(
    query(subscriptionDetailsCollectionRef),
    (snapshot) => {
      const plans = withRequiredPremiumPlan(
        snapshot.docs.map((entry) => normalizePlanRecord({ id: entry.id, ...entry.data() })),
      )
      cacheAdminPlanCatalog(plans)
      callback(plans)
    },
    (error) => {
      if (typeof onError === 'function') onError(error)
    },
  )
}

export const writeAdminPlanCatalog = async (plans = []) => {
  await ensureAdminPlanCatalogSeeded()

  const normalizedPlans = withRequiredPremiumPlan(plans)
  const existingSnapshot = await getDocs(query(subscriptionDetailsCollectionRef))
  const existingIds = new Set(existingSnapshot.docs.map((entry) => entry.id))
  const nextIds = new Set(normalizedPlans.map((plan) => plan.id))
  const batch = writeBatch(db)

  normalizedPlans.forEach((plan) => {
    batch.set(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, plan.id), plan, { merge: true })
  })

  existingIds.forEach((id) => {
    if (!nextIds.has(id)) {
      batch.delete(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, id))
    }
  })

  await batch.commit()
  cacheAdminPlanCatalog(normalizedPlans)
  return normalizedPlans
}

export const upsertAdminPlanRecord = async (plan) => {
  await ensureAdminPlanCatalogSeeded()

  const existingPlans = await readAdminPlanCatalog()
  const existingRecord = existingPlans.find((record) => record.id === text(plan?.id) || record.name === text(plan?.name))
  const now = nowIso()
  const normalizedPlan = normalizePlanRecord({
    ...plan,
    id: text(plan?.id) || existingRecord?.id || buildPlanIdFromName(plan?.name),
    createdAt: text(plan?.createdAt) || existingRecord?.createdAt || now,
    updatedAt: now,
  })

  await setDoc(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, normalizedPlan.id), normalizedPlan, { merge: true })
  await recordSystemActivity({
    action: existingRecord ? 'plan.update' : 'plan.create',
    actionLabel: existingRecord ? 'Subscription plan updated' : 'Subscription plan created',
    description: `${normalizedPlan.name || 'Subscription plan'} was ${existingRecord ? 'updated' : 'created'}.`,
    targetType: 'subscription_plan',
    targetId: normalizedPlan.id,
    targetName: normalizedPlan.name,
    metadata: {
      is_enabled: normalizedPlan.isEnabled,
      price: normalizedPlan.price,
    },
  })
  cacheAdminPlanCatalog(
    withRequiredPremiumPlan(
      existingPlans
        .filter((record) => record.id !== normalizedPlan.id)
        .concat(normalizedPlan),
    ),
  )
  return normalizedPlan
}

export const deleteAdminPlanRecord = async (planId) => {
  await ensureAdminPlanCatalogSeeded()

  const normalizedPlanId = text(planId)
  if (!normalizedPlanId) return readAdminPlanCatalog()

  await deleteDoc(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, normalizedPlanId))
  await recordSystemActivity({
    action: 'plan.delete',
    actionLabel: 'Subscription plan deleted',
    description: `Subscription plan ${normalizedPlanId} was deleted.`,
    targetType: 'subscription_plan',
    targetId: normalizedPlanId,
  })
  const nextPlans = await readAdminPlanCatalog()
  cacheAdminPlanCatalog(nextPlans)
  return nextPlans
}

export const toggleAdminPlanEnabled = async (planId, nextEnabled) => {
  await ensureAdminPlanCatalogSeeded()

  const normalizedPlanId = text(planId)
  if (!normalizedPlanId) return null

  const currentPlans = await readAdminPlanCatalog()
  const currentPlan = currentPlans.find((plan) => text(plan?.id) === normalizedPlanId)
  if (!currentPlan) return null

  const normalizedPlan = normalizePlanRecord({
    ...currentPlan,
    isEnabled: typeof nextEnabled === 'boolean'
      ? nextEnabled
      : !currentPlan?.isEnabled,
    updatedAt: nowIso(),
  })

  await setDoc(doc(db, SUBSCRIPTION_DETAILS_COLLECTION, normalizedPlan.id), normalizedPlan, { merge: true })
  await recordSystemActivity({
    action: normalizedPlan.isEnabled ? 'plan.enable' : 'plan.disable',
    actionLabel: normalizedPlan.isEnabled ? 'Subscription plan enabled' : 'Subscription plan disabled',
    description: `${normalizedPlan.name || 'Subscription plan'} was ${normalizedPlan.isEnabled ? 'enabled' : 'disabled'}.`,
    targetType: 'subscription_plan',
    targetId: normalizedPlan.id,
    targetName: normalizedPlan.name,
    metadata: {
      is_enabled: normalizedPlan.isEnabled,
    },
  })
  cacheAdminPlanCatalog(
    withRequiredPremiumPlan(
      currentPlans
        .filter((plan) => text(plan?.id) !== normalizedPlan.id)
        .concat(normalizedPlan),
    ),
  )
  return normalizedPlan
}
