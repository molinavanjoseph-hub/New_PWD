<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  applicantInitials: {
    type: String,
    required: true,
  },
  applicantFirstName: {
    type: String,
    required: true,
  },
  applicantLastName: {
    type: String,
    required: true,
  },
  applicantEmail: {
    type: String,
    required: true,
  },
  applicantAvatarUrl: {
    type: String,
    default: '',
  },
  showMenuButton: {
    type: Boolean,
    default: false,
  },
  isSidebarOpen: {
    type: Boolean,
    default: false,
  },
  notifications: {
    type: Array,
    default: () => [],
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-personalization', 'open-settings', 'logout', 'open-notification', 'toggle-sidebar'])

const isDropdownOpen = ref(false)
const isNotificationOpen = ref(false)
const profileMenuRef = ref(null)
const notificationMenuRef = ref(null)
const APPLICANT_SEEN_NOTIFICATION_STORAGE_KEY = 'applicantSeenNotificationIds'
const normalizeNotificationOwnerKey = (value) => String(value || '').trim().toLowerCase() || 'default'
const resolveSeenNotificationStorageKey = () =>
  `${APPLICANT_SEEN_NOTIFICATION_STORAGE_KEY}:${normalizeNotificationOwnerKey(props.applicantEmail)}`

function readSeenNotificationIds() {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(resolveSeenNotificationStorageKey())
    const parsedValue = storedValue ? JSON.parse(storedValue) : []
    return Array.isArray(parsedValue)
      ? parsedValue.map((value) => String(value || '').trim()).filter(Boolean)
      : []
  }
  catch {
    return []
  }
}
const seenNotificationIds = ref(readSeenNotificationIds())

const formatNotificationBadge = (value) => {
  const count = Number(value) || 0
  return count > 99 ? '99+' : String(count)
}

const resolveNotificationTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  const parsedValue = Date.parse(String(value || '').trim())
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0
}

const formatNotificationSentLabel = (value, fallbackLabel = 'Just now') => {
  const timestamp = resolveNotificationTimestamp(value)
  if (!timestamp) {
    const normalizedFallback = String(fallbackLabel || '').trim() || 'Just now'
    return `Sent ${normalizedFallback}`
  }

  return `Sent ${new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

const persistSeenNotificationIds = () => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(resolveSeenNotificationStorageKey(), JSON.stringify(seenNotificationIds.value))
  }
  catch {
    // Ignore browser storage errors and keep the dropdown interactive.
  }
}

const normalizeNotificationId = (value) => String(value || '').trim()
const resolveNotificationSeenKey = (notification = {}) => {
  const notificationId = normalizeNotificationId(notification?.id)
  const createdAtValue = resolveNotificationTimestamp(
    notification?.createdAtValue
    || notification?.createdAt
    || notification?.created_at
    || notification?.timestamp,
  )

  return notificationId ? `${notificationId}::${createdAtValue || 0}` : ''
}
const getNotificationSectionLabel = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'applications') return 'Applications'
  if (normalizedValue === 'interviews') return 'Interviews'
  if (normalizedValue === 'job-offers') return 'Job Offers'
  if (normalizedValue === 'contracts') return 'Contracts'
  if (normalizedValue === 'technical-assessment') return 'Technical Assessment'
  if (normalizedValue === 'settings') return 'Workspace'
  return 'Updates'
}

const getNotificationIconClass = (section, tone) => {
  const normalizedSection = String(section || '').trim().toLowerCase()
  const normalizedTone = String(tone || '').trim().toLowerCase()

  if (normalizedSection === 'applications') {
    return normalizedTone === 'danger' ? 'bi bi-x-octagon-fill' : 'bi bi-briefcase-fill'
  }

  if (normalizedSection === 'interviews') {
    return normalizedTone === 'danger' ? 'bi bi-calendar-x-fill' : 'bi bi-camera-video-fill'
  }

  if (normalizedSection === 'job-offers') {
    return normalizedTone === 'danger' ? 'bi bi-briefcase-fill' : 'bi bi-envelope-paper-fill'
  }

  if (normalizedSection === 'contracts') {
    return normalizedTone === 'danger' ? 'bi bi-file-earmark-x-fill' : 'bi bi-file-earmark-check-fill'
  }

  if (normalizedSection === 'technical-assessment') {
    return normalizedTone === 'danger' ? 'bi bi-exclamation-diamond-fill' : 'bi bi-ui-checks-grid'
  }

  if (normalizedSection === 'settings') {
    return 'bi bi-shield-check'
  }

  return 'bi bi-bell-fill'
}

const normalizedNotifications = computed(() =>
  (Array.isArray(props.notifications) ? props.notifications : [])
    .map((item) => {
      const notificationId = normalizeNotificationId(item?.id)
      const timeLabel = String(item?.timeLabel || '').trim() || 'Just now'
      const createdAtValue = resolveNotificationTimestamp(
        item?.createdAtValue
        || item?.createdAt
        || item?.created_at
        || item?.timestamp,
      )

      return {
        ...item,
        id: notificationId,
        seenKey: resolveNotificationSeenKey({ id: notificationId, createdAtValue }),
        message: String(item?.message || item?.copy || '').trim(),
        createdAtValue,
        timeLabel,
        sentLabel: formatNotificationSentLabel(createdAtValue, timeLabel),
        isUnread: notificationId
          ? !seenNotificationIds.value.includes(resolveNotificationSeenKey({ id: notificationId, createdAtValue }))
          : true,
        sectionLabel: getNotificationSectionLabel(item?.section),
        iconClass: getNotificationIconClass(item?.section, item?.tone),
      }
    })
    .filter((item) => item.id),
)

const unreadNotificationCount = computed(() =>
  normalizedNotifications.value.filter((item) => item.isUnread).length,
)
const notificationCount = computed(() => normalizedNotifications.value.length)

const titleSummary = computed(() => {
  const normalizedTitle = String(props.title || '').trim().toLowerCase()

  if (normalizedTitle.includes('dashboard')) {
    return 'Your overview for applications, interviews, and fresh updates.'
  }

  if (normalizedTitle.includes('profile')) {
    return 'Keep your applicant profile complete and ready for employers.'
  }

  if (normalizedTitle.includes('application')) {
    return 'Review each application stage and stay updated in real time.'
  }

  if (normalizedTitle.includes('interview')) {
    return 'Manage your interview schedules, confirmations, and follow-ups.'
  }

  if (normalizedTitle.includes('assessment')) {
    return 'Track assigned technical tests and your latest submissions.'
  }

  if (normalizedTitle.includes('job')) {
    return 'Explore openings that match your profile and current preferences.'
  }

  return 'Stay organized inside your applicant workspace.'
})

const markNotificationsAsSeen = (items = normalizedNotifications.value) => {
  const notificationIds = (Array.isArray(items) ? items : [])
    .map((item) => resolveNotificationSeenKey(item))
    .filter(Boolean)

  if (!notificationIds.length) return

  seenNotificationIds.value = [...new Set([...seenNotificationIds.value, ...notificationIds])]
  persistSeenNotificationIds()
}

const toggleDropdown = () => {
  isNotificationOpen.value = false
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

const toggleNotificationDropdown = () => {
  isDropdownOpen.value = false
  isNotificationOpen.value = !isNotificationOpen.value
}

const closeNotificationDropdown = () => {
  isNotificationOpen.value = false
}

const handleNotificationClick = (notification) => {
  markNotificationsAsSeen([notification])
  closeNotificationDropdown()
  emit('open-notification', notification)
}

const handleMenuAction = (eventName) => {
  closeDropdown()
  emit(eventName)
}

const handleDocumentClick = (event) => {
  if (!profileMenuRef.value?.contains(event.target)) {
    closeDropdown()
  }
  if (!notificationMenuRef.value?.contains(event.target)) {
    closeNotificationDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(
  () => props.applicantEmail,
  () => {
    seenNotificationIds.value = readSeenNotificationIds()
  },
  { immediate: true },
)

</script>

<template>
  <header class="applicant-navbar" :class="{ 'applicant-navbar--compact': compact }">
    <div class="applicant-navbar__left">
      <div class="applicant-navbar__topline">
        <button
          v-if="showMenuButton"
          type="button"
          class="applicant-navbar__menu-toggle"
          :aria-expanded="isSidebarOpen ? 'true' : 'false'"
          :aria-label="isSidebarOpen ? 'Close applicant menu' : 'Open applicant menu'"
          @click="emit('toggle-sidebar')"
        >
          <i :class="isSidebarOpen ? 'bi bi-x-lg' : 'bi bi-list'" aria-hidden="true" />
        </button>

        <div class="applicant-navbar__breadcrumb" aria-label="Breadcrumb">
          <span class="applicant-navbar__breadcrumb-home">
            <i class="bi bi-house-door" aria-hidden="true" />
          </span>
          <i class="bi bi-chevron-right applicant-navbar__breadcrumb-separator" aria-hidden="true" />
          <span class="applicant-navbar__breadcrumb-current">{{ title }}</span>
        </div>
      </div>

      <div v-if="!compact" class="applicant-navbar__title-block">
        <p class="applicant-navbar__eyebrow">Applicant Workspace</p>
        <h1 class="applicant-navbar__title">{{ title }}</h1>
        <p class="applicant-navbar__subtitle">{{ titleSummary }}</p>
      </div>
    </div>

    <div class="applicant-navbar__actions">
      <div ref="notificationMenuRef" class="applicant-navbar__notification-shell">
        <button
          type="button"
          class="applicant-navbar__notification"
          :class="{ 'has-notifications': unreadNotificationCount > 0, 'is-open': isNotificationOpen }"
          :aria-expanded="isNotificationOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          @click.stop="toggleNotificationDropdown"
        >
          <i class="bi bi-bell" aria-hidden="true" />
          <span v-if="unreadNotificationCount > 0" class="applicant-navbar__notification-count">
            {{ formatNotificationBadge(unreadNotificationCount) }}
          </span>
        </button>

        <transition name="applicant-navbar-dropdown">
          <div
            v-if="isNotificationOpen"
            class="applicant-navbar__notification-dropdown"
            role="menu"
            aria-label="Applicant notifications"
          >
            <div class="applicant-navbar__notification-head">
              <div class="applicant-navbar__notification-head-copy">
                <strong>Notifications</strong>
                <span>Recent applicant activity</span>
              </div>

              <div class="applicant-navbar__notification-head-meta">
                <span
                  v-if="notificationCount > 0"
                  class="applicant-navbar__notification-pill"
                  :class="{ 'is-muted': unreadNotificationCount === 0 }"
                >
                  {{ unreadNotificationCount > 0 ? `${formatNotificationBadge(unreadNotificationCount)} new` : 'All seen' }}
                </span>
                <small v-if="notificationCount > 0">{{ notificationCount }} total</small>
              </div>
            </div>

            <div v-if="normalizedNotifications.length" class="applicant-navbar__notification-list">
              <button
                v-for="item in normalizedNotifications"
                :key="item.seenKey || item.id"
                class="applicant-navbar__notification-item"
                :class="[{ 'is-unread': item.isUnread }, `is-${item.tone || 'neutral'}`]"
                :data-icon="item.section === 'applications' ? 'AP' : item.section === 'interviews' ? 'IN' : item.section === 'technical-assessment' ? 'TA' : 'UP'"
                type="button"
                role="menuitem"
                @click.stop="handleNotificationClick(item)"
              >
                <span class="applicant-navbar__notification-dot" :class="{ 'is-unread': item.isUnread }" aria-hidden="true" />

                <div class="applicant-navbar__notification-copy" :data-meta="`${item.sentLabel} | ${item.timeLabel}`">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.message }}</span>
                  <small>{{ item.sentLabel }} - {{ item.timeLabel }}</small>
                </div>
              </button>
            </div>
            <p v-else class="applicant-navbar__notification-empty">
              Waiting for new applicant activity.
            </p>
          </div>
        </transition>
      </div>

      <div ref="profileMenuRef" class="applicant-navbar__profile-shell">
        <button
          type="button"
          class="applicant-navbar__profile"
          :class="{ 'is-open': isDropdownOpen }"
          :aria-expanded="isDropdownOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          :aria-label="`Open profile menu for ${applicantFirstName} ${applicantLastName}`"
          @click="toggleDropdown"
        >
          <div class="applicant-navbar__avatar">
            <img v-if="applicantAvatarUrl" :src="applicantAvatarUrl" alt="Applicant profile avatar" class="applicant-navbar__avatar-image" />
            <span v-else>{{ applicantInitials }}</span>
          </div>
        </button>

        <transition name="applicant-navbar-dropdown">
          <div v-if="isDropdownOpen" class="applicant-navbar__dropdown">
            <div class="applicant-navbar__dropdown-group">
              <button type="button" class="applicant-navbar__dropdown-link" @click="handleMenuAction('open-personalization')">
                <i class="bi bi-person-circle" aria-hidden="true" />
                <span>My Profile</span>
              </button>
              <button type="button" class="applicant-navbar__dropdown-link" @click="handleMenuAction('open-settings')">
                <i class="bi bi-sliders2" aria-hidden="true" />
                <span>Settings</span>
              </button>
            </div>

            <div class="applicant-navbar__dropdown-actions">
              <button type="button" class="applicant-navbar__dropdown-link applicant-navbar__dropdown-link--danger" @click="handleMenuAction('logout')">
                <i class="bi bi-box-arrow-right" aria-hidden="true" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<style scoped src="@/components/applicant_navbar.css"></style>
