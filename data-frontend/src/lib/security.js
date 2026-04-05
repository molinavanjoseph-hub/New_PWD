const BUSINESS_SECTION_QUERY_KEY = 'businessSection'
const BUSINESS_SUBSCRIPTION_VIEW_QUERY_KEY = 'businessSubscriptionView'
const BUSINESS_PLAN_QUERY_KEY = 'businessPlan'
const MANAGED_BUSINESS_SECURITY_QUERY_KEYS = [
  BUSINESS_SECTION_QUERY_KEY,
  BUSINESS_SUBSCRIPTION_VIEW_QUERY_KEY,
  BUSINESS_PLAN_QUERY_KEY,
]

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const normalizeBusinessSubscriptionView = (value) => {
  const normalizedValue = normalizeText(value)
  return ['plans', 'payment', 'history'].includes(normalizedValue) ? normalizedValue : 'plans'
}

const normalizeBusinessPlanId = (value) => {
  const normalizedValue = normalizeText(value)
  return ['free-trial', 'premium'].includes(normalizedValue) ? normalizedValue : ''
}

export const parseBusinessSubscriptionDate = (value) => {
  if (!value) return null

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const resolveBusinessFreeTrialConsumedAt = (user) =>
  parseBusinessSubscriptionDate(
    user?.premium_trial_consumed_at
    || user?.premiumTrialConsumedAt
    || user?.premium_trial_started_at
    || user?.premiumTrialStartedAt,
  )

export const resolveBusinessSubscriptionAccess = (user, options = {}) => {
  const normalizedPlan = normalizeText(
    user?.active_subscription_plan
    || user?.activeSubscriptionPlan,
  )
  const normalizedMode = normalizeText(
    user?.active_subscription_mode
    || user?.activeSubscriptionMode,
  )
  const allowMissingPaidDate = options?.allowMissingPaidDate === true
  const trialConsumedAt = resolveBusinessFreeTrialConsumedAt(user)

  if (normalizedPlan !== 'premium' || !['trial', 'paid'].includes(normalizedMode)) {
    return {
      hasPremiumAccess: false,
      activeSubscriptionPlan: 'free',
      activeSubscriptionMode: 'none',
      premiumTrialStartedAt: '',
      premiumPaidStartedAt: '',
      premiumTrialConsumedAt: trialConsumedAt ? trialConsumedAt.toISOString() : '',
      hasConsumedFreeTrial: Boolean(trialConsumedAt),
    }
  }

  const trialStartedAt = parseBusinessSubscriptionDate(
    user?.premium_trial_started_at
    || user?.premiumTrialStartedAt,
  ) || trialConsumedAt
  const paidStartedAt = parseBusinessSubscriptionDate(
    user?.premium_paid_started_at
    || user?.premiumPaidStartedAt,
  )

  if (normalizedMode === 'paid' && (paidStartedAt || allowMissingPaidDate)) {
    return {
      hasPremiumAccess: true,
      activeSubscriptionPlan: 'premium',
      activeSubscriptionMode: 'paid',
      premiumTrialStartedAt: '',
      premiumPaidStartedAt: paidStartedAt ? paidStartedAt.toISOString() : '',
      premiumTrialConsumedAt: trialConsumedAt ? trialConsumedAt.toISOString() : '',
      hasConsumedFreeTrial: Boolean(trialConsumedAt),
    }
  }

  if (normalizedMode === 'trial' && trialStartedAt) {
    const trialEndDate = new Date(trialStartedAt)
    trialEndDate.setDate(trialEndDate.getDate() + 30)

    if (trialEndDate.getTime() > Date.now()) {
      return {
        hasPremiumAccess: true,
        activeSubscriptionPlan: 'premium',
        activeSubscriptionMode: 'trial',
        premiumTrialStartedAt: trialStartedAt.toISOString(),
        premiumPaidStartedAt: '',
        premiumTrialConsumedAt: trialStartedAt.toISOString(),
        hasConsumedFreeTrial: true,
      }
    }
  }

  return {
    hasPremiumAccess: false,
    activeSubscriptionPlan: 'free',
    activeSubscriptionMode: 'none',
    premiumTrialStartedAt: '',
    premiumPaidStartedAt: '',
    premiumTrialConsumedAt: trialConsumedAt ? trialConsumedAt.toISOString() : '',
    hasConsumedFreeTrial: Boolean(trialConsumedAt),
  }
}

export const hasManagedBusinessSecurityQuery = (query = {}) =>
  MANAGED_BUSINESS_SECURITY_QUERY_KEYS.some((key) => normalizeText(query?.[key]))

export const resolveBusinessWorkspaceSecurityState = (user, query = {}) => {
  const accessState = resolveBusinessSubscriptionAccess(user, { allowMissingPaidDate: true })
  const normalizedSection = normalizeText(query?.[BUSINESS_SECTION_QUERY_KEY])
  const hasManagedQuery = hasManagedBusinessSecurityQuery(query)
  const hasRequestedSubscriptionView = Boolean(normalizeText(query?.[BUSINESS_SUBSCRIPTION_VIEW_QUERY_KEY]))
  const requestedSubscriptionView = normalizeBusinessSubscriptionView(
    query?.[BUSINESS_SUBSCRIPTION_VIEW_QUERY_KEY],
  )
  const requestedPlanId = normalizeBusinessPlanId(query?.[BUSINESS_PLAN_QUERY_KEY])
  const wantsSubscriptionFlow = normalizedSection === 'subscriptions' || hasRequestedSubscriptionView

  if (!accessState.hasPremiumAccess) {
    return {
      ...accessState,
      section: wantsSubscriptionFlow || hasManagedQuery ? 'subscriptions' : 'workspace',
      subscriptionView: wantsSubscriptionFlow ? requestedSubscriptionView : 'plans',
      planId: requestedPlanId,
      requiresSubscription: true,
    }
  }

  if (normalizedSection === 'profile') {
    return {
      ...accessState,
      section: 'profile',
      subscriptionView: 'plans',
      planId: requestedPlanId,
      requiresSubscription: false,
    }
  }

  if (wantsSubscriptionFlow) {
    return {
      ...accessState,
      section: 'subscriptions',
      subscriptionView: requestedSubscriptionView,
      planId: requestedPlanId,
      requiresSubscription: false,
    }
  }

  return {
    ...accessState,
    section: 'workspace',
    subscriptionView: 'plans',
    planId: requestedPlanId,
    requiresSubscription: false,
  }
}

export const buildBusinessSecurityRouteQuery = (user, state = {}, currentQuery = {}) => {
  const nextQuery = { ...currentQuery }

  for (const key of MANAGED_BUSINESS_SECURITY_QUERY_KEYS) {
    delete nextQuery[key]
  }

  const accessState = resolveBusinessSubscriptionAccess(user, { allowMissingPaidDate: true })
  const normalizedSection = normalizeText(state?.section)
  const normalizedSubscriptionView = normalizeBusinessSubscriptionView(state?.subscriptionView)
  const normalizedPlanId = normalizeBusinessPlanId(state?.planId)

  if (!accessState.hasPremiumAccess) {
    return nextQuery
  }

  if (normalizedSection === 'subscriptions') {
    if (normalizedSubscriptionView === 'plans') {
      return nextQuery
    }

    nextQuery[BUSINESS_SECTION_QUERY_KEY] = 'subscriptions'
    nextQuery[BUSINESS_SUBSCRIPTION_VIEW_QUERY_KEY] = normalizedSubscriptionView
    if (normalizedPlanId) nextQuery[BUSINESS_PLAN_QUERY_KEY] = normalizedPlanId
    return nextQuery
  }

  if (normalizedSection === 'profile') {
    nextQuery[BUSINESS_SECTION_QUERY_KEY] = 'profile'
  }

  return nextQuery
}

export const managedBusinessSecurityQueryEquals = (leftQuery = {}, rightQuery = {}) =>
  MANAGED_BUSINESS_SECURITY_QUERY_KEYS.every((key) =>
    normalizeText(leftQuery?.[key]) === normalizeText(rightQuery?.[key]),
  )
