<script setup lang="ts">
import type { ExtractedFrame } from '../../types'
import FrameItem from './FrameItem.vue'

const props = defineProps<{
  frames: ExtractedFrame[]
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [frameId: string]
}>()

function isSelected(id: string): boolean {
  return props.selectedIds.has(id)
}
</script>

<template>
  <div class="frame-grid">
    <div class="grid-container">
      <FrameItem
        v-for="(frame, index) in frames"
        :key="frame.id"
        :frame="frame"
        :index="index"
        :is-selected="isSelected(frame.id)"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.frame-grid {
  display: flex;
  flex-direction: column;
}
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: var(--spacing-sm);
  max-height: 360px;
  overflow-y: auto;
  padding: var(--spacing-xs);
}
</style>
