<script setup lang="ts">
import AppHeader from './components/layout/AppHeader.vue'
import AppLayout from './components/layout/AppLayout.vue'
</script>

<template>
  <div class="app">
    <AppHeader />
    <AppLayout />
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
