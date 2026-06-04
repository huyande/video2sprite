import { reactive } from 'vue'
import type { SpriteSheetConfig, SpriteSheetJSON, ExtractedFrame } from '../types'
import { downloadBlob, downloadText } from '../utils/canvasUtils'

export function useSpriteExporter() {
  const spriteConfig = reactive<SpriteSheetConfig>({
    columns: 5,
    rows: 0,
    frameWidth: 0,
    frameHeight: 0,
    padding: 0,
    scale: 1,
  })

  /**
   * 生成雪碧图 PNG Blob
   */
  async function generateSpriteSheet(
    frames: ExtractedFrame[],
    config: SpriteSheetConfig
  ): Promise<Blob> {
    const { columns, padding, scale } = config
    if (frames.length === 0) throw new Error('没有帧可导出')

    const firstFrame = frames[0]
    const originalWidth = firstFrame.imageData.width
    const originalHeight = firstFrame.imageData.height
    const effectiveScale = Math.max(0.1, Math.min(1, scale))
    const frameWidth = Math.round(originalWidth * effectiveScale)
    const frameHeight = Math.round(originalHeight * effectiveScale)
    const rows = Math.ceil(frames.length / columns)

    // 更新 config
    config.frameWidth = frameWidth
    config.frameHeight = frameHeight
    config.rows = rows

    const totalWidth = columns * frameWidth + (columns + 1) * padding
    const totalHeight = rows * frameHeight + (rows + 1) * padding

    const canvas = document.createElement('canvas')
    canvas.width = totalWidth
    canvas.height = totalHeight
    const ctx = canvas.getContext('2d')!

    // 透明背景，不填充
    frames.forEach((frame, i) => {
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = col * frameWidth + (col + 1) * padding
      const y = row * frameHeight + (row + 1) * padding

      const imageData = frame.processedData || frame.imageData
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0)
      // 缩放绘制到目标区域
      ctx.drawImage(tempCanvas, x, y, frameWidth, frameHeight)
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('生成雪碧图失败'))
      }, 'image/png')
    })
  }

  /**
   * 生成 TexturePacker 兼容的 JSON
   */
  function generateJSON(
    frames: ExtractedFrame[],
    config: SpriteSheetConfig,
    imageFileName: string,
    fps: number = 24,
    loop: boolean = true
  ): SpriteSheetJSON {
    const { columns, padding, scale } = config
    const frameWidth = config.frameWidth || frames[0]?.imageData.width || 0
    const frameHeight = config.frameHeight || frames[0]?.imageData.height || 0
    const originalWidth = frames[0]?.imageData.width || 0
    const originalHeight = frames[0]?.imageData.height || 0
    const rows = Math.ceil(frames.length / columns)
    const totalWidth = columns * frameWidth + (columns + 1) * padding
    const totalHeight = rows * frameHeight + (rows + 1) * padding

    return {
      meta: {
        app: 'video2sprite',
        version: '1.0.0',
        image: imageFileName,
        size: { w: totalWidth, h: totalHeight },
        scale: Math.max(0.1, Math.min(1, scale)),
        fps,
        loop,
      },
      frames: frames.map((frame, i) => {
        const col = i % columns
        const row = Math.floor(i / columns)
        return {
          filename: frame.id,
          frame: {
            x: col * frameWidth + (col + 1) * padding,
            y: row * frameHeight + (row + 1) * padding,
            w: frameWidth,
            h: frameHeight,
          },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          sourceSize: { w: originalWidth, h: originalHeight },
        }
      }),
      animations: {
        default: frames.map((f) => f.id),
      },
    }
  }

  /**
   * 导出单帧 PNG
   */
  function exportSingleFrame(frame: ExtractedFrame, fileName?: string): void {
    const imageData = frame.processedData || frame.imageData
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    canvas.getContext('2d')!.putImageData(imageData, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, fileName || `${frame.id}.png`)
      }
    }, 'image/png')
  }

  /**
   * 下载雪碧图 + JSON
   */
  async function downloadSpriteSheet(
    frames: ExtractedFrame[],
    config?: Partial<SpriteSheetConfig>,
    fps?: number,
    loop?: boolean
  ): Promise<void> {
    const mergedConfig = { ...spriteConfig, ...config }
    const imageFileName = 'spritesheet.png'

    const blob = await generateSpriteSheet(frames, mergedConfig)
    downloadBlob(blob, imageFileName)

    const json = generateJSON(frames, mergedConfig, imageFileName, fps, loop)
    downloadText(JSON.stringify(json, null, 2), 'spritesheet.json')
  }

  return {
    spriteConfig,
    generateSpriteSheet,
    generateJSON,
    exportSingleFrame,
    downloadSpriteSheet,
  }
}
