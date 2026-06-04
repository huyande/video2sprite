<script setup lang="ts">
import type { ExtractedFrame } from '../../types'

defineProps<{
  frame: ExtractedFrame
  isSelected: boolean
  index: number
}>()

const emit = defineEmits<{
  select: [frameId: string]
}>()
</script>

<template>
  <div
    class="frame-item"
    :class="{ selected: isSelected }"
    @click="emit('select', frame.id)"
    :title="`${frame.timestamp.toFixed(2)}s`"
  >
    <div class="thumb-wrapper checker-bg">
      <img
        :src="frame.processedThumbnailUrl || frame.thumbnailUrl"
        class="frame-thumb"
        alt=""
      />
      <span v-if="frame.processedData" class="processed-badge">✓</span>
    </div>
    <span class="frame-index">{{ index + 1 }}</span>
    <span class="frame-time">{{ frame.timestamp.toFixed(1) }}s</span>
  </div>
</template>

<style scoped>
.frame-item {
  position: relative;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  background: var(--color-surface);
}
.frame-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}
.frame-item.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}
.thumb-wrapper {
  position: relative;
}
.frame-thumb {
  width: 100%;
  display: block;
}
.processed-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  background: var(--color-success);
  color: white;
  font-size: 0.55rem;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}
.frame-index {
  position: absolute;
  top: 3px;
  left: 3px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  font-size: 0.6rem;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.4;
  font-family: var(--font-mono);
}
.frame-time {
  display: block;
  text-align: center;
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  padding: 3px 0;
  font-family: var(--font-mono);
}
</style>
