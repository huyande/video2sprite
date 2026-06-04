<script setup lang="ts">
defineProps<{
  frameCount: number
  isExtracting: boolean
  progress: number
}>()

const emit = defineEmits<{
  updateFrameCount: [count: number]
  extract: []
}>()
</script>

<template>
  <div class="frame-toolbar">
    <span class="toolbar-label">帧数:</span>
    <input
      type="number"
      class="input input-number"
      :min="1"
      :max="200"
      :value="frameCount"
      @input="emit('updateFrameCount', Number(($event.target as HTMLInputElement).value))"
    />
    <button
      class="btn btn-primary btn-sm"
      :disabled="isExtracting"
      @click="emit('extract')"
    >
      {{ isExtracting ? `提取中 ${progress}%` : '开始提取' }}
    </button>
  </div>
</template>

<style scoped>
.frame-toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.toolbar-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
