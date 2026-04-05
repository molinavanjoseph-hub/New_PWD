import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition

    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
        top: 96,
      }
    }

    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'main_landing',
      component: () => import('@/modules/main_landing.vue'),
      meta: { title: 'PWD | Landing Page' },
    },
    {
      path: '/mobile',
      name: 'mobile_landing',
      component: () => import('@/mobile-webapps/mobile-landingpage.vue'),
      meta: { title: 'PWD | Mobile Landing Page' },
    },
    {
      path: '/step-view-tutorial',
      name: 'step_view_tutorial',
      component: () => import('@/modules/step_view_tutorial.vue'),
      meta: { title: 'PWD | Step View Tutorial' },
    },
    {
      path: '/login',
      name: 'main_login',
      component: () => import('@/authenticator/main_login.vue'),
      meta: { title: 'PWD | Login' },
    },
    {
      path: '/company-login',
      redirect: '/login',
    },
    {
      path: '/search-jobs',
      name: 'main_searchjobs',
      component: () => import('@/modules/main_searchjobs.vue'),
      meta: { title: 'PWD | Search Jobs' },
    },
    {
      path: '/select-role',
      name: 'select_role',
      component: () => import('@/authenticator/select_role.vue'),
      meta: { title: 'PWD | Select Role' },
    },
    {
      path: '/support/:topic',
      name: 'support_pages',
      component: () => import('@/modules/support_pages.vue'),
      meta: { title: 'PWD | Support' },
    },
    {
      path: '/register',
      name: 'register_slot',
      component: () => import('@/authenticator/register_slot.vue'),
      meta: { title: 'PWD | Register Applicant' },
    },
    {
      path: '/auth/verify-otp',
      name: 'verify_otp',
      component: () => import('@/authenticator/verify_otp.vue'),
      meta: { title: 'PWD | Verify OTP' },
    },
    {
      path: '/auth/pending-approval',
      name: 'pending_approval',
      component: () => import('@/authenticator/pending_approval.vue'),
      meta: { title: 'PWD | Pending Approval' },
    },
    {
      path: '/register/client-verification',
      name: 'client_verification',
      component: () => import('@/authenticator/Face_Recognition/Face_Verify_Page.vue'),
      meta: { title: 'PWD | Client Verification' },
    },
    {
      path: '/admin',
      name: 'admin_dashboard',
      component: () => import('@/modules/Admin/admin_dashboard.vue'),
      meta: { requiresAuth: true, role: ['admin', 'system_admin'], title: 'PWD | Admin Dashboard' },
    },
    {
      path: '/applicant',
      name: 'applicant_dashboard',
      component: () => import('@/modules/Applicant/applicant_dashboard.vue'),
      meta: { requiresAuth: true, role: 'applicant', title: 'PWD | Applicant Dashboard' },
    },
    {
      path: '/employer/business',
      name: 'employer_business_dashboard',
      component: () => import('@/modules/Employer/employer_business_dashboard.vue'),
      meta: {
        requiresAuth: true,
        role: 'employer',
        employerType: 'business',
        title: 'PWD | Employer Business Dashboard',
      },
    },
    {
      path: '/employer/company',
      name: 'employer_company_dashboard',
      component: () => import('@/modules/Employer/employer_company_dashboard.vue'),
      meta: {
        requiresAuth: true,
        role: 'employer',
        employerType: 'company',
        title: 'PWD | Employer Company Dashboard',
      },
    },
  ],
})

router.beforeEach(async (to) => {
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768

  if (to.path === '/' && isMobileViewport) {
    return '/mobile'
  }

  if (to.path === '/mobile' && !isMobileViewport) {
    return '/'
  }

  document.title = to.meta.title || 'PWD Platform'

  if (!to.meta.requiresAuth) return true

  const { validateAuthenticatedRouteAccess } = await import('@/lib/security-auth')
  const access = await validateAuthenticatedRouteAccess(to.meta)
  if (!access.allowed) {
    return access.redirect || '/login'
  }

  const user = access.user

  if (to.name === 'employer_business_dashboard') {
    const {
      buildBusinessSecurityRouteQuery,
      managedBusinessSecurityQueryEquals,
    } = await import('@/lib/security')
    const nextQuery = buildBusinessSecurityRouteQuery(
      user,
      {
        section: to.query.businessSection,
        subscriptionView: to.query.businessSubscriptionView,
        planId: to.query.businessPlan,
      },
      to.query,
    )

    if (!managedBusinessSecurityQueryEquals(to.query, nextQuery)) {
      return {
        path: to.path,
        query: nextQuery,
        hash: to.hash,
        replace: true,
      }
    }
  }

  return true
})

export default router
