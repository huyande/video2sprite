import { ref, onUnmounted } from 'vue'
import type { VideoMeta } from '../types'

const SUPPORTED_TYPES = ['video/mp4', 'video/webm', 'video/ogg']

export function useVideoLoader() {
  const videoElement = ref<HTMLVideoElement | null>(null)
  const videoMeta = ref<VideoMeta | null>(null)
  const videoUrl = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function validateFile(file: File): boolean {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      error.value = `不支持的格式: ${file.type}。请上传 MP4 或 WebM 视频。`
      return false
    }
    return true
  }

  function readMetadata(video: HTMLVideoElement, file: File): VideoMeta {
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }
  }

  async function loadVideo(file: File): Promise<HTMLVideoElement | null> {
    if (!validateFile(file)) return null

    isLoading.value = true
    error.value = null

    try {
      dispose()

      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.playsInline = true

      const url = URL.createObjectURL(file)
      videoUrl.value = url
      video.src = url

      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.addEventListener('error', () => reject(new Error('视频加载失败，请检查文件格式')), { once: true })
      })

      videoElement.value = video
      videoMeta.value = readMetadata(video, file)
      return video
    } catch (e) {
      error.value = e instanceof Error ? e.message : '未知错误'
      return null
    } finally {
      isLoading.value = false
    }
  }

  function dispose() {
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value)
      videoUrl.value = null
    }
    if (videoElement.value) {
      videoElement.value.src = ''
      videoElement.value.load()
      videoElement.value = null
    }
    videoMeta.value = null
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    videoElement,
    videoMeta,
    isLoading,
    error,
    loadVideo,
    dispose,
  }
}
