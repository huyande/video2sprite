import { reactive, ref, toRaw } from 'vue'
import type { ChromaKeyConfig, ExtractedFrame } from '../types'
import { generateThumbnail } from '../utils/canvasUtils'

export function useChromaKey() {
  const config = reactive<ChromaKeyConfig>({
    targetColor: { r: 0, g: 255, b: 0 },
    tolerance: 40,
    feathering: 0,
    spillRemoval: false,
  })

  const isProcessing = ref(false)
  const progress = ref(0)

  /**
   * 批量处理所有帧（使用 Web Worker）
   */
  async function processAllFrames(
    frames: ExtractedFrame[],
    onProgress?: (p: number) => void
  ): Promise<void> {
    if (frames.length === 0) return

    isProcessing.value = true
    progress.value = 0

    const worker = new Worker(
      new URL('../workers/chromaKey.worker.ts', import.meta.url),
      { type: 'module' }
    )

    try {
      let completed = 0

      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data

          if (msg.type === 'FRAME_PROCESSED') {
            const frame = frames.find((f) => f.id === msg.frameId)
            if (frame) {
              frame.processedData = msg.processedData
              frame.processedThumbnailUrl = generateThumbnail(msg.processedData)
            }
            completed++
            progress.value = Math.round((completed / frames.length) * 100)
            onProgress?.(progress.value)
            if (completed === frames.length) resolve()
          } else if (msg.type === 'ERROR') {
            console.error(`Frame ${msg.frameId} processing error:`, msg.error)
            completed++
            progress.value = Math.round((completed / frames.length) * 100)
            if (completed === frames.length) resolve()
          }
        }

        worker.onerror = (e) => {
          reject(new Error(`Worker error: ${e.message}`))
        }

        // 逐帧发送（串行避免内存峰值）
        for (const frame of frames) {
          worker.postMessage({
            type: 'PROCESS_FRAME',
            frameId: frame.id,
            imageData: frame.imageData,
            config: {
              targetColor: { ...toRaw(config.targetColor) },
              tolerance: config.tolerance,
              feathering: config.feathering,
              spillRemoval: config.spillRemoval,
            },
          })
        }
      })
    } finally {
      worker.terminate()
      isProcessing.value = false
    }
  }

  /**
   * 实时预览单帧效果（主线程同步处理）
   */
  function previewFrame(
    imageData: ImageData,
    canvas: HTMLCanvasElement
  ): void {
    const ctx = canvas.getContext('2d')!

    // 先画棋盘格
    const cellSize = 8
    const cols = Math.ceil(canvas.width / cellSize)
    const rows = Math.ceil(canvas.height / cellSize)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e2e8f0'
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
      }
    }

    // 处理图像
    const { targetColor, tolerance, feathering } = config
    const data = imageData.data
    const output = new Uint8ClampedArray(data)
    const maxDist = (tolerance / 100) * Math.sqrt(255 * 255 * 3)

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - targetColor.r
      const dg = data[i + 1] - targetColor.g
      const db = data[i + 2] - targetColor.b
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)

      if (dist < maxDist) {
        if (feathering > 0) {
          const featherStart = maxDist * (1 - feathering / 100)
          if (dist >= featherStart) {
            output[i + 3] = Math.min(255, Math.floor(((dist - featherStart) / (maxDist - featherStart)) * 255))
          } else {
            output[i + 3] = 0
          }
        } else {
          output[i + 3] = 0
        }
      }
    }

    const processed = new ImageData(output, imageData.width, imageData.height)

    // 绘制到临时 canvas 再缩放到预览 canvas
    const temp = document.createElement('canvas')
    temp.width = processed.width
    temp.height = processed.height
    temp.getContext('2d')!.putImageData(processed, 0, 0)

    const scale = Math.min(canvas.width / processed.width, canvas.height / processed.height, 1)
    const w = processed.width * scale
    const h = processed.height * scale
    const x = (canvas.width - w) / 2
    const y = (canvas.height - h) / 2

    ctx.drawImage(temp, x, y, w, h)
  }

  /**
   * 从 Canvas 取色并更新 targetColor
   */
  function pickColorFromCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
    const ctx = canvas.getContext('2d')!
    // 从原始帧 canvas 取色，不是从预览 canvas
    const pixel = ctx.getImageData(x, y, 1, 1).data
    config.targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] }
  }

  return {
    config,
    isProcessing,
    progress,
    processAllFrames,
    previewFrame,
    pickColorFromCanvas,
  }
}
