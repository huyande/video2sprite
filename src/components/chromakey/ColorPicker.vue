<script setup lang="ts">
import type { RGBColor } from '../../types'
import { rgbToHex, hexToRgb } from '../../utils/colorUtils'

const props = defineProps<{
  color: RGBColor
}>()

const emit = defineEmits<{
  change: [color: RGBColor]
}>()

function onNativePickerChange(e: Event) {
  const hex = (e.target as HTMLInputElement).value
  emit('change', hexToRgb(hex))
}
</script>

<template>
  <div class="color-picker">
    <div class="color-preview" :style="{ background: rgbToHex(props.color) }"></div>
    <input
      type="color"
      :value="rgbToHex(props.color)"
      class="native-picker"
      @input="onNativePickerChange"
    />
    <span class="color-hex">{{ rgbToHex(props.color) }}</span>
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.color-preview {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-border);
}
.native-picker {
  width: 0;
  height: 0;
  opacity: 0;
  position: absolute;
}
.color-hex {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
