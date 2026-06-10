<script setup lang="ts">
import { computed } from 'vue'

type DistiState = 'idle' | 'loading' | 'thinking' | 'happy' | 'excited' | 'sad' | 'done'
type DistiSize = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    state?: DistiState
    size?: DistiSize
    label?: string
    emoji?: string
    theme?: 'light' | 'dark'
  }>(),
  {
    state: 'loading',
    size: 'md',
    theme: 'light'
  }
)

// Geometría del logo: [x, y, layer]. layer: 0 = morado (atrás), 1 = azul (frente)
const BLOCKS = [
  [0, 0, 0],
  [1, 1, 0],
  [2, 2, 0],
  [1, 3, 0],
  [0, 4, 0],
  [2, 0, 1],
  [3, 1, 1],
  [4, 2, 1],
  [3, 3, 1],
  [2, 4, 1]
]

// Vectores de entrada/salida en celdas
const VECTORS = [
  [-3.0, -2.0],
  [2.5, -2.5],
  [-3.5, 0.0],
  [2.0, 3.0],
  [-2.5, 2.5],
  [3.5, -1.5],
  [-1.5, -3.0],
  [4.0, 0.4],
  [-2.0, 2.5],
  [1.8, 3.5]
]

const CELL_SIZE: Record<DistiSize, number> = { xs: 4, sm: 10, md: 16, lg: 24 }

const cell = computed(() => CELL_SIZE[props.size])

const blocks = computed(() =>
  BLOCKS.map(([x, y, layer], i) => ({
    x,
    y,
    layer,
    i,
    dx: `calc(${VECTORS[i][0]} * ${cell.value}px)`,
    dy: `calc(${VECTORS[i][1]} * ${cell.value}px)`
  }))
)

const stageStyle = computed(() => ({
  width: `${5 * cell.value}px`,
  height: `${5 * cell.value}px`
}))

const blockStyle = (b: (typeof blocks.value)[0]) => ({
  width: `${cell.value}px`,
  height: `${cell.value}px`,
  left: `${b.x * cell.value}px`,
  top: `${b.y * cell.value}px`,
  borderRadius: `${cell.value * 0.18}px`,
  '--dx': b.dx,
  '--dy': b.dy,
  '--i': b.i,
  animationDelay: animDelay(b.i)
})

function animDelay(i: number): string {
  const ms: Record<DistiState, number> = {
    idle: 0,
    loading: 60,
    thinking: 100,
    happy: 50,
    excited: 30,
    sad: 80,
    done: 0
  }
  return `${i * (ms[props.state] ?? 60)}ms`
}

const showLabel = computed(() => props.state !== 'done' && props.state !== 'idle' && !!props.label)
</script>

<template>
  <div class="disti-root" :class="[`disti-size-${size}`, `disti-state-${state}`, theme === 'dark' ? 'disti-dark' : '']">
    <!-- Logo stage -->
    <div class="disti-stage" :style="stageStyle">
      <span v-for="b in blocks" :key="b.i" class="disti-block" :class="b.layer === 0 ? 'disti-back' : 'disti-front'"
        :style="blockStyle(b)" />
    </div>

    <!-- Label -->
    <p v-if="showLabel" class="disti-label">
      <span v-if="emoji" class="disti-emoji">{{ emoji }}</span>
      <span>{{ label }}</span>
      <span class="disti-dots">
        <i>.</i><i>.</i><i>.</i>
      </span>
    </p>
  </div>
</template>

<style scoped>
.disti-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  user-select: none;
}

/* ── Tamaños ── */
.disti-size-xs {
  --cell: 6px;
  gap: 0;
}

.disti-size-sm {
  --cell: 10px;
  gap: 4px;
}

.disti-size-md {
  --cell: 16px;
  gap: 7px;
}

.disti-size-lg {
  --cell: 24px;
  gap: 10px;
}

/* xs: solo el logo, sin label, sin sombra excesiva */
.disti-size-xs .disti-stage {
  filter: drop-shadow(0 2px 6px rgba(58, 43, 138, 0.3));
}

.disti-size-xs .disti-label {
  display: none;
}

/* ── Stage ── */
.disti-stage {
  position: relative;
  filter: drop-shadow(0 8px 18px rgba(58, 43, 138, 0.22));
  transition: filter 0.4s ease;
}

.disti-dark .disti-stage {
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
}

/* ── Bloques ── */
.disti-block {
  position: absolute;
  opacity: 0;
  transform-origin: center;
  transition: background 0.4s ease;
}

.disti-back {
  background: linear-gradient(160deg, #3b2d96 0%, #2a1f6e 80%);
  z-index: 1;
}

.disti-front {
  background: linear-gradient(180deg, #1d63c2 0%, #3cc0f0 100%);
  z-index: 2;
}

/* ── Animaciones por estado ── */
.disti-state-loading .disti-block {
  animation: d-build 2.6s cubic-bezier(0.5, 0.1, 0.3, 1) infinite;
}

.disti-state-thinking .disti-block {
  opacity: 1;
  animation: d-think 2.4s ease-in-out infinite;
}

.disti-state-happy .disti-block {
  opacity: 1;
  animation: d-happy 0.9s cubic-bezier(0.4, 1.6, 0.6, 1) infinite;
}

.disti-state-excited .disti-block {
  opacity: 1;
  animation: d-excited 0.5s ease-in-out infinite;
}

.disti-state-sad .disti-block {
  opacity: 0.85;
  animation: d-sad 3.2s ease-in-out infinite;
}

.disti-state-done .disti-block {
  opacity: 1;
}

.disti-state-idle .disti-block {
  opacity: 0;
}

/* Sad sobreescribe colores */
.disti-state-sad .disti-back {
  background: linear-gradient(135deg, #8a96b0, #6b7794);
}

.disti-state-sad .disti-front {
  background: linear-gradient(135deg, #6b7794, #8a96b0);
}

.disti-state-sad .disti-stage {
  filter: drop-shadow(0 4px 8px rgba(40, 50, 80, 0.15)) saturate(0.6);
}

/* ── Label ── */
.disti-label {
  margin: 0;
  color: #2a2350;
  font: 600 13px/1.2 'Segoe UI', Roboto, system-ui, sans-serif;
  letter-spacing: 0.4px;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.4s ease;
}

.disti-dark .disti-label {
  color: #c9d4ec;
}

.disti-state-sad .disti-label {
  color: #6b7794;
}

.disti-emoji {
  margin-right: 2px;
}

.disti-dots i {
  font-style: normal;
  display: inline-block;
  animation: d-dot 1.2s ease-in-out infinite;
}

.disti-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.disti-dots i:nth-child(3) {
  animation-delay: 0.30s;
}

/* ── Keyframes ── */
@keyframes d-build {
  0% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(0.2);
  }

  15% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }

  60% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }

  85% {
    opacity: 0;
    transform: translate(calc(var(--dx) * -0.6), calc(var(--dy) * -0.6)) scale(0.2);
  }

  100% {
    opacity: 0;
    transform: translate(calc(var(--dx) * -0.6), calc(var(--dy) * -0.6)) scale(0.2);
  }
}

@keyframes d-think {

  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(0.78);
    opacity: 0.55;
  }
}

@keyframes d-happy {

  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  40% {
    transform: translateY(-8px) scale(1.08);
  }

  70% {
    transform: translateY(2px) scale(0.95);
  }
}

@keyframes d-excited {

  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  20% {
    transform: translate(-1px, -2px) scale(1.10);
  }

  40% {
    transform: translate(2px, 1px) scale(0.94);
  }

  60% {
    transform: translate(-1px, 2px) scale(1.08);
  }

  80% {
    transform: translate(1px, -1px) scale(0.96);
  }
}

@keyframes d-sad {

  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(3px) scale(0.96);
  }
}

@keyframes d-dot {

  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .disti-block {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
