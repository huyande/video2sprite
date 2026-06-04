<script setup lang="ts">
defineProps<{
  imageUrl: string
  width: number
  height: number
}>()
</script>

<template>
  <div class="sprite-preview" v-if="imageUrl">
    <img :src="imageUrl" class="sprite-img" alt="Sprite Sheet Preview" />
    <span class="sprite-size">{{ width }}×{{ height }}</span>
  </div>
</template>

<style scoped>
.sprite-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}
.sprite-img {
  max-width: 100%;
  max-height: 150px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.sprite-size {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}
</style>
