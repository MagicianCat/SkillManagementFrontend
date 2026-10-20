import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { hasAnyPermission, type Permission } from '../types/permissions'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    permissions?: Permission[]
    roles?: string[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: () => import('../views/OAuthCallbackView.vue'),
      meta: { title: '飞书登录' },
    },
    {
      path: '/m/skills/:skillKey',
      name: 'mobile-skill-detail',
      component: () => import('../views/MobileSkillDetailView.vue'),
      meta: { title: 'Skill 详情', requiresAuth: true, permissions: ['skill:browse'] },
    },
    {
      path: '/ide/authorize',
      name: 'ide-authorize',
      component: () => import('../views/IdeAuthorizeView.vue'),
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
          component: () => import('../views/SkillsView.vue'),
          meta: { title: 'Skill 市场', permissions: ['skill:browse'] },
        },
        {
          path: 'skills/new',
          name: 'skill-create',
          component: () => import('../views/SkillCreateView.vue'),
          meta: { title: '新建 Skill', permissions: ['skill:upload'] },
        },
        {
          path: 'skills/:skillKey',
          name: 'skill-detail',
          component: () => import('../views/SkillDetailView.vue'),
          meta: { title: 'Skill 详情', permissions: ['skill:browse'] },
        },
        {
          path: 'wiki',
          name: 'wiki',
          component: () => import('../views/WikiView.vue'),
          meta: { title: '团队 Wiki', permissions: ['skill:browse'] },
        },
        {
          path: 'admin/external-resources',
          name: 'external-resources',
          component: () => import('../views/ExternalResourcesView.vue'),
          meta: { title: '外部资源接入', permissions: ['admin:identity'] },
        },
        {
          path: 'skills/:skillKey/draft',
          name: 'skill-draft',
          component: () => import('../views/SkillDraftView.vue'),
          meta: { title: '草稿工作台', permissions: ['skill:browse'] },
        },
        {
          path: 'reviews',
          name: 'reviews',
          component: () => import('../views/ReviewsView.vue'),
          meta: { title: '审核中心', permissions: ['skill:review', 'wiki:review'] },
        },
        {
          path: 'wiki-reviews',
          name: 'wiki-reviews',
          component: () => import('../views/WikiReviewsView.vue'),
          meta: { title: 'Wiki 审核', permissions: ['wiki:review'] },
        },
        {
          path: 'agent/mcp-audits',
          name: 'agent-mcp-audits',
          component: () => import('../views/AgentMcpAuditView.vue'),
          meta: { title: 'Agent MCP 审计', permissions: ['admin:audit'] },
        },
        {
          path: 'admin/skill-usage',
          name: 'skill-usage-dashboard',
          component: () => import('../views/SkillUsageDashboardView.vue'),
          meta: { title: 'AI 研发效能看板' },
        },
        {
          path: 'admin/skill-usage/stages/:stage',
          name: 'skill-usage-stage',
          component: () => import('../views/SkillUsageStageView.vue'),
          meta: { title: '研发阶段效能' },
        },
        {
          path: 'admin/skill-usage/teams/:teamId',
          name: 'skill-usage-team',
          component: () => import('../views/SkillUsageTeamView.vue'),
          meta: { title: '团队效能' },
        },
        {
          path: 'admin/skill-usage/projects/:projectKey',
          name: 'skill-usage-project',
          component: () => import('../views/SkillUsageProjectView.vue'),
          meta: { title: '项目效能' },
        },
        {
          path: 'admin/skill-usage/skills/:skillKey',
          name: 'skill-usage-skill',
          component: () => import('../views/SkillUsageSkillView.vue'),
          meta: { title: 'Skill 效果' },
        },
        {
          path: 'organization',
          name: 'organization',
          component: () => import('../views/OrganizationView.vue'),
          meta: { title: '组织与团队权限', permissions: ['admin:identity'], roles: ['TEAM_ADMIN'] },
        },
        {
          path: 'reviews/:reviewId',
          name: 'review-detail',
          component: () => import('../views/ReviewDetailView.vue'),
          meta: { title: '审核详情', permissions: ['skill:review'] },
        },
        {
          path: 'wiki-reviews/:reviewId',
          name: 'wiki-review-detail',
          component: () => import('../views/WikiReviewDetailView.vue'),
          meta: { title: 'Wiki 审核详情', permissions: ['wiki:review'] },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('../views/NotificationsView.vue'),
          meta: { title: '通知中心' },
        },
        {
          path: 'dev-pipeline',
          name: 'dev-pipeline',
          component: () => import('../views/DevPipelineView.vue'),
          meta: { title: '开发全链路最佳实践' },
        },
        {
          path: 'agent-config',
          name: 'agent-config',
          component: () => import('../views/AgentConfigView.vue'),
          meta: { title: 'Agent 配置中心', permissions: ['skill:browse'] },
        },
        {
          path: 'agent-config/:code',
          name: 'agent-config-detail',
          component: () => import('../views/AgentConfigDetailView.vue'),
          meta: { title: 'Agent 配置详情', permissions: ['skill:browse'] },
        },
        {
          path: 'agent',
          name: 'agent',
          component: () => import('../views/AgentView.vue'),
          meta: { title: '研途助手', permissions: ['skill:browse'] },
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('../views/ProjectsView.vue'),
          meta: { title: '虚拟项目组', permissions: ['admin:identity'] },
        },
        {
          path: 'collab-projects',
          alias: 'collab-groups',
          name: 'collab-projects',
          component: () => import('../views/CollabProjectsView.vue'),
          meta: { title: '项目组' },
        },
        {
          path: 'collab-groups/:groupKey',
          name: 'collab-group-detail',
          component: () => import('../views/CollabGroupDetailView.vue'),
          meta: { title: '项目组配置' },
        },
        {
          path: 'collab-groups/:groupKey/requirements/new',
          name: 'collab-requirement-create',
          component: () => import('../views/CollabRequirementCreateView.vue'),
          meta: { title: '新建需求' },
        },
        {
          path: 'collab-requirements/:requirementKey',
          name: 'collab-requirement-detail',
          component: () => import('../views/CollabProjectDetailView.vue'),
          meta: { title: '需求详情' },
        },
        {
          path: 'collab-requirements/:requirementKey/people',
          name: 'collab-requirement-people',
          redirect: to => ({ name: 'collab-requirement-detail', params: { requirementKey: to.params.requirementKey } }),
        },
        {
          path: 'collab-requirements/:requirementKey/stages/:stageKey',
          name: 'collab-requirement-stage',
          component: () => import('../views/CollabStageView.vue'),
          meta: { title: '需求阶段' },
        },
        {
          path: 'collab-requirements/:requirementKey/history',
          name: 'collab-requirement-history',
          component: () => import('../views/CollabProjectHistoryView.vue'),
          meta: { title: '需求历史' },
        },
        {
          path: 'collab-projects/:projectKey',
          name: 'collab-project-detail-legacy',
          redirect: to => ({ name: 'collab-requirement-detail', params: { requirementKey: to.params.projectKey }, query: to.query, hash: to.hash }),
        },
        {
          path: 'collab-projects/:projectKey/stages/:stageKey',
          name: 'collab-stage-legacy',
          redirect: to => ({ name: 'collab-requirement-stage', params: { requirementKey: to.params.projectKey, stageKey: to.params.stageKey }, query: to.query, hash: to.hash }),
        },
        {
          path: 'collab-projects/:projectKey/history',
          name: 'collab-project-history-legacy',
          redirect: to => ({ name: 'collab-requirement-history', params: { requirementKey: to.params.projectKey }, query: to.query, hash: to.hash }),
        },
        {
          path: 'projects/:projectKey/documents/:documentId',
          name: 'project-document',
          component: () => import('../views/ProjectDocumentView.vue'),
          meta: { title: '项目文档', permissions: ['admin:identity'] },
        },
        {
          path: 'projects/:projectKey/stages/:stageKey/agent',
          name: 'document-agent',
          component: () => import('../views/DocumentAgentView.vue'),
          meta: { title: '文档 Agent', permissions: ['admin:identity'] },
        },
        {
          path: 'projects/:projectId/workspace/:runId?',
          name: 'project-workspace',
          component: () => import('../views/ProjectWorkspaceView.vue'),
          meta: { title: '项目工作台', permissions: ['admin:identity'] },
        },
        {
          path: 'projects/:projectKey/code-graph',
          name: 'project-code-graph',
          component: () => import('../views/CodeGraphView.vue'),
          meta: { title: '代码图谱准备', permissions: ['admin:identity'] },
        },
        {
          path: 'projects/:projectKey/setup',
          name: 'project-agent-setup',
          component: () => import('../views/ProjectAgentSetupView.vue'),
          meta: { title: '项目 Agent 配置', permissions: ['admin:identity'] },
        },
        {
          path: '403',
          name: 'forbidden',
          component: () => import('../views/ForbiddenView.vue'),
          meta: { title: '没有访问权限' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') },
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
  const hasPermissions = Boolean(to.meta.permissions?.length)
  const hasRoles = Boolean(to.meta.roles?.length)
  const hasAccess = (!hasPermissions && !hasRoles) ||
    (hasPermissions && hasAnyPermission(authStore.user?.permissions, to.meta.permissions!)) ||
    (hasRoles && to.meta.roles!.some((role) => authStore.user?.roles.includes(role)))
  if (authStore.isAuthenticated && !hasAccess) {
    return { name: 'forbidden' }
  }
  return true
})

export default router
