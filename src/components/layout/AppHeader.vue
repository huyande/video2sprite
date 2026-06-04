<script setup lang="ts">
</script>

<template>
  <header class="app-header">
    <div class="logo">
      <span class="logo-icon">🎬</span>
      <h1>Video2Sprite</h1>
    </div>
    <span class="subtitle">视频帧提取 & 雪碧图生成工具</span>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  height: var(--layout-header-height);
  flex-shrink: 0;
}
.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.logo h1 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
}
.logo-icon {
  font-size: 1.25rem;
}
.subtitle {
  font-size: 0.78rem;
  color: var(--color-text-tertiary);
}
</style>
