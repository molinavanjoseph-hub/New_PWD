<script setup>
import { computed, ref } from 'vue'
import { createAdminManagedAccount } from '@/lib/auth'

const emit = defineEmits(['created'])

const accountType = ref('applicant')
const isSubmitting = ref(false)
const formError = ref('')
const successMessage = ref('')
const applicantPwdIdFrontFile = ref(null)
const applicantPwdIdBackFile = ref(null)

const businessForm = ref({
  companyName: '',
  companyIndustry: '',
  contactNumber: '',
  email: '',
  password: '',
})

const applicantForm = ref({
  isNewEmployee: false,
  disabilityType: '',
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  presentAddress: '',
  provincialAddress: '',
  sameAsPresentAddress: false,
  telephoneNumber: '',
  phoneCountryCode: '+63',
  phoneNumber: '',
  birthdate: '',
  placeOfBirth: '',
  age: '',
  password: '',
})

const activeForm = computed(() => (
  accountType.value === 'applicant' ? applicantForm.value : businessForm.value
))

const sheetTitle = computed(() => (
  accountType.value === 'applicant' ? 'PWD Applicant Profile' : 'Business Account Sheet'
))

const sheetCopy = computed(() => (
  accountType.value === 'applicant'
    ? 'Enter the applicant details below to create a managed PWD applicant account.'
    : 'Enter the company details below to create a managed business account.'
))

const switchIndicatorStyle = computed(() => ({
  transform: accountType.value === 'business'
    ? 'translateX(calc(100% + 0.3rem))'
    : 'translateX(0)',
}))

const calculateAge = (birthdate) => {
  const parsedDate = new Date(birthdate)
  if (Number.isNaN(parsedDate.getTime())) return ''

  const today = new Date()
  let age = today.getFullYear() - parsedDate.getFullYear()
  const monthDiff = today.getMonth() - parsedDate.getMonth()
  const dayDiff = today.getDate() - parsedDate.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1
  return age > 0 ? String(age) : ''
}

const handleApplicantBirthdateChange = () => {
  applicantForm.value.age = calculateAge(applicantForm.value.birthdate)
}

const handlePresentAddressChange = () => {
  if (applicantForm.value.sameAsPresentAddress) {
    applicantForm.value.provincialAddress = applicantForm.value.presentAddress
  }
}

const handleSameAddressChange = () => {
  applicantForm.value.provincialAddress = applicantForm.value.sameAsPresentAddress
    ? applicantForm.value.presentAddress
    : ''
}

const handleApplicantFileChange = (event, side) => {
  const file = event?.target?.files?.[0] instanceof File ? event.target.files[0] : null
  if (side === 'front') {
    applicantPwdIdFrontFile.value = file
    return
  }

  applicantPwdIdBackFile.value = file
}

const resetMessages = () => {
  formError.value = ''
  successMessage.value = ''
}

const switchAccountType = (nextType) => {
  if (!['business', 'applicant'].includes(nextType)) return
  accountType.value = nextType
  resetMessages()
}

const resetActiveForm = () => {
  resetMessages()

  if (accountType.value === 'applicant') {
    applicantForm.value = {
      isNewEmployee: false,
      disabilityType: '',
      email: '',
      firstName: '',
      middleName: '',
      lastName: '',
      presentAddress: '',
      provincialAddress: '',
      sameAsPresentAddress: false,
      telephoneNumber: '',
      phoneCountryCode: '+63',
      phoneNumber: '',
      birthdate: '',
      placeOfBirth: '',
      age: '',
      password: '',
    }
    applicantPwdIdFrontFile.value = null
    applicantPwdIdBackFile.value = null
    return
  }

  businessForm.value = {
    companyName: '',
    companyIndustry: '',
    contactNumber: '',
    email: '',
    password: '',
  }
}

const submitCreateUser = async () => {
  resetMessages()
  isSubmitting.value = true

  try {
    const payload = {
      accountType: accountType.value,
      ...activeForm.value,
      pwdIdFrontFile: applicantPwdIdFrontFile.value,
      pwdIdBackFile: applicantPwdIdBackFile.value,
    }

    if (accountType.value === 'applicant' && !payload.age) {
      payload.age = calculateAge(payload.birthdate)
    }

    const result = await createAdminManagedAccount(payload)
    const createdUser = result?.user || {}
    const createdName = String(
      createdUser.name
      || activeForm.value.companyName
      || `${activeForm.value.firstName || ''} ${activeForm.value.lastName || ''}`.trim()
      || 'New account',
    ).trim()

    successMessage.value = `${createdName} was created successfully.`
    resetActiveForm()
    emit('created', {
      accountType: accountType.value,
      user: createdUser,
    })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to create the user right now.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="admin-create-user">
    <div class="admin-create-user__toolbar">
      <div class="admin-create-user__toolbar-copy">

      </div>

      <div class="admin-create-user__switch" role="tablist" aria-label="Account type">
        <span class="admin-create-user__switch-indicator" :style="switchIndicatorStyle" aria-hidden="true" />
        <button
          type="button"
          class="admin-create-user__switch-button"
          :class="{ 'is-active': accountType === 'applicant' }"
          @click="switchAccountType('applicant')"
        >
          Applicant
        </button>
        <button
          type="button"
          class="admin-create-user__switch-button"
          :class="{ 'is-active': accountType === 'business' }"
          @click="switchAccountType('business')"
        >
          Business
        </button>
      </div>
    </div>

    <form class="admin-create-user__sheet" @submit.prevent="submitCreateUser">
      <header class="admin-create-user__sheet-header">
        <h3 class="admin-create-user__sheet-title">{{ sheetTitle }}</h3>
        <p class="admin-create-user__sheet-copy">{{ sheetCopy }}</p>
      </header>

      <Transition name="admin-create-user__panel" mode="out-in">
        <div :key="accountType" class="admin-create-user__panel">
          <template v-if="accountType === 'applicant'">
            <label class="admin-create-user__checkline">
              <input v-model="applicantForm.isNewEmployee" type="checkbox">
              <span>
                <strong>Is this a new PWD applicant?</strong>
                <small>Check this box if this is a newly created applicant account.</small>
              </span>
            </label>

            <div class="admin-create-user__grid admin-create-user__grid--two">
              <label class="admin-create-user__field">
                <span>Disability*</span>
                <select v-model="applicantForm.disabilityType" required>
                  <option value="" disabled>Select disability</option>
                  <option value="Deaf or Hard of Hearing">Deaf or Hard of Hearing</option>
                  <option value="Visual Disability">Visual Disability</option>
                  <option value="Physical Disability">Physical Disability</option>
                  <option value="Psychosocial Disability">Psychosocial Disability</option>
                  <option value="Intellectual Disability">Intellectual Disability</option>
                  <option value="Learning Disability">Learning Disability</option>
                  <option value="Speech and Language Impairment">Speech and Language Impairment</option>
                  <option value="Autism Spectrum Disorder">Autism Spectrum Disorder</option>
                  <option value="Chronic Illness">Chronic Illness</option>
                  <option value="Multiple Disabilities">Multiple Disabilities</option>
                </select>
              </label>

              <label class="admin-create-user__field">
                <span>Email Address*</span>
                <input v-model.trim="applicantForm.email" type="email" placeholder="Enter email address" required>
              </label>
            </div>

            <div class="admin-create-user__grid admin-create-user__grid--three">
              <label class="admin-create-user__field">
                <span>First Name*</span>
                <input v-model.trim="applicantForm.firstName" type="text" placeholder="Enter first name" required>
              </label>

              <label class="admin-create-user__field">
                <span>Middle Name <small>(Optional)</small></span>
                <input v-model.trim="applicantForm.middleName" type="text" placeholder="Enter middle name">
              </label>

              <label class="admin-create-user__field">
                <span>Last Name*</span>
                <input v-model.trim="applicantForm.lastName" type="text" placeholder="Enter last name" required>
              </label>
            </div>

            <label class="admin-create-user__field">
              <span>Present Address*</span>
              <input
                v-model.trim="applicantForm.presentAddress"
                type="text"
                placeholder="Enter present address"
                required
                @input="handlePresentAddressChange"
              >
            </label>

            <label class="admin-create-user__field">
              <span>Provincial Address*</span>
              <input
                v-model.trim="applicantForm.provincialAddress"
                type="text"
                placeholder="Enter provincial address"
                :disabled="applicantForm.sameAsPresentAddress"
                required
              >
            </label>

            <label class="admin-create-user__checkline">
              <input v-model="applicantForm.sameAsPresentAddress" type="checkbox" @change="handleSameAddressChange">
              <span>
                <strong>Is same with present address?</strong>
              </span>
            </label>

            <div class="admin-create-user__grid admin-create-user__grid--two">
              <label class="admin-create-user__field">
                <span>Telephone No. <small>(Optional)</small></span>
                <input v-model.trim="applicantForm.telephoneNumber" type="text" placeholder="Enter telephone number">
              </label>

              <label class="admin-create-user__field">
                <span>Phone No.*</span>
                <div class="admin-create-user__phone">
                  <select v-model="applicantForm.phoneCountryCode" class="admin-create-user__phone-code">
                    <option value="+63">PH +63</option>
                    <option value="+1">US +1</option>
                    <option value="+44">UK +44</option>
                  </select>
                  <input v-model.trim="applicantForm.phoneNumber" type="text" placeholder="Enter phone number" required>
                </div>
              </label>
            </div>

            <div class="admin-create-user__grid admin-create-user__grid--three">
              <label class="admin-create-user__field">
                <span>Date of Birth*</span>
                <input v-model="applicantForm.birthdate" type="date" required @change="handleApplicantBirthdateChange">
              </label>

              <label class="admin-create-user__field">
                <span>Place of Birth*</span>
                <input v-model.trim="applicantForm.placeOfBirth" type="text" placeholder="Enter place of birth" required>
              </label>

              <label class="admin-create-user__field">
                <span>Age*</span>
                <input v-model="applicantForm.age" type="number" min="1" placeholder="Enter age" required>
              </label>
            </div>

            <div class="admin-create-user__grid admin-create-user__grid--two">
              <label class="admin-create-user__field admin-create-user__field--upload">
                <span>PWD ID Front</span>
                <input type="file" accept="image/*,.pdf" @change="handleApplicantFileChange($event, 'front')">
                <small>{{ applicantPwdIdFrontFile?.name || 'Upload the front side of the PWD ID' }}</small>
              </label>

              <label class="admin-create-user__field admin-create-user__field--upload">
                <span>PWD ID Back</span>
                <input type="file" accept="image/*,.pdf" @change="handleApplicantFileChange($event, 'back')">
                <small>{{ applicantPwdIdBackFile?.name || 'Upload the back side of the PWD ID' }}</small>
              </label>
            </div>

            <label class="admin-create-user__field">
              <span>Password*</span>
              <input v-model="applicantForm.password" type="password" minlength="6" placeholder="Enter password" required>
            </label>
          </template>

          <template v-else>
            <div class="admin-create-user__grid admin-create-user__grid--three">
              <label class="admin-create-user__field">
                <span>Company Name*</span>
                <input v-model.trim="businessForm.companyName" type="text" placeholder="Enter company name" required>
              </label>

              <label class="admin-create-user__field">
                <span>Industry*</span>
                <input v-model.trim="businessForm.companyIndustry" type="text" placeholder="Enter industry" required>
              </label>

              <label class="admin-create-user__field">
                <span>Contact Number</span>
                <input v-model.trim="businessForm.contactNumber" type="text" placeholder="Enter contact number">
              </label>
            </div>

            <div class="admin-create-user__grid admin-create-user__grid--two">
              <label class="admin-create-user__field">
                <span>Email Address*</span>
                <input v-model.trim="businessForm.email" type="email" placeholder="Enter email address" required>
              </label>

              <label class="admin-create-user__field">
                <span>Password*</span>
                <input v-model="businessForm.password" type="password" minlength="6" placeholder="Enter password" required>
              </label>
            </div>
          </template>
        </div>
      </Transition>

      <p v-if="formError" class="admin-create-user__message admin-create-user__message--error">{{ formError }}</p>
      <p v-if="successMessage" class="admin-create-user__message admin-create-user__message--success">{{ successMessage }}</p>

      <div class="admin-create-user__actions">
        <button type="button" class="admin-create-user__ghost" :disabled="isSubmitting" @click="resetActiveForm">
          <i class="bi bi-eraser" aria-hidden="true" />
          Clear
        </button>
        <button type="submit" class="admin-create-user__submit" :disabled="isSubmitting">
          <i class="bi bi-person-plus" aria-hidden="true" />
          {{ isSubmitting ? 'Creating...' : 'Create User' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.admin-create-user {
  display: grid;
  gap: 1rem;
}

.admin-create-user__toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.admin-create-user__toolbar h2 {
  margin: 0;
  color: #151821;
  font-size: 1.15rem;
  font-weight: 700;
}

.admin-create-user__title {
  color: #20242d;
  opacity: 1;
}

.admin-create-user__switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 14rem;
  gap: 0.3rem;
  padding: 0.28rem;
  border: 1px solid #e4e7ec;
  border-radius: 0.75rem;
  background: #f8fafc;
  isolation: isolate;
}

.admin-create-user__switch-indicator {
  position: absolute;
  top: 0.28rem;
  bottom: 0.28rem;
  left: 0.28rem;
  width: calc(50% - 0.43rem);
  border-radius: 0.6rem;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
  transition: transform 0.28s ease;
  z-index: 0;
}

.admin-create-user__switch-button {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: #5e6470;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.58rem 0.9rem;
  transition: color 0.22s ease, transform 0.22s ease;
}

.admin-create-user__switch-button.is-active {
  color: #13161d;
}

.admin-create-user__switch-button:hover {
  color: #13161d;
}

.admin-create-user__switch-button:focus-visible {
  outline: none;
  color: #13161d;
}

.admin-create-user__panel {
  display: grid;
  gap: 0.85rem;
}

.admin-create-user__panel-enter-active,
.admin-create-user__panel-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.admin-create-user__panel-enter-from,
.admin-create-user__panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.admin-create-user__sheet {
  display: grid;
  gap: 0.85rem;
  padding: 1.15rem;
  border: 1px solid #e6e7eb;
  border-radius: 1rem;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(16, 24, 40, 0.04);
}

.admin-create-user__sheet-header h3 {
  margin: 0;
  color: #151821;
  font-size: 1.06rem;
  font-weight: 700;
}

.admin-create-user__sheet-title {
  color: #20242d;
  opacity: 1;
}

.admin-create-user__sheet-header p {
  margin: 0.22rem 0 0;
  color: #7a8190;
  font-size: 0.75rem;
  line-height: 1.45;
}

.admin-create-user__sheet-copy {
  color: #636b78;
  opacity: 1;
}

.admin-create-user__checkline {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  color: #1f2937;
}

.admin-create-user__checkline input {
  margin-top: 0.18rem;
}

.admin-create-user__checkline span {
  display: grid;
  gap: 0.06rem;
}

.admin-create-user__checkline strong {
  color: #222833;
  font-size: 0.76rem;
  font-weight: 700;
}

.admin-create-user__checkline small {
  color: #697281;
  font-size: 0.7rem;
  line-height: 1.35;
}

.admin-create-user__grid {
  display: grid;
  gap: 0.65rem;
}

.admin-create-user__grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-create-user__grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.admin-create-user__field {
  display: grid;
  gap: 0.26rem;
}

.admin-create-user__field--spacer {
  visibility: hidden;
  pointer-events: none;
}

.admin-create-user__field--upload {
  align-content: start;
}

.admin-create-user__field span {
  color: #1f2937;
  font-size: 0.74rem;
  font-weight: 700;
}

.admin-create-user__field small {
  color: #8a92a3;
  font-size: 0.68rem;
  font-weight: 600;
}

.admin-create-user__field input,
.admin-create-user__field select {
  width: 100%;
  min-height: 2.25rem;
  padding: 0.55rem 0.72rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.45rem;
  background: #ffffff;
  color: #111827;
  font: inherit;
  font-size: 0.8rem;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.admin-create-user__field select {
  appearance: none;
}

.admin-create-user__field input::placeholder {
  color: #a1a7b3;
}

.admin-create-user__field input:focus,
.admin-create-user__field select:focus {
  outline: none;
  border-color: #b9c0cb;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
}

.admin-create-user__field input:disabled {
  background: #f8fafc;
  color: #8b93a4;
}

.admin-create-user__phone {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 0.5rem;
}

.admin-create-user__phone-code {
  min-width: 0;
}

.admin-create-user__message {
  margin: 0;
  padding: 0.72rem 0.82rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.55rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.admin-create-user__message--error {
  border-color: #f1c7c7;
  background: #fff7f7;
  color: #9a3b3b;
}

.admin-create-user__message--success {
  border-color: #cfe6d5;
  background: #f6fbf7;
  color: #2f6b45;
}

.admin-create-user__actions {
  display: flex;
  justify-content: end;
  gap: 0.6rem;
  margin-top: 0.15rem;
}

.admin-create-user__ghost,
.admin-create-user__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.45rem;
  padding: 0.55rem 1rem;
  border-radius: 0.82rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.admin-create-user__ghost i,
.admin-create-user__submit i {
  font-size: 0.82rem;
}

.admin-create-user__ghost {
  border: 1px solid #d7dfd9;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
}

.admin-create-user__submit {
  border: 1px solid #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.admin-create-user__ghost:hover,
.admin-create-user__submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

.admin-create-user__ghost:disabled,
.admin-create-user__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 980px) {
  .admin-create-user__grid--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .admin-create-user__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-create-user__grid--two,
  .admin-create-user__grid--three,
  .admin-create-user__phone {
    grid-template-columns: 1fr;
  }

  .admin-create-user__actions {
    flex-direction: column-reverse;
  }
}
</style>
