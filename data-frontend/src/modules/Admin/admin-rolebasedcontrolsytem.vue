<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  updateAdminManagedApplicantWorkspacePermissions,
  updateAdminManagedBusinessWorkspacePermissions,
} from '@/lib/auth'

const props = defineProps({
  applicants: {
    type: Array,
    default: () => [],
  },
  employers: {
    type: Array,
    default: () => [],
  },
  workspaceMembersByBusinessId: {
    type: Object,
    default: () => ({}),
  },
})

const text = (value, fallback = '') => String(value || fallback).trim()

const normalizePermissions = (permissions = {}) => {
  const full = Boolean(permissions?.full)
  const edit = Boolean(permissions?.edit || full)
  const view = Boolean(permissions?.view || edit || full)
  return { view, edit, full }
}

const isCheckedModule = (permissions = {}) => {
  const normalized = normalizePermissions(permissions)
  return normalized.view
}

const applicantSectionCatalog = [
  {
    id: 'applicant-main',
    label: 'GENERAL',
    modules: [
      { id: 'overview', label: 'Dashboard' },
      { id: 'messages', label: 'Messages' },
      { id: 'profile', label: 'My Profile' },
      { id: 'settings', label: 'Settings' },
      { id: 'help-center', label: 'Help Center' },
    ],
  },
  {
    id: 'application-activity',
    label: 'APPLICATION ACTIVITY',
    modules: [
      { id: 'find-jobs', label: 'Find Jobs' },
      { id: 'applications', label: 'My Applications' },
      { id: 'interviews', label: 'Interviews' },
      { id: 'technical-assessment', label: 'Technical Assessment' },
    ],
  },
]

const businessSectionCatalog = [
  {
    id: 'general-system',
    label: 'GENERAL & SYSTEM',
    modules: [
      { id: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    id: 'recruitment',
    label: 'RECRUITMENT',
    modules: [
      { id: 'job-posting', label: 'Job Posting' },
      { id: 'applicant-management', label: 'Applicant Management' },
    ],
  },
  {
    id: 'assessment',
    label: 'ASSESSMENT',
    modules: [
      { id: 'assessment-management', label: 'Assessment Management' },
      { id: 'applicant-score', label: 'Applicant Score' },
    ],
  },
  {
    id: 'interview',
    label: 'INTERVIEW',
    modules: [
      { id: 'interview-scheduling', label: 'Interview Scheduling' },
    ],
  },
  {
    id: 'training',
    label: 'TRAINING',
    modules: [
      { id: 'training-templates', label: 'Training Templates' },
      { id: 'assign-templates', label: 'Assign Templates' },
    ],
  },
  {
    id: 'employees-permissions',
    label: 'EMPLOYEES & PERMISSIONS',
    modules: [
      { id: 'user-overview', label: 'User Overview' },
      { id: 'create-user', label: 'Create User' },
      { id: 'add-employee', label: 'Add Employee' },
      { id: 'permissions', label: 'Permissions' },
    ],
  },
]

const cloneModules = (modules = []) =>
  (Array.isArray(modules) ? modules : []).map((module) => ({
    id: text(module?.id),
    permissions: normalizePermissions(module?.permissions),
  }))

const localApplicantModules = ref(null)
const localBusinessRoleModules = ref({})

const applicantRoleRecord = computed(() => {
  const persistedApplicantModules = localApplicantModules.value
    || props.applicants.find((applicant) =>
    Array.isArray(applicant?.admin_applicant_module_access) && applicant.admin_applicant_module_access.length)
    ?.admin_applicant_module_access
    || props.applicants.find((applicant) =>
      Array.isArray(applicant?.adminApplicantModuleAccess) && applicant.adminApplicantModuleAccess.length)
      ?.adminApplicantModuleAccess
    || null

  return {
    key: 'applicant-access',
    title: 'Applicant',
    countLabel: `${props.applicants.length} applicant${props.applicants.length === 1 ? '' : 's'}`,
    sectionCatalog: applicantSectionCatalog,
    modules: Array.isArray(persistedApplicantModules) && persistedApplicantModules.length
      ? persistedApplicantModules.map((module) => ({
        id: text(module?.id),
        permissions: normalizePermissions(module?.permissions),
      }))
      : [
        { id: 'overview', permissions: { view: true } },
        { id: 'messages', permissions: { view: true } },
        { id: 'profile', permissions: { view: true, edit: true } },
        { id: 'settings', permissions: { view: true } },
        { id: 'help-center', permissions: { view: true } },

        { id: 'find-jobs', permissions: { view: true } },
        { id: 'applications', permissions: { view: true } },
        { id: 'interviews', permissions: { view: true } },
        { id: 'technical-assessment', permissions: { view: true } },
      ],
  }
})

const businessRoleRecords = computed(() => {
  const roleMap = new Map()

  props.employers.forEach((employer, employerIndex) => {
    const businessId = text(employer?.id, `business-${employerIndex + 1}`)
    const businessName = text(
      employer?.company_name || employer?.name || employer?.email,
      `Business ${employerIndex + 1}`,
    )

    const workspaceMembers = Array.isArray(props.workspaceMembersByBusinessId?.[businessId])
      ? props.workspaceMembersByBusinessId[businessId]
      : []

    const workspaceRoles = Array.isArray(employer?.workspace_permission_roles)
      ? employer.workspace_permission_roles
      : []

    if (!workspaceRoles.length) {
      const overrideModules = localBusinessRoleModules.value[`${businessId}:default`] || null
      roleMap.set(`${businessId}:default`, {
        key: `${businessId}:default`,
        businessId,
        roleId: 'role-admin-managed',
        roleName: 'Admin Managed',
        color: '#0f8f68',
        title: businessName,
        countLabel: `${workspaceMembers.length} assigned member${workspaceMembers.length === 1 ? '' : 's'}`,
        sectionCatalog: businessSectionCatalog,
        modules: overrideModules || [
          { id: 'dashboard', permissions: { view: true } },

          { id: 'job-posting', permissions: { view: true, edit: true } },
          { id: 'applicant-management', permissions: { view: true, edit: true } },

          { id: 'assessment-management', permissions: { view: true, edit: true } },
          { id: 'applicant-score', permissions: { view: true } },

          { id: 'interview-scheduling', permissions: { view: true, edit: true } },

          { id: 'training-templates', permissions: { view: true, edit: true } },
          { id: 'assign-templates', permissions: { view: true, edit: true } },

          { id: 'user-overview', permissions: { view: true } },
          { id: 'create-user', permissions: { view: true, edit: true } },
          { id: 'add-employee', permissions: { view: true, edit: true } },
          { id: 'permissions', permissions: { view: true, full: true } },
        ],
      })
      return
    }

    workspaceRoles.forEach((role, roleIndex) => {
      const roleId = text(role?.id, `role-${roleIndex + 1}`)
      const roleName = text(role?.name, `Role ${roleIndex + 1}`)

      const assignedMembers = workspaceMembers.filter(
        (member) => text(member?.roleId || member?.permissionRoleId) === roleId,
      )

      const mappedModules = Array.isArray(role?.modules)
        ? role.modules.map((module) => ({
            id: text(module?.id),
            permissions: normalizePermissions(module?.permissions),
          }))
        : []
      const overrideModules = localBusinessRoleModules.value[`${businessId}:${roleId}`] || null

      roleMap.set(`${businessId}:${roleId}`, {
        key: `${businessId}:${roleId}`,
        businessId,
        roleId,
        roleName,
        color: text(role?.color),
        title: `${businessName} • ${roleName}`,
        countLabel: `${assignedMembers.length} assigned member${assignedMembers.length === 1 ? '' : 's'}`,
        sectionCatalog: businessSectionCatalog,
        modules: overrideModules || mappedModules,
      })
    })
  })

  return [...roleMap.values()]
})

const selectedBusinessRoleKey = ref('')

const businessRoleOptions = computed(() =>
  businessRoleRecords.value.map((role) => ({
    key: role.key,
    title: role.title,
  })),
)

const selectedBusinessRoleRecord = computed(() =>
  businessRoleRecords.value.find((role) => role.key === selectedBusinessRoleKey.value) || businessRoleRecords.value[0] || null,
)

const buildSections = (role) => {
  if (!role) return []

  const moduleMap = new Map(
    (role.modules || []).map((module) => [module.id, normalizePermissions(module.permissions)]),
  )

  return role.sectionCatalog.map((section) => ({
    ...section,
    modules: section.modules.map((module) => {
      const permissions = moduleMap.get(module.id) || { view: false, edit: false, full: false }

      return {
        ...module,
        permissions,
        checked: isCheckedModule(permissions),
      }
    }),
  }))
}

const businessSections = reactive([])
const applicantSections = reactive([])
const isSavingBusiness = ref(false)
const isSavingApplicant = ref(false)
const createToastState = () => ({
  visible: false,
  title: '',
  message: '',
  tone: 'success',
})
const toast = ref(createToastState())
let toastTimeoutId = null

const clearToastTimeout = () => {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId)
    toastTimeoutId = null
  }
}

const closeToast = () => {
  clearToastTimeout()
  toast.value = createToastState()
}

const showToast = (message, tone = 'success', title = '') => {
  clearToastTimeout()
  toast.value = {
    visible: true,
    title: String(title || (tone === 'success' ? 'Saved' : 'Notice')).trim(),
    message: String(message || '').trim(),
    tone,
  }
  toastTimeoutId = setTimeout(() => {
    toast.value = createToastState()
    toastTimeoutId = null
  }, 3200)
}

const syncSectionState = (target, source) => {
  target.splice(0, target.length, ...source.map((section) => ({
    ...section,
    modules: section.modules.map((module) => ({
      ...module,
    })),
  })))
}

const syncBusinessDraftFromRole = (role) => {
  syncSectionState(businessSections, buildSections(role))
  savedBusinessSectionsSnapshot.value = serializeSections(businessSections)
}

const syncApplicantDraftFromRole = (role) => {
  syncSectionState(applicantSections, buildSections(role))
  savedApplicantSectionsSnapshot.value = serializeSections(applicantSections)
}

const serializeSections = (sections) => JSON.stringify(
  sections.map((section) => ({
    id: section.id,
    modules: section.modules.map((module) => ({
      id: module.id,
      checked: Boolean(module.checked),
    })),
  })),
)

watch(
  businessRoleOptions,
  (options) => {
    if (!options.length) {
      selectedBusinessRoleKey.value = ''
      return
    }

    if (!options.some((option) => option.key === selectedBusinessRoleKey.value)) {
      selectedBusinessRoleKey.value = options[0].key
    }
  },
  { immediate: true },
)

const toggleModule = (module) => {
  module.checked = !module.checked
}

const toggleAllSectionModules = (sections, value) => {
  sections.forEach((section) => {
    section.modules.forEach((module) => {
      module.checked = value
    })
  })
}

const selectAllBusiness = computed({
  get() {
    const modules = businessSections.flatMap((section) => section.modules)
    if (!modules.length) return false
    return modules.every((module) => module.checked)
  },
  set(value) {
    toggleAllSectionModules(businessSections, value)
  },
})

const selectAllApplicant = computed({
  get() {
    const modules = applicantSections.flatMap((section) => section.modules)
    if (!modules.length) return false
    return modules.every((module) => module.checked)
  },
  set(value) {
    toggleAllSectionModules(applicantSections, value)
  },
})

const businessSectionsSnapshot = computed(() => serializeSections(businessSections))
const applicantSectionsSnapshot = computed(() => serializeSections(applicantSections))
const savedBusinessSectionsSnapshot = ref('')
const savedApplicantSectionsSnapshot = ref('')

watch(businessSectionsSnapshot, (value) => {
  if (!savedBusinessSectionsSnapshot.value) {
    savedBusinessSectionsSnapshot.value = value
  }
}, { immediate: true })

watch(applicantSectionsSnapshot, (value) => {
  if (!savedApplicantSectionsSnapshot.value) {
    savedApplicantSectionsSnapshot.value = value
  }
}, { immediate: true })

const hasUnsavedBusinessChanges = computed(() =>
  businessSectionsSnapshot.value !== savedBusinessSectionsSnapshot.value,
)

const hasUnsavedApplicantChanges = computed(() =>
  applicantSectionsSnapshot.value !== savedApplicantSectionsSnapshot.value,
)

watch(
  selectedBusinessRoleKey,
  () => {
    syncBusinessDraftFromRole(selectedBusinessRoleRecord.value)
  },
  { immediate: true },
)

watch(
  () => JSON.stringify(selectedBusinessRoleRecord.value?.modules || []),
  () => {
    if (hasUnsavedBusinessChanges.value && !isSavingBusiness.value) return
    syncBusinessDraftFromRole(selectedBusinessRoleRecord.value)
  },
  { immediate: true },
)

watch(
  () => JSON.stringify(applicantRoleRecord.value?.modules || []),
  () => {
    if (hasUnsavedApplicantChanges.value && !isSavingApplicant.value) return
    syncApplicantDraftFromRole(applicantRoleRecord.value)
  },
  { immediate: true },
)

const buildSectionPayload = (sections) => sections.map((section) => ({
  id: section.id,
  modules: section.modules.map((module) => ({
    id: module.id,
    checked: module.checked,
  })),
}))

const buildRoleModulesFromSections = (sections) =>
  sections.flatMap((section) =>
    section.modules.map((module) => ({
      id: module.id,
      label: module.label,
      sectionId: section.id,
      sectionLabel: section.label,
      permissions: {
        view: Boolean(module.checked),
        edit: Boolean(module.checked),
        full: false,
      },
    })),
  )

const handleSave = async (target) => {
  const isBusinessTarget = target === 'business'
  const sections = isBusinessTarget ? businessSections : applicantSections
  const snapshot = isBusinessTarget ? businessSectionsSnapshot : applicantSectionsSnapshot
  const hasChanges = isBusinessTarget ? hasUnsavedBusinessChanges.value : hasUnsavedApplicantChanges.value

  if (!hasChanges) return

  if (isBusinessTarget) {
    isSavingBusiness.value = true
  } else {
    isSavingApplicant.value = true
  }

  const payload = buildSectionPayload(sections)
  try {
    if (isBusinessTarget) {
      const selectedRoleRecord = selectedBusinessRoleRecord.value
      const employerId = text(selectedRoleRecord?.businessId)
      const workspaceUsers = Array.isArray(props.workspaceMembersByBusinessId?.[employerId])
        ? props.workspaceMembersByBusinessId[employerId]
        : []
      const employerRecord = props.employers.find((employer) => text(employer?.id) === employerId) || null
      const existingRoles = Array.isArray(employerRecord?.workspace_permission_roles)
        ? employerRecord.workspace_permission_roles
        : []
      const nextRole = {
        id: text(selectedRoleRecord?.roleId || 'role-admin-managed'),
        name: text(selectedRoleRecord?.roleName || selectedRoleRecord?.title || 'Admin Managed'),
        color: text(selectedRoleRecord?.color || '#0f8f68'),
        modules: buildRoleModulesFromSections(businessSections),
      }
      const nextRoles = existingRoles.length
        ? existingRoles.map((role) =>
            text(role?.id) === nextRole.id
              ? { ...role, ...nextRole }
              : role)
        : [nextRole]

      await updateAdminManagedBusinessWorkspacePermissions({
        employerId,
        roles: nextRoles,
        previousRoles: existingRoles,
        selectedRoleId: nextRole.id,
        workspaceUsers,
      })

      localBusinessRoleModules.value = {
        ...localBusinessRoleModules.value,
        [selectedRoleRecord.key]: cloneModules(nextRole.modules),
      }
      savedBusinessSectionsSnapshot.value = snapshot.value
      console.log('Business Access:', payload)
      showToast('Business RBAC changes were saved successfully.', 'success', 'Business Access Saved')
      return
    }

    const persistedApplicantModules = applicantRoleRecord.value.modules.map((module) => ({
      id: text(module?.id),
      permissions: normalizePermissions(module?.permissions),
    }))
    const nextApplicantModules = buildRoleModulesFromSections(applicantSections)

    await updateAdminManagedApplicantWorkspacePermissions({
      applicantIds: props.applicants.map((applicant) => text(applicant?.id)).filter(Boolean),
      modules: nextApplicantModules,
      previousModules: persistedApplicantModules,
    })

    localApplicantModules.value = cloneModules(nextApplicantModules)
    savedApplicantSectionsSnapshot.value = snapshot.value
    console.log('Applicant Access:', payload)
    showToast('Applicant RBAC changes were saved successfully.', 'success', 'Applicant Access Saved')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Unable to save RBAC changes right now.', 'warning', 'Save Failed')
  } finally {
    if (isBusinessTarget) {
      isSavingBusiness.value = false
    } else {
      isSavingApplicant.value = false
    }
  }
}
</script>

<template>
  <section class="access-layout">
    <Transition name="access-toast">
      <div
        v-if="toast.visible"
        class="access-toast"
        :class="`is-${toast.tone}`"
        role="status"
        aria-live="polite"
      >
        <div class="access-toast__icon" aria-hidden="true">
          <i :class="toast.tone === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill'" />
        </div>
        <div class="access-toast__copy">
          <strong>{{ toast.title }}</strong>
          <span>{{ toast.message }}</span>
        </div>
        <button type="button" class="access-toast__close" aria-label="Close notification" @click="closeToast">
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </Transition>

    <article class="access-panel">
      <div class="access-panel__header">
        <div class="access-panel__title-wrap">
          <div class="access-badge">Business</div>
          <div>
            <h2 class="access-panel__title">Business Access</h2>
            <p class="access-panel__subtitle">
              Access to business-related modules for recruitment, assessment, interview, and training.
            </p>
          </div>
        </div>

        <div class="access-panel__actions">
          <label class="access-check">
            <input v-model="selectAllBusiness" type="checkbox" />
            <span>Select All</span>
          </label>

          <button
            v-if="hasUnsavedBusinessChanges || isSavingBusiness"
            type="button"
            class="access-save-btn"
            :disabled="isSavingBusiness"
            @click="handleSave('business')"
          >
            <span
              v-if="isSavingBusiness"
              class="access-save-btn__spinner"
              aria-hidden="true"
            />
            {{ isSavingBusiness ? 'Saving...' : 'Save Changes' }}
          </button>

          <span v-else class="access-save-lock">
            <i class="bi bi-lock-fill" aria-hidden="true" />
            <span>Locked until changes</span>
          </span>
        </div>
      </div>





      <div v-if="businessSections.length" class="access-grid">
        <section
          v-for="section in businessSections"
          :key="section.id"
          class="access-card"
        >
          <h3 class="access-card__title">{{ section.label }}</h3>

          <div class="access-card__list">
            <button
              v-for="module in section.modules"
              :key="module.id"
              type="button"
              class="access-item access-item--button"
              @click="toggleModule(module)"
            >
              <span
                class="access-dot"
                :class="{ 'is-active': module.checked }"
                aria-hidden="true"
              />
              <span class="access-item__label">{{ module.label }}</span>
            </button>
          </div>
        </section>
      </div>

      <div v-else class="access-empty">
        No business role data yet.
      </div>
    </article>

    <article class="access-panel">
      <div class="access-panel__header">
        <div class="access-panel__title-wrap">
          <div class="access-badge applicant">Applicant</div>
          <div>
            <h2 class="access-panel__title">Applicant Access</h2>
            <p class="access-panel__subtitle">
              Access to applicant-related modules for profile, job applications, and communication.
            </p>
          </div>
        </div>

        <div class="access-panel__actions">
          <label class="access-check">
            <input v-model="selectAllApplicant" type="checkbox" />
            <span>Select All</span>
          </label>
          <button
            v-if="hasUnsavedApplicantChanges || isSavingApplicant"
            type="button"
            class="access-save-btn"
            :disabled="isSavingApplicant"
            @click="handleSave('applicant')"
          >
            <span v-if="isSavingApplicant" class="access-save-btn__spinner" aria-hidden="true" />
            {{ isSavingApplicant ? 'Saving...' : 'Save Changes' }}
          </button>
          <span v-else class="access-save-lock">
            <i class="bi bi-lock-fill" aria-hidden="true" />
            <span>Locked until changes</span>
          </span>
        </div>
      </div>

      <div class="access-grid">
        <section
          v-for="section in applicantSections"
          :key="section.id"
          class="access-card"
        >
          <h3 class="access-card__title">{{ section.label }}</h3>

          <div class="access-card__list">
            <button
              v-for="module in section.modules"
              :key="module.id"
              type="button"
              class="access-item access-item--button"
              @click="toggleModule(module)"
            >
              <span
                class="access-dot"
                :class="{ 'is-active': module.checked }"
                aria-hidden="true"
              />
              <span class="access-item__label">{{ module.label }}</span>
            </button>
          </div>
        </section>
      </div>
    </article>
  </section>
</template>

<style scoped>
.access-layout {
  display: grid;
  gap: 1.5rem;
}

.access-panel {
  padding: 1.2rem;
  border: 1px solid #dce9e2;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
}

.access-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.access-panel__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.access-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 82px;
  height: 32px;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: rgba(31, 122, 90, 0.1);
  color: #1f7a5a;
  font-size: 0.82rem;
  font-weight: 700;
}

.access-badge.applicant {
  background: rgba(31, 122, 90, 0.08);
  color: #1f7a5a;
}

.access-panel__title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  color: #183b2d;
}

.access-panel__subtitle {
  margin: 0.28rem 0 0;
  color: #698273;
  font-size: 0.88rem;
  line-height: 1.45;
}

.access-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.access-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #486657;
  font-size: 0.85rem;
  font-weight: 600;
}

.access-select {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #486657;
  font-size: 0.85rem;
  font-weight: 600;
}

.access-select select {
  min-width: 240px;
  border: 1px solid #cfe1d7;
  border-radius: 10px;
  background: #fff;
  color: #304c3f;
  font-size: 0.85rem;
  padding: 0.62rem 0.75rem;
}

.access-check input {
  width: 16px;
  height: 16px;
  accent-color: #1f7a5a;
  cursor: pointer;
}

.access-save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.58rem;
  min-width: 156px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #0f8f68, #14b57c);
  color: #fff;
  font-weight: 800;
  font-size: 0.88rem;
  letter-spacing: 0.01em;
  padding: 0.82rem 1.18rem;
  cursor: pointer;
  box-shadow: 0 16px 30px rgba(20, 181, 124, 0.24);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.access-save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 36px rgba(20, 181, 124, 0.3);
}

.access-save-btn:disabled {
  cursor: wait;
  opacity: 0.9;
}

.access-save-btn__spinner {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.34);
  border-top-color: #ffffff;
  animation: access-spin 0.8s linear infinite;
}

.access-save-lock {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.72rem 0.95rem;
  border: 1px solid #d7e4dd;
  border-radius: 14px;
  background: #f7fbf9;
  color: #6b8577;
  font-size: 0.84rem;
  font-weight: 700;
}

.access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1rem));
  gap: 0.5rem;
  justify-content: start;
}

.access-card {
  border: 1px solid #dfeae4;
  border-radius: 18px;
  background: #fff;
  padding: 1rem;
  width: 15rem;
}

.access-card__title {
  margin: 0 0 0.9rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid #edf3ef;
  color: #456556;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.access-card__list {
  display: grid;
  gap: 0.78rem;
}

.access-item {
  display: flex;
  align-items: center;
  gap: 0.62rem;
  color: #304c3f;
  font-size: 0.92rem;
  font-weight: 500;
}

.access-item--button {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.access-item--button:hover .access-item__label {
  color: #1f7a5a;
}

.access-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #c6d8cf;
  background: #fff;
  flex: 0 0 14px;
  transition: all 0.18s ease;
}

.access-dot.is-active {
  border-color: #1f7a5a;
  background: #1f7a5a;
  box-shadow: inset 0 0 0 3px #fff;
}

.access-item__label {
  line-height: 1.2;
  transition: color 0.18s ease;
}

.access-empty {
  padding: 1rem;
  border: 1px dashed #cfe1d7;
  border-radius: 16px;
  color: #5f7a6c;
  background: #f9fcfa;
}

.access-toast {
  position: fixed;
  left: 1.4rem;
  bottom: 1.4rem;
  z-index: 50;
  width: min(420px, calc(100vw - 2rem));
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1rem 1.05rem;
  border-radius: 18px;
  border: 1px solid rgba(210, 228, 219, 0.95);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.access-toast.is-success {
  border-color: rgba(36, 158, 112, 0.24);
}

.access-toast.is-warning {
  border-color: rgba(230, 162, 60, 0.28);
}

.access-toast__icon {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex: 0 0 2.2rem;
  background: rgba(20, 181, 124, 0.14);
  color: #0f8f68;
  font-size: 1.05rem;
}

.access-toast.is-warning .access-toast__icon {
  background: rgba(230, 162, 60, 0.14);
  color: #b7791f;
}

.access-toast__copy {
  display: grid;
  gap: 0.2rem;
  color: #304c3f;
}

.access-toast__copy strong {
  font-size: 0.92rem;
  font-weight: 800;
}

.access-toast__copy span {
  font-size: 0.84rem;
  line-height: 1.45;
  color: #5f7a6c;
}

.access-toast__close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #89a093;
  cursor: pointer;
  padding: 0.15rem;
}

.access-toast-enter-active,
.access-toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.access-toast-enter-from,
.access-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@keyframes access-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1200px) {
  .access-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .access-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .access-grid {
    grid-template-columns: 1fr;
  }

  .access-panel__header {
    flex-direction: column;
    align-items: stretch;
  }

}
</style>
