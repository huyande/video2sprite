import { reactive, ref } from 'vue'
import type { BrushConfig, ChromaKeyToolMode, ExtractedFrame } from '../types'
import { generateThumbnail } from '../utils/canvasUtils'

const MAX_HISTORY = 30

/** Bresenham 直线插值，保证快速移动时笔画连续 */
function interpolateLine(
  x0: number, y0: number,
  x1: number, y1: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let cx = x0
  let cy = y0

  while (true) {
    points.push({ x: cx, y: cy })
    if (cx === x1 && cy === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      cx += sx
    }
    if (e2 < dx) {
      err += dx
      cy += sy
    }
  }
  return points
}

export function useBrushEdit() {
  const toolMode = ref<ChromaKeyToolMode>('picker')
  const brushConfig = reactive<BrushConfig>({
    size: 10,
    hardness: 80,
  })

  // 撤销/重做
  const historyStack = ref<ImageData[]>([])
  const historyIndex = ref(-1)

  /** 保存当前状态到历史栈 */
  function pushHistory(data: ImageData): void {
    // 截断当前位置之后的历史
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
    // 深拷贝
    const snapshot = new ImageData(
      new Uint8ClampedArray(data.data),
      data.width,
      data.height
    )
    historyStack.value.push(snapshot)
    if (historyStack.value.length > MAX_HISTORY) {
      historyStack.value.shift()
    }
    historyIndex.value = historyStack.value.length - 1
  }

  /** 切换帧时重置历史 */
  function resetHistory(): void {
    historyStack.value = []
    historyIndex.value = -1
  }

  const canUndo = ref(false)
  const canRedo = ref(false)

  function updateHistoryFlags(): void {
    canUndo.value = historyIndex.value > 0
    canRedo.value = historyIndex.value < historyStack.value.length - 1
  }

  /** 撤销 */
  function undo(frame: ExtractedFrame): void {
    if (historyIndex.value <= 0) return
    historyIndex.value--
    const snapshot = historyStack.value[historyIndex.value]
    frame.processedData = new ImageData(
      new Uint8ClampedArray(snapshot.data),
      snapshot.width,
      snapshot.height
    )
    frame.processedThumbnailUrl = generateThumbnail(frame.processedData)
    updateHistoryFlags()
  }

  /** 重做 */
  function redo(frame: ExtractedFrame): void {
    if (historyIndex.value >= historyStack.value.length - 1) return
    historyIndex.value++
    const snapshot = historyStack.value[historyIndex.value]
    frame.processedData = new ImageData(
      new Uint8ClampedArray(snapshot.data),
      snapshot.width,
      snapshot.height
    )
    frame.processedThumbnailUrl = generateThumbnail(frame.processedData)
    updateHistoryFlags()
  }

  /** 切换工具模式 */
  function setToolMode(mode: ChromaKeyToolMode): void {
    toolMode.value = mode
  }

  /**
   * 恢复画笔核心绘制：
   * 从 frame.imageData（原始像素）恢复到 frame.processedData
   */
  function restoreStroke(
    frame: ExtractedFrame,
    fromImg: { x: number; y: number },
    toImg: { x: number; y: number }
  ): void {
    const processed = frame.processedData
    const original = frame.imageData
    if (!processed || !original) return

    const pData = processed.data
    const oData = original.data
    const w = processed.width
    const h = processed.height
    const radius = brushConfig.size
    const hardness = brushConfig.hardness

    // 插值获取连续路径点
    const points = interpolateLine(
      Math.round(fromImg.x), Math.round(fromImg.y),
      Math.round(toImg.x), Math.round(toImg.y)
    )

    for (const point of points) {
      const px = Math.round(point.x)
      const py = Math.round(point.y)

      // 遍历画笔覆盖区域（边界裁剪）
      const yStart = Math.max(0, py - radius)
      const yEnd = Math.min(h - 1, py + radius)
      const xStart = Math.max(0, px - radius)
      const xEnd = Math.min(w - 1, px + radius)

      for (let iy = yStart; iy <= yEnd; iy++) {
        for (let ix = xStart; ix <= xEnd; ix++) {
          const dx = ix - px
          const dy = iy - py
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > radius) continue

          const idx = (iy * w + ix) * 4

          // 根据硬度计算 alpha 权重
          let alpha = 1.0
          if (hardness < 100) {
            const edgeDist = dist / radius
            const featherZone = hardness / 100
            if (edgeDist > featherZone) {
              alpha = 1 - (edgeDist - featherZone) / (1 - featherZone)
            }
          }

          // 恢复原始像素
          const origAlpha = oData[idx + 3]
          const newAlpha = Math.round(origAlpha * alpha + pData[idx + 3] * (1 - alpha))

          // 混合 RGB（按 alpha 权重）
          pData[idx]     = Math.round(oData[idx] * alpha + pData[idx] * (1 - alpha))
          pData[idx + 1] = Math.round(oData[idx + 1] * alpha + pData[idx + 1] * (1 - alpha))
          pData[idx + 2] = Math.round(oData[idx + 2] * alpha + pData[idx + 2] * (1 - alpha))
          pData[idx + 3] = Math.max(pData[idx + 3], newAlpha)
        }
      }
    }
  }

  /** 笔画结束后更新缩略图 */
  function finishStroke(frame: ExtractedFrame): void {
    if (!frame.processedData) return
    frame.processedThumbnailUrl = generateThumbnail(frame.processedData)
    // 将当前 processedData 推入历史
    pushHistory(frame.processedData)
    updateHistoryFlags()
  }

  /**
   * 将当前帧的画笔编辑传播到所有帧。
   *
   * 原理：对比画笔编辑后的 editedData 与初始色键结果（historyStack[0]），
   * 计算出「恢复蒙版」（哪些像素被画笔恢复了），然后将蒙版应用到所有帧。
   *
   * 必须在 processAllFrames 之前调用（保存 editedData），
   * 在 processAllFrames 之后调用本方法（蒙版应用到新色键结果上）。
   */
  function propagateBrushEdits(frames: ExtractedFrame[], editedData: ImageData): void {
    if (historyStack.value.length === 0) return

    const initial = historyStack.value[0] // 初始色键结果（无画笔编辑）
    const w = editedData.width
    const h = editedData.height
    if (initial.width !== w || initial.height !== h) return

    // 1. 计算恢复蒙版：editedData（画笔后）vs initial（画笔前）
    const mask = new Float32Array(w * h)
    const eData = editedData.data
    const iData = initial.data

    for (let i = 0; i < w * h; i++) {
      const idx = i * 4
      const editedAlpha = eData[idx + 3]
      const initialAlpha = iData[idx + 3]
      // 画笔恢复会使 alpha 增大（被移除的像素重新变不透明）
      if (editedAlpha > initialAlpha && initialAlpha < 255) {
        mask[i] = Math.min(1.0, (editedAlpha - initialAlpha) / (255 - initialAlpha))
      }
    }

    // 2. 将蒙版应用到所有帧（包括当前帧，因为 processAllFrames 已覆盖）
    for (const frame of frames) {
      if (!frame.processedData || !frame.imageData) continue
      if (frame.processedData.width !== w || frame.processedData.height !== h) continue

      const fpData = frame.processedData.data
      const foData = frame.imageData.data

      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 0) continue
        const alpha = mask[i]
        const idx = i * 4
        // 用画笔蒙版混合原始像素 → processedData
        fpData[idx]     = Math.round(foData[idx]     * alpha + fpData[idx]     * (1 - alpha))
        fpData[idx + 1] = Math.round(foData[idx + 1] * alpha + fpData[idx + 1] * (1 - alpha))
        fpData[idx + 2] = Math.round(foData[idx + 2] * alpha + fpData[idx + 2] * (1 - alpha))
        const origAlpha = foData[idx + 3]
        const newAlpha = Math.round(origAlpha * alpha + fpData[idx + 3] * (1 - alpha))
        fpData[idx + 3] = Math.max(fpData[idx + 3], newAlpha)
      }
      frame.processedThumbnailUrl = generateThumbnail(frame.processedData)
    }
  }

  return {
    toolMode,
    brushConfig,
    canUndo,
    canRedo,
    setToolMode,
    resetHistory,
    undo,
    redo,
    restoreStroke,
    finishStroke,
    pushHistory,
    updateHistoryFlags,
    propagateBrushEdits,
  }
}
