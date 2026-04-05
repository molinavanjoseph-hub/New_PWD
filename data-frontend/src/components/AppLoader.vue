<script setup>
import mathLogo from '@/assets/math.png'

const props = defineProps({
  progress: {
    type: Number,
    default: 0,
  },
  fullscreen: {
    type: Boolean,
    default: true,
  },
  viewportPinned: {
    type: Boolean,
    default: false,
  },
  contentPinned: {
    type: Boolean,
    default: false,
  },
})

const normalizedProgress = Math.max(0, Math.min(100, props.progress))
</script>

<template>
  <div
    class="app-loader"
    :class="{
      'app-loader--fullscreen': props.fullscreen,
      'app-loader--embedded': !props.fullscreen && !props.viewportPinned && !props.contentPinned,
      'app-loader--viewport-pinned': props.viewportPinned,
      'app-loader--content-pinned': props.contentPinned,
    }"
    aria-live="polite"
    aria-label="Application loading"
  >
    <div class="app-loader__glow app-loader__glow--left" />
    <div class="app-loader__glow app-loader__glow--right" />

    <div class="app-loader__stage">
      <div class="app-loader__logo-shell">
        <div
          class="app-loader__logo-base"
          :style="{ '--loader-logo': `url(${mathLogo})` }"
          aria-hidden="true"
        />

        <div
          class="app-loader__logo-fill"
          :style="{
            '--loader-logo': `url(${mathLogo})`,
            '--fill-level': `${normalizedProgress}%`,
          }"
          role="img"
          aria-label="PWD Employment Assistant loading"
        >
          <div class="app-loader__liquid">
            <div class="app-loader__wave app-loader__wave--back" />
            <div class="app-loader__wave app-loader__wave--mid" />
            <div class="app-loader__wave app-loader__wave--front" />
            <div class="app-loader__foam" />
            <div class="app-loader__shine" />
          </div>
        </div>

        <div
          class="app-loader__logo-outline"
          :style="{ '--loader-logo': `url(${mathLogo})` }"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-loader {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at top left, rgba(44, 176, 116, 0.16), transparent 24%),
    radial-gradient(circle at bottom right, rgba(34, 150, 100, 0.12), transparent 22%),
    linear-gradient(180deg, #eefaf1 0%, #e4f5ea 46%, #f8fdf9 100%);
}

.app-loader--fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  min-width: 100vw;
  height: 100dvh;
  min-height: 100dvh;
  padding: clamp(1rem, 3vw, 2.25rem);
  z-index: 9999;
}

.app-loader--embedded {
  position: absolute;
  inset: 0;
  z-index: 30;
  border-radius: 0;
}

.app-loader--viewport-pinned {
  position: fixed;
  inset: 0;
  width: 100vw;
  min-width: 100vw;
  height: 100dvh;
  min-height: 100dvh;
  z-index: 70;
}

.app-loader--content-pinned {
  position: fixed;
  top: 0;
  left: 258px;
  width: calc(100vw - 258px);
  height: 100dvh;
  min-height: 100dvh;
  z-index: 70;
}

@media (max-width: 900px) {
  .app-loader--content-pinned {
    left: 0;
    width: 100vw;
  }
}

.app-loader__glow {
  position: absolute;
  width: 28rem;
  height: 28rem;
  border-radius: 999px;
  filter: blur(52px);
  opacity: 0.4;
}

.app-loader__glow--left {
  top: -10rem;
  left: -8rem;
  background: rgba(32, 156, 104, 0.22);
}

.app-loader__glow--right {
  right: -10rem;
  bottom: -10rem;
  background: rgba(112, 224, 164, 0.18);
}

.app-loader__stage {
  position: relative;
  z-index: 1;
  width: min(92vw, 58rem);
  display: grid;
  justify-items: center;
}

.app-loader__logo-shell {
  position: relative;
  width: min(24vw, 10.5rem);
  aspect-ratio: 1440 / 541;
  filter: drop-shadow(0 14px 22px rgba(18, 92, 61, 0.12));
  transform: translateZ(0);
}

.app-loader__logo-base,
.app-loader__logo-fill,
.app-loader__logo-outline {
  position: absolute;
  inset: 0;
  -webkit-mask-image: var(--loader-logo);
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-image: var(--loader-logo);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
}

.app-loader__logo-base {
  background: linear-gradient(180deg, rgba(24, 104, 69, 0.10), rgba(24, 104, 69, 0.05));
}

.app-loader__logo-fill {
  overflow: hidden;
  isolation: isolate;
}

.app-loader__liquid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: max(calc(var(--fill-level) + 0.35%), 0%);
  min-height: 0;
  background:
    linear-gradient(
      180deg,
      rgba(134, 239, 172, 0.96) 0%,
      rgba(34, 197, 94, 0.96) 34%,
      rgba(5, 150, 105, 0.98) 70%,
      rgba(6, 95, 70, 1) 100%
    );
  transition: height 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: height;
}

.app-loader__liquid::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 25%, rgba(255, 255, 255, 0.18) 0, transparent 22%),
    radial-gradient(circle at 76% 22%, rgba(255, 255, 255, 0.14) 0, transparent 20%);
  opacity: 0.7;
  pointer-events: none;
}

.app-loader__wave {
  position: absolute;
  left: -12%;
  width: 124%;
  border-radius: 44%;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.app-loader__wave--back {
  top: -1.4rem;
  height: 2.9rem;
  opacity: 0.28;
  background: rgba(255, 255, 255, 0.18);
  animation: app-loader-wave-back 7s linear infinite;
}

.app-loader__wave--mid {
  top: -1.2rem;
  height: 2.55rem;
  opacity: 0.42;
  background: rgba(255, 255, 255, 0.2);
  animation: app-loader-wave-mid 5.2s linear infinite;
}

.app-loader__wave--front {
  top: -1rem;
  height: 2.3rem;
  opacity: 0.88;
  background:
    radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.06) 70%, transparent 72%),
    linear-gradient(180deg, rgba(34, 197, 94, 0.94), rgba(21, 128, 61, 0.96));
  animation: app-loader-wave-front 3.8s linear infinite;
}

.app-loader__foam {
  position: absolute;
  top: -0.08rem;
  left: 7%;
  width: 86%;
  height: 0.32rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.38) 14%,
    rgba(255,255,255,0.16) 50%,
    rgba(255,255,255,0.38) 86%,
    rgba(255,255,255,0) 100%
  );
  filter: blur(0.6px);
  opacity: 0.8;
  animation: app-loader-foam 3.4s ease-in-out infinite;
}

.app-loader__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgba(255,255,255,0.05) 32%,
    rgba(255,255,255,0.12) 48%,
    rgba(255,255,255,0.04) 64%,
    transparent 100%
  );
  mix-blend-mode: screen;
  animation: app-loader-shine 4.8s ease-in-out infinite;
  pointer-events: none;
}

.app-loader__logo-outline {
  background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(22, 163, 74, 0.18));
  opacity: 0.5;
  mix-blend-mode: soft-light;
  pointer-events: none;
}

@keyframes app-loader-wave-front {
  0% {
    transform: translateX(-4%) translateY(0) scaleX(1.02);
  }
  25% {
    transform: translateX(-1%) translateY(-1px) scaleX(1.01);
  }
  50% {
    transform: translateX(3%) translateY(0.5px) scaleX(0.99);
  }
  75% {
    transform: translateX(0%) translateY(-0.5px) scaleX(1.01);
  }
  100% {
    transform: translateX(-4%) translateY(0) scaleX(1.02);
  }
}

@keyframes app-loader-wave-mid {
  0% {
    transform: translateX(4%) translateY(0) scaleX(1);
  }
  50% {
    transform: translateX(-3%) translateY(1px) scaleX(1.02);
  }
  100% {
    transform: translateX(4%) translateY(0) scaleX(1);
  }
}

@keyframes app-loader-wave-back {
  0% {
    transform: translateX(-2%) translateY(0) scaleX(1.01);
  }
  50% {
    transform: translateX(3%) translateY(1.5px) scaleX(1.03);
  }
  100% {
    transform: translateX(-2%) translateY(0) scaleX(1.01);
  }
}

@keyframes app-loader-foam {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.62;
  }
  50% {
    transform: translateY(-0.5px);
    opacity: 0.9;
  }
}

@keyframes app-loader-shine {
  0%, 100% {
    transform: translateX(-2%);
    opacity: 0.45;
  }
  50% {
    transform: translateX(2%);
    opacity: 0.85;
  }
}

@media (max-width: 700px) {
  .app-loader__logo-shell {
    width: min(34vw, 7.6rem);
  }
}
</style>