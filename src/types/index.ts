/** RGB 颜色 */
export interface RGBColor {
  r: number // 0-255
  g: number // 0-255
  b: number // 0-255
}

/** 视频元信息 */
export interface VideoMeta {
  duration: number
  width: number
  height: number
  fileName: string
  fileSize: number
  mimeType: string
}

/** 提取的一帧 */
export interface ExtractedFrame {
  id: string
  timestamp: number
  imageData: ImageData
  originalImageData?: ImageData
  processedData?: ImageData
  thumbnailUrl: string
  processedThumbnailUrl?: string
}

/** 裁切配置 */
export interface CropConfig {
  x: number
  y: number
  width: number
  height: number
}

/** 色键配置 */
export interface ChromaKeyConfig {
  targetColor: RGBColor
  tolerance: number // 0-100
  feathering: number // 0-100
  spillRemoval: boolean
}

/** 帧提取参数 */
export interface ExtractionParams {
  startTime: number
  endTime: number
  frameCount: number
  maxDimension?: number
}

/** 雪碧图配置 */
export interface SpriteSheetConfig {
  columns: number
  rows: number
  frameWidth: number
  frameHeight: number
  padding: number
  scale: number // 0.1 ~ 1.0，导出时按比例缩放帧尺寸
}

/** 雪碧图 JSON 导出格式（兼容 TexturePacker） */
export interface SpriteSheetJSON {
  meta: {
    app: string
    version: string
    image: string
    size: { w: number; h: number }
    scale: number
    fps: number
    loop: boolean
  }
  frames: Array<{
    filename: string
    frame: { x: number; y: number; w: number; h: number }
    rotated: boolean
    trimmed: boolean
    spriteSourceSize: { x: number; y: number; w: number; h: number }
    sourceSize: { w: number; h: number }
  }>
  animations: Record<string, string[]>
}

/** 色键面板工具模式 */
export type ChromaKeyToolMode = 'picker' | 'restore-brush'

/** 画笔配置 */
export interface BrushConfig {
  size: number       // 画笔半径，单位：图像像素，默认 10
  hardness: number   // 硬度 0-100，控制边缘羽化程度，默认 80
}

/** 动画播放状态 */
export interface PlayerState {
  isPlaying: boolean
  currentFrameIndex: number
  fps: number
  isLooping: boolean
}

/** Worker 通信协议：主线程 → Worker */
export interface WorkerProcessRequest {
  type: 'PROCESS_FRAME'
  frameId: string
  imageData: ImageData
  config: ChromaKeyConfig
}

/** Worker 通信协议：Worker → 主线程 */
export type WorkerResponse =
  | { type: 'FRAME_PROCESSED'; frameId: string; processedData: ImageData }
  | { type: 'PROGRESS'; current: number; total: number }
  | { type: 'ERROR'; frameId: string; error: string }
