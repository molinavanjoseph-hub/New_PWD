<script setup>
defineProps({
  logoSrc: {
    type: String,
    default: '',
  },
  wordmarkSrc: {
    type: String,
    default: '',
  },
  primaryItems: {
    type: Array,
    default: () => [],
  },
  userManagementItems: {
    type: Array,
    default: () => [],
  },
  paymentManagementItems: {
    type: Array,
    default: () => [],
  },
  storageManagementItems: {
    type: Array,
    default: () => [],
  },
  secondaryItems: {
    type: Array,
    default: () => [],
  },
  activeView: {
    type: String,
    default: 'dashboard',
  },
  userManagementOpen: {
    type: Boolean,
    default: false,
  },
  paymentManagementOpen: {
    type: Boolean,
    default: false,
  },
  storageManagementOpen: {
    type: Boolean,
    default: false,
  },
  profileName: {
    type: String,
    default: 'Admin User',
  },
  profileEmail: {
    type: String,
    default: 'admin@gmail.com',
  },
  profileInitials: {
    type: String,
    default: 'AU',
  },
})

defineEmits(['set-view', 'open-setting', 'toggle-user-management', 'toggle-payment-management', 'toggle-storage-management'])
</script>

<template>
  <aside class="admin-sidebar" aria-label="Admin sidebar">
    <div class="admin-brand-row">
      <div class="admin-brand">
        <span class="admin-brand__mark">
          <img :src="logoSrc" alt="PWD logo" class="admin-brand__mark-image" />
        </span>
        <span class="admin-brand__copy">
          <img :src="wordmarkSrc" alt="PWD Jobs" class="admin-brand__wordmark" />
          <small class="admin-brand__subtext">Admin Operations</small>
        </span>
      </div>
    </div>

    <div class="admin-section-label admin-section-label--headline">Workspace</div>

    <nav class="admin-link-group" aria-label="Main navigation">
      <button
        v-for="item in primaryItems"
        :key="item.key || item.label"
        class="admin-nav-button"
        :class="{ 'is-active': activeView === (item.key || 'dashboard') }"
        type="button"
        @click="$emit('set-view', item.key || 'dashboard')"
      >
        <span class="admin-nav-button__left">
          <i :class="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </span>
      </button>

      <div class="admin-dropdown-group">
        <button
          class="admin-nav-button admin-nav-button--dropdown"
          :class="{ 'is-active-soft': userManagementItems.some((item) => item.key === activeView) }"
          type="button"
          :aria-expanded="userManagementOpen ? 'true' : 'false'"
          @click="$emit('toggle-user-management')"
        >
          <span class="admin-nav-button__left">
            <i class="bi bi-people-fill" aria-hidden="true" />
            <span>User Management</span>
          </span>
          <span class="admin-nav-button__chevron" :class="{ 'is-open': userManagementOpen }">
            <i class="bi bi-chevron-down" aria-hidden="true" />
          </span>
        </button>

        <Transition name="admin-submenu-collapse">
          <div v-if="userManagementOpen" class="admin-submenu" aria-label="User management submenu">
            <button
              v-for="item in userManagementItems"
              :key="item.label"
              class="admin-submenu__item"
              :class="{ 'is-active': activeView === item.key }"
              type="button"
              @click="$emit('set-view', item.key)"
            >
              <span class="admin-nav-button__left">
                <i :class="item.icon" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <div class="admin-dropdown-group">
        <button
          class="admin-nav-button admin-nav-button--dropdown"
          :class="{ 'is-active-soft': paymentManagementItems.some((item) => item.key === activeView) }"
          type="button"
          :aria-expanded="paymentManagementOpen ? 'true' : 'false'"
          @click="$emit('toggle-payment-management')"
        >
          <span class="admin-nav-button__left">
            <i class="bi bi-wallet2" aria-hidden="true" />
            <span>Subscription Management</span>
          </span>
          <span class="admin-nav-button__chevron" :class="{ 'is-open': paymentManagementOpen }">
            <i class="bi bi-chevron-down" aria-hidden="true" />
          </span>
        </button>

        <Transition name="admin-submenu-collapse">
          <div v-if="paymentManagementOpen" class="admin-submenu" aria-label="Payment management submenu">
            <button
              v-for="item in paymentManagementItems"
              :key="item.label"
              class="admin-submenu__item"
              :class="{ 'is-active': activeView === item.key }"
              type="button"
              @click="$emit('set-view', item.key)"
            >
              <span class="admin-nav-button__left">
                <i :class="item.icon" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <div class="admin-dropdown-group">
        <button
          class="admin-nav-button admin-nav-button--dropdown"
          :class="{ 'is-active-soft': storageManagementItems.some((item) => item.key === activeView) }"
          type="button"
          :aria-expanded="storageManagementOpen ? 'true' : 'false'"
          @click="$emit('toggle-storage-management')"
        >
          <span class="admin-nav-button__left">
            <i class="bi bi-hdd-network" aria-hidden="true" />
            <span>Storage Management</span>
          </span>
          <span class="admin-nav-button__chevron" :class="{ 'is-open': storageManagementOpen }">
            <i class="bi bi-chevron-down" aria-hidden="true" />
          </span>
        </button>

        <Transition name="admin-submenu-collapse">
          <div v-if="storageManagementOpen" class="admin-submenu" aria-label="Storage management submenu">
            <button
              v-for="item in storageManagementItems"
              :key="item.label"
              class="admin-submenu__item"
              :class="{ 'is-active': activeView === item.key }"
              type="button"
              @click="$emit('set-view', item.key)"
            >
              <span class="admin-nav-button__left">
                <i :class="item.icon" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </Transition>
      </div>
    </nav>

    <div class="admin-sidebar__spacer" />

    <div v-if="secondaryItems.length" class="admin-sidebar__secondary">
      <div class="admin-section-label">Quick Access</div>
      <div class="admin-link-group admin-link-group--secondary">
        <button
          v-for="item in secondaryItems"
          :key="item.key || item.label"
          class="admin-nav-button admin-nav-button--secondary"
          :class="{ 'is-active': item.key === 'logs' && activeView === 'logs' }"
          type="button"
          @click="item.key === 'settings' ? $emit('open-setting') : $emit('set-view', item.key || 'dashboard')"
        >
          <span class="admin-nav-button__left">
            <i :class="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </span>
        </button>
      </div>
    </div>

    <section class="admin-sidebar-profile" aria-label="Sidebar profile">
      <div class="admin-sidebar-profile__avatar">{{ profileInitials }}</div>
      <div class="admin-sidebar-profile__meta">
        <strong>{{ profileName }}</strong>
        <span>{{ profileEmail }}</span>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.admin-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.68rem;
  padding: 0.92rem 0.62rem 0.68rem;
  background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
  border-right: 1px solid rgba(218, 224, 233, 0.9);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  transition: padding 0.22s ease, gap 0.22s ease;
}

.admin-brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  padding: 0.1rem 0.2rem 0.2rem;
}

.admin-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.admin-brand__mark {
  width: 3.2rem;
  height: 3.2rem;
  display: grid;
  place-items: center;
}

.admin-brand__mark-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.admin-brand__copy {
  min-width: 0;
  display: grid;
  gap: 0.14rem;
}

.admin-brand__wordmark {
  width: auto;
  height: 1.45rem;
  object-fit: contain;
  object-position: left center;
}

.admin-brand__subtext {
  color: #7f8898;
  font-size: 0.74rem;
  font-weight: 600;
}

.admin-link-group {
  display: grid;
  gap: 0.22rem;
  padding: 0.08rem 0;
}

.admin-section-label {
  padding: 0.08rem 0.5rem 0.2rem;
  color: #8a94a6;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-section-label--headline {
  padding-top: 0;
}

.admin-nav-button {
  min-height: 2.28rem;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 0.9rem;
  padding: 0.56rem 0.66rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.58rem;
  background: transparent;
  color: #374151;
  font-size: 0.87rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    color 0.24s ease,
    transform 0.24s ease;
}

.admin-nav-button:hover {
  background: rgba(241, 245, 249, 0.96);
  box-shadow: none;
  transform: translateX(2px);
}

.admin-nav-button.is-active {
  border-color: rgba(88, 167, 126, 0.2);
  background: linear-gradient(135deg, rgba(233, 246, 238, 0.98) 0%, rgba(245, 252, 248, 0.98) 100%);
  box-shadow: 0 8px 18px rgba(62, 125, 88, 0.08);
  color: #2f6a49;
  transform: translateX(0);
}

.admin-nav-button.is-active .admin-nav-button__left i,
.admin-nav-button.is-active .admin-nav-button__left span {
  color: #2f6a49;
}

.admin-nav-button.is-active-soft {
  background: rgba(245, 247, 250, 0.96);
  color: #2d3748;
}

.admin-nav-button.is-active-soft .admin-nav-button__left i,
.admin-nav-button.is-active-soft .admin-nav-button__left span,
.admin-nav-button.is-active-soft .admin-nav-button__chevron {
  color: #2d3748;
}

.admin-nav-button--dropdown {
  width: 100%;
  padding-left: 0.62rem;
  padding-right: 0.58rem;
  font-size: 0.82rem;
}

.admin-nav-button__left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.56rem;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.admin-nav-button__left span {
  min-width: 0;
  flex: 1 1 auto;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-nav-button__left i {
  font-size: 0.88rem;
  color: #6b7280;
  flex: 0 0 auto;
}

.admin-nav-button__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  color: #9aa3b2;
  flex: 0 0 auto;
  transition: transform 0.2s ease;
}

.admin-nav-button__chevron.is-open {
  transform: rotate(180deg);
}

.admin-dropdown-group {
  display: grid;
  gap: 0.14rem;
  width: 100%;
}

.admin-submenu {
  display: grid;
  gap: 0.12rem;
  padding-top: 0.08rem;
  padding-left: 0;
  margin-left: 0;
  border-left: 0;
  transform-origin: top;
  overflow: hidden;
}

.admin-submenu__item {
  min-height: 2.08rem;
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 0.76rem;
  padding: 0.48rem 0.62rem 0.48rem 1.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  color: #4b5563;
  font-size: 0.83rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color 0.24s ease,
    color 0.24s ease,
    transform 0.24s ease,
    box-shadow 0.24s ease;
  box-shadow: none;
}

.admin-submenu__item:hover {
  background: rgba(241, 245, 249, 0.96);
  color: #1f2937;
  transform: translateX(2px);
  box-shadow: none;
}

.admin-submenu__item.is-active {
  background: linear-gradient(135deg, rgba(233, 246, 238, 0.98) 0%, rgba(245, 252, 248, 0.98) 100%);
  color: #2f6a49;
  box-shadow: none;
}

.admin-submenu__item.is-active .admin-nav-button__left i,
.admin-submenu__item.is-active .admin-nav-button__left span {
  color: #2f6a49;
}

.admin-submenu__item .admin-nav-button__left i {
  font-size: 0.82rem;
}

.admin-submenu__item:hover .admin-nav-button__left i,
.admin-submenu__item:hover .admin-nav-button__left span {
  color: #273246;
}

.admin-sidebar__spacer {
  flex: 1 1 auto;
  min-height: 1.25rem;
}

.admin-sidebar__secondary {
  display: grid;
  gap: 0.16rem;
}

.admin-link-group--secondary {
  gap: 0.18rem;
}

.admin-nav-button--secondary {
  min-height: 2.18rem;
}

.admin-sidebar-profile {
  display: flex;
  align-items: center;
  gap: 0.58rem;
  margin-top: 0;
  padding: 0.8rem 0.5rem 0.12rem;
  border-top: 1px solid rgba(223, 227, 234, 0.92);
}

.admin-sidebar-profile__avatar {
  width: 2.2rem;
  height: 2.2rem;
  min-width: 2.2rem;
  min-height: 2.2rem;
  aspect-ratio: 1 / 1;
  border-radius: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #2d3952 0%, #5a74b0 100%);
  color: #fff;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 12px 22px rgba(45, 57, 82, 0.18);
}

.admin-sidebar-profile__meta {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.admin-sidebar-profile__meta strong {
  color: #214133;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.admin-sidebar-profile__meta span {
  color: #759081;
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-submenu-collapse-enter-active,
.admin-submenu-collapse-leave-active {
  transition:
    max-height 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.22s ease,
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    margin-top 0.26s ease,
    padding-top 0.26s ease,
    padding-bottom 0.26s ease;
  max-height: 18rem;
}

.admin-submenu-collapse-enter-from,
.admin-submenu-collapse-leave-to {
  opacity: 0;
  transform: translateY(-6px) scaleY(0.96);
  max-height: 0;
}

@media (max-width: 1120px) {
  .admin-sidebar {
    padding-inline: 0.56rem;
  }
}

@media (max-width: 900px) {
  .admin-sidebar {
    position: static;
    height: auto;
    overflow-y: visible;
    min-height: auto;
    border-right: 0;
  }
}

@media (max-width: 768px) {
  .admin-sidebar {
    gap: 0.6rem;
    padding: 0.84rem 0.56rem 0.62rem;
  }

  .admin-brand-row {
    padding-inline: 0.08rem;
  }

  .admin-brand {
    gap: 0.74rem;
  }

  .admin-brand__subtext {
    display: none;
  }

  .admin-nav-button,
  .admin-submenu__item {
    min-height: 2.18rem;
    font-size: 0.84rem;
  }
}

@media (max-width: 640px) {
  .admin-sidebar {
    gap: 0.56rem;
    padding: 0.82rem 0.58rem 0.62rem;
  }

  .admin-brand-row {
    gap: 0.5rem;
    padding: 0.08rem 0.08rem 0.14rem;
  }

  .admin-brand {
    gap: 0.62rem;
  }

  .admin-brand__mark {
    width: 2.55rem;
    height: 2.55rem;
  }

  .admin-brand__wordmark {
    height: 1.18rem;
  }

  .admin-brand__subtext {
    font-size: 0.68rem;
  }

  .admin-nav-button,
  .admin-submenu__item {
    min-height: 2.2rem;
  }
}
</style>
