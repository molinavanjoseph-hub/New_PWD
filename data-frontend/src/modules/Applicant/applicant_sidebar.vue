<script setup>
import mathLogo from '@/assets/math.png'

const props = defineProps({
  activeSection: {
    type: String,
    required: true,
  },
  sidebarItems: {
    type: Array,
    required: true,
  },
  sidebarSettingsItem: {
    type: Object,
    required: true,
  },
  showProfileItem: {
    type: Boolean,
    default: true,
  },
  showSettingsItem: {
    type: Boolean,
    default: true,
  },
  showHelpCenterItem: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['select-section', 'open-help-center'])

const selectSection = (sectionId) => {
  emit('select-section', sectionId)
}

const openHelpCenter = () => {
  emit('open-help-center')
}
</script>

<template>
  <aside class="applicant-sidebar">
    <div class="applicant-sidebar__ambient applicant-sidebar__ambient--top" aria-hidden="true" />
    <div class="applicant-sidebar__ambient applicant-sidebar__ambient--bottom" aria-hidden="true" />

    <div class="applicant-sidebar__brand">
      <div class="applicant-sidebar__brand-mark">
        <img :src="mathLogo" alt="Applicant sidebar logo" class="applicant-sidebar__brand-logo" />
      </div>
      <div class="applicant-sidebar__brand-copy">
        <span>PWD Platform</span>
        <strong>Applicant Workspace</strong>
      </div>
    </div>

    <nav class="applicant-sidebar__nav">
      <button
        v-for="item in sidebarItems"
        :key="item.id"
        type="button"
        class="applicant-sidebar__link"
        :class="{ 'is-active': activeSection === item.id }"
        :aria-current="activeSection === item.id ? 'page' : undefined"
        @click="selectSection(item.id)"
      >
        <span class="applicant-sidebar__link-glow" aria-hidden="true" />
        <span class="applicant-sidebar__link-icon" aria-hidden="true">
          <i :class="item.icon" />
        </span>
        <span class="applicant-sidebar__link-label">{{ item.label }}</span>
        <span v-if="activeSection === item.id" class="applicant-sidebar__active-mark" aria-hidden="true" />
      </button>
    </nav>

    <div class="applicant-sidebar__divider" aria-hidden="true" />

    <div class="applicant-sidebar__footer">
      <p class="applicant-sidebar__footer-title">Account</p>

      <button
        v-if="showProfileItem"
        type="button"
        class="applicant-sidebar__footer-link"
        :class="{ 'is-active': activeSection === 'profile' }"
        @click="selectSection('profile')"
      >
        <i class="bi bi-person-circle" aria-hidden="true" />
        <span>My Profile</span>
      </button>

      <button
        v-if="showSettingsItem"
        type="button"
        class="applicant-sidebar__footer-link"
        :class="{ 'is-active': activeSection === sidebarSettingsItem.id }"
        :aria-current="activeSection === sidebarSettingsItem.id ? 'page' : undefined"
        @click="selectSection(sidebarSettingsItem.id)"
      >
        <i :class="sidebarSettingsItem.icon" aria-hidden="true" />
        <span>{{ sidebarSettingsItem.label }}</span>
      </button>

      <button v-if="showHelpCenterItem" type="button" class="applicant-sidebar__footer-link" @click="openHelpCenter">
        <i class="bi bi-question-circle" aria-hidden="true" />
        <span>Help Center</span>
      </button>
    </div>
  </aside>
</template>

<style scoped src="@/components/applicant_sidebar.css"></style>
