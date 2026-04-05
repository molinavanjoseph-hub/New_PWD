<script setup>
import { computed } from 'vue'

const props = defineProps({
  toast: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close'])

const toastKind = computed(() => {
  const normalizedKind = String(props.toast?.kind || 'info').trim().toLowerCase()
  return ['success', 'error', 'warning', 'info'].includes(normalizedKind) ? normalizedKind : 'info'
})

const toastIcon = computed(() => {
  if (toastKind.value === 'error') return 'bi bi-x-circle-fill'
  if (toastKind.value === 'warning') return 'bi bi-exclamation-triangle-fill'
  if (toastKind.value === 'success') return 'bi bi-check-circle-fill'
  return 'bi bi-info-circle-fill'
})
</script>

<template>
  <transition name="app-toast">
    <div v-if="toast" class="app-toast" :class="`app-toast--${toastKind}`" role="status" aria-live="polite">
      <div class="app-toast__icon" :class="`app-toast__icon--${toastKind}`" aria-hidden="true">
        <i :class="toastIcon" />
      </div>
      <div class="app-toast__copy">
        <strong>{{ toast.title || (toastKind === 'error' ? 'Error' : 'Notice') }}</strong>
        <span>{{ toast.text }}</span>
      </div>
      <button type="button" class="app-toast__close" aria-label="Close notification" @click="emit('close')">
        <i class="bi bi-x-lg" />
      </button>
    </div>
  </transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 140;
  width: min(25rem, calc(100vw - 2rem));
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: start;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(212, 224, 217, 0.95);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 22px 42px rgba(16, 41, 29, 0.16);
  backdrop-filter: blur(12px);
}

.app-toast--error {
  border-color: rgba(240, 199, 199, 0.95);
}

.app-toast--warning {
  border-color: rgba(240, 221, 177, 0.95);
}

.app-toast--success {
  border-color: rgba(191, 223, 203, 0.95);
}

.app-toast__icon {
  width: 2.35rem;
  height: 2.35rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-size: 1.1rem;
}

.app-toast__icon--error {
  background: rgba(254, 226, 226, 0.98);
  color: #b91c1c;
}

.app-toast__icon--warning {
  background: rgba(255, 244, 221, 0.98);
  color: #a16207;
}

.app-toast__icon--success {
  background: rgba(220, 252, 231, 0.98);
  color: #166534;
}

.app-toast__icon--info {
  background: rgba(219, 234, 254, 0.98);
  color: #1d4ed8;
}

.app-toast__copy {
  display: grid;
  gap: 0.22rem;
}

.app-toast__copy strong,
.app-toast__copy span {
  display: block;
}

.app-toast__copy strong {
  color: #173126;
  font-size: 0.94rem;
  font-weight: 800;
}

.app-toast__copy span {
  color: #53675d;
  font-size: 0.82rem;
  line-height: 1.5;
}

.app-toast__close {
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #7c8f86;
  cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
}

.app-toast__close:hover {
  color: #173126;
  transform: scale(1.04);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translate3d(0, -0.55rem, 0);
}

@media (max-width: 640px) {
  .app-toast {
    top: 0.85rem;
    right: 0.85rem;
    width: calc(100vw - 1.2rem);
  }
}
</style>
