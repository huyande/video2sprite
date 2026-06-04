import { ref } from 'vue'
import type { ExtractedFrame, ExtractionParams } from '../types'
import { generateThumbnail } from '../utils/canvasUtils'

const MAX_FRAMES = 200

export function useFrameExtractor() {
  const frames = ref<ExtractedFrame[]>([])
  const isExtracting = ref(false)
  const progress = ref(0)

  function captureFrameAtTime(
    video: HTMLVideoElement,
    time: number
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Seek to ${time}s timed out`))
      }, 5000)

      const onSeeked = () => {
        clearTimeout(timeoutId)
        video.removeEventListener('seeked', onSeeked)

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
      }

      video.addEventListener('seeked', onSeeked)
      video.currentTime = time
    })
  }

  async function extractFrames(
    video: HTMLVideoElement,
    params: ExtractionParams
  ): Promise<ExtractedFrame[]> {
    const { startTime, endTime, frameCount } = params
    const clampedCount = Math.min(frameCount, MAX_FRAMES)

    if (frameCount > MAX_FRAMES) {
      console.warn(`帧数 ${frameCount} 超过上限 ${MAX_FRAMES}，已自动截断`)
    }

    isExtracting.value = true
    progress.value = 0
    frames.value = []

    try {
      const duration = endTime - startTime
      const interval = duration / clampedCount
      const result: ExtractedFrame[] = []

      for (let i = 0; i < clampedCount; i++) {
        const time = Math.min(startTime + interval * i + interval / 2, endTime)
        const imageData = await captureFrameAtTime(video, time)

        const frame: ExtractedFrame = {
          id: `frame_${String(i + 1).padStart(4, '0')}`,
          timestamp: time,
          imageData,
          thumbnailUrl: generateThumbnail(imageData),
        }

        result.push(frame)
        frames.value = [...result]
        progress.value = Math.round(((i + 1) / clampedCount) * 100)
      }

      return result
    } finally {
      isExtracting.value = false
    }
  }

  function clearFrames(): void {
    frames.value = []
    progress.value = 0
  }

  return { frames, isExtracting, progress, extractFrames, clearFrames }
}
