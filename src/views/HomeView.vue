<script setup lang="ts">
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
</script>

<template>
  <section class="hero-panel">
    <p class="eyebrow">SKILL MANAGEMENT SYSTEM</p>
    <h1>前端服务已就绪</h1>
    <p class="lead">
      Vue 3 应用骨架已经完成，后续可在此接入 Skill
      目录、版本管理和生命周期工作流。
    </p>
    <div class="status-row" aria-label="功能状态">
      <span class="status-chip status-chip--active">基础服务运行中</span>
      <span class="status-chip"
        >Agent：{{ appStore.agentEnabled ? '启用' : '未启用' }}</span
      >
      <span class="status-chip"
        >管理端：{{ appStore.adminEnabled ? '启用' : '未启用' }}</span
      >
    </div>
  </section>
</template>
