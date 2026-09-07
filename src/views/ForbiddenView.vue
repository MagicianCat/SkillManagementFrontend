<template>
  <main class="error-page">
    <p class="eyebrow">403</p>
    <h1>没有访问权限</h1>
    <p class="lead">你当前的角色没有访问该页面的权限，如需访问请联系管理员。</p>
    <RouterLink class="primary-link" :to="{ name: 'skills' }"
      >返回 Skill 市场</RouterLink
    >
  </main>
</template>
