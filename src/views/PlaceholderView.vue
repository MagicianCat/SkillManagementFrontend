<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <el-empty :description="`${title}功能将在后续迭代中提供`">
    <el-button type="primary" @click="$router.push({ name: 'home' })"
      >返回首页</el-button
    >
  </el-empty>
</template>
