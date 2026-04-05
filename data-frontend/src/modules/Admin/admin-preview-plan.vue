<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import mathLogo from '@/assets/math.png'
import {
  BUSINESS_MODULE_CATALOG,
  DEFAULT_PREMIUM_PLAN_RECORD,
  deleteAdminPlanRecord,
  isPremiumPlanRecord,
  normalizePlanRecord,
  readAdminPlanCatalog,
  subscribeToAdminPlanCatalog,
  toggleAdminPlanEnabled,
} from '@/lib/business_plan_access'

const emit = defineEmits(['create-new', 'plan-status-updated'])

const plans = ref([])
const isActionLoading = ref(false)
const actionProgress = ref(0)
const activeActionPlanId = ref('')
let actionLoaderInterval = 0
let stopPlanCatalogSubscription = () => {}

const clearActionLoader = () => {
  if (typeof window === 'undefined' || !actionLoaderInterval) return
  window.clearInterval(actionLoaderInterval)
  actionLoaderInterval = 0
}

const refreshPlans = async () => {
  plans.value = await readAdminPlanCatalog()
}

const displayPlans = computed(() => {
  const normalizedPlans = Array.isArray(plans.value) ? plans.value.map((plan) => normalizePlanRecord(plan)) : []
  const hasPremiumPlan = normalizedPlans.some((plan) => isPremiumPlanRecord(plan))
  return hasPremiumPlan
    ? normalizedPlans
    : [normalizePlanRecord(DEFAULT_PREMIUM_PLAN_RECORD), ...normalizedPlans]
})

const groupedModulesForPlan = (plan) =>
  BUSINESS_MODULE_CATALOG.filter((module) => Array.isArray(plan?.moduleAccess) && plan.moduleAccess.includes(module.id))

const emptyStateCopy = computed(() =>
  displayPlans.value.length
    ? ''
    : 'No subscription plans saved yet. Create a plan first and it will appear here.',
)

const handleDelete = async (plan) => {
  const planName = String(plan?.name || 'this plan').trim()
  if (typeof window !== 'undefined' && !window.confirm(`Delete ${planName}?`)) return

  try {
    plans.value = await deleteAdminPlanRecord(plan?.id)
  } catch {
    emit('plan-status-updated', {
      kind: 'error',
      message: `Could not delete ${planName}. Check Firestore access and try again.`,
    })
  }
}

const handleToggleEnabled = async (plan) => {
  if (isActionLoading.value) return

  const planName = String(plan?.name || 'Plan').trim() || 'Plan'
  const nextEnabled = !plan?.isEnabled
  isActionLoading.value = true
  actionProgress.value = 14
  activeActionPlanId.value = String(plan?.id || '')

  if (typeof window !== 'undefined') {
    clearActionLoader()
    actionLoaderInterval = window.setInterval(() => {
      actionProgress.value = Math.min(actionProgress.value + 16, 86)
    }, 90)
  }

  try {
    await new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve()
        return
      }

      window.setTimeout(resolve, 360)
    })

    await toggleAdminPlanEnabled(plan?.id, nextEnabled)
    await nextTick()
    actionProgress.value = 100

    await new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve()
        return
      }

      window.setTimeout(resolve, 140)
    })

    emit('plan-status-updated', {
      kind: 'success',
      message: `${planName} ${nextEnabled ? 'enabled' : 'disabled'} successfully.`,
    })
  } catch {
    emit('plan-status-updated', {
      kind: 'error',
      message: `Could not update ${planName}. Check Firestore access and try again.`,
    })
  } finally {
    clearActionLoader()
    isActionLoading.value = false
    actionProgress.value = 0
    activeActionPlanId.value = ''
  }
}

onMounted(() => {
  void refreshPlans()
  void subscribeToAdminPlanCatalog(
    (nextPlans) => {
      plans.value = nextPlans
    },
    () => {
      emit('plan-status-updated', {
        kind: 'error',
        message: 'Could not subscribe to Firestore plan updates.',
      })
    },
  ).then((unsubscribe) => {
    stopPlanCatalogSubscription = typeof unsubscribe === 'function' ? unsubscribe : () => {}
  })
})

onBeforeUnmount(() => {
  clearActionLoader()
  stopPlanCatalogSubscription()
})
</script>

<template>
  <section class="admin-plan-preview-shell">
    <div v-if="isActionLoading" class="admin-plan-preview-shell__overlay" aria-live="polite" aria-label="Waiting for plan update">
      <div class="admin-plan-preview-shell__loader">
        <div class="admin-plan-preview-shell__loader-rubics" aria-hidden="true">
          <span class="admin-plan-preview-shell__loader-cube admin-plan-preview-shell__loader-cube--one" />
          <span class="admin-plan-preview-shell__loader-cube admin-plan-preview-shell__loader-cube--two" />
          <span class="admin-plan-preview-shell__loader-cube admin-plan-preview-shell__loader-cube--three" />
          <span class="admin-plan-preview-shell__loader-cube admin-plan-preview-shell__loader-cube--four" />
          <div class="admin-plan-preview-shell__loader-logo">
            <img :src="mathLogo" alt="Waiting" />
          </div>
        </div>
        <strong>Waiting</strong>
      </div>
    </div>

    <div class="admin-plan-preview-shell__content" :class="{ 'is-blurred': isActionLoading }">
      <header class="admin-plan-preview-shell__head">
        <div>
          <h2>Subscription Preview</h2>
          <p>These cards mirror the same premium subscription direction shown in the employer workspace.</p>
        </div>

      </header>

      <div v-if="displayPlans.length" class="admin-plan-list-grid">
        <article
          v-for="plan in displayPlans"
          :key="plan.id"
          class="admin-plan-list-card"
          :class="`admin-plan-list-card--${plan.tone || 'premium'}`"
        >
          <div class="admin-plan-list-card__top">
            <div>
              <h3>{{ plan.name }}</h3>
              <p class="admin-plan-list-card__subtitle">{{ plan.subtitle || 'No plan subtitle added yet.' }}</p>
            </div>
            <div class="admin-plan-list-card__status">
              <span class="admin-plan-list-card__toggle-state" :class="{ 'is-live': plan.isEnabled }">
                {{ plan.isEnabled ? 'Enabled' : 'Disabled' }}
              </span>
              <span v-if="plan.badge" class="admin-plan-list-card__pill">{{ plan.badge }}</span>
            </div>
          </div>

          <div class="admin-plan-list-card__body">
            <strong class="admin-plan-list-card__price">{{ plan.price }}</strong>
            <span class="admin-plan-list-card__caption">{{ plan.description || 'No price caption provided.' }}</span>
          </div>

          <ul class="admin-plan-list-card__features">
            <li v-for="feature in plan.features" :key="feature">
              <i class="bi bi-check2-circle" aria-hidden="true" />
              <span>{{ feature }}</span>
            </li>
            <li v-if="!plan.features.length">
              <i class="bi bi-check2-circle" aria-hidden="true" />
              <span>No features added yet.</span>
            </li>
          </ul>

          <section class="admin-plan-list-card__access">
            <div class="admin-plan-list-card__access-head">
              <div>
                <strong>Enabled Modules</strong>
                <p>{{ groupedModulesForPlan(plan).length }} workspace items unlocked by this plan.</p>
              </div>
              <span>{{ groupedModulesForPlan(plan).length }}</span>
            </div>

            <div class="admin-plan-list-card__access-grid">
              <span
                v-for="module in groupedModulesForPlan(plan)"
                :key="module.id"
                class="admin-plan-list-card__access-tag admin-plan-list-card__access-tag--selected"
              >
                <span class="admin-plan-list-card__access-tag-copy">{{ module.label }}</span>
              </span>
              <p v-if="!groupedModulesForPlan(plan).length" class="admin-plan-list-card__access-empty">
                This plan does not unlock any modules yet.
              </p>
            </div>
          </section>

          <div class="admin-plan-list-card__actions">
            <button
              type="button"
              class="admin-table-action"
              :class="plan.isEnabled ? 'admin-table-action--warning' : 'admin-table-action--success'"
              :disabled="isActionLoading"
              @click="handleToggleEnabled(plan)"
            >
              <template v-if="isActionLoading && activeActionPlanId === plan.id">
                <span class="admin-table-action__spinner" aria-hidden="true" />
                {{ plan.isEnabled ? 'Disabling...' : 'Enabling...' }}
              </template>
              <template v-else>
                <i :class="plan.isEnabled ? 'bi bi-pause-circle' : 'bi bi-check-circle'" aria-hidden="true" />
                {{ plan.isEnabled ? 'Disable' : 'Enable' }}
              </template>
            </button>
            <button type="button" class="admin-table-action admin-table-action--danger admin-plan-list-card__delete" :disabled="isActionLoading" @click="handleDelete(plan)">
              <i class="bi bi-trash3" aria-hidden="true" />
              Delete
            </button>
          </div>

          <p class="admin-plan-list-card__note">{{ plan.trialNote || 'No extra plan note added yet.' }}</p>
        </article>
      </div>

      <div v-else class="admin-plan-list-empty">
        <i class="bi bi-card-checklist" aria-hidden="true" />
        <strong>Subscription cards will appear here.</strong>
        <p>{{ emptyStateCopy }}</p>
        <button type="button" class="admin-table-action" @click="emit('create-new')">
          Start Creating
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-plan-preview-shell { position: relative; display: grid; gap: 1rem; min-height: 18rem; }
.admin-plan-preview-shell__content { display: grid; gap: 1rem; transition: filter 0.24s ease, transform 0.24s ease; }
.admin-plan-preview-shell__content.is-blurred { filter: blur(10px); transform: scale(0.995); pointer-events: none; user-select: none; }
.admin-plan-preview-shell__overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  border-radius: 1.2rem;
  background: rgba(244, 250, 246, 0.52);
  backdrop-filter: blur(8px);
}
.admin-plan-preview-shell__loader { display: grid; justify-items: center; gap: 0.95rem; }
.admin-plan-preview-shell__loader strong { color: #1a3328; font-size: 1.02rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.admin-plan-preview-shell__loader-rubics {
  position: relative;
  width: 7rem;
  height: 7rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.52rem;
  animation: admin-plan-rubics-spin 2.8s linear infinite;
}
.admin-plan-preview-shell__loader-cube {
  display: block;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(228, 245, 234, 0.98) 100%);
  border: 1px solid rgba(161, 215, 183, 0.92);
  box-shadow: 0 10px 18px rgba(39, 113, 77, 0.12);
}
.admin-plan-preview-shell__loader-cube--one { animation: admin-plan-rubics-float 1.6s ease-in-out infinite; }
.admin-plan-preview-shell__loader-cube--two { animation: admin-plan-rubics-float 1.6s ease-in-out infinite 0.15s; }
.admin-plan-preview-shell__loader-cube--three { animation: admin-plan-rubics-float 1.6s ease-in-out infinite 0.3s; }
.admin-plan-preview-shell__loader-cube--four { animation: admin-plan-rubics-float 1.6s ease-in-out infinite 0.45s; }
.admin-plan-preview-shell__loader-logo {
  position: absolute;
  inset: 50%;
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(183, 225, 199, 0.95);
  box-shadow: 0 12px 22px rgba(22, 73, 49, 0.14);
  transform: translate(-50%, -50%);
}
.admin-plan-preview-shell__loader-logo img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}
.admin-plan-preview-shell__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem 1rem 0; }
.admin-plan-preview-shell__head h2 { margin: 0; color: #183126; font-size: 1.2rem; }
.admin-plan-preview-shell__head p { margin: 0.35rem 0 0; color: #698274; font-size: 0.84rem; line-height: 1.6; }
.admin-plan-list-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(17.5rem, 21rem)); gap: 0.85rem; padding: 0 1rem 1rem; justify-content: flex-start; align-items: start; }
.admin-plan-list-card { display: grid; align-content: start; align-self: start; gap: 0.82rem; padding: 0.95rem; border: 1px solid rgba(214, 227, 219, 0.92); border-radius: 1.2rem; background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 250, 247, 0.97) 100%); box-shadow: 0 14px 26px rgba(71, 112, 90, 0.08); }
.admin-plan-list-card--premium { background: radial-gradient(circle at top right, rgba(37, 168, 104, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(241, 251, 245, 0.96) 100%); }
.admin-plan-list-card--trial { background: radial-gradient(circle at top right, rgba(39, 122, 214, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(241, 247, 255, 0.96) 100%); }
.admin-plan-list-card--starter { background: radial-gradient(circle at top right, rgba(214, 158, 39, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 250, 241, 0.96) 100%); }
.admin-plan-list-card--free { background: radial-gradient(circle at top right, rgba(129, 140, 153, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 248, 250, 0.96) 100%); }
.admin-plan-list-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; }
.admin-plan-list-card__status { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 0.4rem; }
.admin-plan-list-card__top h3 { margin: 0; color: #183126; font-size: 0.98rem; line-height: 1.15; }
.admin-plan-list-card__subtitle { margin: 0.32rem 0 0; color: #678173; font-size: 0.76rem; line-height: 1.5; }
.admin-plan-list-card__pill { display: inline-flex; align-items: center; min-height: 1.95rem; padding: 0 0.8rem; border-radius: 999px; background: rgba(35, 145, 89, 0.12); color: #23724b; font-size: 0.74rem; font-weight: 800; }
.admin-plan-list-card__toggle-state { display: inline-flex; align-items: center; min-height: 1.95rem; padding: 0 0.78rem; border-radius: 999px; background: #fff3f3; color: #b14242; border: 1px solid #f2c9c9; font-size: 0.72rem; font-weight: 800; }
.admin-plan-list-card__toggle-state.is-live { background: #eef8f2; color: #23724b; border-color: #cde7d8; }
.admin-plan-list-card__body { display: grid; gap: 0.2rem; }
.admin-plan-list-card__price { color: #173026; font-size: 1.2rem; font-weight: 900; }
.admin-plan-list-card__caption { color: #617a6d; font-size: 0.72rem; font-weight: 600; }
.admin-plan-list-card__features { display: grid; gap: 0.55rem; margin: 0; padding: 0.9rem 0 0; list-style: none; border-top: 1px solid rgba(214, 227, 219, 0.88); }
.admin-plan-list-card__features li { display: flex; align-items: flex-start; gap: 0.45rem; color: #315043; font-size: 0.75rem; line-height: 1.5; }
.admin-plan-list-card__features i { color: #2f9d60; margin-top: 0.06rem; }
.admin-plan-list-card__access { display: grid; gap: 0.7rem; padding-top: 0.85rem; border-top: 1px solid rgba(214, 227, 219, 0.88); }
.admin-plan-list-card__access-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; }
.admin-plan-list-card__access-head strong { color: #183126; font-size: 0.9rem; }
.admin-plan-list-card__access-head p { margin: 0.22rem 0 0; color: #698173; font-size: 0.77rem; line-height: 1.5; }
.admin-plan-list-card__access-head span { display: inline-flex; align-items: center; min-height: 1.85rem; padding: 0 0.68rem; border-radius: 999px; border: 1px solid #d8e2dc; background: #fff; color: #51695c; font-size: 0.74rem; font-weight: 800; }
.admin-plan-list-card__access-grid { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.admin-plan-list-card__access-tag { display: inline-flex; align-items: center; min-height: 2rem; border-radius: 999px; border: 1px solid #d7e2dc; background: #fff; }
.admin-plan-list-card__access-tag-copy { display: inline-flex; align-items: center; padding: 0 0.66rem; color: #355143; font-size: 0.71rem; font-weight: 700; }
.admin-plan-list-card__access-empty, .admin-plan-list-card__note { margin: 0; color: #74867b; font-size: 0.76rem; line-height: 1.5; }
.admin-plan-list-card__actions { display: flex; gap: 0.55rem; padding-top: 0.15rem; }
.admin-table-action { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; min-height: 2.45rem; padding: 0 0.9rem; border: 1px solid #d7dfd9; border-radius: 0.82rem; background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%); color: #173026; font-size: 0.74rem; font-weight: 800; cursor: pointer; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease; }
.admin-table-action i { font-size: 0.82rem; }
.admin-table-action:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12); }
.admin-table-action:disabled { cursor: wait; opacity: 0.88; transform: none; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); }
.admin-table-action__spinner { width: 0.92rem; height: 0.92rem; border-radius: 999px; border: 2px solid currentColor; border-right-color: transparent; animation: admin-plan-action-spin 0.7s linear infinite; }
.admin-table-action--success { border-color: #cfe6d7; background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%); color: #1f6f46; }
.admin-table-action--ghost { flex: 1 1 auto; background: linear-gradient(180deg, #f8fbf9 0%, #edf4f0 100%); color: #305141; border: 1px solid #d5e0da; }
.admin-table-action--danger { border-color: #f1cdcd; background: linear-gradient(180deg, #ffffff 0%, #fff3f3 100%); color: #b14242; }
.admin-table-action--warning { border-color: #f1debb; background: linear-gradient(180deg, #ffffff 0%, #fff6e7 100%); color: #ad7217; }
.admin-plan-list-card__delete { min-width: 0; }
.admin-plan-list-empty { display: grid; justify-items: center; gap: 0.7rem; padding: 2.4rem 1rem 1.4rem; border: 1px dashed #d3dfd8; border-radius: 1.35rem; background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 247, 0.96) 100%); }
.admin-plan-list-empty i { color: #67967b; font-size: 1.6rem; }
.admin-plan-list-empty strong { color: #183126; font-size: 1rem; }
.admin-plan-list-empty p { margin: 0; max-width: 32rem; text-align: center; color: #698173; font-size: 0.82rem; line-height: 1.6; }
@keyframes admin-plan-action-spin { to { transform: rotate(360deg); } }
@keyframes admin-plan-rubics-spin { to { transform: rotate(360deg); } }
@keyframes admin-plan-rubics-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.03); }
}
@media (max-width: 720px) { .admin-plan-preview-shell__head, .admin-plan-list-card__actions { flex-direction: column; } }
</style>
