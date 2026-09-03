import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: '登录' },
    },
    {
      path: '/',
      component: () => import('../components/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'home', component: HomeView },
        {
          path: 'skills',
          name: 'skills',
          component: PlaceholderView,
          props: { title: 'Skill 目录' },
        },
        {
          path: 'workflows',
          name: 'workflows',
          component: PlaceholderView,
          props: { title: '生命周期工作台' },
        },
        {
          path: 'admin',
          name: 'admin',
          component: PlaceholderView,
          props: { title: '管理中心' },
          meta: { adminOnly: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initialize()
  if (to.name === 'login' && authStore.isAuthenticated) {
    return (to.query.redirect as string) || { name: 'skills' }
  }
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
