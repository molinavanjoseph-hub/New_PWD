<script setup>
import logoPwd from '@/assets/logo-pwd.png'
import pwdWordmark from '@/assets/pwdlogo.png'

const props = defineProps({
  activeSection: {
    type: String,
    required: true,
  },
  applicantName: {
    type: String,
    default: 'Applicant',
  },
  applicantEmail: {
    type: String,
    default: 'No email available',
  },
  applicantAvatarUrl: {
    type: String,
    default: '',
  },
  
  applicantInitials: {
    type: String,
    default: 'AP',
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  sidebarItems: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['select-section', 'close'])

const selectSection = (sectionId) => {
  emit('select-section', sectionId)
  if (props.isMobile) {
    emit('close')
  }
}

const closeSidebar = () => {
  emit('close')
}

const getSidebarDescription = (item) =>
  String(item?.description || '').trim() || 'Open this applicant workspace section.'
</script>

<template>
  <div class="applicant-sidebar-shell" :class="{ 'is-mobile': isMobile, 'is-open': isOpen }">
    <button
      v-if="isMobile"
      type="button"
      class="applicant-sidebar__backdrop"
      aria-label="Close applicant navigation"
      @click="closeSidebar"
    />

    <aside class="applicant-sidebar">
      <div class="applicant-sidebar__ambient applicant-sidebar__ambient--top" aria-hidden="true" />
      <div class="applicant-sidebar__ambient applicant-sidebar__ambient--bottom" aria-hidden="true" />

      <div class="applicant-sidebar__main">
        <div v-if="isMobile" class="applicant-sidebar__mobile-topbar">
          <span>Workspace Menu</span>
          <button type="button" class="applicant-sidebar__mobile-close" aria-label="Close menu" @click="closeSidebar">
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div class="applicant-sidebar__brand">
          <div class="applicant-sidebar__brand-mark">
            <img :src="logoPwd" alt="PWD logo" class="applicant-sidebar__brand-logo" />
          </div>
          <div class="applicant-sidebar__brand-copy">
            <img :src="pwdWordmark" alt="PWD Platform" class="applicant-sidebar__brand-wordmark" />
            <strong>APPLICANT WORKSPACE</strong>
          </div>
        </div>

        <div class="applicant-sidebar__nav-head" aria-hidden="true">
          <span>Workspace Menu</span>
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
            <span class="applicant-sidebar__link-copy">
              <span class="applicant-sidebar__link-label">{{ item.label }}</span>
              <small class="applicant-sidebar__link-meta">{{ getSidebarDescription(item) }}</small>
            </span>
          </button>
        </nav>
      </div>

      <section class="applicant-sidebar__profile" aria-label="Applicant profile summary">
        <div class="applicant-sidebar__profile-avatar">
          <img
            v-if="applicantAvatarUrl"
            :src="applicantAvatarUrl"
            :alt="`${applicantName} avatar`"
            class="applicant-sidebar__profile-image"
          />
          <template v-else>{{ applicantInitials }}</template>
        </div>
        <div class="applicant-sidebar__profile-copy">
          <strong :title="applicantName">{{ applicantName }}</strong>
          <span :title="applicantEmail">{{ applicantEmail }}</span>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped src="@/components/applicant_sidebar.css"></style>
