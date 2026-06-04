<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ChromaKeyConfig, ExtractedFrame } from '../../types'
import ColorPicker from './ColorPicker.vue'

const props = defineProps<{
  config: ChromaKeyConfig
  currentFrame: ExtractedFrame | null
  isProcessing: boolean
  progress: number
}>()

const emit = defineEmits<{
  apply: []
  preview: [imageData: ImageData, canvas: HTMLCanvasElement]
}>()

const previewCanvas = ref<HTMLCanvasElement | null>(null)

// 当参数变化时实时预览
watch(
  () => [props.config.targetColor, props.config.tolerance, props.config.feathering, props.currentFrame],
  () => {
    if (previewCanvas.value && props.currentFrame) {
      emit('preview', props.currentFrame.imageData, previewCanvas.value)
    }
  },
  { deep: true }
)

function onColorChange(color: { r: number; g: number; b: number }) {
  props.config.targetColor = color
}

function onCanvasClick(e: MouseEvent) {
  if (!previewCanvas.value || !props.currentFrame) return
  const rect = previewCanvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  // 从原始 imageData 取色（通过临时 canvas）
  const temp = document.createElement('canvas')
  temp.width = props.currentFrame.imageData.width
  temp.height = props.currentFrame.imageData.height
  temp.getContext('2d')!.putImageData(props.currentFrame.imageData, 0, 0)
  const pixel = temp.getContext('2d')!.getImageData(
    Math.floor(x * (temp.width / rect.width)),
    Math.floor(y * (temp.height / rect.height)),
    1, 1
  ).data
  props.config.targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] }
}
</script>

<template>
  <div class="chromakey-panel">
    <!-- 目标颜色 -->
    <div class="field">
      <label class="field-label">目标颜色</label>
      <ColorPicker :color="config.targetColor" @change="onColorChange" />
      <span class="field-hint">点击下方预览可取色</span>
    </div>

    <!-- 容差 -->
    <div class="field">
      <label class="field-label">容差 <span class="field-value">{{ config.tolerance }}</span></label>
      <input
        type="range"
        class="slider"
        min="0"
        max="100"
        :value="config.tolerance"
        @input="config.tolerance = Number(($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 边缘平滑度 -->
    <div class="field">
      <label class="field-label">边缘平滑度 <span class="field-value">{{ config.feathering }}</span></label>
      <input
        type="range"
        class="slider"
        min="0"
        max="100"
        :value="config.feathering"
        @input="config.feathering = Number(($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 预览 Canvas -->
    <div class="preview-container">
      <canvas
        ref="previewCanvas"
        class="preview-canvas checker-bg"
        width="640"
        height="360"
        @click="onCanvasClick"
      ></canvas>
      <div v-if="!currentFrame" class="preview-empty">选择一帧以预览效果</div>
    </div>

    <!-- 应用按钮 -->
    <button
      class="btn btn-primary"
      :disabled="isProcessing"
      @click="emit('apply')"
    >
      {{ isProcessing ? `处理中 ${progress}%` : '应用到所有帧' }}
    </button>
    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.chromakey-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.field-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.field-value {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 600;
}
.field-hint {
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
}
.preview-container {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
}
.preview-canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  display: block;
  cursor: crosshair;
}
.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  aspect-ratio: 16 / 9;
}
.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width var(--transition-base);
}
</style>
