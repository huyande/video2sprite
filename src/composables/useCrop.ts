import { reactive, ref } from 'vue'
import type { CropConfig, ExtractedFrame } from '../types'
import { cropImageData, generateThumbnail } from '../utils/canvasUtils'

export function useCrop() {
  const config = reactive<CropConfig>({ x: 0, y: 0, width: 0, height: 0 })
  const isProcessing = ref(false)
  const isCropped = ref(false)
  const progress = ref(0)

  /** 根据帧尺寸初始化裁切配置为全帧 */
  function initFromFrame(frame: ExtractedFrame): void {
    config.x = 0
    config.y = 0
    config.width = frame.imageData.width
    config.height = frame.imageData.height
  }

  /** 判断当前配置是否等于全帧（无需裁切） */
  function isFullFrame(frame: ExtractedFrame): boolean {
    return (
      config.x === 0 &&
      config.y === 0 &&
      config.width === frame.imageData.width &&
      config.height === frame.imageData.height
    )
  }

  /** 批量裁切所有帧 */
  async function applyCrop(frames: ExtractedFrame[]): Promise<void> {
    if (frames.length === 0) return
    if (config.width < 1 || config.height < 1) return
    if (isFullFrame(frames[0])) return

    isProcessing.value = true
    progress.value = 0

    const total = frames.length

    for (let i = 0; i < total; i++) {
      const frame = frames[i]

      // 首次裁切时保存原始数据
      if (!frame.originalImageData) {
        frame.originalImageData = frame.imageData
      }

      // 裁切
      frame.imageData = cropImageData(frame.originalImageData, {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      })

      // 清除色键处理结果（裁切后尺寸变了，旧结果失效）
      frame.processedData = undefined
      frame.processedThumbnailUrl = undefined

      // 重新生成缩略图
      frame.thumbnailUrl = generateThumbnail(frame.imageData)

      progress.value = Math.round(((i + 1) / total) * 100)

      // 每 10 帧让出主线程，避免 UI 冻结
      if (i % 10 === 9) {
        await new Promise<void>((r) => setTimeout(r, 0))
      }
    }

    isCropped.value = true
    isProcessing.value = false
  }

  /** 撤销裁切，恢复原始帧 */
  function resetCrop(frames: ExtractedFrame[]): void {
    if (frames.length === 0) return

    for (const frame of frames) {
      if (frame.originalImageData) {
        frame.imageData = frame.originalImageData
        frame.originalImageData = undefined
      }
      frame.processedData = undefined
      frame.processedThumbnailUrl = undefined
      frame.thumbnailUrl = generateThumbnail(frame.imageData)
    }

    // 重置配置为全帧
    initFromFrame(frames[0])
    isCropped.value = false
  }

  return {
    config,
    isProcessing,
    isCropped,
    progress,
    initFromFrame,
    applyCrop,
    resetCrop,
  }
}
