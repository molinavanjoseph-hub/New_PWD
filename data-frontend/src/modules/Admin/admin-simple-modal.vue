<script setup>
import { computed } from 'vue'

const emit = defineEmits(['close'])

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Modal',
  },
  subtitle: {
    type: String,
    default: '',
  },
  closeLabel: {
    type: String,
    default: 'Close',
  },
  showCloseButton: {
    type: Boolean,
    default: true,
  },
  maxWidth: {
    type: String,
    default: '34rem',
  },
})

const headingId = computed(() =>
  `admin-simple-modal-${String(props.title || 'modal').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-simple-modal" @click.self="emit('close')">
      <div
        class="admin-simple-modal__card"
        :style="{ '--admin-simple-modal-width': props.maxWidth }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
      >
        <header class="admin-simple-modal__head">
          <div class="admin-simple-modal__copy">
            <h2 :id="headingId">{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>

          <button v-if="showCloseButton" type="button" class="admin-simple-modal__close" @click="emit('close')">
            {{ closeLabel }}
          </button>
        </header>

        <div class="admin-simple-modal__body">
          <slot />
        </div>

        <footer v-if="$slots.actions" class="admin-simple-modal__actions">
          <slot name="actions" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.admin-simple-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  padding: 1rem;
  display: grid;
  place-items: center;
  background: rgba(18, 27, 22, 0.42);
}

.admin-simple-modal__card {
  width: min(var(--admin-simple-modal-width, 34rem), 100%);
  max-height: min(88vh, 46rem);
  overflow: auto;
  border-radius: 1rem;
  border: 1px solid rgba(124, 166, 140, 0.18);
  background: #fff;
  box-shadow: 0 24px 44px rgba(25, 39, 31, 0.14);
}

.admin-simple-modal__head {
  padding: 1rem 1rem 0.85rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(122, 179, 145, 0.12);
}

.admin-simple-modal__copy {
  display: grid;
  gap: 0.2rem;
}

.admin-simple-modal__copy h2 {
  margin: 0;
  color: #244132;
  font-size: 1rem;
  font-weight: 700;
}

.admin-simple-modal__copy p {
  margin: 0;
  color: #678070;
  font-size: 0.82rem;
  line-height: 1.5;
}

.admin-simple-modal__close {
  min-height: 2.25rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.7rem;
  padding: 0 0.85rem;
  background: #fff;
  color: #476857;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-simple-modal__body {
  padding: 1rem;
}

.admin-simple-modal__actions {
  padding: 0 1rem 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

@media (max-width: 700px) {
  .admin-simple-modal {
    padding: 0.7rem;
  }

  .admin-simple-modal__head,
  .admin-simple-modal__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
