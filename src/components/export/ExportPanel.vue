<script setup lang="ts">
import { computed } from 'vue'
import type { ExtractedFrame, SpriteSheetConfig } from '../../types'

const props = defineProps<{
  frames: ExtractedFrame[]
  spriteConfig: SpriteSheetConfig
  hasProcessed: boolean
}>()

const emit = defineEmits<{
  exportSingle: [frame: ExtractedFrame]
  exportSprite: [frames: ExtractedFrame[], config: SpriteSheetConfig]
}>()

const scalePercent = computed(() => Math.round(props.spriteConfig.scale * 100))

const exportDimensions = computed(() => {
  if (props.frames.length === 0) return null
  const f = props.frames[0]
  const w = Math.round(f.imageData.width * props.spriteConfig.scale)
  const h = Math.round(f.imageData.height * props.spriteConfig.scale)
  const { columns, padding } = props.spriteConfig
  const rows = Math.ceil(props.frames.length / columns)
  const totalW = columns * w + (columns + 1) * padding
  const totalH = rows * h + (rows + 1) * padding
  return { frameW: w, frameH: h, totalW, totalH }
})

function onExportSingle() {
  if (props.frames.length > 0) {
    emit('exportSingle', props.frames[0])
  }
}

function onExportSprite() {
  emit('exportSprite', props.frames, props.spriteConfig)
}
</script>

<template>
  <div class="export-panel">
    <!-- 雪碧图配置 -->
    <div class="config-row">
      <label class="field-label">
        每行列数
        <input
          v-model.number="spriteConfig.columns"
          type="number"
          class="input input-number"
          :min="1"
          :max="50"
        />
      </label>
      <label class="field-label">
        间距 (px)
        <input
          v-model.number="spriteConfig.padding"
          type="number"
          class="input input-number"
          :min="0"
          :max="20"
        />
      </label>
    </div>

    <!-- 缩放比例 -->
    <div class="scale-row">
      <label class="field-label">
        缩放比例
        <span class="scale-value">{{ scalePercent }}%</span>
      </label>
      <input
        type="range"
        class="slider"
        :value="scalePercent"
        min="10"
        max="100"
        step="5"
        @input="spriteConfig.scale = Number(($event.target as HTMLInputElement).value) / 100"
      />
    </div>

    <!-- 尺寸预估 -->
    <div class="export-info" v-if="frames.length > 0 && exportDimensions">
      单帧 <strong>{{ exportDimensions.frameW }}×{{ exportDimensions.frameH }}</strong>
      &nbsp;|&nbsp;
      雪碧图 <strong>{{ exportDimensions.totalW }}×{{ exportDimensions.totalH }}</strong>
      &nbsp;|&nbsp;
      <strong>{{ frames.length }}</strong> 帧
      <span v-if="hasProcessed" class="export-note">（透明背景）</span>
      <span v-if="scalePercent < 100" class="export-note">（{{ scalePercent }}% 缩放压缩）</span>
    </div>

    <!-- 导出按钮 -->
    <div class="export-actions">
      <button class="btn" @click="onExportSingle" :disabled="frames.length === 0">
        📄 导出首帧 PNG
      </button>
      <button
        class="btn btn-primary"
        @click="onExportSprite"
        :disabled="frames.length === 0"
      >
        📦 导出雪碧图 + JSON
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.config-row {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
  flex-wrap: wrap;
}
.scale-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
.scale-row .slider {
  flex: 1;
  max-width: 200px;
}
.scale-value {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
  font-weight: 600;
  min-width: 36px;
}
.field-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.export-info {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  padding: var(--spacing-sm) 0;
}
.export-info strong {
  color: var(--color-text);
}
.export-note {
  color: var(--color-success);
  font-size: 0.75rem;
  font-weight: 500;
}
.export-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
</style>
