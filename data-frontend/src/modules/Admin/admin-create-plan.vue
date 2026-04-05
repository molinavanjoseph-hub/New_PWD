<script setup>
import { computed, ref } from 'vue'
import {
  BUSINESS_MODULE_CATALOG,
  PLAN_TONE_OPTIONS,
  normalizePlanRecord,
  upsertAdminPlanRecord,
} from '@/lib/business_plan_access'

const emit = defineEmits(['saved'])
const ADMIN_PLAN_TEMPLATE_STORAGE_KEY = 'adminCreatePlanTemplates'

const DEFAULT_PLAN_TEMPLATES = [
  {
    id: 'premium',
    label: 'Premium',
    values: {
      name: 'Premium Subscription',
      subtitle: 'Pay the first billing cycle now and activate the full premium subscription immediately.',
      description: 'PHP 1,400.00 / month',
      price: 'PHP 1,400.00',
      cta: 'Get Started',
      tone: 'premium',
      moduleAccess: ['dashboard', 'user-management', 'attendance-monitoring', 'training-templates', 'assessment-templates'],
    },
  },
  {
    id: 'trial',
    label: 'Free Trial',
    values: {
      name: 'Free Trial',
      subtitle: 'Use premium tools for 30 days first, then continue with automatic billing after the trial period.',
      description: 'PHP 0.00 today',
      price: 'PHP 0.00',
      cta: 'Start Free Trial',
      tone: 'trial',
      moduleAccess: ['dashboard', 'user-management', 'training-templates'],
    },
  },
  {
    id: 'starter',
    label: 'Starter',
    values: {
      name: 'Starter Plan',
      subtitle: 'A lighter paid plan for small teams that need essential hiring and attendance tools.',
      description: 'PHP 799.00 / month',
      price: 'PHP 799.00',
      cta: 'Choose Starter',
      tone: 'starter',
      moduleAccess: ['dashboard', 'user-management', 'attendance-monitoring', 'attendance-reports'],
    },
  },
  {
    id: 'free',
    label: 'Free',
    values: {
      name: 'Free Plan',
      subtitle: 'A basic workspace option for businesses that want to explore the platform first.',
      description: 'PHP 0.00 / month',
      price: 'PHP 0.00',
      cta: 'Use Free Plan',
      tone: 'free',
      moduleAccess: ['dashboard'],
    },
  },
]

const cloneTemplateRecord = (template) => ({
  id: String(template?.id || '').trim(),
  label: String(template?.label || '').trim(),
  values: {
    ...template?.values,
    moduleAccess: Array.isArray(template?.values?.moduleAccess) ? [...template.values.moduleAccess] : [],
  },
})

const sanitizePriceInput = (value) => String(value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')

const formatPhilippinePeso = (value) => {
  const numeric = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric)) return 'PHP 0.00'
  return `PHP ${numeric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const readStoredTemplates = () => {
  if (typeof window === 'undefined') return DEFAULT_PLAN_TEMPLATES.map(cloneTemplateRecord)

  try {
    const raw = JSON.parse(window.localStorage.getItem(ADMIN_PLAN_TEMPLATE_STORAGE_KEY) || 'null')
    if (!Array.isArray(raw) || !raw.length) return DEFAULT_PLAN_TEMPLATES.map(cloneTemplateRecord)
    return raw.map(cloneTemplateRecord).filter((template) => template.id && template.label)
  } catch {
    return DEFAULT_PLAN_TEMPLATES.map(cloneTemplateRecord)
  }
}

const writeStoredTemplates = (templates) => {
  if (typeof window === 'undefined') return templates
  window.localStorage.setItem(
    ADMIN_PLAN_TEMPLATE_STORAGE_KEY,
    JSON.stringify(templates.map(cloneTemplateRecord)),
  )
  return templates
}

const planTemplates = ref(readStoredTemplates())

const moduleGroups = BUSINESS_MODULE_CATALOG.reduce((groups, module) => {
  const groupKey = String(module.group || 'Other')
  if (!groups[groupKey]) groups[groupKey] = []
  groups[groupKey].push(module)
  return groups
}, {})

const baseFormState = () => ({
  name: '',
  subtitle: '',
  description: '',
  price: '',
  cta: '',
  tone: 'premium',
  customFeatures: [],
  moduleAccess: [],
})

const form = ref(baseFormState())
const saveNotice = ref('')
const isSavingPlan = ref(false)
const selectedTemplateId = ref('')
const templateName = ref('')
const formRenderKey = ref(0)
const featureInput = ref('')

const nextCustomTemplateNumber = computed(() =>
  planTemplates.value.filter((template) => String(template?.id || '').startsWith('custom-template-')).length + 1,
)

const isCustomTemplateSelected = computed(() =>
  String(selectedTemplateId.value || '').startsWith('custom-template-'),
)

const removableTemplateIds = new Set(['starter', 'free'])

const canRemoveSelectedTemplate = computed(() => {
  const templateId = String(selectedTemplateId.value || '').trim()
  return String(templateId).startsWith('custom-template-') || removableTemplateIds.has(templateId)
})

const selectedModuleLabels = computed(() =>
  form.value.moduleAccess
    .map((moduleId) => BUSINESS_MODULE_CATALOG.find((module) => module.id === moduleId)?.label || '')
    .filter(Boolean),
)

const combinedFeatureList = computed(() => {
  const customFeatures = Array.isArray(form.value.customFeatures) ? form.value.customFeatures : []
  return [...customFeatures, ...selectedModuleLabels.value].filter(Boolean)
})

const previewPlan = computed(() =>
  normalizePlanRecord({
    name: form.value.name,
    subtitle: form.value.subtitle,
    description: form.value.description,
    price: form.value.price,
    cta: form.value.cta,
    tone: form.value.tone,
    features: combinedFeatureList.value,
    moduleAccess: form.value.moduleAccess,
  }),
)

const previewPriceLabel = computed(() => formatPhilippinePeso(form.value.price))

const toggleModule = (moduleId) => {
  const normalizedId = String(moduleId || '').trim()
  if (!normalizedId) return

  if (form.value.moduleAccess.includes(normalizedId)) {
    form.value.moduleAccess = form.value.moduleAccess.filter((value) => value !== normalizedId)
    return
  }

  form.value.moduleAccess = [...form.value.moduleAccess, normalizedId]
}

const selectTone = (toneId) => {
  form.value.tone = String(toneId || 'premium').trim() || 'premium'
}

const handlePriceInput = (event) => {
  form.value.price = sanitizePriceInput(event?.target?.value)
}

const addCustomFeature = () => {
  const nextFeature = String(featureInput.value || '').trim()
  if (!nextFeature) return
  if (!Array.isArray(form.value.customFeatures)) form.value.customFeatures = []
  if (form.value.customFeatures.includes(nextFeature)) {
    featureInput.value = ''
    return
  }
  form.value.customFeatures = [...form.value.customFeatures, nextFeature]
  featureInput.value = ''
}

const removeCustomFeature = (feature) => {
  const normalizedFeature = String(feature || '').trim()
  if (!normalizedFeature) return
  form.value.customFeatures = (Array.isArray(form.value.customFeatures) ? form.value.customFeatures : []).filter((item) => item !== normalizedFeature)
}

const resetForm = () => {
  form.value = baseFormState()
  saveNotice.value = ''
  selectedTemplateId.value = ''
  templateName.value = ''
  formRenderKey.value += 1
}

const applyTemplate = (template) => {
  if (!template?.values) return
  form.value = {
    ...baseFormState(),
    ...template.values,
    price: sanitizePriceInput(template.values.price),
    customFeatures: Array.isArray(template.values.customFeatures) ? [...template.values.customFeatures] : [],
    moduleAccess: Array.isArray(template.values.moduleAccess) ? [...template.values.moduleAccess] : [],
  }
  saveNotice.value = ''
  selectedTemplateId.value = String(template.id || '').trim()
  templateName.value = String(template.label || '').trim()
  featureInput.value = ''
}

const addTemplate = () => {
  const templateNumber = nextCustomTemplateNumber.value
  const customTemplateName = String(templateName.value || '').trim()
  const planName = String(form.value.name || '').trim()
  const templateLabel = customTemplateName || planName || `Custom Plan ${templateNumber}`
  const templateId = `custom-template-${templateNumber}`

  const templateValues = {
    name: String(form.value.name || '').trim() || templateLabel,
    subtitle: String(form.value.subtitle || '').trim() || 'Custom template preset for your next subscription setup.',
    description: String(form.value.description || '').trim() || 'No price caption provided yet.',
    price: sanitizePriceInput(form.value.price) || '0',
    cta: String(form.value.cta || '').trim() || 'Choose Plan',
    tone: String(form.value.tone || 'premium').trim() || 'premium',
    customFeatures: Array.isArray(form.value.customFeatures) ? [...form.value.customFeatures] : [],
    moduleAccess: Array.isArray(form.value.moduleAccess) ? [...form.value.moduleAccess] : [],
  }

  planTemplates.value = [
    ...planTemplates.value,
    {
      id: templateId,
      label: templateLabel,
      values: templateValues,
    },
  ]
  writeStoredTemplates(planTemplates.value)

  form.value = baseFormState()
  selectedTemplateId.value = ''
  templateName.value = ''
  featureInput.value = ''
  saveNotice.value = `"${templateLabel}" template button was added.`
  formRenderKey.value += 1
}

const removeSelectedTemplate = () => {
  const templateId = String(selectedTemplateId.value || '').trim()
  if (!templateId || (!templateId.startsWith('custom-template-') && !removableTemplateIds.has(templateId))) return

  const templateToRemove = planTemplates.value.find((template) => String(template?.id || '').trim() === templateId)
  planTemplates.value = planTemplates.value.filter((template) => String(template?.id || '').trim() !== templateId)
  writeStoredTemplates(planTemplates.value)
  resetForm()
  saveNotice.value = `"${String(templateToRemove?.label || 'Custom template').trim()}" was removed.`
}

const savePlan = async () => {
  if (isSavingPlan.value) return
  if (!String(form.value.name || '').trim()) {
    saveNotice.value = ''
    emit('saved', {
      kind: 'error',
      title: 'Missing Plan Name',
      message: 'Plan name is required before saving.',
    })
    return
  }

  isSavingPlan.value = true

  try {
    const savedPlan = await upsertAdminPlanRecord(previewPlan.value)
    saveNotice.value = ''
    emit('saved', {
      plan: savedPlan,
      kind: 'success',
      title: 'Plan Saved',
      message: `"${savedPlan.name}" saved successfully. Check Preview Plan.`,
    })
  } catch {
    saveNotice.value = ''
    emit('saved', {
      kind: 'error',
      title: 'Save Failed',
      message: 'Could not save the plan to Firestore. Check your Firebase connection and rules.',
    })
  } finally {
    isSavingPlan.value = false
  }
}
</script>

<template>
  <section class="admin-create-plan">
    <div class="admin-plan-builder">
      <article class="admin-plan-builder__form admin-plan-panel">
        <div :key="formRenderKey" class="admin-create-plan__sheet">
          <header class="admin-create-plan__sheet-header">
            <h3 class="admin-create-plan__sheet-title">Subscription Details</h3>
            <p class="admin-create-plan__sheet-copy">Create a plan on the left, then check the live preview on the right.</p>
          </header>

          <section class="admin-create-plan__templates">
            <div class="admin-create-plan__templates-head">
            </div>

            <div class="admin-create-plan__template-manage">
              <label class="admin-create-plan__field">
                <span>Template Name</span>
                <input v-model="templateName" type="text" placeholder="Enter template button name" autocomplete="off" />
              </label>

              <button
                v-if="canRemoveSelectedTemplate"
                type="button"
                class="admin-create-plan__template-button admin-create-plan__template-button--remove"
                @click="removeSelectedTemplate"
              >
                <i class="bi bi-trash3" aria-hidden="true" />
                <span>Remove Template</span>
              </button>
            </div>

            <TransitionGroup name="template-chip" tag="div" class="admin-create-plan__template-actions">
              <button
                v-for="template in planTemplates"
                :key="template.id"
                type="button"
                class="admin-create-plan__template-button"
                :class="{ 'is-active': selectedTemplateId === template.id }"
                @click="applyTemplate(template)"
              >
                <span>{{ template.label }}</span>
              </button>
              <button
                type="button"
                class="admin-create-plan__template-button admin-create-plan__template-button--add"
                @click="addTemplate"
              >
                <i class="bi bi-plus-lg" aria-hidden="true" />
                <span>Add Template</span>
              </button>
            </TransitionGroup>

          </section>

          <div class="admin-create-plan__grid admin-create-plan__grid--two">
            <label class="admin-create-plan__field">
              <span>Plan Name</span>
              <input v-model="form.name" type="text" placeholder="Premium Subscription" autocomplete="off" />
            </label>

            <label class="admin-create-plan__field">
              <span>Price</span>
              <input
                :value="form.price"
                type="text"
                inputmode="decimal"
                placeholder="1400"
                autocomplete="off"
                @input="handlePriceInput"
              />
            </label>
          </div>

          <label class="admin-create-plan__field">
            <span>Subtitle</span>
            <textarea v-model="form.subtitle" rows="3" placeholder="Short plan intro" autocomplete="off" />
          </label>

          <div class="admin-create-plan__grid admin-create-plan__grid--two">
            <label class="admin-create-plan__field">
              <span>Price Caption</span>
              <input v-model="form.description" type="text" placeholder="PHP 1,400.00 / month" autocomplete="off" />
            </label>
          </div>

          <section class="admin-create-plan__features-editor">
            <div class="admin-create-plan__features-head">
              <div>
                <strong>Plan Features</strong>
                <p>Add short feature lines for the live preview checklist.</p>
              </div>
              <span>{{ (form.customFeatures || []).length }} added</span>
            </div>

            <div class="admin-create-plan__feature-entry">
              <input
                v-model="featureInput"
                type="text"
                placeholder="Add feature like Priority support"
                autocomplete="off"
                @keydown.enter.prevent="addCustomFeature"
              />
              <button type="button" class="admin-create-plan__template-button admin-create-plan__template-button--add" @click="addCustomFeature">
                <i class="bi bi-plus-lg" aria-hidden="true" />
                <span>Add Feature</span>
              </button>
            </div>

            <div v-if="(form.customFeatures || []).length" class="admin-create-plan__feature-list">
              <button
                v-for="feature in form.customFeatures"
                :key="feature"
                type="button"
                class="admin-create-plan__feature-chip"
                @click="removeCustomFeature(feature)"
              >
                <i class="bi bi-check2-circle" aria-hidden="true" />
                <span>{{ feature }}</span>
                <i class="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section class="admin-create-plan__tone">
            <div class="admin-create-plan__tone-head">
              <strong>Card Tone</strong>
              <span>Choose the pricing look you want to preview.</span>
            </div>

            <div class="admin-create-plan__tone-options">
              <button
                v-for="option in PLAN_TONE_OPTIONS"
                :key="option.id"
                type="button"
                class="admin-create-plan__tone-option"
                :class="{ 'is-active': previewPlan.tone === option.id }"
                @click="selectTone(option.id)"
              >
                {{ option.label }}
              </button>
            </div>
          </section>

          <section class="admin-create-plan__access">
            <div class="admin-create-plan__access-head">
              <div>
                <strong>Module Access</strong>
                <p>Select which premium workspace modules will be enabled by this subscription plan.</p>
              </div>
              <span>{{ previewPlan.moduleAccess.length }} selected</span>
            </div>

            <div class="admin-create-plan__access-workspace">
              <article
                v-for="(modules, groupName) in moduleGroups"
                :key="groupName"
                class="admin-create-plan__access-zone"
                :class="{ 'admin-create-plan__access-zone--selected': modules.some((module) => previewPlan.moduleAccess.includes(module.id)) }"
              >
                <div class="admin-create-plan__access-zone-head">
                  <div class="admin-create-plan__access-zone-copy">
                    <strong>{{ groupName }}</strong>
                    <p>{{ modules.length }} modules available</p>
                  </div>
                  <span>{{ modules.filter((module) => previewPlan.moduleAccess.includes(module.id)).length }}</span>
                </div>

                <div class="admin-create-plan__access-tag-grid">
                  <button
                    v-for="module in modules"
                    :key="module.id"
                    type="button"
                    class="admin-create-plan__access-tag"
                    :class="{ 'admin-create-plan__access-tag--selected': previewPlan.moduleAccess.includes(module.id) }"
                    @click="toggleModule(module.id)"
                  >
                    <span class="admin-create-plan__access-tag-copy">{{ module.label }}</span>
                    <span class="admin-create-plan__access-tag-action">{{ previewPlan.moduleAccess.includes(module.id) ? 'Added' : 'Add' }}</span>
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <footer class="admin-create-plan__actions">
          <div class="admin-plan-builder__buttons">
            <button type="button" class="admin-table-action admin-table-action--ghost" @click="resetForm">
              <i class="bi bi-arrow-counterclockwise" aria-hidden="true" />
              Reset
            </button>
            <button type="button" class="admin-table-action admin-table-action--success" :disabled="isSavingPlan" @click="savePlan">
              <i :class="isSavingPlan ? 'bi bi-arrow-repeat' : 'bi bi-check2-circle'" aria-hidden="true" />
              {{ isSavingPlan ? 'Saving to Firestore...' : 'Save Plan' }}
            </button>
          </div>
        </footer>
      </article>

      <aside class="admin-plan-builder__preview admin-plan-panel">
        <div class="admin-plan-builder__preview-head">
          <strong>Live Preview</strong>
        </div>

        <div class="admin-create-plan__preview-stack">
          <article class="admin-plan-list-card" :class="`admin-plan-list-card--${previewPlan.tone || 'premium'}`">
            <div class="admin-plan-list-card__top">
              <div>
                <h3>{{ previewPlan.name }}</h3>
                <p class="admin-plan-list-card__subtitle">{{ previewPlan.subtitle || 'Add a short subscription introduction for this plan.' }}</p>
              </div>
            </div>

            <div class="admin-plan-list-card__body">
              <strong class="admin-plan-list-card__price">{{ previewPriceLabel }}</strong>
              <span class="admin-plan-list-card__caption">{{ previewPlan.description || 'Price caption will show here.' }}</span>
            </div>

            <ul class="admin-plan-list-card__features">
              <li v-for="feature in previewPlan.features" :key="feature">
                <i class="bi bi-check2-circle" aria-hidden="true" />
                <span>{{ feature }}</span>
              </li>
              <li v-if="!previewPlan.features.length">
                <i class="bi bi-check2-circle" aria-hidden="true" />
                <span>Add plan features to preview the checklist here.</span>
              </li>
            </ul>
          </article>

          <section class="admin-plan-list-card admin-plan-list-card--access">
            <div class="admin-plan-list-card__access">
              <div class="admin-plan-list-card__access-head">
                <div>
                  <strong>Enabled Modules</strong>
                  <p>{{ previewPlan.moduleAccess.length ? 'Current workspace access for this plan.' : 'No modules selected yet.' }}</p>
                </div>
                <span>{{ previewPlan.moduleAccess.length }}</span>
              </div>

              <div class="admin-plan-list-card__access-grid">
                <span
                  v-for="module in previewPlan.moduleAccess"
                  :key="module"
                  class="admin-plan-list-card__access-tag admin-plan-list-card__access-tag--selected"
                >
                  <span class="admin-plan-list-card__access-tag-copy">
                    {{ BUSINESS_MODULE_CATALOG.find((item) => item.id === module)?.label || module }}
                  </span>
                </span>
                <p v-if="!previewPlan.moduleAccess.length" class="admin-plan-list-card__access-empty">
                  This plan does not unlock any modules yet.
                </p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>

  </section>
</template>

<style scoped>
.admin-create-plan { position: relative; display: grid; gap: 1rem; }
.admin-create-plan__loading {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
}
.admin-create-plan__loading-copy {
  position: relative;
  z-index: 41;
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  margin-top: 10rem;
  text-align: center;
}
.admin-create-plan__loading-copy strong {
  color: #173026;
  font-size: 1rem;
  font-weight: 800;
}
.admin-create-plan__loading-copy span {
  color: #567264;
  font-size: 0.8rem;
  font-weight: 600;
}
.admin-plan-panel { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.admin-plan-builder { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.76fr); gap: 1rem; width: 100%; }
.admin-plan-builder__form, .admin-plan-builder__preview { display: grid; align-content: start; gap: 1rem; }
.admin-plan-builder__form { padding: 1rem; }
.admin-plan-builder__preview { padding: 1rem; }
.admin-plan-builder__preview-head strong { margin: 0; color: #183126; font-size: 1.08rem; font-weight: 800; }
.admin-create-plan__toolbar { display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
.admin-create-plan__title { margin: 0; color: #151821; font-size: 1.15rem; font-weight: 700; }
.admin-create-plan__sheet { display: grid; gap: 0.85rem; padding: 1.15rem; border: 1px solid #e6e7eb; border-radius: 1rem; background: #ffffff; box-shadow: 0 2px 10px rgba(16, 24, 40, 0.04); }
.admin-create-plan__sheet-header h3 { margin: 0; color: #151821; font-size: 1.06rem; font-weight: 700; }
.admin-create-plan__sheet-copy { margin: 0.22rem 0 0; color: #636b78; font-size: 0.75rem; line-height: 1.45; }
.admin-create-plan__templates { display: grid; gap: 0.55rem; }
.admin-create-plan__templates-head { display: grid; gap: 0.12rem; }
.admin-create-plan__templates-head strong { color: #1f2937; font-size: 0.76rem; font-weight: 700; }
.admin-create-plan__templates-head span { color: #697281; font-size: 0.7rem; line-height: 1.35; }
.admin-create-plan__template-manage { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.65rem; align-items: end; }
.admin-create-plan__template-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.admin-create-plan__template-button { min-height: 2.05rem; padding: 0 0.8rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #1f2937; font-size: 0.76rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; }
.admin-create-plan__template-button.is-active { border-color: #2e9a62; background: #eef8f2; color: #1f6f46; box-shadow: 0 0 0 3px rgba(46, 154, 98, 0.12); }
.admin-create-plan__template-button--add { display: inline-flex; align-items: center; gap: 0.42rem; border-style: dashed; color: #1f6f46; background: #f7fcf9; }
.admin-create-plan__template-button--remove { display: inline-flex; align-items: center; gap: 0.42rem; color: #9f2f2f; background: #fff5f5; border-color: #f2caca; }
.template-chip-enter-active, .template-chip-leave-active { transition: all 0.24s ease; }
.template-chip-enter-from, .template-chip-leave-to { opacity: 0; transform: translateY(8px) scale(0.96); }
.template-chip-move { transition: transform 0.24s ease; }
.admin-create-plan__grid { display: grid; gap: 0.65rem; }
.admin-create-plan__grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.admin-create-plan__field { display: grid; gap: 0.26rem; }
.admin-create-plan__field span { color: #1f2937; font-size: 0.74rem; font-weight: 700; }
.admin-create-plan__field input, .admin-create-plan__field textarea { width: 100%; min-height: 2.25rem; padding: 0.55rem 0.72rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #111827; font: inherit; font-size: 0.8rem; transition: border-color 0.18s ease, box-shadow 0.18s ease; resize: vertical; }
.admin-create-plan__field input::placeholder, .admin-create-plan__field textarea::placeholder { color: #a1a7b3; }
.admin-create-plan__field input:focus, .admin-create-plan__field textarea:focus { outline: none; border-color: #b9c0cb; box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05); }
.admin-create-plan__features-editor { display: grid; gap: 0.7rem; padding: 0.95rem; border: 1px solid #e6e7eb; border-radius: 1rem; background: #fbfcfd; }
.admin-create-plan__features-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; }
.admin-create-plan__features-head strong { color: #1f2937; font-size: 0.76rem; font-weight: 700; }
.admin-create-plan__features-head p { margin: 0.22rem 0 0; color: #697281; font-size: 0.7rem; line-height: 1.35; }
.admin-create-plan__features-head span { display: inline-flex; align-items: center; min-height: 1.7rem; padding: 0 0.58rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #51695c; font-size: 0.72rem; font-weight: 800; }
.admin-create-plan__feature-entry { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.65rem; align-items: center; }
.admin-create-plan__feature-entry input { width: 100%; min-height: 2.25rem; padding: 0.55rem 0.72rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #111827; font: inherit; font-size: 0.8rem; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
.admin-create-plan__feature-entry input:focus { outline: none; border-color: #b9c0cb; box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05); }
.admin-create-plan__feature-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.admin-create-plan__feature-chip { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2rem; padding: 0 0.72rem; border: 1px solid #d8e4db; border-radius: 999px; background: #ffffff; color: #25533d; font-size: 0.73rem; font-weight: 700; cursor: pointer; }
.admin-create-plan__feature-chip i:first-child { color: #2f9d60; }
.admin-create-plan__feature-chip i:last-child { font-size: 0.68rem; color: #7a8190; }
.admin-create-plan__tone { display: grid; gap: 0.55rem; }
.admin-create-plan__tone-head { display: grid; gap: 0.12rem; }
.admin-create-plan__tone-head strong { color: #1f2937; font-size: 0.76rem; font-weight: 700; }
.admin-create-plan__tone-head span { color: #697281; font-size: 0.7rem; line-height: 1.35; }
.admin-create-plan__tone-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.admin-create-plan__tone-option { min-height: 2.05rem; padding: 0 0.8rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #1f2937; font-size: 0.76rem; font-weight: 700; cursor: pointer; }
.admin-create-plan__tone-option.is-active { border-color: #b9c0cb; background: #f8fafc; }
.admin-create-plan__access { display: grid; gap: 0.75rem; padding: 0.95rem; border: 1px solid #e6e7eb; border-radius: 1rem; background: #fbfcfd; }
.admin-create-plan__access-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; }
.admin-create-plan__access-head strong { color: #1f2937; font-size: 0.76rem; font-weight: 700; }
.admin-create-plan__access-head p { margin: 0.22rem 0 0; color: #697281; font-size: 0.7rem; line-height: 1.35; }
.admin-create-plan__access-head span { display: inline-flex; align-items: center; min-height: 1.7rem; padding: 0 0.58rem; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #51695c; font-size: 0.72rem; font-weight: 800; }
.admin-create-plan__access-workspace { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; }
.admin-create-plan__access-zone { display: grid; gap: 0.62rem; padding: 0.75rem; border: 1px dashed #d8dee6; border-radius: 0.75rem; background: #ffffff; }
.admin-create-plan__access-zone--selected { background: #f8fafc; border-color: #c8d0da; }
.admin-create-plan__access-zone-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.65rem; }
.admin-create-plan__access-zone-copy { display: grid; gap: 0.18rem; }
.admin-create-plan__access-zone-copy strong { color: #1f2937; font-size: 0.74rem; font-weight: 700; }
.admin-create-plan__access-zone-copy p { margin: 0; color: #697281; font-size: 0.68rem; }
.admin-create-plan__access-zone-head span { display: inline-flex; align-items: center; min-height: 1.55rem; padding: 0 0.5rem; border-radius: 0.45rem; background: #f3f4f6; color: #4b5563; font-size: 0.68rem; font-weight: 800; }
.admin-create-plan__access-tag-grid { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.admin-create-plan__access-tag { display: inline-flex; align-items: stretch; padding: 0; border: 1px solid #e5e7eb; border-radius: 0.45rem; background: #ffffff; color: #30473a; cursor: pointer; overflow: hidden; }
.admin-create-plan__access-tag--selected { border-color: #c8d0da; background: #f8fafc; }
.admin-create-plan__access-tag-copy, .admin-create-plan__access-tag-action { display: inline-flex; align-items: center; min-height: 1.9rem; }
.admin-create-plan__access-tag-copy { padding: 0 0.68rem; font-size: 0.72rem; font-weight: 700; }
.admin-create-plan__access-tag-action { padding: 0 0.55rem; border-left: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; font-size: 0.64rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.admin-create-plan__actions { display: grid; gap: 0.8rem; }
.admin-plan-builder__buttons { display: flex; justify-content: flex-end; gap: 0.55rem; }
.admin-table-action { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; min-height: 2.45rem; padding: 0 1rem; border: 1px solid #d7dfd9; border-radius: 0.82rem; background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%); color: #173026; font-size: 0.76rem; font-weight: 800; cursor: pointer; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease; }
.admin-table-action i { font-size: 0.82rem; }
.admin-table-action:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12); }
.admin-table-action--ghost { border-color: #d7dfd9; background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%); color: #305141; }
.admin-table-action--success { border-color: #cfe6d7; background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%); color: #1f6f46; }
.admin-create-plan__preview-stack { display: grid; gap: 1rem; }
.admin-plan-list-card { display: grid; gap: 0.82rem; padding: 0.95rem; border: 1px solid rgba(214, 227, 219, 0.92); border-radius: 1.2rem; background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 250, 247, 0.97) 100%); box-shadow: 0 14px 26px rgba(71, 112, 90, 0.08); }
.admin-plan-list-card--premium { background: radial-gradient(circle at top right, rgba(37, 168, 104, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(241, 251, 245, 0.96) 100%); }
.admin-plan-list-card--trial { background: radial-gradient(circle at top right, rgba(39, 122, 214, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(241, 247, 255, 0.96) 100%); }
.admin-plan-list-card--starter { background: radial-gradient(circle at top right, rgba(214, 158, 39, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 250, 241, 0.96) 100%); }
.admin-plan-list-card--free { background: radial-gradient(circle at top right, rgba(129, 140, 153, 0.12), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 248, 250, 0.96) 100%); }
.admin-plan-list-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; }
.admin-plan-list-card__top h3 { margin: 0; color: #183126; font-size: 0.98rem; line-height: 1.15; }
.admin-plan-list-card__subtitle { margin: 0.32rem 0 0; color: #678173; font-size: 0.76rem; line-height: 1.5; }
.admin-plan-list-card__pill { display: inline-flex; align-items: center; min-height: 1.95rem; padding: 0 0.8rem; border-radius: 999px; background: rgba(35, 145, 89, 0.12); color: #23724b; font-size: 0.74rem; font-weight: 800; }
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
.admin-plan-list-card__actions { display: flex; gap: 0.65rem; }
.admin-plan-list-card--access { gap: 0; }
@media (max-width: 1120px) { .admin-plan-builder { grid-template-columns: 1fr; } }
@media (max-width: 720px) {
  .admin-create-plan__grid--two, .admin-create-plan__access-workspace, .admin-create-plan__template-manage, .admin-create-plan__feature-entry { grid-template-columns: 1fr; }
  .admin-plan-builder__buttons { flex-direction: column; }
}
</style>
