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
  notifications: {
    type: Array,
    default: () => [],
  },
  notificationCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['open-personalization', 'open-help-center', 'open-terms', 'logout', 'open-notification'])

const isDropdownOpen = ref(false)
const isNotificationOpen = ref(false)
const profileMenuRef = ref(null)
const notificationMenuRef = ref(null)
const APPLICANT_SEEN_NOTIFICATION_STORAGE_KEY = 'applicantSeenNotificationIds'
const seenNotificationIds = ref([])

const formatNotificationBadge = (value) => {
  const count = Number(value) || 0
  return count > 99 ? '99+' : String(count)
}

const readSeenNotificationIds = () => {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(APPLICANT_SEEN_NOTIFICATION_STORAGE_KEY)
    const parsedValue = storedValue ? JSON.parse(storedValue) : []
    return Array.isArray(parsedValue)
      ? parsedValue.map((value) => String(value || '').trim()).filter(Boolean)
      : []
  }
  catch {
    return []
  }
}

const persistSeenNotificationIds = () => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(APPLICANT_SEEN_NOTIFICATION_STORAGE_KEY, JSON.stringify(seenNotificationIds.value))
  }
  catch {
    // Ignore browser storage errors and keep the dropdown interactive.
  }
}

const normalizeNotificationId = (value) => String(value || '').trim()

const normalizedNotifications = computed(() =>
  (Array.isArray(props.notifications) ? props.notifications : [])
    .map((item) => {
      const notificationId = normalizeNotificationId(item?.id)
      return {
        ...item,
        id: notificationId,
        message: String(item?.message || item?.copy || '').trim(),
        timeLabel: String(item?.timeLabel || '').trim() || 'Just now',
        isUnread: notificationId ? !seenNotificationIds.value.includes(notificationId) : true,
      }
    })
    .filter((item) => item.id),
)

const unreadNotificationCount = computed(() =>
  normalizedNotifications.value.filter((item) => item.isUnread).length,
)

const markNotificationsAsSeen = (items = normalizedNotifications.value) => {
  const notificationIds = (Array.isArray(items) ? items : [])
    .map((item) => normalizeNotificationId(item?.id))
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

  if (isNotificationOpen.value) {
    markNotificationsAsSeen()
  }
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
  seenNotificationIds.value = readSeenNotificationIds()
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(() => props.notifications, () => {
  if (isNotificationOpen.value) {
    markNotificationsAsSeen()
  }
}, { deep: true })
</script>

<template>
  <header class="applicant-navbar">
    <div class="applicant-navbar__left">
      <div class="applicant-navbar__breadcrumb" aria-label="Breadcrumb">
        <span class="applicant-navbar__breadcrumb-home">
          <i class="bi bi-house-door" aria-hidden="true" />
        </span>
        <i class="bi bi-chevron-right applicant-navbar__breadcrumb-separator" aria-hidden="true" />
        <span class="applicant-navbar__breadcrumb-current">{{ title }}</span>
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
              <div>
                <strong>Notifications</strong>
                <span>Live application activity</span>
              </div>

              <span v-if="unreadNotificationCount > 0" class="applicant-navbar__notification-pill">
                {{ formatNotificationBadge(unreadNotificationCount) }} new
              </span>
            </div>

            <div v-if="normalizedNotifications.length" class="applicant-navbar__notification-list">
              <button
                v-for="item in normalizedNotifications"
                :key="item.id"
                class="applicant-navbar__notification-item"
                :class="{ 'is-unread': item.isUnread }"
                type="button"
                role="menuitem"
                @click="handleNotificationClick(item)"
              >
                <span class="applicant-navbar__notification-dot" :class="{ 'is-unread': item.isUnread }" aria-hidden="true" />

                <div class="applicant-navbar__notification-copy">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.message }}</span>
                  <small>{{ item.timeLabel }}</small>
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
        <button type="button" class="applicant-navbar__profile" :aria-expanded="isDropdownOpen ? 'true' : 'false'" @click="toggleDropdown">
          <div class="applicant-navbar__avatar">
            <img v-if="applicantAvatarUrl" :src="applicantAvatarUrl" alt="Applicant profile avatar" class="applicant-navbar__avatar-image" />
            <span v-else>{{ applicantInitials }}</span>
          </div>
          <div class="applicant-navbar__profile-copy">
            <p class="applicant-navbar__name">{{ applicantFirstName }} {{ applicantLastName }}</p>
            <p class="applicant-navbar__email">{{ applicantEmail }}</p>
          </div>
          <i class="bi bi-chevron-down applicant-navbar__chevron" :class="{ 'is-open': isDropdownOpen }" aria-hidden="true" />
        </button>

        <transition name="applicant-navbar-dropdown">
          <div v-if="isDropdownOpen" class="applicant-navbar__dropdown">
            <div class="applicant-navbar__dropdown-group">
              <button type="button" class="applicant-navbar__dropdown-link" @click="handleMenuAction('open-personalization')">
                <i class="bi bi-sliders2" aria-hidden="true" />
                <span>Personalization</span>
              </button>
            </div>

            <div class="applicant-navbar__dropdown-group">
              <button type="button" class="applicant-navbar__dropdown-link" @click="handleMenuAction('open-help-center')">
                <i class="bi bi-life-preserver" aria-hidden="true" />
                <span>Help Center</span>
              </button>
              <button type="button" class="applicant-navbar__dropdown-link" @click="handleMenuAction('open-terms')">
                <i class="bi bi-shield-check" aria-hidden="true" />
                <span>Terms & Policies</span>
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
