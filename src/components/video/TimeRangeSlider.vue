<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  duration: number
}>()

const emit = defineEmits<{
  change: [startTime: number, endTime: number]
}>()

const startTime = ref(0)
const endTime = ref(props.duration)

watch(() => props.duration, (val) => {
  endTime.value = val
  startTime.value = 0
})

const startPercent = computed(() => (startTime.value / props.duration) * 100)
const endPercent = computed(() => (endTime.value / props.duration) * 100)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

function onStartInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  startTime.value = Math.min(val, endTime.value - 0.1)
  emit('change', startTime.value, endTime.value)
}

function onEndInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  endTime.value = Math.max(val, startTime.value + 0.1)
  emit('change', startTime.value, endTime.value)
}
</script>

<template>
  <div class="time-range">
    <div class="range-header">
      <span class="range-label">时间范围</span>
      <span class="range-value">{{ formatTime(startTime) }} — {{ formatTime(endTime) }}</span>
    </div>
    <div class="range-track-container">
      <div class="track">
        <div class="track-fill" :style="{ left: startPercent + '%', right: (100 - endPercent) + '%' }"></div>
      </div>
      <input
        type="range"
        :min="0"
        :max="duration"
        :step="0.1"
        :value="startTime"
        class="range-input"
        @input="onStartInput"
      />
      <input
        type="range"
        :min="0"
        :max="duration"
        :step="0.1"
        :value="endTime"
        class="range-input"
        @input="onEndInput"
      />
    </div>
  </div>
</template>

<style scoped>
.time-range {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.range-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.range-value {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 500;
}
.range-track-container {
  position: relative;
  height: 28px;
}
.track {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
}
.track-fill {
  position: absolute;
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
}
.range-input {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  margin: 0;
}
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  pointer-events: all;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.range-input::-moz-range-thumb {
  pointer-events: all;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
