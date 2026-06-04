import type { RGBColor } from '../types'

/** 计算 RGB 欧氏距离 */
export function colorDistance(a: RGBColor, b: RGBColor): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** 容差值 (0-100) 转换为最大 RGB 距离阈值 */
export function toleranceToMaxDist(tolerance: number): number {
  return (tolerance / 100) * Math.sqrt(255 * 255 * 3)
}

/** 从 ImageData 的 Uint8ClampedArray 中获取指定索引像素的 RGB 颜色 */
export function getPixelColor(data: Uint8ClampedArray, index: number): RGBColor {
  return { r: data[index], g: data[index + 1], b: data[index + 2] }
}

/** RGBColor → HEX 字符串 */
export function rgbToHex(color: RGBColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

/** HEX 字符串 → RGBColor */
export function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) throw new Error(`Invalid hex color: ${hex}`)
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}
