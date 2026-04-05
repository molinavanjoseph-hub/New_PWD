<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { computed, ref } from 'vue'
import AdminAllUsersCsv from '@/modules/Admin/admin-allusers-csv.vue'

const emit = defineEmits(['open-user'])

const props = defineProps({
  applicants: {
    type: Array,
    default: () => [],
  },
  employees: {
    type: Array,
    default: () => [],
  },
})

const search = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')

const normalizeStatusValue = (value) => String(value || '').trim().toLowerCase()

const formatDisplayDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const buildInitials = (value, fallback = 'US') => {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return fallback
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

const formatUserId = (value) => {
  const normalized = String(value || '').trim()
  if (normalized) return normalized
  return 'Pending ID'
}

const normalizedUsers = computed(() => {
  const applicantRows = (Array.isArray(props.applicants) ? props.applicants : []).map((record) => ({
    id: String(record?.id || '').trim(),
    accountId: formatUserId(record?.public_id || record?.user?.public_id),
    name: String(
      `${record?.first_name || ''} ${record?.last_name || ''}`.trim()
      || record?.name
      || record?.user?.name
      || 'Applicant',
    ).trim(),
    email: String(record?.email || record?.user?.email || 'No email').trim() || 'No email',
    role: 'applicant',
    status: normalizeStatusValue(record?.approval_status) || 'pending',
    date: record?.created_at || record?.submitted_at || '',
    avatarClass: 'admin-all-user__avatar--applicant',
    initials: buildInitials(
      `${record?.first_name || ''} ${record?.last_name || ''}`.trim()
      || record?.name
      || record?.user?.name,
      'AP',
    ),
  }))

  const employeeRows = (Array.isArray(props.employees) ? props.employees : []).map((record) => ({
    id: String(record?.id || '').trim(),
    accountId: formatUserId(record?.public_id || record?.user?.public_id),
    name: String(record?.company_name || record?.name || record?.user?.name || 'Employer').trim(),
    email: String(record?.email || record?.user?.email || 'No email').trim() || 'No email',
    role: 'employer',
    status: normalizeStatusValue(record?.approval_status) || 'pending',
    date: record?.created_at || '',
    avatarClass: 'admin-all-user__avatar--employer',
    initials: buildInitials(record?.company_name || record?.name || record?.user?.name, 'EM'),
  }))

  return [...applicantRows, ...employeeRows].sort((left, right) => {
    const leftTime = Date.parse(left.date || '') || 0
    const rightTime = Date.parse(right.date || '') || 0
    return rightTime - leftTime
  })
})

const filteredUsers = computed(() => {
  const normalizedSearch = String(search.value || '').trim().toLowerCase()
  const normalizedRole = String(roleFilter.value || 'all').trim().toLowerCase()
  const normalizedStatus = String(statusFilter.value || 'all').trim().toLowerCase()

  return normalizedUsers.value.filter((record) => {
    const matchesSearch = !normalizedSearch || [
      record.accountId,
      record.name,
      record.email,
      record.role,
      record.status,
    ]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(normalizedSearch))

    const matchesRole = normalizedRole === 'all' || record.role === normalizedRole
    const matchesStatus = normalizedStatus === 'all' || record.status === normalizedStatus
    return matchesSearch && matchesRole && matchesStatus
  })
})

const filterSummary = computed(() => {
  const total = normalizedUsers.value.length
  const visible = filteredUsers.value.length
  return `${visible} of ${total} users`
})
</script>

<template>
  <section class="admin-all-user">
    <div class="admin-all-user__toolbar">
      <label class="admin-all-user__field admin-all-user__field--search">
        <span>Search</span>
        <input v-model.trim="search" type="text" placeholder="Search by ID, name, or email..." />
      </label>

      <label class="admin-all-user__field">
        <span>Role</span>
        <select v-model="roleFilter">
          <option value="all">All</option>
          <option value="applicant">Applicant</option>
          <option value="employer">Employer</option>
        </select>
      </label>

      <label class="admin-all-user__field">
        <span>Status</span>
        <select v-model="statusFilter">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>

      <AdminAllUsersCsv
        :users="filteredUsers"
        :filter-summary="filterSummary"
        :format-date="formatDisplayDate"
      />

      <div class="admin-all-user__summary">
        {{ filterSummary }}
      </div>
    </div>

    <div class="admin-all-user__table-shell">
      <div class="admin-all-user__table">
        <div class="admin-all-user__head">
          <span>#</span>
          <span>ID</span>
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span>Date</span>
          <span>Actions</span>
        </div>

        <TransitionGroup name="admin-all-user-row" tag="div" class="admin-all-user__body">
          <article
            v-for="(user, index) in filteredUsers"
            :key="user.id || `${user.role}-${user.email}-${index}`"
            class="admin-all-user__row"
          >
            <div>{{ index + 1 }}</div>
            <div class="admin-all-user__id">{{ user.accountId }}</div>

            <div class="admin-all-user__account">
              <div class="admin-all-user__avatar" :class="user.avatarClass">
                {{ user.initials }}
              </div>

              <div class="admin-all-user__meta">
                <strong>{{ user.name }}</strong>
                <span>{{ user.email }}</span>
              </div>
            </div>

            <div class="admin-all-user__role">{{ user.role }}</div>
            <div>
              <span class="admin-all-user__status" :class="`is-${user.status}`">{{ user.status }}</span>
            </div>
            <div>{{ formatDisplayDate(user.date) }}</div>
            <div class="admin-all-user__actions">
              <button type="button" class="admin-all-user__action-btn" title="Disable" aria-label="Disable" @click="emit('open-user', { ...user, action: 'disable' })">
                <i class="bi bi-slash-circle" aria-hidden="true" />
              </button>
              <button type="button" class="admin-all-user__action-btn admin-all-user__action-btn--danger" title="Delete" aria-label="Delete" @click="emit('open-user', { ...user, action: 'delete' })">
                <i class="bi bi-trash" aria-hidden="true" />
              </button>
            </div>
          </article>
        </TransitionGroup>
      </div>
    </div>

    <div v-if="!filteredUsers.length" class="admin-all-user__empty">
      No users match the current filter.
    </div>
  </section>
</template>

<style scoped>
.admin-all-user { display: grid; gap: 1rem; }
.admin-all-user__toolbar { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(10rem, 0.55fr)) auto auto; gap: 0.8rem; padding: 1rem; border: 1px solid rgba(213, 226, 219, 0.92); border-radius: 1.2rem; background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 249, 0.96) 100%); }
.admin-all-user__field { display: grid; gap: 0.35rem; }
.admin-all-user__field span { color: #557161; font-size: 0.74rem; font-weight: 700; }
.admin-all-user__field input, .admin-all-user__field select { width: 100%; min-height: 2.7rem; padding: 0.65rem 0.85rem; border: 1px solid #d8e3dc; border-radius: 0.85rem; background: #ffffff; color: #183126; font: inherit; }
.admin-all-user__field input, .admin-all-user__field select { transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
.admin-all-user__field input:focus, .admin-all-user__field select:focus { outline: none; border-color: #79b293; box-shadow: 0 0 0 3px rgba(46, 154, 98, 0.12); }
.admin-all-user__summary { align-self: end; display: inline-flex; align-items: center; justify-content: center; min-height: 2.7rem; padding: 0 0.9rem; border: 1px solid rgba(213, 226, 219, 0.92); border-radius: 0.95rem; background: #ffffff; color: #4e6c5c; font-size: 0.78rem; font-weight: 800; white-space: nowrap; }
.admin-all-user__table-shell { overflow-x: auto; overflow-y: hidden; border: 1px solid rgba(213, 226, 219, 0.92); border-radius: 1.2rem; background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 249, 0.96) 100%); }
.admin-all-user__table { display: grid; min-width: 980px; }
.admin-all-user__body { display: grid; }
.admin-all-user__head, .admin-all-user__row { display: grid; grid-template-columns: 4.5rem minmax(8rem, 0.9fr) minmax(16rem, 2fr) minmax(8rem, 0.8fr) minmax(8rem, 0.8fr) minmax(8rem, 0.8fr) minmax(9rem, 0.95fr); align-items: center; gap: 1rem; padding: 0.95rem 1rem; }
.admin-all-user__head { color: #709180; font-size: 0.78rem; font-weight: 800; border-bottom: 1px solid rgba(221, 231, 225, 0.92); background: rgba(248, 252, 249, 0.92); }
.admin-all-user__row { color: #234334; font-size: 0.88rem; border-bottom: 1px solid rgba(235, 241, 237, 0.96); transition: background-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease; }
.admin-all-user__row:hover { background: rgba(247, 251, 249, 0.78); }
.admin-all-user__row:last-child { border-bottom: 0; }
.admin-all-user__id { color: #6b7f72; font-size: 0.78rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-all-user__account { display: flex; align-items: center; gap: 0.8rem; min-width: 0; }
.admin-all-user__avatar { width: 2.35rem; height: 2.35rem; border-radius: 0.85rem; display: grid; place-items: center; flex-shrink: 0; color: #fff; font-size: 0.82rem; font-weight: 800; }
.admin-all-user__avatar--applicant { background: linear-gradient(135deg, #2c9a60 0%, #67c98b 100%); }
.admin-all-user__avatar--employer { background: linear-gradient(135deg, #3574b8 0%, #67a5e4 100%); }
.admin-all-user__meta { display: grid; gap: 0.14rem; min-width: 0; }
.admin-all-user__meta strong, .admin-all-user__meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-all-user__meta strong { color: #173026; font-size: 0.95rem; }
.admin-all-user__meta span { color: #728578; font-size: 0.8rem; }
.admin-all-user__role { text-transform: capitalize; }
.admin-all-user__status { display: inline-flex; align-items: center; justify-content: center; min-height: 2rem; padding: 0 0.7rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
.admin-all-user__status.is-approved { background: #edf9f1; color: #1f7a47; }
.admin-all-user__status.is-pending { background: #fff6e7; color: #b07219; }
.admin-all-user__status.is-rejected { background: #fff0f0; color: #b33838; }
.admin-all-user__actions { display: flex; align-items: center; justify-content: flex-start; gap: 0.28rem; }
.admin-all-user__action-btn { width: 2.2rem; height: 2.2rem; border: 0; border-radius: 0.45rem; display: grid; place-items: center; background: transparent; color: #8a978f; cursor: pointer; transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease; }
.admin-all-user__action-btn i { font-size: 1rem; }
.admin-all-user__action-btn:hover { transform: none; background: rgba(235, 247, 240, 0.98); color: #2d684d; }
.admin-all-user__action-btn--danger:hover { background: rgba(252, 239, 239, 0.98); color: #a54545; }
.admin-all-user__empty { padding: 1rem; border: 1px dashed rgba(213, 226, 219, 0.92); border-radius: 1rem; color: #708579; text-align: center; }
.admin-all-user-row-enter-active, .admin-all-user-row-leave-active { transition: all 0.22s ease; }
.admin-all-user-row-enter-from, .admin-all-user-row-leave-to { opacity: 0; transform: translateY(8px); }
.admin-all-user-row-move { transition: transform 0.22s ease; }
@media (max-width: 980px) {
  .admin-all-user__toolbar { grid-template-columns: 1fr; }
  .admin-all-user__head, .admin-all-user__row { grid-template-columns: 3rem minmax(7rem, 0.9fr) minmax(12rem, 1.8fr) minmax(7rem, 0.9fr) minmax(7rem, 0.9fr) minmax(7rem, 0.9fr) minmax(8rem, 0.9fr); }
  .admin-all-user__summary { justify-content: flex-start; }
}

@media (max-width: 768px) {
  .admin-all-user__toolbar { padding: 0.92rem; }
  .admin-all-user__summary { width: 100%; }
}

@media (max-width: 640px) {
  .admin-all-user { gap: 0.85rem; }
  .admin-all-user__toolbar { gap: 0.68rem; padding: 0.85rem; }
  .admin-all-user__summary { min-height: 2.5rem; padding: 0 0.82rem; }
  .admin-all-user__field input,
  .admin-all-user__field select { min-height: 2.55rem; padding: 0.58rem 0.78rem; }
}
</style>
