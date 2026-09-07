import { createRouter, createWebHistory } from 'vue-router'
import NotFoundView from '../views/NotFoundView.vue'
import ForbiddenView from '../views/ForbiddenView.vue'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '../stores/auth'
import { hasAnyPermission, type Permission } from '../types/permissions'
import SkillsView from '../views/SkillsView.vue'
import SkillDetailView from '../views/SkillDetailView.vue'
import SkillCreateView from '../views/SkillCreateView.vue'
import SkillDraftView from '../views/SkillDraftView.vue'
import ReviewsView from '../views/ReviewsView.vue'
import ReviewDetailView from '../views/ReviewDetailView.vue'
import NotificationsView from '../views/NotificationsView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    permissions?: Permission[]
  }
}

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
        { path: '', name: 'home', redirect: { name: 'skills' } },
        {
          path: 'skills',
          name: 'skills',
          component: SkillsView,
          meta: { title: 'Skill 市场', permissions: ['skill:browse'] },
        },
        {
          path: 'skills/new',
          name: 'skill-create',
          component: SkillCreateView,
          meta: { title: '新建 Skill', permissions: ['skill:upload'] },
        },
        {
          path: 'skills/:skillKey',
          name: 'skill-detail',
          component: SkillDetailView,
          meta: { title: 'Skill 详情', permissions: ['skill:browse'] },
        },
        {
          path: 'skills/:skillKey/draft',
          name: 'skill-draft',
          component: SkillDraftView,
          meta: { title: '草稿工作台', permissions: ['skill:browse'] },
        },
        {
          path: 'reviews',
          name: 'reviews',
          component: ReviewsView,
          meta: { title: '审核中心', permissions: ['skill:review'] },
        },
        {
          path: 'reviews/:reviewId',
          name: 'review-detail',
          component: ReviewDetailView,
          meta: { title: '审核详情', permissions: ['skill:review'] },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: NotificationsView,
          meta: { title: '通知中心' },
        },
        {
          path: 'agent',
          name: 'agent',
          component: () => import('../views/AgentView.vue'),
          meta: { title: 'Agent 助手', permissions: ['skill:browse'] },
        },
        {
          path: '403',
          name: 'forbidden',
          component: ForbiddenView,
          meta: { title: '没有访问权限' },
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
  if (
    authStore.isAuthenticated &&
    to.meta.permissions?.length &&
    !hasAnyPermission(authStore.user?.permissions, to.meta.permissions)
  ) {
    return { name: 'forbidden' }
  }
  return true
})

export default router
