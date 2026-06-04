import type { RGBColor, CropConfig } from '../types'

/** 生成缩略图 data URL */
export function generateThumbnail(imageData: ImageData, maxWidth: number = 200): string {
  const scale = maxWidth / imageData.width
  const thumbWidth = Math.round(imageData.width * scale)
  const thumbHeight = Math.round(imageData.height * scale)

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = imageData.width
  tempCanvas.height = imageData.height
  tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0)

  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = thumbWidth
  thumbCanvas.height = thumbHeight
  const ctx = thumbCanvas.getContext('2d')!
  ctx.drawImage(tempCanvas, 0, 0, thumbWidth, thumbHeight)

  return thumbCanvas.toDataURL('image/png')
}

/** 从 ImageData 中裁出指定矩形区域 */
export function cropImageData(source: ImageData, crop: CropConfig): ImageData {
  const x = Math.max(0, Math.min(Math.round(crop.x), source.width - 1))
  const y = Math.max(0, Math.min(Math.round(crop.y), source.height - 1))
  const maxX = Math.min(Math.round(crop.x + crop.width), source.width)
  const maxY = Math.min(Math.round(crop.y + crop.height), source.height)
  const width = Math.max(1, maxX - x)
  const height = Math.max(1, maxY - y)

  const output = new ImageData(width, height)
  const srcData = source.data
  const dstData = output.data
  const srcStride = source.width * 4
  const dstStride = width * 4

  for (let row = 0; row < height; row++) {
    const srcOffset = ((y + row) * source.width + x) * 4
    const dstOffset = row * dstStride
    dstData.set(srcData.subarray(srcOffset, srcOffset + dstStride), dstOffset)
  }

  return output
}

/** 从 Canvas 上指定坐标取色 */
export function pickColorFromCanvas(canvas: HTMLCanvasElement, x: number, y: number): RGBColor {
  const ctx = canvas.getContext('2d')!
  const pixel = ctx.getImageData(x, y, 1, 1).data
  return { r: pixel[0], g: pixel[1], b: pixel[2] }
}

/** 将 ImageData 绘制到 Canvas 上（先画棋盘格再画帧） */
export function drawFrameOnCanvas(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  showChecker: boolean = true
): void {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (showChecker) {
    drawCheckerBackground(canvas, 8)
  }

  // 先将 imageData 放到临时 canvas
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = imageData.width
  tempCanvas.height = imageData.height
  tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0)

  // 缩放绘制到目标 canvas（保持比例居中）
  const scale = Math.min(
    canvas.width / imageData.width,
    canvas.height / imageData.height,
    1
  )
  const w = imageData.width * scale
  const h = imageData.height * scale
  const x = (canvas.width - w) / 2
  const y = (canvas.height - h) / 2

  ctx.drawImage(tempCanvas, x, y, w, h)
}

/** 绘制棋盘格背景 */
export function drawCheckerBackground(canvas: HTMLCanvasElement, cellSize: number = 8): void {
  const ctx = canvas.getContext('2d')!
  const cols = Math.ceil(canvas.width / cellSize)
  const rows = Math.ceil(canvas.height / cellSize)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#e2e8f0'
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}

/** 下载 Blob 文件 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 下载文本文件 */
export function downloadText(content: string, fileName: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(blob, fileName)
}
