<script setup lang="ts">
import VideoUploader from '../video/VideoUploader.vue'
import TimeRangeSlider from '../video/TimeRangeSlider.vue'
import CropPanel from '../crop/CropPanel.vue'
import FrameGrid from '../frame/FrameGrid.vue'
import ChromaKeyPanel from '../chromakey/ChromaKeyPanel.vue'
import AnimationPlayer from '../player/AnimationPlayer.vue'
import ExportPanel from '../export/ExportPanel.vue'

import { useFrameExtractor } from '../../composables/useFrameExtractor'
import { useCrop } from '../../composables/useCrop'
import { useChromaKey } from '../../composables/useChromaKey'
import { useAnimationPlayer } from '../../composables/useAnimationPlayer'
import { useSpriteExporter } from '../../composables/useSpriteExporter'

import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import type { ExtractedFrame, VideoMeta } from '../../types'

// ---- Composables ----
const {
  frames,
  isExtracting,
  progress: extractionProgress,
  extractFrames,
  clearFrames,
} = useFrameExtractor()

const {
  config: chromaKeyConfig,
  isProcessing: isChromaKeyProcessing,
  progress: chromaKeyProgress,
  processAllFrames,
  previewFrame,
} = useChromaKey()

const { state: playerState, play, pause, seekTo, setFps, stop } = useAnimationPlayer()

const {
  config: cropConfig,
  isProcessing: isCropProcessing,
  isCropped,
  progress: cropProgress,
  initFromFrame: initCropFromFrame,
  applyCrop,
  resetCrop,
} = useCrop()

const {
  spriteConfig,
  exportSingleFrame,
  downloadSpriteSheet,
} = useSpriteExporter()

// ---- Video State ----
const videoElement = ref<HTMLVideoElement | null>(null)
const videoMeta = ref<VideoMeta | null>(null)
const videoBlobUrl = ref<string | null>(null)

// ---- Extraction State ----
const startTime = ref(0)
const endTime = ref(0)
const frameCount = ref(24)

// ---- Selection State ----
const selectedFrameIds = ref<Set<string>>(new Set())
const currentSelectedFrame = ref<ExtractedFrame | null>(null)

const hasVideo = computed(() => videoMeta.value !== null)
const hasFrames = computed(() => frames.value.length > 0)
const hasProcessed = computed(() => frames.value.some((f) => f.processedData))

/** 获取选中的帧（用于动画预览和导出） */
const selectedFrames = computed(() => {
  if (selectedFrameIds.value.size === 0) return frames.value
  return frames.value.filter((f) => selectedFrameIds.value.has(f.id))
})

const selectedCount = computed(() => selectedFrameIds.value.size)

// ---- Video Preview ----
const previewVideo = ref<HTMLVideoElement | null>(null)

// hasVideo 变为 true 后，等 DOM 渲染再设置 video src
watch(hasVideo, async (val) => {
  if (val && videoBlobUrl.value) {
    await nextTick()
    if (previewVideo.value) {
      previewVideo.value.src = videoBlobUrl.value
      previewVideo.value.load()
    }
  }
})

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

function releaseVideoResources() {
  if (videoBlobUrl.value) {
    URL.revokeObjectURL(videoBlobUrl.value)
    videoBlobUrl.value = null
  }
  if (videoElement.value) {
    videoElement.value.src = ''
    videoElement.value.load()
    videoElement.value = null
  }
  videoMeta.value = null
}

function onResetVideo() {
  releaseVideoResources()
  startTime.value = 0
  endTime.value = 0
  selectedFrameIds.value.clear()
  currentSelectedFrame.value = null
  clearFrames()
  stop()
}

onUnmounted(() => {
  releaseVideoResources()
})

// ---- Handlers ----
async function onVideoLoaded(video: HTMLVideoElement, meta: VideoMeta, file: File) {
  // 先释放旧资源
  releaseVideoResources()
  clearFrames()
  selectedFrameIds.value.clear()
  currentSelectedFrame.value = null

  // 用 File 创建独立的 blob URL，由 AppLayout 管理生命周期
  videoBlobUrl.value = URL.createObjectURL(file)
  videoMeta.value = meta
  startTime.value = 0
  endTime.value = meta.duration
  frameCount.value = 24

  // 创建独立的 video 元素用于帧提取，不依赖 VideoUploader 的实例
  const ownVideo = document.createElement('video')
  ownVideo.preload = 'auto'
  ownVideo.muted = true
  ownVideo.playsInline = true
  ownVideo.src = videoBlobUrl.value
  await new Promise<void>((resolve, reject) => {
    ownVideo.addEventListener('loadeddata', () => resolve(), { once: true })
    ownVideo.addEventListener('error', () => reject(new Error('视频加载失败')), { once: true })
  })
  videoElement.value = ownVideo
}

function onTimeChange(start: number, end: number) {
  startTime.value = start
  endTime.value = end
}

async function onExtract() {
  if (!videoElement.value) return
  clearFrames()
  selectedFrameIds.value.clear()
  currentSelectedFrame.value = null
  await extractFrames(videoElement.value, {
    startTime: startTime.value,
    endTime: endTime.value,
    frameCount: frameCount.value,
  })
  // 帧提取后初始化裁切配置
  if (frames.value.length > 0) {
    initCropFromFrame(frames.value[0])
  }
}

function onFrameSelect(frameId: string) {
  const newSet = new Set(selectedFrameIds.value)
  if (newSet.has(frameId)) {
    newSet.delete(frameId)
  } else {
    newSet.add(frameId)
  }
  selectedFrameIds.value = newSet
  const frame = frames.value.find((f) => f.id === frameId)
  if (frame) {
    currentSelectedFrame.value = frame
  }
}

function onSelectAll() {
  if (selectedFrameIds.value.size === frames.value.length) {
    selectedFrameIds.value = new Set()
  } else {
    selectedFrameIds.value = new Set(frames.value.map((f) => f.id))
  }
}

async function onApplyChromaKey() {
  await processAllFrames(frames.value)
}

function onApplyCrop() {
  applyCrop(frames.value)
}

function onResetCrop() {
  resetCrop(frames.value)
}

function onCropConfigUpdate(partial: { x?: number; y?: number; width?: number; height?: number }) {
  Object.assign(cropConfig, partial)
}

function onPlayAnimation(canvas: HTMLCanvasElement) {
  play(selectedFrames.value, canvas)
}

function onExportSingle(frame: ExtractedFrame) {
  exportSingleFrame(frame)
}

function onExportSprite(framesToExport: ExtractedFrame[], config: Parameters<typeof downloadSpriteSheet>[1]) {
  downloadSpriteSheet(framesToExport, config, playerState.fps, playerState.isLooping)
}
</script>

<template>
  <div class="app-layout">
    <!-- ============ 空状态：居中上传 ============ -->
    <div v-if="!hasVideo" class="empty-state">
      <VideoUploader class="uploader-centered" @loaded="onVideoLoaded" />
    </div>

    <!-- ============ 已加载视频：流式布局 ============ -->
    <div v-else class="main-content">
      <!-- 1. 顶部：视频预览 + 信息 -->
      <section class="section">
        <div class="section-header">
          <span class="section-icon">📹</span>
          <span>视频预览</span>
        </div>
        <div class="video-preview-row">
          <div class="video-player-wrapper">
            <video
              ref="previewVideo"
              class="video-player"
              controls
              muted
              playsinline
            ></video>
          </div>
          <div class="video-meta-card">
            <div class="info-row"><span class="info-label">文件名</span><span class="info-value">{{ videoMeta!.fileName }}</span></div>
            <div class="info-row"><span class="info-label">分辨率</span><span class="info-value">{{ videoMeta!.width }}×{{ videoMeta!.height }}</span></div>
            <div class="info-row"><span class="info-label">时长</span><span class="info-value">{{ formatDuration(videoMeta!.duration) }}</span></div>
            <div class="info-row"><span class="info-label">大小</span><span class="info-value">{{ formatFileSize(videoMeta!.fileSize) }}</span></div>
            <button class="btn btn-danger btn-sm" @click="onResetVideo" style="margin-top: 8px;">重新选择视频</button>
          </div>
        </div>
      </section>

      <!-- 2. 提取参数 -->
      <section class="section">
        <div class="section-header">
          <span class="section-icon">⚙️</span>
          <span>提取参数</span>
        </div>
        <div class="params-row">
          <TimeRangeSlider
            :duration="videoMeta!.duration"
            @change="onTimeChange"
          />
          <div class="extract-controls">
            <label class="field-label">
              帧数
              <input
                v-model.number="frameCount"
                type="number"
                class="input input-number"
                :min="1"
                :max="200"
              />
            </label>
            <button
              class="btn btn-primary"
              :disabled="isExtracting"
              @click="onExtract"
            >
              {{ isExtracting ? `提取中 ${extractionProgress}%` : '开始提取' }}
            </button>
          </div>
        </div>
        <div v-if="isExtracting" class="progress-bar">
          <div class="progress-fill" :style="{ width: extractionProgress + '%' }"></div>
        </div>
      </section>

      <!-- 2.5 帧裁切 -->
      <section v-if="hasFrames" class="section">
        <div class="section-header">
          <span class="section-icon">✂️</span>
          <span>帧裁切</span>
          <span v-if="isCropped" class="badge badge-selected">已裁切 {{ cropConfig.width }}×{{ cropConfig.height }}</span>
        </div>
        <CropPanel
          :current-frame="currentSelectedFrame || frames[0]"
          :config="cropConfig"
          :is-processing="isCropProcessing"
          :is-cropped="isCropped"
          :progress="cropProgress"
          @apply="onApplyCrop"
          @reset="onResetCrop"
          @update:config="onCropConfigUpdate"
        />
        <div v-if="isCropped" class="crop-hint">已裁切，色键处理结果已清除，如需请重新应用</div>
      </section>

      <!-- 3. 背景移除配置 + 帧预览（水平排列） -->
      <div v-if="hasFrames" class="row-2col">
        <!-- 左：色键配置 -->
        <section class="section">
          <div class="section-header">
            <span class="section-icon">🎨</span>
            <span>背景移除</span>
          </div>
          <ChromaKeyPanel
            :config="chromaKeyConfig"
            :current-frame="currentSelectedFrame"
            :is-processing="isChromaKeyProcessing"
            :progress="chromaKeyProgress"
            @apply="onApplyChromaKey"
            @preview="previewFrame"
          />
        </section>

        <!-- 右：帧预览 -->
        <section class="section section-frames">
          <div class="section-header">
            <span class="section-icon">🖼️</span>
            <span>帧预览</span>
            <span class="badge">{{ frames.length }} 帧</span>
            <span v-if="selectedCount > 0" class="badge badge-selected">已选 {{ selectedCount }}</span>
            <button class="btn btn-sm select-all-btn" @click="onSelectAll">
              {{ selectedFrameIds.size === frames.length ? '取消全选' : '全选' }}
            </button>
          </div>
          <FrameGrid
            :frames="frames"
            :selected-ids="selectedFrameIds"
            @select="onFrameSelect"
          />
          <div class="frame-hint">点击帧可多选，选中帧用于动画预览和导出（未选则使用全部）</div>
        </section>
      </div>

      <!-- 4. 动画预览 -->
      <section v-if="hasFrames" class="section">
        <div class="section-header">
          <span class="section-icon">🎬</span>
          <span>动画预览</span>
          <span v-if="selectedCount > 0" class="badge badge-selected">{{ selectedCount }} 帧动画</span>
        </div>
        <AnimationPlayer
          :frames="selectedFrames"
          :player-state="playerState"
          @play="onPlayAnimation"
          @pause="pause"
          @seek-to="seekTo"
          @set-fps="setFps"
          @stop="stop"
        />
      </section>

      <!-- 5. 导出 -->
      <section v-if="hasFrames" class="section">
        <div class="section-header">
          <span class="section-icon">📦</span>
          <span>导出</span>
          <span v-if="selectedCount > 0" class="badge badge-selected">导出选中 {{ selectedCount }} 帧</span>
        </div>
        <ExportPanel
          :frames="selectedFrames"
          :sprite-config="spriteConfig"
          :has-processed="hasProcessed"
          @export-single="onExportSingle"
          @export-sprite="onExportSprite"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  background: var(--color-bg);
}

/* ---- 空状态 ---- */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}
.uploader-centered {
  max-width: 520px;
  width: 100%;
}
.uploader-centered :deep(.drop-zone) {
  padding: var(--spacing-2xl) var(--spacing-xl);
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  border-width: 2px;
}
.uploader-centered :deep(.drop-icon) {
  font-size: 2.5rem;
  margin-bottom: var(--spacing-sm);
}
.uploader-centered :deep(.drop-content p) {
  font-size: 1rem;
  line-height: 1.6;
}

/* ---- 主内容区 ---- */
.main-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: var(--layout-max-width);
  margin: 0 auto;
}

/* ---- Section 卡片 ---- */
.section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}
.section-header {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}
.section-icon {
  font-size: 1.1rem;
}

/* ---- 两列布局 ---- */
.row-2col {
  display: grid;
  grid-template-columns: var(--layout-sidebar-width) 1fr;
  gap: var(--spacing-lg);
}
.section-frames {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ---- 提取参数 ---- */
.params-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.extract-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}
.field-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* ---- Badge ---- */
.badge {
  font-size: 0.7rem;
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}
.badge-selected {
  background: var(--color-success-light);
  color: var(--color-success);
}
.select-all-btn {
  margin-left: auto;
}

/* ---- 进度条 ---- */
.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin-top: var(--spacing-sm);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width var(--transition-base);
}

/* ---- 帧选择提示 ---- */
.frame-hint {
  font-size: 0.72rem;
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-md);
  text-align: center;
}

/* ---- 裁切提示 ---- */
.crop-hint {
  font-size: 0.75rem;
  color: var(--color-warning);
  margin-top: var(--spacing-sm);
  text-align: center;
}

/* ---- 视频预览 ---- */
.video-preview-row {
  display: flex;
  gap: var(--spacing-lg);
  align-items: flex-start;
}
.video-player-wrapper {
  flex: 1;
  min-width: 0;
  max-width: 560px;
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}
.video-player {
  width: 100%;
  max-height: 320px;
  display: block;
  object-fit: contain;
}
.video-meta-card {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
}
.video-meta-card .info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) 0;
}
.video-meta-card .info-row:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}
.video-meta-card .info-label {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.video-meta-card .info-value {
  font-weight: 500;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 响应式 ---- */
@media (max-width: 960px) {
  .row-2col {
    grid-template-columns: 1fr;
  }
  .video-preview-row {
    flex-direction: column;
  }
  .video-player-wrapper {
    max-width: 100%;
  }
  .video-meta-card {
    width: 100%;
  }
}
@media (max-width: 640px) {
  .app-layout {
    padding: var(--spacing-sm);
  }
  .section {
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
  }
}
</style>
