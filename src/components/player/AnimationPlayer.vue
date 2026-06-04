<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlayerState, ExtractedFrame } from '../../types'

const props = defineProps<{
  frames: ExtractedFrame[]
  playerState: PlayerState
}>()

const emit = defineEmits<{
  play: [canvas: HTMLCanvasElement]
  pause: []
  seekTo: [index: number]
  setFps: [fps: number]
  stop: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const fpsOptions = [10, 12, 15, 24, 30, 60]

// 帧列表变化时绘制第一帧
watch(() => props.frames, (newFrames) => {
  if (canvasRef.value && newFrames.length > 0) {
    drawFrame(newFrames[0])
  }
}, { immediate: true })

// 播放位置变化时绘制当前帧（非播放状态下）
watch(() => props.playerState.currentFrameIndex, (idx) => {
  if (!props.playerState.isPlaying && canvasRef.value && props.frames[idx]) {
    drawFrame(props.frames[idx])
  }
})

function drawFrame(frame: ExtractedFrame) {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')!
  const canvas = canvasRef.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawChecker(ctx, canvas.width, canvas.height)

  const imageData = frame.processedData || frame.imageData
  const temp = document.createElement('canvas')
  temp.width = imageData.width
  temp.height = imageData.height
  temp.getContext('2d')!.putImageData(imageData, 0, 0)

  const scale = Math.min(canvas.width / imageData.width, canvas.height / imageData.height, 1)
  const w = imageData.width * scale
  const h = imageData.height * scale
  ctx.drawImage(temp, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
}

function drawChecker(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cellSize = 8
  for (let row = 0; row < Math.ceil(height / cellSize); row++) {
    for (let col = 0; col < Math.ceil(width / cellSize); col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e2e8f0'
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}

function togglePlay() {
  if (props.playerState.isPlaying) {
    emit('pause')
  } else if (canvasRef.value) {
    emit('play', canvasRef.value)
  }
}

function onFpsChange(e: Event) {
  emit('setFps', Number((e.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="animation-player">
    <canvas
      ref="canvasRef"
      class="player-canvas checker-bg"
      width="640"
      height="360"
    ></canvas>
    <div class="controls">
      <button class="btn btn-sm" @click="emit('stop')" title="停止">⏹</button>
      <button class="btn btn-primary btn-sm" @click="togglePlay" :title="playerState.isPlaying ? '暂停' : '播放'">
        {{ playerState.isPlaying ? '⏸' : '▶' }}
      </button>
      <select class="input input-sm" :value="playerState.fps" @change="onFpsChange">
        <option v-for="fps in fpsOptions" :key="fps" :value="fps">{{ fps }} fps</option>
      </select>
      <label class="loop-label">
        <input type="checkbox" v-model="playerState.isLooping" />
        循环
      </label>
      <span class="frame-counter" v-if="frames.length > 0">
        {{ Math.min(playerState.currentFrameIndex + 1, frames.length) }} / {{ frames.length }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.animation-player {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.player-canvas {
  width: 100%;
  max-width: 720px;
  height: auto;
  aspect-ratio: 16 / 9;
  display: block;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #000;
}
.controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  flex-wrap: wrap;
}
.input-sm {
  padding: 4px 8px;
  font-size: 0.78rem;
  border-radius: var(--radius-sm);
}
.loop-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.loop-label input {
  margin: 0;
  accent-color: var(--color-primary);
}
.frame-counter {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 2px 10px;
  border-radius: var(--radius-sm);
}
</style>
