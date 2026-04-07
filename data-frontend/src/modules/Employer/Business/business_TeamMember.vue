<script setup>
import { toRefs } from 'vue'
import BPermissionrules from '@/modules/Employer/Business/business_Permissionrules.vue'
import BUserOverview from '@/modules/Employer/Business/business_UserOverview.vue'

const props = defineProps([
  'activeSection',
  'currentUserManagementPage',
  'isWorkspaceUserDirectoryLoading',
  'workspaceUserDirectory',
  'permissionRoles',
  'employeeDirectory',
  'workspaceUserDirectorySyncMessage',
  'userOverviewCards',
  'filteredUserOverviewRows',
  'userOverviewRoleOptions',
  'userOverviewSearch',
  'userOverviewRoleFilter',
  'userOverviewStatusFilter',
  'userOverviewSummary',
  'formatUserOverviewDate',
  'setUserOverviewSearch',
  'setUserOverviewRoleFilter',
  'setUserOverviewStatusFilter',
  'openCreateUserSection',
  'openPermissionsSection',
  'userAccountDraft',
  'permissionRoleOptionsForUsers',
  'selectedUserAccountRole',
  'selectedUserAccountRoleSummary',
  'selectedUserAccountRoleModules',
  'selectedUserAccountRoleModuleSections',
  'canEditBusinessModule',
  'isCreatingWorkspaceUser',
  'resetUserAccountDraft',
  'saveWorkspaceUserAccount',
  'getEmployeeRoleName',
  'getEmployeeRoleAccessSummary',
  'resolveEmployeeStatusClass',
  'permissionBindings',
])

const {
  activeSection,
  currentUserManagementPage,
  isWorkspaceUserDirectoryLoading,
  workspaceUserDirectory,
  permissionRoles,
  employeeDirectory,
  workspaceUserDirectorySyncMessage,
  userOverviewCards,
  filteredUserOverviewRows,
  userOverviewRoleOptions,
  userOverviewSearch,
  userOverviewRoleFilter,
  userOverviewStatusFilter,
  userOverviewSummary,
  formatUserOverviewDate,
  setUserOverviewSearch,
  setUserOverviewRoleFilter,
  setUserOverviewStatusFilter,
  openCreateUserSection,
  openPermissionsSection,
  userAccountDraft,
  permissionRoleOptionsForUsers,
  selectedUserAccountRole,
  selectedUserAccountRoleSummary,
  selectedUserAccountRoleModules,
  selectedUserAccountRoleModuleSections,
  canEditBusinessModule,
  isCreatingWorkspaceUser,
  resetUserAccountDraft,
  saveWorkspaceUserAccount,
  getEmployeeRoleName,
  getEmployeeRoleAccessSummary,
  resolveEmployeeStatusClass,
  permissionBindings,
} = toRefs(props)
</script>

<template>
  <section class="business-user-management">
    <div class="business-user-management__lead">
      <div class="business-user-management__copy">
        <p class="business-user-management__eyebrow">User Management</p>
        <h2>{{ currentUserManagementPage.title }}</h2>
        <p>{{ currentUserManagementPage.description }}</p>
      </div>
      <div v-if="activeSection !== 'create-user' && activeSection !== 'user-overview'" class="business-user-management__lead-meta">
        <span class="business-user-management__panel-chip">
          {{
            isWorkspaceUserDirectoryLoading
              ? 'Syncing workspace users...'
              : activeSection === 'permissions'
                ? `${permissionRoles.length} saved roles`
                : `${employeeDirectory.length} employee profiles`
          }}
        </span>
        <span class="business-user-management__panel-chip">
          {{ activeSection === 'permissions' ? 'RBAC matrix' : 'List view only' }}
        </span>
      </div>
    </div>

    <p v-if="workspaceUserDirectorySyncMessage && activeSection !== 'create-user' && activeSection !== 'permissions'" class="business-user-management__notice">
      {{ workspaceUserDirectorySyncMessage }}
    </p>

    <section v-if="activeSection === 'user-overview'" class="business-user-management__overview">
      <div class="business-user-management__overview-head">
        <div>
          <p class="business-user-management__panel-label">Team Overview</p>
          <h3>Quick snapshot of your team members</h3>
        </div>
        <span class="business-user-management__panel-chip">Team Members</span>
      </div>

      <div class="business-user-management__overview-grid">
        <article
          v-for="card in userOverviewCards"
          :key="card.label"
          class="business-user-management__overview-card"
        >
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.copy }}</small>
        </article>
      </div>
    </section>

    <BUserOverview
      v-if="activeSection === 'user-overview'"
      :workspace-user-count="workspaceUserDirectory.length"
      :employee-profile-count="employeeDirectory.length"
      :rows="filteredUserOverviewRows"
      :role-options="userOverviewRoleOptions"
      :search="userOverviewSearch"
      :role-filter="userOverviewRoleFilter"
      :status-filter="userOverviewStatusFilter"
      :summary="userOverviewSummary"
      :format-date="formatUserOverviewDate"
      @update:search="setUserOverviewSearch"
      @update:role-filter="setUserOverviewRoleFilter"
      @update:status-filter="setUserOverviewStatusFilter"
      @create-user="openCreateUserSection"
    />

    <article v-else-if="activeSection === 'create-user'" class="business-user-management__panel business-user-management__panel--admin-create">
      <div class="business-user-management__sheet-header">
        <div>
          <p class="business-user-management__panel-label">Create User</p>
          <h3>Create a workspace login for your team</h3>
          <p class="business-user-management__sheet-copy">Enter the team member details below and assign a saved role before creating the account.</p>
        </div>
        <span class="business-user-management__panel-chip">{{ permissionRoles.length }} roles available</span>
      </div>

      <div class="business-user-management__drawer-launch">
        <div class="business-user-management__drawer-copy">
          <strong>Permissions are back in Team Manager</strong>
          <span>Open the permission builder to add or edit roles, then come back here to assign them to each workspace login.</span>
        </div>
        <button type="button" class="business-user-management__action-btn business-user-management__action-btn--secondary" @click="openPermissionsSection">
          <i class="bi bi-shield-lock" aria-hidden="true" />
          Open Permissions
        </button>
      </div>

      <div class="business-user-management__inline-meta business-user-management__inline-meta--sheet">
        <span v-for="role in permissionRoles.slice(0, 4)" :key="role.id" class="business-user-management__panel-chip">
          {{ role.name }}
        </span>
      </div>

      <fieldset class="business-user-management__fieldset business-user-management__fieldset--sheet" :disabled="!canEditBusinessModule('create-user') || isCreatingWorkspaceUser">
        <div class="business-user-management__grid business-user-management__grid--two">
          <label class="business-user-management__field business-user-management__field--sheet">
            <span>Full Name</span>
            <input v-model="userAccountDraft.fullName" type="text" placeholder="Enter full name" />
          </label>

          <label class="business-user-management__field business-user-management__field--sheet">
            <span>Email Address</span>
            <input v-model="userAccountDraft.gmail" type="email" placeholder="name@company.com" />
          </label>
        </div>

        <div class="business-user-management__grid business-user-management__grid--two">
          <label class="business-user-management__field business-user-management__field--sheet">
            <span>Temporary Password</span>
            <input v-model="userAccountDraft.temporaryPassword" type="text" placeholder="Enter temporary password" />
          </label>

          <label class="business-user-management__field business-user-management__field--sheet">
            <span>Assign Role</span>
            <select v-model="userAccountDraft.roleId">
              <option value="">Select a role from Permissions</option>
              <option v-for="role in permissionRoleOptionsForUsers" :key="role.id" :value="role.id">
                {{ role.name }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="selectedUserAccountRole" class="business-user-management__role-preview">
          <div class="business-user-management__role-preview-head">
            <span class="business-user-management__panel-chip">{{ selectedUserAccountRole.name }}</span>
          </div>
          <div class="business-user-management__inline-meta business-user-management__inline-meta--sheet">
            <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleSummary }}</span>
            <span class="business-user-management__panel-chip">{{ selectedUserAccountRoleModules }}</span>
          </div>
          <p class="business-permissions__intro-copy">
            Module access preview for the selected role. Ito ang exact access pattern na maa-assign sa bagong user.
          </p>
          <div class="business-permissions__table-wrap business-permissions__table-wrap--matrix">
            <table class="business-permissions__table business-permissions__table--matrix">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Module</th>
                  <th>View</th>
                  <th>Edit</th>
                  <th>Full Access</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="section in selectedUserAccountRoleModuleSections" :key="section.id">
                  <tr
                    v-for="module in section.modules"
                    :key="module.id"
                    class="business-permissions__table-row"
                    :class="{ 'is-muted': !module.permissions.view }"
                  >
                    <td>
                      <span class="business-permissions__section-chip">
                        <i :class="section.icon" aria-hidden="true" />
                        {{ section.label }}
                      </span>
                    </td>
                    <td>
                      <div class="business-permissions__module-copy">
                        <strong>{{ module.label }}</strong>
                        <p>{{ module.description }}</p>
                      </div>
                    </td>
                    <td>
                      <label class="business-permissions__switch" :aria-label="`View access for ${module.label}`">
                        <input
                          type="checkbox"
                          class="business-permissions__switch-input"
                          :checked="module.permissions.view"
                          disabled
                        />
                        <span class="business-permissions__switch-track" aria-hidden="true">
                          <span class="business-permissions__switch-thumb" />
                        </span>
                      </label>
                    </td>
                    <td>
                      <label class="business-permissions__switch" :aria-label="`Edit access for ${module.label}`">
                        <input
                          type="checkbox"
                          class="business-permissions__switch-input"
                          :checked="module.permissions.edit"
                          disabled
                        />
                        <span class="business-permissions__switch-track" aria-hidden="true">
                          <span class="business-permissions__switch-thumb" />
                        </span>
                      </label>
                    </td>
                    <td>
                      <label class="business-permissions__switch" :aria-label="`Full access for ${module.label}`">
                        <input
                          type="checkbox"
                          class="business-permissions__switch-input"
                          :checked="module.permissions.full"
                          disabled
                        />
                        <span class="business-permissions__switch-track" aria-hidden="true">
                          <span class="business-permissions__switch-thumb" />
                        </span>
                      </label>
                    </td>
                    <td>
                      <span
                        class="business-permissions__status-pill"
                        :class="{
                          'is-hidden': !module.permissions.view,
                          'is-full': module.permissions.full,
                        }"
                      >
                        {{ module.accessLabel }}
                      </span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <div class="business-user-management__actions business-user-management__actions--sheet">
          <button type="button" class="business-user-management__action-btn business-user-management__action-btn--secondary" @click="resetUserAccountDraft">
            <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
            Clear Form
          </button>
          <button type="button" class="business-user-management__action-btn business-user-management__action-btn--primary" @click="saveWorkspaceUserAccount">
            <i class="bi bi-check-circle" aria-hidden="true" />
            {{ isCreatingWorkspaceUser ? 'Creating Account...' : 'Create User' }}
          </button>
        </div>
      </fieldset>
    </article>

    <BPermissionrules
      v-else-if="activeSection === 'permissions'"
      v-bind="permissionBindings"
    />

    <article v-else class="business-user-management__panel business-user-management__panel--form">
      <div class="business-user-management__panel-head">
        <div>
          <p class="business-user-management__panel-label">Employee Directory</p>
          <h3>Review your saved employee profiles</h3>
          <p class="business-user-management__panel-copy">This section is now list-only so you can focus on reviewing linked employee records.</p>
        </div>
        <span class="business-user-management__panel-chip">{{ employeeDirectory.length }} employee profiles</span>
      </div>

      <div class="business-user-management__table-wrap">
        <table class="business-user-management__table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Linked User</th>
              <th>Role</th>
              <th>Gmail</th>
              <th>Employment Type</th>
              <th>Status</th>
              <th>Start Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="employee in employeeDirectory" :key="employee.id">
              <td><strong>{{ employee.id }}</strong></td>
              <td>
                <div class="business-user-management__meta">
                  <strong>{{ employee.name }}</strong>
                  <small>{{ employee.linkedUserId }}</small>
                </div>
              </td>
              <td>
                <div class="business-user-management__meta">
                  <strong>{{ getEmployeeRoleName(employee) }}</strong>
                  <small>{{ getEmployeeRoleAccessSummary(employee) }}</small>
                </div>
              </td>
              <td>{{ employee.workEmail }}</td>
              <td>{{ employee.employmentType || 'Not set' }}</td>
              <td>
                <span class="business-user-management__status" :class="resolveEmployeeStatusClass(employee.status)">
                  {{ employee.status }}
                </span>
              </td>
              <td>{{ employee.startDate || 'Not set' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!employeeDirectory.length" class="business-user-management__notice">
        No employee profiles yet.
      </p>
    </article>
  </section>
</template>
