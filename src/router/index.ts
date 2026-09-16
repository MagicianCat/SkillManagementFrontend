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
import WikiReviewsView from '../views/WikiReviewsView.vue'
import WikiReviewDetailView from '../views/WikiReviewDetailView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import OrganizationView from '../views/OrganizationView.vue'
import OAuthCallbackView from '../views/OAuthCallbackView.vue'
import WikiView from '../views/WikiView.vue'
import MobileSkillDetailView from '../views/MobileSkillDetailView.vue'
import AgentMcpAuditView from '../views/AgentMcpAuditView.vue'
import IdeAuthorizeView from '../views/IdeAuthorizeView.vue'
import SkillUsageDashboardView from '../views/SkillUsageDashboardView.vue'

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
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: OAuthCallbackView,
      meta: { title: '飞书登录' },
    },
    {
      path: '/m/skills/:skillKey',
      name: 'mobile-skill-detail',
      component: MobileSkillDetailView,
      meta: { title: 'Skill 详情', requiresAuth: true, permissions: ['skill:browse'] },
    },
    {
      path: '/ide/authorize',
      name: 'ide-authorize',
      component: IdeAuthorizeView,
      meta: { title: '授权 CodeBuddy', requiresAuth: true },
    },
    {
      path: '/',
      component: () => import('../components/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'home', redirect: { name: 'agent' } },
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
          path: 'wiki',
          name: 'wiki',
          component: WikiView,
          meta: { title: '团队 Wiki', permissions: ['skill:browse'] },
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
          meta: { title: '审核中心', permissions: ['skill:review', 'wiki:review'] },
        },
        {
          path: 'wiki-reviews',
          name: 'wiki-reviews',
          component: WikiReviewsView,
          meta: { title: 'Wiki 审核', permissions: ['wiki:review'] },
        },
        {
          path: 'agent/mcp-audits',
          name: 'agent-mcp-audits',
          component: AgentMcpAuditView,
          meta: { title: 'Agent MCP 审计', permissions: ['admin:audit'] },
        },
        {
          path: 'admin/skill-usage',
          name: 'skill-usage-dashboard',
          component: SkillUsageDashboardView,
          meta: { title: 'Skill 使用看板' },
        },
        {
          path: 'organization',
          name: 'organization',
          component: OrganizationView,
          meta: { title: '组织与团队权限', permissions: ['admin:identity', 'skill:review'] },
        },
        {
          path: 'reviews/:reviewId',
          name: 'review-detail',
          component: ReviewDetailView,
          meta: { title: '审核详情', permissions: ['skill:review'] },
        },
        {
          path: 'wiki-reviews/:reviewId',
          name: 'wiki-review-detail',
          component: WikiReviewDetailView,
          meta: { title: 'Wiki 审核详情', permissions: ['wiki:review'] },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: NotificationsView,
          meta: { title: '通知中心' },
        },
        {
          path: 'dev-pipeline',
          name: 'dev-pipeline',
          component: () => import('../views/DevPipelineView.vue'),
          meta: { title: '开发全链路最佳实践' },
        },
        {
          path: 'agent',
          name: 'agent',
          component: () => import('../views/AgentView.vue'),
          meta: { title: '研途助手', permissions: ['skill:browse'] },
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

router.afterEach((to) => {
  document.title = `${to.meta.title ?? '研发全流程助手'} - 研途助手`
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initialize()
  if (to.name === 'login' && authStore.isAuthenticated) {
    return (to.query.redirect as string) || { name: 'agent' }
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
        {
          path: 'projects',
          name: 'projects',
          component: () => import('../views/ProjectsView.vue'),
          meta: { title: '虚拟项目组' },
        },
        {
          path: 'projects/:projectKey/documents/:documentId',
          name: 'project-document',
          component: () => import('../views/ProjectDocumentView.vue'),
          meta: { title: '项目文档' },
        },
        {
          path: 'document-agent',
          name: 'document-agent',
          component: () => import('../views/DocumentAgentView.vue'),
          meta: { title: '文档 Agent' },
        },
