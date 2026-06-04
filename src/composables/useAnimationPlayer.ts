import { reactive, onUnmounted } from 'vue'
import type { PlayerState, ExtractedFrame } from '../types'

export function useAnimationPlayer() {
  const state = reactive<PlayerState>({
    isPlaying: false,
    currentFrameIndex: 0,
    fps: 24,
    isLooping: true,
  })

  let timerId: number | null = null

  function play(frames: ExtractedFrame[], canvas: HTMLCanvasElement): void {
    if (frames.length === 0) return
    state.isPlaying = true

    const ctx = canvas.getContext('2d')!
    const interval = 1000 / state.fps

    function tick() {
      if (!state.isPlaying) return

      const frame = frames[state.currentFrameIndex]
      if (!frame) {
        state.isPlaying = false
        return
      }

      const imageData = frame.processedData || frame.imageData

      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制棋盘格背景
      const cellSize = 8
      const cols = Math.ceil(canvas.width / cellSize)
      const rows = Math.ceil(canvas.height / cellSize)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e2e8f0'
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
        }
      }

      // 绘制帧
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0)

      const scale = Math.min(canvas.width / imageData.width, canvas.height / imageData.height, 1)
      const w = imageData.width * scale
      const h = imageData.height * scale
      const x = (canvas.width - w) / 2
      const y = (canvas.height - h) / 2
      ctx.drawImage(tempCanvas, x, y, w, h)

      // 推进帧
      state.currentFrameIndex++
      if (state.currentFrameIndex >= frames.length) {
        if (state.isLooping) {
          state.currentFrameIndex = 0
        } else {
          state.isPlaying = false
          return
        }
      }

      timerId = window.setTimeout(tick, interval)
    }

    tick()
  }

  function pause(): void {
    state.isPlaying = false
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  function seekTo(index: number): void {
    state.currentFrameIndex = Math.max(0, index)
  }

  function setFps(fps: number): void {
    state.fps = Math.max(1, Math.min(120, fps))
  }

  function stop(): void {
    pause()
    state.currentFrameIndex = 0
  }

  onUnmounted(() => {
    stop()
  })

  return { state, play, pause, seekTo, setFps, stop }
}
