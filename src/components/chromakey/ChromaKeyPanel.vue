<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ChromaKeyConfig, ChromaKeyToolMode, ExtractedFrame } from '../../types'
import ColorPicker from './ColorPicker.vue'

const props = defineProps<{
  config: ChromaKeyConfig
  currentFrame: ExtractedFrame | null
  isProcessing: boolean
  progress: number
  toolMode: ChromaKeyToolMode
  brushSize: number
  brushHardness: number
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  apply: []
  preview: [imageData: ImageData, canvas: HTMLCanvasElement]
  'update:toolMode': [mode: ChromaKeyToolMode]
  'update:brushSize': [size: number]
  'update:brushHardness': [hardness: number]
  undo: []
  redo: []
  'brush-stroke': [from: { x: number; y: number }, to: { x: number; y: number }]
  'brush-finish': []
}>()

const previewCanvas = ref<HTMLCanvasElement | null>(null)

// 画笔绘制状态
const isDrawing = ref(false)
const lastImgPoint = ref<{ x: number; y: number } | null>(null)

// CSS 光标位置（不操作 canvas）
const cursorX = ref(0)
const cursorY = ref(0)
const cursorVisible = ref(false)

/** 光标直径（CSS 像素），基于 canvas 显示比例换算 */
const cursorDiameter = computed(() => {
  if (!previewCanvas.value || !props.currentFrame) return props.brushSize * 2
  const img = props.currentFrame.imageData
  const canvas = previewCanvas.value
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
  const cssScale = canvas.getBoundingClientRect().width / canvas.width
  return props.brushSize * scale * cssScale * 2
})

// 缓存上一帧预览数据（避免画笔光标闪烁时反复重绘图像）
let cachedProcessedCanvas: HTMLCanvasElement | null = null
let cachedFrameId: string | null = null

// 当参数变化或切换帧时实时预览
// 注意：只监听 currentFrame?.id，不 deep 监听整个 frame 对象
// 否则 finishStroke 修改 processedThumbnailUrl 会触发重绘，冲掉画笔编辑结果
watch(
  () => [props.config.targetColor, props.config.tolerance, props.config.feathering, props.currentFrame?.id],
  () => {
    if (previewCanvas.value && props.currentFrame) {
      cachedFrameId = null
      if (props.toolMode === 'restore-brush' && props.currentFrame.processedData) {
        // 画笔模式下，显示 processedData（保留画笔编辑结果）
        redrawProcessed()
      } else {
        // 取色模式下，显示色键预览
        emit('preview', props.currentFrame.imageData, previewCanvas.value)
      }
    }
  },
  { deep: true }
)

function onColorChange(color: { r: number; g: number; b: number }) {
  props.config.targetColor = color
}

/** 将鼠标事件坐标转换为图像像素坐标 */
function mouseToImageCoords(e: MouseEvent) {
  if (!previewCanvas.value || !props.currentFrame) return null
  const canvas = previewCanvas.value
  const rect = canvas.getBoundingClientRect()
  const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width)
  const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height)

  const img = props.currentFrame.imageData
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
  const offsetX = (canvas.width - img.width * scale) / 2
  const offsetY = (canvas.height - img.height * scale) / 2

  const imgX = (canvasX - offsetX) / scale
  const imgY = (canvasY - offsetY) / scale

  return {
    canvasX,
    canvasY,
    imgX,
    imgY,
    scale,
    offsetX,
    offsetY,
  }
}

/** 判断坐标是否在图像范围内 */
function isInsideImage(imgX: number, imgY: number): boolean {
  if (!props.currentFrame) return false
  const img = props.currentFrame.imageData
  return imgX >= 0 && imgX < img.width && imgY >= 0 && imgY < img.height
}

// ---- Canvas 事件 ----

function onCanvasMouseDown(e: MouseEvent) {
  if (!props.currentFrame || !previewCanvas.value) return

  if (props.toolMode === 'picker') {
    onCanvasClick(e)
    return
  }

  // 恢复画笔模式
  if (props.toolMode === 'restore-brush') {
    const coords = mouseToImageCoords(e)
    if (!coords || !isInsideImage(coords.imgX, coords.imgY)) return

    isDrawing.value = true
    const pt = { x: coords.imgX, y: coords.imgY }
    lastImgPoint.value = pt
    // 单点也绘制（处理 click 不 move 的情况）
    emit('brush-stroke', pt, pt)
    redrawProcessed() // 立即显示画笔效果
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  if (!previewCanvas.value) return

  if (props.toolMode === 'restore-brush') {
    const coords = mouseToImageCoords(e)

    // 更新 CSS 光标位置（不操作 canvas）
    if (coords) {
      const rect = previewCanvas.value.getBoundingClientRect()
      // 用 CSS 像素定位光标 div
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      const displayRadius = props.brushSize * coords.scale
      const cssScale = rect.width / previewCanvas.value.width
      cursorX.value = cssX - displayRadius * cssScale
      cursorY.value = cssY - displayRadius * cssScale
      cursorVisible.value = true
    }

    // 按住鼠标绘制中 → 才操作 canvas
    if (isDrawing.value && coords && isInsideImage(coords.imgX, coords.imgY)) {
      const pt = { x: coords.imgX, y: coords.imgY }
      emit('brush-stroke', lastImgPoint.value!, pt)
      lastImgPoint.value = pt
      redrawProcessed()
    }
  }
}

function onCanvasMouseUp() {
  if (isDrawing.value) {
    isDrawing.value = false
    lastImgPoint.value = null
    if (props.toolMode === 'restore-brush') {
      emit('brush-finish')
      redrawProcessed() // 确保 canvas 显示最终状态
    }
  }
}

function onCanvasMouseLeave() {
  cursorVisible.value = false
  if (isDrawing.value) {
    isDrawing.value = false
    lastImgPoint.value = null
    if (props.toolMode === 'restore-brush') {
      emit('brush-finish')
      redrawProcessed() // 鼠标离开时也确保 canvas 显示最终状态
    }
  }
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

/** 重绘 processedData 到 canvas（带棋盘格背景） */
function redrawProcessed() {
  const canvas = previewCanvas.value
  const frame = props.currentFrame
  if (!canvas || !frame?.processedData) return

  const ctx = canvas.getContext('2d')!
  const img = frame.processedData

  // 使用缓存的离屏 canvas
  if (cachedFrameId !== frame.id || !cachedProcessedCanvas) {
    cachedProcessedCanvas = document.createElement('canvas')
    cachedProcessedCanvas.width = img.width
    cachedProcessedCanvas.height = img.height
    cachedProcessedCanvas.getContext('2d')!.putImageData(img, 0, 0)
    cachedFrameId = frame.id
  } else {
    // 更新缓存
    cachedProcessedCanvas.getContext('2d')!.putImageData(img, 0, 0)
  }

  // 棋盘格背景
  const cellSize = 8
  const cols = Math.ceil(canvas.width / cellSize)
  const rows = Math.ceil(canvas.height / cellSize)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e2e8f0'
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }

  // 缩放绘制
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
  const w = img.width * scale
  const h = img.height * scale
  const x = (canvas.width - w) / 2
  const y = (canvas.height - h) / 2
  ctx.drawImage(cachedProcessedCanvas, x, y, w, h)
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

    <!-- 工具切换 -->
    <div class="field">
      <label class="field-label">工具</label>
      <div class="tool-buttons">
        <button
          class="btn-tool"
          :class="{ active: toolMode === 'picker' }"
          title="取色器"
          @click="emit('update:toolMode', 'picker')"
        >
          🎨 取色
        </button>
        <button
          class="btn-tool"
          :class="{ active: toolMode === 'restore-brush' }"
          title="恢复画笔 - 涂抹恢复已移除的区域"
          @click="emit('update:toolMode', 'restore-brush')"
        >
          🖌️ 恢复画笔
        </button>
      </div>
      <span v-if="toolMode === 'restore-brush' && !currentFrame?.processedData" class="field-hint hint-warning">
        需先「应用到所有帧」后画笔才有效果
      </span>
      <span v-if="toolMode === 'restore-brush' && currentFrame?.processedData" class="field-hint">
        按住鼠标涂抹已移除的区域可恢复原始像素
      </span>
    </div>

    <!-- 画笔设置（仅恢复画笔模式显示） -->
    <template v-if="toolMode === 'restore-brush'">
      <div class="field">
        <label class="field-label">画笔大小 <span class="field-value">{{ brushSize }}px</span></label>
        <input
          type="range"
          class="slider"
          min="1"
          max="80"
          :value="brushSize"
          @input="emit('update:brushSize', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="field">
        <label class="field-label">画笔硬度 <span class="field-value">{{ brushHardness }}%</span></label>
        <input
          type="range"
          class="slider"
          min="0"
          max="100"
          :value="brushHardness"
          @input="emit('update:brushHardness', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="undo-redo-row">
        <button
          class="btn btn-sm"
          :disabled="!canUndo"
          title="撤销 (Ctrl+Z)"
          @click="emit('undo')"
        >
          ↩ 撤销
        </button>
        <button
          class="btn btn-sm"
          :disabled="!canRedo"
          title="重做 (Ctrl+Y)"
          @click="emit('redo')"
        >
          ↪ 重做
        </button>
      </div>
    </template>

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
        :class="{ 'cursor-brush': toolMode === 'restore-brush' }"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseup="onCanvasMouseUp"
        @mouseleave="onCanvasMouseLeave"
      ></canvas>
      <!-- CSS 光标覆盖层（不操作 canvas，避免误触） -->
      <div
        v-if="toolMode === 'restore-brush' && cursorVisible"
        class="brush-cursor"
        :style="{
          left: cursorX + 'px',
          top: cursorY + 'px',
          width: cursorDiameter + 'px',
          height: cursorDiameter + 'px',
        }"
      ></div>
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
.hint-warning {
  color: var(--color-warning);
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
.cursor-brush {
  cursor: none;
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

/* 工具切换按钮 */
.tool-buttons {
  display: flex;
  gap: var(--spacing-xs);
}
.btn-tool {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}
.btn-tool:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-lighter);
}
.btn-tool.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 600;
}
.btn-tool:disabled,
.btn-tool.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 撤销重做 */
.undo-redo-row {
  display: flex;
  gap: var(--spacing-xs);
}

/* CSS 画笔光标（不操作 canvas，避免鼠标移入就重绘） */
.brush-cursor {
  position: absolute;
  border: 1.5px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  pointer-events: none;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.5);
  z-index: 1;
  will-change: transform;
}
</style>
