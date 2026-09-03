<template>
  <main class="error-page">
    <p class="eyebrow">404</p>
    <h1>页面不存在</h1>
    <p class="lead">你访问的页面可能已移动，或地址输入有误。</p>
    <RouterLink class="primary-link" :to="{ name: 'home' }"
      >返回首页</RouterLink
    >
  </main>
</template>
