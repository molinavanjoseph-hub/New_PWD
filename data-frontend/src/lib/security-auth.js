import {
  clearAuthSession,
  doesStoredSessionMatchFirebaseUser,
  getAccountApprovalStatus,
  getEmployerDashboardRoute,
  getStoredAuthToken,
  getStoredAuthUser,
  normalizeEmployerOrganizationType,
  refreshStoredAuthUserProfile,
} from '@/lib/auth'

const matchesRequiredRole = (user, requiredRole) => {
  const userRole = String(user?.role || '').trim().toLowerCase()

  if (Array.isArray(requiredRole)) {
    return requiredRole
      .map((role) => String(role || '').trim().toLowerCase())
      .includes(userRole)
  }

  return userRole === String(requiredRole || '').trim().toLowerCase()
}

export const getDashboardRouteForUser = (user) => {
  const userRole = String(user?.role || '').trim().toLowerCase()

  if (userRole === 'applicant') return '/applicant'
  if (userRole === 'employer') return getEmployerDashboardRoute(user)
  if (userRole === 'admin' || userRole === 'system_admin') return '/admin'
  return '/login'
}

export const validateAuthenticatedRouteAccess = async (routeMeta = {}) => {
  const token = getStoredAuthToken()
  const storedUser = getStoredAuthUser()

  if (!token || !storedUser) {
    clearAuthSession()
    return {
      allowed: false,
      redirect: '/login',
      user: null,
    }
  }

  const isMatchingFirebaseSession = await doesStoredSessionMatchFirebaseUser(storedUser)
  if (!isMatchingFirebaseSession) {
    clearAuthSession()
    return {
      allowed: false,
      redirect: '/login',
      user: null,
    }
  }

  let resolvedUser = storedUser

  if (routeMeta.role === 'applicant' || routeMeta.role === 'employer') {
    try {
      const refreshedUser = await refreshStoredAuthUserProfile(storedUser.id)
      if (refreshedUser?.role) {
        resolvedUser = refreshedUser
      }
    } catch {
      // Keep the active session moving even if the profile refresh is unavailable.
    }
  }

  if (routeMeta.role && !matchesRequiredRole(resolvedUser, routeMeta.role)) {
    return {
      allowed: false,
      redirect: getDashboardRouteForUser(resolvedUser),
      user: resolvedUser,
    }
  }

  if (routeMeta.role === 'employer' && routeMeta.employerType) {
    const storedEmployerType = normalizeEmployerOrganizationType(
      resolvedUser?.company_organization_type || resolvedUser?.companyOrganizationType,
    )

    if (!storedEmployerType) {
      return {
        allowed: false,
        redirect: getDashboardRouteForUser(resolvedUser),
        user: resolvedUser,
      }
    }

    if (storedEmployerType !== routeMeta.employerType) {
      return {
        allowed: false,
        redirect: getEmployerDashboardRoute(resolvedUser),
        user: resolvedUser,
      }
    }
  }

  if (routeMeta.role === 'applicant' || routeMeta.role === 'employer') {
    try {
      const status = await getAccountApprovalStatus(resolvedUser?.email)
      if (!status || status.status !== 'approved') {
        clearAuthSession()
        return {
          allowed: false,
          redirect: '/login',
          user: null,
        }
      }
    } catch {
      clearAuthSession()
      return {
        allowed: false,
        redirect: '/login',
        user: null,
      }
    }
  }

  return {
    allowed: true,
    redirect: '',
    user: resolvedUser,
  }
}

export const resolveApprovedEmployerSession = async (employerType = '') =>
  validateAuthenticatedRouteAccess({
    requiresAuth: true,
    role: 'employer',
    employerType,
  })
