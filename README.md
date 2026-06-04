# Video2Sprite

纯前端视频帧提取 & 雪碧图生成工具。上传视频 → 提取关键帧 → 裁切 → 移除背景 → 导出雪碧图 + JSON 配置，所有处理均在浏览器端完成，无需后端。

## 功能特性

| 功能 | 说明 |
|------|------|
| 🎬 视频上传 | 支持拖拽或点击上传 MP4 / WebM 格式视频 |
| ⏱️ 时间范围选择 | 双滑块选择视频起止时间，按需提取帧 |
| ✂️ 帧裁切 | 可视化拖拽裁切框，统一应用到所有帧 |
| 🎨 色键去背景 | 基于 RGB 欧氏距离的颜色匹配，支持容差和边缘平滑 |
| 🖼️ 帧预览 | 网格缩略图展示，支持多选帧 |
| ▶️ 动画预览 | Canvas 实时播放帧动画，可调帧率和循环 |
| 📦 雪碧图导出 | 按行列布局生成 Sprite Sheet + TexturePacker 兼容 JSON |
| 📐 缩放压缩 | 10%~100% 缩放比例，降低导出分辨率和文件体积 |

## 技术栈

- **Vue 3** — Composition API
- **TypeScript** — 类型安全
- **Vite 6** — 构建工具，支持 Web Worker ES Module
- **Canvas 2D** — 帧提取、色键处理、雪碧图生成
- **Web Worker** — 色键批量处理不阻塞 UI

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 使用流程

```
上传视频 → 设置时间范围和帧数 → 提取帧 → 裁切（可选）→ 色键去背景（可选）→ 导出
```

### 1. 上传视频

拖拽或点击上传区域选择视频文件，支持 MP4、WebM 格式。

### 2. 提取帧

设置起止时间范围和提取帧数（最大 200 帧），点击「开始提取」。

### 3. 帧裁切（可选）

在预览 Canvas 上拖拽定义裁切区域，点击「应用到所有帧」。支持撤销，恢复到原始帧。

### 4. 背景移除（可选）

- 选择目标颜色（点击预览取色或使用颜色选择器）
- 调整容差（颜色匹配范围）
- 调整边缘平滑度（羽化过渡）
- 点击「应用到所有帧」，通过 Web Worker 批量处理

### 5. 动画预览

播放/暂停帧动画，调整 FPS（10/12/15/24/30/60），支持循环播放。可选择特定帧进行预览。

### 6. 导出

| 导出类型 | 说明 |
|----------|------|
| 单帧 PNG | 导出选中帧（透明背景）为 PNG 图片 |
| 雪碧图 + JSON | 生成 Sprite Sheet PNG 和 TexturePacker 兼容的 JSON 配置文件 |

**导出配置**：
- **每行列数**：控制雪碧图每行排列的帧数
- **间距**：帧与帧之间的像素间距
- **缩放比例**：10%~100%，按比例缩小帧尺寸以压缩文件体积

## JSON 配置格式

导出的 JSON 文件兼容 TexturePacker 格式，并扩展了动画信息：

```json
{
  "meta": {
    "app": "video2sprite",
    "version": "1.0.0",
    "image": "spritesheet.png",
    "size": { "w": 960, "h": 540 },
    "scale": 0.5,
    "fps": 24,
    "loop": true
  },
  "frames": [
    {
      "filename": "frame_0001",
      "frame": { "x": 0, "y": 0, "w": 480, "h": 270 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 480, "h": 270 },
      "sourceSize": { "w": 960, "h": 540 }
    }
  ],
  "animations": {
    "default": ["frame_0001", "frame_0002", "..."]
  }
}
```

| 字段 | 说明 |
|------|------|
| `meta.scale` | 缩放比例（如 0.5 表示 50%），可用于还原原始尺寸 |
| `meta.fps` | 动画帧率 |
| `meta.loop` | 是否循环播放 |
| `frame` | 帧在雪碧图中的实际位置和尺寸（缩放后） |
| `sourceSize` | 原始帧尺寸（缩放前） |

## 项目结构

```
src/
├── types/index.ts            # TypeScript 类型定义
├── styles/
│   ├── variables.css          # CSS 变量（颜色、间距、阴影）
│   └── global.css             # 全局样式（按钮、输入框、滚动条）
├── composables/
│   ├── useVideoLoader.ts      # 视频文件加载和元数据读取
│   ├── useFrameExtractor.ts   # 帧提取（video.currentTime + seeked）
│   ├── useCrop.ts             # 帧裁切逻辑
│   ├── useChromaKey.ts        # 色键配置和批量处理
│   ├── useAnimationPlayer.ts  # 帧动画播放控制
│   └── useSpriteExporter.ts   # 雪碧图生成和导出
├── workers/
│   └── chromaKey.worker.ts    # Web Worker 色键处理
├── utils/
│   ├── colorUtils.ts          # 颜色距离计算、格式转换
│   └── canvasUtils.ts         # Canvas 工具（缩略图、裁切、下载）
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue      # 顶部导航栏
│   │   └── AppLayout.vue      # 主布局（状态流转）
│   ├── video/
│   │   ├── VideoUploader.vue  # 视频上传（拖拽 + 点击）
│   │   └── TimeRangeSlider.vue # 时间范围双滑块
│   ├── crop/
│   │   └── CropPanel.vue      # 可视化裁切面板
│   ├── chromakey/
│   │   ├── ChromaKeyPanel.vue  # 色键配置面板
│   │   └── ColorPicker.vue    # 颜色选择器
│   ├── frame/
│   │   ├── FrameGrid.vue      # 帧缩略图网格
│   │   └── FrameItem.vue      # 单帧缩略图
│   ├── player/
│   │   └── AnimationPlayer.vue # 动画播放器
│   └── export/
│       └── ExportPanel.vue    # 导出配置和操作
├── App.vue                    # 根组件
└── main.ts                    # 入口文件
```

## 限制

- **帧数上限**：单次最多提取 200 帧
- **视频格式**：支持 MP4（H.264）、WebM，取决于浏览器解码能力
- **内存占用**：所有帧数据存储在内存中，高分辨率视频 + 大帧数可能导致内存压力
- **色键算法**：基于 RGB 欧氏距离，对复杂背景或光照不均匀的场景效果有限
- **纯客户端**：所有处理在浏览器端完成，不上传数据到服务器

## License

MIT
