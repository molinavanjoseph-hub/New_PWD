<script setup>
import { toRefs } from 'vue'

const props = defineProps([
  'currentSection',
  'businessName',
  'businessEmail',
  'businessInitials',
  'profileAvatar',
  'profileRoleLabel',
  'workspaceOwnerName',
  'isProfileMenuOpen',
  'businessNavbarSettingsItems',
  'businessNavbarNotifications',
  'unreadBusinessNotificationCount',
  'isNotificationMenuOpen',
  'toggleBusinessProfileMenu',
  'toggleNotificationMenu',
  'openBusinessNotification',
  'handleBusinessNavbarSetting',
  'openLogoutConfirm',
])

const {
  currentSection,
  businessName,
  businessEmail,
  businessInitials,
  profileAvatar,
  profileRoleLabel,
  workspaceOwnerName,
  isProfileMenuOpen,
  businessNavbarSettingsItems,
  businessNavbarNotifications,
  unreadBusinessNotificationCount,
  isNotificationMenuOpen,
  toggleBusinessProfileMenu,
  toggleNotificationMenu,
  openBusinessNotification,
  handleBusinessNavbarSetting,
  openLogoutConfirm,
} = toRefs(props)

const formatNotificationBadge = (value) => {
  const count = Number(value) || 0
  return count > 99 ? '99+' : String(count)
}

const resolveNotificationToneClass = (notification) => {
  const tone = String(notification?.tone || '').trim().toLowerCase()
  if (tone === 'warning') return 'is-warning'
  if (tone === 'success') return 'is-success'
  if (tone === 'danger') return 'is-danger'
  return ''
}

const formatNotificationTime = (notification) =>
  String(notification?.createdAtLabel || '').trim()
  || new Date(notification?.createdAt || Date.now()).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
</script>

<template>
  <header class="business-navbar business-user-navbar">
    <div class="business-user-navbar__main">
      <div class="business-user-navbar__eyebrow-row">
        <p class="business-navbar__eyebrow">Employee Workspace</p>
        <span v-if="profileRoleLabel" class="business-user-navbar__role-badge">{{ profileRoleLabel }}</span>
      </div>
      <h1>{{ currentSection.title }}</h1>
      <p class="business-user-navbar__subtitle">{{ currentSection.description }}</p>
      <div class="business-user-navbar__owner">
        <i class="bi bi-buildings" aria-hidden="true" />
        <span>Working under {{ workspaceOwnerName || 'Business Workspace' }}</span>
      </div>
    </div>

    <div class="business-navbar__actions">
      <div class="business-navbar__notifications">
        <button
          type="button"
          class="business-navbar__notifications-btn"
          :class="{
            'is-open': isNotificationMenuOpen,
            'has-unread': unreadBusinessNotificationCount > 0,
          }"
          aria-label="Workspace notifications"
          :aria-expanded="isNotificationMenuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          @click.stop="toggleNotificationMenu"
        >
          <i class="bi bi-bell" aria-hidden="true" />
          <span v-if="unreadBusinessNotificationCount > 0" class="business-navbar__notifications-badge">
            {{ formatNotificationBadge(unreadBusinessNotificationCount) }}
          </span>
        </button>

        <div
          v-if="isNotificationMenuOpen"
          class="business-navbar__notifications-panel"
          role="menu"
          aria-label="Workspace notifications"
        >
          <div class="business-navbar__notifications-head">
            <div>
              <strong>Notifications</strong>
              <span>Live workspace updates</span>
            </div>

            <span v-if="unreadBusinessNotificationCount > 0" class="business-navbar__notification-pill">
              {{ formatNotificationBadge(unreadBusinessNotificationCount) }} new
            </span>
          </div>

          <div v-if="businessNavbarNotifications.length" class="business-navbar__notifications-list">
            <button
              v-for="notification in businessNavbarNotifications"
              :key="notification.id"
              type="button"
              class="business-navbar__notification-item"
              :class="[resolveNotificationToneClass(notification), { 'is-unread': !notification.read }]"
              @click.stop="openBusinessNotification(notification.id)"
            >
              <span class="business-navbar__notification-icon" aria-hidden="true" />

              <div class="business-navbar__notification-copy">
                <strong>{{ notification.title }}</strong>
                <span>{{ notification.message }}</span>
                <small>{{ formatNotificationTime(notification) }}</small>
              </div>
            </button>
          </div>

          <div v-else class="business-navbar__notifications-empty">
            No new workspace updates yet.
          </div>
        </div>
      </div>

      <div class="business-navbar__account">
        <div class="business-navbar__account-row">
          <button
            type="button"
            class="business-navbar__account-btn business-user-navbar__account-btn"
            :aria-expanded="isProfileMenuOpen ? 'true' : 'false'"
            aria-haspopup="menu"
            aria-label="Employee workspace menu"
            @click.stop="toggleBusinessProfileMenu"
          >
            <span class="business-navbar__avatar">
              <img v-if="profileAvatar" :src="profileAvatar" alt="Employee avatar" class="business-navbar__avatar-image" />
              <template v-else>{{ businessInitials }}</template>
            </span>
            <span class="business-navbar__profile-meta">
              <strong>{{ businessName }}</strong>
              <span>{{ businessEmail }}</span>
            </span>
            <i class="bi bi-chevron-down business-user-navbar__account-chevron" :class="{ 'is-open': isProfileMenuOpen }" aria-hidden="true" />
          </button>
        </div>

        <div v-if="isProfileMenuOpen" class="business-navbar__dropdown business-user-navbar__dropdown" role="menu" aria-label="Employee workspace menu">
          <div class="business-user-navbar__dropdown-head">
            <span class="business-user-navbar__mode-badge">Employee Workspace</span>
            <strong>{{ businessName }}</strong>
            <span>{{ businessEmail }}</span>
            <small>{{ profileRoleLabel || 'Workspace User' }} under {{ workspaceOwnerName || 'Business Workspace' }}</small>
          </div>

          <div v-if="businessNavbarSettingsItems.length" class="business-navbar__dropdown-group">
            <button
              v-for="item in businessNavbarSettingsItems"
              :key="item.label"
              type="button"
              class="business-sidebar__footer-link business-navbar__dropdown-link"
              @click="handleBusinessNavbarSetting(item.label)"
            >
              <i :class="item.icon" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
          </div>

          <div class="business-navbar__dropdown-group">
            <button
              type="button"
              class="business-sidebar__footer-link business-navbar__dropdown-link business-navbar__dropdown-link--danger"
              @click="openLogoutConfirm"
            >
              <i class="bi bi-box-arrow-right" aria-hidden="true" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
