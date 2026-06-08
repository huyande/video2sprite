# 计划：修复画笔编辑和传播功能

## 任务概述
修复视频帧提取工具中的画笔编辑功能，解决两个关键问题：
1. 恢复画笔点击时会意外恢复所有内容
2. 画笔编辑无法传播到所有帧

## 变更文件
- `src/components/chromakey/ChromaKeyPanel.vue` - 画笔交互和渲染逻辑
- `src/composables/useBrushEdit.ts` - 画笔编辑核心功能和传播逻辑
- `src/components/layout/AppLayout.vue` - 应用主布局，协调画笔传播

## 详细变更说明

### 1. ChromaKeyPanel.vue - 修复画笔监听和渲染

#### 问题分析
原代码使用 `watch(() => props.currentFrame, ...)` 深度监听整个帧对象。当 `finishStroke()` 更新 `processedThumbnailUrl` 时，会触发 watcher 重绘 canvas，导致画笔编辑结果被原始 imageData 覆盖。

#### 解决方案
**变更 1：优化 watcher 触发条件**
```typescript
// 从监听整个对象改为只监听 ID
watch(
  () => [props.config.targetColor, props.config.tolerance, props.config.feathering, props.currentFrame?.id],
  // ...
)
```

**变更 2：添加立即重绘调用**
在以下事件处理函数中添加 `redrawProcessed()` 调用：
- `onCanvasMouseDown()` - 单点绘制时立即显示效果
- `onCanvasMouseUp()` - 确保最终状态显示
- `onCanvasMouseLeave()` - 鼠标离开时确保最终状态

**变更 3：画笔模式使用 redrawProcessed()**
在 watcher 回调中，画笔模式调用 `redrawProcessed()` 而非 emit preview，保留画笔编辑结果。

### 2. useBrushEdit.ts - 实现画笔传播功能

#### 新增功能：propagateBrushEdits()

**原理说明**
通过对比画笔编辑后的数据与初始色键结果，计算恢复蒙版，然后将蒙版应用到所有帧。

**实现步骤**
1. 保存初始色键结果（historyStack[0]）作为对比基准
2. 计算恢复蒙版：找出 alpha 值增大的像素（被画笔恢复的区域）
3. 将蒙版应用到所有帧的 processedData

**代码结构**
```typescript
function propagateBrushEdits(frames: ExtractedFrame[], editedData: ImageData): void {
  // 1. 获取初始状态
  const initial = historyStack.value[0]

  // 2. 计算恢复蒙版
  const mask = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    // 对比 editedData vs initial
    // 记录 alpha 增大的像素
  }

  // 3. 应用蒙版到所有帧
  for (const frame of frames) {
    // 用蒙版混合原始像素和 processedData
  }
}
```

### 3. AppLayout.vue - 协调传播时机

#### onApplyChromaKey 修改

**调用时机**
1. 在 `processAllFrames` **之前**保存当前帧的画笔编辑数据
2. 执行 `processAllFrames`（会覆盖所有帧的 processedData）
3. 在 `processAllFrames` **之后**调用 `propagateBrushEdits` 应用蒙版

**实现代码**
```typescript
async function onApplyChromaKey() {
  // 1. 保存画笔编辑数据
  const editedData = effectiveFrame.value?.processedData
    ? new ImageData(/* 深拷贝 */)
    : null

  // 2. 处理所有帧（会覆盖 processedData）
  await processAllFrames(frames.value)

  // 3. 传播画笔编辑
  if (editedData) {
    propagateBrushEdits(frames.value, editedData)
  }

  // 4. 重置历史并保存新状态
  resetHistory()
  // ...
}
```

## 技术要点

### 关键依赖
- `historyStack[0]` 必须保存初始色键结果（无画笔编辑）
- `editedData` 必须在 processAllFrames 前深拷贝保存
-蒙版计算基于 alpha 差异（画笔恢复会使 alpha 增大）

### 数据流
```mermaid
graph LR
    A[用户涂抹] --> B[restoreStroke]
    B --> C[finishStroke]
    C --> D[pushHistory]
    D --> E[historyStack]
    E --> F[editedData]
    F --> G[propagateBrushEdits]
    G --> H[所有帧 processedData]
```

## 测试场景

### 场景 1：单帧画笔编辑
1. 选择一帧
2. 使用恢复画笔涂抹
3. 验证：涂抹区域立即显示恢复效果
4. 验证：切换到其他帧再切回，编辑结果保留

### 场景 2：画笔传播到所有帧
1. 选择一帧并进行色键处理
2. 使用恢复画笔涂抹
3. 点击"应用到所有帧"
4. 验证：所有帧都应用了相同的画笔恢复效果

### 场景 3：撤销/重做
1. 进行画笔编辑
2. 点击撤销
3. 验证：画布恢复到编辑前状态
4. 点击重做
5. 验证：画布恢复到编辑后状态

## 潜在风险

### 风险 1：历史栈状态管理
- **问题**：historyStack 可能为空或状态不一致
- **应对**：在 propagateBrushEdits 开头检查 `historyStack.value.length === 0`

### 风险 2：帧尺寸不一致
- **问题**：不同帧可能有不同尺寸
- **应对**：在应用蒙版前检查帧尺寸匹配

### 风险 3：性能影响
- **问题**：传播蒙版到大量帧可能耗时
- **应对**：使用 Float32Array 优化计算，避免不必要的对象创建

## 完成状态
- [x] 分析问题根因
- [x] 设计解决方案
- [x] 实现 watcher 优化
- [x] 实现画笔传播功能
- [x] 集成到主应用流程
- [ ] 功能测试
- [ ] 代码审查
