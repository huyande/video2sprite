/// <reference lib="webworker" />

import type { ChromaKeyConfig } from '../types'

function removeBackground(
  imageData: ImageData,
  config: ChromaKeyConfig
): ImageData {
  const { data, width, height } = imageData
  const { targetColor, tolerance, feathering } = config
  const output = new Uint8ClampedArray(data)

  const maxDist = (tolerance / 100) * Math.sqrt(255 * 255 * 3) // ≈ tolerance * 4.4167

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const dr = r - targetColor.r
    const dg = g - targetColor.g
    const db = b - targetColor.b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    if (dist < maxDist) {
      if (feathering > 0) {
        // 边缘平滑：靠近阈值边缘的像素渐变 alpha
        const featherStart = maxDist * (1 - feathering / 100)
        if (dist >= featherStart) {
          const alpha = Math.min(
            255,
            Math.floor(((dist - featherStart) / (maxDist - featherStart)) * 255)
          )
          output[i + 3] = alpha
        } else {
          output[i + 3] = 0
        }
      } else {
        output[i + 3] = 0
      }
    }
  }

  return new ImageData(output, width, height)
}

self.onmessage = (e: MessageEvent) => {
  const { type, frameId, imageData, config } = e.data

  if (type === 'PROCESS_FRAME') {
    try {
      const processedData = removeBackground(imageData, config)
      self.postMessage({ type: 'FRAME_PROCESSED', frameId, processedData })
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        frameId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
}
