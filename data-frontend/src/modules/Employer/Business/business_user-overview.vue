<script setup>
const props = defineProps({
  workspaceUserCount: {
    type: Number,
    default: 0,
  },
  employeeProfileCount: {
    type: Number,
    default: 0,
  },
  rows: {
    type: Array,
    default: () => [],
  },
  roleOptions: {
    type: Array,
    default: () => [],
  },
  search: {
    type: String,
    default: '',
  },
  roleFilter: {
    type: String,
    default: 'all',
  },
  statusFilter: {
    type: String,
    default: 'all',
  },
  summary: {
    type: String,
    default: '0 of 0 users',
  },
  formatDate: {
    type: Function,
    default: (value) => String(value || ''),
  },
})

const emit = defineEmits([
  'update:search',
  'update:role-filter',
  'update:status-filter',
  'create-user',
])
</script>

<template>
  <article class="business-user-management__panel business-user-management__panel--form">
    <div class="business-user-management__panel-head">
      <div>
        <p class="business-user-management__panel-label">Team Directory</p>
        <h3>Workspace users and employee profile progress</h3>
      </div>
      <span class="business-user-management__panel-chip">
        {{ workspaceUserCount }} workspace users · {{ employeeProfileCount }} employee profiles
      </span>
    </div>

    <div class="business-user-overview__toolbar">
      <label class="business-user-overview__field business-user-overview__field--search">
        <span>Search</span>
        <input
          :value="search"
          type="text"
          placeholder="Search by ID, name, or email..."
          @input="emit('update:search', $event.target.value)"
        />
      </label>

      <label class="business-user-overview__field">
        <span>Role</span>
        <select :value="roleFilter" @change="emit('update:role-filter', $event.target.value)">
          <option v-for="option in roleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="business-user-overview__field">
        <span>Status</span>
        <select :value="statusFilter" @change="emit('update:status-filter', $event.target.value)">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="on leave">On Leave</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>

      <button type="button" class="business-user-overview__action-btn business-user-overview__action-btn--primary" @click="emit('create-user')">
        <i class="bi bi-check-circle" aria-hidden="true" />
        Create User
      </button>

      <div class="business-user-overview__summary">
        {{ summary }}
      </div>
    </div>

    <div class="business-user-overview__table-shell">
      <div class="business-user-overview__table">
        <div class="business-user-overview__head">
          <span>#</span>
          <span>ID</span>
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span>Start Date</span>
          <span>Linked Member</span>
        </div>

        <TransitionGroup name="business-user-overview-row" tag="div" class="business-user-overview__body">
          <article
            v-for="(user, index) in rows"
            :key="`${user.id}-${user.email}-${index}`"
            class="business-user-overview__row"
          >
            <div>{{ index + 1 }}</div>
            <div class="business-user-overview__id">{{ user.id }}</div>

            <div class="business-user-overview__account">
              <div class="business-user-overview__avatar" :class="user.avatarClass">
                <img
                  v-if="user.avatarUrl"
                  :src="user.avatarUrl"
                  :alt="`${user.name} avatar`"
                  class="business-user-overview__avatar-image"
                >
                <template v-else>{{ user.initials }}</template>
              </div>

              <div class="business-user-overview__meta">
                <strong>{{ user.name }}</strong>
                <span>{{ user.email }}</span>
              </div>
            </div>

            <div class="business-user-overview__role">
              <strong>{{ user.role }}</strong>
              <span>{{ user.accessSummary }}</span>
            </div>
            <div>
              <span class="business-user-overview__status" :class="`is-${user.status.replace(/\\s+/g, '-')}`">{{ user.statusLabel }}</span>
            </div>
            <div>{{ formatDate(user.date) }}</div>
            <div class="business-user-overview__linked">
              <strong>{{ user.linkedState }}</strong>
              <span>{{ user.linkedMember }}</span>
            </div>
          </article>
        </TransitionGroup>
      </div>
    </div>

    <div v-if="!rows.length" class="business-user-overview__empty">
      No users match the current filter.
    </div>
  </article>
</template>

<style scoped>
.business-user-management__panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #d6ddd8;
  border-radius: 8px;
  background: #ffffff;
}

.business-user-management__panel--form {
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.business-user-management__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.85rem;
}

.business-user-management__panel-label {
  margin: 0;
  color: #4b5563;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.business-user-management__panel-head h3 {
  margin: 0.3rem 0 0;
  color: #111827;
  font-size: 1.05rem;
}

.business-user-management__panel-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.72rem;
  border-radius: 4px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.business-user-overview__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(10rem, 0.55fr)) auto auto;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid rgba(213, 226, 219, 0.92);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 249, 0.96) 100%);
}

.business-user-overview__field {
  display: grid;
  gap: 0.35rem;
}

.business-user-overview__field span {
  color: #557161;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-user-overview__field input,
.business-user-overview__field select {
  width: 100%;
  min-height: 2.7rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid #d8e3dc;
  border-radius: 0.85rem;
  background: #ffffff;
  color: #183126;
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.business-user-overview__field input:focus,
.business-user-overview__field select:focus {
  outline: none;
  border-color: #79b293;
  box-shadow: 0 0 0 3px rgba(46, 154, 98, 0.12);
}

.business-user-overview__action-btn {
  align-self: end;
  min-height: 2.7rem;
  padding: 0.72rem 1.12rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 16px;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.business-user-overview__action-btn i {
  font-size: 0.95rem;
  line-height: 1;
}

.business-user-overview__action-btn--primary {
  border: 1px solid #bfe0cf;
  background: linear-gradient(180deg, #f7fcf9 0%, #eef8f2 100%);
  color: #1f7a47;
  box-shadow: 0 12px 24px rgba(46, 154, 98, 0.1);
}

.business-user-overview__action-btn:hover {
  transform: translateY(-1px);
}

.business-user-overview__action-btn--primary:hover {
  border-color: #acd6c1;
  background: linear-gradient(180deg, #f9fdfb 0%, #e8f6ee 100%);
  box-shadow: 0 16px 28px rgba(46, 154, 98, 0.14);
}

.business-user-overview__action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
  box-shadow: none;
}

.business-user-overview__summary {
  align-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.7rem;
  padding: 0 0.9rem;
  border: 1px solid rgba(213, 226, 219, 0.92);
  border-radius: 0.95rem;
  background: #ffffff;
  color: #4e6c5c;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.business-user-overview__table-shell {
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid rgba(213, 226, 219, 0.92);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 249, 0.96) 100%);
}

.business-user-overview__table {
  display: grid;
  min-width: 1080px;
}

.business-user-overview__body {
  display: grid;
}

.business-user-overview__head,
.business-user-overview__row {
  display: grid;
  grid-template-columns: 4.5rem minmax(8rem, 0.9fr) minmax(16rem, 2fr) minmax(11rem, 1fr) minmax(8rem, 0.8fr) minmax(8rem, 0.8fr) minmax(12rem, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.95rem 1rem;
}

.business-user-overview__head {
  color: #709180;
  font-size: 0.78rem;
  font-weight: 800;
  border-bottom: 1px solid rgba(221, 231, 225, 0.92);
  background: rgba(248, 252, 249, 0.92);
}

.business-user-overview__row {
  color: #234334;
  font-size: 0.88rem;
  border-bottom: 1px solid rgba(235, 241, 237, 0.96);
  transition: background-color 0.22s ease, transform 0.22s ease, opacity 0.22s ease;
}

.business-user-overview__row:hover {
  background: rgba(247, 251, 249, 0.78);
}

.business-user-overview__row:last-child {
  border-bottom: 0;
}

.business-user-overview__id {
  color: #6b7f72;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.business-user-overview__account {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.business-user-overview__avatar {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.85rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  overflow: hidden;
}

.business-user-overview__avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.business-user-overview__avatar--linked {
  background: linear-gradient(135deg, #2c9a60 0%, #67c98b 100%);
}

.business-user-overview__avatar--ready {
  background: linear-gradient(135deg, #3574b8 0%, #67a5e4 100%);
}

.business-user-overview__meta,
.business-user-overview__role,
.business-user-overview__linked {
  display: grid;
  gap: 0.14rem;
  min-width: 0;
}

.business-user-overview__meta strong,
.business-user-overview__meta span,
.business-user-overview__role strong,
.business-user-overview__role span,
.business-user-overview__linked strong,
.business-user-overview__linked span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.business-user-overview__meta strong,
.business-user-overview__role strong,
.business-user-overview__linked strong {
  color: #173026;
  font-size: 0.95rem;
}

.business-user-overview__meta span,
.business-user-overview__role span,
.business-user-overview__linked span {
  color: #728578;
  font-size: 0.8rem;
}

.business-user-overview__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.business-user-overview__status.is-active {
  background: #edf9f1;
  color: #1f7a47;
}

.business-user-overview__status.is-on-leave {
  background: #fff6e7;
  color: #b07219;
}

.business-user-overview__status.is-disabled {
  background: #fff0f0;
  color: #b33838;
}

.business-user-overview__empty {
  padding: 1rem;
  border: 1px dashed rgba(213, 226, 219, 0.92);
  border-radius: 1rem;
  color: #708579;
  text-align: center;
}

.business-user-overview-row-enter-active,
.business-user-overview-row-leave-active {
  transition: all 0.22s ease;
}

.business-user-overview-row-enter-from,
.business-user-overview-row-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.business-user-overview-row-move {
  transition: transform 0.22s ease;
}

@media (max-width: 1080px) {
  .business-user-overview__toolbar {
    grid-template-columns: 1fr;
  }

  .business-user-overview__summary {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .business-user-management__panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .business-user-overview__table-shell {
    overflow-x: auto;
  }
}
</style>
