<script setup>
import { ref } from 'vue'
import FaceVerify from '@/authenticator/Face_Recognition/Face_Verify.vue'

const selfieFile = ref(null)
const isComplete = ref(false)
const statusText = ref('')

const handleSelfieSelected = (file) => {
  selfieFile.value = file
}

const handleStatusChange = (value) => {
  isComplete.value = Boolean(value)
}

const handleComplete = ({ idCardFileName }) => {
  statusText.value = 'Verification complete. Returning to your registration tab...'

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      {
        type: 'client-verification-complete',
        selfieFile: selfieFile.value,
        idCardFileName,
        completed: true,
      },
      window.location.origin,
    )

    window.opener.focus()
    window.setTimeout(() => window.close(), 250)
    return
  }

  statusText.value = 'Main registration tab was not found. You can reopen verification from the form.'
}
</script>

<template>
  <main class="client-verification-page">
    <div class="client-verification-page__inner">
      <FaceVerify
        standalone
        :has-selfie="Boolean(selfieFile)"
        :is-complete="isComplete"
        @selfie-selected="handleSelfieSelected"
        @status-change="handleStatusChange"
        @complete="handleComplete"
      />
      <p v-if="statusText" class="client-verification-page__status">{{ statusText }}</p>
    </div>
  </main>
</template>

<style scoped src="@/authenticator/Face_Recognition/face_verify.css"></style>
