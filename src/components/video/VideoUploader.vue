<script setup lang="ts">
import { ref } from 'vue'
import { useVideoLoader } from '../../composables/useVideoLoader'

const emit = defineEmits<{
  loaded: [video: HTMLVideoElement, meta: { duration: number; width: number; height: number; fileName: string; fileSize: number; mimeType: string }, file: File]
}>()

const { videoMeta, isLoading, error, loadVideo } = useVideoLoader()

const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await handleFile(file)
}

function handleFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

async function handleFile(file: File) {
  const video = await loadVideo(file)
  if (video && videoMeta.value) {
    emit('loaded', video, videoMeta.value, file)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="video-uploader">
    <div
      v-if="!videoMeta"
      class="drop-zone"
      :class="{ 'drag-over': isDragOver, loading: isLoading }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept="video/mp4,video/webm,video/ogg"
        class="hidden-input"
        @change="handleFileInput"
      />
      <div class="drop-content">
        <span class="drop-icon">📹</span>
        <p v-if="!isLoading">拖拽视频文件到此处<br />或点击选择文件</p>
        <p v-else>加载中...</p>
        <span class="drop-hint">支持 MP4、WebM 格式</span>
      </div>
    </div>

    <div v-if="videoMeta" class="video-info">
      <div class="info-row">
        <span class="info-label">文件名</span>
        <span class="info-value" :title="videoMeta.fileName">{{ videoMeta.fileName }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">分辨率</span>
        <span class="info-value">{{ videoMeta.width }}×{{ videoMeta.height }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">时长</span>
        <span class="info-value">{{ formatDuration(videoMeta.duration) }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">大小</span>
        <span class="info-value">{{ formatFileSize(videoMeta.fileSize) }}</span>
      </div>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<style scoped>
.video-uploader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl) var(--spacing-lg);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-base), background var(--transition-base);
  background: var(--color-surface);
}
.drop-zone:hover,
.drop-zone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-lighter);
}
.drop-zone.loading {
  opacity: 0.6;
  pointer-events: none;
}
.hidden-input {
  display: none;
}
.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}
.drop-icon {
  font-size: 2rem;
  opacity: 0.7;
}
.drop-content p {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.drop-hint {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-xs);
}
.video-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
}
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}
.info-label {
  color: var(--color-text-secondary);
}
.info-value {
  font-weight: 500;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-msg {
  color: var(--color-danger);
  font-size: 0.8rem;
  padding: var(--spacing-sm);
  background: var(--color-danger-light);
  border-radius: var(--radius-sm);
}
</style>
