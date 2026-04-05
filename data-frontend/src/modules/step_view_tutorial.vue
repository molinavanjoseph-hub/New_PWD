<script setup>
import { computed, ref } from 'vue'

const activeStep = ref('1')

const onboardingSteps = [
  {
    number: '1',
    title: 'Register & Build Your Profile',
    icon: 'bi bi-person-plus-fill',
    description:
      'Open an account, fill in your personal details, and showcase your skills so employers can quickly see your strengths and preferences.',
    panelLabel: 'Registration Flow',
    panelTitle: 'Build a strong first impression',
    panelCopy:
      'Create your account, complete your personal details, and prepare a profile that feels clear, guided, and easy to finish.',
    previewTag: 'Account Setup',
    ctaLabel: 'Open Registration',
    ctaHref: '/register',
  },
  {
    number: '2',
    title: 'Get Matched & Explore',
    icon: 'bi bi-geo-alt-fill',
    description:
      'Explore job listings and discover verified opportunities that align with your experience, location, and ideal work arrangement.',
    panelLabel: 'Matching Flow',
    panelTitle: 'Discover jobs that fit your needs',
    panelCopy:
      'Browse curated opportunities, view accessible job details, and explore roles based on your skills, location, and preferred setup.',
    previewTag: 'Job Matching',
    ctaLabel: 'Browse Jobs',
    ctaHref: '/search-jobs',
  },
  {
    number: '3',
    title: 'Discover, Apply & Connect',
    icon: 'bi bi-people-fill',
    description:
      'Apply to roles that match your goals and communicate with employers through the platform for updates and next steps.',
    panelLabel: 'Application Flow',
    panelTitle: 'Apply with confidence and stay connected',
    panelCopy:
      'Send applications smoothly, track progress, and keep communication organized so each next step feels more guided.',
    previewTag: 'Apply & Connect',
    ctaLabel: 'Start Applying',
    ctaHref: '/search-jobs',
  },
  {
    number: '4',
    title: 'Start Your Opportunity',
    icon: 'bi bi-rocket-takeoff-fill',
    description:
      'Begin your work journey with smoother coordination, clearer onboarding, and better support as you step into new opportunities.',
    panelLabel: 'Onboarding Flow',
    panelTitle: 'Move into your opportunity smoothly',
    panelCopy:
      'Review onboarding updates, stay informed, and transition into your role with a cleaner and more reassuring experience.',
    previewTag: 'Opportunity Start',
    ctaLabel: 'Continue Journey',
    ctaHref: '/login',
  },
]

const selectedStep = computed(
  () => onboardingSteps.find((step) => step.number === activeStep.value) || onboardingSteps[0],
)

const openStep = (stepNumber) => {
  activeStep.value = stepNumber
}
</script>

<template>
  <section class="open-source-landing">
    <div class="open-source-landing__shell">
      <div class="open-source-landing__header">
        <p class="open-source-landing__eyebrow">Open Source Preview</p>
        <h1 class="open-source-landing__title">Ready to Get Started?</h1>
        <p class="open-source-landing__subtitle">
          Standalone version ito ng smooth step interaction para hiwalay sa main landing page at mas safe i-edit.
        </p>
      </div>

      <div class="open-source-landing__layout">
        <div class="open-source-landing__grid">
          <article
            v-for="step in onboardingSteps"
            :key="step.number"
            class="open-source-landing__card"
            :class="{ 'open-source-landing__card--active': selectedStep.number === step.number }"
            role="button"
            tabindex="0"
            :aria-expanded="String(selectedStep.number === step.number)"
            @click="openStep(step.number)"
            @keydown.enter.prevent="openStep(step.number)"
            @keydown.space.prevent="openStep(step.number)"
          >
            <div class="open-source-landing__card-line" />
            <div class="open-source-landing__card-meta">
              <span class="open-source-landing__card-number">{{ step.number }}</span>
              <div class="open-source-landing__card-icon" aria-hidden="true">
                <i :class="step.icon" />
              </div>
            </div>
            <div class="open-source-landing__card-content">
              <p class="open-source-landing__card-label">Step {{ step.number }}</p>
              <h2 class="open-source-landing__card-title">{{ step.title }}</h2>
              <p class="open-source-landing__card-description">{{ step.description }}</p>
              <p class="open-source-landing__card-hint">Click to preview</p>
            </div>
          </article>
        </div>

        <transition name="open-source-panel" mode="out-in">
          <aside :key="selectedStep.number" class="open-source-landing__panel">
            <div class="open-source-landing__panel-shell">
              <p class="open-source-landing__panel-label">
                Step {{ selectedStep.number }} • {{ selectedStep.panelLabel }}
              </p>
              <h2 class="open-source-landing__panel-title">{{ selectedStep.panelTitle }}</h2>
              <p class="open-source-landing__panel-copy">{{ selectedStep.panelCopy }}</p>

              <div class="open-source-landing__panel-preview" aria-hidden="true">
                <div class="open-source-landing__panel-screen">
                  <div class="open-source-landing__panel-glow" />
                  <div class="open-source-landing__panel-tag">
                    <i class="bi bi-play-fill" />
                    <span>{{ selectedStep.previewTag }}</span>
                  </div>

                  <div class="open-source-landing__panel-form">
                    <span class="open-source-landing__panel-chip">{{ selectedStep.previewTag }}</span>
                    <span class="open-source-landing__panel-line open-source-landing__panel-line--lg" />
                    <span class="open-source-landing__panel-line open-source-landing__panel-line--md" />
                    <span class="open-source-landing__panel-line open-source-landing__panel-line--sm" />
                    <div class="open-source-landing__panel-progress">
                      <span class="open-source-landing__panel-progress-bar" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="open-source-landing__panel-actions">
                <a class="open-source-landing__panel-cta" :href="selectedStep.ctaHref">
                  {{ selectedStep.ctaLabel }}
                </a>
              </div>
            </div>
          </aside>
        </transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.open-source-landing {
  min-height: 100vh;
  padding: 3rem 1.25rem;
  background:
    radial-gradient(circle at top, rgba(43, 122, 79, 0.1), transparent 28%),
    linear-gradient(180deg, #f5f4ef 0%, #eef4ef 100%);
  color: #17231d;
}

.open-source-landing__shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.open-source-landing__header {
  text-align: center;
}

.open-source-landing__eyebrow {
  margin: 0;
  color: #1b8a54;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.open-source-landing__title {
  margin: 0.8rem 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.open-source-landing__subtitle {
  width: min(46rem, 100%);
  margin: 1rem auto 0;
  color: #5f6b65;
  font-size: 1rem;
  line-height: 1.75;
}

.open-source-landing__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.95fr);
  gap: 1.5rem;
  margin-top: 2rem;
  align-items: start;
}

.open-source-landing__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
}

.open-source-landing__card {
  position: relative;
  min-height: 20rem;
  padding: 1.35rem 1.35rem 1.75rem;
  border: 1px solid #d7e4dc;
  background:
    radial-gradient(circle at top right, rgba(27, 138, 84, 0.07), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f8fbf9 100%);
  box-shadow: 0 16px 28px rgba(23, 35, 29, 0.05);
  cursor: pointer;
  transition:
    transform 0.28s ease,
    box-shadow 0.28s ease,
    border-color 0.28s ease,
    background 0.28s ease;
}

.open-source-landing__card:hover,
.open-source-landing__card:focus-visible,
.open-source-landing__card--active {
  transform: translateY(-10px);
  border-color: #9bc7b0;
  background:
    radial-gradient(circle at top right, rgba(27, 138, 84, 0.16), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  box-shadow: 0 24px 38px rgba(23, 35, 29, 0.12);
  outline: none;
}

.open-source-landing__card-line {
  position: absolute;
  right: 1.35rem;
  bottom: 0.9rem;
  left: 1.35rem;
  height: 0.28rem;
  background: linear-gradient(90deg, rgba(27, 138, 84, 0.18) 0%, rgba(27, 138, 84, 0.95) 50%, rgba(27, 138, 84, 0.18) 100%);
  box-shadow:
    0 0 14px rgba(27, 138, 84, 0.32),
    0 0 26px rgba(27, 138, 84, 0.18);
}

.open-source-landing__card-meta {
  display: grid;
  justify-items: center;
  gap: 1rem;
}

.open-source-landing__card-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3rem;
  height: 2rem;
  padding: 0 0.85rem;
  border-radius: 999px;
  background: #ecf8f0;
  color: #1b8a54;
  font-size: 0.95rem;
  font-weight: 800;
}

.open-source-landing__card-icon {
  color: #1b8a54;
}

.open-source-landing__card-icon i {
  font-size: clamp(2.6rem, 4.5vw, 3.7rem);
}

.open-source-landing__card-content {
  margin-top: 1.15rem;
  text-align: center;
}

.open-source-landing__card-label {
  margin: 0;
  color: #6d7c74;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.open-source-landing__card-title {
  margin: 0.7rem 0 0;
  font-size: 1.2rem;
  line-height: 1.3;
}

.open-source-landing__card-description {
  margin: 1rem 0 0;
  color: #5f6b65;
  font-size: 0.98rem;
  line-height: 1.72;
}

.open-source-landing__card-hint {
  margin: 1rem 0 0;
  color: #1b8a54;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.open-source-landing__panel-shell {
  position: sticky;
  top: 1rem;
  overflow: hidden;
  padding: 1.35rem;
  border: 1px solid #d0e1d7;
  background:
    radial-gradient(circle at top left, rgba(27, 138, 84, 0.14), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f4faf6 100%);
  box-shadow: 0 24px 42px rgba(20, 48, 31, 0.12);
}

.open-source-landing__panel-label {
  margin: 0;
  color: #1b8a54;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.open-source-landing__panel-title {
  margin: 0.8rem 0 0;
  font-size: clamp(1.45rem, 2vw, 1.95rem);
  line-height: 1.15;
}

.open-source-landing__panel-copy {
  margin: 0.9rem 0 0;
  color: #5f6b65;
  font-size: 0.98rem;
  line-height: 1.72;
}

.open-source-landing__panel-preview {
  margin-top: 1.2rem;
  padding: 0.9rem;
  border: 1px solid rgba(27, 138, 84, 0.14);
  background: linear-gradient(180deg, rgba(235, 247, 239, 0.82) 0%, rgba(244, 251, 246, 0.98) 100%);
}

.open-source-landing__panel-screen {
  position: relative;
  overflow: hidden;
  min-height: 18rem;
  padding: 1rem;
  background: linear-gradient(145deg, rgba(13, 43, 28, 0.98) 0%, rgba(23, 90, 58, 0.92) 100%);
}

.open-source-landing__panel-screen::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
  opacity: 0.28;
}

.open-source-landing__panel-glow {
  position: absolute;
  top: -10%;
  right: -8%;
  width: 10rem;
  height: 10rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(112, 255, 183, 0.48) 0%, rgba(112, 255, 183, 0) 68%);
  filter: blur(10px);
  animation: open-source-float 4.8s ease-in-out infinite alternate;
}

.open-source-landing__panel-tag {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.45rem 0.72rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #eef9f2;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  backdrop-filter: blur(12px);
}

.open-source-landing__panel-form {
  position: absolute;
  right: 1.1rem;
  bottom: 1.1rem;
  left: 1.1rem;
  display: grid;
  gap: 0.7rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  animation: open-source-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.open-source-landing__panel-chip {
  display: inline-flex;
  justify-self: start;
  padding: 0.42rem 0.75rem;
  border-radius: 999px;
  background: rgba(207, 255, 226, 0.18);
  color: #f7fffa;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.open-source-landing__panel-line {
  display: block;
  height: 0.74rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0%, rgba(192, 252, 214, 0.72) 100%);
  animation: open-source-shimmer 2.4s ease-in-out infinite;
}

.open-source-landing__panel-line--lg {
  width: 88%;
}

.open-source-landing__panel-line--md {
  width: 68%;
}

.open-source-landing__panel-line--sm {
  width: 52%;
}

.open-source-landing__panel-progress {
  margin-top: 0.2rem;
  width: 100%;
  height: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.open-source-landing__panel-progress-bar {
  display: block;
  width: 56%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #75e6a0 0%, #d5ffe3 100%);
  animation: open-source-progress 2.8s ease-in-out infinite;
}

.open-source-landing__panel-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 1.2rem;
}

.open-source-landing__panel-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.9rem;
  padding: 0.75rem 1.15rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #1b8a54 0%, #146641 100%);
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 14px 28px rgba(20, 102, 65, 0.18);
}

.open-source-panel-enter-active,
.open-source-panel-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.open-source-panel-enter-from,
.open-source-panel-leave-to {
  opacity: 0;
  transform: translateX(38px);
}

@keyframes open-source-float {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  100% {
    transform: translate3d(-10px, 16px, 0) scale(1.08);
  }
}

@keyframes open-source-rise {
  0% {
    opacity: 0;
    transform: translate3d(0, 20px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes open-source-shimmer {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

@keyframes open-source-progress {
  0%,
  100% {
    width: 56%;
  }
  50% {
    width: 84%;
  }
}

@media (max-width: 980px) {
  .open-source-landing__layout {
    grid-template-columns: 1fr;
  }

  .open-source-landing__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .open-source-landing__panel-shell {
    position: relative;
    top: 0;
  }
}

@media (max-width: 640px) {
  .open-source-landing {
    padding: 2rem 0.9rem;
  }

  .open-source-landing__grid {
    grid-template-columns: 1fr;
  }

  .open-source-landing__card {
    min-height: auto;
  }

  .open-source-landing__panel-screen {
    min-height: 15rem;
  }
}
</style>
