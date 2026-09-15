<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="placeholder-wrap">
    <t-empty :description="`${title}功能将在后续迭代中提供`">
      <t-button theme="primary" @click="$router.push({ name: 'skills' })">返回 Skill 市场</t-button>
    </t-empty>
  </div>
</template>

<style scoped>
.placeholder-wrap {
  padding: 48px 20px;
}
</style>
