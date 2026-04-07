<script setup>
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'

defineEmits(['toggle-profile', 'logout', 'toggle-notifications', 'open-notification', 'open-setting'])

const props = defineProps({
  title: {
    type: String,
    default: 'Dashboard',
  },
  breadcrumbParent: {
    type: String,
    default: 'Dashboard',
  },
  breadcrumbCurrent: {
    type: String,
    default: 'Dashboard',
  },
  subtitle: {
    type: String,
    default: 'Admin workspace',
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
  profileMenuOpen: {
    type: Boolean,
    default: false,
  },
  settingsItems: {
    type: Array,
    default: () => [],
  },
  notifications: {
    type: Array,
    default: () => [],
  },
  notificationCount: {
    type: Number,
    default: 0,
  },
  notificationMenuOpen: {
    type: Boolean,
    default: false,
  },
})

const formatNotificationBadge = (value) => {
  const count = Number(value) || 0
  return count > 99 ? '99+' : String(count)
}

const formatNotificationTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const showBreadcrumbParent = () =>
  props.breadcrumbParent
  && props.breadcrumbCurrent
  && props.breadcrumbParent !== props.breadcrumbCurrent
  && props.breadcrumbParent !== 'Dashboard'
</script>

<template>
  <header class="admin-navbar">
    <div class="admin-navbar__left">
      <div class="admin-navbar__breadcrumb" aria-label="Breadcrumb">
        <span class="admin-navbar__breadcrumb-home">
          <i class="bi bi-house-door" aria-hidden="true" />
        </span>
        <i class="bi bi-chevron-right admin-navbar__breadcrumb-separator" aria-hidden="true" />
        <Transition name="admin-navbar-breadcrumb" mode="out-in">
          <span :key="`${breadcrumbParent}-${breadcrumbCurrent}`" class="admin-navbar__breadcrumb-trail">
            <template v-if="showBreadcrumbParent()">
              <span class="admin-navbar__breadcrumb-parent">
                {{ breadcrumbParent }}
              </span>
              <i class="bi bi-chevron-right admin-navbar__breadcrumb-separator" aria-hidden="true" />
            </template>
            <span class="admin-navbar__breadcrumb-current">{{ breadcrumbCurrent }}</span>
          </span>
        </Transition>
      </div>
    </div>

    <div class="admin-navbar__actions">
      <div class="admin-navbar__notification-wrap">
        <button
          class="admin-navbar__tool admin-navbar__tool--notification"
          type="button"
          aria-label="Notifications"
          :aria-expanded="notificationMenuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          @click.stop="$emit('toggle-notifications')"
        >
          <i class="bi bi-bell" aria-hidden="true" />
          <span v-if="notificationCount > 0" class="admin-navbar__icon-badge">
            {{ formatNotificationBadge(notificationCount) }}
          </span>
        </button>

        <div
          v-if="notificationMenuOpen"
          class="admin-navbar__notification-panel"
          role="menu"
          aria-label="Admin notifications"
        >
          <div class="admin-navbar__notification-head">
            <div>
              <strong>Notifications</strong>
              <span>Live applicant activity</span>
            </div>

            <span v-if="notificationCount > 0" class="admin-navbar__notification-pill">
              {{ formatNotificationBadge(notificationCount) }} new
            </span>
          </div>

          <div v-if="props.notifications.length" class="admin-navbar__notification-list">
            <button
              v-for="notification in props.notifications"
              :key="notification.id"
              class="admin-navbar__notification-item"
              :class="{ 'is-unread': !notification.read }"
              type="button"
              role="menuitem"
              @click.stop="$emit('open-notification', notification.id)"
            >
              <span class="admin-navbar__notification-dot" :class="{ 'is-unread': !notification.read }" aria-hidden="true" />

              <div class="admin-navbar__notification-copy">
                <strong>{{ notification.title }}</strong>
                <span>{{ notification.message }}</span>
                <small>{{ formatNotificationTime(notification.createdAt) }}</small>
              </div>
            </button>
          </div>

          <div v-else class="admin-navbar__notification-empty">
            Waiting for new applicant accounts.
          </div>
        </div>
      </div>

      <div class="admin-user-menu admin-navbar__profile-wrap">
        <button
          class="admin-navbar__profile"
          type="button"
          :aria-expanded="profileMenuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          aria-label="Admin profile"
          @click.stop="$emit('toggle-profile')"
        >
          <div class="admin-navbar__avatar">{{ profileInitials }}</div>
        </button>

        <div v-if="profileMenuOpen" class="admin-navbar__dropdown" role="menu" aria-label="Profile menu">
          <button
            v-for="item in settingsItems"
            :key="item.label"
            class="admin-navbar__dropdown-item"
            type="button"
            role="menuitem"
            @click="$emit('open-setting', item.label)"
          >
            <i :class="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
          <button class="admin-navbar__dropdown-item" type="button" role="menuitem" @click="$emit('logout')">
            <i class="bi bi-box-arrow-right" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.admin-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3.4rem;
  padding: 0.55rem 0.1rem 0.9rem;
  border-bottom: 1px solid rgba(223, 227, 234, 0.92);
  background: #ffffff;
  font-family: "Inter", "Segoe UI", sans-serif;
  position: relative;
  z-index: 100;
  overflow: visible;
}

.admin-navbar__left {
  min-width: 0;
  flex: 1;
}

.admin-navbar__breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
  color: #8a93a5;
  font-size: 0.78rem;
  font-weight: 600;
}

.admin-navbar__breadcrumb-trail {
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
  min-width: 0;
}

.admin-navbar__breadcrumb-home {
  width: 1.45rem;
  height: 1.45rem;
  display: grid;
  place-items: center;
  border-radius: 0.45rem;
  color: #6b7280;
  background: transparent;
}

.admin-navbar__breadcrumb-separator {
  font-size: 0.62rem;
  color: #a0a8b8;
}

.admin-navbar__breadcrumb-current {
  color: #1f2937;
  font-weight: 700;
}

.admin-navbar__breadcrumb-parent {
  color: #6f7a8d;
  font-weight: 600;
}

.admin-navbar-breadcrumb-enter-active,
.admin-navbar-breadcrumb-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.admin-navbar-breadcrumb-enter-from,
.admin-navbar-breadcrumb-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.admin-navbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  position: relative;
  overflow: visible;
  padding: 0.24rem 0.28rem 0.24rem 0.55rem;
  border: 1px solid rgba(223, 227, 234, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

.admin-navbar__profile-wrap {
  position: relative;
  z-index: 110;
  isolation: isolate;
}

.admin-navbar__notification-wrap {
  position: relative;
  z-index: 110;
  isolation: isolate;
}

.admin-navbar__tool {
  width: 2.1rem;
  height: 2.1rem;
  border: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    background-color 0.22s ease,
    box-shadow 0.22s ease,
    color 0.22s ease;
}

.admin-navbar__tool:hover {
  color: #1f2937;
  background: rgba(240, 247, 243, 0.95);
  box-shadow: inset 0 0 0 1px rgba(128, 177, 149, 0.18);
}

.admin-navbar__tool--notification {
  position: relative;
}

.admin-navbar__tool i {
  font-size: 0.95rem;
  line-height: 1;
}

.admin-navbar__icon-badge {
  position: absolute;
  top: -0.08rem;
  right: -0.08rem;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.28rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #d95b5b;
  color: #fff;
  font-size: 0.58rem;
  font-weight: 700;
  box-shadow: 0 8px 14px rgba(217, 91, 91, 0.22);
}

.admin-navbar__profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  margin-left: 0.08rem;
  padding: 0.08rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.22s ease;
}

.admin-navbar__profile:hover {
  background: rgba(240, 247, 243, 0.95);
}

.admin-navbar__avatar {
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

.admin-navbar__dropdown {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  min-width: 10rem;
  padding: 0.38rem;
  border: 1px solid rgba(164, 171, 188, 0.36);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 30px rgba(96, 108, 128, 0.16);
  backdrop-filter: blur(12px);
  z-index: 115;
}

.admin-navbar__dropdown-item {
  width: 100%;
  min-height: 2.5rem;
  border: 0;
  border-radius: 0.65rem;
  padding: 0.7rem 0.78rem;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  background: transparent;
  color: #374153;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}

.admin-navbar__notification-panel {
  position: absolute;
  top: calc(100% + 0.65rem);
  right: 0;
  width: min(24rem, calc(100vw - 2rem));
  padding: 0.55rem;
  border: 1px solid rgba(164, 171, 188, 0.36);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 30px rgba(96, 108, 128, 0.16);
  backdrop-filter: blur(12px);
  z-index: 115;
}

.admin-navbar__notification-head {
  padding: 0.45rem 0.55rem 0.7rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.admin-navbar__notification-head strong {
  display: block;
  color: #2f3b51;
  font-size: 0.92rem;
  font-weight: 700;
}

.admin-navbar__notification-head span {
  color: #7b879a;
  font-size: 0.75rem;
}

.admin-navbar__notification-pill {
  flex-shrink: 0;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: rgba(217, 91, 91, 0.1);
  color: #b24949;
  font-size: 0.7rem;
  font-weight: 700;
}

.admin-navbar__notification-list {
  display: grid;
  gap: 0.28rem;
}

.admin-navbar__notification-item {
  width: 100%;
  border: 0;
  border-radius: 0.8rem;
  padding: 0.72rem 0.75rem;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: flex-start;
  gap: 0.7rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.admin-navbar__notification-item:hover {
  transform: translateY(-1px);
  background: #f2f5fb;
}

.admin-navbar__notification-item.is-unread {
  background: rgba(223, 239, 252, 0.55);
}

.admin-navbar__notification-dot {
  width: 0.55rem;
  height: 0.55rem;
  margin-top: 0.4rem;
  border-radius: 999px;
  background: rgba(122, 137, 160, 0.38);
}

.admin-navbar__notification-dot.is-unread {
  background: #2c8a62;
  box-shadow: 0 0 0 5px rgba(44, 138, 98, 0.12);
}

.admin-navbar__notification-copy {
  display: grid;
  gap: 0.18rem;
}

.admin-navbar__notification-copy strong {
  color: #2f3b51;
  font-size: 0.84rem;
  font-weight: 700;
}

.admin-navbar__notification-copy span {
  color: #58657c;
  font-size: 0.78rem;
  line-height: 1.45;
}

.admin-navbar__notification-copy small {
  color: #8a93a5;
  font-size: 0.7rem;
}

.admin-navbar__notification-empty {
  padding: 1rem 0.8rem;
  border-radius: 0.8rem;
  color: #6d788e;
  font-size: 0.8rem;
  background: #f7f9fc;
  text-align: center;
}

.admin-navbar__dropdown-item:hover {
  background: #f2f5fb;
}

@media (max-width: 900px) {
  .admin-navbar {
    flex-wrap: wrap;
    align-items: center;
  }

  .admin-navbar__actions {
    margin-left: auto;
  }
}
</style>
