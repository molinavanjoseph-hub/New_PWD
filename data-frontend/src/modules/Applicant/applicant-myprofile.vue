<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  applicantName: {
    type: String,
    required: true,
  },
  applicantInitials: {
    type: String,
    required: true,
  },
  applicantAvatarUrl: {
    type: String,
    default: '',
  },
  applicantProfileForm: {
    type: Object,
    required: true,
  },
  isApplicantAvatarUploading: {
    type: Boolean,
    default: false,
  },
  isApplicantResumeUploading: {
    type: Boolean,
    default: false,
  },
  isApplicantProfileSaving: {
    type: Boolean,
    default: false,
  },
  isApplicantProfileEditing: {
    type: Boolean,
    default: false,
  },
  hasPendingApplicantProfileChanges: {
    type: Boolean,
    default: false,
  },
  hasPendingApplicantAvatarChange: {
    type: Boolean,
    default: false,
  },
  applicantProfileMessage: {
    type: String,
    default: '',
  },
  applicantProfileMessageTone: {
    type: String,
    default: 'success',
  },
  applicantProfilePreferredPage: {
    type: String,
    default: 'profile',
  },
  applicantProfileSnapshot: {
    type: Array,
    default: () => [],
  },
  applicantPresentAddress: {
    type: String,
    required: true,
  },
  applicantProvincialAddress: {
    type: String,
    required: true,
  },
  applicantPlaceOfBirth: {
    type: String,
    required: true,
  },
  applicantSex: {
    type: String,
    required: true,
  },
  applicantAge: {
    type: String,
    required: true,
  },
  applicantJoined: {
    type: String,
    required: true,
  },
  applicantResumeUrl: {
    type: String,
    default: '',
  },
  applicantResumeFileName: {
    type: String,
    default: '',
  },
  applicantHasResume: {
    type: Boolean,
    default: false,
  },
  savedFavoriteBusinesses: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['start-profile-edit', 'cancel-profile-edit', 'upload-avatar', 'upload-resume', 'save-profile'])

const activeProfilePage = ref('profile')
const profilePhotoActionLabel = computed(() => {
  if (props.isApplicantAvatarUploading) return 'Uploading...'
  if (props.hasPendingApplicantAvatarChange) return 'Replace Photo'
  return props.applicantProfileForm.avatar || props.applicantAvatarUrl ? 'Change Photo' : 'Upload Photo'
})
const shouldShowProfileSaveButton = computed(() => props.hasPendingApplicantProfileChanges || props.isApplicantProfileSaving)

watch(
  () => props.applicantProfilePreferredPage,
  (value) => {
    const normalizedValue = String(value || '').trim().toLowerCase()
    activeProfilePage.value = ['profile', 'address', 'resume'].includes(normalizedValue) ? normalizedValue : 'profile'
  },
  { immediate: true },
)
</script>

<template>
  <section class="applicant-settings" :class="{ 'is-saving': isApplicantProfileSaving }">
    <div class="applicant-settings__content">
      <p v-if="applicantProfileMessage" class="applicant-settings__status" :class="`applicant-settings__status--${applicantProfileMessageTone}`">
        {{ applicantProfileMessage }}
      </p>

      <section class="applicant-settings__grid">
        <aside class="applicant-settings__rail">
          <article class="applicant-settings__profile-card">
          <div class="applicant-settings__profile-head">
            <span class="applicant-settings__profile-badge">Applicant</span>
            <span class="applicant-settings__profile-status">Active</span>
          </div>

          <div class="applicant-settings__identity applicant-settings__identity--stacked">
            <div class="applicant-settings__avatar-shell" :class="{ 'is-loading': isApplicantAvatarUploading }">
              <img v-if="applicantProfileForm.avatar || applicantAvatarUrl" :src="applicantProfileForm.avatar || applicantAvatarUrl" alt="Applicant profile avatar" class="applicant-settings__avatar-image" />
              <span v-else>{{ applicantInitials }}</span>
            </div>

            <div class="applicant-settings__identity-copy applicant-settings__identity-copy--card">
              <p class="applicant-settings__eyebrow">My Profile</p>
              <h2>{{ applicantName }}</h2>
              <p>{{ applicantProfileSnapshot[0]?.value || 'No email available' }}</p>
            </div>
          </div>

          <div class="applicant-settings__profile-actions">
            <label class="applicant-settings__upload-button">
              <input
                type="file"
                accept="image/*"
                class="applicant-settings__file-input"
                :disabled="isApplicantAvatarUploading || isApplicantProfileSaving"
                @change="$emit('upload-avatar', $event)"
              >
              <i class="bi bi-camera" aria-hidden="true" />
              <span>{{ profilePhotoActionLabel }}</span>
            </label>

            <button
              v-if="shouldShowProfileSaveButton"
              type="button"
              class="applicant-settings__save-button applicant-settings__save-button--inline"
              :disabled="isApplicantProfileSaving || isApplicantAvatarUploading || isApplicantResumeUploading"
              @click="$emit('save-profile')"
            >
              <span v-if="isApplicantProfileSaving" class="applicant-settings__save-loading" aria-live="polite">
                Saving
                <span />
                <span />
                <span />
              </span>
              <template v-else>
                <i class="bi bi-floppy" aria-hidden="true" />
                <span>Save Changes</span>
              </template>
            </button>
          </div>

          <div class="applicant-settings__mini-list">
            <div class="applicant-settings__mini-item">
              <span><i class="bi bi-geo-alt" aria-hidden="true" /> From</span>
              <strong>{{ applicantPresentAddress }}</strong>
            </div>
            <div class="applicant-settings__mini-item">
              <span><i class="bi bi-calendar3" aria-hidden="true" /> Member since</span>
              <strong>{{ applicantJoined }}</strong>
            </div>
            <div class="applicant-settings__mini-item">
              <span><i class="bi bi-universal-access-circle" aria-hidden="true" /> Disability</span>
              <strong>{{ applicantProfileSnapshot[2]?.value || 'Not set' }}</strong>
            </div>
            <div class="applicant-settings__mini-item">
              <span><i class="bi bi-file-earmark-pdf" aria-hidden="true" /> Resume</span>
              <strong>{{ applicantHasResume ? 'Ready to send' : 'Upload needed' }}</strong>
            </div>
          </div>

          </article>

          <article class="applicant-settings__panel applicant-settings__panel--compact">
          <div class="applicant-panel__head">
            <div>
              <h3>Quick Summary</h3>
              <span>Visible account details</span>
            </div>
          </div>

          <div class="applicant-settings__summary-list applicant-settings__summary-list--compact">
            <div v-for="item in applicantProfileSnapshot" :key="item.id" class="applicant-settings__summary-item">
              <div class="applicant-settings__summary-icon" aria-hidden="true">
                <i :class="item.icon" />
              </div>
              <div>
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
          </article>
        </aside>

        <article class="applicant-settings__panel applicant-settings__panel--form">
        <div class="applicant-panel__head">
          <div>
            <h3>Profile Information</h3>
            <span>{{
              activeProfilePage === 'resume'
                ? 'Switch between profile, address, and resume pages.'
                : props.isApplicantProfileEditing
                  ? 'All fields are open for editing right now.'
                  : 'Fields are locked until you press Edit Profile.'
            }}</span>
          </div>
          <div v-if="activeProfilePage !== 'resume'" class="applicant-settings__head-actions">
            <button
              v-if="!props.isApplicantProfileEditing"
              type="button"
              class="applicant-settings__edit-button"
              @click="$emit('start-profile-edit')"
            >
              <i class="bi bi-pencil-square" aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
            <button
              v-else
              type="button"
              class="applicant-settings__edit-button applicant-settings__edit-button--ghost"
              @click="$emit('cancel-profile-edit')"
            >
              <i class="bi bi-lock" aria-hidden="true" />
              <span>Lock Fields</span>
            </button>
          </div>
        </div>

        <div class="applicant-settings__pager">
          <button type="button" class="applicant-settings__pager-button" :class="{ 'is-active': activeProfilePage === 'profile' }" @click="activeProfilePage = 'profile'">
            Profile Page
          </button>
          <button type="button" class="applicant-settings__pager-button" :class="{ 'is-active': activeProfilePage === 'address' }" @click="activeProfilePage = 'address'">
            Address Page
          </button>
          <button type="button" class="applicant-settings__pager-button" :class="{ 'is-active': activeProfilePage === 'resume' }" @click="activeProfilePage = 'resume'">
            Resume Page
          </button>
        </div>

        <p v-if="!props.isApplicantProfileEditing && activeProfilePage !== 'resume'" class="applicant-settings__lock-note">
          Press <strong>Edit Profile</strong> to unlock and update your information.
        </p>

        <div v-if="activeProfilePage === 'profile'" class="applicant-settings__profile-page">
          <fieldset class="applicant-settings__fieldset" :disabled="!props.isApplicantProfileEditing">
            <div class="applicant-settings__form-grid">
              <label class="applicant-settings__field">
                <span>First Name</span>
                <input v-model="applicantProfileForm.first_name" type="text" placeholder="Enter first name" />
              </label>
              <label class="applicant-settings__field">
                <span>Middle Name</span>
                <input v-model="applicantProfileForm.middle_name" type="text" placeholder="Enter middle name" />
              </label>
              <label class="applicant-settings__field">
                <span>Last Name</span>
                <input v-model="applicantProfileForm.last_name" type="text" placeholder="Enter last name" />
              </label>
              <label class="applicant-settings__field">
                <span>Sex</span>
                <input v-model="applicantProfileForm.sex" type="text" placeholder="Enter sex" />
              </label>
              <label class="applicant-settings__field">
                <span>Birth Date</span>
                <input v-model="applicantProfileForm.birth_date" type="date" />
              </label>
              <label class="applicant-settings__field">
                <span>Age</span>
                <input v-model="applicantProfileForm.age" type="text" inputmode="numeric" placeholder="Enter age" />
              </label>
              <label class="applicant-settings__field">
                <span>Disability Type</span>
                <input v-model="applicantProfileForm.disability_type" type="text" placeholder="Enter disability type" />
              </label>
              <label class="applicant-settings__field">
                <span>Preferred Language</span>
                <input v-model="applicantProfileForm.preferred_language" type="text" placeholder="Enter preferred language" />
              </label>
              <label class="applicant-settings__field">
                <span>Country Code</span>
                <input v-model="applicantProfileForm.contact_country_code" type="text" placeholder="+63" />
              </label>
              <label class="applicant-settings__field">
                <span>Mobile Number</span>
                <input v-model="applicantProfileForm.contact_number" type="text" placeholder="Enter contact number" />
              </label>
              <label class="applicant-settings__field">
                <span>Telephone Number</span>
                <input v-model="applicantProfileForm.telephone_number" type="text" placeholder="Enter telephone number" />
              </label>
              <label class="applicant-settings__field">
                <span>PWD ID Number</span>
                <input v-model="applicantProfileForm.pwd_id_number" type="text" placeholder="Enter PWD ID number" />
              </label>
            </div>
          </fieldset>

          <aside class="applicant-settings__profile-side">
            <article class="applicant-settings__panel applicant-settings__panel--nested applicant-settings__favorites-panel">
              <div class="applicant-panel__head">
                <div>
                  <h3>Favorite Businesses</h3>
                  <span>Saved from Find Jobs</span>
                </div>
              </div>

              <div v-if="savedFavoriteBusinesses.length" class="applicant-settings__favorites-list">
                <article v-for="business in savedFavoriteBusinesses" :key="business.id" class="applicant-settings__favorite-card">
                  <div class="applicant-settings__favorite-head">
                    <div class="applicant-settings__favorite-avatar">
                      <img
                        v-if="business.logoUrl"
                        :src="business.logoUrl"
                        :alt="`${business.businessName} logo`"
                        class="applicant-settings__favorite-avatar-image"
                      >
                      <template v-else>{{ business.initials }}</template>
                    </div>

                    <div class="applicant-settings__favorite-copy">
                      <strong>{{ business.businessName }}</strong>
                      <span>{{ business.jobTitle }}</span>
                    </div>
                  </div>

                  <div class="applicant-settings__favorite-meta">
                    <span>
                      <i class="bi bi-geo-alt" aria-hidden="true" />
                      {{ business.location }}
                    </span>
                    <span>
                      <i class="bi bi-bookmark-check" aria-hidden="true" />
                      {{ business.savedDateLabel }}
                    </span>
                  </div>
                </article>
              </div>

              <div v-else class="applicant-settings__favorites-empty">
                <i class="bi bi-bookmark-heart" aria-hidden="true" />
                <strong>No favorite businesses saved yet.</strong>
                <span>Use Save Favorite in Find Jobs and your saved businesses will appear here.</span>
              </div>
            </article>
          </aside>
        </div>

        <div v-else-if="activeProfilePage === 'address'" class="applicant-settings__page-stack">
          <fieldset class="applicant-settings__fieldset" :disabled="!props.isApplicantProfileEditing">
            <div class="applicant-settings__form-grid">
              <label class="applicant-settings__field">
                <span>Barangay</span>
                <input v-model="applicantProfileForm.address_barangay" type="text" placeholder="Enter barangay" />
              </label>
              <label class="applicant-settings__field">
                <span>City</span>
                <input v-model="applicantProfileForm.address_city" type="text" placeholder="Enter city" />
              </label>
              <label class="applicant-settings__field">
                <span>Province</span>
                <input v-model="applicantProfileForm.address_province" type="text" placeholder="Enter province" />
              </label>
              <label class="applicant-settings__field">
                <span>Place of Birth</span>
                <input v-model="applicantProfileForm.place_of_birth" type="text" placeholder="Enter place of birth" />
              </label>
              <label class="applicant-settings__field applicant-settings__field--wide">
                <span>Present Address</span>
                <textarea v-model="applicantProfileForm.present_address" rows="3" placeholder="Enter present address" />
              </label>
              <label class="applicant-settings__field applicant-settings__field--wide">
                <span>Provincial Address</span>
                <textarea v-model="applicantProfileForm.provincial_address" rows="3" placeholder="Enter provincial address" />
              </label>
            </div>
          </fieldset>

          <article class="applicant-settings__panel applicant-settings__panel--nested">
            <div class="applicant-panel__head">
              <div>
                <h3>Address Details</h3>
                <span>Review your saved location and identity details</span>
              </div>
            </div>

            <div class="applicant-settings__detail-list">
              <div class="applicant-settings__detail-item">
                <span>Current Address</span>
                <strong>{{ applicantPresentAddress }}</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Provincial Address</span>
                <strong>{{ applicantProvincialAddress }}</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Place of Birth</span>
                <strong>{{ applicantPlaceOfBirth }}</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Sex</span>
                <strong>{{ applicantSex }}</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Age</span>
                <strong>{{ applicantAge }}</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Member Since</span>
                <strong>{{ applicantJoined }}</strong>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="applicant-settings__page-stack">
          <article class="applicant-settings__resume-card">
            <div class="applicant-settings__resume-copy">
              <p class="applicant-settings__eyebrow">Resume Upload</p>
              <h4>{{ applicantHasResume ? 'Resume ready for job applications' : 'Upload your resume before applying' }}</h4>
              <p>
                Upload your latest PDF resume here. When you click Apply Now in Find Jobs, this file will be sent with your application automatically.
              </p>
            </div>

            <div class="applicant-settings__resume-status" :class="{ 'is-ready': applicantHasResume }">
              <span class="applicant-settings__resume-pill">
                {{ applicantHasResume ? 'Resume linked' : 'Resume required' }}
              </span>
              <strong>{{ applicantHasResume ? applicantResumeFileName || 'Uploaded resume.pdf' : 'No resume uploaded yet' }}</strong>
            </div>

            <div class="applicant-settings__resume-actions">
              <label class="applicant-settings__upload-button">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  class="applicant-settings__file-input"
                  :disabled="isApplicantResumeUploading"
                  @change="$emit('upload-resume', $event)"
                />
                <i class="bi bi-upload" aria-hidden="true" />
                <span>{{ isApplicantResumeUploading ? 'Uploading PDF...' : 'Upload PDF Resume' }}</span>
              </label>

              <a
                v-if="applicantResumeUrl"
                class="applicant-settings__resume-link"
                :href="applicantResumeUrl"
                target="_blank"
                rel="noreferrer"
              >
                <i class="bi bi-box-arrow-up-right" aria-hidden="true" />
                <span>View Current Resume</span>
              </a>
            </div>
          </article>

          <article class="applicant-settings__panel applicant-settings__panel--nested">
            <div class="applicant-panel__head">
              <div>
                <h3>Application Flow</h3>
                <span>How resume detection works when you apply</span>
              </div>
            </div>

            <div class="applicant-settings__detail-list">
              <div class="applicant-settings__detail-item">
                <span>Without Resume</span>
                <strong>Apply Now will pause and show a toast telling you to set up your resume in this profile page.</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>With Resume</span>
                <strong>Apply Now opens a simple Yes or No confirmation first, then submits after you confirm.</strong>
              </div>
              <div class="applicant-settings__detail-item">
                <span>Recommended File</span>
                <strong>Use a clean PDF resume so employers can review it easily on any device.</strong>
              </div>
            </div>
          </article>
        </div>
        </article>
      </section>
    </div>

    <transition name="applicant-settings-saving">
      <div v-if="isApplicantProfileSaving" class="applicant-settings__saving-overlay" aria-live="polite" aria-busy="true">
        <div class="applicant-settings__saving-card">
          <span class="applicant-settings__saving-badge">Saving profile</span>
          <strong>Applying your changes</strong>
          <p>Your updated photo and profile details are being saved right now.</p>
          <span class="applicant-settings__saving-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.applicant-settings {
  display: grid;
  gap: 1rem;
  padding: 0 1.25rem;
  justify-items: center;
}

.applicant-settings__profile-card,
.applicant-settings__panel {
  border: 1px solid rgba(215, 224, 219, 0.95);
  border-radius: 0;
  background: #ffffff;
  box-shadow: none;
}

.applicant-settings__grid {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  width: 100%;
  max-width: 74rem;
  margin: 0 auto;
}

.applicant-settings__rail {
  display: grid;
  gap: 1rem;
}

.applicant-settings__profile-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.applicant-settings__profile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.applicant-settings__profile-badge,
.applicant-settings__profile-status {
  border: 1px solid rgba(201, 211, 205, 0.95);
  padding: 0.18rem 0.45rem;
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.2;
}

.applicant-settings__profile-badge {
  color: #4a5b54;
  background: #f8faf8;
}

.applicant-settings__profile-status {
  color: #1d6b3a;
  background: #f1f9f4;
}

.applicant-settings__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.applicant-settings__identity--stacked {
  grid-template-columns: 1fr;
  justify-items: center;
  text-align: center;
}

.applicant-settings__avatar-shell {
  width: 6.25rem;
  height: 6.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8d8f89 0%, #686c64 100%);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 800;
  overflow: hidden;
  box-shadow: none;
}

.applicant-settings__avatar-shell.is-loading {
  opacity: 0.72;
}

.applicant-settings__avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.applicant-settings__identity-copy,
.applicant-settings__identity-copy h2,
.applicant-settings__identity-copy p,
.applicant-settings__eyebrow,
.applicant-panel__head h3,
.applicant-panel__head span {
  margin: 0;
}

.applicant-settings__eyebrow {
  color: #7b8a83;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-settings__identity-copy h2 {
  margin-top: 0.2rem;
  color: #20312a;
  font-size: 1.3rem;
}

.applicant-settings__identity-copy--card h2 {
  font-size: 1.15rem;
}

.applicant-settings__identity-copy p {
  margin-top: 0.28rem;
  max-width: 100%;
  color: #63756d;
  font-size: 0.78rem;
  line-height: 1.55;
}

.applicant-settings__mini-list {
  display: grid;
  border-top: 1px solid rgba(229, 233, 230, 0.95);
  border-bottom: 1px solid rgba(229, 233, 230, 0.95);
}

.applicant-settings__mini-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  padding: 0.72rem 0;
  border-bottom: 1px solid rgba(237, 240, 238, 0.95);
}

.applicant-settings__mini-item:last-child {
  border-bottom: 0;
}

.applicant-settings__mini-item span {
  color: #707f78;
  font-size: 0.72rem;
  font-weight: 600;
}

.applicant-settings__mini-item span i {
  margin-right: 0.35rem;
}

.applicant-settings__mini-item strong {
  color: #24342d;
  font-size: 0.74rem;
  font-weight: 700;
  text-align: right;
  max-width: 8.5rem;
}

.applicant-settings__profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.applicant-settings {
  position: relative;
}

.applicant-settings__content {
  display: grid;
  gap: 1rem;
  transition: filter 0.22s ease, opacity 0.22s ease, transform 0.22s ease;
}

.applicant-settings.is-saving .applicant-settings__content {
  filter: blur(8px);
  opacity: 0.48;
  transform: scale(0.995);
  pointer-events: none;
  user-select: none;
}

.applicant-settings__upload-button,
.applicant-settings__save-button {
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.applicant-settings__upload-button--full,
.applicant-settings__save-button--full {
  width: 100%;
}

.applicant-settings__upload-button {
  border: 1px solid rgba(195, 205, 199, 0.98);
  background: #ffffff;
  color: #31423b;
}

.applicant-settings__save-button {
  border: 1px solid #26c281;
  background: #26c281;
  color: #fff;
}

.applicant-settings__save-button--inline {
  min-width: 7.25rem;
}

.applicant-settings__upload-button:hover,
.applicant-settings__save-button:hover {
  filter: brightness(0.98);
}

.applicant-settings__save-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.applicant-settings__save-loading {
  display: inline-flex;
  align-items: center;
  gap: 0.16rem;
}

.applicant-settings__save-loading span {
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
  animation: applicant-settings-save-dot 1s ease-in-out infinite;
}

.applicant-settings__save-loading span:nth-child(2) {
  animation-delay: 0.14s;
}

.applicant-settings__save-loading span:nth-child(3) {
  animation-delay: 0.28s;
}

.applicant-settings__saving-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(245, 248, 246, 0.38);
  backdrop-filter: blur(5px);
}

.applicant-settings__saving-card {
  width: min(22rem, 100%);
  display: grid;
  gap: 0.55rem;
  padding: 1.1rem 1rem;
  border: 1px solid rgba(203, 214, 208, 0.96);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 40px rgba(22, 35, 29, 0.14);
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.applicant-settings__saving-badge {
  width: fit-content;
  padding: 0.22rem 0.5rem;
  border: 1px solid rgba(180, 216, 196, 0.95);
  background: rgba(240, 253, 244, 0.92);
  color: #166534;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.applicant-settings__saving-card strong {
  color: #20312a;
  font-size: 1rem;
  font-weight: 800;
}

.applicant-settings__saving-card p {
  margin: 0;
  color: #607169;
  font-size: 0.78rem;
  line-height: 1.6;
}

.applicant-settings__saving-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #197145;
}

.applicant-settings__saving-dots span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.3;
  animation: applicant-settings-save-dot 1s ease-in-out infinite;
}

.applicant-settings__saving-dots span:nth-child(2) {
  animation-delay: 0.14s;
}

.applicant-settings__saving-dots span:nth-child(3) {
  animation-delay: 0.28s;
}

.applicant-settings__file-input {
  display: none;
}

.applicant-settings__status {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 0;
  font-size: 0.82rem;
  font-weight: 700;
}

.applicant-settings__status--success {
  border: 1px solid rgba(34, 197, 94, 0.2);
  background: rgba(240, 253, 244, 0.96);
  color: #166534;
}

.applicant-settings__status--error {
  border: 1px solid rgba(248, 113, 113, 0.2);
  background: rgba(255, 241, 242, 0.96);
  color: #b42318;
}

.applicant-settings__panel {
  padding: 1rem;
}

.applicant-settings__panel--form {
  width: 100%;
  max-width: none;
}

.applicant-settings__panel--compact {
  padding: 0.9rem;
}

.applicant-settings__panel--nested {
  padding: 0.9rem;
}

.applicant-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.applicant-settings__head-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.applicant-settings__edit-button {
  min-height: 2.35rem;
  padding: 0 0.95rem;
  border: 1px solid #26c281;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  background: #26c281;
  color: #ffffff;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.applicant-settings__edit-button--ghost {
  border-color: rgba(195, 205, 199, 0.98);
  background: #ffffff;
  color: #31423b;
}

.applicant-settings__edit-button:hover {
  filter: brightness(0.98);
}

.applicant-panel__head h3 {
  color: #325747;
  font-size: 0.88rem;
  font-weight: 700;
}

.applicant-panel__head span {
  color: #6d7d75;
  font-size: 0.7rem;
  font-weight: 600;
}

.applicant-settings__pager {
  display: inline-flex;
  gap: 0.45rem;
  margin-bottom: 0.9rem;
  padding: 0.24rem;
  border: 1px solid rgba(223, 230, 225, 0.95);
  background: #f8faf8;
}

.applicant-settings__pager-button {
  min-width: 8.5rem;
  min-height: 2.15rem;
  padding: 0 0.85rem;
  border: 0;
  background: transparent;
  color: #687872;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.applicant-settings__pager-button.is-active {
  background: #ffffff;
  color: #1f2937;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.applicant-settings__page-stack {
  display: grid;
  gap: 0.9rem;
}

.applicant-settings__lock-note {
  margin: 0 0 0.9rem;
  padding: 0.75rem 0.85rem;
  border: 1px dashed rgba(195, 205, 199, 0.98);
  background: #fbfcfa;
  color: #5c6e66;
  font-size: 0.76rem;
  line-height: 1.55;
}

.applicant-settings__lock-note strong {
  color: #20312a;
}

.applicant-settings__profile-page {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(18rem, 0.9fr);
  gap: 1rem;
  align-items: start;
}

.applicant-settings__profile-side {
  display: grid;
  gap: 0.9rem;
}

.applicant-settings__fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.applicant-settings__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.applicant-settings__field {
  display: grid;
  gap: 0.3rem;
}

.applicant-settings__field--wide {
  grid-column: 1 / -1;
}

.applicant-settings__field span {
  color: #52635b;
  font-size: 0.69rem;
  font-weight: 700;
}

.applicant-settings__field input,
.applicant-settings__field textarea {
  width: 100%;
  min-height: 2.45rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(213, 222, 216, 0.98);
  border-radius: 0;
  background: #fcfcfc;
  color: #20312a;
  font-size: 0.78rem;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.applicant-settings__field textarea {
  min-height: 4.75rem;
  resize: vertical;
}

.applicant-settings__fieldset:disabled .applicant-settings__field input,
.applicant-settings__fieldset:disabled .applicant-settings__field textarea {
  border-color: rgba(220, 227, 223, 0.98);
  background: #f6f8f7;
  color: #708079;
  cursor: not-allowed;
  box-shadow: none;
}

.applicant-settings__field input:focus,
.applicant-settings__field textarea:focus {
  outline: none;
  border-color: rgba(42, 138, 78, 0.34);
  box-shadow: 0 0 0 4px rgba(42, 138, 78, 0.08);
  background: #fff;
}

.applicant-settings__summary-list,
.applicant-settings__detail-list {
  display: grid;
  gap: 0.65rem;
}

.applicant-settings__favorites-list {
  display: grid;
  gap: 0.7rem;
}

.applicant-settings__favorite-card {
  display: grid;
  gap: 0.7rem;
  padding: 0.85rem;
  border: 1px solid rgba(231, 237, 232, 0.95);
  border-radius: 0;
  background: #fbfcfa;
}

.applicant-settings__favorite-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.applicant-settings__favorite-avatar {
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #8d8f89 0%, #686c64 100%);
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 800;
}

.applicant-settings__favorite-avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.applicant-settings__favorite-copy {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.applicant-settings__favorite-copy strong {
  color: #20312a;
  font-size: 0.82rem;
  line-height: 1.45;
}

.applicant-settings__favorite-copy span {
  color: #62746c;
  font-size: 0.72rem;
  line-height: 1.5;
}

.applicant-settings__favorite-meta {
  display: grid;
  gap: 0.35rem;
}

.applicant-settings__favorite-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #62746c;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.45;
}

.applicant-settings__favorites-empty {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem;
  border: 1px dashed rgba(213, 222, 216, 0.98);
  border-radius: 0;
  background: #fbfcfa;
}

.applicant-settings__favorites-empty i {
  color: #197145;
  font-size: 1.05rem;
}

.applicant-settings__favorites-empty strong {
  color: #20312a;
  font-size: 0.8rem;
}

.applicant-settings__favorites-empty span {
  color: #62746c;
  font-size: 0.72rem;
  line-height: 1.55;
}

.applicant-settings__summary-list--compact .applicant-settings__summary-item {
  padding: 0.72rem;
}

.applicant-settings__summary-item,
.applicant-settings__detail-item {
  display: grid;
  gap: 0.3rem;
  padding: 0.8rem;
  border: 1px solid rgba(231, 237, 232, 0.95);
  border-radius: 0;
  background: #fbfcfa;
}

.applicant-settings__summary-item {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
}

.applicant-settings__summary-icon {
  width: 2.2rem;
  height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  background: rgba(223, 244, 229, 0.96);
  color: #197145;
}

.applicant-settings__summary-item span,
.applicant-settings__detail-item span {
  color: #6a7b72;
  font-size: 0.68rem;
  font-weight: 700;
}

.applicant-settings__summary-item strong,
.applicant-settings__detail-item strong {
  color: #20312a;
  font-size: 0.76rem;
  line-height: 1.5;
}

.applicant-settings__resume-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(231, 237, 232, 0.95);
  background: linear-gradient(180deg, #fbfcfa 0%, #ffffff 100%);
}

.applicant-settings__resume-copy,
.applicant-settings__resume-copy h4,
.applicant-settings__resume-copy p {
  margin: 0;
}

.applicant-settings__resume-copy {
  display: grid;
  gap: 0.45rem;
}

.applicant-settings__resume-copy h4 {
  color: #20312a;
  font-size: 1rem;
  font-weight: 800;
}

.applicant-settings__resume-copy p:last-child {
  color: #607169;
  font-size: 0.78rem;
  line-height: 1.6;
}

.applicant-settings__resume-status {
  display: grid;
  gap: 0.45rem;
  padding: 0.9rem;
  border: 1px solid rgba(232, 214, 170, 0.95);
  background: rgba(255, 249, 235, 0.88);
}

.applicant-settings__resume-status.is-ready {
  border-color: rgba(191, 223, 203, 0.95);
  background: rgba(240, 253, 244, 0.92);
}

.applicant-settings__resume-pill {
  width: fit-content;
  padding: 0.22rem 0.48rem;
  border: 1px solid rgba(214, 196, 154, 0.95);
  color: #8b5e00;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.applicant-settings__resume-status.is-ready .applicant-settings__resume-pill {
  border-color: rgba(163, 211, 182, 0.95);
  color: #166534;
}

.applicant-settings__resume-status strong {
  color: #20312a;
  font-size: 0.82rem;
  line-height: 1.5;
}

.applicant-settings__resume-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.applicant-settings__resume-link {
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border: 1px solid rgba(195, 205, 199, 0.98);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  color: #31423b;
  font-size: 0.76rem;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.applicant-settings__resume-link:hover {
  background: #f8faf8;
  color: #20312a;
}

@keyframes applicant-settings-save-dot {
  0%,
  80%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-0.1rem);
  }
}

.applicant-settings-saving-enter-active,
.applicant-settings-saving-leave-active {
  transition: opacity 0.22s ease;
}

.applicant-settings-saving-enter-from,
.applicant-settings-saving-leave-to {
  opacity: 0;
}

.applicant-settings-saving-enter-from .applicant-settings__saving-card,
.applicant-settings-saving-leave-to .applicant-settings__saving-card {
  transform: translateY(0.45rem);
}

@media (max-width: 1200px) {
  .applicant-settings__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .applicant-settings__panel--form,
  .applicant-settings__grid,
  .applicant-settings__form-grid,
  .applicant-settings__profile-page {
    grid-template-columns: 1fr;
    max-width: 100%;
  }

  .applicant-panel__head {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 720px) {
  .applicant-settings {
    padding: 0;
  }

  .applicant-settings__mini-item {
    grid-template-columns: 1fr;
  }

  .applicant-settings__mini-item strong {
    text-align: left;
    max-width: 100%;
  }

  .applicant-settings__pager {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }

  .applicant-settings__pager-button {
    width: 100%;
  }

  .applicant-settings__resume-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .applicant-settings__profile-actions,
  .applicant-settings__head-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }

  .applicant-settings__upload-button,
  .applicant-settings__save-button,
  .applicant-settings__edit-button {
    width: 100%;
  }
}
</style>
