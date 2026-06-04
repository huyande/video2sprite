<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { CropConfig, ExtractedFrame } from '../../types'

type DragMode = 'idle' | 'drawing' | 'moving' | 'resizing'

const props = defineProps<{
  currentFrame: ExtractedFrame | null
  config: CropConfig
  isProcessing: boolean
  isCropped: boolean
  progress: number
}>()

const emit = defineEmits<{
  apply: []
  reset: []
  'update:config': [config: Partial<CropConfig>]
}>()

const cropCanvas = ref<HTMLCanvasElement | null>(null)

// ---- 拖拽状态 ----
const dragMode = ref<DragMode>('idle')
const dragHandle = ref<string | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const dragStartRect = ref({ x: 0, y: 0, width: 0, height: 0 })

const HANDLE_SIZE = 6
const EDGE_THRESHOLD = 8
const MIN_CROP = 10 // 最小裁切像素

const handleEdgeMap: Record<string, { l: boolean; t: boolean; r: boolean; b: boolean }> = {
  tl: { l: true, t: true, r: false, b: false },
  tc: { l: false, t: true, r: false, b: false },
  tr: { l: false, t: true, r: true, b: false },
  ml: { l: true, t: false, r: false, b: false },
  mr: { l: false, t: false, r: true, b: false },
  bl: { l: true, t: false, r: false, b: true },
  bc: { l: false, t: false, r: false, b: true },
  br: { l: false, t: false, r: true, b: true },
}

const handleCursorMap: Record<string, string> = {
  tl: 'nwse-resize', tr: 'nesw-resize',
  bl: 'nesw-resize', br: 'nwse-resize',
  tc: 'ns-resize', bc: 'ns-resize',
  ml: 'ew-resize', mr: 'ew-resize',
}

// ---- 坐标映射 ----

function getScaleInfo() {
  if (!props.currentFrame || !cropCanvas.value) return null
  const img = props.currentFrame.imageData
  const canvas = cropCanvas.value
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const offsetX = (canvas.width - drawW) / 2
  const offsetY = (canvas.height - drawH) / 2
  return { scale, offsetX, offsetY, drawW, drawH, imgW: img.width, imgH: img.height }
}

function mouseToCanvas(e: MouseEvent) {
  if (!cropCanvas.value) return { x: 0, y: 0 }
  const rect = cropCanvas.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (cropCanvas.value.width / rect.width),
    y: (e.clientY - rect.top) * (cropCanvas.value.height / rect.height),
  }
}

function canvasToImage(cx: number, cy: number) {
  const info = getScaleInfo()
  if (!info) return { x: 0, y: 0 }
  return {
    x: Math.round((cx - info.offsetX) / info.scale),
    y: Math.round((cy - info.offsetY) / info.scale),
  }
}

function imageToCanvas(ix: number, iy: number) {
  const info = getScaleInfo()
  if (!info) return { x: 0, y: 0 }
  return {
    x: ix * info.scale + info.offsetX,
    y: iy * info.scale + info.offsetY,
  }
}

// ---- 碰撞检测 ----

function hitTestHandle(cx: number, cy: number): string | null {
  const tl = imageToCanvas(props.config.x, props.config.y)
  const br = imageToCanvas(props.config.x + props.config.width, props.config.y + props.config.height)

  const handles: Record<string, { x: number; y: number }> = {
    tl: tl, tc: { x: (tl.x + br.x) / 2, y: tl.y }, tr: { x: br.x, y: tl.y },
    ml: { x: tl.x, y: (tl.y + br.y) / 2 }, mr: { x: br.x, y: (tl.y + br.y) / 2 },
    bl: { x: tl.x, y: br.y }, bc: { x: (tl.x + br.x) / 2, y: br.y }, br: br,
  }

  for (const [name, pos] of Object.entries(handles)) {
    if (Math.abs(cx - pos.x) <= EDGE_THRESHOLD && Math.abs(cy - pos.y) <= EDGE_THRESHOLD) {
      return name
    }
  }
  return null
}

function isInsideCrop(cx: number, cy: number): boolean {
  const tl = imageToCanvas(props.config.x, props.config.y)
  const br = imageToCanvas(props.config.x + props.config.width, props.config.y + props.config.height)
  return cx >= tl.x && cx <= br.x && cy >= tl.y && cy <= br.y
}

// ---- 渲染 ----

function renderOverlay() {
  if (!cropCanvas.value || !props.currentFrame) return
  const canvas = cropCanvas.value
  const ctx = canvas.getContext('2d')!
  const img = props.currentFrame.imageData
  const info = getScaleInfo()
  if (!info) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 1. 画帧图像
  const temp = document.createElement('canvas')
  temp.width = img.width
  temp.height = img.height
  temp.getContext('2d')!.putImageData(img, 0, 0)
  ctx.drawImage(temp, info.offsetX, info.offsetY, info.drawW, info.drawH)

  // 2. 半透明遮罩（裁切区域外）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 3. 清除裁切区域并重绘帧
  const cropTL = imageToCanvas(props.config.x, props.config.y)
  const cropBR = imageToCanvas(props.config.x + props.config.width, props.config.y + props.config.height)
  const cropCW = cropBR.x - cropTL.x
  const cropCH = cropBR.y - cropTL.y

  ctx.save()
  ctx.beginPath()
  ctx.rect(cropTL.x, cropTL.y, cropCW, cropCH)
  ctx.clip()
  ctx.clearRect(cropTL.x, cropTL.y, cropCW, cropCH)
  ctx.drawImage(temp, info.offsetX, info.offsetY, info.drawW, info.drawH)
  ctx.restore()

  // 4. 裁切框边框
  ctx.strokeStyle = '#4f46e5'
  ctx.lineWidth = 2
  ctx.strokeRect(cropTL.x, cropTL.y, cropCW, cropCH)

  // 5. 三分线（辅助线）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 2; i++) {
    const lineX = cropTL.x + (cropCW * i) / 3
    const lineY = cropTL.y + (cropCH * i) / 3
    ctx.beginPath()
    ctx.moveTo(lineX, cropTL.y)
    ctx.lineTo(lineX, cropTL.y + cropCH)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cropTL.x, lineY)
    ctx.lineTo(cropTL.x + cropCW, lineY)
    ctx.stroke()
  }

  // 6. 拖拽手柄
  const handles: Record<string, { x: number; y: number }> = {
    tl: cropTL, tc: { x: cropTL.x + cropCW / 2, y: cropTL.y }, tr: { x: cropBR.x, y: cropTL.y },
    ml: { x: cropTL.x, y: cropTL.y + cropCH / 2 }, mr: { x: cropBR.x, y: cropTL.y + cropCH / 2 },
    bl: { x: cropTL.x, y: cropBR.y }, bc: { x: cropTL.x + cropCW / 2, y: cropBR.y }, br: cropBR,
  }

  for (const pos of Object.values(handles)) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 1.5
    ctx.strokeRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
  }

  // 7. 尺寸标注
  const info2 = getScaleInfo()
  if (info2 && props.config.width > 30 && props.config.height > 20) {
    const label = `${props.config.width} × ${props.config.height}`
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    const textW = ctx.measureText(label).width
    const textX = cropTL.x + cropCW / 2 - textW / 2
    const textY = cropBR.y + 16
    ctx.fillRect(textX - 4, textY - 11, textW + 8, 15)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, textX, textY)
  }
}

// ---- 鼠标事件 ----

function clampConfig(c: Partial<CropConfig>) {
  const info = getScaleInfo()
  if (!info) return
  const maxW = info.imgW
  const maxH = info.imgH

  if (c.x !== undefined) c.x = Math.max(0, Math.min(c.x, maxW - MIN_CROP))
  if (c.y !== undefined) c.y = Math.max(0, Math.min(c.y, maxH - MIN_CROP))
  if (c.width !== undefined) c.width = Math.max(MIN_CROP, Math.min(c.width, maxW - (c.x ?? props.config.x)))
  if (c.height !== undefined) c.height = Math.max(MIN_CROP, Math.min(c.height, maxH - (c.y ?? props.config.y)))
}

function onMouseDown(e: MouseEvent) {
  if (!props.currentFrame) return
  const cp = mouseToCanvas(e)
  const ip = canvasToImage(cp.x, cp.y)

  // 快照当前 rect
  dragStartRect.value = { x: props.config.x, y: props.config.y, width: props.config.width, height: props.config.height }
  dragStart.value = { x: ip.x, y: ip.y }

  // 检测手柄
  const handle = hitTestHandle(cp.x, cp.y)
  if (handle) {
    dragMode.value = 'resizing'
    dragHandle.value = handle
  } else if (isInsideCrop(cp.x, cp.y)) {
    dragMode.value = 'moving'
  } else {
    dragMode.value = 'drawing'
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!props.currentFrame) return
  const cp = mouseToCanvas(e)
  const ip = canvasToImage(cp.x, cp.y)
  const dx = ip.x - dragStart.value.x
  const dy = ip.y - dragStart.value.y
  const info = getScaleInfo()
  if (!info) return

  if (dragMode.value === 'idle') {
    // 更新光标
    const handle = hitTestHandle(cp.x, cp.y)
    if (handle) {
      cropCanvas.value!.style.cursor = handleCursorMap[handle]
    } else if (isInsideCrop(cp.x, cp.y)) {
      cropCanvas.value!.style.cursor = 'move'
    } else {
      cropCanvas.value!.style.cursor = 'crosshair'
    }
    return
  }

  let newX = dragStartRect.value.x
  let newY = dragStartRect.value.y
  let newW = dragStartRect.value.width
  let newH = dragStartRect.value.height

  if (dragMode.value === 'drawing') {
    // 从起点到当前点画矩形
    const x1 = dragStart.value.x
    const y1 = dragStart.value.y
    const x2 = ip.x
    const y2 = ip.y
    newX = Math.max(0, Math.min(x1, x2))
    newY = Math.max(0, Math.min(y1, y2))
    newW = Math.max(MIN_CROP, Math.abs(x2 - x1))
    newH = Math.max(MIN_CROP, Math.abs(y2 - y1))
    // 边界限制
    if (newX + newW > info.imgW) newW = info.imgW - newX
    if (newY + newH > info.imgH) newH = info.imgH - newY
  } else if (dragMode.value === 'moving') {
    newX = Math.max(0, Math.min(dragStartRect.value.x + dx, info.imgW - dragStartRect.value.width))
    newY = Math.max(0, Math.min(dragStartRect.value.y + dy, info.imgH - dragStartRect.value.height))
  } else if (dragMode.value === 'resizing' && dragHandle.value) {
    const edges = handleEdgeMap[dragHandle.value]
    if (edges.l) {
      newX = Math.max(0, Math.min(dragStartRect.value.x + dx, dragStartRect.value.x + dragStartRect.value.width - MIN_CROP))
      newW = dragStartRect.value.x + dragStartRect.value.width - newX
    }
    if (edges.r) {
      newW = Math.max(MIN_CROP, Math.min(dragStartRect.value.width + dx, info.imgW - newX))
    }
    if (edges.t) {
      newY = Math.max(0, Math.min(dragStartRect.value.y + dy, dragStartRect.value.y + dragStartRect.value.height - MIN_CROP))
      newH = dragStartRect.value.y + dragStartRect.value.height - newY
    }
    if (edges.b) {
      newH = Math.max(MIN_CROP, Math.min(dragStartRect.value.height + dy, info.imgH - newY))
    }
  }

  const newConfig = { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
  emit('update:config', newConfig)
}

function onMouseUp() {
  dragMode.value = 'idle'
  dragHandle.value = null
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// ---- 数值输入 ----

function onInputChange(field: keyof CropConfig, value: string) {
  const num = Math.max(0, Number(value))
  const info = getScaleInfo()
  if (!info) return

  const update: Partial<CropConfig> = {}
  if (field === 'x') update.x = Math.min(num, info.imgW - MIN_CROP)
  else if (field === 'y') update.y = Math.min(num, info.imgH - MIN_CROP)
  else if (field === 'width') update.width = Math.max(MIN_CROP, Math.min(num, info.imgW - props.config.x))
  else if (field === 'height') update.height = Math.max(MIN_CROP, Math.min(num, info.imgH - props.config.y))

  emit('update:config', update)
}

// ---- 生命周期 ----

watch(
  () => [props.currentFrame, props.config.x, props.config.y, props.config.width, props.config.height],
  () => renderOverlay(),
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="crop-panel">
    <!-- 预览 Canvas -->
    <div class="preview-container">
      <canvas
        ref="cropCanvas"
        class="crop-canvas"
        width="640"
        height="360"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
      ></canvas>
      <div v-if="!currentFrame" class="preview-empty">选择一帧以预览裁切区域</div>
    </div>

    <!-- 数值输入 -->
    <div class="crop-inputs">
      <label class="input-group">
        <span>X</span>
        <input
          type="number"
          class="input input-number"
          :value="config.x"
          min="0"
          @input="onInputChange('x', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="input-group">
        <span>Y</span>
        <input
          type="number"
          class="input input-number"
          :value="config.y"
          min="0"
          @input="onInputChange('y', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="input-group">
        <span>宽</span>
        <input
          type="number"
          class="input input-number"
          :value="config.width"
          :min="10"
          @input="onInputChange('width', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="input-group">
        <span>高</span>
        <input
          type="number"
          class="input input-number"
          :value="config.height"
          :min="10"
          @input="onInputChange('height', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <!-- 操作按钮 -->
    <div class="crop-actions">
      <button
        class="btn btn-sm"
        :disabled="!isCropped || isProcessing"
        @click="emit('reset')"
      >
        重置裁切
      </button>
      <button
        class="btn btn-primary btn-sm"
        :disabled="isProcessing"
        @click="emit('apply')"
      >
        {{ isProcessing ? `裁切中 ${progress}%` : '应用到所有帧' }}
      </button>
    </div>

    <!-- 进度条 -->
    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.crop-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.preview-container {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
}
.crop-canvas {
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
.crop-inputs {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.input-group .input-number {
  width: 70px;
  padding: 4px 6px;
  font-size: 0.75rem;
}
.crop-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
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
